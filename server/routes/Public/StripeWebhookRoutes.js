import express from 'express';
import { handleStripeWebhook } from '../../controllers/organization/billingController.js';

const router = express.Router();

router.post('/stripe', handleStripeWebhook);

export default router;
