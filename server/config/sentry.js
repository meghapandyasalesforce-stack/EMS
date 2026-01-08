/**
 * Sentry Error Tracking Configuration
 * Optional error tracking integration
 * 
 * Setup:
 * 1. Install: npm install @sentry/node
 * 2. Get DSN from https://sentry.io/
 * 3. Set SENTRY_DSN environment variable
 * 4. Errors will be automatically tracked in production
 */

import logger from '../helpers/logger.js';

/**
 * Initialize Sentry error tracking
 * Only initializes if SENTRY_DSN is configured
 */
export const initSentry = async () => {
    const sentryDsn = process.env.SENTRY_DSN;
    
    if (!sentryDsn) {
        logger.info('Sentry not configured (SENTRY_DSN not set)');
        return false;
    }
    
    try {
        const Sentry = await import('@sentry/node');
        
        Sentry.default.init({
            dsn: sentryDsn,
            environment: process.env.NODE_ENV || 'development',
            tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'), // 10% of transactions
            profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'), // 10% of profiles
            beforeSend(event, hint) {
                // Filter out sensitive data
                if (event.request) {
                    // Remove sensitive headers
                    if (event.request.headers) {
                        delete event.request.headers['authorization'];
                        delete event.request.headers['cookie'];
                        delete event.request.headers['x-csrf-token'];
                    }
                    
                    // Remove sensitive query params
                    if (event.request.query_string) {
                        // Filter out sensitive params
                        const sensitiveParams = ['password', 'token', 'secret', 'key'];
                        // Implementation would filter query_string here
                    }
                }
                
                return event;
            },
            ignoreErrors: [
                // Ignore common non-critical errors
                'ECONNREFUSED', // Database connection refused
                'ECONNRESET', // Connection reset
                'ETIMEDOUT', // Request timeout
            ]
        });
        
        logger.info('Sentry error tracking initialized', {
            environment: process.env.NODE_ENV,
            dsn: sentryDsn.substring(0, 20) + '...' // Log partial DSN for verification
        });
        
        return true;
    } catch (error) {
        logger.warn('Failed to initialize Sentry', {
            error: error.message
        });
        return false;
    }
};

export default initSentry;

