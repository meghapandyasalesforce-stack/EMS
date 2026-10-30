import Organization from '../models/organization.model.js';

const OBJECT_ID = /^[a-f\d]{24}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
let indexReady;

export const careerSlugFromName = (name) => {
    const slug = String(name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        .slice(0, 60).replace(/-$/, '') || 'company';
    return OBJECT_ID.test(slug) ? `company-${slug}` : slug;
};

// Allocate the server-derived company name once; callers cannot choose or change it.
export const ensureCareerSlug = async (organizationId) => {
    const org = await Organization.findById(organizationId).select('name careerSlug').lean();
    if (!org) return null;
    if (org.careerSlug) return org.careerSlug;
    // Guarantee uniqueness even when automatic index creation is disabled.
    if (!indexReady) {
        indexReady = Organization.collection.createIndex({ careerSlug: 1 }, { unique: true, sparse: true })
            .catch((error) => { indexReady = null; throw error; });
    }
    await indexReady;
    const base = careerSlugFromName(org.name);
    const id = String(org._id);
    for (const slug of [base, `${base}-${id.slice(-6)}`, `${base}-${id}`]) {
        try {
            const saved = await Organization.findOneAndUpdate(
                { _id: org._id, $or: [{ careerSlug: { $exists: false } }, { careerSlug: null }, { careerSlug: '' }] },
                { $set: { careerSlug: slug } },
                { new: true, runValidators: true },
            ).select('careerSlug').lean();
            if (saved) return saved.careerSlug;
            // Another request may already have assigned this organization's link.
            const current = await Organization.findById(org._id).select('careerSlug').lean();
            if (current?.careerSlug) return current.careerSlug;
            return null;
        } catch (error) {
            if (error.code !== 11000) throw error;
        }
    }
    throw new Error('Unable to assign a unique career portal URL');
};

export const resolveCareerOrganizationId = async (identifier) => {
    const value = String(identifier || '');
    const isId = OBJECT_ID.test(value);
    const slug = value.toLowerCase();
    if (!isId && (slug.length > 90 || !SLUG.test(slug))) return null;
    // Both IDs and exact saved slugs must resolve to a live organization.
    // Never infer an alias from a username, company-name similarity, or jobs.
    const org = await Organization.findOne({ ...(isId ? { _id: value } : { careerSlug: slug }), isActive: true, deletedAt: null })
        .select('_id').lean();
    return org?._id?.toString() || null;
};
