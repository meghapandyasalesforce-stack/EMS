import { describe, it, expect } from '@jest/globals';
import { generateSecurePassword } from '../../helpers/utils.js';

describe('Password Generation Tests', () => {
    describe('generateSecurePassword', () => {
        it('should generate a password of default length (16)', () => {
            const password = generateSecurePassword();
            expect(password).toHaveLength(16);
        });

        it('should generate a password of specified length', () => {
            const password = generateSecurePassword(20);
            expect(password).toHaveLength(20);
        });

        it('should generate unique passwords on each call', () => {
            const password1 = generateSecurePassword();
            const password2 = generateSecurePassword();
            expect(password1).not.toBe(password2);
        });

        it('should contain uppercase letters', () => {
            const password = generateSecurePassword();
            expect(password).toMatch(/[A-Z]/);
        });

        it('should contain lowercase letters', () => {
            const password = generateSecurePassword();
            expect(password).toMatch(/[a-z]/);
        });

        it('should contain numbers', () => {
            const password = generateSecurePassword();
            expect(password).toMatch(/[0-9]/);
        });

        it('should contain special characters', () => {
            const password = generateSecurePassword();
            expect(password).toMatch(/[!@#$%^&*]/);
        });

        it('should generate passwords with all required character types', () => {
            for (let i = 0; i < 10; i++) {
                const password = generateSecurePassword();
                expect(password).toMatch(/[A-Z]/); // Uppercase
                expect(password).toMatch(/[a-z]/); // Lowercase
                expect(password).toMatch(/[0-9]/); // Numbers
                expect(password).toMatch(/[!@#$%^&*]/); // Special chars
            }
        });
    });
});

