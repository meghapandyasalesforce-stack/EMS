import { OneOnOne } from '../../models/oneOnOne.model.js';
import Employee from '../../models/employee.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import { getManagerEmployeeIds } from '../../helpers/managerHelper.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../middlewares/asyncHandler.js';
import {
    ACTIVE_MEETING_STATUSES,
    RESPONSE_ELIGIBLE_STATUSES,
    RESCHEDULE_ELIGIBLE_STATUSES,
    COMPLETE_ELIGIBLE_STATUSES,
    CANCEL_ELIGIBLE_STATUSES,
    displayName,
    formatMeetingWhen,
    getActorEmployeeId,
    idsEqual,
    isParticipant,
    isOrganizer,
    isInvitee,
    loadEmployeeWithRoles,
    isEmployeeManagerLike,
    notifyMeetingParticipants,
    otherParticipantId,
    populateMeeting,
    buildDeepLink
} from '../../helpers/oneOnOneHelper.js';

const UPDATE_ALLOWLIST = [
    'scheduledDate',
    'scheduledTime',
    'duration',
    'location',
    'meetingLink',
    'agenda',
    'nextMeetingDate',
    'actionItems',
    'goals',
    'feedback',
    'recurring'
];

const pickAllowed = (body) => {
    const out = {};
    for (const key of UPDATE_ALLOWLIST) {
        if (body[key] !== undefined) out[key] = body[key];
    }
    return out;
};

const requireActor = (req, res) => {
    const actorId = getActorEmployeeId(req);
    if (!actorId && !req.user) {
        res.status(403).json({ success: false, message: 'Employee profile required for this action' });
        return null;
    }
    return actorId;
};

/**
 * Eligible participants: team members + peer managers (for manager-to-manager).
 */
export const getEligibleParticipants = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const actorId = getActorEmployeeId(req);

    if (!actorId && !req.user) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const allActive = await Employee.find({
        organizationId,
        status: 'active',
        ...(actorId ? { _id: { $ne: actorId } } : {})
    })
        .select('name lastName email position jobTitle functionalRoles department managerId')
        .sort({ name: 1 })
        .lean();

    // Admin sees everyone
    if (req.user && !req.employee) {
        const managers = [];
        const employees = [];
        for (const emp of allActive) {
            const enriched = { ...emp, isManager: isEmployeeManagerLike(emp) };
            if (enriched.isManager) managers.push(enriched);
            else employees.push(enriched);
        }
        return res.json({
            success: true,
            data: { teamMembers: employees, peerManagers: managers, all: allActive }
        });
    }

    const actor = await loadEmployeeWithRoles(actorId, organizationId);
    if (!actor) {
        return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const teamIds = await getManagerEmployeeIds(Employee, organizationId, actor);
    const teamIdSet = new Set(teamIds.map(String));

    const teamMembers = [];
    const peerManagers = [];

    for (const emp of allActive) {
        const id = String(emp._id);
        if (id === String(actorId)) continue;
        const enriched = { ...emp, isManager: isEmployeeManagerLike(emp) };
        if (teamIdSet.has(id)) {
            teamMembers.push(enriched);
        } else if (enriched.isManager && (actor.isManager || actor.isHR || req.user)) {
            peerManagers.push(enriched);
        }
    }

    // HR without manager flag: allow selecting managers org-wide
    if (actor.isHR && !actor.isManager) {
        for (const emp of allActive) {
            if (String(emp._id) === String(actorId)) continue;
            if (isEmployeeManagerLike(emp) && !peerManagers.some((p) => String(p._id) === String(emp._id))) {
                peerManagers.push({ ...emp, isManager: true });
            }
            if (!teamMembers.some((t) => String(t._id) === String(emp._id)) && !isEmployeeManagerLike(emp)) {
                teamMembers.push({ ...emp, isManager: false });
            }
        }
    }

    res.json({
        success: true,
        data: {
            teamMembers,
            peerManagers,
            all: [...teamMembers, ...peerManagers]
        }
    });
});

/**
 * Create one-on-one meeting (manager → employee or manager → manager).
 */
