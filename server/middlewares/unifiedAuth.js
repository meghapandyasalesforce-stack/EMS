/**
 * Unified authentication middleware that works for both admin and employee
 * Uses the new createAuthMiddleware factory for consistency
 */
import { isAdminOrEmployee } from './createAuthMiddleware.js';

// Re-export the pre-configured middleware
const unifiedAuth = isAdminOrEmployee;

export default unifiedAuth;

