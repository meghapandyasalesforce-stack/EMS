import { describe, it, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import Attendance from '../../models/attendance.model.js';
import Employee from '../../models/employee.model.js';
import connectDB from '../../db/database.js';

// Mock the server setup for testing
const app = express();
app.use(express.json());

// Import routes
import attendanceRouter from '../../routes/Both/AttendanceRoutes.js';
app.use('/api/v1/both/attendance', attendanceRouter);

describe('Attendance Integration Tests', () => {
    let testEmployee;
    let authToken;

    beforeAll(async () => {
        await connectDB();
    });

    beforeEach(async () => {
        // Clean up
        await Attendance.deleteMany({});
        await Employee.deleteMany({});

        // Create test employee
        testEmployee = new Employee({
            name: 'Test',
            lastName: 'Employee',
            email: 'test.employee@example.com',
            password: 'TestPass123!',
            position: 'Senior',
            department: 'Engineering',
            manager: 'Test Manager',
            jobTitle: 'Software Engineer',
            jobCategory: 'Information Technology',
            salary: 75000,
            organizationId: '507f1f77bcf86cd799439011'
        });
        await testEmployee.save();

        // Mock authentication - in real tests, use actual auth
        authToken = 'mock-token';
    });

    afterEach(async () => {
        await Attendance.deleteMany({});
        await Employee.deleteMany({});
    });

    describe('POST /api/v1/both/attendance/clock-in', () => {
        it('should clock in successfully', async () => {
            const response = await request(app)
                .post('/api/v1/both/attendance/clock-in')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    workLocation: 'office',
                    latitude: 40.7128,
                    longitude: -74.0060
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.session).toBeDefined();
            expect(response.body.session.clockIn).toBeDefined();
        });

        it('should reject duplicate clock-in for same day', async () => {
            // First clock-in
            await request(app)
                .post('/api/v1/both/attendance/clock-in')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ workLocation: 'office' })
                .expect(200);

            // Duplicate clock-in
            const response = await request(app)
                .post('/api/v1/both/attendance/clock-in')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ workLocation: 'office' })
                .expect(400);

            expect(response.body.message).toContain('Already clocked in');
        });
    });

    describe('POST /api/v1/both/attendance/clock-out', () => {
        it('should clock out successfully after clock-in', async () => {
            // Clock in first
            const clockInResponse = await request(app)
                .post('/api/v1/both/attendance/clock-in')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ workLocation: 'office' })
                .expect(200);

            const sessionId = clockInResponse.body.session._id;

            // Clock out
            const response = await request(app)
                .post('/api/v1/both/attendance/clock-out')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ sessionId })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.session.clockOut).toBeDefined();
        });

        it('should reject clock-out without clock-in', async () => {
            const response = await request(app)
                .post('/api/v1/both/attendance/clock-out')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ sessionId: 'invalid-id' })
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });
});

