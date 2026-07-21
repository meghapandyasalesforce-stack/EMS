import React, { useState, useEffect } from 'react';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';

const DEFAULT_LEAVE_TYPE = {
    enabled: true,
    type: 'casual',
    displayName: 'Casual Leave',
    accrual: {
        method: 'fixed',
        amount: 0.5,
        frequency: 'yearly',
        maxAccrual: 6,
    },
    maxDaysPerMonth: 0.5,
    carryForward: {
        enabled: false,
        maxDays: null,
    },
    requiresApproval: true,
    requiresDocument: false,
    isPaid: true,
    minDaysPerRequest: 0.5,
    maxDaysPerRequest: null,
    encashment: {
        enabled: false,
        maxDaysPerYear: 0,
        calculationMethod: 'daily_salary',
    },
    probationRestrictions: {
        enabled: false,
        minServiceDays: 0,
        maxDaysDuringProbation: 0,
    },
    noticePeriodRestrictions: {
        enabled: false,
        minNoticeDays: 0,
    },
};

/** Map API policy leave type → form fields (Amount = annual, Monthly entitlement = monthly rate). */
const mapLeaveTypeToForm = (leaveType) => {
    if (!leaveType) return { ...DEFAULT_LEAVE_TYPE, uiAnnualAmount: 6, uiMonthlyEntitlement: 0.5 };
    const lt = JSON.parse(JSON.stringify(leaveType));
    lt.uiAnnualAmount = Number(lt.accrual?.maxAccrual) || 0;
    lt.uiMonthlyEntitlement = Number(lt.accrual?.amount) || Number(lt.maxDaysPerMonth) || 0;
    return lt;
};

/** Map form → API: Amount → maxAccrual, Monthly Entitlement → amount + maxDaysPerMonth. */
const mapLeaveTypeToApi = (leaveType) => {
    const lt = JSON.parse(JSON.stringify(leaveType));
    const annual = Number(lt.uiAnnualAmount ?? lt.accrual?.maxAccrual) || 0;
    const monthly = Number(lt.uiMonthlyEntitlement ?? lt.accrual?.amount) || 0;
    delete lt.uiAnnualAmount;
    delete lt.uiMonthlyEntitlement;

    lt.accrual = {
        ...(lt.accrual || {}),
        method: lt.accrual?.method || 'fixed',
        frequency: lt.accrual?.frequency || 'yearly',
        maxAccrual: annual,
        amount: monthly,
    };
    lt.maxDaysPerMonth = monthly > 0 ? monthly : null;
    return lt;
};

const mapPolicyToForm = (policy) => ({
    ...policy,
    leaveTypes: (policy?.leaveTypes || []).map(mapLeaveTypeToForm),
});

const mapFormToApi = (formData) => ({
    ...formData,
    leaveTypes: (formData.leaveTypes || []).map(mapLeaveTypeToApi),
});

const monthlyEntitlementHelp = (leaveType) => {
    const annual = Number(leaveType.uiAnnualAmount ?? leaveType.accrual?.maxAccrual) || 0;
    const monthly = Number(leaveType.uiMonthlyEntitlement ?? leaveType.accrual?.amount) || 0;
    if (monthly <= 0) {
        return 'Set monthly entitlement to define how many days accrue each month.';
    }
    return `Accrues ${monthly} day(s)/month (max ${annual}/year in balance). Unused months roll into available balance. Same value limits max days taken per calendar month.`;
};

