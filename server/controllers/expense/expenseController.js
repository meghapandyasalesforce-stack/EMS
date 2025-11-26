import Expense from '../../models/expense.model.js';
import Employee from '../../models/employee.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import logger from '../../helpers/logger.js';
import mongoose from 'mongoose';

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

        if (employeeId) {
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

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const expenses = await Expense.find(query)
            .populate('employeeId', 'name lastName email employeeId')
            .populate('approvedBy', 'name email')
            .populate('projectId', 'name')
            .sort({ expenseDate: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Expense.countDocuments(query);

        // Calculate summary statistics
        const summary = await Expense.aggregate([
            { $match: query },
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
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
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
 */
export const approveExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = getOrganizationId(req);
        const approverId = req.user?._id;

        if (!approverId) {
            return res.status(401).json({
                success: false,
                message: 'Admin authentication required'
            });
        }

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

        if (expense.status !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: `Expense is already ${expense.status}`
            });
        }

        expense.status = 'Approved';
        expense.approvedBy = approverId;
        expense.approvedAt = new Date();

        await expense.save();

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
 */
export const rejectExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejectionReason } = req.body;
        const organizationId = getOrganizationId(req);
        const approverId = req.user?._id;

        if (!approverId) {
            return res.status(401).json({
                success: false,
                message: 'Admin authentication required'
            });
        }

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

        if (expense.status !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: `Expense is already ${expense.status}`
            });
        }

        expense.status = 'Rejected';
        expense.approvedBy = approverId;
        expense.approvedAt = new Date();
        expense.rejectionReason = rejectionReason || '';

        await expense.save();

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
        const { startDate, endDate, employeeId } = req.query;

        const query = addOrganizationFilter(req, {});

        if (employeeId) {
            query.employeeId = employeeId;
        }

        if (startDate || endDate) {
            query.expenseDate = {};
            if (startDate) query.expenseDate.$gte = new Date(startDate);
            if (endDate) query.expenseDate.$lte = new Date(endDate);
        }

        // Overall statistics
        const overallStats = await Expense.aggregate([
            { $match: query },
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

        // Statistics by category
        const categoryStats = await Expense.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$category',
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { totalAmount: -1 } }
        ]);

        // Statistics by status
        const statusStats = await Expense.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$status',
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Monthly trend
        const monthlyTrend = await Expense.aggregate([
            { $match: query },
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

