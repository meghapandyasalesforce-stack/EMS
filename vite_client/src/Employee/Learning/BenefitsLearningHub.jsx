import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    FaHeart,
    FaBook,
    FaSearch,
    FaFilter,
    FaArrowRight,
    FaCheckCircle,
    FaPlayCircle,
    FaYoutube,
    FaFilePdf,
    FaLink,
    FaVideo,
    FaTag,
    FaDownload,
    FaClock,
    FaSpinner,
    FaChevronDown
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-toastify';
import {
    externalResourceLabel,
    isEnrollmentOverdue,
    isExternalCourse
} from '../../HR/Learning/learningUtils';
import { formatStatusLabel, UI_BADGE_TEXT_CLASS, UI_FORM_LABEL_CLASS } from '../../utils/textFormat.js';
import { format } from 'date-fns';

const LEARNING_STATUS_RANK = { 'In Progress': 0, Enrolled: 1, Completed: 2, Available: 3 };

const LEARNING_FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'assigned', label: 'Not Started' },
    { id: 'in-progress', label: 'In Progress' },
    { id: 'completed', label: 'Completed' },
    { id: 'overdue', label: 'Overdue' }
];

const LearningFilterDropdown = ({ value, onChange, className = '' }) => {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);
    const selected = LEARNING_FILTERS.find((item) => item.id === value) || LEARNING_FILTERS[0];

    useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event) => {
            if (!rootRef.current?.contains(event.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [open]);

    return (
        <div ref={rootRef} className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                className="inline-flex h-9 w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700"
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <FaFilter className="h-3 w-3 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate text-left">{selected.label}</span>
                <FaChevronDown className={`h-2.5 w-2.5 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <ul
                    role="listbox"
                    className="absolute right-0 z-30 mt-1 min-w-[10.5rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                >
                    {LEARNING_FILTERS.map((item) => (
                        <li key={item.id}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={item.id === value}
                                onClick={() => {
                                    onChange(item.id);
                                    setOpen(false);
                                }}
                                className={`block w-full px-3 py-1.5 text-left text-xs font-medium ${
                                    item.id === value
                                        ? 'bg-theme-primary/10 text-theme-primary'
                                        : 'text-slate-700 hover:bg-slate-50'
                                }`}
                            >
                                {item.label}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const LEARNING_STATUS_STYLES = {
    Completed: 'bg-emerald-100 text-emerald-700',
    'In Progress': 'bg-[#20C997]/15 text-[#0a8f6c]',
    Enrolled: 'bg-amber-100 text-amber-700',
    'Not Started': 'bg-amber-100 text-amber-700',
    Available: 'bg-slate-100 text-slate-600'
};

const learningStatusStyle = (status) => LEARNING_STATUS_STYLES[status] || 'bg-slate-100 text-slate-600';

const formatLearningStatusDisplay = (status) => {
    if (status === 'Enrolled') return 'Not started';
    return formatStatusLabel(status);
};

const BenefitsLearningHub = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);

    const [loading, setLoading] = useState(true);
    const [benefits, setBenefits] = useState([]);
    const [myBenefitEnrollments, setMyBenefitEnrollments] = useState([]);
    const [benefitActionId, setBenefitActionId] = useState(null);
    const [dependentDraft, setDependentDraft] = useState({ enrollmentId: null, name: '', relationship: 'Spouse' });
    const [teamLearning, setTeamLearning] = useState([]);
    const [courses, setCourses] = useState([]);
    const [enrollments, setEnrollments] = useState([]);

    const [activeTab, setActiveTab] = useState(
        location.pathname.startsWith('/learning') || searchParams.get('tab') === 'learning'
            ? 'learning'
            : 'benefits'
    );
    const [search, setSearch] = useState('');
    const [learningFilter, setLearningFilter] = useState('all');
    const [updatingTeamProgressId, setUpdatingTeamProgressId] = useState(null);

    useEffect(() => {
        const fetchHubData = async () => {
            try {
                setLoading(true);
                // auth.user holds the User id for linked accounts; assignments reference the Employee id.
                const currentUserId =
                    employee?._id || user?.employeeProfileId || user?._id || user?.id;

                const [benefitsRes, myBenefitsRes, teamRes, coursesRes, enrollmentsRes] = await Promise.allSettled([
                    axios.get('/v1/both/benefits/benefit-plans', { withCredentials: true }),
                    axios.get('/v1/both/benefits/benefits', { withCredentials: true }),
                    axios.get('/v1/both/team-learning', { withCredentials: true }),
                    axios.get('/v1/both/learning/courses', { withCredentials: true }),
                    axios.get('/v1/both/learning/enrollments', { withCredentials: true })
                ]);

                if (benefitsRes.status === 'fulfilled') {
                    setBenefits(benefitsRes.value.data?.data || []);
                }
                if (myBenefitsRes.status === 'fulfilled') {
                    setMyBenefitEnrollments(myBenefitsRes.value.data?.data || []);
                }
                if (teamRes.status === 'fulfilled') {
                    const allTeamLearning = teamRes.value.data?.data || [];
                    const assignedLearning = allTeamLearning.filter((item) => {
                        if (!item.assignedTo || item.assignedTo.length === 0) return true;
                        return item.assignedTo.some((id) => String(id?._id || id) === String(currentUserId));
                    });
                    setTeamLearning(assignedLearning);
                }
                if (coursesRes.status === 'fulfilled') {
                    setCourses(coursesRes.value.data?.data || []);
                }
                if (enrollmentsRes.status === 'fulfilled') {
                    // The endpoint already returns only the signed-in employee's enrollments.
                    setEnrollments(enrollmentsRes.value.data?.data || []);
                }
            } catch {
                toast.error('Failed to load benefits and learning data');
            } finally {
                setLoading(false);
            }
        };

        fetchHubData();
    }, [user, employee]);

    const filteredBenefits = useMemo(() => {
        return benefits.filter((plan) => {
            if (!plan?.isActive) return false;
            if (!search.trim()) return true;
            const text = `${plan.name || ''} ${plan.description || ''} ${plan.category || ''}`.toLowerCase();
            return text.includes(search.toLowerCase());
        });
    }, [benefits, search]);

    const enrollmentByPlanId = useMemo(() => {
        const map = {};
        myBenefitEnrollments.forEach((item) => {
            const planId = String(item.benefitPlanId?._id || item.benefitPlanId || '');
            if (!planId) return;
            if (['Pending', 'Active', 'Enrolled'].includes(item.status)) {
                map[planId] = item;
            }
        });
        return map;
    }, [myBenefitEnrollments]);

    const refreshMyBenefits = async () => {
        const response = await axios.get('/v1/both/benefits/benefits', { withCredentials: true });
        setMyBenefitEnrollments(response.data?.data || []);
    };

    const handleCancelMyEnrollment = async (enrollmentId) => {
        if (!window.confirm('Withdraw this pending enrollment request?')) return;
        try {
            setBenefitActionId(enrollmentId);
            await axios.put(`/v1/both/benefits/benefits/${enrollmentId}/cancel`, {}, { withCredentials: true });
            toast.success('Enrollment request withdrawn');
            await refreshMyBenefits();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to cancel enrollment');
        } finally {
            setBenefitActionId(null);
        }
    };

    const handleAddMyDependent = async (enrollment) => {
        if (!dependentDraft.name.trim()) {
            toast.error('Dependent name is required');
            return;
        }
        const next = [
            ...(enrollment.dependents || []),
            {
                name: dependentDraft.name.trim(),
                relationship: dependentDraft.relationship
            }
        ];
        try {
            setBenefitActionId(enrollment._id);
            await axios.put(
                `/v1/both/benefits/benefits/${enrollment._id}/dependents`,
                { dependents: next },
                { withCredentials: true }
            );
            toast.success('Dependent added');
            setDependentDraft({ enrollmentId: null, name: '', relationship: 'Spouse' });
            await refreshMyBenefits();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add dependent');
        } finally {
            setBenefitActionId(null);
        }
    };

    const myActiveOrPendingBenefits = useMemo(
        () => myBenefitEnrollments.filter((item) => ['Pending', 'Active', 'Enrolled'].includes(item.status)),
        [myBenefitEnrollments]
    );

    const learningCards = useMemo(() => {
        // Assignments drive this list: the catalog response is paginated and only covers published courses.
        const assigned = enrollments
            .map((enrollment) => {
                const populatedCourse =
                    enrollment.courseId && typeof enrollment.courseId === 'object'
                        ? enrollment.courseId
                        : courses.find((item) => String(item._id) === String(enrollment.courseId));
                if (!populatedCourse?._id) return null;
                return {
                    ...populatedCourse,
                    progress: enrollment.progress ?? 0,
                    status: enrollment.status || 'Enrolled',
                    enrollment
                };
            })
            .filter(Boolean);

        const assignedCourseIds = new Set(assigned.map((course) => String(course._id)));

        return [
            ...assigned,
            ...courses
                .filter((course) => !assignedCourseIds.has(String(course._id)))
                .map((course) => ({
                    ...course,
                    progress: 0,
                    status: 'Available',
                    enrollment: null
                }))
        ]
            .sort(
                (a, b) =>
                    (LEARNING_STATUS_RANK[a.status] ?? 4) - (LEARNING_STATUS_RANK[b.status] ?? 4) ||
                    (a.title || '').localeCompare(b.title || '')
            )
            .filter((course) => {
                if (!search.trim()) return true;
                const text = `${course.title || ''} ${course.description || ''} ${course.category || ''}`.toLowerCase();
                return text.includes(search.toLowerCase());
            })
            .filter((course) => {
                if (learningFilter === 'all') return true;
                if (learningFilter === 'assigned') return course.status === 'Enrolled';
                if (learningFilter === 'in-progress') return course.status === 'In Progress';
                if (learningFilter === 'completed') return course.status === 'Completed';
                if (learningFilter === 'overdue') return isEnrollmentOverdue(course.enrollment);
                return true;
            });
    }, [courses, enrollments, search, learningFilter]);

    const learningStats = useMemo(() => {
        const completed = enrollments.filter((item) => item.status === 'Completed').length;
        const total = enrollments.length;

        return {
            total,
            assigned: enrollments.filter((item) => item.status === 'Enrolled').length,
            inProgress: enrollments.filter((item) => item.status === 'In Progress').length,
            completed,
            pending: total - completed,
            overdue: enrollments.filter(isEnrollmentOverdue).length,
            completionRate: total ? Math.round((completed / total) * 100) : 0
        };
    }, [enrollments]);

    const filteredTeamLearning = useMemo(() => {
        return teamLearning
            .filter((item) => {
                if (!search.trim()) return true;
                const text = `${item.title || ''} ${item.description || ''} ${item.category || ''}`.toLowerCase();
                return text.includes(search.toLowerCase());
            })
            .filter((item) => {
                const progress =
                    typeof item.progress === 'number'
                        ? item.progress
                        : item.progress?.progress || item.progressRecord?.progress || 0;
                if (learningFilter === 'all') return true;
                if (learningFilter === 'assigned') return progress === 0;
                if (learningFilter === 'in-progress') return progress > 0 && progress < 100;
                if (learningFilter === 'completed') return progress >= 100;
                return true;
            });
    }, [teamLearning, search, learningFilter]);

    const getResourceIcon = (type) => {
        switch (type) {
            case 'Video':
                return <FaVideo className="text-red-500" />;
            case 'Document':
                return <FaFilePdf className="text-red-500" />;
            case 'Link':
                return <FaLink className="text-[#0a8f6c]" />;
            case 'YouTube':
                return <FaYoutube className="text-red-500" />;
            default:
                return <FaBook className="text-slate-500" />;
        }
    };

    const getCategoryColor = (category) => {
        const colors = {
            Technical: 'bg-[#20C997]/15 text-[#0a8f6c]',
            'Soft Skills': 'bg-blue-100 text-blue-700',
            Leadership: 'bg-purple-100 text-purple-700',
            Compliance: 'bg-red-100 text-red-700',
            Other: 'bg-slate-100 text-slate-600'
        };
        return colors[category] || colors.Other;
    };

    const updateTeamLearningProgress = async (learningId, progress) => {
        try {
            setUpdatingTeamProgressId(learningId);
            await axios.post(
                `/v1/both/team-learning/${learningId}/progress`,
                { progress },
                { withCredentials: true }
            );

            setTeamLearning((prev) =>
                prev.map((item) =>
                    item._id === learningId ? { ...item, progress } : item
                )
            );
            toast.success('Progress updated');
        } catch {
            toast.error('Failed to update progress');
        } finally {
            setUpdatingTeamProgressId(null);
        }
    };

    if (loading) {
        return <LoadingSpinner message="Loading benefits and learning..." />;
    }

    const isLearningTab = activeTab === 'learning';

    return (
        <div className="page-shell bg-[#F3F7F5]">
            <div className="page-shell-inner hrms-stack">
                <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between lg:p-6">
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-theme-primary/10 text-theme-primary lg:h-12 lg:w-12 lg:rounded-2xl lg:text-xl">
                                {isLearningTab ? <FaBook /> : <FaHeart />}
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-xl font-bold text-slate-900 lg:text-3xl">
                                    {isLearningTab ? 'Learning & Development' : 'Benefits & Learning'}
                                </h1>
                                <p className="mt-1 text-xs text-slate-500 lg:text-sm">
                                    {isLearningTab
                                        ? 'Track assigned courses, continue learning, and view your progress'
                                        : 'Access your employee benefits and growth resources in one place'}
                                </p>
                            </div>
                        </div>
                        <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:items-center">
                            <label className="relative hidden min-w-[240px] lg:block lg:w-64">
                                <FaSearch className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search benefits or courses..."
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-theme-primary focus:bg-white focus:ring-2 focus:ring-theme-primary/20"
                                />
                            </label>
                            {isLearningTab && (
                                <LearningFilterDropdown
                                    value={learningFilter}
                                    onChange={setLearningFilter}
                                    className="hidden w-32 lg:block"
                                />
                            )}
                            <div className="inline-flex w-full rounded-xl bg-slate-100 p-1 lg:w-auto">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('benefits')}
                                    className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition lg:flex-none ${
                                        activeTab === 'benefits' ? 'bg-white text-theme-primary shadow-sm' : 'text-slate-600'
                                    }`}
                                >
                                    Benefits
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('learning')}
                                    className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition lg:flex-none ${
                                        activeTab === 'learning' ? 'bg-white text-theme-primary shadow-sm' : 'text-slate-600'
                                    }`}
                                >
                                    Learning
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                <section className="flex items-center gap-2 lg:hidden">
                    <label className="relative min-w-0 flex-1">
                        <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search..."
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/20"
                        />
                    </label>
                    {isLearningTab && (
                        <LearningFilterDropdown
                            value={learningFilter}
                            onChange={setLearningFilter}
                            className="w-[7.25rem] shrink-0"
                        />
                    )}
                </section>

                {activeTab === 'benefits' ? (
                    <>
                    <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                        <div>
                            <h3 className="text-2xl font-semibold text-slate-900">My Benefits</h3>
                            <p className="text-sm text-slate-500">Your enrollments, pending requests, and dependents.</p>
                        </div>
                        {myActiveOrPendingBenefits.length === 0 ? (
                            <p className="py-6 text-center text-sm text-slate-500">
                                You have no active or pending benefit enrollments yet.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {myActiveOrPendingBenefits.map((enrollment) => {
                                    const plan = enrollment.benefitPlanId || {};
                                    const supportsDependents = plan.planType === 'Family' || plan.planType === 'Both';
                                    return (
                                        <div key={enrollment._id} className="rounded-xl border border-slate-100 p-4">
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                <div>
                                                    <h4 className="font-semibold text-slate-900">{plan.name || 'Benefit'}</h4>
                                                    <p className="text-xs text-slate-500">{plan.category || 'Benefit Plan'}</p>
                                                    <p className="mt-1 text-sm text-slate-600">
                                                        Coverage: {enrollment.coverageType || '—'} · Employer ₹{Number(enrollment.companyContribution || 0).toLocaleString('en-IN')} · Employee ₹{Number(enrollment.employeeContribution || 0).toLocaleString('en-IN')}
                                                    </p>
                                                </div>
                                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                    enrollment.status === 'Pending'
                                                        ? 'bg-amber-100 text-amber-700'
                                                        : 'bg-[#20C997]/15 text-[#0a8f6c]'
                                                }`}>
                                                    {enrollment.status}
                                                </span>
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/benefits/${plan._id || enrollment.benefitPlanId}`)}
                                                    className="text-sm font-semibold text-[#0a8f6c]"
                                                >
                                                    View plan
                                                </button>
                                                {enrollment.status === 'Pending' && (
                                                    <button
                                                        type="button"
                                                        disabled={benefitActionId === enrollment._id}
                                                        onClick={() => handleCancelMyEnrollment(enrollment._id)}
                                                        className="text-sm font-semibold text-red-600"
                                                    >
                                                        {benefitActionId === enrollment._id ? 'Working...' : 'Withdraw'}
                                                    </button>
                                                )}
                                            </div>
                                            {supportsDependents && ['Active', 'Enrolled', 'Pending'].includes(enrollment.status) && (
                                                <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dependents</p>
                                                    {(enrollment.dependents || []).length === 0 && (
                                                        <p className="text-sm text-slate-500">No dependents added.</p>
                                                    )}
                                                    {(enrollment.dependents || []).map((dep, idx) => (
                                                        <p key={`${dep.name}-${idx}`} className="text-sm text-slate-700">
                                                            {dep.relationship}: {dep.name}
                                                        </p>
                                                    ))}
                                                    {dependentDraft.enrollmentId === enrollment._id ? (
                                                        <div className="flex flex-col sm:flex-row gap-2">
                                                            <input
                                                                type="text"
                                                                value={dependentDraft.name}
                                                                onChange={(e) => setDependentDraft({ ...dependentDraft, name: e.target.value })}
                                                                placeholder="Dependent name"
                                                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                                            />
                                                            <select
                                                                value={dependentDraft.relationship}
                                                                onChange={(e) => setDependentDraft({ ...dependentDraft, relationship: e.target.value })}
                                                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                                            >
                                                                <option value="Spouse">Spouse</option>
                                                                <option value="Child">Child</option>
                                                                <option value="Parent">Parent</option>
                                                                <option value="Other">Other</option>
                                                            </select>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAddMyDependent(enrollment)}
                                                                className="rounded-lg bg-[#0a8f6c] px-3 py-2 text-sm font-semibold text-white"
                                                            >
                                                                Save
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setDependentDraft({ enrollmentId: null, name: '', relationship: 'Spouse' })}
                                                                className="rounded-lg px-3 py-2 text-sm text-slate-600"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => setDependentDraft({ enrollmentId: enrollment._id, name: '', relationship: 'Spouse' })}
                                                            className="text-sm font-semibold text-[#0a8f6c]"
                                                        >
                                                            + Add Dependent
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-semibold text-slate-900">Core Benefits</h3>
                                <p className="text-sm text-slate-500">Active plans and wellness subsidies for this quarter.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate('/benefits')}
                                className="text-sm font-semibold text-[#0a8f6c] hover:text-[#086d56]"
                            >
                                View All Programs
                            </button>
                        </div>

                        {filteredBenefits.length === 0 ? (
                            <p className="py-8 text-center text-sm text-slate-500">No benefits matched your search.</p>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {filteredBenefits.slice(0, 6).map((plan) => {
                                    const myEnrollment = enrollmentByPlanId[String(plan._id)];
                                    const statusLabel = myEnrollment?.status || (plan.enrollmentType === 'Automatic' ? 'HR Assigned' : 'Available');
                                    const statusClass = myEnrollment?.status === 'Pending'
                                        ? 'bg-amber-100 text-amber-700'
                                        : myEnrollment
                                            ? 'bg-[#20C997]/15 text-[#0a8f6c]'
                                            : 'bg-slate-100 text-slate-600';
                                    return (
                                    <article key={plan._id} className="rounded-xl border border-slate-100 bg-white p-4 transition hover:shadow-md">
                                        <div className="mb-3 flex items-center justify-between">
                                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#20C997]/15 text-[#0a8f6c]">
                                                <FaHeart />
                                            </span>
                                            <span className={`rounded-full ${statusClass} ${UI_BADGE_TEXT_CLASS}`}>
                                                {statusLabel}
                                            </span>
                                        </div>
                                        <h4 className="text-lg font-semibold text-slate-900">{plan.name}</h4>
                                        <p className="text-xs text-slate-500">{plan.category || 'Benefit Plan'}</p>
                                        <p className="mt-2 line-clamp-2 text-sm text-slate-600">{plan.description || 'Benefit details available.'}</p>
                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/benefits/${plan._id}`)}
                                                className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-[#20C997] to-[#0a8f6c] px-3 py-1.5 text-sm font-semibold text-white"
                                            >
                                                {myEnrollment
                                                    ? 'View Status'
                                                    : plan.enrollmentType === 'Automatic'
                                                        ? 'View Details'
                                                        : 'Enroll'}
                                                <FaArrowRight className="text-xs" />
                                            </button>
                                            {!myEnrollment && plan.enrollmentType !== 'Automatic' && (
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/benefits/${plan._id}`)}
                                                    className="text-sm font-semibold text-[#0a8f6c]"
                                                >
                                                    Details
                                                </button>
                                            )}
                                        </div>
                                    </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                    </>
                ) : (
                    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">My Learning</h3>
                                <p className="text-sm text-slate-500">Assigned courses, catalog, and completion progress.</p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600 whitespace-nowrap">
                                {learningStats.total} assigned
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                            {[
                                { label: 'Total Assigned', value: learningStats.total, tone: 'text-slate-900' },
                                { label: 'Not Started', value: learningStats.assigned, tone: 'text-amber-700' },
                                { label: 'In Progress', value: learningStats.inProgress, tone: 'text-[#0a8f6c]' },
                                { label: 'Completed', value: learningStats.completed, tone: 'text-emerald-600' }
                            ].map((stat) => (
                                <div key={stat.label} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                                    <p className={UI_FORM_LABEL_CLASS}>{stat.label}</p>
                                    <p className={`mt-1 text-2xl font-bold ${stat.tone}`}>{stat.value}</p>
                                </div>
                            ))}
                        </div>

                        {learningStats.total > 0 && (
                            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-slate-900">
                                        {learningStats.completed} of {learningStats.total} assigned courses completed
                                    </p>
                                    <p className="text-sm font-semibold text-[#0a8f6c]">{learningStats.completionRate}%</p>
                                </div>
                                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-[#20C997] to-[#0a8f6c] transition-all"
                                        style={{ width: `${learningStats.completionRate}%` }}
                                    />
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                    <span>
                                        {learningStats.pending === 0
                                            ? 'Everything assigned to you is complete.'
                                            : `${learningStats.pending} still to finish`}
                                    </span>
                                    {learningStats.overdue > 0 && (
                                        <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                                            <FaClock /> {learningStats.overdue} overdue
                                        </span>
                                    )}
                                    {learningStats.inProgress > 0 && (
                                        <span className="text-[#0a8f6c] font-medium">
                                            {learningStats.inProgress} in progress
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {learningCards.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-400">
                                    <FaBook />
                                </div>
                                <h4 className="mt-3 font-semibold text-slate-800">No courses match your filters</h4>
                                <p className="mt-1 text-sm text-slate-500">Try a different search or status filter.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {learningCards.map((course) => (
                                    <article
                                        key={course._id}
                                        className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-theme-primary/30 hover:shadow-md"
                                    >
                                        <div className="mb-3 flex items-center justify-between gap-2">
                                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#20C997]/15 text-[#0a8f6c]">
                                                <FaBook />
                                            </span>
                                            <span
                                                className={`rounded-full ${UI_BADGE_TEXT_CLASS} ${learningStatusStyle(
                                                    course.status
                                                )}`}
                                            >
                                                {formatLearningStatusDisplay(course.status)}
                                            </span>
                                        </div>
                                        <h4 className="line-clamp-2 text-lg font-semibold text-slate-900">{course.title}</h4>
                                        <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm text-slate-600">
                                            {course.description || 'Learning content available.'}
                                        </p>
                                        {isExternalCourse(course) && (
                                            <p className="mt-2 text-xs font-semibold text-[#0a8f6c]">
                                                {course.provider || externalResourceLabel(course.resourceType)}
                                                {course.isMandatory ? ' • Mandatory' : ''}
                                            </p>
                                        )}
                                        {course.enrollment?.dueDate && (
                                            <p className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${isEnrollmentOverdue(course.enrollment) ? 'text-red-600' : 'text-slate-500'}`}>
                                                <FaClock />
                                                {isEnrollmentOverdue(course.enrollment) ? 'Overdue' : 'Due'}{' '}
                                                {format(new Date(course.enrollment.dueDate), 'dd MMM yyyy')}
                                            </p>
                                        )}

                                        <div className="mt-3">
                                            <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
                                                <span>Progress</span>
                                                <span className="font-semibold text-slate-700">{course.progress}% complete</span>
                                            </div>
                                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-[#20C997] to-[#0a8f6c] transition-all"
                                                    style={{ width: `${Math.min(100, Math.max(0, Number(course.progress) || 0))}%` }}
                                                />
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => navigate(`/learning/courses/${course._id}`)}
                                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-theme-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
                                        >
                                            {course.status === 'Completed' && course.certificate?.enabled ? (
                                                <>
                                                    <FaCheckCircle /> View Certificate
                                                </>
                                            ) : (
                                                <>
                                                    {course.status === 'Completed' ? <FaCheckCircle /> : <FaPlayCircle />}
                                                    {course.status === 'Completed'
                                                        ? 'View Course'
                                                        : course.status === 'In Progress'
                                                          ? 'Continue Learning'
                                                          : course.status === 'Enrolled'
                                                            ? 'Start Learning'
                                                            : 'View Course'}
                                                </>
                                            )}
                                        </button>
                                    </article>
                                ))}
                            </div>
                        )}

                        <div className="mt-2 border-t border-slate-100 pt-5">
                            <div className="mb-3">
                                <h4 className="text-xl font-semibold text-slate-900">Team Learning Resources</h4>
                                <p className="text-sm text-slate-500">Assigned resources, materials, and practical learning tasks.</p>
                            </div>

                            {filteredTeamLearning.length === 0 ? (
                                <p className="py-6 text-center text-sm text-slate-500">No team learning resources matched your filters.</p>
                            ) : (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    {filteredTeamLearning.map((learning) => (
                                        (() => {
                                            const progressValue =
                                                typeof learning.progress === 'number'
                                                    ? learning.progress
                                                    : learning.progress?.progress || learning.progressRecord?.progress || 0;
                                            const teamLearningStatus =
                                                learning.progressStatus ||
                                                (progressValue >= 100
                                                    ? 'Completed'
                                                    : progressValue > 0
                                                      ? 'In Progress'
                                                      : 'Not Started');
                                            return (
                                        <article
                                            key={learning._id}
                                            className="rounded-xl border border-slate-100 bg-white p-4 transition hover:shadow-md"
                                        >
                                            <div className="mb-2 flex items-start justify-between gap-2">
                                                <h5 className="line-clamp-2 text-base font-semibold text-slate-900">{learning.title}</h5>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getCategoryColor(learning.category)}`}>
                                                        {learning.category || 'Other'}
                                                    </span>
                                                    <span
                                                        className={`whitespace-nowrap rounded-full ${UI_BADGE_TEXT_CLASS} ${learningStatusStyle(
                                                            teamLearningStatus
                                                        )}`}
                                                    >
                                                        {formatLearningStatusDisplay(teamLearningStatus)}
                                                    </span>
                                                </div>
                                            </div>

                                            {learning.description && (
                                                <p className="mb-3 line-clamp-2 text-sm text-slate-600">{learning.description}</p>
                                            )}

                                            {learning.resources && learning.resources.length > 0 && (
                                                <div className="mb-3">
                                                    <p className={`mb-2 ${UI_FORM_LABEL_CLASS}`}>Resources</p>
                                                    <div className="space-y-1.5">
                                                        {learning.resources.slice(0, 3).map((resource, idx) => (
                                                            <div key={`${resource.title}-${idx}`} className="flex items-center gap-2 text-xs text-slate-600">
                                                                {getResourceIcon(resource.type)}
                                                                <span className="flex-1 truncate">{resource.title}</span>
                                                                {resource.url && (
                                                                    <a
                                                                        href={resource.url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-[#0a8f6c] hover:underline"
                                                                    >
                                                                        <FaDownload className="text-[11px]" />
                                                                    </a>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {learning.tags && learning.tags.length > 0 && (
                                                <div className="mb-3 flex flex-wrap gap-1">
                                                    {learning.tags.slice(0, 3).map((tag, idx) => (
                                                        <span key={`${tag}-${idx}`} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                                                            <FaTag className="text-[10px]" />
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {learning.dueDate && (
                                                <p className="mb-2 inline-flex items-center gap-1.5 text-xs text-slate-500">
                                                    <FaClock />
                                                    Due {new Date(learning.dueDate).toLocaleDateString()}
                                                </p>
                                            )}

                                            <div className="mt-2">
                                                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                                                    <span>Progress</span>
                                                    <span>{progressValue}%</span>
                                                </div>
                                                <div className="h-2 w-full rounded-full bg-slate-100">
                                                    <div
                                                        className="h-2 rounded-full bg-gradient-to-r from-[#20C997] to-[#0a8f6c]"
                                                        style={{ width: `${progressValue}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {progressValue < 100 && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        updateTeamLearningProgress(
                                                            learning._id,
                                                            Math.min(progressValue + 25, 100)
                                                        )
                                                    }
                                                    disabled={updatingTeamProgressId === learning._id}
                                                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#20C997]/40 py-2 text-sm font-semibold text-[#0a8f6c] transition hover:bg-[#20C997]/10 disabled:opacity-60"
                                                >
                                                    {updatingTeamProgressId === learning._id ? (
                                                        <>
                                                            <FaSpinner className="animate-spin" />
                                                            Updating...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <FaCheckCircle />
                                                            Update Progress
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </article>
                                            );
                                        })()
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
};

export default BenefitsLearningHub;