const LeavePolicyManagement = () => {
    const [policies, setPolicies] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState(null);
    const [togglingPolicyId, setTogglingPolicyId] = useState(null);
    const [formData, setFormData] = useState({
        policyName: '',
        description: '',
        effectiveDate: new Date().toISOString().split('T')[0],
        expiryDate: '',
        isActive: true,
        applicableTo: 'all',
        applicableDepartments: [],
        applicableRoles: [],
        applicableEmployees: [],
        leaveTypes: [
            {
                ...DEFAULT_LEAVE_TYPE,
                uiAnnualAmount: 6,
                uiMonthlyEntitlement: 0.5,
            },
        ],
        blackoutDates: [],
        dateHandlingRules: {
            countWeekends: false,
            countHolidays: false,
            autoAdjustDates: false
        }
    });

    useEffect(() => {
        fetchPolicies();
    }, []);

    const fetchPolicies = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/v1/admin/leave-policy');
            setPolicies(res.data.policies || []);
        } catch (error) {
            toast.error('Failed to fetch leave policies');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent bubbling to parent form
        setLoading(true);
        try {
            const url = editingPolicy
                ? `/v1/admin/leave-policy/${editingPolicy._id}`
                : '/v1/admin/leave-policy';
            
            const method = editingPolicy ? 'put' : 'post';
            await axios[method](url, mapFormToApi(formData));
            
            toast.success(`Policy ${editingPolicy ? 'updated' : 'created'} successfully`);
            await fetchPolicies();
            setShowForm(false);
            setEditingPolicy(null);
            resetForm();
        } catch (error) {
            toast.error('Error saving policy: ' + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePolicy = async (policy) => {
        if (!policy?._id) return;
        try {
            setTogglingPolicyId(policy._id);
            const newIsActive = !policy.isActive;

            const ok = window.confirm(
                newIsActive
                    ? `Activate policy "${policy.policyName}"? This will affect leave requests immediately.`
                    : `Deactivate policy "${policy.policyName}"? This will stop it from applying to employees.`
            );
            if (!ok) return;

            await axios.put(`/v1/admin/leave-policy/${policy._id}`, {
                isActive: newIsActive
            });

            // Auto-recalculate balances so changes reflect immediately.
            // Current UI shows balances by year; we recalculate current year.
            await axios.post('/v1/admin/leave-policy/balance/recalculate', {
                year: new Date().getFullYear()
            });

            toast.success(`Policy ${newIsActive ? 'activated' : 'deactivated'} and balances recalculated`);
            await fetchPolicies();
        } catch (error) {
            toast.error('Failed to update policy: ' + (error.response?.data?.message || error.message));
        } finally {
            setTogglingPolicyId(null);
        }
    };

    const resetForm = () => {
        setFormData({
            policyName: '',
            description: '',
            effectiveDate: new Date().toISOString().split('T')[0],
            expiryDate: '',
            isActive: true,
            applicableTo: 'all',
            applicableDepartments: [],
            applicableRoles: [],
            applicableEmployees: [],
            leaveTypes: []
        });
    };

    const addLeaveType = () => {
        setFormData({
            ...formData,
            leaveTypes: [
                ...formData.leaveTypes,
                {
                    ...DEFAULT_LEAVE_TYPE,
                    displayName: '',
                    uiAnnualAmount: 6,
                    uiMonthlyEntitlement: 0.5,
                },
            ],
        });
    };

    const removeLeaveType = (index) => {
        const updated = formData.leaveTypes.filter((_, i) => i !== index);
        setFormData({ ...formData, leaveTypes: updated });
    };

    const updateLeaveType = (index, field, value) => {
        const updated = [...formData.leaveTypes];
        if (field.includes('.')) {
            const parts = field.split('.');
            let target = updated[index];
            for (let i = 0; i < parts.length - 1; i++) {
                if (!target[parts[i]]) target[parts[i]] = {};
                target = target[parts[i]];
            }
            target[parts[parts.length - 1]] = value;
        } else {
            updated[index][field] = value;
        }

        if (field === 'accrual.method' || field === 'accrual.frequency') {
            updated[index].uiAnnualAmount =
                updated[index].uiAnnualAmount ?? updated[index].accrual?.maxAccrual ?? 0;
            updated[index].uiMonthlyEntitlement =
                updated[index].uiMonthlyEntitlement ?? updated[index].accrual?.amount ?? 0;
        }

        setFormData({ ...formData, leaveTypes: updated });
    };

    if (loading && !showForm) {
        return <div className="p-3 sm:p-4">Loading...</div>;
    }

    return (
        <div className="p-3 sm:p-4">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold">Leave Policy Management</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Configure leave types and accrual rules. This is a one-time setup that applies to all years.
                    </p>
                </div>
                <button
                    onClick={() => {
                        setShowForm(!showForm);
                        if (showForm) {
                            setEditingPolicy(null);
                            resetForm();
                        }
                    }}
                    className="bg-theme-primary text-white px-4 py-2 rounded-lg hover:opacity-90"
                >
                    {showForm ? 'Cancel' : (policies.length > 0 ? 'Update Policy' : 'Create Policy')}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow mb-6">
                    <h3 className="text-xl font-semibold mb-4">
                        {editingPolicy ? 'Edit Policy' : 'Create New Policy'}
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Policy Name *</label>
                            <input
                                type="text"
                                value={formData.policyName}
                                onChange={(e) => setFormData({ ...formData, policyName: e.target.value })}
                                className="w-full border rounded px-3 py-2"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Applicable To</label>
                            <select
                                value={formData.applicableTo}
                                onChange={(e) => setFormData({ ...formData, applicableTo: e.target.value })}
                                className="w-full border rounded px-3 py-2"
                            >
                                <option value="all">All Employees</option>
                                <option value="department">Department</option>
                                <option value="role">Role</option>
                                <option value="employee">Specific Employees</option>
                            </select>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full border rounded px-3 py-2"
                            rows="3"
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">Effective Date *</label>
                        <input
                            type="date"
                            value={formData.effectiveDate}
                            onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                            className="w-full border rounded px-3 py-2"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            This policy will apply to all years once set. It's a one-time configuration.
                        </p>
                    </div>

                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium">Leave Types *</label>
                            <button
                                type="button"
                                onClick={addLeaveType}
                                className="text-theme-secondary hover:text-theme-secondary text-sm"
                            >
                                + Add Leave Type
                            </button>
                        </div>
                        
                        {formData.leaveTypes.map((leaveType, index) => (
                            <div key={index} className="border p-4 rounded mb-2">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-medium">Leave Type {index + 1}</h4>
                                    {formData.leaveTypes.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeLeaveType(index)}
                                            className="text-red-600 hover:text-red-700 text-sm"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-2">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Type *</label>
                                        <select
                                            value={leaveType.type}
                                            onChange={(e) => updateLeaveType(index, 'type', e.target.value)}
                                            className="w-full border rounded px-3 py-2"
                                            required
                                        >
                                            <option value="casual">Casual</option>
                                            <option value="paid">Paid</option>
                                            <option value="sick">Sick</option>
                                            <option value="maternity">Maternity</option>
                                            <option value="paternity">Paternity</option>
                                            <option value="vacation">Vacation</option>
                                            <option value="privileged">Privileged</option>
                                            <option value="compensatory">Compensatory</option>
                                            <option value="sabbatical">Sabbatical</option>
                                            <option value="loss_of_pay">Loss of Pay</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Display Name *</label>
                                        <input
                                            type="text"
                                            value={leaveType.displayName}
                                            onChange={(e) => updateLeaveType(index, 'displayName', e.target.value)}
                                            className="w-full border rounded px-3 py-2"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Accrual Method *</label>
                                        <select
                                            value={leaveType.accrual?.method || 'fixed'}
                                            onChange={(e) => updateLeaveType(index, 'accrual.method', e.target.value)}
                                            className="w-full border rounded px-3 py-2"
                                        >
                                            <option value="fixed">Fixed</option>
                                            <option value="monthly">Monthly</option>
                                            <option value="yearly">Yearly</option>
                                            <option value="proportional">Proportional</option>
                                            <option value="on_anniversary">On Anniversary</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Amount *</label>
                                        <input
                                            type="number"
                                            value={leaveType.uiAnnualAmount ?? leaveType.accrual?.maxAccrual ?? ''}
                                            onChange={(e) => updateLeaveType(index, 'uiAnnualAmount', parseFloat(e.target.value))}
                                            className="w-full border rounded px-3 py-2"
                                            min="0"
                                            step="0.5"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Frequency</label>
                                        <select
                                            value={leaveType.accrual?.frequency || 'yearly'}
                                            onChange={(e) => updateLeaveType(index, 'accrual.frequency', e.target.value)}
                                            className="w-full border rounded px-3 py-2"
                                        >
                                            <option value="yearly">Yearly</option>
                                            <option value="monthly">Monthly</option>
                                            <option value="daily">Daily</option>
                                            <option value="on_anniversary">On Anniversary</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-2">
                                    <div>
                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={leaveType.carryForward?.enabled || false}
                                                onChange={(e) => updateLeaveType(index, 'carryForward.enabled', e.target.checked)}
                                                className="mr-2"
                                            />
                                            Enable Carry Forward
                                        </label>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={leaveType.enabled !== false}
                                                onChange={(e) => updateLeaveType(index, 'enabled', e.target.checked)}
                                                className="mr-2"
                                            />
                                            Enabled
                                        </label>
                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={leaveType.requiresApproval}
                                                onChange={(e) => updateLeaveType(index, 'requiresApproval', e.target.checked)}
                                                className="mr-2"
                                            />
                                            Requires Approval
                                        </label>
                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(leaveType.requiresDocument)}
                                                onChange={(e) => updateLeaveType(index, 'requiresDocument', e.target.checked)}
                                                className="mr-2"
                                            />
                                            Requires Document
                                        </label>
                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={leaveType.isPaid}
                                                onChange={(e) => updateLeaveType(index, 'isPaid', e.target.checked)}
                                                className="mr-2"
                                            />
                                            Paid Leave
                                        </label>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">
                                                Monthly entitlement (days/month)
                                            </label>
                                            <input
                                                type="number"
                                                value={leaveType.uiMonthlyEntitlement ?? leaveType.accrual?.amount ?? ''}
                                                onChange={(e) =>
                                                    updateLeaveType(index, 'uiMonthlyEntitlement', parseFloat(e.target.value))
                                                }
                                                className="w-full border rounded px-3 py-2"
                                                min="0"
                                                step="0.5"
                                                required
                                            />
                                            <p className="mt-1 text-[11px] text-gray-500">
                                                {monthlyEntitlementHelp(leaveType)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t pt-3 mt-3">
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={leaveType.encashment?.enabled || false}
                                            onChange={(e) => updateLeaveType(index, 'encashment.enabled', e.target.checked)}
                                            className="mr-2"
                                        />
                                        Enable Leave Encashment
                                    </label>
                                </div>

                                <div className="border-t pt-3 mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={leaveType.probationRestrictions?.enabled || false}
                                            onChange={(e) => updateLeaveType(index, 'probationRestrictions.enabled', e.target.checked)}
                                            className="mr-2"
                                        />
                                        Probation Restrictions
                                    </label>
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={leaveType.noticePeriodRestrictions?.enabled || false}
                                            onChange={(e) => updateLeaveType(index, 'noticePeriodRestrictions.enabled', e.target.checked)}
                                            className="mr-2"
                                        />
                                        Notice Period
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Date Handling Rules */}
                    <div className="mb-4 border-t pt-4">
                        <h4 className="font-medium mb-3">Date Handling Rules</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={formData.dateHandlingRules?.countWeekends || false}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        dateHandlingRules: {
                                            ...formData.dateHandlingRules,
                                            countWeekends: e.target.checked
                                        }
                                    })}
                                    className="mr-2"
                                />
                                Count Weekends
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={formData.dateHandlingRules?.countHolidays || false}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        dateHandlingRules: {
                                            ...formData.dateHandlingRules,
                                            countHolidays: e.target.checked
                                        }
                                    })}
                                    className="mr-2"
                                />
                                Count Holidays
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={formData.dateHandlingRules?.autoAdjustDates || false}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        dateHandlingRules: {
                                            ...formData.dateHandlingRules,
                                            autoAdjustDates: e.target.checked
                                        }
                                    })}
                                    className="mr-2"
                                />
                                Auto Adjust Dates
                            </label>
                        </div>
                    </div>

                    {/* Blackout Dates */}
                    <div className="mb-4 border-t pt-4">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-medium">Blackout Dates</h4>
                            <button
                                type="button"
                                onClick={() => {
                                    setFormData({
                                        ...formData,
                                        blackoutDates: [
                                            ...(formData.blackoutDates || []),
                                            {
                                                startDate: '',
                                                endDate: '',
                                                reason: '',
                                                applicableLeaveTypes: [],
                                                isActive: true
                                            }
                                        ]
                                    });
                                }}
                                className="text-theme-secondary hover:text-theme-secondary text-sm"
                            >
                                + Add Blackout Period
                            </button>
                        </div>
                        {(formData.blackoutDates || []).map((blackout, index) => (
                            <div key={index} className="border p-3 rounded mb-2">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-medium">Blackout Period {index + 1}</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const updated = formData.blackoutDates.filter((_, i) => i !== index);
                                            setFormData({ ...formData, blackoutDates: updated });
                                        }}
                                        className="text-red-600 hover:text-red-700 text-xs"
                                    >
                                        Remove
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                                        <input
                                            type="date"
                                            value={blackout.startDate || ''}
                                            onChange={(e) => {
                                                const updated = [...formData.blackoutDates];
                                                updated[index].startDate = e.target.value;
                                                setFormData({ ...formData, blackoutDates: updated });
                                            }}
                                            className="w-full border rounded px-2 py-1 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1">End Date</label>
                                        <input
                                            type="date"
                                            value={blackout.endDate || ''}
                                            onChange={(e) => {
                                                const updated = [...formData.blackoutDates];
                                                updated[index].endDate = e.target.value;
                                                setFormData({ ...formData, blackoutDates: updated });
                                            }}
                                            className="w-full border rounded px-2 py-1 text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="mb-2">
                                    <label className="block text-xs text-gray-600 mb-1">Reason</label>
                                    <input
                                        type="text"
                                        value={blackout.reason || ''}
                                        onChange={(e) => {
                                            const updated = [...formData.blackoutDates];
                                            updated[index].reason = e.target.value;
                                            setFormData({ ...formData, blackoutDates: updated });
                                        }}
                                        placeholder="Reason for blackout"
                                        className="w-full border rounded px-2 py-1 text-sm"
                                    />
                                </div>
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={blackout.isActive !== false}
                                        onChange={(e) => {
                                            const updated = [...formData.blackoutDates];
                                            updated[index].isActive = e.target.checked;
                                            setFormData({ ...formData, blackoutDates: updated });
                                        }}
                                        className="mr-2"
                                    />
                                    <span className="text-xs">Active</span>
                                </label>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-4">
                        <button
                            type="submit"
                            className="bg-theme-primary text-white px-6 py-2 rounded-lg hover:opacity-90"
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : 'Save Policy'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setShowForm(false);
                                setEditingPolicy(null);
                                resetForm();
                            }}
                            className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                <table className="min-w-[640px] w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Policy Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leave Types</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applicable To</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {policies.map((policy) => (
                            <tr key={policy._id}>
                                <td className="px-6 py-4 whitespace-nowrap">{policy.policyName}</td>
                                <td className="px-6 py-4">
                                    {policy.leaveTypes?.map(lt => lt.displayName).join(', ')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap capitalize">{policy.applicableTo}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-3">
                                        <span
                                            className={`px-2 py-1 rounded ${
                                                policy.isActive
                                                    ? 'bg-theme-primary/10 text-theme-primary'
                                                    : 'bg-red-100 text-red-800'
                                            }`}
                                        >
                                            {policy.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleTogglePolicy(policy)}
                                            disabled={togglingPolicyId === policy._id}
                                            className={`text-xs font-semibold px-3 py-1 rounded ${
                                                policy.isActive
                                                    ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                                    : 'bg-green-50 text-green-700 hover:bg-green-100'
                                            } ${togglingPolicyId === policy._id ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            {togglingPolicyId === policy._id
                                                ? 'Updating...'
                                                : policy.isActive
                                                    ? 'Deactivate'
                                                    : 'Activate'}
                                        </button>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <button
                                        onClick={() => {
                                            setEditingPolicy(policy);
                                            setFormData(mapPolicyToForm(policy));
                                            setShowForm(true);
                                        }}
                                        className="text-theme-secondary hover:text-theme-secondary mr-3"
                                    >
                                        Edit
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
                {policies.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                        No leave policies found. Create one to get started.
                    </div>
                )}
            </div>
        </div>
    );
};

export default LeavePolicyManagement;

