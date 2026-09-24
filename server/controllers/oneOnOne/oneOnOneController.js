import { OneOnOne } from '../../models/oneOnOne.model.js';
import Employee from '../../models/employee.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import { sendNotificationToUsers } from '../../helpers/notificationService.js';
import { getManagerEmployeeIds } from '../../helpers/managerHelper.js';
import { calculateFunctionalRoles } from '../../helpers/roleHelper.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../middlewares/asyncHandler.js';

const uniqueIds = (ids = []) =>
    [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || '').trim()).filter(Boolean))];

const isHrRequester = (req, effectiveRoles = []) =>
    Boolean(
        req.authContext?.isHrManager ||
        req.authContext?.isHrExecutive ||
        req.authContext?.isOrgOwner ||
        effectiveRoles.includes('hr')
    );

const idStr = (value) => String(value?._id || value || '');

const pushHistory = (meeting, { status, action, actorId, note }) => {
    if (!Array.isArray(meeting.statusHistory)) meeting.statusHistory = [];
    meeting.statusHistory.unshift({
        status,
        action,
        actorId: actorId || undefined,
        note: note || '',
        at: new Date()
    });
    meeting.statusHistory = meeting.statusHistory.slice(0, 40);
};

const formatMeetingWhen = (scheduledDate, scheduledTime) => {
    const date = new Date(scheduledDate);
    const formattedDate = Number.isNaN(date.getTime())
        ? 'the scheduled date'
        : date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    return { formattedDate, formattedTime: scheduledTime || 'TBD' };
};

/** Resolve Employee ids → User ids when linked (notifications expect User recipients). */
const resolveNotificationRecipientIds = async (employeeIds = []) => {
    const ids = uniqueIds(employeeIds);
    if (ids.length === 0) return [];

    const employees = await Employee.find({ _id: { $in: ids } })
        .select('_id userId')
        .lean();

    return uniqueIds(
        employees.map((emp) => emp.userId || emp._id)
    );
};

const notifyPeople = async ({ recipientEmployeeIds, actor, message, meeting, action, forInvitee = false }) => {
    try {
        const recipients = await resolveNotificationRecipientIds(recipientEmployeeIds);
        if (recipients.length === 0) return;

        const organizationId =
            actor?.organizationId ||
            meeting?.organizationId ||
            undefined;

        const meetingId = meeting?._id;
        const link = forInvitee
            ? `/1-on-1?meetingId=${meetingId}`
            : `/one-on-one?meetingId=${meetingId}`;

        await sendNotificationToUsers(
            recipients,
            { ...(actor?.toObject?.() || actor || {}), organizationId },
            message,
            'general',
            {
                oneOnOneId: meetingId,
                type: 'one_on_one',
                action: action || 'update',
                status: meeting?.status,
                scheduledDate: meeting?.scheduledDate,
                scheduledTime: meeting?.scheduledTime,
                link,
                organizationId
            }
        );
    } catch (error) {
        logger.error('One-on-one notification failed', {
            error: error.message,
            meetingId: meeting?._id,
            action
        });
    }
};

const populateMeeting = async (meeting) => {
    await meeting.populate('employeeId', 'name lastName email jobTitle position');
    await meeting.populate('managerId', 'name lastName email jobTitle position');
    await meeting.populate('meetingNotes.author', 'name lastName');
    return meeting;
};

const personLabel = (person, fallback = 'Someone') => {
    if (!person) return fallback;
    const name = `${person.name || ''} ${person.lastName || ''}`.trim();
    return name || fallback;
};

const getActorEmployeeId = (req) =>
    req.employee?._id ||
    req.authContext?.employee?._id ||
    req.user?.employeeProfileId ||
    req.employeeProfileId ||
    null;

const viewerRoleForMeeting = (meeting, actorId) => {
    if (!actorId) return 'neither';
    if (idStr(meeting.employeeId) === idStr(actorId)) return 'invitee';
    if (idStr(meeting.managerId) === idStr(actorId)) return 'organizer';
    return 'neither';
};

const withViewerRole = (meetingDoc, actorId) => {
    const obj = typeof meetingDoc.toObject === 'function' ? meetingDoc.toObject() : { ...meetingDoc };
    obj.myRole = viewerRoleForMeeting(obj, actorId);
    // Never expose legacy auto-generated Jitsi placeholders
    if (isLegacyAutoMeetingLink(obj.meetingLink)) {
        obj.meetingLink = '';
    }
    return obj;
};

