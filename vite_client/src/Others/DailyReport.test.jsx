import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import DailyReport from './DailyReport';
import axios from '../utils/axios';
import { BOTH_ATTENDANCE_ENDPOINT } from '../utils/constant';

vi.mock('../utils/axios', () => ({ default: { get: vi.fn() } }));
vi.mock('react-redux', () => ({ useSelector: (selector) => selector({ timezone: { timezone: 'Asia/Kolkata' } }) }));
beforeEach(() => vi.clearAllMocks());

describe('Daily attendance report', () => {
    it('uses the existing self attendance API and shows one row per day with server-calculated hours', async () => {
        axios.get.mockResolvedValue({ data: {
            sessions: [
                { attendanceDateKey: '2026-10-29', clockIn: '2026-10-29T04:30:00Z', clockOut: '2026-10-29T07:30:00Z' },
                { attendanceDateKey: '2026-10-29', clockIn: '2026-10-29T08:00:00Z', clockOut: '2026-10-29T12:30:00Z' },
            ],
            dailyStats: { '2026-10-29': { effectiveHours: 7.25, status: 'present' } },
        } });
        render(<DailyReport />);
        const date = await screen.findByText('29 Oct 2026');
        const row = within(date.closest('tr'));
        expect(row.getByText('10:00 AM')).toBeInTheDocument();
        expect(row.getByText('06:00 PM')).toBeInTheDocument();
        expect(row.getByText('7.25 hrs')).toBeInTheDocument();
        expect(row.getByText('Present')).toBeInTheDocument();
        expect(screen.getAllByRole('row')).toHaveLength(2);
        expect(axios.get).toHaveBeenCalledWith(`${BOTH_ATTENDANCE_ENDPOINT}/get-logs`, { withCredentials: true });
    });

    it('keeps attendance calendar keys and handles an active session without an invalid checkout time', async () => {
        axios.get.mockResolvedValue({ data: {
            sessions: [{ attendanceDateKey: '2026-10-29', date: '2026-10-28T18:30:00Z', clockIn: '2026-10-28T23:00:00Z', clockOut: null }],
            dailyStats: { '2026-10-29': { effectiveHours: 0, status: 'present' } },
        } });
        render(<DailyReport />);
        const row = within((await screen.findByText('29 Oct 2026')).closest('tr'));
        expect(row.getByText('04:30 AM')).toBeInTheDocument();
        expect(row.getByText('—')).toBeInTheDocument();
        expect(row.getByText('In progress')).toBeInTheDocument();
        expect(screen.queryByText(/Invalid Date|1970/)).not.toBeInTheDocument();
    });

    it('shows an empty state when the employee has no attendance this month', async () => {
        axios.get.mockResolvedValue({ data: { sessions: [], dailyStats: {} } });
        render(<DailyReport />);
        expect(await screen.findByText('No attendance records for this month.')).toBeInTheDocument();
    });

    it('shows the API error and lets the employee retry', async () => {
        axios.get.mockRejectedValueOnce({ response: { data: { message: 'Attendance temporarily unavailable' } } })
            .mockResolvedValueOnce({ data: { sessions: [], dailyStats: {} } });
        render(<DailyReport />);
        expect(await screen.findByRole('alert')).toHaveTextContent('Attendance temporarily unavailable');
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(await screen.findByText('No attendance records for this month.')).toBeInTheDocument();
        expect(axios.get).toHaveBeenCalledTimes(2);
    });

    it('does not silently show an empty report for an unexpected API response', async () => {
        axios.get.mockResolvedValue({ data: { success: true } });
        render(<DailyReport />);
        expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch daily report');
    });
});
