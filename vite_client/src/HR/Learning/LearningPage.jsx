import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    FaBook,
    FaGraduationCap,
    FaPlus,
    FaSearch,
    FaClock,
    FaCheckCircle,
    FaUsers,
    FaTimes,
    FaMedal,
    FaDownload,
    FaEllipsisV,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import {
    canManageLearning,
    courseStatusStyle,
    enrollmentStatusStyle,
    externalResourceLabel,
    formatCourseStatusLabel,
    formatEnrollmentStatusLabel,
    isEnrollmentOverdue,
    isExternalCourse
} from './learningUtils';
import { UI_TABLE_HEADING_CLASS } from '../../utils/textFormat.js';
import DraftAwaitingBanner from '../../components/DraftAwaitingBanner';
import CertificateModal from '../../Employee/Learning/CertificateModal';

const MINT_DARK = '#0d9488';

const KpiStat = ({ label, value, hint, icon }) => (
    <div className="rounded-2xl border border-slate-200 p-5 shadow-sm" style={{ backgroundColor: '#ffffff' }}>
        <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <span className="flex h-9 w-9 items-center justify-center rounded-full text-[#0a8f6c]" style={{ backgroundColor: '#e7f7f2' }}>
                {React.createElement(icon, { className: 'h-4 w-4' })}
            </span>
        </div>
        <p className="mt-4 text-3xl font-bold tracking-tight text-[#0E2B3D]">{value}</p>
        {hint ? <p className="mt-2 text-xs font-medium text-[#0a8f6c]">{hint}</p> : <span className="mt-2 block h-4" aria-hidden="true" />}
    </div>
);

const personName = (person) =>
    [person?.name, person?.lastName].filter(Boolean).join(' ').trim();

const courseLeadName = (course) =>
    personName(course?.instructor) || course?.externalInstructor?.name || '';

const formatUpdated = (date) => {
    if (!date) return 'Loading catalog';
    const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
    if (minutes < 1) return 'Updated just now';
    if (minutes < 60) return `Updated ${minutes} min${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`;
    return `Updated ${date.toLocaleDateString()}`;
};

const csvCell = (value) => `"${String(value ?? '').split('"').join('""')}"`;

