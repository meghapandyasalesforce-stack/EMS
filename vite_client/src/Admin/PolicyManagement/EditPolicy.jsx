import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from '../../utils/axios';
import { ORGANIZATION_POLICIES_ENDPOINT } from '../../utils/constant';
import { toast } from 'react-toastify';
import logger from '../../utils/logger';
import LoadingSpinner from '../../components/LoadingSpinner';

const formatDateInput = (d) => {
    if (!d) return '';
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
};

const EditPolicy = () => {
    const { policyId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        policyType: 'custom',
        title: '',
        description: '',
        content: '',
        effectiveDate: '',
        expiryDate: '',
        requiresAcknowledgment: false,
        applicableDepartments: [],
        isActive: true,
        rules: []
    });

    const policyTypes = [
        'leave', 'attendance', 'payroll', 'work_hours',
        'dress_code', 'code_of_conduct', 'data_security',
        'remote_work', 'overtime', 'expense', 'travel',
        'performance', 'disciplinary', 'benefits', 'custom'
    ];

    const departments = [
        'Engineering', 'HR', 'Finance', 'Sales', 'Marketing',
        'IT Support', 'Operations', 'Customer Support', 'Legal',
        'Product', 'Research & Development', 'Design', 'Administration'
    ];

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                setLoading(true);
                const { data } = await axios.get(`${ORGANIZATION_POLICIES_ENDPOINT}/${policyId}`);
                if (cancelled || !data.success || !data.policy) {
                    if (!cancelled) {
                        toast.error('Policy not found');
                        navigate('/admin/policies');
                    }
                    return;
                }
                const p = data.policy;
                setFormData({
                    policyType: p.policyType || 'custom',
                    title: p.title || '',
                    description: p.description || '',
                    content: p.content || '',
                    effectiveDate: formatDateInput(p.effectiveDate),
                    expiryDate: formatDateInput(p.expiryDate),
                    requiresAcknowledgment: !!p.requiresAcknowledgment,
                    applicableDepartments: Array.isArray(p.applicableDepartments) ? [...p.applicableDepartments] : [],
                    isActive: p.isActive !== false,
                    rules: Array.isArray(p.rules) ? p.rules : []
                });
            } catch (e) {
                logger.error('Error loading policy for edit', { error: e.message, policyId });
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

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleDepartmentChange = (dept) => {
        setFormData(prev => ({
            ...prev,
            applicableDepartments: prev.applicableDepartments.includes(dept)
                ? prev.applicableDepartments.filter(d => d !== dept)
                : [...prev.applicableDepartments, dept]
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...formData,
                effectiveDate: formData.effectiveDate || undefined,
                expiryDate: formData.expiryDate || undefined
            };
            await axios.put(`${ORGANIZATION_POLICIES_ENDPOINT}/${policyId}`, payload);
            toast.success('Policy updated successfully');
            navigate('/admin/policies');
        } catch (error) {
            logger.error('Error updating policy', { error: error.message, response: error.response?.data, policyId });
            toast.error(error.response?.data?.message || 'Failed to update policy');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <LoadingSpinner message="Loading policy..." />;
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Edit company policy</h1>
                <p className="text-gray-600 mt-2">Update policy details for your organization</p>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Policy type *
                    </label>
                    <select
                        name="policyType"
                        value={formData.policyType}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary"
                        required
                    >
                        {policyTypes.map(type => (
                            <option key={type} value={type}>
                                {type.replace('_', ' ').toUpperCase()}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Title *
                    </label>
                    <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description *
                    </label>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        rows="3"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Policy content *
                    </label>
                    <textarea
                        name="content"
                        value={formData.content}
                        onChange={handleChange}
                        rows="10"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary"
                        required
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Effective date *
                        </label>
                        <input
                            type="date"
                            name="effectiveDate"
                            value={formData.effectiveDate}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Expiry date (optional)
                        </label>
                        <input
                            type="date"
                            name="expiryDate"
                            value={formData.expiryDate}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Applicable departments (leave empty for all)
                    </label>
                    <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-4">
                        {departments.map(dept => (
                            <label key={dept} className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.applicableDepartments.includes(dept)}
                                    onChange={() => handleDepartmentChange(dept)}
                                    className="rounded"
                                />
                                <span className="text-sm">{dept}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            name="requiresAcknowledgment"
                            checked={formData.requiresAcknowledgment}
                            onChange={handleChange}
                            className="rounded"
                        />
                        <span className="text-sm font-medium text-gray-700">Require employee acknowledgment</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            name="isActive"
                            checked={formData.isActive}
                            onChange={handleChange}
                            className="rounded"
                        />
                        <span className="text-sm font-medium text-gray-700">Policy is active</span>
                    </label>
                </div>

                <div className="flex gap-4">
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-theme-primary text-white px-6 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save changes'}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/admin/policies')}
                        className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EditPolicy;
