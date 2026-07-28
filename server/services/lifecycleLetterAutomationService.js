/**
 * Auto-generate experience/relieving letters on offboarding workflow events.
 */

import { LifecycleLetterTemplate, LifecycleGeneratedLetter } from '../models/lifecycleGap.model.js';
import { generateLetter, sendLetter } from './lifecycleLetterService.js';
import { getOrCreateLifecycleSettings, isFeatureEnabled } from './lifecycleConfigService.js';
import { addOffboardingActivity } from './offboardingService.js';

const OFFBOARDING_LETTER_TYPES = ['experience_letter', 'relieving_letter', 'service_certificate'];

export async function triggerOffboardingLetters(workflow, organizationId, { actor, req } = {}) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    const results = [];

    for (const letterType of OFFBOARDING_LETTER_TYPES) {
        const featureKey = letterType === 'experience_letter' ? 'experienceLetter'
            : letterType === 'relieving_letter' ? 'relievingLetter' : 'serviceCertificate';
        if (!isFeatureEnabled(settings, featureKey)) continue;

        const tpl = await LifecycleLetterTemplate.findOne({
            organizationId,
            letterType,
            status: 'Published',
            isActive: { $ne: false },
            $or: [
                { workflowTriggers: 'offboarding_completed' },
                { workflowTriggers: { $in: ['offboarding_completed'] } },
                { workflowTriggers: { $size: 0 } },
            ],
        }).sort({ updatedAt: -1 });

        if (!tpl) continue;

        try {
            const letter = await generateLetter({
                organizationId,
                templateId: tpl._id,
                employeeId: workflow.employeeId,
                workflowId: workflow._id,
                workflowType: 'offboarding',
                triggerEvent: 'offboarding_completed',
                actor,
                req,
                sendNotification: true,
            });

            if (letter.status === 'Approved' || letter.status === 'Draft') {
                await sendLetter(organizationId, letter._id, { actor, req });
            }

            if (letterType === 'experience_letter' && workflow.experienceLetter) {
                workflow.experienceLetter.status = 'Issued';
                workflow.experienceLetter.fileName = letter.pdfFileName;
                workflow.experienceLetter.uploadedAt = new Date();
                workflow.experienceLetter.generatedLetterId = letter._id;
            }

            results.push(letter);
            addOffboardingActivity(workflow, {
                action: 'letter_auto_generated',
                description: `${letterType.replace(/_/g, ' ')} auto-generated`,
                actor,
                metadata: { letterId: letter._id, letterType },
            });
        } catch (err) {
            results.push({ letterType, error: err.message });
        }
    }

    return results;
}

export async function listGeneratedLettersForWorkflow(organizationId, workflowId) {
    return LifecycleGeneratedLetter.find({ organizationId, workflowId, workflowType: 'offboarding' })
        .sort({ createdAt: -1 })
        .lean();
}
