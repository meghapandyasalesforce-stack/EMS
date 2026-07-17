import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from '../../utils/axios';
import { ORGANIZATION_POLICIES_ENDPOINT } from '../../utils/constant';
import { toast } from 'react-toastify';
import logger from '../../utils/logger';
import LoadingSpinner from '../../components/LoadingSpinner';

const ViewPolicy = () => {
    const { policyId } = useParams();
    const navigate = useNavigate();
    const [policy, setPolicy] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                setLoading(true);
                const { data } = await axios.get(`${ORGANIZATION_POLICIES_ENDPOINT}/${policyId}`);
                if (!cancelled && data.success && data.policy) {
                    setPolicy(data.policy);
                } else if (!cancelled) {
                    toast.error('Policy not found');
                    navigate('/admin/policies');
                }
            } catch (e) {
                logger.error('Error loading policy', { error: e.message, policyId });
                if (!cancelled) {
                    toast.error(e.response?.data?.message || 'Failed to load policy');
                    navigate('/admin/policies');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [policyId, navigate]);

    if (loading || !policy) {
        return <LoadingSpinner message="Loading policy..." />;
    }

    return (
        <div className="page-shell">
        <div className="page-shell-inner hrms-stack">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">{policy.title}</h1>
                    <p className="text-gray-500 mt-1 capitalize">
                        {(policy.policyType || '').replace(/_/g, ' ')}
                        {policy.isActive ? (
                            <span className="ml-2 text-theme-primary font-medium">· Active</span>
                        ) : (
                            <span className="ml-2 text-gray-600 font-medium">· Inactive</span>
                        )}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => navigate('/admin/policies')}
                        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                        Back to list
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(`/admin/policies/${policyId}/edit`)}
                        className="px-4 py-2 rounded-lg bg-theme-primary text-white hover:opacity-90"
                    >
                        Edit
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
                <div>
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Description</h2>
                    <p className="text-gray-800 mt-1 whitespace-pre-wrap">{policy.description}</p>
                </div>
                <div>
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Content</h2>
                    <p className="text-gray-800 mt-1 whitespace-pre-wrap">{policy.content}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>
                        <span className="font-medium text-gray-700">Effective: </span>
                        {policy.effectiveDate ? new Date(policy.effectiveDate).toLocaleDateString() : '—'}
                    </div>
                    <div>
                        <span className="font-medium text-gray-700">Expires: </span>
                        {policy.expiryDate ? new Date(policy.expiryDate).toLocaleDateString() : '—'}
                    </div>
                    <div>
                        <span className="font-medium text-gray-700">Version: </span>
                        {policy.version ?? 1}
                    </div>
                    <div>
                        <span className="font-medium text-gray-700">Acknowledgment: </span>
                        {policy.requiresAcknowledgment ? 'Required' : 'Not required'}
                    </div>
                </div>
                {Array.isArray(policy.applicableDepartments) && policy.applicableDepartments.length > 0 && (
                    <div>
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Applicable departments</h2>
                        <p className="text-gray-800 mt-1">{policy.applicableDepartments.join(', ')}</p>
                    </div>
                )}
            </div>
        </div>
        </div>
    );
};

export default ViewPolicy;
