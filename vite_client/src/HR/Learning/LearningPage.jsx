import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    FaUserPlus,
    FaTimes,
    FaMedal,
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
import { UI_FORM_LABEL_CLASS, UI_TABLE_HEADING_CLASS } from '../../utils/textFormat.js';
import DraftAwaitingBanner from '../../components/DraftAwaitingBanner';
import CertificateModal from '../../Employee/Learning/CertificateModal';

const MINT_DARK = '#0d9488';

const KpiStat = ({ label, value, icon, tint }) => (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${tint}`}>
            {React.createElement(icon)}
        </div>
        <div className="min-w-0">
            <p className={UI_FORM_LABEL_CLASS}>{label}</p>
            <p className="text-2xl font-bold leading-tight text-slate-900">{value}</p>
        </div>
    </div>
);

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
            <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-transparent">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-transparent border-t-[#0E9370] border-r-[#0E9370]" />
                    <p className="text-sm font-medium text-slate-600">Loading learning data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-shell min-h-[calc(100vh-64px)] bg-transparent">
            <div className="page-shell-inner hrms-stack">
                <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-theme-primary/10 text-xl text-theme-primary">
                                <FaGraduationCap />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                                    Learning & Development
                                </h1>
                                <p className="mt-1 text-sm text-slate-500">
                                    Manage the course catalog, assignments, and completion tracking
                                </p>
                            </div>
                        </div>
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                            <label className="relative block min-w-[220px] flex-1 sm:w-72">
                                <FaSearch className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={
                                        activeTab === 'courses'
                                            ? 'Search courses...'
                                            : 'Search enrollments...'
                                    }
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-theme-primary focus:bg-white focus:ring-2 focus:ring-theme-primary/20"
                                />
                            </label>
                            {isManagerUser && (
                                <button
                                    type="button"
                                    onClick={() => navigate('/learning/create-course')}
                                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-theme-primary px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                                >
                                    <FaPlus className="h-3.5 w-3.5" />
                                    Create Course
                                </button>
                            )}
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                    <KpiStat label="Total Courses" value={stats.totalCourses} icon={FaBook} tint="bg-slate-100 text-slate-600" />
                    <KpiStat
                        label="Published"
                        value={stats.published}
                        icon={FaCheckCircle}
                        tint="bg-emerald-50 text-emerald-600"
                    />
                    <KpiStat
                        label="Enrollments"
                        value={stats.enrollments}
                        icon={FaUsers}
                        tint="bg-teal-50 text-teal-700"
                    />
                    <KpiStat
                        label="Training Hours"
                        value={stats.totalHours}
                        icon={FaClock}
                        tint="bg-violet-50 text-violet-600"
                    />
                </div>

                <section className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-slate-900">
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
                        <div className="flex w-full rounded-xl bg-slate-100 p-1 sm:w-auto">
                            <button
                                type="button"
                                onClick={() => setActiveTab('courses')}
                                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition sm:flex-none sm:px-4 ${
                                    activeTab === 'courses'
                                        ? 'bg-theme-primary text-white shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <FaBook className="h-3.5 w-3.5" />
                                Courses
                                <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                                    activeTab === 'courses' ? 'bg-white/20 text-white' : 'bg-white text-slate-500'
                                }`}>{courses.length}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('enrollments')}
                                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition sm:flex-none sm:px-4 ${
                                    activeTab === 'enrollments'
                                        ? 'bg-theme-primary text-white shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <FaGraduationCap className="h-3.5 w-3.5" />
                                Enrollments
                                <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                                    activeTab === 'enrollments' ? 'bg-white/20 text-white' : 'bg-white text-slate-500'
                                }`}>{enrollments.length}</span>
                            </button>
                        </div>
                    </div>

                    <div className="min-w-0 max-w-full p-5 md:p-6">
                        {activeTab === 'courses' ? (
                            <>
                            <DraftAwaitingBanner count={draftCourseCount} entityLabel="course" />
                            {filteredCourses.length === 0 ? (
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
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                                    {filteredCourses.map((course) => (
                                        <article
                                            key={course._id}
                                            className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-theme-primary/30 hover:shadow-md"
                                        >
                                            <div className="flex flex-1 flex-col p-5">
                                                <div className="flex items-start gap-3">
                                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-theme-primary/10 text-theme-primary">
                                                        <FaBook />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="truncate text-base font-semibold text-slate-900">
                                                            {course.title}
                                                        </h3>
                                                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                            {course.category && (
                                                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                                                    {course.category}
                                                                </span>
                                                            )}
                                                            {course.level && (
                                                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                                                                    {course.level}
                                                                </span>
                                                            )}
                                                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${courseStatusStyle(course.status)}`}>
                                                                {formatCourseStatusLabel(course.status || 'Draft')}
                                                            </span>
                                                        </div>
                                                        {isExternalCourse(course) && (
                                                            <p className="mt-1 text-xs font-medium text-theme-primary">
                                                                {course.provider || externalResourceLabel(course.resourceType)}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                                                    {course.description || 'No description provided.'}
                                                </p>
                                                <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                                    <FaClock className="h-3 w-3" />
                                                    {course.duration || 0} hours
                                                    {course.isMandatory ? ' • Mandatory' : ''}
                                                </p>
                                            </div>
                                            <div className="mt-auto grid gap-2 border-t border-slate-100 p-4">
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/learning/courses/${course._id}`)}
                                                    className="w-full rounded-xl bg-theme-primary py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                                                >
                                                    View Course
                                                </button>
                                                {isManagerUser && (
                                                    <div className={`grid gap-2 ${course.status === 'Published' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                                        {course.status === 'Published' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openAssignment(course)}
                                                                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-theme-primary bg-theme-primary/10 py-2 text-sm font-semibold text-theme-primary transition hover:bg-theme-primary hover:text-white"
                                                            >
                                                                <FaUserPlus className="h-3.5 w-3.5" />
                                                                Assign
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                navigate(`/learning/edit-course/${course._id}`)
                                                            }
                                                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                                        >
                                                            <FaEdit className="h-3.5 w-3.5" />
                                                            Edit
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )}
                            </>
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
                {assignmentCourse && (
                    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
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
                    </div>
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
