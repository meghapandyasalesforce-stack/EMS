/**
 * Enterprise bootstrap — enables production defaults, seeds forms, auto-configures packs.
 */

import { getFullFeatureRegistry } from './lifecycleConfigService.js';
import { getOrCreateLifecycleSettings, updateLifecycleSettings } from './lifecycleConfigService.js';
import { autoConfigureLifecyclePacks } from './lifecycleCountryAutoConfigService.js';
import { seedDefaultLifecycleForms } from './lifecycleDefaultFormsService.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';

/** Features enabled on enterprise bootstrap (previously disabled-by-default) */
export const ENTERPRISE_ENABLED_FEATURES = Object.freeze([
    'backgroundVerification', 'employmentVerification', 'educationVerification', 'referenceVerification',
    'trainingLms', 'milestone30_60_90', 'probation', 'managerFeedback', 'employeeFeedback', 'goalAssignment',
    'exitInterview', 'leaveEncashment', 'bonusRecovery', 'serviceCertificate', 'alumniManagement', 'rehireEligibility',
    'candidatePortal', 'eSignature', 'digitalForms', 'emergencyContact', 'familyNominee',
    'industry.it.nda', 'industry.it.repositoryAccess',
    'compliance.india.aadhaar', 'compliance.india.pan', 'compliance.india.uan',
    'compliance.india.epf', 'compliance.india.esi', 'compliance.india.nomination',
    'indiaStatutoryCompliance', 'lmsDashboard', 'probationCenter', 'enterpriseDashboards',
    'globalLifecycleSearch', 'notificationCenter', 'bulkOperations', 'whiteLabelBranding',
]);

export async function bootstrapEnterpriseLifecycle(organizationId, { actor, req } = {}) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    const registryKeys = new Set(getFullFeatureRegistry().map((f) => f.key));

    const disabledPackKeys = new Set([
        ...(settings.compliancePacks || []).filter((p) => p.enabled === false).map((p) => p.packKey),
        ...(settings.industryPacks || []).filter((p) => p.enabled === false).map((p) => p.packKey),
    ]);
    const disabledPackFeatures = new Set();
    for (const feature of getFullFeatureRegistry()) {
        if (feature.packKey && disabledPackKeys.has(feature.packKey)) {
            disabledPackFeatures.add(feature.key);
        }
    }

    const featureUpdates = {};
    for (const key of ENTERPRISE_ENABLED_FEATURES) {
        if (!registryKeys.has(key)) continue;
        if (disabledPackFeatures.has(key)) continue; // respect Configure pack disables
        featureUpdates[key] = true;
    }

    await updateLifecycleSettings(organizationId, {
        enabledFeatures: featureUpdates,
        bgvPolicy: {
            vendor: process.env.DEFAULT_BGV_VENDOR || 'manual',
            blockJoiningUntilClear: true,
            defaultChecks: ['employment', 'education', 'identity', 'criminal'],
            slaDays: 14,
        },
        exitInterviewPolicy: {
            enabled: true,
            mandatory: false,
            autoSchedule: true,
            autoScheduleDaysBeforeLwd: 7,
            anonymousAllowed: true,
            reminderDaysBefore: [7, 3, 1],
        },
        noticePeriodPolicy: {
            enabled: true,
            defaultNoticeDays: 30,
            probationNoticeDays: 15,
            allowBuyout: true,
            maxBuyoutDays: 30,
            allowLeaveAdjustment: true,
            gradePolicies: [
                { grade: 'Junior', noticeDays: 30 },
                { grade: 'Mid', noticeDays: 60 },
                { grade: 'Senior', noticeDays: 90 },
            ],
            departmentPolicies: [],
            employmentTypePolicies: [
                { type: 'permanent', noticeDays: 30 },
                { type: 'contract', noticeDays: 15 },
            ],
        },
        fnfPolicy: {
            enabled: true,
            includeLeaveEncashment: true,
            includeBonus: true,
            includeGratuityEstimate: true,
            recoveryFromFinalPay: true,
            approvalRequired: true,
            bridgeToPayroll: true,
        },
        esignProvider: process.env.DEFAULT_ESIGN_PROVIDER || 'internal',
        lmsProvider: process.env.DEFAULT_LMS_PROVIDER || 'internal',
        accessRevocationPolicy: {
            autoRevokeOnLwd: true,
            providers: {
                email: process.env.ACCESS_REVOKE_EMAIL_PROVIDER || 'google_workspace',
                hrms: 'hrms',
            },
        },
    }, { actor, req });

    const packResult = await autoConfigureLifecyclePacks(organizationId, { actor, req });
    const forms = await seedDefaultLifecycleForms(organizationId, { actor, req });

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'LifecycleSettings',
        entityId: settings._id,
        entityName: 'Enterprise Bootstrap',
        actor,
        req,
        metadata: { packResult, formsSeeded: forms.length },
    });

    return {
        featuresEnabled: Object.keys(featureUpdates).length,
        packs: packResult,
        formsSeeded: forms.length,
    };
}
