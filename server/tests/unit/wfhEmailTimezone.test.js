import { jest, describe, it, expect, afterEach } from '@jest/globals';
import { generateWfhRequestEmailTemplate } from '../../helpers/emailSender.js';

const data = { wfhDate: '2026-11-16', employeeName: 'Test Employee' };
afterEach(() => jest.useRealTimers());

describe('WFH email submission time', () => {
  it('converts UTC to India time and labels the timezone', () => {
    const html = generateWfhRequestEmailTemplate({ ...data, submittedAt: '2026-11-12T07:15:00Z' });
    expect(html).toContain('Thu, Nov 12, 2026, 12:45 PM IST');
  });

  it('rolls over to the next date in India', () => {
    const html = generateWfhRequestEmailTemplate({ ...data, submittedAt: '2026-11-12T20:00:00Z' });
    expect(html).toContain('Fri, Nov 13, 2026, 01:30 AM IST');
  });

  it('uses India time for the current-time fallback', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-12T07:15:00Z'));
    expect(generateWfhRequestEmailTemplate(data)).toContain('Thu, Nov 12, 2026, 12:45 PM IST');
  });
});
