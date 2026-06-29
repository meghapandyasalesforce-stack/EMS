import express from "express";
import {
    createLeave,
    getMyLeaves,
    getMyLeaveBalance,
    cancelLeave,
    uploadLeaveDocument,
    leaveDocumentUpload
} from "../../controllers/leave/leaveEmployeeController.js";
import isAuthenticated from "../../middlewares/isAuthenticated.js";

const router = express.Router();

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

router.route("/cancel/:id").put(isAuthenticated, cancelLeave);

export default router;
