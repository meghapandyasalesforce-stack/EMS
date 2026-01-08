import express from 'express';
import {
    createTicket,
    getTickets,
    getTicketById,
    updateTicket,
    addComment,
    resolveTicket,
    getHelpdeskAnalytics
} from '../../controllers/helpdesk/helpdeskController.js';
import { isAuthenticatedBoth } from '../../middlewares/isAuthenticatedBoth.js';
import isAdminOrHRAuthenticated from '../../middlewares/isAdminOrHRAuthenticated.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Tickets
router.route('/tickets')
    .post(isAuthenticatedBoth, writeLimiter, createTicket)
    .get(isAuthenticatedBoth, readLimiter, getTickets);

router.route('/tickets/:id')
    .get(isAuthenticatedBoth, readLimiter, getTicketById)
    .put(isAuthenticatedBoth, writeLimiter, updateTicket);

router.route('/tickets/:id/comment')
    .post(isAuthenticatedBoth, writeLimiter, addComment);

router.route('/tickets/:id/resolve')
    .post(isAuthenticatedBoth, writeLimiter, resolveTicket);

// Analytics (Admin/HR only)
router.route('/analytics')
    .get(isAdminOrHRAuthenticated, readLimiter, getHelpdeskAnalytics);

export default router;

