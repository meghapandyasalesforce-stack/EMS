/**
 * Approval Workflow Service
 * Handles workflow execution, step progression, and notifications
 */

import logger from '../helpers/logger.js';
import { ApprovalWorkflow, ApprovalInstance } from '../models/approvalWorkflow.model.js';
import Employee from '../models/employee.model.js';
import { sendNotification } from '../helpers/notificationService.js';

/**
 * Create approval instance and start workflow
 */
export const initiateApproval = async ({
    organizationId,
    entityType,
    entityId,
    requestedBy,
    workflowId = null,
    metadata = {},
    priority = 'Medium'
}) => {
    try {
        // Find active workflow for entity type
        let workflow;
        if (workflowId) {
            workflow = await ApprovalWorkflow.findOne({
                _id: workflowId,
                organizationId,
                isActive: true
            });
        } else {
            workflow = await ApprovalWorkflow.findOne({
                organizationId,
                entityType,
                isActive: true
            });
        }

        if (!workflow) {
            // No workflow configured - auto approve
            logger.info('No workflow found, auto-approving', { entityType, entityId });
            return {
                status: 'Approved',
                autoApproved: true,
                workflowId: null
            };
        }

        // Check auto-approve conditions
        if (workflow.autoApprove?.enabled) {
            const shouldAutoApprove = checkAutoApproveConditions(workflow.autoApprove.conditions, metadata);
            if (shouldAutoApprove) {
                logger.info('Auto-approving based on conditions', { entityType, entityId });
                return {
                    status: 'Approved',
                    autoApproved: true,
                    workflowId: workflow._id
                };
            }
        }

        // Build steps array (await approver determination)
        const steps = [];
        for (const step of workflow.steps) {
            const approver = await determineApprover(step, requestedBy, organizationId);
            steps.push({
                stepNumber: step.stepNumber,
                stepName: step.stepName,
                approverId: approver?.id,
                approverName: approver?.name,
                status: 'Pending',
                dueDate: new Date(Date.now() + (step.timeoutHours || 48) * 60 * 60 * 1000)
            });
        }

        // Create approval instance
        const approvalInstance = await ApprovalInstance.create({
            organizationId,
            workflowId: workflow._id,
            entityType,
            entityId,
            requestedBy,
            status: 'In Progress',
            currentStep: 0,
            steps,
            metadata,
            priority
        });

        // Start first step
        await processNextStep(approvalInstance._id);

        return {
            status: 'In Progress',
            approvalInstanceId: approvalInstance._id,
            workflowId: workflow._id
        };
    } catch (error) {
        logger.error('Error initiating approval', {
            error: error.message,
            entityType,
            entityId,
            stack: error.stack
        });
        throw error;
    }
};

/**
 * Process approval action (approve/reject)
 */
export const processApprovalAction = async ({
    approvalInstanceId,
    stepNumber,
    approverId,
    action,
    comments = '',
    metadata = {}
}) => {
    try {
        const instance = await ApprovalInstance.findById(approvalInstanceId);
        if (!instance) {
            throw new Error('Approval instance not found');
        }

        if (instance.status !== 'In Progress') {
            throw new Error(`Cannot process action. Current status: ${instance.status}`);
        }

        const step = instance.steps.find(s => s.stepNumber === stepNumber);
        if (!step) {
            throw new Error('Step not found');
        }

        if (step.approverId?.toString() !== approverId?.toString()) {
            throw new Error('Unauthorized: You are not the assigned approver for this step');
        }

        if (step.status !== 'Pending') {
            throw new Error(`Step already ${step.status}`);
        }

        // Update step
        step.status = action === 'Approve' ? 'Approved' : 'Rejected';
        step.action = action;
        step.comments = comments;
        step.actionDate = new Date();

        // If rejected, reject entire workflow
        if (action === 'Reject') {
            instance.status = 'Rejected';
            instance.rejectedAt = new Date();
            instance.rejectedBy = approverId;
            instance.rejectionReason = comments;
            await instance.save();

            // Notify requester
            await notifyRequester(instance, 'rejected', comments);

            return {
                status: 'Rejected',
                message: 'Request rejected'
            };
        }

        // Check if all required steps are approved
        const allApproved = checkAllStepsApproved(instance);
        if (allApproved) {
            instance.status = 'Approved';
            instance.approvedAt = new Date();
            instance.currentStep = instance.steps.length;
            await instance.save();

            // ✅ UPDATE ENTITY STATUS (Leave, Expense, etc.)
            await updateEntityStatus(instance);

            await notifyRequester(instance, 'approved');

            return {
                status: 'Approved',
                message: 'Request approved'
            };
        }

        // Move to next step
        instance.currentStep = stepNumber;
        await instance.save();

        await processNextStep(approvalInstanceId);

        return {
            status: 'In Progress',
            message: 'Approval processed, moving to next step'
        };
    } catch (error) {
        logger.error('Error processing approval action', {
            error: error.message,
            approvalInstanceId,
            stepNumber,
            stack: error.stack
        });
        throw error;
    }
};

