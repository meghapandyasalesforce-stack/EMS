/**
 * Bridge F&F settlement → Payroll off-cycle (subtype fnf).
 */

import Payroll from '../models/payroll.model.js';
import Employee from '../models/employee.model.js';
import { getOrCreateLifecycleSettings, isFeatureEnabled } from './lifecycleConfigService.js';
import { estimateGratuityFromEmployee } from './gratuityCalculationService.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';
import { addOffboardingActivity } from './offboardingService.js';

export async function createFnfPayrollRun(workflow, { actor, req, month, year } = {}) {
    const settings = await getOrCreateLifecycleSettings(workflow.organizationId);
    if (!isFeatureEnabled(settings, 'fnfSettlement')) {
        throw new Error('F&F settlement is disabled');
    }
    if (!settings.fnfPolicy?.bridgeToPayroll) {
        throw new Error('Payroll bridge is not enabled in F&F policy');
    }

    const fs = workflow.finalSettlement || {};
    if (!['Calculated', 'Approved', 'Cleared'].includes(fs.status)) {
        throw new Error('F&F must be calculated/approved before payroll run');
    }

    const employee = await Employee.findById(workflow.employeeId).lean();
    if (!employee) throw new Error('Employee not found');

    const now = new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const payMonth = month ?? monthNames[now.getMonth()];
    const payYear = year ?? now.getFullYear();

    const existing = await Payroll.findOne({
        organizationId: workflow.organizationId,
        employeeId: workflow.employeeId,
        type: 'off_cycle',
        subType: 'fnf',
        offboardingWorkflowId: workflow._id,
    });
    if (existing) return { payroll: existing, created: false };

    const pendingDues = Number(fs.pendingDues || 0);
    const leaveEncashment = Number(fs.leaveEncashment || 0);
    const bonusAmount = Number(fs.bonusAmount || 0);
    const gratuityEstimate = Number(fs.gratuityEstimate || 0);
    const recoveries = Number(fs.recoveries || 0);
    const taxDeduction = Number(fs.taxDeduction || 0);

    const grossEarnings = pendingDues + leaveEncashment + bonusAmount + gratuityEstimate;
    const totalDeductions = recoveries + taxDeduction;
    const netPay = Math.max(0, grossEarnings - totalDeductions);

    const payroll = await Payroll.create({
        organizationId: workflow.organizationId,
        employeeId: workflow.employeeId,
        month: payMonth,
        year: payYear,
        type: 'off_cycle',
        subType: 'fnf',
        adjustmentMode: 'earning',
        offboardingWorkflowId: workflow._id,
        status: 'Pending',
        basicSalary: 0,
        earnings: {
            specialAllowance: pendingDues + leaveEncashment,
            performanceBonus: bonusAmount,
            gratuity: gratuityEstimate,
            totalEarnings: grossEarnings,
        },
        deductions: {
            otherDeductions: recoveries,
            incomeTax: taxDeduction,
            total: totalDeductions,
        },
        inHandSalary: netPay,
        notes: `F&F settlement for LWD ${workflow.lastWorkingDate ? new Date(workflow.lastWorkingDate).toISOString().slice(0, 10) : 'N/A'}`,
        lastModifiedBy: actor?._id,
    });

    workflow.finalSettlement.payrollId = payroll._id;
    workflow.finalSettlement.status = 'Pending Payment';
    workflow.finalSettlement.payrollLinkedAt = new Date();

    addOffboardingActivity(workflow, {
        action: 'fnf_payroll_created',
        description: `Payroll F&F run created (Net: Rs ${netPay.toLocaleString('en-IN')})`,
        actor,
        metadata: { payrollId: payroll._id },
    });

    await logLifecycleAudit({
        action: 'Create',
        entityType: 'F&F',
        entityId: payroll._id,
        entityName: 'F&F Payroll Run',
        actor,
        req,
        metadata: { workflowId: workflow._id, netPay },
    });

    return { payroll, created: true };
}

export async function enrichFnfWithGratuity(workflow, employee) {
    const settings = await getOrCreateLifecycleSettings(workflow.organizationId);
    if (!settings.fnfPolicy?.includeGratuityEstimate) return workflow;

    const gratuity = estimateGratuityFromEmployee(employee, { lastWorkingDate: workflow.lastWorkingDate });
    workflow.finalSettlement = workflow.finalSettlement || {};
    workflow.finalSettlement.gratuityEstimate = gratuity.amount || 0;
    workflow.finalSettlement.gratuityEligible = gratuity.eligible;
    workflow.finalSettlement.gratuityNotes = gratuity.reason || gratuity.formula;
    return workflow;
}
