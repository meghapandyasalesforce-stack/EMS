import React, { useEffect, useMemo, useState } from 'react';
import axios from '../../utils/axios';

const chipClass =
    'inline-flex items-center gap-1 rounded-full bg-[#20C997]/10 px-2.5 py-1 text-xs font-medium text-[#0d9488]';

const SurveyAudienceFields = ({
    targetAudience,
    targetDepartments = [],
    targetRoles = [],
    targetEmployees = [],
    onChange,
}) => {
    const [loading, setLoading] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [roles, setRoles] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        if (targetAudience === 'All Employees') return undefined;

        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setLoadError('');
            try {
                if (targetAudience === 'Department') {
                    const deptSet = new Set();
                    try {
                        const { data } = await axios.get('/v1/admin/organization/profile', {
                            withCredentials: true,
                        });
                        const org = data?.organization || data?.data?.organization || data?.data || {};
                        (org.orgDepartments || []).forEach((d) => {
                            const name = typeof d === 'object' ? d.name : d;
                            if (name?.trim()) deptSet.add(String(name).trim());
                        });
                    } catch {
                        /* org profile optional */
                    }

                    const empRes = await axios.get('/v1/employee/auth/get-all-employees', {
                        params: { page: 1, limit: 100, status: 'active' },
                        withCredentials: true,
                    });
                    const batch = Array.isArray(empRes.data?.data)
                        ? empRes.data.data
                        : Array.isArray(empRes.data)
                          ? empRes.data
                          : [];
                    batch.forEach((e) => {
                        if (e.status === 'inactive') return;
                        if (e.department?.trim()) deptSet.add(String(e.department).trim());
                    });

                    if (!cancelled) setDepartments([...deptSet].sort());
                }

                if (targetAudience === 'Role') {
                    const { data } = await axios.get('/v1/admin/roles', { withCredentials: true });
                    const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
                    if (!cancelled) {
                        setRoles(list.filter((r) => r.isActive !== false));
                    }
                }

                if (targetAudience === 'Specific Employees') {
                    const all = [];
                    let page = 1;
                    let hasMore = true;
                    while (hasMore && page <= 20) {
                        const { data } = await axios.get('/v1/employee/auth/get-all-employees', {
                            params: { page, limit: 100 },
                            withCredentials: true,
                        });
                        const batch = Array.isArray(data?.data)
                            ? data.data
                            : Array.isArray(data)
                              ? data
                              : [];
                        all.push(...batch.filter((e) => e.status !== 'inactive'));
                        const pagination = data?.pagination;
                        hasMore =
                            pagination?.hasNext === true ||
                            (batch.length === 100 && !pagination);
                        page += 1;
                    }
                    if (!cancelled) setEmployees(all);
                }
            } catch (error) {
                if (!cancelled) {
                    setLoadError(
                        error.response?.data?.message || 'Failed to load audience options'
                    );
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [targetAudience]);

    const filteredEmployees = useMemo(() => {
        const q = employeeSearch.trim().toLowerCase();
        if (!q) return employees;
        return employees.filter((e) => {
            const label = `${e.name || ''} ${e.lastName || ''} ${e.email || ''} ${e.employeeId || ''}`.toLowerCase();
            return label.includes(q);
        });
    }, [employees, employeeSearch]);

    const toggleDepartment = (dept) => {
        const next = targetDepartments.includes(dept)
            ? targetDepartments.filter((d) => d !== dept)
            : [...targetDepartments, dept];
        onChange({ targetDepartments: next });
    };

    const toggleRole = (roleId) => {
        const id = String(roleId);
        const current = targetRoles.map((r) => String(r));
        const next = current.includes(id)
            ? targetRoles.filter((r) => String(r) !== id)
            : [...targetRoles, roleId];
        onChange({ targetRoles: next });
    };

    const toggleEmployee = (empId) => {
        const id = String(empId);
        const current = targetEmployees.map((e) => String(e));
        const next = current.includes(id)
            ? targetEmployees.filter((e) => String(e) !== id)
            : [...targetEmployees, empId];
        onChange({ targetEmployees: next });
    };

    if (targetAudience === 'All Employees') return null;

    return (
        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/80 p-4">
            <p className="mb-2 text-sm font-medium text-gray-700">
                {targetAudience === 'Department' && 'Select departments'}
                {targetAudience === 'Role' && 'Select roles'}
                {targetAudience === 'Specific Employees' && 'Select employees'}
                <span className="ml-1 text-red-500">*</span>
            </p>

            {loading && (
                <p className="text-sm text-slate-500">Loading options...</p>
            )}

            {loadError && !loading && (
                <p className="text-sm text-red-600">{loadError}</p>
            )}

            {!loading && targetAudience === 'Department' && (
                <>
                    {departments.length === 0 ? (
                        <p className="text-sm text-slate-500">No departments found.</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {departments.map((dept) => {
                                const selected = targetDepartments.includes(dept);
                                return (
                                    <button
                                        key={dept}
                                        type="button"
                                        onClick={() => toggleDepartment(dept)}
                                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                            selected
                                                ? 'bg-[#20C997] text-white'
                                                : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-[#20C997]/40'
                                        }`}
                                    >
                                        {dept}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    {targetDepartments.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {targetDepartments.map((dept) => (
                                <span key={dept} className={chipClass}>
                                    {dept}
                                    <button
                                        type="button"
                                        onClick={() => toggleDepartment(dept)}
                                        className="text-[#0d9488]/70 hover:text-red-500"
                                        aria-label={`Remove ${dept}`}
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </>
            )}

            {!loading && targetAudience === 'Role' && (
                <>
                    {roles.length === 0 ? (
                        <p className="text-sm text-slate-500">No roles found.</p>
                    ) : (
                        <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                            {roles.map((role) => {
                                const selected = targetRoles.some(
                                    (r) => String(r) === String(role._id)
                                );
                                return (
                                    <label
                                        key={role._id}
                                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selected}
                                            onChange={() => toggleRole(role._id)}
                                        />
                                        <span>{role.name}</span>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {!loading && targetAudience === 'Specific Employees' && (
                <>
                    <input
                        type="search"
                        value={employeeSearch}
                        onChange={(e) => setEmployeeSearch(e.target.value)}
                        placeholder="Search employees by name, email, or ID..."
                        className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#20C997] focus:ring-2 focus:ring-[#20C997]/20"
                    />
                    {filteredEmployees.length === 0 ? (
                        <p className="text-sm text-slate-500">No employees found.</p>
                    ) : (
                        <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                            {filteredEmployees.map((emp) => {
                                const selected = targetEmployees.some(
                                    (e) => String(e) === String(emp._id)
                                );
                                const label = `${emp.name || ''} ${emp.lastName || ''}`.trim();
                                return (
                                    <label
                                        key={emp._id}
                                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selected}
                                            onChange={() => toggleEmployee(emp._id)}
                                        />
                                        <span className="min-w-0 flex-1 truncate">
                                            {label || emp.email}
                                            {emp.department ? (
                                                <span className="ml-1 text-xs text-slate-400">
                                                    · {emp.department}
                                                </span>
                                            ) : null}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                    {targetEmployees.length > 0 && (
                        <p className="mt-2 text-xs text-slate-500">
                            {targetEmployees.length} employee(s) selected
                        </p>
                    )}
                </>
            )}
        </div>
    );
};

export default SurveyAudienceFields;
