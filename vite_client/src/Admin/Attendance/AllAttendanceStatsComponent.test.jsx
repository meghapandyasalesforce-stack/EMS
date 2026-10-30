import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ state: {}, dispatch: vi.fn(), navigate: vi.fn(), history: vi.fn((payload) => ({ type: 'history', payload })), details: vi.fn((payload) => ({ type: 'details', payload })), get: vi.fn(), write: vi.fn(), sheet: vi.fn(), toastError: vi.fn() }));
vi.mock('react-redux', () => ({ useSelector: (fn) => fn(mocks.state), useDispatch: () => mocks.dispatch }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('../../context/attendanceSlice', () => ({ fetchTeamAttendanceHistory: mocks.history, fetchEmployeeAttendanceDetails: mocks.details, clearEmployeeDetails: () => ({ type: 'clear' }) }));
vi.mock('../../context/timezoneSlice', () => ({ fetchOrganizationTimezone: () => ({ type: 'timezone' }) }));
vi.mock('../../utils/axios', () => ({ default: { get: mocks.get } }));
vi.mock('../../Hooks/useSignedProfilePhoto', () => ({ useSignedProfilePhoto: () => ({ photoUrl: null }) }));
vi.mock('./TodayStatusComponent', () => ({ default: () => <div>Live overview</div> }));
vi.mock('recharts', () => ({ BarChart: () => null, Bar: () => null, XAxis: () => null, YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null, ResponsiveContainer: () => null, ReferenceLine: () => null, Legend: () => null }));
vi.mock('xlsx', () => ({ utils: { json_to_sheet: mocks.sheet, book_new: () => ({}), book_append_sheet: vi.fn() }, writeFile: mocks.write }));
vi.mock('react-toastify', () => ({ toast: { error: mocks.toastError, success: vi.fn(), loading: vi.fn(), dismiss: vi.fn() } }));
import Attendance from './AllAttendanceStatsComponent';

const employee = { _id: 'employee-1', name: 'Test', lastName: 'Employee', department: 'Engineering', employeeId: 'E-001' };
const record = { _id: 'row-1', employee, date: '2026-10-29', uiStatus: 'present', clockIn: '2026-10-29T09:00:00Z', clockOut: '2026-10-29T17:30:00Z', effectiveHours: 8, breaks: [{ breakIn: '2026-10-29T12:00:00Z', breakOut: '2026-10-29T12:30:00Z', breakType: 'BREAK_1' }] };
async function openHistory() { const view = render(<Attendance />); fireEvent.click(screen.getByRole('button', { name: 'Attendance History' })); await screen.findByRole('option', { name: 'Engineering' }); return view; }
beforeEach(() => { vi.clearAllMocks(); mocks.state = { timezone: { timezone: 'UTC' }, attendance: { teamAttendanceHistory: { loading: false, records: [record], total: 50, page: 1, limit: 25, kpis: {}, dailyTrend: [], memberBreakdown: [] } } }; mocks.get.mockImplementation(async (url) => url.endsWith('all-employee-list') ? { data: { employees: [employee] } } : { data: { records: [record], total: 1 } }); mocks.sheet.mockReturnValue({}); });

describe('Attendance history UI behavior', () => {
  it('sends search, department and every status option to the existing history request', async () => {
    await openHistory();
    fireEvent.change(screen.getByLabelText('Search attendance history'), { target: { value: 'Test' } });
    await waitFor(() => expect(mocks.history).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Test' })));
    fireEvent.change(screen.getByLabelText('Filter department'), { target: { value: 'Engineering' } });
    for (const status of ['present', 'late', 'absent', 'leave', 'office', 'wfh', 'all']) { fireEvent.change(screen.getByLabelText('Filter attendance status'), { target: { value: status } }); await waitFor(() => expect(mocks.history).toHaveBeenLastCalledWith(expect.objectContaining({ department: 'Engineering', status, search: 'Test' }))); }
  });
  it('preserves custom dates, year/month shortcuts and sorting', async () => {
    const view = await openHistory();
    const dates = view.container.querySelectorAll('input[type=date]');
    fireEvent.change(dates[0], { target: { value: '2026-09-01' } }); fireEvent.change(dates[1], { target: { value: '2026-09-15' } });
    await waitFor(() => expect(mocks.history).toHaveBeenLastCalledWith(expect.objectContaining({ startDate: '2026-09-01', endDate: '2026-09-15' })));
    fireEvent.click(screen.getByText('More filters & columns'));
    fireEvent.click(screen.getByRole('button', { name: 'Feb' }));
    await waitFor(() => expect(mocks.history).toHaveBeenLastCalledWith(expect.objectContaining({ startDate: expect.stringMatching(/-02-01$/), endDate: expect.stringMatching(/-02-28$/) })));
    const sort = [...view.container.querySelectorAll('select')].find((el) => [...el.options].some((o) => o.value === 'date_asc'));
    fireEvent.change(sort, { target: { value: 'date_asc' } }); expect(mocks.history).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'date_asc' }));
  });
  it('paginates, changes page size, and resets page when a filter changes', async () => {
    const view = await openHistory();
    const footer = view.container.querySelector('footer');
    fireEvent.click(footer.querySelectorAll('button')[1]); expect(mocks.history).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    fireEvent.change(screen.getByLabelText('Filter attendance status'), { target: { value: 'late' } }); expect(mocks.history).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, status: 'late' }));
    fireEvent.change(footer.querySelector('select'), { target: { value: '10' } }); expect(mocks.history).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 10, page: 1 }));
  });
  it('opens employee details with the same ID and selected range', async () => {
    await openHistory(); fireEvent.click(screen.getByRole('button', { name: 'View attendance details for Test Employee' }));
    expect(mocks.dispatch).toHaveBeenCalledWith({ type: 'clear' }); expect(mocks.details).toHaveBeenCalledWith(expect.objectContaining({ employeeId: employee._id, params: expect.objectContaining({ full: true, startDate: expect.any(String), endDate: expect.any(String) }) }));
  });
  it('keeps break details accessible through additional columns', async () => {
    await openHistory(); fireEvent.click(screen.getByText('More filters & columns')); fireEvent.click(screen.getByRole('checkbox', { name: 'Show shift, break details & location' }));
    expect(document.querySelector('[data-extra-columns]')).toHaveAttribute('data-extra-columns', 'true'); fireEvent.click(screen.getByRole('button', { name: 'View Breaks' }));
    expect(screen.getByRole('heading', { name: /Break/ })).toBeInTheDocument(); expect(screen.getAllByText('Test Employee', { selector: 'p' }).length).toBeGreaterThan(0);
  });
  it('exports CSV using the active filters and creates a download', async () => {
    await openHistory(); const create = vi.fn(() => 'blob:attendance'); Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create }); Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() }); const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    fireEvent.change(screen.getByLabelText('Filter attendance status'), { target: { value: 'present' } }); fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(click).toHaveBeenCalled()); expect(create).toHaveBeenCalled(); expect(mocks.get).toHaveBeenCalledWith(expect.stringContaining('team-attendance-history'), expect.objectContaining({ params: expect.objectContaining({ status: 'present', limit: 500, page: 1 }) })); click.mockRestore();
  });
  it.each(['date', 'month'])('exports %s-wise Excel through the existing export dialog', async (type) => {
    await openHistory(); fireEvent.click(screen.getByRole('button', { name: 'Export Excel' })); fireEvent.click(screen.getByRole('button', { name: `Export by ${type}` }));
    await screen.findByRole('button', { name: /All Employees/ }); fireEvent.click(screen.getByRole('button', { name: /All Employees/ }));
    const buttons = screen.getAllByRole('button'); const confirm = buttons.find((el) => /Export/.test(el.textContent) && !/CSV|Excel|date|month/.test(el.textContent));
    expect(confirm).toBeTruthy(); fireEvent.click(confirm); await waitFor(() => expect(mocks.write).toHaveBeenCalled()); expect(mocks.sheet).toHaveBeenCalledWith([expect.objectContaining({ 'Employee Name': 'Test Employee', 'Employee ID': 'E-001', 'Total Break Time': '30m' })]);
  });
});
