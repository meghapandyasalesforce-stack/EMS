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

const createUser = async (email, password, name) => {
    if (!email || !password || !name) {
        console.error('❌ Missing required parameters');
        console.log('Usage: node server/scripts/createTestUser.js <email> <password> <name>');
        console.log('Example: node server/scripts/createTestUser.js admin@test.com Password123 "Admin User"');
        process.exit(1);
    }

    const normalizedEmail = email.toLowerCase().trim();

    try {
        // Check if user already exists
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            console.log(`⚠️  User with email ${normalizedEmail} already exists`);
            console.log(`   ID: ${existingUser._id}`);
            console.log(`   Name: ${existingUser.name}`);
            console.log(`   Role: ${existingUser.role}`);
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

        console.log('\n✅ User created successfully:');
        console.log(`   ID: ${newUser._id}`);
        console.log(`   Name: ${newUser.name}`);
        console.log(`   Email: ${newUser.email}`);
        console.log(`   Role: ${newUser.role}`);
        console.log(`   Password: ${password} (will be hashed on save)`);
        console.log('\n💡 You can now login with these credentials');

    } catch (error) {
        console.error('❌ Error creating user:', error.message);
        if (error.errors) {
            Object.values(error.errors).forEach(err => {
                console.error(`   - ${err.message}`);
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
    console.log('\n✅ Database connection closed');
    process.exit(0);
};

main().catch(error => {
    console.error('❌ Script error:', error);
    process.exit(1);
});

