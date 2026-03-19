import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../utils/axios';
import { ORGANIZATION_POLICIES_ENDPOINT } from '../../utils/constant';
import { toast } from 'react-toastify';
import logger from '../../utils/logger';

const CreatePolicy = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        policyType: 'custom',
        title: '',
        description: '',
        content: '',
        effectiveDate: new Date().toISOString().split('T')[0],
        expiryDate: '',
        requiresAcknowledgment: false,
        applicableDepartments: [],
        rules: []
    });
    const [loading, setLoading] = useState(false);

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
        setLoading(true);

        try {
            await axios.post(ORGANIZATION_POLICIES_ENDPOINT, formData);
            toast.success('Policy created successfully');
            navigate('/admin/policies');
        } catch (error) {
            logger.error('Error creating policy', { error: error.message, response: error.response?.data });
            toast.error(error.response?.data?.message || 'Failed to create policy');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Create Company Policy</h1>
                <p className="text-gray-600 mt-2">Define a new policy for your organization</p>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
                {/* Policy Type */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Policy Type *
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

                {/* Title */}
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

                {/* Description */}
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

                {/* Content */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Policy Content *
                    </label>
                    <textarea
                        name="content"
                        value={formData.content}
                        onChange={handleChange}
                        rows="10"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary"
                        placeholder="Enter the full policy content here..."
                        required
                    />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Effective Date *
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
                            Expiry Date (Optional)
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

                {/* Applicable Departments */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Applicable Departments (Leave empty for all departments)
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

                {/* Requires Acknowledgment */}
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        name="requiresAcknowledgment"
                        checked={formData.requiresAcknowledgment}
                        onChange={handleChange}
                        className="rounded"
                    />
                    <label className="text-sm font-medium text-gray-700">
                        Require employee acknowledgment
                    </label>
                </div>

                {/* Buttons */}
                <div className="flex gap-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-theme-primary text-white px-6 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
                    >
                        {loading ? 'Creating...' : 'Create Policy'}
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

export default CreatePolicy;

