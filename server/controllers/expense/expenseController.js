import Expense from '../../models/expense.model.js';
import Employee from '../../models/employee.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import logger from '../../helpers/logger.js';
import mongoose from 'mongoose';
import { initiateApproval } from '../../services/approvalWorkflowService.js';
import { logCreate, logUpdate, logApprove, logReject, logDelete } from '../../helpers/auditLogger.js';

/**
 * Create a new expense claim
 */
export const createExpense = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);
        const employeeId = req.employee?._id || req.user?._id;

        if (!employeeId) {
            return res.status(401).json({
                success: false,
                message: 'Employee ID is required'
            });
        }

        const {
            expenseDate,
            category,
            amount,
            currency,
            description,
            receipt,
            tags,
            projectId,
            notes
        } = req.body;

        const expense = new Expense({
            organizationId,
            employeeId,
            expenseDate: new Date(expenseDate),
            category,
            amount: parseFloat(amount),
            currency: currency || 'USD',
            description,
            receipt,
            tags: tags || [],
            projectId: projectId || null,
            notes: notes || '',
            status: 'Pending'
        });

        await expense.save();

        // Log audit trail for expense creation
        await logCreate({
            entityType: 'Expense',
            entityId: expense._id,
            entityName: `${expense.category} expense - ${expense.amount} ${expense.currency}`,
            req,
            before: null,
            after: expense.toObject(),
            metadata: {
                category: expense.category,
                amount: expense.amount,
                currency: expense.currency,
                expenseDate: expense.expenseDate
            }
        });

        // Initiate approval workflow if configured
        try {
            const employee = await Employee.findById(employeeId).select('organizationId').lean();
            if (employee) {
                const approvalResult = await initiateApproval({
                    organizationId: expense.organizationId,
                    entityType: 'Expense',
                    entityId: expense._id,
                    requestedBy: employeeId,
                    metadata: {
                        amount: expense.amount,
                        category: expense.category,
                        currency: expense.currency,
                        description: expense.description
                    },
                    priority: expense.amount > 1000 ? 'High' : expense.amount > 500 ? 'Medium' : 'Low'
                });

                // Update expense with approval instance ID if workflow was initiated
                if (approvalResult.approvalInstanceId) {
                    expense.approvalInstanceId = approvalResult.approvalInstanceId;
                    await expense.save();
                }

                // If auto-approved, update expense status
                if (approvalResult.status === 'Approved' && approvalResult.autoApproved) {
                    expense.status = 'Approved';
                    await expense.save();
                }
            }
        } catch (approvalError) {
            logger.warn('Error initiating approval workflow for expense', {
                error: approvalError.message,
                expenseId: expense._id
            });
            // Don't fail expense creation if approval workflow fails
        }

        res.status(201).json({
            success: true,
            message: 'Expense claim created successfully',
            data: expense
        });
    } catch (error) {
        logger.error('Error creating expense', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get all expenses (with filters)
 */
export const getExpenses = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);
        
        if (!organizationId) {
            return res.status(400).json({
                success: false,
                message: 'Organization ID is required'
            });
        }

        const { 
            employeeId, 
            status, 
            category, 
            startDate, 
            endDate,
            page = 1,
            limit = 20
        } = req.query;

        const query = addOrganizationFilter(req, {});

        // Validate and parse pagination parameters
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        
        if (isNaN(pageNum) || pageNum < 1) {
            return res.status(400).json({
                success: false,
                message: 'Invalid page number'
            });
        }
        
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            return res.status(400).json({
                success: false,
                message: 'Invalid limit (must be between 1 and 100)'
            });
        }

        // Validate employeeId if provided (must be valid MongoDB ObjectId)
        if (employeeId) {
            if (!mongoose.Types.ObjectId.isValid(employeeId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid employee ID format'
                });
            }
            
            // If employee is requesting another employee's data, check permissions
            if (req.employee?._id && employeeId !== req.employee._id.toString()) {
                // Only admins can view other employees' expenses
                if (!req.user) {
                    return res.status(403).json({
                        success: false,
                        message: 'Access denied. You can only view your own expenses.'
                    });
                }
            }
            
            query.employeeId = employeeId;
        } else if (req.employee?._id) {
            // Employee can only see their own expenses
            query.employeeId = req.employee._id;
        }

        if (status) {
            query.status = status;
        }

        if (category) {
            query.category = category;
        }

        if (startDate || endDate) {
            query.expenseDate = {};
            if (startDate) query.expenseDate.$gte = new Date(startDate);
            if (endDate) query.expenseDate.$lte = new Date(endDate);
        }

        const skip = (pageNum - 1) * limitNum;

        const expenses = await Expense.find(query)
            .populate('employeeId', 'name lastName email employeeId')
            .populate('approvedBy', 'name email')
            .populate('projectId', 'name')
            .sort({ expenseDate: -1 })
            .skip(skip)
            .limit(limitNum);

        const total = await Expense.countDocuments(query);

        // Calculate summary statistics with organizationId filter
        const summary = await Expense.aggregate([
            { $match: { ...query, organizationId } },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: '$amount' },
                    pendingAmount: {
                        $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, '$amount', 0] }
                    },
                    approvedAmount: {
                        $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, '$amount', 0] }
                    },
                    paidAmount: {
                        $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, '$amount', 0] }
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            success: true,
            data: expenses,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            },
            summary: summary[0] || {
                totalAmount: 0,
                pendingAmount: 0,
                approvedAmount: 0,
                paidAmount: 0,
                count: 0
            }
        });
    } catch (error) {
        logger.error('Error fetching expenses', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get single expense by ID
 */
export const getExpenseById = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = getOrganizationId(req);

        const expense = await Expense.findOne({
            _id: id,
            organizationId
        })
            .populate('employeeId', 'name lastName email employeeId department')
            .populate('approvedBy', 'name email')
            .populate('projectId', 'name');

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        // Check if employee is viewing their own expense or is admin
        if (req.employee?._id && expense.employeeId._id.toString() !== req.employee._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        res.json({
            success: true,
            data: expense
        });
    } catch (error) {
        logger.error('Error fetching expense', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Update expense (employee can update pending expenses)
 */
export const updateExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = getOrganizationId(req);
        const employeeId = req.employee?._id || req.user?._id;

        const expense = await Expense.findOne({
            _id: id,
            organizationId
        });

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        // Get expense before update for audit log
        const expenseBefore = expense.toObject();

        // Employee can only update their own pending expenses
        if (req.employee?._id) {
            if (expense.employeeId.toString() !== employeeId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only update your own expenses'
                });
            }
            if (expense.status !== 'Pending') {
                return res.status(400).json({
                    success: false,
                    message: 'Only pending expenses can be updated'
                });
            }
        }

        const allowedFields = ['expenseDate', 'category', 'amount', 'currency', 'description', 'receipt', 'tags', 'projectId', 'notes'];
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                expense[field] = req.body[field];
            }
        });

        await expense.save();

        // Log audit trail
        await logUpdate({
            entityType: 'Expense',
            entityId: expense._id,
            entityName: `${expense.category} expense - ${expense.amount} ${expense.currency}`,
            req,
            before: expenseBefore,
            after: expense.toObject(),
            metadata: {
                category: expense.category,
                amount: expense.amount,
                currency: expense.currency
            }
        });

        res.json({
            success: true,
            message: 'Expense updated successfully',
            data: expense
        });
    } catch (error) {
        logger.error('Error updating expense', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Approve expense (admin only)
 * If approval workflow exists, use workflow; otherwise direct approval
 */
export const approveExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const { comments } = req.body;
        const organizationId = getOrganizationId(req);
        const approverId = req.user?._id || req.employee?._id;

        if (!approverId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const expense = await Expense.findOne({
            _id: id,
            organizationId
        }).populate('approvalInstanceId');

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        if (expense.status !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: `Expense is already ${expense.status}`
            });
        }

        // If approval workflow exists, process through workflow
        if (expense.approvalInstanceId) {
            try {
                const { processApprovalAction } = await import('../../services/approvalWorkflowService.js');
                
                const ApprovalInstance = (await import('../../models/approvalWorkflow.model.js')).ApprovalInstance;
                const instance = await ApprovalInstance.findById(expense.approvalInstanceId);
                
                if (instance && instance.status === 'In Progress') {
                    const pendingStep = instance.steps.find(s => 
                        s.status === 'Pending' && 
                        s.approverId?.toString() === approverId.toString()
                    );

                    if (pendingStep) {
                        await processApprovalAction({
                            approvalInstanceId: instance._id,
                            stepNumber: pendingStep.stepNumber,
                            approverId: approverId,
                            action: 'Approve',
                            comments: comments || 'Expense approved',
                            metadata: {
                                expenseId: expense._id,
                                amount: expense.amount
                            }
                        });

                        // Check if workflow is complete
                        const updatedInstance = await ApprovalInstance.findById(instance._id);
                        if (updatedInstance.status === 'Approved') {
                            expense.status = 'Approved';
                            expense.approvedBy = approverId;
                            expense.approvedAt = new Date();
                            await expense.save();
                            
                            // Log audit trail
                            await logApprove({
                                entityType: 'Expense',
                                entityId: expense._id,
                                entityName: `${expense.category} expense - ${expense.amount} ${expense.currency}`,
                                req,
                                before: expenseBefore,
                                after: expense.toObject(),
                                metadata: {
                                    category: expense.category,
                                    amount: expense.amount,
                                    currency: expense.currency,
                                    approverId: approverId.toString(),
                                    comments,
                                    viaWorkflow: true
                                }
                            });
                        }

                        return res.json({
                            success: true,
                            message: 'Expense approved through workflow',
                            data: expense
                        });
                    }
                }
            } catch (workflowError) {
                logger.warn('Error processing expense through workflow, falling back to direct approval', {
                    error: workflowError.message,
                    expenseId: expense._id
                });
                // Fall through to direct approval
            }
        }

        // Direct approval (no workflow or workflow failed)
        expense.status = 'Approved';
        expense.approvedBy = approverId;
        expense.approvedAt = new Date();

        await expense.save();

        // Log audit trail
        await logApprove({
            entityType: 'Expense',
            entityId: expense._id,
            entityName: `${expense.category} expense - ${expense.amount} ${expense.currency}`,
            req,
            before: expenseBefore,
            after: expense.toObject(),
            metadata: {
                category: expense.category,
                amount: expense.amount,
                currency: expense.currency,
                approverId: approverId.toString(),
                comments
            }
        });

        res.json({
            success: true,
            message: 'Expense approved successfully',
            data: expense
        });
    } catch (error) {
        logger.error('Error approving expense', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Reject expense (admin only)
 * If approval workflow exists, use workflow; otherwise direct rejection
 */
export const rejectExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejectionReason } = req.body;
        const organizationId = getOrganizationId(req);
        const approverId = req.user?._id || req.employee?._id;

        if (!approverId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const expense = await Expense.findOne({
            _id: id,
            organizationId
        }).populate('approvalInstanceId');

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        if (expense.status !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: `Expense is already ${expense.status}`
            });
        }

        // If approval workflow exists, process through workflow
        if (expense.approvalInstanceId) {
            try {
                const { processApprovalAction } = await import('../../services/approvalWorkflowService.js');
                
                const ApprovalInstance = (await import('../../models/approvalWorkflow.model.js')).ApprovalInstance;
                const instance = await ApprovalInstance.findById(expense.approvalInstanceId);
                
                if (instance && instance.status === 'In Progress') {
                    const pendingStep = instance.steps.find(s => 
                        s.status === 'Pending' && 
                        s.approverId?.toString() === approverId.toString()
                    );

                    if (pendingStep) {
                        await processApprovalAction({
                            approvalInstanceId: instance._id,
                            stepNumber: pendingStep.stepNumber,
                            approverId: approverId,
                            action: 'Reject',
                            comments: rejectionReason || 'Expense rejected',
                            metadata: {
                                expenseId: expense._id,
                                amount: expense.amount
                            }
                        });

                        // Workflow rejection will update expense status
                        expense.status = 'Rejected';
                        expense.approvedBy = approverId;
                        expense.approvedAt = new Date();
                        expense.rejectionReason = rejectionReason || '';
                        await expense.save();
                        
                        // Log audit trail
                        await logReject({
                            entityType: 'Expense',
                            entityId: expense._id,
                            entityName: `${expense.category} expense - ${expense.amount} ${expense.currency}`,
                            req,
                            before: expenseBefore,
                            after: expense.toObject(),
                            metadata: {
                                category: expense.category,
                                amount: expense.amount,
                                currency: expense.currency,
                                approverId: approverId.toString(),
                                rejectionReason,
                                viaWorkflow: true
                            }
                        });

                        return res.json({
                            success: true,
                            message: 'Expense rejected through workflow',
                            data: expense
                        });
                    }
                }
            } catch (workflowError) {
                logger.warn('Error processing expense rejection through workflow, falling back to direct rejection', {
                    error: workflowError.message,
                    expenseId: expense._id
                });
                // Fall through to direct rejection
            }
        }

        // Direct rejection (no workflow or workflow failed)
        expense.status = 'Rejected';
        expense.approvedBy = approverId;
        expense.approvedAt = new Date();
        expense.rejectionReason = rejectionReason || '';

        await expense.save();

        // Log audit trail
        await logReject({
            entityType: 'Expense',
            entityId: expense._id,
            entityName: `${expense.category} expense - ${expense.amount} ${expense.currency}`,
            req,
            before: expenseBefore,
            after: expense.toObject(),
            metadata: {
                category: expense.category,
                amount: expense.amount,
                currency: expense.currency,
                approverId: approverId.toString(),
                rejectionReason
            }
        });

        res.json({
            success: true,
            message: 'Expense rejected successfully',
            data: expense
        });
    } catch (error) {
        logger.error('Error rejecting expense', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Mark expense as paid (admin only)
 */
export const markExpenseAsPaid = async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentMethod, paymentReference } = req.body;
        const organizationId = getOrganizationId(req);

        const expense = await Expense.findOne({
            _id: id,
            organizationId
        });

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        if (expense.status !== 'Approved') {
            return res.status(400).json({
                success: false,
                message: 'Only approved expenses can be marked as paid'
            });
        }

        expense.status = 'Paid';
        expense.paymentDate = new Date();
        expense.paymentMethod = paymentMethod || 'Bank Transfer';
        expense.paymentReference = paymentReference || '';

        await expense.save();

        res.json({
            success: true,
            message: 'Expense marked as paid successfully',
            data: expense
        });
    } catch (error) {
        logger.error('Error marking expense as paid', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Delete expense (only pending expenses can be deleted)
 */
export const deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = getOrganizationId(req);
        const employeeId = req.employee?._id || req.user?._id;

        const expense = await Expense.findOne({
            _id: id,
            organizationId
        });

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        // Get expense before deletion for audit log
        const expenseBefore = expense.toObject();

        // Employee can only delete their own pending expenses
        if (req.employee?._id) {
            if (expense.employeeId.toString() !== employeeId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only delete your own expenses'
                });
            }
            if (expense.status !== 'Pending') {
                return res.status(400).json({
                    success: false,
                    message: 'Only pending expenses can be deleted'
                });
            }
        }

        await Expense.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'Expense deleted successfully'
        });
    } catch (error) {
        logger.error('Error deleting expense', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get expense statistics
 */
export const getExpenseStatistics = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);
        
        if (!organizationId) {
            return res.status(400).json({
                success: false,
                message: 'Organization ID is required'
            });
        }

        const { startDate, endDate, employeeId } = req.query;

        const query = addOrganizationFilter(req, {});

        // Validate employeeId if provided
        if (employeeId) {
            if (!mongoose.Types.ObjectId.isValid(employeeId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid employee ID format'
                });
            }
            
            // If employee is requesting another employee's data, check permissions
            if (req.employee?._id && employeeId !== req.employee._id.toString()) {
                if (!req.user) {
                    return res.status(403).json({
                        success: false,
                        message: 'Access denied. You can only view your own expense statistics.'
                    });
                }
            }
            
            query.employeeId = employeeId;
        }

        if (startDate || endDate) {
            query.expenseDate = {};
            if (startDate) query.expenseDate.$gte = new Date(startDate);
            if (endDate) query.expenseDate.$lte = new Date(endDate);
        }

        // Overall statistics with organizationId filter
        const overallStats = await Expense.aggregate([
            { $match: { ...query, organizationId } },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: '$amount' },
                    totalCount: { $sum: 1 },
                    pendingCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] }
                    },
                    approvedCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] }
                    },
                    paidCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, 1, 0] }
                    }
                }
            }
        ]);

        // Statistics by category with organizationId filter
        const categoryStats = await Expense.aggregate([
            { $match: { ...query, organizationId } },
            {
                $group: {
                    _id: '$category',
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { totalAmount: -1 } }
        ]);

        // Statistics by status with organizationId filter
        const statusStats = await Expense.aggregate([
            { $match: { ...query, organizationId } },
            {
                $group: {
                    _id: '$status',
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Monthly trend with organizationId filter
        const monthlyTrend = await Expense.aggregate([
            { $match: { ...query, organizationId } },
            {
                $group: {
                    _id: {
                        year: { $year: '$expenseDate' },
                        month: { $month: '$expenseDate' }
                    },
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        res.json({
            success: true,
            data: {
                overall: overallStats[0] || {
                    totalAmount: 0,
                    totalCount: 0,
                    pendingCount: 0,
                    approvedCount: 0,
                    paidCount: 0
                },
                byCategory: categoryStats,
                byStatus: statusStats,
                monthlyTrend: monthlyTrend
            }
        });
    } catch (error) {
        logger.error('Error fetching expense statistics', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

