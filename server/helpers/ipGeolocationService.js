/**
 * IP Geolocation Service
 * Validates GPS coordinates against IP-based location to detect GPS spoofing
 * Uses free IP geolocation APIs (ip-api.com or ipapi.co)
 */

import logger from './logger.js';
import { getCache, setCache } from './cache.js';

// Cache IP geolocation results for 24 hours
const IP_CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds

/**
 * Get IP geolocation using free API
 * @param {string} ipAddress - IP address to geolocate
 * @returns {Promise<Object>} - IP geolocation data
 */
export const getIPGeolocation = async (ipAddress) => {
    try {
        // Skip for localhost/private IPs
        if (!ipAddress || ipAddress === 'unknown' || 
            ipAddress.startsWith('127.') || 
            ipAddress.startsWith('192.168.') ||
            ipAddress.startsWith('10.') ||
            ipAddress.startsWith('172.16.')) {
            return {
                success: false,
                reason: 'private_ip',
                message: 'Private IP address, cannot geolocate'
            };
        }

        // Check cache first
        const cacheKey = `ip_geo:${ipAddress}`;
        const cached = await getCache(cacheKey);
        if (cached) {
            logger.debug('IP geolocation cache hit', { ipAddress });
            return cached;
        }

        // Try ip-api.com first (free, 45 requests/minute)
        try {
            // Use node-fetch or built-in fetch (Node 18+)
            const fetchModule = globalThis.fetch || (await import('node-fetch')).default;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetchModule(`http://ip-api.com/json/${ipAddress}?fields=status,message,country,regionName,city,lat,lon,timezone,isp,query`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`IP API returned ${response.status}`);
            }

            const data = await response.json();
            
            if (data.status === 'success') {
                const result = {
                    success: true,
                    ip: data.query,
                    country: data.country,
                    region: data.regionName,
                    city: data.city,
                    latitude: data.lat,
                    longitude: data.lon,
                    timezone: data.timezone,
                    isp: data.isp,
                    source: 'ip-api.com'
                };

                // Cache result
                await setCache(cacheKey, result, IP_CACHE_TTL);
                
                return result;
            } else {
                throw new Error(data.message || 'IP geolocation failed');
            }
        } catch (ipApiError) {
            logger.warn('ip-api.com failed, trying fallback', { 
                error: ipApiError.message,
                ipAddress 
            });

            // Fallback to ipapi.co (free tier: 1000 requests/day)
            try {
                const fetchModule = globalThis.fetch || (await import('node-fetch')).default;
                const apiKey = process.env.IPAPI_API_KEY || '';
                const url = apiKey 
                    ? `https://ipapi.co/${ipAddress}/json/?key=${apiKey}`
                    : `https://ipapi.co/${ipAddress}/json/`;
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                
                const response = await fetchModule(url, { 
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`IP API fallback returned ${response.status}`);
                }

                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.reason || 'IP geolocation failed');
                }

                const result = {
                    success: true,
                    ip: data.ip || ipAddress,
                    country: data.country_name,
                    region: data.region,
                    city: data.city,
                    latitude: parseFloat(data.latitude),
                    longitude: parseFloat(data.longitude),
                    timezone: data.timezone,
                    isp: data.org,
                    source: 'ipapi.co'
                };

                // Cache result
                await setCache(cacheKey, result, IP_CACHE_TTL);
                
                return result;
            } catch (fallbackError) {
                logger.error('IP geolocation fallback failed', {
                    error: fallbackError.message,
                    ipAddress
                });
                
                return {
                    success: false,
                    reason: 'api_failure',
                    message: 'IP geolocation service unavailable'
                };
            }
        }
    } catch (error) {
        logger.error('IP geolocation error', {
            error: error.message,
            ipAddress,
            stack: error.stack
        });
        
        return {
            success: false,
            reason: 'error',
            message: error.message
        };
    }
};

/**
 * Validate GPS coordinates against IP geolocation
 * Detects potential GPS spoofing
 * @param {number} gpsLatitude - GPS latitude
 * @param {number} gpsLongitude - GPS longitude
 * @param {string} ipAddress - Client IP address
 * @param {number} allowedDistanceKm - Maximum allowed distance in km (default: 50km)
 * @returns {Promise<Object>} - Validation result
 */
export const validateGPSAgainstIP = async (gpsLatitude, gpsLongitude, ipAddress, allowedDistanceKm = 50) => {
    try {
        // Get IP geolocation
        const ipGeo = await getIPGeolocation(ipAddress);
        
        if (!ipGeo.success) {
            // If IP geolocation fails, we can't validate but don't block
            // Log for monitoring
            logger.warn('IP geolocation unavailable, skipping GPS validation', {
                ipAddress,
                reason: ipGeo.reason
            });
            
            return {
                isValid: true, // Don't block if we can't validate
                warning: true,
                reason: 'ip_geo_unavailable',
                message: 'IP geolocation unavailable, GPS validation skipped'
            };
        }

        // Calculate distance between GPS and IP location
        const distance = calculateDistance(
            gpsLatitude,
            gpsLongitude,
            ipGeo.latitude,
            ipGeo.longitude
        );

        const distanceKm = distance / 1000; // Convert meters to km

        // If distance is too large, potential GPS spoofing
        if (distanceKm > allowedDistanceKm) {
            logger.warn('GPS spoofing detected', {
                ipAddress,
                gpsLocation: { lat: gpsLatitude, lng: gpsLongitude },
                ipLocation: { lat: ipGeo.latitude, lng: ipGeo.longitude },
                distanceKm,
                allowedDistanceKm
            });

            return {
                isValid: false,
                reason: 'gps_spoofing_suspected',
                message: `GPS location (${distanceKm.toFixed(2)}km away) does not match IP location (${ipGeo.city}, ${ipGeo.country})`,
                gpsLocation: { latitude: gpsLatitude, longitude: gpsLongitude },
                ipLocation: { 
                    latitude: ipGeo.latitude, 
                    longitude: ipGeo.longitude,
                    city: ipGeo.city,
                    country: ipGeo.country
                },
                distanceKm: parseFloat(distanceKm.toFixed(2))
            };
        }

        // Location matches (within allowed distance)
        return {
            isValid: true,
            distanceKm: parseFloat(distanceKm.toFixed(2)),
            ipLocation: {
                city: ipGeo.city,
                country: ipGeo.country
            }
        };
    } catch (error) {
        logger.error('GPS validation error', {
            error: error.message,
            ipAddress,
            stack: error.stack
        });
        
        // Don't block on validation errors, but log for monitoring
        return {
            isValid: true,
            warning: true,
            reason: 'validation_error',
            message: 'GPS validation error occurred'
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
 * Check if IP geolocation service is available
 * @returns {boolean}
 */
export const isIPGeolocationAvailable = () => {
    // Service is available if we can make HTTP requests
    return true; // Always available (uses free APIs)
};

