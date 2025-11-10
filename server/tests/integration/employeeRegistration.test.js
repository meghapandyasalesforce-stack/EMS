import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import Employee from '../../models/employee.model.js';
import connectDB from '../../db/database.js';

// Mock the server setup for testing
const app = express();
app.use(express.json());

// Import routes
import employeeRouter from '../../routes/Auth/EmployeeRoutes.js';
app.use('/api/v1/employee/auth', employeeRouter);

describe('Employee Registration Integration Tests', () => {
    beforeAll(async () => {
        await connectDB();
    });

    beforeEach(async () => {
        await Employee.deleteMany({});
    });

    afterEach(async () => {
        await Employee.deleteMany({});
    });

    describe('POST /api/v1/employee/auth/register', () => {
        it('should register a new employee with auto-generated password', async () => {
            const employeeData = {
                name: 'John',
                lastName: 'Doe',
                email: 'john.doe@example.com',
                position: 'Senior',
                department: 'Engineering',
                manager: 'Jane Smith',
                jobTitle: 'Software Engineer',
                jobCategory: 'Information Technology',
                salary: 75000
            };

            const response = await request(app)
                .post('/api/v1/employee/auth/register')
                .send(employeeData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.employee).toBeDefined();
            expect(response.body.employee.email).toBe(employeeData.email.toLowerCase());
            expect(response.body.employee.employeeId).toBeDefined();
        });

        it('should reject registration with missing required fields', async () => {
            const incompleteData = {
                name: 'John',
                email: 'john.doe@example.com'
            };

            const response = await request(app)
                .post('/api/v1/employee/auth/register')
                .send(incompleteData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should reject duplicate email registration', async () => {
            const employeeData = {
                name: 'John',
                lastName: 'Doe',
                email: 'john.doe@example.com',
                position: 'Senior',
                department: 'Engineering',
                manager: 'Jane Smith',
                jobTitle: 'Software Engineer',
                jobCategory: 'Information Technology',
                salary: 75000
            };

            // First registration
            await request(app)
                .post('/api/v1/employee/auth/register')
                .send(employeeData)
                .expect(201);

            // Duplicate registration
            const response = await request(app)
                .post('/api/v1/employee/auth/register')
                .send(employeeData)
                .expect(409);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('already exists');
        });

        it('should generate unique employee ID', async () => {
            const employeeData1 = {
                name: 'John',
                lastName: 'Doe',
                email: 'john.doe@example.com',
                position: 'Senior',
                department: 'Engineering',
                manager: 'Jane Smith',
                jobTitle: 'Software Engineer',
                jobCategory: 'Information Technology',
                salary: 75000
            };

            const employeeData2 = {
                name: 'John',
                lastName: 'Smith',
                email: 'john.smith@example.com',
                position: 'Senior',
                department: 'Engineering',
                manager: 'Jane Smith',
                jobTitle: 'Software Engineer',
                jobCategory: 'Information Technology',
                salary: 75000
            };

            const response1 = await request(app)
                .post('/api/v1/employee/auth/register')
                .send(employeeData1)
                .expect(201);

            const response2 = await request(app)
                .post('/api/v1/employee/auth/register')
                .send(employeeData2)
                .expect(201);

            expect(response1.body.employee.employeeId).not.toBe(response2.body.employee.employeeId);
        });
    });
});