export const createOneOnOne = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const organizerId = getActorEmployeeId(req);

    if (!organizerId) {
        return res.status(403).json({
            success: false,
            message: 'An employee profile is required to schedule meetings'
        });
    }

    const { employeeId, scheduledDate, scheduledTime } = req.body;
    if (!employeeId || !scheduledDate) {
        return res.status(400).json({
            success: false,
            message: 'Invitee and scheduled date are required'
        });
    }

    if (idsEqual(employeeId, organizerId)) {
        return res.status(400).json({
            success: false,
            message: 'You cannot schedule a meeting with yourself'
        });
    }

    const [organizer, invitee] = await Promise.all([
        loadEmployeeWithRoles(organizerId, organizationId),
        loadEmployeeWithRoles(employeeId, organizationId)
    ]);

    if (!invitee || invitee.status === 'inactive') {
        return res.status(400).json({
            success: false,
            message: 'Invitee not found or inactive in this organization'
        });
    }

    const canSchedule =
        req.user ||
        organizer?.isManager ||
        organizer?.isHR;

    if (!canSchedule) {
        return res.status(403).json({
            success: false,
            message: 'Only managers, HR, or admins can schedule one-on-one meetings'
        });
    }

    // Non-admin managers may invite: direct reports OR other managers (peer)
    if (!req.user && organizer?.isManager && !organizer?.isHR) {
        const teamIds = await getManagerEmployeeIds(Employee, organizationId, organizer);
        const isTeamMember = teamIds.some((id) => idsEqual(id, employeeId));
        const isPeerManager = isEmployeeManagerLike(invitee);
        if (!isTeamMember && !isPeerManager) {
            return res.status(403).json({
                success: false,
                message: 'You can only schedule meetings with your team members or other managers'
            });
        }
    }

    const meetingKind = isEmployeeManagerLike(invitee) && (organizer?.isManager || req.user)
        ? 'manager_manager'
        : 'manager_employee';

    const oneOnOne = new OneOnOne({
        organizationId,
        managerId: organizerId,
        employeeId,
        meetingKind,
        scheduledDate,
        scheduledTime: scheduledTime || '',
        duration: req.body.duration || 30,
        location: req.body.location || '',
        meetingLink: req.body.meetingLink || '',
        agenda: Array.isArray(req.body.agenda) ? req.body.agenda : [],
        status: 'Pending',
        recurring: req.body.recurring
    });
    meeting.statusHistory = meeting.statusHistory.slice(0, 40);
};

    await oneOnOne.save();
    await populateMeeting(oneOnOne);

    const organizerName = displayName(oneOnOne.managerId);
    const inviteeName = displayName(oneOnOne.employeeId);
    const { label } = formatMeetingWhen(oneOnOne);

    try {
        await notifyMeetingParticipants({
            recipientIds: [oneOnOne.employeeId._id],
            sender: req.employee || req.user,
            message: `Meeting with ${organizerName} has been scheduled for ${label} by ${organizerName}.`,
            organizationId,
            meetingId: oneOnOne._id,
            extraMetadata: {
                scheduledDate: oneOnOne.scheduledDate,
                scheduledTime: oneOnOne.scheduledTime,
                action: 'scheduled'
            }
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
    }

    logger.info('One-on-one created', {
        oneOnOneId: oneOnOne._id,
        meetingKind,
        organizerId,
        inviteeId: employeeId,
        inviteeName
    });

    res.status(201).json({
        success: true,
        message: multi
            ? `${created.length} one-on-one invitations sent`
            : 'One-on-one invitation sent',
        data: multi ? created : created[0]
    });
});

/**
 * Get one-on-one meetings (both participants always see shared state).
 */
