import React, { useCallback, useEffect, useState } from 'react';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import LoadingSpinner from '../../components/LoadingSpinner';

/**
 * Exit interview panel embedded in offboarding workflow detail.
 * Reuses lifecycle exit interview sessions linked to the workflow.
 */
const ExitInterviewWorkflowPanel = ({ workflowId, isHRView, onUpdated }) => {
    const base = `${ADMIN_LIFECYCLE_ENDPOINT}/exit-interviews`;
    const [loading, setLoading] = useState(true);
    const [sessions, setSessions] = useState([]);
    const [activeSession, setActiveSession] = useState(null);
    const [formDef, setFormDef] = useState(null);
    const [responses, setResponses] = useState({});
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async () => {
        if (!workflowId) return;
        try {
            setLoading(true);
            const { data } = await axios.get(`${base}/sessions`, {
                params: { offboardingWorkflowId: workflowId },
                withCredentials: true,
            });
            setSessions(data.data || []);
        } catch {
            setSessions([]);
        } finally {
            setLoading(false);
        }
    }, [workflowId, base]);

    useEffect(() => { load(); }, [load]);

    const openSession = async (session) => {
        setActiveSession(session);
        setResponses(session.responses || {});
        if (session.formDefinitionId) {
            try {
                const { data } = await axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/forms/${session.formDefinitionId}`, { withCredentials: true });
                setFormDef(data.data);
            } catch {
                setFormDef(null);
            }
        }
    };

    const saveDraft = async () => {
        if (!activeSession) return;
        try {
            setSubmitting(true);
            await axios.post(`${base}/sessions/${activeSession._id}/draft`, { responses }, { withCredentials: true });
            toast.success('Draft saved');
            await load();
            onUpdated?.();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Save failed');
        } finally {
            setSubmitting(false);
        }
    };

    const submit = async () => {
        if (!activeSession) return;
        try {
            setSubmitting(true);
            await axios.post(`${base}/sessions/${activeSession._id}/submit`, { responses }, { withCredentials: true });
            toast.success('Exit interview submitted');
            setActiveSession(null);
            await load();
            onUpdated?.();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Submit failed');
        } finally {
            setSubmitting(false);
        }
    };

    const provision = async () => {
        try {
            await axios.post(`${base}/provision/${workflowId}`, {}, { withCredentials: true });
            toast.success('Exit interviews provisioned');
            await load();
            onUpdated?.();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Provision failed');
        }
    };

    const closeSession = async (id) => {
        try {
            await axios.post(`${base}/sessions/${id}/close`, {}, { withCredentials: true });
            toast.success('Interview closed');
            await load();
            onUpdated?.();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Close failed');
        }
    };

    if (loading) return <LoadingSpinner />;

    return (
        <div className="space-y-4">
            {isHRView && !sessions.length && (
                <button type="button" onClick={provision} className="text-sm px-3 py-1.5 bg-theme-primary text-white rounded-lg">
                    Provision Exit Interviews
                </button>
            )}

            {!activeSession ? (
                <div className="space-y-2">
                    {sessions.map((s) => (
                        <div key={s._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg">
                            <div>
                                <p className="font-medium text-sm capitalize">{s.interviewType?.replace('_', ' ')}</p>
                                <p className="text-xs text-gray-500">
                                    {s.scheduledDate ? `Scheduled ${format(new Date(s.scheduledDate), 'MMM dd, yyyy')}` : 'Not scheduled'}
                                    {' · '}{s.status}
                                </p>
                                {(s.meetingUrl || s.icsUrl) && (
                                    <div className="mt-1 flex flex-wrap gap-2">
                                        {s.meetingUrl && (
                                            <a href={s.meetingUrl} target="_blank" rel="noreferrer"
                                                className="text-xs text-theme-primary underline">
                                                Join meeting
                                            </a>
                                        )}
                                        {s.icsUrl && (
                                            <a href={s.icsUrl} download
                                                className="text-xs text-theme-primary underline">
                                                Download calendar (.ics)
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {!['Closed', 'Cancelled', 'Approved'].includes(s.status) && (
                                    <button type="button" onClick={() => openSession(s)} className="text-xs px-2 py-1 border rounded hover:bg-gray-50">
                                        {['Submitted', 'Pending Approval'].includes(s.status) ? 'View' : 'Complete'}
                                    </button>
                                )}
                                {isHRView && !['Closed', 'Cancelled'].includes(s.status) && (
                                    <button type="button" onClick={() => closeSession(s._id)} className="text-xs px-2 py-1 text-red-600 border border-red-200 rounded">
                                        Close
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {!sessions.length && (
                        <p className="text-sm text-gray-500 text-center py-4">No exit interview sessions for this offboarding workflow.</p>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    <button type="button" onClick={() => setActiveSession(null)} className="text-sm text-blue-600">← Back to sessions</button>
                    <p className="font-medium capitalize">{activeSession.interviewType?.replace('_', ' ')} Questionnaire</p>
                    {(formDef?.fields || []).filter((f) => !['heading', 'divider'].includes(f.type)).map((field) => (
                        <label key={field.key} className="block text-sm space-y-1">
                            <span className="font-medium">{field.label}{field.required && ' *'}</span>
                            {field.type === 'textarea' ? (
                                <textarea rows={3} value={responses[field.key] ?? ''} onChange={(e) => setResponses((r) => ({ ...r, [field.key]: e.target.value }))} className="w-full rounded border px-3 py-2" />
                            ) : field.type === 'dropdown' ? (
                                <select value={responses[field.key] ?? ''} onChange={(e) => setResponses((r) => ({ ...r, [field.key]: e.target.value }))} className="w-full rounded border px-3 py-2">
                                    <option value="">Select...</option>
                                    {(field.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            ) : (
                                <input type="text" value={responses[field.key] ?? ''} onChange={(e) => setResponses((r) => ({ ...r, [field.key]: e.target.value }))} className="w-full rounded border px-3 py-2" />
                            )}
                        </label>
                    ))}
                    {!formDef?.fields?.length && (
                        <textarea rows={4} placeholder="Feedback" value={responses.feedback ?? ''} onChange={(e) => setResponses((r) => ({ ...r, feedback: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm" />
                    )}
                    {!['Submitted', 'Pending Approval', 'Approved', 'Closed'].includes(activeSession.status) && (
                        <div className="flex gap-2">
                            <button type="button" disabled={submitting} onClick={saveDraft} className="px-3 py-1.5 border rounded text-sm">Save Draft</button>
                            <button type="button" disabled={submitting} onClick={submit} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-sm">Submit</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ExitInterviewWorkflowPanel;
