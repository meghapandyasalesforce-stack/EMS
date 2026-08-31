import { Course, Enrollment, LearningPath, Skill } from '../../models/learning.model.js';
import Employee from '../../models/employee.model.js';
import Organization from '../../models/organization.model.js';
import mongoose from 'mongoose';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../middlewares/asyncHandler.js';
import {
    isExternalCourse,
    validateExternalCourseResource
} from '../../helpers/learningExternalResourceHelper.js';
import { buildManagerMatchQuery, isEmployeeLinkedToManager } from '../../helpers/managerHelper.js';
import { shouldScopeDataToManagedTeam } from '../../helpers/permissionService.js';
import { renderHtmlToPdfBuffer } from '../../helpers/htmlToPdfBuffer.js';
import {
    buildLearningCertificateHtml,
    buildCertificateFileName
} from '../../helpers/learningCertificateHtml.js';

/**
 * Create course
 */
export const createCourse = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const createdBy = req.user?._id || req.employee?._id;
    const resourceError = validateExternalCourseResource(req.body);

    if (resourceError) {
        return res.status(400).json({ success: false, message: resourceError });
    }

    const course = new Course({
        ...req.body,
        organizationId,
        createdBy
    });

    await course.save();

    res.status(201).json({
        success: true,
        message: 'Course created successfully',
        data: course
    });
});

/**
 * Admin/HR: Get all courses (all statuses)
 */
export const getAdminCourses = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { category, status, level, page = 1, limit = 50 } = req.query;

    const query = addOrganizationFilter(req, {});
    if (category) query.category = category;
    if (level) query.level = level;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const courses = await Course.find(query)
        .populate('instructor', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Course.countDocuments(query);

    res.json({
        success: true,
        data: courses,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

/**
 * Admin/HR: Get single course by id
 */
export const getAdminCourseById = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { id } = req.params;

    const course = await Course.findOne({ _id: id, organizationId }).populate('instructor', 'name email');
    if (!course) {
        return res.status(404).json({
            success: false,
            message: 'Course not found'
        });
    }

    res.json({
        success: true,
        data: course
    });
});

/**
 * Admin/HR: Update course
 */
export const updateCourse = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { id } = req.params;

    const course = await Course.findOne({ _id: id, organizationId });
    if (!course) {
        return res.status(404).json({
            success: false,
            message: 'Course not found'
        });
    }

    const nextCourse = { ...course.toObject(), ...req.body };
    const resourceError = validateExternalCourseResource(nextCourse);
    if (resourceError) {
        return res.status(400).json({ success: false, message: resourceError });
    }

    Object.assign(course, req.body);
    await course.save();

    // Recalculate enrollment progress whenever module structure changes.
    // This keeps existing enrollments in sync when HR adds/removes modules.
    const enrollments = isExternalCourse(course)
        ? []
        : await Enrollment.find({
            organizationId,
            courseId: course._id
        });

    const totalModules = Array.isArray(course.content) ? course.content.length : 0;

    await Promise.all(
        enrollments.map(async (enrollment) => {
            const completedModulesCountRaw = Array.isArray(enrollment.completedModules)
                ? enrollment.completedModules.length
                : 0;
            const completedModulesCount = Math.min(completedModulesCountRaw, totalModules || completedModulesCountRaw);

            const nextProgress =
                totalModules > 0
                    ? Math.round((completedModulesCount / totalModules) * 100)
                    : 0;

            enrollment.progress = Math.max(0, Math.min(100, nextProgress));

            if (enrollment.progress >= 100 && totalModules > 0) {
                enrollment.status = 'Completed';
                if (!enrollment.completionDate) {
                    enrollment.completionDate = new Date();
                }
            } else if (enrollment.status === 'Completed') {
                enrollment.status = completedModulesCount > 0 ? 'In Progress' : 'Enrolled';
                enrollment.completionDate = undefined;
            } else if (enrollment.progress > 0 && enrollment.status === 'Enrolled') {
                enrollment.status = 'In Progress';
            } else if (enrollment.progress === 0 && enrollment.status === 'In Progress') {
                enrollment.status = 'Enrolled';
            }

            await enrollment.save();
        })
    );

    const updatedCourse = await Course.findById(course._id).populate('instructor', 'name email');
    res.json({
        success: true,
        message: 'Course updated successfully',
        data: updatedCourse
    });
});

/**
 * Get all courses
 */
