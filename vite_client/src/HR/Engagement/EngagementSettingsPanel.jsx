import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';

const Toggle = ({ checked, onChange, disabled, label }) => (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
        <span className="text-sm font-semibold text-slate-800">{label}</span>
        <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} className="h-4 w-4 shrink-0" />
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

    useEffect(() => {
        load();
    }, []);

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

    if (loading || !settings) {
        return <p className="py-12 text-center text-sm text-slate-500">Loading settings...</p>;
    }

    const features = settings.features || {};
    const lifecycle = settings.lifecycle || {};

    return (
        <div className="space-y-6">
            <div>
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Modules</h3>
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
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Lifecycle surveys</h3>
                <div className="space-y-2">
                    <Toggle
                        label="Enable lifecycle automation"
                        checked={Boolean(lifecycle.enabled)}
                        disabled={saving}
                        onChange={() => save({ lifecycle: { ...lifecycle, enabled: !lifecycle.enabled } })}
                    />
                    {[
                        ['day7', 'Day 7'],
                        ['day30', 'Day 30'],
                        ['day90', 'Day 90'],
                        ['exit', 'Exit / resignation'],
                    ].map(([key, label]) => (
                        <Toggle
                            key={key}
                            label={label}
                            checked={lifecycle[key] !== false}
                            disabled={saving || !lifecycle.enabled}
                            onChange={() => save({ lifecycle: { ...lifecycle, [key]: lifecycle[key] === false } })}
                        />
                    ))}
                </div>
            </div>

            <div>
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Privacy</h3>
                <div className="space-y-2">
                    <Toggle
                        label="Require approval for employee recognition"
                        checked={Boolean(settings.recognitionRequireApproval)}
                        disabled={saving}
                        onChange={() => save({ recognitionRequireApproval: !settings.recognitionRequireApproval })}
                    />
                    <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                        <span className="text-sm font-semibold text-slate-800">Min responses for analytics</span>
                        <input
                            type="number"
                            min={5}
                            max={50}
                            defaultValue={settings.analyticsMinResponses || 5}
                            disabled={saving}
                            className="w-20 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
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
        </div>
    );
};

export default EngagementSettingsPanel;
