import mongoose from "mongoose";
import logger from "../helpers/logger.js";

const connectDB = async (retries = 5, delay = 5000) => { 
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/paarsiv_hr';
    
    for (let i = 0; i < retries; i++) {
        try {
            logger.info(`Attempting MongoDB connection (${i + 1}/${retries})...`);
            await mongoose.connect(mongoURI);
            logger.info("MongoDB connected successfully");
            
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