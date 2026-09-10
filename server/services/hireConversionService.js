/**
 * Hire conversion — create Employee + login + onboarding from a Candidate.
 * Uses the same patterns as registerEmployee without modifying that controller.
 */
import {
    applySystemRoleToEmployee,
    syncLinkedUserForSystemRole,
} from '../helpers/systemRoleService.js';
import { inferSystemRoleFromWorkInfo } from '../helpers/inferSystemRoleFromWorkInfo.js';
import { ALL_SYSTEM_ROLE_IDS } from '../config/systemRole.constants.js';
import { createEmployeeOnboardingWorkflow } from './onboardingService.js';
import logger from '../helpers/logger.js';
import { markHired } from './recruitmentService.js';
import { notify } from '../helpers/notificationManager.js';
import { queueWelcomeEmail } from '../helpers/emailQueue.js';
import { generateSecurePassword } from '../helpers/utils.js';
import Organization from '../models/organization.model.js';
import Employee from '../models/employee.model.js';
import { Recruitment } from '../models/recruitment.model.js';
import { invalidateEmployeesCache } from '../helpers/cacheHelper.js';
export const EMPLOYEE_DEPARTMENTS = [
    'Engineering', 'HR', 'Finance', 'Sales', 'Marketing', 'IT Support', 'Operations',
    'Customer Support', 'Legal', 'Product', 'Research & Development', 'Design', 'Administration',
    'Salesforce',
];
export const EMPLOYEE_JOB_TITLES = [
    'Software Engineer', 'Frontend Developer', 'Backend Developer', 'DevOps Engineer',
    'HR Manager', 'HR Executive', 'Financial Analyst', 'Marketing Executive',
    'Sales Representative', 'Product Manager', 'QA Tester', 'Customer Support Specialist',
    'UX/UI Designer', 'Project Manager', 'Legal Advisor', 'Operations Coordinator', 'Full Stack Developer',
    'MCP', 'SFMC',
];
export const EMPLOYEE_POSITIONS = [
    'Intern', 'Junior', 'Mid-Level', 'Senior', 'Lead', 'Supervisor', 'Manager',
    'Director', 'Executive', 'VP', 'CTO', 'CFO', 'CEO', 'Developer',
];
export const EMPLOYEE_JOB_CATEGORIES = [
    'Information Technology', 'Human Resources', 'Finance', 'Marketing', 'Sales', 'Operations',
    'Customer Service', 'Research and Development', 'Engineering', 'Legal', 'Administration',
    'Management', 'Design', 'Product Management', 'Salesforce',
];

function pickClosest(value, allowed, fallback) {
    if (!value) return fallback;
    const v = String(value).trim();
    const exact = allowed.find((a) => a.toLowerCase() === v.toLowerCase());
    if (exact) return exact;
    const partial = allowed.find(
        (a) => a.toLowerCase().includes(v.toLowerCase()) || v.toLowerCase().includes(a.toLowerCase())
    );
    return partial || fallback;
}

async function generateEmployeeId(organizationId, name) {
    const orgSettings = await Organization.findById(organizationId)
        .select('settings.employeeIdPrefix settings.employeeIdNextNumber settings.employeeIdMinDigits')
        .lean();

    if (orgSettings?.settings?.employeeIdPrefix) {
        const prefix = orgSettings.settings.employeeIdPrefix.toUpperCase();
        const minDigits = orgSettings.settings.employeeIdMinDigits || 3;
        for (let attempts = 0; attempts < 10; attempts++) {
            const updatedOrg = await Organization.findOneAndUpdate(
                { _id: organizationId },
                { $inc: { 'settings.employeeIdNextNumber': 1 } },
                { new: true, projection: { 'settings.employeeIdNextNumber': 1 } }
            );
            const seq = updatedOrg?.settings?.employeeIdNextNumber || 1;
            const candidateId = `${prefix}${String(seq).padStart(minDigits, '0')}`;
            const existing = await Employee.findOne({ employeeId: candidateId, organizationId }).select('_id').lean();
            if (!existing) return candidateId;
        }
        throw Object.assign(new Error('Failed to generate unique employee ID'), { status: 500, code: 'EMPLOYEE_ID_FAILED' });
    }

    const namePrefix = String(name || 'EMP').substring(0, 3).toUpperCase();
    const joiningYear = new Date().getFullYear();
    for (let attempts = 0; attempts < 10; attempts++) {
        const random = Math.floor(1000 + Math.random() * 9000);
        const candidateId = `EMP-${namePrefix}-${joiningYear}-${random}`;
        const existing = await Employee.findOne({ employeeId: candidateId, organizationId }).select('_id').lean();
        if (!existing) return candidateId;
    }
    throw Object.assign(new Error('Failed to generate unique employee ID'), { status: 500, code: 'EMPLOYEE_ID_FAILED' });
}

/**
 * Convert hired candidate → Employee + User login + onboarding.
 * @param {object} opts
 */
