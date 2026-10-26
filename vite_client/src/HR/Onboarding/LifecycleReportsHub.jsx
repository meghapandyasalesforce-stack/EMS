import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import {
    FaDownload, FaSync, FaArrowLeft, FaUserPlus, FaSignInAlt, FaSignOutAlt,
} from 'react-icons/fa';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import LoadingSpinner from '../../components/LoadingSpinner';
import ReportDataTable from '../Reports/components/ReportDataTable';
import { CmButton, CmStat } from '../../components/corporateModern';

const employeeName = (row) => {
    const emp = row.employeeId || row.employee || {};
    const full = [emp.name || emp.firstName, emp.lastName].filter(Boolean).join(' ').trim();
    return full || row.name || '—';
};

const employeeDept = (row) => row.employeeId?.department || row.department || '—';
const employeeTitle = (row) => row.employeeId?.jobTitle || row.jobTitle || row.position || '—';
const formatDate = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
    return d.toLocaleDateString();
};

const ONBOARDING_COLUMNS = [
    { key: 'employee', label: 'Employee', render: employeeName },
    { key: 'department', label: 'Department', render: employeeDept },
    { key: 'title', label: 'Title', render: employeeTitle },
    { key: 'status', label: 'Status', render: (r) => r.status || '—' },
    { key: 'joining', label: 'Joining', render: (r) => formatDate(r.joiningDate || r.startDate) },
];

const OFFBOARDING_COLUMNS = [
    { key: 'employee', label: 'Employee', render: employeeName },
    { key: 'department', label: 'Department', render: employeeDept },
    { key: 'title', label: 'Title', render: employeeTitle },
    { key: 'status', label: 'Status', render: (r) => r.status || '—' },
    { key: 'lwd', label: 'Last working', render: (r) => formatDate(r.lastWorkingDate || r.startDate) },
];

