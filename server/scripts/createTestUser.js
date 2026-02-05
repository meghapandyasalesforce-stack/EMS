/**
 * Utility script to create a test admin user
 * Usage: node server/scripts/createTestUser.js <email> <password> <name>
 * Example: node server/scripts/createTestUser.js admin@test.com Password123 Admin User
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/user.model.js';
import logger from '../helpers/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/paarsiv_hr';
    try {
        await mongoose.connect(mongoURI);
        logger.info('✅ MongoDB connected successfully');
        return true;
    } catch (error) {
        logger.error('❌ MongoDB connection failed:', { error: error.message });
        return false;
    }
};

const createUser = async (email, password, name) => {
    if (!email || !password || !name) {
        logger.error('❌ Missing required parameters');
        logger.info('Usage: node server/scripts/createTestUser.js <email> <password> <name>');
        logger.info('Example: node server/scripts/createTestUser.js admin@test.com Password123 "Admin User"');
        process.exit(1);
    }

    const normalizedEmail = email.toLowerCase().trim();

    try {
        // Check if user already exists
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            logger.warn(`⚠️  User with email ${normalizedEmail} already exists`);
            logger.info(`   ID: ${existingUser._id}`);
            logger.info(`   Name: ${existingUser.name}`);
            logger.info(`   Role: ${existingUser.role}`);
            return;
        }

        // Create new user
        const newUser = new User({
            name: name,
            email: normalizedEmail,
            password: password, // Will be hashed automatically by pre-save hook
            role: 'admin'
        });

        await newUser.save();

        logger.info('\n✅ User created successfully:');
        logger.info(`   ID: ${newUser._id}`);
        logger.info(`   Name: ${newUser.name}`);
        logger.info(`   Email: ${newUser.email}`);
        logger.info(`   Role: ${newUser.role}`);
        logger.info(`   Password: ${password} (will be hashed on save)`);
        logger.info('\n💡 You can now login with these credentials');

    } catch (error) {
        logger.error('❌ Error creating user:', { error: error.message });
        if (error.errors) {
            Object.values(error.errors).forEach(err => {
                logger.error(`   - ${err.message}`);
            });
        }
    }
};

const main = async () => {
    const email = process.argv[2];
    const password = process.argv[3];
    const name = process.argv[4] || 'Test Admin';

    const connected = await connectDB();
    if (!connected) {
        process.exit(1);
    }

    await createUser(email, password, name);

    await mongoose.connection.close();
    logger.info('\n✅ Database connection closed');
    process.exit(0);
};

main().catch(error => {
    logger.error('❌ Script error:', { error: error.message, stack: error.stack });
    process.exit(1);
});

