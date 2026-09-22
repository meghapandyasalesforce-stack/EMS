import express from 'express';
import {
    createOneOnOne,
    getOneOnOnes,
    getOneOnOneById,
    getEligibleParticipants,
    updateOneOnOne,
    cancelOneOnOne,
    completeOneOnOne,
    acceptOneOnOne,
    declineOneOnOne,
    requestRescheduleOneOnOne,
    acceptRescheduleOneOnOne,
    rejectRescheduleOneOnOne,
    addMeetingNote,
    updateMeetingNote
} from '../../controllers/oneOnOne/oneOnOneController.js';
import { isAuthenticatedBoth } from '../../middlewares/isAuthenticatedBoth.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

router.route('/eligible-participants')
    .get(isAuthenticatedBoth, readLimiter, getEligibleParticipants);

router.route('/one-on-ones')
    .post(isAuthenticatedBoth, writeLimiter, createOneOnOne)
    .get(isAuthenticatedBoth, readLimiter, getOneOnOnes);

router.route('/one-on-ones/:id')
    .get(isAuthenticatedBoth, readLimiter, getOneOnOneById)
    .put(isAuthenticatedBoth, writeLimiter, updateOneOnOne);

router.route('/one-on-ones/:id/accept')
    .patch(isAuthenticatedBoth, writeLimiter, acceptOneOnOne);

router.route('/one-on-ones/:id/decline')
    .patch(isAuthenticatedBoth, writeLimiter, declineOneOnOne);

router.route('/one-on-ones/:id/request-reschedule')
    .patch(isAuthenticatedBoth, writeLimiter, requestRescheduleOneOnOne);

router.route('/one-on-ones/:id/accept-reschedule')
    .patch(isAuthenticatedBoth, writeLimiter, acceptRescheduleOneOnOne);

router.route('/one-on-ones/:id/reject-reschedule')
    .patch(isAuthenticatedBoth, writeLimiter, rejectRescheduleOneOnOne);

router.route('/one-on-ones/:id/cancel')
    .patch(isAuthenticatedBoth, writeLimiter, cancelOneOnOne);

router.route('/one-on-ones/:id/complete')
    .post(isAuthenticatedBoth, writeLimiter, completeOneOnOne);

router.route('/one-on-ones/:id/notes')
    .post(isAuthenticatedBoth, writeLimiter, addMeetingNote);

router.route('/one-on-ones/:id/notes/:noteId')
    .patch(isAuthenticatedBoth, writeLimiter, updateMeetingNote);

export default router;
