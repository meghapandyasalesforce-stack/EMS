import express from 'express';
import { handleRazorpayWebhook } from '../../controllers/organization/billingController.js';

const router = express.Router();

router.post('/razorpay', handleRazorpayWebhook);

export default router;
