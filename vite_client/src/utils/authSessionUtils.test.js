import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveSessionAuthUser, isAdminAuthSession } from './authSessionUtils';

describe('authSessionUtils', () => {
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    const store = {};
    globalThis.localStorage = {
      getItem: (key) => store[key] ?? null,
      setItem: (key, value) => {
        store[key] = String(value);
      },
      removeItem: (key) => {
        delete store[key];
      },
    };
  });

  afterEach(() => {
    globalThis.localStorage = originalLocalStorage;
  });

  it('preserves admin role when employee profile is returned', () => {
    localStorage.setItem('role', 'admin');
    const result = resolveSessionAuthUser(
      {
        employee: {
          _id: 'emp1',
          name: 'Shubham',
          email: 'admin@test.com',
          role: 'employee',
          organizationId: 'org1',
        },
      },
      { _id: 'user1', role: 'admin', email: 'admin@test.com', organizationId: 'org1' },
      { isOrgOwner: true }
    );
    expect(result.role).toBe('admin');
    expect(result._id).toBe('user1');
    expect(result.name).toBe('Shubham');
  });

  it('uses employee role for pure employee sessions', () => {
    localStorage.setItem('role', 'employee');
    const result = resolveSessionAuthUser(
      {
        employee: { _id: 'emp1', name: 'Alex', role: 'employee' },
      },
      null,
      {}
    );
    expect(result.role).toBe('employee');
    expect(result._id).toBe('emp1');
  });

  it('prefers payload user document when present', () => {
    const result = resolveSessionAuthUser(
      {
        user: { id: 'u1', role: 'admin', email: 'a@b.com' },
        employee: { _id: 'emp1', role: 'employee' },
      },
      null,
      {}
    );
    expect(result.role).toBe('admin');
    expect(result._id).toBe('u1');
  });

  it('detects admin session from stored role when profile has only employee', () => {
    localStorage.setItem('role', 'admin');
    expect(
      isAdminAuthSession({
        existingUser: null,
        permissionFlags: {},
      })
    ).toBe(true);
  });
});
