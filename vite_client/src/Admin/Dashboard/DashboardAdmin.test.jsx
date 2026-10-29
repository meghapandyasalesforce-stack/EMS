import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardAdmin from '../DashboardAdmin';
import axios from '../../utils/axios';

const fixtures = vi.hoisted(() => ({
  employees: [{ _id: 'emp1', name: 'Megha', lastName: 'Pandya', department: 'Engineering', position: 'Developer', joiningDate: '2026-01-10' }],
  leaves: [{ _id: 'leave1', employeeName: 'Megha', status: 'pending', leaveType: 'casual', totalDays: 2 }],
}));
vi.mock('../../Hooks/useDashboardData', () => ({
  useEmployees: () => ({ data: { employees: fixtures.employees, total: 13 } }),
  useLeaves: () => ({ data: fixtures.leaves }),
  useProjects: () => ({ data: [{ _id: 'project1' }] }),
  usePayrolls: () => ({ data: [{ _id: 'pay1', employeeId: fixtures.employees[0], amount: 1000, createdAt: new Date().toISOString() }, { _id: 'old-pay', employeeId: { _id: 'old-employee', department: 'Finance' }, amount: 999, createdAt: '2025-01-10' }] }),
}));
vi.mock('../../utils/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../context/store', () => ({ persistor: { purge: vi.fn() } }));
vi.mock('../Employee/AddEmployee', () => ({ default: () => <label>Employee name<input aria-label="Employee name" /></label> }));
vi.mock('../Attendance/TodayStatusComponent', () => ({ default: () => <p>Existing attendance workflow</p> }));
vi.mock('../Payroll/AdminPayroll', () => ({ default: () => <p>Existing payroll workflow</p> }));
vi.mock('../../HR/Helpdesk/HelpdeskPage', () => ({ default: () => <p>Existing helpdesk workflow</p> }));
vi.mock('../Calendar/CalendarManagement', () => ({ default: () => <p>Existing calendar workflow</p> }));

function Location() { return <output data-testid="route">{useLocation().pathname}</output>; }
function mount(owner = true, permissions = []) {
  const state = { auth: { user: { _id: 'admin1', name: 'Megha', role: 'admin' }, permissions, roleBuckets: ['admin'], permissionFlags: { isOrgOwner: owner } }, employeeDetails: { employee: null } };
  const store = configureStore({ reducer: () => state });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<Provider store={store}><QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/dashboard-admin']}><DashboardAdmin /><Location /></MemoryRouter></QueryClientProvider></Provider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  axios.get.mockImplementation(async url => {
    if (url.includes('today-status')) return { data: { data: [{ status: 'present' }, { status: 'absent' }] } };
    if (url.includes('escalated-count')) return { data: { data: { count: 1 } } };
    if (url.includes('/calendar/')) return { data: { data: { holidays: [{ _id: url, name: 'Company holiday', date: new Date(Date.now() + 86400000).toISOString() }] } } };
    if (url.includes('my-pending')) return { data: { data: [{ _id: 'approval1', slaEscalated: true, entityType: 'Leave', employeeName: 'Megha' }] } };
    return { data: { data: [], announcements: [], celebrations: [] } };
  });
});

describe('Admin dashboard reference layout and overlays', () => {
  it('retains every section, real metrics, payroll totals and calendar data', async () => {
    mount();
    for (const title of ['Upcoming celebrations', 'Attendance Today', 'Pending Leave', 'Upcoming Events', /Payroll by Department/, 'New Hires', 'Announcements']) expect(screen.getByRole('heading', { name: title, exact: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Total Employees/ })).toHaveTextContent('13');
    expect(screen.getByRole('button', { name: /Pending Leave/ })).toHaveTextContent('1');
    expect((await screen.findAllByText('Company holiday')).length).toBeGreaterThan(0);
    expect(screen.getByRole('table')).toHaveTextContent('Engineering');
    expect(screen.getByText("We'll show birthdays, work anniversaries and other special occasions here.")).toBeInTheDocument();
  });
  it.each([
    [/Total Employees/, 'Employee overview'],
    [/Present Today/, "Today's Attendance"],
    [/Pending Leave/, 'Pending Leave Approvals (1)'],
    [/Overdue Approvals/, 'Pending Approvals Queue'],
    [/^Helpdesk$/, 'Helpdesk'],
    [/^Run Payroll$/, 'Payroll'],
    [/^Add Employee$/, 'Add Employee'],
    [/^View today$/, "Today's Attendance"],
    [/^View calendar$/, 'Calendar'],
    [/^Review all$/, 'Pending Leave Approvals (1)'],
    [/View payroll details/, 'Payroll'],
  ])('opens %s in one on-page overlay', async (button, title) => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: button }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument());
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByTestId('route')).toHaveTextContent('/dashboard-admin');
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body.style.overflow).not.toBe('hidden');
  });
  it('opens the existing Announcements page from View All Announcements', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'View All Announcements', exact: true }));
    await waitFor(() => expect(screen.getByTestId('route')).toHaveTextContent('/sent-announcements'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('opens the selected new hire and closes on backdrop click', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Megha Pandya.*Joined/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Employee Quick View' });
    expect(within(dialog).getByText('Megha Pandya')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close overlay' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('opens celebrations without navigating away and restores focus', async () => {
    mount();
    const card = screen.getByRole('heading', { name: 'Upcoming celebrations' }).closest('.admin-dash__celebrations');
    const trigger = within(card).getByRole('button', { name: 'View all' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(await screen.findByRole('dialog', { name: 'Upcoming celebrations' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Close', exact: true })[0]);
    expect(trigger).toHaveFocus();
    expect(screen.getByTestId('route')).toHaveTextContent('/dashboard-admin');
  });
  it('filters payroll by the selected real period', () => {
    mount();
    fireEvent.change(screen.getByRole('combobox', { name: 'Payroll month' }), { target: { value: '2025-01' } });
    expect(screen.getByRole('table')).toHaveTextContent('Finance');
    expect(screen.getByRole('table')).not.toHaveTextContent('Engineering');
    expect(screen.getByRole('table')).toHaveTextContent('999');
  });
  it('protects a dirty employee form from accidental dismissal', async () => {
    mount();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Add Employee' }));
    fireEvent.input(await screen.findByRole('textbox', { name: 'Employee name' }), { target: { value: 'New employee' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Add Employee' })).toBeInTheDocument();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    confirm.mockRestore();
  });
  it('shows a retryable error instead of an empty overdue queue on failure', async () => {
    axios.get.mockRejectedValue(new Error('Unavailable'));
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Overdue Approvals/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Overdue approvals' });
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('Unable to load approvals'));
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
  it('keeps leave approval controls out of the read-only leave overlay', async () => {
    mount(false, ['leave.view.all']);
    fireEvent.click(screen.getByRole('button', { name: /Pending Leave/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Pending leave requests' });
    expect(within(dialog).getByText('Megha')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Approve|Reject/ })).not.toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });
  it('keeps protected workflows unavailable without their permissions', () => {
    mount(false);
    expect(screen.getByRole('button', { name: /Total Employees/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Overdue Approvals/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Run Payroll' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Employee' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Payroll by Department/ })).not.toBeInTheDocument();
    expect(axios.get.mock.calls.some(([url]) => url.includes('/calendar/'))).toBe(false);
  });
});
