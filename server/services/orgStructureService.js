/**
 * Organization structure masters — seed, CRUD, catalog, employee field resolution.
 */

import mongoose from 'mongoose';
import Organization from '../models/organization.model.js';
import OrgDepartment from '../models/orgMasters/department.model.js';
import OrgTeam from '../models/orgMasters/team.model.js';
import OrgJobFamily from '../models/orgMasters/jobFamily.model.js';
import OrgJobRole from '../models/orgMasters/jobRole.model.js';
import OrgDesignation from '../models/orgMasters/designation.model.js';
import OrgLocation from '../models/orgMasters/location.model.js';
import OrgEmploymentType from '../models/orgMasters/employmentType.model.js';
import OrgWorkMode from '../models/orgMasters/workMode.model.js';
import {
    DEFAULT_ORG_DEPARTMENTS,
    DEFAULT_ORG_DESIGNATIONS,
    DEFAULT_ORG_JOB_ROLES,
    DEFAULT_EMPLOYMENT_TYPES,
} from '../constants/onboardingDefaults.js';
import logger from '../helpers/logger.js';

export const MASTER_MODELS = {
    departments: OrgDepartment,
    teams: OrgTeam,
    jobFamilies: OrgJobFamily,
    jobRoles: OrgJobRole,
    designations: OrgDesignation,
    locations: OrgLocation,
    employmentTypes: OrgEmploymentType,
    workModes: OrgWorkMode,
};

const DEFAULT_WORK_MODES = [
    { name: 'Office', code: 'OFFICE' },
    { name: 'Remote', code: 'REMOTE' },
    { name: 'Hybrid', code: 'HYBRID' },
    { name: 'Field', code: 'FIELD' },
];

/** Normalized set of allowed designation (level) names */
const LEVEL_DESIGNATION_KEYS = new Set(
    DEFAULT_ORG_DESIGNATIONS.map((name) => String(name).toLowerCase().trim())
);

/** Role/function titles that were historically seeded as designations */
const MISPLACED_DESIGNATION_KEYS = new Set(
    [
        ...DEFAULT_ORG_JOB_ROLES,
        'Software Engineer',
        'Senior Software Engineer',
        'HR Manager',
        'Finance Manager',
        'Sales Executive',
        'Marketing Manager',
        'Operations Manager',
        'Project Manager',
        'Product Manager',
        'Backend Developer',
        'Frontend Developer',
        'Full Stack Developer',
        'DevOps Engineer',
        'QA Tester',
        'UX/UI Designer',
        'Financial Analyst',
        'Marketing Executive',
        'Sales Representative',
        'HR Executive',
        'Operations Coordinator',
        'Customer Support Specialist',
        'Legal Advisor',
        'Accountant',
        'Recruiter',
        'Data Analyst',
    ].map((name) => String(name).toLowerCase().trim())
);

const slugCode = (name, index = 0) => {
    const base = String(name || 'ITEM')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 24);
    return base || `ITEM_${index}`;
};

const isLevelDesignationName = (name) =>
    LEVEL_DESIGNATION_KEYS.has(String(name || '').toLowerCase().trim());

const isMisplacedDesignationName = (name) =>
    MISPLACED_DESIGNATION_KEYS.has(String(name || '').toLowerCase().trim());

