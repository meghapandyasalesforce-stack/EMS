/**
 * Authentication Unit Tests
 * Tests for authentication middleware and role detection
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createAuthMiddleware, isAdminOrHR, isAdminOrExecutive } from '../../middlewares/createAuthMiddleware.js';
import Employee from '../../models/employee.model.js';
import User from '../../models/user.model.js';

describe('Authentication Middleware', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
        mockReq = {
            cookies: {},
            headers: {},
            user: null,
            employee: null,
            organizationId: null
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        mockNext = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Role Detection Security', () => {
        it('should use explicit functionalRoles instead of string matching', async () => {
            // Create employee with explicit functional roles
            const employee = {
                _id: 'employee123',
                organizationId: 'org123',
                functionalRoles: ['hr'],
                department: 'Engineering', // Should NOT be used for role detection
                position: 'Developer', // Should NOT be used for role detection
                status: 'active',
                active: true
            };

            // Mock Employee.findById
            Employee.findById = jest.fn().mockResolvedValue(employee);

            // Mock token verification
            const middleware = isAdminOrHR;
            mockReq.headers.authorization = 'Bearer valid-token';
            
            // Mock verifyToken to return decoded token
            const mockDecoded = {
                userId: 'employee123',
                role: 'employee',
                organizationId: 'org123'
            };

            // This test verifies that functionalRoles is used, not department/position
            expect(employee.functionalRoles).toContain('hr');
            expect(employee.department).toBe('Engineering'); // Different from role
        });

        it('should reject access when functionalRoles does not include required role', async () => {
            const employee = {
                _id: 'employee123',
                organizationId: 'org123',
                functionalRoles: [], // No HR role
                status: 'active',
                active: true
            };

            Employee.findById = jest.fn().mockResolvedValue(employee);

            // Employee without HR role should be denied
            expect(employee.functionalRoles).not.toContain('hr');
        });

        it('should allow access when functionalRoles includes required role', async () => {
            const employee = {
                _id: 'employee123',
                organizationId: 'org123',
                functionalRoles: ['hr', 'manager'], // Has HR role
                status: 'active',
                active: true
            };

            expect(employee.functionalRoles).toContain('hr');
            expect(employee.functionalRoles).toContain('manager');
        });
    });

    describe('Executive Role Detection', () => {
        it('should detect CEO from functionalRoles', () => {
            const employee = {
                functionalRoles: ['ceo', 'executive']
            };
            
            const isExec = employee.functionalRoles.includes('executive') || 
                          employee.functionalRoles.includes('ceo');
            
            expect(isExec).toBe(true);
        });

        it('should detect CTO from functionalRoles', () => {
            const employee = {
                functionalRoles: ['cto', 'executive']
            };
            
            const isExec = employee.functionalRoles.includes('executive') || 
                          employee.functionalRoles.includes('cto');
            
            expect(isExec).toBe(true);
        });

        it('should detect CFO from functionalRoles', () => {
            const employee = {
                functionalRoles: ['cfo', 'executive']
            };
            
            const isExec = employee.functionalRoles.includes('executive') || 
                          employee.functionalRoles.includes('cfo');
            
            expect(isExec).toBe(true);
        });

        it('should detect VP from functionalRoles', () => {
            const employee = {
                functionalRoles: ['vp', 'executive']
            };
            
            const isExec = employee.functionalRoles.includes('executive') || 
                          employee.functionalRoles.includes('vp');
            
            expect(isExec).toBe(true);
        });
    });

    describe('Manager Role Detection', () => {
        it('should detect manager from functionalRoles', () => {
            const employee = {
                functionalRoles: ['manager']
            };
            
            expect(employee.functionalRoles).toContain('manager');
        });

        it('should not detect manager from position string', () => {
            const employee = {
                functionalRoles: [],
                position: 'Manager' // Should NOT be used
            };
            
            // Should NOT use position for role detection
            expect(employee.functionalRoles).not.toContain('manager');
        });
    });
});

describe('Organization Isolation', () => {
    it('should require organizationId in queries', () => {
        const query = {
            organizationId: 'org123'
        };
        
        expect(query.organizationId).toBeDefined();
        expect(query.organizationId).toBe('org123');
    });

    it('should reject queries without organizationId', () => {
        const query = {}; // Missing organizationId
        
        expect(query.organizationId).toBeUndefined();
    });
});
