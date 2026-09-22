import Organization from '../models/organization.model.js';

/**
 * Org-level Employee Documents modes.
 * Missing fields default to true (both modes on) so existing orgs are unchanged.
 */
export async function getDocumentModeSettings(organizationId) {
  if (!organizationId) {
    return { enableDocumentRequests: true, enableSelfServiceDocuments: true };
  }

  const org = await Organization.findById(organizationId)
    .select('settings.enableDocumentRequests settings.enableSelfServiceDocuments')
    .lean();

  return {
    enableDocumentRequests: org?.settings?.enableDocumentRequests !== false,
    enableSelfServiceDocuments: org?.settings?.enableSelfServiceDocuments !== false,
  };
}
