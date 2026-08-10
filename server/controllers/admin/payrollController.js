import Payroll from "../../models/payroll.model.js";
import { shouldScopeDataToManagedTeam } from '../../helpers/permissionService.js';
import Employee from"../../models/employee.model.js"
import { transferToBank } from "../../helpers/paymentService.js";
import logger from "../../helpers/logger.js";
import { getManagerEmployeeIds, isEmployeeLinkedToManager, buildManagerMatchQuery } from "../../helpers/managerHelper.js";
import { logCreate, logUpdate } from "../../helpers/auditLogger.js";
import { computeEarningsFromGross, employeePfFromBasicWage } from "../../helpers/salaryCalculation.js";
import {
    pickDisplayPayroll,
    buildGeneratedPayrollPayload,
    isFinalGenerationAllowedForPeriod,
    getPayrollMonthUtcBounds
} from "../../helpers/payrollGenerationHelper.js";
import { aggregatePayrollPeriod, attachPayrollRecordIds, isValidMongoObjectId } from "../../helpers/payrollAggregationHelper.js";
import { getCachedEffectiveTimezone } from "../../helpers/orgContextCache.js";
import { DateTime } from "luxon";

const MONTH_ORDER = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };

function sortPayrollsByYearMonth(payrolls, descending = true) {
    return payrolls.slice().sort((a, b) => {
        const yA = a.year || 0, yB = b.year || 0;
        if (yA !== yB) return descending ? yB - yA : yA - yB;
        const mA = MONTH_ORDER[a.month] || 0, mB = MONTH_ORDER[b.month] || 0;
        return descending ? mB - mA : mA - mB;
    });
}

function resolveRecomputeMode(month, year, requestedGenerationType = 'final') {
    const monthName = String(month || '');
    const yearNum = parseInt(year, 10);
    const monthIndex = new Date(`${monthName} 1, ${yearNum}`).getMonth();
    if (!Number.isFinite(yearNum) || Number.isNaN(monthIndex)) {
        return requestedGenerationType === 'preview' ? 'preview' : 'final';
    }
    // For explicit manual monthly creation/update, honor requested generation type.
    // This allows full-month calendar-day denominator even when payroll is created mid-month.
    return requestedGenerationType === 'preview' ? 'preview' : 'final';
}

function normalizePayrollForDisplay(payroll) {
    if (!payroll || typeof payroll !== 'object') return payroll;

    const rawEarnings = payroll.earnings && typeof payroll.earnings === 'object' ? { ...payroll.earnings } : {};
    const gratuityLegacy = Number(rawEarnings.gratuity) || 0;
    delete rawEarnings.gratuity;
    const earnings = rawEarnings;
    const deductions = payroll.deductions && typeof payroll.deductions === 'object' ? { ...payroll.deductions } : {};

    // Legacy payrolls used to compute specialAllowance as:
    //   gross - basicWage - houseRentAllowance - gratuity
    // For SPA we want: gross - (Basic + HRA). So fold legacy gratuity into specialAllowance.
    if (gratuityLegacy > 0) {
        earnings.specialAllowance = (Number(earnings.specialAllowance) || 0) + gratuityLegacy;
    }

    // Keep stored PF when present (supports custom/capped structures); fallback only for legacy rows.
    if (deductions.pfEmployee == null) {
        deductions.pfEmployee = employeePfFromBasicWage(earnings.basicWage);
    }

    const earningsFields = [
        'basicWage',
        'houseRentAllowance',
        'transportAllowance',
        'medicalAllowance',
        'overtime',
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

    return attachPayrollRecordIds({
        ...payroll,
        earnings,
        deductions,
        ctc: earnings.totalEarnings,
        inHandSalary: earnings.totalEarnings - deductions.total
    });
}

function pickAllowedCreateFields(payload = {}) {
    const allowed = {};
    const scalarFields = [
        'employeeId',
        'month',
        'year',
        'basicSalary',
        'status',
        'type',
        'subType',
        'adjustmentMode',
        'notes',
        'generationType'
    ];
    for (const key of scalarFields) {
        if (payload[key] !== undefined) allowed[key] = payload[key];
    }
    if (payload.earnings && typeof payload.earnings === 'object') {
        allowed.earnings = payload.earnings;
    }
    if (payload.deductions && typeof payload.deductions === 'object') {
        allowed.deductions = payload.deductions;
    }
    if (Array.isArray(payload.leaves)) {
        allowed.leaves = payload.leaves;
    }
    return allowed;
}

function buildDisbursementPlanForGroup(group = []) {
    const monthlyCandidates = group
        .filter((p) => p?.type === 'monthly')
        .slice()
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    const monthly = monthlyCandidates[0] || null;
    const adjustments = group.filter((p) => p?.type === 'off_cycle');

    const fullOverride = adjustments
        .filter((p) => String(p?.adjustmentMode) === 'full_override')
        .slice()
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0] || null;

    const payableRecords = [];
    if (fullOverride) {
        const cutoff = new Date(fullOverride.createdAt || fullOverride.updatedAt || 0).getTime();
        payableRecords.push(fullOverride);
        adjustments.forEach((adj) => {
            if (String(adj?._id) === String(fullOverride?._id)) return;
            const ts = new Date(adj.createdAt || adj.updatedAt || 0).getTime();
            if (Number.isFinite(ts) && ts >= cutoff) {
                payableRecords.push(adj);
            }
        });
    } else {
        if (monthly) payableRecords.push(monthly);
        payableRecords.push(...adjustments);
    }

    if (!payableRecords.length) {
        return null;
    }

    const aggregated = aggregatePayrollPeriod(payableRecords);
    const amount = Math.round(Number(aggregated?.final?.net) || 0);
    const employee = payableRecords[0]?.employeeId || group[0]?.employeeId;

    return {
        monthly,
        fullOverride,
        payableRecords,
        aggregated,
        amount,
        employee
    };
}

