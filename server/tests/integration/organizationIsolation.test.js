/**
 * Organization Isolation Integration Tests
 * Tests that verify multi-tenancy data isolation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import mongoose from 'mongoose';
import Employee from '../../models/employee.model.js';
import { addOrganizationFilter } from '../../middlewares/organizationIsolation.js';

describe('Organization Isolation', () => {
    let org1Id, org2Id;
    let employee1, employee2;

    beforeEach(async () => {
        // Create test organization IDs
        org1Id = new mongoose.Types.ObjectId();
        org2Id = new mongoose.Types.ObjectId();

        // Create test employees in different organizations
        employee1 = await Employee.create({
            organizationId: org1Id,
            name: 'Employee 1',
            lastName: 'Org1',
            email: 'emp1@org1.com',
            password: 'password123',
            position: 'Developer',
            department: 'Engineering',
            manager: 'Manager 1',
            jobTitle: 'Software Engineer',
            jobCategory: 'Engineering',
            salary: 50000,
            functionalRoles: ['tech']
        });

        employee2 = await Employee.create({
            organizationId: org2Id,
            name: 'Employee 2',
            lastName: 'Org2',
            email: 'emp2@org2.com',
            password: 'password123',
            position: 'Developer',
            department: 'Engineering',
            manager: 'Manager 2',
            jobTitle: 'Software Engineer',
            jobCategory: 'Engineering',
            salary: 50000,
            functionalRoles: ['tech']
        });
    });

    afterEach(async () => {
        // Clean up test data
        await Employee.deleteMany({ 
            organizationId: { $in: [org1Id, org2Id] } 
        });
    });

    describe('Query Filtering', () => {
        it('should only return employees from organization 1', async () => {
            const mockReq = {
                user: { organizationId: org1Id }
            };

            const query = addOrganizationFilter(mockReq, {});
            
            const employees = await Employee.find(query);
            
            expect(employees.length).toBe(1);
            expect(employees[0].organizationId.toString()).toBe(org1Id.toString());
            expect(employees[0]._id.toString()).toBe(employee1._id.toString());
        });

        it('should only return employees from organization 2', async () => {
            const mockReq = {
                user: { organizationId: org2Id }
            };

            const query = addOrganizationFilter(mockReq, {});
            
            const employees = await Employee.find(query);
            
            expect(employees.length).toBe(1);
            expect(employees[0].organizationId.toString()).toBe(org2Id.toString());
            expect(employees[0]._id.toString()).toBe(employee2._id.toString());
        });

        it('should not return employees from other organizations', async () => {
            const mockReq = {
                user: { organizationId: org1Id }
            };

            const query = addOrganizationFilter(mockReq, {});
            
            const employees = await Employee.find(query);
            
            // Should not include employee2 from org2
            const org2Employees = employees.filter(
                emp => emp.organizationId.toString() === org2Id.toString()
            );
            
            expect(org2Employees.length).toBe(0);
        });
    });

    describe('Data Access Violation Prevention', () => {
        it('should prevent accessing employee from different organization', async () => {
            const mockReq = {
                user: { organizationId: org1Id }
            };

            // Try to access employee2 (from org2) when user is from org1
            const query = addOrganizationFilter(mockReq, {
                _id: employee2._id
            });
            
            const employee = await Employee.findOne(query);
            
            // Should return null because employee2 is from org2
            expect(employee).toBeNull();
        });

        it('should allow accessing employee from same organization', async () => {
            const mockReq = {
                user: { organizationId: org1Id }
            };

            const query = addOrganizationFilter(mockReq, {
                _id: employee1._id
            });
            
            const employee = await Employee.findOne(query);
            
            expect(employee).not.toBeNull();
            expect(employee._id.toString()).toBe(employee1._id.toString());
        });
    });

    describe('Update Operations', () => {
        it('should only update employees from same organization', async () => {
            const mockReq = {
                user: { organizationId: org1Id }
            };

            const query = addOrganizationFilter(mockReq, {
                _id: employee2._id // Try to update employee from org2
            });
            
            const result = await Employee.updateOne(
                query,
                { name: 'Updated Name' }
            );
            
            // Should not update any documents
            expect(result.modifiedCount).toBe(0);
        });

        it('should update employees from same organization', async () => {
            const mockReq = {
                user: { organizationId: org1Id }
            };

            const query = addOrganizationFilter(mockReq, {
                _id: employee1._id
            });
            
            const result = await Employee.updateOne(
                query,
                { name: 'Updated Name' }
            );
            
            expect(result.modifiedCount).toBe(1);
            
            // Verify update
            const updated = await Employee.findById(employee1._id);
            expect(updated.name).toBe('Updated Name');
        });
    });

    describe('Delete Operations', () => {
        it('should only delete employees from same organization', async () => {
            const mockReq = {
                user: { organizationId: org1Id }
            };

            const query = addOrganizationFilter(mockReq, {
                _id: employee2._id // Try to delete employee from org2
            });
            
            const result = await Employee.deleteOne(query);
            
            // Should not delete any documents
            expect(result.deletedCount).toBe(0);
            
            // Verify employee2 still exists
            const stillExists = await Employee.findById(employee2._id);
            expect(stillExists).not.toBeNull();
        });
    });
});

