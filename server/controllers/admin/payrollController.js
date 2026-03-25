import Payroll from "../../models/payroll.model.js";
import Employee from"../../models/employee.model.js"
import { transferToBank } from "../../helpers/paymentService.js";
import logger from "../../helpers/logger.js";
import { getManagerEmployeeIds, isEmployeeLinkedToManager, buildManagerMatchQuery } from "../../helpers/managerHelper.js";
import { logCreate, logUpdate } from "../../helpers/auditLogger.js";
import { computeEarningsFromGross, employeePfFromBasicWage } from "../../helpers/salaryCalculation.js";
import {
    pickDisplayPayroll,
    buildGeneratedPayrollPayload,
    isFinalGenerationAllowedForPeriod
} from "../../helpers/payrollGenerationHelper.js";
import { aggregatePayrollPeriod } from "../../helpers/payrollAggregationHelper.js";

const MONTH_ORDER = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };

function sortPayrollsByYearMonth(payrolls, descending = true) {
    return payrolls.slice().sort((a, b) => {
        const yA = a.year || 0, yB = b.year || 0;
        if (yA !== yB) return descending ? yB - yA : yA - yB;
        const mA = MONTH_ORDER[a.month] || 0, mB = MONTH_ORDER[b.month] || 0;
        return descending ? mB - mA : mA - mB;
    });
}

function normalizePayrollForDisplay(payroll) {
    if (!payroll || typeof payroll !== 'object') return payroll;

    const earnings = payroll.earnings && typeof payroll.earnings === 'object' ? { ...payroll.earnings } : {};
    const deductions = payroll.deductions && typeof payroll.deductions === 'object' ? { ...payroll.deductions } : {};

    deductions.pfEmployee = employeePfFromBasicWage(earnings.basicWage);

    const earningsFields = [
        'basicWage',
        'houseRentAllowance',
        'transportAllowance',
        'medicalAllowance',
        'overtime',
        'gratuity',
        'specialAllowance',
        'performanceBonus',
        'projectBonus',
        'attendanceBonus',
        'pfEmployer',
        'esiEmployer'
    ];
    const deductionFields = [
        'pfEmployee',
        'esiEmployee',
        'professionalTax',
        'incomeTax',
        'advanceSalary',
        'loanDeduction',
        'otherDeductions'
    ];

    earnings.totalEarnings = earningsFields.reduce((sum, key) => sum + (Number(earnings[key]) || 0), 0);
    deductions.total = deductionFields.reduce((sum, key) => sum + (Number(deductions[key]) || 0), 0);

    return {
        ...payroll,
        earnings,
        deductions,
        ctc: earnings.totalEarnings,
        inHandSalary: earnings.totalEarnings - deductions.total
    };
}

// Update payroll details
export const updatePayroll = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const adminId = req.user?._id;

        // Paid status is controlled by CEO disbursement (so bank transfer + lock happens together).
        if (updates?.status === 'Paid') {
            return res.status(403).json({
                success: false,
                message: 'Paid status can only be set after disbursement.'
            });
        }

        // Ensure earnings and deductions are objects
        const earnings = updates.earnings || {};
        const deductions = updates.deductions || {};
        deductions.pfEmployee = employeePfFromBasicWage(earnings.basicWage);

        // Calculate total earnings
        earnings.totalEarnings = 
            (earnings.basicWage || 0) +
            (earnings.houseRentAllowance || 0) +
            (earnings.transportAllowance || 0) +
            (earnings.medicalAllowance || 0) +
            (earnings.overtime || 0) +
            (earnings.gratuity || 0) +
            (earnings.specialAllowance || 0) +
            (earnings.performanceBonus || 0) +
            (earnings.projectBonus || 0) +
            (earnings.attendanceBonus || 0) +
            (earnings.pfEmployer || 0) +
            (earnings.esiEmployer || 0);

        // Calculate total deductions
        deductions.total = 
            (deductions.pfEmployee || 0) +
            (deductions.esiEmployee || 0) +
            (deductions.professionalTax || 0) +
            (deductions.incomeTax || 0) +
            (deductions.advanceSalary || 0) +
            (deductions.loanDeduction || 0) +
            (deductions.otherDeductions || 0);

        // Calculate CTC (Cost to Company)
        const ctc = earnings.totalEarnings;

        // Calculate in-hand salary
        const inHandSalary = earnings.totalEarnings - deductions.total;

        // Update final object with tracking
        const updateData = {
            ...updates,
            earnings,
            deductions,
            ctc,
            inHandSalary,
            lastModifiedBy: adminId
        };

        // Get payroll before update for audit log
        const payrollBefore = await Payroll.findById(id).populate('employeeId', 'name lastName email jobTitle department employeeId').lean();
        
        if (!payrollBefore) {
            return res.status(404).json({ 
                success: false,
                message: 'Payroll not found' 
            });
        }

        if (payrollBefore.status === 'Paid' || payrollBefore.status === 'Processed' || payrollBefore.payrollLocked) {
            return res.status(403).json({
                success: false,
                message: 'This payroll is paid or locked and cannot be edited.'
            });
        }

        // Off-cycle adjustments should never be created/treated as preview/provisional.
        if (payrollBefore.type === 'off_cycle') {
            updateData.type = 'off_cycle';
            updateData.generationType = 'final';
            updateData.isProvisional = false;
            updateData.payrollLocked = false;
            updateData.isVisible = true;
        }

        // Perform the update
        const payroll = await Payroll.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        ).populate('employeeId', 'name lastName email jobTitle department employeeId');

        // Log audit trail
        await logUpdate({
            entityType: 'Payroll',
            entityId: payroll._id,
            entityName: `Payroll for ${payroll.employeeId?.name || 'Employee'}`,
            req,
            before: payrollBefore,
            after: payroll.toObject(),
            metadata: {
                month: payroll.month,
                year: payroll.year,
                inHandSalary: payroll.inHandSalary,
                ctc: payroll.ctc
            }
        });

        const { invalidatePayrollCache } = await import('../../helpers/cacheHelper.js');
        await invalidatePayrollCache();

        res.status(200).json({
            success: true,
            message: 'Payroll updated successfully',
            data: payroll
        });
    } catch (error) {
        logger.error('Update Payroll Error', { error: error.message, stack: error.stack });
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
};

