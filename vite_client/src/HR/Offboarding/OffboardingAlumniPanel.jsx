import React, { useCallback, useEffect, useState } from 'react';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import LoadingSpinner from '../../components/LoadingSpinner';
import useLifecycleFeatures from '../../Hooks/useLifecycleFeatures';

const OffboardingAlumniPanel = ({ isHRView }) => {
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState([]);
    const [dashboard, setDashboard] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const { isEnabled: isFeatureEnabled } = useLifecycleFeatures({ admin: true, showAll: true });

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/alumni`, { withCredentials: true });
            setRecords(data.data || []);
            setDashboard(data.dashboard);
        } catch {
            setRecords([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const rehire = async (alumniId) => {
        try {
            setSubmitting(true);
            await axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/alumni/${alumniId}/rehire`, {}, { withCredentials: true });
            toast.success('Rehire initiated');
            await load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Rehire failed');
        } finally {
            setSubmitting(false);
        }
    };

    const blacklist = async (alumniId) => {
        const reason = window.prompt('Blacklist reason:');
        if (!reason) return;
        try {
            setSubmitting(true);
            await axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/alumni/${alumniId}/blacklist`, { reason }, { withCredentials: true });
            toast.success('Marked as blacklisted');
            await load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isHRView) return null;
    if (loading) return <LoadingSpinner message="Loading alumni..." />;

    const canRehire = isFeatureEnabled('rehireEligibility');
    const canBlacklist = isFeatureEnabled('blacklisting');

    return (
        <div className="space-y-4">
            {dashboard && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-sm">
                    <div className="rounded-lg bg-gray-50 p-3"><p className="font-bold text-lg">{dashboard.total}</p><p className="text-gray-500">Total</p></div>
                    <div className="rounded-lg bg-emerald-50 p-3"><p className="font-bold text-lg">{dashboard.rehireEligible}</p><p className="text-gray-500">Rehire eligible</p></div>
                    <div className="rounded-lg bg-red-50 p-3"><p className="font-bold text-lg">{dashboard.blacklisted}</p><p className="text-gray-500">Blacklisted</p></div>
                    <div className="rounded-lg bg-blue-50 p-3"><p className="font-bold text-lg">{dashboard.rehired}</p><p className="text-gray-500">Rehired</p></div>
                </div>
            )}
            {!records.length ? (
                <p className="text-sm text-gray-500">No alumni records yet. Created when offboarding completes.</p>
            ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {records.map((r) => (
                        <div key={r._id} className="flex flex-wrap items-center justify-between gap-2 border rounded-lg p-3">
                            <div>
                                <p className="font-medium text-sm">
                                    {r.employeeId?.name || 'Employee'} {r.employeeId?.lastName || ''}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {r.status} · LWD {r.lastWorkingDate ? format(new Date(r.lastWorkingDate), 'MMM dd, yyyy') : '—'}
                                </p>
                            </div>
                            {r.eligibleForRehire && r.status !== 'Blacklisted' && (canRehire || canBlacklist) && (
                                <div className="flex gap-2">
                                    {canRehire && (
                                        <button type="button" disabled={submitting} onClick={() => rehire(r._id)}
                                            className="text-xs px-2 py-1 bg-theme-primary text-white rounded">Rehire</button>
                                    )}
                                    {canBlacklist && (
                                        <button type="button" disabled={submitting} onClick={() => blacklist(r._id)}
                                            className="text-xs px-2 py-1 border border-red-300 text-red-600 rounded">Blacklist</button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default OffboardingAlumniPanel;
