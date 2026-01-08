/**
 * Location Validation Service
 * Comprehensive location validation with accuracy checks, GPS spoofing detection,
 * and fallback mechanisms
 */

import logger from './logger.js';
import { validateGPSAgainstIP } from './ipGeolocationService.js';
import { getCache, setCache } from './cache.js';

// Cache validation results for 1 hour
const VALIDATION_CACHE_TTL = 60 * 60; // 1 hour

/**
 * Validate location with comprehensive checks
 * @param {Object} params - Validation parameters
 * @param {number} params.latitude - GPS latitude
 * @param {number} params.longitude - GPS longitude
 * @param {number} params.accuracy - GPS accuracy in meters (optional)
 * @param {string} params.ipAddress - Client IP address
 * @param {Object} params.ruleCoordinates - Office coordinates from attendance rule
 * @param {number} params.maximumRadius - Maximum allowed radius in meters
 * @param {boolean} params.enableGPSValidation - Enable GPS spoofing detection
 * @param {boolean} params.enableAccuracyCheck - Enable accuracy filtering
 * @param {number} params.minAccuracy - Minimum required accuracy in meters (default: 100m)
 * @param {boolean} params.allowFallback - Allow fallback if GPS unavailable
 * @returns {Promise<Object>} - Validation result
 */
export const validateLocation = async ({
    latitude,
    longitude,
    accuracy,
    ipAddress,
    ruleCoordinates,
    maximumRadius,
    enableGPSValidation = true,
    enableAccuracyCheck = true,
    minAccuracy = 100, // Default: 100 meters
    allowFallback = true
}) => {
    try {
        // 1. Basic coordinate validation
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
            return {
                isValid: false,
                reason: 'invalid_coordinates',
                message: 'Invalid GPS coordinates provided',
                requiresFallback: allowFallback
            };
        }

        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return {
                isValid: false,
                reason: 'out_of_range',
                message: 'GPS coordinates out of valid range',
                requiresFallback: allowFallback
            };
        }

        // 2. GPS Accuracy Check (if accuracy data available)
        if (enableAccuracyCheck && typeof accuracy === 'number') {
            if (accuracy > minAccuracy) {
                logger.warn('GPS accuracy too low', {
                    accuracy,
                    minAccuracy,
                    latitude,
                    longitude
                });

                // If accuracy is too low, allow fallback if enabled
                if (allowFallback) {
                    return {
                        isValid: false,
                        reason: 'low_accuracy',
                        message: `GPS accuracy (${accuracy}m) is below required threshold (${minAccuracy}m)`,
                        requiresFallback: true,
                        warning: true
                    };
                } else {
                    return {
                        isValid: false,
                        reason: 'low_accuracy',
                        message: `GPS accuracy (${accuracy}m) is below required threshold (${minAccuracy}m)`,
                        requiresFallback: false
                    };
                }
            }
        }

        // 3. GPS Spoofing Detection (IP-based validation)
        if (enableGPSValidation && ipAddress && ipAddress !== 'unknown') {
            const gpsValidation = await validateGPSAgainstIP(
                latitude,
                longitude,
                ipAddress,
                50 // Allow 50km difference (configurable)
            );

            if (!gpsValidation.isValid) {
                logger.warn('GPS spoofing detected', {
                    latitude,
                    longitude,
                    ipAddress,
                    validation: gpsValidation
                });

                return {
                    isValid: false,
                    reason: 'gps_spoofing_detected',
                    message: gpsValidation.message,
                    details: gpsValidation,
                    requiresFallback: false, // Don't allow fallback for spoofing
                    securityAlert: true
                };
            }

            // Add IP validation info to result
            if (gpsValidation.warning) {
                logger.warn('GPS validation warning', gpsValidation);
            }
        }

        // 4. Distance Check (if rule coordinates provided)
        if (ruleCoordinates && maximumRadius) {
            const distance = calculateDistance(
                latitude,
                longitude,
                ruleCoordinates.latitude,
                ruleCoordinates.longitude
            );

            if (distance > maximumRadius) {
                return {
                    isValid: false,
                    reason: 'outside_radius',
                    message: `Location is ${Math.round(distance)}m away, maximum allowed is ${maximumRadius}m`,
                    distance: Math.round(distance),
                    maximumRadius,
                    requiresFallback: allowFallback
                };
            }

            return {
                isValid: true,
                distance: Math.round(distance),
                maximumRadius,
                accuracy: accuracy || null,
                withinRadius: true
            };
        }

        // If no rule coordinates, just validate GPS is valid
        return {
            isValid: true,
            accuracy: accuracy || null,
            warning: enableGPSValidation && !ipAddress ? 'IP validation skipped' : null
        };

    } catch (error) {
        logger.error('Location validation error', {
            error: error.message,
            stack: error.stack,
            latitude,
            longitude
        });

        // On error, allow fallback if enabled
        return {
            isValid: false,
            reason: 'validation_error',
            message: 'Location validation error occurred',
            requiresFallback: allowFallback,
            error: error.message
        };
    }
};