export const getOneOnOnes = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { managerId, employeeId, status, startDate, endDate, tab } = req.query;
    const currentUserId = getActorEmployeeId(req);

    const query = addOrganizationFilter(req, {});

    if (currentUserId && !req.user) {
        const currentEmployee = await loadEmployeeWithRoles(currentUserId, organizationId);
        const isManager = !!currentEmployee?.isManager;
        const isHR = !!currentEmployee?.isHR;

        if (isHR) {
            // HR: org-wide visibility
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
            // Regular employee: meetings they organize (rare) or are invited to
            query.$or = [
                { managerId: currentUserId },
                { employeeId: currentUserId }
            ];
        }
    }

    if (managerId) query.managerId = managerId;
    if (employeeId) query.employeeId = employeeId;
    if (status) {
        if (status === 'Scheduled') {
            // Include legacy + new pending/accepted for older clients
            query.status = { $in: ['Scheduled', 'Pending', 'Accepted', 'Rescheduled'] };
        } else {
            query.status = status;
        }
    }

    if (tab === 'upcoming') {
        query.status = { $in: ACTIVE_MEETING_STATUSES };
        query.scheduledDate = { ...(query.scheduledDate || {}), $gte: new Date(new Date().setHours(0, 0, 0, 0)) };
    } else if (tab === 'pending') {
        query.status = 'Pending';
    } else if (tab === 'reschedule') {
        query.status = 'Reschedule Requested';
    } else if (tab === 'history') {
        query.status = { $in: ['Completed', 'Cancelled', 'Declined', 'No Show'] };
    }

    if (startDate || endDate) {
        query.scheduledDate = query.scheduledDate || {};
        if (startDate) query.scheduledDate.$gte = new Date(startDate);
        if (endDate) query.scheduledDate.$lte = new Date(endDate);
    }

    const oneOnOnes = await OneOnOne.find(query)
        .populate('managerId', 'name lastName email position jobTitle functionalRoles')
        .populate('employeeId', 'name lastName email position jobTitle functionalRoles')
        .populate('meetingNotes.authorId', 'name lastName')
        .populate('response.respondedBy', 'name lastName')
        .populate('rescheduleProposal.proposedBy', 'name lastName')
        .populate('goals.goalId')
        .sort({ scheduledDate: -1 });

    const actorId = getActorEmployeeId(req);
    res.json({
        success: true,
        data: oneOnOnes.map((m) => stripNotesIfNotParticipant(m, actorId))
    });
});

/**
 * Get single meeting by id (participants / HR / admin).
 */
export const getOneOnOneById = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const actorId = getActorEmployeeId(req);
    const { id } = req.params;

    const oneOnOne = await OneOnOne.findOne({ _id: id, organizationId });
    if (!oneOnOne) {
        return res.status(404).json({ success: false, message: 'One-on-one meeting not found' });
    }

    const actor = actorId ? await loadEmployeeWithRoles(actorId, organizationId) : null;
    const allowed = req.user || actor?.isHR || isParticipant(oneOnOne, actorId);
    if (!allowed) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this meeting' });
    }

    await populateMeeting(oneOnOne);
    res.json({ success: true, data: oneOnOne });
});

/**
 * Update meeting details (organizer / admin). Does not change response workflow status.
 */
