/**
 * Utility script to check if a user exists in the database
 * Usage: node server/scripts/checkUser.js <email>
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/user.model.js';
import Employee from '../models/employee.model.js';
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

const checkUser = async (email) => {
    if (!email) {
        logger.error('❌ Please provide an email address');
        logger.info('Usage: node server/scripts/checkUser.js <email>');
        process.exit(1);
    }

    const normalizedEmail = email.toLowerCase().trim();
    logger.info(`\n🔍 Checking for user: ${normalizedEmail}\n`);

    // Check in User collection
    try {
        const user = await User.findOne({ 
            email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
        }).select('+password');
        
        if (user) {
            logger.info('✅ User found in User collection:');
            logger.info(`   ID: ${user._id}`);
            logger.info(`   Name: ${user.name}`);
            logger.info(`   Email: ${user.email}`);
            logger.info(`   Role: ${user.role}`);
            logger.info(`   Active: ${user.isActive}`);
            logger.info(`   Has Password: ${user.password ? 'Yes (hashed)' : 'No'}`);
            logger.info(`   Created: ${user.createdAt}`);
            return { found: true, type: 'user', data: user };
        }
    } catch (error) {
        logger.error('❌ Error checking User collection:', { error: error.message });
    }

    // Check in Employee collection
    try {
        const employee = await Employee.findOne({ 
            email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
        }).select('+password');
        
        if (employee) {
            logger.info('✅ Employee found in Employee collection:');
            logger.info(`   ID: ${employee._id}`);
            logger.info(`   Name: ${employee.name} ${employee.lastName}`);
            logger.info(`   Email: ${employee.email}`);
            logger.info(`   Employee ID: ${employee.employeeId}`);
            logger.info(`   Position: ${employee.position}`);
            logger.info(`   Department: ${employee.department}`);
            logger.info(`   Active: ${employee.active}`);
            logger.info(`   Has Password: ${employee.password ? 'Yes (hashed)' : 'No'}`);
            logger.info(`   Created: ${employee.createdAt}`);
            return { found: true, type: 'employee', data: employee };
        }
    } catch (error) {
        logger.error('❌ Error checking Employee collection:', { error: error.message });
    }

    logger.info('❌ User not found in either User or Employee collection');
    return { found: false, type: null, data: null };
};

const listAllUsers = async () => {
    logger.info('\n📋 Listing all users:\n');
    
    try {
        const users = await User.find({}).select('-password');
        logger.info(`👥 Users (${users.length}):`);
        users.forEach(user => {
            logger.info(`   - ${user.email} (${user.role}) - ${user.name}`);
        });
    } catch (error) {
        logger.error('❌ Error listing users:', { error: error.message });
    }

    try {
        const employees = await Employee.find({}).select('-password');
        logger.info(`\n👤 Employees (${employees.length}):`);
        employees.forEach(emp => {
            logger.info(`   - ${emp.email} - ${emp.name} ${emp.lastName} (${emp.active ? 'Active' : 'Inactive'})`);
        });
    } catch (error) {
        logger.error('❌ Error listing employees:', { error: error.message });
    }
};

const main = async () => {
    const email = process.argv[2];
    
    const connected = await connectDB();
    if (!connected) {
        process.exit(1);
    }

    if (email === '--list' || email === '-l') {
        await listAllUsers();
    } else {
        await checkUser(email);
    }

    await mongoose.connection.close();
    logger.info('\n✅ Database connection closed');
    process.exit(0);
};

main().catch(error => {
    logger.error('❌ Script error:', { error: error.message, stack: error.stack });
    process.exit(1);
});

