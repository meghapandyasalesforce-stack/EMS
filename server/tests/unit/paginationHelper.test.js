/**
 * Unit tests for pagination helper functions
 */

import { describe, it, expect } from '@jest/globals';
import { parsePagination, createPaginationMeta, sendPaginatedResponse, parseSort } from '../../helpers/paginationHelper.js';

describe('Pagination Helper', () => {
    describe('parsePagination', () => {
        it('should return default pagination when no query params provided', () => {
            const req = { query: {} };
            const result = parsePagination(req);
            
            expect(result.page).toBe(1);
            expect(result.limit).toBe(20);
            expect(result.skip).toBe(0);
        });

        it('should parse page and limit from query params', () => {
            const req = { query: { page: '2', limit: '10' } };
            const result = parsePagination(req);
            
            expect(result.page).toBe(2);
            expect(result.limit).toBe(10);
            expect(result.skip).toBe(10);
        });

        it('should enforce minimum page value of 1', () => {
            const req = { query: { page: '0', limit: '10' } };
            const result = parsePagination(req);
            
            expect(result.page).toBe(1);
            expect(result.skip).toBe(0);
        });

        it('should enforce minimum limit value', () => {
            const req = { query: { page: '1', limit: '0' } };
            const result = parsePagination(req, { defaultLimit: 20 });
            
            expect(result.limit).toBe(20);
        });

        it('should enforce maximum limit', () => {
            const req = { query: { page: '1', limit: '200' } };
            const result = parsePagination(req, { maxLimit: 100 });
            
            expect(result.limit).toBe(100);
        });

        it('should use custom default limit', () => {
            const req = { query: {} };
            const result = parsePagination(req, { defaultLimit: 50 });
            
            expect(result.limit).toBe(50);
        });
    });

    describe('createPaginationMeta', () => {
        it('should create correct pagination metadata', () => {
            const meta = createPaginationMeta(2, 20, 100);
            
            expect(meta.page).toBe(2);
            expect(meta.limit).toBe(20);
            expect(meta.total).toBe(100);
            expect(meta.pages).toBe(5);
            expect(meta.hasNext).toBe(true);
            expect(meta.hasPrev).toBe(true);
        });

        it('should indicate no next page on last page', () => {
            const meta = createPaginationMeta(5, 20, 100);
            
            expect(meta.hasNext).toBe(false);
            expect(meta.hasPrev).toBe(true);
        });

        it('should indicate no previous page on first page', () => {
            const meta = createPaginationMeta(1, 20, 100);
            
            expect(meta.hasNext).toBe(true);
            expect(meta.hasPrev).toBe(false);
        });

        it('should calculate pages correctly', () => {
            const meta = createPaginationMeta(1, 20, 99);
            
            expect(meta.pages).toBe(5); // Math.ceil(99/20) = 5
        });
    });

    describe('parseSort', () => {
        it('should return default sort when no query param provided', () => {
            const req = { query: {} };
            const result = parseSort(req);
            
            expect(result).toBe('-createdAt');
        });

        it('should return custom sort from query', () => {
            const req = { query: { sort: 'name' } };
            const result = parseSort(req);
            
            expect(result).toBe('name');
        });

        it('should handle descending sort', () => {
            const req = { query: { sort: '-name' } };
            const result = parseSort(req);
            
            expect(result).toBe('-name');
        });

        it('should parse multiple sort fields', () => {
            const req = { query: { sort: 'name,-createdAt' } };
            const result = parseSort(req);
            
            expect(result).toEqual({
                name: 1,
                createdAt: -1
            });
        });
    });
});

