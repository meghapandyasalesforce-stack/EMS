import express from 'express';
import { readLimiter, writeLimiter } from '../../middlewares/rateLimiter.js';
import {
    getOfferPortal,
    postOfferPortalRespond,
} from '../../controllers/lifecycle/lifecycleGapController.js';
import { handleEsignWebhook } from '../../controllers/lifecycle/esignWebhookController.js';

const router = express.Router();

router.route('/webhooks/esign/:provider')
    .post(writeLimiter, async (req, res) => {
        try {
            const result = await handleEsignWebhook(req.params.provider, req);
            return res.json({ success: true, data: result });
        } catch (error) {
            const status = error.status || 400;
            return res.status(status).json({
                success: false,
                code: error.code || 'ESIGN_WEBHOOK_FAILED',
                message: error.message,
            });
        }
    });

router.route('/offer/:token')
    .get(readLimiter, getOfferPortal)
    .post(writeLimiter, postOfferPortalRespond);

export default router;