// Get payroll details for logged-in employee
export const getEmployeePayroll = async (req, res) => {
    try {
        const employeeId = req.employee._id; // Authenticated employee's ID
        const { month, year } = req.query;

        // Fetch employee details
        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Import organization helper for multi-tenancy support
        const { addOrganizationFilter } = await import('../../helpers/organizationHelper.js');
        
        // Build query with organization filter - SECURITY: Ensures multi-tenancy isolation
        const query = addOrganizationFilter(req, {
            employeeId,
            month,
            year,
            isVisible: true
        });

        const rawList = await Payroll.find(query)
            .sort({ updatedAt: -1, createdAt: -1 })
            .populate('employeeId', 'name designation salary jobTitle department')
            .lean();

        const aggregated = aggregatePayrollPeriod(rawList);
        if (!aggregated?.monthly) {
            return res.status(404).json({
                success: false,
                message: 'No payroll found for this period.'
            });
        }

        const normalizedPayroll = normalizePayrollForDisplay(aggregated.monthly);
        normalizedPayroll.earnings.totalEarnings = aggregated.final.earningsTotal;
        normalizedPayroll.deductions.total = aggregated.final.deductionsTotal;
        normalizedPayroll.ctc = aggregated.final.earningsTotal;
        normalizedPayroll.inHandSalary = aggregated.final.net;

        res.json({
            ...normalizedPayroll,
            adjustments: aggregated.adjustments
        });
    } catch (error) {
        logger.error('Payroll Error', { error: error.message, stack: error.stack });
        res.status(500).json({ message: error.message });
    }
};