const downloadCsv = (filename, header, rows) => {
    const blob = new Blob(
        [[header.join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\n')],
        { type: 'text/csv;charset=utf-8' }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};

const certificateReady = (enrollment) =>
    enrollment?.status === 'Completed' && Boolean(enrollment?.courseId?.certificate?.enabled);

const LEVEL_ORDER = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

const LearningPage = () => {
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);

    const isManagerUser = useMemo(() => canManageLearning(user, employee), [user, employee]);

    const [courses, setCourses] = useState([]);
    const [enrollments, setEnrollments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('courses');
    const [searchQuery, setSearchQuery] = useState('');
    const [assignmentCourse, setAssignmentCourse] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [assignmentTeams, setAssignmentTeams] = useState([]);
    const [assignmentMode, setAssignmentMode] = useState('employees');
    const [selectedTeamManagerId, setSelectedTeamManagerId] = useState('');
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
    const [assignmentDueDate, setAssignmentDueDate] = useState('');
    const [assignmentPriority, setAssignmentPriority] = useState('Medium');
    const [assignmentLoading, setAssignmentLoading] = useState(false);
    const [certificate, setCertificate] = useState(null);
    const [certificateEnrollmentId, setCertificateEnrollmentId] = useState(null);
    const [certificateLoadingId, setCertificateLoadingId] = useState(null);
    const [loadedAt, setLoadedAt] = useState(null);
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [levelFilter, setLevelFilter] = useState('all');
    const [menuCourseId, setMenuCourseId] = useState(null);
    const [exporting, setExporting] = useState(false);
    const menuRef = useRef(null);

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true);
            const coursesUrl = isManagerUser
                ? '/v1/admin/learning/courses?limit=500'
                : '/v1/both/learning/courses?limit=100';
            const enrollmentsUrl = isManagerUser
                ? '/v1/admin/learning/enrollments?limit=500'
                : '/v1/both/learning/enrollments';

            const [coursesRes, enrollmentsRes] = await Promise.all([
                axios.get(coursesUrl, { withCredentials: true }),
                axios.get(enrollmentsUrl, { withCredentials: true }),
            ]);
            setCourses(coursesRes.data?.data || []);
            setEnrollments(enrollmentsRes.data?.data || []);
            setLoadedAt(new Date());
        } catch (error) {
            setCourses([]);
            setEnrollments([]);
            toast.error(error.response?.data?.message || 'Failed to load learning data');
        } finally {
            setLoading(false);
        }
    }, [isManagerUser]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const openCertificate = useCallback(async (enrollmentId) => {
        try {
            setCertificateLoadingId(enrollmentId);
            const response = await axios.get(
                `/v1/both/learning/enrollments/${enrollmentId}/certificate`,
                { withCredentials: true }
            );
            if (response.data?.data) {
                setCertificate(response.data.data);
                setCertificateEnrollmentId(enrollmentId);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load certificate');
        } finally {
            setCertificateLoadingId(null);
        }
    }, []);

    const openAssignment = async (course) => {
        setAssignmentCourse(course);
        setAssignmentMode('employees');
        setSelectedTeamManagerId('');
        setSelectedEmployeeIds([]);
        setAssignmentDueDate('');
        setAssignmentPriority('Medium');
        try {
            setAssignmentLoading(true);
            const [employeesResponse, teamsResponse] = await Promise.all([
                axios.get('/v1/admin/employee?limit=100', { withCredentials: true }),
                axios.get('/v1/admin/learning/assignment-teams', { withCredentials: true })
            ]);
            setEmployees(employeesResponse.data?.data || employeesResponse.data?.employees || []);
            setAssignmentTeams(teamsResponse.data?.data || []);
        } catch (error) {
            setEmployees([]);
            setAssignmentTeams([]);
            toast.error(error.response?.data?.message || 'Failed to load employees');
        } finally {
            setAssignmentLoading(false);
        }
    };

    const submitAssignment = async () => {
        const isTeamAssignment = assignmentMode === 'team';
        if (
            !assignmentCourse ||
            (isTeamAssignment ? !selectedTeamManagerId : selectedEmployeeIds.length === 0)
        ) {
            toast.info(isTeamAssignment ? 'Select a team' : 'Select at least one employee');
            return;
        }
        if (assignmentCourse.isMandatory && !assignmentDueDate) {
            toast.info('A due date is required for mandatory training');
            return;
        }
        try {
            setAssignmentLoading(true);
            const response = await axios.post(
                '/v1/admin/learning/assignments',
                {
                    courseId: assignmentCourse._id,
                    employeeIds: isTeamAssignment ? undefined : selectedEmployeeIds,
                    teamManagerId: isTeamAssignment ? selectedTeamManagerId : undefined,
                    dueDate: assignmentDueDate || undefined,
                    priority: assignmentPriority
                },
                { withCredentials: true }
            );
            toast.success(response.data?.message || 'Course assigned');
            setAssignmentCourse(null);
            await fetchAll();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to assign course');
        } finally {
            setAssignmentLoading(false);
        }
    };

    const enrollmentsByCourse = useMemo(() => {
        const map = new Map();
        enrollments.forEach((enrollment) => {
            const id = String(enrollment.courseId?._id || enrollment.courseId || '');
            if (!id) return;
            const list = map.get(id) || [];
            list.push(enrollment);
            map.set(id, list);
        });
        return map;
    }, [enrollments]);

    const stats = useMemo(() => {
        const published = courses.filter((c) => (c.status || '').toLowerCase() === 'published').length;
        const completed = enrollments.filter((e) => e.status === 'Completed').length;
        const people = new Set(
            enrollments.map((e) => String(e.employeeId?._id || e.employeeId || '')).filter(Boolean)
        );
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const addedThisMonth = courses.filter((course) => {
            const created = course.createdAt ? new Date(course.createdAt) : null;
            return created && !Number.isNaN(created.getTime()) && created >= monthStart;
        }).length;
        return {
            published,
            enrolledEmployees: people.size,
            completionRate: enrollments.length ? Math.round((completed / enrollments.length) * 1000) / 10 : 0,
            certificates: enrollments.filter(certificateReady).length,
            completed,
            addedThisMonth,
        };
    }, [courses, enrollments]);

    const draftCourseCount = useMemo(
        () => courses.filter((c) => c.status === 'Draft').length,
        [courses]
    );

    const categories = useMemo(
        () => [...new Set(courses.map((course) => course.category).filter(Boolean))].sort(),
        [courses]
    );
    const levels = useMemo(() => {
        const present = new Set(courses.map((course) => course.level).filter(Boolean));
        return LEVEL_ORDER.filter((level) => present.has(level));
    }, [courses]);

    const matchesCourseFacets = useCallback((course) => {
        if (!course) return categoryFilter === 'all' && levelFilter === 'all';
        if (categoryFilter !== 'all' && course.category !== categoryFilter) return false;
        if (levelFilter !== 'all' && course.level !== levelFilter) return false;
        return true;
    }, [categoryFilter, levelFilter]);

    const filteredCourses = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return courses.filter((course) => {
            if (!matchesCourseFacets(course)) return false;
            if (!q) return true;
            const haystack = [
                course.title,
                course.category,
                course.description,
                course.status,
                course.level,
                courseLeadName(course),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [courses, searchQuery, matchesCourseFacets]);

    const filteredEnrollments = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return enrollments.filter((enrollment) => {
            if (!matchesCourseFacets(enrollment.courseId)) return false;
            if (!q) return true;
            const haystack = [
                enrollment.courseId?.title,
                enrollment.employeeId?.name,
                enrollment.employeeId?.lastName,
                enrollment.status,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [enrollments, searchQuery, matchesCourseFacets]);

    const certificateRows = useMemo(
        () => filteredEnrollments.filter(certificateReady),
        [filteredEnrollments]
    );

    const resetFilters = () => {
        setSearchQuery('');
        setCategoryFilter('all');
        setLevelFilter('all');
    };

    const exportCurrent = () => {
        setExporting(true);
        try {
            if (activeTab === 'courses') {
                downloadCsv(
                    'learning-courses.csv',
                    ['Title', 'Category', 'Level', 'Status', 'Hours', 'Enrollments', 'Average completion', 'Lead'],
                    filteredCourses.map((course) => {
                        const rows = enrollmentsByCourse.get(String(course._id)) || [];
                        const average = rows.length
                            ? Math.round(rows.reduce((sum, row) => sum + (Number(row.progress) || 0), 0) / rows.length)
                            : 0;
                        return [
                            course.title,
                            course.category,
                            course.level,
                            course.status,
                            course.duration || 0,
                            rows.length,
                            `${average}%`,
                            courseLeadName(course),
                        ];
                    })
                );
            } else if (activeTab === 'certificates') {
                downloadCsv(
                    'learning-certificates.csv',
                    ['Employee', 'Course', 'Completed'],
                    certificateRows.map((enrollment) => [
                        personName(enrollment.employeeId),
                        enrollment.courseId?.title || '',
                        enrollment.completedAt || enrollment.completionDate || '',
                    ])
                );
            } else {
                downloadCsv(
                    'learning-enrollments.csv',
                    ['Course', 'Employee', 'Assigned as', 'Progress', 'Status', 'Due'],
                    filteredEnrollments.map((enrollment) => [
                        enrollment.courseId?.title || '',
                        personName(enrollment.employeeId),
                        enrollment.assignmentTarget?.type === 'team' ? 'Team' : 'Individual',
                        `${enrollment.progress || 0}%`,
                        enrollment.status || '',
                        enrollment.dueDate ? new Date(enrollment.dueDate).toLocaleDateString() : '',
                    ])
                );
            }
        } finally {
            setExporting(false);
        }
    };

    useEffect(() => {
        if (!menuCourseId) return undefined;
        const onPointer = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) setMenuCourseId(null);
        };
        document.addEventListener('mousedown', onPointer);
        return () => document.removeEventListener('mousedown', onPointer);
    }, [menuCourseId]);

    return (
        <div className="page-shell min-h-[calc(100vh-64px)] bg-transparent">
            <div className="page-shell-inner hrms-stack">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0a8f6c]">
                            Engage &amp; support
                            <span className="ml-2 font-medium normal-case tracking-normal text-slate-400">· {formatUpdated(loadedAt)}</span>
                        </p>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0E2B3D] sm:text-3xl">
                            Enterprise Learning &amp; Development Hub
                        </h1>
                        <p className="mt-1 max-w-2xl text-sm text-slate-500">
                            Orchestrate internal training tracks, compliance certifications, and employee skill roadmaps.
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {isManagerUser && (
                            <button
                                type="button"
                                onClick={() => navigate('/learning/create-course')}
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0a8f6c] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#087a5c]"
                            >
                                <FaPlus className="h-3.5 w-3.5" />
                                Create Course
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={exportCurrent}
                            disabled={exporting}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                            style={{ backgroundColor: '#ffffff' }}
                            aria-label="Export current list"
                            title="Export current list"
                        >
                            <FaDownload className="h-4 w-4" />
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <KpiStat
                        label="Active courses"
                        value={stats.published}
                        hint={stats.addedThisMonth ? `+${stats.addedThisMonth} added this month` : null}
                        icon={FaBook}
                    />
                    <KpiStat label="Enrolled employees" value={stats.enrolledEmployees.toLocaleString()} icon={FaUsers} />
                    <KpiStat
                        label="Completion rate"
                        value={`${stats.completionRate}%`}
                        hint={stats.completed ? `${stats.completed} completed` : null}
                        icon={FaCheckCircle}
                    />
                    <KpiStat
                        label="Certifications issued"
                        value={stats.certificates}
                        hint={stats.certificates ? 'Ready to view' : null}
                        icon={FaMedal}
                    />
                </div>

                <div className="flex flex-wrap gap-6 border-b border-slate-200" role="tablist">
                    {[
                        { id: 'courses', label: 'Courses Catalog', count: filteredCourses.length, icon: FaBook },
                        { id: 'enrollments', label: 'Assignments & Progress', count: filteredEnrollments.length, icon: FaGraduationCap },
                        { id: 'certificates', label: 'Certificates Ledger', count: certificateRows.length, icon: FaMedal },
                    ].map((tab) => {
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setActiveTab(tab.id)}
                                className={`-mb-px inline-flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold ${
                                    active ? 'border-[#0a8f6c] text-[#0a8f6c]' : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <tab.icon className="h-3.5 w-3.5" />
                                {tab.label}
                                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${active ? 'bg-[#0a8f6c]/10 text-[#0a8f6c]' : 'bg-slate-100 text-slate-500'}`}>
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-3 shadow-sm lg:flex-row lg:items-center" style={{ backgroundColor: '#ffffff' }}>
                    <label className="relative min-w-0 flex-1">
                        <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder={activeTab === 'courses' ? 'Search courses by title, skill...' : 'Search by employee or course'}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#0a8f6c] focus:ring-2 focus:ring-[#0a8f6c]/20"
                        />
                    </label>
                    <select
                        value={categoryFilter}
                        onChange={(event) => setCategoryFilter(event.target.value)}
                        className="h-11 min-w-[10.5rem] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                    >
                        <option value="all">All categories</option>
                        {categories.map((category) => (
                            <option key={category} value={category}>{category}</option>
                        ))}
                    </select>
                    <select
                        value={levelFilter}
                        onChange={(event) => setLevelFilter(event.target.value)}
                        className="h-11 min-w-[9.5rem] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                    >
                        <option value="all">All levels</option>
                        {levels.map((level) => (
                            <option key={level} value={level}>{level}</option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={resetFilters}
                        className="h-11 px-3 text-sm font-semibold text-[#0a8f6c] hover:underline"
                    >
                        Reset filters
                    </button>
                </div>

                <section className="relative min-w-0 max-w-full">
                    {loading ? (
                        <div className="absolute inset-0 z-[2] flex items-center justify-center rounded-2xl bg-white/70">
                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-transparent border-t-[#0a8f6c]" />
                        </div>
                    ) : null}
                    <div className="min-w-0 max-w-full">
                        {activeTab === 'courses' ? (
                            <>
                            <DraftAwaitingBanner count={draftCourseCount} entityLabel="course" />
                            {loading && courses.length === 0 ? (
                                <div className="py-20" />
                            ) : filteredCourses.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
                                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-theme-primary/10 text-theme-primary">
                                        <FaBook className="h-7 w-7" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-900">No courses found</h3>
                                    <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                                        {searchQuery
                                            ? 'Try a different search term.'
                                            : 'Create your first course to get started.'}
                                    </p>
                                    {isManagerUser && !searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => navigate('/learning/create-course')}
                                            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-theme-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                                        >
                                            <FaPlus className="h-3.5 w-3.5" />
                                            Create Course
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                                    {filteredCourses.map((course) => {
                                        const rows = enrollmentsByCourse.get(String(course._id)) || [];
                                        const average = rows.length
                                            ? Math.round(rows.reduce((sum, row) => sum + (Number(row.progress) || 0), 0) / rows.length)
                                            : 0;
                                        const lead = courseLeadName(course);
                                        const menuOpen = menuCourseId === String(course._id);
                                        return (
                                        <article
                                            key={course._id}
                                            className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 shadow-sm"
                                            style={{ backgroundColor: '#ffffff' }}
                                        >
                                            <div
                                                className="relative flex shrink-0 flex-col justify-end"
                                                style={{ height: 148, minHeight: 148, backgroundColor: '#0E2B3D' }}
                                            >
                                                {course.thumbnail ? (
                                                    <img src={course.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" />
                                                ) : (
                                                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0E2B3D 0%, #146b56 100%)' }}>
                                                        <span className="text-3xl font-bold tracking-wide text-white/90">
                                                            {(course.title || course.category || 'C').slice(0, 1).toUpperCase()}
                                                        </span>
                                                    </div>
                                                )}
                                                {course.category ? (
                                                    <span className="absolute left-3 top-3 z-[1] rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-[#0E2B3D]">
                                                        {course.category}
                                                    </span>
                                                ) : null}
                                                <div className="relative z-[1] flex justify-end gap-2 px-4 pb-3">
                                                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0E2B3D]">
                                                            <FaClock className="mr-1 inline h-3 w-3" />
                                                            {course.duration || 0} hours
                                                        </span>
                                                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0E2B3D]">
                                                            <FaUsers className="mr-1 inline h-3 w-3" />
                                                            {rows.length} enrolled
                                                        </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-1 flex-col border-t border-slate-100 p-4" style={{ backgroundColor: '#ffffff' }}>
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        {course.level ? (
                                                            <span className="text-[11px] font-bold uppercase tracking-wide text-[#0a8f6c]">{course.level} level</span>
                                                        ) : null}
                                                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${courseStatusStyle(course.status)}`}>
                                                            {formatCourseStatusLabel(course.status || 'Draft')}
                                                        </span>
                                                        {course.isMandatory ? (
                                                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Mandatory</span>
                                                        ) : null}
                                                    </div>
                                                    <div className="relative" ref={menuOpen ? menuRef : null}>
                                                        <button
                                                            type="button"
                                                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                                            aria-label="Course actions"
                                                            onClick={() => setMenuCourseId(menuOpen ? null : String(course._id))}
                                                        >
                                                            <FaEllipsisV className="h-3.5 w-3.5" />
                                                        </button>
                                                        {menuOpen ? (
                                                            <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                                                                <button type="button" className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => navigate(`/learning/courses/${course._id}`)}>View</button>
                                                                {isManagerUser ? (
                                                                    <button type="button" className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => navigate(`/learning/edit-course/${course._id}`)}>Edit</button>
                                                                ) : null}
                                                                {isManagerUser && course.status === 'Published' ? (
                                                                    <button type="button" className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => { setMenuCourseId(null); openAssignment(course); }}>Assign</button>
                                                                ) : null}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                <h3 className="mt-2 line-clamp-2 text-base font-bold text-[#0E2B3D]">{course.title}</h3>
                                                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{course.description || 'No description provided.'}</p>
                                                {isExternalCourse(course) ? (
                                                    <p className="mt-1 text-xs font-medium text-[#0a8f6c]">{course.provider || externalResourceLabel(course.resourceType)}</p>
                                                ) : null}
                                                <div className="mt-4">
                                                    <div className="mb-1 flex justify-between text-[11px] font-medium text-slate-500">
                                                        <span>Avg completion</span>
                                                        <span>{average}%</span>
                                                    </div>
                                                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                                        <div className="h-full rounded-full bg-[#0a8f6c]" style={{ width: `${average}%` }} />
                                                    </div>
                                                </div>
                                                <div className="mt-4 flex items-center justify-between gap-2">
                                                    <p className="min-w-0 truncate text-xs text-slate-600">
                                                        {lead ? (
                                                            <>Lead: <span className="font-semibold text-[#0E2B3D]">{lead}</span></>
                                                        ) : (
                                                            <span className="font-medium text-slate-500">{course.category || 'Course'}</span>
                                                        )}
                                                    </p>
                                                    {isManagerUser && course.status === 'Published' ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => openAssignment(course)}
                                                            className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                        >
                                                            Assign
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </article>
                                        );
                                    })}
                                </div>
                            )}
                            </>
                        ) : activeTab === 'certificates' ? (
                            certificateRows.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
                                    <FaMedal className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                                    <h3 className="text-lg font-semibold text-slate-900">No certificates to show</h3>
                                    <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                                        Completed courses with certificates enabled appear here.
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                                    <table className="min-w-full text-left text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-100 bg-slate-50/80">
                                                <th className={`px-5 py-3 ${UI_TABLE_HEADING_CLASS}`}>Employee</th>
                                                <th className={`px-5 py-3 ${UI_TABLE_HEADING_CLASS}`}>Course</th>
                                                <th className={`px-5 py-3 ${UI_TABLE_HEADING_CLASS}`}>Completed</th>
                                                <th className={`px-5 py-3 ${UI_TABLE_HEADING_CLASS}`}>Certificate</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {certificateRows.map((enrollment) => (
                                                <tr key={enrollment._id} className="border-b border-slate-50">
                                                    <td className="px-5 py-4 text-slate-800">{personName(enrollment.employeeId) || '—'}</td>
                                                    <td className="px-5 py-4 font-medium text-slate-900">{enrollment.courseId?.title || '—'}</td>
                                                    <td className="px-5 py-4 text-slate-600">
                                                        {enrollment.completedAt || enrollment.completionDate
                                                            ? new Date(enrollment.completedAt || enrollment.completionDate).toLocaleDateString()
                                                            : '—'}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <button
                                                            type="button"
                                                            onClick={() => openCertificate(enrollment._id)}
                                                            disabled={certificateLoadingId === enrollment._id}
                                                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                                        >
                                                            <FaMedal className="h-3.5 w-3.5 text-[#0a8f6c]" />
                                                            {certificateLoadingId === enrollment._id ? 'Opening...' : 'View'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        ) : loading && enrollments.length === 0 ? (
                            <div className="py-20" />
                        ) : filteredEnrollments.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
                                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-theme-primary/10 text-theme-primary">
                                    <FaGraduationCap className="h-7 w-7" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-900">No enrollments yet</h3>
                                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                                    {searchQuery
                                        ? 'Try a different search term.'
                                        : 'Enrollments will appear when employees join courses.'}
                                </p>
                            </div>
                        ) : (
                            <div className="table-scroll-container learning-enrollments-table-scroll min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200 [-webkit-overflow-scrolling:touch]">
                                <table className="learning-enrollments-table w-max min-w-[780px] text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/80">
                                            <th className={`px-5 py-3 ${UI_TABLE_HEADING_CLASS}`}>
                                                Course
                                            </th>
                                            <th className={`px-5 py-3 ${UI_TABLE_HEADING_CLASS}`}>
                                                Employee
                                            </th>
                                            <th className={`px-5 py-3 ${UI_TABLE_HEADING_CLASS}`}>
                                                Assigned as
                                            </th>
                                            <th className={`px-5 py-3 ${UI_TABLE_HEADING_CLASS}`}>
                                                Progress
                                            </th>
                                            <th className={`px-5 py-3 ${UI_TABLE_HEADING_CLASS}`}>
                                                Status
                                            </th>
                                            <th className={`px-5 py-3 ${UI_TABLE_HEADING_CLASS}`}>
                                                Due
                                            </th>
                                            <th className={`px-5 py-3 ${UI_TABLE_HEADING_CLASS}`}>
                                                Certificate
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredEnrollments.map((enrollment) => {
                                            const progress = enrollment.progress || 0;
                                            const emp = enrollment.employeeId || {};
                                            const external = isExternalCourse(enrollment.courseId);
                                            const overdue = isEnrollmentOverdue(enrollment);
                                            const certificateReady =
                                                enrollment.status === 'Completed' &&
                                                Boolean(enrollment.courseId?.certificate?.enabled);
                                            return (
                                                <tr
                                                    key={enrollment._id}
                                                    className="border-b border-slate-50 hover:bg-slate-50/50"
                                                >
                                                    <td className="px-5 py-4 font-medium text-slate-900">
                                                        {enrollment.courseId?.title || 'N/A'}
                                                    </td>
                                                    <td className="px-5 py-4 text-slate-700">
                                                        {emp.name
                                                            ? `${emp.name} ${emp.lastName || ''}`.trim()
                                                            : 'N/A'}
                                                    </td>
                                                    <td className="px-5 py-4 text-xs text-slate-600">
                                                        {enrollment.assignmentTarget?.type === 'team'
                                                            ? `Team • ${
                                                                  enrollment.assignmentTarget.teamName ||
                                                                  [
                                                                      enrollment.assignmentTarget.teamManagerId?.name,
                                                                      enrollment.assignmentTarget.teamManagerId?.lastName
                                                                  ]
                                                                      .filter(Boolean)
                                                                      .join(' ') ||
                                                                  'Manager'
                                                              }`
                                                            : 'Individual'}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-2 flex-1 max-w-[120px] overflow-hidden rounded-full bg-slate-100">
                                                                <div
                                                                    className="h-full rounded-full bg-[#0E9370] transition-all"
                                                                    style={{ width: `${progress}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs font-medium text-slate-600">
                                                                {progress}%
                                                            </span>
                                                        </div>
                                                        {external && (
                                                            <p className="mt-1 text-[11px] text-slate-400">Self-reported</p>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <span
                                                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${enrollmentStatusStyle(enrollment.status)}`}
                                                        >
                                                            {formatEnrollmentStatusLabel(enrollment.status || '—')}
                                                        </span>
                                                    </td>
                                                    <td className={`px-5 py-4 text-xs font-medium ${overdue ? 'text-red-600' : 'text-slate-600'}`}>
                                                        {enrollment.dueDate
                                                            ? `${overdue ? 'Overdue • ' : ''}${new Date(enrollment.dueDate).toLocaleDateString()}`
                                                            : '—'}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        {certificateReady ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => openCertificate(enrollment._id)}
                                                                disabled={certificateLoadingId === enrollment._id}
                                                                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                                                            >
                                                                <FaMedal className="h-3.5 w-3.5" style={{ color: MINT_DARK }} />
                                                                {certificateLoadingId === enrollment._id
                                                                    ? 'Opening...'
                                                                    : 'View'}
                                                            </button>
                                                        ) : (
                                                            <span className="text-xs text-slate-400">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </section>
                {assignmentCourse && createPortal(
                    <div className="fixed inset-0 z-[12000] flex items-end justify-center bg-[#0E2B3D]/70 p-0 sm:items-center sm:p-4">
                        <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl">
                            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6 sm:py-5">
                                <div className="min-w-0">
                                    <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Assign Course</h2>
                                    <p className="mt-0.5 truncate text-sm text-slate-500">{assignmentCourse.title}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setAssignmentCourse(null)}
                                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                    aria-label="Close"
                                >
                                    <FaTimes />
                                </button>
                            </div>
                            <div className="p-5 sm:p-6">
                            <div className="mt-5">
                                <label className="mb-2 block text-sm font-semibold text-slate-800">
                                    Assign to
                                </label>
                                <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                                    {[
                                        { id: 'employees', label: 'Selected employees' },
                                        { id: 'team', label: 'Entire team' }
                                    ].map((mode) => (
                                        <button
                                            key={mode.id}
                                            type="button"
                                            onClick={() => {
                                                setAssignmentMode(mode.id);
                                                setSelectedEmployeeIds([]);
                                                setSelectedTeamManagerId('');
                                            }}
                                            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                                                assignmentMode === mode.id
                                                    ? 'bg-white text-[#0d9488] shadow-sm'
                                                    : 'text-slate-500'
                                            }`}
                                        >
                                            {mode.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700">
                                        Due date {assignmentCourse.isMandatory && <span className="text-red-500">*</span>}
                                    </label>
                                    <input type="date" value={assignmentDueDate} onChange={(event) => setAssignmentDueDate(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
                                    <select value={assignmentPriority} onChange={(event) => setAssignmentPriority(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2">
                                        {['Low', 'Medium', 'High', 'Urgent'].map((priority) => <option key={priority}>{priority}</option>)}
                                    </select>
                                </div>
                            </div>
                            {assignmentMode === 'team' ? (
                                <div className="mt-5">
                                    <label className="mb-2 block text-sm font-semibold text-slate-800">
                                        Team
                                    </label>
                                    <select
                                        value={selectedTeamManagerId}
                                        onChange={(event) => setSelectedTeamManagerId(event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"
                                    >
                                        <option value="">Select a manager's team</option>
                                        {assignmentTeams.map((team) => (
                                            <option key={team.managerId} value={team.managerId}>
                                                {team.managerName} — {team.memberCount} member
                                                {team.memberCount === 1 ? '' : 's'}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-2 text-xs text-slate-500">
                                        Every active direct report receives a separate enrollment, so progress,
                                        status, and completion are tracked independently.
                                    </p>
                                </div>
                            ) : (
                            <div className="mt-5">
                                <div className="mb-2 flex items-center justify-between">
                                    <label className="text-sm font-semibold text-slate-800">Employees</label>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedEmployeeIds(
                                            selectedEmployeeIds.length === employees.length
                                                ? []
                                                : employees.map((item) => item._id)
                                        )}
                                        className="text-xs font-semibold text-[#0d9488]"
                                    >
                                        {selectedEmployeeIds.length === employees.length ? 'Clear all' : 'Select all'}
                                    </button>
                                </div>
                                <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-slate-100 p-2">
                                    {assignmentLoading && employees.length === 0 ? (
                                        <p className="p-4 text-center text-sm text-slate-500">Loading employees...</p>
                                    ) : employees.length === 0 ? (
                                        <p className="p-4 text-center text-sm text-slate-500">No active employees available.</p>
                                    ) : employees.map((item) => (
                                        <label key={item._id} className="flex cursor-pointer items-center gap-3 rounded-lg p-3 hover:bg-slate-50">
                                            <input
                                                type="checkbox"
                                                checked={selectedEmployeeIds.includes(item._id)}
                                                onChange={() => setSelectedEmployeeIds((current) =>
                                                    current.includes(item._id)
                                                        ? current.filter((id) => id !== item._id)
                                                        : [...current, item._id]
                                                )}
                                                className="h-4 w-4"
                                            />
                                            <span>
                                                <span className="block text-sm font-medium text-slate-800">
                                                    {`${item.name || ''} ${item.lastName || ''}`.trim() || item.email}
                                                </span>
                                                <span className="block text-xs text-slate-500">
                                                    {[item.department, item.jobTitle || item.position].filter(Boolean).join(' • ')}
                                                </span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            )}
                            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={() => setAssignmentCourse(null)}
                                    className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={submitAssignment}
                                    disabled={
                                        assignmentLoading ||
                                        (assignmentMode === 'team'
                                            ? !selectedTeamManagerId
                                            : selectedEmployeeIds.length === 0)
                                    }
                                    className="rounded-xl bg-theme-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                                >
                                    {assignmentLoading
                                        ? 'Assigning...'
                                        : assignmentMode === 'team'
                                          ? `Assign to ${
                                                assignmentTeams.find(
                                                    (team) => team.managerId === selectedTeamManagerId
                                                )?.memberCount || 0
                                            } team members`
                                          : `Assign to ${selectedEmployeeIds.length || 0}`}
                                </button>
                            </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
                <CertificateModal
                    certificate={certificate}
                    enrollmentId={certificateEnrollmentId}
                    onClose={() => {
                        setCertificate(null);
                        setCertificateEnrollmentId(null);
                    }}
                />
            </div>
        </div>
    );
};

export default LearningPage;
