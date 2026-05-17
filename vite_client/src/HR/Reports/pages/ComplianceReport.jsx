import React from 'react';
import { FaFileInvoice, FaPercent, FaClipboardCheck, FaShieldAlt } from 'react-icons/fa';
import ReportKpiCard from '../components/ReportKpiCard';
import ReportPageHeader from '../components/ReportPageHeader';
import ReportDataTable from '../components/ReportDataTable';

const COMPLIANCE_GAUGES = [
    { label: 'Labor Law', value: 90, detail: '12 of 14 mandates fulfilled' },
    { label: 'Tax Compliance', value: 98, detail: 'GST & TDS filings up to date' },
    { label: 'Health & Safety', value: 85, detail: 'OSHA standards review pending', warning: true },
];

const COMPLIANCE_ITEMS = [
    { id: 1, name: 'Provident Fund Return', category: 'Statutory Filing', lastAudit: 'Oct 12, 2023', due: 'Nov 15, 2023', status: 'COMPLIANT', score: 100 },
    { id: 2, name: 'TDS Remittance', category: 'Financial', lastAudit: 'Oct 28, 2023', due: 'Nov 07, 2023', status: 'ACTION REQUIRED', score: 78 },
    { id: 3, name: 'POSH Policy Acknowledgment', category: 'Legal Mandate', lastAudit: 'Sep 15, 2023', due: 'Dec 31, 2023', status: 'COMPLIANT', score: 92 },
    { id: 4, name: 'Fire Safety Audit', category: 'Infrastructure', lastAudit: 'Aug 20, 2023', due: 'Feb 20, 2024', status: 'VALID', score: 95 },
];

const Gauge = ({ label, value, detail, warning }) => (
    <div className="flex flex-col items-center rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="relative h-28 w-28">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke={warning ? '#fb923c' : '#20C997'}
                    strokeWidth="8"
                    strokeDasharray={`${value * 2.64} 264`}
                    strokeLinecap="round"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-slate-900">{value}%</span>
                <span className="text-[10px] text-slate-500">Health</span>
            </div>
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-900">{label}</p>
        <p className="mt-1 text-center text-xs text-slate-500">{detail}</p>
    </div>
);

const statusPill = (status) => {
    const s = (status || '').toUpperCase();
    const styles =
        s === 'COMPLIANT' || s === 'VALID'
            ? 'bg-emerald-100 text-emerald-700'
            : s === 'ACTION REQUIRED'
              ? 'bg-orange-100 text-orange-700'
              : 'bg-slate-100 text-slate-600';
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles}`}>{status}</span>;
};

const ComplianceReport = () => (
    <div>
        <ReportPageHeader
            title="Statutory & Compliance Report"
            subtitle="Regulatory health and operational compliance"
            searchPlaceholder="Search compliance items..."
        />

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ReportKpiCard title="PF Filing Status" value="100%" subtitle="Completed" icon={FaFileInvoice} />
            <ReportKpiCard title="TDS Compliance" value="98%" subtitle="Active" icon={FaPercent} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
            <ReportKpiCard
                title="Policy Acknowledgment"
                value="92%"
                subtitle="Pending reviews"
                icon={FaClipboardCheck}
                iconBg="bg-orange-50"
                iconColor="text-orange-600"
            />
            <ReportKpiCard
                title="Document Audit"
                value="Pass"
                subtitle="Next audit in 14 days"
                icon={FaShieldAlt}
                highlight
            />
        </div>

        <div className="mb-6">
            <h3 className="mb-4 text-base font-semibold text-slate-900">Compliance Health Index</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {COMPLIANCE_GAUGES.map((g) => (
                    <Gauge key={g.label} {...g} />
                ))}
            </div>
        </div>

        <ReportDataTable
            title="Operational Compliance List"
            footer="Showing 4 of 24 active compliance items"
            columns={[
                { key: 'name', label: 'Item Name' },
                { key: 'category', label: 'Category' },
                { key: 'lastAudit', label: 'Last Audit Date' },
                { key: 'due', label: 'Due Date' },
                { key: 'status', label: 'Status', render: (r) => statusPill(r.status) },
                {
                    key: 'score',
                    label: 'Score',
                    render: (r) => (
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                                <div
                                    className="h-full rounded-full bg-[#20C997]"
                                    style={{ width: `${r.score}%` }}
                                />
                            </div>
                            <span className="text-xs font-medium">{r.score}</span>
                        </div>
                    ),
                },
            ]}
            rows={COMPLIANCE_ITEMS}
        />
    </div>
);

export default ComplianceReport;
