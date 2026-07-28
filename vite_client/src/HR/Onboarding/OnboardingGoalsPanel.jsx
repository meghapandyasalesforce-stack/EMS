import React, { useCallback, useEffect, useState } from 'react';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import LoadingSpinner from '../../components/LoadingSpinner';

const OnboardingGoalsPanel = ({ workflowId, isHRView, onUpdated }) => {
    const [loading, setLoading] = useState(true);
    const [goals, setGoals] = useState([]);
    const [assigning, setAssigning] = useState(false);

    const load = useCallback(async () => {
        if (!workflowId) return;
        try {
            setLoading(true);
            const { data } = await axios.get(
                `${ADMIN_LIFECYCLE_ENDPOINT}/onboarding/${workflowId}/goals`,
                { withCredentials: true },
            );
            setGoals(data.data || []);
        } catch {
            setGoals([]);
        } finally {
            setLoading(false);
        }
    }, [workflowId]);

    useEffect(() => { load(); }, [load]);

    const assignDefaults = async () => {
        try {
            setAssigning(true);
            await axios.post(
                `${ADMIN_LIFECYCLE_ENDPOINT}/onboarding/${workflowId}/goals`,
                {
                    goals: [
                        { title: 'Complete onboarding & mandatory training', goalType: 'KPI', category: 'Onboarding' },
                        { title: 'Deliver first assigned project', goalType: 'KRA', category: 'Probation' },
                    ],
                },
                { withCredentials: true },
            );
            toast.success('Probation goals assigned');
            await load();
            onUpdated?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Assignment failed');
        } finally {
            setAssigning(false);
        }
    };

    if (loading) return <LoadingSpinner message="Loading goals..." />;

    return (
        <div className="space-y-3">
            {isHRView && !goals.length && (
                <button type="button" onClick={assignDefaults} disabled={assigning}
                    className="px-4 py-2 bg-theme-primary text-white rounded-lg text-sm disabled:opacity-50">
                    Assign default probation goals
                </button>
            )}
            {!goals.length && !isHRView && (
                <p className="text-sm text-gray-500">No probation goals assigned yet.</p>
            )}
            {goals.map((g) => (
                <div key={g._id} className="border rounded-lg p-3 flex justify-between items-center gap-2">
                    <div>
                        <p className="font-medium text-sm">{g.title}</p>
                        <p className="text-xs text-gray-500">{g.goalType} · {g.category} · {g.status}</p>
                    </div>
                    <div className="text-right">
                        <span className="text-sm font-bold">{g.progress ?? 0}%</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default OnboardingGoalsPanel;
