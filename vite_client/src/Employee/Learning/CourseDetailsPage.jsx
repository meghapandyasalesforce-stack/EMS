import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    FaArrowLeft,
    FaBook,
    FaCheckCircle,
    FaClock,
    FaPlayCircle,
    FaExternalLinkAlt,
    FaEdit,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { MINT_GRADIENT } from '../../HR/Reports/constants';
import { canManageLearning } from '../../HR/Learning/learningUtils';

const CourseDetailsPage = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);

    const isPreviewMode = useMemo(() => canManageLearning(user, employee), [user, employee]);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [updatingModuleId, setUpdatingModuleId] = useState(null);
    const [course, setCourse] = useState(null);
    const [enrollment, setEnrollment] = useState(null);

    const fetchCourseData = useCallback(
        async (showErrorToast = true) => {
            try {
                if (isPreviewMode) {
                    const courseRes = await axios.get(`/v1/admin/learning/courses/${courseId}`, {
                        withCredentials: true,
                    });
                    const foundCourse = courseRes.data?.data;
                    if (!foundCourse) {
                        setCourse(null);
                        setEnrollment(null);
                        return;
                    }
                    setCourse(foundCourse);
                    setEnrollment(null);
                    return;
                }

                const [coursesRes, enrollmentsRes] = await Promise.all([
                    axios.get('/v1/both/learning/courses?limit=100', { withCredentials: true }),
                    axios.get('/v1/both/learning/enrollments', { withCredentials: true }),
                ]);

                const allCourses = coursesRes.data?.data || [];
                const foundCourse = allCourses.find((item) => String(item._id) === String(courseId));
                if (!foundCourse) {
                    setCourse(null);
                    setEnrollment(null);
                    return;
                }
                setCourse(foundCourse);

                const allEnrollments = enrollmentsRes.data?.data || [];
                const existingEnrollment = allEnrollments.find((item) => {
                    const enrolledCourseId = item.courseId?._id || item.courseId;
                    return String(enrolledCourseId) === String(courseId);
                });
                setEnrollment(existingEnrollment || null);
            } catch (error) {
                setCourse(null);
                setEnrollment(null);
                if (showErrorToast) {
                    toast.error(error.response?.data?.message || 'Failed to load course details');
                }
            }
        },
        [courseId, isPreviewMode]
    );

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                await fetchCourseData(true);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [fetchCourseData]);

    const progress = useMemo(() => {
        const raw = Number(enrollment?.progress || 0);
        if (!Number.isFinite(raw)) return 0;
        return Math.max(0, Math.min(100, Math.round(raw)));
    }, [enrollment?.progress]);

    const canEnroll =
        !isPreviewMode && course && (course.status || '').toLowerCase() === 'published';

    const handleEnroll = async () => {
        if (!course?._id || !canEnroll) return;
        try {
            setSubmitting(true);
            const res = await axios.post(
                `/v1/both/learning/courses/${course._id}/enroll`,
                {},
                { withCredentials: true }
            );
            setEnrollment(
                res.data?.data || {
                    status: 'Enrolled',
                    progress: 0,
                    courseId: course._id,
                    completedModules: [],
                }
            );
            toast.success('Enrolled successfully');
            await fetchCourseData(false);
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to enroll in course';
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    const completedModuleIds = useMemo(() => {
        if (!Array.isArray(enrollment?.completedModules)) return new Set();
        return new Set(
            enrollment.completedModules
                .map((entry) => String(entry?.moduleId || ''))
                .filter(Boolean)
        );
    }, [enrollment?.completedModules]);

    const normalizeUrl = (url) => {
        if (!url || typeof url !== 'string') return '';
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        return `https://${url}`;
    };

    const handleOpenModule = (module) => {
        const url = normalizeUrl(module?.contentUrl);
        if (!url) {
            toast.info('No content URL available for this module yet.');
            return;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handleMarkModuleComplete = async (module, idx) => {
        if (!enrollment?._id) {
            toast.info('Please enroll in the course first.');
            return;
        }
        const moduleId = String(module?._id || `${courseId}-module-${idx}`);
        if (!moduleId) return;
        if (completedModuleIds.has(moduleId)) {
            toast.info('Module already completed.');
            return;
        }

        try {
            setUpdatingModuleId(moduleId);
            await axios.put(
                `/v1/both/learning/enrollments/${enrollment._id}/progress`,
                { moduleId, score: 100 },
                { withCredentials: true }
            );
            toast.success('Module marked complete');
            await fetchCourseData(false);
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to update module progress';
            toast.error(message);
        } finally {
            setUpdatingModuleId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-[#F5F7FB]">
                <LoadingSpinner message="Loading course details..." />
            </div>
        );
    }

    if (!course) {
        return (
            <div className="min-h-[calc(100vh-64px)] bg-[#F5F7FB] p-4 sm:p-6">
                <div className="mx-auto max-w-4xl rounded-[28px] border border-slate-100 bg-white p-8 text-center shadow-sm">
                    <p className="text-lg font-semibold text-slate-900">Course not found</p>
                    <p className="mt-2 text-sm text-slate-600">
                        This course may be unavailable or archived.
                    </p>
                    <button
                        type="button"
                        onClick={() => navigate('/learning')}
                        className="mt-4 rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        Back to Learning
                    </button>
                </div>
            </div>
        );
    }

    const courseStatus = course.status || 'Draft';

    return (
        <div className="min-h-[calc(100vh-64px)] bg-[#F5F7FB] p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-4xl space-y-5">
                <button
                    type="button"
                    onClick={() => navigate('/learning')}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                    <FaArrowLeft className="text-xs" /> Back
                </button>

                <section className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <div
                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white"
                                style={{ background: MINT_GRADIENT }}
                            >
                                <FaBook className="h-5 w-5" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">{course.title}</h1>
                                <p className="mt-1 text-sm text-slate-600">{course.description}</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                {course.category}
                            </span>
                            <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    courseStatus === 'Published'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : courseStatus === 'Archived'
                                          ? 'bg-amber-100 text-amber-700'
                                          : 'bg-slate-100 text-slate-600'
                                }`}
                            >
                                {courseStatus}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Level
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                                {course.level || 'Beginner'}
                            </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Duration
                            </p>
                            <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-slate-900">
                                <FaClock className="text-[11px] text-slate-500" /> {course.duration || 0}{' '}
                                hours
                            </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {isPreviewMode ? 'Course status' : 'Your status'}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                                {isPreviewMode
                                    ? courseStatus
                                    : enrollment?.status || 'Not Enrolled'}
                            </p>
                        </div>
                    </div>

                    {!isPreviewMode && (
                        <div className="mt-5">
                            <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                                <span>Progress</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-100">
                                <div
                                    className="h-2 rounded-full bg-[#20C997] transition-all"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="mt-5 flex flex-wrap gap-3">
                        {isPreviewMode ? (
                            <>
                                <p className="text-sm text-slate-500">
                                    HR preview — employees enroll when the course is published.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => navigate(`/learning/edit-course/${course._id}`)}
                                    className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white"
                                    style={{ background: MINT_GRADIENT }}
                                >
                                    <FaEdit className="h-4 w-4" />
                                    Edit Course
                                </button>
                            </>
                        ) : !enrollment ? (
                            <button
                                type="button"
                                onClick={handleEnroll}
                                disabled={submitting || !canEnroll}
                                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                                style={{ background: MINT_GRADIENT }}
                            >
                                <FaPlayCircle />
                                {submitting
                                    ? 'Enrolling...'
                                    : canEnroll
                                      ? 'Enroll & Start'
                                      : 'Not available for enrollment'}
                            </button>
                        ) : (
                            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                                <FaCheckCircle /> You are enrolled
                            </div>
                        )}
                    </div>
                </section>

                <section className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
                    <h2 className="mb-3 text-lg font-semibold text-slate-900">Course Content</h2>
                    {!course.content || course.content.length === 0 ? (
                        <p className="text-sm text-slate-500">No modules available yet.</p>
                    ) : (
                        <ul className="space-y-2">
                            {course.content
                                .slice()
                                .sort((a, b) => (a.order || 0) - (b.order || 0))
                                .map((module, idx) => {
                                    const moduleKey = String(module?._id || `${courseId}-module-${idx}`);
                                    const isCompleted = completedModuleIds.has(moduleKey);
                                    const isUpdating = updatingModuleId === moduleKey;
                                    return (
                                        <li
                                            key={`${module.moduleTitle || 'module'}-${idx}`}
                                            className="rounded-xl border border-slate-100 p-3"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-slate-900">
                                                        {module.moduleTitle || `Module ${idx + 1}`}
                                                    </p>
                                                    {module.moduleDescription ? (
                                                        <p className="mt-1 text-xs text-slate-600">
                                                            {module.moduleDescription}
                                                        </p>
                                                    ) : null}
                                                    <p className="mt-1 text-[11px] text-slate-500">
                                                        {module.contentType || 'Content'}
                                                        {module.duration ? ` • ${module.duration} mins` : ''}
                                                    </p>
                                                </div>
                                                {!isPreviewMode && (
                                                    <span
                                                        className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
                                                            isCompleted
                                                                ? 'bg-emerald-50 text-emerald-700'
                                                                : 'bg-slate-100 text-slate-600'
                                                        }`}
                                                    >
                                                        {isCompleted ? 'Completed' : 'Pending'}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenModule(module)}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                >
                                                    <FaExternalLinkAlt className="text-[10px]" />
                                                    Open Module
                                                </button>
                                                {enrollment && !isPreviewMode ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMarkModuleComplete(module, idx)}
                                                        disabled={isCompleted || isUpdating}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-[#20C997]/40 px-3 py-1.5 text-xs font-semibold text-[#0d9488] hover:bg-[#20C997]/10 disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                        <FaCheckCircle className="text-[11px]" />
                                                        {isUpdating
                                                            ? 'Updating...'
                                                            : isCompleted
                                                              ? 'Completed'
                                                              : 'Mark Complete'}
                                                    </button>
                                                ) : null}
                                            </div>
                                        </li>
                                    );
                                })}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
};

export default CourseDetailsPage;
