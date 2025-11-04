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
        it('should assign admin role for @gmail.com email', async () => {
            const userData = {
                name: 'Test User',
                email: 'test@gmail.com',
                password: 'TestPassword123!'
            };

            const user = new User(userData);
            await user.save();

            expect(user.role).toBe('admin');
        });

        it('should assign employee role for non-gmail email', async () => {
            const userData = {
                name: 'Test User',
                email: 'test@paarsiv.com',
                password: 'TestPassword123!'
            };

            const user = new User(userData);
            await user.save();

            expect(user.role).toBe('employee');
        });
    });
});
