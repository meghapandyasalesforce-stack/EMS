/**
 * Unit tests for password utility functions
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { hashPassword, comparePassword } from '../../helpers/passwordUtils.js';

describe('Password Utils', () => {
    describe('hashPassword', () => {
        it('should hash a password successfully', async () => {
            const password = 'TestPassword123!';
            const hashed = await hashPassword(password);
            
            expect(hashed).toBeDefined();
            expect(hashed).not.toBe(password);
            expect(hashed.length).toBeGreaterThan(0);
        });

        it('should throw error for empty password', async () => {
            await expect(hashPassword('')).rejects.toThrow('Password is required');
        });

        it('should throw error for null password', async () => {
            await expect(hashPassword(null)).rejects.toThrow('Password is required');
        });

        it('should produce different hashes for same password', async () => {
            const password = 'TestPassword123!';
            const hash1 = await hashPassword(password);
            const hash2 = await hashPassword(password);
            
            // bcrypt produces different hashes due to salt
            expect(hash1).not.toBe(hash2);
        });
    });

    describe('comparePassword', () => {
        it('should return true for matching password', async () => {
            const password = 'TestPassword123!';
            const hashed = await hashPassword(password);
            const result = await comparePassword(password, hashed);
            
            expect(result).toBe(true);
        });

        it('should return false for non-matching password', async () => {
            const password = 'TestPassword123!';
            const wrongPassword = 'WrongPassword123!';
            const hashed = await hashPassword(password);
            const result = await comparePassword(wrongPassword, hashed);
            
            expect(result).toBe(false);
        });

        it('should return false for empty candidate password', async () => {
            const hashed = await hashPassword('TestPassword123!');
            const result = await comparePassword('', hashed);
            
            expect(result).toBe(false);
        });

        it('should return false for null candidate password', async () => {
            const hashed = await hashPassword('TestPassword123!');
            const result = await comparePassword(null, hashed);
            
            expect(result).toBe(false);
        });

        it('should return false for null hashed password', async () => {
            const result = await comparePassword('TestPassword123!', null);
            
            expect(result).toBe(false);
        });
    });
});

