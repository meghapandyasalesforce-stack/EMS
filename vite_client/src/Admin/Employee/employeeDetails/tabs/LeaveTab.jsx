import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import axios from '../../../../utils/axios';
import SectionCard from '../SectionCard';

const formatDate = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const AdjustLeaveModal = ({ open, leaveTypeLabel, form, saving, onChange, onClose, onSave }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="adjust-leave-title"
        className="w-full max-w-md rounded-2xl border border-slate-100 bg-white shadow-xl"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 id="adjust-leave-title" className="text-lg font-semibold text-slate-900">
            Adjust {leaveTypeLabel} balance
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Manual changes override automatic accrual for this leave type until HR recalculates org-wide balances.
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Accrued (days)</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={form.accrued}
              onChange={(e) => onChange('accrued', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Used (days)</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={form.used}
              onChange={(e) => onChange('used', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Carried forward (days)</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={form.carriedForward}
              onChange={(e) => onChange('carriedForward', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Reason <span className="font-normal text-slate-400">(recommended)</span>
            </span>
            <textarea
              rows={3}
              value={form.reason}
              onChange={(e) => onChange('reason', e.target.value)}
              placeholder="e.g. Opening balance correction, carry-over from previous employer"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-[#20C997] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1ab386] disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

const LeaveTab = ({ employeeId }) => {
  const [balance, setBalance] = useState(null);
  const [canAdjust, setCanAdjust] = useState(false);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjustForm, setAdjustForm] = useState({
    accrued: '',
    used: '',
    carriedForward: '',
    reason: '',
  });
  const [saving, setSaving] = useState(false);

  const loadBalance = useCallback(async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      const res = await axios.get(`/v1/admin/leave-policy/balance/${employeeId}`, {
        params: { year },
      });
      setBalance(res.data?.balance || null);
      setCanAdjust(Boolean(res.data?.canAdjust));
    } catch (err) {
      setBalance(null);
      setCanAdjust(false);
      const message = err.response?.data?.message;
      if (message && err.response?.status === 403) {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }, [employeeId, year]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  const openAdjust = (typeBalance, label) => {
    setAdjustTarget({ leaveType: typeBalance.leaveType, label });
    setAdjustForm({
      accrued: String(typeBalance.accrued ?? 0),
      used: String(typeBalance.used ?? 0),
      carriedForward: String(typeBalance.carriedForward ?? 0),
      reason: typeBalance.manualOverride?.reason || '',
    });
  };

  const closeAdjust = () => {
    if (saving) return;
    setAdjustTarget(null);
  };

  const handleAdjustChange = (field, value) => {
    setAdjustForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveAdjust = async () => {
    if (!adjustTarget || !employeeId) return;
    setSaving(true);
    try {
      const res = await axios.patch(
        `/v1/admin/leave-policy/balance/${employeeId}/adjust`,
        {
          year,
          leaveType: adjustTarget.leaveType,
          accrued: adjustForm.accrued === '' ? undefined : Number(adjustForm.accrued),
          used: adjustForm.used === '' ? undefined : Number(adjustForm.used),
          carriedForward:
            adjustForm.carriedForward === '' ? undefined : Number(adjustForm.carriedForward),
          reason: adjustForm.reason.trim(),
        }
      );
      setBalance(res.data?.balance || null);
      setCanAdjust(Boolean(res.data?.canAdjust));
      setAdjustTarget(null);
      toast.success(res.data?.message || 'Leave balance updated');
      window.dispatchEvent(new CustomEvent('leave-balance-updated', { detail: { employeeId } }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update leave balance');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Leave balances"
        action={
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          >
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        }
      >
        {canAdjust && !loading && balance?.balances?.length > 0 && (
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            You can manually adjust leave balances for this employee. Use <strong>Edit</strong> on each leave type card.
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-transparent border-t-[#20C997]" />
          </div>
        ) : !balance?.balances?.length ? (
          <p className="text-sm text-slate-500">No leave balance found for this year.</p>
        ) : (
          <>
            {balance.policy?.policyName && (
              <p className="mb-4 rounded-xl border border-[#20C997]/30 bg-[#20C997]/10 px-4 py-2 text-sm text-[#0d9488]">
                <strong>Policy:</strong> {balance.policy.policyName}
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {balance.balances.map((typeBalance) => {
                const policyType = balance.policy?.leaveTypes?.find(
                  (lt) => lt.type === typeBalance.leaveType
                );
                const label = policyType?.displayName || typeBalance.leaveType;
                const manual = typeBalance.manualOverride;
                return (
                  <div
                    key={typeBalance.leaveType}
                    className="rounded-2xl border border-slate-100 bg-slate-50/80 p-5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold capitalize text-slate-900">{label} leave</h4>
                      {canAdjust && (
                        <button
                          type="button"
                          onClick={() => openAdjust(typeBalance, label)}
                          className="shrink-0 rounded-lg border border-[#20C997]/40 bg-white px-2.5 py-1 text-xs font-semibold text-[#0d9488] hover:bg-[#20C997]/10"
                        >
                          Edit
                        </button>
                      )}
                    </div>

                    {manual?.active && (
                      <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                        Manually adjusted
                        {manual.adjustedAt ? ` · ${formatDate(manual.adjustedAt)}` : ''}
                        {manual.reason ? ` · ${manual.reason}` : ''}
                      </p>
                    )}

                    <dl className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Accrued</dt>
                        <dd>{typeBalance.accrued ?? 0} days</dd>
                      </div>
                      {(typeBalance.carriedForward ?? 0) > 0 && (
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Carried forward</dt>
                          <dd className="text-[#0d9488]">+{typeBalance.carriedForward} days</dd>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Used</dt>
                        <dd className="text-red-600">-{typeBalance.used ?? 0} days</dd>
                      </div>
                      {typeBalance.pending > 0 && (
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Pending</dt>
                          <dd className="text-amber-600">-{typeBalance.pending} days</dd>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold">
                        <dt>Available</dt>
                        <dd className="text-[#20C997]">{typeBalance.available ?? 0} days</dd>
                      </div>
                      {policyType?.maxDaysPerMonth > 0 && (
                        <div className="flex justify-between border-t border-slate-100 pt-2">
                          <dt className="text-slate-500">Monthly entitlement</dt>
                          <dd className="text-slate-600">
                            {policyType.maxDaysPerMonth} days/month ({policyType.maxDaysPerMonth * 12}/year max)
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </SectionCard>

      <AdjustLeaveModal
        open={Boolean(adjustTarget)}
        leaveTypeLabel={adjustTarget?.label || ''}
        form={adjustForm}
        saving={saving}
        onChange={handleAdjustChange}
        onClose={closeAdjust}
        onSave={handleSaveAdjust}
      />
    </div>
  );
};

export default LeaveTab;