export const updateOneOnOne = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const actorId = getActorEmployeeId(req);

    const oneOnOne = await OneOnOne.findOne({ _id: id, organizationId });
    if (!oneOnOne) {
        return res.status(404).json({ success: false, message: 'One-on-one meeting not found' });
    }

    if (['Completed', 'Cancelled', 'Declined'].includes(oneOnOne.status)) {
        return res.status(400).json({
            success: false,
            message: `Cannot update a meeting with status ${oneOnOne.status}`
        });
    }

    const allowed = req.user || isOrganizer(oneOnOne, actorId);
    if (!allowed) {
        return res.status(403).json({
            success: false,
            message: 'Only the organizer can update meeting details'
        });
    }

    const updates = pickAllowed(req.body);
    const dateChanged =
        (updates.scheduledDate && String(new Date(updates.scheduledDate)) !== String(oneOnOne.scheduledDate)) ||
        (updates.scheduledTime !== undefined && updates.scheduledTime !== oneOnOne.scheduledTime);

    Object.assign(oneOnOne, updates);

    if (dateChanged) {
        oneOnOne.status = 'Rescheduled';
        oneOnOne.rescheduleProposal = undefined;
    }

    await oneOnOne.save();
    await populateMeeting(oneOnOne);

    if (dateChanged) {
        const organizerName = displayName(oneOnOne.managerId);
        const { label } = formatMeetingWhen(oneOnOne);
        await notifyMeetingParticipants({
            recipientIds: [oneOnOne.employeeId._id || oneOnOne.employeeId],
            sender: req.employee || req.user,
            message: `Your meeting has been rescheduled by ${organizerName} to ${label}.`,
            organizationId,
            meetingId: oneOnOne._id,
            extraMetadata: { action: 'rescheduled' }
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
 * Invitee accepts the meeting.
 */
export const acceptOneOnOne = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const actorId = requireActor(req, res);
    if (actorId === null && !req.user) return;

    const oneOnOne = await OneOnOne.findOne({ _id: id, organizationId });
    if (!oneOnOne) {
        return res.status(404).json({ success: false, message: 'One-on-one meeting not found' });
    }

    if (!isInvitee(oneOnOne, actorId)) {
        return res.status(403).json({ success: false, message: 'Only the invited participant can accept' });
    }

    if (!RESPONSE_ELIGIBLE_STATUSES.includes(oneOnOne.status)) {
        return res.status(400).json({
            success: false,
            message: `Cannot accept a meeting with status ${oneOnOne.status}`
        });
    }

    if (oneOnOne.status === 'Accepted') {
        return res.status(400).json({ success: false, message: 'Meeting is already accepted' });
    }

    oneOnOne.status = 'Accepted';
    oneOnOne.response = {
        respondedBy: actorId,
        respondedAt: new Date(),
        note: req.body?.note || ''
    };
    await oneOnOne.save();
    await populateMeeting(oneOnOne);

    const inviteeName = displayName(oneOnOne.employeeId);
    await notifyMeetingParticipants({
        recipientIds: [oneOnOne.managerId._id || oneOnOne.managerId],
        sender: req.employee || req.user,
        message: `${inviteeName} accepted your meeting request.`,
        organizationId,
        meetingId: oneOnOne._id,
        extraMetadata: { action: 'accepted' }
    });

    res.json({ success: true, message: 'Meeting accepted', data: oneOnOne });
});

/**
 * Invitee declines the meeting.
 */
export const declineOneOnOne = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const actorId = requireActor(req, res);
    if (actorId === null && !req.user) return;

    const oneOnOne = await OneOnOne.findOne({ _id: id, organizationId });
    if (!oneOnOne) {
        return res.status(404).json({ success: false, message: 'One-on-one meeting not found' });
    }

    if (!isInvitee(oneOnOne, actorId)) {
        return res.status(403).json({ success: false, message: 'Only the invited participant can decline' });
    }

    if (!RESPONSE_ELIGIBLE_STATUSES.includes(oneOnOne.status) && oneOnOne.status !== 'Accepted') {
        return res.status(400).json({
            success: false,
            message: `Cannot decline a meeting with status ${oneOnOne.status}`
        });
    }

    oneOnOne.status = 'Declined';
    oneOnOne.response = {
        respondedBy: actorId,
        respondedAt: new Date(),
        note: req.body?.note || ''
    };
    await oneOnOne.save();
    await populateMeeting(oneOnOne);

    const inviteeName = displayName(oneOnOne.employeeId);
    await notifyMeetingParticipants({
        recipientIds: [oneOnOne.managerId._id || oneOnOne.managerId],
        sender: req.employee || req.user,
        message: `${inviteeName} declined your meeting request.`,
        organizationId,
        meetingId: oneOnOne._id,
        extraMetadata: { action: 'declined' }
    });

    res.json({ success: true, message: 'Meeting declined', data: oneOnOne });
});

/**
 * Propose a new date/time (either participant).
 */
