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

const checkUser = async (email) => {
    if (!email) {
        console.error('❌ Please provide an email address');
        console.log('Usage: node server/scripts/checkUser.js <email>');
        process.exit(1);
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`\n🔍 Checking for user: ${normalizedEmail}\n`);

    // Check in User collection
    try {
        const user = await User.findOne({ 
            email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
        }).select('+password');
        
        if (user) {
            console.log('✅ User found in User collection:');
            console.log(`   ID: ${user._id}`);
            console.log(`   Name: ${user.name}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Role: ${user.role}`);
            console.log(`   Active: ${user.isActive}`);
            console.log(`   Has Password: ${user.password ? 'Yes (hashed)' : 'No'}`);
            console.log(`   Created: ${user.createdAt}`);
            return { found: true, type: 'user', data: user };
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
            console.log('✅ Employee found in Employee collection:');
            console.log(`   ID: ${employee._id}`);
            console.log(`   Name: ${employee.name} ${employee.lastName}`);
            console.log(`   Email: ${employee.email}`);
            console.log(`   Employee ID: ${employee.employeeId}`);
            console.log(`   Position: ${employee.position}`);
            console.log(`   Department: ${employee.department}`);
            console.log(`   Active: ${employee.active}`);
            console.log(`   Has Password: ${employee.password ? 'Yes (hashed)' : 'No'}`);
            console.log(`   Created: ${employee.createdAt}`);
            return { found: true, type: 'employee', data: employee };
        }
    } catch (error) {
        console.error('❌ Error checking Employee collection:', error.message);
    }

    console.log('❌ User not found in either User or Employee collection');
    return { found: false, type: null, data: null };
};

const listAllUsers = async () => {
    console.log('\n📋 Listing all users:\n');
    
    try {
        const users = await User.find({}).select('-password');
        console.log(`👥 Users (${users.length}):`);
        users.forEach(user => {
            console.log(`   - ${user.email} (${user.role}) - ${user.name}`);
        });
    } catch (error) {
        console.error('❌ Error listing users:', error.message);
    }

    try {
        const employees = await Employee.find({}).select('-password');
        console.log(`\n👤 Employees (${employees.length}):`);
        employees.forEach(emp => {
            console.log(`   - ${emp.email} - ${emp.name} ${emp.lastName} (${emp.active ? 'Active' : 'Inactive'})`);
        });
    } catch (error) {
        console.error('❌ Error listing employees:', error.message);
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
    console.log('\n✅ Database connection closed');
    process.exit(0);
};

main().catch(error => {
    console.error('❌ Script error:', error);
    process.exit(1);
});