// Get all payrolls (optionally filtered by month/year) for the current organization
export const getAllPayrolls = async (req, res) => {
    try {
        // Import organization helper for multi-tenancy support
        const { addOrganizationFilter } = await import('../../helpers/organizationHelper.js');
        
        const { month, year } = req.query;
        const isAdmin = req.user?.role === 'admin';
        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        
        // Build base query: only add month/year when explicitly provided
        // Dashboard calls this endpoint without params to fetch all payrolls
        const baseQuery = {};
        if (month != null && month !== '') {
            baseQuery.month = month;
        }
        if (year != null && year !== '') {
            const yearNum = parseInt(year, 10);
            if (!Number.isNaN(yearNum)) {
                baseQuery.year = yearNum;
            }
        }

        // Add organization filter for multi-tenancy isolation
        const query = addOrganizationFilter(req, baseQuery);
        
        if (!isAdmin) {
            query.isVisible = true;
        }

        // If user is a manager, filter by manager field
        // Example: Manager "Arun Kumar" sees payrolls for employees with manager="Arun Kumar" or "Arun"
        if (isManager && req.employee) {
            const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
            const managerEmployeeIds = await getManagerEmployeeIds(Employee, organizationId, req.employee);
            query.employeeId = { $in: managerEmployeeIds };
            
            const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();
            logger.info('Manager filtering payrolls by manager field', {
                managerId: req.employee._id,
                managerName: managerName,
                employeeCount: managerEmployeeIds.length
            });
        }

        const payrolls = await Payroll.find(query)
            .sort({ year: -1, createdAt: -1 })
            .populate('employeeId', 'name designation salary jobTitle department')
            .lean();

        // Enrich response with flattened fields for dashboards (without removing raw data)
        // Filter out records that have lost their employee reference (orphaned test data)
        const enrichedPayrolls = payrolls
          .filter((p) => !!p.employeeId)
          .map((p) => {
            const employeeName =
                p.employeeName ||
                (p.employeeId && (p.employeeId.name || p.employeeId.fullName)) ||
                'Unknown Employee';

            const amount =
                p.amount ??
                p.totalAmount ??
                p.inHandSalary ??
                p.ctc ??
                (p.earnings && p.earnings.totalEarnings) ??
                p.basicSalary ??
                0;

            return {
                ...p,
                employeeName,
                amount,
                totalAmount: p.totalAmount ?? amount,
            };
        });

        res.json({
            success: true,
            payrolls: enrichedPayrolls,
            message: 'Payrolls retrieved successfully'
        });
    } catch (error) {
        logger.error('Get All Payrolls Error', { error: error.message, stack: error.stack });
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
};

// Create new payroll
export const createPayroll = async (req, res) => {
    try {
        const payrollData = req.body;
        
        // Get organizationId from request context (multi-tenancy security)
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
        if (!organizationId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Organization ID is required. Please ensure you are authenticated.' 
            });
        }
        
        // If employeeId is provided, verify it belongs to the same organization
        if (payrollData.employeeId) {
            const employee = await Employee.findById(payrollData.employeeId).select('organizationId').lean();
            if (!employee) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Employee not found' 
                });
            }
            if (employee.organizationId && employee.organizationId.toString() !== organizationId.toString()) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Access denied. Employee does not belong to your organization.' 
                });
            }
        }

        const { month, year } = payrollData;
        if (!month || year == null) {
            return res.status(400).json({
                success: false,
                message: 'Month and year are required to create payroll.'
            });
        }
        const yearNum = parseInt(year, 10);

        // Backward compatibility: existing UI typically creates/updates monthly base payroll.
        // Only create off-cycle adjustments when the caller explicitly sets `type: 'off_cycle'`.
        const recordType = payrollData.type === 'off_cycle' ? 'off_cycle' : 'monthly';

        const subType = recordType === 'off_cycle' ? (payrollData.subType || 'correction') : undefined;
        const adjustmentMode = recordType === 'off_cycle' ? (payrollData.adjustmentMode || 'earning') : undefined;
        const genType = payrollData.generationType === 'preview' ? 'preview' : 'final';

        if (recordType === 'monthly') {
            const existing = await Payroll.findOne({
                organizationId,
                employeeId: payrollData.employeeId,
                month,
                year: yearNum,
                type: 'monthly'
            });
            if (existing) {
                return res.status(409).json({
                    success: false,
                    message: `Monthly payroll already exists for this employee for ${month} ${year}.`
                });
            }
        }
        
        // Calculate totals
        const earnings = payrollData.earnings || {};
        const deductions = payrollData.deductions || {};
        deductions.pfEmployee = employeePfFromBasicWage(earnings.basicWage);

        earnings.totalEarnings = Object.values(earnings).reduce((sum, val) => sum + (val || 0), 0);
        deductions.total = Object.values(deductions).reduce((sum, val) => sum + (val || 0), 0);
        
        const ctc = earnings.totalEarnings;
        const inHandSalary = earnings.totalEarnings - deductions.total;
        
        const payroll = new Payroll({
            ...payrollData,
            organizationId: organizationId, // Override with request context for security
            earnings,
            deductions,
            ctc,
            inHandSalary,
            type: recordType,
            subType,
            adjustmentMode,
            generationType: recordType === 'monthly' ? genType : 'final',
            // Off-cycle never uses preview/provisional.
            isProvisional: recordType === 'monthly' ? genType === 'preview' : false,
            payrollLocked: false,
            isVisible: true
        });
        
        await payroll.save();
        
        const populatedPayroll = await Payroll.findById(payroll._id)
            .populate('employeeId', 'name lastName email jobTitle department employeeId');
        
        // Log audit trail
        await logCreate({
            entityType: 'Payroll',
            entityId: payroll._id,
            entityName: `Payroll for ${populatedPayroll.employeeId?.name || 'Employee'}`,
            req,
            before: null,
            after: populatedPayroll.toObject(),
            metadata: {
                month: payroll.month,
                year: payroll.year,
                inHandSalary: payroll.inHandSalary,
                ctc: payroll.ctc
            }
        });

        const { invalidatePayrollCache } = await import('../../helpers/cacheHelper.js');
        await invalidatePayrollCache();
        
        res.status(201).json(populatedPayroll);
    } catch (error) {
        logger.error('Create Payroll Error', { error: error.message, stack: error.stack });
        res.status(500).json({ message: error.message });
    }
};

