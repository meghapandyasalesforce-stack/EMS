/**
 * View raw organization data from database
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../helpers/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/paarsiv_hr';
    try {
        await mongoose.connect(mongoURI);
        logger.info('✅ MongoDB connected successfully');
        logger.info(`📊 Database: ${mongoose.connection.db.databaseName}\n`);
        return true;
    } catch (error) {
        logger.error('❌ MongoDB connection failed:', { error: error.message });
        return false;
    }
};

const viewRawOrganization = async () => {
    try {
        const db = mongoose.connection.db;
        const collection = db.collection('organizations');
        const organizations = await collection.find({}).toArray();
        
        logger.info(`Found ${organizations.length} organization(s):\n`);
        
        organizations.forEach((org, index) => {
            logger.info(`\n=== Organization ${index + 1} ===`);
            logger.info(JSON.stringify(org, null, 2));
        });
        
    } catch (error) {
        logger.error('❌ Error viewing organizations:', { error: error.message });
    }
};

const main = async () => {
    const connected = await connectDB();
    if (!connected) {
        process.exit(1);
    }

    await viewRawOrganization();

    await mongoose.connection.close();
    logger.info('\n✅ Database connection closed');
    process.exit(0);
};

main().catch(error => {
    logger.error('❌ Script error:', { error: error.message, stack: error.stack });
    process.exit(1);
});