export const requestRescheduleOneOnOne = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const actorId = requireActor(req, res);
    if (actorId === null && !req.user) return;

    const { proposedDate, proposedTime, note } = req.body || {};
    if (!proposedDate) {
        return res.status(400).json({ success: false, message: 'Proposed date is required' });
    }

    const oneOnOne = await OneOnOne.findOne({ _id: id, organizationId });
    if (!oneOnOne) {
        return res.status(404).json({ success: false, message: 'One-on-one meeting not found' });
    }

    if (!isParticipant(oneOnOne, actorId) && !req.user) {
        return res.status(403).json({ success: false, message: 'Only participants can request a reschedule' });
    }

    if (!RESCHEDULE_ELIGIBLE_STATUSES.includes(oneOnOne.status)) {
        return res.status(400).json({
            success: false,
            message: `Cannot reschedule a meeting with status ${oneOnOne.status}`
        });
    }

    oneOnOne.status = 'Reschedule Requested';
    oneOnOne.rescheduleProposal = {
        proposedDate: new Date(proposedDate),
        proposedTime: proposedTime || '',
        proposedBy: actorId,
        proposedAt: new Date(),
        note: note || '',
        status: 'pending'
    };
    await oneOnOne.save();
    await populateMeeting(oneOnOne);

    const actorName = displayName(
        idsEqual(actorId, oneOnOne.managerId) ? oneOnOne.managerId : oneOnOne.employeeId
    );
    const otherId = otherParticipantId(oneOnOne, actorId);
    const propDate = new Date(proposedDate).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric'
    });
    const propTime = proposedTime || 'TBD';

    await notifyMeetingParticipants({
        recipientIds: [otherId],
        sender: req.employee || req.user,
        message: `${actorName} requested a new time for your meeting: ${propDate} at ${propTime}.`,
        organizationId,
        meetingId: oneOnOne._id,
        extraMetadata: { action: 'reschedule_requested' }
    });

    res.json({ success: true, message: 'Reschedule requested', data: oneOnOne });
});

/**
 * Accept a pending reschedule proposal (the other participant / organizer).
 * Applies the proposed date/time and sets status to Rescheduled.
 */
export const acceptRescheduleOneOnOne = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const actorId = requireActor(req, res);
    if (actorId === null && !req.user) return;

    const oneOnOne = await OneOnOne.findOne({ _id: id, organizationId });
    if (!oneOnOne) {
        return res.status(404).json({ success: false, message: 'One-on-one meeting not found' });
    }

    if (oneOnOne.status !== 'Reschedule Requested' || oneOnOne.rescheduleProposal?.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'No pending reschedule request' });
    }

    if (!isParticipant(oneOnOne, actorId) && !req.user) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Proposer cannot accept their own proposal
    if (idsEqual(oneOnOne.rescheduleProposal.proposedBy, actorId) && !req.user) {
        return res.status(400).json({
            success: false,
            message: 'Wait for the other participant to accept your reschedule proposal'
        });
    }

    oneOnOne.scheduledDate = oneOnOne.rescheduleProposal.proposedDate;
    oneOnOne.scheduledTime = oneOnOne.rescheduleProposal.proposedTime || oneOnOne.scheduledTime;
    oneOnOne.status = 'Rescheduled';
    oneOnOne.rescheduleProposal.status = 'accepted';
    await oneOnOne.save();
    await populateMeeting(oneOnOne);

    const actorName = displayName(
        idsEqual(actorId, oneOnOne.managerId) ? oneOnOne.managerId : oneOnOne.employeeId
    );
    const { label } = formatMeetingWhen(oneOnOne);
    const otherId = otherParticipantId(oneOnOne, actorId);

    await notifyMeetingParticipants({
        recipientIds: [otherId],
        sender: req.employee || req.user,
        message: `Your meeting has been rescheduled by ${actorName} to ${label}.`,
        organizationId,
        meetingId: oneOnOne._id,
        extraMetadata: { action: 'reschedule_accepted' }
    });

    res.json({ success: true, message: 'Reschedule accepted', data: oneOnOne });
});

/**
 * Reject a pending reschedule proposal — restores previous Accepted/Pending state.
 */