/**
 * Check if location is within office radius with caching
 * @param {number} latitude - GPS latitude
 * @param {number} longitude - GPS longitude
 * @param {Object} ruleCoordinates - Office coordinates
 * @param {number} maximumRadius - Maximum radius in meters
 * @returns {Promise<Object>} - Distance check result
 */
export const checkLocationWithinRadius = async (latitude, longitude, ruleCoordinates, maximumRadius) => {
    try {
        // Create cache key
        const cacheKey = `loc_check:${latitude.toFixed(4)}:${longitude.toFixed(4)}:${ruleCoordinates.latitude.toFixed(4)}:${ruleCoordinates.longitude.toFixed(4)}:${maximumRadius}`;
        
        // Check cache
        const cached = await getCache(cacheKey);
        if (cached) {
            return cached;
        }

        const distance = calculateDistance(
            latitude,
            longitude,
            ruleCoordinates.latitude,
            ruleCoordinates.longitude
        );

        const result = {
            isWithinRadius: distance <= maximumRadius,
            distance: Math.round(distance),
            maximumRadius,
            percentage: Math.min(100, Math.round((distance / maximumRadius) * 100))
        };

        // Cache for 5 minutes (locations don't change that fast)
        await setCache(cacheKey, result, 300);

        return result;
    } catch (error) {
        logger.error('Radius check error', {
            error: error.message,
            latitude,
            longitude
        });

        return {
            isWithinRadius: false,
            distance: null,
            maximumRadius,
            error: error.message
        };
    }
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude 1
 * @param {number} lon1 - Longitude 1
 * @param {number} lat2 - Latitude 2
 * @param {number} lon2 - Longitude 2
 * @returns {number} - Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const toRad = (v) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Handle GPS failure with fallback options
 * @param {Object} params - Fallback parameters
 * @param {string} params.ipAddress - Client IP address
 * @param {Object} params.ruleCoordinates - Office coordinates
 * @param {number} params.maximumRadius - Maximum radius
 * @param {boolean} params.allowIPFallback - Allow IP-based fallback
 * @returns {Promise<Object>} - Fallback validation result
 */
export const handleGPSFailure = async ({
    ipAddress,
    ruleCoordinates,
    maximumRadius,
    allowIPFallback = true
}) => {
    try {
        if (!allowIPFallback) {
            return {
                isValid: false,
                reason: 'gps_required',
                message: 'GPS location is required and unavailable',
                requiresFallback: false
            };
        }

        // Try IP-based location as fallback
        const { getIPGeolocation } = await import('./ipGeolocationService.js');
        const ipGeo = await getIPGeolocation(ipAddress);

        if (!ipGeo.success || !ipGeo.latitude || !ipGeo.longitude) {
            return {
                isValid: false,
                reason: 'no_location_data',
                message: 'GPS unavailable and IP geolocation failed',
                requiresFallback: false
            };
        }

        // Validate IP location against office
        if (ruleCoordinates && maximumRadius) {
            const distance = calculateDistance(
                ipGeo.latitude,
                ipGeo.longitude,
                ruleCoordinates.latitude,
                ruleCoordinates.longitude
            );

            return {
                isValid: distance <= maximumRadius,
                reason: 'ip_fallback',
                message: 'Using IP-based location (GPS unavailable)',
                distance: Math.round(distance),
                maximumRadius,
                locationSource: 'ip',
                ipLocation: {
                    city: ipGeo.city,
                    country: ipGeo.country,
                    latitude: ipGeo.latitude,
                    longitude: ipGeo.longitude
                },
                warning: true
            };
        }

        return {
            isValid: true,
            reason: 'ip_fallback',
            message: 'Using IP-based location (GPS unavailable)',
            locationSource: 'ip',
            warning: true
        };

    } catch (error) {
        logger.error('GPS failure fallback error', {
            error: error.message,
            ipAddress
        });

        return {
            isValid: false,
            reason: 'fallback_error',
            message: 'GPS unavailable and fallback failed',
            requiresFallback: false
        };
    }
};

