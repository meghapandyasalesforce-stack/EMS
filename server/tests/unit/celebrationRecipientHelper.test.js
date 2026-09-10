/**
 * Unit tests for celebration recipient resolution.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockEmployeeFind = jest.fn();

jest.unstable_mockModule('../../models/employee.model.js', () => ({
  default: {
    find: mockEmployeeFind,
  },
}));

jest.unstable_mockModule('../../helpers/lifecycleNotificationRecipients.js', () => ({
  normalizeLifecycleRecipientIds: async (ids) => ids,
}));

const {
  resolveCelebrationEventViewers,
  resolveCelebrationNotificationRecipients,
  canViewCelebrationEvent,
} = await import('../../helpers/celebrationRecipientHelper.js');

const leanResult = (rows) => ({
  select: () => ({
    lean: async () => rows,
  }),
});

describe('celebrationRecipientHelper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveCelebrationEventViewers', () => {
    it('includes subject, manager, HR, and same department', async () => {
      mockEmployeeFind.mockReturnValue(leanResult([
        { _id: 'hr1', department: 'HR', functionalRoles: ['hr'] },
        { _id: 'peer1', department: 'Engineering', functionalRoles: [] },
        { _id: 'other1', department: 'Sales', functionalRoles: [] },
      ]));

      const subject = {
        _id: 'emp1',
        managerId: 'mgr1',
        department: 'Engineering',
      };

      const viewers = await resolveCelebrationEventViewers(subject, 'org1');
      expect(viewers).toEqual(expect.arrayContaining(['emp1', 'mgr1', 'hr1', 'peer1']));
      expect(viewers).not.toContain('other1');
    });
  });

  describe('resolveCelebrationNotificationRecipients', () => {
    it('excludes the subject employee from notification recipients', async () => {
      mockEmployeeFind.mockReturnValue(leanResult([
        { _id: 'peer1', department: 'Engineering', functionalRoles: [] },
      ]));

      const subject = {
        _id: 'emp1',
        managerId: 'mgr1',
        department: 'Engineering',
      };

      const recipients = await resolveCelebrationNotificationRecipients(subject, 'org1');
      expect(recipients).not.toContain('emp1');
      expect(recipients).toEqual(expect.arrayContaining(['mgr1', 'peer1']));
    });
  });

  describe('canViewCelebrationEvent', () => {
    it('allows subject and eligible viewers', () => {
      const event = {
        employeeId: 'emp1',
        eligibleViewerIds: ['peer1'],
      };
      expect(canViewCelebrationEvent(event, 'emp1')).toBe(true);
      expect(canViewCelebrationEvent(event, 'peer1')).toBe(true);
      expect(canViewCelebrationEvent(event, 'stranger')).toBe(false);
    });
  });
});
