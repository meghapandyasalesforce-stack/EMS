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

/**
 * Mirror server usesMonthlyAccrual: Fixed/Monthly (or frequency monthly) need days/month.
 * On Anniversary / Yearly / Proportional grant from Amount only — monthly is optional.
 */
const needsMonthlyEntitlement = (leaveType) => {
    if (leaveType?.enabled === false || leaveType?.type === 'loss_of_pay') return false;
    const method = String(leaveType?.accrual?.method || 'fixed').toLowerCase();
    const frequency = String(leaveType?.accrual?.frequency || 'yearly').toLowerCase();
    return method === 'monthly' || method === 'fixed' || frequency === 'monthly';
};

/** Map API policy leave type → form fields (Amount = annual, Monthly entitlement = monthly rate). */
const mapLeaveTypeToForm = (leaveType) => {
    if (!leaveType) return { ...DEFAULT_LEAVE_TYPE, uiAnnualAmount: 6, uiMonthlyEntitlement: 0.5 };
    const lt = JSON.parse(JSON.stringify(leaveType));
    lt.uiAnnualAmount = Number(lt.accrual?.maxAccrual) || 0;
    const monthly = Number(lt.accrual?.amount) || Number(lt.maxDaysPerMonth) || 0;
    lt.uiMonthlyEntitlement = monthly > 0 ? monthly : needsMonthlyEntitlement(lt) ? '' : 0;
    return lt;
};

/** Map form → API: Amount → maxAccrual, Monthly Entitlement → amount + maxDaysPerMonth. */
const mapLeaveTypeToApi = (leaveType) => {
    const lt = JSON.parse(JSON.stringify(leaveType));
    const annual = Number(lt.uiAnnualAmount ?? lt.accrual?.maxAccrual) || 0;
    const method = lt.accrual?.method || 'fixed';
    const frequency = lt.accrual?.frequency || 'yearly';
    const usesMonthly = needsMonthlyEntitlement({
        ...lt,
        accrual: { ...(lt.accrual || {}), method, frequency },
    });
    const rawMonthly = Number(lt.uiMonthlyEntitlement ?? lt.accrual?.amount);
    const monthly = usesMonthly
        ? (Number.isFinite(rawMonthly) && rawMonthly > 0 ? rawMonthly : 0)
        : 0;
    delete lt.uiAnnualAmount;
    delete lt.uiMonthlyEntitlement;

    lt.accrual = {
        ...(lt.accrual || {}),
        method,
        frequency,
        maxAccrual: annual,
        // Schema requires amount ≥ 0; lump-sum methods store 0 (grant uses maxAccrual).
        amount: monthly,
        anniversaryBased: method === 'on_anniversary' || frequency === 'on_anniversary',
    };
    lt.maxDaysPerMonth = monthly > 0 ? monthly : null;
    return lt;
};

const toIdString = (value) => {
    if (value == null || value === '') return '';
    if (typeof value === 'object') {
        if (value._id != null) return String(value._id);
        return '';
    }
    return String(value);
};

const formatDateInput = (value) => {
    if (!value) return new Date().toISOString().split('T')[0];
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
    return d.toISOString().split('T')[0];
};

const emptyPolicyForm = () => ({
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
        autoAdjustDates: false,
    },
});

const mapPolicyToForm = (policy) => ({
    ...emptyPolicyForm(),
    ...policy,
    effectiveDate: formatDateInput(policy?.effectiveDate),
    expiryDate: policy?.expiryDate ? formatDateInput(policy.expiryDate) : '',
    applicableTo: policy?.applicableTo || 'all',
    applicableDepartments: (policy?.applicableDepartments || [])
        .map((d) => String(d || '').trim())
        .filter(Boolean),
    applicableRoles: (policy?.applicableRoles || []).map(toIdString).filter(Boolean),
    applicableEmployees: (policy?.applicableEmployees || []).map(toIdString).filter(Boolean),
    leaveTypes: (policy?.leaveTypes || []).map(mapLeaveTypeToForm),
});

