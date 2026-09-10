import CelebrationEvent, { CELEBRATION_REACTIONS } from '../../models/celebrationEvent.model.js';
import Employee from '../../models/employee.model.js';
import { getOrganizationId } from '../../helpers/organizationHelper.js';
import {
  canViewCelebrationEvent,
} from '../../helpers/celebrationRecipientHelper.js';
import {
  openTodayBirthdayEvent,
  openTodayAnniversaryEvent,
  openTodayMarriageAnniversaryEvent,
} from '../../helpers/celebrationEventService.js';
import { notify } from '../../helpers/notificationManager.js';
import '../../helpers/celebrationEventRegistry.js';
import asyncHandler from '../../middlewares/asyncHandler.js';
import logger from '../../helpers/logger.js';

const employeeFullName = (employee) =>
  `${employee?.name || ''} ${employee?.lastName || ''}`.trim();

const buildReactionCounts = (reactions = []) =>
  reactions.reduce((acc, reaction) => {
    acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
    return acc;
  }, {});

const serializeEvent = (event, viewerEmployeeId, employeeMap = new Map()) => {
  const subject = employeeMap.get(String(event.employeeId));
  const isSubject = String(event.employeeId) === String(viewerEmployeeId);

  const reactionsWithNames = (event.reactions || []).map((r) => {
    const reactor = employeeMap.get(String(r.employeeId));
    return {
      emoji: r.emoji,
      employeeId: r.employeeId,
      employeeName: employeeFullName(reactor),
      reactedAt: r.reactedAt,
    };
  });

  const payload = {
    _id: event._id,
    type: event.type,
    eventDate: event.eventDate,
    eventYear: event.eventYear,
    completedYears: event.completedYears,
    employee: subject
      ? {
          _id: subject._id,
          name: employeeFullName(subject),
          department: subject.department,
          profilePhoto: subject.profilePhoto,
        }
      : null,
    reactions: reactionsWithNames,
    reactionCounts: buildReactionCounts(event.reactions),
    myReactions: (event.reactions || [])
      .filter((r) => String(r.employeeId) === String(viewerEmployeeId))
      .map((r) => r.emoji),
    reactors: [...new Map(
      (reactionsWithNames || [])
        .filter((r) => r.employeeName)
        .map((r) => [String(r.employeeId), r.employeeName])
    ).values()],
    isSubject,
    createdAt: event.createdAt,
  };

  if (isSubject) {
    payload.wishes = (event.wishes || []).map((wish) => {
      const commenter = employeeMap.get(String(wish.commenterEmployeeId));
      return {
        _id: wish._id,
        comment: wish.comment,
        commenterEmployeeId: wish.commenterEmployeeId,
        commenterName: employeeFullName(commenter),
        createdAt: wish.createdAt,
      };
    });
  }

  return payload;
};

const loadEmployeeMap = async (organizationId, employeeIds) => {
  const uniqueIds = [...new Set(employeeIds.filter(Boolean).map(String))];
  const employees = await Employee.find({
    organizationId,
    _id: { $in: uniqueIds },
  })
    .select('_id name lastName department profilePhoto')
    .lean();

  return new Map(employees.map((emp) => [String(emp._id), emp]));
};

/**
 * GET /v1/both/celebrations/events
 */
export const getCelebrationEvents = asyncHandler(async (req, res) => {
  const organizationId = getOrganizationId(req);
  const viewerId = req.employee?._id;

  if (!viewerId) {
    return res.status(403).json({ success: false, message: 'Employee context required' });
  }

  const events = await CelebrationEvent.find({
    organizationId,
    status: 'active',
    $or: [
      { employeeId: viewerId },
      { eligibleViewerIds: viewerId },
    ],
  })
    .sort({ eventDate: -1 })
    .limit(50)
    .lean();

  const employeeIds = events.flatMap((event) => [
    event.employeeId,
    ...(event.reactions || []).map((r) => r.employeeId),
    ...(event.wishes || []).map((w) => w.commenterEmployeeId),
  ]);
  const employeeMap = await loadEmployeeMap(organizationId, employeeIds);

  res.json({
    success: true,
    data: events.map((event) => serializeEvent(event, viewerId, employeeMap)),
  });
});

/**
 * GET /v1/both/celebrations/events/:id
 */