export const getCourses = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { category, status, level, page = 1, limit = 20 } = req.query;

    const query = addOrganizationFilter(req, { status: 'Published' });

    if (category) query.category = category;
    if (level) query.level = level;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const courses = await Course.find(query)
        .populate('instructor', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Course.countDocuments(query);

    res.json({
        success: true,
        data: courses,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

/**
 * Enroll in course
 */
export const enrollInCourse = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { courseId } = req.params;
    const employeeId = req.employee?._id || req.user?._id;

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
        organizationId,
        courseId,
        employeeId
    });

    if (existingEnrollment) {
        return res.status(400).json({
            success: false,
            message: 'Already enrolled in this course'
        });
    }

    // Check course availability
    const course = await Course.findOne({ _id: courseId, organizationId });
    if (!course) {
        return res.status(404).json({
            success: false,
            message: 'Course not found'
        });
    }

    if (course.status !== 'Published' || course.enrollmentType === 'Assigned Only') {
        return res.status(400).json({
            success: false,
            message: course.enrollmentType === 'Assigned Only'
                ? 'This course is available by assignment only'
                : 'Course is not available for enrollment'
        });
    }

    if (course.maxEnrollments && course.currentEnrollments >= course.maxEnrollments) {
        return res.status(400).json({
            success: false,
            message: 'Course is full'
        });
    }

    const enrollmentData = {
        organizationId,
        courseId,
        employeeId,
        assignedBy: req.employee?._id
    };
    if (!isExternalCourse(course)) {
        enrollmentData.startDate = new Date();
    }

    const enrollment = new Enrollment(enrollmentData);

    await enrollment.save();

    // Update course enrollment count
    course.currentEnrollments += 1;
    await course.save();

    res.status(201).json({
        success: true,
        message: 'Enrolled in course successfully',
        data: enrollment
    });
});

/**
 * Get employee enrollments (current user only)
 */
export const getEmployeeEnrollments = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employeeId = req.employee?._id || req.params.employeeId;

    if (!employeeId) {
        return res.json({
            success: true,
            data: []
        });
    }

    const enrollments = await Enrollment.find({
        organizationId,
        employeeId
    })
        .populate(
            'courseId',
            'title description category status duration level provider resourceType externalUrl thumbnail isMandatory certificate skills'
        )
        .populate('employeeId', 'name lastName email employeeId department')
        .sort({ enrollmentDate: -1 });

    res.json({
        success: true,
        data: enrollments
    });
});

/**
 * Admin/HR: Get all learning enrollments for the organization
 */
export const getAllLearningEnrollments = asyncHandler(async (req, res) => {
    const { status, courseId, employeeId, page = 1, limit = 200 } = req.query;

    const query = addOrganizationFilter(req, {});
    if (status) query.status = status;
    if (courseId) query.courseId = courseId;
    if (employeeId) query.employeeId = employeeId;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const parsedLimit = parseInt(limit, 10);

    const [enrollments, total] = await Promise.all([
        Enrollment.find(query)
            .populate(
                'courseId',
                'title category status duration level provider resourceType externalUrl thumbnail isMandatory certificate'
            )
            .populate('employeeId', 'name lastName email employeeId department')
            .populate('assignmentTarget.teamManagerId', 'name lastName email')
            .sort({ enrollmentDate: -1 })
            .skip(skip)
            .limit(parsedLimit),
        Enrollment.countDocuments(query)
    ]);

    res.json({
        success: true,
        data: enrollments,
        pagination: {
            page: parseInt(page, 10),
            limit: parsedLimit,
            total,
            pages: Math.ceil(total / parsedLimit) || 1
        }
    });
});

/**
 * Admin/HR: list line-manager teams available as learning assignment targets.
 */
