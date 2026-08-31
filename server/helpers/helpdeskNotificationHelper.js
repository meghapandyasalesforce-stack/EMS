import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import { PLATFORM_ROLES } from '../config/identity.constants.js';
import { resolveAuthContext } from './permissionService.js';
import { normalizeLifecycleRecipientIds } from './lifecycleNotificationRecipients.js';

const toId = (value) => value?._id?.toString?.() || value?.toString?.() || null;

const escapeRegex = (value) =>
    String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const resolveReportingManager = async (employee, organizationId) => {
    if (!employee) return null;

    if (employee.managerId) {
        const manager = await Employee.findOne({
            _id: employee.managerId,
            organizationId,
            status: 'active'
        })
            .select('_id')
            .lean();
        if (manager?._id) return manager._id.toString();
    }

    const managerName = String(employee.manager || '').trim();
    if (!managerName || managerName.toLowerCase() === 'ceo') return null;

    const namePattern = new RegExp(`^${escapeRegex(managerName)}(?:\\s|$)`, 'i');
    const manager = await Employee.findOne({
        organizationId,
        status: 'active',
        $or: [
            { name: namePattern },
            {
                $expr: {
                    $regexMatch: {
                        input: {
                            $trim: {
                                input: {
                                    $concat: [
                                        { $ifNull: ['$name', ''] },
                                        ' ',
                                        { $ifNull: ['$lastName', ''] }
                                    ]
                                }
                            }
                        },
                        regex: `^${escapeRegex(managerName)}$`,
                        options: 'i'
                    }
                }
            }
        ]
    })
        .select('_id')
        .lean();

    return toId(manager);
};

const getAdminRecipients = async (organizationId) => {
    const admins = await User.find({
        organizationId,
        isActive: true,
        $or: [
            { roles: PLATFORM_ROLES.ORG_OWNER },
            { role: 'admin', roles: { $size: 0 } },
            { role: 'admin', roles: { $exists: false } }
        ]
    })
        .select('_id')
        .lean();

    return admins.map(toId).filter(Boolean);
};

const getHrManagerRecipients = async (organizationId) => {
    const [users, employees] = await Promise.all([
        User.find({
            organizationId,
            isActive: true,
            roles: {
                $all: [PLATFORM_ROLES.HR_ADMIN],
                $nin: [PLATFORM_ROLES.ORG_OWNER]
            }
        })
            .select('_id')
            .lean(),
        Employee.find({
            organizationId,
            status: 'active',
            jobTitle: /^\s*HR Manager\s*$/i
        })
            .select('_id')
            .lean()
    ]);

    return [...users, ...employees].map(toId).filter(Boolean);
};

const getHrExecutiveRecipients = async (organizationId) => {
    const [users, employees] = await Promise.all([
        User.find({
            organizationId,
            isActive: true,
            roles: {
                $all: [PLATFORM_ROLES.HR_EXECUTIVE],
                $nin: [PLATFORM_ROLES.ORG_OWNER, PLATFORM_ROLES.HR_ADMIN]
            }
        })
            .select('_id')
            .lean(),
        Employee.find({
            organizationId,
            status: 'active',
            functionalRoles: { $in: ['hr', 'HR'] },
            jobTitle: { $not: /manager/i }
        })
            .select('_id')
            .lean()
    ]);

    return [...users, ...employees].map(toId).filter(Boolean);
};

const getFunctionalManagerRecipients = async (employee, organizationId) => {
    const department = String(employee?.department || '').trim();
    if (!department) return [];

    const managers = await Employee.find({
        organizationId,
        status: 'active',
        department: new RegExp(`^${escapeRegex(department)}$`, 'i'),
        functionalRoles: { $in: ['manager'] }
    })
        .select('_id')
        .lean();

    return managers.map(toId).filter(Boolean);
};

const classifyCreator = (req, authContext) => {
    if (authContext?.isOrgOwner) return 'admin';
    if (authContext?.isHrManager) return 'hr_manager';
    if (authContext?.isHrExecutive) return 'hr_executive';
    if (req.decoded?.role === 'admin') return 'admin';
    if (authContext?.isLineManager) return 'functional_manager';
    return 'employee';
};

export const getHelpdeskTicketNotificationRecipients = async (req, organizationId) => {
    const authContext =
        req.authContext || await resolveAuthContext(req.decoded, req);
    req.authContext = authContext;

    const creatorType = classifyCreator(req, authContext);
    if (creatorType === 'admin') return [];

    const employee = req.employee || authContext?.employee || null;
    const include = {
        admins: true,
        hrManagers: creatorType !== 'hr_manager',
        hrExecutives: ['employee', 'functional_manager'].includes(creatorType),
        reportingManager: ['employee', 'functional_manager'].includes(creatorType),
        functionalManagers: creatorType === 'employee'
    };

    const [admins, hrManagers, hrExecutives, reportingManager, functionalManagers] =
        await Promise.all([
            include.admins ? getAdminRecipients(organizationId) : [],
            include.hrManagers ? getHrManagerRecipients(organizationId) : [],
            include.hrExecutives ? getHrExecutiveRecipients(organizationId) : [],
            include.reportingManager
                ? resolveReportingManager(employee, organizationId)
                : null,
            include.functionalManagers
                ? getFunctionalManagerRecipients(employee, organizationId)
                : []
        ]);

    const recipients = await normalizeLifecycleRecipientIds(
        [
            ...admins,
            ...hrManagers,
            ...hrExecutives,
            reportingManager,
            ...functionalManagers
        ].filter(Boolean),
        organizationId
    );

    const creatorIds = await normalizeLifecycleRecipientIds(
        [
            req.employee?._id,
            req.employee?.userId,
            req.user?._id,
            authContext?.employee?._id,
            authContext?.employee?.userId,
            authContext?.user?._id
        ].filter(Boolean),
        organizationId
    );
    const excluded = new Set(creatorIds.map(String));

    return recipients.filter((recipientId) => !excluded.has(String(recipientId)));
};

export default getHelpdeskTicketNotificationRecipients;
