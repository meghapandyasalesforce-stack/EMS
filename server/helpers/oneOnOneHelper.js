/**
 * One-on-one meeting helpers: identity, permissions, notifications, formatting.
 */

import Employee from '../models/employee.model.js';
import { calculateFunctionalRoles } from './roleHelper.js';
import { sendNotification } from './notificationService.js';
import logger from './logger.js';

export const ACTIVE_MEETING_STATUSES = [
    'Pending',
    'Accepted',
    'Reschedule Requested',
    'Rescheduled',
    'Scheduled' // legacy
];

export const RESPONSE_ELIGIBLE_STATUSES = [
    'Pending',
    'Rescheduled',
    'Scheduled'
];

export const RESCHEDULE_ELIGIBLE_STATUSES = [
    'Pending',
    'Accepted',
    'Reschedule Requested',
    'Rescheduled',
    'Scheduled'
];

export const COMPLETE_ELIGIBLE_STATUSES = [
    'Accepted',
    'Rescheduled',
    'Scheduled',
    'Pending'
];

export const CANCEL_ELIGIBLE_STATUSES = [
    'Pending',
    'Accepted',
    'Reschedule Requested',
    'Rescheduled',
    'Scheduled'
];

export const displayName = (person) => {
    if (!person) return 'Someone';
    return `${person.name || ''} ${person.lastName || ''}`.trim() || person.email || 'Someone';
};

export const formatMeetingWhen = (meeting) => {
    const date = meeting?.scheduledDate ? new Date(meeting.scheduledDate) : null;
    const formattedDate = date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'TBD';
    const time = meeting?.scheduledTime || 'TBD';
    return { formattedDate, time, label: `${formattedDate} at ${time}` };
};

export const getActorEmployeeId = (req) => {
    if (req.employee?._id) return req.employee._id;
    // Admin User may also have a linked employee profile on the token
    return req.user?.employeeProfileId || req.user?.employeeId || null;
};

export const idsEqual = (a, b) => {
    if (a == null || b == null) return false;
    return String(a._id || a) === String(b._id || b);
};

export const getParticipantIds = (meeting) => ([
    meeting.managerId?._id || meeting.managerId,
    meeting.employeeId?._id || meeting.employeeId
].filter(Boolean).map(String));

export const isParticipant = (meeting, employeeId) => {
    if (!employeeId) return false;
    return getParticipantIds(meeting).includes(String(employeeId));
};

export const isOrganizer = (meeting, employeeId) => {
    if (!employeeId) return false;
    return idsEqual(meeting.managerId, employeeId);
};

export const isInvitee = (meeting, employeeId) => {
    if (!employeeId) return false;
    return idsEqual(meeting.employeeId, employeeId);
};

export const resolveEmployeeRoles = async (employeeDoc, organizationId) => {
    if (!employeeDoc) return { isManager: false, isHR: false, roles: [] };
    const stored = Array.isArray(employeeDoc.functionalRoles) ? employeeDoc.functionalRoles : [];
    const roles = stored.length > 0 ? stored : calculateFunctionalRoles(employeeDoc || {});
    return {
        isManager: roles.includes('manager'),
        isHR: roles.includes('hr'),
        roles
    };
};

export const loadEmployeeWithRoles = async (employeeId, organizationId) => {
    const emp = await Employee.findOne({ _id: employeeId, organizationId })
        .select('name lastName email functionalRoles department position jobTitle status managerId userId')
        .lean();
    if (!emp) return null;
    const roleInfo = await resolveEmployeeRoles(emp, organizationId);
    return { ...emp, ...roleInfo };
};

export const isEmployeeManagerLike = (emp) => {
    if (!emp) return false;
    if (emp.isManager) return true;
    const roles = Array.isArray(emp.functionalRoles) ? emp.functionalRoles : [];
    if (roles.includes('manager')) return true;
    const position = String(emp.position || '').toLowerCase();
    const jobTitle = String(emp.jobTitle || '').toLowerCase();
    return (
        position.includes('manager') ||
        position.includes('director') ||
        jobTitle.includes('manager') ||
        jobTitle.includes('director')
    );
};

export const buildDeepLink = (meetingId) => (
    meetingId ? `/one-on-one?meetingId=${meetingId}` : '/one-on-one'
);

/**
 * Notify one or more employees with a deep link to the meeting.
 */
export const notifyMeetingParticipants = async ({
    recipientIds,
    sender,
    message,
    organizationId,
    meetingId,
    extraMetadata = {}
}) => {
    const uniqueIds = [...new Set(
        (recipientIds || [])
            .filter(Boolean)
            .map((id) => String(id._id || id))
    )];

    const senderId = sender?._id || sender;
    const senderType = sender?.constructor?.modelName === 'User' ? 'User' : 'Employee';
    const metadata = {
        ...extraMetadata,
        oneOnOneId: meetingId,
        type: 'one_on_one',
        url: buildDeepLink(meetingId),
        organizationId
    };

    for (const recipientId of uniqueIds) {
        if (senderId && String(recipientId) === String(senderId)) continue;
        try {
            await sendNotification({
                userId: recipientId,
                message,
                type: 'general',
                metadata,
                organizationId,
                senderId,
                senderType
            });
        } catch (err) {
            logger.error('Failed to send one-on-one notification', {
                error: err.message,
                recipientId,
                meetingId
            });
        }
    }
};

export const otherParticipantId = (meeting, actorId) => {
    const managerId = meeting.managerId?._id || meeting.managerId;
    const employeeId = meeting.employeeId?._id || meeting.employeeId;
    if (idsEqual(managerId, actorId)) return employeeId;
    if (idsEqual(employeeId, actorId)) return managerId;
    return null;
};

/** Normalize legacy Scheduled → Active bucket for UI filters. */
export const isUpcomingStatus = (status) => ACTIVE_MEETING_STATUSES.includes(status);

export const populateMeeting = async (meeting) => {
    if (!meeting) return meeting;
    await meeting.populate('managerId', 'name lastName email position jobTitle functionalRoles');
    await meeting.populate('employeeId', 'name lastName email position jobTitle functionalRoles');
    await meeting.populate('meetingNotes.authorId', 'name lastName');
    await meeting.populate('response.respondedBy', 'name lastName');
    await meeting.populate('rescheduleProposal.proposedBy', 'name lastName');
    return meeting;
};