export const getLearningAssignmentTeams = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const activeEmployees = await Employee.find({
        organizationId,
        status: 'active'
    })
        .select('_id name lastName email managerId functionalRoles position jobTitle')
        .lean();

    const employeeById = new Map(
        activeEmployees.map((employee) => [String(employee._id), employee])
    );
    const managerIds = new Set(
        activeEmployees
            .map((employee) => employee.managerId)
            .filter(Boolean)
            .map(String)
    );

    activeEmployees.forEach((employee) => {
        if (
            employee.functionalRoles?.includes('manager') ||
            /manager|director/i.test(`${employee.position || ''} ${employee.jobTitle || ''}`)
        ) {
            managerIds.add(String(employee._id));
        }
    });

    const teams = (
        await Promise.all(
            [...managerIds].map(async (managerId) => {
                const manager = employeeById.get(managerId);
                if (!manager) return null;

                const managerQuery = buildManagerMatchQuery(manager);
                const memberCount = managerQuery
                    ? await Employee.countDocuments({
                        organizationId,
                        status: 'active',
                        ...managerQuery
                    })
                    : 0;

                if (memberCount === 0) return null;
                return {
                    managerId: manager._id,
                    managerName:
                        `${manager.name || ''} ${manager.lastName || ''}`.trim() ||
                        manager.email,
                    memberCount
                };
            })
        )
    )
        .filter(Boolean)
        .sort((a, b) => a.managerName.localeCompare(b.managerName));

    res.json({ success: true, data: teams });
});

/**
 * Admin/HR: assign a published course to employees or every active member of a team.
 */
export const assignCourse = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const assignedBy = req.employee?._id || req.user?._id;
    const {
        courseId,
        employeeIds = [],
        teamManagerId,
        dueDate,
        priority = 'Medium'
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
        return res.status(400).json({ success: false, message: 'A valid course is required' });
    }

    let assignmentTarget = { type: 'individual' };
    let requestedEmployeeIds = Array.isArray(employeeIds) ? employeeIds.map(String) : [];

    if (teamManagerId) {
        if (!mongoose.Types.ObjectId.isValid(teamManagerId)) {
            return res.status(400).json({ success: false, message: 'Select a valid team' });
        }

        const manager = await Employee.findOne({
            _id: teamManagerId,
            organizationId,
            status: 'active'
        }).select('_id name lastName');
        if (!manager) {
            return res.status(404).json({ success: false, message: 'Team manager not found' });
        }

        const managerQuery = buildManagerMatchQuery(manager);
        const teamMembers = managerQuery
            ? await Employee.find({
                organizationId,
                status: 'active',
                ...managerQuery
            }).select('_id')
            : [];

        requestedEmployeeIds = teamMembers.map((member) => String(member._id));
        assignmentTarget = {
            type: 'team',
            teamManagerId: manager._id,
            teamName: `${manager.name || ''} ${manager.lastName || ''}`.trim()
        };
    }

    const uniqueEmployeeIds = [...new Set(requestedEmployeeIds)];
    if (
        uniqueEmployeeIds.length === 0 ||
        uniqueEmployeeIds.some((id) => !mongoose.Types.ObjectId.isValid(id))
    ) {
        return res.status(400).json({
            success: false,
            message: 'Select at least one valid employee'
        });
    }

    const course = await Course.findOne({
        _id: courseId,
        organizationId,
        status: 'Published'
    });
    if (!course) {
        return res.status(404).json({
            success: false,
            message: 'Published course not found'
        });
    }

    if (course.isMandatory && !dueDate) {
        return res.status(400).json({
            success: false,
            message: 'Due date is required for mandatory courses'
        });
    }

    let parsedDueDate;
    if (dueDate) {
        parsedDueDate = new Date(dueDate);
        if (Number.isNaN(parsedDueDate.getTime())) {
            return res.status(400).json({ success: false, message: 'Due date is invalid' });
        }
    }

    const employees = await Employee.find({
        _id: { $in: uniqueEmployeeIds },
        organizationId,
        status: 'active'
    }).select('_id');

    if (employees.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'No active employees matched the selection'
        });
    }

    const employeeObjectIds = employees.map((employee) => employee._id);
    const existing = await Enrollment.find({
        organizationId,
        courseId: course._id,
        employeeId: { $in: employeeObjectIds }
    }).select('employeeId');
    const existingEmployeeIds = new Set(existing.map((item) => String(item.employeeId)));
    const newEmployeeIds = employeeObjectIds.filter(
        (employeeId) => !existingEmployeeIds.has(String(employeeId))
    );

    if (newEmployeeIds.length > 0) {
        await Enrollment.insertMany(
            newEmployeeIds.map((employeeId) => ({
                organizationId,
                courseId: course._id,
                employeeId,
                assignedBy,
                assignmentTarget,
                dueDate: parsedDueDate,
                priority
            }))
        );
        course.currentEnrollments = (course.currentEnrollments || 0) + newEmployeeIds.length;
        await course.save();
    }

    const assignments = await Enrollment.find({
        organizationId,
        courseId: course._id,
        employeeId: { $in: employeeObjectIds }
    })
        .populate('courseId', 'title provider resourceType isMandatory')
        .populate('employeeId', 'name lastName email employeeId department position jobTitle')
        .populate('assignmentTarget.teamManagerId', 'name lastName email');

    res.status(newEmployeeIds.length > 0 ? 201 : 200).json({
        success: true,
        message: newEmployeeIds.length > 0
            ? `Course assigned to ${newEmployeeIds.length} employee${newEmployeeIds.length === 1 ? '' : 's'}`
            : 'Selected employees are already assigned',
        data: assignments,
        summary: {
            requested: uniqueEmployeeIds.length,
            assigned: newEmployeeIds.length,
            alreadyAssigned: existing.length,
            inactiveOrUnavailable: uniqueEmployeeIds.length - employees.length,
            targetType: assignmentTarget.type,
            teamName: assignmentTarget.teamName
        }
    });
});

