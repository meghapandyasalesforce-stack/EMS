import React, { useCallback, useEffect, useState } from 'react';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { ADMIN_LIFECYCLE_ENDPOINT, BOTH_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import LoadingSpinner from '../../components/LoadingSpinner';
import { CmBadge, CmButton, statusTone } from '../../components/corporateModern';

const OnboardingFormsPanel = ({ workflowId, employeeId, isHRView, onUpdated }) => {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [gateStatus, setGateStatus] = useState(null);
    const [activeForm, setActiveForm] = useState(null);
    const [responses, setResponses] = useState({});

    const formsBase = `${BOTH_LIFECYCLE_ENDPOINT}/forms`;

    const load = useCallback(async () => {
        if (!workflowId) return;
        try {
            setLoading(true);
            const { data } = await axios.get(
                `${ADMIN_LIFECYCLE_ENDPOINT}/onboarding/${workflowId}/forms/status`,
                { withCredentials: true },
            );
            setGateStatus(data.data);
        } catch (err) {
            setGateStatus(null);
            if (err.response?.status !== 503) {
                toast.error(err.response?.data?.message || 'Could not load mandatory forms');
            }
        } finally {
            setLoading(false);
        }
    }, [workflowId]);

    useEffect(() => { load(); }, [load]);

    const openForm = async (item) => {
        try {
            const { data } = await axios.get(`${formsBase}/${item.formId}`, { withCredentials: true });
            setActiveForm({ ...item, definition: data.data });
            setResponses({});
        } catch {
            toast.error('Could not load form');
        }
    };

    const submitForm = async () => {
        if (!activeForm) return;
        try {
            setSubmitting(true);
            await axios.post(`${formsBase}/${activeForm.formId}/submit`, {
                responses,
                employeeId,
                workflowId,
                workflowType: 'onboarding',
            }, { withCredentials: true });
            toast.success('Form submitted');
            setActiveForm(null);
            await load();
            onUpdated?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Submit failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <LoadingSpinner message="Loading forms..." />;

    if (!gateStatus?.items?.length) {
        return (
            <div className={isHRView ? 'text-sm text-[var(--cm-muted)]' : 'text-sm text-gray-500'}>
                <p>No published onboarding forms yet.</p>
                {isHRView && (
                    <p className="mt-2">
                        Create a form under <strong>Onboarding → Configure → Form Builder</strong>, set category to{' '}
                        <strong>Onboarding</strong>, then click <strong>Publish</strong>. It will appear here for every active onboarding workflow.
                    </p>
                )}
            </div>
        );
    }

    const rowClass = isHRView
        ? 'flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[rgba(187,202,193,0.35)] bg-[var(--cm-surface-low)] p-3'
        : 'flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3';

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                    {gateStatus.completed}/{gateStatus.total} forms complete ({gateStatus.progress}%)
                </span>
                {!gateStatus.allComplete && (
                    <span className={isHRView ? 'text-[var(--cm-tertiary-deep)]' : 'text-amber-700'}>
                        Required before workflow can complete
                    </span>
                )}
            </div>
            <div className="space-y-2">
                {gateStatus.items.map((item) => (
                    <div key={item.formId} className={rowClass}>
                        <div>
                            <p className="font-medium text-sm">{item.name}</p>
                            {isHRView ? (
                                <CmBadge tone={statusTone(item.completed ? 'Completed' : item.status)} className="mt-1">
                                    {item.status}
                                </CmBadge>
                            ) : (
                                <span className={`text-xs px-2 py-0.5 rounded ${item.completed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                    {item.status}
                                </span>
                            )}
                        </div>
                        {!item.completed && (
                            isHRView ? (
                                <CmButton variant="primary" size="sm" onClick={() => openForm(item)}>
                                    {isHRView ? 'Fill / View' : 'Complete'}
                                </CmButton>
                            ) : (
                                <button type="button" onClick={() => openForm(item)}
                                    className="px-3 py-1.5 bg-theme-primary text-white rounded text-sm">
                                    Complete
                                </button>
                            )
                        )}
                    </div>
                ))}
            </div>

            {activeForm?.definition && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
                        <h3 className="text-lg font-bold mb-4">{activeForm.name}</h3>
                        <div className="space-y-3">
                            {(activeForm.definition.fields || []).map((field) => (
                                <label key={field.key} className="block text-sm">
                                    <span className="font-medium">{field.label}{field.required ? ' *' : ''}</span>
                                    {field.type === 'dropdown' ? (
                                        <select value={responses[field.key] || ''}
                                            onChange={(e) => setResponses((p) => ({ ...p, [field.key]: e.target.value }))}
                                            className="mt-1 w-full border rounded px-3 py-2">
                                            <option value="">Select</option>
                                            {(field.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    ) : (
                                        <input type={field.type === 'number' ? 'number' : 'text'}
                                            value={responses[field.key] || ''}
                                            onChange={(e) => setResponses((p) => ({ ...p, [field.key]: e.target.value }))}
                                            className="mt-1 w-full border rounded px-3 py-2" />
                                    )}
                                </label>
                            ))}
                        </div>
                        <div className="mt-6 flex gap-2 justify-end">
                            <button type="button" onClick={() => setActiveForm(null)} className="px-4 py-2 border rounded">Cancel</button>
                            <button type="button" onClick={submitForm} disabled={submitting}
                                className="px-4 py-2 bg-theme-primary text-white rounded disabled:opacity-50">Submit</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OnboardingFormsPanel;