const LifecycleReportsHub = ({ onBack, onInvite }) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [exporting, setExporting] = useState(null);
    const [dashboard, setDashboard] = useState(null);
    const [onboardingRows, setOnboardingRows] = useState([]);
    const [offboardingRows, setOffboardingRows] = useState([]);
    const [filters, setFilters] = useState({ dateRangeDays: 90 });

    const base = `${ADMIN_LIFECYCLE_ENDPOINT}/reports`;

    const filterParams = useMemo(() => ({
        dateRangeDays: filters.dateRangeDays,
    }), [filters]);

    const loadEmployees = useCallback(async () => {
        const [onbRes, offRes] = await Promise.all([
            axios.get(`${base}/drilldown/onboarding`, { params: filterParams, withCredentials: true }),
            axios.get(`${base}/drilldown/offboarding`, { params: filterParams, withCredentials: true }),
        ]);
        setOnboardingRows(onbRes.data?.data || []);
        setOffboardingRows(offRes.data?.data || []);
    }, [base, filterParams]);

    const loadDashboard = useCallback(async () => {
        const { data } = await axios.get(`${base}/dashboard`, {
            params: filterParams,
            withCredentials: true,
        });
        setDashboard(data.data);
    }, [base, filterParams]);

    const load = useCallback(async ({ soft = false } = {}) => {
        try {
            if (soft) setRefreshing(true);
            else setLoading(true);
            await Promise.all([loadDashboard(), loadEmployees()]);
            if (soft) toast.success('Analytics refreshed');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load analytics');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [loadDashboard, loadEmployees]);

    useEffect(() => { load(); }, [load]);

    const handleExport = async (category, format) => {
        const key = `${category}:${format}`;
        try {
            setExporting(key);
            const response = await axios.get(`${base}/export/${category}`, {
                params: { ...filterParams, format },
                withCredentials: true,
                responseType: 'blob',
            });
            const contentType = response.headers['content-type'] || '';
            if (contentType.includes('application/json')) {
                const text = await response.data.text();
                const parsed = JSON.parse(text);
                throw new Error(parsed.message || 'Export failed');
            }
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `lifecycle-${category}.${format === 'excel' ? 'xls' : format}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success(`Exported as ${format.toUpperCase()}`);
        } catch (err) {
            toast.error(err.message || 'Export failed');
        } finally {
            setExporting(null);
        }
    };

    const openInvite = () => {
        if (onInvite) {
            onInvite();
            return;
        }
        if (onBack) onBack();
        navigate('/onboarding?create=1');
        window.dispatchEvent(new CustomEvent('ems:onboarding-create'));
        toast.info('Opening create onboarding…');
    };

    const onb = dashboard?.onboarding;
    const off = dashboard?.offboarding;

    if (loading && !dashboard) {
        return <div className="flex justify-center py-20"><LoadingSpinner /></div>;
    }

    return (
        <div className="cm-hrms hrms-lifecycle min-h-[calc(100vh-4rem)]">
            <div className="page-shell !bg-transparent">
                <div className="page-shell-inner cm-page cm-analytics pb-8">
                    {onBack && (
                        <button
                            type="button"
                            onClick={onBack}
                            className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-theme-secondary hover:text-theme-primary"
                        >
                            <FaArrowLeft /> Back to workflows
                        </button>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 className="text-2xl font-bold leading-tight text-[var(--cm-on-surface)] sm:text-[1.75rem]">
                                Analytics
                            </h2>
                            <p className="mt-1 max-w-2xl text-sm text-[var(--cm-muted)]">
                                Onboarding and offboarding employees in the selected period.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                className="cm-select"
                                value={filters.dateRangeDays}
                                onChange={(e) => setFilters({ dateRangeDays: Number(e.target.value) })}
                                aria-label="Date range"
                            >
                                {[30, 60, 90, 180, 365].map((d) => (
                                    <option key={d} value={d}>{d} days</option>
                                ))}
                            </select>
                            <CmButton
                                variant="outline"
                                size="sm"
                                onClick={() => load({ soft: true })}
                                disabled={refreshing}
                            >
                                <FaSync className={refreshing ? 'animate-spin' : ''} />
                                {refreshing ? 'Refreshing…' : 'Refresh'}
                            </CmButton>
                            <CmButton variant="inverted" size="sm" onClick={openInvite}>
                                <FaUserPlus /> Invite Member
                            </CmButton>
                        </div>
                    </div>

                    <div className="mt-4 space-y-4">
                        <div className="cm-kpi-row cm-kpi-row--4 cm-analytics-kpi">
                            <CmStat
                                label="Onboarding employees"
                                value={onboardingRows.length || onb?.summary?.total || 0}
                                icon={<FaSignInAlt />}
                                meta={`${onb?.summary?.inProgress ?? 0} in progress`}
                            />
                            <CmStat
                                label="Onboarding completed"
                                value={onb?.summary?.completed ?? 0}
                                meta={`${onb?.summary?.completionRate ?? 0}% rate`}
                            />
                            <CmStat
                                label="Offboarding employees"
                                value={offboardingRows.length || off?.summary?.total || 0}
                                icon={<FaSignOutAlt />}
                                meta={`${off?.summary?.inProgress ?? off?.noticePeriod?.active ?? 0} in progress`}
                            />
                            <CmStat
                                label="Clearance done"
                                value={`${off?.clearance?.completionRate ?? 0}%`}
                                meta={`${off?.fnf?.paid ?? 0} F&F paid`}
                            />
                        </div>

                        <ReportDataTable
                            title="Onboarding employees"
                            subtitle={`${onboardingRows.length} employee${onboardingRows.length === 1 ? '' : 's'} · last ${filters.dateRangeDays} days`}
                            columns={ONBOARDING_COLUMNS}
                            rows={onboardingRows}
                            actions={(
                                <ExportButtons
                                    category="onboarding"
                                    onExport={handleExport}
                                    exporting={exporting}
                                />
                            )}
                        />

                        <ReportDataTable
                            title="Offboarding employees"
                            subtitle={`${offboardingRows.length} employee${offboardingRows.length === 1 ? '' : 's'} · last ${filters.dateRangeDays} days`}
                            columns={OFFBOARDING_COLUMNS}
                            rows={offboardingRows}
                            actions={(
                                <ExportButtons
                                    category="offboarding"
                                    onExport={handleExport}
                                    exporting={exporting}
                                />
                            )}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

const ExportButtons = ({ category, onExport, exporting }) => (
    <div className="cm-export-btns">
        {['csv', 'excel', 'pdf'].map((fmt) => {
            const key = `${category}:${fmt}`;
            const busy = exporting === key;
            return (
                <button
                    key={fmt}
                    type="button"
                    disabled={Boolean(exporting)}
                    onClick={() => onExport(category, fmt)}
                    className="cm-btn cm-btn--outline cm-btn--sm"
                >
                    <FaDownload /> {busy ? '…' : fmt.toUpperCase()}
                </button>
            );
        })}
    </div>
);

export default LifecycleReportsHub;
