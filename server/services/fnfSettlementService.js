/**
 * Full & Final settlement — calculation hooks into payroll/leave; approval + PDF.
 */

import Employee from '../models/employee.model.js';
import { getOrCreateLifecycleSettings, isFeatureEnabled, assertFeatureEnabled } from './lifecycleConfigService.js';
import { initiateLifecycleApproval } from './lifecycleApprovalService.js';
import { generateLetterPdf } from '../helpers/lifecycleLetterPdf.js';
import { addOffboardingActivity } from './offboardingService.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';
import { enrichFnfWithGratuity } from './fnfPayrollBridgeService.js';

export async function calculateFnfSettlement(workflow, { actor, leaveBalanceDays = 0, dailyRate = null } = {}) {
    const settings = await assertFeatureEnabled(workflow.organizationId, 'fnfSettlement', 'F&F settlement');

    const employee = await Employee.findById(workflow.employeeId).select('salary financialDetails dateOfJoining').lean();
    const policy = settings.fnfPolicy || {};

    await enrichFnfWithGratuity(workflow, employee);

    const monthlyGross = Number(employee?.salary?.gross || employee?.salary?.basic || 0);
    const computedDaily = dailyRate ?? (monthlyGross > 0 ? monthlyGross / 30 : 0);

    let leaveEncashment = 0;
    if (policy.includeLeaveEncashment !== false && leaveBalanceDays > 0) {
        leaveEncashment = Math.round(computedDaily * leaveBalanceDays * 100) / 100;
    }

    const pendingDues = Number(workflow.finalSettlement?.pendingDues || 0);
    const bonusAmount = policy.includeBonus ? Number(workflow.finalSettlement?.bonusAmount || 0) : 0;
    const gratuityEstimate = policy.includeGratuityEstimate
        ? Number(workflow.finalSettlement?.gratuityEstimate || 0) : 0;
    const recoveries = policy.recoveryFromFinalPay !== false
        ? Number(workflow.finalSettlement?.recoveries || 0) : 0;
    const taxDeduction = Number(workflow.finalSettlement?.taxDeduction || 0);
    const deductions = recoveries + taxDeduction;

    const finalAmount = Math.max(0, pendingDues + leaveEncashment + bonusAmount + gratuityEstimate - deductions);

    workflow.finalSettlement = {
        ...(workflow.finalSettlement?.toObject?.() || workflow.finalSettlement || {}),
        leaveEncashment,
        bonusAmount,
        gratuityEstimate,
        recoveries,
        taxDeduction,
        deductions,
        pendingDues,
        finalAmount,
        calculatedAt: new Date(),
        calculatedBy: actor?._id,
        status: 'Calculated',
        calculationNotes: `Daily rate: ${computedDaily.toFixed(2)}; leave days: ${leaveBalanceDays}`,
    };

    addOffboardingActivity(workflow, {
        action: 'fnf_calculated',
        description: `F&F calculated: Rs ${finalAmount.toLocaleString('en-IN')}`,
        actor,
        metadata: { finalAmount, leaveEncashment },
    });

    return workflow;
}

export async function generateFnfSummaryPdf(workflow, organizationId) {
    await assertFeatureEnabled(organizationId || workflow.organizationId, 'fnfSettlement', 'F&F settlement');
    const fs = workflow.finalSettlement || {};
    const bodyHtml = `<p><strong>Full & Final Settlement Summary</strong></p>
<p>Pending Dues: Rs ${fs.pendingDues || 0}</p>
<p>Leave Encashment: Rs ${fs.leaveEncashment || 0}</p>
<p>Bonus: Rs ${fs.bonusAmount || 0}</p>
<p>Gratuity (Est.): Rs ${fs.gratuityEstimate || 0}</p>
<p>Recoveries: Rs ${fs.recoveries || 0}</p>
<p>Tax Deduction: Rs ${fs.taxDeduction || 0}</p>
<p><strong>Net Settlement: Rs ${fs.finalAmount || 0}</strong></p>`;

    const pdf = await generateLetterPdf({
        organizationId,
        prefix: 'fnf',
        title: 'Full & Final Settlement',
        bodyHtml,
        fileName: `fnf-${workflow._id}.pdf`,
    });
    workflow.finalSettlement.pdfUrl = pdf.pdfUrl;
    workflow.finalSettlement.pdfFileName = pdf.pdfFileName;
    return workflow;
}

export async function submitFnfForApproval(workflow, actor, req) {
    const settings = await assertFeatureEnabled(workflow.organizationId, 'fnfSettlement', 'F&F settlement');
    if (!settings.fnfPolicy?.approvalRequired) {
        workflow.finalSettlement.status = 'Approved';
        return workflow;
    }

    const result = await initiateLifecycleApproval({
        organizationId: workflow.organizationId,
        entityType: 'FnF',
        entityId: workflow._id,
        requestedBy: actor?._id,
        metadata: { finalAmount: workflow.finalSettlement?.finalAmount },
        req,
        actor,
    });

    if (result.approvalInstanceId) {
        workflow.finalSettlement.approvalInstanceId = result.approvalInstanceId;
        workflow.finalSettlement.status = 'Pending Approval';
    } else if (result.status === 'Approved') {
        workflow.finalSettlement.status = 'Approved';
    }

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'F&F',
        entityId: workflow._id,
        entityName: 'F&F Settlement',
        actor,
        metadata: { approval: result },
    });

    return workflow;
}

export function buildFnfDashboard(workflows) {
    return {
        pending: workflows.filter((w) => ['Pending', 'In Review'].includes(w.finalSettlement?.status)).length,
        calculated: workflows.filter((w) => w.finalSettlement?.status === 'Calculated').length,
        pendingApproval: workflows.filter((w) => w.finalSettlement?.status === 'Pending Approval').length,
        approved: workflows.filter((w) => ['Approved', 'Paid', 'Cleared'].includes(w.finalSettlement?.status)).length,
        totalPendingAmount: workflows
            .filter((w) => !['Paid', 'Cleared', 'Waived'].includes(w.finalSettlement?.status))
            .reduce((sum, w) => sum + Number(w.finalSettlement?.finalAmount || 0), 0),
    };
}