const getOwnedExternalEnrollment = async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employeeId = req.employee?._id;
    if (!employeeId) {
        res.status(403).json({
            success: false,
            message: 'An employee profile is required to update learning status'
        });
        return null;
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400).json({ success: false, message: 'Invalid enrollment ID' });
        return null;
    }

    const enrollment = await Enrollment.findOne({
        _id: req.params.id,
        organizationId,
        employeeId
    }).populate('courseId');

    if (!enrollment) {
        res.status(404).json({ success: false, message: 'Enrollment not found' });
        return null;
    }
    if (!isExternalCourse(enrollment.courseId)) {
        res.status(400).json({
            success: false,
            message: 'Use module progress for this course'
        });
        return null;
    }
    return enrollment;
};

/**
 * Employee: start an assigned or self-enrolled external course.
 */
export const startExternalLearning = asyncHandler(async (req, res) => {
    const enrollment = await getOwnedExternalEnrollment(req, res);
    if (!enrollment) return;

    if (enrollment.status === 'Completed') {
        return res.status(400).json({
            success: false,
            message: 'Completed learning cannot be restarted'
        });
    }

    const now = new Date();
    enrollment.status = 'In Progress';
    enrollment.startedAt = enrollment.startedAt || now;
    enrollment.startDate = enrollment.startDate || now;
    enrollment.lastAccessedDate = now;
    await enrollment.save();

    res.json({
        success: true,
        message: 'Learning started',
        data: enrollment
    });
});

/**
 * Mark an external enrollment complete and credit the course skills to the employee.
 */
const finalizeExternalCompletion = async (enrollment) => {
    const now = new Date();
    enrollment.status = 'Completed';
    enrollment.startedAt = enrollment.startedAt || now;
    enrollment.startDate = enrollment.startDate || now;
    enrollment.completedAt = now;
    enrollment.completionDate = now;
    enrollment.completionSource = 'self';
    enrollment.progress = 100;
    enrollment.lastAccessedDate = now;
    await enrollment.save();

    const courseSkills = Array.isArray(enrollment.courseId?.skills)
        ? enrollment.courseId.skills.map((skill) => String(skill).trim()).filter(Boolean)
        : [];
    if (courseSkills.length > 0) {
        const skillCategory = ['Technical', 'Soft Skills'].includes(enrollment.courseId.category)
            ? enrollment.courseId.category
            : 'Other';
        const proficiencyLevel = ['Beginner', 'Intermediate', 'Advanced', 'Expert'].includes(
            enrollment.courseId.level
        )
            ? enrollment.courseId.level
            : 'Beginner';

        await Promise.all(
            courseSkills.map((skillName) =>
                Skill.findOneAndUpdate(
                    { organizationId: enrollment.organizationId, employeeId: enrollment.employeeId, skillName },
                    {
                        $setOnInsert: {
                            organizationId: enrollment.organizationId,
                            employeeId: enrollment.employeeId,
                            skillName,
                            category: skillCategory,
                            proficiencyLevel,
                            verified: false,
                            notes: `Added after completing ${enrollment.courseId.title}`
                        }
                    },
                    { upsert: true, new: true, runValidators: true }
                )
            )
        );
    }
};

/**
 * Employee: self-attest completion of an external course.
 */