const guessJobRoleDepartmentIds = (name, deptIdByName) => {
    const lower = String(name || '').toLowerCase().trim();
    const resolve = (...keys) => {
        for (const key of keys) {
            const id = deptIdByName.get(key);
            if (id) return [id];
        }
        return [];
    };

    // Explicit leadership / specialty mappings (do not default everything to Engineering)
    if (
        lower === 'chief executive officer' ||
        lower === 'ceo' ||
        (lower.includes('chief executive') && !lower.includes('technology') && !lower.includes('financial'))
    ) {
        return resolve('administration');
    }
    if (lower.includes('chief technology') || lower === 'cto') {
        return resolve('engineering');
    }
    if (lower.includes('chief financial') || lower === 'cfo') {
        return resolve('finance');
    }
    if (lower.startsWith('vp engineering')) {
        return resolve('engineering');
    }
    if (lower.startsWith('vp finance')) {
        return resolve('finance');
    }
    if (lower.startsWith('vp human') || lower.startsWith('vp hr')) {
        return resolve('human resources', 'hr');
    }
    if (lower.startsWith('vp sales')) {
        return resolve('sales');
    }
    if (lower.startsWith('vp operations')) {
        return resolve('operations');
    }
    if (lower.startsWith('vp marketing')) {
        return resolve('marketing');
    }
    if (lower.includes('it support')) {
        return resolve('it support');
    }
    if (lower.includes('legal')) {
        // No dedicated Legal department in defaults — leave unscoped (visible for any department filter)
        return [];
    }
    if (lower.includes('customer support') || lower.includes('customer service')) {
        return resolve('operations');
    }
    if (lower.includes('recruiter') || lower.includes('hr ') || lower.startsWith('hr') || lower.includes('human resource')) {
        return resolve('human resources', 'hr');
    }
    if (lower.includes('financ') || lower.includes('account')) {
        return resolve('finance');
    }
    if (lower.includes('sales')) {
        return resolve('sales');
    }
    if (lower.includes('marketing')) {
        return resolve('marketing');
    }
    if (lower.includes('operation')) {
        return resolve('operations');
    }
    if (
        lower.includes('engineer') ||
        lower.includes('developer') ||
        lower.includes('devops') ||
        lower.includes('qa ') ||
        lower.startsWith('qa') ||
        lower.includes('ux') ||
        lower.includes('product manager') ||
        lower.includes('project manager')
    ) {
        return resolve('engineering');
    }

    // Unknown roles: unscoped rather than incorrectly pinning to Engineering
    return [];
};

/** Roles whose department link should be corrected on sync for existing orgs. */
const ROLE_DEPARTMENT_REMAP_KEYS = new Set(
    [
        'Legal Advisor',
        'Customer Support Specialist',
        'Chief Executive Officer',
        'Chief Technology Officer',
        'Chief Financial Officer',
        'VP Engineering',
        'VP Finance',
        'VP Human Resources',
        'VP Sales',
        'VP Operations',
        'VP Marketing',
        'HR Director',
        'IT Support Engineer',
        'Recruiter',
        'Accountant',
    ].map((n) => n.toLowerCase())
);

async function ensureDefaultDepartments(organizationId) {
    let created = 0;
    for (let i = 0; i < DEFAULT_ORG_DEPARTMENTS.length; i += 1) {
        const name = DEFAULT_ORG_DEPARTMENTS[i];
        const existing = await OrgDepartment.findOne({
            organizationId,
            name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
        });
        if (!existing) {
            await OrgDepartment.create({
                organizationId,
                name,
                code: slugCode(name, i),
                status: 'active',
            });
            created += 1;
            continue;
        }
        if (existing.status !== 'active') {
            existing.status = 'active';
            await existing.save();
        }
    }
    return created;
}

