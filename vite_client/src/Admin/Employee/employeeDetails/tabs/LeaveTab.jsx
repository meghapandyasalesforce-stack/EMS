import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiClock, FiEdit2, FiLayers, FiRefreshCw } from 'react-icons/fi';
import { toast } from 'react-toastify';
import axios from '../../../../utils/axios';
import SectionCard from '../SectionCard';
import styles from './LeaveTab.module.css';
import {
  EmployeeLeaveSummaryPanel,
  LeaveBalanceCard,
  LeavePeriodDropdowns,
  getDisplayLeaveBalances,
} from '../widgets/LeaveBalancesWidget';
import {
  getLeaveSummary,
  getLeaveTypeDisplayName,
} from '../../../../constants/leaveConstants';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatMonthYear = (month, year) => {
  const name = MONTHS.find((m) => m.value === month)?.label || month;
  return `${name} ${year}`;
};

const LEAVE_MIN_YEAR = 2016;
const ACTIVITY_PREVIEW_COUNT = 2;

const roundLeaveDays = (value) => Math.round((Number(value) || 0) * 1000) / 1000;

/** Mirror server split: policy first, then stock; excess → LOP or future months. */
const splitBalanceReduceAmount = ({ available = 0, manualStock = 0, reduceAmount = 0 } = {}) => {
  const availableBal = Math.max(0, roundLeaveDays(available));
  const stock = Math.max(0, roundLeaveDays(manualStock));
  const reduce = Math.max(0, roundLeaveDays(reduceAmount));
  const fromBalance = Math.min(reduce, availableBal);
  const policyBucket = Math.max(0, roundLeaveDays(availableBal - stock));
  const fromPolicy = Math.min(fromBalance, policyBucket);
  const fromManual = Math.max(0, roundLeaveDays(fromBalance - fromPolicy));
  const excessDays = Math.max(0, roundLeaveDays(reduce - fromBalance));
  return {
    fromPolicy,
    fromManual,
    fromBalance,
    excessDays,
    lopDays: excessDays,
    availableAfter: Math.max(0, roundLeaveDays(availableBal - fromBalance)),
  };
};

const computeFutureMonthsResplit = ({
  policyAnnual = 0,
  policyMonthly = 0,
  adjustMonth = 1,
  excessDays = 0,
} = {}) => {
  const month = Math.min(12, Math.max(1, Number(adjustMonth) || 1));
  const annual = Math.max(0, roundLeaveDays(policyAnnual));
  const monthly = Math.max(0, roundLeaveDays(policyMonthly));
  const excess = Math.max(0, roundLeaveDays(excessDays));
  const futureMonthCount = Math.max(0, 12 - month);
  if (futureMonthCount <= 0) {
    return {
      ok: false,
      futureMonthCount: 0,
      futureMonthlyRate: 0,
      fundedFutureMonths: 0,
      zeroedFutureMonths: 0,
      effectiveAnnual: Math.max(0, roundLeaveDays(annual - excess)),
      message: 'No future months left; use LOP for this month',
    };
  }
  if (monthly <= 0) {
    return {
      ok: false,
      futureMonthCount,
      futureMonthlyRate: 0,
      fundedFutureMonths: 0,
      zeroedFutureMonths: futureMonthCount,
      effectiveAnnual: Math.max(0, roundLeaveDays(annual - excess)),
      message: 'No monthly entitlement to re-split; use LOP instead',
    };
  }
  const futurePoolBefore = roundLeaveDays(futureMonthCount * monthly);
  const futurePoolAfter = Math.max(0, roundLeaveDays(futurePoolBefore - excess));
  const fundedFutureMonths = Math.min(
    futureMonthCount,
    Math.floor((futurePoolAfter + 1e-9) / monthly)
  );
  const fundedPool = roundLeaveDays(fundedFutureMonths * monthly);
  const zeroedFutureMonths = Math.max(0, futureMonthCount - fundedFutureMonths);
  const pastAndCurrentPool = roundLeaveDays(month * monthly);
  return {
    ok: true,
    futureMonthCount,
    futurePoolBefore,
    futurePoolAfter: fundedPool,
    futureMonthlyRate: monthly,
    fundedFutureMonths,
    zeroedFutureMonths,
    effectiveAnnual: roundLeaveDays(pastAndCurrentPool + fundedPool),
    message: null,
  };
};

