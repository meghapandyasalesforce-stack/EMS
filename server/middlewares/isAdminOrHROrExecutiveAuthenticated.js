/**
 * Middleware that allows admin users, HR employees, and executives (CEO, CTO, CFO, VP) to access resources
 * 
 * This middleware has been refactored to use the createAuthMiddleware factory pattern
 * to reduce code duplication and improve maintainability.
 * 
 * @deprecated Use isAdminOrHROrExecutive from createAuthMiddleware.js instead
 * This file is kept for backward compatibility but now re-exports the factory-based implementation
 */
import { isAdminOrHROrExecutive } from './createAuthMiddleware.js';

// Re-export the factory-based implementation
const isAdminOrHROrExecutiveAuthenticated = isAdminOrHROrExecutive;

export default isAdminOrHROrExecutiveAuthenticated;

