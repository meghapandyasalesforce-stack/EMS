/**
 * Location validation and helper utilities
 */

/**
 * Validate if coordinates are valid
 * @param {number} latitude 
 * @param {number} longitude 
 * @returns {boolean}
 */
export const isValidCoordinates = (latitude, longitude) => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return false;
  }
  
  if (isNaN(latitude) || isNaN(longitude)) {
    return false;
  }
  
  // Check if both are 0 (invalid)
  if (latitude === 0 && longitude === 0) {
    return false;
  }
  
  // Check ranges
  if (latitude < -90 || latitude > 90) {
    return false;
  }
  
  if (longitude < -180 || longitude > 180) {
    return false;
  }
  
  return true;
};

/**
 * Normalize coordinates to numbers
 * @param {any} latitude 
 * @param {any} longitude 
 * @returns {{latitude: number | undefined, longitude: number | undefined}}
 */
export const normalizeCoordinates = (latitude, longitude) => {
  const normalizeCoord = (value, isLatitude) => {
    if (value == null || value === '' || value === 'null' || value === 'undefined') {
      return undefined;
    }
    const num = Number(value);
    if (isNaN(num)) {
      return undefined;
    }
    // Validate coordinate ranges
    if (isLatitude) {
      if (num < -90 || num > 90) return undefined;
    } else {
      if (num < -180 || num > 180) return undefined;
    }
    // Reject (0,0) as invalid
    if (num === 0 && (isLatitude ? longitude === 0 : latitude === 0)) {
      return undefined;
    }
    return num;
  };

  return {
    latitude: normalizeCoord(latitude, true),
    longitude: normalizeCoord(longitude, false)
  };
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in meters
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
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
};

/**
 * Check if location is within radius
 * @param {number} userLat 
 * @param {number} userLon 
 * @param {number} officeLat 
 * @param {number} officeLon 
 * @param {number} maxRadius 
 * @returns {{distance: number, isWithinRadius: boolean} | null}
 */
export const checkLocationWithinRadius = (userLat, userLon, officeLat, officeLon, maxRadius) => {
  if (!isValidCoordinates(userLat, userLon) || !isValidCoordinates(officeLat, officeLon)) {
    return null;
  }
  
  const distance = calculateDistance(userLat, userLon, officeLat, officeLon);
  return {
    distance: Math.round(distance),
    isWithinRadius: distance <= maxRadius
  };
};