export const getCelebrationEventById = asyncHandler(async (req, res) => {
  const organizationId = getOrganizationId(req);
  const viewerId = req.employee?._id;
  const { id } = req.params;

  if (!viewerId) {
    return res.status(403).json({ success: false, message: 'Employee context required' });
  }

  const event = await CelebrationEvent.findOne({ _id: id, organizationId }).lean();
  if (!event || !canViewCelebrationEvent(event, viewerId)) {
    return res.status(404).json({ success: false, message: 'Celebration event not found' });
  }

  const employeeIds = [
    event.employeeId,
    ...(event.reactions || []).map((r) => r.employeeId),
    ...(event.wishes || []).map((w) => w.commenterEmployeeId),
  ];
  const employeeMap = await loadEmployeeMap(organizationId, employeeIds);

  res.json({
    success: true,
    data: serializeEvent(event, viewerId, employeeMap),
  });
});

/**
 * POST /v1/both/celebrations/events/:id/react
 */
export const reactToCelebrationEvent = asyncHandler(async (req, res) => {
  const organizationId = getOrganizationId(req);
  const viewerId = req.employee?._id;
  const { id } = req.params;
  const emoji = String(req.body.emoji || '').trim();

  if (!viewerId) {
    return res.status(403).json({ success: false, message: 'Employee context required' });
  }

  if (!CELEBRATION_REACTIONS.includes(emoji)) {
    return res.status(400).json({
      success: false,
      message: `Invalid reaction. Allowed: ${CELEBRATION_REACTIONS.join(' ')}`,
    });
  }

  const event = await CelebrationEvent.findOne({ _id: id, organizationId, status: 'active' });
  if (!event || !canViewCelebrationEvent(event, viewerId)) {
    return res.status(404).json({ success: false, message: 'Celebration event not found' });
  }

  event.reactions = event.reactions || [];
  const existingIdx = event.reactions.findIndex(
    (r) => String(r.employeeId) === String(viewerId) && r.emoji === emoji
  );

  if (existingIdx >= 0) {
    event.reactions.splice(existingIdx, 1);
  } else {
    event.reactions.push({ emoji, employeeId: viewerId, reactedAt: new Date() });
  }

  await event.save();

  res.json({
    success: true,
    data: {
      _id: event._id,
      type: event.type,
      employeeId: event.employeeId,
      reactions: event.reactions,
      reactionCounts: buildReactionCounts(event.reactions),
    },
  });
});

/**
 * POST /v1/both/celebrations/events/:id/wish
 * Private wish — only the subject employee receives a notification.
 */
export const postCelebrationWish = asyncHandler(async (req, res) => {
  const organizationId = getOrganizationId(req);
  const commenterId = req.employee?._id;
  const { id } = req.params;
  const comment = String(req.body.comment || '').trim();

  if (!commenterId) {
    return res.status(403).json({ success: false, message: 'Employee context required' });
  }

  if (!comment || comment.length > 500) {
    return res.status(400).json({ success: false, message: 'Wish must be 1–500 characters' });
  }

  const event = await CelebrationEvent.findOne({ _id: id, organizationId, status: 'active' });
  if (!event || !canViewCelebrationEvent(event, commenterId)) {
    return res.status(404).json({ success: false, message: 'Celebration event not found' });
  }

  const commenter = await Employee.findById(commenterId).select('name lastName').lean();
  const commenterName = employeeFullName(commenter);

  event.wishes = event.wishes || [];
  event.wishes.push({
    commenterEmployeeId: commenterId,
    subjectEmployeeId: event.employeeId,
    comment,
    createdAt: new Date(),
  });
  await event.save();

  const wishType = event.type === 'marriage_anniversary'
    ? 'celebration_marriage_anniversary_wish'
    : event.type === 'anniversary'
      ? 'celebration_anniversary_wish'
      : 'celebration_birthday_wish';

  const wishTitle = event.type === 'marriage_anniversary'
    ? '💬 Marriage Anniversary Wish'
    : event.type === 'anniversary'
      ? '💬 Anniversary Wish'
      : '💬 Birthday Wish';

  try {
    await notify({
      type: wishType,
      organizationId,
      title: wishTitle,
      data: {
        celebrationEventId: event._id,
        commenterEmployeeId: commenterId,
        subjectEmployeeId: event.employeeId,
        commenterName,
        comment,
      },
    });
  } catch (error) {
    logger.warn('Celebration wish notification failed', {
      eventId: event._id,
      error: error.message,
    });
  }

  res.status(201).json({
    success: true,
    message: 'Wish sent successfully',
    data: {
      _id: event._id,
      type: event.type,
      employeeId: event.employeeId,
      wishPosted: true,
    },
  });
});

