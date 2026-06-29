import React, { useEffect, useState } from 'react';
import axios from '../../../../utils/axios';

const LeaveRing = ({ label, used, total, monthlyMode }) => {
  const safeTotal = Math.max(total || 1, 1);
  const pct = Math.min(100, Math.round(((used || 0) / safeTotal) * 100));
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="flex flex-col items-center">
      <svg width="72" height="72" className="-rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="#20C997"
          strokeWidth="6"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <p className="mt-2 text-center text-xs font-semibold text-slate-700">{label}</p>
      <p className="text-[10px] text-slate-500">{used ?? 0}/{total ?? 0}</p>
      {monthlyMode && (
        <p className="text-[9px] text-[#0d9488]">this month</p>
      )}
    </div>
  );
};

const LeaveBalancesWidget = ({ employeeId, compact = false }) => {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/v1/admin/leave-policy/balance/${employeeId}`, {
          params: { year: new Date().getFullYear() },
        });
        if (!cancelled) setBalance(res.data?.balance || null);
      } catch {
        if (!cancelled) setBalance(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [employeeId]);

  const items = balance?.balances || [];

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Leave balances</p>
      {loading ? (
        <div className="mt-4 flex justify-center py-6">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-transparent border-t-[#20C997]" />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No leave balance on file.</p>
      ) : (
        <div className={`mt-4 flex flex-wrap justify-center gap-4 ${compact ? '' : 'gap-6'}`}>
          {items.map((b) => {
            const policyType = balance?.policy?.leaveTypes?.find((lt) => lt.type === b.leaveType);
            const label = policyType?.displayName || b.leaveType;
            const monthlyEntitlement = Number(policyType?.maxDaysPerMonth) || 0;
            const totalEntitlement = (b.accrued || 0) + (b.carriedForward || 0);
            const used = (b.used || 0) + (b.pending || 0);
            return (
              <div key={b.leaveType} className="flex flex-col items-center">
                <LeaveRing
                  label={label}
                  used={used}
                  total={Math.max(totalEntitlement, 1)}
                  monthlyMode={false}
                />
                <p className="mt-1 text-[10px] font-semibold text-[#0d9488]">
                  {b.available ?? 0} available
                </p>
                {monthlyEntitlement > 0 && (
                  <p className="text-[9px] text-slate-500">
                    {monthlyEntitlement}/mo · max {monthlyEntitlement * 12}/yr
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LeaveBalancesWidget;
