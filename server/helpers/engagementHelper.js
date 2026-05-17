import Employee from '../models/employee.model.js';
import { getEffectiveFunctionalRoles } from '../middlewares/createAuthMiddleware.js';

export const getRequestActorId = (req) => req.employee?._id || req.user?._id || null;

export const isEngagementManager = (req, employeeDoc = null) => {
    if (req.user?.role === 'admin') return true;

    const emp = employeeDoc || req.employee;
    if (!emp) return false;

    const roles = getEffectiveFunctionalRoles(emp);
    if (roles.includes('hr') || roles.includes('executive')) return true;

    const role = String(emp.role || '').toLowerCase();
    if (role === 'executive') return true;

    const department = String(emp.department || '').toLowerCase();
    const position = String(emp.position || '').toLowerCase();
    const jobTitle = String(emp.jobTitle || '').toLowerCase();

    return (
        department.includes('hr') ||
        department.includes('human resource') ||
        jobTitle.includes('hr') ||
        position.includes('hr manager') ||
        (position.includes('hr') && position.includes('manager'))
    );
};

export const loadRequestEmployee = async (req) => {
    const id = getRequestActorId(req);
    if (!id) return null;

    const needsFetch =
        !req.employee?._id ||
        req.employee.department === undefined ||
        (req.employee.assignedRole === undefined && req.user?.role !== 'admin');

    if (!needsFetch && req.employee) {
        return { ...req.employee, _id: req.employee._id || id };
    }

    const doc = await Employee.findById(id)
        .select('department assignedRole functionalRoles position jobTitle role name lastName')
        .populate('assignedRole', '_id')
        .lean();

    return doc ? { ...doc, _id: doc._id || id } : null;
};

export const surveyMatchesEmployee = (survey, employee) => {
    if (!survey || !employee) return false;

    const audience = survey.targetAudience || 'All Employees';
    if (audience === 'All Employees') return true;

    if (audience === 'Department') {
        const deps = survey.targetDepartments || [];
        if (deps.length === 0) return true;
        return deps.includes(employee.department);
    }

    if (audience === 'Role') {
        const roles = survey.targetRoles || [];
        if (roles.length === 0) return true;
        const assigned = employee.assignedRole?._id || employee.assignedRole;
        return roles.some((r) => String(r) === String(assigned));
    }

    if (audience === 'Specific Employees') {
        const targets = survey.targetEmployees || [];
        if (targets.length === 0) return true;
        return targets.some((t) => String(t) === String(employee._id));
    }

    return true;
};

export const isSurveyActiveForResponse = (survey) => {
    if (!survey || survey.status !== 'Active') return false;
    const now = new Date();
    if (survey.startDate && new Date(survey.startDate) > now) return false;
    if (survey.endDate && new Date(survey.endDate) < now) return false;
    return true;
};

export const filterSurveysForEmployee = (surveys, employee) => {
    if (!Array.isArray(surveys)) return [];
    return surveys.filter(
        (s) => s.status === 'Active' && surveyMatchesEmployee(s, employee)
    );
};
