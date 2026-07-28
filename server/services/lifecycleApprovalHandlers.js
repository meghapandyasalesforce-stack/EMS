/**
 * Applies approval workflow outcomes to lifecycle entities.
 */

import { OfferLetter } from '../models/lifecycleGap.model.js';
import { OffboardingWorkflow } from '../models/onboarding.model.js';
import { notify } from '../helpers/notificationManager.js';
import logger from '../helpers/logger.js';
import { addOffboardingActivity } from './offboardingService.js';

export async function applyLifecycleApprovalOutcome(instance) {
    const { entityType, entityId, status, rejectionReason, steps } = instance;
    const approverId = steps?.[steps.length - 1]?.approverId;

    try {
        switch (entityType) {
            case 'Offer': {
                const offer = await OfferLetter.findById(entityId);
                if (!offer) break;
                if (status === 'Approved') {
                    offer.status = 'Approved';
                    offer.activityFeed.push({
                        action: 'offer_approved',
                        description: 'Offer letter approved',
                        actor: approverId,
                        createdAt: new Date(),
                    });
                } else if (status === 'Rejected') {
                    offer.status = 'Draft';
                    offer.activityFeed.push({
                        action: 'offer_rejected',
                        description: rejectionReason || 'Offer letter rejected',
                        actor: approverId,
                        createdAt: new Date(),
                    });
                }
                await offer.save();
                await notify({
                    type: status === 'Approved' ? 'lifecycle_offer_approved' : 'lifecycle_offer_rejected',
                    organizationId: offer.organizationId,
                    data: { offer },
                }).catch((e) => logger.warn('Offer approval notification failed', { error: e.message }));
                break;
            }
            case 'FnF': {
                const workflow = await OffboardingWorkflow.findById(entityId);
                if (!workflow?.finalSettlement) break;
                if (status === 'Approved') {
                    workflow.finalSettlement.status = 'Approved';
                    addOffboardingActivity(workflow, {
                        action: 'fnf_approved',
                        description: 'Full & Final settlement approved',
                        actor: approverId,
                    });
                    const { processWorkflowLetterTriggers } = await import('./lifecycleLetterService.js');
                    await processWorkflowLetterTriggers({
                        organizationId: workflow.organizationId,
                        event: 'fnf_approved',
                        employeeId: workflow.employeeId,
                        workflowId: workflow._id,
                        workflowType: 'offboarding',
                        actor: { _id: approverId },
                    }).catch(() => {});
                } else if (status === 'Rejected') {
                    workflow.finalSettlement.status = 'In Review';
                    addOffboardingActivity(workflow, {
                        action: 'fnf_rejected',
                        description: rejectionReason || 'F&F settlement rejected',
                        actor: approverId,
                    });
                }
                await workflow.save();
                await notify({
                    type: status === 'Approved' ? 'lifecycle_fnf_approved' : 'lifecycle_fnf_rejected',
                    organizationId: workflow.organizationId,
                    data: { workflow },
                }).catch((e) => logger.warn('FnF approval notification failed', { error: e.message }));
                break;
            }
            case 'Offboarding':
            case 'Clearance': {
                const workflow = await OffboardingWorkflow.findById(entityId);
                if (!workflow) break;
                addOffboardingActivity(workflow, {
                    action: status === 'Approved' ? 'clearance_approved' : 'clearance_rejected',
                    description: `${entityType} approval ${status.toLowerCase()}`,
                    actor: approverId,
                });
                await workflow.save();
                break;
            }
            case 'LifecycleForm': {
                const { handleFormApprovalOutcome } = await import('./lifecycleFormService.js');
                await handleFormApprovalOutcome(entityId, status, rejectionReason, approverId);
                break;
            }
            case 'ExitInterview': {
                const { handleExitInterviewApprovalOutcome } = await import('./lifecycleExitInterviewService.js');
                await handleExitInterviewApprovalOutcome(entityId, status, rejectionReason, approverId);
                break;
            }
            case 'LifecycleLetter': {
                const { handleLetterApprovalOutcome } = await import('./lifecycleLetterService.js');
                await handleLetterApprovalOutcome(entityId, status, rejectionReason, approverId);
                break;
            }
            default:
                break;
        }
    } catch (error) {
        logger.error('Lifecycle approval outcome handler failed', {
            error: error.message,
            entityType,
            entityId,
        });
    }
}
