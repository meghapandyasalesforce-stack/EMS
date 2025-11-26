/**
 * Utility script to check organizations in the database
 * Usage: 
 *   node server/scripts/checkOrganizations.js          - List all organizations
 *   node server/scripts/checkOrganizations.js <email>  - Find organization by email
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Organization from '../models/organization.model.js';
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
        console.log(`📊 Database: ${mongoose.connection.db.databaseName}\n`);
        return true;
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        return false;
    }
};

const checkOrganizationByEmail = async (email) => {
    if (!email) {
        console.error('❌ Please provide an email address');
        console.log('Usage: node server/scripts/checkOrganizations.js <email>');
        process.exit(1);
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`🔍 Checking for organization: ${normalizedEmail}\n`);

    try {
        const organization = await Organization.findOne({ 
            email: normalizedEmail 
        });
        
        if (organization) {
            console.log('✅ Organization found:');
            console.log(`   ID: ${organization._id}`);
            console.log(`   Name: ${organization.name}`);
            console.log(`   Email: ${organization.email}`);
            console.log(`   Phone: ${organization.phone || 'N/A'}`);
            console.log(`   Domain: ${organization.domain || 'N/A'}`);
            console.log(`   Subscription Plan: ${organization.subscriptionPlan}`);
            console.log(`   Max Employees: ${organization.maxEmployees}`);
            console.log(`   Active: ${organization.isActive}`);
            console.log(`   Created: ${organization.createdAt}`);
            
            // Count users and employees for this organization
            const userCount = await User.countDocuments({ organizationId: organization._id });
            const employeeCount = await Employee.countDocuments({ organizationId: organization._id });
            
            console.log(`\n📊 Organization Statistics:`);
            console.log(`   Admin Users: ${userCount}`);
            console.log(`   Employees: ${employeeCount}`);
            console.log(`   Total Users: ${userCount + employeeCount}`);
            
            return { found: true, data: organization };
        } else {
            console.log('❌ Organization not found');
            return { found: false, data: null };
        }
    } catch (error) {
        console.error('❌ Error checking organization:', error.message);
        return { found: false, data: null, error: error.message };
    }
};

const listAllOrganizations = async () => {
    console.log('📋 Listing all organizations:\n');
    
    try {
        const organizations = await Organization.find({}).sort({ createdAt: -1 });
        
        if (organizations.length === 0) {
            console.log('❌ No organizations found in database');
            console.log('\n💡 To create an organization:');
            console.log('   1. Visit: http://localhost:5173/organization/register');
            console.log('   2. Or use the API: POST /api/v1/organization/auth/register');
            return;
        }
        
        console.log(`✅ Found ${organizations.length} organization(s):\n`);
        
        for (const org of organizations) {
            const orgData = org.toObject ? org.toObject() : org;
            console.log(`📌 ${orgData.name || '(No name)'}`);
            console.log(`   ID: ${orgData._id}`);
            console.log(`   Email: ${orgData.email || '(No email)'}`);
            console.log(`   Phone: ${orgData.phone || 'Not set'}`);
            console.log(`   Domain: ${orgData.domain || 'Not set'}`);
            console.log(`   Plan: ${orgData.subscriptionPlan || 'free'}`);
            console.log(`   Max Employees: ${orgData.maxEmployees || 10}`);
            console.log(`   Active: ${orgData.isActive !== false ? 'Yes' : 'No'}`);
            console.log(`   Created: ${orgData.createdAt || orgData.createdAt || 'Unknown'}`);
            
            // Count users and employees
            const userCount = await User.countDocuments({ organizationId: org._id });
            const employeeCount = await Employee.countDocuments({ organizationId: org._id });
            
            console.log(`   Admin Users: ${userCount}`);
            console.log(`   Employees: ${employeeCount}`);
            console.log(`   Total: ${userCount + employeeCount} users\n`);
        }
        
        // Summary
        const totalUsers = await User.countDocuments({});
        const totalEmployees = await Employee.countDocuments({});
        const usersWithoutOrg = await User.countDocuments({ organizationId: { $exists: false } });
        const employeesWithoutOrg = await Employee.countDocuments({ organizationId: { $exists: false } });
        
        console.log('📊 Database Summary:');
        console.log(`   Total Organizations: ${organizations.length}`);
        console.log(`   Total Admin Users: ${totalUsers}`);
        console.log(`   Total Employees: ${totalEmployees}`);
        if (usersWithoutOrg > 0 || employeesWithoutOrg > 0) {
            console.log(`   ⚠️  Users without organizationId: ${usersWithoutOrg}`);
            console.log(`   ⚠️  Employees without organizationId: ${employeesWithoutOrg}`);
            console.log(`   💡 These records need to be assigned to an organization`);
        }
        
    } catch (error) {
        console.error('❌ Error listing organizations:', error.message);
    }
};

const main = async () => {
    const email = process.argv[2];
    
    const connected = await connectDB();
    if (!connected) {
        process.exit(1);
    }

    if (email && email !== '--list' && email !== '-l') {
        await checkOrganizationByEmail(email);
    } else {
        await listAllOrganizations();
    }

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
};

main().catch(error => {
    console.error('❌ Script error:', error);
    process.exit(1);
});

