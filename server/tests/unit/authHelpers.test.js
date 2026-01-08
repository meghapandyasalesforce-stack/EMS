/**
 * Unit tests for authentication helper functions
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { extractToken, verifyToken } from '../../middlewares/authHelpers.js';

// Mock environment variable
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

describe('Auth Helpers', () => {
    describe('extractToken', () => {
        it('should extract token from Authorization header', () => {
            const req = {
                headers: {
                    authorization: 'Bearer test-token-123'
                },
                cookies: {}
            };
            
            const token = extractToken(req);
            expect(token).toBe('test-token-123');
        });

        it('should extract token from cookie when header is missing', () => {
            const req = {
                headers: {},
                cookies: {
                    jwt: 'cookie-token-123'
                }
            };
            
            const token = extractToken(req);
            expect(token).toBe('cookie-token-123');
        });

        it('should prefer cookie over header', () => {
            const req = {
                headers: {
                    authorization: 'Bearer header-token-123'
                },
                cookies: {
                    jwt: 'cookie-token-123'
                }
            };
            
            const token = extractToken(req);
            expect(token).toBe('cookie-token-123');
        });

        it('should return null when no token found', () => {
            const req = {
                headers: {},
                cookies: {}
            };
            
            const token = extractToken(req);
            expect(token).toBeNull();
        });

        it('should handle missing Bearer prefix in header', () => {
            const req = {
                headers: {
                    authorization: 'test-token-123'
                },
                cookies: {}
            };
            
            const token = extractToken(req);
            expect(token).toBeNull();
        });
    });

    describe('verifyToken', () => {
        it('should verify valid token', () => {
            const payload = { userId: '123', role: 'admin', organizationId: 'org123' };
            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
            
            const decoded = verifyToken(token);
            expect(decoded.userId).toBe('123');
            expect(decoded.role).toBe('admin');
        });

        it('should throw error for expired token', () => {
            const payload = { userId: '123', role: 'admin' };
            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '-1h' });
            
            expect(() => verifyToken(token)).toThrow('Session expired');
        });

        it('should throw error for invalid token', () => {
            expect(() => verifyToken('invalid-token')).toThrow('Invalid token');
        });

        it('should throw error for token without userId', () => {
            const payload = { role: 'admin' };
            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
            
            expect(() => verifyToken(token)).toThrow('Invalid token payload');
        });
    });
});

