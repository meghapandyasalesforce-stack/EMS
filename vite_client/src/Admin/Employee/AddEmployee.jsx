import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { createEmployee } from '../../context/employeeSlice';
import { checkAuthSession } from '../../context/Auth/authSlice';
import { fetchEmployeeOwnInfo, setEmployeeProfile } from '../../context/employeeDetailsSlice';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import ReplaceProfileConfirmModal from '../../components/ReplaceProfileConfirmModal';
import ElevatedRoleConfirmModal from '../../components/ElevatedRoleConfirmModal';
import { DEFAULT_SYSTEM_ROLE } from '../../utils/systemRoles';
import useSuggestedSystemRole from '../../Hooks/useSuggestedSystemRole';
import useAuthPermissions from '../../Hooks/useAuthPermissions';
import { PERMISSIONS } from '../../utils/permissions';
import { getDefaultDashboardRoute } from '../../utils/dashboardRedirect';
import {
    getCredentialsForAdminEmail,
    isOrgAdminEmail,
    resolveOrgAdminEmail,
} from '../../utils/orgAdminCredentials';
import {
    getRoleLabel,
    getRoleMismatch,
    isElevatedSystemRole,
} from '../../utils/systemRoleHelpers';
import { getSystemRoleHome } from '../../utils/systemRoleHome';
import useOrgStructureCatalog from '../../Hooks/useOrgStructureCatalog';

const VISIBLE_STEPS = [
    { id: 'personal', label: 'Personal' },
    { id: 'job', label: 'Job details' },
    { id: 'review', label: 'Review' },
];

const inputClass =
    'w-full min-w-0 max-w-full flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30';
const selectClass = inputClass;

