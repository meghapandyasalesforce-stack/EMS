import mongoose from "mongoose";
import logger from "../helpers/logger.js";

const connectDB = async (retries = 5, delay = 5000) => { 
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
            logger.error(`MongoDB connection attempt ${i + 1} failed`, { error: error.message, stack: error.stack });
            if (i < retries - 1) {
                logger.info(`Retrying in ${delay/1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                logger.error('All MongoDB connection attempts failed');
                process.exit(1);
            }
        }
    }
}

export default connectDB;