/** Legacy auto Jitsi links from older builds — treat as empty. */
const isLegacyAutoMeetingLink = (link) => {
    const value = String(link || '').trim().toLowerCase();
    if (!value) return false;
    return value.includes('meet.jit.si/ems-1on1-') || value.includes('jit.si/ems-1on1-');
};

const sanitizeMeetingLinkInput = (link) => {
    const value = String(link || '').trim();
    if (!value || isLegacyAutoMeetingLink(value)) return '';
    return value;
};

/** Clear legacy placeholder links from DB (org-scoped). Safe to call on list. */
const purgeLegacyMeetingLinks = async (organizationId) => {
    if (!organizationId) return;
    try {
        await OneOnOne.updateMany(
            {
                organizationId,
                meetingLink: { $regex: /meet\.jit\.si\/ems-1on1-|jit\.si\/ems-1on1-/i }
            },
            { $set: { meetingLink: '' } }
        );
    } catch {
        // non-fatal — responses still strip the link
    }
};

const isStrictParticipant = (meeting, actorId) => {
    if (!actorId) return false;
    return (
        idStr(meeting.managerId) === idStr(actorId) ||
        idStr(meeting.employeeId) === idStr(actorId)
    );
};

/** Notes are restricted to the two meeting participants only (not org-wide HR). */
const assertNotesParticipant = (meeting, req, res) => {
    const actorId = getActorEmployeeId(req);
    if (!isStrictParticipant(meeting, actorId)) {
        res.status(403).json({
            success: false,
            message: 'Only meeting participants can access notes for this meeting'
        });
        return false;
    }
    return true;
};

const stripNotesIfNotParticipant = (meetingDoc, actorId) => {
    const obj = typeof meetingDoc.toObject === 'function' ? meetingDoc.toObject() : { ...meetingDoc };
    if (!isStrictParticipant(obj, actorId)) {
        delete obj.meetingNotes;
        delete obj.managerNotes;
        delete obj.employeeNotes;
    }
    return obj;
};

const loadMeetingOr404 = async (req, res) => {
    const organizationId = getOrganizationId(req);
    if (!organizationId) {
        res.status(401).json({
            success: false,
            message: 'Session missing organization context. Please log in again.',
            code: 'MISSING_ORGANIZATION_ID'
        });
        return null;
    }

    const meeting = await OneOnOne.findOne({ _id: req.params.id, organizationId });
    if (!meeting) {
        res.status(404).json({
            success: false,
            message: 'One-on-one meeting not found'
        });
        return null;
    }
    return meeting;
};

const assertInvitee = (meeting, req, res) => {
    const actorId = getActorEmployeeId(req);
    if (actorId && idStr(meeting.employeeId) === idStr(actorId)) {
        return true;
    }
    const isOrganizer = actorId && idStr(meeting.managerId) === idStr(actorId);
    res.status(403).json({
        success: false,
        message: isOrganizer
            ? 'You organized this meeting — only the invitee can accept or decline'
            : 'Only the invitee can perform this action'
    });
    return false;
};

const assertOrganizerOrHr = (meeting, req, res) => {
    const actorId = getActorEmployeeId(req);
    const isAdmin = Boolean(req.user || req.authContext?.isOrgOwner);
    const isHr = isHrRequester(req, []);
    const isOrganizer = actorId && idStr(meeting.managerId) === idStr(actorId);
    if (!isAdmin && !isHr && !isOrganizer) {
        res.status(403).json({
            success: false,
            message: 'Only the meeting organizer or HR can perform this action'
        });
        return false;
    }
    return true;
};

const assertParticipant = (meeting, req, res) => {
    const actorId = getActorEmployeeId(req);
    const isAdmin = Boolean(req.user || req.authContext?.isOrgOwner);
    const isHr = isHrRequester(req, []);
    const isOrganizer = actorId && idStr(meeting.managerId) === idStr(actorId);
    const isInvitee = actorId && idStr(meeting.employeeId) === idStr(actorId);
    if (!isAdmin && !isHr && !isOrganizer && !isInvitee) {
        res.status(403).json({
            success: false,
            message: 'You are not a participant of this meeting'
        });
        return false;
    }
    return true;
};

/**
 * Create one-on-one meeting(s).
 * Status starts as Pending Response until invitee accepts.
 */