async function buildMonthlyPayrollGeneration({ payrollEmployee, month, year, organizationId, generationType }) {
    const effectiveGenerationType = generationType === 'preview' ? 'preview' : 'final';
    const recomputeMode = resolveRecomputeMode(month, year, effectiveGenerationType);
    const generatedPayload = await buildGeneratedPayrollPayload({
        emp: payrollEmployee,
        month,
        year,
        organizationId,
        mode: recomputeMode,
        asOf: new Date()
    });

    return {
        generatedPayload,
        recomputeMode
    };
}

// Update payroll details
export const updatePayroll = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const adminId = req.user?._id;
        const { addOrganizationFilter } = await import('../../helpers/organizationHelper.js');
        const query = addOrganizationFilter(req, { _id: id });

        // Paid status is controlled by CEO disbursement (so bank transfer + lock happens together).
        if (updates?.status === 'Paid') {
            return res.status(403).json({
                success: false,
                message: 'Paid status can only be set after disbursement.'
            });
        }

        // Get payroll before update for audit log
        const payrollBefore = await Payroll.findOne(query).populate('employeeId', 'name lastName email jobTitle department employeeId').lean();
        
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

        // Ensure earnings and deductions are objects
        const earnings = updates.earnings || {};
        const deductions = updates.deductions || {};
        deductions.pfEmployee = employeePfFromBasicWage(earnings.basicWage);

        // Calculate total earnings
        const gratuityLegacyUpdate = Number(earnings.gratuity) || 0;
        if (gratuityLegacyUpdate > 0) {
            earnings.specialAllowance = (Number(earnings.specialAllowance) || 0) + gratuityLegacyUpdate;
        }
        delete earnings.gratuity;

        earnings.totalEarnings = 
            (earnings.basicWage || 0) +
            (earnings.houseRentAllowance || 0) +
            (earnings.transportAllowance || 0) +
            (earnings.medicalAllowance || 0) +
            (earnings.overtime || 0) +
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

        // Off-cycle adjustments should never be created/treated as preview/provisional.
        if (payrollBefore.type === 'off_cycle') {
            updateData.type = 'off_cycle';
            updateData.generationType = 'final';
            updateData.isProvisional = false;
            updateData.payrollLocked = false;
            updateData.isVisible = true;
        }

        const targetType = updateData.type || payrollBefore.type || 'monthly';
        if (targetType === 'monthly') {
            const targetEmployeeId = updateData.employeeId || payrollBefore.employeeId?._id || payrollBefore.employeeId;
            const targetMonth = updateData.month || payrollBefore.month;
            const targetYear = parseInt(updateData.year ?? payrollBefore.year, 10);
            const targetOrganizationId =
                payrollBefore.organizationId ||
                req.organizationId ||
                req.user?.organizationId ||
                req.employee?.organizationId;

            if (targetEmployeeId && targetMonth && !Number.isNaN(targetYear)) {
                const payrollEmployee = await Employee.findById(targetEmployeeId)
                    .select('salary salaryRevisions organizationId joiningDate department position roleLevel salaryStructure status terminationDate lastWorkingDate financialDetails')
                    .lean();

                if (payrollEmployee) {
                    const generationType = updateData.generationType || payrollBefore.generationType || 'final';
                    const { generatedPayload, recomputeMode } = await buildMonthlyPayrollGeneration({
                        payrollEmployee,
                        month: targetMonth,
                        year: targetYear,
                        organizationId: targetOrganizationId,
                        generationType
                    });
                    updateData.basicSalary = generatedPayload.basicSalary;
                    updateData.earnings = generatedPayload.earnings;
                    updateData.deductions = generatedPayload.deductions;
                    updateData.ctc = generatedPayload.ctc;
                    updateData.inHandSalary = generatedPayload.inHandSalary;
                    updateData.workingDays = generatedPayload.workingDays;
                    updateData.presentDays = generatedPayload.presentDays;
                    updateData.unpaidLeave = generatedPayload.unpaidLeave;
                    updateData.paidLeaveDays = generatedPayload.paidLeaveDays;
                    updateData.leaves = generatedPayload.leaves;
                    updateData.generationType = recomputeMode === 'preview' ? 'preview' : 'final';
                    updateData.isProvisional = recomputeMode === 'preview';
                }
            }
        }

        // Perform the update
        const payroll = await Payroll.findOneAndUpdate(
            query,
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
        const isManager = shouldScopeDataToManagedTeam(req);
        
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
        const payrollData = pickAllowedCreateFields(req.body || {});
        let payrollEmployee = null;
        
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
            payrollEmployee = await Employee.findById(payrollData.employeeId)
                .select('organizationId salary salaryRevisions joiningDate department position roleLevel salaryStructure status terminationDate lastWorkingDate financialDetails')
                .lean();
            if (!payrollEmployee) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Employee not found' 
                });
            }
            if (payrollEmployee.organizationId && payrollEmployee.organizationId.toString() !== organizationId.toString()) {
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
        const requestedStatus = payrollData.status;
        let monthlyGeneratedData = null;

        if (recordType === 'monthly') {
            if (requestedStatus && !['Pending', 'Processed', 'Cancelled'].includes(requestedStatus)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status for monthly payroll creation.'
                });
            }
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
        if (recordType === 'off_cycle' && requestedStatus && !['Pending', 'Processed', 'Cancelled'].includes(requestedStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status for off-cycle payroll creation.'
            });
        }
        
        if (recordType === 'monthly' && payrollEmployee) {
            const { generatedPayload, recomputeMode } = await buildMonthlyPayrollGeneration({
                payrollEmployee,
                month,
                year: yearNum,
                organizationId,
                generationType: genType
            });
            monthlyGeneratedData = {
                basicSalary: generatedPayload.basicSalary,
                earnings: generatedPayload.earnings,
                deductions: generatedPayload.deductions,
                ctc: generatedPayload.ctc,
                inHandSalary: generatedPayload.inHandSalary,
                leaves: generatedPayload.leaves,
                workingDays: generatedPayload.workingDays,
                presentDays: generatedPayload.presentDays,
                unpaidLeave: generatedPayload.unpaidLeave,
                paidLeaveDays: generatedPayload.paidLeaveDays,
                generationType: recomputeMode === 'preview' ? 'preview' : 'final',
                isProvisional: recomputeMode === 'preview'
            };
        }

        // Calculate totals for manual off-cycle entries only.
        const earnings = payrollData.earnings || {};
        const deductions = payrollData.deductions || {};
        deductions.pfEmployee = employeePfFromBasicWage(earnings.basicWage);

        // Legacy payrolls used to compute specialAllowance as:
        //   gross - basicWage - houseRentAllowance - gratuity
        // For SPA we want: gross - (Basic + HRA). So fold legacy gratuity into specialAllowance.
        const gratuityLegacyCreate = Number(earnings.gratuity) || 0;
        if (gratuityLegacyCreate > 0) {
            earnings.specialAllowance = (Number(earnings.specialAllowance) || 0) + gratuityLegacyCreate;
        }
        delete earnings.gratuity;

        // Sum line items only — client sends totalEarnings/total alongside components; Object.values would double-count.
        earnings.totalEarnings =
            (Number(earnings.basicWage) || 0) +
            (Number(earnings.houseRentAllowance) || 0) +
            (Number(earnings.transportAllowance) || 0) +
            (Number(earnings.medicalAllowance) || 0) +
            (Number(earnings.overtime) || 0) +
            (Number(earnings.specialAllowance) || 0) +
            (Number(earnings.performanceBonus) || 0) +
            (Number(earnings.projectBonus) || 0) +
            (Number(earnings.attendanceBonus) || 0) +
            (Number(earnings.pfEmployer) || 0) +
            (Number(earnings.esiEmployer) || 0);

        deductions.total =
            (Number(deductions.pfEmployee) || 0) +
            (Number(deductions.esiEmployee) || 0) +
            (Number(deductions.professionalTax) || 0) +
            (Number(deductions.incomeTax) || 0) +
            (Number(deductions.advanceSalary) || 0) +
            (Number(deductions.loanDeduction) || 0) +
            (Number(deductions.otherDeductions) || 0);

        const ctc = earnings.totalEarnings;
        const inHandSalary = earnings.totalEarnings - deductions.total;
        
        const payroll = new Payroll({
            organizationId: organizationId, // Override with request context for security
            employeeId: payrollData.employeeId,
            month,
            year: yearNum,
            basicSalary: recordType === 'monthly' ? monthlyGeneratedData?.basicSalary : payrollData.basicSalary,
            status: requestedStatus || 'Pending',
            earnings: recordType === 'monthly' ? monthlyGeneratedData?.earnings : earnings,
            deductions: recordType === 'monthly' ? monthlyGeneratedData?.deductions : deductions,
            ctc: recordType === 'monthly' ? monthlyGeneratedData?.ctc : ctc,
            inHandSalary: recordType === 'monthly' ? monthlyGeneratedData?.inHandSalary : inHandSalary,
            leaves: recordType === 'monthly' ? monthlyGeneratedData?.leaves : payrollData.leaves,
            notes: payrollData.notes,
            type: recordType,
            subType,
            adjustmentMode,
            generationType: recordType === 'monthly' ? (monthlyGeneratedData?.generationType || genType) : 'final',
            // Off-cycle never uses preview/provisional.
            isProvisional: recordType === 'monthly' ? !!monthlyGeneratedData?.isProvisional : false,
            payrollLocked: false,
            isVisible: true,
            ...(recordType === 'monthly'
                ? {
                    workingDays: monthlyGeneratedData?.workingDays,
                    presentDays: monthlyGeneratedData?.presentDays,
                    unpaidLeave: monthlyGeneratedData?.unpaidLeave,
                    paidLeaveDays: monthlyGeneratedData?.paidLeaveDays
                }
                : {})
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
        if (error?.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Monthly payroll already exists for this employee and period.'
            });
        }
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
        const isManager = shouldScopeDataToManagedTeam(req);
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
        const isManager = shouldScopeDataToManagedTeam(req);
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
        if (!isValidMongoObjectId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid payroll ID' });
        }

        const { addOrganizationFilter } = await import('../../helpers/organizationHelper.js');

        const query = addOrganizationFilter(req, { _id: id });
        const payroll = await Payroll.findOne(query)
            .populate('employeeId', 'name lastName email jobTitle department employeeId')
            .lean();

        if (!payroll) {
            return res.status(404).json({ success: false, message: 'Payroll not found' });
        }

        const isManager = shouldScopeDataToManagedTeam(req);
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
        const isManager = shouldScopeDataToManagedTeam(req);
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
        const isManager = shouldScopeDataToManagedTeam(req);
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
                adjustmentMode: p.adjustmentMode,
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
        const { addOrganizationFilter } = await import('../../helpers/organizationHelper.js');
        const query = addOrganizationFilter(req, { _id: id });

        const payroll = await Payroll.findOneAndUpdate(
            query,
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
                const { notify } = await import('../../helpers/notificationManager.js');
                await import('../../helpers/notificationEventRegistry.js');
                await notify({
                    type: 'payroll_released',
                    organizationId: payroll.organizationId,
                    data: {
                        employee: payroll.employeeId,
                        payrollData: payroll
                    }
                });
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

// Mark one payroll entry as Processed (workflow transition)
export const processPayrollEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const { addOrganizationFilter } = await import('../../helpers/organizationHelper.js');
        const query = addOrganizationFilter(req, { _id: id });
        const payroll = await Payroll.findOne(query).populate('employeeId', 'name lastName email');

        if (!payroll) {
            return res.status(404).json({ success: false, message: 'Payroll not found' });
        }
        if (payroll.status === 'Paid' || payroll.payrollLocked) {
            return res.status(409).json({ success: false, message: 'Paid/locked payroll cannot be re-processed.' });
        }
        if (payroll.status === 'Cancelled') {
            return res.status(409).json({ success: false, message: 'Cancelled payroll cannot be processed.' });
        }
        if (payroll.isProvisional) {
            return res.status(409).json({ success: false, message: 'Preview/provisional payroll cannot be processed for payout.' });
        }

        payroll.status = 'Processed';
        payroll.lastModifiedBy = req.user?._id || req.employee?._id;
        payroll.processedDate = new Date();
        await payroll.save();

        const { invalidatePayrollCache } = await import('../../helpers/cacheHelper.js');
        await invalidatePayrollCache();

        return res.json({ success: true, message: 'Payroll processed successfully.', data: payroll });
    } catch (error) {
        logger.error('Process Payroll Entry Error', { error: error.message, stack: error.stack });
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Void one payroll entry before payout (workflow transition)
export const voidPayrollEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body || {};
        const { addOrganizationFilter } = await import('../../helpers/organizationHelper.js');
        const query = addOrganizationFilter(req, { _id: id });
        const payroll = await Payroll.findOne(query).populate('employeeId', 'name lastName email');

        if (!payroll) {
            return res.status(404).json({ success: false, message: 'Payroll not found' });
        }
        if (payroll.status === 'Paid' || payroll.payrollLocked) {
            return res.status(409).json({ success: false, message: 'Paid/locked payroll cannot be voided.' });
        }

        payroll.status = 'Cancelled';
        payroll.lastModifiedBy = req.user?._id || req.employee?._id;
        if (reason) {
            const base = (payroll.notes || '').trim();
            payroll.notes = `${base}${base ? '\n' : ''}[VOID] ${reason}`.slice(0, 500);
        }
        await payroll.save();

        const { invalidatePayrollCache } = await import('../../helpers/cacheHelper.js');
        await invalidatePayrollCache();

        return res.json({ success: true, message: 'Payroll entry voided successfully.', data: payroll });
    } catch (error) {
        logger.error('Void Payroll Entry Error', { error: error.message, stack: error.stack });
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Mark a monthly base payroll as superseded by an off-cycle full override.
export const supersedeMonthlyBase = async (req, res) => {
    try {
        const { monthlyPayrollId, overridePayrollId } = req.body || {};
        const { addOrganizationFilter } = await import('../../helpers/organizationHelper.js');
        const monthlyQuery = addOrganizationFilter(req, { _id: monthlyPayrollId });
        const overrideQuery = addOrganizationFilter(req, { _id: overridePayrollId });

        const [monthly, override] = await Promise.all([
            Payroll.findOne(monthlyQuery),
            Payroll.findOne(overrideQuery)
        ]);

        if (!monthly || !override) {
            return res.status(404).json({ success: false, message: 'Monthly or override payroll not found.' });
        }
        if (monthly.type !== 'monthly') {
            return res.status(400).json({ success: false, message: 'monthlyPayrollId must refer to a monthly payroll entry.' });
        }
        if (override.type !== 'off_cycle' || String(override.adjustmentMode) !== 'full_override') {
            return res.status(400).json({ success: false, message: 'overridePayrollId must be an off-cycle full_override entry.' });
        }
        if (override.status !== 'Processed') {
            return res.status(400).json({ success: false, message: 'Only processed full_override entries can supersede a monthly base.' });
        }
        if (String(monthly.employeeId) !== String(override.employeeId) || monthly.month !== override.month || Number(monthly.year) !== Number(override.year)) {
            return res.status(400).json({ success: false, message: 'Monthly and override entries must belong to same employee and period.' });
        }
        if (monthly.status === 'Paid' || monthly.payrollLocked) {
            return res.status(409).json({ success: false, message: 'Paid/locked monthly payroll cannot be superseded.' });
        }

        monthly.isSuperseded = true;
        monthly.supersededBy = override._id;
        monthly.supersededAt = new Date();
        monthly.lastModifiedBy = req.user?._id || req.employee?._id;
        await monthly.save();

        const { invalidatePayrollCache } = await import('../../helpers/cacheHelper.js');
        await invalidatePayrollCache();

        return res.json({
            success: true,
            message: 'Monthly payroll marked as superseded by override.',
            data: { monthlyPayrollId: monthly._id, overridePayrollId: override._id }
        });
    } catch (error) {
        logger.error('Supersede Monthly Payroll Error', { error: error.message, stack: error.stack });
        return res.status(500).json({ success: false, message: error.message });
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

        if (Number.isNaN(targetYear)) {
            return res.status(400).json({ success: false, message: 'Invalid year value' });
        }

        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
        if (!organizationId) {
            return res.status(400).json({
                success: false,
                message: 'Organization ID is required. Please ensure you are authenticated.'
            });
        }

        const orgTimezone = await getCachedEffectiveTimezone(organizationId);
        const nowInOrg = DateTime.fromJSDate(now, { zone: orgTimezone });
        const currentYear = nowInOrg.year;
        const currentMonthIndex = nowInOrg.month - 1;

        if (targetYear > currentYear || (targetYear === currentYear && targetMonthIndex > currentMonthIndex)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot generate payrolls for future months. Only current and past months are allowed.'
            });
        }

        if (
            mode === 'final' &&
            !forceFinalBeforePeriodEnd &&
            !isFinalGenerationAllowedForPeriod(now, targetYear, targetMonthIndex, orgTimezone)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Final payroll can only be generated on or after the last day of the selected month. Use preview for mid-month estimates, or send forceFinalBeforePeriodEnd: true only if you intentionally need an early close.'
            });
        }

        const { monthStart, monthEnd: endOfMonth } = getPayrollMonthUtcBounds(
            targetYear,
            targetMonthIndex,
            orgTimezone
        );

        const employees = await Employee.find({
            salary: { $exists: true, $gt: 0 },
            organizationId: organizationId,
            $or: [
                { active: true },
                {
                    status: 'terminated',
                    $or: [
                        { lastWorkingDate: { $gte: monthStart, $lte: endOfMonth } },
                        { terminationDate: { $gte: monthStart, $lte: endOfMonth } }
                    ]
                }
            ]
        }).select('salary salaryRevisions organizationId joiningDate department position roleLevel salaryStructure status terminationDate lastWorkingDate financialDetails');

        let created = 0;
        let updated = 0;
        let skipped = 0;
        const asOf = now;

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
                computedAsOf: endOfMonth,
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

