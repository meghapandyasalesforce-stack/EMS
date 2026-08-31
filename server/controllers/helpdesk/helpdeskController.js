import { HelpdeskTicket } from '../../models/helpdesk.model.js';
import Employee from '../../models/employee.model.js';
import { getOrganizationId } from '../../helpers/organizationHelper.js';
import { getManagerEmployeeIds } from '../../helpers/managerHelper.js';
import { resolveAuthContext } from '../../helpers/permissionService.js';
import { notify } from '../../helpers/notificationManager.js';
import { getHelpdeskTicketNotificationRecipients } from '../../helpers/helpdeskNotificationHelper.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../middlewares/asyncHandler.js';

const HELPDESK_CATEGORIES = [
    'HR', 'IT', 'Payroll', 'Benefits', 'Leave', 'Attendance',
    'Training', 'Document', 'General', 'Other'
];
const HELPDESK_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

const getHelpdeskAccess = async (req) => {
    if (!req.authContext) {
        req.authContext = await resolveAuthContext(req.decoded, req);
    }

    const ctx = req.authContext;
    const canManage = Boolean(
        req.decoded?.role === 'admin' ||
        ctx?.isOrgOwner ||
        ctx?.isHrManager ||
        ctx?.isHrExecutive ||
        ctx?.isExecutive
    );

    return {
        canManage,
        isLineManager: Boolean(!canManage && ctx?.isLineManager),
        employeeId: req.employee?._id || null
    };
};

const buildTicketScope = async (req) => {
    const organizationId = getOrganizationId(req);
    const access = await getHelpdeskAccess(req);

    if (access.canManage) {
        return { organizationId, access };
    }

    if (!access.employeeId) {
        return { organizationId, access, denied: true };
    }

    if (access.isLineManager) {
        const reportIds = await getManagerEmployeeIds(
            Employee,
            organizationId,
            req.employee
        );
        return {
            organizationId,
            access,
            requestedBy: { $in: [access.employeeId, ...reportIds] }
        };
    }

    return { organizationId, access, requestedBy: access.employeeId };
};

const ticketQueryForRequest = async (req, extra = {}) => {
    const scope = await buildTicketScope(req);
    if (scope.denied) return null;

    const { access: _access, denied: _denied, ...visibility } = scope;
    return { ...visibility, ...extra };
};

const hideInternalComments = (ticket, canManage) => {
    if (!ticket || canManage) return ticket;
    const plain = typeof ticket.toObject === 'function' ? ticket.toObject() : ticket;
    return {
        ...plain,
        comments: (plain.comments || []).filter((comment) => !comment.isInternal)
    };
};

/**
 * Create helpdesk ticket
 */
