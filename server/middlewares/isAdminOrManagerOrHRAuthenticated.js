/**
 * Middleware that allows admin users, HR employees, Managers/Directors, and Executives (CEO, CTO, CFO, VP) to access resources
 * 
 * This middleware has been refactored to use the createAuthMiddleware factory pattern
 * to reduce code duplication and improve maintainability.
 * 
 * @deprecated Use isAdminOrManagerOrHR from createAuthMiddleware.js instead
 * This file is kept for backward compatibility but now re-exports the factory-based implementation
 */
import { isAdminOrManagerOrHR } from './createAuthMiddleware.js';

// Re-export the factory-based implementation
const isAdminOrManagerOrHRAuthenticated = isAdminOrManagerOrHR;

export default isAdminOrManagerOrHRAuthenticated;