/**
 * Process next step in workflow
 */
const processNextStep = async (approvalInstanceId) => {
    try {
        const instance = await ApprovalInstance.findById(approvalInstanceId);
        if (!instance) return;

        const workflow = await ApprovalWorkflow.findById(instance.workflowId);
        if (!workflow) return;

        // Find next pending step
        const nextStep = instance.steps.find(s => s.status === 'Pending');
        if (!nextStep) return;

        const workflowStep = workflow.steps.find(s => s.stepNumber === nextStep.stepNumber);
        if (!workflowStep) return;

        // Notify approver
        await notifyApprover(instance, nextStep, workflowStep);

        // Set up escalation if enabled
        if (workflow.escalation?.enabled) {
            setTimeout(async () => {
                await checkAndEscalate(approvalInstanceId, nextStep.stepNumber);
            }, (workflow.escalation.escalateAfterHours || 24) * 60 * 60 * 1000);
        }
    } catch (error) {
        logger.error('Error processing next step', {
            error: error.message,
            approvalInstanceId,
            stack: error.stack
        });
    }
};

/**
 * Determine approver for a step
 */
const determineApprover = async (step, requestedBy, organizationId) => {
    try {
        const requester = await Employee.findById(requestedBy);
        if (!requester) return null;

        switch (step.approverType) {
            case 'Manager':
                if (requester.manager) {
                    const manager = await Employee.findById(requester.manager);
                    return { id: manager?._id, name: manager?.name };
                }
                break;

            case 'Role':
                if (step.approverRole) {
                    const employee = await Employee.findOne({
                        organizationId,
                        role: step.approverRole,
                        status: 'active'
                    });
                    return { id: employee?._id, name: employee?.name };
                }
                break;

            case 'Department':
                if (step.approverDepartment) {
                    const employee = await Employee.findOne({
                        organizationId,
                        department: step.approverDepartment,
                        position: { $in: ['Manager', 'Head', 'Director'] },
                        status: 'active'
                    });
                    return { id: employee?._id, name: employee?.name };
                }
                break;

            case 'Employee':
                if (step.approverEmployee) {
                    const employee = await Employee.findById(step.approverEmployee);
                    return { id: employee?._id, name: employee?.name };
                }
                break;

            case 'HR':
                const hrEmployee = await Employee.findOne({
                    organizationId,
                    position: { $regex: /HR|Human Resources/i },
                    status: 'active'
                });
                return { id: hrEmployee?._id, name: hrEmployee?.name };

            case 'Finance':
                const financeEmployee = await Employee.findOne({
                    organizationId,
                    department: 'Finance',
                    status: 'active'
                });
                return { id: financeEmployee?._id, name: financeEmployee?.name };

            case 'Executive':
                const executive = await Employee.findOne({
                    organizationId,
                    position: { $in: ['CEO', 'CTO', 'CFO', 'VP'] },
                    status: 'active'
                });
                return { id: executive?._id, name: executive?.name };
        }

        return null;
    } catch (error) {
        logger.error('Error determining approver', { error: error.message });
        return null;
    }
};

/**
 * Check if all required steps are approved
 */
const checkAllStepsApproved = (instance) => {
    const workflow = instance.workflowId; // Would need to fetch workflow
    // For now, check if all non-skipped steps are approved
    const requiredSteps = instance.steps.filter(s => s.status !== 'Skipped');
    return requiredSteps.every(s => s.status === 'Approved');
};

/**
 * Check auto-approve conditions
 */
const checkAutoApproveConditions = (conditions, metadata) => {
    if (!conditions) return false;

    if (conditions.maxAmount && metadata.amount) {
        return metadata.amount <= conditions.maxAmount;
    }

    if (conditions.leaveDays && metadata.duration) {
        return metadata.duration <= conditions.leaveDays;
    }

    return false;
};

/**
 * Notify approver
 */
const notifyApprover = async (instance, step, workflowStep) => {
    try {
        if (!step.approverId) return;

        const requester = await Employee.findById(instance.requestedBy);
        const approver = await Employee.findById(step.approverId);

        if (!approver) return;

        await sendNotification({
            userId: approver._id,
            title: `Approval Required: ${instance.entityType}`,
            message: `${requester?.name || 'Someone'} has requested approval for ${instance.entityType}. Step: ${step.stepName}`,
            type: 'approval_request',
            priority: instance.priority === 'Urgent' ? 'high' : 'medium',
            metadata: {
                approvalInstanceId: instance._id,
                entityType: instance.entityType,
                entityId: instance.entityId,
                stepNumber: step.stepNumber
            }
        });
    } catch (error) {
        logger.error('Error notifying approver', { error: error.message });
    }
};