// Get specific employee's payroll data for admin
export const getEmployeePayrollForAdmin = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { page = 1, limit = 12 } = req.query;

        // If user is a manager (not admin or HR), verify employee is linked to them
        // Example: Manager "Arun Kumar" can only view payroll for employees with manager="Arun Kumar" or "Arun"
        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        if (isManager && req.employee) {
            const employee = await Employee.findById(employeeId).select('manager').lean();
            if (!employee) {
                return res.status(404).json({ 
                    success: false,
                    message: 'Employee not found.' 
                });
            }
            
            // Check if employee's manager field matches this manager
            const isLinked = isEmployeeLinkedToManager(employee, req.employee);
            
            if (!isLinked) {
                const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();
                logger.warn('Manager trying to access payroll for unlinked employee', {
                    managerId: req.employee._id,
                    managerName: managerName,
                    employeeManager: employee.manager,
                    employeeId: employeeId
                });
                return res.status(403).json({ 
                    success: false,
                    message: 'You can only view payroll for employees linked to you.' 
                });
            }
        }

        const skip = (page - 1) * limit;
        const limitNum = Math.min(parseInt(limit, 10) || 12, 24);

        // Import organization helper for multi-tenancy support
        const { addOrganizationFilter } = await import('../../helpers/organizationHelper.js');
        
        // Build query with organization filter - SECURITY: Ensures multi-tenancy isolation
        const query = addOrganizationFilter(req, { employeeId, type: 'monthly', isProvisional: false });

        const total = await Payroll.countDocuments(query);
        const fetchSize = Math.min(skip + limitNum, 120);
        const raw = await Payroll.find(query)
            .sort({ year: -1 })
            .limit(fetchSize)
            .populate('employeeId', 'name lastName email jobTitle department employeeId')
            .lean();
        const sorted = sortPayrollsByYearMonth(raw, true);
        const paged = sorted.slice(skip, skip + limitNum);
        // Include off-cycle adjustments in final totals (N+1 is OK for small page sizes).
        const payrolls = await Promise.all(
            paged.map(async (monthlyPayroll) => {
                const normalized = normalizePayrollForDisplay(monthlyPayroll);

                const { addOrganizationFilter } = await import('../../helpers/organizationHelper.js');
                const adjustmentsQuery = addOrganizationFilter(req, {
                    employeeId,
                    month: monthlyPayroll.month,
                    year: monthlyPayroll.year,
                    type: 'off_cycle'
                });
                const adjustments = await Payroll.find(adjustmentsQuery).lean();

                const aggregated = aggregatePayrollPeriod([monthlyPayroll, ...adjustments]);
                normalized.earnings.totalEarnings = aggregated.final.earningsTotal;
                normalized.deductions.total = aggregated.final.deductionsTotal;
                normalized.ctc = aggregated.final.earningsTotal;
                normalized.inHandSalary = aggregated.final.net;

                normalized.adjustments = aggregated.adjustments;
                return normalized;
            })
        );

        res.json({
            payrolls,
            totalPages: Math.ceil(total / limitNum),
            currentPage: parseInt(page, 10),
            total
        });
    } catch (error) {
        logger.error('Get Employee Payroll for Admin Error', { error: error.message, stack: error.stack });
        res.status(500).json({ message: error.message });
    }
};

// Get specific payroll by employee ID, month, and year (admin view)
export const getPayrollByEmployeeMonthYear = async (req, res) => {
    try {
        const { employeeId, month, year } = req.params;

        // If user is a manager (not admin or HR), verify employee is linked to them
        // Example: Manager "Arun Kumar" can only view payroll for employees with manager="Arun Kumar" or "Arun"
        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        if (isManager && req.employee) {
            const employee = await Employee.findById(employeeId).select('manager').lean();
            if (!employee) {
                return res.status(404).json({ 
                    success: false,
                    message: 'Employee not found.' 
                });
            }
            
            // Check if employee's manager field matches this manager
            const isLinked = isEmployeeLinkedToManager(employee, req.employee);
            
            if (!isLinked) {
                const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();
                logger.warn('Manager trying to access payroll for unlinked employee', {
                    managerId: req.employee._id,
                    managerName: managerName,
                    employeeManager: employee.manager,
                    employeeId: employeeId
                });
                return res.status(403).json({ 
                    success: false,
                    message: 'You can only view payroll for employees linked to you.' 
                });
            }
        }
        
        const { addOrganizationFilter } = await import('../../helpers/organizationHelper.js');

        const monthDecoded = decodeURIComponent(month);
        const yearNum = parseInt(year, 10);
        const query = addOrganizationFilter(req, {
            employeeId,
            month: monthDecoded,
            year: yearNum
        });

        const rawList = await Payroll.find(query)
            .sort({ updatedAt: -1, createdAt: -1 })
            .populate('employeeId', 'name lastName email jobTitle department employeeId')
            .lean();

        const aggregated = aggregatePayrollPeriod(rawList);
        if (!aggregated?.monthly) {
            return res.status(404).json({
                success: false,
                message: 'No payroll found for this employee and period.'
            });
        }

        const monthly = aggregated.monthly;
        const normalizedPayroll = normalizePayrollForDisplay(monthly);
        normalizedPayroll.earnings.totalEarnings = aggregated.final.earningsTotal;
        normalizedPayroll.deductions.total = aggregated.final.deductionsTotal;
        normalizedPayroll.ctc = aggregated.final.earningsTotal;
        normalizedPayroll.inHandSalary = aggregated.final.net;

        res.json({
            ...normalizedPayroll,
            adjustments: aggregated.adjustments
        });
    } catch (error) {
        logger.error('Get Payroll by Employee Month Year Error', { error: error.message, stack: error.stack });
        res.status(500).json({ message: error.message });
    }
};

