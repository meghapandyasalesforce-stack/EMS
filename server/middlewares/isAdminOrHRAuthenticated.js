/**
 * Middleware that allows both admin users and HR employees to access resources
 * 
 * This middleware has been refactored to use the createAuthMiddleware factory pattern
 * to reduce code duplication and improve maintainability.
 * 
 * @deprecated Use isAdminOrHR from createAuthMiddleware.js instead
 * This file is kept for backward compatibility but now re-exports the factory-based implementation
 */
import { isAdminOrHR } from './createAuthMiddleware.js';

// Re-export the factory-based implementation
const isAdminOrHRAuthenticated = isAdminOrHR;

export default isAdminOrHRAuthenticated;

