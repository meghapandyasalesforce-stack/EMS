import express from 'express';
import { getOrganizationTimezoneContext } from '../../controllers/both/organizationTimezoneController.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';

const router = express.Router();

router.get('/', isAuthenticated, getOrganizationTimezoneContext);

export default router;
