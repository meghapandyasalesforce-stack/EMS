/**
 * Decide whether admin leave status should be applied directly (bypassing workflow).
 * Direct updates are allowed when there is no workflow, or when workflow processing failed.
 * Multi-step workflows still "In Progress" must not be fully approved via direct update.
 */
export function shouldApplyDirectLeaveStatusUpdate({
    hasApprovalInstance,
    workflowProcessed,
    workflowStillInProgress,
    workflowError = false,
}) {
    if (workflowError) {
        return false;
    }
    if (!hasApprovalInstance) {
        return true;
    }
    if (workflowStillInProgress) {
        return false;
    }
    if (workflowProcessed) {
        return false;
    }
    return true;
}
