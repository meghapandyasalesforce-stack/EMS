import React, { useCallback, useEffect, useState } from 'react';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';

const LeaveReportsPage = () => {
  const [tab, setTab] = useState('balance');
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      let url = '';
      if (tab === 'balance') url = `/v1/admin/leave-reports/balance-report?year=${year}`;
      else if (tab === 'usage') url = `/v1/admin/leave-reports/usage-trends?startDate=${year}-01-01&endDate=${year}-12-31`;
      else url = `/v1/admin/leave-reports/approval-analytics?year=${year}`;

      const res = await axios.get(url);
      setData(res.data?.data || res.data);
    } catch (err) {
      setData(null);
      toast.error(err.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [tab, year]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const tabs = [
    { id: 'balance', label: 'Leave Balance' },
    { id: 'usage', label: 'Leave Usage' },
    { id: 'approval', label: 'Approval Analytics' },
  ];

  return (
    <div className="page-shell mx-auto w-full">
      <div className="page-shell-inner">
      <h1 className="text-2xl font-bold text-slate-900">Leave Reports</h1>
      <p className="mt-1 text-sm text-slate-500">
        Employee balances, monthly usage, carry-forward summaries, and approval statistics.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="hrms-tabs-scroll">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === t.id ? 'bg-[#20C997] text-white' : 'border border-slate-200 bg-white text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
        </div>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:ml-auto sm:w-auto"
        >
          {[year - 2, year - 1, year, year + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-transparent border-t-[#20C997]" />
          </div>
        ) : !data ? (
          <p className="text-sm text-slate-500">No report data available.</p>
        ) : (
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap text-xs text-slate-700">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
      </div>
    </div>
  );
};

export default LeaveReportsPage;