// Preview disbursement plan for a given month/year (no payment side-effects)
export const previewDisbursement = async (req, res) => {
    try {
        const isCEO = req.employee && (
            (req.employee.position || '').toLowerCase().trim() === 'ceo' ||
            (req.employee.position || '').toLowerCase().trim().includes('chief executive')
        );
        if (!isCEO) {
            return res.status(403).json({
                success: false,
                message: 'Access restricted to CEO only. Only the CEO can preview disbursement.'
            });
        }

        const { month, year } = req.query;
        if (!month || !year) {
            return res.status(400).json({ success: false, message: 'month and year are required' });
        }

        const { addOrganizationFilter } = await import('../../helpers/organizationHelper.js');
        const query = addOrganizationFilter(req, {
            month,
            year: parseInt(year, 10),
            status: 'Processed',
            payrollLocked: false,
            isProvisional: { $ne: true },
            $or: [
                { type: { $ne: 'monthly' } },
                { type: 'monthly', isSuperseded: { $ne: true } }
            ]
        });

        const payrolls = await Payroll.find(query)
            .populate('employeeId', 'financialDetails name lastName email');

        if (!payrolls.length) {
            return res.json({ success: true, totalEmployees: 0, totalAmount: 0, plans: [] });
        }

        const byEmployee = new Map();
        for (const pr of payrolls) {
            const key = String(pr.employeeId?._id || pr.employeeId || '');
            if (!byEmployee.has(key)) byEmployee.set(key, []);
            byEmployee.get(key).push(pr);
        }

        const plans = [];
        for (const [, group] of byEmployee) {
            const plan = buildDisbursementPlanForGroup(group);
            if (!plan) continue;

            const employee = plan.employee;
            plans.push({
                employee: employee?._id,
                employeeName: `${employee?.name || ''} ${employee?.lastName || ''}`.trim(),
                employeeEmail: employee?.email || '',
                amount: plan.amount,
                strategy: plan.fullOverride ? 'override_with_post_adjustments' : 'base_plus_adjustments',
                recordCount: plan.payableRecords.length,
                records: plan.payableRecords.map((p) => ({
                    payrollId: p._id,
                    type: p.type,
                    adjustmentMode: p.adjustmentMode,
                    subType: p.subType,
                    status: p.status,
                    earningsTotal: Number(p?.earnings?.totalEarnings) || 0,
                    deductionsTotal: Number(p?.deductions?.total) || 0,
                    net: (Number(p?.earnings?.totalEarnings) || 0) - (Number(p?.deductions?.total) || 0)
                }))
            });
        }

        const totalAmount = plans.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        return res.json({
            success: true,
            month,
            year: parseInt(year, 10),
            totalEmployees: plans.length,
            totalAmount,
            plans
        });
    } catch (error) {
        logger.error('Preview Disbursement Error', { error: error.message, stack: error.stack });
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
            isProvisional: { $ne: true },
            $or: [
                { type: { $ne: 'monthly' } },
                { type: 'monthly', isSuperseded: { $ne: true } }
            ]
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
            const plan = buildDisbursementPlanForGroup(group);
            if (!plan) {
                continue;
            }
            const { payableRecords, amount, employee } = plan;
            const fin = employee?.financialDetails || {};

            if (amount <= 0) {
                for (const pr of payableRecords) {
                    pr.payment = {
                        provider: 'mock-bank',
                        status: 'Failed',
                        processedAt: new Date(),
                        error: 'Invalid payout amount'
                    };
                    pr.paidAmount = 0;
                    pr.lastModifiedBy = adminId;
                    await pr.save();
                }
                failed += 1;
                results.push({
                    payrollId: payableRecords.map((p) => p._id),
                    employee: employee?._id,
                    employeeName: `${employee?.name || ''} ${employee?.lastName || ''}`.trim(),
                    employeeEmail: employee?.email,
                    amount,
                    status: 'Failed',
                    error: 'Invalid payout amount'
                });
                continue;
            }

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
                const paymentBatchId = `PB-${month}-${year}-${Date.now()}-${String(employee?._id || '')}`;
                for (const pr of payableRecords) {
                    const prEarnings = Number(pr?.earnings?.totalEarnings) || 0;
                    const prDeductions = Number(pr?.deductions?.total) || 0;
                    pr.status = 'Paid';
                    pr.paidAmount = prEarnings - prDeductions;
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
                    pr.paymentBatchId = paymentBatchId;
                    await pr.save();
                }
                paid += 1;
                results.push({
                    payrollId: payableRecords.map((p) => p._id),
                    employee: employee?._id,
                    employeeName: `${employee?.name || ''} ${employee?.lastName || ''}`.trim(),
                    employeeEmail: employee?.email,
                    amount,
                    status: 'Success',
                    reference: transfer.reference
                });
            } else {
                for (const pr of payableRecords) {
                    pr.payment = {
                        provider: 'mock-bank',
                        status: 'Failed',
                        processedAt: new Date(),
                        error: transfer.error
                    };
                    pr.paidAmount = 0;
                    pr.lastModifiedBy = adminId;
                    await pr.save();
                }
                failed += 1;
                results.push({
                    payrollId: payableRecords.map((p) => p._id),
                    employee: employee?._id,
                    employeeName: `${employee?.name || ''} ${employee?.lastName || ''}`.trim(),
                    employeeEmail: employee?.email,
                    amount,
                    status: 'Failed',
                    error: transfer.error
                });
            }
        }

        return res.json({ success: true, total: payrolls.length, paid, failed, results });
    } catch (error) {
        logger.error('Disburse Payrolls Error', { error: error.message, stack: error.stack });
        return res.status(500).json({ success: false, message: error.message });
    }
};