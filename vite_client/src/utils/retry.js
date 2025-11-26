/**
 * Retry utility for API calls
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.delay - Delay between retries in ms (default: 1000)
 * @param {Function} options.shouldRetry - Function to determine if error should be retried
 * @returns {Promise} - Promise that resolves with the function result
 */
export const retry = async (fn, options = {}) => {
    const {
        maxRetries = 3,
        delay = 1000,
        shouldRetry = (error) => {
            // Don't retry on 4xx errors (client errors)
            if (error.response?.status >= 400 && error.response?.status < 500) {
                return false;
            }
            // Retry on network errors and 5xx errors
            return true;
        }
    } = options;

    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            // Don't retry if we've exceeded max retries
            if (attempt >= maxRetries) {
                break;
            }
            
            // Don't retry if shouldRetry returns false
            if (!shouldRetry(error)) {
                break;
            }
            
            // Wait before retrying (exponential backoff)
            const waitTime = delay * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    
    throw lastError;
};

/**
 * Retry wrapper for axios calls
 * @param {Function} axiosCall - Function that returns an axios promise
 * @param {Object} options - Retry options
 * @returns {Promise} - Promise that resolves with the axios response
 */
export const retryAxios = (axiosCall, options = {}) => {
    return retry(axiosCall, options);
};

