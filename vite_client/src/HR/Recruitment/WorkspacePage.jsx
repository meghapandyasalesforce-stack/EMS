import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaArrowLeft, FaBriefcase, FaCalendarAlt, FaClipboardCheck, FaExclamationTriangle, FaUserCheck } from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { AtsPage, AtsPageHeader, AtsAvatar } from '../../components/recruitment/atsUi';

const Widget = ({ title, icon: Icon, items, empty, onOpen }) => (
    <section className="ats-workspace-widget flex flex-col">
        <div className="mb-3 flex items-center gap-2">
            <div className="cm-stat__icon" style={{ width: '2.25rem', height: '2.25rem' }}>
                <Icon className="h-3.5 w-3.5" />
            </div>
            <h2 className="font-semibold" style={{ color: 'var(--ats-secondary)' }}>{title}</h2>
            <span className="ats-tab-count ml-auto">{items?.length || 0}</span>
        </div>
        <div className="max-h-64 space-y-2 overflow-y-auto">
            {(items || []).length === 0 ? (
                <p className="text-sm" style={{ color: 'rgba(15,45,38,0.5)' }}>{empty}</p>
            ) : (
                items.map((item) => {
                    const id = item._id || item.id;
                    const name = item.name || `${item.firstName || ''} ${item.lastName || ''}`.trim();
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => onOpen(id)}
                            className="ats-workspace-widget__item"
                        >
                            <AtsAvatar name={name} />
                            <span className="min-w-0 flex-1">
                                <p className="truncate font-medium" style={{ color: 'var(--ats-secondary)' }}>{name}</p>
                                <p className="truncate text-xs" style={{ color: 'rgba(15,45,38,0.5)' }}>{item.jobPostingId?.jobTitle || item.status || item.stage || ''}</p>
                            </span>
                        </button>
                    );
                })
            )}
        </div>
    </section>
);

const WorkspacePage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    const fetchWorkspace = useCallback(async () => {
        try {
            setLoading(true);
            const { data: res } = await axios.get('/v1/admin/recruitment/workspace', { withCredentials: true });
            setData(res.data);
        } catch {
            toast.error('Failed to load workspace');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchWorkspace(); }, [fetchWorkspace]);

    if (loading) return <LoadingSpinner message="Loading workspace…" />;

    const counts = data?.counts || {};
    const widgets = data?.widgets || {};

    return (
        <AtsPage className="rec-hub ats-workspace-page">
            <div className="rec-hub__crumb">
                <span>Recruitment</span>
                <span className="rec-hub__crumb-sep">/</span>
                <span className="rec-hub__crumb-current">My Workspace</span>
            </div>

            <button type="button" onClick={() => navigate('/recruitment')} className="ats-back">
                <FaArrowLeft className="h-3 w-3" /> Back to Recruitment
            </button>

            <AtsPageHeader
                eyebrow="Talent acquisition"
                title="My Workspace"
                subtitle="Recruiter home — screening, interviews, joining"
            />

            <div className="ats-stat-grid">
                {[
                    { label: 'Open jobs', value: counts.openJobs },
                    { label: 'Active candidates', value: counts.totalCandidates },
                    { label: 'Overdue screening', value: counts.overdueScreening, tone: 'attention' },
                    { label: 'Joining this week', value: counts.joiningThisWeek },
                ].map((c) => (
                    <div key={c.label} className="cm-stat">
                        <p className="cm-stat__label">{c.label}</p>
                        <p className={`cm-stat__value ${c.tone === 'attention' ? 'cm-stat__value--attention' : ''}`}>{c.value ?? 0}</p>
                    </div>
                ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Widget title="Pending Resume Screening" icon={FaClipboardCheck} items={widgets.pendingScreening} empty="No pending screening" onOpen={(id) => navigate(`/recruitment/candidates/${id}`)} />
                <Widget title="Interviews Today" icon={FaCalendarAlt} items={widgets.interviewsToday} empty="No interviews today" onOpen={(id) => navigate(`/recruitment/candidates/${id}`)} />
                <Widget title="Pending Feedback" icon={FaExclamationTriangle} items={widgets.pendingFeedback} empty="No pending feedback" onOpen={(id) => navigate(`/recruitment/candidates/${id}`)} />
                <Widget title="Awaiting Joining Confirm" icon={FaUserCheck} items={widgets.awaitingJoiningConfirm} empty="Nothing awaiting confirmation" onOpen={(id) => navigate(`/recruitment/candidates/${id}`)} />
                <Widget title="Joining This Week" icon={FaBriefcase} items={widgets.joiningThisWeek} empty="No joinings this week" onOpen={(id) => navigate(`/recruitment/candidates/${id}`)} />
            </div>
        </AtsPage>
    );
};

export default WorkspacePage;
