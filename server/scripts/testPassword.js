/**
 * Utility script to test password verification for a user
 * Usage: node server/scripts/testPassword.js <email> <password>
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/user.model.js';
import Employee from '../models/employee.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/paarsiv_hr';
    try {
        await mongoose.connect(mongoURI);
        console.log('✅ MongoDB connected successfully');
        return true;
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        return false;
    }
};

const testPassword = async (email, password) => {
    if (!email || !password) {
        console.error('❌ Please provide both email and password');
        console.log('Usage: node server/scripts/testPassword.js <email> <password>');
        process.exit(1);
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`\n🔍 Testing password for: ${normalizedEmail}\n`);

    // Check in User collection
    try {
        const user = await User.findOne({ 
            email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
        }).select('+password');
        
        if (user) {
            console.log('✅ User found in User collection');
            console.log(`   Testing password...`);
            
            try {
                const isValid = await user.comparePassword(password);
                if (isValid) {
                    console.log('✅ Password is CORRECT');
                } else {
                    console.log('❌ Password is INCORRECT');
                }
            } catch (error) {
                console.error('❌ Error comparing password:', error.message);
            }
            
            await mongoose.connection.close();
            process.exit(0);
        }
    } catch (error) {
        console.error('❌ Error checking User collection:', error.message);
    }

    // Check in Employee collection
    try {
        const employee = await Employee.findOne({ 
            email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
        }).select('+password');
        
        if (employee) {
            console.log('✅ Employee found in Employee collection');
            console.log(`   Testing password...`);
            
            try {
                const isValid = await employee.comparePassword(password);
                if (isValid) {
                    console.log('✅ Password is CORRECT');
                } else {
                    console.log('❌ Password is INCORRECT');
                }
            } catch (error) {
                console.error('❌ Error comparing password:', error.message);
            }
            
            await mongoose.connection.close();
            process.exit(0);
        }
    } catch (error) {
        console.error('❌ Error checking Employee collection:', error.message);
    }

    console.log('❌ User not found in either User or Employee collection');
    await mongoose.connection.close();
    process.exit(1);
};

const main = async () => {
    const email = process.argv[2];
    const password = process.argv[3];

    const connected = await connectDB();
    if (!connected) {
        process.exit(1);
    }

    await testPassword(email, password);
};

main().catch(error => {
    console.error('❌ Script error:', error);
    process.exit(1);
});

