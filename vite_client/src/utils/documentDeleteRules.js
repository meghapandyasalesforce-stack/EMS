/**
 * Employees may remove their own upload only before HR approves or rejects it.
 * Applies to all document types (existing and future rows use approvalStatus).
 */
export function canEmployeeDeleteOwnDocument(doc) {
  if (!doc || doc.isActive === false) return false;
  if (doc.approvalStatus === 'Withdrawn') return false;
  if (doc.approvalStatus === 'Approved' || doc.approvalStatus === 'Rejected') return false;
  if (doc.approvalStatus === 'Pending') return true;
  if (doc.requiresApproval && (doc.approvalStatus == null || doc.approvalStatus === undefined)) {
    return true;
  }
  return false;
}
