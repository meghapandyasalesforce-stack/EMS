import Report from '../../models/report.model.js';
import Payroll from '../../models/payroll.model.js';
import Attendance from '../../models/attendance.model.js';
import Leave from '../../models/leave.model.js';
import Employee from '../../models/employee.model.js';
import Expense from '../../models/expense.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../helpers/asyncHandler.js';
import { sendSuccess, sendError, sendNotFound, sendInternalError } from '../../helpers/responseHelper.js';
import mongoose from 'mongoose';

/**
 * Generate payroll report
 */
const generatePayrollReport = async (query, config) => {
    const { startDate, endDate, departments, employees } = config.filters || {};
    
    const matchQuery = { ...query };
    
    if (startDate || endDate) {
        matchQuery.createdAt = {};
        if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
        if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    const payrolls = await Payroll.find(matchQuery)
        .populate('employeeId', 'name lastName email department position')
        .sort({ year: -1, month: -1 });

    // Filter by departments if specified
    let filteredPayrolls = payrolls;
    if (departments && departments.length > 0) {
        filteredPayrolls = payrolls.filter(p => 
            departments.includes(p.employeeId?.department)
        );
    }

    // Filter by employees if specified
    if (employees && employees.length > 0) {
        filteredPayrolls = filteredPayrolls.filter(p => 
            employees.includes(p.employeeId._id.toString())
        );
    }

    // Calculate summary
    const summary = {
        totalEmployees: new Set(filteredPayrolls.map(p => p.employeeId._id.toString())).size,
        totalPayroll: filteredPayrolls.reduce((sum, p) => sum + (p.inHandSalary || 0), 0),
        totalEarnings: filteredPayrolls.reduce((sum, p) => sum + (p.earnings?.totalEarnings || 0), 0),
        totalDeductions: filteredPayrolls.reduce((sum, p) => sum + (p.deductions?.total || 0), 0),
        byDepartment: {},
        byStatus: {}
    };

    filteredPayrolls.forEach(p => {
        const dept = p.employeeId?.department || 'Unknown';
        summary.byDepartment[dept] = (summary.byDepartment[dept] || 0) + (p.inHandSalary || 0);
        
        const status = p.status || 'Pending';
        summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
    });

    return {
        data: filteredPayrolls,
        summary
    };
};

/**
 * Generate attendance report
 */
const generateAttendanceReport = async (query, config) => {
    const { startDate, endDate, departments, employees } = config.filters || {};
    
    const matchQuery = { ...query };
    
    if (startDate || endDate) {
        matchQuery.date = {};
        if (startDate) matchQuery.date.$gte = new Date(startDate);
        if (endDate) matchQuery.date.$lte = new Date(endDate);
    }

    const attendances = await Attendance.find(matchQuery)
        .populate('userId', 'name lastName email department')
        .sort({ date: -1 });

    let filteredAttendances = attendances;
    if (departments && departments.length > 0) {
        filteredAttendances = attendances.filter(a => 
            departments.includes(a.userId?.department)
        );
    }

    if (employees && employees.length > 0) {
        filteredAttendances = filteredAttendances.filter(a => 
            employees.includes(a.userId._id.toString())
        );
    }

    const summary = {
        totalRecords: filteredAttendances.length,
        totalEffectiveHours: filteredAttendances.reduce((sum, a) => sum + (a.effectiveHours || 0), 0),
        totalOvertime: filteredAttendances.reduce((sum, a) => sum + (a.overtimeHours || 0), 0),
        presentDays: filteredAttendances.filter(a => a.status === 'present').length,
        absentDays: filteredAttendances.filter(a => a.status === 'absent').length,
        lateArrivals: filteredAttendances.filter(a => a.isLateArrival).length,
        byDepartment: {},
        byStatus: {}
    };

    filteredAttendances.forEach(a => {
        const dept = a.userId?.department || 'Unknown';
        summary.byDepartment[dept] = (summary.byDepartment[dept] || 0) + 1;
        
        const status = a.status || 'unknown';
        summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
    });

    return {
        data: filteredAttendances,
        summary
    };
};

/**
 * Generate leave report
 */
const generateLeaveReport = async (query, config) => {
    const { startDate, endDate, departments, employees, status } = config.filters || {};
    
    const matchQuery = { ...query };
    
    if (startDate || endDate) {
        matchQuery.startDate = {};
        if (startDate) matchQuery.startDate.$gte = new Date(startDate);
        if (endDate) matchQuery.endDate = { $lte: new Date(endDate) };
    }

    if (status && status.length > 0) {
        matchQuery.status = { $in: status };
    }

    const leaves = await Leave.find(matchQuery)
        .populate('employee', 'name lastName email department')
        .sort({ startDate: -1 });

    let filteredLeaves = leaves;
    if (departments && departments.length > 0) {
        filteredLeaves = leaves.filter(l => 
            departments.includes(l.employee?.department)
        );
    }

    if (employees && employees.length > 0) {
        filteredLeaves = filteredLeaves.filter(l => 
            employees.includes(l.employee._id.toString())
        );
    }

    const summary = {
        totalLeaves: filteredLeaves.length,
        totalDays: filteredLeaves.reduce((sum, l) => sum + (l.duration || 0), 0),
        byType: {},
        byStatus: {},
        byDepartment: {}
    };

    filteredLeaves.forEach(l => {
        summary.byType[l.leaveType] = (summary.byType[l.leaveType] || 0) + (l.duration || 0);
        summary.byStatus[l.status] = (summary.byStatus[l.status] || 0) + 1;
        
        const dept = l.employee?.department || 'Unknown';
        summary.byDepartment[dept] = (summary.byDepartment[dept] || 0) + (l.duration || 0);
    });

    return {
        data: filteredLeaves,
        summary
    };
};

/**
 * Generate employee report
 */
const generateEmployeeReport = async (query, config) => {
    const { departments, status, position } = config.filters || {};
    
    const matchQuery = { ...query };

    if (departments && departments.length > 0) {
        matchQuery.department = { $in: departments };
    }

    if (status && status.length > 0) {
        matchQuery.status = { $in: status };
    }

    if (position && position.length > 0) {
        matchQuery.position = { $in: position };
    }

    const employees = await Employee.find(matchQuery)
        .select('-password')
        .sort({ joiningDate: -1 });

    const summary = {
        totalEmployees: employees.length,
        byDepartment: {},
        byStatus: {},
        byPosition: {}
    };

    employees.forEach(emp => {
        summary.byDepartment[emp.department] = (summary.byDepartment[emp.department] || 0) + 1;
        summary.byStatus[emp.status] = (summary.byStatus[emp.status] || 0) + 1;
        summary.byPosition[emp.position] = (summary.byPosition[emp.position] || 0) + 1;
    });

    return {
        data: employees,
        summary
    };
};

/**
 * Generate expense report
 */
const generateExpenseReport = async (query, config) => {
    const { startDate, endDate, category, status } = config.filters || {};
    
    const matchQuery = { ...query };
    
    if (startDate || endDate) {
        matchQuery.expenseDate = {};
        if (startDate) matchQuery.expenseDate.$gte = new Date(startDate);
        if (endDate) matchQuery.expenseDate.$lte = new Date(endDate);
    }

    if (category && category.length > 0) {
        matchQuery.category = { $in: category };
    }

    if (status && status.length > 0) {
        matchQuery.status = { $in: status };
    }

    const expenses = await Expense.find(matchQuery)
        .populate('employeeId', 'name lastName email department')
        .sort({ expenseDate: -1 });

    const summary = {
        totalExpenses: expenses.length,
        totalAmount: expenses.reduce((sum, e) => sum + (e.amount || 0), 0),
        byCategory: {},
        byStatus: {}
    };

    expenses.forEach(e => {
        summary.byCategory[e.category] = (summary.byCategory[e.category] || 0) + (e.amount || 0);
        summary.byStatus[e.status] = (summary.byStatus[e.status] || 0) + 1;
    });

    return {
        data: expenses,
        summary
    };
};

/**
 * Create a new report
 */
export const createReport = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const userId = req.user?._id || req.employee?._id;

    const {
        name,
        description,
        reportType,
        config,
        exportSettings,
        schedule
    } = req.body;

    // Generate report data based on type
    let reportData = null;
    const query = addOrganizationFilter(req, {});

    switch (reportType) {
        case 'Payroll':
            reportData = await generatePayrollReport(query, config);
            break;
        case 'Attendance':
            reportData = await generateAttendanceReport(query, config);
            break;
        case 'Leave':
            reportData = await generateLeaveReport(query, config);
            break;
        case 'Employee':
            reportData = await generateEmployeeReport(query, config);
            break;
        case 'Expense':
            reportData = await generateExpenseReport(query, config);
            break;
        default:
            return sendError(res, 'Invalid report type', 400, 'INVALID_REPORT_TYPE');
    }

    const report = new Report({
        organizationId,
        createdBy: userId,
        name,
        description,
        reportType,
        config,
        data: reportData,
        exportSettings: exportSettings || { format: 'PDF' },
        schedule: schedule || { enabled: false }
    });

    await report.save();

    return sendSuccess(res, { report }, 'Report created successfully', 201);
});