const buildLopDaySlots = (lopDays = 0) => {
  const total = Math.max(0, roundLeaveDays(lopDays));
  if (total <= 0) return [];
  const slots = [];
  let remaining = total;
  while (remaining >= 1 - 0.0001) {
    slots.push({ days: 1, isHalfDay: false });
    remaining = roundLeaveDays(remaining - 1);
  }
  if (remaining >= 0.5 - 0.0001) {
    slots.push({ days: 0.5, isHalfDay: true });
  }
  return slots;
};

const emptyLopEntry = () => ({ date: '', halfDayType: 'first_half' });

const syncLopEntriesToSlots = (prevEntries = [], slots = []) =>
  slots.map((_, i) => ({
    date: prevEntries[i]?.date || '',
    halfDayType: prevEntries[i]?.halfDayType || 'first_half',
  }));

const monthDateBounds = (year, month) => {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { min: start, max: end };
};

const friendlyAction = (action) => {
  const map = {
    period_update: 'Balance recalculated',
    carry_forward: 'Carried to next year',
    monthly_auto: 'Monthly credit',
    manual_adjust: 'Manual correction',
    manual_carry_forward: 'Manual carry forward added',
    manual_carry_forward_reduce: 'Manual carry forward reduced',
    'Current balance': 'Current snapshot',
  };
  return map[action] || String(action || 'Updated').replace(/_/g, ' ');
};

const fmtDays = (n) => {
  const v = Number(n) || 0;
  return v % 1 === 0 ? String(v) : v.toFixed(1);
};

const emptyTypeForm = () => ({
  available: '0',
  used: '0',
  manualStock: '0',
  annualEntitlement: '0',
  monthlyRate: '0',
  carriedForward: '0',
  carryMode: 'add',
  excessMode: 'lop',
  lopEntries: [],
});