export const createOneOnOne = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const organizerId = req.employee?._id || req.user?._id;

    if (!organizerId) {
        return res.status(401).json({
            success: false,
            message: 'Unable to identify meeting organizer'
        });
    }

    if (!req.employee?._id) {
        return res.status(400).json({
            success: false,
            message: 'An employee profile is required to schedule one-on-one meetings'
        });
    }

    const employeeIds = uniqueIds(
        Array.isArray(req.body.employeeIds) && req.body.employeeIds.length > 0
            ? req.body.employeeIds
            : req.body.employeeId
                ? [req.body.employeeId]
                : []
    );

    if (employeeIds.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'At least one employee is required'
        });
    }

    if (!req.body.scheduledDate) {
        return res.status(400).json({
            success: false,
            message: 'Scheduled date is required'
        });
    }

    const currentEmployee = await Employee.findOne({ _id: organizerId, organizationId })
        .select('name lastName functionalRoles department position jobTitle')
        .lean();

    const storedRoles = Array.isArray(currentEmployee?.functionalRoles)
        ? currentEmployee.functionalRoles
        : [];
    const effectiveRoles = storedRoles.length > 0
        ? storedRoles
        : calculateFunctionalRoles(currentEmployee || {});

    const isAdmin = Boolean(req.user || req.authContext?.isOrgOwner);
    const canInviteAnyone = isAdmin || isHrRequester(req, effectiveRoles);

    if (employeeIds.some((id) => id === idStr(organizerId))) {
        return res.status(400).json({
            success: false,
            message: 'You cannot schedule a one-on-one with yourself'
        });
    }

    const validEmployees = await Employee.find({
        _id: { $in: employeeIds },
        organizationId
    })
        .select('_id name lastName')
        .lean();

    if (validEmployees.length !== employeeIds.length) {
        return res.status(400).json({
            success: false,
            message: 'One or more selected employees were not found in your organization'
        });
    }

    const {
        employeeId: _single,
        employeeIds: _many,
        status: _ignoreStatus,
        ...meetingFields
    } = req.body;

    if (Object.prototype.hasOwnProperty.call(meetingFields, 'meetingLink')) {
        meetingFields.meetingLink = sanitizeMeetingLinkInput(meetingFields.meetingLink);
    }

    const created = [];
    for (const empId of employeeIds) {
        const oneOnOne = new OneOnOne({
            ...meetingFields,
            organizationId,
            managerId: organizerId,
            employeeId: empId,
            status: 'Pending Response',
            inviteeResponse: { status: 'pending' },
            rescheduleProposal: { status: 'none' },
            statusHistory: []
        });
        pushHistory(oneOnOne, {
            status: 'Pending Response',
            action: 'created',
            actorId: organizerId,
            note: 'Meeting invitation sent'
        });
        await oneOnOne.save();
        await populateMeeting(oneOnOne);
        created.push(oneOnOne);
    }

    const organizer = created[0]?.managerId;
    const organizerLabel = personLabel(organizer, canInviteAnyone ? 'HR' : 'Your Manager');
    const { formattedDate, formattedTime } = formatMeetingWhen(
        created[0].scheduledDate,
        created[0].scheduledTime
    );

    await Promise.all(
        created.map((meeting) =>
            notifyPeople({
                recipientEmployeeIds: [meeting.employeeId?._id || meeting.employeeId],
                actor: req.employee || req.user,
                message: `${organizerLabel} invited you to a one-on-one on ${formattedDate} at ${formattedTime}. Please respond.`,
                meeting,
                action: 'invite',
                forInvitee: true
            })
        )
    );

    const multi = created.length > 1;
    res.status(201).json({
        success: true,
        message: multi
            ? `${created.length} one-on-one invitations sent`
            : 'One-on-one invitation sent',
        data: multi ? created : created[0]
    });
});

/**
 * Employees the current user may invite to a 1:1.
 * Uses schedule auth (manager team / HR-all) — does NOT require EMPLOYEE_VIEW_* permissions.
 */
export const getEligibleInvitees = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    if (!organizationId) {
        return res.status(401).json({
            success: false,
            message: 'Session missing organization context. Please log in again.',
            code: 'MISSING_ORGANIZATION_ID'
        });
    }

    const organizerId = req.employee?._id;
    if (!organizerId) {
        return res.status(400).json({
            success: false,
            message: 'An employee profile is required to schedule one-on-one meetings'
        });
    }

    const currentEmployee = await Employee.findOne({ _id: organizerId, organizationId })
        .select('name lastName functionalRoles department position jobTitle')
        .lean();

    if (!currentEmployee) {
        return res.status(404).json({
            success: false,
            message: 'Employee profile not found'
        });
    }

    const selfId = String(organizerId);
    // Any employee may invite any other active employee in the org
    let employees = await Employee.find({
        organizationId,
        status: { $ne: 'terminated' },
        isOrgOwnerRoot: { $ne: true }
    })
        .select('_id name lastName email jobTitle position department')
        .sort({ name: 1 })
        .limit(500)
        .lean();

    employees = employees.filter((emp) => String(emp._id) !== selfId);

    res.json({
        success: true,
        data: employees
    });
});

