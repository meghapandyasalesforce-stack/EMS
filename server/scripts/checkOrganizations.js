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
        logger.info(`📊 Database: ${mongoose.connection.db.databaseName}\n`);
        return true;
    } catch (error) {
        logger.error('❌ MongoDB connection failed:', { error: error.message });
        return false;
    }
};

const checkOrganizationByEmail = async (email) => {
    if (!email) {
        logger.error('❌ Please provide an email address');
        logger.info('Usage: node server/scripts/checkOrganizations.js <email>');
        process.exit(1);
    }

    const normalizedEmail = email.toLowerCase().trim();
    logger.info(`🔍 Checking for organization: ${normalizedEmail}\n`);

    try {
        const organization = await Organization.findOne({ 
            email: normalizedEmail 
        });
        
        if (organization) {
            logger.info('✅ Organization found:');
            logger.info(`   ID: ${organization._id}`);
            logger.info(`   Name: ${organization.name}`);
            logger.info(`   Email: ${organization.email}`);
            logger.info(`   Phone: ${organization.phone || 'N/A'}`);
            logger.info(`   Domain: ${organization.domain || 'N/A'}`);
            logger.info(`   Subscription Plan: ${organization.subscriptionPlan}`);
            logger.info(`   Max Employees: ${organization.maxEmployees}`);
            logger.info(`   Active: ${organization.isActive}`);
            logger.info(`   Created: ${organization.createdAt}`);
            
            // Count users and employees for this organization
            const userCount = await User.countDocuments({ organizationId: organization._id });
            const employeeCount = await Employee.countDocuments({ organizationId: organization._id });
            
            logger.info(`\n📊 Organization Statistics:`);
            logger.info(`   Admin Users: ${userCount}`);
            logger.info(`   Employees: ${employeeCount}`);
            logger.info(`   Total Users: ${userCount + employeeCount}`);
            
            return { found: true, data: organization };
        } else {
            logger.info('❌ Organization not found');
            return { found: false, data: null };
        }
    } catch (error) {
        logger.error('❌ Error checking organization:', { error: error.message });
        return { found: false, data: null, error: error.message };
    }
};

const listAllOrganizations = async () => {
    logger.info('📋 Listing all organizations:\n');
    
    try {
        const organizations = await Organization.find({}).sort({ createdAt: -1 });
        
        if (organizations.length === 0) {
            logger.info('❌ No organizations found in database');
            logger.info('\n💡 To create an organization:');
            logger.info('   1. Visit: http://localhost:5173/organization/register');
            logger.info('   2. Or use the API: POST /api/v1/organization/auth/register');
            return;
        }
        
        logger.info(`✅ Found ${organizations.length} organization(s):\n`);
        
        for (const org of organizations) {
            const orgData = org.toObject ? org.toObject() : org;
            logger.info(`📌 ${orgData.name || '(No name)'}`);
            logger.info(`   ID: ${orgData._id}`);
            logger.info(`   Email: ${orgData.email || '(No email)'}`);
            logger.info(`   Phone: ${orgData.phone || 'Not set'}`);
            logger.info(`   Domain: ${orgData.domain || 'Not set'}`);
            logger.info(`   Plan: ${orgData.subscriptionPlan || 'free'}`);
            logger.info(`   Max Employees: ${orgData.maxEmployees || 10}`);
            logger.info(`   Active: ${orgData.isActive !== false ? 'Yes' : 'No'}`);
            logger.info(`   Created: ${orgData.createdAt || orgData.createdAt || 'Unknown'}`);
            
            // Count users and employees
            const userCount = await User.countDocuments({ organizationId: org._id });
            const employeeCount = await Employee.countDocuments({ organizationId: org._id });
            
            logger.info(`   Admin Users: ${userCount}`);
            logger.info(`   Employees: ${employeeCount}`);
            logger.info(`   Total: ${userCount + employeeCount} users\n`);
        }
        
        // Summary
        const totalUsers = await User.countDocuments({});
        const totalEmployees = await Employee.countDocuments({});
        const usersWithoutOrg = await User.countDocuments({ organizationId: { $exists: false } });
        const employeesWithoutOrg = await Employee.countDocuments({ organizationId: { $exists: false } });
        
        logger.info('📊 Database Summary:');
        logger.info(`   Total Organizations: ${organizations.length}`);
        logger.info(`   Total Admin Users: ${totalUsers}`);
        logger.info(`   Total Employees: ${totalEmployees}`);
        if (usersWithoutOrg > 0 || employeesWithoutOrg > 0) {
            logger.warn(`   ⚠️  Users without organizationId: ${usersWithoutOrg}`);
            logger.warn(`   ⚠️  Employees without organizationId: ${employeesWithoutOrg}`);
            logger.info(`   💡 These records need to be assigned to an organization`);
        }
        
    } catch (error) {
        logger.error('❌ Error listing organizations:', { error: error.message });
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
    logger.info('\n✅ Database connection closed');
    process.exit(0);
};

main().catch(error => {
    logger.error('❌ Script error:', { error: error.message, stack: error.stack });
    process.exit(1);
});

