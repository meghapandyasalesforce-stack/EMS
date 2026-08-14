import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { FaCalendarAlt, FaCheckCircle, FaTasks } from 'react-icons/fa';
import axios from '../utils/axios';
import {
    BOTH_ATTENDANCE_ENDPOINT,
    BOTH_TASK_ENDPOINT,
    EMPLOYEE_LEAVE_ENDPOINT,
} from '../utils/constant';

const WS = {
    border: 'rgba(148, 163, 184, 0.24)',
    mint: '#20C997',
};

const kpiCard = (label, value, sub, icon, loading, compact = false, stacked = false) => (
    <div
        className={`rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${compact ? 'p-3.5' : 'p-5'} ${stacked ? 'flex-1' : ''}`}
        style={{ borderColor: WS.border }}
    >
        <div className="flex items-start justify-between gap-3">
            <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
                <p className={`mt-1 font-semibold tracking-tight text-slate-900 ${compact ? 'text-xl' : 'text-2xl'}`}>
                    {loading ? '…' : value}
                </p>
                {sub ? <p className="mt-1 text-[11px] text-slate-500">{sub}</p> : null}
            </div>
            <div
                className={`flex shrink-0 items-center justify-center rounded-xl ${compact ? 'h-9 w-9' : 'h-11 w-11'}`}
                style={{ backgroundColor: 'rgba(32, 201, 151, 0.12)', color: WS.mint }}
            >
                {icon}
            </div>
        </div>
    </div>
);

const PersonalDashboardKpiRow = ({ compact = false, layout = 'row' }) => {
    const [loading, setLoading] = useState(true);
    const [daysPresent, setDaysPresent] = useState(0);
    const [tasksCount, setTasksCount] = useState('0');
    const [monthlyCapSummary, setMonthlyCapSummary] = useState(null);
    const [leaveDaysRemaining, setLeaveDaysRemaining] = useState('0');

    useEffect(() => {
        let cancelled = false;

        const fetchStats = async () => {
            try {
                setLoading(true);
                const currentMonth = new Date().getMonth() + 1;
                const currentYear = new Date().getFullYear();
                const firstDayOfMonth = format(new Date(currentYear, currentMonth - 1, 1), 'yyyy-MM-dd');
                const lastDayOfMonth = format(new Date(currentYear, currentMonth, 0), 'yyyy-MM-dd');

                const [monthLogsRes, leaveRes, tasksRes] = await Promise.allSettled([
                    axios.get(`${BOTH_ATTENDANCE_ENDPOINT}/get-logs`, {
                        params: { startDate: firstDayOfMonth, endDate: lastDayOfMonth },
                        withCredentials: true,
                    }),
                    axios.get(`${EMPLOYEE_LEAVE_ENDPOINT}/get-my-leaves`, { withCredentials: true }),
                    axios.get(`${BOTH_TASK_ENDPOINT}/all-tasks`, { withCredentials: true }),
                ]);

                if (cancelled) return;

                if (monthLogsRes.status === 'fulfilled') {
                    const monthLogs = monthLogsRes.value.data;
                    const monthSessions = monthLogs?.sessions || [];
                    const present =
                        monthLogs?.summary?.presentDays ??
                        monthSessions.filter((s) => s.clockIn && s.clockOut).length;
                    setDaysPresent(present);
                }

                if (leaveRes.status === 'fulfilled') {
                    const stats = leaveRes.value.data?.statistics;
                    if (stats?.remainingLeaves !== undefined) {
                        setLeaveDaysRemaining(String(stats.remainingLeaves));
                    }
                    const capsRaw = stats?.monthlyLeaveCaps;
                    if (capsRaw?.types?.length) {
                        const totalAppliable = capsRaw.types.reduce(
                            (sum, t) => sum + (Number(t.appliableThisMonth) || 0),
                            0
                        );
                        setMonthlyCapSummary({
                            ...capsRaw,
                            totalRemainingThisMonth: Math.round(totalAppliable * 1000) / 1000,
                        });
                    }
                }

                if (tasksRes.status === 'fulfilled') {
                    setTasksCount(String(tasksRes.value.data?.tasks?.length || 0));
                }
            } catch {
                /* optional */
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchStats();
        return () => {
            cancelled = true;
        };
    }, []);

    const leaveLabel = monthlyCapSummary ? 'Leave room this month' : 'Leave remaining';
    const leaveValue = monthlyCapSummary
        ? `${monthlyCapSummary.totalRemainingThisMonth} days`
        : `${leaveDaysRemaining} days`;
    const leaveSub = monthlyCapSummary
        ? `${monthlyCapSummary.monthLabel || 'This month'} · policy monthly limits`
        : 'Available balance';

    const stacked = layout === 'stack';

    return (
        <div
            className={
                stacked
                    ? `flex h-full min-h-0 flex-col ${compact ? 'gap-3' : 'gap-4'}`
                    : `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 ${compact ? 'gap-3' : 'gap-4'}`
            }
        >
            {kpiCard(
                'Days present',
                String(daysPresent),
                'This month',
                <FaCheckCircle className={compact ? 'h-4 w-4' : 'h-5 w-5'} />,
                loading,
                compact,
                stacked
            )}
            {kpiCard(
                leaveLabel,
                leaveValue,
                leaveSub,
                <FaCalendarAlt className={compact ? 'h-4 w-4' : 'h-5 w-5'} />,
                loading,
                compact,
                stacked
            )}
            {kpiCard(
                'Pending tasks',
                tasksCount,
                'Assigned to you',
                <FaTasks className={compact ? 'h-4 w-4' : 'h-5 w-5'} />,
                loading,
                compact,
                stacked
            )}
        </div>
    );
};

export default PersonalDashboardKpiRow;