export const completeExternalLearning = asyncHandler(async (req, res) => {
    const enrollment = await getOwnedExternalEnrollment(req, res);
    if (!enrollment) return;

    if (enrollment.status === 'Completed') {
        return res.json({
            success: true,
            message: 'Learning is already completed',
            data: enrollment
        });
    }

    await finalizeExternalCompletion(enrollment);

    res.json({
        success: true,
        message: 'Learning marked as completed',
        data: enrollment
    });
});

/**
 * Employee: self-report how far they are through an external course.
 * External content lives off-platform, so the learner is the only source of progress.
 */
export const updateExternalLearningProgress = asyncHandler(async (req, res) => {
    const enrollment = await getOwnedExternalEnrollment(req, res);
    if (!enrollment) return;

    const progress = Number(req.body?.progress);
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
        return res.status(400).json({
            success: false,
            message: 'Progress must be a number between 0 and 100'
        });
    }

    if (enrollment.status === 'Completed') {
        return res.status(400).json({
            success: false,
            message: 'Completed learning cannot be updated'
        });
    }

    // Player-reported progress restarts from zero on replay, so it may only move forward.
    const isAutoReported = req.body?.source === 'auto';
    let roundedProgress = isAutoReported
        ? Math.max(Math.round(progress), enrollment.progress || 0)
        : Math.round(progress);

    // A playlist is scored per video: skipping an item leaves that item at zero instead of
    // crediting everything before the current one.
    const playlistItem = req.body?.playlistItem;
    if (playlistItem && Number.isFinite(Number(playlistItem.index))) {
        const totalItems = Math.max(Number(playlistItem.totalItems) || 0, 1);
        const itemIndex = Number(playlistItem.index);
        const itemPercent = Math.max(0, Math.min(100, Math.round(Number(playlistItem.percent) || 0)));

        const items = enrollment.playlistProgress?.items || [];
        const existing = items.find((item) => item.index === itemIndex);

        if (existing) {
            existing.percent = Math.max(existing.percent || 0, itemPercent);
            existing.videoId = playlistItem.videoId || existing.videoId;
            if (existing.percent >= 95 && !existing.completedAt) existing.completedAt = new Date();
        } else {
            items.push({
                index: itemIndex,
                videoId: playlistItem.videoId,
                percent: itemPercent,
                completedAt: itemPercent >= 95 ? new Date() : undefined
            });
        }

        const trackedItems = items.filter((item) => item.index < totalItems);
        const watchedTotal = trackedItems.reduce((sum, item) => sum + (item.percent || 0), 0);

        enrollment.playlistProgress = { totalItems, items: trackedItems };
        roundedProgress = Math.round(watchedTotal / totalItems);
    }

    if (roundedProgress >= 100) {
        await finalizeExternalCompletion(enrollment);
        return res.json({
            success: true,
            message: 'Learning marked as completed',
            data: enrollment
        });
    }

    const now = new Date();
    enrollment.progress = roundedProgress;
    enrollment.status = roundedProgress > 0 ? 'In Progress' : 'Enrolled';
    if (roundedProgress > 0) {
        enrollment.startedAt = enrollment.startedAt || now;
        enrollment.startDate = enrollment.startDate || now;
    }
    enrollment.lastAccessedDate = now;
    await enrollment.save();

    res.json({
        success: true,
        message: 'Progress updated',
        data: enrollment
    });
});

/**
 * Update enrollment progress
 */
export const updateEnrollmentProgress = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const { moduleId, score } = req.body;

    const enrollment = await Enrollment.findOne({
        _id: id,
        organizationId
    });

    if (!enrollment) {
        return res.status(404).json({
            success: false,
            message: 'Enrollment not found'
        });
    }

    // Check if module already completed
    const existingModule = enrollment.completedModules.find(
        m => m.moduleId.toString() === moduleId
    );

    if (!existingModule) {
        enrollment.completedModules.push({
            moduleId,
            completedDate: new Date(),
            score
        });
    }

    // Calculate overall progress
    const course = await Course.findById(enrollment.courseId);
    if (course) {
        const totalModules = course.content.length;
        const completedModules = enrollment.completedModules.length;
        enrollment.progress = Math.round((completedModules / totalModules) * 100);

        if (enrollment.progress === 100 && enrollment.status !== 'Completed') {
            enrollment.status = 'Completed';
            const completedAt = new Date();
            enrollment.completionDate = completedAt;
            enrollment.completedAt = completedAt;
            enrollment.completionSource = 'module_progress';
        }
    }

    enrollment.lastAccessedDate = new Date();
    await enrollment.save();

    res.json({
        success: true,
        message: 'Progress updated successfully',
        data: enrollment
    });
});

