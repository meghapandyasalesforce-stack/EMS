import LeavePolicy from '../../models/leavePolicy.model.js';
import LeaveBalance from '../../models/leaveBalance.model.js';
import Employee from '../../models/employee.model.js';
import leaveBalanceEngine from '../../services/leaveBalanceEngine.js';
import logger from '../../helpers/logger.js';
import { addOrganizationFilter } from '../../helpers/organizationHelper.js';
import { parsePagination, parseSort, sendPaginatedResponse } from '../../helpers/paginationHelper.js';
import { buildEmployeeLeaveBalanceResponse } from '../../helpers/leaveBalanceResponseHelper.js';
import {
    normalizePolicyLeaveTypes,
    validateLeavePolicyAccrual,
} from '../../helpers/leavePolicyAccrualHelper.js';
import { resolveEmployeeLeaveBalanceAccess } from '../../helpers/leaveBalanceAccessHelper.js';
import { writeLeaveBalanceAuditEntry, buildEmployeeLeaveHistory } from '../../helpers/leaveBalanceHistoryHelper.js';
import { getEmployeeLeaveYearBounds, isLeaveYearAllowed } from '../../helpers/leaveYearBoundsHelper.js';
import { roundLeaveDays } from '../../helpers/leaveBalanceRulesHelper.js';
import {
    isOpeningRelocate,
    resolveManualCorrectionSaveKind,
} from '../../helpers/openingLeaveBalanceHelper.js';

async function recalculateOrgLeaveBalances(organizationId) {
    if (!organizationId) return;
    try {
        await leaveBalanceEngine.recalculateBalances(organizationId, new Date().getFullYear());
    } catch (error) {
        logger.warn('Leave balance recalculation after policy change failed', {
            organizationId,
            error: error.message
        });
    }
}

/**
 * Create a new leave policy
 */
export const createLeavePolicy = async (req, res) => {
    try {
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
        
        if (!organizationId) {
            return res.status(400).json({
                success: false,
                message: 'Organization ID is required'
            });
        }

        const policyData = {
            ...req.body,
            organizationId,
            createdBy: req.user?._id || req.employee?._id
        };

        if (policyData.leaveTypes) {
            policyData.leaveTypes = normalizePolicyLeaveTypes(policyData.leaveTypes);
        }

        const validationErrors = validateLeavePolicyAccrual(policyData);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: validationErrors[0],
                errors: validationErrors,
            });
        }

        const policy = new LeavePolicy(policyData);
        await policy.save();

        if (policyData.leaveTypes?.length) {
            await recalculateOrgLeaveBalances(organizationId);
        }

        res.status(201).json({
            success: true,
            message: 'Leave policy created successfully',
            policy
        });
    } catch (error) {
        logger.error('Create Leave Policy Error', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: 'Error creating leave policy',
            error: error.message
        });
    }
};

/**
 * Get all leave policies
 */
export const getAllLeavePolicies = async (req, res) => {
    try {
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
        const { isActive } = req.query;

        const query = addOrganizationFilter(req, {});
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        const policies = await LeavePolicy.find(query)
            .populate('applicableRoles', 'name')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            policies
        });
    } catch (error) {
        logger.error('Get All Leave Policies Error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error fetching leave policies',
            error: error.message
        });
    }
};

/**
 * Get leave policy by ID
 */
export const getLeavePolicyById = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;

        const policy = await LeavePolicy.findOne({
            _id: id,
            organizationId
        })
            .populate('applicableRoles', 'name')
            .populate('applicableEmployees', 'name email employeeId')
            .populate('createdBy', 'name email');

        if (!policy) {
            return res.status(404).json({
                success: false,
                message: 'Leave policy not found'
            });
        }

        res.json({
            success: true,
            policy
        });
    } catch (error) {
        logger.error('Get Leave Policy Error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error fetching leave policy',
            error: error.message
        });
    }
};

/**
 * Update leave policy
 */
