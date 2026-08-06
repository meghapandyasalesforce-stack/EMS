import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaPlus } from 'react-icons/fa';
import { format } from 'date-fns';
import axios from '../utils/axios';
import { EMPLOYEE_LEAVE_ENDPOINT } from '../utils/constant';

const CARD_BORDER = 'rgba(148, 163, 184, 0.24)';

const LeaveBalanceCard = () => {
    const navigate = useNavigate();
    const [statsLoading, setStatsLoading] = useState(true);
    const [leaveDaysRemaining, setLeaveDaysRemaining] = useState('0');
    const [monthlyCapSummary, setMonthlyCapSummary] = useState(null);
    const [fallbackBalance, setFallbackBalance] = useState(null);

    useEffect(() => {
        let cancelled = false;

        const fetchLeaveBalance = async () => {
            try {
                setStatsLoading(true);
                const [leavesResponse, balanceResponse] = await Promise.allSettled([
                    axios.get(`${EMPLOYEE_LEAVE_ENDPOINT}/get-my-leaves`, {
                        withCredentials: true,
                    }),
                    axios.get(`${EMPLOYEE_LEAVE_ENDPOINT}/balance`, {
                        withCredentials: true,
                    }),
                ]);

                if (cancelled) return;

                const stats =
                    leavesResponse.status === 'fulfilled'
                        ? leavesResponse.value.data?.statistics
                        : null;
                if (stats?.remainingLeaves !== undefined) {
                    setLeaveDaysRemaining(String(stats.remainingLeaves));
                }

                const capsRaw = stats?.monthlyLeaveCaps;
                if (capsRaw?.types?.length) {
                    setMonthlyCapSummary(capsRaw);
                } else {
                    setMonthlyCapSummary(null);
                }

                if (balanceResponse.status === 'fulfilled') {
                    setFallbackBalance(balanceResponse.value.data?.balance || null);
                } else {
                    setFallbackBalance(null);
                }
            } catch {
                if (!cancelled) {
                    setMonthlyCapSummary(null);
                    setFallbackBalance(null);
                }
            } finally {
                if (!cancelled) {
                    setStatsLoading(false);
                }
            }
        };

        fetchLeaveBalance();

        return () => {
            cancelled = true;
        };
    }, []);

    const fallbackMonthLabel = fallbackBalance?.viewPeriod
        ? format(new Date(fallbackBalance.viewPeriod.year, fallbackBalance.viewPeriod.month - 1, 1), 'MMMM yyyy')
        : 'This month';
    const policyTypes = (fallbackBalance?.policy?.leaveTypes || []).filter(
        (type) => type?.type && type.enabled !== false
    );
    const fallbackSourceRows =
        policyTypes.length > 0
            ? policyTypes.map((policyType) => {
                const balanceRow =
                    (fallbackBalance?.balances || []).find((row) => row.leaveType === policyType.type) || {};
                return {
                    ...balanceRow,
                    leaveType: policyType.type,
                    leaveTypeDisplayName:
                        balanceRow.leaveTypeDisplayName ||
                        policyType.displayName ||
                        String(policyType.type).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
                    monthlyRateDisplay:
                        balanceRow.monthlyRateDisplay ??
                        policyType?.accrual?.amount ??
                        0,
                    monthlyRate:
                        balanceRow.monthlyRate ??
                        policyType?.accrual?.amount ??
                        0,
                    availableDisplay: balanceRow.availableDisplay ?? balanceRow.availableDays ?? balanceRow.available ?? 0,
                    availableDays: balanceRow.availableDays ?? balanceRow.available ?? 0,
                    available: balanceRow.available ?? 0,
                };
            })
            : (fallbackBalance?.balances || []);
    const fallbackTypeRows = fallbackSourceRows
        .filter((row) => row?.leaveType)
        .map((row) => {
            const monthlyEntitlement = Number(row.monthlyRateDisplay ?? row.monthlyRate ?? row.currentMonthAccrual ?? 0);
            const availableBalance = Number(row.availableDisplay ?? row.availableDays ?? row.available ?? 0);
            return {
                leaveType: row.leaveType,
                displayName:
                    row.leaveTypeDisplayName ||
                    String(row.leaveType).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
                availableBalance,
                appliableThisMonth: availableBalance,
                maxDaysPerMonth: monthlyEntitlement > 0 ? monthlyEntitlement : Number(row.monthlyTakeLimit ?? 0),
                monthlyEntitlement,
            };
        })
        .filter((row) => row.monthlyEntitlement > 0 || row.availableBalance > 0);

    const detailRows = monthlyCapSummary?.types?.length ? monthlyCapSummary.types : fallbackTypeRows;
    const detailMonthLabel = monthlyCapSummary?.monthLabel || fallbackMonthLabel;

    return (
        <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: CARD_BORDER }}>
            <h3 className="text-sm font-semibold text-slate-900">Leave balance</h3>
            {statsLoading ? (
                <p className="mt-3 text-3xl font-bold text-[#006D4E]">...</p>
            ) : detailRows.length > 0 ? (
                <>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                        {detailMonthLabel || 'This month'}
                    </p>
                    <ul className="mt-3 space-y-2.5">
                        {detailRows.map((type) => (
                            <li
                                key={type.leaveType}
                                className="rounded-lg border border-slate-100 bg-[#F8F9FB] px-3 py-2 text-sm"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <span className="font-medium text-slate-800">{type.displayName}</span>
                                    <span className="shrink-0 text-right text-slate-700">
                                        <span className="font-semibold text-[#006D4E]">
                                            {type.availableBalance ?? 0}
                                        </span>
                                        <span className="text-slate-500"> days available</span>
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">
                                    Can apply this month:{' '}
                                    <span className="font-semibold text-[#006D4E]">
                                        {type.appliableThisMonth ?? type.remainingThisMonth ?? 0}
                                    </span>{' '}
                                    / {type.maxDaysPerMonth} max per month
                                    {type.monthlyEntitlement ? <> . earns {type.monthlyEntitlement}/month</> : null}
                                </p>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
                        Unused monthly entitlement stays in your year-to-date balance. The per-month limit is the
                        maximum you can take in one calendar month.
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                        Annual days available: <span className="font-semibold text-slate-800">{leaveDaysRemaining}</span>
                    </p>
                </>
            ) : (
                <>
                    <p className="mt-3 text-3xl font-bold text-[#006D4E]">{leaveDaysRemaining}</p>
                    <p className="text-xs text-slate-500">days remaining</p>
                </>
            )}
            <div className="mt-4 space-y-2">
                <button
                    type="button"
                    onClick={() => navigate('/employee/leave-attendance')}
                    className="w-full rounded-full bg-[#20C997] py-2.5 text-sm font-semibold text-white transition hover:bg-[#1ab589]"
                >
                    <FaPlus className="mr-2 inline h-3 w-3" />
                    Apply for leave
                </button>
                <button
                    type="button"
                    onClick={() => navigate('/my-leave')}
                    className="w-full rounded-full border-2 border-[#20C997] py-2.5 text-sm font-semibold text-[#20C997] transition hover:bg-[#20C997]/10"
                >
                    <FaEye className="mr-2 inline h-3 w-3" />
                    View my leaves
                </button>
            </div>
        </div>
    );
};

export default LeaveBalanceCard;
