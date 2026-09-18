import express from "express";
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import {
    createLeave,
    getMyLeaves,
    getMyLeaveBalance,
    cancelLeave,
    uploadLeaveDocument,
    downloadMyLeaveDocument,
    leaveDocumentUpload
} from "../../controllers/leave/leaveEmployeeController.js";
import isAuthenticated from "../../middlewares/isAuthenticated.js";
import { readLimiter } from "../../middlewares/rateLimiter.js";

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.LEAVE));

router.route("/create-leave").post(isAuthenticated, createLeave);

router.route("/get-my-leaves").get(isAuthenticated, getMyLeaves);

router.route("/balance").get(isAuthenticated, getMyLeaveBalance);

router.route("/upload-document").post(
    isAuthenticated,
    (req, res, next) => {
        leaveDocumentUpload(req, res, (err) => {
            if (err) {
                return res.status(400).json({ success: false, message: err.message });
            }
            next();
        });
    },
    uploadLeaveDocument
);

router.route("/:id/document/download")
    .get(isAuthenticated, readLimiter, downloadMyLeaveDocument);

router.route("/cancel/:id").put(isAuthenticated, cancelLeave);

export default router;
