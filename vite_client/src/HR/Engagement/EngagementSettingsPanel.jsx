import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { MINT_GRADIENT } from '../Reports/constants';

const Toggle = ({ checked, onChange, disabled, label, hint }) => (
    <label className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
        <span>
            <span className="block text-sm font-semibold text-slate-800">{label}</span>
            {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
        </span>
        <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} className="mt-1 h-4 w-4" />
    </label>
);

const EngagementSettingsPanel = () => {
    const [settings, setSettings] = useState(null);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        try {
            const { data } = await axios.get('/v1/admin/engagement/settings', { withCredentials: true });
            setSettings(data?.data);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const save = async (patch) => {
        try {
            setSaving(true);
            const { data } = await axios.put('/v1/admin/engagement/settings', patch, { withCredentials: true });
            setSettings(data?.data);
            toast.success('Settings saved');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading || !settings) return <p className="py-12 text-center text-sm text-slate-500">Loading settings...</p>;

    const features = settings.features || {};
    const notifications = settings.notifications || {};
    const lifecycle = settings.lifecycle || {};

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-sm font-semibold text-slate-800">Modules</h3>
                <p className="mb-3 text-xs text-slate-500">Disabled modules hide employee actions and reject new API usage. Existing history remains.</p>
                <div className="space-y-2">
                    {[
                        ['surveys', 'Surveys'],
                        ['pulse', 'Pulse programs'],
                        ['feedback', 'Feedback'],
                        ['suggestions', 'Suggestions'],
                        ['recognition', 'Recognition'],
                    ].map(([key, label]) => (
                        <Toggle
                            key={key}
                            label={label}
                            checked={features[key] !== false}
                            disabled={saving}
                            onChange={() => save({ features: { ...features, [key]: features[key] === false } })}
                        />
                    ))}
                </div>
            </div>

            <div>
                <h3 className="text-sm font-semibold text-slate-800">Lifecycle survey automation</h3>
                <p className="mb-3 text-xs text-slate-500">
                    Automatically assigns existing Survey forms for new joiners (Day 7 / 30 / 90) and exit/resignation.
                    Does not create a separate survey system.
                </p>
                <div className="space-y-2">
                    <Toggle
                        label="Enable lifecycle automation"
                        hint="Hourly job creates targeted surveys when triggers fire"
                        checked={Boolean(lifecycle.enabled)}
                        disabled={saving}
                        onChange={() => save({ lifecycle: { ...lifecycle, enabled: !lifecycle.enabled } })}
                    />
                    {[
                        ['day7', 'Day 7 new-joiner survey'],
                        ['day30', 'Day 30 new-joiner survey'],
                        ['day90', 'Day 90 new-joiner survey'],
                        ['exit', 'Exit / resignation survey'],
                    ].map(([key, label]) => (
                        <Toggle
                            key={key}
                            label={label}
                            checked={lifecycle[key] !== false}
                            disabled={saving || !lifecycle.enabled}
                            onChange={() => save({ lifecycle: { ...lifecycle, [key]: lifecycle[key] === false } })}
                        />
                    ))}
                    <Toggle
                        label="Lifecycle surveys anonymous by default"
                        hint="Preserves identity privacy for lifecycle responses"
                        checked={lifecycle.anonymous !== false}
                        disabled={saving || !lifecycle.enabled}
                        onChange={() => save({ lifecycle: { ...lifecycle, anonymous: lifecycle.anonymous === false } })}
                    />
                    <label className="block rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                        <span className="block text-sm font-semibold text-slate-800">Open duration (days)</span>
                        <span className="mt-0.5 block text-xs text-slate-500">How long lifecycle surveys stay open (3–30).</span>
                        <input
                            type="number"
                            min={3}
                            max={30}
                            defaultValue={lifecycle.openDurationDays || 7}
                            disabled={saving || !lifecycle.enabled}
                            className="mt-2 w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            onBlur={(e) => {
                                const n = parseInt(e.target.value, 10);
                                if (!Number.isNaN(n) && n !== lifecycle.openDurationDays) {
                                    save({ lifecycle: { ...lifecycle, openDurationDays: n } });
                                }
                            }}
                        />
                    </label>
                </div>
            </div>

            <div>
                <h3 className="text-sm font-semibold text-slate-800">Privacy & approval</h3>
                <div className="mt-3 space-y-2">
                    <Toggle
                        label="Require HR approval for employee recognition"
                        hint="HR/Admin recognition still publishes immediately"
                        checked={Boolean(settings.recognitionRequireApproval)}
                        disabled={saving}
                        onChange={() => save({ recognitionRequireApproval: !settings.recognitionRequireApproval })}
                    />
                    <Toggle
                        label="Default anonymous feedback checkbox on"
                        hint="Employees still need anonymous permission to submit anonymously"
                        checked={Boolean(settings.anonymousFeedbackDefault)}
                        disabled={saving}
                        onChange={() => save({ anonymousFeedbackDefault: !settings.anonymousFeedbackDefault })}
                    />
                    <label className="block rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                        <span className="block text-sm font-semibold text-slate-800">Analytics privacy threshold</span>
                        <span className="mt-0.5 block text-xs text-slate-500">Never below 5. Higher values hide more detail.</span>
                        <input
                            type="number"
                            min={5}
                            max={50}
                            defaultValue={settings.analyticsMinResponses || 5}
                            disabled={saving}
                            className="mt-2 w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            onBlur={(e) => {
                                const n = parseInt(e.target.value, 10);
                                if (!Number.isNaN(n) && n !== settings.analyticsMinResponses) {
                                    save({ analyticsMinResponses: n });
                                }
                            }}
                        />
                    </label>
                </div>
            </div>

            <div>
                <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
                <p className="mb-3 text-xs text-slate-500">Organization-level Engagement notification preferences.</p>
                <div className="space-y-2">
                    {[
                        ['surveyAssigned', 'Survey assigned'],
                        ['surveyReminder', 'Survey reminders & closing notices'],
                        ['lifecycleSurveyAssigned', 'Lifecycle survey assigned'],
                        ['recognitionReceived', 'Recognition received'],
                        ['actionPlanAssigned', 'Action plan assigned'],
                        ['actionPlanDue', 'Action plan due / overdue'],
                        ['suggestionImplemented', 'Suggestion implemented'],
                    ].map(([key, label]) => (
                        <Toggle
                            key={key}
                            label={label}
                            checked={notifications[key] !== false}
                            disabled={saving}
                            onChange={() => save({ notifications: { ...notifications, [key]: notifications[key] === false } })}
                        />
                    ))}
                </div>
            </div>

            <p className="text-xs text-slate-400" style={{ background: `${MINT_GRADIENT}00` }}>
                Settings apply organization-wide. Server-side authorization remains the source of truth.
            </p>
        </div>
    );
};

export default EngagementSettingsPanel;
