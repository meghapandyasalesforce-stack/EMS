import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    FaArrowLeft,
    FaBook,
    FaCheckCircle,
    FaClock,
    FaMedal,
    FaPlayCircle,
    FaExternalLinkAlt,
    FaEdit,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
    canManageLearning,
    externalResourceLabel,
    isEnrollmentOverdue,
    isExternalCourse,
    parseYouTubeResource
} from '../../HR/Learning/learningUtils';
import YouTubeProgressPlayer from './YouTubeProgressPlayer';
import CertificateModal from './CertificateModal';

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
    const [livePercent, setLivePercent] = useState(null);
    const [certificate, setCertificate] = useState(null);
    const [certificateLoading, setCertificateLoading] = useState(false);

    const enrollmentRef = useRef(null);
    enrollmentRef.current = enrollment;
    const lastSavedProgressRef = useRef({});
    const lastSaveAtRef = useRef(0);

    useEffect(() => {
        lastSavedProgressRef.current = { overall: Number(enrollmentRef.current?.progress || 0) };
        setLivePercent(null);
    }, [enrollment?._id]);

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
                        return null;
                    }
                    setCourse(foundCourse);
                    setEnrollment(null);
                    return null;
                }

                const [coursesRes, enrollmentsRes] = await Promise.all([
                    axios.get('/v1/both/learning/courses?limit=100', { withCredentials: true }),
                    axios.get('/v1/both/learning/enrollments', { withCredentials: true }),
                ]);

                const allCourses = coursesRes.data?.data || [];
                const allEnrollments = enrollmentsRes.data?.data || [];
                const existingEnrollment = allEnrollments.find((item) => {
                    const enrolledCourseId = item.courseId?._id || item.courseId;
                    return String(enrolledCourseId) === String(courseId);
                });

                // Assigned courses may sit outside the paginated catalog response.
                const foundCourse =
                    allCourses.find((item) => String(item._id) === String(courseId)) ||
                    (existingEnrollment?.courseId && typeof existingEnrollment.courseId === 'object'
                        ? existingEnrollment.courseId
                        : null);

                if (!foundCourse) {
                    setCourse(null);
                    setEnrollment(null);
                    return null;
                }
                setCourse(foundCourse);
                setEnrollment(existingEnrollment || null);
                return existingEnrollment || null;
            } catch (error) {
                setCourse(null);
                setEnrollment(null);
                if (showErrorToast) {
                    toast.error(error.response?.data?.message || 'Failed to load course details');
                }
                return null;
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

    const watchedPlaylistItems = useMemo(
        () => enrollment?.playlistProgress?.items || [],
        [enrollment?.playlistProgress]
    );

    const displayProgress = useMemo(
        () => Math.max(progress, Number.isFinite(livePercent) ? livePercent : 0),
        [progress, livePercent]
    );

    const canEnroll =
        !isPreviewMode &&
        course &&
        (course.status || '').toLowerCase() === 'published' &&
        course.enrollmentType !== 'Assigned Only';
    const externalCourse = isExternalCourse(course);
    const youTubeResource = useMemo(() => {
        if (course?.resourceType !== 'YOUTUBE' && course?.resourceType !== 'YOUTUBE_PLAYLIST') {
            return null;
        }

        const parsed = parseYouTubeResource(course?.externalUrl);
        if (!parsed) return null;

        // A playlist link saved under the single-video type still has to play as a playlist.
        const playAsPlaylist =
            Boolean(parsed.playlistId) &&
            (course.resourceType === 'YOUTUBE_PLAYLIST' || !parsed.videoId);

        return {
            videoId: parsed.videoId,
            playlistId: playAsPlaylist ? parsed.playlistId : null
        };
    }, [course?.resourceType, course?.externalUrl]);

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

    const openCertificate = useCallback(
        async (enrollmentId, { silent = false } = {}) => {
            const targetId = enrollmentId || enrollmentRef.current?._id;
            if (!targetId) return;
            try {
                setCertificateLoading(true);
                const res = await axios.get(
                    `/v1/both/learning/enrollments/${targetId}/certificate`,
                    { withCredentials: true }
                );
                if (res.data?.data) setCertificate(res.data.data);
            } catch (error) {
                if (!silent) {
                    toast.error(error.response?.data?.message || 'Failed to load certificate');
                }
            } finally {
                setCertificateLoading(false);
            }
        },
        []
    );

    const handleExternalStatus = async (action) => {
        if (!enrollment?._id) {
            toast.info('This course must be assigned or enrolled before it can be started.');
            return;
        }
        try {
            setSubmitting(true);
            await axios.post(
                `/v1/both/learning/enrollments/${enrollment._id}/${action}`,
                {},
                { withCredentials: true }
            );
            toast.success(action === 'start' ? 'Learning started' : 'Course marked as completed');
            await fetchCourseData(false);

            if (action === 'complete' && course?.certificate?.enabled) {
                await openCertificate(enrollment._id, { silent: true });
            }
        } catch (error) {
            toast.error(error.response?.data?.message || `Failed to ${action} learning`);
        } finally {
            setSubmitting(false);
        }
    };

    const persistAutoProgress = useCallback(async (percent, { flush = false, item } = {}) => {
        const activeEnrollment = enrollmentRef.current;
        if (!activeEnrollment?._id || activeEnrollment.status === 'Completed') return;

        // Playlists advance per video, so throttle against that video rather than the total,
        // otherwise a freshly opened page never beats the stored overall figure.
        const key = item ? `item-${item.index}` : 'overall';
        const value = item ? item.percent : percent;
        const previousSaved = lastSavedProgressRef.current[key] || 0;
        if (value <= previousSaved) return;

        const now = Date.now();
        if (!flush && value - previousSaved < 5 && now - lastSaveAtRef.current < 20000) return;

        lastSavedProgressRef.current[key] = value;
        lastSaveAtRef.current = now;
        try {
            const res = await axios.patch(
                `/v1/both/learning/enrollments/${activeEnrollment._id}/progress`,
                { progress: percent, source: 'auto', playlistItem: item },
                { withCredentials: true }
            );
            const updated = res.data?.data;
            if (updated) {
                setEnrollment((prev) =>
                    prev
                        ? {
                            ...prev,
                            progress: updated.progress,
                            status: updated.status,
                            playlistProgress: updated.playlistProgress
                        }
                        : prev
                );
            }
        } catch {
            lastSavedProgressRef.current[key] = previousSaved;
        }
    }, []);

    const handleAutoProgress = useCallback(
        (percent, options) => {
            setLivePercent(percent);
            persistAutoProgress(percent, options);
        },
        [persistAutoProgress]
    );

    const handleExternalProgress = async (value) => {
        if (!enrollment?._id) {
            toast.info('This course must be assigned or enrolled before you can log progress.');
            return;
        }
        try {
            setSubmitting(true);
            await axios.patch(
                `/v1/both/learning/enrollments/${enrollment._id}/progress`,
                { progress: value },
                { withCredentials: true }
            );
            toast.success(value >= 100 ? 'Course marked as completed' : `Progress saved at ${value}%`);
            const refreshed = await fetchCourseData(false);

            if (refreshed?.status === 'Completed' && course?.certificate?.enabled) {
                await openCertificate(refreshed._id, { silent: true });
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update progress');
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenExternal = () => {
        const url = normalizeUrl(course?.externalUrl);
        if (!url) {
            toast.info('No external course URL is available.');
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
            const refreshed = await fetchCourseData(false);

            if (refreshed?.status === 'Completed' && course?.certificate?.enabled) {
                await openCertificate(enrollment._id, { silent: true });
            }
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to update module progress';
            toast.error(message);
        } finally {
            setUpdatingModuleId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-slate-50">
                <LoadingSpinner message="Loading course details..." />
            </div>
        );
    }

    if (!course) {
        return (
            <div className="page-shell min-h-[calc(100vh-64px)] bg-[#F3F7F5]">
                <div className="page-shell-inner">
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <p className="text-lg font-semibold text-slate-900">Course not found</p>
                    <p className="mt-2 text-sm text-slate-600">
                        This course may be unavailable or archived.
                    </p>
                    <button
                        type="button"
                        onClick={() => navigate('/learning')}
                        className="mt-4 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        Back to Learning
                    </button>
                </div>
                </div>
            </div>
        );
    }

    const courseStatus = course.status || 'Draft';

    return (
        <div className="page-shell min-h-[calc(100vh-64px)] bg-[#F3F7F5]">
            <div className="page-shell-inner space-y-4">
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 p-4 sm:p-5">
                        <button
                            type="button"
                            onClick={() => navigate('/learning')}
                            className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-theme-primary"
                        >
                            <FaArrowLeft className="h-3 w-3" />
                            Learning
                        </button>
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-theme-primary/10 text-theme-primary sm:h-12 sm:w-12">
                                <FaBook className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-lg font-bold text-slate-900 sm:text-2xl">{course.title}</h1>
                                {course.description ? (
                                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{course.description}</p>
                                ) : null}
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {course.category && (
                                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                                            {course.category}
                                        </span>
                                    )}
                                    <span
                                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                            courseStatus === 'Published'
                                                ? 'bg-emerald-50 text-emerald-700'
                                                : courseStatus === 'Archived'
                                                  ? 'bg-amber-50 text-amber-700'
                                                  : 'bg-slate-100 text-slate-600'
                                        }`}
                                    >
                                        {courseStatus}
                                    </span>
                                    {course.isMandatory && (
                                        <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
                                            Mandatory
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4 sm:gap-3 sm:p-5">
                        <div className="rounded-xl bg-slate-50 px-3 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Level</p>
                            <p className="mt-0.5 text-sm font-semibold text-slate-900">{course.level || 'Beginner'}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-3 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Duration</p>
                            <p className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-slate-900">
                                <FaClock className="text-[11px] text-slate-400" /> {course.duration || 0}h
                            </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-3 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                {isPreviewMode ? 'Status' : 'Your status'}
                            </p>
                            <p className="mt-0.5 text-sm font-semibold text-slate-900">
                                {isPreviewMode ? courseStatus : enrollment?.status || 'Not enrolled'}
                            </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-3 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Provider</p>
                            <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                                {course.provider || (externalCourse ? externalResourceLabel(course.resourceType) : 'Internal')}
                            </p>
                        </div>
                    </div>

                    {!isPreviewMode && !externalCourse && (
                        <div className="px-4 pb-2 sm:px-5">
                            <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                                <span>Progress</span>
                                <span className="font-semibold text-theme-primary">{progress}%</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-100">
                                <div
                                    className="h-2 rounded-full bg-theme-primary transition-all"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {!isPreviewMode && enrollment?.dueDate && (
                        <p className={`px-4 text-xs font-semibold sm:px-5 ${isEnrollmentOverdue(enrollment) ? 'text-red-600' : 'text-slate-500'}`}>
                            {isEnrollmentOverdue(enrollment) ? 'Overdue' : 'Due'} {new Date(enrollment.dueDate).toLocaleDateString()}
                        </p>
                    )}

                    {!isPreviewMode &&
                        enrollment?.status === 'Completed' &&
                        course.certificate?.enabled && (
                            <div className="mx-4 mb-4 mt-3 flex flex-col gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 sm:mx-5 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-emerald-800">Your certificate is ready</p>
                                    <p className="text-xs text-emerald-700">Issued for completing {course.title}.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => openCertificate(enrollment._id)}
                                    disabled={certificateLoading}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                                >
                                    <FaMedal />
                                    {certificateLoading ? 'Opening...' : 'View Certificate'}
                                </button>
                            </div>
                        )}

                    <div className="flex flex-col gap-2 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                        {isPreviewMode ? (
                            <>
                                <p className="text-xs text-slate-500 sm:text-sm">
                                    HR preview — employees enroll when this course is published.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => navigate(`/learning/edit-course/${course._id}`)}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-theme-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                                >
                                    <FaEdit className="h-3.5 w-3.5" />
                                    Edit Course
                                </button>
                            </>
                        ) : !enrollment ? (
                            <button
                                type="button"
                                onClick={handleEnroll}
                                disabled={submitting || !canEnroll}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-theme-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 sm:w-auto"
                            >
                                <FaPlayCircle />
                                {submitting
                                    ? 'Enrolling...'
                                    : canEnroll
                                      ? externalCourse ? 'Enroll' : 'Enroll & Start'
                                      : 'Not available'}
                            </button>
                        ) : (
                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                                <FaCheckCircle /> You are enrolled
                            </span>
                        )}
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                        {externalCourse ? 'Learning resource' : 'Course content'}
                    </h2>
                    {externalCourse ? (
                        <div className="mt-3">
                            <p className="text-sm text-slate-600">
                                Hosted by {course.provider || 'an external provider'}.
                                {youTubeResource
                                    ? ' Watch below to track progress automatically.'
                                    : ' Log how far you have reached so your manager can see progress.'}
                            </p>

                            {youTubeResource && (enrollment || isPreviewMode) && (
                                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-black">
                                    <YouTubeProgressPlayer
                                        videoId={youTubeResource.videoId}
                                        playlistId={youTubeResource.playlistId}
                                        watchedItems={watchedPlaylistItems}
                                        onProgress={isPreviewMode ? undefined : handleAutoProgress}
                                        onComplete={
                                            isPreviewMode ? undefined : () => handleExternalStatus('complete')
                                        }
                                    />
                                </div>
                            )}

                            {!isPreviewMode && enrollment && (
                                <div className="mt-4 rounded-xl bg-slate-50 p-3 sm:p-4">
                                    <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500">
                                        <span>Your progress</span>
                                        <span className="text-theme-primary">{displayProgress}%</span>
                                    </div>
                                    <div className="h-2 w-full rounded-full bg-slate-200">
                                        <div
                                            className="h-2 rounded-full bg-theme-primary transition-all"
                                            style={{ width: `${displayProgress}%` }}
                                        />
                                    </div>
                                    {youTubeResource ? (
                                        <p className="mt-2 text-xs text-slate-400">
                                            Updates automatically as you watch.
                                        </p>
                                    ) : (
                                        enrollment.status !== 'Completed' && (
                                            <div className="mt-3 flex flex-wrap gap-1.5">
                                                {[10, 25, 50, 75, 100].map((value) => (
                                                    <button
                                                        key={value}
                                                        type="button"
                                                        onClick={() => handleExternalProgress(value)}
                                                        disabled={submitting}
                                                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-theme-primary hover:text-theme-primary disabled:opacity-60"
                                                    >
                                                        {value}%
                                                    </button>
                                                ))}
                                            </div>
                                        )
                                    )}
                                </div>
                            )}
                            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                {isPreviewMode ? (
                                    <button
                                        type="button"
                                        onClick={handleOpenExternal}
                                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        <FaExternalLinkAlt /> Open resource
                                    </button>
                                ) : enrollment?.status === 'Completed' ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleOpenExternal}
                                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                            <FaExternalLinkAlt /> Open again
                                        </button>
                                        <span className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                                            <FaCheckCircle /> Completed
                                        </span>
                                    </>
                                ) : enrollment?.status === 'In Progress' ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleOpenExternal}
                                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-theme-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                                        >
                                            <FaExternalLinkAlt /> Continue
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleExternalStatus('complete')}
                                            disabled={submitting}
                                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-theme-primary px-4 py-2 text-sm font-semibold text-theme-primary disabled:opacity-60"
                                        >
                                            <FaCheckCircle /> Mark complete
                                        </button>
                                    </>
                                ) : enrollment ? (
                                    <button
                                        type="button"
                                        onClick={() => handleExternalStatus('start')}
                                        disabled={submitting}
                                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-theme-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                                    >
                                        <FaPlayCircle /> {submitting ? 'Starting...' : 'Start learning'}
                                    </button>
                                ) : (
                                    <p className="text-sm text-slate-500">Enroll to begin this course.</p>
                                )}
                            </div>
                        </div>
                    ) : !course.content || course.content.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-500">No modules available yet.</p>
                    ) : (
                        <ul className="mt-3 space-y-2">
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
                                            className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-slate-900">
                                                        {idx + 1}. {module.moduleTitle || `Module ${idx + 1}`}
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
                                                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                            isCompleted
                                                                ? 'bg-emerald-50 text-emerald-700'
                                                                : 'bg-white text-slate-500'
                                                        }`}
                                                    >
                                                        {isCompleted ? 'Done' : 'Pending'}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenModule(module)}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                >
                                                    <FaExternalLinkAlt className="text-[10px]" />
                                                    Open
                                                </button>
                                                {enrollment && !isPreviewMode ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMarkModuleComplete(module, idx)}
                                                        disabled={isCompleted || isUpdating}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-theme-primary/40 bg-white px-3 py-1.5 text-xs font-semibold text-theme-primary disabled:opacity-60"
                                                    >
                                                        <FaCheckCircle className="text-[11px]" />
                                                        {isUpdating
                                                            ? 'Updating...'
                                                            : isCompleted
                                                              ? 'Completed'
                                                              : 'Mark complete'}
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

            <CertificateModal
                certificate={certificate}
                enrollmentId={enrollment?._id}
                onClose={() => setCertificate(null)}
            />
        </div>
    );
};

export default CourseDetailsPage;