/**
 * Get all reports
 */
export const getReports = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { reportType, isTemplate, page = 1, limit = 20 } = req.query;

    const query = addOrganizationFilter(req, { status: 'Active' });

    if (reportType) {
        query.reportType = reportType;
    }

    if (isTemplate !== undefined) {
        query.isTemplate = isTemplate === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reports = await Report.find(query)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Report.countDocuments(query);

    return sendSuccess(res, {
        reports,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    }, 'Reports fetched successfully');
});

/**
 * Get report by ID
 */
export const getReportById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const report = await Report.findOne({
        _id: id,
        organizationId
    }).populate('createdBy', 'name email');

    if (!report) {
        return sendNotFound(res, 'Report');
    }

    return sendSuccess(res, { report }, 'Report fetched successfully');
});

/**
 * Regenerate report data
 */
export const regenerateReport = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const report = await Report.findOne({
        _id: id,
        organizationId
    });

    if (!report) {
        return sendNotFound(res, 'Report');
    }

    const query = addOrganizationFilter(req, {});
    let reportData = null;

    switch (report.reportType) {
        case 'Payroll':
            reportData = await generatePayrollReport(query, report.config);
            break;
        case 'Attendance':
            reportData = await generateAttendanceReport(query, report.config);
            break;
        case 'Leave':
            reportData = await generateLeaveReport(query, report.config);
            break;
        case 'Employee':
            reportData = await generateEmployeeReport(query, report.config);
            break;
        case 'Expense':
            reportData = await generateExpenseReport(query, report.config);
            break;
    }

    report.data = reportData;
    await report.save();

    return sendSuccess(res, { report }, 'Report regenerated successfully');
});

/**
 * Update report
 */
export const updateReport = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const report = await Report.findOne({
        _id: id,
        organizationId
    });

    if (!report) {
        return sendNotFound(res, 'Report');
    }

    const allowedFields = ['name', 'description', 'config', 'exportSettings', 'schedule', 'isPublic', 'isTemplate'];
    allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
            report[field] = req.body[field];
        }
    });

    await report.save();

    return sendSuccess(res, { report }, 'Report updated successfully');
});

/**
 * Delete report
 */
export const deleteReport = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const report = await Report.findOne({
        _id: id,
        organizationId
    });

    if (!report) {
        return sendNotFound(res, 'Report');
    }

    report.status = 'Deleted';
    await report.save();

    return sendSuccess(res, null, 'Report deleted successfully');
});

