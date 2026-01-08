import { Client } from '@googlemaps/google-maps-services-js';
import logger from './logger.js';
import { getCache, setCache } from './cache.js';

/**
 * Google Maps Geocoding Service
 * Provides geocoding (address to coordinates) and reverse geocoding (coordinates to address)
 * Includes caching and rate limiting to prevent API overuse
 */

const client = new Client({});

// Cache TTL: 30 days for addresses (they don't change often)
const GEOCODE_CACHE_TTL = 30 * 24 * 60 * 60; // 30 days
const REVERSE_GEOCODE_CACHE_TTL = 30 * 24 * 60 * 60; // 30 days

// Rate limiting: Track API calls per hour
const RATE_LIMIT_WINDOW = 60 * 60; // 1 hour
const MAX_REQUESTS_PER_HOUR = 100; // Conservative limit

// Track API usage
let apiCallCount = 0;
let apiCallWindowStart = Date.now();

/**
 * Check and enforce rate limiting
 * @returns {boolean} - True if within rate limit
 */
function checkRateLimit() {
    const now = Date.now();
    const windowElapsed = (now - apiCallWindowStart) / 1000; // seconds

    // Reset window if hour has passed
    if (windowElapsed >= RATE_LIMIT_WINDOW) {
        apiCallCount = 0;
        apiCallWindowStart = now;
    }

    // Check if over limit
    if (apiCallCount >= MAX_REQUESTS_PER_HOUR) {
        logger.warn('Geocoding API rate limit reached', {
            count: apiCallCount,
            limit: MAX_REQUESTS_PER_HOUR
        });
        return false;
    }

    apiCallCount++;
    return true;
}

/**
 * Geocode an address to get coordinates
 * @param {string} address - The address to geocode
 * @returns {Promise<Object>} - Object with latitude, longitude, and formatted address
 */
export const geocodeAddress = async (address, useCache = true) => {
    try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
        
        if (!apiKey) {
            logger.warn('Google Maps API key not configured. Geocoding unavailable.');
            throw new Error('Google Maps API key not configured');
        }

        if (!address || typeof address !== 'string' || address.trim().length === 0) {
            throw new Error('Address is required for geocoding');
        }

        const normalizedAddress = address.trim().toLowerCase();

        // Check cache first
        if (useCache) {
            const cacheKey = `geocode:${normalizedAddress}`;
            const cached = await getCache(cacheKey);
            if (cached) {
                logger.debug('Geocoding cache hit', { address: normalizedAddress });
                return cached;
            }
        }

        // Check rate limit
        if (!checkRateLimit()) {
            throw new Error('Geocoding API rate limit exceeded. Please try again later.');
        }

        const response = await client.geocode({
            params: {
                address: address.trim(),
                key: apiKey,
            },
            timeout: 5000, // 5 second timeout
        });

        if (!response.data || !response.data.results || response.data.results.length === 0) {
            throw new Error('No results found for the provided address');
        }

        const result = response.data.results[0];
        const location = result.geometry.location;

        const geocodeResult = {
            success: true,
            latitude: location.lat,
            longitude: location.lng,
            formattedAddress: result.formatted_address,
            addressComponents: result.address_components,
            placeId: result.place_id,
            locationType: result.geometry.location_type,
            viewport: result.geometry.viewport,
            cached: false
        };

        // Cache result
        if (useCache) {
            const cacheKey = `geocode:${normalizedAddress}`;
            await setCache(cacheKey, geocodeResult, GEOCODE_CACHE_TTL);
        }

        return geocodeResult;
    } catch (error) {
        logger.error('Geocoding error', {
            error: error.message,
            address: address,
            stack: error.stack
        });
        
        // Return a more user-friendly error message
        if (error.response?.data?.error_message) {
            throw new Error(error.response.data.error_message);
        }
        
        throw error;
    }
};

/**
 * Reverse geocode coordinates to get address
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {Promise<Object>} - Object with formatted address and address components
 */
export const reverseGeocode = async (latitude, longitude, useCache = true) => {
    try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
        
        if (!apiKey) {
            logger.warn('Google Maps API key not configured. Reverse geocoding unavailable.');
            throw new Error('Google Maps API key not configured');
        }

        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
            throw new Error('Valid latitude and longitude coordinates are required');
        }

        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            throw new Error('Invalid coordinate values');
        }

        // Round coordinates to 4 decimal places for cache key (~11m precision)
        const roundedLat = parseFloat(latitude.toFixed(4));
        const roundedLng = parseFloat(longitude.toFixed(4));

        // Check cache first
        if (useCache) {
            const cacheKey = `reverse_geocode:${roundedLat}:${roundedLng}`;
            const cached = await getCache(cacheKey);
            if (cached) {
                logger.debug('Reverse geocoding cache hit', { latitude: roundedLat, longitude: roundedLng });
                return cached;
            }
        }

        // Check rate limit
        if (!checkRateLimit()) {
            throw new Error('Geocoding API rate limit exceeded. Please try again later.');
        }

        const response = await client.reverseGeocode({
            params: {
                latlng: { lat: latitude, lng: longitude },
                key: apiKey,
            },
            timeout: 5000, // 5 second timeout
        });

        if (!response.data || !response.data.results || response.data.results.length === 0) {
            throw new Error('No address found for the provided coordinates');
        }

        const result = response.data.results[0];

        const reverseGeocodeResult = {
            success: true,
            formattedAddress: result.formatted_address,
            addressComponents: result.address_components,
            placeId: result.place_id,
            locationType: result.geometry.location_type,
            cached: false
        };

        // Cache result
        if (useCache) {
            const cacheKey = `reverse_geocode:${roundedLat}:${roundedLng}`;
            await setCache(cacheKey, reverseGeocodeResult, REVERSE_GEOCODE_CACHE_TTL);
        }

        return reverseGeocodeResult;
    } catch (error) {
        logger.error('Reverse geocoding error', {
            error: error.message,
            latitude,
            longitude,
            stack: error.stack
        });
        
        // Return a more user-friendly error message
        if (error.response?.data?.error_message) {
            throw new Error(error.response.data.error_message);
        }
        
        throw error;
    }
};

/**
 * Check if geocoding service is available
 * @returns {boolean} - True if API key is configured
 */
export const isGeocodingAvailable = () => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
    return !!apiKey;
};

/**
 * Get geocoding API usage statistics
 * @returns {Object} - Usage statistics
 */
export const getGeocodingStats = () => {
    const now = Date.now();
    const windowElapsed = (now - apiCallWindowStart) / 1000;
    const windowRemaining = Math.max(0, RATE_LIMIT_WINDOW - windowElapsed);
    const requestsRemaining = Math.max(0, MAX_REQUESTS_PER_HOUR - apiCallCount);

    return {
        callsInCurrentWindow: apiCallCount,
        maxCallsPerHour: MAX_REQUESTS_PER_HOUR,
        requestsRemaining,
        windowRemainingSeconds: Math.round(windowRemaining),
        rateLimitReached: apiCallCount >= MAX_REQUESTS_PER_HOUR
    };
};

