import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    FaBook,
    FaGraduationCap,
    FaPlus,
    FaEdit,
    FaSearch,
    FaClock,
    FaCheckCircle,
    FaUsers,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { MINT_GRADIENT } from '../Reports/constants';
import { canManageLearning, enrollmentStatusStyle } from './learningUtils';
import DraftAwaitingBanner from '../../components/DraftAwaitingBanner';

const MINT = '#20C997';
const MINT_DARK = '#0d9488';

const KpiStat = ({ label, value, icon: Icon, accent = MINT }) => (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
            <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
            </div>
            <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${accent}18`, color: accent }}
            >
                <Icon className="h-5 w-5" />
            </div>
        </div>
    </div>
);

const courseStatusStyle = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'published') return 'bg-emerald-100 text-emerald-700 ring-emerald-600/20';
    if (s === 'draft') return 'bg-slate-100 text-slate-600 ring-slate-500/20';
    if (s === 'archived') return 'bg-amber-100 text-amber-700 ring-amber-600/20';
    return 'bg-slate-100 text-slate-600 ring-slate-500/20';
};

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

    const fetchAll = async () => {
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
        } catch (error) {
            setCourses([]);
            setEnrollments([]);
            toast.error(error.response?.data?.message || 'Failed to load learning data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, [isManagerUser]);

    const stats = useMemo(() => {
        const published = courses.filter((c) => (c.status || '').toLowerCase() === 'published').length;
        const totalHours = courses.reduce((sum, c) => sum + (Number(c.duration) || 0), 0);
        const completed = enrollments.filter((e) => e.status === 'Completed').length;
        return {
            totalCourses: courses.length,
            published,
            enrollments: enrollments.length,
            completed,
            totalHours,
        };
    }, [courses, enrollments]);

    const draftCourseCount = useMemo(
        () => courses.filter((c) => c.status === 'Draft').length,
        [courses]
    );

    const filteredCourses = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return courses;
        return courses.filter((course) => {
            const haystack = [course.title, course.category, course.description, course.status, course.level]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [courses, searchQuery]);

    const filteredEnrollments = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return enrollments;
        return enrollments.filter((e) => {
            const haystack = [
                e.courseId?.title,
                e.employeeId?.name,
                e.employeeId?.lastName,
                e.status,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [enrollments, searchQuery]);

    if (loading) {
        return (
            <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-[#F5F7FB]">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-transparent border-t-[#20C997] border-r-[#20C997]" />
                    <p className="text-sm font-medium text-slate-600">Loading learning data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-shell min-h-[calc(100vh-64px)] bg-[#F5F7FB]">
            <div className="page-shell-inner hrms-stack">
                {/* Header */}
                <header className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-4">
                            <div
                                className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md"
                                style={{ background: MINT_GRADIENT }}
                            >
                                <FaGraduationCap className="h-7 w-7" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                    HR Workspace
                                </p>
                                <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
                                    Learning & Development
                                </h1>
                                <p className="mt-0.5 text-sm text-slate-500">
                                    Manage training courses and employee development
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <label className="relative block min-w-[240px] flex-1 sm:max-w-sm">
                                <FaSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={
                                        activeTab === 'courses'
                                            ? 'Search courses...'
                                            : 'Search enrollments...'
                                    }
                                    className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-[#20C997] focus:bg-white focus:ring-2 focus:ring-[#20C997]/20"
                                />
                            </label>
                            {isManagerUser && (
                                <button
                                    type="button"
                                    onClick={() => navigate('/learning/create-course')}
                                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-white shadow-md transition hover:opacity-95"
                                    style={{ background: MINT_GRADIENT }}
                                >
                                    <FaPlus className="h-5 w-5" />
                                    Create Course
                                </button>
                            )}
                        </div>
                    </div>
                </header>

                {/* KPIs */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <KpiStat label="Total Courses" value={stats.totalCourses} icon={FaBook} accent={MINT} />
                    <KpiStat
                        label="Published"
                        value={stats.published}
                        icon={FaCheckCircle}
                        accent="#10b981"
                    />
                    <KpiStat
                        label="Enrollments"
                        value={stats.enrollments}
                        icon={FaUsers}
                        accent={MINT_DARK}
                    />
                    <KpiStat
                        label="Training Hours"
                        value={stats.totalHours}
                        icon={FaClock}
                        accent="#8b5cf6"
                    />
                </div>

                {/* Tabs */}
                <div className="rounded-2xl border border-slate-100 bg-white p-2 shadow-sm">
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab('courses')}
                            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                                activeTab === 'courses'
                                    ? 'bg-[#20C997]/10 text-[#0d9488] ring-1 ring-[#20C997]/30'
                                    : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <FaBook className="h-4 w-4" />
                            Courses ({courses.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('enrollments')}
                            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                                activeTab === 'enrollments'
                                    ? 'bg-[#20C997]/10 text-[#0d9488] ring-1 ring-[#20C997]/30'
                                    : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <FaGraduationCap className="h-4 w-4" />
                            Enrollments ({enrollments.length})
                        </button>
                    </div>
                </div>

                {/* Content */}
                <section className="rounded-[28px] border border-slate-100 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-5 py-4 md:px-6">
                        <h2 className="text-lg font-semibold text-slate-900">
                            {activeTab === 'courses'
                                ? `Courses (${filteredCourses.length})`
                                : `Enrollments (${filteredEnrollments.length})`}
                        </h2>
                        <p className="text-sm text-slate-500">
                            {activeTab === 'courses'
                                ? 'Browse and manage training programs'
                                : `${stats.completed} completed enrollments`}
                        </p>
                    </div>

                    <div className="p-5 md:p-6">
                        {activeTab === 'courses' ? (
                            <>
                            <DraftAwaitingBanner count={draftCourseCount} entityLabel="course" />
                            {filteredCourses.length === 0 ? (
                                <div className="py-16 text-center">
                                    <div
                                        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                                        style={{ background: `${MINT}20` }}
                                    >
                                        <FaBook className="h-8 w-8" style={{ color: MINT }} />
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
                                            className="mt-6 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white"
                                            style={{ background: MINT_GRADIENT }}
                                        >
                                            <FaPlus className="h-4 w-4" />
                                            Create Course
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                                    {filteredCourses.map((course) => (
                                        <article
                                            key={course._id}
                                            className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50 transition hover:border-[#20C997]/30 hover:shadow-md"
                                        >
                                            <div className="border-b border-slate-100 bg-white p-5">
                                                <div className="flex items-start gap-3">
                                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#20C997]/10">
                                                        <FaBook className="h-6 w-6 text-[#0d9488]" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="truncate text-lg font-semibold text-slate-900">
                                                            {course.title}
                                                        </h3>
                                                        <p className="text-sm text-slate-500">{course.category}</p>
                                                        {course.level && (
                                                            <p className="mt-0.5 text-xs text-slate-400">
                                                                {course.level}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                                                    {course.description || 'No description provided.'}
                                                </p>
                                                <div className="mt-4 flex items-center justify-between gap-2">
                                                    <span className="inline-flex items-center gap-1 text-sm text-slate-500">
                                                        <FaClock className="h-3.5 w-3.5" />
                                                        {course.duration || 0} hours
                                                    </span>
                                                    <span
                                                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${courseStatusStyle(course.status)}`}
                                                    >
                                                        {course.status || 'Draft'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="mt-auto space-y-2 p-4">
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/learning/courses/${course._id}`)}
                                                    className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
                                                    style={{ background: MINT_GRADIENT }}
                                                >
                                                    View Course
                                                </button>
                                                {isManagerUser && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            navigate(`/learning/edit-course/${course._id}`)
                                                        }
                                                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#20C997] py-2.5 text-sm font-semibold text-[#0d9488] transition hover:bg-[#20C997]/10"
                                                    >
                                                        <FaEdit className="h-4 w-4" />
                                                        Edit Course
                                                    </button>
                                                )}
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )}
                            </>
                        ) : filteredEnrollments.length === 0 ? (
                            <div className="py-16 text-center">
                                <div
                                    className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                                    style={{ background: `${MINT}20` }}
                                >
                                    <FaGraduationCap className="h-8 w-8" style={{ color: MINT }} />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-900">No enrollments yet</h3>
                                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                                    {searchQuery
                                        ? 'Try a different search term.'
                                        : 'Enrollments will appear when employees join courses.'}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-100">
                                <table className="w-full min-w-[640px] text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/80">
                                            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                Course
                                            </th>
                                            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                Employee
                                            </th>
                                            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                Progress
                                            </th>
                                            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredEnrollments.map((enrollment) => {
                                            const progress = enrollment.progress || 0;
                                            const emp = enrollment.employeeId || {};
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
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-2 flex-1 max-w-[120px] overflow-hidden rounded-full bg-slate-100">
                                                                <div
                                                                    className="h-full rounded-full bg-[#20C997] transition-all"
                                                                    style={{ width: `${progress}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs font-medium text-slate-600">
                                                                {progress}%
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <span
                                                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${enrollmentStatusStyle(enrollment.status)}`}
                                                        >
                                                            {enrollment.status || '—'}
                                                        </span>
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
            </div>
        </div>
    );
};

export default LearningPage;
