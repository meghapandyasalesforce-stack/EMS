import mongoose from "mongoose";
import logger from "../helpers/logger.js";

/**
 * Calculate exponential backoff delay
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {number} baseDelay - Base delay in milliseconds
 * @param {number} maxDelay - Maximum delay in milliseconds
 * @returns {number} Delay in milliseconds
 */
const calculateBackoffDelay = (attempt, baseDelay = 5000, maxDelay = 30000) => {
    // Exponential backoff: baseDelay * 2^attempt, capped at maxDelay
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    // Add jitter (random 0-25% of delay) to prevent thundering herd
    const jitter = delay * 0.25 * Math.random();
    return Math.floor(delay + jitter);
};

const connectDB = async (retries = 5, baseDelay = 5000) => { 
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/paarsiv_hr';
    
    // Connection pool configuration
    const connectionOptions = {
        maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '10'),
        minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '2'),
        serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT || '5000'),
        socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT || '45000'),
        connectTimeoutMS: parseInt(process.env.MONGODB_CONNECT_TIMEOUT || '10000'),
        retryWrites: true,
        retryReads: true,
    };
    
    for (let i = 0; i < retries; i++) {
        try {
            logger.info(`Attempting MongoDB connection (${i + 1}/${retries})...`);
            await mongoose.connect(mongoURI, connectionOptions);
            logger.info("MongoDB connected successfully", {
                maxPoolSize: connectionOptions.maxPoolSize,
                minPoolSize: connectionOptions.minPoolSize
            });
            
            // Handle connection events
            mongoose.connection.on('error', (err) => {
                logger.error('MongoDB connection error', { error: err.message, stack: err.stack });
            });
            
            mongoose.connection.on('disconnected', () => {
                logger.warn('MongoDB disconnected');
            });
            
            // Graceful shutdown
            process.on('SIGINT', async () => {
                await mongoose.connection.close();
                logger.info('MongoDB connection closed through app termination');
                process.exit(0);
            });
            process.on('SIGTERM', async () => {
                await mongoose.connection.close();
                logger.info('MongoDB connection closed due to SIGTERM');
                process.exit(0);
            });
            
            return; // Success, exit retry loop
            
        } catch (error) {
            logger.error(`MongoDB connection attempt ${i + 1} failed`, { 
                error: error.message, 
                stack: error.stack,
                attempt: i + 1,
                totalRetries: retries
            });
            
            if (i < retries - 1) {
                // Use exponential backoff with jitter
                const delay = calculateBackoffDelay(i, baseDelay);
                logger.info(`Retrying in ${(delay / 1000).toFixed(1)} seconds (exponential backoff)...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                logger.error('All MongoDB connection attempts failed', {
                    totalAttempts: retries,
                    finalError: error.message
                });
                // In production, exit; in development/test, allow graceful degradation
                if (process.env.NODE_ENV === 'production') {
                    process.exit(1);
                } else {
                    logger.warn('Continuing without database connection in non-production environment');
                    // Don't exit - allow server to start for testing/development
                    return;
                }
            }
        }
    }
}

export default connectDB;