/**
 * Update entity status when workflow completes
 */
const updateEntityStatus = async (instance) => {
    try {
        if (instance.entityType === 'Leave') {
            const Leave = (await import('../models/leave.model.js')).default;
            const leave = await Leave.findById(instance.entityId);
            if (leave) {
                if (instance.status === 'Approved') {
                    leave.status = 'approved';
                    leave.approvedBy = instance.steps[instance.steps.length - 1]?.approverId;
                    leave.approvedAt = new Date();
                    
                    // Update leave balance
                    try {
                        const leaveBalanceEngine = (await import('./leaveBalanceEngine.js')).default;
                        const year = new Date(leave.startDate).getFullYear();
                        await leaveBalanceEngine.calculateBalance(leave.employee, year, leave.organizationId);
                    } catch (balanceError) {
                        logger.warn('Error updating leave balance after workflow approval', {
                            error: balanceError.message,
                            leaveId: leave._id
                        });
                    }
                } else if (instance.status === 'Rejected') {
                    leave.status = 'rejected';
                    leave.rejectedBy = instance.rejectedBy;
                    leave.rejectedAt = new Date();
                    leave.rejectionReason = instance.rejectionReason;
                }
                await leave.save();
            }
        } else if (instance.entityType === 'Expense') {
            const Expense = (await import('../models/expense.model.js')).default;
            const expense = await Expense.findById(instance.entityId);
            if (expense) {
                if (instance.status === 'Approved') {
                    expense.status = 'Approved';
                    expense.approvedBy = instance.steps[instance.steps.length - 1]?.approverId;
                    expense.approvedAt = new Date();
                } else if (instance.status === 'Rejected') {
                    expense.status = 'Rejected';
                    expense.approvedBy = instance.rejectedBy;
                    expense.approvedAt = instance.rejectedAt;
                    expense.rejectionReason = instance.rejectionReason || 'Rejected through approval workflow';
                }
                await expense.save();
            }
        }
        // Add other entity types (Document, etc.) as needed
    } catch (error) {
        logger.error('Error updating entity status', {
            error: error.message,
            entityType: instance.entityType,
            entityId: instance.entityId,
            stack: error.stack
        });
    }
};

/**
 * Notify requester
 */
const notifyRequester = async (instance, status, reason = '') => {
    try {
        await sendNotification({
            userId: instance.requestedBy,
            title: `Approval ${status === 'approved' ? 'Approved' : 'Rejected'}: ${instance.entityType}`,
            message: status === 'approved'
                ? `Your ${instance.entityType} request has been approved.`
                : `Your ${instance.entityType} request has been rejected. ${reason}`,
            type: `approval_${status}`,
            priority: 'medium',
            metadata: {
                approvalInstanceId: instance._id,
                entityType: instance.entityType,
                entityId: instance.entityId
            }
        });
    } catch (error) {
        logger.error('Error notifying requester', { error: error.message });
    }
};

/**
 * Check and escalate if needed
 */
const checkAndEscalate = async (approvalInstanceId, stepNumber) => {
    try {
        const instance = await ApprovalInstance.findById(approvalInstanceId);
        if (!instance || instance.status !== 'In Progress') return;

        const step = instance.steps.find(s => s.stepNumber === stepNumber);
        if (!step || step.status !== 'Pending') return;

        const workflow = await ApprovalWorkflow.findById(instance.workflowId);
        if (!workflow?.escalation?.enabled) return;

        // Mark as escalated
        step.escalated = true;
        step.escalatedAt = new Date();
        await instance.save();

        // Determine escalation approver
        const escalationApprover = await determineEscalationApprover(workflow, instance);
        if (escalationApprover) {
            step.approverId = escalationApprover.id;
            step.approverName = escalationApprover.name;
            await instance.save();

            await notifyApprover(instance, step, workflow.steps.find(s => s.stepNumber === stepNumber));
        }
    } catch (error) {
        logger.error('Error escalating approval', { error: error.message });
    }
};

/**
 * Determine escalation approver
 */