export async function convertCandidateToEmployee({
    candidate,
    organizationId,
    actorId,
    hirePayload = {},
}) {
    if (candidate.linkedEmployeeId) {
        const existing = await Employee.findById(candidate.linkedEmployeeId).select('name lastName email employeeId');
        return {
            alreadyConverted: true,
            employee: existing,
            candidate,
            onboarding: null,
            temporaryPassword: null,
        };
    }

    const job = candidate.jobPostingId && typeof candidate.jobPostingId === 'object'
        ? candidate.jobPostingId
        : await Recruitment.findById(candidate.jobPostingId).lean();

    const name = (hirePayload.name || candidate.firstName || '').trim();
    const lastName = (hirePayload.lastName || candidate.lastName || '').trim();
    const email = String(hirePayload.email || candidate.email || '').toLowerCase().trim();
    const salary = Number(hirePayload.salary ?? candidate.offerDetails?.salary);
    const department = pickClosest(
        hirePayload.department || job?.department,
        EMPLOYEE_DEPARTMENTS,
        'Engineering'
    );
    const jobTitle = pickClosest(
        hirePayload.jobTitle || job?.jobTitle || job?.position,
        EMPLOYEE_JOB_TITLES,
        'Software Engineer'
    );
    const position = pickClosest(hirePayload.position || job?.position, EMPLOYEE_POSITIONS, 'Junior');
    const jobCategory = pickClosest(hirePayload.jobCategory, EMPLOYEE_JOB_CATEGORIES, 'Information Technology');
    const joiningDate = hirePayload.joiningDate
        ? new Date(hirePayload.joiningDate)
        : (candidate.expectedJoiningDate || candidate.offerDetails?.startDate || new Date());

    if (!name || !lastName || !email) {
        throw Object.assign(new Error('name, lastName and email are required to hire'), { status: 400, code: 'HIRE_FIELDS_REQUIRED' });
    }
    if (!salary || Number.isNaN(salary) || salary <= 0) {
        throw Object.assign(new Error('A valid salary is required to create the employee'), { status: 400, code: 'SALARY_REQUIRED' });
    }

    const existingByEmail = await Employee.findOne({ email, organizationId }).select('_id employeeId').lean();
    if (existingByEmail) {
        throw Object.assign(
            new Error(`An employee with email ${email} already exists (${existingByEmail.employeeId}). Link manually or use a different email.`),
            { status: 409, code: 'DUPLICATE_EMAIL', existingEmployeeId: existingByEmail._id }
        );
    }

    const orgHasEmployees = await Employee.exists({ organizationId });
    let managerId = hirePayload.managerId || job?.hiringManager || null;
    let managerValue = 'CEO';

    if (orgHasEmployees) {
        if (!managerId) {
            throw Object.assign(
                new Error('Manager is required. Select a reporting manager to complete hire.'),
                { status: 400, code: 'MANAGER_REQUIRED' }
            );
        }
        const managerEmployee = await Employee.findOne({
            _id: managerId,
            organizationId,
            status: 'active',
        }).select('_id name lastName employeeId').lean();
        if (!managerEmployee) {
            throw Object.assign(new Error('Selected manager not found'), { status: 400, code: 'MANAGER_NOT_FOUND' });
        }
        managerId = managerEmployee._id;
        managerValue = `${managerEmployee.name || ''} ${managerEmployee.lastName || ''}`.trim();
    } else {
        managerId = null;
        managerValue = 'CEO';
    }

    let systemRole = hirePayload.systemRole;
    if (!systemRole || !ALL_SYSTEM_ROLE_IDS.includes(systemRole)) {
        systemRole = inferSystemRoleFromWorkInfo({ department, jobTitle, position }).systemRoleId;
    }

    const employeePassword = hirePayload.password || generateSecurePassword(16);
    const employeeId = await generateEmployeeId(organizationId, name);

    const employee = new Employee({
        organizationId,
        name,
        lastName,
        email,
        password: employeePassword,
        position,
        department,
        manager: managerValue,
        managerId,
        jobTitle,
        jobCategory,
        salary,
        role: 'employee',
        mustResetPassword: !hirePayload.password,
        hasCompletedFirstLogin: false,
        employeeId,
        status: 'active',
        active: true,
        joiningDate,
        phone1: hirePayload.phone || candidate.phone || undefined,
        ...(hirePayload.salaryStructureId
            ? { salaryStructure: hirePayload.salaryStructureId }
            : {}),
    });

    applySystemRoleToEmployee(employee, systemRole);
    await employee.save();

    try {
        await syncLinkedUserForSystemRole({
            employee,
            systemRoleId: systemRole,
            plaintextPassword: employeePassword,
            organizationId,
        });
    } catch (userErr) {
        logger.warn('Hire: linked user sync failed', { employeeId: employee._id, error: userErr.message });
    }

    try {
        await invalidateEmployeesCache(organizationId);
    } catch { /* non-fatal */ }

    // Always start onboarding from recruitment hire (module may throw if disabled)
    let onboarding = null;
    let onboardingError = null;
    try {
        onboarding = await createEmployeeOnboardingWorkflow({
            employee,
            organizationId,
            assignedHR: hirePayload.assignedHR || actorId || null,
            assignedManager: managerId,
            initiatedBy: actorId,
            joiningDate,
            welcomeMessage: hirePayload.welcomeMessage || `Welcome aboard, ${name}!`,
        });
    } catch (obErr) {
        onboardingError = obErr.message;
        logger.warn('Hire: onboarding workflow failed', { employeeId: employee._id, error: obErr.message });
    }

    try {
        await queueWelcomeEmail(email, `${name} ${lastName}`, employeePassword);
    } catch (mailErr) {
        logger.warn('Hire: welcome email queue failed', { email, error: mailErr.message });
    }

    try {
        await notify({
            type: 'new_employee_joined',
            organizationId,
            data: { employee },
        });
    } catch { /* non-fatal */ }

    // Mark ATS hired + link
    if (candidate.stage !== 'Hired') {
        await markHired(candidate, actorId);
    }
    candidate.linkedEmployeeId = employee._id;
    candidate.joiningStatus = 'Confirmed';
    if (joiningDate) candidate.expectedJoiningDate = joiningDate;
    candidate.notes.push({
        note: `Converted to employee ${employee.employeeId}${onboarding ? ` · Onboarding ${onboarding._id}` : ''}`,
        addedBy: actorId,
        addedAt: new Date(),
    });
    await candidate.save();

    // Sync Workforce Planning hiring fill from the linked recruitment job (already incremented by markHired).
    // Do not call syncWorkforceFillOnEmployeeJoin here — that would double-count Recruitment.filledPositions.
    try {
        const { WorkforcePlan } = await import('../models/workforce.model.js');
        const { getLiveHeadcount } = await import('../helpers/workforceHeadcountHelper.js');
        const jobId = candidate.jobPostingId;
        if (jobId) {
            const job = await Recruitment.findById(jobId).select('filledPositions numberOfPositions').lean();
            const plans = await WorkforcePlan.find({
                organizationId,
                status: { $in: ['Draft', 'Approved', 'In Progress', 'Pending Approval'] },
                'hiringPlan.recruitmentJobId': jobId,
            });
            for (const plan of plans) {
                let changed = false;
                for (const hiring of plan.hiringPlan || []) {
                    if (String(hiring.recruitmentJobId) !== String(jobId)) continue;
                    hiring.filledPositions = Number(job?.filledPositions) || 0;
                    const required = Number(hiring.numberOfPositions) || 0;
                    if (hiring.status === 'Planned') hiring.status = 'In Progress';
                    if (required > 0 && hiring.filledPositions >= required && hiring.status !== 'Cancelled') {
                        hiring.status = 'Filled';
                    }
                    changed = true;
                }
                if (changed) {
                    plan.currentHeadcount = await getLiveHeadcount(organizationId, {
                        department: plan.department || undefined,
                        jobTitle: plan.jobTitle || undefined,
                    });
                    await plan.save();
                }
            }
        } else {
            const { syncWorkforceFillOnEmployeeJoin } = await import('../helpers/workforceHeadcountHelper.js');
            await syncWorkforceFillOnEmployeeJoin(employee);
        }
    } catch (wfErr) {
        logger.warn('Hire: workforce fill sync failed', { employeeId: employee._id, error: wfErr.message });
    }

    return {
        alreadyConverted: false,
        employee: {
            _id: employee._id,
            employeeId: employee.employeeId,
            name: employee.name,
            lastName: employee.lastName,
            email: employee.email,
            department: employee.department,
            jobTitle: employee.jobTitle,
            position: employee.position,
            managerId: employee.managerId,
            salary: employee.salary,
            systemRole,
            joiningDate: employee.joiningDate,
        },
        candidate,
        onboarding: onboarding
            ? { _id: onboarding._id, status: onboarding.status }
            : null,
        onboardingError,
        temporaryPassword: hirePayload.password ? null : employeePassword,
        mustResetPassword: !hirePayload.password,
    };
}

export function suggestHireDefaults(candidate, job) {
    return {
        name: candidate.firstName || '',
        lastName: candidate.lastName || '',
        email: candidate.email || '',
        phone: candidate.phone || '',
        salary: candidate.offerDetails?.salary || job?.salaryRange?.max || '',
        department: pickClosest(job?.department, EMPLOYEE_DEPARTMENTS, 'Engineering'),
        jobTitle: pickClosest(job?.jobTitle || job?.position, EMPLOYEE_JOB_TITLES, 'Software Engineer'),
        position: pickClosest(job?.position, EMPLOYEE_POSITIONS, 'Junior'),
        jobCategory: 'Information Technology',
        joiningDate: candidate.expectedJoiningDate || candidate.offerDetails?.startDate || null,
        managerId: job?.hiringManager?._id || job?.hiringManager || '',
    };
}
