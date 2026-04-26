import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    FaSpinner
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-toastify';

const BenefitsLearningHub = () => {
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);

    const [loading, setLoading] = useState(true);
    const [benefits, setBenefits] = useState([]);
    const [teamLearning, setTeamLearning] = useState([]);
    const [courses, setCourses] = useState([]);
    const [enrollments, setEnrollments] = useState([]);

    const [activeTab, setActiveTab] = useState('benefits');
    const [search, setSearch] = useState('');
    const [learningFilter, setLearningFilter] = useState('all');
    const [updatingTeamProgressId, setUpdatingTeamProgressId] = useState(null);

    useEffect(() => {
        const fetchHubData = async () => {
            try {
                setLoading(true);
                const currentUser = user || employee;
                const currentUserId = currentUser?._id || currentUser?.id;

                const [benefitsRes, teamRes, coursesRes, enrollmentsRes] = await Promise.allSettled([
                    axios.get('/v1/both/benefits/benefit-plans', { withCredentials: true }),
                    axios.get('/v1/both/team-learning', { withCredentials: true }),
                    axios.get('/v1/both/learning/courses', { withCredentials: true }),
                    axios.get('/v1/both/learning/enrollments', { withCredentials: true })
                ]);

                if (benefitsRes.status === 'fulfilled') {
                    setBenefits(benefitsRes.value.data?.data || []);
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
                    const allEnrollments = enrollmentsRes.value.data?.data || [];
                    const myEnrollments = allEnrollments.filter((enrollment) => {
                        const enrollmentEmployeeId = enrollment.employeeId?._id || enrollment.employeeId;
                        if (!currentUserId) return true;
                        return String(enrollmentEmployeeId) === String(currentUserId);
                    });
                    setEnrollments(myEnrollments);
                }
            } catch (error) {
                toast.error('Failed to load benefits and learning data');
            } finally {
                setLoading(false);
            }
        };

        fetchHubData();
    }, [user, employee]);

    const enrollmentByCourse = useMemo(() => {
        const map = {};
        enrollments.forEach((enrollment) => {
            const courseId = enrollment.courseId?._id || enrollment.courseId;
            if (courseId) {
                map[String(courseId)] = enrollment;
            }
        });
        return map;
    }, [enrollments]);

    const filteredBenefits = useMemo(() => {
        return benefits.filter((plan) => {
            if (!plan?.isActive) return false;
            if (!search.trim()) return true;
            const text = `${plan.name || ''} ${plan.description || ''} ${plan.category || ''}`.toLowerCase();
            return text.includes(search.toLowerCase());
        });
    }, [benefits, search]);

    const learningCards = useMemo(() => {
        return courses
            .map((course) => {
                const enrollment = enrollmentByCourse[String(course._id)];
                const progress = enrollment?.progress ?? 0;
                const status = enrollment?.status || (progress > 0 ? 'In Progress' : 'Assigned');
                return {
                    ...course,
                    progress,
                    status
                };
            })
            .filter((course) => {
                if (!search.trim()) return true;
                const text = `${course.title || ''} ${course.description || ''} ${course.category || ''}`.toLowerCase();
                return text.includes(search.toLowerCase());
            })
            .filter((course) => {
                if (learningFilter === 'all') return true;
                if (learningFilter === 'assigned') return course.status === 'Assigned';
                if (learningFilter === 'in-progress') return course.status === 'In Progress';
                if (learningFilter === 'completed') return course.status === 'Completed';
                return true;
            });
    }, [courses, enrollmentByCourse, search, learningFilter]);

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
        } catch (error) {
            toast.error('Failed to update progress');
        } finally {
            setUpdatingTeamProgressId(null);
        }
    };

    if (loading) {
        return <LoadingSpinner message="Loading benefits and learning..." />;
    }

    return (
        <div className="min-h-screen bg-[#F4F6FB] p-4 sm:p-6 transition-all duration-300">
            <div className="mx-auto max-w-[1240px] space-y-6">
                <header className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Benefits & Learning</h1>
                            <p className="mt-1 text-sm text-slate-600">
                                Access your employee benefits and growth resources in one place.
                            </p>
                        </div>
                        <div className="flex gap-2 rounded-lg bg-slate-100 p-1">
                            <button
                                type="button"
                                onClick={() => setActiveTab('benefits')}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                                    activeTab === 'benefits' ? 'bg-white text-[#0a8f6c] shadow-sm' : 'text-slate-600'
                                }`}
                            >
                                Benefits
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('learning')}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                                    activeTab === 'learning' ? 'bg-white text-[#0a8f6c] shadow-sm' : 'text-slate-600'
                                }`}
                            >
                                Learning
                            </button>
                        </div>
                    </div>
                </header>

                <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2">
                        <div className="space-y-4 bg-[#d9f5ef] p-6 md:p-8">
                            <span className="inline-flex rounded-full bg-[#20C997]/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#006D4E]">
                                Enrollment Open
                            </span>
                            <h2 className="text-4xl font-semibold leading-tight text-slate-900">Your Benefits Package</h2>
                            <p className="max-w-md text-sm text-slate-700">
                                A curated collection of resources designed to support your growth, health, and holistic well-being.
                            </p>
                            <button
                                type="button"
                                onClick={() => setActiveTab('benefits')}
                                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#20C997] to-[#0a8f6c] px-4 py-2 text-sm font-semibold text-white"
                            >
                                Explore Perks <FaArrowRight className="text-xs" />
                            </button>
                        </div>
                        <div className="hidden bg-[linear-gradient(120deg,#d9f5ef,#b8ede2)] md:block" />
                    </div>
                </section>

                <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="relative w-full md:max-w-md">
                        <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search benefits or courses..."
                            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm outline-none transition focus:border-[#20C997]/40 focus:ring-2 focus:ring-[#20C997]/20"
                        />
                    </div>
                    {activeTab === 'learning' && (
                        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
                            <FaFilter className="ml-2 text-xs text-slate-400" />
                            {[
                                { id: 'all', label: 'All' },
                                { id: 'assigned', label: 'Assigned' },
                                { id: 'in-progress', label: 'In Progress' },
                                { id: 'completed', label: 'Completed' }
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setLearningFilter(item.id)}
                                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                                        learningFilter === item.id ? 'bg-slate-100 text-slate-800' : 'text-slate-500'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                {activeTab === 'benefits' ? (
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
                                {filteredBenefits.slice(0, 6).map((plan) => (
                                    <article key={plan._id} className="rounded-xl border border-slate-100 bg-white p-4 transition hover:shadow-md">
                                        <div className="mb-3 flex items-center justify-between">
                                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#20C997]/15 text-[#0a8f6c]">
                                                <FaHeart />
                                            </span>
                                            <span className="rounded-full bg-[#20C997]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#0a8f6c]">
                                                Active
                                            </span>
                                        </div>
                                        <h4 className="text-lg font-semibold text-slate-900">{plan.name}</h4>
                                        <p className="text-xs text-slate-500">{plan.category || 'Benefit Plan'}</p>
                                        <p className="mt-2 line-clamp-2 text-sm text-slate-600">{plan.description || 'Benefit details available.'}</p>
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/benefits/${plan._id}`)}
                                            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#0a8f6c]"
                                        >
                                            View Details <FaArrowRight className="text-xs" />
                                        </button>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                ) : (
                    <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-semibold text-slate-900">Learning</h3>
                                <p className="text-sm text-slate-500">Track assigned learning and continue your progress.</p>
                            </div>
                            <span className="text-sm font-medium text-slate-500">{learningCards.length} courses</span>
                        </div>

                        {learningCards.length === 0 ? (
                            <p className="py-8 text-center text-sm text-slate-500">No learning courses matched your filters.</p>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {learningCards.slice(0, 6).map((course) => (
                                    <article key={course._id} className="rounded-xl border border-slate-100 bg-white p-4 transition hover:shadow-md">
                                        <div className="mb-3 flex items-center justify-between">
                                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#20C997]/15 text-[#0a8f6c]">
                                                <FaBook />
                                            </span>
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                                    course.status === 'Completed'
                                                        ? 'bg-[#20C997]/15 text-[#0a8f6c]'
                                                        : 'bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                {course.status}
                                            </span>
                                        </div>
                                        <h4 className="line-clamp-2 text-lg font-semibold text-slate-900">{course.title}</h4>
                                        <p className="mt-2 line-clamp-2 text-sm text-slate-600">{course.description || 'Learning content available.'}</p>

                                        <div className="mt-3">
                                            <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                                                <span>Progress</span>
                                                <span>{course.progress}%</span>
                                            </div>
                                            <div className="h-2 w-full rounded-full bg-slate-100">
                                                <div
                                                    className="h-2 rounded-full bg-gradient-to-r from-[#20C997] to-[#0a8f6c]"
                                                    style={{ width: `${course.progress}%` }}
                                                />
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (course.status === 'Completed') {
                                                    toast.info('Certificate view will be added in next update');
                                                    return;
                                                }
                                                navigate(`/learning/courses/${course._id}`);
                                            }}
                                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#20C997]/40 py-2 text-sm font-semibold text-[#0a8f6c] transition hover:bg-[#20C997]/10"
                                        >
                                            {course.status === 'Completed' ? (
                                                <>
                                                    <FaCheckCircle /> View Certificate
                                                </>
                                            ) : (
                                                <>
                                                    <FaPlayCircle /> {course.progress > 0 ? 'Continue Learning' : 'Start Course'}
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
                                    {filteredTeamLearning.slice(0, 9).map((learning) => (
                                        (() => {
                                            const progressValue =
                                                typeof learning.progress === 'number'
                                                    ? learning.progress
                                                    : learning.progress?.progress || learning.progressRecord?.progress || 0;
                                            return (
                                        <article
                                            key={learning._id}
                                            className="rounded-xl border border-slate-100 bg-white p-4 transition hover:shadow-md"
                                        >
                                            <div className="mb-2 flex items-start justify-between gap-2">
                                                <h5 className="line-clamp-2 text-base font-semibold text-slate-900">{learning.title}</h5>
                                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getCategoryColor(learning.category)}`}>
                                                    {learning.category || 'Other'}
                                                </span>
                                            </div>

                                            {learning.description && (
                                                <p className="mb-3 line-clamp-2 text-sm text-slate-600">{learning.description}</p>
                                            )}

                                            {learning.resources && learning.resources.length > 0 && (
                                                <div className="mb-3">
                                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Resources</p>
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