export const updateLeavePolicy = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;

        const policy = await LeavePolicy.findOne({
            _id: id,
            organizationId
        });

        if (!policy) {
            return res.status(404).json({
                success: false,
                message: 'Leave policy not found'
            });
        }

        const updateBody = { ...req.body };
        if (updateBody.leaveTypes) {
            updateBody.leaveTypes = normalizePolicyLeaveTypes(updateBody.leaveTypes);
        }

        const mergedForValidation = {
            ...policy.toObject(),
            ...updateBody,
            leaveTypes: updateBody.leaveTypes ?? policy.leaveTypes,
            leaveCycle: updateBody.leaveCycle ?? policy.leaveCycle,
        };
        const validationErrors = validateLeavePolicyAccrual(mergedForValidation);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: validationErrors[0],
                errors: validationErrors,
            });
        }

        Object.assign(policy, updateBody);
        policy.lastModifiedBy = req.user?._id || req.employee?._id;
        await policy.save();

        if (updateBody.leaveTypes?.length) {
            await recalculateOrgLeaveBalances(organizationId);
        }

        res.json({
            success: true,
            message: 'Leave policy updated successfully',
            policy
        });
    } catch (error) {
        logger.error('Update Leave Policy Error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error updating leave policy',
            error: error.message
        });
    }
};

/**
 * Delete leave policy
 */
export const deleteLeavePolicy = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;

        const policy = await LeavePolicy.findOne({
            _id: id,
            organizationId
        });

        if (!policy) {
            return res.status(404).json({
                success: false,
                message: 'Leave policy not found'
            });
        }

        // Check if policy is in use
        const balancesInUse = await LeaveBalance.countDocuments({ policy: id });
        if (balancesInUse > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete policy that is in use. Deactivate it instead.'
            });
        }

        await policy.deleteOne();

        res.json({
            success: true,
            message: 'Leave policy deleted successfully'
        });
    } catch (error) {
        logger.error('Delete Leave Policy Error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error deleting leave policy',
            error: error.message
        });
    }
};

/**
 * Get employee leave balance
 */
export const getEmployeeLeaveBalance = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { year, month } = req.query;
        const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
        const targetMonth = month ? parseInt(month, 10) : new Date().getMonth() + 1;
        const targetEmployeeId = employeeId || req.employee?._id || req.user?._id;

        const access = await resolveEmployeeLeaveBalanceAccess(req, targetEmployeeId, { forAdjust: false });
        if (!access.ok) {
            return res.status(access.status || 403).json({
                success: false,
                message: access.message,
            });
        }

        const organizationId = access.organizationId;

        const balanceObj = await buildEmployeeLeaveBalanceResponse(
            targetEmployeeId,
            targetYear,
            organizationId,
            { month: targetMonth }
        );

        if (!balanceObj) {
            const employee = await Employee.findById(targetEmployeeId).select('joiningDate').lean();
            const bounds = getEmployeeLeaveYearBounds(employee);
            if (!isLeaveYearAllowed(targetYear, bounds)) {
                return res.status(404).json({
                    success: false,
                    message: `Select a year between ${bounds.minYear} and ${bounds.maxYear}.`,
                    employeeContext: {
                        joiningYear: bounds.joiningYear,
                        joiningMonth: bounds.joiningMonth,
                        minYear: bounds.minYear,
                        maxYear: bounds.maxYear,
                    },
                });
            }
            return res.status(404).json({
                success: false,
                message: 'Leave balance not found. No applicable policy for this employee.'
            });
        }

        res.json({
            success: true,
            balance: balanceObj,
            canAdjust: access.canAdjust,
        });
    } catch (error) {
        logger.error('Get Employee Leave Balance Error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error fetching leave balance',
            error: error.message
        });
    }
};

/**
 * Manually adjust leave balance for an employee (admin / HR / direct manager).
 */