/**
 * Add/Update skill
 */
export const upsertSkill = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employeeId = req.employee?._id || req.params.employeeId;
    const { skillName, proficiencyLevel, category } = req.body;

    const skill = await Skill.findOneAndUpdate(
        {
            organizationId,
            employeeId,
            skillName
        },
        {
            ...req.body,
            organizationId,
            employeeId
        },
        {
            new: true,
            upsert: true,
            runValidators: true
        }
    );

    res.json({
        success: true,
        message: 'Skill updated successfully',
        data: skill
    });
});

/**
 * Get employee skills
 */
export const getEmployeeSkills = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employeeId = req.employee?._id || req.params.employeeId;

    const skills = await Skill.find({
        organizationId,
        employeeId
    }).sort({ skillName: 1 });

    res.json({
        success: true,
        data: skills
    });
});

/**
 * Create learning path
 */
export const createLearningPath = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const createdBy = req.user?._id || req.employee?._id;

    const learningPath = new LearningPath({
        ...req.body,
        organizationId,
        createdBy
    });

    await learningPath.save();

    res.status(201).json({
        success: true,
        message: 'Learning path created successfully',
        data: learningPath
    });
});

/**
 * Get learning paths
 */
export const getLearningPaths = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { status } = req.query;

    const query = addOrganizationFilter(req, {});

    if (status) query.status = status;

    const learningPaths = await LearningPath.find(query)
        .populate('courses.courseId')
        .populate('targetRoles')
        .sort({ createdAt: -1 });

    res.json({
        success: true,
        data: learningPaths
    });
});

/**
 * Generate certificate for completed course
 */
/**
 * Stamp a certificate onto a completed enrollment. Existing certificates are kept so the
 * certificate id an employee has already seen stays stable.
 */
const issueEnrollmentCertificate = async (enrollment, { reissue = false } = {}) => {
    if (enrollment.certificate?.issued && !reissue) return enrollment.certificate;

    const course = enrollment.courseId;
    const employee = enrollment.employeeId;
    const certificateId = `CERT-${employee?.employeeId || employee?._id || enrollment.employeeId}-${
        course?._id || enrollment.courseId
    }-${Date.now()}`;

    let expiryDate = null;
    if (course?.certificate?.validityPeriod) {
        expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + course.certificate.validityPeriod);
    }

    enrollment.certificate = {
        issued: true,
        certificateId,
        issuedDate: new Date(),
        expiryDate,
        certificateUrl: `/certificates/${certificateId}`
    };

    await enrollment.save();
    return enrollment.certificate;
};

export const generateCertificate = asyncHandler(async (req, res) => {
    const { enrollmentId } = req.params;
    const organizationId = getOrganizationId(req);

    const enrollment = await Enrollment.findOne({
        _id: enrollmentId,
        organizationId,
        status: 'Completed'
    }).populate('courseId').populate('employeeId');

    if (!enrollment) {
        return res.status(404).json({
            success: false,
            message: 'Completed enrollment not found'
        });
    }

    const course = enrollment.courseId;
    if (!course || !course.certificate?.enabled) {
        return res.status(400).json({
            success: false,
            message: 'Certificate not enabled for this course'
        });
    }

    await issueEnrollmentCertificate(enrollment, { reissue: true });

    res.json({
        success: true,
        message: 'Certificate generated successfully',
        data: {
            enrollment,
            certificate: enrollment.certificate
        }
    });
});

/**
 * Loads a completed enrollment and authorizes the viewer, issuing the certificate on
 * first access. The learner sees their own; HR, executives, admins see anyone's; line
 * managers see their direct reports'.
 *
 * @returns {Promise<{ error?: { status: number, message: string }, certificate?: object }>}
 */
