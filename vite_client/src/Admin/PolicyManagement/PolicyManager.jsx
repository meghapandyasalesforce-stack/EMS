import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaEdit, FaTrash, FaEye, FaFileAlt } from 'react-icons/fa';
import axios from '../../utils/axios';
import { ORGANIZATION_POLICIES_ENDPOINT } from '../../utils/constant';
import { toast } from 'react-toastify';
import logger from '../../utils/logger';
import LoadingSpinner from '../../components/LoadingSpinner';

const PolicyManager = () => {
    const navigate = useNavigate();
    const [policies, setPolicies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, active, inactive

    useEffect(() => {
        fetchPolicies();
    }, [filter]);

    const fetchPolicies = async () => {
        try {
            const params = filter !== 'all' ? { isActive: filter === 'active' } : {};
            const response = await axios.get(ORGANIZATION_POLICIES_ENDPOINT, { params });
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

    const handleDelete = async (policyId) => {
        if (!window.confirm('Are you sure you want to delete this policy?')) {
            return;
        }

        try {
            await axios.delete(`${ORGANIZATION_POLICIES_ENDPOINT}/${policyId}`);
            toast.success('Policy deleted successfully');
            fetchPolicies();
        } catch (error) {
            logger.error('Error deleting policy', { error: error.message, response: error.response?.data, policyId });
            toast.error('Failed to delete policy');
        }
    };

    const getPolicyTypeBadge = (type) => {
        const colors = {
            leave: 'bg-blue-100 text-blue-800',
            attendance: 'bg-green-100 text-green-800',
            payroll: 'bg-yellow-100 text-yellow-800',
            work_hours: 'bg-purple-100 text-purple-800',
            code_of_conduct: 'bg-red-100 text-red-800',
            custom: 'bg-gray-100 text-gray-800'
        };
        return colors[type] || colors.custom;
    };

    if (loading) {
        return <LoadingSpinner message="Loading policies..." />;
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">Company Policies</h1>
                <button
                    onClick={() => navigate('/admin/policies/create')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                    <FaPlus /> Create Policy
                </button>
            </div>

            {/* Filter */}
            <div className="flex gap-4">
                <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-lg ${
                        filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                >
                    All Policies
                </button>
                <button
                    onClick={() => setFilter('active')}
                    className={`px-4 py-2 rounded-lg ${
                        filter === 'active' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                >
                    Active
                </button>
                <button
                    onClick={() => setFilter('inactive')}
                    className={`px-4 py-2 rounded-lg ${
                        filter === 'inactive' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                >
                    Inactive
                </button>
            </div>

            {/* Policies List */}
            <div className="grid grid-cols-1 gap-4">
                {policies.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-md p-12 text-center">
                        <FaFileAlt className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 text-lg">No policies found</p>
                        <button
                            onClick={() => navigate('/admin/policies/create')}
                            className="mt-4 text-blue-600 hover:underline"
                        >
                            Create your first policy
                        </button>
                    </div>
                ) : (
                    policies.map((policy) => (
                        <div key={policy._id} className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-xl font-semibold text-gray-800">{policy.title}</h3>
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPolicyTypeBadge(policy.policyType)}`}>
                                            {policy.policyType.replace('_', ' ')}
                                        </span>
                                        {policy.isActive ? (
                                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                Active
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                Inactive
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-gray-600 mb-4">{policy.description}</p>
                                    <div className="flex gap-4 text-sm text-gray-500">
                                        <span>Effective: {new Date(policy.effectiveDate).toLocaleDateString()}</span>
                                        {policy.expiryDate && (
                                            <span>Expires: {new Date(policy.expiryDate).toLocaleDateString()}</span>
                                        )}
                                        <span>Version: {policy.version}</span>
                                        {policy.requiresAcknowledgment && (
                                            <span className="text-blue-600">Requires Acknowledgment</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => navigate(`/admin/policies/${policy._id}`)}
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                        title="View"
                                    >
                                        <FaEye />
                                    </button>
                                    <button
                                        onClick={() => navigate(`/admin/policies/${policy._id}/edit`)}
                                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                        title="Edit"
                                    >
                                        <FaEdit />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(policy._id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                        title="Delete"
                                    >
                                        <FaTrash />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default PolicyManager;

