import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
    FaBalanceScale, FaCheckCircle, FaDownload, FaExclamationTriangle, FaFileCsv, FaFilePdf,
    FaHistory, FaPrint, FaSearch, FaSync, FaUsers,
} from 'react-icons/fa';
import axios, { getBackendBaseURL } from '../../utils/axios';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import { useEmployees } from '../../Hooks/useDashboardData';
import LoadingSpinner from '../../components/LoadingSpinner';

const FALLBACK_MODULES = [
    { key: 'form16', label: 'Form 16', category: 'Tax', description: 'TDS certificate under Section 203' },
    { key: 'form12ba', label: 'Form 12BA', category: 'Tax', description: 'Statement of perquisites' },
    { key: 'tds_summary', label: 'TDS Summary', category: 'Tax', description: 'Monthly / quarterly / annual TDS' },
    { key: 'epf_statement', label: 'EPF Statement', category: 'Provident Fund', description: 'PF contributions & UAN' },
    { key: 'esi_statement', label: 'ESI Statement', category: 'Insurance', description: 'ESI contributions' },
    { key: 'gratuity_statement', label: 'Gratuity Statement', category: 'Benefits', description: 'Gratuity Act estimate' },
    { key: 'professional_tax', label: 'Professional Tax', category: 'State', description: 'State PT summary' },
    { key: 'lwf_summary', label: 'LWF Summary', category: 'State', description: 'Labour Welfare Fund' },
    { key: 'shops_establishment', label: 'Shops & Establishment', category: 'Organization', description: 'Registration & renewal' },
    { key: 'investment_declaration', label: 'Investment Declaration', category: 'Tax', description: '80C / 80D / HRA / loans' },
    { key: 'compliance_report', label: 'Compliance Report', category: 'Dashboard', description: 'Org-wide compliance' },
];

const NEEDS_EMPLOYEE = new Set([
    'form16', 'form12ba', 'tds_summary', 'epf_statement', 'esi_statement',
    'gratuity_statement', 'professional_tax', 'lwf_summary', 'investment_declaration',
]);

function resolveUrl(url) {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    const base = getBackendBaseURL?.() || '';
    return `${base}${url.startsWith('/') ? url : `/${url}`}`;
}

