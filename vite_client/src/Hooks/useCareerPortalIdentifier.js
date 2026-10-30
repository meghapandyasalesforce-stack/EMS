/** Career links always use the owning organization ID. No name lookup or redirect. */
export default function useCareerPortalIdentifier(organizationId) {
    return typeof organizationId === 'object' && organizationId
        ? String(organizationId._id || organizationId.id || '')
        : String(organizationId || '');
}
