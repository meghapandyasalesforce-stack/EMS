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

const LEGACY_DESIGNATIONS = [
    'Intern', 'Trainee', 'Junior', 'Mid-Level', 'Senior', 'Lead', 'Supervisor',
    'Manager', 'Senior Manager', 'Director', 'VP', 'Executive', 'CEO', 'CTO', 'CFO',
    'Software Engineer', 'Senior Software Engineer',
];

const LEGACY_JOB_ROLES = [
    'Software Engineer', 'Frontend Developer', 'Backend Developer', 'DevOps Engineer',
    'HR Manager', 'HR Executive', 'Financial Analyst', 'Marketing Executive',
    'Sales Representative', 'Product Manager', 'QA Tester', 'Customer Support Specialist',
    'UX/UI Designer', 'Project Manager', 'Legal Advisor', 'Operations Coordinator',
    'Full Stack Developer',
];

const slugCode = (name, index = 0) => {
    const base = String(name || 'ITEM')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 24);
    return base || `ITEM_${index}`;
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

    const desigSources = (org.orgDesignations?.length
        ? org.orgDesignations
        : DEFAULT_ORG_DESIGNATIONS.map((title) => ({ title }))
    ).filter((d) => d?.title);

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
    for (let i = 0; i < LEGACY_DESIGNATIONS.length; i += 1) {
        const title = LEGACY_DESIGNATIONS[i];
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

    const engDeptId = deptIdByName.get('engineering') || [...deptIdByName.values()][0];
    for (let i = 0; i < LEGACY_JOB_ROLES.length; i += 1) {
        const name = LEGACY_JOB_ROLES[i];
        let departmentIds = engDeptId ? [engDeptId] : [];
        const lower = name.toLowerCase();
        if (lower.includes('hr')) {
            const hrId = deptIdByName.get('hr') || deptIdByName.get('human resources');
            if (hrId) departmentIds = [hrId];
        } else if (lower.includes('financial') || lower.includes('account')) {
            const finId = deptIdByName.get('finance');
            if (finId) departmentIds = [finId];
        } else if (lower.includes('sales')) {
            const sId = deptIdByName.get('sales');
            if (sId) departmentIds = [sId];
        } else if (lower.includes('marketing')) {
            const mId = deptIdByName.get('marketing');
            if (mId) departmentIds = [mId];
        }
        await OrgJobRole.create({
            organizationId,
            name,
            code: slugCode(name, i),
            departmentIds,
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
    return Model.find(query).sort({ name: 1 }).lean();
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

const loadMasterById = async (Model, organizationId, id, label) => {
    if (!id) return null;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error(`Invalid ${label} id`);
    }
    const doc = await Model.findOne({ _id: id, organizationId, status: 'active' }).lean();
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

    const department = await loadMasterById(
        OrgDepartment,
        organizationId,
        input.departmentId,
        'Department'
    );
    if (department) {
        out.departmentId = department._id;
        out.department = department.name;
    }

    const team = await loadMasterById(OrgTeam, organizationId, input.teamId, 'Team');
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

    const jobRole = await loadMasterById(OrgJobRole, organizationId, input.jobRoleId, 'Job role');
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
        input.designationId,
        'Designation'
    );
    if (designation) {
        out.designationId = designation._id;
        out.position = designation.name;
    }

    const location = await loadMasterById(OrgLocation, organizationId, input.locationId, 'Location');
    if (location) {
        out.locationId = location._id;
        if (location.address?.city) {
            out.city = location.address.city;
        }
    }

    const employmentType = await loadMasterById(
        OrgEmploymentType,
        organizationId,
        input.employmentTypeId,
        'Employment type'
    );
    if (employmentType) {
        out.employmentTypeId = employmentType._id;
        out.employmentType = employmentType.name;
    }

    const workMode = await loadMasterById(OrgWorkMode, organizationId, input.workModeId, 'Work mode');
    if (workMode) {
        out.workModeId = workMode._id;
        out.workMode = workMode.name;
    }

    return out;
};

export default {
    seedOrgStructureFromOrganization,
    getStructureCatalog,
    listMasterRecords,
    createMasterRecord,
    updateMasterRecord,
    deleteMasterRecord,
    resolveEmployeeOrgFields,
    MASTER_MODELS,
};
