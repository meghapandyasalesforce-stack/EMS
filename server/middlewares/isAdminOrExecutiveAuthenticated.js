/**
 * Middleware that allows admin users and executives (CEO, CTO, CFO, VP) to access resources
 * 
 * This middleware has been refactored to use the createAuthMiddleware factory pattern
 * to reduce code duplication and improve maintainability.
 * 
 * @deprecated Use isAdminOrExecutive from createAuthMiddleware.js instead
 * This file is kept for backward compatibility but now re-exports the factory-based implementation
 */
import { isAdminOrExecutive } from './createAuthMiddleware.js';

// Re-export the factory-based implementation
const isAdminOrExecutiveAuthenticated = isAdminOrExecutive;

export default isAdminOrExecutiveAuthenticated;