export const createTicket = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const requestedBy = req.employee?._id || req.user?._id;

    if (!requestedBy) {
        return res.status(403).json({
            success: false,
            message: 'An authenticated profile is required to create a ticket'
        });
    }

    if (!organizationId) {
        return res.status(400).json({
            success: false,
            message: 'Your account is not linked to an organization, so a ticket cannot be created'
        });
    }

    const allowedFields = [
        'category',
        'subCategory',
        'priority',
        'subject',
        'description',
        'department',
        'attachments'
    ];
    const payload = Object.fromEntries(
        allowedFields
            .filter((field) => req.body?.[field] !== undefined)
            .map((field) => [field, req.body[field]])
    );

    const subject = String(payload.subject || '').trim();
    const description = String(payload.description || '').trim();
    const category = String(payload.category || '').trim();

    const fieldErrors = [];
    if (!subject) fieldErrors.push('Subject is required');
    if (!description) fieldErrors.push('Description is required');
    if (!category) fieldErrors.push('Category is required');
    else if (!HELPDESK_CATEGORIES.includes(category)) {
        fieldErrors.push(`Category must be one of: ${HELPDESK_CATEGORIES.join(', ')}`);
    }
    if (payload.priority && !HELPDESK_PRIORITIES.includes(payload.priority)) {
        fieldErrors.push(`Priority must be one of: ${HELPDESK_PRIORITIES.join(', ')}`);
    }

    if (fieldErrors.length) {
        return res.status(400).json({
            success: false,
            message: fieldErrors[0],
            errors: fieldErrors
        });
    }

    const ticket = new HelpdeskTicket({
        ...payload,
        subject,
        description,
        category,
        organizationId,
        requestedBy
    });

    await ticket.save();

    // Notify only the role-specific recipients for newly created tickets.
    setImmediate(async () => {
        try {
            const recipients = await getHelpdeskTicketNotificationRecipients(
                req,
                organizationId
            );
            if (!recipients.length) return;

            const creatorName = [
                req.employee?.name || req.user?.name,
                req.employee?.lastName
            ]
                .filter(Boolean)
                .join(' ')
                .trim() || 'An employee';

            await notify({
                type: 'helpdesk_ticket_created',
                recipients,
                organizationId,
                senderId: requestedBy,
                senderType: req.employee?._id ? 'Employee' : 'User',
                data: {
                    ticket,
                    creatorName
                }
            });
        } catch (notificationError) {
            logger.error('Failed to send helpdesk ticket creation notification', {
                ticketId: ticket._id,
                ticketNumber: ticket.ticketNumber,
                error: notificationError.message
            });
        }
    });

    // Auto-track ticket for SLA
    try {
        const { trackEntity } = await import('../../services/slaService.js');
        const slaViolation = await trackEntity({
            organizationId,
            entityType: 'Helpdesk',
            entityId: ticket._id,
            priority: ticket.priority || 'Medium',
            metadata: {
                category: ticket.category,
                subCategory: ticket.subCategory,
                ticketNumber: ticket.ticketNumber
            }
        });

        if (slaViolation) {
            // Update ticket with SLA violation ID if needed
            // You can add a slaViolationId field to the ticket model if needed
            logger.info('Ticket tracked for SLA', {
                ticketId: ticket._id,
                slaViolationId: slaViolation._id
            });
        }
    } catch (slaError) {
        logger.warn('Error tracking ticket for SLA', {
            error: slaError.message,
            ticketId: ticket._id
        });
        // Don't fail ticket creation if SLA tracking fails
    }

    res.status(201).json({
        success: true,
        message: 'Ticket created successfully',
        data: ticket
    });
});

/**
 * Get tickets
 */
export const getTickets = asyncHandler(async (req, res) => {
    const { status, category, priority, requestedBy, assignedTo, page = 1, limit = 20 } = req.query;
    const scope = await buildTicketScope(req);
    if (scope.denied) {
        return res.status(403).json({
            success: false,
            message: 'An employee profile is required to view tickets'
        });
    }
    const { access, denied: _denied, ...query } = scope;

    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;
    if (access.canManage && requestedBy) query.requestedBy = requestedBy;
    if (access.canManage && assignedTo) query.assignedTo = assignedTo;

    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (parsedPage - 1) * parsedLimit;

    const [tickets, total] = await Promise.all([
        HelpdeskTicket.find(query)
            .populate('requestedBy', 'name lastName email department')
            .populate('assignedTo', 'name lastName email')
            .populate('comments.commentedBy', 'name lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parsedLimit),
        HelpdeskTicket.countDocuments(query)
    ]);

    res.json({
        success: true,
        data: tickets.map((ticket) => hideInternalComments(ticket, access.canManage)),
        pagination: {
            page: parsedPage,
            limit: parsedLimit,
            total,
            pages: Math.ceil(total / parsedLimit)
        }
    });
});

/**
 * Get ticket by ID
 */
export const getTicketById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const scope = await buildTicketScope(req);
    if (scope.denied) {
        return res.status(403).json({
            success: false,
            message: 'An employee profile is required to view tickets'
        });
    }
    const { access, denied: _denied, ...query } = scope;

    const ticket = await HelpdeskTicket.findOne({
        ...query,
        _id: id,
    })
        .populate('requestedBy', 'name lastName email department')
        .populate('assignedTo', 'name lastName email')
        .populate('comments.commentedBy', 'name lastName email')
        .populate('resolution.resolvedBy', 'name lastName email');

    if (!ticket) {
        return res.status(404).json({
            success: false,
            message: 'Ticket not found'
        });
    }

    res.json({
        success: true,
        data: hideInternalComments(ticket, access.canManage)
    });
});

