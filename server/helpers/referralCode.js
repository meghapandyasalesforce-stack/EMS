import crypto from 'crypto';

/**
 * Generate a unique referral code
 * @param {number} length - Code length (default: 8)
 * @returns {string} Referral code
 */
export const generateReferralCode = (length = 8) => {
    // Generate a random code using alphanumeric characters
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding confusing characters
    let code = '';
    
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return code;
};

/**
 * Generate a unique referral code with organization name prefix
 * @param {string} orgName - Organization name
 * @param {number} length - Additional code length (default: 6)
 * @returns {string} Referral code with prefix
 */
export const generateReferralCodeWithPrefix = (orgName, length = 6) => {
    // Get first 3-4 characters of organization name (uppercase, alphanumeric only)
    const prefix = orgName
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 4)
        .toUpperCase();
    
    const suffix = generateReferralCode(length);
    return `${prefix}${suffix}`;
};

