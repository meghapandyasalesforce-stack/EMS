import Organization from '../models/organization.model.js';

/** Public career portals accept organization IDs only. */
export const resolveCareerOrganizationId = async (identifier) => {
    const value = String(identifier || '');
    if (!/^[a-f\d]{24}$/i.test(value)) return null;
    const org = await Organization.findOne({ _id: value, isActive: true, deletedAt: null })
        .select('_id').lean();
    return org?._id?.toString() || null;
};
