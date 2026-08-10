/**
 * Unit tests for Onboarding/Offboarding notification recipient resolution.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockEmployeeFind = jest.fn();
const mockEmployeeFindOne = jest.fn();
const mockUserFind = jest.fn();
const mockUserFindOne = jest.fn();

jest.unstable_mockModule('../../models/employee.model.js', () => ({
  default: {
    find: mockEmployeeFind,
    findOne: mockEmployeeFindOne,
  },
}));

jest.unstable_mockModule('../../models/user.model.js', () => ({
  default: {
    find: mockUserFind,
    findOne: mockUserFindOne,
  },
}));

const {
  normalizeLifecycleRecipientIds,
  expandOnboardingRecipients,
  getOnboardingHrRecipients,
  getOnboardingProgressRecipients,
  getAuthoritativeHrRecipients,
  findAuthoritativeHrEscalationRecipient,
} = await import('../../helpers/lifecycleNotificationRecipients.js');

const leanResult = (rows) => ({
  select: () => ({
    lean: async () => rows,
  }),
});

describe('lifecycleNotificationRecipients', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizeLifecycleRecipientIds', () => {
    it('collapses Employee + linked User into a single User id', async () => {
      mockEmployeeFind.mockReturnValue(leanResult([
        { _id: 'emp-hr', userId: 'user-hr' },
      ]));

      const ids = await normalizeLifecycleRecipientIds(
        ['emp-hr', 'user-hr'],
        'org-1',
      );

      expect(ids).toEqual(['user-hr']);
    });

    it('keeps Employee id when no User link exists', async () => {
      mockEmployeeFind.mockReturnValue(leanResult([
        { _id: 'emp-only', userId: null },
      ]));

      const ids = await normalizeLifecycleRecipientIds(['emp-only'], 'org-1');
      expect(ids).toEqual(['emp-only']);
    });
  });

  describe('getOnboardingHrRecipients', () => {
    it('notifies assigned HR + platform HR roles + admins, not title-matched employees', async () => {
      mockUserFind
        .mockReturnValueOnce(leanResult([
          { _id: 'user-hrexec' },
          { _id: 'user-hrmgr' },
        ]))
        .mockReturnValueOnce(leanResult([
          { _id: 'user-admin' },
        ]));

      mockEmployeeFind.mockReturnValue(leanResult([
        { _id: 'emp-assigned-hr', userId: 'user-assigned-hr' },
      ]));

      const ids = await getOnboardingHrRecipients(
        { assignedHR: 'emp-assigned-hr' },
        'org-1',
      );

      expect(ids).toEqual(expect.arrayContaining([
        'user-assigned-hr',
        'user-hrexec',
        'user-hrmgr',
        'user-admin',
      ]));
      expect(ids).toHaveLength(4);

      // Authoritative HR query must use platform roles, not jobTitle/department
      expect(mockUserFind).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          roles: { $in: ['hr_admin', 'hr_executive', 'org_owner'] },
        }),
      );
    });

    it('still includes assigned HR even without platform HR roles', async () => {
      mockUserFind
        .mockReturnValueOnce(leanResult([]))
        .mockReturnValueOnce(leanResult([]));
      mockEmployeeFind.mockReturnValue(leanResult([
        { _id: 'emp-assigned', userId: 'user-assigned' },
      ]));

      const ids = await getOnboardingHrRecipients(
        { assignedHR: 'emp-assigned' },
        'org-1',
      );

      expect(ids).toEqual(['user-assigned']);
    });

    it('does not treat Chrome/Threat title employees as HR (no Employee fan-out query)', async () => {
      mockUserFind
        .mockReturnValueOnce(leanResult([{ _id: 'user-real-hr' }]))
        .mockReturnValueOnce(leanResult([]));
      mockEmployeeFind.mockReturnValue(leanResult([]));

      const ids = await getOnboardingHrRecipients({}, 'org-1');

      expect(ids).toEqual(['user-real-hr']);
      expect(mockEmployeeFind).toHaveBeenCalled();
      // Never queried employees by jobTitle/department for HR fan-out
      const employeeQueries = mockEmployeeFind.mock.calls.map((c) => c[0]);
      expect(employeeQueries.every((q) => !q?.jobTitle && !q?.department && !q?.functionalRoles)).toBe(true);
    });
  });

  describe('getOnboardingProgressRecipients', () => {
    it('excludes unrelated regular employees from HR progress events', async () => {
      mockUserFind
        .mockReturnValueOnce(leanResult([{ _id: 'user-hr' }]))
        .mockReturnValueOnce(leanResult([{ _id: 'user-admin' }]));
      mockEmployeeFind.mockReturnValue(leanResult([]));

      const ids = await getOnboardingProgressRecipients(
        {
          employeeId: 'emp-b',
          assignedManager: 'emp-mgr',
          assignedBuddy: 'emp-buddy',
          tasks: [],
        },
        'org-1',
        { hr: true, manager: true, buddy: true },
      );

      expect(ids).toEqual(expect.arrayContaining(['user-hr', 'user-admin', 'emp-mgr', 'emp-buddy']));
      expect(ids).not.toContain('emp-regular-a');
      expect(ids).not.toContain('emp-b');
    });

    it('includes the subject employee when employee flag is set', async () => {
      mockUserFind.mockReturnValue(leanResult([]));
      mockEmployeeFind.mockReturnValue(leanResult([
        { _id: 'emp-b', userId: 'user-b' },
      ]));

      const ids = await getOnboardingProgressRecipients(
        { employeeId: 'emp-b' },
        'org-1',
        { employee: true },
      );

      expect(ids).toEqual(['user-b']);
    });

    it('includes only explicit IT task assignees, not org-wide IT title matches', async () => {
      mockUserFind.mockReturnValue(leanResult([]));
      mockEmployeeFind.mockReturnValue(leanResult([
        { _id: 'emp-it-assignee', userId: 'user-it' },
      ]));

      const ids = await getOnboardingProgressRecipients(
        {
          tasks: [
            { assigneeRole: 'it', assignedTo: 'emp-it-assignee' },
            { assigneeRole: 'employee', assignedTo: 'emp-b' },
          ],
        },
        'org-1',
        { it: true },
      );

      expect(ids).toEqual(['user-it']);
      expect(ids).not.toContain('emp-b');
    });

    it('dedupes assigned HR who is also HR Manager to one recipient', async () => {
      mockUserFind
        .mockReturnValueOnce(leanResult([{ _id: 'user-same' }]))
        .mockReturnValueOnce(leanResult([]));
      mockEmployeeFind.mockReturnValue(leanResult([
        { _id: 'emp-same', userId: 'user-same' },
      ]));

      const ids = await getOnboardingHrRecipients(
        { assignedHR: 'emp-same' },
        'org-1',
      );

      expect(ids).toEqual(['user-same']);
    });
  });

  describe('getAuthoritativeHrRecipients', () => {
    it('returns platform HR users only', async () => {
      mockUserFind.mockReturnValue(leanResult([
        { _id: 'user-hrexec' },
      ]));
      mockEmployeeFind.mockReturnValue(leanResult([]));

      const ids = await getAuthoritativeHrRecipients('org-1');
      expect(ids).toEqual(['user-hrexec']);
    });
  });

  describe('findAuthoritativeHrEscalationRecipient', () => {
    it('resolves first platform HR user to employee profile when linked', async () => {
      mockUserFindOne.mockReturnValue(leanResult({
        _id: 'user-hr',
        employeeProfileId: 'emp-hr',
      }));

      const recipient = await findAuthoritativeHrEscalationRecipient('org-1');
      expect(recipient).toBe('emp-hr');
      expect(mockUserFindOne).toHaveBeenCalledWith(
        expect.objectContaining({
          roles: { $in: ['hr_admin', 'hr_executive', 'org_owner'] },
        }),
      );
    });
  });

  describe('expandOnboardingRecipients', () => {
    it('does not duplicate when includeAdmins overlaps with HR user', async () => {
      mockEmployeeFind.mockReturnValue(leanResult([]));
      mockUserFind.mockReturnValue(leanResult([
        { _id: 'user-admin-hr' },
      ]));

      const ids = await expandOnboardingRecipients(
        ['user-admin-hr'],
        'org-1',
        { includeAdmins: true },
      );

      expect(ids).toEqual(['user-admin-hr']);
    });
  });
});
