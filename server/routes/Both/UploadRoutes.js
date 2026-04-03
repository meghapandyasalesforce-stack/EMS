import express from 'express';
import { 
    addDocument, 
    downloadDocument,
    upload
} from '../../controllers/fileUpload/uploadConfigController.js';
import isAuthenticated from "../../middlewares/isAuthenticated.js";
import isAdminOrHRAuthenticated from '../../middlewares/isAdminOrHRAuthenticated.js';

const router = express.Router();

// Employee uploads documents (employeeId from authenticated user, not URL)
router.post(
    '/document-upload',
    isAuthenticated,
    (req, res, next) => {
        upload(req, res, (err) => {
            if (err) {
                return res.status(400).json({ message: err.message });
            }
            next();
        });
    },
    addDocument // This controller should use req.employee._id instead of req.params.employeeId
);

// Admin or HR downloads employee document (uses employeeId from URL)
router.get(
    '/:employeeId/documents/:documentId/download',
    isAdminOrHRAuthenticated,
    downloadDocument
);

export default router;
