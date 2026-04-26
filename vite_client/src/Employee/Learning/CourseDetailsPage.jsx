import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaBook, FaCheckCircle, FaClock, FaPlayCircle, FaExternalLinkAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';

const CourseDetailsPage = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [updatingModuleId, setUpdatingModuleId] = useState(null);
    const [course, setCourse] = useState(null);
    const [enrollment, setEnrollment] = useState(null);

    const fetchCourseData = async (showErrorToast = true) => {
        try {
            const [coursesRes, enrollmentsRes] = await Promise.all([
                axios.get('/v1/both/learning/courses', { withCredentials: true }),
                axios.get('/v1/both/learning/enrollments', { withCredentials: true })
            ]);

            const allCourses = coursesRes.data?.data || [];
            const foundCourse = allCourses.find((item) => String(item._id) === String(courseId));
            if (!foundCourse) {
                setCourse(null);
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
            if (showErrorToast) {
                toast.error('Failed to load course details');
            }
        }
    };

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
    }, [courseId]);

    const progress = useMemo(() => {
        const raw = Number(enrollment?.progress || 0);
        if (!Number.isFinite(raw)) return 0;
        return Math.max(0, Math.min(100, Math.round(raw)));
    }, [enrollment?.progress]);

    const handleEnroll = async () => {
        if (!course?._id) return;
        try {
            setSubmitting(true);
            const res = await axios.post(
                `/v1/both/learning/courses/${course._id}/enroll`,
                {},
                { withCredentials: true }
            );
            setEnrollment(res.data?.data || { status: 'Enrolled', progress: 0, courseId: course._id, completedModules: [] });
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
        return <LoadingSpinner message="Loading course details..." />;
    }

    if (!course) {
        return (
            <div className="min-h-screen bg-[#F4F6FB] p-4 sm:p-6">
                <div className="mx-auto max-w-4xl rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm">
                    <p className="text-lg font-semibold text-slate-900">Course not found</p>
                    <p className="mt-2 text-sm text-slate-600">This course may be unavailable or archived.</p>
                    <button
                        type="button"
                        onClick={() => navigate('/learning')}
                        className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                        Back to Learning
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F4F6FB] p-4 sm:p-6">
            <div className="mx-auto max-w-4xl space-y-5">
                <button
                    type="button"
                    onClick={() => navigate('/learning')}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                >
                    <FaArrowLeft className="text-xs" /> Back
                </button>

                <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                            <h1 className="text-2xl font-semibold text-slate-900">{course.title}</h1>
                            <p className="mt-1 text-sm text-slate-600">{course.description}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                            {course.category}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Level</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{course.level || 'Beginner'}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Duration</p>
                            <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-slate-900">
                                <FaClock className="text-[11px] text-slate-500" /> {course.duration || 0} hours
                            </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{enrollment?.status || 'Not Enrolled'}</p>
                        </div>
                    </div>

                    <div className="mt-5">
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                            <span>Progress</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100">
                            <div className="h-2 rounded-full bg-gradient-to-r from-[#20C997] to-[#0a8f6c]" style={{ width: `${progress}%` }} />
                        </div>
                    </div>

                    <div className="mt-5">
                        {!enrollment ? (
                            <button
                                type="button"
                                onClick={handleEnroll}
                                disabled={submitting}
                                className="inline-flex items-center gap-2 rounded-lg bg-[#0a8f6c] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                <FaPlayCircle /> {submitting ? 'Enrolling...' : 'Enroll & Start'}
                            </button>
                        ) : (
                            <div className="inline-flex items-center gap-2 rounded-lg bg-[#ECFDF5] px-3 py-2 text-sm font-semibold text-[#0a8f6c]">
                                <FaCheckCircle /> You are enrolled
                            </div>
                        )}
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-lg font-semibold text-slate-900">Course Content</h2>
                    {!course.content || course.content.length === 0 ? (
                        <p className="text-sm text-slate-500">No modules available yet.</p>
                    ) : (
                        <ul className="space-y-2">
                            {course.content
                                .slice()
                                .sort((a, b) => (a.order || 0) - (b.order || 0))
                                .map((module, idx) => (
                                    (() => {
                                        const moduleKey = String(module?._id || `${courseId}-module-${idx}`);
                                        const isCompleted = completedModuleIds.has(moduleKey);
                                        const isUpdating = updatingModuleId === moduleKey;
                                        return (
                                            <li key={`${module.moduleTitle || 'module'}-${idx}`} className="rounded-lg border border-slate-100 p-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-slate-900">{module.moduleTitle || `Module ${idx + 1}`}</p>
                                                        {module.moduleDescription ? (
                                                            <p className="mt-1 text-xs text-slate-600">{module.moduleDescription}</p>
                                                        ) : null}
                                                        <p className="mt-1 text-[11px] text-slate-500">
                                                            {module.contentType || 'Content'} {module.duration ? `• ${module.duration} mins` : ''}
                                                        </p>
                                                    </div>
                                                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
                                                        isCompleted ? 'bg-[#ECFDF5] text-[#0a8f6c]' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        {isCompleted ? 'Completed' : 'Pending'}
                                                    </span>
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
                                                    {enrollment ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleMarkModuleComplete(module, idx)}
                                                            disabled={isCompleted || isUpdating}
                                                            className="inline-flex items-center gap-1 rounded-lg border border-[#20C997]/40 px-3 py-1.5 text-xs font-semibold text-[#0a8f6c] hover:bg-[#20C997]/10 disabled:cursor-not-allowed disabled:opacity-60"
                                                        >
                                                            <FaCheckCircle className="text-[11px]" />
                                                            {isUpdating ? 'Updating...' : isCompleted ? 'Completed' : 'Mark Complete'}
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </li>
                                        );
                                    })()
                                ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
};

export default CourseDetailsPage;
