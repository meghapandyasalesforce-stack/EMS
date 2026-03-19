import React, { useEffect, useState } from 'react';
import { FaFileAlt, FaCheckCircle, FaClock } from 'react-icons/fa';
import DOMPurify from 'dompurify';
import axios from '../../utils/axios';
import { ORGANIZATION_POLICIES_ENDPOINT } from '../../utils/constant';
import { toast } from 'react-toastify';
import logger from '../../utils/logger';
import LoadingSpinner from '../../components/LoadingSpinner';

const ViewPolicies = () => {
    const [policies, setPolicies] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPolicies();
    }, []);

    const fetchPolicies = async () => {
        try {
            const response = await axios.get(`${ORGANIZATION_POLICIES_ENDPOINT}/employee/policies`);
            if (response.data.success) {
                setPolicies(response.data.policies || []);
            }
        } catch (error) {
            logger.error('Error fetching policies', { error: error.message, response: error.response?.data });
            toast.error('Failed to load policies');
        } finally {
            setLoading(false);
        }
    };

    const handleAcknowledge = async (policyId) => {
        try {
            await axios.post(`${ORGANIZATION_POLICIES_ENDPOINT}/employee/acknowledge`, { policyId });
            toast.success('Policy acknowledged successfully');
            fetchPolicies(); // Refresh to update acknowledgment status
        } catch (error) {
            logger.error('Error acknowledging policy', { error: error.message, response: error.response?.data, policyId });
            toast.error('Failed to acknowledge policy');
        }
    };

    if (loading) {
        return <LoadingSpinner message="Loading policies..." />;
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Company Policies</h1>
                <p className="text-gray-600 mt-2">Review and acknowledge company policies</p>
            </div>

            {policies.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-12 text-center">
                    <FaFileAlt className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">No policies available</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {policies.map((policy) => (
                        <div key={policy._id} className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-xl font-semibold text-gray-800">{policy.title}</h3>
                                        {policy.requiresAcknowledgment && (
                                            policy.acknowledged ? (
                                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-theme-primary/10 text-theme-primary flex items-center gap-1">
                                                    <FaCheckCircle /> Acknowledged
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 flex items-center gap-1">
                                                    <FaClock /> Pending
                                                </span>
                                            )
                                        )}
                                    </div>
                                    <p className="text-gray-600 mb-4">{policy.description}</p>
                                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                                        <div 
                                            className="prose max-w-none" 
                                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(policy.content || '') }} 
                                        />
                                    </div>
                                    <div className="flex gap-4 text-sm text-gray-500">
                                        <span>Effective: {new Date(policy.effectiveDate).toLocaleDateString()}</span>
                                        {policy.expiryDate && (
                                            <span>Expires: {new Date(policy.expiryDate).toLocaleDateString()}</span>
                                        )}
                                        {policy.acknowledgedAt && (
                                            <span className="text-theme-primary">
                                                Acknowledged: {new Date(policy.acknowledgedAt).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {policy.requiresAcknowledgment && !policy.acknowledged && (
                                <button
                                    onClick={() => handleAcknowledge(policy._id)}
                                    className="bg-theme-primary text-white px-6 py-2 rounded-lg hover:opacity-90 flex items-center gap-2"
                                >
                                    <FaCheckCircle /> Acknowledge Policy
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ViewPolicies;