function ResponsiveSelect({ name, value, onChange, required, disabled, options, placeholder }) {
    const rootRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [menuStyle, setMenuStyle] = useState(null);
    const selected = options.find((option) => String(option.value) === String(value));

    const placeMenu = useCallback(() => {
        const rect = rootRef.current?.getBoundingClientRect();
        if (!rect) return;
        const gap = 4;
        const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
        const spaceAbove = rect.top - gap - 8;
        const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
        const maxHeight = Math.max(120, Math.min(240, openUp ? spaceAbove : spaceBelow));
        setMenuStyle({
            position: 'fixed',
            left: rect.left,
            width: rect.width,
            maxHeight,
            zIndex: 60,
            ...(openUp
                ? { bottom: window.innerHeight - rect.top + gap }
                : { top: rect.bottom + gap }),
        });
    }, []);

    useEffect(() => {
        if (!open) return undefined;
        placeMenu();
        const close = () => setOpen(false);
        const onPointer = (event) => {
            if (!rootRef.current?.contains(event.target)) close();
        };
        window.addEventListener('resize', placeMenu);
        window.addEventListener('scroll', placeMenu, true);
        document.addEventListener('pointerdown', onPointer);
        return () => {
            window.removeEventListener('resize', placeMenu);
            window.removeEventListener('scroll', placeMenu, true);
            document.removeEventListener('pointerdown', onPointer);
        };
    }, [open, placeMenu]);

    return (
        <div ref={rootRef} className="relative min-w-0 w-full flex-1">
            <button
                type="button"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-required={required || undefined}
                onClick={() => {
                    if (disabled) return;
                    setOpen((current) => !current);
                }}
                className={`${selectClass} flex items-center justify-between gap-2 bg-white text-left disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400`}
            >
                <span className={`truncate ${selected ? 'text-slate-900' : 'text-slate-500'}`}>
                    {selected?.label || placeholder}
                </span>
                <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
            </button>
            {open && menuStyle ? (
                <ul
                    role="listbox"
                    style={menuStyle}
                    className="overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                >
                    <li>
                        <button
                            type="button"
                            role="option"
                            aria-selected={!value}
                            className="block w-full px-3 py-2.5 text-left text-sm text-slate-500 hover:bg-slate-50"
                            onClick={() => {
                                onChange({ target: { name, value: '' } });
                                setOpen(false);
                            }}
                        >
                            {placeholder}
                        </button>
                    </li>
                    {options.map((option) => {
                        const isSelected = String(option.value) === String(value);
                        return (
                            <li key={option.value}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    className={`block w-full break-words px-3 py-2.5 text-left text-sm ${
                                        isSelected ? 'bg-emerald-50 font-medium text-emerald-800' : 'text-slate-800 hover:bg-slate-50'
                                    }`}
                                    onClick={() => {
                                        onChange({ target: { name, value: option.value } });
                                        setOpen(false);
                                    }}
                                >
                                    {option.label}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </div>
    );
}

function AddEmployee() {
    const queryClient = useQueryClient();
    const [step, setStep] = useState(0);
    const [form, setForm] = useState({
        name: '',
        lastName: '',
        department: '',
        departmentId: '',
        teamId: '',
        manager: '',
        jobTitle: '',
        jobRoleId: '',
        jobCategory: '',
        email: '',
        password: '',
        position: '',
        designationId: '',
        locationId: '',
        employmentTypeId: '',
        workModeId: '',
        salary: '',
        systemRole: DEFAULT_SYSTEM_ROLE,
        onProbation: false,
        probationMonths: 6,
        shiftId: '',
    });
    const [shiftOptions, setShiftOptions] = useState([
        { key: 'shift1', name: 'Shift 1', startTime: '09:00', endTime: '17:00' },
        { key: 'shift2', name: 'Shift 2', startTime: '21:00', endTime: '06:00' },
    ]);
    const [roleCatalog, setRoleCatalog] = useState([]);
    const [systemRoleManual, setSystemRoleManual] = useState(false);
    const [loadingRoles, setLoadingRoles] = useState(true);
    const [roleSuggestionReason, setRoleSuggestionReason] = useState(null);
    const [elevatedConfirmedForRole, setElevatedConfirmedForRole] = useState(null);
    const [showElevatedModal, setShowElevatedModal] = useState(false);
    const [pendingStepAdvance, setPendingStepAdvance] = useState(null);
    const [showReplaceModal, setShowReplaceModal] = useState(false);
    const [existingProfileToReplace, setExistingProfileToReplace] = useState(null);
    const [linkAsMyProfile, setLinkAsMyProfile] = useState(false);

    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [managers, setManagers] = useState([]);
    const [loadingManagers, setLoadingManagers] = useState(false);
    const employeeStatus = useSelector((state) => state.employees.status);
    const employeeError = useSelector(state => state.employees.error);
    const user = useSelector((state) => state.auth?.user);
    const employee = useSelector((state) => state.employeeDetails?.employee);
    const { isOrgOwner, isHrManager, isHrExecutive, hasPermission } = useAuthPermissions();
    const canAddEmployee =
        isOrgOwner ||
        isHrManager ||
        isHrExecutive ||
        hasPermission(PERMISSIONS.EMPLOYEE_CREATE);
    const permissionFlags = useMemo(() => ({ isOrgOwner }), [isOrgOwner]);

    const adminEmail = useMemo(
        () => (isOrgOwner ? resolveOrgAdminEmail(user, permissionFlags) : ''),
        [user, permissionFlags, isOrgOwner]
    );
    const usingAdminEmail =
        isOrgOwner && isOrgAdminEmail(form.email, user, permissionFlags);

    useEffect(() => {
        if (isOrgOwner && usingAdminEmail) {
            setLinkAsMyProfile(true);
        }
    }, [isOrgOwner, usingAdminEmail]);

    const getDashboardRoute = useMemo(() => {
        const userRole = user?.role || employee?.role || localStorage.getItem('role');
        const department = (user?.department || employee?.department || '').toLowerCase().trim();
        const jobTitle = (user?.jobTitle || employee?.jobTitle || '').toLowerCase().trim();
        const position = (user?.position || employee?.position || '').toLowerCase().trim();

        if (userRole === 'admin') return '/dashboard-admin';

        const isHR =
            department === 'hr' ||
            department.includes('hr') ||
            department.includes('human resource') ||
            jobTitle.includes('hr manager') ||
            jobTitle.includes('human resource') ||
            jobTitle.includes('hr') ||
            position.includes('hr manager') ||
            (position.includes('hr') && position.includes('manager'));

        if (isHR) return '/dashboard-hr';
        return '/dashboard-admin';
    }, [user, employee]);

    const { catalog, loading: catalogLoading } = useOrgStructureCatalog(form.departmentId || null);

    const filteredJobRoles = useMemo(() => {
        const roles = catalog.jobRoles || [];
        if (!form.departmentId) return roles;
        return roles.filter(
            (r) =>
                !Array.isArray(r.departmentIds) ||
                r.departmentIds.length === 0 ||
                r.departmentIds.some((id) => String(id) === String(form.departmentId))
        );
    }, [catalog.jobRoles, form.departmentId]);

    const filteredTeams = useMemo(() => {
        if (!form.departmentId) return catalog.teams || [];
        return (catalog.teams || []).filter(
            (t) => String(t.departmentId) === String(form.departmentId)
        );
    }, [catalog.teams, form.departmentId]);

    const selectedDepartmentName = useMemo(() => {
        const d = (catalog.departments || []).find((x) => String(x._id) === String(form.departmentId));
        return d?.name || form.department;
    }, [catalog.departments, form.departmentId, form.department]);

    const selectedJobRoleName = useMemo(() => {
        const r = filteredJobRoles.find((x) => String(x._id) === String(form.jobRoleId));
        return r?.name || form.jobTitle;
    }, [filteredJobRoles, form.jobRoleId, form.jobTitle]);

    const selectedDesignationName = useMemo(() => {
        const d = (catalog.designations || []).find((x) => String(x._id) === String(form.designationId));
        return d?.name || form.position;
    }, [catalog.designations, form.designationId, form.position]);
    const jobCategories = [
        'Information Technology', 'Human Resources', 'Finance', 'Marketing', 'Sales', 'Operations',
        'Customer Service', 'Research and Development', 'Engineering', 'Legal', 'Administration',
        'Management', 'Design', 'Product Management', 'Salesforce',
    ];

    const fetchManagers = useCallback(async () => {
        try {
            setLoadingManagers(true);
            const response = await axios.get('/v1/admin/employee/managers?limit=500', { withCredentials: true });
            const data = response.data;
            const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
            setManagers(list);
            if (list.length === 0) {
                setForm((prev) => ({ ...prev, manager: 'Admin' }));
            } else {
                setForm((prev) =>
                    prev.manager === 'CEO' || prev.manager === 'Admin' ? { ...prev, manager: '' } : prev
                );
            }
        } catch {
            setManagers([]);
            setForm((prev) => ({ ...prev, manager: 'Admin' }));
        } finally {
            setLoadingManagers(false);
        }
    }, []);

    useEffect(() => {
        fetchManagers();
    }, [fetchManagers]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await axios.get('/v1/admin/attendance-rules/shifts', { withCredentials: true });
                const data = res.data?.data || res.data || {};
                const list = Array.isArray(data.shifts) && data.shifts.length
                    ? data.shifts
                    : [
                        { key: 'shift1', name: 'Shift 1', ...(data.shift1 || {}) },
                        { key: 'shift2', name: 'Shift 2', ...(data.shift2 || {}) },
                    ];
                if (!cancelled && list.length) {
                    setShiftOptions(list.map((s) => ({
                        key: s.key || (s.name === 'Shift 2' ? 'shift2' : 'shift1'),
                        name: s.name || 'Shift',
                        startTime: s.startTime || '',
                        endTime: s.endTime || '',
                    })));
                }
            } catch {
                // keep defaults
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const selectedShiftLabel = useMemo(() => {
        if (!form.shiftId) return 'No Shift';
        const s = shiftOptions.find((x) => x.key === form.shiftId);
        if (!s) return form.shiftId || 'No Shift';
        return `${s.name}${s.startTime && s.endTime ? ` (${s.startTime}–${s.endTime})` : ''}`;
    }, [shiftOptions, form.shiftId]);

    const { suggestion: suggestedRole, loading: suggestionLoading } = useSuggestedSystemRole(
        {
            department: selectedDepartmentName,
            jobTitle: selectedJobRoleName,
            position: selectedDesignationName,
        },
        { enabled: Boolean(selectedDepartmentName && selectedJobRoleName && selectedDesignationName) }
    );

    useEffect(() => {
        if (suggestionLoading || !selectedDepartmentName || !selectedJobRoleName || !selectedDesignationName) return;

        setRoleSuggestionReason(suggestedRole.reason);
        if (systemRoleManual) return;
        setForm((prev) =>
            prev.systemRole === suggestedRole.systemRoleId
                ? prev
                : { ...prev, systemRole: suggestedRole.systemRoleId }
        );
    }, [
        suggestedRole,
        suggestionLoading,
        selectedDepartmentName,
        selectedJobRoleName,
        selectedDesignationName,
        systemRoleManual,
    ]);

    const resolveSystemRole = useCallback(
        () => form.systemRole || suggestedRole.systemRoleId || DEFAULT_SYSTEM_ROLE,
        [form.systemRole, suggestedRole.systemRoleId]
    );

    const roleMismatch = useMemo(
        () =>
            getRoleMismatch({
                department: selectedDepartmentName,
                jobTitle: selectedJobRoleName,
                position: selectedDesignationName,
                systemRoleId: form.systemRole,
                suggestedRoleId: suggestedRole.systemRoleId,
                suggestedReason: suggestedRole.reason,
            }),
        [selectedDepartmentName, selectedJobRoleName, selectedDesignationName, form.systemRole, suggestedRole]
    );

    const selectedRoleLabel = getRoleLabel(form.systemRole, roleCatalog);

    const managerLabel = useMemo(() => {
        if (!form.manager) return '—';
        if (form.manager === 'CEO' || form.manager === 'Admin') return 'Admin (organization root)';
        const match = managers.find(
            (mgr) => String(mgr._id) === String(form.manager) || mgr.employeeId === form.manager
        );
        if (match) {
            return `${match.name}${match.lastName ? ` ${match.lastName}` : ''}`.trim();
        }
        return form.manager;
    }, [form.manager, managers]);

    useEffect(() => {
        const loadCatalog = async () => {
            try {
                setLoadingRoles(true);
                const res = await axios.get('/v1/admin/platform-roles/catalog', { withCredentials: true });
                const data = res.data?.data || res.data;
                setRoleCatalog(data.catalog || []);
            } catch {
                setRoleCatalog([]);
            } finally {
                setLoadingRoles(false);
            }
        };
        loadCatalog();
    }, []);

    useEffect(() => {
        const onFocus = () => fetchManagers();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [fetchManagers]);

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === 'email') {
            setForm((prev) => {
                const next = { ...prev, email: value };
                const { password } = getCredentialsForAdminEmail(value, user, permissionFlags);
                if (isOrgAdminEmail(value, user, permissionFlags) && password) {
                    next.password = password;
                } else if (
                    !isOrgAdminEmail(value, user, permissionFlags) &&
                    isOrgAdminEmail(prev.email, user, permissionFlags)
                ) {
                    next.password = '';
                }
                return next;
            });
            return;
        }

        if (name === 'departmentId') {
            const dept = (catalog.departments || []).find((d) => String(d._id) === String(value));
            setSystemRoleManual(false);
            setForm((prev) => ({
                ...prev,
                departmentId: value,
                department: dept?.name || '',
                teamId: '',
                jobRoleId: '',
                jobTitle: '',
            }));
            return;
        }
        if (name === 'jobRoleId') {
            const role = filteredJobRoles.find((r) => String(r._id) === String(value));
            setSystemRoleManual(false);
            setForm((prev) => ({
                ...prev,
                jobRoleId: value,
                jobTitle: role?.name || '',
            }));
            return;
        }
        if (name === 'designationId') {
            const des = (catalog.designations || []).find((d) => String(d._id) === String(value));
            setSystemRoleManual(false);
            setForm((prev) => ({
                ...prev,
                designationId: value,
                position: des?.name || '',
            }));
            return;
        }
        if (name === 'systemRole') {
            setSystemRoleManual(true);
            setForm((prev) => ({ ...prev, systemRole: value }));
            return;
        }

        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const fillAdminCredentials = () => {
        if (!adminEmail) {
            toast.info('Admin email is not available in this session.');
            return;
        }
        const { email, password } = getCredentialsForAdminEmail(adminEmail, user, permissionFlags);
        setForm((prev) => ({
            ...prev,
            email,
            ...(password ? { password } : {}),
        }));
    };

    const validateStep = (stepIndex) => {
        if (stepIndex === 0) {
            if (!form.name.trim() || !form.email.trim()) {
                toast.error('Please fill in first name and email.');
                return false;
            }
            if (form.password && form.password.length < 8) {
                toast.error('Password must be at least 8 characters');
                return false;
            }
            return true;
        }

        if (stepIndex === 1) {
            if (!form.departmentId || !form.jobRoleId || !form.designationId || !form.jobCategory || !form.salary) {
                toast.error('Please complete department, job role, designation, category, and salary.');
                return false;
            }
            if (!form.systemRole) {
                toast.error('Please select Access & home screen (which dashboard they open).');
                return false;
            }
            if (managers.length > 0 && (!form.manager || !String(form.manager).trim())) {
                toast.error('Please select a manager.');
                return false;
            }
            if (form.onProbation) {
                const months = Number(form.probationMonths);
                if (!Number.isFinite(months) || months < 1 || months > 36) {
                    toast.error('Probation duration must be between 1 and 36 months.');
                    return false;
                }
            }
            return true;
        }

        return true;
    };

    const needsElevatedConfirm = (roleId = resolveSystemRole()) =>
        isElevatedSystemRole(roleId) && elevatedConfirmedForRole !== roleId;

    const requestElevatedConfirm = (onConfirmed) => {
        setPendingStepAdvance(() => onConfirmed);
        setShowElevatedModal(true);
    };

    const handleElevatedConfirm = () => {
        setElevatedConfirmedForRole(resolveSystemRole());
        setShowElevatedModal(false);
        pendingStepAdvance?.();
        setPendingStepAdvance(null);
    };

    const handleElevatedCancel = () => {
        setShowElevatedModal(false);
        setPendingStepAdvance(null);
    };

    const goNext = () => {
        if (!validateStep(step)) return;

        if (step === 1) {
            const roleToUse = resolveSystemRole();
            if (!roleToUse) {
                toast.error('Unable to determine system access from job details.');
                return;
            }
            if (form.systemRole !== roleToUse) {
                setForm((prev) => ({ ...prev, systemRole: roleToUse }));
            }
            if (needsElevatedConfirm(roleToUse)) {
                requestElevatedConfirm(() => setStep(2));
                return;
            }
        }

        setStep((prev) => Math.min(prev + 1, VISIBLE_STEPS.length - 1));
    };

    const goBack = () => {
        setError('');
        setStep((prev) => Math.max(prev - 1, 0));
    };

    const submitEmployee = async (skipElevatedCheck = false, confirmReplace = false) => {
        setError('');

        if (!validateStep(0) || !validateStep(1)) {
            toast.error('Please complete all required steps.');
            return;
        }

        const systemRole = resolveSystemRole();
        if (!systemRole) {
            toast.error('Unable to determine system access from job details.');
            return;
        }

        if (!skipElevatedCheck && needsElevatedConfirm(systemRole)) {
            requestElevatedConfirm(() => submitEmployee(true, confirmReplace));
            return;
        }

        const linkAsOrgOwnerMe = isOrgOwner && (usingAdminEmail || linkAsMyProfile);
        const payload = {
            ...form,
            department: selectedDepartmentName,
            jobTitle: selectedJobRoleName,
            position: selectedDesignationName,
            systemRole,
            confirmReplace,
            linkAsOrgOwnerMe,
            shiftId: form.shiftId || '',
            shiftName: form.shiftId
                ? (shiftOptions.find((s) => s.key === form.shiftId) || {}).name || ''
                : '',
        };
        // Omit empty optional ObjectIds so Mongoose never receives ""
        [
            'teamId',
            'locationId',
            'employmentTypeId',
            'workModeId',
            'departmentId',
            'jobRoleId',
            'designationId',
        ].forEach((key) => {
            if (!payload[key]) delete payload[key];
        });
        const resultAction = await dispatch(createEmployee(payload));

        if (createEmployee.fulfilled.match(resultAction)) {
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            const { linkedToExistingUser, updatedExistingProfile, linkMessage } = resultAction.payload;
            const roleMsg = `System access: ${selectedRoleLabel}.`;

            if (updatedExistingProfile) {
                toast.success(
                    `${linkMessage || 'Employee profile updated and linked to your admin login.'} ${roleMsg}`,
                    { autoClose: 6000 }
                );
            } else if (linkedToExistingUser) {
                toast.success(
                    `${linkMessage || 'Employee linked to existing login.'} ${roleMsg}`,
                    { autoClose: 6000 }
                );
            } else {
                toast.success(`Employee created successfully as ${selectedRoleLabel}.`, {
                    autoClose: 4000,
                });
            }

            if (linkedToExistingUser || updatedExistingProfile || linkAsOrgOwnerMe) {
                await dispatch(checkAuthSession());
                await dispatch(fetchEmployeeOwnInfo());
            }

            if (resultAction.payload?.employee) {
                dispatch(setEmployeeProfile(resultAction.payload.employee));
            }

            setExistingProfileToReplace(null);
            navigate(getDashboardRoute);
        } else {
            const errPayload = resultAction.payload;
            const errorMsg =
                typeof errPayload === 'string'
                    ? errPayload
                    : errPayload?.message || 'Failed to create employee';

            if (errPayload?.code === 'PROFILE_EXISTS_REQUIRES_CONFIRMATION') {
                setExistingProfileToReplace(errPayload.existingProfile || null);
                setShowReplaceModal(true);
                return;
            }

            setError(errorMsg);
            toast.error(errorMsg, { autoClose: 5000 });
        }
    };

    const handleReplaceConfirm = () => {
        setShowReplaceModal(false);
        submitEmployee(true, true);
    };

    const handleReplaceCancel = () => {
        setShowReplaceModal(false);
        setExistingProfileToReplace(null);
    };

    const renderStepIndicator = () => (
        <ol className="mb-8 flex flex-wrap gap-2 sm:gap-4">
            {VISIBLE_STEPS.map((item, index) => {
                const isActive = index === step;
                const isDone = index < step;
                return (
                    <li key={item.id} className="flex items-center gap-2">
                        <span
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                                isActive
                                    ? 'bg-emerald-600 text-white'
                                    : isDone
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-slate-100 text-slate-500'
                            }`}
                        >
                            {index + 1}
                        </span>
                        <span className={`text-sm font-medium ${isActive ? 'text-slate-900' : 'text-slate-500'}`}>
                            {item.label}
                        </span>
                        {index < VISIBLE_STEPS.length - 1 ? (
                            <span className="hidden text-slate-300 sm:inline">›</span>
                        ) : null}
                    </li>
                );
            })}
        </ol>
    );

    const renderPersonalStep = () => (
        <div className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row">
                <input
                    className={inputClass}
                    name="name"
                    placeholder="First name"
                    value={form.name}
                    onChange={handleChange}
                    required
                />
                <input
                    className={inputClass}
                    name="lastName"
                    placeholder="Last name (optional)"
                    value={form.lastName}
                    onChange={handleChange}
                />
            </div>
            <div className="flex flex-col gap-4 lg:flex-row">
                <input
                    className={inputClass}
                    name="email"
                    placeholder="Work email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                />
                <input
                    className={inputClass}
                    name="password"
                    placeholder="Password (optional — auto-generated if empty)"
                    type="password"
                    minLength={8}
                    value={form.password}
                    onChange={handleChange}
                />
            </div>
            {isOrgOwner && adminEmail ? (
                <button
                    type="button"
                    onClick={fillAdminCredentials}
                    className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
                >
                    Use my admin email ({adminEmail})
                </button>
            ) : null}
            {isOrgOwner && usingAdminEmail ? (
                <p className="text-xs text-emerald-700">
                    Only your organization admin email can share login. One employee profile will link to your admin account (same email and password).
                </p>
            ) : (
                <p className="text-xs text-slate-500">
                    Use a unique email for each employee. Leave password empty to auto-generate and email credentials to the new hire.
                </p>
            )}
            {isOrgOwner ? (
                <label className="flex items-start gap-2 text-sm text-slate-700">
                    <input
                        type="checkbox"
                        className="mt-1"
                        checked={usingAdminEmail || linkAsMyProfile}
                        disabled={usingAdminEmail}
                        onChange={(event) => setLinkAsMyProfile(event.target.checked)}
                    />
                    <span>
                        Show this employee on my Me tab
                        {usingAdminEmail ? ' (always on when using your admin email)' : ''}
                    </span>
                </label>
            ) : null}
        </div>
    );

    const renderJobStep = () => (
        <div className="space-y-4">
            {catalogLoading ? (
                <p className="text-sm text-slate-500">Loading organization structure…</p>
            ) : null}
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
                <ResponsiveSelect
                    name="departmentId"
                    value={form.departmentId}
                    onChange={handleChange}
                    required
                    placeholder="Select department"
                    options={(catalog.departments || []).map((dep) => ({ value: dep._id, label: dep.name }))}
                />
                <ResponsiveSelect
                    name="teamId"
                    value={form.teamId}
                    onChange={handleChange}
                    disabled={!form.departmentId}
                    placeholder="Team (optional)"
                    options={filteredTeams.map((team) => ({ value: team._id, label: team.name }))}
                />
            </div>
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
                <ResponsiveSelect
                    name="jobRoleId"
                    value={form.jobRoleId}
                    onChange={handleChange}
                    required
                    disabled={!form.departmentId}
                    placeholder="Select job role"
                    options={filteredJobRoles.map((role) => ({ value: role._id, label: role.name }))}
                />
                <ResponsiveSelect
                    name="designationId"
                    value={form.designationId}
                    onChange={handleChange}
                    required
                    placeholder="Select designation"
                    options={(catalog.designations || []).map((des) => ({ value: des._id, label: des.name }))}
                />
            </div>
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
                <ResponsiveSelect
                    name="employmentTypeId"
                    value={form.employmentTypeId}
                    onChange={handleChange}
                    placeholder="Employment type (optional)"
                    options={(catalog.employmentTypes || []).map((et) => ({ value: et._id, label: et.name }))}
                />
                <ResponsiveSelect
                    name="workModeId"
                    value={form.workModeId}
                    onChange={handleChange}
                    placeholder="Work mode (optional)"
                    options={(catalog.workModes || []).map((wm) => ({ value: wm._id, label: wm.name }))}
                />
            </div>
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
                <ResponsiveSelect
                    name="locationId"
                    value={form.locationId}
                    onChange={handleChange}
                    placeholder="Location (optional)"
                    options={(catalog.locations || []).map((loc) => ({ value: loc._id, label: loc.name }))}
                />
                <ResponsiveSelect
                    name="shiftId"
                    value={form.shiftId}
                    onChange={handleChange}
                    placeholder="No Shift"
                    options={shiftOptions.map((s) => ({
                        value: s.key,
                        label: `${s.name}${s.startTime && s.endTime ? ` (${s.startTime}–${s.endTime})` : ''}`,
                    }))}
                />
            </div>
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
                <ResponsiveSelect
                    name="manager"
                    value={form.manager}
                    onChange={handleChange}
                    required={managers.length > 0}
                    disabled={loadingManagers}
                    placeholder={loadingManagers ? 'Loading managers...' : managers.length > 0 ? 'Select manager (required)' : 'Select manager'}
                    options={[
                        ...(managers.length === 0 && !loadingManagers
                            ? [{ value: 'Admin', label: 'Admin profile — organization root (no manager)' }]
                            : []),
                        ...managers.map((mgr) => {
                            const fullName = `${mgr.name}${mgr.lastName ? ` ${mgr.lastName}` : ''}`.trim();
                            const isRoot = !mgr.managerId;
                            return {
                                value: mgr._id || fullName,
                                label: `${fullName} — ${mgr.position}${isRoot ? ' (Admin root)' : ''}`,
                            };
                        }),
                    ]}
                />
            </div>
            {!loadingManagers && managers.length === 0 ? (
                <p className="text-xs text-slate-500">
                    No employees yet — this profile becomes the organization Admin root (managerId empty).
                    Department managers added later should report to this Admin.
                </p>
            ) : !loadingManagers ? (
                <p className="text-xs text-slate-500">
                    Every employee after the Admin root must select a manager. Department managers
                    can report directly to Admin; others follow their department hierarchy.
                </p>
            ) : null}
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
                <ResponsiveSelect
                    name="jobCategory"
                    value={form.jobCategory}
                    onChange={handleChange}
                    required
                    placeholder="Select job category"
                    options={jobCategories.map((cat) => ({ value: cat, label: cat }))}
                />
                <input
                    className={inputClass}
                    name="salary"
                    placeholder="Annual salary"
                    type="number"
                    value={form.salary}
                    onChange={handleChange}
                    required
                />
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                <div>
                    <h3 className="text-sm font-semibold text-slate-900">Access &amp; home screen</h3>
                    <p className="mt-1 text-xs text-slate-600">
                        This controls which dashboard and modules they get after login. Department and job title are labels only — they do not pick the home screen.
                    </p>
                </div>
                <ResponsiveSelect
                    name="systemRole"
                    value={form.systemRole || DEFAULT_SYSTEM_ROLE}
                    onChange={handleChange}
                    required
                    disabled={loadingRoles}
                    placeholder={loadingRoles ? 'Loading access options…' : 'Select access & home'}
                    options={roleCatalog.map((role) => ({
                        value: role.id,
                        label: `${role.label} → ${getSystemRoleHome(role.id).label}`,
                    }))}
                />
                {form.systemRole ? (
                    <p className="text-xs text-slate-600">
                        Opens <span className="font-medium text-slate-800">{getSystemRoleHome(form.systemRole).label}</span>
                        {' '}({getSystemRoleHome(form.systemRole).path})
                        {roleCatalog.find((r) => r.id === form.systemRole)?.description
                            ? ` — ${roleCatalog.find((r) => r.id === form.systemRole).description}`
                            : ''}
                    </p>
                ) : null}
                {!systemRoleManual && roleSuggestionReason ? (
                    <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                        Suggested from job details: {roleSuggestionReason}. You can change the selection above.
                    </p>
                ) : null}
                {systemRoleManual && roleMismatch.mismatch ? (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Job details suggest {getRoleLabel(roleMismatch.suggestedRoleId, roleCatalog)}. You overrode access to {selectedRoleLabel}.
                    </p>
                ) : null}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        checked={Boolean(form.onProbation)}
                        onChange={(e) =>
                            setForm((prev) => ({ ...prev, onProbation: e.target.checked }))
                        }
                    />
                    <span>
                        <span className="block text-sm font-semibold text-slate-900">
                            Put this employee on probation
                        </span>
                        <span className="block text-xs text-slate-500 mt-0.5">
                            Off by default. Only enable if this hire should start a probation period.
                        </span>
                    </span>
                </label>
                {form.onProbation ? (
                    <div className="max-w-xs">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Probation duration (months)
                        </label>
                        <input
                            className={inputClass}
                            name="probationMonths"
                            type="number"
                            min={1}
                            max={36}
                            step={1}
                            value={form.probationMonths}
                            onChange={handleChange}
                        />
                    </div>
                ) : null}
            </div>
        </div>
    );

    const renderReviewStep = () => {
        const selected = roleCatalog.find((r) => r.id === form.systemRole);

        return (
            <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Summary</h3>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="text-slate-500">Name</dt>
                            <dd className="font-medium text-slate-900">{form.name} {form.lastName}</dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">Email</dt>
                            <dd className="font-medium text-slate-900">{form.email}</dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">Department</dt>
                            <dd className="font-medium text-slate-900">{selectedDepartmentName}</dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">Job title</dt>
                            <dd className="font-medium text-slate-900">{selectedJobRoleName}</dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">Position</dt>
                            <dd className="font-medium text-slate-900">{selectedDesignationName}</dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">Manager</dt>
                            <dd className="font-medium text-slate-900">{managerLabel}</dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">Shift</dt>
                            <dd className="font-medium text-slate-900">{selectedShiftLabel}</dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">Probation</dt>
                            <dd className="font-medium text-slate-900">
                                {form.onProbation
                                    ? `Yes — ${form.probationMonths || 6} month(s)`
                                    : 'No'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">Access &amp; home</dt>
                            <dd className="font-semibold text-emerald-700">
                                {selectedRoleLabel}
                                <span className="ml-1 text-xs font-normal text-slate-500">
                                    → {getSystemRoleHome(form.systemRole).label}
                                    {!systemRoleManual && roleSuggestionReason ? ' (suggested)' : ''}
                                </span>
                            </dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">Salary</dt>
                            <dd className="font-medium text-slate-900">₹{Number(form.salary).toLocaleString('en-IN')}</dd>
                        </div>
                    </dl>
                    {selected?.description ? (
                        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{selected.description}</p>
                    ) : null}
                </div>

                {roleMismatch.mismatch ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        Job details suggest {getRoleLabel(roleMismatch.suggestedRoleId, roleCatalog)}. Access &amp; home is set to{' '}
                        {selectedRoleLabel} → {getSystemRoleHome(form.systemRole).label}.
                    </div>
                ) : null}
            </div>
        );
    };

    if (!canAddEmployee) {
        return <Navigate to={getDefaultDashboardRoute(user, employee)} replace />;
    }

    return (
        <div className="min-h-screen overflow-x-hidden bg-[#F5F7FB]">
            <div className="page-shell">
                <div className="page-shell-inner min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
                    <h1 className="mb-2 text-xl font-semibold text-slate-900 sm:text-2xl">Add employee</h1>
                    <p className="mb-6 text-sm text-slate-500">
                        Job details describe where they sit. Access &amp; home screen chooses their dashboard and modules (like Zoho roles).
                    </p>

                    {renderStepIndicator()}

                    {(error || employeeError) && (
                        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {error ||
                                (typeof employeeError === 'string'
                                    ? employeeError
                                    : employeeError?.message || 'Failed to create employee')}
                        </p>
                    )}

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (step < VISIBLE_STEPS.length - 1) goNext();
                            else submitEmployee();
                        }}
                    >
                        {step === 0 && renderPersonalStep()}
                        {step === 1 && renderJobStep()}
                        {step === 2 && renderReviewStep()}

                        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={goBack}
                                disabled={step === 0 || employeeStatus === 'loading'}
                                className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Back
                            </button>
                            <button
                                type="submit"
                                disabled={employeeStatus === 'loading'}
                                className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                                {employeeStatus === 'loading'
                                    ? 'Creating…'
                                    : step < VISIBLE_STEPS.length - 1
                                      ? 'Continue'
                                      : 'Create employee'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <ElevatedRoleConfirmModal
                open={showElevatedModal}
                roleId={resolveSystemRole()}
                roleLabel={selectedRoleLabel}
                onConfirm={handleElevatedConfirm}
                onCancel={handleElevatedCancel}
            />
            <ReplaceProfileConfirmModal
                open={showReplaceModal}
                existingProfile={existingProfileToReplace}
                onConfirm={handleReplaceConfirm}
                onCancel={handleReplaceCancel}
            />
        </div>
    );
}

export default AddEmployee;
