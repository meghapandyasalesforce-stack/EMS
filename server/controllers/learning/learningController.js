import { Course, Enrollment, LearningPath, Skill } from '../../models/learning.model.js';
import Employee from '../../models/employee.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../middlewares/asyncHandler.js';

/**
 * Create course
 */
export const createCourse = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const createdBy = req.user?._id || req.employee?._id;

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

    if (course.maxEnrollments && course.currentEnrollments >= course.maxEnrollments) {
        return res.status(400).json({
            success: false,
            message: 'Course is full'
        });
    }

    const enrollment = new Enrollment({
        organizationId,
        courseId,
        employeeId,
        assignedBy: req.user?._id || req.employee?._id,
        startDate: new Date()
    });

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
 * Get employee enrollments
 */
export const getEmployeeEnrollments = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employeeId = req.employee?._id || req.params.employeeId;

    const enrollments = await Enrollment.find({
        organizationId,
        employeeId
    })
        .populate('courseId')
        .sort({ enrollmentDate: -1 });

    res.json({
        success: true,
        data: enrollments
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
            enrollment.completionDate = new Date();
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

    // Generate certificate ID
    const certificateId = `CERT-${enrollment.employeeId.employeeId || enrollment.employeeId._id}-${course._id}-${Date.now()}`;
    
    // Calculate expiry date if validity period is set
    let expiryDate = null;
    if (course.certificate.validityPeriod) {
        expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + course.certificate.validityPeriod);
    }

    enrollment.certificate = {
        issued: true,
        certificateId,
        issuedDate: new Date(),
        expiryDate,
        certificateUrl: `/certificates/${certificateId}` // This would be generated by a service
    };

    await enrollment.save();

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

