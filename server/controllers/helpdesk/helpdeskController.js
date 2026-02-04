import { HelpdeskTicket } from '../../models/helpdesk.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../middlewares/asyncHandler.js';

/**
 * Create helpdesk ticket
 */
export const createTicket = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const requestedBy = req.employee?._id || req.user?._id;

    const ticket = new HelpdeskTicket({
        ...req.body,
        organizationId,
        requestedBy
    });

    await ticket.save();

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
    const organizationId = getOrganizationId(req);
    const { status, category, priority, requestedBy, assignedTo, page = 1, limit = 20 } = req.query;

    const query = addOrganizationFilter(req, {});

    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;
    if (requestedBy) query.requestedBy = requestedBy;
    if (assignedTo) query.assignedTo = assignedTo;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tickets = await HelpdeskTicket.find(query)
        .populate('requestedBy', 'name email department')
        .populate('assignedTo', 'name email')
        .populate('comments.commentedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await HelpdeskTicket.countDocuments(query);

    res.json({
        success: true,
        data: tickets,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

/**
 * Get ticket by ID
 */
export const getTicketById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const ticket = await HelpdeskTicket.findOne({
        _id: id,
        organizationId
    })
        .populate('requestedBy', 'name email department')
        .populate('assignedTo', 'name email')
        .populate('comments.commentedBy', 'name email')
        .populate('resolution.resolvedBy', 'name email');

    if (!ticket) {
        return res.status(404).json({
            success: false,
            message: 'Ticket not found'
        });
    }

    res.json({
        success: true,
        data: ticket
    });
});

/**
 * Update ticket
 */
export const updateTicket = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const ticket = await HelpdeskTicket.findOneAndUpdate(
        { _id: id, organizationId },
        req.body,
        { new: true, runValidators: true }
    );

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
    const organizationId = getOrganizationId(req);
    const commentedBy = req.user?._id || req.employee?._id;

    const ticket = await HelpdeskTicket.findOne({
        _id: id,
        organizationId
    });

    if (!ticket) {
        return res.status(404).json({
            success: false,
            message: 'Ticket not found'
        });
    }

    ticket.comments.push({
        comment: req.body.comment,
        commentedBy,
        isInternal: req.body.isInternal || false
    });

    await ticket.save();

    res.json({
        success: true,
        message: 'Comment added successfully',
        data: ticket
    });
});

/**
 * Resolve ticket
 */
export const resolveTicket = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const resolvedBy = req.user?._id || req.employee?._id;

    const ticket = await HelpdeskTicket.findOne({
        _id: id,
        organizationId
    });

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

