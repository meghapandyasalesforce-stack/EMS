/**
 * Leave type alignment: Leave model uses 'annual', Policy/Balance use 'paid'.
 * These helpers normalize between them so validation and balance work for all roles.
 */

/** Normalize leave type for policy/balance lookup (e.g. annual -> paid) */
export function normalizeLeaveTypeForPolicy(leaveType) {
    if (!leaveType || typeof leaveType !== 'string') return leaveType;
    const t = leaveType.trim().toLowerCase();
    if (t === 'annual') return 'paid';
    return leaveType;
}

/** Leave types to query in Leave collection when calculating used/pending for a balance type */
export function getLeaveTypeVariantsForBalance(balanceType) {
    if (!balanceType || typeof balanceType !== 'string') return [balanceType];
    const t = balanceType.trim().toLowerCase();
    if (t === 'paid') return ['paid', 'annual'];
    return [balanceType];
}