const mapFormToApi = (formData) => {
    const applicableTo = formData.applicableTo || 'all';
    const payload = {
        ...formData,
        leaveTypes: (formData.leaveTypes || []).map(mapLeaveTypeToApi),
        applicableTo,
        applicableDepartments:
            applicableTo === 'department'
                ? [...new Set((formData.applicableDepartments || []).map((d) => String(d).trim()).filter(Boolean))]
                : [],
        applicableRoles:
            applicableTo === 'role'
                ? [...new Set((formData.applicableRoles || []).map(toIdString).filter(Boolean))]
                : [],
        applicableEmployees:
            applicableTo === 'employee'
                ? [...new Set((formData.applicableEmployees || []).map(toIdString).filter(Boolean))]
                : [],
    };
    if (!payload.expiryDate) {
        delete payload.expiryDate;
    }
    return payload;
};

const validateApplicabilityClient = (formData) => {
    const applicableTo = formData.applicableTo || 'all';
    if (applicableTo === 'department' && !(formData.applicableDepartments || []).length) {
        return 'Select at least one department for this policy.';
    }
    if (applicableTo === 'role' && !(formData.applicableRoles || []).length) {
        return 'Select at least one role for this policy.';
    }
    if (applicableTo === 'employee' && !(formData.applicableEmployees || []).length) {
        return 'Select at least one employee for this policy.';
    }
    return null;
};

const formatApplicabilitySummary = (policy) => {
    const applicableTo = policy?.applicableTo || 'all';
    if (applicableTo === 'all') return 'All employees';
    if (applicableTo === 'department') {
        const depts = policy.applicableDepartments || [];
        return depts.length ? `Dept: ${depts.join(', ')}` : 'Department (none selected)';
    }
    if (applicableTo === 'role') {
        const roles = (policy.applicableRoles || []).map((r) =>
            typeof r === 'object' ? r.name || toIdString(r) : String(r)
        );
        return roles.length ? `Role: ${roles.join(', ')}` : 'Role (none selected)';
    }
    if (applicableTo === 'employee') {
        const people = (policy.applicableEmployees || []).map((e) =>
            typeof e === 'object' ? e.name || e.employeeId || toIdString(e) : String(e)
        );
        return people.length
            ? `Employees: ${people.slice(0, 3).join(', ')}${people.length > 3 ? ` +${people.length - 3}` : ''}`
            : 'Employees (none selected)';
    }
    return applicableTo;
};

const monthlyEntitlementHelp = (leaveType) => {
    const annual = Number(leaveType.uiAnnualAmount ?? leaveType.accrual?.maxAccrual) || 0;
    const monthly = Number(leaveType.uiMonthlyEntitlement ?? leaveType.accrual?.amount) || 0;
    const method = String(leaveType?.accrual?.method || 'fixed').toLowerCase();

    if (!needsMonthlyEntitlement(leaveType)) {
        if (method === 'on_anniversary') {
            return `Full Amount (${annual || 0} day(s)) is granted on the employee’s join anniversary. Monthly entitlement is not used.`;
        }
        if (method === 'yearly') {
            return `Full Amount (${annual || 0} day(s)) is granted at the start of the leave year (once employed). Monthly entitlement is not used.`;
        }
        if (method === 'proportional') {
            return `Amount (${annual || 0} day(s)) is pro-rated by months of service. Monthly entitlement is not used.`;
        }
        return 'Monthly entitlement is not required for this accrual method.';
    }
    if (monthly <= 0) {
        return 'Required for Fixed/Monthly accrual. Defines how many days accrue each month.';
    }
    return `Accrues ${monthly} day(s)/month (max ${annual}/year in balance). Unused months roll into available balance.`;
};

