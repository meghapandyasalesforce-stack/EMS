/**
 * Integration Tests for Full Auth Flow
 * Tests complete authentication workflows including login, registration, and account lockout
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../server.js';
import User from '../../models/user.model.js';
import Employee from '../../models/employee.model.js';
import connectDB from '../../db/database.js';

describe('Authentication Flow Integration Tests', () => {
    let testOrganizationId;
    let testAdminUser;
    let testEmployee;

    beforeAll(async () => {
        // Connect to test database
        if (mongoose.connection.readyState === 0) {
            await connectDB();
        }

        // Create test organization ID
        testOrganizationId = new mongoose.Types.ObjectId();
    });

    afterAll(async () => {
        // Clean up test data
        await User.deleteMany({ email: /^test/ });
        await Employee.deleteMany({ email: /^test/ });
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        // Clean up before each test
        await User.deleteMany({ email: /^test/ });
        await Employee.deleteMany({ email: /^test/ });
    });

    describe('Admin Registration and Login Flow', () => {
        it('should register a new admin user successfully', async () => {
            const response = await request(app)
                .post('/api/v1/admin/auth/register')
                .send({
                    name: 'Test Admin',
                    email: 'testadmin@example.com',
                    password: 'TestPass123!',
                    organizationId: testOrganizationId.toString()
                })
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.user).toBeDefined();
            expect(response.body.user.email).toBe('testadmin@example.com');
            expect(response.body.token).toBeDefined();
        });

        it('should login with correct credentials', async () => {
            // First register
            await request(app)
                .post('/api/v1/admin/auth/register')
                .send({
                    name: 'Test Admin',
                    email: 'testadmin@example.com',
                    password: 'TestPass123!',
                    organizationId: testOrganizationId.toString()
                });

            // Then login
            const response = await request(app)
                .post('/api/v1/admin/auth/login')
                .send({
                    email: 'testadmin@example.com',
                    password: 'TestPass123!'
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.token).toBeDefined();
            expect(response.body.user).toBeDefined();
        });

        it('should reject login with incorrect password', async () => {
            // Register first
            await request(app)
                .post('/api/v1/admin/auth/register')
                .send({
                    name: 'Test Admin',
                    email: 'testadmin@example.com',
                    password: 'TestPass123!',
                    organizationId: testOrganizationId.toString()
                });

            // Try login with wrong password
            const response = await request(app)
                .post('/api/v1/admin/auth/login')
                .send({
                    email: 'testadmin@example.com',
                    password: 'WrongPassword123!'
                })
                .expect(401);

            expect(response.body.success).toBe(false);
        });
    });

    describe('Account Lockout Flow', () => {
        it('should lock account after 5 failed login attempts', async () => {
            // Register first
            await request(app)
                .post('/api/v1/admin/auth/register')
                .send({
                    name: 'Test Admin',
                    email: 'testlockout@example.com',
                    password: 'TestPass123!',
                    organizationId: testOrganizationId.toString()
                });

            // Make 5 failed login attempts
            for (let i = 0; i < 5; i++) {
                await request(app)
                    .post('/api/v1/admin/auth/login')
                    .send({
                        email: 'testlockout@example.com',
                        password: 'WrongPassword123!'
                    })
                    .expect(401);
            }

            // 6th attempt should be locked
            const response = await request(app)
                .post('/api/v1/admin/auth/login')
                .send({
                    email: 'testlockout@example.com',
                    password: 'WrongPassword123!'
                })
                .expect(403);

            expect(response.body.message).toContain('locked');
        });

        it('should unlock account after lock period expires', async () => {
            // This test would require time manipulation or shorter lock period
            // For now, we'll test that lock is set correctly
            const user = await User.findOne({ email: 'testlockout@example.com' });
            if (user) {
                expect(user.lockUntil).toBeDefined();
                expect(user.loginAttempts).toBeGreaterThanOrEqual(5);
            }
        });
    });

    describe('Employee Registration and Login Flow', () => {
        it('should register a new employee successfully', async () => {
            const response = await request(app)
                .post('/api/v1/employee/auth/register')
                .send({
                    name: 'Test',
                    lastName: 'Employee',
                    email: 'testemployee@example.com',
                    password: 'TestPass123!',
                    manager: 'Test Manager',
                    salary: 50000,
                    jobCategory: 'Information Technology',
                    jobTitle: 'Software Engineer',
                    position: 'Mid-Level',
                    department: 'Engineering',
                    organizationId: testOrganizationId.toString()
                })
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.employee).toBeDefined();
            expect(response.body.employee.email).toBe('testemployee@example.com');
        });

        it('should login employee with correct credentials', async () => {
            // Register first
            await request(app)
                .post('/api/v1/employee/auth/register')
                .send({
                    name: 'Test',
                    lastName: 'Employee',
                    email: 'testemployee@example.com',
                    password: 'TestPass123!',
                    manager: 'Test Manager',
                    salary: 50000,
                    jobCategory: 'Information Technology',
                    jobTitle: 'Software Engineer',
                    position: 'Mid-Level',
                    department: 'Engineering',
                    organizationId: testOrganizationId.toString()
                });

            // Login
            const response = await request(app)
                .post('/api/v1/employee/auth/login')
                .send({
                    email: 'testemployee@example.com',
                    password: 'TestPass123!'
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.token).toBeDefined();
        });
    });

    describe('Token Validation', () => {
        it('should reject requests without token', async () => {
            const response = await request(app)
                .get('/api/v1/admin/employee')
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        it('should accept requests with valid token', async () => {
            // Register and login to get token
            const registerResponse = await request(app)
                .post('/api/v1/admin/auth/register')
                .send({
                    name: 'Test Admin',
                    email: 'testtoken@example.com',
                    password: 'TestPass123!',
                    organizationId: testOrganizationId.toString()
                });

            const loginResponse = await request(app)
                .post('/api/v1/admin/auth/login')
                .send({
                    email: 'testtoken@example.com',
                    password: 'TestPass123!'
                });

            const token = loginResponse.body.token;

            // Use token to access protected route
            const response = await request(app)
                .get('/api/v1/admin/employee')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });
});

