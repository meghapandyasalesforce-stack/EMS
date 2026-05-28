import React, { useEffect, useState } from 'react';
import axios from '../../../../utils/axios';
import SectionCard from '../SectionCard';

const LeaveTab = ({ employeeId }) => {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/v1/admin/leave-policy/balance/${employeeId}`, {
          params: { year },
        });
        if (!cancelled) setBalance(res.data?.balance || null);
      } catch {
        if (!cancelled) setBalance(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [employeeId, year]);

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
                return (
                  <div
                    key={typeBalance.leaveType}
                    className="rounded-2xl border border-slate-100 bg-slate-50/80 p-5"
                  >
                    <h4 className="font-semibold capitalize text-slate-900">{label} leave</h4>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Accrued</dt>
                        <dd>{typeBalance.accrued ?? 0} days</dd>
                      </div>
                      {typeBalance.carriedForward > 0 && (
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
                          <dt className="text-slate-500">Monthly limit</dt>
                          <dd className="text-slate-600">{policyType.maxDaysPerMonth} days/month</dd>
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
    </div>
  );
};

export default LeaveTab;
