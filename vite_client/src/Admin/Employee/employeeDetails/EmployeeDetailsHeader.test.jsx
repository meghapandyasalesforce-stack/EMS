import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EmployeeDetailsHeader from './EmployeeDetailsHeader';
import { exportToCSV } from '../../../utils/exportUtils';

vi.mock('../../../utils/exportUtils', () => ({ exportToCSV: vi.fn() }));
vi.mock('../../../Shared/ProfilePicture', () => ({ default: () => <span /> }));

const employee = { employeeId: 'PRS016', name: 'Finance', lastName: 'TestingUser', active: true, salary: 120000, email: '=example', department: 'Finance' };

describe('Employee profile export', () => {
  it.each([false, true])('downloads the selected employee and respects hidden payroll: %s', (hidePayrollFields) => {
    vi.clearAllMocks();
    render(<EmployeeDetailsHeader employee={employee} canManageEmployeeActions hidePayrollFields={hidePayrollFields} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const [rows, filename] = exportToCSV.mock.calls[0];
    expect(filename).toBe('PRS016-profile.csv');
    expect(rows[0]['Full Name']).toBe('Finance TestingUser');
    expect(rows[0].Email).toBe("'=example");
    expect(Object.hasOwn(rows[0], 'Annual CTC')).toBe(!hidePayrollFields);
    if (!hidePayrollFields) expect(rows[0]['Annual CTC']).toBe(120000);
  });
});