/**
 * Get one-on-one meetings (single source of truth for both organizer & invitee views)
 */
export const getOneOnOnes = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    if (!organizationId) {
        return res.status(401).json({
            success: false,
            message: 'Session missing organization context. Please log in again.',
            code: 'MISSING_ORGANIZATION_ID'
        });
    }

    const { managerId, employeeId, status, startDate, endDate } = req.query;
    const currentUserId = req.employee?._id || req.user?._id;

    // Remove legacy auto-generated Jitsi URLs stored on older meetings
    await purgeLegacyMeetingLinks(organizationId);

    const query = addOrganizationFilter(req, {});

    if (currentUserId && !req.user) {
        const currentEmployee = await Employee.findOne({
            _id: currentUserId,
            organizationId
        })
            .select('name lastName functionalRoles department position jobTitle')
            .lean();

        const storedRoles = Array.isArray(currentEmployee?.functionalRoles)
            ? currentEmployee.functionalRoles
            : [];
        const effectiveRoles = storedRoles.length > 0
            ? storedRoles
            : calculateFunctionalRoles(currentEmployee || {});
        const isManager = effectiveRoles.includes('manager');
        const isHR = isHrRequester(req, effectiveRoles);

        if (isHR || req.authContext?.isOrgOwner) {
            // org-wide
        } else if (isManager) {
            const managerEmployeeIds = await getManagerEmployeeIds(Employee, organizationId, {
                ...currentEmployee,
                _id: currentUserId
            });
            query.$or = [
                { managerId: currentUserId },
                { employeeId: currentUserId },
                { employeeId: { $in: managerEmployeeIds } }
            ];
        } else {
            // Invitee view + any they somehow organize
            query.$or = [
                { employeeId: currentUserId },
                { managerId: currentUserId }
            ];
        }
    }

    if (managerId) query.managerId = managerId;
    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;
    if (startDate || endDate) {
        query.scheduledDate = {};
        if (startDate) query.scheduledDate.$gte = new Date(startDate);
        if (endDate) query.scheduledDate.$lte = new Date(endDate);
    }

    const oneOnOnes = await OneOnOne.find(query)
        .populate('managerId', 'name lastName email jobTitle position')
        .populate('employeeId', 'name lastName email jobTitle position')
        .populate('meetingNotes.author', 'name lastName')
        .populate('goals.goalId')
        .sort({ scheduledDate: -1 });

    const actorId = getActorEmployeeId(req);
    res.json({
        success: true,
        data: oneOnOnes.map((m) => withViewerRole(stripNotesIfNotParticipant(m, actorId), actorId)),
        meta: {
            actorEmployeeId: actorId ? String(actorId) : null
        }
    });
});

/**
 * Get single meeting by id (for deep links)
 */
export const getOneOnOneById = asyncHandler(async (req, res) => {
    const meeting = await loadMeetingOr404(req, res);
    if (!meeting) return;
    if (!assertParticipant(meeting, req, res)) return;

    await populateMeeting(meeting);
    const actorId = getActorEmployeeId(req);
    res.json({
        success: true,
        data: withViewerRole(stripNotesIfNotParticipant(meeting, actorId), actorId)
    });
});

/**
 * Update one-on-one (organizer). Date/time changes re-require invitee confirmation.
 */