function inr(n) {
    return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function ValidationBadges({ validations }) {
    if (!validations || typeof validations !== 'object') return null;
    const entries = Object.entries(validations).filter(([, v]) => v && typeof v === 'object' && 'valid' in v);
    if (!entries.length) return null;
    return (
        <div className="flex flex-wrap gap-2">
            {entries.map(([key, v]) => (
                <span
                    key={key}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        v.valid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                    }`}
                    title={v.message || ''}
                >
                    {v.valid ? <FaCheckCircle /> : <FaExclamationTriangle />}
                    {key.toUpperCase()}: {v.valid ? 'OK' : (v.message || 'Check')}
                </span>
            ))}
        </div>
    );
}

function DataTable({ columns, rows, empty = 'No rows' }) {
    if (!rows?.length) {
        return <p className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500">{empty}</p>;
    }
    return (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                        {columns.map((c) => (
                            <th key={c.key} className="px-3 py-2 font-semibold">{c.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={row.id || row.label || i} className="border-t border-gray-50">
                            {columns.map((c) => (
                                <td key={c.key} className="px-3 py-2 text-gray-800">
                                    {c.render ? c.render(row) : row[c.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function SectionCard({ title, children, actions }) {
    return (
        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
                {actions}
            </div>
            {children}
        </section>
    );
}

function KvGrid({ items = [] }) {
    return (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
                <div key={item.label} className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">{item.label}</p>
                    <p className="text-sm font-semibold text-gray-900 break-words">{item.value ?? '—'}</p>
                </div>
            ))}
        </div>
    );
}

function exportCsv(filename, rows, columns) {
    const header = columns.map((c) => c.label).join(',');
    const body = rows.map((row) => columns.map((c) => {
        const raw = c.exportValue ? c.exportValue(row) : row[c.key];
        const val = String(raw ?? '').replace(/"/g, '""');
        return `"${val}"`;
    }).join(',')).join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * India Statutory Compliance Center — dedicated workspace per statutory module.
 * Reuses payroll/tax/document APIs via /admin/lifecycle/statutory/*.
 */
const StatutoryCompliancePanel = () => {
    const { data: employeeData = { employees: [] } } = useEmployees();
    const employees = employeeData?.employees || [];

    const [modules, setModules] = useState(FALLBACK_MODULES);
    const [moduleKey, setModuleKey] = useState('form16');
    const [employeeId, setEmployeeId] = useState('');
    const [department, setDepartment] = useState('');
    const [searchEmp, setSearchEmp] = useState('');
    const [requireApproval, setRequireApproval] = useState(false);
    const [orgDash, setOrgDash] = useState(null);
    const [preview, setPreview] = useState(null);
    const [history, setHistory] = useState([]);
    const [loadingDash, setLoadingDash] = useState(true);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [bulkIds, setBulkIds] = useState([]);
    const [bulkRunning, setBulkRunning] = useState(false);
    const [bulkResult, setBulkResult] = useState(null);
    const [activeTab, setActiveTab] = useState('overview'); // overview | history | bulk

    const selectedModule = useMemo(
        () => modules.find((m) => m.key === moduleKey) || FALLBACK_MODULES.find((m) => m.key === moduleKey),
        [modules, moduleKey],
    );

    const needsEmployee = NEEDS_EMPLOYEE.has(moduleKey);

    const departments = useMemo(() => {
        const set = new Set(employees.map((e) => e.department).filter(Boolean));
        return [...set].sort();
    }, [employees]);

    const filteredEmployees = useMemo(() => {
        const q = searchEmp.trim().toLowerCase();
        return employees.filter((e) => {
            if (department && e.department !== department) return false;
            if (!q) return true;
            const name = `${e.name || ''} ${e.lastName || ''} ${e.email || ''} ${e.employeeId || ''}`.toLowerCase();
            return name.includes(q);
        });
    }, [employees, department, searchEmp]);

    const loadModulesAndDash = useCallback(async () => {
        try {
            setLoadingDash(true);
            const [modRes, dashRes] = await Promise.all([
                axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/statutory/modules`).catch(() => ({ data: { data: FALLBACK_MODULES } })),
                axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/statutory/dashboard`),
            ]);
            setModules(modRes.data.data?.length ? modRes.data.data : FALLBACK_MODULES);
            setOrgDash(dashRes.data.data);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load statutory dashboard');
            setOrgDash(null);
        } finally {
            setLoadingDash(false);
        }
    }, []);

    useEffect(() => { loadModulesAndDash(); }, [loadModulesAndDash]);

    const loadPreview = useCallback(async () => {
        if (needsEmployee && !employeeId) {
            setPreview(null);
            return;
        }
        try {
            setLoadingPreview(true);
            const { data } = await axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/statutory/preview`, {
                params: { docType: moduleKey, employeeId: employeeId || undefined },
            });
            setPreview(data.data);
        } catch (err) {
            setPreview(null);
            toast.error(err.response?.data?.message || 'Preview failed');
        } finally {
            setLoadingPreview(false);
        }
    }, [moduleKey, employeeId, needsEmployee]);

    const loadHistory = useCallback(async () => {
        try {
            const { data } = await axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/statutory/history`, {
                params: {
                    docType: moduleKey,
                    employeeId: employeeId || undefined,
                    limit: 40,
                },
            });
            const payload = data.data;
            setHistory(Array.isArray(payload) ? payload : (payload?.documents || []));
        } catch {
            setHistory([]);
        }
    }, [moduleKey, employeeId]);

    useEffect(() => {
        loadPreview();
        loadHistory();
        setBulkResult(null);
        setActiveTab('overview');
    }, [loadPreview, loadHistory]);

    const generatePdf = async () => {
        if (needsEmployee && !employeeId) {
            toast.error('Select an employee');
            return;
        }
        try {
            setGenerating(true);
            const { data } = await axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/statutory/generate`, {
                docType: moduleKey,
                employeeId: employeeId || undefined,
                requireApproval,
            });
            toast.success(requireApproval ? 'PDF generated — pending approval' : 'PDF generated');
            const url = resolveUrl(data.data?.pdfUrl);
            if (url) window.open(url, '_blank');
            await Promise.all([loadHistory(), loadModulesAndDash()]);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Generation failed');
        } finally {
            setGenerating(false);
        }
    };

    const runBulk = async () => {
        if (!bulkIds.length) {
            toast.info('Select employees for bulk generation');
            return;
        }
        try {
            setBulkRunning(true);
            const { data } = await axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/statutory/bulk-generate`, {
                docType: moduleKey,
                employeeIds: bulkIds,
                requireApproval,
            });
            setBulkResult(data.data);
            toast.success(`Bulk: ${data.data?.succeeded ?? 0}/${data.data?.total ?? 0} succeeded`);
            await Promise.all([loadHistory(), loadModulesAndDash()]);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Bulk generation failed');
        } finally {
            setBulkRunning(false);
        }
    };

    const printPreview = () => {
        if (!preview?.html) {
            toast.info('Load a preview first');
            return;
        }
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(`<html><head><title>${selectedModule?.label || 'Statutory'}</title></head><body>${preview.html}</body></html>`);
        w.document.close();
        w.print();
    };

    const data = preview?.data || {};
    const monthly = data.monthly || preview?.monthly || [];
    const quarters = data.quarters || preview?.quarters || [];
    const validations = data.validations || preview?.validations;

    const monthlyCols = [
        { key: 'label', label: 'Month', exportValue: (r) => r.label || `${r.month}/${r.year}` },
        { key: 'gross', label: 'Gross', render: (r) => inr(r.gross), exportValue: (r) => r.gross },
        { key: 'incomeTax', label: 'TDS', render: (r) => inr(r.incomeTax), exportValue: (r) => r.incomeTax },
        { key: 'pfEmployee', label: 'PF Emp', render: (r) => inr(r.pfEmployee), exportValue: (r) => r.pfEmployee },
        { key: 'esiEmployee', label: 'ESI Emp', render: (r) => inr(r.esiEmployee), exportValue: (r) => r.esiEmployee },
        { key: 'professionalTax', label: 'PT', render: (r) => inr(r.professionalTax), exportValue: (r) => r.professionalTax },
        { key: 'status', label: 'Status' },
    ];

    if (loadingDash && !orgDash) {
        return <LoadingSpinner message="Loading India Statutory Compliance Center..." />;
    }

    const totals = orgDash?.totals || {};

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h3 className="flex items-center gap-2 text-base font-bold text-gray-900">
                        <FaBalanceScale className="text-theme-primary" />
                        India Statutory Compliance Center
                    </h3>
                    <p className="text-xs text-gray-500">
                        Enterprise modules for Form 16, TDS, EPF, ESI, gratuity, PT, LWF, S&amp;E, declarations &amp; reports — powered by payroll, tax engine, and Document Hub.
                        {orgDash?.financialYear?.label ? ` · ${orgDash.financialYear.label}` : ''}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={loadModulesAndDash}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                    <FaSync /> Refresh
                </button>
            </div>

            {/* Org widgets */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {[
                    { label: 'Active employees', value: totals.activeEmployees ?? 0 },
                    { label: 'Statutory PDFs', value: totals.statutoryDocuments ?? 0 },
                    { label: 'Pending approval', value: totals.pendingApproval ?? 0, warn: true },
                    { label: 'Missing PAN', value: totals.missingPan ?? 0, warn: true },
                    { label: 'Missing UAN', value: totals.missingUan ?? 0, warn: true },
                    { label: 'Invalid PAN/UAN', value: (totals.invalidPan || 0) + (totals.invalidUan || 0), warn: true },
                ].map((c) => (
                    <div key={c.label} className={`rounded-xl border p-3 text-center ${c.warn && c.value ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}>
                        <p className="text-xl font-bold text-gray-900">{c.value}</p>
                        <p className="text-[11px] text-gray-500">{c.label}</p>
                    </div>
                ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-12">
                {/* Module nav */}
                <aside className="lg:col-span-3">
                    <div className="rounded-xl border border-gray-100 bg-white p-2 shadow-sm">
                        <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Modules</p>
                        <nav className="max-h-[520px] space-y-0.5 overflow-y-auto">
                            {modules.map((m) => (
                                <button
                                    key={m.key}
                                    type="button"
                                    onClick={() => setModuleKey(m.key)}
                                    className={`w-full rounded-lg px-3 py-2.5 text-left transition ${
                                        moduleKey === m.key
                                            ? 'bg-theme-primary text-white'
                                            : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    <p className="text-sm font-semibold">{m.label}</p>
                                    <p className={`text-[11px] ${moduleKey === m.key ? 'text-white/80' : 'text-gray-500'}`}>
                                        {m.category} · {m.description}
                                    </p>
                                </button>
                            ))}
                        </nav>
                    </div>
                </aside>

                {/* Workspace */}
                <div className="space-y-4 lg:col-span-9">
                    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                            <div className="min-w-0 flex-1">
                                <h4 className="text-lg font-bold text-gray-900">{selectedModule?.label}</h4>
                                <p className="text-xs text-gray-500">{selectedModule?.description}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => setActiveTab('overview')} className={`rounded-full px-3 py-1 text-xs font-medium ${activeTab === 'overview' ? 'bg-theme-primary text-white' : 'border border-gray-200'}`}>Overview</button>
                                <button type="button" onClick={() => setActiveTab('history')} className={`rounded-full px-3 py-1 text-xs font-medium ${activeTab === 'history' ? 'bg-theme-primary text-white' : 'border border-gray-200'}`}>History</button>
                                <button type="button" onClick={() => setActiveTab('bulk')} className={`rounded-full px-3 py-1 text-xs font-medium ${activeTab === 'bulk' ? 'bg-theme-primary text-white' : 'border border-gray-200'}`}>Bulk</button>
                            </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <label className="text-xs font-medium text-gray-600 sm:col-span-2">
                                Search employees
                                <div className="relative mt-1">
                                    <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                                    <input
                                        value={searchEmp}
                                        onChange={(e) => setSearchEmp(e.target.value)}
                                        placeholder="Name, email, code…"
                                        className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-sm"
                                    />
                                </div>
                            </label>
                            <label className="text-xs font-medium text-gray-600">
                                Department
                                <select value={department} onChange={(e) => setDepartment(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                                    <option value="">All</option>
                                    {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </label>
                            <label className="text-xs font-medium text-gray-600">
                                Employee {needsEmployee ? '*' : '(optional)'}
                                <select
                                    value={employeeId}
                                    onChange={(e) => setEmployeeId(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                                >
                                    <option value="">Select employee</option>
                                    {filteredEmployees.map((e) => (
                                        <option key={e._id} value={e._id}>{e.name} {e.lastName}{e.department ? ` · ${e.department}` : ''}</option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-3">
                            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                                <input type="checkbox" checked={requireApproval} onChange={(e) => setRequireApproval(e.target.checked)} />
                                Require Document Hub approval
                            </label>
                            <button type="button" onClick={loadPreview} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50">
                                Reload preview
                            </button>
                            <button type="button" onClick={printPreview} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50">
                                <FaPrint /> Print
                            </button>
                            <button
                                type="button"
                                disabled={generating || (needsEmployee && !employeeId)}
                                onClick={generatePdf}
                                className="inline-flex items-center gap-1 rounded-lg bg-theme-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                                <FaFilePdf /> {generating ? 'Generating…' : 'Generate PDF'}
                            </button>
                            <button
                                type="button"
                                onClick={() => { window.location.href = '/documents'; }}
                                className="text-xs text-theme-primary underline"
                            >
                                Open Document Hub
                            </button>
                        </div>
                    </div>

                    {activeTab === 'overview' && (
                        <div className="space-y-4">
                            {loadingPreview ? (
                                <LoadingSpinner message="Loading module preview..." />
                            ) : needsEmployee && !employeeId ? (
                                <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
                                    <FaUsers className="mx-auto mb-2 text-2xl text-gray-300" />
                                    Select an employee to open the {selectedModule?.label} workspace.
                                </div>
                            ) : !preview ? (
                                <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
                                    No preview data. Check Configure feature flags or payroll data.
                                </div>
                            ) : (
                                <>
                                    <SectionCard title="Validations & readiness">
                                        <ValidationBadges validations={validations} />
                                    </SectionCard>

                                    {moduleKey === 'form16' && (
                                        <>
                                            <SectionCard title="Employee & employer">
                                                <KvGrid items={[
                                                    { label: 'Employee', value: data.employee?.name },
                                                    { label: 'PAN', value: data.employee?.pan || '—' },
                                                    { label: 'Aadhaar', value: data.employee?.aadhaarMasked || data.employee?.aadhaar || '—' },
                                                    { label: 'UAN', value: data.employee?.uan || '—' },
                                                    { label: 'Employer TAN', value: data.tan || preview.tan },
                                                    { label: 'Financial Year', value: data.financialYear || preview.financialYear },
                                                    { label: 'Period', value: data.period ? `${data.period.from} → ${data.period.to}` : '—' },
                                                    { label: 'Tax regime', value: data.tax?.regime },
                                                ]} />
                                            </SectionCard>
                                            <SectionCard title="Salary breakup">
                                                <KvGrid items={[
                                                    { label: 'Basic', value: inr(data.salaryBreakup?.basic) },
                                                    { label: 'HRA', value: inr(data.salaryBreakup?.hra) },
                                                    { label: 'LTA', value: inr(data.salaryBreakup?.lta) },
                                                    { label: 'Special allowance', value: inr(data.salaryBreakup?.special) },
                                                    { label: 'Bonus', value: inr(data.salaryBreakup?.bonus) },
                                                    { label: 'Gross', value: inr(data.salaryBreakup?.gross) },
                                                ]} />
                                            </SectionCard>
                                            <SectionCard title="Tax calculation & TDS">
                                                <KvGrid items={[
                                                    { label: 'Computed annual tax', value: inr(data.tax?.computedAnnualTax) },
                                                    { label: 'TDS deducted (payroll)', value: inr(data.tax?.tdsDeducted) },
                                                    { label: 'Difference', value: inr(data.tax?.difference) },
                                                ]} />
                                            </SectionCard>
                                        </>
                                    )}

                                    {moduleKey === 'form12ba' && (
                                        <SectionCard title="Perquisites">
                                            <DataTable
                                                columns={[
                                                    { key: 'name', label: 'Perquisite', render: (r) => r.name || r[0] },
                                                    { key: 'value', label: 'Taxable value', render: (r) => inr(r.value ?? r[1]) },
                                                ]}
                                                rows={data.perquisites || preview.perquisites || []}
                                            />
                                            <p className="mt-2 text-sm font-semibold">Total: {inr(data.totalPerquisites)}</p>
                                        </SectionCard>
                                    )}

                                    {moduleKey === 'tds_summary' && (
                                        <>
                                            <SectionCard title="TDS dashboard">
                                                <KvGrid items={[
                                                    { label: 'Gross income', value: inr(data.summary?.grossIncome || preview.summary?.grossIncome) },
                                                    { label: 'TDS deducted', value: inr(data.summary?.tdsDeducted || preview.summary?.tdsDeducted) },
                                                    { label: 'Professional tax', value: inr(data.summary?.professionalTax || preview.summary?.professionalTax) },
                                                    { label: 'Net taxable (est.)', value: inr(data.summary?.netTaxableEstimate || preview.summary?.netTaxableEstimate) },
                                                ]} />
                                            </SectionCard>
                                            <SectionCard title="Quarterly TDS">
                                                <DataTable
                                                    columns={[
                                                        { key: 'label', label: 'Quarter' },
                                                        { key: 'tds', label: 'TDS', render: (r) => inr(r.tds) },
                                                        { key: 'gross', label: 'Gross', render: (r) => inr(r.gross) },
                                                        { key: 'count', label: 'Months' },
                                                    ]}
                                                    rows={quarters}
                                                />
                                            </SectionCard>
                                        </>
                                    )}

                                    {moduleKey === 'epf_statement' && (
                                        <SectionCard title="EPF account">
                                            <KvGrid items={[
                                                { label: 'UAN', value: data.uan || preview.uan || data.employee?.uan },
                                                { label: 'Employee contribution', value: inr(data.employeeContribution ?? preview.totals?.pfEmployee) },
                                                { label: 'Employer contribution', value: inr(data.employerContribution ?? preview.totals?.pfEmployer) },
                                                { label: 'Closing (est.)', value: inr(data.closingBalance) },
                                            ]} />
                                        </SectionCard>
                                    )}

                                    {moduleKey === 'esi_statement' && (
                                        <SectionCard title="ESI contributions">
                                            <KvGrid items={[
                                                { label: 'ESI number', value: data.esiNumber || preview.esiNumber || data.employee?.esi },
                                                { label: 'Employee', value: inr(data.employeeContribution) },
                                                { label: 'Employer', value: inr(data.employerContribution) },
                                            ]} />
                                        </SectionCard>
                                    )}

                                    {moduleKey === 'gratuity_statement' && (
                                        <SectionCard title="Gratuity calculation">
                                            <KvGrid items={[
                                                { label: 'Eligible', value: data.gratuity?.eligible || preview.gratuity?.eligible ? 'Yes' : 'No' },
                                                { label: 'Years of service', value: data.gratuity?.yearsOfService ?? preview.gratuity?.yearsOfService },
                                                { label: 'Last drawn wage', value: inr(data.gratuity?.wage ?? preview.gratuity?.wage) },
                                                { label: 'Amount', value: inr(data.gratuity?.amount ?? preview.gratuity?.amount) },
                                                { label: 'Formula', value: data.gratuity?.formula || preview.gratuity?.formula || preview.gratuity?.reason },
                                            ]} />
                                        </SectionCard>
                                    )}

                                    {moduleKey === 'professional_tax' && (
                                        <SectionCard title="Professional tax">
                                            <KvGrid items={[
                                                { label: 'State', value: data.state || preview.state },
                                                { label: 'Annual PT', value: inr(data.annualTotal ?? data.summary?.professionalTax) },
                                                { label: 'Payment status', value: data.paymentStatus || 'Via payroll' },
                                            ]} />
                                        </SectionCard>
                                    )}

                                    {moduleKey === 'lwf_summary' && (
                                        <SectionCard title="Labour Welfare Fund">
                                            <KvGrid items={[
                                                { label: 'State', value: data.state || preview.state },
                                                { label: 'Employee contribution', value: inr(data.employeeContribution) },
                                                { label: 'Employer contribution', value: inr(data.employerContribution) },
                                                { label: 'Frequency', value: data.contributionFrequency || 'State schedule' },
                                            ]} />
                                        </SectionCard>
                                    )}

                                    {moduleKey === 'shops_establishment' && (
                                        <SectionCard title="Registration & compliance">
                                            <KvGrid items={[
                                                { label: 'Registration no.', value: data.registrationNumber || preview.registrationNumber },
                                                { label: 'Status', value: data.complianceStatus || preview.complianceStatus },
                                                { label: 'Headcount', value: data.headcount ?? preview.headcount },
                                                { label: 'Renewal alert', value: (data.expiryAlert || preview.expiryAlert) ? 'Yes' : 'No' },
                                            ]} />
                                            <p className="mt-2 text-xs text-gray-500">
                                                Upload renewed certificates in Document Hub (Compliance). Renewal workflow uses existing approval engine.
                                            </p>
                                        </SectionCard>
                                    )}

                                    {moduleKey === 'investment_declaration' && (
                                        <SectionCard
                                            title="Investment declaration (from Employee Profile tax declaration)"
                                            actions={(
                                                <a href="/profile" className="text-xs text-theme-primary underline">Open profile tax form</a>
                                            )}
                                        >
                                            <KvGrid items={[
                                                { label: 'FY', value: data.financialYear || data.declaration?.financialYear },
                                                { label: 'Status', value: data.approvalStatus || '—' },
                                                { label: '80C EPF', value: inr(data.sections?.section80C?.epf || data.declaration?.section80C?.epf) },
                                                { label: '80C PPF', value: inr(data.sections?.section80C?.ppf || data.declaration?.section80C?.ppf) },
                                                { label: '80C LIC', value: inr(data.sections?.section80C?.lic || data.declaration?.section80C?.lic) },
                                                { label: '80D self/family', value: inr(data.sections?.section80D?.selfFamilyPremium || data.declaration?.section80D?.selfFamilyPremium) },
                                                { label: 'Home loan interest', value: inr(data.sections?.homeLoan?.homeLoanInterest || data.declaration?.section24b?.homeLoanInterest) },
                                                { label: 'HRA monthly rent', value: inr(data.sections?.hra?.monthlyRent || data.declaration?.hra?.monthlyRent) },
                                            ]} />
                                            <p className="mt-2 text-xs text-gray-500">
                                                Edits reuse the existing Tax Declaration form on Employee Profile. Proofs upload via Document Hub.
                                            </p>
                                        </SectionCard>
                                    )}

                                    {moduleKey === 'compliance_report' && (
                                        <SectionCard title="Compliance dashboard">
                                            <KvGrid items={[
                                                { label: 'Missing PAN', value: data.dashboard?.counts?.missingPan ?? totals.missingPan },
                                                { label: 'Missing UAN', value: data.dashboard?.counts?.missingUan ?? totals.missingUan },
                                                { label: 'Missing declarations', value: data.dashboard?.counts?.missingDecl },
                                                { label: 'S&E status', value: data.shops?.complianceStatus || data.dashboard?.epfStatus },
                                            ]} />
                                            {(data.dashboard?.departmentWise || []).length > 0 && (
                                                <div className="mt-3">
                                                    <p className="mb-2 text-xs font-semibold text-gray-500">Department-wise</p>
                                                    <DataTable
                                                        columns={[
                                                            { key: 'department', label: 'Department' },
                                                            { key: 'total', label: 'Headcount' },
                                                            { key: 'panMissing', label: 'PAN missing' },
                                                            { key: 'uanMissing', label: 'UAN missing' },
                                                            { key: 'declarationMissing', label: 'Decl. missing' },
                                                        ]}
                                                        rows={data.dashboard.departmentWise}
                                                    />
                                                </div>
                                            )}
                                        </SectionCard>
                                    )}

                                    {monthly.length > 0 && (
                                        <SectionCard
                                            title="Monthly history (payroll)"
                                            actions={(
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center gap-1 text-xs text-theme-primary"
                                                    onClick={() => exportCsv(`${moduleKey}-monthly.csv`, monthly, monthlyCols)}
                                                >
                                                    <FaFileCsv /> Export CSV
                                                </button>
                                            )}
                                        >
                                            <DataTable columns={monthlyCols} rows={monthly} />
                                        </SectionCard>
                                    )}

                                    <SectionCard title="Document preview (HTML → PDF)">
                                        <div
                                            className="prose prose-sm max-w-none rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm"
                                            // Statutory HTML is server-generated from payroll numbers (no user HTML).
                                            dangerouslySetInnerHTML={{ __html: preview.html || '<p>No HTML preview</p>' }}
                                        />
                                    </SectionCard>
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <SectionCard title="Download / version history" actions={<FaHistory className="text-gray-400" />}>
                            {!history.length ? (
                                <p className="text-sm text-gray-500">No generated documents for this module yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {history.map((d) => (
                                        <a
                                            key={d._id}
                                            href={resolveUrl(d.fileUrl)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm hover:bg-gray-50"
                                        >
                                            <div>
                                                <p className="font-medium text-theme-primary">{d.name || d.fileName}</p>
                                                <p className="text-[11px] text-gray-500">
                                                    v{d.version || d.versionCount || 1} · {d.approvalStatus || '—'} · {d.createdAt ? new Date(d.createdAt).toLocaleString() : ''}
                                                </p>
                                            </div>
                                            <FaDownload className="text-gray-400" />
                                        </a>
                                    ))}
                                </div>
                            )}
                            <p className="mt-3 text-xs text-gray-500">
                                Approvals &amp; e-sign continue in Document Hub. Audit entries are written on each generate.
                            </p>
                        </SectionCard>
                    )}

                    {activeTab === 'bulk' && (
                        <SectionCard title={`Bulk generate — ${selectedModule?.label}`}>
                            {moduleKey === 'shops_establishment' ? (
                                <p className="text-sm text-gray-500">Shops &amp; Establishment is organization-level. Use Generate PDF on Overview.</p>
                            ) : (
                                <>
                                    <p className="mb-2 text-xs text-gray-500">
                                        Select employees (filtered list). Uses the same payroll/tax engines — no duplicate module.
                                    </p>
                                    <div className="mb-3 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-gray-100 p-2">
                                        {filteredEmployees.map((e) => {
                                            const checked = bulkIds.includes(e._id);
                                            return (
                                                <label key={e._id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={(ev) => {
                                                            setBulkIds((prev) => (ev.target.checked
                                                                ? [...prev, e._id]
                                                                : prev.filter((id) => id !== e._id)));
                                                        }}
                                                    />
                                                    {e.name} {e.lastName}
                                                    <span className="text-xs text-gray-400">{e.department}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            className="rounded-lg border px-3 py-1.5 text-xs"
                                            onClick={() => setBulkIds(filteredEmployees.map((e) => e._id))}
                                        >
                                            Select filtered
                                        </button>
                                        <button type="button" className="rounded-lg border px-3 py-1.5 text-xs" onClick={() => setBulkIds([])}>
                                            Clear
                                        </button>
                                        <button
                                            type="button"
                                            disabled={bulkRunning || !bulkIds.length}
                                            onClick={runBulk}
                                            className="rounded-lg bg-theme-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                                        >
                                            {bulkRunning ? 'Running…' : `Generate for ${bulkIds.length}`}
                                        </button>
                                    </div>
                                    {bulkResult && (
                                        <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs">
                                            Succeeded {bulkResult.succeeded}/{bulkResult.total}
                                            {bulkResult.failed ? ` · Failed ${bulkResult.failed}` : ''}
                                        </div>
                                    )}
                                </>
                            )}
                        </SectionCard>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StatutoryCompliancePanel;
