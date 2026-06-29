import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { createEmployee } from '../../context/employeeSlice';
import { checkAuthSession } from '../../context/Auth/authSlice';
import { fetchEmployeeOwnInfo, setEmployeeProfile } from '../../context/employeeDetailsSlice';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import SystemRolePicker from '../../components/SystemRolePicker';
import ElevatedRoleConfirmModal from '../../components/ElevatedRoleConfirmModal';
import ReplaceProfileConfirmModal from '../../components/ReplaceProfileConfirmModal';
import { DEFAULT_SYSTEM_ROLE } from '../../utils/systemRoles';
import useSuggestedSystemRole from '../../Hooks/useSuggestedSystemRole';
import useAuthPermissions from '../../Hooks/useAuthPermissions';
import {
    getCredentialsForAdminEmail,
    isOrgAdminEmail,
    normalizeEmail,
    resolveOrgAdminEmail,
} from '../../utils/orgAdminCredentials';
import {
    getRoleLabel,
    getRoleMismatch,
    isElevatedSystemRole,
} from '../../utils/systemRoleHelpers';

const STEPS = [
    { id: 'personal', label: 'Personal' },
    { id: 'job', label: 'Job details' },
    { id: 'access', label: 'System access' },
    { id: 'review', label: 'Review' },
];

const inputClass =
    'flex-1 rounded-lg border border-slate-300 px-4 py-3 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30';
const selectClass = inputClass;