const ManualAdjustModal = ({
  open,
  saving,
  leaveTypes,
  forms,
  onChange,
  onLopEntryChange,
  reason,
  onReasonChange,
  onClose,
  onSave,
  viewMonth,
  viewYear,
}) => {
  if (!open) return null;

  const { min: dateMin, max: dateMax } = monthDateBounds(viewYear, viewMonth);
  const futureMonthsLeft = Math.max(0, 12 - viewMonth);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="border-b px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Balance Adjustment</h3>
          <p className="mt-1 text-sm text-slate-500">
            Add raises available. Reduce takes from this month first (policy, then imported stock).
            Extra days: choose LOP this month, or re-budget future months.
          </p>
        </div>
        <div className="overflow-y-auto px-6 py-4">
          {leaveTypes.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No leave types found on this policy.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {leaveTypes.map((lt) => {
                const typeKey = lt.type;
                const form = forms[typeKey] || emptyTypeForm();
                const label =
                  lt.displayName || getLeaveTypeDisplayName(typeKey, leaveTypes);
                const currentAvailable = Number(form.available) || 0;
                const manualStock = Number(form.manualStock) || 0;
                const policyAnnual = Number(form.annualEntitlement) || 0;
                const policyMonthly = Number(form.monthlyRate) || 0;
                const carryForward = form.carriedForward === '' ? 0 : Number(form.carriedForward) || 0;
                const carryMode = form.carryMode === 'reduce' ? 'reduce' : 'add';
                const excessMode = form.excessMode === 'future_months' ? 'future_months' : 'lop';
                const reduceSplit =
                  carryMode === 'reduce'
                    ? splitBalanceReduceAmount({
                        available: currentAvailable,
                        manualStock,
                        reduceAmount: carryForward,
                      })
                    : null;
                const futurePreview =
                  carryMode === 'reduce' &&
                  reduceSplit?.excessDays > 0 &&
                  excessMode === 'future_months'
                    ? computeFutureMonthsResplit({
                        policyAnnual,
                        policyMonthly,
                        adjustMonth: viewMonth,
                        excessDays: reduceSplit.excessDays,
                      })
                    : null;
                const showLopDates =
                  carryMode === 'reduce' &&
                  reduceSplit?.excessDays > 0 &&
                  excessMode === 'lop';
                const lopSlots = showLopDates
                  ? buildLopDaySlots(reduceSplit.excessDays)
                  : [];
                const totalAfterCarry =
                  carryMode === 'reduce'
                    ? reduceSplit.availableAfter
                    : Math.max(0, currentAvailable + carryForward);
                return (
                  <div
                    key={typeKey}
                    className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                  >
                    <h4 className="text-sm font-semibold text-slate-900">{label}</h4>
                    <div className="mt-3 flex rounded-xl border border-slate-200 bg-white p-1">
                      <button
                        type="button"
                        onClick={() => onChange(typeKey, 'carryMode', 'add')}
                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                          carryMode === 'add'
                            ? 'bg-[#20C997] text-white'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => onChange(typeKey, 'carryMode', 'reduce')}
                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                          carryMode === 'reduce'
                            ? 'bg-rose-600 text-white'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Reduce
                      </button>
                    </div>
                    <label className="mt-3 block text-sm">
                      <span className="mb-1 block font-medium text-slate-700">
                        Current Available Leave
                      </span>
                      <input
                        type="text"
                        value={`${fmtDays(currentAvailable)} Days`}
                        readOnly
                        tabIndex={-1}
                        aria-readonly="true"
                        className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-700"
                      />
                    </label>
                    <label className="mt-3 block text-sm">
                      <span className="mb-1 block font-medium text-slate-700">
                        {carryMode === 'reduce' ? 'Deduct' : 'Days to add'}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={form.carriedForward ?? '0'}
                        onChange={(e) => onChange(typeKey, 'carriedForward', e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                      />
                    </label>
                    <p className="mt-2 text-xs text-slate-600">
                      After save:{' '}
                      <span
                        className={`font-semibold ${
                          carryMode === 'reduce' ? 'text-rose-600' : 'text-[#0d9488]'
                        }`}
                      >
                        {fmtDays(totalAfterCarry)} days
                      </span>
                      {carryForward > 0 && carryMode === 'add'
                        ? ` (${fmtDays(currentAvailable)} + ${fmtDays(carryForward)})`
                        : ''}
                      {carryForward > 0 && carryMode === 'reduce'
                        ? ` (from balance: ${fmtDays(reduceSplit.fromBalance)})`
                        : ''}
                    </p>
                    {carryMode === 'reduce' && reduceSplit?.excessDays > 0 && (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-sm font-semibold text-amber-900">
                          {fmtDays(reduceSplit.excessDays)} beyond this month’s available
                        </p>
                        <p className="mt-2 text-xs font-medium text-amber-900">
                          How should the extra be handled?
                        </p>
                        <div className="mt-2 space-y-2">
                          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-100 bg-white p-2 text-sm">
                            <input
                              type="radio"
                              name={`${typeKey}-excessMode`}
                              checked={excessMode === 'lop'}
                              onChange={() => onChange(typeKey, 'excessMode', 'lop')}
                              className="mt-1"
                            />
                            <span>
                              <span className="font-semibold text-slate-800">  
                                Apply as LOP this month
                              </span>
                              <span className="mt-0.5 block text-xs text-slate-500">
                                Create loss-of-pay leave for the extra days (pick dates).
                              </span>
                            </span>
                          </label>
                          <label
                            className={`flex items-start gap-2 rounded-lg border border-amber-100 bg-white p-2 text-sm ${
                              futureMonthsLeft <= 0
                                ? 'cursor-not-allowed opacity-50'
                                : 'cursor-pointer'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`${typeKey}-excessMode`}
                              checked={excessMode === 'future_months'}
                              disabled={futureMonthsLeft <= 0}
                              onChange={() => onChange(typeKey, 'excessMode', 'future_months')}
                              className="mt-1"
                            />
                            <span>
                              <span className="font-semibold text-slate-800">
                                Adjust future months
                              </span>
                              <span className="mt-0.5 block text-xs text-slate-500">
                                {futureMonthsLeft <= 0
                                  ? 'No months left after this one — use LOP.'
                                  : `Cut extra from the remaining year pool. Later months keep full policy monthly entitlement until the pool runs out; months after that get 0.`}
                              </span>
                            </span>
                          </label>
                        </div>

                        {excessMode === 'future_months' && futurePreview?.ok && (
                          <p className="mt-3 text-xs text-amber-900">
                            Preview: remaining annual ≈{' '}
                            <strong>{fmtDays(futurePreview.effectiveAnnual)}</strong>
                            {' · '}
                            next{' '}
                            <strong>{futurePreview.fundedFutureMonths}</strong> month
                            {futurePreview.fundedFutureMonths === 1 ? '' : 's'} keep{' '}
                            <strong>{fmtDays(futurePreview.futureMonthlyRate)}</strong> / month
                            {futurePreview.zeroedFutureMonths > 0
                              ? `, then ${futurePreview.zeroedFutureMonths} month${
                                  futurePreview.zeroedFutureMonths === 1 ? '' : 's'
                                } get 0`
                              : ''}{' '}
                            after {formatMonthYear(viewMonth, viewYear)}.
                          </p>
                        )}
                        {excessMode === 'future_months' && futurePreview && !futurePreview.ok && (
                          <p className="mt-3 text-xs font-medium text-rose-700">
                            {futurePreview.message}
                          </p>
                        )}

                        {showLopDates && (
                          <>
                            <p className="mt-3 text-xs text-amber-800">
                              Choose {lopSlots.length} date
                              {lopSlots.length === 1 ? '' : 's'} in{' '}
                              {formatMonthYear(viewMonth, viewYear)}.
                              {lopSlots.some((s) => s.isHalfDay)
                                ? ' Half-day slots also need a shift.'
                                : ''}
                            </p>
                            <div className="mt-3 space-y-3">
                              {lopSlots.map((slot, idx) => {
                                const entry = (form.lopEntries || [])[idx] || emptyLopEntry();
                                return (
                                  <div
                                    key={`${typeKey}-lop-${idx}`}
                                    className="rounded-lg border border-amber-100 bg-white p-3"
                                  >
                                    <label className="block text-sm">
                                      <span className="mb-1 block font-medium text-slate-700">
                                        LOP date {idx + 1}
                                        {slot.isHalfDay ? ' (half day)' : ' (full day)'}
                                      </span>
                                      <input
                                        type="date"
                                        min={dateMin}
                                        max={dateMax}
                                        value={entry.date}
                                        onChange={(e) =>
                                          onLopEntryChange(typeKey, idx, 'date', e.target.value)
                                        }
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                      />
                                    </label>
                                    {slot.isHalfDay && (
                                      <label className="mt-2 block text-sm">
                                        <span className="mb-1 block font-medium text-slate-700">
                                          Shift
                                        </span>
                                        <select
                                          value={entry.halfDayType || 'first_half'}
                                          onChange={(e) =>
                                            onLopEntryChange(
                                              typeKey,
                                              idx,
                                              'halfDayType',
                                              e.target.value
                                            )
                                          }
                                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                        >
                                          <option value="first_half">
                                            First half (morning)
                                          </option>
                                          <option value="second_half">
                                            Second half (afternoon)
                                          </option>
                                        </select>
                                      </label>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <label className="mt-4 block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Reason</span>
            <input
              placeholder="Reason (required)"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || leaveTypes.length === 0}
            className="rounded-xl bg-[#20C997] px-4 py-2 text-sm font-semibold text-white"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

const LeaveTab = ({ employeeId }) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [balance, setBalance] = useState(null);
  const [canAdjust, setCanAdjust] = useState(false);
  const [loading, setLoading] = useState(true);
  const [auditLog, setAuditLog] = useState([]);
  const [viewYear, setViewYear] = useState(currentYear);
  const [viewMonth, setViewMonth] = useState(currentMonth);
  const [showTools, setShowTools] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustForms, setAdjustForms] = useState({});
  const [adjustInitialForms, setAdjustInitialForms] = useState({});
  const [adjustReason, setAdjustReason] = useState('');
  const [savingAdjust, setSavingAdjust] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);

  const policyLeaveTypes = balance?.policy?.leaveTypes || [];
  const editableLeaveTypes = useMemo(
    () =>
      (policyLeaveTypes || []).filter(
        (lt) => lt?.type && lt.enabled !== false && lt.type !== 'loss_of_pay'
      ),
    [policyLeaveTypes]
  );
  const employeeContext = balance?.employeeContext;
  const joiningMonth = employeeContext?.joiningMonth ?? 1;
  const joiningYear = employeeContext?.joiningYear ?? currentYear;

  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = LEAVE_MIN_YEAR; y <= currentYear; y += 1) years.push(y);
    return years;
  }, [currentYear]);

  const viewMonthOptions = useMemo(() => {
    if (viewYear === currentYear) {
      return MONTHS.filter((m) => m.value <= currentMonth);
    }
    return MONTHS;
  }, [viewYear, currentYear, currentMonth]);

  const loadBalance = useCallback(async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      const res = await axios.get(`/v1/admin/leave-policy/balance/${employeeId}`, {
        params: { year: viewYear, month: viewMonth },
      });
      const nextBalance = res.data?.balance || null;
      setBalance(nextBalance);
      setCanAdjust(Boolean(res.data?.canAdjust));
    } catch (err) {
      setBalance(null);
      setCanAdjust(false);
      const msg = err.response?.data?.message;
      if (err.response?.status === 403) toast.error(msg);
      else if (err.response?.status >= 400) toast.error(msg || 'Could not load leave balance');
    } finally {
      setLoading(false);
    }
  }, [employeeId, viewYear, viewMonth]);

  const loadAudit = useCallback(async () => {
    if (!employeeId) return;
    try {
      const res = await axios.get(`/v1/admin/leave-policy/balance/${employeeId}/audit`, { params: { limit: 100 } });
      setAuditLog(res.data?.auditLog || []);
    } catch {
      setAuditLog([]);
    }
  }, [employeeId]);

  useEffect(() => {
    setViewYear(currentYear);
    setViewMonth(currentMonth);
    setShowTools(false);
    setShowAllActivity(false);
  }, [employeeId, currentYear, currentMonth]);

  useEffect(() => { loadBalance(); }, [loadBalance]);
  useEffect(() => { loadAudit(); }, [loadAudit]);

  useEffect(() => {
    const onBalanceUpdated = (event) => {
      const updatedEmployeeId = event.detail?.employeeId;
      if (!updatedEmployeeId || String(updatedEmployeeId) !== String(employeeId)) return;
      loadBalance();
      loadAudit();
    };
    window.addEventListener('leave-balance-updated', onBalanceUpdated);
    return () => window.removeEventListener('leave-balance-updated', onBalanceUpdated);
  }, [employeeId, loadBalance, loadAudit]);

  useEffect(() => {
    if (viewYear === currentYear && viewMonth > currentMonth) {
      setViewMonth(currentMonth);
    }
  }, [viewYear, viewMonth, currentYear, currentMonth]);

  const leaveSummary = useMemo(() => getLeaveSummary(balance), [balance]);

  const refreshAll = async () => {
    await loadBalance();
    await loadAudit();
    window.dispatchEvent(new CustomEvent('leave-balance-updated', { detail: { employeeId } }));
  };

  const openEditModal = () => {
    const nextForms = {};
    editableLeaveTypes.forEach((lt) => {
      const row = (balance?.balances || []).find((b) => b.leaveType === lt.type);
      const available = Number(row?.availableDays ?? row?.available ?? 0) || 0;
      const used = Number(row?.usedDays ?? row?.used ?? 0) || 0;
      const manualStock = Number(row?.manualStock ?? row?.manualAdjustment ?? 0) || 0;
      const annualEntitlement =
        Number(row?.annualEntitlement ?? lt?.accrual?.maxAccrual ?? 0) || 0;
      const monthlyRate =
        Number(row?.monthlyRate ?? lt?.accrual?.amount ?? 0) ||
        (annualEntitlement > 0 ? annualEntitlement / 12 : 0);
      nextForms[lt.type] = {
        available: String(available),
        used: String(used),
        manualStock: String(manualStock),
        annualEntitlement: String(annualEntitlement),
        monthlyRate: String(monthlyRate),
        carriedForward: '0',
        carryMode: 'add',
        excessMode: 'lop',
        lopEntries: [],
      };
    });
    setAdjustForms(nextForms);
    setAdjustInitialForms(JSON.parse(JSON.stringify(nextForms)));
    setAdjustReason('');
    setAdjustOpen(true);
  };

  const handleAdjustFormChange = (leaveType, field, value) => {
    if (!leaveType) return;
    setAdjustForms((prev) => {
      const current = { ...(prev[leaveType] || emptyTypeForm()), [field]: value };
      if (field === 'carriedForward' || field === 'carryMode' || field === 'excessMode') {
        const available = Number(current.available) || 0;
        const manualStock = Number(current.manualStock) || 0;
        const amount = current.carriedForward === '' ? 0 : Number(current.carriedForward) || 0;
        if (current.carryMode === 'reduce') {
          const split = splitBalanceReduceAmount({
            available,
            manualStock,
            reduceAmount: amount,
          });
          const useLop =
            split.excessDays > 0 && current.excessMode !== 'future_months';
          current.lopEntries = useLop
            ? syncLopEntriesToSlots(current.lopEntries, buildLopDaySlots(split.excessDays))
            : [];
        } else {
          current.lopEntries = [];
          current.excessMode = 'lop';
        }
      }
      return { ...prev, [leaveType]: current };
    });
  };

  const handleLopEntryChange = (leaveType, index, field, value) => {
    if (!leaveType) return;
    setAdjustForms((prev) => {
      const current = { ...(prev[leaveType] || emptyTypeForm()) };
      const entries = [...(current.lopEntries || [])];
      entries[index] = { ...(entries[index] || emptyLopEntry()), [field]: value };
      current.lopEntries = entries;
      return { ...prev, [leaveType]: current };
    });
  };

  const handleSaveManualAdjust = async () => {
    if (!employeeId || !adjustReason.trim()) {
      toast.error('Please enter a reason');
      return;
    }

    const changedTypes = editableLeaveTypes.filter((lt) => {
      const form = adjustForms[lt.type] || emptyTypeForm();
      const carriedForward = form.carriedForward === '' ? 0 : Number(form.carriedForward);
      return carriedForward > 0;
    });

    if (changedTypes.length === 0) {
      toast.info('Enter an amount for at least one leave type');
      return;
    }

    for (const lt of changedTypes) {
      const form = adjustForms[lt.type] || emptyTypeForm();
      if (form.carryMode !== 'reduce') continue;
      const available = form.available === '' ? 0 : Number(form.available);
      const manualStock = form.manualStock === '' ? 0 : Number(form.manualStock);
      const amount = form.carriedForward === '' ? 0 : Number(form.carriedForward);
      const annualEntitlement = Number(form.annualEntitlement) || 0;
      const monthlyRate = Number(form.monthlyRate) || 0;
      const excessMode = form.excessMode === 'future_months' ? 'future_months' : 'lop';
      const split = splitBalanceReduceAmount({
        available,
        manualStock,
        reduceAmount: amount,
      });
      if (split.excessDays <= 0) continue;

      if (excessMode === 'future_months') {
        const preview = computeFutureMonthsResplit({
          policyAnnual: annualEntitlement,
          policyMonthly: monthlyRate,
          adjustMonth: viewMonth,
          excessDays: split.excessDays,
        });
        if (!preview.ok) {
          toast.error(
            preview.message ||
              `Cannot adjust future months for ${
                lt.displayName || getLeaveTypeDisplayName(lt.type, editableLeaveTypes)
              }`
          );
          return;
        }
        continue;
      }

      const slots = buildLopDaySlots(split.excessDays);
      const entries = form.lopEntries || [];
      if (entries.length !== slots.length || entries.some((e) => !e?.date)) {
        toast.error(
          `Select ${slots.length} LOP date${slots.length === 1 ? '' : 's'} for ${
            lt.displayName || getLeaveTypeDisplayName(lt.type, editableLeaveTypes)
          }`
        );
        return;
      }
      for (let i = 0; i < slots.length; i += 1) {
        if (
          slots[i].isHalfDay &&
          entries[i].halfDayType !== 'first_half' &&
          entries[i].halfDayType !== 'second_half'
        ) {
          toast.error('Choose a shift for each half-day LOP');
          return;
        }
      }
    }

    setSavingAdjust(true);
    try {
      let latestBalance = null;
      let totalLopDays = 0;
      let usedFutureMonths = false;
      for (const lt of changedTypes) {
        const form = adjustForms[lt.type] || emptyTypeForm();
        const available = form.available === '' ? 0 : Number(form.available);
        const used = form.used === '' ? 0 : Number(form.used);
        const manualStock = form.manualStock === '' ? 0 : Number(form.manualStock);
        const carriedForward = form.carriedForward === '' ? 0 : Number(form.carriedForward);
        const carryMode = form.carryMode === 'reduce' ? 'reduce' : 'add';
        const excessMode = form.excessMode === 'future_months' ? 'future_months' : 'lop';

        let payload = {
          year: viewYear,
          month: viewMonth,
          leaveType: lt.type,
          used,
          adjustMode: carryMode,
          adjustAmount: carriedForward,
          reason: adjustReason.trim(),
        };

        if (carryMode === 'reduce') {
          const split = splitBalanceReduceAmount({
            available,
            manualStock,
            reduceAmount: carriedForward,
          });
          if (split.excessDays > 0 && excessMode === 'lop') {
            totalLopDays = roundLeaveDays(totalLopDays + split.excessDays);
          }
          if (split.excessDays > 0 && excessMode === 'future_months') {
            usedFutureMonths = true;
          }
          const slots =
            split.excessDays > 0 && excessMode === 'lop'
              ? buildLopDaySlots(split.excessDays)
              : [];
          payload = {
            ...payload,
            accrued: Math.max(0, split.availableAfter + used),
            carriedForward: 0,
            excessMode: split.excessDays > 0 ? excessMode : undefined,
            lopEntries: slots.map((slot, i) => ({
              date: form.lopEntries[i].date,
              halfDayType: slot.isHalfDay ? form.lopEntries[i].halfDayType : undefined,
            })),
          };
        } else {
          const newAvailable = available + carriedForward;
          payload = {
            ...payload,
            accrued: Math.max(0, newAvailable + used),
            carriedForward,
          };
        }

        const res = await axios.patch(
          `/v1/admin/leave-policy/balance/${employeeId}/adjust`,
          payload
        );
        latestBalance = res.data?.balance || latestBalance;
      }
      if (latestBalance) setBalance(latestBalance);
      setAdjustOpen(false);
      const baseMsg =
        changedTypes.length === 1
          ? 'Leave type balance adjusted'
          : `${changedTypes.length} leave type balances adjusted`;
      let detail = '';
      if (totalLopDays > 0) detail = ` ${fmtDays(totalLopDays)} day(s) applied as LOP.`;
      else if (usedFutureMonths) detail = ' Future months re-budgeted for excess.';
      toast.success(`${baseMsg}.${detail}`);
      await refreshAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Adjustment failed');
    } finally {
      setSavingAdjust(false);
    }
  };

  const displayBalances = useMemo(
    () => getDisplayLeaveBalances(balance, policyLeaveTypes),
    [balance, policyLeaveTypes]
  );

  const visibleActivity = showAllActivity ? auditLog : auditLog.slice(0, ACTIVITY_PREVIEW_COUNT);
  const hasMoreActivity = auditLog.length > ACTIVITY_PREVIEW_COUNT;

  const isCurrentPeriod = viewYear === currentYear && viewMonth === currentMonth;

  const overviewSubtitle = useMemo(() => {
    const parts = [];
    parts.push(isCurrentPeriod ? 'As of today' : `As of ${formatMonthYear(viewMonth, viewYear)}`);
    if (balance?.policy?.policyName) parts.push(balance.policy.policyName);
    if (employeeContext?.joiningDate) {
      parts.push(`Joined ${formatMonthYear(joiningMonth, joiningYear)}`);
    }
    return parts.join(' · ');
  }, [
    isCurrentPeriod,
    viewMonth,
    viewYear,
    balance?.policy?.policyName,
    employeeContext?.joiningDate,
    joiningMonth,
    joiningYear,
  ]);

  return (
    <div className="space-y-5">
      <EmployeeLeaveSummaryPanel
        className={styles.summaryPanel}
        summary={leaveSummary}
        loading={loading}
        subtitle={!loading ? overviewSubtitle : undefined}
      />

      {canAdjust && (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setShowTools((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <span className="flex items-center gap-2 font-semibold text-slate-800">
              <FiRefreshCw className="h-4 w-4 text-[#20C997]" />
              Balance Adjustments
            </span>
            <span className="text-sm text-[#0d9488]">{showTools ? 'Hide' : 'Show'}</span>
          </button>
          {showTools && (
            <div className="border-t border-slate-100 px-5 pb-5 pt-4">
              <button
                type="button"
                onClick={openEditModal}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                <FiEdit2 className="h-4 w-4" />
                Balance Adjustment
              </button>
            </div>
          )}
        </div>
      )}

      <SectionCard
        title="Leave balances"
        icon={FiLayers}
        action={
          <LeavePeriodDropdowns
            viewMonth={viewMonth}
            viewYear={viewYear}
            onMonthChange={setViewMonth}
            onYearChange={setViewYear}
            monthOptions={viewMonthOptions}
            yearOptions={yearOptions}
            className={`ml-0 ${styles.periodControls}`}
          />
        }
      >
        {loading ? (
          <div className="flex justify-center py-14">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-transparent border-t-[#20C997]" />
          </div>
        ) : !balance ? (
          <p className="py-8 text-center text-sm text-slate-500">No leave balance for this period. Assign a leave policy first.</p>
        ) : (
          <>
            {balance.policy?.policyName && (
              <div className="mb-4 rounded-lg border border-[#20C997]/25 bg-[#20C997]/10 px-4 py-2.5 text-sm text-[#0d9488]">
                <span className="font-semibold">Policy:</span> {balance.policy.policyName}
              </div>
            )}
            {displayBalances.length > 0 ? (
              <div className={styles.balanceGrid}>
                {displayBalances.map((typeBalance) => (
                  <LeaveBalanceCard
                    className={styles.balanceCard}
                    key={typeBalance.leaveType}
                    typeBalance={typeBalance}
                    policyLeaveTypes={policyLeaveTypes}
                  />
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">No leave types configured for this policy.</p>
            )}
          </>
        )}
      </SectionCard>

      {auditLog.length > 0 && (
        <SectionCard title="Recent activity" icon={FiClock}>
          <ul className="divide-y divide-slate-100">
            {visibleActivity.map((entry) => {
              const prev = entry.previousBalance?.available;
              const next = entry.newBalance?.available;
              const changed = prev != null && next != null && prev !== next;
              return (
                <li key={entry._id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-slate-800">{friendlyAction(entry.action)}</p>
                    <p className="text-xs text-slate-500">
                      {entry.leaveType && (
                        <span className="font-medium text-slate-600">
                          {entry.leaveType === 'employee'
                            ? 'Employee leave balance'
                            : getLeaveTypeDisplayName(entry.leaveType, policyLeaveTypes)}
                          {' · '}
                        </span>
                      )}
                      {entry.action === 'carry_forward' && entry.carryForwardFromYear
                        ? `${entry.carryForwardFromYear} → ${entry.carryForwardToYear}`
                        : entry.fromYear
                          ? `${formatMonthYear(entry.fromMonth, entry.fromYear)} → ${formatMonthYear(entry.toMonth, entry.toYear)}`
                          : formatDate(entry.performedAt)}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    {changed ? (
                      <span>
                        <span className="text-slate-400">{fmtDays(prev)}</span>
                        <span className="mx-1 text-slate-300">→</span>
                        <span className="font-semibold text-[#0d9488]">{fmtDays(next)} days</span>
                      </span>
                    ) : next != null ? (
                      <span className="font-semibold text-[#0d9488]">{fmtDays(next)} days</span>
                    ) : null}
                    <p className="text-xs text-slate-400">{formatDate(entry.performedAt)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          {hasMoreActivity && (
            <div className="border-t border-slate-100 pt-3 text-center">
              <button
                type="button"
                onClick={() => setShowAllActivity((expanded) => !expanded)}
                className="text-sm font-semibold text-[#0d9488] transition hover:text-[#0f766e]"
              >
                {showAllActivity
                  ? 'Show less'
                  : `See more (${auditLog.length - ACTIVITY_PREVIEW_COUNT} more)`}
              </button>
            </div>
          )}
        </SectionCard>
      )}

      <ManualAdjustModal
        open={adjustOpen}
        leaveTypes={editableLeaveTypes}
        forms={adjustForms}
        reason={adjustReason}
        saving={savingAdjust}
        viewMonth={viewMonth}
        viewYear={viewYear}
        onChange={handleAdjustFormChange}
        onLopEntryChange={handleLopEntryChange}
        onReasonChange={setAdjustReason}
        onClose={() => !savingAdjust && setAdjustOpen(false)}
        onSave={handleSaveManualAdjust}
      />
    </div>
  );
};

export default LeaveTab;