export const updateOneOnOne = asyncHandler(async (req, res) => {
    const meeting = await loadMeetingOr404(req, res);
    if (!meeting) return;
    if (!assertOrganizerOrHr(meeting, req, res)) return;

    if (['Completed', 'Cancelled', 'Declined'].includes(meeting.status)) {
        return res.status(400).json({
            success: false,
            message: `Cannot edit a meeting with status ${meeting.status}`
        });
    }

    const {
        employeeIds: _ignoreIds,
        employeeId: _ignoreEmp,
        status: _ignoreStatus,
        managerId: _ignoreMgr,
        organizationId: _ignoreOrg,
        inviteeResponse: _ignoreInv,
        rescheduleProposal: _ignoreProp,
        statusHistory: _ignoreHist,
        ...updateBody
    } = req.body || {};

    const prevDate = meeting.scheduledDate ? new Date(meeting.scheduledDate).toISOString() : '';
    const prevTime = meeting.scheduledTime || '';

    Object.assign(meeting, updateBody);
    if (Object.prototype.hasOwnProperty.call(updateBody, 'meetingLink')) {
        meeting.meetingLink = sanitizeMeetingLinkInput(updateBody.meetingLink);
    } else if (isLegacyAutoMeetingLink(meeting.meetingLink)) {
        meeting.meetingLink = '';
    }

    const nextDate = meeting.scheduledDate ? new Date(meeting.scheduledDate).toISOString() : '';
    const nextTime = meeting.scheduledTime || '';
    const scheduleChanged = prevDate !== nextDate || prevTime !== nextTime;

    if (scheduleChanged) {
        meeting.status = 'Pending Response';
        meeting.inviteeResponse = { status: 'pending' };
        meeting.rescheduleProposal = { status: 'none' };
        pushHistory(meeting, {
            status: 'Pending Response',
            action: 'rescheduled_by_organizer',
            actorId: getActorEmployeeId(req),
            note: 'Organizer changed date/time — awaiting invitee confirmation'
        });
    } else {
        pushHistory(meeting, {
            status: meeting.status,
            action: 'updated',
            actorId: getActorEmployeeId(req),
            note: 'Meeting details updated'
        });
    }

    await meeting.save();
    await populateMeeting(meeting);

    const { formattedDate, formattedTime } = formatMeetingWhen(
        meeting.scheduledDate,
        meeting.scheduledTime
    );
    const organizerLabel = personLabel(meeting.managerId, 'Organizer');

    await notifyPeople({
        recipientEmployeeIds: [meeting.employeeId?._id || meeting.employeeId],
        actor: req.employee || req.user,
        message: scheduleChanged
            ? `${organizerLabel} updated your one-on-one to ${formattedDate} at ${formattedTime}. Please confirm again.`
            : `${organizerLabel} updated details for your one-on-one on ${formattedDate}.`,
        meeting,
        action: scheduleChanged ? 'schedule_changed' : 'updated',
        forInvitee: true
    });

    res.json({
        success: true,
        message: scheduleChanged
            ? 'Meeting updated — invitee must confirm the new time'
            : 'One-on-one updated successfully',
        data: meeting
    });
});

/**
 * Invitee accepts invitation
 */
export const acceptOneOnOne = asyncHandler(async (req, res) => {
    const meeting = await loadMeetingOr404(req, res);
    if (!meeting) return;
    if (!assertInvitee(meeting, req, res)) return;

    if (!['Pending Response', 'Rescheduled'].includes(meeting.status)) {
        return res.status(400).json({
            success: false,
            message: `Only pending invitations can be accepted (current: ${meeting.status})`
        });
    }

    meeting.status = 'Scheduled';
    meeting.inviteeResponse = {
        status: 'accepted',
        respondedAt: new Date(),
        reason: ''
    };
    meeting.rescheduleProposal = { status: 'none' };
    pushHistory(meeting, {
        status: 'Scheduled',
        action: 'accepted',
        actorId: getActorEmployeeId(req),
        note: 'Invitee accepted'
    });
    await meeting.save();
    await populateMeeting(meeting);

    await notifyPeople({
        recipientEmployeeIds: [meeting.managerId?._id || meeting.managerId],
        actor: req.employee || req.user,
        message: `${personLabel(meeting.employeeId, 'Invitee')} accepted the one-on-one invitation.`,
        meeting,
        action: 'accepted'
    });

    res.json({
        success: true,
        message: 'Meeting accepted',
        data: withViewerRole(meeting, getActorEmployeeId(req))
    });
});

/**
 * Invitee declines invitation
 */
export const declineOneOnOne = asyncHandler(async (req, res) => {
    const meeting = await loadMeetingOr404(req, res);
    if (!meeting) return;
    if (!assertInvitee(meeting, req, res)) return;

    if (!['Pending Response', 'Scheduled', 'Rescheduled'].includes(meeting.status)) {
        return res.status(400).json({
            success: false,
            message: `This meeting cannot be declined (current: ${meeting.status})`
        });
    }

    const reason = String(req.body?.reason || '').trim();
    meeting.status = 'Declined';
    meeting.inviteeResponse = {
        status: 'declined',
        respondedAt: new Date(),
        reason
    };
    meeting.rescheduleProposal = { status: 'none' };
    pushHistory(meeting, {
        status: 'Declined',
        action: 'declined',
        actorId: getActorEmployeeId(req),
        note: reason || 'Invitee declined'
    });
    await meeting.save();
    await populateMeeting(meeting);

    await notifyPeople({
        recipientEmployeeIds: [meeting.managerId?._id || meeting.managerId],
        actor: req.employee || req.user,
        message: `${personLabel(meeting.employeeId, 'Invitee')} declined the one-on-one${reason ? `: ${reason}` : '.'}`,
        meeting,
        action: 'declined'
    });

    res.json({
        success: true,
        message: 'Meeting declined',
        data: withViewerRole(meeting, getActorEmployeeId(req))
    });
});