function AddEmployee() {
    const queryClient = useQueryClient();
    const [step, setStep] = useState(0);
    const [form, setForm] = useState({
        name: '',
        lastName: '',
        department: '',
        manager: '',
        jobTitle: '',
        jobCategory: '',
        email: '',
        password: '',
        position: '',
        salary: '',
        systemRole: DEFAULT_SYSTEM_ROLE,
    });
    const [roleCatalog, setRoleCatalog] = useState([]);
    const [loadingRoles, setLoadingRoles] = useState(true);
    const [roleManuallyOverridden, setRoleManuallyOverridden] = useState(false);
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
    const { isOrgOwner } = useAuthPermissions();
    const permissionFlags = useMemo(() => ({ isOrgOwner }), [isOrgOwner]);

    const adminEmail = useMemo(
        () => resolveOrgAdminEmail(user, permissionFlags),
        [user, permissionFlags]
    );
    const usingAdminEmail = isOrgAdminEmail(form.email, user, permissionFlags);

    useEffect(() => {
        if (usingAdminEmail) {
            setLinkAsMyProfile(true);
        }
    }, [usingAdminEmail]);

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

    const departments = [
        'Engineering', 'HR', 'Finance', 'Sales', 'Marketing', 'IT Support', 'Operations',
        'Customer Support', 'Legal', 'Product', 'Research & Development', 'Design', 'Administration',
    ];

    const jobTitles = [
        'Software Engineer', 'Frontend Developer', 'Backend Developer', 'DevOps Engineer', 'HR Manager', 'HR Executive',
        'Financial Analyst', 'Marketing Executive', 'Sales Representative', 'Product Manager',
        'QA Tester', 'Customer Support Specialist', 'UX/UI Designer', 'Project Manager',
        'Legal Advisor', 'Operations Coordinator', 'Full Stack Developer',
    ];

    const jobCategories = [
        'Information Technology', 'Human Resources', 'Finance', 'Marketing', 'Sales', 'Operations',
        'Customer Service', 'Research and Development', 'Engineering', 'Legal', 'Administration',
        'Management', 'Design', 'Product Management',
    ];

    const positions = [
        'Intern', 'Junior', 'Mid-Level', 'Senior', 'Lead', 'Supervisor', 'Manager',
        'Director', 'Executive', 'VP', 'CTO', 'CFO', 'CEO',
    ];

    const fetchManagers = useCallback(async () => {
        try {
            setLoadingManagers(true);
            const response = await axios.get('/v1/admin/employee/managers?limit=500', { withCredentials: true });
            const data = response.data;
            const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
            setManagers(list);
            if (list.length === 0) {
                setForm((prev) => ({ ...prev, manager: 'CEO' }));
            } else {
                setForm((prev) => (prev.manager === 'CEO' ? { ...prev, manager: '' } : prev));
            }
        } catch {
            setManagers([]);
            setForm((prev) => ({ ...prev, manager: 'CEO' }));
        } finally {
            setLoadingManagers(false);
        }
    }, []);

    useEffect(() => {
        fetchManagers();
    }, [fetchManagers]);

    const { suggestion: suggestedRole, loading: suggestionLoading } = useSuggestedSystemRole(
        {
            department: form.department,
            jobTitle: form.jobTitle,
            position: form.position,
        },
        { enabled: step >= 1 }
    );

    useEffect(() => {
        if (roleManuallyOverridden || suggestionLoading) return;

        setRoleSuggestionReason(suggestedRole.reason);
        setForm((prev) =>
            prev.systemRole === suggestedRole.systemRoleId
                ? prev
                : { ...prev, systemRole: suggestedRole.systemRoleId }
        );
    }, [suggestedRole, roleManuallyOverridden, suggestionLoading]);

    const roleMismatch = useMemo(
        () =>
            getRoleMismatch({
                department: form.department,
                jobTitle: form.jobTitle,
                position: form.position,
                systemRoleId: form.systemRole,
                suggestedRoleId: suggestedRole.systemRoleId,
                suggestedReason: suggestedRole.reason,
            }),
        [form.department, form.jobTitle, form.position, form.systemRole, suggestedRole]
    );

    const suggestedRoleLabel = getRoleLabel(suggestedRole.systemRoleId, roleCatalog);
    const selectedRoleLabel = getRoleLabel(form.systemRole, roleCatalog);

    const managerLabel = useMemo(() => {
        if (!form.manager) return '—';
        if (form.manager === 'CEO') return 'First employee (no manager)';
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

    const handleApplySuggestedRole = () => {
        setRoleManuallyOverridden(false);
        setElevatedConfirmedForRole(null);
        setRoleSuggestionReason(suggestedRole.reason);
        setForm((prev) => ({ ...prev, systemRole: suggestedRole.systemRoleId }));
    };

    const handleSystemRoleChange = (systemRole) => {
        setRoleManuallyOverridden(true);
        setElevatedConfirmedForRole(null);
        setForm((prev) => ({ ...prev, systemRole }));
    };

    const validateStep = (stepIndex) => {
        if (stepIndex === 0) {
            if (!form.name.trim() || !form.lastName.trim() || !form.email.trim()) {
                toast.error('Please fill in name, last name, and email.');
                return false;
            }
            if (form.password && form.password.length < 8) {
                toast.error('Password must be at least 8 characters');
                return false;
            }
            return true;
        }

        if (stepIndex === 1) {
            if (!form.department || !form.jobTitle || !form.jobCategory || !form.position || !form.salary) {
                toast.error('Please complete all job detail fields.');
                return false;
            }
            if (managers.length > 0 && (!form.manager || !String(form.manager).trim())) {
                toast.error('Please select a manager.');
                return false;
            }
            return true;
        }

        if (stepIndex === 2) {
            if (!form.systemRole) {
                toast.error('Please select a system access role.');
                return false;
            }
            return true;
        }

        return true;
    };

    const needsElevatedConfirm = () =>
        isElevatedSystemRole(form.systemRole) && elevatedConfirmedForRole !== form.systemRole;

    const requestElevatedConfirm = (onConfirmed) => {
        setPendingStepAdvance(() => onConfirmed);
        setShowElevatedModal(true);
    };

    const handleElevatedConfirm = () => {
        setElevatedConfirmedForRole(form.systemRole);
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

        if (step === 2 && needsElevatedConfirm()) {
            requestElevatedConfirm(() => setStep(3));
            return;
        }

        setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    };

    const goBack = () => {
        setError('');
        setStep((prev) => Math.max(prev - 1, 0));
    };

    const submitEmployee = async (skipElevatedCheck = false, confirmReplace = false) => {
        setError('');

        if (!validateStep(0) || !validateStep(1) || !validateStep(2)) {
            toast.error('Please complete all required steps.');
            return;
        }

        if (!skipElevatedCheck && needsElevatedConfirm()) {
            requestElevatedConfirm(() => submitEmployee(true, confirmReplace));
            return;
        }

        const linkAsOrgOwnerMe = usingAdminEmail || linkAsMyProfile;
        const resultAction = await dispatch(createEmployee({ ...form, confirmReplace, linkAsOrgOwnerMe }));

        if (createEmployee.fulfilled.match(resultAction)) {
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            const { emailSent, emailWarning, emailError, linkedToExistingUser, updatedExistingProfile, linkMessage } = resultAction.payload;
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
            } else if (emailSent) {
                toast.success(`Employee created as ${selectedRoleLabel}. Welcome email sent.`, {
                    autoClose: 4000,
                });
            } else if (emailWarning || emailError) {
                toast.warning(`Employee created as ${selectedRoleLabel}, but welcome email failed!`, {
                    autoClose: 5000,
                });
                setTimeout(() => {
                    const errorMsg = emailWarning || emailError || 'Email service unavailable';
                    toast.error(errorMsg, { autoClose: 10000 });
                }, 500);
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
            {STEPS.map((item, index) => {
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
                        {index < STEPS.length - 1 ? (
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
                    placeholder="Last name"
                    value={form.lastName}
                    onChange={handleChange}
                    required
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
            {adminEmail ? (
                <button
                    type="button"
                    onClick={fillAdminCredentials}
                    className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
                >
                    Use my admin email ({adminEmail})
                </button>
            ) : null}
            {usingAdminEmail ? (
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
            <div className="flex flex-col gap-4 lg:flex-row">
                <select
                    className={selectClass}
                    name="department"
                    value={form.department}
                    onChange={handleChange}
                    required
                >
                    <option value="">Select department</option>
                    {departments.map((dep) => (
                        <option key={dep} value={dep}>{dep}</option>
                    ))}
                </select>
                <select
                    className={selectClass}
                    name="manager"
                    value={form.manager}
                    onChange={handleChange}
                    required={managers.length > 0}
                    disabled={loadingManagers}
                >
                    <option value="">
                        {loadingManagers ? 'Loading managers...' : managers.length > 0 ? 'Select manager (required)' : 'Select manager'}
                    </option>
                    {managers.length === 0 && !loadingManagers ? (
                        <option value="CEO">First employee — no manager</option>
                    ) : null}
                    {managers.map((mgr) => {
                        const fullName = `${mgr.name}${mgr.lastName ? ` ${mgr.lastName}` : ''}`.trim();
                        return (
                            <option key={mgr._id || mgr.employeeId} value={mgr._id || fullName}>
                                {fullName} — {mgr.position}
                            </option>
                        );
                    })}
                </select>
            </div>
            <div className="flex flex-col gap-4 lg:flex-row">
                <select
                    className={selectClass}
                    name="jobTitle"
                    value={form.jobTitle}
                    onChange={handleChange}
                    required
                >
                    <option value="">Select job title</option>
                    {jobTitles.map((title) => (
                        <option key={title} value={title}>{title}</option>
                    ))}
                </select>
                <select
                    className={selectClass}
                    name="jobCategory"
                    value={form.jobCategory}
                    onChange={handleChange}
                    required
                >
                    <option value="">Select job category</option>
                    {jobCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
            </div>
            <div className="flex flex-col gap-4 lg:flex-row">
                <select
                    className={selectClass}
                    name="position"
                    value={form.position}
                    onChange={handleChange}
                    required
                >
                    <option value="">Select position level</option>
                    {positions.map((pos) => (
                        <option key={pos} value={pos}>{pos}</option>
                    ))}
                </select>
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
        </div>
    );

    const renderAccessStep = () => (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            {suggestionLoading ? (
                <p className="mb-3 text-xs text-slate-500">Checking recommended access…</p>
            ) : null}

            {!loadingRoles && !suggestionLoading && roleSuggestionReason && !roleManuallyOverridden ? (
                <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    <span className="font-medium">Suggested: {suggestedRoleLabel}</span>
                    <span className="text-emerald-800"> — {roleSuggestionReason}</span>
                </div>
            ) : null}

            {!loadingRoles && roleManuallyOverridden && suggestedRole.reason ? (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <span>
                        Suggested <span className="font-medium">{suggestedRoleLabel}</span>
                        {roleSuggestionReason ? ` (${roleSuggestionReason})` : ''}
                    </span>
                    <button
                        type="button"
                        onClick={handleApplySuggestedRole}
                        className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-200"
                    >
                        Use suggestion
                    </button>
                </div>
            ) : null}

            {!loadingRoles && roleMismatch.mismatch ? (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Job details suggest <span className="font-medium">{getRoleLabel(roleMismatch.suggestedRoleId, roleCatalog)}</span>
                    {roleMismatch.suggestedReason ? ` (${roleMismatch.suggestedReason})` : ''}, but you selected{' '}
                    <span className="font-medium">{selectedRoleLabel}</span>.
                </div>
            ) : null}

            {loadingRoles ? (
                <p className="text-sm text-slate-500">Loading roles…</p>
            ) : (
                <SystemRolePicker
                    catalog={roleCatalog}
                    value={form.systemRole}
                    onChange={handleSystemRoleChange}
                    label="What can this person do in the app?"
                />
            )}
            <p className="mt-2 text-xs text-slate-500">
                Auto-suggested from department, job title, and position. Override only when needed.
            </p>
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
                            <dd className="font-medium text-slate-900">{form.department}</dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">Job title</dt>
                            <dd className="font-medium text-slate-900">{form.jobTitle}</dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">Position</dt>
                            <dd className="font-medium text-slate-900">{form.position}</dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">Manager</dt>
                            <dd className="font-medium text-slate-900">{managerLabel}</dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">System access</dt>
                            <dd className="font-semibold text-emerald-700">{selectedRoleLabel}</dd>
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
                        Note: job details suggest {getRoleLabel(roleMismatch.suggestedRoleId, roleCatalog)}, but you assigned{' '}
                        {selectedRoleLabel}. Confirm this is intentional before creating the employee.
                    </div>
                ) : null}
            </div>
        );
    };

    if (!isOrgOwner) {
        return <Navigate to="/dashboard-admin" replace />;
    }

    return (
        <div className="min-h-screen bg-[#F5F7FB]">
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
                    <h1 className="mb-2 text-xl font-semibold text-slate-900 sm:text-2xl">Add employee</h1>
                    <p className="mb-6 text-sm text-slate-500">
                        Create a profile, assign job details, and set system access in a few steps.
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
                            if (step < STEPS.length - 1) goNext();
                            else submitEmployee();
                        }}
                    >
                        {step === 0 && renderPersonalStep()}
                        {step === 1 && renderJobStep()}
                        {step === 2 && renderAccessStep()}
                        {step === 3 && renderReviewStep()}

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
                                    : step < STEPS.length - 1
                                      ? 'Continue'
                                      : 'Create employee'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <ElevatedRoleConfirmModal
                open={showElevatedModal}
                roleId={form.systemRole}
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