// Get single payroll by ID (admin/manager view) - for details modal
export const getPayrollById = async (req, res) => {
    try {
        const { id } = req.params;
        const { addOrganizationFilter } = await import('../../helpers/organizationHelper.js');

        const query = addOrganizationFilter(req, { _id: id });
        const payroll = await Payroll.findOne(query)
            .populate('employeeId', 'name lastName email jobTitle department employeeId')
            .lean();

        if (!payroll) {
            return res.status(404).json({ success: false, message: 'Payroll not found' });
        }

        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        if (isManager && req.employee && payroll.employeeId) {
            const employee = await Employee.findById(payroll.employeeId._id || payroll.employeeId).select('manager').lean();
            if (employee && !isEmployeeLinkedToManager(employee, req.employee)) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only view payroll for employees linked to you.'
                });
            }
        }

        const normalizedPayroll = normalizePayrollForDisplay(payroll);
        res.json(normalizedPayroll);
    } catch (error) {
        logger.error('Get Payroll by ID Error', { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get current month payroll for specific employee (admin view)
export const getCurrentMonthPayrollForAdmin = async (req, res) => {
    try {
        const { employeeId } = req.params;
        
        // If user is a manager (not admin or HR), verify employee is linked to them
        // Example: Manager "Arun Kumar" can only view payroll for employees with manager="Arun Kumar" or "Arun"
        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        if (isManager && req.employee) {
            const employee = await Employee.findById(employeeId).select('manager').lean();
            if (!employee) {
                return res.status(404).json({ 
                    success: false,
                    message: 'Employee not found.' 
                });
            }
            
            // Check if employee's manager field matches this manager
            const isLinked = isEmployeeLinkedToManager(employee, req.employee);
            
            if (!isLinked) {
                const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();
                logger.warn('Manager trying to access payroll for unlinked employee', {
                    managerId: req.employee._id,
                    managerName: managerName,
                    employeeManager: employee.manager,
                    employeeId: employeeId
                });
                return res.status(403).json({ 
                    success: false,
                    message: 'You can only view payroll for employees linked to you.' 
                });
            }
        }
        
        const currentDate = new Date();
        const month = currentDate.toLocaleString('default', { month: 'long' });
        const year = currentDate.getFullYear();

        const { addOrganizationFilter } = await import('../../helpers/organizationHelper.js');
        const payQuery = addOrganizationFilter(req, { employeeId, month, year });

        const rawList = await Payroll.find(payQuery)
            .sort({ updatedAt: -1, createdAt: -1 })
            .populate('employeeId', 'name lastName email jobTitle department employeeId')
            .lean();

        const aggregated = aggregatePayrollPeriod(rawList);
        if (!aggregated?.monthly) {
            return res.status(404).json({
                success: false,
                message: 'No payroll exists for the current month. Generate or create payroll for this period first.'
            });
        }

        const monthly = aggregated.monthly;
        const normalizedPayroll = normalizePayrollForDisplay(monthly);
        normalizedPayroll.earnings.totalEarnings = aggregated.final.earningsTotal;
        normalizedPayroll.deductions.total = aggregated.final.deductionsTotal;
        normalizedPayroll.ctc = aggregated.final.earningsTotal;
        normalizedPayroll.inHandSalary = aggregated.final.net;

        res.json({
            ...normalizedPayroll,
            adjustments: aggregated.adjustments
        });
    } catch (error) {
        logger.error('Get Current Month Payroll for Admin Error', { error: error.message, stack: error.stack });
        res.status(500).json({ message: error.message });
    }
};

// Get all employees' payroll data for admin (Optimized - No N+1 queries)
export const getAllEmployeesPayroll = async (req, res) => {
    try {
        const { parsePagination, sendPaginatedResponse } = await import('../../helpers/paginationHelper.js');
        const { addOrganizationFilter } = await import('../../helpers/organizationHelper.js');
        
        // Parse pagination
        const { page, limit, skip } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });

        // Use current month/year if not provided
        const month = req.query.month || new Date().toLocaleString('default', { month: 'long' });
        const year = parseInt(req.query.year) || new Date().getFullYear();

        // Build query with organization filter
        const query = addOrganizationFilter(req, { salary: { $exists: true } });

        // If user is a manager (not admin or HR), filter by manager field
        // Example: Manager "Arun Kumar" sees payrolls for employees with manager="Arun Kumar" or "Arun"
        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        if (isManager && req.employee) {
            const managerQuery = buildManagerMatchQuery(req.employee);
            if (managerQuery && managerQuery.$or) {
                query.$or = managerQuery.$or;
            }
            query.status = 'active'; // Only active employees for managers
            
            const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();
            logger.info('Manager filtering employee payrolls by manager field', {
                managerId: req.employee._id,
                managerName: managerName
            });
        }

        // Get employees with pagination
        const [employees, totalEmployees] = await Promise.all([
            Employee.find(query)
                .select('name salary designation jobTitle department position _id')
                .skip(skip)
                .limit(limit)
                .lean(),
            Employee.countDocuments(query)
        ]);

        // Get all payrolls for these employees in one query (fixes N+1)
        const employeeIds = employees.map(emp => emp._id);
        const payrolls = await Payroll.find(
            addOrganizationFilter(req, {
                employeeId: { $in: employeeIds },
                month,
                year
            })
        )
            .sort({ updatedAt: -1, createdAt: -1 })
            .lean();

        const byEmployee = new Map();
        for (const p of payrolls) {
            const key = p.employeeId.toString();
            if (!byEmployee.has(key)) byEmployee.set(key, []);
            byEmployee.get(key).push(p);
        }

        const payrollSummaries = employees.map((employee) => {
            const list = byEmployee.get(employee._id.toString()) || [];
            const aggregated = aggregatePayrollPeriod(list);
            const monthly = aggregated?.monthly;
            const norm = monthly ? normalizePayrollForDisplay(monthly) : null;
            const leaveDays =
                monthly?.leaves?.reduce((sum, lv) => sum + (Number(lv?.days) || 0), 0) || 0;

            const finalEarningsTotal = aggregated?.final?.earningsTotal ?? 0;
            const finalDeductionsTotal = aggregated?.final?.deductionsTotal ?? 0;
            const finalNet = aggregated?.final?.net ?? 0;

            const adjustments = aggregated?.adjustments?.map((p) => ({
                payrollId: p._id,
                subType: p.subType,
                status: p.status,
                paidAmount: p.paidAmount ?? 0,
                generationType: p.generationType,
                isProvisional: p.isProvisional,
                isVisible: p.isVisible,
                earningsTotal: Number(p?.earnings?.totalEarnings) || 0,
                deductionsTotal: Number(p?.deductions?.total) || 0,
                netDelta: Number(p?.earnings?.totalEarnings || 0) - Number(p?.deductions?.total || 0)
            })) || [];

            return {
                employeeId: employee._id,
                name: employee.name,
                designation: employee.designation,
                jobTitle: employee.jobTitle,
                department: employee.department,
                position: employee.position,
                basicSalary: employee.salary,
                ctc: finalEarningsTotal,
                inHandSalary: finalNet,
                totalEarnings: finalEarningsTotal,
                totalDeductions: finalDeductionsTotal,
                leaves: leaveDays,
                status: monthly?.status || 'Not Generated',
                isVisible: monthly?.isVisible !== false,
                payrollId: monthly?._id,
                generationType: monthly?.generationType ?? 'final',
                isProvisional: !!monthly?.isProvisional,
                computedAsOf: monthly?.computedAsOf,
                // UI uses earnings/deductions breakdown; keep monthly breakdown but replace totals with final.
                earnings: norm?.earnings ?? null,
                deductions: norm?.deductions ?? null,
                adjustments
            };
        });

        return sendPaginatedResponse(res, payrollSummaries, page, limit, totalEmployees, 'Payroll data retrieved successfully');
    } catch (error) {
        logger.error('Admin Payroll Error', { error: error.message, stack: error.stack });
        res.status(500).json({ message: error.message });
    }
};

// Toggle payroll visibility
export const togglePayrollVisibility = async (req, res) => {
    try {
        const { id } = req.params;
        const { isVisible } = req.body;

        const payroll = await Payroll.findByIdAndUpdate(
            id,
            { isVisible },
            { new: true }
        ).populate('employeeId', 'name lastName email');

        if (!payroll) {
            return res.status(404).json({ 
                success: false,
                message: 'Payroll not found' 
            });
        }

        // Send push notification when payroll is made visible
        if (isVisible && payroll.employeeId) {
            try {
                const { notifyPayrollReleased } = await import('../../helpers/pushNotificationTriggers.js');
                await notifyPayrollReleased(payroll.employeeId._id || payroll.employeeId, payroll);
            } catch (notifError) {
                logger.warn('Failed to send payroll release notification', {
                    error: notifError.message,
                    payrollId: payroll._id
                });
                // Don't fail the request if notification fails
            }
        }

        const { invalidatePayrollCache } = await import('../../helpers/cacheHelper.js');
        await invalidatePayrollCache();

        res.status(200).json({
            success: true,
            message: `Payroll ${isVisible ? 'visible' : 'hidden'} successfully`,
            data: payroll
        });
    } catch (error) {
        logger.error('Toggle Visibility Error', { error: error.message, stack: error.stack });
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
};

// Generate or refresh payrolls for all employees for a given month/year (preview = provisional, final = closed month)
export const generatePayrollsForMonthYear = async (req, res) => {
    try {
        const { month, year, mode: modeRaw, forceFinalBeforePeriodEnd } = req.body;
        if (!month || !year) {
            return res.status(400).json({ success: false, message: 'month and year are required' });
        }

        const mode = modeRaw === 'preview' ? 'preview' : 'final';

        const targetYear = parseInt(year, 10);
        const targetMonthIndex = new Date(`${month} 1, ${year}`).getMonth();
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonthIndex = now.getMonth();

        if (Number.isNaN(targetYear)) {
            return res.status(400).json({ success: false, message: 'Invalid year value' });
        }

        if (targetYear > currentYear || (targetYear === currentYear && targetMonthIndex > currentMonthIndex)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot generate payrolls for future months. Only current and past months are allowed.'
            });
        }

        if (
            mode === 'final' &&
            !forceFinalBeforePeriodEnd &&
            !isFinalGenerationAllowedForPeriod(now, targetYear, targetMonthIndex)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Final payroll can only be generated on or after the last day of the selected month. Use preview for mid-month estimates, or send forceFinalBeforePeriodEnd: true only if you intentionally need an early close.'
            });
        }

        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
        if (!organizationId) {
            return res.status(400).json({
                success: false,
                message: 'Organization ID is required. Please ensure you are authenticated.'
            });
        }

        const employees = await Employee.find({
            salary: { $exists: true, $gt: 0 },
            organizationId: organizationId,
            active: true
        }).select('salary organizationId joiningDate');

        let created = 0;
        let updated = 0;
        let skipped = 0;
        const asOf = now;
        const endOfMonth = new Date(targetYear, targetMonthIndex + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);

        for (const emp of employees) {
            const orgId = emp.organizationId || organizationId;

            let existing = null;
            // Exactly one monthly record per employee per month.
            existing = await Payroll.findOne({
                employeeId: emp._id,
                month,
                year: targetYear,
                organizationId: orgId,
                type: 'monthly'
            });

            if (mode === 'final' && existing) {
                if (existing.status === 'Paid' || existing.payrollLocked || existing.status === 'Processed') {
                    skipped += 1;
                    continue;
                }
            }

            if (
                mode === 'preview' &&
                existing &&
                (existing.status === 'Paid' || existing.status === 'Processed' || existing.payrollLocked)
            ) {
                skipped += 1;
                continue;
            }

            const payload = await buildGeneratedPayrollPayload({
                emp,
                month,
                year: targetYear,
                organizationId,
                mode,
                asOf
            });

            const meta = {
                organizationId: orgId,
                employeeId: emp._id,
                month,
                year: targetYear,
                type: 'monthly',
                generationType: mode === 'preview' ? 'preview' : 'final',
                isProvisional: mode === 'preview',
                computedAsOf: mode === 'preview' ? asOf : endOfMonth,
                payrollLocked: false
            };
            // Allow employees (and admin) to see monthly payroll as soon as it's generated.
            meta.isVisible = true;

            if (existing) {
                await Payroll.findByIdAndUpdate(existing._id, {
                    ...payload,
                    ...meta,
                    // For FINAL generation we publish as Processed (not Paid).
                    status: mode === 'preview' ? 'Pending' : 'Processed'
                });
                updated += 1;
            } else {
                await Payroll.create({
                    ...payload,
                    ...meta,
                    status: mode === 'preview' ? 'Pending' : 'Processed'
                });
                created += 1;
            }
        }

        const { invalidatePayrollCache } = await import('../../helpers/cacheHelper.js');
        await invalidatePayrollCache();

        return res.json({
            success: true,
            mode,
            created,
            updated,
            skipped,
            provisional: mode === 'preview'
        });
    } catch (error) {
        logger.error('Generate Payrolls Error', { error: error.message, stack: error.stack });
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Disburse payrolls for a given month/year
export const disbursePayrolls = async (req, res) => {
    try {
        // CEO-only access check (extra security layer)
        const isCEO = req.employee && (
            (req.employee.position || '').toLowerCase().trim() === 'ceo' ||
            (req.employee.position || '').toLowerCase().trim().includes('chief executive')
        );
        
        if (!isCEO) {
            logger.warn('Unauthorized payroll disbursement attempt', {
                userId: req.user?._id || req.employee?._id,
                role: req.user?.role || req.employee?.role,
                position: req.employee?.position
            });
            return res.status(403).json({ 
                success: false, 
                message: 'Access restricted to CEO only. Only the CEO can disburse payroll.' 
            });
        }

        const adminId = req.employee?._id || req.user?._id;
        const { month, year } = req.body;
        if (!month || !year) {
            return res.status(400).json({ success: false, message: 'month and year are required' });
        }

        // Import organization helper for multi-tenancy support
        const { addOrganizationFilter } = await import('../../helpers/organizationHelper.js');
        
        // Build query with organization filter - SECURITY: Ensures multi-tenancy isolation
        const query = addOrganizationFilter(req, {
            month,
            year,
            // Only approved payrolls should be disbursed.
            status: 'Processed',
            payrollLocked: false,
            isProvisional: { $ne: true }
        });

        const payrolls = await Payroll.find(query)
            .populate('employeeId', 'financialDetails name lastName');

        if (!payrolls.length) {
            return res.json({ success: true, total: 0, paid: 0, failed: 0, results: [] });
        }

        const results = [];
        let paid = 0;
        let failed = 0;

        // Group by employee so full_override (F&F) can replace base payroll payment.
        const byEmployee = new Map();
        for (const pr of payrolls) {
            const key = String(pr.employeeId?._id || pr.employeeId || '');
            if (!byEmployee.has(key)) byEmployee.set(key, []);
            byEmployee.get(key).push(pr);
        }

        for (const [, group] of byEmployee) {
            const hasFullOverride = group.some(
                (p) => p?.type === 'off_cycle' && String(p?.adjustmentMode) === 'full_override'
            );

            const toPay = hasFullOverride
                ? group.filter((p) => p?.type === 'off_cycle')
                : group;

            for (const pr of toPay) {
                const employee = pr.employeeId;
                const fin = employee?.financialDetails || {};
                const earningsTotal = Number(pr?.earnings?.totalEarnings);
                const deductionsTotal = Number(pr?.deductions?.total);
                const amount = Math.round(
                    Number.isFinite(earningsTotal)
                        ? (earningsTotal - (Number.isFinite(deductionsTotal) ? deductionsTotal : 0))
                        : (Number(pr?.inHandSalary) || 0)
                );

                const transfer = await transferToBank({
                    amount,
                    beneficiary: {
                        accountNo: fin.accountNo,
                        ifsc: fin.ifsc,
                        accountName: fin.accountName,
                        bankName: fin.bankName
                    }
                });

                if (transfer.success) {
                    pr.status = 'Paid';
                    pr.paidAmount = amount;
                    pr.paymentDate = new Date();
                    pr.payrollLocked = true;
                    pr.paidDate = new Date();
                    pr.lastModifiedBy = adminId;
                    pr.payment = {
                        provider: transfer.provider,
                        reference: transfer.reference,
                        status: 'Success',
                        processedAt: new Date()
                    };
                    await pr.save();
                    paid += 1;
                    results.push({ 
                        payrollId: pr._id, 
                        employee: employee._id, 
                        employeeName: `${employee.name || ''} ${employee.lastName || ''}`.trim(),
                        employeeEmail: employee.email,
                        amount, 
                        status: 'Success', 
                        reference: transfer.reference 
                    });
                } else {
                    pr.payment = {
                        provider: 'mock-bank',
                        status: 'Failed',
                        processedAt: new Date(),
                        error: transfer.error
                    };
                    pr.paidAmount = 0;
                    pr.lastModifiedBy = adminId;
                    await pr.save();
                    failed += 1;
                    results.push({ 
                        payrollId: pr._id, 
                        employee: employee._id, 
                        employeeName: `${employee.name || ''} ${employee.lastName || ''}`.trim(),
                        employeeEmail: employee.email,
                        amount, 
                        status: 'Failed', 
                        error: transfer.error 
                    });
                }
            }
        }

        return res.json({ success: true, total: payrolls.length, paid, failed, results });
    } catch (error) {
        logger.error('Disburse Payrolls Error', { error: error.message, stack: error.stack });
        return res.status(500).json({ success: false, message: error.message });
    }
};