/**
 * Update ticket
 */
export const updateTicket = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const access = await getHelpdeskAccess(req);
    let query;
    let updates;

    if (access.canManage) {
        query = await ticketQueryForRequest(req, { _id: id });
        const allowedFields = ['status', 'priority', 'assignedTo', 'category', 'subCategory'];
        updates = Object.fromEntries(
            allowedFields
                .filter((field) => req.body?.[field] !== undefined)
                .map((field) => [field, req.body[field]])
        );
    } else {
        if (req.body?.status !== 'Cancelled' || !access.employeeId) {
            return res.status(403).json({
                success: false,
                message: 'Only HR, executives, or administrators can update ticket workflow'
            });
        }
        query = {
            _id: id,
            organizationId: getOrganizationId(req),
            requestedBy: access.employeeId,
            status: { $nin: ['Resolved', 'Closed', 'Cancelled'] }
        };
        updates = { status: 'Cancelled' };
    }

    const ticket = await HelpdeskTicket.findOneAndUpdate(
        query,
        updates,
        { new: true, runValidators: true }
    )
        .populate('requestedBy', 'name lastName email department')
        .populate('assignedTo', 'name lastName email')
        .populate('comments.commentedBy', 'name lastName email');

    if (!ticket) {
        return res.status(404).json({
            success: false,
            message: 'Ticket not found'
        });
    }

    res.json({
        success: true,
        message: 'Ticket updated successfully',
        data: ticket
    });
});

/**
 * Add comment to ticket
 */
export const addComment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const access = await getHelpdeskAccess(req);
    const commentedBy = req.employee?._id || req.user?._id;

    if (!commentedBy) {
        return res.status(403).json({
            success: false,
            message: 'An authenticated profile is required to comment'
        });
    }
    const comment = String(req.body?.comment || '').trim();
    if (!comment) {
        return res.status(400).json({
            success: false,
            message: 'Comment is required'
        });
    }

    const query = await ticketQueryForRequest(req, { _id: id });

    const ticket = query ? await HelpdeskTicket.findOne(query) : null;

    if (!ticket) {
        return res.status(404).json({
            success: false,
            message: 'Ticket not found'
        });
    }

    ticket.comments.push({
        comment,
        commentedBy,
        isInternal: access.canManage && req.body.isInternal === true
    });

    await ticket.save();
    await ticket.populate([
        { path: 'requestedBy', select: 'name lastName email department' },
        { path: 'assignedTo', select: 'name lastName email' },
        { path: 'comments.commentedBy', select: 'name lastName email' }
    ]);

    res.json({
        success: true,
        message: 'Comment added successfully',
        data: hideInternalComments(ticket, access.canManage)
    });
});

/**
 * Resolve ticket
 */
export const resolveTicket = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const access = await getHelpdeskAccess(req);
    if (!access.canManage) {
        return res.status(403).json({
            success: false,
            message: 'Only HR, executives, or administrators can resolve tickets'
        });
    }
    const resolvedBy = req.employee?._id || req.user?._id;
    if (!resolvedBy) {
        return res.status(403).json({
            success: false,
            message: 'An authenticated profile is required to resolve tickets'
        });
    }

    const query = await ticketQueryForRequest(req, { _id: id });
    const ticket = await HelpdeskTicket.findOne(query);

    if (!ticket) {
        return res.status(404).json({
            success: false,
            message: 'Ticket not found'
        });
    }

    ticket.status = 'Resolved';
    ticket.resolution = {
        resolvedBy,
        resolvedAt: new Date(),
        resolutionNotes: req.body.resolutionNotes
    };

    await ticket.save();

    res.json({
        success: true,
        message: 'Ticket resolved successfully',
        data: ticket
    });
});