/**
 * POST /v1/both/celebrations/events/open
 * Opens today's celebration event (birthday, work anniversary, or marriage anniversary) so the Wishes button can work immediately.
 */
export const openTodayCelebrationEvent = asyncHandler(async (req, res) => {
  const organizationId = getOrganizationId(req);
  const viewerId = req.employee?._id;
  const employeeId = req.body?.employeeId;
  const rawType = String(req.body?.type || '').toLowerCase();
  const type = rawType === 'marriage_anniversary'
    ? 'marriage_anniversary'
    : rawType === 'anniversary'
      ? 'anniversary'
      : 'birthday';

  if (!viewerId) {
    return res.status(403).json({ success: false, message: 'Employee context required' });
  }
  if (!employeeId) {
    return res.status(400).json({ success: false, message: 'employeeId is required' });
  }

  const employee = await Employee.findOne({
    _id: employeeId,
    organizationId,
    status: 'active',
  })
    .select('_id name lastName firstName fullName birthDate dateOfBirth dob joiningDate anniversaryDate maritalStatus spouseName marriageDate showMarriageAnniversary contactDetails personalDetails department managerId userId functionalRoles position jobTitle profilePhoto avatar')
    .lean();

  if (!employee) {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }

  let event;
  try {
    if (type === 'marriage_anniversary') {
      event = await openTodayMarriageAnniversaryEvent(organizationId, employee, viewerId);
    } else if (type === 'anniversary') {
      event = await openTodayAnniversaryEvent(organizationId, employee, viewerId);
    } else {
      event = await openTodayBirthdayEvent(organizationId, employee, viewerId);
    }
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || (
        type === 'marriage_anniversary'
          ? 'Could not open marriage anniversary wishes'
          : type === 'anniversary'
            ? 'Could not open anniversary wishes'
            : 'Could not open birthday wishes'
      ),
    });
  }

  const eventDoc = event.toObject ? event.toObject() : event;
  if (!canViewCelebrationEvent(eventDoc, viewerId)) {
    return res.status(403).json({ success: false, message: 'You cannot view this celebration' });
  }

  const employeeMap = await loadEmployeeMap(organizationId, [
    event.employeeId,
    ...(event.reactions || []).map((r) => r.employeeId),
    ...(event.wishes || []).map((w) => w.commenterEmployeeId),
  ]);

  res.json({
    success: true,
    data: serializeEvent(eventDoc, viewerId, employeeMap),
  });
});


/**
 * DELETE /v1/both/celebrations/events/:id
 * Soft-deletes a celebration event for the subject employee.
 */
export const deleteCelebrationEvent = asyncHandler(async (req, res) => {
  const organizationId = getOrganizationId(req);
  const viewerId = req.employee?._id;
  const { id } = req.params;

  if (!viewerId) {
    return res.status(403).json({ success: false, message: 'Employee context required' });
  }

  const event = await CelebrationEvent.findOne({ _id: id, organizationId, status: 'active' });
  if (!event || !canViewCelebrationEvent(event, viewerId)) {
    return res.status(404).json({ success: false, message: 'Celebration event not found' });
  }

  const isSubject = String(event.employeeId) === String(viewerId);
  if (!isSubject) {
    return res.status(403).json({ success: false, message: 'Only the celebration owner can delete this celebration' });
  }

  event.status = 'deleted';
  event.deletedAt = new Date();
  event.deletedBy = viewerId;
  await event.save();

  res.json({
    success: true,
    message: 'Celebration deleted successfully',
    data: {
      _id: event._id,
      type: event.type,
      employeeId: event.employeeId,
      status: event.status,
    },
  });
});

export default {
  getCelebrationEvents,
  getCelebrationEventById,
  reactToCelebrationEvent,
  postCelebrationWish,
  openTodayCelebrationEvent,
  deleteCelebrationEvent,
};