export const adjustEmployeeLeaveBalance = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { year, leaveType, accrued, used, carriedForward, reason, remarks, month } = req.body;

        const access = await resolveEmployeeLeaveBalanceAccess(req, employeeId, { forAdjust: true });
        if (!access.ok) {
            return res.status(access.status || 403).json({
                success: false,
                message: access.message,
            });
        }

        const organizationId = access.organizationId;

        if (!leaveType || typeof leaveType !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'leaveType is required (use "employee" for the shared leave wallet)',
            });
        }

        const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
        if (Number.isNaN(targetYear)) {
            return res.status(400).json({ success: false, message: 'Invalid year' });
        }

        const targetMonth = (() => {
            const m = Number(month);
            if (Number.isInteger(m) && m >= 1 && m <= 12) return m;
            return new Date().getMonth() + 1;
        })();

        const now = new Date();
        const isCurrentPeriod =
            targetYear === now.getFullYear() && targetMonth === now.getMonth() + 1;
        let adjustAsOfDate = isCurrentPeriod
            ? now
            : leaveBalanceEngine.endOfMonthDate(targetYear, targetMonth - 1);
        if (adjustAsOfDate > now) {
            adjustAsOfDate = now;
        }

        const normalizedType = leaveType.toLowerCase().trim();
        const numericFields = { accrued, used, carriedForward };
        const hasAnyField = Object.values(numericFields).some((v) => v !== undefined && v !== null && v !== '');
        if (!hasAnyField) {
            return res.status(400).json({
                success: false,
                message: 'Provide at least one of accrued, used, or carriedForward to update',
            });
        }

        let balance = await leaveBalanceEngine.calculateBalance(employeeId, targetYear, organizationId, {
            asOfDate: adjustAsOfDate,
        });
        if (!balance) {
            return res.status(404).json({
                success: false,
                message: 'Leave balance not found. Assign a leave policy to this employee first.',
            });
        }

        await balance.populate('policy', 'leaveTypes');
        const pooledTypes = leaveBalanceEngine
            .getPooledLeaveTypeConfigs(balance.policy || {})
            .map((lt) => lt.type);
        // Only the explicit employee wallet key uses the shared-wallet path.
        // Specific leave types always adjust independently (even if also in the pool).
        const isEmployeeWalletAdjust = normalizedType === 'employee';

        if (!isEmployeeWalletAdjust) {
            let typeBalance = balance.balances.find((b) => b.leaveType === normalizedType);
            if (!typeBalance) {
                const policyHasType = (balance.policy?.leaveTypes || []).some(
                    (lt) => lt?.type === normalizedType && lt.enabled !== false
                );
                if (!policyHasType) {
                    return res.status(404).json({
                        success: false,
                        message: `Leave type "${normalizedType}" not found in this employee's balance`,
                    });
                }
                typeBalance = {
                    leaveType: normalizedType,
                    accrued: 0,
                    used: 0,
                    available: 0,
                    carriedForward: 0,
                    expired: 0,
                    pending: 0,
                };
                balance.balances.push(typeBalance);
            }
        }

        try {
            const parseNonNegative = (val, label) => {
                if (val === undefined || val === null || val === '') return undefined;
                const num = Number(val);
                if (Number.isNaN(num) || num < 0) {
                    throw new Error(`${label} must be a non-negative number`);
                }
                return num;
            };

            const nextAccrued = parseNonNegative(accrued, 'accrued');
            const nextUsed = parseNonNegative(used, 'used');
            const nextCarried = parseNonNegative(carriedForward, 'carriedForward');

            if (isEmployeeWalletAdjust) {
                const employeeRecord = await Employee.findById(employeeId)
                    .select('joiningDate name lastName')
                    .lean();

                const balanceObj = await buildEmployeeLeaveBalanceResponse(
                    employeeId,
                    targetYear,
                    organizationId,
                    { month: targetMonth }
                );
                const summary = balanceObj?.leaveSummary || {};
                const prevSnapshot = {
                    accrued: summary.totalAccrued ?? 0,
                    used: summary.totalUsed ?? 0,
                    carriedForward: summary.totalCarriedForward ?? 0,
                    available: summary.totalAvailableLeave ?? 0,
                };

                // Balance Adjustment overwrites the wallet — do not stack on prior available/CF.
                // Available Leave = max(0, Earned So Far − Used). CF mirrors that remaining amount.
                const merged = {
                    accrued: nextAccrued ?? 0,
                    used: nextUsed ?? 0,
                    carriedForward: 0,
                };
                if (nextAccrued === undefined && nextUsed === undefined && nextCarried === undefined) {
                    const currentOverride = balance.employeeLeaveSummary?.manualOverride || {};
                    merged.accrued =
                        (currentOverride.active ? currentOverride.accrued : prevSnapshot.accrued) ??
                        prevSnapshot.accrued;
                    merged.used =
                        (currentOverride.active ? currentOverride.used : prevSnapshot.used) ??
                        prevSnapshot.used;
                }
                const nextAvailable = Math.max(
                    0,
                    roundLeaveDays(merged.accrued - merged.used)
                );
                merged.carriedForward =
                    nextCarried !== undefined && nextCarried !== null && nextCarried !== ''
                        ? Math.max(0, roundLeaveDays(nextCarried))
                        : nextAvailable;

                const anchorMonth = targetMonth;

                balance.employeeLeaveSummary = balance.employeeLeaveSummary || {};

                const persistedOpening = await leaveBalanceEngine.resolvePersistedOpeningLeaveBalance(
                    employeeId,
                    organizationId
                );
                const hasLegacyManualOverride = Boolean(
                    await LeaveBalance.exists({
                        organizationId,
                        employee: employeeId,
                        'employeeLeaveSummary.manualOverride.active': true,
                    })
                );
                const saveKind = resolveManualCorrectionSaveKind(
                    persistedOpening,
                    hasLegacyManualOverride,
                    targetYear,
                    anchorMonth,
                    employeeRecord?.joiningDate ?? null
                );

                let finalAvailable = nextAvailable;
                const hasExplicitNumericInput = [accrued, used, carriedForward].some(
                    (v) => v !== undefined && v !== null && v !== ''
                );
                if (
                    saveKind === 'opening' &&
                    finalAvailable === 0 &&
                    prevSnapshot.available > 0 &&
                    !hasExplicitNumericInput
                ) {
                    finalAvailable = roundLeaveDays(prevSnapshot.available);
                    merged.carriedForward = Math.max(
                        0,
                        roundLeaveDays(finalAvailable - (merged.accrued || 0) + (merged.used || 0))
                    );
                }

                const manualOverridePayload = {
                    accrued: merged.accrued,
                    used: merged.used,
                    carriedForward: merged.carriedForward,
                    available: finalAvailable,
                    anchorYear: targetYear,
                    anchorMonth,
                    reason: reason ? String(reason).trim().slice(0, 500) : '',
                    adjustedBy: req.employee?._id || req.user?._id,
                    adjustedAt: new Date(),
                };

                if (saveKind === 'opening') {
                    const openingPayload = {
                        active: true,
                        balance: finalAvailable,
                        openingYear: targetYear,
                        openingMonth: anchorMonth,
                        reason: manualOverridePayload.reason,
                        setBy: manualOverridePayload.adjustedBy,
                        setAt: manualOverridePayload.adjustedAt,
                    };
                    const relocate = isOpeningRelocate(
                        persistedOpening,
                        saveKind,
                        targetYear,
                        anchorMonth
                    );
                    const persistDocId =
                        relocate || !persistedOpening
                            ? balance._id
                            : (persistedOpening.documentId ?? balance._id);

                    if (String(persistDocId) === String(balance._id)) {
                        balance.employeeLeaveSummary.openingLeaveBalance = openingPayload;
                    } else {
                        const openingDoc = await LeaveBalance.findById(persistDocId);
                        if (openingDoc) {
                            openingDoc.employeeLeaveSummary = openingDoc.employeeLeaveSummary || {};
                            openingDoc.employeeLeaveSummary.openingLeaveBalance = openingPayload;
                            openingDoc.markModified('employeeLeaveSummary');
                            await openingDoc.save();
                        }
                    }

                    await LeaveBalance.updateMany(
                        {
                            organizationId,
                            employee: employeeId,
                            _id: { $ne: persistDocId },
                            'employeeLeaveSummary.openingLeaveBalance.active': true,
                        },
                        { $set: { 'employeeLeaveSummary.openingLeaveBalance.active': false } }
                    );

                    balance.employeeLeaveSummary.manualOverride = {
                        ...manualOverridePayload,
                        active: false,
                    };

                    logger.info('[OpeningLeaveBalance] saved', {
                        employeeId: String(employeeId),
                        organizationId: String(organizationId),
                        openingYear: targetYear,
                        openingMonth: anchorMonth,
                        balance: finalAvailable,
                        relocate,
                    });
                } else {
                    balance.employeeLeaveSummary.manualOverride = {
                        ...manualOverridePayload,
                        active: true,
                    };

                    if (saveKind === 'anchor') {
                        await LeaveBalance.updateMany(
                            {
                                organizationId,
                                employee: employeeId,
                                year: { $ne: targetYear },
                            },
                            { $set: { 'employeeLeaveSummary.manualOverride.active': false } }
                        );
                    }

                    logger.info('Manual leave balance saved', {
                        employeeId: String(employeeId),
                        saveKind,
                        anchorYear: targetYear,
                        anchorMonth,
                        balance: finalAvailable,
                    });
                }

                for (const typeBalance of balance.balances) {
                    if (!pooledTypes.includes(typeBalance.leaveType)) continue;
                    typeBalance.manualOverride = { active: false };
                    typeBalance.accrued = 0;
                    typeBalance.carriedForward = 0;
                }

                balance.accrualHistory = balance.accrualHistory || [];
                balance.accrualHistory.push({
                    date: new Date(),
                    leaveType: 'employee',
                    amount: finalAvailable,
                    method: 'manual',
                    notes: `[${access.role}] ${reason || 'Manual employee leave balance adjustment'}`,
                });

                balance.markModified('balances');
                balance.markModified('employeeLeaveSummary');
                await balance.save();

                logger.info('Manual leave balance override saved', {
                    employeeId,
                    organizationId: String(organizationId),
                    balanceDocumentId: String(balance._id),
                    balanceYear: balance.year,
                    manualOverride: balance.employeeLeaveSummary?.manualOverride,
                    openingLeaveBalance: balance.employeeLeaveSummary?.openingLeaveBalance,
                });

                const employeeName = employeeRecord
                    ? [employeeRecord.name, employeeRecord.lastName].filter(Boolean).join(' ')
                    : undefined;

                await writeLeaveBalanceAuditEntry({
                    organizationId,
                    employeeId,
                    employeeName,
                    action: 'manual_adjust',
                    leaveType: 'employee',
                    previousBalance: prevSnapshot,
                    newBalance: {
                        accrued: merged.accrued,
                        used: merged.used,
                        carriedForward: merged.carriedForward,
                        available: finalAvailable,
                    },
                    performedBy: req.employee?._id || req.user?._id,
                    notes: reason
                        ? String(reason).trim().slice(0, 500)
                        : 'Manual employee leave balance adjustment',
                    remarks: remarks ? String(remarks).trim().slice(0, 500) : undefined,
                    toYear: targetYear,
                    toMonth: anchorMonth,
                });
            } else {
                const typeBalance = balance.balances.find((b) => b.leaveType === normalizedType);
                const prevSnapshot = {
                    accrued: typeBalance.accrued,
                    used: typeBalance.used,
                    carriedForward: typeBalance.carriedForward,
                    available: typeBalance.available,
                };

                // Overwrite this leave type only — Available = max(0, Earned − Used).
                // Carry forward is stored as the auto value for display; it is not added again.
                if (nextAccrued !== undefined) typeBalance.accrued = nextAccrued;
                if (nextUsed !== undefined) typeBalance.used = nextUsed;
                typeBalance.available = Math.max(
                    0,
                    roundLeaveDays((typeBalance.accrued || 0) - (typeBalance.used || 0))
                );
                typeBalance.carriedForward =
                    nextCarried !== undefined
                        ? Math.max(0, roundLeaveDays(nextCarried))
                        : typeBalance.available;

                typeBalance.manualOverride = {
                    active: true,
                    accrued: typeBalance.accrued,
                    used: typeBalance.used,
                    carriedForward: typeBalance.carriedForward,
                    reason: reason ? String(reason).trim().slice(0, 500) : '',
                    adjustedBy: req.employee?._id || req.user?._id,
                    adjustedAt: new Date(),
                };

                balance.accrualHistory = balance.accrualHistory || [];
                balance.accrualHistory.push({
                    date: new Date(),
                    leaveType: normalizedType,
                    amount: typeBalance.available,
                    method: 'manual',
                    notes: `[${access.role}] ${reason || 'Manual balance adjustment'}`,
                });

                balance.markModified('balances');
                await balance.save();

                const employeeDoc = await Employee.findById(employeeId).select('name lastName').lean();
                const employeeName = employeeDoc
                    ? [employeeDoc.name, employeeDoc.lastName].filter(Boolean).join(' ')
                    : undefined;

                await writeLeaveBalanceAuditEntry({
                    organizationId,
                    employeeId,
                    employeeName,
                    action: 'manual_adjust',
                    leaveType: normalizedType,
                    previousBalance: prevSnapshot,
                    newBalance: {
                        accrued: typeBalance.accrued,
                        used: typeBalance.used,
                        carriedForward: typeBalance.carriedForward,
                        available: typeBalance.available,
                    },
                    performedBy: req.employee?._id || req.user?._id,
                    notes: reason ? String(reason).trim().slice(0, 500) : 'Manual balance adjustment',
                    remarks: remarks ? String(remarks).trim().slice(0, 500) : undefined,
                    toYear: targetYear,
                    toMonth: targetMonth,
                });
            }
        } catch (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError.message,
            });
        }

        const balanceObj = await buildEmployeeLeaveBalanceResponse(
            employeeId,
            targetYear,
            organizationId,
            { month: targetMonth }
        );

        logger.info('Leave balance manually adjusted', {
            employeeId,
            leaveType: normalizedType,
            year: targetYear,
            adjustedBy: req.employee?._id || req.user?._id,
            role: access.role,
        });

        res.json({
            success: true,
            message: 'Leave balance updated successfully',
            balance: balanceObj,
            canAdjust: true,
        });
    } catch (error) {
        logger.error('Adjust Employee Leave Balance Error', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: 'Error adjusting leave balance',
            error: error.message,
        });
    }
};

