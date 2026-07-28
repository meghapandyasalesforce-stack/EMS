/**
 * Maps lifecycle notification event types → Configure feature keys.
 * Used by notificationManager so disabled features never emit emails/push/etc.
 */

export const LIFECYCLE_NOTIFICATION_FEATURE_MAP = Object.freeze({
    onboarding_reminder: 'reminders',
    onboarding_workflow_overdue: 'reminders',
    offboarding_reminder: 'reminders',
    offboarding_workflow_overdue: 'reminders',
    lifecycle_onboarding_escalation: 'escalations',
    lifecycle_offboarding_escalation: 'escalations',

    onboarding_document_uploaded: 'documentCollection',
    onboarding_document_approved: 'documentApproval',
    onboarding_document_rejected: 'documentApproval',
    onboarding_checklist_completed: 'joiningChecklist',
    onboarding_asset_assigned: 'itAssetProvisioning',
    onboarding_asset_returned: 'itAssetProvisioning',
    onboarding_training_completed: 'mandatoryTraining',
    onboarding_policy_signed: 'eSignature',

    offboarding_asset_returned: 'assetReturn',
    offboarding_experience_letter_issued: 'experienceLetter',

    lifecycle_offer_sent: 'offerLetter',
    lifecycle_offer_accepted: 'offerAcceptance',
    lifecycle_offer_declined: 'offerAcceptance',
    lifecycle_offer_approved: 'offerApproval',
    lifecycle_offer_rejected: 'offerApproval',

    lifecycle_bgv_initiated: 'backgroundVerification',
    lifecycle_bgv_cleared: 'backgroundVerification',
    lifecycle_bgv_failed: 'backgroundVerification',
    bgv_verification_assigned: 'backgroundVerification',
    bgv_documents_required: 'backgroundVerification',
    bgv_submission_successful: 'backgroundVerification',
    bgv_additional_info_requested: 'backgroundVerification',
    bgv_verification_approved: 'backgroundVerification',
    bgv_verification_rejected: 'backgroundVerification',
    bgv_employee_submitted: 'backgroundVerification',
    bgv_employee_resubmitted: 'backgroundVerification',
    bgv_verification_pending: 'backgroundVerification',
    bgv_verification_overdue: 'backgroundVerification',
    bgv_check_submitted: 'backgroundVerification',
    bgv_check_verified: 'backgroundVerification',
    bgv_check_rejected: 'backgroundVerification',
    bgv_info_requested: 'backgroundVerification',
    bgv_info_response: 'backgroundVerification',
    bgv_hr_remarks: 'backgroundVerification',

    lifecycle_fnf_approved: 'fnfSettlement',
    lifecycle_fnf_rejected: 'fnfSettlement',
    lifecycle_fnf_calculated: 'fnfSettlement',

    lifecycle_exit_interview_scheduled: 'exitInterview',
    lifecycle_exit_interview_reminder: 'exitInterview',
    lifecycle_exit_interview_completed: 'exitInterview',

    lifecycle_letter_sent: 'experienceLetter',
    lifecycle_notice_period_alert: 'noticePeriod',
});

/**
 * Optional feature key from event type; null = not lifecycle-gated at transport layer.
 */
export function resolveNotificationFeatureKey(eventType, data = {}) {
    if (data?.featureKey) return data.featureKey;
    if (LIFECYCLE_NOTIFICATION_FEATURE_MAP[eventType]) {
        return LIFECYCLE_NOTIFICATION_FEATURE_MAP[eventType];
    }
    return null;
}
