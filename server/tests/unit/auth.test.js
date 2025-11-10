import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import User from '../../models/user.model.js';
import bcrypt from 'bcryptjs';
import connectDB from '../../db/database.js';

describe('User Model Tests', () => {
    beforeAll(async () => {
        await connectDB();
    });

    beforeEach(async () => {
        await User.deleteMany({});
    });

    afterEach(async () => {
        await User.deleteMany({});
    });

    describe('User Creation', () => {
        it('should create a user with hashed password', async () => {
            const userData = {
                name: 'Test User',
                email: 'test@gmail.com',
                password: 'TestPassword123!'
            };

            const user = new User(userData);
            await user.save();

            expect(user._id).toBeDefined();
            expect(user.name).toBe(userData.name);
            expect(user.email).toBe(userData.email);
            expect(user.password).not.toBe(userData.password);
            expect(user.password).toMatch(/^\$2[aby]\$/); // bcrypt hash format
        });

        it('should validate email format', async () => {
            const userData = {
                name: 'Test User',
                email: 'invalid-email',
                password: 'TestPassword123!'
            };

            const user = new User(userData);
            await expect(user.save()).rejects.toThrow();
        });

        it('should enforce unique email', async () => {
            const userData = {
                name: 'Test User',
                email: 'test@gmail.com',
                password: 'TestPassword123!'
            };

            const user1 = new User(userData);
            await user1.save();

            const user2 = new User(userData);
            await expect(user2.save()).rejects.toThrow(/duplicate key error/);
        });

        it('should enforce minimum password length', async () => {
            const userData = {
                name: 'Test User',
                email: 'test@gmail.com',
                password: 'short'
            };

            const user = new User(userData);
            await expect(user.save()).rejects.toThrow();
        });
    });

    describe('Password Comparison', () => {
        it('should compare passwords correctly', async () => {
            const userData = {
                name: 'Test User',
                email: 'test@gmail.com',
                password: 'TestPassword123!'
            };

            const user = new User(userData);
            await user.save();

            const isMatch = await user.comparePassword('TestPassword123!');
            expect(isMatch).toBe(true);

            const isNotMatch = await user.comparePassword('WrongPassword');
            expect(isNotMatch).toBe(false);
        });
    });

    describe('toJSON Method', () => {
        it('should remove password from JSON output', async () => {
            const userData = {
                name: 'Test User',
                email: 'test@gmail.com',
                password: 'TestPassword123!'
            };

            const user = new User(userData);
            await user.save();

            const userJSON = user.toJSON();
            expect(userJSON.password).toBeUndefined();
        });
    });

    describe('Role Assignment', () => {
        it('should default to admin role when not specified', async () => {
            const userData = {
                name: 'Test User',
                email: 'test@example.com',
                password: 'TestPassword123!'
            };

            const user = new User(userData);
            await user.save();

            // Role should default to 'admin' as per schema default
            expect(user.role).toBe('admin');
        });

        it('should use explicitly set role', async () => {
            const userData = {
                name: 'Test User',
                email: 'test@example.com',
                password: 'TestPassword123!',
                role: 'employee'
            };

            const user = new User(userData);
            await user.save();

            expect(user.role).toBe('employee');
        });

        it('should not change role based on email domain', async () => {
            // SECURITY: Role assignment is no longer based on email domain
            const userData = {
                name: 'Test User',
                email: 'test@gmail.com',
                password: 'TestPassword123!',
                role: 'employee' // Explicitly set to employee
            };

            const user = new User(userData);
            await user.save();

            // Should use explicitly set role, not email domain
            expect(user.role).toBe('employee');
        });
    });
});