/**
 * GET leave policy metadata (leave types, reasons) — additive, backward compatible.
 */
export const getLeavePolicyMeta = async (req, res) => {
    try {
        const { LEAVE_TYPE_OPTIONS, LEAVE_REASON_OPTIONS, DEFAULT_LEAVE_CYCLE } = await import(
            '../../constants/leaveConstants.js'
        );
        const { getLegacyDefaultAnnualEntitlement, getLegacyDefaultMonthlyAccrual } = await import(
            '../../constants/leaveDefaults.js'
        );
        // Template values for new policy forms only — not used in balance calculations when a policy exists
        res.json({
            success: true,
            leaveTypes: LEAVE_TYPE_OPTIONS,
            leaveReasons: LEAVE_REASON_OPTIONS,
            defaults: {
                annualEntitlement: getLegacyDefaultAnnualEntitlement(),
                monthlyAllocation: getLegacyDefaultMonthlyAccrual(),
                leaveCycle: DEFAULT_LEAVE_CYCLE,
            },
        });
    } catch (error) {
        logger.error('Get leave policy meta error', { error: error.message });
        res.status(500).json({ success: false, message: 'Error fetching leave metadata' });
    }
};

/**
 * GET unified leave balance history for an employee.
 */
export const getEmployeeLeaveHistory = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
        const { year, leaveType, limit } = req.query;

        const access = await resolveEmployeeLeaveBalanceAccess(req, employeeId, { forAdjust: false });
        if (!access.ok) {
            return res.status(access.status || 403).json({ success: false, message: access.message });
        }

        const history = await buildEmployeeLeaveHistory(employeeId, organizationId, {
            year: year ? parseInt(year, 10) : undefined,
            leaveType,
            limit: limit ? parseInt(limit, 10) : 100,
        });

        res.json({ success: true, ...history });
    } catch (error) {
        logger.error('Get employee leave history error', { error: error.message });
        res.status(500).json({ success: false, message: 'Error fetching leave history' });
    }
};