const resolveCertificateForViewer = async (req) => {
    const organizationId = getOrganizationId(req);
    const viewerEmployeeId = req.employee?._id;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return { error: { status: 400, message: 'Invalid enrollment ID' } };
    }

    const enrollment = await Enrollment.findOne({
        _id: req.params.id,
        organizationId
    })
        .populate('courseId')
        .populate(
            'employeeId',
            'name lastName email employeeId department jobTitle position manager managerId'
        );

    if (!enrollment) {
        return { error: { status: 404, message: 'Enrollment not found' } };
    }

    const ctx = req.authContext;
    const canViewAnyCertificate = Boolean(
        req.user || ctx?.isOrgOwner || ctx?.isHrManager || ctx?.isHrExecutive || ctx?.isExecutive
    );
    const isOwnCertificate =
        viewerEmployeeId &&
        String(enrollment.employeeId?._id || enrollment.employeeId) === String(viewerEmployeeId);
    const isTeamCertificate =
        shouldScopeDataToManagedTeam(req) &&
        isEmployeeLinkedToManager(enrollment.employeeId, req.employee);

    if (!canViewAnyCertificate && !isOwnCertificate && !isTeamCertificate) {
        return { error: { status: 403, message: 'You do not have access to this certificate' } };
    }
    if (enrollment.status !== 'Completed') {
        return {
            error: {
                status: 400,
                message: isOwnCertificate
                    ? 'Complete the course to unlock your certificate'
                    : 'This employee has not completed the course yet'
            }
        };
    }

    const course = enrollment.courseId;
    if (!course?.certificate?.enabled) {
        return { error: { status: 400, message: 'Certificate is not enabled for this course' } };
    }

    await issueEnrollmentCertificate(enrollment);

    const organization = await Organization.findById(organizationId)
        .select('name legalName logo emailBranding.logoUrl')
        .lean();
    const employee = enrollment.employeeId;

    return {
        certificate: {
            enrollmentId: String(enrollment._id),
            certificateId: enrollment.certificate.certificateId,
            issuedDate: enrollment.certificate.issuedDate,
            expiryDate: enrollment.certificate.expiryDate,
            employeeName:
                `${employee?.name || ''} ${employee?.lastName || ''}`.trim() || employee?.email,
            employeeCode: employee?.employeeId || null,
            courseTitle: course.title,
            courseProvider: course.provider || null,
            courseCategory: course.category || null,
            courseDuration: course.duration || null,
            completedDate: enrollment.completedAt || enrollment.completionDate,
            organizationName: organization?.name || organization?.legalName || null,
            organizationLogo:
                organization?.logo?.url || organization?.emailBranding?.logoUrl || null
        }
    };
};

/**
 * GET /api/v1/both/learning/enrollments/:id/certificate
 */
export const getEnrollmentCertificate = asyncHandler(async (req, res) => {
    const { error, certificate } = await resolveCertificateForViewer(req);
    if (error) {
        return res.status(error.status).json({ success: false, message: error.message });
    }

    res.json({ success: true, message: 'Certificate ready', data: certificate });
});

/**
 * Download the certificate as a PDF attachment.
 * GET /api/v1/both/learning/enrollments/:id/certificate/download
 */
export const downloadEnrollmentCertificate = asyncHandler(async (req, res) => {
    const { error, certificate } = await resolveCertificateForViewer(req);
    if (error) {
        return res.status(error.status).json({ success: false, message: error.message });
    }

    const html = buildLearningCertificateHtml(certificate);
    // A certificate is a single full-bleed page: no page numbers, no Puppeteer margins.
    const rendered = await renderHtmlToPdfBuffer(html, {
        includePageNumbers: false,
        marginMm: 0
    });
    // Puppeteer's page.pdf() returns a Uint8Array; Express only sends real Buffers as
    // binary (otherwise it JSON-stringifies), so coerce before sending.
    const pdfBuffer = Buffer.isBuffer(rendered) ? rendered : Buffer.from(rendered);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
        'Content-Disposition',
        `attachment; filename="${buildCertificateFileName(certificate)}"`
    );
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
});

/**
 * Get learning analytics
 */