/**
 * Either party proposes a new time
 */
export const requestRescheduleOneOnOne = asyncHandler(async (req, res) => {
    const meeting = await loadMeetingOr404(req, res);
    if (!meeting) return;
    if (!assertParticipant(meeting, req, res)) return;

    if (['Completed', 'Cancelled', 'Declined'].includes(meeting.status)) {
        return res.status(400).json({
            success: false,
            message: `Cannot reschedule a meeting with status ${meeting.status}`
        });
    }

    const proposedDate = req.body?.proposedDate;
    const proposedTime = req.body?.proposedTime;
    const reason = String(req.body?.reason || '').trim();

    if (!proposedDate || !proposedTime) {
        return res.status(400).json({
            success: false,
            message: 'Proposed date and time are required'
        });
    }

    const actorId = getActorEmployeeId(req);
    const isInvitee = idStr(meeting.employeeId) === idStr(actorId);
    const role = isInvitee ? 'Invitee' : 'Organizer';

    meeting.rescheduleProposal = {
        proposedDate: new Date(proposedDate),
        proposedTime,
        reason,
        requestedBy: actorId,
        requestedByRole: role,
        status: 'pending',
        respondedAt: undefined,
        responseNote: ''
    };
    meeting.status = 'Rescheduled';
    pushHistory(meeting, {
        status: 'Rescheduled',
        action: 'reschedule_requested',
        actorId,
        note: reason || `${role} proposed a new time`
    });
    await meeting.save();
    await populateMeeting(meeting);

    const notifyTarget = isInvitee
        ? [meeting.managerId?._id || meeting.managerId]
        : [meeting.employeeId?._id || meeting.employeeId];
    const { formattedDate, formattedTime } = formatMeetingWhen(
        meeting.rescheduleProposal.proposedDate,
        meeting.rescheduleProposal.proposedTime
    );

    await notifyPeople({
        recipientEmployeeIds: notifyTarget,
        actor: req.employee || req.user,
        message: `${personLabel(isInvitee ? meeting.employeeId : meeting.managerId)} proposed a new time: ${formattedDate} at ${formattedTime}.`,
        meeting,
        action: 'reschedule_requested',
        forInvitee: !isInvitee
    });

    res.json({
        success: true,
        message: 'Reschedule proposal sent',
        data: meeting
    });
});

/**
 * Counterparty accepts / rejects / counters a reschedule proposal
 */