async function ensureJobRoleExists(organizationId, name, deptIdByName) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;
    const key = trimmed.toLowerCase();
    const existing = await OrgJobRole.findOne({
        organizationId,
        name: { $regex: `^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    });
    const desiredDeptIds = guessJobRoleDepartmentIds(trimmed, deptIdByName);

    if (existing) {
        let dirty = false;
        if (existing.status !== 'active') {
            existing.status = 'active';
            dirty = true;
        }
        const currentIds = (existing.departmentIds || []).map((id) => String(id)).sort();
        const desiredIds = desiredDeptIds.map((id) => String(id)).sort();
        const shouldRemap =
            ROLE_DEPARTMENT_REMAP_KEYS.has(key) ||
            (currentIds.length === 0 && desiredIds.length > 0);
        if (shouldRemap && currentIds.join(',') !== desiredIds.join(',')) {
            existing.departmentIds = desiredDeptIds;
            dirty = true;
        }
        if (dirty) await existing.save();
        return existing;
    }
    return OrgJobRole.create({
        organizationId,
        name: trimmed,
        code: slugCode(trimmed),
        departmentIds: desiredDeptIds,
        status: 'active',
    });
}

/**
 * Ensure designations are seniority levels only.
 * Role-like designations are soft-deactivated and recreated as job roles.
 */
export const normalizeOrgDesignationCatalog = async (organizationId) => {
    // Keep default departments (incl. Administration) and job roles available for existing orgs
    await ensureDefaultDepartments(organizationId);

    const departments = await OrgDepartment.find({ organizationId, status: 'active' })
        .select('_id name')
        .lean();
    const deptIdByName = new Map(
        departments.map((d) => [String(d.name || '').toLowerCase().trim(), d._id])
    );

    let createdLevels = 0;
    let reactivatedLevels = 0;
    for (let i = 0; i < DEFAULT_ORG_DESIGNATIONS.length; i += 1) {
        const title = DEFAULT_ORG_DESIGNATIONS[i];
        const existing = await OrgDesignation.findOne({
            organizationId,
            name: { $regex: `^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
        });
        if (!existing) {
            await OrgDesignation.create({
                organizationId,
                name: title,
                code: slugCode(title, i),
                levelOrder: i + 1,
                status: 'active',
            });
            createdLevels += 1;
            continue;
        }
        let dirty = false;
        if (existing.status !== 'active') {
            existing.status = 'active';
            dirty = true;
            reactivatedLevels += 1;
        }
        if (existing.name !== title) {
            existing.name = title;
            dirty = true;
        }
        if (existing.levelOrder !== i + 1) {
            existing.levelOrder = i + 1;
            dirty = true;
        }
        if (dirty) await existing.save();
    }

    // Default job roles always available (creates missing leadership roles for existing orgs)
    for (const roleName of DEFAULT_ORG_JOB_ROLES) {
        await ensureJobRoleExists(organizationId, roleName, deptIdByName);
    }

    // Remove roles dropped from defaults (hide from Add Employee catalogs)
    const retiredJobRoleNames = ['Engineering Manager', 'Engineering Lead'];
    let retiredJobRoles = 0;
    for (const roleName of retiredJobRoleNames) {
        const result = await OrgJobRole.updateMany(
            {
                organizationId,
                status: 'active',
                name: { $regex: `^${roleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
            },
            { $set: { status: 'inactive' } }
        );
        retiredJobRoles += result.modifiedCount || result.nModified || 0;
    }

    const activeDesignations = await OrgDesignation.find({ organizationId, status: 'active' });
    let deactivated = 0;
    let movedToJobRoles = 0;
    for (const desig of activeDesignations) {
        if (isLevelDesignationName(desig.name)) continue;
        if (!isMisplacedDesignationName(desig.name)) continue;
        await ensureJobRoleExists(organizationId, desig.name, deptIdByName);
        movedToJobRoles += 1;
        desig.status = 'inactive';
        await desig.save();
        deactivated += 1;
    }

    if (createdLevels || reactivatedLevels || deactivated || retiredJobRoles) {
        logger.info('Normalized org designations to levels-only', {
            organizationId: String(organizationId),
            createdLevels,
            reactivatedLevels,
            deactivated,
            movedToJobRoles,
            retiredJobRoles,
        });
    }

    return { createdLevels, reactivatedLevels, deactivated, movedToJobRoles };
};

export const seedOrgStructureFromOrganization = async (organizationId) => {
    const org = await Organization.findById(organizationId)
        .select('orgDepartments orgDesignations employmentTypes officeLocations name')
        .lean();
    if (!org) {
        throw new Error('Organization not found');
    }

    const existingDepts = await OrgDepartment.countDocuments({ organizationId });
    if (existingDepts > 0) {
        // Already initialized — still keep designations level-only for existing tenants
        await normalizeOrgDesignationCatalog(organizationId);
        return { seeded: false, reason: 'already_initialized' };
    }

    const deptSources = (org.orgDepartments?.length
        ? org.orgDepartments
        : DEFAULT_ORG_DEPARTMENTS.map((name) => ({ name }))
    ).filter((d) => d?.name);

    const deptIdByName = new Map();
    for (let i = 0; i < deptSources.length; i += 1) {
        const src = deptSources[i];
        const name = String(src.name).trim();
        const doc = await OrgDepartment.create({
            organizationId,
            name,
            code: src.code || slugCode(name, i),
            description: src.description || '',
            status: 'active',
        });
        deptIdByName.set(name.toLowerCase(), doc._id);
    }

    // Prefer level designations from org onboarding only when they are actual levels;
    // otherwise seed the canonical level list.
    const desigSourcesRaw = (org.orgDesignations?.length
        ? org.orgDesignations
        : DEFAULT_ORG_DESIGNATIONS.map((title) => ({ title }))
    ).filter((d) => d?.title);

    const levelFromOrg = desigSourcesRaw.filter((d) => isLevelDesignationName(d.title));
    const roleLikeFromOrg = desigSourcesRaw.filter((d) => !isLevelDesignationName(d.title));
    const desigSources = levelFromOrg.length
        ? levelFromOrg
        : DEFAULT_ORG_DESIGNATIONS.map((title) => ({ title }));

    const seenDesig = new Set();
    for (let i = 0; i < desigSources.length; i += 1) {
        const title = String(desigSources[i].title).trim();
        const key = title.toLowerCase();
        if (seenDesig.has(key)) continue;
        seenDesig.add(key);
        await OrgDesignation.create({
            organizationId,
            name: title,
            code: slugCode(title, i),
            levelOrder: i + 1,
            status: 'active',
        });
    }
    for (let i = 0; i < DEFAULT_ORG_DESIGNATIONS.length; i += 1) {
        const title = DEFAULT_ORG_DESIGNATIONS[i];
        const key = title.toLowerCase();
        if (seenDesig.has(key)) continue;
        seenDesig.add(key);
        await OrgDesignation.create({
            organizationId,
            name: title,
            code: slugCode(title, 100 + i),
            levelOrder: i + 1,
            status: 'active',
        });
    }

    const empSources = (org.employmentTypes?.length
        ? org.employmentTypes
        : DEFAULT_EMPLOYMENT_TYPES.map((t) => ({ name: t.name, code: t.code }))
    ).filter((t) => t?.name);

    for (let i = 0; i < empSources.length; i += 1) {
        const src = empSources[i];
        await OrgEmploymentType.create({
            organizationId,
            name: String(src.name).trim(),
            code: src.code || slugCode(src.name, i),
            description: src.description || '',
            status: 'active',
        });
    }

    for (let i = 0; i < DEFAULT_WORK_MODES.length; i += 1) {
        const wm = DEFAULT_WORK_MODES[i];
        await OrgWorkMode.create({
            organizationId,
            name: wm.name,
            code: wm.code,
            status: 'active',
        });
    }

    const jobRoleNames = [
        ...DEFAULT_ORG_JOB_ROLES,
        ...roleLikeFromOrg.map((d) => String(d.title).trim()),
    ];
    const seenRoles = new Set();
    for (let i = 0; i < jobRoleNames.length; i += 1) {
        const name = jobRoleNames[i];
        const key = String(name || '').toLowerCase().trim();
        if (!key || seenRoles.has(key)) continue;
        seenRoles.add(key);
        await OrgJobRole.create({
            organizationId,
            name,
            code: slugCode(name, i),
            departmentIds: guessJobRoleDepartmentIds(name, deptIdByName),
            status: 'active',
        });
    }

    const locSources = org.officeLocations?.length ? org.officeLocations : [];
    for (let i = 0; i < locSources.length; i += 1) {
        const loc = locSources[i];
        if (!loc?.name && !loc?.address?.city) continue;
        await OrgLocation.create({
            organizationId,
            name: loc.name || loc.address?.city || `Location ${i + 1}`,
            code: slugCode(loc.name || loc.address?.city, i),
            type: loc.type || 'branch',
            isPrimary: Boolean(loc.isPrimary),
            address: loc.address || {},
            phone: loc.phone || '',
            status: 'active',
        });
    }

    logger.info('Seeded organization structure masters', { organizationId, departments: deptSources.length });
    // Ensure Administration + leadership job roles exist even when org onboarding supplied a custom dept list
    await normalizeOrgDesignationCatalog(organizationId);
    return { seeded: true };
};

export const listMasterRecords = async (organizationId, resource, filters = {}) => {
    const Model = MASTER_MODELS[resource];
    if (!Model) {
        throw new Error(`Unknown resource: ${resource}`);
    }
    const query = { organizationId, status: 'active' };
    if (filters.departmentId && resource === 'teams') {
        query.departmentId = filters.departmentId;
    }
    if (filters.departmentId && resource === 'jobRoles') {
        query.departmentIds = filters.departmentId;
    }
    const sort = resource === 'designations' ? { levelOrder: 1, name: 1 } : { name: 1 };
    return Model.find(query).sort(sort).lean();
};

export const getStructureCatalog = async (organizationId, { departmentId } = {}) => {
    await seedOrgStructureFromOrganization(organizationId);

    const [
        departments,
        teams,
        jobFamilies,
        jobRoles,
        designations,
        locations,
        employmentTypes,
        workModes,
    ] = await Promise.all([
        listMasterRecords(organizationId, 'departments'),
        departmentId
            ? listMasterRecords(organizationId, 'teams', { departmentId })
            : listMasterRecords(organizationId, 'teams'),
        listMasterRecords(organizationId, 'jobFamilies'),
        departmentId
            ? listMasterRecords(organizationId, 'jobRoles', { departmentId })
            : listMasterRecords(organizationId, 'jobRoles'),
        listMasterRecords(organizationId, 'designations'),
        listMasterRecords(organizationId, 'locations'),
        listMasterRecords(organizationId, 'employmentTypes'),
        listMasterRecords(organizationId, 'workModes'),
    ]);

    return {
        departments,
        teams,
        jobFamilies,
        jobRoles,
        designations,
        locations,
        employmentTypes,
        workModes,
    };
};

export const createMasterRecord = async (organizationId, resource, payload) => {
    const Model = MASTER_MODELS[resource];
    if (!Model) throw new Error(`Unknown resource: ${resource}`);

    const data = {
        organizationId,
        name: String(payload.name || '').trim(),
        code: payload.code ? String(payload.code).trim().toUpperCase() : slugCode(payload.name),
        description: payload.description || '',
        status: payload.status || 'active',
    };

    if (resource === 'departments') {
        data.parentDepartmentId = payload.parentDepartmentId || null;
        data.departmentHeadId = payload.departmentHeadId || null;
    }
    if (resource === 'teams') {
        if (!payload.departmentId) throw new Error('departmentId is required for teams');
        data.departmentId = payload.departmentId;
        data.teamLeadId = payload.teamLeadId || null;
    }
    if (resource === 'jobRoles') {
        data.departmentIds = Array.isArray(payload.departmentIds) ? payload.departmentIds : [];
        if (payload.departmentId) {
            data.departmentIds = [payload.departmentId];
        }
        data.level = payload.level || '';
        data.jobFamilyId = payload.jobFamilyId || null;
    }
    if (resource === 'designations') {
        data.levelOrder = payload.levelOrder || 1;
    }
    if (resource === 'locations') {
        data.type = payload.type || 'branch';
        data.isPrimary = Boolean(payload.isPrimary);
        data.address = payload.address || {};
        data.phone = payload.phone || '';
    }

    return Model.create(data);
};

export const updateMasterRecord = async (organizationId, resource, id, payload) => {
    const Model = MASTER_MODELS[resource];
    if (!Model) throw new Error(`Unknown resource: ${resource}`);

    const update = { ...payload };
    delete update.organizationId;
    delete update._id;

    const doc = await Model.findOneAndUpdate(
        { _id: id, organizationId },
        update,
        { new: true, runValidators: true }
    );
    if (!doc) throw new Error('Record not found');
    return doc;
};

export const deleteMasterRecord = async (organizationId, resource, id) => {
    const Model = MASTER_MODELS[resource];
    if (!Model) throw new Error(`Unknown resource: ${resource}`);

    const doc = await Model.findOneAndUpdate(
        { _id: id, organizationId },
        { status: 'inactive' },
        { new: true }
    );
    if (!doc) throw new Error('Record not found');
    return doc;
};

/** Treat "", null, and invalid ids as unset so Mongoose never sees "". */
const normalizeOptionalObjectId = (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const s = String(value).trim();
    if (!s || !mongoose.Types.ObjectId.isValid(s)) return undefined;
    return s;
};

const loadMasterById = async (Model, organizationId, id, label) => {
    const normalizedId = normalizeOptionalObjectId(id);
    if (!normalizedId) return null;
    const doc = await Model.findOne({ _id: normalizedId, organizationId, status: 'active' }).lean();
    if (!doc) {
        throw new Error(`${label} not found in this organization`);
    }
    return doc;
};

/**
 * Resolve master IDs to legacy string fields + store refs on employee payload.
 */
export const resolveEmployeeOrgFields = async (organizationId, input = {}) => {
    const out = { ...input };

    // Drop empty-string ObjectId fields from the client (e.g. teamId: "")
    const idKeys = [
        'departmentId',
        'teamId',
        'jobRoleId',
        'designationId',
        'locationId',
        'employmentTypeId',
        'workModeId',
        'jobFamilyId',
    ];
    for (const key of idKeys) {
        const normalized = normalizeOptionalObjectId(out[key]);
        if (normalized) out[key] = normalized;
        else delete out[key];
    }

    const department = await loadMasterById(
        OrgDepartment,
        organizationId,
        out.departmentId,
        'Department'
    );
    if (department) {
        out.departmentId = department._id;
        out.department = department.name;
    }

    const team = await loadMasterById(OrgTeam, organizationId, out.teamId, 'Team');
    if (team) {
        out.teamId = team._id;
        if (team.departmentId && !out.departmentId) {
            const teamDept = await OrgDepartment.findById(team.departmentId).lean();
            if (teamDept) {
                out.departmentId = teamDept._id;
                out.department = teamDept.name;
            }
        }
    }

    const jobRole = await loadMasterById(OrgJobRole, organizationId, out.jobRoleId, 'Job role');
    if (jobRole) {
        out.jobRoleId = jobRole._id;
        out.jobTitle = jobRole.name;
        if (jobRole.departmentIds?.length && !out.departmentId) {
            const jrDept = await OrgDepartment.findById(jobRole.departmentIds[0]).lean();
            if (jrDept) {
                out.departmentId = jrDept._id;
                out.department = jrDept.name;
            }
        }
    }

    const designation = await loadMasterById(
        OrgDesignation,
        organizationId,
        out.designationId,
        'Designation'
    );
    if (designation) {
        out.designationId = designation._id;
        out.position = designation.name;
    }

    const location = await loadMasterById(OrgLocation, organizationId, out.locationId, 'Location');
    if (location) {
        out.locationId = location._id;
        if (location.address?.city) {
            out.city = location.address.city;
        }
    }

    const employmentType = await loadMasterById(
        OrgEmploymentType,
        organizationId,
        out.employmentTypeId,
        'Employment type'
    );
    if (employmentType) {
        out.employmentTypeId = employmentType._id;
        out.employmentType = employmentType.name;
    }

    const workMode = await loadMasterById(OrgWorkMode, organizationId, out.workModeId, 'Work mode');
    if (workMode) {
        out.workModeId = workMode._id;
        out.workMode = workMode.name;
    }

    return out;
};

export default {
    seedOrgStructureFromOrganization,
    normalizeOrgDesignationCatalog,
    getStructureCatalog,
    listMasterRecords,
    createMasterRecord,
    updateMasterRecord,
    deleteMasterRecord,
    resolveEmployeeOrgFields,
    MASTER_MODELS,
};
