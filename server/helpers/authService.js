/**
 * Shared Authentication Service
 * Extracts common authentication logic to reduce duplication across auth controllers
 */

import User from "../models/user.model.js";
import Employee from "../models/employee.model.js";
import { normalizeEmail, isAccountLocked, handleFailedLogin, resetLoginAttempts, getLockoutMessage } from "./authHelpers.js";
import { generateToken } from "./utils.js";
import { sendSuccess, sendUnauthorized, sendForbidden, sendValidationError } from "./responseHelper.js";
import logger from "./logger.js";

/**
 * Common login logic for admin and employee
 * @param {Object} options - Login options
 * @param {string} options.email - User email
 * @param {string} options.password - User password
 * @param {string} options.userType - 'admin' or 'employee'
 * @param {Object} options.res - Express response object
 * @param {string} options.requestId - Request ID for logging
 * @returns {Promise<Object>} Response object
 */
export const performLogin = async ({ email, password, userType, res, requestId }) => {
  // Normalize email for case-insensitive lookup
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return sendValidationError(res, { email: 'Invalid email format' });
  }

  logger.debug(`${userType} login attempt`, { requestId, email: normalizedEmail });

  // Find user based on type
  let user = null;
  if (userType === 'admin') {
    user = await User.findOne({ email: normalizedEmail }).select('+password');
  } else {
    user = await Employee.findOne({ email: normalizedEmail }).select('+password');
  }

  // Authentication checks
  if (!user) {
    logger.warn(`${userType} login failed: User not found`, { requestId, email: normalizedEmail });
    return sendUnauthorized(res, 'Invalid email or password');
  }

  // Check if account is locked
  if (isAccountLocked(user)) {
    const lockoutMessage = getLockoutMessage(user);
    logger.warn(`${userType} login failed: Account locked`, {
      requestId,
      email: normalizedEmail,
      userId: user._id,
      lockUntil: user.lockUntil
    });
    return sendForbidden(res, lockoutMessage);
  }

  // Check if user is active
  const isActiveField = userType === 'admin' ? user.isActive : user.active;
  if (!isActiveField) {
    logger.warn(`${userType} login failed: Account inactive`, {
      requestId,
      email: normalizedEmail,
      userId: user._id
    });
    return sendForbidden(res, 'Your account is inactive. Please contact administrator.');
  }

  // Verify password
  logger.debug('Comparing password', { requestId, userId: user._id });
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    // Handle failed login attempt (account lockout)
    await handleFailedLogin(user);
    logger.warn(`${userType} login failed: Invalid password`, {
      requestId,
      email: normalizedEmail,
      userId: user._id,
      attempts: user.loginAttempts
    });
    return sendUnauthorized(res, 'Invalid email or password');
  }

  // Reset login attempts on successful login
  await resetLoginAttempts(user);

  const organizationId = user.organizationId;
  logger.info(`${userType} login successful`, {
    requestId,
    email: normalizedEmail,
    userId: user._id,
    organizationId
  });

  // Generate token with organizationId
  const tokenResult = generateToken(user._id, userType, organizationId, res);
  const token = typeof tokenResult === 'object' ? tokenResult.token : tokenResult;
  const refreshToken = typeof tokenResult === 'object' ? tokenResult.refreshToken : undefined;
  const csrfToken = typeof tokenResult === 'object' ? tokenResult.csrfToken : undefined;

  // Prepare user data
  const userData = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: userType
  };

  // Add employee-specific fields if applicable
  if (userType === 'employee') {
    userData.lastName = user.lastName;
    userData.employeeId = user.employeeId;
    userData.mustResetPassword = user.mustResetPassword;
  }

  // Unified response structure
  const response = {
    token,
    [userType === 'admin' ? 'user' : 'employee']: userData
  };

  // Include refresh token and CSRF token in response for cross-site scenarios
  if (refreshToken) {
    response.refreshToken = refreshToken;
  }
  if (csrfToken) {
    response.csrfToken = csrfToken;
  }

  return sendSuccess(res, response, 'Login successful');
};

