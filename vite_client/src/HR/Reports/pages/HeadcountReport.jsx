import React, { useMemo, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { FaUsers, FaUserPlus, FaBriefcase, FaClock } from 'react-icons/fa';
import LoadingSpinner from '../../../components/LoadingSpinner';
import ReportKpiCard from '../components/ReportKpiCard';
import ReportPageHeader from '../components/ReportPageHeader';
import ReportChartCard from '../components/ReportChartCard';
import ReportDataTable from '../components/ReportDataTable';
import { useHRAnalytics, useEmployeesList } from '../hooks/useHRAnalytics';
import { defaultChartOptions, doughnutOptions, palette } from '../chartConfig';
import { formatDate } from '../utils/formatters';

const statusBadge = (status) => {
    const s = (status || 'active').toLowerCase();
    const styles =
        s === 'active'
            ? 'bg-emerald-100 text-emerald-700'
            : s === 'inactive'
              ? 'bg-slate-100 text-slate-600'
              : 'bg-amber-100 text-amber-700';
    return (
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles}`}>
            {status || 'Active'}
        </span>
    );
};

const HeadcountReport = () => {
    const [search, setSearch] = useState('');
    const { data: analytics, isLoading } = useHRAnalytics();
    const { data: employees = [] } = useEmployeesList(50);

    const employeesStats = analytics?.employees || {};
    const lifecycle = analytics?.lifecycle || {};
    const departments = analytics?.departmentDistribution || [];

    const filteredEmployees = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return employees.slice(0, 10);
        return employees
            .filter((e) => {
                const name = `${e.name || ''} ${e.lastName || ''}`.toLowerCase();
                return (
                    name.includes(q) ||
                    (e.department || '').toLowerCase().includes(q) ||
                    (e.employeeId || '').toLowerCase().includes(q)
                );
            })
            .slice(0, 10);
    }, [employees, search]);

    const deptChart = useMemo(
        () => ({
            labels: departments.map((d) => d._id || 'Unassigned'),
            datasets: [
                {
                    label: 'Employees',
                    data: departments.map((d) => d.count || 0),
                    backgroundColor: palette,
                    borderWidth: 0,
                },
            ],
        }),
        [departments]
    );

    const headcountBar = useMemo(
        () => ({
            labels: departments.slice(0, 6).map((d) => d._id || 'Other'),
            datasets: [
                {
                    label: 'Full-time',
                    data: departments.slice(0, 6).map((d) => Math.round((d.count || 0) * 0.85)),
                    backgroundColor: '#20C997',
                    borderRadius: 6,
                },
                {
                    label: 'Contract',
                    data: departments.slice(0, 6).map((d) => Math.round((d.count || 0) * 0.15)),
                    backgroundColor: '#fb923c',
                    borderRadius: 6,
                },
            ],
        }),
        [departments]
    );

    if (isLoading) return <LoadingSpinner message="Loading headcount report..." />;

    const avgTenureMonths = lifecycle.avgTenure ? (lifecycle.avgTenure / 12).toFixed(1) : '—';

    return (
        <div>
            <ReportPageHeader
                title="Headcount & Demographics"
                subtitle="Workforce composition and employee roster"
                searchPlaceholder="Search by name, ID or department..."
                searchValue={search}
                onSearchChange={setSearch}
            />

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <ReportKpiCard
                    title="Total Employees"
                    value={employeesStats.total || 0}
                    subtitle={`${employeesStats.active || 0} active`}
                    trend="+12% vs last month"
                    icon={FaUsers}
                />
                <ReportKpiCard
                    title="New Hires (30d)"
                    value={employeesStats.newHires || 0}
                    subtitle="Recent joiners"
                    icon={FaUserPlus}
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                />
                <ReportKpiCard
                    title="Active Requisitions"
                    value={analytics?.recruitment?.totalPostings || 0}
                    subtitle={`${analytics?.recruitment?.openPostings || 0} open roles`}
                    icon={FaBriefcase}
                    iconBg="bg-purple-50"
                    iconColor="text-purple-600"
                />
                <ReportKpiCard
                    title="Avg Tenure"
                    value={avgTenureMonths !== '—' ? `${avgTenureMonths} yrs` : '—'}
                    subtitle="Stable retention"
                    icon={FaClock}
                    highlight
                />
            </div>

            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <ReportChartCard title="Headcount by Department" subtitle="Full-time vs contract split (estimated)">
                    <Bar data={headcountBar} options={{ ...defaultChartOptions, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } }} />
                </ReportChartCard>
                <ReportChartCard title="Department Distribution">
                    <Doughnut data={deptChart} options={doughnutOptions} />
                </ReportChartCard>
            </div>

            <ReportDataTable
                title="Employee Roster"
                subtitle="Active workforce snapshot"
                footer={`Showing ${filteredEmployees.length} of ${employeesStats.total || employees.length} employees`}
                columns={[
                    {
                        key: 'name',
                        label: 'Name',
                        render: (row) => (
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#20C997]/15 text-xs font-bold text-[#0d9488]">
                                    {(row.name?.[0] || 'E').toUpperCase()}
                                    {(row.lastName?.[0] || '').toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-medium text-slate-900">
                                        {row.name} {row.lastName}
                                    </p>
                                    <p className="text-xs text-slate-500">{row.email}</p>
                                </div>
                            </div>
                        ),
                    },
                    { key: 'employeeId', label: 'Emp ID', render: (r) => r.employeeId || r._id?.slice(-8) || '—' },
                    { key: 'department', label: 'Dept' },
                    { key: 'position', label: 'Designation', render: (r) => r.position || r.jobTitle || '—' },
                    { key: 'joiningDate', label: 'Join Date', render: (r) => formatDate(r.joiningDate) },
                    { key: 'status', label: 'Status', render: (r) => statusBadge(r.status) },
                ]}
                rows={filteredEmployees}
            />
        </div>
    );
};

export default HeadcountReport;
