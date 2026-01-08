/**
 * Device Fingerprint Service
 * Creates and validates device fingerprints to prevent device spoofing
 * and detect unauthorized device usage
 */

import crypto from 'crypto';
import logger from './logger.js';
import { getCache, setCache } from './cache.js';

// Cache device fingerprints for 30 days
const FINGERPRINT_CACHE_TTL = 30 * 24 * 60 * 60; // 30 days

/**
 * Generate device fingerprint from request headers and user agent
 * @param {Object} req - Express request object
 * @returns {string} - Device fingerprint hash
 */
export const generateDeviceFingerprint = (req) => {
    try {
        const userAgent = req.get('User-Agent') || '';
        const acceptLanguage = req.get('Accept-Language') || '';
        const acceptEncoding = req.get('Accept-Encoding') || '';
        const acceptCharset = req.get('Accept-Charset') || '';
        const connection = req.get('Connection') || '';
        const platform = req.body.devicePlatform || '';
        const screenResolution = req.body.screenResolution || '';
        const timezone = req.body.timezone || '';

        // Combine all fingerprintable data
        const fingerprintData = [
            userAgent,
            acceptLanguage,
            acceptEncoding,
            acceptCharset,
            connection,
            platform,
            screenResolution,
            timezone
        ].join('|');

        // Generate SHA-256 hash
        const hash = crypto
            .createHash('sha256')
            .update(fingerprintData)
            .digest('hex');

        return hash;
    } catch (error) {
        logger.error('Device fingerprint generation error', {
            error: error.message,
            stack: error.stack
        });
        return null;
    }
};

/**
 * Validate device fingerprint for employee
 * @param {string} employeeId - Employee ID
 * @param {string} fingerprint - Current device fingerprint
 * @param {boolean} allowNewDevice - Allow new device registration
 * @returns {Promise<Object>} - Validation result
 */
export const validateDeviceFingerprint = async (employeeId, fingerprint, allowNewDevice = true) => {
    try {
        if (!fingerprint) {
            return {
                isValid: false,
                reason: 'no_fingerprint',
                message: 'Device fingerprint not provided'
            };
        }

        const cacheKey = `device_fp:${employeeId}`;
        
        // Get stored fingerprints for employee
        let storedFingerprints = await getCache(cacheKey);
        
        if (!storedFingerprints) {
            // First time or cache expired, allow if enabled
            if (allowNewDevice) {
                // Store new fingerprint
                storedFingerprints = [fingerprint];
                await setCache(cacheKey, storedFingerprints, FINGERPRINT_CACHE_TTL);
                
                return {
                    isValid: true,
                    isNewDevice: true,
                    message: 'New device registered'
                };
            } else {
                return {
                    isValid: false,
                    reason: 'no_registered_device',
                    message: 'No registered device found. Device registration required.'
                };
            }
        }

        // Check if fingerprint matches any stored fingerprint
        if (Array.isArray(storedFingerprints)) {
            if (storedFingerprints.includes(fingerprint)) {
                return {
                    isValid: true,
                    isNewDevice: false,
                    message: 'Device verified'
                };
            }
        } else if (storedFingerprints === fingerprint) {
            // Legacy single fingerprint format
            return {
                isValid: true,
                isNewDevice: false,
                message: 'Device verified'
            };
        }

        // New device detected
        if (allowNewDevice) {
            // Add to stored fingerprints (limit to 3 devices)
            const fingerprints = Array.isArray(storedFingerprints) 
                ? storedFingerprints 
                : [storedFingerprints];
            
            if (fingerprints.length >= 3) {
                // Remove oldest, add newest
                fingerprints.shift();
            }
            
            fingerprints.push(fingerprint);
            await setCache(cacheKey, fingerprints, FINGERPRINT_CACHE_TTL);
            
            return {
                isValid: true,
                isNewDevice: true,
                message: 'New device registered',
                warning: true
            };
        } else {
            return {
                isValid: false,
                reason: 'unknown_device',
                message: 'Device not recognized. Please use a registered device.',
                securityAlert: true
            };
        }

    } catch (error) {
        logger.error('Device fingerprint validation error', {
            error: error.message,
            employeeId,
            stack: error.stack
        });

        // On error, allow if configured to be permissive
        return {
            isValid: process.env.ALLOW_DEVICE_VALIDATION_FAILURE === 'true',
            reason: 'validation_error',
            message: 'Device validation error occurred',
            warning: true
        };
    }
};

/**
 * Register device for employee (admin action)
 * @param {string} employeeId - Employee ID
 * @param {string} fingerprint - Device fingerprint
 * @returns {Promise<Object>} - Registration result
 */
export const registerDevice = async (employeeId, fingerprint) => {
    try {
        const cacheKey = `device_fp:${employeeId}`;
        let storedFingerprints = await getCache(cacheKey) || [];
        
        if (!Array.isArray(storedFingerprints)) {
            storedFingerprints = [storedFingerprints];
        }

        if (!storedFingerprints.includes(fingerprint)) {
            storedFingerprints.push(fingerprint);
            
            // Limit to 5 registered devices
            if (storedFingerprints.length > 5) {
                storedFingerprints = storedFingerprints.slice(-5);
            }
            
            await setCache(cacheKey, storedFingerprints, FINGERPRINT_CACHE_TTL);
        }

        return {
            success: true,
            message: 'Device registered successfully',
            deviceCount: storedFingerprints.length
        };
    } catch (error) {
        logger.error('Device registration error', {
            error: error.message,
            employeeId
        });

        return {
            success: false,
            message: 'Device registration failed'
        };
    }
};

/**
 * Get registered devices for employee
 * @param {string} employeeId - Employee ID
 * @returns {Promise<Array>} - List of registered fingerprints
 */
export const getRegisteredDevices = async (employeeId) => {
    try {
        const cacheKey = `device_fp:${employeeId}`;
        const storedFingerprints = await getCache(cacheKey);
        
        return Array.isArray(storedFingerprints) 
            ? storedFingerprints 
            : (storedFingerprints ? [storedFingerprints] : []);
    } catch (error) {
        logger.error('Get registered devices error', {
            error: error.message,
            employeeId
        });
        return [];
    }
};

/**
 * Remove device for employee
 * @param {string} employeeId - Employee ID
 * @param {string} fingerprint - Device fingerprint to remove
 * @returns {Promise<Object>} - Removal result
 */
export const removeDevice = async (employeeId, fingerprint) => {
    try {
        const cacheKey = `device_fp:${employeeId}`;
        let storedFingerprints = await getCache(cacheKey) || [];
        
        if (!Array.isArray(storedFingerprints)) {
            storedFingerprints = [storedFingerprints];
        }

        const index = storedFingerprints.indexOf(fingerprint);
        if (index > -1) {
            storedFingerprints.splice(index, 1);
            await setCache(cacheKey, storedFingerprints, FINGERPRINT_CACHE_TTL);
            
            return {
                success: true,
                message: 'Device removed successfully',
                deviceCount: storedFingerprints.length
            };
        }

        return {
            success: false,
            message: 'Device not found'
        };
    } catch (error) {
        logger.error('Device removal error', {
            error: error.message,
            employeeId
        });

        return {
            success: false,
            message: 'Device removal failed'
        };
    }
};