const LeavePolicyManagement = () => {
    const [policies, setPolicies] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState(null);
    const [togglingPolicyId, setTogglingPolicyId] = useState(null);
    const [formData, setFormData] = useState(emptyPolicyForm);
    const [departmentOptions, setDepartmentOptions] = useState([]);
    const [roleOptions, setRoleOptions] = useState([]);
    const [employeeOptions, setEmployeeOptions] = useState([]);
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [customDepartment, setCustomDepartment] = useState('');
    const [loadingApplicability, setLoadingApplicability] = useState(false);

    useEffect(() => {
        fetchPolicies();
    }, []);

    useEffect(() => {
        if (!showForm) return;
        loadApplicabilityOptions(employeeSearch);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showForm]);

    useEffect(() => {
        if (!showForm || formData.applicableTo !== 'employee') return;
        const timer = setTimeout(() => {
            loadApplicabilityOptions(employeeSearch);
        }, 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [employeeSearch, formData.applicableTo, showForm]);

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

    const loadApplicabilityOptions = async (search = '') => {
        setLoadingApplicability(true);
        try {
            const deptSet = new Set();

            // Org-configured departments (admin); ignore 403 for HR.
            try {
                const orgRes = await axios.get('/v1/admin/organization/profile');
                const orgDepts = orgRes.data?.organization?.orgDepartments || [];
                orgDepts.forEach((d) => {
                    const name = typeof d === 'object' ? d.name : d;
                    if (name && String(name).trim()) deptSet.add(String(name).trim());
                });
            } catch {
                /* optional for non-admin */
            }

            // Roles (admin/HR/executive)
            try {
                const rolesRes = await axios.get('/v1/admin/roles');
                const roles = Array.isArray(rolesRes.data)
                    ? rolesRes.data
                    : rolesRes.data?.roles || [];
                setRoleOptions(
                    roles
                        .filter((r) => r && r._id && r.isActive !== false)
                        .map((r) => ({ _id: String(r._id), name: r.name || 'Untitled role' }))
                        .sort((a, b) => a.name.localeCompare(b.name))
                );
            } catch {
                setRoleOptions([]);
            }

            // Employees — departments + employee picker
            let employees = [];
            try {
                const empRes = await axios.get('/v1/admin/employee', {
                    params: {
                        page: 1,
                        limit: 100,
                        ...(search.trim() ? { search: search.trim() } : {}),
                    },
                });
                employees = Array.isArray(empRes.data?.data)
                    ? empRes.data.data
                    : Array.isArray(empRes.data?.employees)
                      ? empRes.data.employees
                      : [];
            } catch {
                try {
                    const empRes = await axios.get('/v1/employee/auth/get-all-employees');
                    employees = Array.isArray(empRes.data)
                        ? empRes.data
                        : empRes.data?.employees || [];
                    if (search.trim()) {
                        const q = search.trim().toLowerCase();
                        employees = employees.filter((e) => {
                            const hay = `${e.name || ''} ${e.email || ''} ${e.employeeId || ''} ${e.department || ''}`.toLowerCase();
                            return hay.includes(q);
                        });
                    }
                } catch {
                    employees = [];
                }
            }

            employees.forEach((e) => {
                if (e?.department && String(e.department).trim()) {
                    deptSet.add(String(e.department).trim());
                }
            });

            // Keep currently selected departments even if not in live options
            (formData.applicableDepartments || []).forEach((d) => {
                if (d && String(d).trim()) deptSet.add(String(d).trim());
            });

            setDepartmentOptions([...deptSet].sort((a, b) => a.localeCompare(b)));
            setEmployeeOptions((prev) => {
                const mapped = employees.map((e) => ({
                    _id: String(e._id),
                    name: e.name || 'Unnamed',
                    email: e.email || '',
                    employeeId: e.employeeId || '',
                    department: e.department || '',
                }));
                // Preserve previously selected rows so checkboxes stay labeled after search.
                const byId = new Map(mapped.map((p) => [p._id, p]));
                prev.forEach((p) => {
                    if ((formData.applicableEmployees || []).includes(p._id) && !byId.has(p._id)) {
                        byId.set(p._id, p);
                    }
                });
                return [...byId.values()];
            });
        } finally {
            setLoadingApplicability(false);
        }
    };

    const toggleListValue = (field, value) => {
        setFormData((prev) => {
            const list = prev[field] || [];
            const exists = list.includes(value);
            return {
                ...prev,
                [field]: exists ? list.filter((v) => v !== value) : [...list, value],
            };
        });
    };

    const handleApplicableToChange = (value) => {
        setFormData((prev) => ({
            ...prev,
            applicableTo: value,
            // Keep selections so switching back doesn't wipe work; API clears unused scopes.
        }));
        if (value === 'employee') {
            loadApplicabilityOptions(employeeSearch);
        }
    };

    const addCustomDepartment = () => {
        const name = customDepartment.trim();
        if (!name) return;
        setDepartmentOptions((prev) =>
            prev.includes(name) ? prev : [...prev, name].sort((a, b) => a.localeCompare(b))
        );
        setFormData((prev) => ({
            ...prev,
            applicableDepartments: prev.applicableDepartments.includes(name)
                ? prev.applicableDepartments
                : [...prev.applicableDepartments, name],
        }));
        setCustomDepartment('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const applicabilityError = validateApplicabilityClient(formData);
        if (applicabilityError) {
            toast.error(applicabilityError);
            return;
        }
        if (!(formData.leaveTypes || []).length) {
            toast.error('Add at least one leave type');
            return;
        }
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
        setFormData(emptyPolicyForm());
        setEmployeeSearch('');
        setCustomDepartment('');
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
            const next = updated[index];

            // Lump-sum methods pair with yearly frequency so monthly entitlement stays optional.
            if (field === 'accrual.method') {
                const method = String(value || '').toLowerCase();
                if (method === 'on_anniversary' || method === 'yearly' || method === 'proportional') {
                    if (!next.accrual) next.accrual = {};
                    next.accrual.frequency = 'yearly';
                }
                if (method === 'monthly') {
                    if (!next.accrual) next.accrual = {};
                    next.accrual.frequency = 'monthly';
                }
            }

            if (needsMonthlyEntitlement(next)) {
                const currentMonthly = Number(next.uiMonthlyEntitlement ?? next.accrual?.amount);
                if (!Number.isFinite(currentMonthly) || currentMonthly <= 0) {
                    const annual = Number(next.uiAnnualAmount ?? next.accrual?.maxAccrual) || 0;
                    next.uiMonthlyEntitlement = annual > 0 ? annual / 12 : 0.5;
                }
            } else {
                // Lump-sum methods: clear monthly so save is not blocked / not misinterpreted
                next.uiMonthlyEntitlement = '';
            }
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
                                onChange={(e) => handleApplicableToChange(e.target.value)}
                                className="w-full border rounded px-3 py-2"
                            >
                                <option value="all">All Employees</option>
                                <option value="department">Department</option>
                                <option value="role">Role</option>
                                <option value="employee">Specific Employees</option>
                            </select>
                        </div>
                    </div>

                    {formData.applicableTo === 'department' && (
                        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                            <label className="block text-sm font-medium mb-1">
                                Departments *
                            </label>
                            <p className="text-xs text-gray-500 mb-2">
                                Policy applies only to employees in the selected department(s).
                                Names must match the employee’s department field.
                            </p>
                            {loadingApplicability && departmentOptions.length === 0 ? (
                                <p className="text-sm text-gray-500">Loading departments…</p>
                            ) : departmentOptions.length === 0 ? (
                                <p className="text-sm text-amber-700 mb-2">
                                    No departments found yet. Add one below (must match employee
                                    records).
                                </p>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white p-3">
                                    {departmentOptions.map((dept) => (
                                        <label
                                            key={dept}
                                            className="flex items-center gap-2 cursor-pointer text-sm"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={formData.applicableDepartments.includes(
                                                    dept
                                                )}
                                                onChange={() =>
                                                    toggleListValue('applicableDepartments', dept)
                                                }
                                                className="rounded"
                                            />
                                            <span>{dept}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                            <div className="mt-3 flex flex-col sm:flex-row gap-2">
                                <input
                                    type="text"
                                    value={customDepartment}
                                    onChange={(e) => setCustomDepartment(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addCustomDepartment();
                                        }
                                    }}
                                    placeholder="Add department name"
                                    className="flex-1 border rounded px-3 py-2 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={addCustomDepartment}
                                    className="px-4 py-2 text-sm rounded bg-slate-800 text-white hover:bg-slate-700"
                                >
                                    Add
                                </button>
                            </div>
                            {formData.applicableDepartments.length > 0 && (
                                <p className="mt-2 text-xs text-slate-600">
                                    Selected: {formData.applicableDepartments.join(', ')}
                                </p>
                            )}
                        </div>
                    )}

                    {formData.applicableTo === 'role' && (
                        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                            <label className="block text-sm font-medium mb-1">Roles *</label>
                            <p className="text-xs text-gray-500 mb-2">
                                Policy applies to employees with the selected hierarchy role
                                (assigned role on the employee profile).
                            </p>
                            {loadingApplicability && roleOptions.length === 0 ? (
                                <p className="text-sm text-gray-500">Loading roles…</p>
                            ) : roleOptions.length === 0 ? (
                                <p className="text-sm text-amber-700">
                                    No roles found. Create roles under Users &amp; Roles first, then
                                    assign them to employees.
                                </p>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white p-3">
                                    {roleOptions.map((role) => (
                                        <label
                                            key={role._id}
                                            className="flex items-center gap-2 cursor-pointer text-sm"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={formData.applicableRoles.includes(
                                                    role._id
                                                )}
                                                onChange={() =>
                                                    toggleListValue('applicableRoles', role._id)
                                                }
                                                className="rounded"
                                            />
                                            <span>{role.name}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {formData.applicableTo === 'employee' && (
                        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                            <label className="block text-sm font-medium mb-1">
                                Specific Employees *
                            </label>
                            <p className="text-xs text-gray-500 mb-2">
                                Policy applies only to the employees you select.
                            </p>
                            <input
                                type="search"
                                value={employeeSearch}
                                onChange={(e) => setEmployeeSearch(e.target.value)}
                                placeholder="Search by name, email, or employee ID"
                                className="w-full border rounded px-3 py-2 text-sm mb-2"
                            />
                            {loadingApplicability && employeeOptions.length === 0 ? (
                                <p className="text-sm text-gray-500">Loading employees…</p>
                            ) : (
                                <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg bg-white divide-y">
                                    {employeeOptions.length === 0 ? (
                                        <p className="p-3 text-sm text-gray-500">No employees found.</p>
                                    ) : (
                                        employeeOptions.map((emp) => (
                                            <label
                                                key={emp._id}
                                                className="flex items-start gap-2 cursor-pointer p-3 text-sm hover:bg-slate-50"
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="mt-1 rounded"
                                                    checked={formData.applicableEmployees.includes(
                                                        emp._id
                                                    )}
                                                    onChange={() =>
                                                        toggleListValue(
                                                            'applicableEmployees',
                                                            emp._id
                                                        )
                                                    }
                                                />
                                                <span>
                                                    <span className="font-medium text-slate-800">
                                                        {emp.name}
                                                    </span>
                                                    <span className="block text-xs text-slate-500">
                                                        {[emp.employeeId, emp.email, emp.department]
                                                            .filter(Boolean)
                                                            .join(' · ')}
                                                    </span>
                                                </span>
                                            </label>
                                        ))
                                    )}
                                </div>
                            )}
                            {formData.applicableEmployees.length > 0 && (
                                <p className="mt-2 text-xs text-slate-600">
                                    {formData.applicableEmployees.length} employee
                                    {formData.applicableEmployees.length === 1 ? '' : 's'} selected
                                </p>
                            )}
                        </div>
                    )}

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
                                                {needsMonthlyEntitlement(leaveType) ? ' *' : ''}
                                            </label>
                                            <input
                                                type="number"
                                                value={
                                                    leaveType.uiMonthlyEntitlement === '' ||
                                                    leaveType.uiMonthlyEntitlement == null
                                                        ? ''
                                                        : leaveType.uiMonthlyEntitlement
                                                }
                                                onChange={(e) => {
                                                    const raw = e.target.value;
                                                    updateLeaveType(
                                                        index,
                                                        'uiMonthlyEntitlement',
                                                        raw === '' ? '' : parseFloat(raw)
                                                    );
                                                }}
                                                className="w-full border rounded px-3 py-2"
                                                min="0"
                                                step="0.5"
                                                required={needsMonthlyEntitlement(leaveType)}
                                                placeholder={
                                                    needsMonthlyEntitlement(leaveType)
                                                        ? 'e.g. 0.5'
                                                        : 'Not required'
                                                }
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
                                <td className="px-6 py-4 text-sm text-slate-700 max-w-xs">
                                    {formatApplicabilitySummary(policy)}
                                </td>
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
                                            const mapped = mapPolicyToForm(policy);
                                            setFormData(mapped);
                                            // Seed picker with already-selected people (may be outside first page / search).
                                            const selectedPeople = (policy.applicableEmployees || [])
                                                .filter((e) => e && typeof e === 'object' && e._id)
                                                .map((e) => ({
                                                    _id: String(e._id),
                                                    name: e.name || 'Unnamed',
                                                    email: e.email || '',
                                                    employeeId: e.employeeId || '',
                                                    department: e.department || '',
                                                }));
                                            if (selectedPeople.length) {
                                                setEmployeeOptions((prev) => {
                                                    const byId = new Map(prev.map((p) => [p._id, p]));
                                                    selectedPeople.forEach((p) => byId.set(p._id, p));
                                                    return [...byId.values()];
                                                });
                                            }
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

