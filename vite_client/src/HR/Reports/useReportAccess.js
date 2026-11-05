import { useSelector } from 'react-redux';

/** Finance sees the payroll report only. HR, admin, and executive keep the full set. */
export function useReportAccess() {
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const permissionFlags = useSelector((state) => state.auth.permissionFlags) || {};
    const profile = user || employee || {};
    const department = String(profile.department || '').toLowerCase();
    const isFinanceDept =
        department === 'finance' ||
        department.includes('finance') ||
        department === 'accounting';
    const isFullReports =
        permissionFlags.isOrgOwner ||
        permissionFlags.isHrManager ||
        permissionFlags.isHrExecutive ||
        permissionFlags.isExecutive ||
        String(user?.role || employee?.role || '').toLowerCase() === 'admin';
    const payrollOnly = !isFullReports && (permissionFlags.isPayrollAdmin || isFinanceDept);

    return { payrollOnly };
}