export const getLearningAnalytics = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
        dateFilter.enrollmentDate = {};
        if (startDate) dateFilter.enrollmentDate.$gte = new Date(startDate);
        if (endDate) dateFilter.enrollmentDate.$lte = new Date(endDate);
    }

    const [totalCourses, activeCourses, totalEnrollments, completedEnrollments,
           enrollmentsByStatus, enrollmentsByCategory, avgCompletionRate, 
           certificatesIssued, topCourses] = await Promise.all([
        Course.countDocuments({ organizationId }),
        Course.countDocuments({ organizationId, status: 'Published' }),
        Enrollment.countDocuments({ organizationId, ...dateFilter }),
        Enrollment.countDocuments({ organizationId, status: 'Completed', ...dateFilter }),
        Enrollment.aggregate([
            { $match: { organizationId, ...dateFilter } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        Enrollment.aggregate([
            { $match: { organizationId, ...dateFilter } },
            { $lookup: { from: 'courses', localField: 'courseId', foreignField: '_id', as: 'course' } },
            { $unwind: '$course' },
            { $group: { _id: '$course.category', count: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } } } }
        ]),
        Enrollment.aggregate([
            { $match: { organizationId, ...dateFilter } },
            {
                $group: {
                    _id: null,
                    avgProgress: { $avg: '$progress' },
                    avgScore: { $avg: '$score' }
                }
            }
        ]),
        Enrollment.countDocuments({ organizationId, 'certificate.issued': true, ...dateFilter }),
        Enrollment.aggregate([
            { $match: { organizationId, ...dateFilter } },
            { $lookup: { from: 'courses', localField: 'courseId', foreignField: '_id', as: 'course' } },
            { $unwind: '$course' },
            { $group: { _id: '$courseId', courseTitle: { $first: '$course.title' }, enrollments: { $sum: 1 }, completions: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } } } },
            { $sort: { enrollments: -1 } },
            { $limit: 10 }
        ])
    ]);

    const completionRate = totalEnrollments > 0 
        ? ((completedEnrollments / totalEnrollments) * 100).toFixed(2)
        : 0;

    res.json({
        success: true,
        data: {
            courses: {
                total: totalCourses,
                active: activeCourses
            },
            enrollments: {
                total: totalEnrollments,
                completed: completedEnrollments,
                completionRate: parseFloat(completionRate)
            },
            enrollmentsByStatus,
            enrollmentsByCategory,
            averageMetrics: avgCompletionRate[0] || {},
            certificatesIssued,
            topCourses
        }
    });
});

/**
 * Calculate training ROI
 */
export const calculateTrainingROI = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { courseId, startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
        dateFilter.enrollmentDate = {};
        if (startDate) dateFilter.enrollmentDate.$gte = new Date(startDate);
        if (endDate) dateFilter.enrollmentDate.$lte = new Date(endDate);
    }

    const query = { organizationId, status: 'Completed', ...dateFilter };
    if (courseId) query.courseId = courseId;

    const [enrollments, courses] = await Promise.all([
        Enrollment.find(query).populate('courseId').lean(),
        courseId ? Course.find({ _id: courseId, organizationId }).lean() : Course.find({ organizationId }).lean()
    ]);

    // Calculate costs (simplified - should come from actual cost data)
    const totalCost = courses.reduce((sum, course) => {
        const courseEnrollments = enrollments.filter(e => e.courseId._id.toString() === course._id.toString());
        const instructorCost = course.instructor ? 0 : (course.externalInstructor ? 5000 : 0); // External instructor cost
        const platformCost = courseEnrollments.length * 50; // Per enrollment cost
        return sum + instructorCost + platformCost;
    }, 0);

    // Calculate benefits (simplified - should be based on performance improvements)
    const avgScore = enrollments.reduce((sum, e) => sum + (e.score || 0), 0) / (enrollments.length || 1);
    const estimatedBenefit = enrollments.length * avgScore * 10; // Simplified benefit calculation

    const roi = totalCost > 0 
        ? (((estimatedBenefit - totalCost) / totalCost) * 100).toFixed(2)
        : 0;

    res.json({
        success: true,
        data: {
            totalCost,
            estimatedBenefit,
            roi: parseFloat(roi),
            enrollmentsCount: enrollments.length,
            coursesCount: courses.length
        }
    });
});

/**
 * Get recommended learning paths for employee
 */
export const getRecommendedLearningPaths = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employeeId = req.employee?._id || req.params.employeeId;

    const employee = await Employee.findById(employeeId);
    if (!employee) {
        return res.status(404).json({
            success: false,
            message: 'Employee not found'
        });
    }

    // Get learning paths matching employee's role/department
    const learningPaths = await LearningPath.find({
        organizationId,
        status: 'Active',
        $or: [
            { targetDepartments: { $in: [employee.department] } },
            { targetRoles: { $in: [employee.assignedRole] } },
            { targetDepartments: { $size: 0 }, targetRoles: { $size: 0 } } // General paths
        ]
    })
        .populate('courses.courseId')
        .limit(5);

    res.json({
        success: true,
        data: learningPaths
    });
});

