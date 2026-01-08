/**
 * Migration Script: Add functionalRoles to existing employees
 * 
 * This script updates all existing employees to have functionalRoles
 * based on their department, position, and jobTitle fields.
 * 
 * Run: node server/scripts/migrate-functional-roles.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Employee from '../models/employee.model.js';
import connectDB from '../db/database.js';
import logger from '../helpers/logger.js';

dotenv.config();

/**
 * Calculate functional roles from department/position/jobTitle
 * This matches the logic in the Employee model pre-save hook
 */
const calculateFunctionalRoles = (employee) => {
    const roles = [];
    const dept = (employee.department || '').toLowerCase().trim();
    const pos = (employee.position || '').toLowerCase().trim();
    const jobTitle = (employee.jobTitle || '').toLowerCase().trim();
    
    // HR detection
    if (dept === 'hr' || dept.includes('hr') || dept.includes('human resource') ||
        jobTitle.includes('hr manager') || jobTitle.includes('human resource') ||
        jobTitle.includes('hr') || (pos.includes('hr') && pos.includes('manager'))) {
        roles.push('hr');
    }
    
    // Manager detection
    if (pos === 'manager' || pos === 'director' || pos.includes('manager') ||
        pos.includes('director') || jobTitle.includes('manager') || jobTitle.includes('director')) {
        roles.push('manager');
    }
    
    // Executive detection
    if (pos === 'ceo' || pos === 'cto' || pos === 'cfo' || pos === 'vp' ||
        pos === 'vice president' || pos.includes('chief executive') ||
        pos.includes('chief technology') || pos.includes('chief financial') ||
        pos.includes('vice president')) {
        if (pos === 'ceo' || pos.includes('chief executive')) roles.push('ceo');
        if (pos === 'cto' || pos.includes('chief technology')) roles.push('cto');
        if (pos === 'cfo' || pos.includes('chief financial')) roles.push('cfo');
        if (pos === 'vp' || pos === 'vice president') roles.push('vp');
        roles.push('executive');
    }
    
    // Finance detection
    if (dept === 'finance' || dept.includes('finance')) {
        roles.push('finance');
    }
    
    // Tech detection
    if (dept === 'engineering' || dept === 'it support' || dept.includes('engineering') ||
        dept.includes('technology') || jobTitle.includes('engineer') || jobTitle.includes('developer')) {
        roles.push('tech');
    }
    
    // Remove duplicates
    return [...new Set(roles)];
};

const migrateFunctionalRoles = async () => {
    try {
        logger.info('Starting functional roles migration...');
        
        // Connect to database
        await connectDB();
        logger.info('Connected to database');
        
        // Find all employees without functionalRoles or with empty functionalRoles
        const employees = await Employee.find({
            $or: [
                { functionalRoles: { $exists: false } },
                { functionalRoles: { $size: 0 } }
            ]
        });
        
        logger.info(`Found ${employees.length} employees to migrate`);
        
        let updated = 0;
        let skipped = 0;
        
        for (const employee of employees) {
            try {
                const functionalRoles = calculateFunctionalRoles(employee);
                
                if (functionalRoles.length > 0) {
                    employee.functionalRoles = functionalRoles;
                    await employee.save();
                    updated++;
                    
                    logger.debug(`Updated employee ${employee._id}`, {
                        email: employee.email,
                        functionalRoles
                    });
                } else {
                    skipped++;
                    logger.debug(`Skipped employee ${employee._id} (no roles detected)`, {
                        email: employee.email,
                        department: employee.department,
                        position: employee.position
                    });
                }
            } catch (error) {
                logger.error(`Error updating employee ${employee._id}`, {
                    error: error.message,
                    email: employee.email
                });
            }
        }
        
        logger.info('Migration completed', {
            total: employees.length,
            updated,
            skipped
        });
        
        process.exit(0);
    } catch (error) {
        logger.error('Migration failed', {
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
};

// Run migration
migrateFunctionalRoles();

