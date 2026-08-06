import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaArrowLeft, FaBriefcase, FaCalendarAlt, FaClipboardCheck, FaExclamationTriangle, FaUserCheck } from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';

const Widget = ({ title, icon: Icon, items, empty, onOpen }) => (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
            <Icon className="text-theme-secondary" />
            <h2 className="font-semibold text-gray-800">{title}</h2>
            <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs">{items?.length || 0}</span>
        </div>
        <div className="max-h-64 space-y-2 overflow-y-auto">
            {(items || []).length === 0 ? (
                <p className="text-sm text-gray-500">{empty}</p>
            ) : (
                items.map((item) => {
                    const id = item._id || item.id;
                    const name = item.name || `${item.firstName || ''} ${item.lastName || ''}`.trim();
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => onOpen(id)}
                            className="block w-full rounded-lg border px-3 py-2 text-left text-sm hover:border-theme-secondary/40"
                        >
                            <p className="font-medium text-gray-900">{name}</p>
                            <p className="text-xs text-gray-500">{item.jobPostingId?.jobTitle || item.status || item.stage || ''}</p>
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
        <div className="min-h-screen bg-gray-50 p-3 sm:p-4">
            <div className="w-full">
                <button type="button" onClick={() => navigate('/recruitment')} className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
                    <FaArrowLeft /> Back to Recruitment
                </button>
                <h1 className="text-2xl font-bold text-gray-800">My Workspace</h1>
                <p className="mb-6 text-gray-600">Recruiter home screening, interviews, joining</p>

                <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                        { label: 'Open jobs', value: counts.openJobs },
                        { label: 'Active candidates', value: counts.totalCandidates },
                        { label: 'Overdue screening', value: counts.overdueScreening },
                        { label: 'Joining this week', value: counts.joiningThisWeek },
                    ].map((c) => (
                        <div key={c.label} className="rounded-xl border bg-white p-4 shadow-sm">
                            <p className="text-2xl font-bold text-gray-900">{c.value ?? 0}</p>
                            <p className="text-sm text-gray-500">{c.label}</p>
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
            </div>
        </div>
    );
};

export default WorkspacePage;