/**
 * Add manual carry forward for an employee
 */
export const addManualCarryForward = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { carriedForward, anchorMonth, anchorYear, reason } = req.body;

        const access = await resolveEmployeeLeaveBalanceAccess(req, employeeId, { forAdjust: true });
        if (!access.ok) {
            return res.status(access.status || 403).json({
                success: false,
                message: access.message,
            });
        }

        const organizationId = access.organizationId;

        if (carriedForward === undefined || carriedForward === null || carriedForward === '') {
            return res.status(400).json({
                success: false,
                message: 'carriedForward is required',
            });
        }

        const numericCarriedForward = Number(carriedForward);
        if (Number.isNaN(numericCarriedForward) || numericCarriedForward < 0) {
            return res.status(400).json({
                success: false,
                message: 'carriedForward must be a non-negative number',
            });
        }

        const targetYear = anchorYear ? parseInt(anchorYear, 10) : new Date().getFullYear();
        const targetMonth = anchorMonth ? parseInt(anchorMonth, 10) : new Date().getMonth() + 1;

        if (Number.isNaN(targetYear) || targetYear < 2016 || targetYear > 2100) {
            return res.status(400).json({ success: false, message: 'Invalid year' });
        }

        if (Number.isNaN(targetMonth) || targetMonth < 1 || targetMonth > 12) {
            return res.status(400).json({ success: false, message: 'Invalid month' });
        }

        if (!reason || typeof reason !== 'string' || !reason.trim()) {
            return res.status(400).json({
                success: false,
                message: 'reason is required',
            });
        }

        let balance = await leaveBalanceEngine.calculateBalance(employeeId, targetYear, organizationId, {
            asOfDate: new Date(),
        });
        if (!balance) {
            return res.status(404).json({
                success: false,
                message: 'Leave balance not found. Assign a leave policy to this employee first.',
            });
        }

        await balance.populate('policy', 'leaveTypes');
        const pooledTypes = leaveBalanceEngine
            .getPooledLeaveTypeConfigs(balance.policy || {})
            .map((lt) => lt.type);

        const employeeRecord = await Employee.findById(employeeId)
            .select('joiningDate name lastName')
            .lean();

        const balanceObj = await buildEmployeeLeaveBalanceResponse(
            employeeId,
            targetYear,
            organizationId,
            { month: targetMonth }
        );
        const summary = balanceObj?.leaveSummary || {};
        const prevCarriedForward = summary.totalCarriedForward ?? 0;
        const prevAvailable = summary.totalAvailableLeave ?? 0;

        // Add manual carry forward as a one-time credit in accrual history
        // This will be incorporated into the rolling balance calculation
        balance.accrualHistory = balance.accrualHistory || [];
        balance.accrualHistory.push({
            date: new Date(targetYear, targetMonth - 1, 1),
            leaveType: 'employee',
            amount: numericCarriedForward,
            method: 'manual_carry_forward',
            notes: `[${access.role}] Manual carry forward: ${numericCarriedForward} days effective from ${targetMonth}/${targetYear}. Reason: ${reason.trim()}`,
        });

        // Store manual carry forward metadata for tracking
        balance.employeeLeaveSummary = balance.employeeLeaveSummary || {};
        if (!balance.employeeLeaveSummary.manualCarryForwards) {
            balance.employeeLeaveSummary.manualCarryForwards = [];
        }
        balance.employeeLeaveSummary.manualCarryForwards.push({
            amount: numericCarriedForward,
            effectiveYear: targetYear,
            effectiveMonth: targetMonth,
            reason: reason.trim().slice(0, 500),
            addedBy: req.employee?._id || req.user?._id,
            addedAt: new Date(),
        });

        balance.markModified('employeeLeaveSummary');
        await balance.save();

        const employeeName = employeeRecord
            ? [employeeRecord.name, employeeRecord.lastName].filter(Boolean).join(' ')
            : undefined;

        await writeLeaveBalanceAuditEntry({
            organizationId,
            employeeId,
            employeeName,
            action: 'manual_carry_forward',
            leaveType: 'employee',
            previousBalance: {
                carriedForward: prevCarriedForward,
                available: prevAvailable,
            },
            newBalance: {
                carriedForward: prevCarriedForward + numericCarriedForward,
                available: prevAvailable + numericCarriedForward,
            },
            performedBy: req.employee?._id || req.user?._id,
            notes: reason.trim().slice(0, 500),
            toYear: targetYear,
            toMonth: targetMonth,
        });

        logger.info('Manual carry forward added', {
            employeeId,
            organizationId: String(organizationId),
            carriedForward: numericCarriedForward,
            anchorYear: targetYear,
            anchorMonth: targetMonth,
            adjustedBy: req.employee?._id || req.user?._id,
            role: access.role,
        });

        const updatedBalanceObj = await buildEmployeeLeaveBalanceResponse(
            employeeId,
            targetYear,
            organizationId,
            { month: targetMonth }
        );

        res.json({
            success: true,
            message: 'Manual carry forward added successfully',
            balance: updatedBalanceObj,
            canAdjust: true,
        });
    } catch (error) {
        logger.error('Add Manual Carry Forward Error', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: 'Error adding manual carry forward',
            error: error.message,
        });
    }
};