export const respondRescheduleOneOnOne = asyncHandler(async (req, res) => {
    const meeting = await loadMeetingOr404(req, res);
    if (!meeting) return;
    if (!assertParticipant(meeting, req, res)) return;

    const proposal = meeting.rescheduleProposal;
    if (!proposal || proposal.status !== 'pending') {
        return res.status(400).json({
            success: false,
            message: 'There is no pending reschedule proposal'
        });
    }

    const actorId = getActorEmployeeId(req);
    const requesterId = idStr(proposal.requestedBy);
    if (requesterId && requesterId === idStr(actorId)) {
        return res.status(400).json({
            success: false,
            message: 'The other participant must respond to your proposal'
        });
    }

    const action = String(req.body?.action || '').toLowerCase();
    if (!['accept', 'decline', 'counter'].includes(action)) {
        return res.status(400).json({
            success: false,
            message: 'action must be accept, decline, or counter'
        });
    }

    if (action === 'accept') {
        meeting.scheduledDate = proposal.proposedDate;
        meeting.scheduledTime = proposal.proposedTime;
        meeting.status = 'Scheduled';
        meeting.inviteeResponse = {
            status: 'accepted',
            respondedAt: new Date(),
            reason: ''
        };
        meeting.rescheduleProposal = {
            ...proposal.toObject?.() || proposal,
            status: 'accepted',
            respondedAt: new Date(),
            responseNote: String(req.body?.reason || '').trim()
        };
        pushHistory(meeting, {
            status: 'Scheduled',
            action: 'reschedule_accepted',
            actorId,
            note: 'New time confirmed'
        });
    } else if (action === 'decline') {
        meeting.rescheduleProposal = {
            ...proposal.toObject?.() || proposal,
            status: 'rejected',
            respondedAt: new Date(),
            responseNote: String(req.body?.reason || '').trim()
        };
        // Keep prior confirmed schedule if it was Scheduled; otherwise back to pending
        if (meeting.inviteeResponse?.status === 'accepted') {
            meeting.status = 'Scheduled';
        } else {
            meeting.status = 'Pending Response';
        }
        pushHistory(meeting, {
            status: meeting.status,
            action: 'reschedule_rejected',
            actorId,
            note: String(req.body?.reason || '').trim() || 'Reschedule proposal declined'
        });
    } else {
        const proposedDate = req.body?.proposedDate;
        const proposedTime = req.body?.proposedTime;
        if (!proposedDate || !proposedTime) {
            return res.status(400).json({
                success: false,
                message: 'Counter proposals require proposedDate and proposedTime'
            });
        }
        const isInvitee = idStr(meeting.employeeId) === idStr(actorId);
        meeting.rescheduleProposal = {
            proposedDate: new Date(proposedDate),
            proposedTime,
            reason: String(req.body?.reason || '').trim(),
            requestedBy: actorId,
            requestedByRole: isInvitee ? 'Invitee' : 'Organizer',
            status: 'pending',
            respondedAt: undefined,
            responseNote: ''
        };
        meeting.status = 'Rescheduled';
        pushHistory(meeting, {
            status: 'Rescheduled',
            action: 'reschedule_countered',
            actorId,
            note: 'Counter time proposed'
        });
    }

    await meeting.save();
    await populateMeeting(meeting);

    const otherParty = idStr(meeting.employeeId) === idStr(actorId)
        ? [meeting.managerId?._id || meeting.managerId]
        : [meeting.employeeId?._id || meeting.employeeId];

    const actorLabel = personLabel(
        idStr(meeting.employeeId) === idStr(actorId) ? meeting.employeeId : meeting.managerId
    );

    let message = `${actorLabel} responded to the reschedule proposal.`;
    if (action === 'accept') message = `${actorLabel} accepted the proposed new time. Meeting is confirmed.`;
    if (action === 'decline') message = `${actorLabel} declined the proposed new time.`;
    if (action === 'counter') {
        const { formattedDate, formattedTime } = formatMeetingWhen(
            meeting.rescheduleProposal.proposedDate,
            meeting.rescheduleProposal.proposedTime
        );
        message = `${actorLabel} proposed another time: ${formattedDate} at ${formattedTime}.`;
    }

    const notifyingInvitee = idStr(meeting.employeeId) !== idStr(actorId);
    await notifyPeople({
        recipientEmployeeIds: otherParty,
        actor: req.employee || req.user,
        message,
        meeting,
        action: `reschedule_${action}`,
        forInvitee: notifyingInvitee
    });

    res.json({
        success: true,
        message: action === 'accept'
            ? 'New time confirmed'
            : action === 'decline'
                ? 'Reschedule proposal declined'
                : 'Counter proposal sent',
        data: meeting
    });
});

/**
 * Cancel one-on-one (organizer / HR)
 */
export const cancelOneOnOne = asyncHandler(async (req, res) => {
    const meeting = await loadMeetingOr404(req, res);
    if (!meeting) return;
    if (!assertOrganizerOrHr(meeting, req, res)) return;

    if (!['Pending Response', 'Scheduled', 'Rescheduled'].includes(meeting.status)) {
        return res.status(400).json({
            success: false,
            message: `Only active meetings can be cancelled (current status: ${meeting.status})`
        });
    }

    meeting.status = 'Cancelled';
    meeting.rescheduleProposal = { status: 'none' };
    pushHistory(meeting, {
        status: 'Cancelled',
        action: 'cancelled',
        actorId: getActorEmployeeId(req),
        note: String(req.body?.reason || '').trim() || 'Cancelled by organizer'
    });
    await meeting.save();
    await populateMeeting(meeting);

    await notifyPeople({
        recipientEmployeeIds: [meeting.employeeId?._id || meeting.employeeId],
        actor: req.employee || req.user,
        message: `${personLabel(meeting.managerId, 'Organizer')} cancelled the one-on-one meeting.`,
        meeting,
        action: 'cancelled',
        forInvitee: true
    });

    res.json({
        success: true,
        message: 'One-on-one meeting cancelled',
        data: meeting
    });
});

/**
 * Complete one-on-one
 */
