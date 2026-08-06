import express from 'express';
import {
    getSelfServiceApplication,
    postSelfServiceApplication,
} from '../../controllers/recruitment/selfServiceController.js';
import { readLimiter, writeLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

router.route('/application/:token')
    .get(readLimiter, getSelfServiceApplication)
    .post(writeLimiter, postSelfServiceApplication);

export default router;