export const rejectRescheduleOneOnOne = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const actorId = requireActor(req, res);
    if (actorId === null && !req.user) return;

    const oneOnOne = await OneOnOne.findOne({ _id: id, organizationId });
    if (!oneOnOne) {
        return res.status(404).json({ success: false, message: 'One-on-one meeting not found' });
    }

    if (oneOnOne.status !== 'Reschedule Requested') {
        return res.status(400).json({ success: false, message: 'No pending reschedule request' });
    }

    if (!isParticipant(oneOnOne, actorId) && !req.user) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (idsEqual(oneOnOne.rescheduleProposal?.proposedBy, actorId) && !req.user) {
        return res.status(400).json({
            success: false,
            message: 'You cannot reject your own reschedule proposal — cancel it by proposing again or contact the other participant'
        });
    }

    oneOnOne.rescheduleProposal.status = 'rejected';
    // Restore to Accepted if previously confirmed, else Pending
    oneOnOne.status = oneOnOne.response?.respondedAt ? 'Accepted' : 'Pending';
    await oneOnOne.save();
    await populateMeeting(oneOnOne);

    const actorName = displayName(
        idsEqual(actorId, oneOnOne.managerId) ? oneOnOne.managerId : oneOnOne.employeeId
    );
    const otherId = otherParticipantId(oneOnOne, actorId);
    await notifyMeetingParticipants({
        recipientIds: [otherId],
        sender: req.employee || req.user,
        message: `${actorName} declined your reschedule request. The original time remains.`,
        organizationId,
        meetingId: oneOnOne._id,
        extraMetadata: { action: 'reschedule_rejected' }
    });

    res.json({ success: true, message: 'Reschedule request rejected', data: oneOnOne });
});

/**
 * Cancel one-on-one (organizer, invitee, or admin).
 */
export const cancelOneOnOne = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const currentUserId = getActorEmployeeId(req);

    const oneOnOne = await OneOnOne.findOne({ _id: id, organizationId });
    if (!oneOnOne) {
        return res.status(404).json({ success: false, message: 'One-on-one meeting not found' });
    }

    if (!CANCEL_ELIGIBLE_STATUSES.includes(oneOnOne.status)) {
        return res.status(400).json({
            success: false,
            message: `Only active meetings can be cancelled (current status: ${oneOnOne.status})`
        });
    }

    const isAdmin = !!req.user;
    if (!isAdmin && !isParticipant(oneOnOne, currentUserId)) {
        return res.status(403).json({
            success: false,
            message: 'Only meeting participants can cancel this meeting'
        });
    }

    oneOnOne.status = 'Cancelled';
    oneOnOne.cancelledBy = currentUserId || undefined;
    oneOnOne.cancelledAt = new Date();
    oneOnOne.cancelReason = req.body?.reason || '';
    await oneOnOne.save();
    await populateMeeting(oneOnOne);

    const actorName = displayName(
        idsEqual(currentUserId, oneOnOne.managerId)
            ? oneOnOne.managerId
            : idsEqual(currentUserId, oneOnOne.employeeId)
                ? oneOnOne.employeeId
                : { name: 'Admin' }
    );
    const otherId = otherParticipantId(oneOnOne, currentUserId);
    const recipients = otherId
        ? [otherId]
        : [oneOnOne.managerId._id || oneOnOne.managerId, oneOnOne.employeeId._id || oneOnOne.employeeId];

    await notifyMeetingParticipants({
        recipientIds: recipients,
        sender: req.employee || req.user,
        message: `Meeting cancelled by ${actorName}.`,
        organizationId,
        meetingId: oneOnOne._id,
        extraMetadata: { action: 'cancelled' }
    });

    res.json({
        success: true,
        message: 'One-on-one meeting cancelled',
        data: meeting
    });
});

/**
 * Mark meeting completed (either participant).
 */
