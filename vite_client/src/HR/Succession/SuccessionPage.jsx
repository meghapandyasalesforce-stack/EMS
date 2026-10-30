import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
    FaDownload,
    FaPlus,
    FaSearch,
    FaSpinner,
    FaTrash,
    FaUserTie,
    FaUsers
} from 'react-icons/fa';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { useEmployees } from '../../Hooks/useDashboardData';
import { format } from 'date-fns';

const TEAL = '#0a8f6c';
const READINESS = ['Ready Now', 'Ready in 1-2 Years', 'Ready in 3-5 Years', 'Long-term Potential'];

const personName = (person) => {
    if (!person) return '';
    if (typeof person === 'string') return person;
    return [person.name, person.lastName].filter(Boolean).join(' ').trim() || person.email || '';
};

const initials = (person) => {
    const name = personName(person);
    const parts = name.split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const benchLabel = (plan) => {
    const successors = plan.successors || [];
    if (!successors.length) return 'Vulnerable';
    if (successors.some((item) => item.readinessLevel === 'Ready Now')) return 'Strong';
    return 'Moderate';
};

const benchClass = (label) => {
    if (label === 'Strong') return 'text-emerald-700';
    if (label === 'Moderate') return 'text-amber-700';
    return 'text-rose-700';
};

const riskClass = (risk) => {
    if (risk === 'Critical') return 'bg-rose-50 text-rose-700';
    if (risk === 'High') return 'bg-orange-50 text-orange-700';
    if (risk === 'Medium') return 'bg-amber-50 text-amber-700';
    return 'bg-emerald-50 text-emerald-700';
};

const statusClass = (status) => {
    if (status === 'Active') return 'bg-emerald-50 text-emerald-700';
    if (status === 'On Hold') return 'bg-amber-50 text-amber-700';
    if (status === 'Archived') return 'bg-slate-100 text-slate-500';
    return 'bg-slate-100 text-slate-600';
};

const readinessClass = (level) => {
    if (level === 'Ready Now') return 'bg-emerald-50 text-emerald-700';
    if (level === 'Ready in 1-2 Years') return 'bg-sky-50 text-sky-700';
    if (level === 'Ready in 3-5 Years') return 'bg-amber-50 text-amber-700';
    return 'bg-slate-100 text-slate-600';
};

const percent = (part, total) => {
    if (!total) return '0%';
    const value = (part / total) * 100;
    return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
};

const performanceBand = (rating) => {
    const value = Number(rating);
    if (!rating || Number.isNaN(value) || value <= 0) return null;
    if (value < 2.5) return 'Low';
    if (value < 4) return 'Medium';
    return 'High';
};

const potentialBand = (level) => {
    if (level === 'High Potential') return 'High';
    if (level === 'Medium Potential') return 'Medium';
    if (level === 'Emerging Talent') return 'Low';
    return null;
};

const csvEscape = (value) => `"${String(value ?? '').split('"').join('""')}"`;

const downloadCsv = (filename, header, rows) => {
    const csv = [header, ...rows].map((cols) => cols.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};

const roleListFrom = (payload) => {
    const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    return list.filter((role) => role && role.isActive !== false);
};

const matchRole = (roles, employee) => {
    const title = String(employee?.jobTitle || employee?.position || '').trim().toLowerCase();
    if (!title) return null;
    return roles.find((role) => String(role.name || '').trim().toLowerCase() === title) || null;
};

const SuiteModal = ({ title, onClose, children, wide = false }) => {
    const closeRef = useRef(onClose);
    useEffect(() => {
        closeRef.current = onClose;
    }, [onClose]);
    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (event) => {
            if (event.key === 'Escape') closeRef.current();
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = previous;
            document.removeEventListener('keydown', onKey);
        };
    }, []);
    return createPortal(
        <div className="fixed inset-0 z-[12000] flex items-center justify-center p-4" style={{ background: 'rgba(14,43,61,0.7)' }}>
            <section
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-xl ${wide ? 'max-w-3xl' : 'max-w-2xl'}`}
                style={{ backgroundColor: '#ffffff' }}
            >
                <div className="mb-4 flex items-start justify-between gap-3">
                    <h3 className="text-xl font-semibold text-[#0E2B3D]">{title}</h3>
                    <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100">
                        ×
                    </button>
                </div>
                {children}
            </section>
        </div>,
        document.body
    );
};

const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none focus:border-[#0a8f6c]';

const KpiCard = ({ label, value, hint, accent }) => (
    <div className="rounded-2xl border border-slate-200 p-5 shadow-sm" style={{ backgroundColor: '#ffffff' }}>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="mt-3 text-3xl font-bold tracking-tight text-[#0E2B3D]">{value}</p>
        <p className="mt-2 text-xs font-medium" style={{ color: accent }}>{hint}</p>
    </div>
);

const SuccessionPage = () => {
    const navigate = useNavigate();
    const [successionPlans, setSuccessionPlans] = useState([]);
    const [talentPool, setTalentPool] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('plans');
    const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
    const [showAddTalentModal, setShowAddTalentModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [riskFilter, setRiskFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [readinessFilter, setReadinessFilter] = useState('all');
    const [potentialFilter, setPotentialFilter] = useState('all');
    const { data: employeeData = { employees: [], total: 0 } } = useEmployees();
    const employees = employeeData?.employees ?? [];

    const [planFormData, setPlanFormData] = useState({
        positionName: '',
        department: '',
        positionId: '',
        currentIncumbent: '',
        riskLevel: 'Medium',
        criticality: 'Medium',
        status: 'Draft',
        successors: [],
        developmentActivities: []
    });

    const [talentFormData, setTalentFormData] = useState({
        employeeId: '',
        potentialLevel: 'Medium Potential',
        currentRole: '',
        strengths: [],
        developmentAreas: [],
        careerAspirations: '',
        performanceRating: 0
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [plansRes, talentRes, rolesRes] = await Promise.allSettled([
                axios.get('/v1/admin/succession/succession-plans', { withCredentials: true }),
                axios.get('/v1/admin/succession/talent-pool', { withCredentials: true }),
                axios.get('/v1/admin/roles', { withCredentials: true })
            ]);
            if (plansRes.status === 'fulfilled') setSuccessionPlans(plansRes.value.data?.data || []);
            else {
                setSuccessionPlans([]);
                toast.error('Failed to load succession plans');
            }
            if (talentRes.status === 'fulfilled') setTalentPool(talentRes.value.data?.data || []);
            else {
                setTalentPool([]);
                toast.error('Failed to load talent pool');
            }
            if (rolesRes.status === 'fulfilled') setRoles(roleListFrom(rolesRes.value.data));
            else setRoles([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreatePlan = async (event) => {
        event.preventDefault();
        if (!planFormData.positionName || !planFormData.department || !planFormData.positionId) {
            toast.error('Position name, department, and role are required');
            return;
        }
        const payload = { ...planFormData };
        if (!payload.currentIncumbent) delete payload.currentIncumbent;
        try {
            setSubmitting(true);
            await axios.post('/v1/admin/succession/succession-plans', payload, { withCredentials: true });
            toast.success('Succession plan created successfully');
            setShowCreatePlanModal(false);
            resetPlanForm();
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create succession plan');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddTalent = async (event) => {
        event.preventDefault();
        if (!talentFormData.employeeId) {
            toast.error('Please select an employee');
            return;
        }
        const payload = { ...talentFormData };
        if (!payload.currentRole) delete payload.currentRole;
        try {
            setSubmitting(true);
            await axios.post('/v1/admin/succession/talent-pool', payload, { withCredentials: true });
            toast.success('Added to talent pool successfully');
            setShowAddTalentModal(false);
            resetTalentForm();
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add to talent pool');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeletePlan = async (planId) => {
        if (!window.confirm('Are you sure you want to delete this succession plan?')) return;
        try {
            await axios.delete(`/v1/admin/succession/succession-plans/${planId}`, { withCredentials: true });
            toast.success('Succession plan deleted successfully');
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete succession plan');
        }
    };

    const handleDeleteTalent = async (talentId) => {
        if (!window.confirm('Are you sure you want to remove this employee from talent pool?')) return;
        try {
            await axios.delete(`/v1/admin/succession/talent-pool/${talentId}`, { withCredentials: true });
            toast.success('Removed from talent pool successfully');
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to remove from talent pool');
        }
    };

    const resetPlanForm = () => {
        setPlanFormData({
            positionName: '',
            department: '',
            positionId: '',
            currentIncumbent: '',
            riskLevel: 'Medium',
            criticality: 'Medium',
            status: 'Draft',
            successors: [],
            developmentActivities: []
        });
    };

    const resetTalentForm = () => {
        setTalentFormData({
            employeeId: '',
            potentialLevel: 'Medium Potential',
            currentRole: '',
            strengths: [],
            developmentAreas: [],
            careerAspirations: '',
            performanceRating: 0
        });
    };

    const departments = useMemo(() => {
        const names = successionPlans.map((plan) => String(plan.department || '').trim()).filter(Boolean);
        return [...new Set(names)].sort((a, b) => a.localeCompare(b));
    }, [successionPlans]);

    const filteredPlans = successionPlans.filter((plan) => {
        const term = searchTerm.trim().toLowerCase();
        const incumbent = personName(plan.currentIncumbent).toLowerCase();
        const matchesSearch = term === ''
            || plan.positionName?.toLowerCase().includes(term)
            || plan.department?.toLowerCase().includes(term)
            || incumbent.includes(term);
        const matchesRisk = riskFilter === 'all' || plan.riskLevel === riskFilter;
        const matchesStatus = statusFilter === 'all' || plan.status === statusFilter;
        const matchesDepartment = departmentFilter === 'all' || plan.department === departmentFilter;
        const matchesReadiness = readinessFilter === 'all'
            || (plan.successors || []).some((item) => item.readinessLevel === readinessFilter);
        return matchesSearch && matchesRisk && matchesStatus && matchesDepartment && matchesReadiness;
    });

    const filteredTalent = talentPool.filter((talent) => {
        const term = searchTerm.trim().toLowerCase();
        const matchesSearch = term === ''
            || personName(talent.employeeId).toLowerCase().includes(term)
            || talent.employeeId?.email?.toLowerCase().includes(term);
        const matchesPotential = potentialFilter === 'all' || talent.potentialLevel === potentialFilter;
        return matchesSearch && matchesPotential;
    });

    const stats = useMemo(() => {
        const total = successionPlans.length;
        const critical = successionPlans.filter((plan) => plan.criticality === 'High' || plan.criticality === 'Critical').length;
        const covered = successionPlans.filter((plan) => (plan.successors || []).length > 0).length;
        const atRisk = successionPlans.filter((plan) => plan.riskLevel === 'High' || plan.riskLevel === 'Critical').length;
        const ready = new Set();
        successionPlans.forEach((plan) => {
            (plan.successors || []).forEach((item) => {
                if (item.readinessLevel !== 'Ready Now') return;
                const id = item.employeeId?._id || item.employeeId;
                if (id) ready.add(String(id));
            });
        });
        return { total, critical, covered, atRisk, ready: ready.size };
    }, [successionPlans]);

    const showPlans = () => {
        setActiveTab('plans');
        setSearchTerm('');
        setRiskFilter('all');
        setStatusFilter('all');
        setDepartmentFilter('all');
        setReadinessFilter('all');
    };

    const showTalent = () => {
        setActiveTab('talent');
        setSearchTerm('');
        setPotentialFilter('all');
    };

    const exportCurrent = () => {
        if (activeTab === 'plans') {
            downloadCsv(
                'succession-plans.csv',
                ['Position', 'Department', 'Incumbent', 'Risk', 'Criticality', 'Status', 'Successors', 'Bench', 'Updated'],
                filteredPlans.map((plan) => [
                    plan.positionName,
                    plan.department,
                    personName(plan.currentIncumbent),
                    plan.riskLevel,
                    plan.criticality,
                    plan.status,
                    plan.successors?.length || 0,
                    benchLabel(plan),
                    plan.updatedAt ? format(new Date(plan.updatedAt), 'yyyy-MM-dd') : ''
                ])
            );
            return;
        }
        downloadCsv(
            'talent-pool.csv',
            ['Employee', 'Email', 'Potential', 'Role', 'Performance'],
            filteredTalent.map((talent) => [
                personName(talent.employeeId),
                talent.employeeId?.email || '',
                talent.potentialLevel,
                talent.currentRole?.name || talent.employeeId?.position || '',
                talent.performanceRating || ''
            ])
        );
    };

    const bands = { High: [], Medium: [], Low: [] };
    const unplaced = [];
    filteredTalent.forEach((talent) => {
        const performance = performanceBand(talent.performanceRating);
        const potential = potentialBand(talent.potentialLevel);
        if (!performance || !potential) {
            unplaced.push(talent);
            return;
        }
        bands[potential].push({ ...talent, performance });
    });

    return (
        <div className="page-shell min-h-screen bg-transparent">
            <div className="page-shell-inner hrms-stack">
                <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-[#0E2B3D] lg:text-3xl">Succession Planning &amp; Leadership Pipeline</h1>
                        <p className="mt-1 max-w-3xl text-sm text-slate-500">
                            Identify critical role vulnerabilities, evaluate leadership bench strength, and mitigate talent continuity risks across mission-critical executive roles.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={exportCurrent}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                        >
                            <FaDownload className="h-3.5 w-3.5" />
                            Export
                        </button>
                        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
                            <button
                                type="button"
                                onClick={showPlans}
                                className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === 'plans' ? 'text-white' : 'text-slate-600'}`}
                                style={activeTab === 'plans' ? { backgroundColor: TEAL } : undefined}
                            >
                                Role Cards
                            </button>
                            <button
                                type="button"
                                onClick={showTalent}
                                className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === 'talent' ? 'text-white' : 'text-slate-600'}`}
                                style={activeTab === 'talent' ? { backgroundColor: TEAL } : undefined}
                            >
                                9-Box Matrix
                            </button>
                        </div>
                        {activeTab === 'plans' ? (
                            <button
                                type="button"
                                onClick={() => {
                                    resetPlanForm();
                                    setShowCreatePlanModal(true);
                                }}
                                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                                style={{ backgroundColor: TEAL }}
                            >
                                <FaPlus className="h-3.5 w-3.5" />
                                Create Plan
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    resetTalentForm();
                                    setShowAddTalentModal(true);
                                }}
                                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                                style={{ backgroundColor: TEAL }}
                            >
                                <FaPlus className="h-3.5 w-3.5" />
                                Add Talent
                            </button>
                        )}
                    </div>
                </header>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <KpiCard label="Critical roles identified" value={stats.critical} hint="High or critical criticality" accent="#d97706" />
                    <KpiCard label="Bench strength ratio" value={percent(stats.covered, stats.total)} hint="Plans with at least one successor" accent={TEAL} />
                    <KpiCard label="Ready now candidates" value={stats.ready} hint="Unique successors marked ready now" accent={TEAL} />
                    <KpiCard label="Talent at risk rate" value={percent(stats.atRisk, stats.total)} hint="High or critical risk plans" accent="#e11d48" />
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 shadow-sm lg:flex-row lg:items-center" style={{ backgroundColor: '#ffffff' }}>
                    <div className="relative min-w-0 flex-1">
                        <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder={activeTab === 'plans' ? 'Search role title, incumbent, or department...' : 'Search by employee name or email...'}
                            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm"
                        />
                    </div>
                    {activeTab === 'plans' ? (
                        <>
                            <select aria-label="Filter department" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600">
                                <option value="all">Dept: All Departments</option>
                                {departments.map((name) => <option key={name} value={name}>{name}</option>)}
                            </select>
                            <select aria-label="Filter risk" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600">
                                <option value="all">Risk: All Risks</option>
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                                <option value="Critical">Critical</option>
                            </select>
                            <select aria-label="Filter readiness" value={readinessFilter} onChange={(event) => setReadinessFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600">
                                <option value="all">Readiness: All Levels</option>
                                {READINESS.map((level) => <option key={level} value={level}>{level}</option>)}
                            </select>
                            <select aria-label="Filter status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600">
                                <option value="all">Status: All</option>
                                <option value="Draft">Draft</option>
                                <option value="Active">Active</option>
                                <option value="On Hold">On Hold</option>
                                <option value="Archived">Archived</option>
                            </select>
                        </>
                    ) : (
                        <select aria-label="Filter potential" value={potentialFilter} onChange={(event) => setPotentialFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600">
                            <option value="all">All Potential</option>
                            <option value="High Potential">High Potential</option>
                            <option value="Medium Potential">Medium Potential</option>
                            <option value="Emerging Talent">Emerging Talent</option>
                        </select>
                    )}
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {[0, 1, 2, 3].map((row) => <div key={row} className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}
                    </div>
                ) : activeTab === 'plans' ? (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {filteredPlans.map((plan) => {
                            const coverage = benchLabel(plan);
                            const successors = plan.successors || [];
                            const shown = successors.slice(0, 3);
                            return (
                                <article key={plan._id} className="rounded-2xl border border-slate-200 p-5 shadow-sm" style={{ backgroundColor: '#ffffff' }}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex flex-wrap gap-2">
                                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${riskClass(plan.riskLevel)}`}>Risk: {plan.riskLevel}</span>
                                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${riskClass(plan.criticality)}`}>Impact: {plan.criticality}</span>
                                            {plan.department && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{plan.department}</span>}
                                        </div>
                                        <button type="button" onClick={() => handleDeletePlan(plan._id)} aria-label="Delete plan" className="rounded-lg p-2 text-rose-500 hover:bg-rose-50">
                                            <FaTrash />
                                        </button>
                                    </div>
                                    <h2 className="mt-3 text-lg font-bold text-[#0E2B3D]">{plan.positionName}</h2>
                                    <p className="mt-1 text-sm text-slate-500">Criticality {plan.criticality} · Risk {plan.riskLevel}</p>
                                    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <span className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#0E2B3D' }}>
                                                {plan.currentIncumbent ? initials(plan.currentIncumbent) : <FaUserTie />}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Current incumbent</p>
                                                <p className="truncate text-sm font-semibold text-slate-800">{personName(plan.currentIncumbent) || 'Not assigned'}</p>
                                            </div>
                                        </div>
                                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(plan.status)}`}>{plan.status}</span>
                                    </div>
                                    <div className="mt-4">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Identified pipeline ({successors.length} successors)</p>
                                            <p className={`text-xs font-semibold ${benchClass(coverage)}`}>Bench coverage: {coverage}</p>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {shown.map((item, index) => (
                                                <span key={item._id || index} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${readinessClass(item.readinessLevel)}`}>
                                                    {personName(item.employeeId) || 'Successor'} · {item.readinessLevel}
                                                </span>
                                            ))}
                                            {successors.length > shown.length && (
                                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">+{successors.length - shown.length} more</span>
                                            )}
                                            {successors.length === 0 && <span className="text-sm text-slate-400">No successors identified</span>}
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                                        <p className="text-xs text-slate-400">
                                            {plan.updatedAt ? `Updated ${format(new Date(plan.updatedAt), 'dd MMM yyyy')}` : 'Not updated yet'}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/succession/${plan._id}`)}
                                            className="rounded-xl border px-3 py-2 text-sm font-semibold"
                                            style={{ borderColor: TEAL, color: TEAL }}
                                        >
                                            View Succession Dossier
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                        {filteredPlans.length === 0 && (
                            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                                <FaUserTie className="mx-auto text-4xl text-slate-300" />
                                <p className="mt-3 text-slate-500">{successionPlans.length === 0 ? 'No succession plans created yet.' : 'No plans match your filters.'}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 p-5 shadow-sm" style={{ backgroundColor: '#ffffff' }}>
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-bold text-[#0E2B3D]">9-Box Matrix</h2>
                                    <p className="text-sm text-slate-500">Placed from potential level and performance rating already saved on each person.</p>
                                </div>
                                <p className="text-xs font-semibold text-slate-400">{unplaced.length} not placed</p>
                            </div>
                            <div className="grid grid-cols-[88px_repeat(3,minmax(0,1fr))] gap-2">
                                <div />
                                {['Low', 'Medium', 'High'].map((label) => (
                                    <p key={label} className="text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">{label} performance</p>
                                ))}
                                {['High', 'Medium', 'Low'].map((potential) => (
                                    <React.Fragment key={potential}>
                                        <p className="flex items-center text-[11px] font-bold uppercase tracking-wider text-slate-400">{potential} potential</p>
                                        {['Low', 'Medium', 'High'].map((performance) => {
                                            const people = bands[potential].filter((item) => item.performance === performance);
                                            return (
                                                <div key={`${potential}-${performance}`} className="min-h-24 rounded-xl bg-slate-50 p-2">
                                                    <div className="flex flex-wrap gap-1">
                                                        {people.map((talent) => (
                                                            <span key={talent._id} className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                                                                {personName(talent.employeeId) || 'Employee'}
                                                            </span>
                                                        ))}
                                                        {people.length === 0 && <span className="text-xs text-slate-300">—</span>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="min-w-[640px] w-full">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            {['Employee', 'Potential', 'Current Role', 'Performance', 'Actions'].map((heading) => (
                                                <th key={heading} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">{heading}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredTalent.map((talent) => (
                                            <tr key={talent._id}>
                                                <td className="px-5 py-4">
                                                    <p className="font-medium text-slate-900">{personName(talent.employeeId) || 'N/A'}</p>
                                                    <p className="text-sm text-slate-500">{talent.employeeId?.email || ''}</p>
                                                </td>
                                                <td className="px-5 py-4 text-sm text-slate-700">{talent.potentialLevel}</td>
                                                <td className="px-5 py-4 text-sm text-slate-600">{talent.currentRole?.name || talent.employeeId?.position || 'N/A'}</td>
                                                <td className="px-5 py-4 text-sm text-slate-700">{talent.performanceRating ? `${talent.performanceRating}/5` : 'N/A'}</td>
                                                <td className="px-5 py-4">
                                                    <button type="button" onClick={() => handleDeleteTalent(talent._id)} aria-label="Remove from talent pool" className="text-rose-500 hover:text-rose-700">
                                                        <FaTrash />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredTalent.length === 0 && (
                                            <tr>
                                                <td colSpan="5" className="px-6 py-10 text-center text-slate-500">
                                                    <FaUsers className="mx-auto mb-2 text-3xl text-slate-300" />
                                                    {talentPool.length === 0 ? 'No employees in talent pool yet.' : 'No employees match your filters.'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {showCreatePlanModal && (
                <SuiteModal title="Create Succession Plan" wide onClose={() => { setShowCreatePlanModal(false); resetPlanForm(); }}>
                    <form onSubmit={handleCreatePlan} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Position Name <span className="text-rose-500">*</span></label>
                                <input type="text" value={planFormData.positionName} onChange={(event) => setPlanFormData({ ...planFormData, positionName: event.target.value })} className={fieldClass} required />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Department <span className="text-rose-500">*</span></label>
                                <input type="text" value={planFormData.department} onChange={(event) => setPlanFormData({ ...planFormData, department: event.target.value })} className={fieldClass} required />
                            </div>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Role <span className="text-rose-500">*</span></label>
                            <select
                                value={planFormData.positionId}
                                onChange={(event) => {
                                    const positionId = event.target.value;
                                    const role = roles.find((item) => String(item._id) === String(positionId));
                                    setPlanFormData({
                                        ...planFormData,
                                        positionId,
                                        positionName: planFormData.positionName || role?.name || ''
                                    });
                                }}
                                className={fieldClass}
                                required
                            >
                                <option value="">Select role</option>
                                {roles.map((role) => (
                                    <option key={role._id} value={role._id}>{role.name}</option>
                                ))}
                            </select>
                            {roles.length === 0 && <p className="mt-1 text-xs text-amber-700">Add an organization role before creating a plan.</p>}
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Current Incumbent</label>
                            <select
                                value={planFormData.currentIncumbent}
                                onChange={(event) => {
                                    const currentIncumbent = event.target.value;
                                    const employee = employees.find((item) => String(item._id || item.id) === String(currentIncumbent));
                                    const matched = matchRole(roles, employee);
                                    setPlanFormData({
                                        ...planFormData,
                                        currentIncumbent,
                                        department: employee?.department || planFormData.department,
                                        positionName: planFormData.positionName || employee?.jobTitle || employee?.position || '',
                                        positionId: planFormData.positionId || matched?._id || ''
                                    });
                                }}
                                className={fieldClass}
                            >
                                <option value="">Select Employee</option>
                                {employees.map((employee) => (
                                    <option key={employee._id || employee.id} value={employee._id || employee.id}>
                                        {personName(employee)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Risk Level</label>
                                <select value={planFormData.riskLevel} onChange={(event) => setPlanFormData({ ...planFormData, riskLevel: event.target.value })} className={fieldClass}>
                                    {['Low', 'Medium', 'High', 'Critical'].map((level) => <option key={level}>{level}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Criticality</label>
                                <select value={planFormData.criticality} onChange={(event) => setPlanFormData({ ...planFormData, criticality: event.target.value })} className={fieldClass}>
                                    {['Low', 'Medium', 'High', 'Critical'].map((level) => <option key={level}>{level}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                                <select value={planFormData.status} onChange={(event) => setPlanFormData({ ...planFormData, status: event.target.value })} className={fieldClass}>
                                    {['Draft', 'Active', 'On Hold', 'Archived'].map((status) => <option key={status}>{status}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                            <button type="button" onClick={() => { setShowCreatePlanModal(false); resetPlanForm(); }} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                            <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: TEAL }}>
                                {submitting && <FaSpinner className="animate-spin" />}
                                {submitting ? 'Creating...' : 'Create Plan'}
                            </button>
                        </div>
                    </form>
                </SuiteModal>
            )}

            {showAddTalentModal && (
                <SuiteModal title="Add to Talent Pool" onClose={() => { setShowAddTalentModal(false); resetTalentForm(); }}>
                    <form onSubmit={handleAddTalent} className="space-y-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Employee <span className="text-rose-500">*</span></label>
                            <select
                                value={talentFormData.employeeId}
                                onChange={(event) => {
                                    const employeeId = event.target.value;
                                    const employee = employees.find((item) => String(item._id || item.id) === String(employeeId));
                                    const matched = matchRole(roles, employee);
                                    setTalentFormData({
                                        ...talentFormData,
                                        employeeId,
                                        currentRole: talentFormData.currentRole || matched?._id || '',
                                        performanceRating: employee?.performanceScore != null
                                            ? Number(employee.performanceScore) || talentFormData.performanceRating
                                            : talentFormData.performanceRating
                                    });
                                }}
                                className={fieldClass}
                                required
                            >
                                <option value="">Select Employee</option>
                                {employees.map((employee) => (
                                    <option key={employee._id || employee.id} value={employee._id || employee.id}>
                                        {personName(employee)} ({employee.email})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Potential Level</label>
                                <select value={talentFormData.potentialLevel} onChange={(event) => setTalentFormData({ ...talentFormData, potentialLevel: event.target.value })} className={fieldClass}>
                                    <option>High Potential</option>
                                    <option>Medium Potential</option>
                                    <option>Emerging Talent</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Performance Rating</label>
                                <input type="number" min="0" max="5" step="0.1" value={talentFormData.performanceRating} onChange={(event) => setTalentFormData({ ...talentFormData, performanceRating: parseFloat(event.target.value) || 0 })} className={fieldClass} />
                            </div>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Current Role</label>
                            <select value={talentFormData.currentRole} onChange={(event) => setTalentFormData({ ...talentFormData, currentRole: event.target.value })} className={fieldClass}>
                                <option value="">No role selected</option>
                                {roles.map((role) => <option key={role._id} value={role._id}>{role.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Career Aspirations</label>
                            <textarea value={talentFormData.careerAspirations} onChange={(event) => setTalentFormData({ ...talentFormData, careerAspirations: event.target.value })} className={fieldClass} rows="3" placeholder="Employee's career goals and aspirations..." />
                        </div>
                        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                            <button type="button" onClick={() => { setShowAddTalentModal(false); resetTalentForm(); }} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                            <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: TEAL }}>
                                {submitting && <FaSpinner className="animate-spin" />}
                                {submitting ? 'Adding...' : 'Add Talent'}
                            </button>
                        </div>
                    </form>
                </SuiteModal>
            )}
        </div>
    );
};

export default SuccessionPage;
