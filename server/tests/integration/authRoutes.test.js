import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import connectDB from '../../db/database.js';
import User from '../../models/user.model.js';
import adminRouter from '../../routes/Auth/AdminRoutes.js';
import { generateToken } from '../../helpers/utils.js';

describe('Admin Auth Routes Integration Tests', () => {
    let app;

    beforeAll(async () => {
        await connectDB();
    });

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/v1/admin/auth', adminRouter);
    });

    afterEach(async () => {
        await User.deleteMany({});
    });

    describe('POST /api/v1/admin/auth/register', () => {
        it('should register a new admin user', async () => {
            const userData = {
                name: 'Test Admin',
                email: 'admin@gmail.com',
                password: 'TestPassword123!'
            };

            const response = await request(app)
                .post('/api/v1/admin/auth/register')
                .send(userData)
                .expect(201);

            expect(response.body.message).toBe('Registration successful');
            expect(response.body.email).toBe(userData.email);
            expect(response.body.role).toBe('admin');
        });

        it('should reject registration with existing email', async () => {
            const userData = {
                name: 'Test Admin',
                email: 'admin@gmail.com',
                password: 'TestPassword123!'
            };

            await new User(userData).save();

            const response = await request(app)
                .post('/api/v1/admin/auth/register')
                .send(userData)
                .expect(400);

            expect(response.body.message).toContain('already registered');
        });

        it('should reject non-gmail email for admin', async () => {
            const userData = {
                name: 'Test Admin',
                email: 'admin@paarsiv.com',
                password: 'TestPassword123!'
            };

            const response = await request(app)
                .post('/api/v1/admin/auth/register')
                .send(userData)
                .expect(400);

            expect(response.body.message).toContain('Gmail');
        });

        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/v1/admin/auth/register')
                .send({})
                .expect(500);

            expect(response.body.message).toBeDefined();
        });
    });

    describe('POST /api/v1/admin/auth/login', () => {
        beforeEach(async () => {
            const userData = {
                name: 'Test Admin',
                email: 'admin@gmail.com',
                password: 'TestPassword123!'
            };
            await new User(userData).save();
        });

        it('should login with valid credentials', async () => {
            const response = await request(app)
                .post('/api/v1/admin/auth/login')
                .send({
                    email: 'admin@gmail.com',
                    password: 'TestPassword123!'
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.token).toBeDefined();
            expect(response.body.user).toBeDefined();
            expect(response.body.user.email).toBe('admin@gmail.com');
        });

        it('should reject invalid credentials', async () => {
            const response = await request(app)
                .post('/api/v1/admin/auth/login')
                .send({
                    email: 'admin@gmail.com',
                    password: 'WrongPassword'
                })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Invalid credentials');
        });

        it('should require email and password', async () => {
            const response = await request(app)
                .post('/api/v1/admin/auth/login')
                .send({})
                .expect(400);

            expect(response.body.message).toContain('required');
        });
    });

    describe('Rate Limiting', () => {
        it('should enforce rate limit on login', async () => {
            const loginAttempts = Array(6).fill(null);
            
            for (const _ of loginAttempts) {
                await request(app)
                    .post('/api/v1/admin/auth/login')
                    .send({
                        email: 'admin@gmail.com',
                        password: 'WrongPassword'
                    });
            }

            const response = await request(app)
                .post('/api/v1/admin/auth/login')
                .send({
                    email: 'admin@gmail.com',
                    password: 'WrongPassword'
                });

            expect(response.status).toBe(429);
        });
    });
});
