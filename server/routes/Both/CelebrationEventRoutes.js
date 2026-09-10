import express from 'express';
import {
  getCelebrationEvents,
  getCelebrationEventById,
  reactToCelebrationEvent,
  postCelebrationWish,
  openTodayCelebrationEvent,
} from '../../controllers/celebration/celebrationEventController.js';
import { isAuthenticatedBoth } from '../../middlewares/isAuthenticatedBoth.js';
import { readLimiter, writeLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

router.get('/events', isAuthenticatedBoth, readLimiter, getCelebrationEvents);
router.post('/events/open', isAuthenticatedBoth, writeLimiter, openTodayCelebrationEvent);
router.get('/events/:id', isAuthenticatedBoth, readLimiter, getCelebrationEventById);
router.post('/events/:id/react', isAuthenticatedBoth, writeLimiter, reactToCelebrationEvent);
router.post('/events/:id/wish', isAuthenticatedBoth, writeLimiter, postCelebrationWish);

export default router;