export const completeOneOnOne = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const actorId = getActorEmployeeId(req);

    const oneOnOne = await OneOnOne.findOne({ _id: id, organizationId });
    if (!oneOnOne) {
        return res.status(404).json({ success: false, message: 'One-on-one meeting not found' });
    }

    if (!req.user && !isParticipant(oneOnOne, actorId)) {
        return res.status(403).json({ success: false, message: 'Only participants can complete this meeting' });
    }

    if (!COMPLETE_ELIGIBLE_STATUSES.includes(oneOnOne.status)) {
        return res.status(400).json({
            success: false,
            message: `Cannot complete a meeting with status ${oneOnOne.status}`
        });
    }

    oneOnOne.status = 'Completed';
    oneOnOne.completedBy = actorId || undefined;
    oneOnOne.completedAt = new Date();

    if (req.body.managerNotes !== undefined) oneOnOne.managerNotes = req.body.managerNotes;
    if (req.body.employeeNotes !== undefined) oneOnOne.employeeNotes = req.body.employeeNotes;
    if (req.body.feedback) oneOnOne.feedback = req.body.feedback;
    if (req.body.agenda) oneOnOne.agenda = req.body.agenda;
    if (req.body.actionItems) oneOnOne.actionItems = req.body.actionItems;
    if (req.body.nextMeetingDate) oneOnOne.nextMeetingDate = req.body.nextMeetingDate;

    // Optional note on complete
    if (req.body.note && actorId) {
        const author = await Employee.findById(actorId).select('name lastName').lean();
        oneOnOne.meetingNotes.push({
            content: req.body.note,
            authorId: actorId,
            authorName: displayName(author),
            createdAt: new Date()
        });
    }

    await oneOnOne.save();
    await populateMeeting(oneOnOne);

    const actorName = displayName(
        idsEqual(actorId, oneOnOne.managerId) ? oneOnOne.managerId : oneOnOne.employeeId
    );
    const otherId = otherParticipantId(oneOnOne, actorId);
    if (otherId) {
        await notifyMeetingParticipants({
            recipientIds: [otherId],
            sender: req.employee || req.user,
            message: `${actorName} marked your meeting as completed.`,
            organizationId,
            meetingId: oneOnOne._id,
            extraMetadata: { action: 'completed' }
        });
    }

    res.json({
        success: true,
        message: 'One-on-one completed successfully',
        data: meeting
    });
});

/**
 * Add a shared meeting note.
 */
export const addMeetingNote = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const actorId = requireActor(req, res);
    if (actorId === null && !req.user) return;

    const content = (req.body?.content || '').trim();
    if (!content) {
        return res.status(400).json({ success: false, message: 'Note content is required' });
    }

    const oneOnOne = await OneOnOne.findOne({ _id: id, organizationId });
    if (!oneOnOne) {
        return res.status(404).json({ success: false, message: 'One-on-one meeting not found' });
    }

    if (!isParticipant(oneOnOne, actorId) && !req.user) {
        return res.status(403).json({ success: false, message: 'Only participants can add notes' });
    }

    if (['Cancelled', 'Declined'].includes(oneOnOne.status)) {
        return res.status(400).json({ success: false, message: 'Cannot add notes to a cancelled/declined meeting' });
    }

    const author = await Employee.findById(actorId).select('name lastName').lean();
    oneOnOne.meetingNotes.push({
        content,
        authorId: actorId,
        authorName: displayName(author),
        createdAt: new Date()
    });
    await oneOnOne.save();
    await populateMeeting(oneOnOne);

    res.json({ success: true, message: 'Note added', data: oneOnOne });
});

/**
 * Update own meeting note.
 */
export const updateMeetingNote = asyncHandler(async (req, res) => {
    const { id, noteId } = req.params;
    const organizationId = getOrganizationId(req);
    const actorId = requireActor(req, res);
    if (actorId === null && !req.user) return;

    const content = (req.body?.content || '').trim();
    if (!content) {
        return res.status(400).json({ success: false, message: 'Note content is required' });
    }

    const oneOnOne = await OneOnOne.findOne({ _id: id, organizationId });
    if (!oneOnOne) {
        return res.status(404).json({ success: false, message: 'One-on-one meeting not found' });
    }

    const note = oneOnOne.meetingNotes.id(noteId);
    if (!note) {
        return res.status(404).json({ success: false, message: 'Note not found' });
    }

    if (!idsEqual(note.authorId, actorId) && !req.user) {
        return res.status(403).json({ success: false, message: 'You can only edit your own notes' });
    }

    note.content = content;
    note.updatedAt = new Date();
    await oneOnOne.save();
    await populateMeeting(oneOnOne);

    res.json({ success: true, message: 'Note updated', data: oneOnOne });
});

export { buildDeepLink };
