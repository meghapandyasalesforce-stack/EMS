import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const findMock = jest.fn();

jest.unstable_mockModule('../../models/calendar.model.js', () => ({
  __esModule: true,
  default: {
    find: findMock,
  },
}));

const {
  expandDateRange,
  parseLocalDate,
  toDateKey,
  validateEmployeeWfhEligibility,
} = await import('../../helpers/wfhCalendarHelper.js');

describe('wfhCalendarHelper', () => {
  beforeEach(() => {
    findMock.mockReset();
  });

  it('parses YYYY-MM-DD as local midnight', () => {
    const d = parseLocalDate('2026-04-15');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3);
    expect(d.getDate()).toBe(15);
    expect(toDateKey(d)).toBe('2026-04-15');
  });

  it('expands inclusive date ranges', () => {
    const days = expandDateRange('2026-04-15', '2026-04-17');
    expect(days.map(toDateKey)).toEqual([
      '2026-04-15',
      '2026-04-16',
      '2026-04-17',
    ]);
  });

  it('blocks apply when HR has not enabled the date', async () => {
    findMock.mockReturnValue({
      select: () => ({
        lean: async () => [{ year: 2026, wfhDates: [] }],
      }),
    });

    const result = await validateEmployeeWfhEligibility({
      organizationId: 'org1',
      employeeId: 'emp1',
      fromDate: '2026-04-15',
      toDate: '2026-04-15',
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('WFH_DATE_NOT_ENABLED');
  });

  it('blocks apply when employee is excluded on an enabled date', async () => {
    findMock.mockReturnValue({
      select: () => ({
        lean: async () => [
          {
            year: 2026,
            wfhDates: [
              {
                date: parseLocalDate('2026-04-15'),
                excludedEmployeeIds: ['emp1'],
              },
            ],
          },
        ],
      }),
    });

    const result = await validateEmployeeWfhEligibility({
      organizationId: 'org1',
      employeeId: 'emp1',
      fromDate: '2026-04-15',
      toDate: '2026-04-15',
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('WFH_EMPLOYEE_EXCLUDED');
  });

  it('allows apply when date is enabled and employee is not excluded', async () => {
    findMock.mockReturnValue({
      select: () => ({
        lean: async () => [
          {
            year: 2026,
            wfhDates: [
              {
                date: parseLocalDate('2026-04-15'),
                excludedEmployeeIds: ['someone-else'],
              },
            ],
          },
        ],
      }),
    });

    const result = await validateEmployeeWfhEligibility({
      organizationId: 'org1',
      employeeId: 'emp1',
      fromDate: '2026-04-15',
      toDate: '2026-04-15',
    });

    expect(result.ok).toBe(true);
  });

  it('only_these mode allows listed employees and blocks others', async () => {
    findMock.mockReturnValue({
      select: () => ({
        lean: async () => [
          {
            year: 2026,
            wfhDates: [
              {
                date: parseLocalDate('2026-04-15'),
                employeeAccess: 'only_these',
                excludedEmployeeIds: ['emp1'],
              },
            ],
          },
        ],
      }),
    });

    const allowed = await validateEmployeeWfhEligibility({
      organizationId: 'org1',
      employeeId: 'emp1',
      fromDate: '2026-04-15',
      toDate: '2026-04-15',
    });
    expect(allowed.ok).toBe(true);

    const blocked = await validateEmployeeWfhEligibility({
      organizationId: 'org1',
      employeeId: 'emp2',
      fromDate: '2026-04-15',
      toDate: '2026-04-15',
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.code).toBe('WFH_EMPLOYEE_EXCLUDED');
  });
});