/**
 * Reduce leave via a separate manual carry-forward reduction (does not change add flow).
 */
export const reduceManualCarryForward = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { amount, anchorMonth, anchorYear, reason } = req.body;

        const access = await resolveEmployeeLeaveBalanceAccess(req, employeeId, { forAdjust: true });
        if (!access.ok) {
            return res.status(access.status || 403).json({
                success: false,
                message: access.message,
            });
        }

        const organizationId = access.organizationId;

        if (amount === undefined || amount === null || amount === '') {
            return res.status(400).json({
                success: false,
                message: 'amount is required',
            });
        }

        const numericAmount = Number(amount);
        if (Number.isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'amount must be a positive number',
            });
        }

        const targetYear = anchorYear ? parseInt(anchorYear, 10) : new Date().getFullYear();
        const targetMonth = anchorMonth ? parseInt(anchorMonth, 10) : new Date().getMonth() + 1;

        if (Number.isNaN(targetYear) || targetYear < 2016 || targetYear > 2100) {
            return res.status(400).json({ success: false, message: 'Invalid year' });
        }

        if (Number.isNaN(targetMonth) || targetMonth < 1 || targetMonth > 12) {
            return res.status(400).json({ success: false, message: 'Invalid month' });
        }

        if (!reason || typeof reason !== 'string' || !reason.trim()) {
            return res.status(400).json({
                success: false,
                message: 'reason is required',
            });
        }

        let balance = await leaveBalanceEngine.calculateBalance(employeeId, targetYear, organizationId, {
            asOfDate: new Date(),
        });
        if (!balance) {
            return res.status(404).json({
                success: false,
                message: 'Leave balance not found. Assign a leave policy to this employee first.',
            });
        }

        const employeeRecord = await Employee.findById(employeeId)
            .select('joiningDate name lastName')
            .lean();

        const balanceObj = await buildEmployeeLeaveBalanceResponse(
            employeeId,
            targetYear,
            organizationId,
            { month: targetMonth }
        );
        const summary = balanceObj?.leaveSummary || {};
        const prevCarriedForward = summary.totalCarriedForward ?? 0;
        const prevAvailable = summary.totalAvailableLeave ?? 0;

        balance.accrualHistory = balance.accrualHistory || [];
        balance.accrualHistory.push({
            date: new Date(targetYear, targetMonth - 1, 1),
            leaveType: 'employee',
            amount: -numericAmount,
            method: 'manual_carry_forward_reduce',
            notes: `[${access.role}] Manual carry forward reduce: ${numericAmount} days effective from ${targetMonth}/${targetYear}. Reason: ${reason.trim()}`,
        });

        balance.employeeLeaveSummary = balance.employeeLeaveSummary || {};
        if (!balance.employeeLeaveSummary.manualCarryForwardReductions) {
            balance.employeeLeaveSummary.manualCarryForwardReductions = [];
        }
        balance.employeeLeaveSummary.manualCarryForwardReductions.push({
            amount: numericAmount,
            effectiveYear: targetYear,
            effectiveMonth: targetMonth,
            reason: reason.trim().slice(0, 500),
            addedBy: req.employee?._id || req.user?._id,
            addedAt: new Date(),
        });

        balance.markModified('employeeLeaveSummary');
        await balance.save();

        const employeeName = employeeRecord
            ? [employeeRecord.name, employeeRecord.lastName].filter(Boolean).join(' ')
            : undefined;

        const nextAvailable = Math.max(0, roundLeaveDays(prevAvailable - numericAmount));
        const nextCarriedForward = Math.max(0, roundLeaveDays(prevCarriedForward - numericAmount));

        await writeLeaveBalanceAuditEntry({
            organizationId,
            employeeId,
            employeeName,
            action: 'manual_carry_forward_reduce',
            leaveType: 'employee',
            previousBalance: {
                carriedForward: prevCarriedForward,
                available: prevAvailable,
            },
            newBalance: {
                carriedForward: nextCarriedForward,
                available: nextAvailable,
            },
            performedBy: req.employee?._id || req.user?._id,
            notes: reason.trim().slice(0, 500),
            toYear: targetYear,
            toMonth: targetMonth,
        });

        logger.info('Manual carry forward reduced', {
            employeeId,
            organizationId: String(organizationId),
            amount: numericAmount,
            anchorYear: targetYear,
            anchorMonth: targetMonth,
            adjustedBy: req.employee?._id || req.user?._id,
            role: access.role,
        });

        const updatedBalanceObj = await buildEmployeeLeaveBalanceResponse(
            employeeId,
            targetYear,
            organizationId,
            { month: targetMonth }
        );

        res.json({
            success: true,
            message: 'Manual carry forward reduced successfully',
            balance: updatedBalanceObj,
            canAdjust: true,
        });
    } catch (error) {
        logger.error('Reduce Manual Carry Forward Error', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: 'Error reducing manual carry forward',
            error: error.message,
        });
    }
};

/**
 * Recalculate all employee balances for a year
 */
export const recalculateBalances = async (req, res) => {
    try {
        const { year } = req.body;
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;

        const targetYear = year || new Date().getFullYear();
        const result = await leaveBalanceEngine.recalculateBalances(organizationId, targetYear);

        res.json({
            success: true,
            message: `Balances recalculated. Processed: ${result.processed}, Errors: ${result.errors}`,
            ...result
        });
    } catch (error) {
        logger.error('Recalculate Balances Error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error recalculating balances',
            error: error.message
        });
    }
};

