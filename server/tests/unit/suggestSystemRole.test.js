import { describe, it, expect } from '@jest/globals';
import { inferSystemRoleFromWorkInfo } from '../../helpers/inferSystemRoleFromWorkInfo.js';
import { SYSTEM_ROLE_IDS } from '../../config/systemRole.constants.js';

describe('getSuggestedSystemRole (inference)', () => {
  it('returns HR Executive for HR department staff', () => {
    const result = inferSystemRoleFromWorkInfo({
      department: 'HR',
      jobTitle: 'Backend Developer',
      position: 'Senior',
    });
    expect(result.systemRoleId).toBe(SYSTEM_ROLE_IDS.HR_EXECUTIVE);
    expect(result.reason).toBeTruthy();
  });

  it('returns HR Manager for HR Manager title', () => {
    const result = inferSystemRoleFromWorkInfo({
      department: 'HR',
      jobTitle: 'HR Manager',
      position: 'Manager',
    });
    expect(result.systemRoleId).toBe(SYSTEM_ROLE_IDS.HR_MANAGER);
  });
});