const determineEscalationApprover = async (workflow, instance) => {
    const escalation = workflow.escalation;
    if (!escalation) return null;

    switch (escalation.escalateTo) {
        case 'NextLevel':
            // Find next step approver
            const nextStep = instance.steps.find(s => s.status === 'Pending' && s.stepNumber > instance.currentStep);
            if (nextStep) {
                return { id: nextStep.approverId, name: nextStep.approverName };
            }
            break;

        case 'Role':
            if (escalation.escalateToRole) {
                const employee = await Employee.findOne({
                    organizationId: instance.organizationId,
                    role: escalation.escalateToRole,
                    status: 'active'
                });
                return { id: employee?._id, name: employee?.name };
            }
            break;

        case 'Employee':
            if (escalation.escalateToEmployee) {
                const employee = await Employee.findById(escalation.escalateToEmployee);
                return { id: employee?._id, name: employee?.name };
            }
            break;
    }

    return null;
};

/**
 * Delegate approval to another employee
 */
export const delegateApproval = async ({
    approvalInstanceId,
    stepNumber,
    approverId,
    delegateToId,
    comments = ''
}) => {
    try {
        const instance = await ApprovalInstance.findById(approvalInstanceId);
        if (!instance) {
            throw new Error('Approval instance not found');
        }

        if (instance.status !== 'In Progress') {
            throw new Error(`Cannot delegate. Current status: ${instance.status}`);
        }

        const step = instance.steps.find(s => s.stepNumber === stepNumber);
        if (!step) {
            throw new Error('Step not found');
        }

        if (step.approverId?.toString() !== approverId?.toString()) {
            throw new Error('Unauthorized: You are not the assigned approver for this step');
        }

        if (step.status !== 'Pending') {
            throw new Error(`Cannot delegate step with status: ${step.status}`);
        }

        // Get workflow to check if delegation is allowed
        const workflow = await ApprovalWorkflow.findById(instance.workflowId);
        if (!workflow) {
            throw new Error('Workflow not found');
        }

        const workflowStep = workflow.steps.find(s => s.stepNumber === stepNumber);
        if (!workflowStep) {
            throw new Error('Workflow step not found');
        }

        if (!workflowStep.canDelegate) {
            throw new Error('Delegation is not allowed for this step');
        }

        // Verify delegate exists and is active
        const delegate = await Employee.findById(delegateToId);
        if (!delegate) {
            throw new Error('Delegate employee not found');
        }

        if (delegate.organizationId?.toString() !== instance.organizationId?.toString()) {
            throw new Error('Delegate must be from the same organization');
        }

        // Update step with delegation
        step.status = 'Delegated';
        step.action = 'Delegate';
        step.comments = comments || `Delegated to ${delegate.name}`;
        step.actionDate = new Date();
        step.delegatedTo = delegateToId;

        // Update approver to delegate
        step.approverId = delegateToId;
        step.approverName = delegate.name;
        step.status = 'Pending'; // Reset to pending for delegate

        await instance.save();

        // Notify delegate
        const requester = await Employee.findById(instance.requestedBy);
        await sendNotification({
            userId: delegateToId,
            title: `Delegated Approval: ${instance.entityType}`,
            message: `${requester?.name || 'Someone'} has requested approval for ${instance.entityType}. This was delegated to you by ${step.approverName || 'the original approver'}.`,
            type: 'approval_delegated',
            priority: instance.priority === 'Urgent' ? 'high' : 'medium',
            metadata: {
                approvalInstanceId: instance._id,
                entityType: instance.entityType,
                entityId: instance.entityId,
                stepNumber: step.stepNumber,
                originalApproverId: approverId
            }
        });

        logger.info('Approval delegated', {
            approvalInstanceId,
            stepNumber,
            originalApproverId: approverId,
            delegateToId,
            entityType: instance.entityType
        });

        return {
            status: 'Delegated',
            message: 'Approval delegated successfully',
            step: step
        };
    } catch (error) {
        logger.error('Error delegating approval', {
            error: error.message,
            approvalInstanceId,
            stepNumber,
            approverId,
            stack: error.stack
        });
        throw error;
    }
};

/**
 * Get pending approvals for an employee
 */
export const getPendingApprovals = async (employeeId, organizationId) => {
    try {
        const approvals = await ApprovalInstance.find({
            organizationId,
            'steps.approverId': employeeId,
            'steps.status': 'Pending',
            status: 'In Progress'
        })
            .populate('requestedBy', 'name email')
            .populate('workflowId', 'name')
            .sort({ createdAt: -1 })
            .lean();

        return approvals.map(approval => {
            const pendingStep = approval.steps.find(s => 
                s.approverId?.toString() === employeeId?.toString() && s.status === 'Pending'
            );
            return {
                ...approval,
                currentPendingStep: pendingStep
            };
        });
    } catch (error) {
        logger.error('Error getting pending approvals', { error: error.message });
        return [];
    }
};

