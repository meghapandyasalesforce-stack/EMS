import { OneOnOne } from '../../models/oneOnOne.model.js';
import Employee from '../../models/employee.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import { sendNotificationToUsers } from '../../helpers/notificationService.js';
import { getManagerEmployeeIds } from '../../helpers/managerHelper.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../middlewares/asyncHandler.js';

/**
 * Create one-on-one meeting
 */
export const createOneOnOne = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const managerId = req.employee?._id || req.user?._id;

    if (!req.body.employeeId) {
        return res.status(400).json({
            success: false,
            message: 'Employee ID is required'
        });
    }

    const oneOnOne = new OneOnOne({
        ...req.body,
        organizationId,
        managerId
    });

    await oneOnOne.save();

    // Populate for notification
    await oneOnOne.populate('employeeId', 'name lastName email');
    await oneOnOne.populate('managerId', 'name lastName email');

    // Send notification to employee
    try {
        const manager = oneOnOne.managerId;
        const employee = oneOnOne.employeeId;
        const managerName = manager ? `${manager.name} ${manager.lastName || ''}`.trim() : 'Your Manager';
        
        const scheduledDate = new Date(oneOnOne.scheduledDate);
        const formattedDate = scheduledDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        const formattedTime = oneOnOne.scheduledTime || 'TBD';
        
        const message = `${managerName} has scheduled a one-on-one meeting with you on ${formattedDate} at ${formattedTime}`;
        
        await sendNotificationToUsers(
            [oneOnOne.employeeId._id],
            req.employee || req.user,
            message,
            'general',
            {
                oneOnOneId: oneOnOne._id,
                type: 'one_on_one',
                scheduledDate: oneOnOne.scheduledDate,
                scheduledTime: oneOnOne.scheduledTime
            }
        );

        logger.info('One-on-one notification sent', {
            oneOnOneId: oneOnOne._id,
            employeeId: oneOnOne.employeeId._id,
            managerId: managerId
        });
    } catch (notificationError) {
        logger.error('Error sending one-on-one notification', {
            error: notificationError.message,
            oneOnOneId: oneOnOne._id
        });
        // Don't fail the request if notification fails
    }

    res.status(201).json({
        success: true,
        message: 'One-on-one meeting scheduled successfully',
        data: oneOnOne
    });
});

/**
 * Get one-on-one meetings
 */
export const getOneOnOnes = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { managerId, employeeId, status, startDate, endDate } = req.query;
    const currentUserId = req.employee?._id || req.user?._id;

    const query = addOrganizationFilter(req, {});

    // If user is a manager, show meetings they created or with their team members
    if (req.employee?.isManager && !req.employee?.isHR && !req.user) {
        const managerEmployeeIds = await getManagerEmployeeIds(Employee, organizationId, req.employee);
        
        query.$or = [
            { managerId: req.employee._id }, // Meetings created by this manager
            { employeeId: { $in: managerEmployeeIds } } // Meetings with their team members
        ];
    } else if (currentUserId && !req.user) {
        // Regular employees see meetings where they are the employee
        query.employeeId = currentUserId;
    }

    if (managerId) query.managerId = managerId;
    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;
    if (startDate || endDate) {
        query.scheduledDate = {};
        if (startDate) query.scheduledDate.$gte = new Date(startDate);
        if (endDate) query.scheduledDate.$lte = new Date(endDate);
    }

    const oneOnOnes = await OneOnOne.find(query)
        .populate('managerId', 'name lastName email')
        .populate('employeeId', 'name lastName email')
        .populate('goals.goalId')
        .sort({ scheduledDate: -1 });

    res.json({
        success: true,
        data: oneOnOnes
    });
});

/**
 * Update one-on-one
 */
export const updateOneOnOne = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const oneOnOne = await OneOnOne.findOneAndUpdate(
        { _id: id, organizationId },
        req.body,
        { new: true, runValidators: true }
    );

    if (!oneOnOne) {
        return res.status(404).json({
            success: false,
            message: 'One-on-one meeting not found'
        });
    }

    res.json({
        success: true,
        message: 'One-on-one updated successfully',
        data: oneOnOne
    });
});

/**
 * Complete one-on-one
 */
export const completeOneOnOne = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const oneOnOne = await OneOnOne.findOne({
        _id: id,
        organizationId
    });

    if (!oneOnOne) {
        return res.status(404).json({
            success: false,
            message: 'One-on-one meeting not found'
        });
    }

    oneOnOne.status = 'Completed';
    oneOnOne.managerNotes = req.body.managerNotes;
    oneOnOne.employeeNotes = req.body.employeeNotes;
    oneOnOne.feedback = req.body.feedback;
    oneOnOne.agenda = req.body.agenda || oneOnOne.agenda;
    oneOnOne.actionItems = req.body.actionItems || oneOnOne.actionItems;
    oneOnOne.nextMeetingDate = req.body.nextMeetingDate;

    await oneOnOne.save();

    res.json({
        success: true,
        message: 'One-on-one completed successfully',
        data: oneOnOne
    });
});