export const completeOneOnOne = asyncHandler(async (req, res) => {
    const meeting = await loadMeetingOr404(req, res);
    if (!meeting) return;
    if (!assertParticipant(meeting, req, res)) return;

    if (!['Scheduled', 'Rescheduled', 'No Show'].includes(meeting.status)) {
        return res.status(400).json({
            success: false,
            message: `Only confirmed meetings can be completed (current: ${meeting.status})`
        });
    }

    meeting.status = 'Completed';
    if (req.body.managerNotes !== undefined) meeting.managerNotes = req.body.managerNotes;
    if (req.body.employeeNotes !== undefined) meeting.employeeNotes = req.body.employeeNotes;
    if (req.body.feedback !== undefined) meeting.feedback = req.body.feedback;
    if (req.body.agenda) meeting.agenda = req.body.agenda;
    if (req.body.actionItems) meeting.actionItems = req.body.actionItems;
    if (req.body.nextMeetingDate !== undefined) meeting.nextMeetingDate = req.body.nextMeetingDate;

    pushHistory(meeting, {
        status: 'Completed',
        action: 'completed',
        actorId: getActorEmployeeId(req),
        note: 'Meeting marked completed'
    });
    await meeting.save();
    await populateMeeting(meeting);

    res.json({
        success: true,
        message: 'One-on-one completed successfully',
        data: meeting
    });
});

/**
 * Add a participant note (append — does not overwrite others)
 */
export const addOneOnOneNote = asyncHandler(async (req, res) => {
    const meeting = await loadMeetingOr404(req, res);
    if (!meeting) return;
    if (!assertNotesParticipant(meeting, req, res)) return;

    const actorId = getActorEmployeeId(req);
    const content = String(req.body?.content ?? req.body?.notes ?? '').trim();
    if (!content) {
        return res.status(400).json({
            success: false,
            message: 'Note content is required'
        });
    }

    if (!Array.isArray(meeting.meetingNotes)) meeting.meetingNotes = [];
    const now = new Date();
    meeting.meetingNotes.push({
        author: actorId,
        content,
        createdAt: now,
        updatedAt: now
    });

    pushHistory(meeting, {
        status: meeting.status,
        action: 'note_added',
        actorId,
        note: 'Participant added a note'
    });
    await meeting.save();
    await populateMeeting(meeting);

    res.json({
        success: true,
        message: 'Note added',
        data: meeting
    });
});

/**
 * Update own note only
 */
export const updateOneOnOneNote = asyncHandler(async (req, res) => {
    const meeting = await loadMeetingOr404(req, res);
    if (!meeting) return;
    if (!assertNotesParticipant(meeting, req, res)) return;

    const actorId = getActorEmployeeId(req);
    const noteId = req.params.noteId;
    const content = String(req.body?.content ?? req.body?.notes ?? '').trim();
    if (!content) {
        return res.status(400).json({
            success: false,
            message: 'Note content is required'
        });
    }

    const note = meeting.meetingNotes?.id?.(noteId) ||
        meeting.meetingNotes?.find((n) => idStr(n._id) === idStr(noteId));
    if (!note) {
        return res.status(404).json({
            success: false,
            message: 'Note not found'
        });
    }
    if (idStr(note.author) !== idStr(actorId)) {
        return res.status(403).json({
            success: false,
            message: 'You can only edit your own notes'
        });
    }

    note.content = content;
    note.updatedAt = new Date();
    pushHistory(meeting, {
        status: meeting.status,
        action: 'note_updated',
        actorId,
        note: 'Participant updated a note'
    });
    await meeting.save();
    await populateMeeting(meeting);

    res.json({
        success: true,
        message: 'Note updated',
        data: meeting
    });
});

/**
 * Delete own note only
 */
export const deleteOneOnOneNote = asyncHandler(async (req, res) => {
    const meeting = await loadMeetingOr404(req, res);
    if (!meeting) return;
    if (!assertNotesParticipant(meeting, req, res)) return;

    const actorId = getActorEmployeeId(req);
    const noteId = req.params.noteId;
    const note = meeting.meetingNotes?.id?.(noteId) ||
        meeting.meetingNotes?.find((n) => idStr(n._id) === idStr(noteId));
    if (!note) {
        return res.status(404).json({
            success: false,
            message: 'Note not found'
        });
    }
    if (idStr(note.author) !== idStr(actorId)) {
        return res.status(403).json({
            success: false,
            message: 'You can only delete your own notes'
        });
    }

    meeting.meetingNotes = meeting.meetingNotes.filter(
        (n) => idStr(n._id) !== idStr(noteId)
    );
    pushHistory(meeting, {
        status: meeting.status,
        action: 'note_deleted',
        actorId,
        note: 'Participant deleted a note'
    });
    await meeting.save();
    await populateMeeting(meeting);

    res.json({
        success: true,
        message: 'Note deleted',
        data: meeting
    });
});

/** @deprecated Prefer addOneOnOneNote — kept as alias that appends a note */
export const saveOneOnOneNotes = addOneOnOneNote;