/**
 * Get helpdesk analytics with SLA tracking
 */
export const getHelpdeskAnalytics = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
        if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const [totalTickets, openTickets, resolvedTickets, ticketsByStatus, 
           ticketsByCategory, ticketsByPriority, avgResolutionTime, 
           slaCompliance, ticketsByAssignee] = await Promise.all([
        HelpdeskTicket.countDocuments({ organizationId, ...dateFilter }),
        HelpdeskTicket.countDocuments({ organizationId, status: 'Open', ...dateFilter }),
        HelpdeskTicket.countDocuments({ organizationId, status: 'Resolved', ...dateFilter }),
        HelpdeskTicket.aggregate([
            { $match: { organizationId, ...dateFilter } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        HelpdeskTicket.aggregate([
            { $match: { organizationId, ...dateFilter } },
            { $group: { _id: '$category', count: { $sum: 1 } } }
        ]),
        HelpdeskTicket.aggregate([
            { $match: { organizationId, ...dateFilter } },
            { $group: { _id: '$priority', count: { $sum: 1 } } }
        ]),
        HelpdeskTicket.aggregate([
            { 
                $match: { 
                    organizationId, 
                    status: 'Resolved',
                    'resolution.resolvedAt': { $exists: true },
                    ...dateFilter 
                } 
            },
            {
                $project: {
                    resolutionTime: {
                        $divide: [
                            { $subtract: ['$resolution.resolvedAt', '$createdAt'] },
                            3600000 // Convert to hours
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    avgHours: { $avg: '$resolutionTime' },
                    medianHours: { $percentile: { input: '$resolutionTime', p: [0.5], method: 'approximate' } }
                }
            }
        ]),
        HelpdeskTicket.aggregate([
            { 
                $match: { 
                    organizationId, 
                    status: 'Resolved',
                    'resolution.resolvedAt': { $exists: true },
                    slaTarget: { $exists: true },
                    ...dateFilter 
                } 
            },
            {
                $project: {
                    resolutionTime: {
                        $divide: [
                            { $subtract: ['$resolution.resolvedAt', '$createdAt'] },
                            3600000
                        ]
                    },
                    slaTarget: 1
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    metSLA: { $sum: { $cond: [{ $lte: ['$resolutionTime', '$slaTarget'] }, 1, 0] } }
                }
            }
        ]),
        HelpdeskTicket.aggregate([
            { $match: { organizationId, assignedTo: { $exists: true }, ...dateFilter } },
            { $group: { _id: '$assignedTo', count: { $sum: 1 }, resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ])
    ]);

    const resolutionRate = totalTickets > 0 
        ? ((resolvedTickets / totalTickets) * 100).toFixed(2)
        : 0;

    const slaComplianceRate = slaCompliance[0] && slaCompliance[0].total > 0
        ? ((slaCompliance[0].metSLA / slaCompliance[0].total) * 100).toFixed(2)
        : 0;

    res.json({
        success: true,
        data: {
            tickets: {
                total: totalTickets,
                open: openTickets,
                resolved: resolvedTickets,
                resolutionRate: parseFloat(resolutionRate)
            },
            ticketsByStatus,
            ticketsByCategory,
            ticketsByPriority,
            avgResolutionTime: avgResolutionTime[0] || {},
            slaCompliance: {
                rate: parseFloat(slaComplianceRate),
                ...(slaCompliance[0] || {})
            },
            topAssignees: ticketsByAssignee
        }
    });
});

