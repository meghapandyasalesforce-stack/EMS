import express from 'express';
import {
    createOneOnOne,
    getOneOnOnes,
    getOneOnOneById,
    updateOneOnOne,
    cancelOneOnOne,
    completeOneOnOne,
    acceptOneOnOne,
    declineOneOnOne,
    requestRescheduleOneOnOne,
    respondRescheduleOneOnOne,
    addOneOnOneNote,
    updateOneOnOneNote,
    deleteOneOnOneNote,
    getEligibleInvitees
} from '../../controllers/oneOnOne/oneOnOneController.js';
import { isAuthenticatedBoth } from '../../middlewares/isAuthenticatedBoth.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

router.route('/eligible-invitees')
    .get(isAuthenticatedBoth, readLimiter, getEligibleInvitees);

router.route('/one-on-ones')
    .post(isAuthenticatedBoth, writeLimiter, createOneOnOne)
    .get(isAuthenticatedBoth, readLimiter, getOneOnOnes);

router.route('/one-on-ones/:id')
    .get(isAuthenticatedBoth, readLimiter, getOneOnOneById)
    .put(isAuthenticatedBoth, writeLimiter, updateOneOnOne);

router.route('/one-on-ones/:id/cancel')
    .patch(isAuthenticatedBoth, writeLimiter, cancelOneOnOne);

router.route('/one-on-ones/:id/complete')
    .post(isAuthenticatedBoth, writeLimiter, completeOneOnOne);

router.route('/one-on-ones/:id/accept')
    .patch(isAuthenticatedBoth, writeLimiter, acceptOneOnOne);

router.route('/one-on-ones/:id/decline')
    .patch(isAuthenticatedBoth, writeLimiter, declineOneOnOne);

router.route('/one-on-ones/:id/request-reschedule')
    .patch(isAuthenticatedBoth, writeLimiter, requestRescheduleOneOnOne);

router.route('/one-on-ones/:id/respond-reschedule')
    .patch(isAuthenticatedBoth, writeLimiter, respondRescheduleOneOnOne);

router.route('/one-on-ones/:id/notes')
    .post(isAuthenticatedBoth, writeLimiter, addOneOnOneNote);

router.route('/one-on-ones/:id/notes/:noteId')
    .patch(isAuthenticatedBoth, writeLimiter, updateOneOnOneNote)
    .delete(isAuthenticatedBoth, writeLimiter, deleteOneOnOneNote);

export default router;
