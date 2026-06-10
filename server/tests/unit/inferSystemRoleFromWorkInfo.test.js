import { describe, it, expect } from '@jest/globals';
import { inferSystemRoleFromWorkInfo } from '../../helpers/inferSystemRoleFromWorkInfo.js';
import { SYSTEM_ROLE_IDS } from '../../config/systemRole.constants.js';

describe('inferSystemRoleFromWorkInfo', () => {
  it('suggests executive for C-suite positions', () => {
    expect(inferSystemRoleFromWorkInfo({ position: 'CEO' }).systemRoleId).toBe(
      SYSTEM_ROLE_IDS.EXECUTIVE
    );
  });

  it('suggests HR Manager for HR Manager job title', () => {
    expect(
      inferSystemRoleFromWorkInfo({
        department: 'HR',
        jobTitle: 'HR Manager',
        position: 'Manager',
      }).systemRoleId
    ).toBe(SYSTEM_ROLE_IDS.HR_MANAGER);
  });

  it('suggests HR Executive for HR department ICs', () => {
    expect(
      inferSystemRoleFromWorkInfo({
        department: 'HR',
        jobTitle: 'Backend Developer',
        position: 'Senior',
      }).systemRoleId
    ).toBe(SYSTEM_ROLE_IDS.HR_EXECUTIVE);
  });

  it('suggests payroll admin for finance managers', () => {
    expect(
      inferSystemRoleFromWorkInfo({
        department: 'Finance',
        jobTitle: 'Financial Analyst',
        position: 'Manager',
      }).systemRoleId
    ).toBe(SYSTEM_ROLE_IDS.PAYROLL_ADMIN);
  });

  it('suggests line manager for project managers', () => {
    expect(
      inferSystemRoleFromWorkInfo({
        department: 'Operations',
        jobTitle: 'Project Manager',
        position: 'Manager',
      }).systemRoleId
    ).toBe(SYSTEM_ROLE_IDS.LINE_MANAGER);
  });

  it('defaults to employee for standard ICs', () => {
    expect(
      inferSystemRoleFromWorkInfo({
        department: 'Engineering',
        jobTitle: 'Software Engineer',
        position: 'Mid-Level',
      }).systemRoleId
    ).toBe(SYSTEM_ROLE_IDS.EMPLOYEE);
  });
});
