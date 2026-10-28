import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    FaMoneyBillWave, FaPlus, FaSpinner, FaSearch, FaEdit, FaTrash, FaEye,
    FaCheckCircle, FaTimesCircle, FaDownload, FaTimes, FaUsers, FaShieldAlt,
    FaMapMarkerAlt, FaArrowRight, FaWallet, FaFolderOpen, FaUserFriends
} from 'react-icons/fa';
import { FiCheckCircle, FiShield } from 'react-icons/fi';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-toastify';
import { format, differenceInCalendarDays } from 'date-fns';
import { isHR } from '../../utils/managerHelper';
import { exportToExcel } from '../../utils/exportUtils';
import '../../styles/benefitsUI.css';

const CATEGORY_THEME = {
    'Health Insurance': 'health',
    Dental: 'health',
    Vision: 'health',
    'Life Insurance': 'life',
    Transportation: 'meal',
    Wellness: 'wellness',
    Retirement: 'other',
    Education: 'other',
    Other: 'other',
};

const planTheme = (category) => CATEGORY_THEME[category] || 'other';

const initialsOf = (name = '') => {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const fyLabel = () => {
    const now = new Date();
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return `FY ${year}-${String(year + 1).slice(-2)} Active`;
};

const emptyForm = () => ({
    name: '',
    benefitCode: '',
    category: 'Health Insurance',
    description: '',
    provider: '',
    planType: 'Both',
    coverage: 'Full',
    enrollmentType: 'Optional',
    employeeContribution: {
        amount: 0,
        percentage: 0,
        frequency: 'Monthly'
    },
    companyContribution: {
        amount: 0,
        percentage: 0
    },
    eligibility: {
        employmentType: ['Full-time'],
        tenure: 0,
        departments: [],
        positionLevels: [],
        locations: [],
        roles: []
    },
    enrollmentPeriod: {
        startDate: '',
        endDate: '',
        isOpen: true
    },
    effectiveDate: '',
    expiryDate: '',
    isActive: true
});

const formatContribution = (amount, frequency = 'Monthly') => {
    const value = Number(amount || 0);
    const suffix =
        frequency === 'Annual' ? '/year' :
        frequency === 'One-time' ? '' :
        '/month';
    return `₹${value.toLocaleString('en-IN')}${suffix}`;
};

const formatEligibility = (plan) => {
    const depts = plan.eligibility?.departments?.filter(Boolean);
    if (depts?.length) return depts.join(', ');
    const types = plan.eligibility?.employmentType;
    if (types?.length) return types.join(', ');
    return 'All Employees';
};

const displayOrDash = (value) => {
    const text = String(value ?? '').trim();
    return text || 'Not set';
};

const toDateInput = (value) => {
    if (!value) return '';
    try {
        return format(new Date(value), 'yyyy-MM-dd');
    } catch {
        return '';
    }
};

const BenefitsPage = () => {
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);

    const isHRUser = useMemo(() => {
        const userRole = user?.role || employee?.role;
        if (userRole === 'admin') return true;
        return isHR(user || employee);
    }, [user, employee]);

    const [activeSection, setActiveSection] = useState('plans');
    const [benefitPlans, setBenefitPlans] = useState([]);
    const [employeeOverview, setEmployeeOverview] = useState([]);
    const [allEnrollments, setAllEnrollments] = useState([]);
    const [reportSummary, setReportSummary] = useState({
        totalPlans: 0,
        activePlans: 0,
        activeEnrollments: 0,
        pendingEnrollments: 0,
        expiringBenefits: 0
    });
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [planSearch, setPlanSearch] = useState('');
    const [planDrawer, setPlanDrawer] = useState(null);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [formData, setFormData] = useState(emptyForm());

    // Employee Benefits filters / drawer
    const [empSearch, setEmpSearch] = useState('');
    const [empDepartment, setEmpDepartment] = useState('all');
    const [empStatus, setEmpStatus] = useState('all');
    const [empBenefit, setEmpBenefit] = useState('all');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerTab, setDrawerTab] = useState('overview');
    const [selectedEmployeeRow, setSelectedEmployeeRow] = useState(null);
    const [dependentForm, setDependentForm] = useState({ name: '', relationship: 'Spouse', dateOfBirth: '' });
    const [addingDependentFor, setAddingDependentFor] = useState(null);

    // Reports filters
    const [reportBenefit, setReportBenefit] = useState('all');
    const [reportDepartment, setReportDepartment] = useState('all');
    const [reportStatus, setReportStatus] = useState('all');
    const [reportType, setReportType] = useState('enrollment');
    const [hrEnrollPlanId, setHrEnrollPlanId] = useState('');
    const [hrEnrollCoverage, setHrEnrollCoverage] = useState('Individual');
    const [hrEnrolling, setHrEnrolling] = useState(false);
    const [employeeDirectory, setEmployeeDirectory] = useState([]);
    const [assignEmployeeId, setAssignEmployeeId] = useState('');
    const [assignPlanId, setAssignPlanId] = useState('');
    const [assignCoverage, setAssignCoverage] = useState('Individual');
    const [assignActivate, setAssignActivate] = useState(true);
    const [assigning, setAssigning] = useState(false);

    useEffect(() => {
        fetchBenefits();
        if (isHRUser) {
            fetchEmployeeOverview();
            fetchReportSummary();
            fetchAllEnrollments();
        }
    }, [isHRUser]);

    useEffect(() => {
        if (isHRUser) {
            fetchEmployeeDirectory();
        }
    }, [isHRUser, employeeOverview]);

    // Close Benefits overlays with Escape so they cannot block navbar clicks
    useEffect(() => {
        if (!showCreateModal && !drawerOpen && !planDrawer) return undefined;
        const onKeyDown = (event) => {
            if (event.key !== 'Escape') return;
            setShowCreateModal(false);
            setDrawerOpen(false);
            setPlanDrawer(null);
            setSelectedPlan(null);
            setAddingDependentFor(null);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [showCreateModal, drawerOpen, planDrawer]);

    // Ensure body scroll lock is cleared if overlays unmount unexpectedly
    useEffect(() => {
        if (showCreateModal || drawerOpen || planDrawer) {
            const previous = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = previous || '';
            };
        }
        return undefined;
    }, [showCreateModal, drawerOpen, planDrawer]);

    useEffect(() => {
        if (isHRUser) fetchAllEnrollments();
    }, [isHRUser, benefitPlans.length]);

    const fetchEmployeeDirectory = async () => {
        try {
            const allEmployees = [];
            let page = 1;
            let hasMore = true;

            while (hasMore && page <= 20) {
                const response = await axios.get('/v1/employee/auth/get-all-employees', {
                    params: { page, limit: 100 },
                    withCredentials: true
                });
                const body = response.data;
                const batch = Array.isArray(body)
                    ? body
                    : Array.isArray(body?.data)
                        ? body.data
                        : Array.isArray(body?.employees)
                            ? body.employees
                            : [];

                allEmployees.push(...batch);
                const pagination = body?.pagination;
                hasMore = pagination?.hasNext === true || (batch.length === 100 && !pagination);
                page += 1;
            }

            // Fallback: employees already present in benefits overview
            if (allEmployees.length === 0) {
                const fromOverview = (employeeOverview || [])
                    .map((row) => row.employee)
                    .filter(Boolean);
                allEmployees.push(...fromOverview);
            }

            const unique = [];
            const seen = new Set();
            allEmployees.forEach((emp) => {
                const id = String(emp?._id || '');
                if (!id || seen.has(id)) return;
                seen.add(id);
                unique.push(emp);
            });

            unique.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
            setEmployeeDirectory(unique);
        } catch (error) {
            toast.error('Failed to load employees for assignment');
            setEmployeeDirectory([]);
        }
    };

    const fetchBenefits = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/v1/both/benefits/benefit-plans', { withCredentials: true });
            setBenefitPlans(response.data?.data || []);
        } catch (error) {
            toast.error('Failed to load benefit plans');
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployeeOverview = async () => {
        try {
            const response = await axios.get('/v1/admin/benefits/employee-overview', { withCredentials: true });
            setEmployeeOverview(response.data?.data || []);
        } catch (error) {
            toast.error('Failed to load employee benefits');
        }
    };

    const fetchReportSummary = async () => {
        try {
            const response = await axios.get('/v1/admin/benefits/reports/summary', { withCredentials: true });
            setReportSummary(response.data?.data || reportSummary);
        } catch (error) {
            // Keep zeros if summary fails
        }
    };

    const fetchAllEnrollments = async () => {
        try {
            const response = await axios.get('/v1/admin/benefits/enrollments', { withCredentials: true });
            setAllEnrollments(response.data?.data || []);
        } catch (error) {
            // optional for reports
        }
    };

    const refreshOperationalData = async () => {
        await Promise.all([fetchEmployeeOverview(), fetchReportSummary(), fetchAllEnrollments()]);
    };

    const openCreateModal = () => {
        setSelectedPlan(null);
        setFormData(emptyForm());
        setShowCreateModal(true);
    };

    const openEditModal = (plan) => {
        setSelectedPlan(plan);
        setFormData({
            name: plan.name || '',
            benefitCode: plan.benefitCode || '',
            category: plan.category || 'Health Insurance',
            description: plan.description || '',
            provider: plan.provider || '',
            planType: plan.planType || 'Both',
            coverage: plan.coverage || 'Full',
            enrollmentType: plan.enrollmentType || 'Optional',
            employeeContribution: {
                amount: plan.employeeContribution?.amount || 0,
                percentage: plan.employeeContribution?.percentage || 0,
                frequency: plan.employeeContribution?.frequency || 'Monthly'
            },
            companyContribution: {
                amount: plan.companyContribution?.amount || 0,
                percentage: plan.companyContribution?.percentage || 0
            },
            eligibility: {
                employmentType: plan.eligibility?.employmentType?.length
                    ? plan.eligibility.employmentType
                    : ['Full-time'],
                tenure: plan.eligibility?.tenure || 0,
                departments: plan.eligibility?.departments || [],
                positionLevels: plan.eligibility?.positionLevels || [],
                locations: plan.eligibility?.locations || [],
                roles: plan.eligibility?.roles || []
            },
            enrollmentPeriod: {
                startDate: toDateInput(plan.enrollmentPeriod?.startDate),
                endDate: toDateInput(plan.enrollmentPeriod?.endDate),
                isOpen: plan.enrollmentPeriod?.isOpen || false
            },
            effectiveDate: toDateInput(plan.effectiveDate),
            expiryDate: toDateInput(plan.expiryDate),
            isActive: plan.isActive !== false
        });
        setShowCreateModal(true);
    };

    const handleSaveBenefit = async (e) => {
        e.preventDefault();

        if (!formData.name || !formData.category) {
            toast.error('Please fill in required fields');
            return;
        }

        const payload = {
            ...formData,
            enrollmentPeriod: {
                ...formData.enrollmentPeriod,
                startDate: formData.enrollmentPeriod.startDate || undefined,
                endDate: formData.enrollmentPeriod.endDate || undefined
            },
            effectiveDate: formData.effectiveDate || undefined,
            expiryDate: formData.expiryDate || undefined
        };

        try {
            setSubmitting(true);
            if (selectedPlan?._id) {
                await axios.put(`/v1/admin/benefits/benefit-plans/${selectedPlan._id}`, payload, { withCredentials: true });
                toast.success('Benefit plan updated successfully');
            } else {
                await axios.post('/v1/admin/benefits/benefit-plans', payload, { withCredentials: true });
                toast.success('Benefit plan created successfully');
            }
            setShowCreateModal(false);
            setSelectedPlan(null);
            setFormData(emptyForm());
            fetchBenefits();
            fetchReportSummary();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save benefit plan');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteBenefit = async (planId) => {
        if (!window.confirm('Are you sure you want to delete this benefit plan?')) return;

        try {
            await axios.delete(`/v1/admin/benefits/benefit-plans/${planId}`, { withCredentials: true });
            toast.success('Benefit plan deleted successfully');
            fetchBenefits();
            fetchReportSummary();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete benefit plan');
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Active':
            case 'Enrolled':
                return 'bg-theme-primary/10 text-theme-primary';
            case 'Pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'Cancelled':
            case 'Expired':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const enrollmentCountByPlan = useMemo(() => {
        const map = {};
        allEnrollments.forEach((e) => {
            const id = String(e.benefitPlanId?._id || e.benefitPlanId || '');
            if (!id) return;
            if (!map[id]) map[id] = { active: 0, total: 0 };
            map[id].total += 1;
            if (['Active', 'Enrolled'].includes(e.status)) map[id].active += 1;
        });
        return map;
    }, [allEnrollments]);

    const workforceTotal = useMemo(() => {
        const fromDir = employeeDirectory.length;
        const fromOverview = employeeOverview.length;
        return Math.max(fromDir, fromOverview, 1);
    }, [employeeDirectory.length, employeeOverview.length]);

    const kpiStats = useMemo(() => {
        const activePlans = benefitPlans.filter((p) => p.isActive).length;
        const activeEnrollments = reportSummary.activeEnrollments || 0;
        const optIn = Math.min(100, Math.round((activeEnrollments / workforceTotal) * 1000) / 10);
        const subsidyVals = benefitPlans
            .map((p) => Number(p.companyContribution?.percentage))
            .filter((n) => !Number.isNaN(n) && n > 0);
        const avgSubsidy = subsidyVals.length
            ? Math.round((subsidyVals.reduce((a, b) => a + b, 0) / subsidyVals.length) * 10) / 10
            : 0;
        const annualPremium = benefitPlans.reduce((sum, p) => {
            const amt = Number(p.companyContribution?.amount || 0);
            const freq = p.employeeContribution?.frequency || 'Monthly';
            return sum + (freq === 'Monthly' ? amt * 12 : amt);
        }, 0);
        const premiumLabel =
            annualPremium >= 1e7
                ? `₹${(annualPremium / 1e7).toFixed(2)} Cr`
                : annualPremium >= 1e5
                    ? `₹${(annualPremium / 1e5).toFixed(2)} L`
                    : `₹${annualPremium.toLocaleString('en-IN')}`;
        return {
            activePlans,
            activeEnrollments,
            optIn,
            avgSubsidy,
            premiumLabel,
            employeeCopay: Math.max(0, Math.round((100 - avgSubsidy) * 10) / 10),
        };
    }, [benefitPlans, reportSummary.activeEnrollments, workforceTotal]);

    const categoryChips = useMemo(() => {
        const counts = {};
        benefitPlans.forEach((p) => {
            const cat = p.category || 'Other';
            counts[cat] = (counts[cat] || 0) + 1;
        });
        return [
            { id: 'all', label: `All Types (${benefitPlans.length})` },
            ...Object.keys(counts)
                .sort()
                .map((cat) => ({ id: cat, label: cat })),
        ];
    }, [benefitPlans]);

    const coverageLocations = useMemo(() => {
        const set = new Set();
        benefitPlans.forEach((p) => {
            (p.eligibility?.locations || []).forEach((loc) => {
                if (loc) set.add(loc);
            });
        });
        const list = Array.from(set);
        if (!list.length) return 'Pan-India Coverage';
        return `Pan-India Coverage: ${list.slice(0, 4).join(', ')}`;
    }, [benefitPlans]);

    const filteredPlans = benefitPlans.filter((plan) => {
        const matchesStatus =
            statusFilter === 'all' ||
            (statusFilter === 'active' && plan.isActive) ||
            (statusFilter === 'inactive' && !plan.isActive);
        const matchesCategory = categoryFilter === 'all' || plan.category === categoryFilter;
        const q = planSearch.trim().toLowerCase();
        const matchesSearch =
            !q ||
            `${plan.name || ''} ${plan.provider || ''} ${plan.benefitCode || ''} ${plan.category || ''} ${plan.description || ''}`
                .toLowerCase()
                .includes(q);
        return matchesStatus && matchesCategory && matchesSearch;
    });

    const planDrawerEnrollments = useMemo(() => {
        if (!planDrawer?._id) return [];
        const pid = String(planDrawer._id);
        return allEnrollments
            .filter((e) => String(e.benefitPlanId?._id || e.benefitPlanId) === pid)
            .filter((e) => ['Active', 'Enrolled', 'Pending'].includes(e.status))
            .slice(0, 8);
    }, [planDrawer, allEnrollments]);

    const departments = useMemo(() => {
        const set = new Set();
        employeeOverview.forEach((row) => {
            if (row.employee?.department) set.add(row.employee.department);
        });
        allEnrollments.forEach((e) => {
            if (e.employeeId?.department) set.add(e.employeeId.department);
        });
        return Array.from(set).sort();
    }, [employeeOverview, allEnrollments]);

    const filteredEmployees = useMemo(() => {
        return employeeOverview.filter((row) => {
            const emp = row.employee || {};
            const matchesSearch =
                !empSearch ||
                `${emp.name || ''} ${emp.email || ''} ${emp.employeeId || ''}`
                    .toLowerCase()
                    .includes(empSearch.toLowerCase());
            const matchesDept = empDepartment === 'all' || emp.department === empDepartment;
            const matchesBenefit =
                empBenefit === 'all' ||
                row.enrollments?.some((e) => e.benefitPlanId?._id === empBenefit || e.benefitPlanId === empBenefit);
            const matchesStatus =
                empStatus === 'all' ||
                row.enrollments?.some((e) => e.status === empStatus) ||
                (empStatus === 'Active' && row.activeCount > 0) ||
                (empStatus === 'Pending' && row.pendingCount > 0);
            return matchesSearch && matchesDept && matchesBenefit && matchesStatus;
        });
    }, [employeeOverview, empSearch, empDepartment, empBenefit, empStatus]);

    const openEmployeeDrawer = (row) => {
        setSelectedEmployeeRow(row);
        setDrawerTab('overview');
        setDrawerOpen(true);
        setAddingDependentFor(null);
        setDependentForm({ name: '', relationship: 'Spouse', dateOfBirth: '' });
    };

    const refreshSelectedEmployee = async (employeeId) => {
        const response = await axios.get('/v1/admin/benefits/employee-overview', { withCredentials: true });
        const rows = response.data?.data || [];
        setEmployeeOverview(rows);
        const updated = rows.find((r) => String(r.employee?._id) === String(employeeId));
        if (updated) setSelectedEmployeeRow(updated);
        await Promise.all([fetchReportSummary(), fetchAllEnrollments()]);
    };

    const handleEnrollmentAction = async (enrollmentId, status) => {
        try {
            await axios.put(
                `/v1/admin/benefits/enrollments/${enrollmentId}`,
                { status },
                { withCredentials: true }
            );
            toast.success(status === 'Active' ? 'Enrollment approved' : 'Enrollment rejected');
            if (selectedEmployeeRow?.employee?._id) {
                await refreshSelectedEmployee(selectedEmployeeRow.employee._id);
            } else {
                await refreshOperationalData();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update enrollment');
        }
    };

    const supportsDependents = (enrollment) => {
        const planType = enrollment.benefitPlanId?.planType;
        return planType === 'Family' || planType === 'Both' || (enrollment.dependents?.length > 0);
    };

    const handleAddDependent = async (enrollment) => {
        if (!dependentForm.name.trim()) {
            toast.error('Dependent name is required');
            return;
        }
        const next = [
            ...(enrollment.dependents || []),
            {
                name: dependentForm.name.trim(),
                relationship: dependentForm.relationship,
                dateOfBirth: dependentForm.dateOfBirth || undefined
            }
        ];
        try {
            await axios.put(
                `/v1/admin/benefits/enrollments/${enrollment._id}/dependents`,
                { dependents: next },
                { withCredentials: true }
            );
            toast.success('Dependent added');
            setDependentForm({ name: '', relationship: 'Spouse', dateOfBirth: '' });
            setAddingDependentFor(null);
            await refreshSelectedEmployee(selectedEmployeeRow.employee._id);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add dependent');
        }
    };

    const handleRemoveDependent = async (enrollment, index) => {
        const next = (enrollment.dependents || []).filter((_, i) => i !== index);
        try {
            await axios.put(
                `/v1/admin/benefits/enrollments/${enrollment._id}/dependents`,
                { dependents: next },
                { withCredentials: true }
            );
            toast.success('Dependent removed');
            await refreshSelectedEmployee(selectedEmployeeRow.employee._id);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to remove dependent');
        }
    };

    const filteredReportRows = useMemo(() => {
        const now = new Date();
        const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        return allEnrollments.filter((e) => {
            const matchesBenefit =
                reportBenefit === 'all' ||
                e.benefitPlanId?._id === reportBenefit ||
                e.benefitPlanId === reportBenefit;
            const matchesDept =
                reportDepartment === 'all' || e.employeeId?.department === reportDepartment;
            const matchesStatus = reportStatus === 'all' || e.status === reportStatus;

            if (!(matchesBenefit && matchesDept && matchesStatus)) return false;

            if (reportType === 'expiring') {
                if (!e.expiryDate) return false;
                const exp = new Date(e.expiryDate);
                return exp >= now && exp <= in30Days && ['Active', 'Enrolled'].includes(e.status);
            }
            if (reportType === 'contribution') {
                return ['Active', 'Enrolled', 'Pending'].includes(e.status);
            }
            if (reportType === 'department') {
                return Boolean(e.employeeId?.department);
            }
            return true;
        });
    }, [allEnrollments, reportBenefit, reportDepartment, reportStatus, reportType]);

    const handleExport = () => {
        let rows = filteredReportRows.map((e) => ({
            ReportType: reportType,
            Employee: e.employeeId?.name || '',
            EmployeeID: e.employeeId?.employeeId || '',
            Department: e.employeeId?.department || '',
            Benefit: e.benefitPlanId?.name || '',
            Category: e.benefitPlanId?.category || '',
            Status: e.status || '',
            Coverage: e.coverageType || '',
            'Employer Contribution': e.companyContribution ?? 0,
            'Employee Contribution': e.employeeContribution ?? 0,
            EnrollmentDate: e.enrollmentDate ? format(new Date(e.enrollmentDate), 'yyyy-MM-dd') : '',
            ExpiryDate: e.expiryDate ? format(new Date(e.expiryDate), 'yyyy-MM-dd') : ''
        }));

        // If no enrollments yet, still allow exporting configured benefit plans
        if (rows.length === 0 && reportType === 'enrollment') {
            rows = benefitPlans.map((plan) => ({
                ReportType: 'plans',
                Benefit: plan.name || '',
                Code: plan.benefitCode || '',
                Category: plan.category || '',
                Status: plan.isActive ? 'Active' : 'Inactive',
                EnrollmentType: plan.enrollmentType || 'Optional',
                'Employer Contribution': plan.companyContribution?.amount ?? 0,
                'Employee Contribution': plan.employeeContribution?.amount ?? 0,
                Provider: plan.provider || ''
            }));
        }

        if (rows.length === 0) {
            toast.error('No data to export for the selected report filters');
            return;
        }

        exportToExcel(rows, `benefits-${reportType}-report.csv`);
        toast.success(`Exported ${rows.length} row(s)`);
    };

    const handleHrEnrollForEmployee = async () => {
        if (!selectedEmployeeRow?.employee?._id || !hrEnrollPlanId) {
            toast.error('Select a benefit plan');
            return;
        }
        try {
            setHrEnrolling(true);
            await axios.post(
                '/v1/admin/benefits/enrollments',
                {
                    employeeId: selectedEmployeeRow.employee._id,
                    benefitPlanId: hrEnrollPlanId,
                    coverageType: hrEnrollCoverage,
                    activateImmediately: benefitPlans.find((p) => p._id === hrEnrollPlanId)?.enrollmentType === 'Automatic'
                },
                { withCredentials: true }
            );
            toast.success('Employee enrolled successfully');
            setHrEnrollPlanId('');
            await refreshSelectedEmployee(selectedEmployeeRow.employee._id);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to enroll employee');
        } finally {
            setHrEnrolling(false);
        }
    };

    const handleAssignFromSettings = async () => {
        if (!assignEmployeeId || !assignPlanId) {
            toast.error('Select employee and benefit plan');
            return;
        }
        try {
            setAssigning(true);
            await axios.post(
                '/v1/admin/benefits/enrollments',
                {
                    employeeId: assignEmployeeId,
                    benefitPlanId: assignPlanId,
                    coverageType: assignCoverage,
                    activateImmediately: assignActivate
                },
                { withCredentials: true }
            );
            toast.success('Benefit assigned successfully');
            setAssignEmployeeId('');
            setAssignPlanId('');
            await refreshOperationalData();
            fetchBenefits();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to assign benefit');
        } finally {
            setAssigning(false);
        }
    };

    const toggleEnrollmentOpen = async (plan) => {
        try {
            const nextOpen = !plan.enrollmentPeriod?.isOpen;
            await axios.put(
                `/v1/admin/benefits/benefit-plans/${plan._id}`,
                {
                    enrollmentPeriod: {
                        ...(plan.enrollmentPeriod || {}),
                        isOpen: nextOpen
                    }
                },
                { withCredentials: true }
            );
            toast.success(nextOpen ? 'Enrollment opened' : 'Enrollment closed');
            fetchBenefits();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update enrollment window');
        }
    };

    const drawerHistory = useMemo(() => {
        if (!selectedEmployeeRow?.enrollments) return [];
        const events = [];
        selectedEmployeeRow.enrollments.forEach((enrollment) => {
            (enrollment.history || []).forEach((h) => {
                events.push({
                    ...h,
                    planName: enrollment.benefitPlanId?.name
                });
            });
            if (!enrollment.history?.length && enrollment.enrollmentDate) {
                events.push({
                    type: 'Enrollment Created',
                    message: `${enrollment.benefitPlanId?.name || 'Benefit'} enrollment`,
                    createdAt: enrollment.enrollmentDate,
                    planName: enrollment.benefitPlanId?.name
                });
            }
        });
        return events.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }, [selectedEmployeeRow]);

    if (loading) {
        return <LoadingSpinner message="Loading benefits..." />;
    }

    const renderPlanCard = (plan) => {
        const theme = planTheme(plan.category);
        const counts = enrollmentCountByPlan[String(plan._id)] || { active: 0, total: 0 };
        const pct = workforceTotal > 0 ? Math.min(100, Math.round((counts.active / workforceTotal) * 100)) : 0;
        const companyPct = Number(plan.companyContribution?.percentage || 0);
        const freq = plan.employeeContribution?.frequency || 'Monthly';
        const companyAmt = formatContribution(plan.companyContribution?.amount, freq);
        const empAmt = formatContribution(plan.employeeContribution?.amount, freq);
        return (
            <article key={plan._id} className={`ben-plan ben-plan--${theme}`}>
                <div className="ben-plan__top">
                    <span className="ben-plan__cat">
                        <span className="ben-plan__dot" aria-hidden="true" />
                        {plan.category || 'Benefit'}
                    </span>
                    <span className={`ben-plan__status${plan.isActive ? '' : ' is-off'}`}>
                        {plan.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
                <h3 className="ben-plan__name">{plan.name}</h3>
                <p className="ben-plan__desc">
                    {[plan.provider, plan.description].filter(Boolean).join(' • ') || 'Company benefit plan'}
                </p>
                <div className="ben-plan__stats">
                    <div>
                        <p className="ben-plan__stat-label">Coverage</p>
                        <p className="ben-plan__stat-value">{plan.coverage || plan.planType || '—'}</p>
                    </div>
                    <div>
                        <p className="ben-plan__stat-label">Annual / premium</p>
                        <p className="ben-plan__stat-value">{companyAmt}</p>
                    </div>
                    <div>
                        <p className="ben-plan__stat-label">Company subsidy</p>
                        <p className="ben-plan__stat-value is-green">
                            {companyPct > 0 ? `${companyPct}%` : companyAmt}
                        </p>
                    </div>
                    <div>
                        <p className="ben-plan__stat-label">Employee co-pay</p>
                        <p className="ben-plan__stat-value">{empAmt}</p>
                    </div>
                </div>
                <ul className="ben-plan__meta">
                    <li>
                        <FiCheckCircle aria-hidden="true" />
                        Eligibility: {formatEligibility(plan)}
                    </li>
                    <li>
                        <FiShield aria-hidden="true" />
                        {plan.enrollmentType || 'Optional'} enrollment
                        {plan.benefitCode ? ` • ${plan.benefitCode}` : ''}
                    </li>
                </ul>
                <div className="ben-plan__roster">
                    <div className="ben-plan__roster-row">
                        <span className="ben-plan__roster-label">Active roster</span>
                        <span className="ben-plan__roster-value">
                            {counts.active} Enrolled ({pct}%)
                        </span>
                    </div>
                    <div className="ben-plan__progress" aria-hidden="true">
                        <span style={{ width: `${pct}%` }} />
                    </div>
                    <button
                        type="button"
                        className="ben-plan__cta"
                        onClick={() => setPlanDrawer(plan)}
                    >
                        View Details &amp; Roster <FaArrowRight className="text-xs" />
                    </button>
                </div>
            </article>
        );
    };

    return (
        <div className="ben-ui">
            <div className="ben-ui__inner">
                        <header className="ben-ui__header">
                            <div>
                                <div className="ben-ui__crumb-row">
                                    <p className="ben-ui__crumb">People &amp; Compensation / Benefits &amp; Insurance Suite</p>
                                    <span className="ben-ui__fy">
                                        <span className="ben-ui__fy-dot" aria-hidden="true" />
                                        {fyLabel()}
                                    </span>
                                </div>
                                <h1 className="ben-ui__title">Benefits &amp; Insurance Administration</h1>
                                <p className="ben-ui__subtitle">
                                    Curate healthcare tiers, oversee lifecycle enrollments, and track employer subsidy across office hubs.
                                </p>
                            </div>
                            <div className="ben-ui__actions">
                                {isHRUser ? (
                                    <button
                                        type="button"
                                        className="ben-ui__btn ben-ui__btn--ghost"
                                        onClick={async () => {
                                            await fetchAllEnrollments();
                                            handleExport();
                                        }}
                                    >
                                        <FaDownload /> Export Ledger
                                    </button>
                                ) : null}
                                {isHRUser ? (
                                    <button type="button" className="ben-ui__btn ben-ui__btn--primary" onClick={openCreateModal}>
                                        <FaPlus /> Create Plan
                                    </button>
                                ) : null}
                            </div>
                        </header>

                        <div className="ben-ui__kpis">
                            <div className="ben-ui__kpi">
                                <p className="ben-ui__kpi-label">Annual Gross Premium</p>
                                <span className="ben-ui__kpi-icon">₹</span>
                                <p className="ben-ui__kpi-value">{kpiStats.premiumLabel}</p>
                                <p className="ben-ui__kpi-meta">{kpiStats.activePlans} active plans in pool</p>
                                <div className="ben-ui__kpi-bar"><span style={{ width: '72%' }} /></div>
                            </div>
                            <div className="ben-ui__kpi">
                                <p className="ben-ui__kpi-label">Enrolled Personnel</p>
                                <span className="ben-ui__kpi-icon"><FaUsers /></span>
                                <p className="ben-ui__kpi-value">
                                    {kpiStats.activeEnrollments} / {workforceTotal}
                                </p>
                                <p className="ben-ui__kpi-meta">{kpiStats.optIn}% workforce opt-in rate</p>
                                <div className="ben-ui__kpi-bar">
                                    <span style={{ width: `${Math.min(100, kpiStats.optIn)}%` }} />
                                </div>
                            </div>
                            <div className="ben-ui__kpi">
                                <p className="ben-ui__kpi-label">Avg Employer Subsidy</p>
                                <span className="ben-ui__kpi-icon ben-ui__kpi-icon--blue"><FaWallet /></span>
                                <p className="ben-ui__kpi-value">{kpiStats.avgSubsidy || 0}%</p>
                                <p className="ben-ui__kpi-meta ben-ui__kpi-meta--muted">
                                    Employee co-pay avg: {kpiStats.employeeCopay}%
                                </p>
                                <div className="ben-ui__kpi-bar ben-ui__kpi-bar--navy">
                                    <span style={{ width: `${Math.min(100, kpiStats.avgSubsidy || 0)}%` }} />
                                </div>
                            </div>
                            <div className="ben-ui__kpi">
                                <p className="ben-ui__kpi-label">Claims Settled Ratio</p>
                                <span className="ben-ui__kpi-icon"><FaShieldAlt /></span>
                                <p className="ben-ui__kpi-value">
                                    {reportSummary.expiringBenefits != null
                                        ? `${Math.max(0, 100 - Math.min(20, reportSummary.pendingEnrollments || 0))}%`
                                        : '—'}
                                </p>
                                <p className="ben-ui__kpi-meta">
                                    {reportSummary.pendingEnrollments || 0} pending • {reportSummary.expiringBenefits || 0} expiring
                                </p>
                                <div className="ben-ui__kpi-bar"><span style={{ width: '88%' }} /></div>
                            </div>
                        </div>

                        <div className="ben-ui__board">
                            <div className="ben-ui__board-head">
                                <div className="ben-ui__tabs">
                                    <button
                                        type="button"
                                        className={`ben-ui__tab${activeSection === 'plans' ? ' is-active' : ''}`}
                                        onClick={() => setActiveSection('plans')}
                                    >
                                        <FaFolderOpen /> Plans Catalog
                                        <span className="ben-ui__tab-count">{kpiStats.activePlans} Active</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`ben-ui__tab${activeSection === 'employees' ? ' is-active' : ''}`}
                                        onClick={() => {
                                            setActiveSection('employees');
                                            if (isHRUser) fetchEmployeeOverview();
                                        }}
                                    >
                                        <FaUserFriends /> Employee Enrollments
                                        <span className="ben-ui__tab-count">{kpiStats.activeEnrollments || employeeOverview.length}</span>
                                    </button>
                                </div>
                                <p className="ben-ui__coverage">
                                    <FaMapMarkerAlt aria-hidden="true" /> {coverageLocations}
                                </p>
                            </div>

                        {/* ========== Benefit Plans ========== */}
                        {activeSection === 'plans' && (
                            <>
                                <div className="ben-ui__toolbar">
                                    <div className="ben-ui__chips">
                                        {categoryChips.map((chip) => (
                                            <button
                                                key={chip.id}
                                                type="button"
                                                className={`ben-ui__chip${categoryFilter === chip.id ? ' is-active' : ''}`}
                                                onClick={() => setCategoryFilter(chip.id)}
                                            >
                                                {chip.label}
                                            </button>
                                        ))}
                                        {[
                                            { id: 'all', label: 'All status' },
                                            { id: 'active', label: 'Active' },
                                            { id: 'inactive', label: 'Inactive' },
                                        ].map((chip) => (
                                            <button
                                                key={`st-${chip.id}`}
                                                type="button"
                                                className={`ben-ui__chip${statusFilter === chip.id ? ' is-active' : ''}`}
                                                onClick={() => setStatusFilter(chip.id)}
                                            >
                                                {chip.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="ben-ui__search">
                                        <FaSearch className="ben-ui__search-ico" aria-hidden="true" />
                                        <input
                                            type="search"
                                            value={planSearch}
                                            onChange={(e) => setPlanSearch(e.target.value)}
                                            placeholder="Search plans, sum insured…"
                                            aria-label="Search benefit plans"
                                        />
                                    </div>
                                </div>
                                <div className="ben-ui__grid">
                                    {filteredPlans.map(renderPlanCard)}
                                    {filteredPlans.length === 0 ? (
                                        <div className="ben-ui__empty">
                                            <FaMoneyBillWave className="mx-auto mb-3 text-3xl opacity-40" />
                                            {benefitPlans.length === 0
                                                ? 'No benefit plans configured yet.'
                                                : 'No benefit plans match your filters.'}
                                        </div>
                                    ) : null}
                                </div>
                            </>
                        )}

                        {/* ========== Employee Benefits ========== */}
                        {activeSection === 'employees' && isHRUser && (
                            <>
                                <div className="ben-ui__toolbar">
                                    <div className="ben-ui__search" style={{ maxWidth: '100%', flex: 1 }}>
                                        <FaSearch className="ben-ui__search-ico" aria-hidden="true" />
                                        <input
                                            type="search"
                                            placeholder="Search employee"
                                            value={empSearch}
                                            onChange={(e) => setEmpSearch(e.target.value)}
                                            aria-label="Search employee"
                                        />
                                    </div>
                                    <select
                                        value={empDepartment}
                                        onChange={(e) => setEmpDepartment(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
                                    >
                                        <option value="all">Department</option>
                                        {departments.map((d) => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={empStatus}
                                        onChange={(e) => setEmpStatus(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
                                    >
                                        <option value="all">Status</option>
                                        <option value="Active">Active</option>
                                        <option value="Pending">Pending</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                    <select
                                        value={empBenefit}
                                        onChange={(e) => setEmpBenefit(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
                                    >
                                        <option value="all">Benefit</option>
                                        {benefitPlans.map((p) => (
                                            <option key={p._id} value={p._id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="ben-ui__table-wrap">
                                    <div className="overflow-x-auto">
                                        <table className="ben-ui__table">
                                            <thead>
                                                <tr>
                                                    <th>Employee</th>
                                                    <th>Benefits</th>
                                                    <th>Active</th>
                                                    <th>Pending</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredEmployees.map((row) => (
                                                    <tr key={row.employee._id} className="border-t border-gray-100 hover:bg-gray-50/80">
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium text-gray-800">{row.employee.name}</div>
                                                            <div className="text-xs text-gray-500">
                                                                {row.employee.employeeId || row.employee.department || ''}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-600">
                                                            {row.benefitNames?.join(', ') || '—'}
                                                        </td>
                                                        <td className="px-4 py-3">{row.activeCount}</td>
                                                        <td className="px-4 py-3">{row.pendingCount}</td>
                                                        <td className="px-4 py-3">
                                                            <button
                                                                type="button"
                                                                onClick={() => openEmployeeDrawer(row)}
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary transition text-sm"
                                                            >
                                                                <FaEye /> View
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {filteredEmployees.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                                                            No employee benefits found.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}

                        {activeSection === 'employees' && !isHRUser && (
                            <div className="bg-white rounded-lg p-8 text-center text-gray-500 border border-gray-100">
                                Employee benefits management is available to HR and Admin.
                            </div>
                        )}

                        </div>

            {/* Create/Edit Modal */}
            {showCreateModal && isHRUser
                ? createPortal(
                    <div className="ben-form-root" role="presentation">
                        <button
                            type="button"
                            className="ben-form-backdrop"
                            aria-label="Dismiss form"
                            onClick={() => {
                                setShowCreateModal(false);
                                setFormData(emptyForm());
                                setSelectedPlan(null);
                            }}
                        />
                        <div
                            className="ben-form"
                            role="dialog"
                            aria-modal="true"
                            aria-label={selectedPlan ? 'Edit Benefit Plan' : 'Add Benefit'}
                        >
                            <header className="ben-form__head">
                                <div>
                                    <p className="ben-form__eyebrow">Benefits catalog</p>
                                    <h3 className="ben-form__title">
                                        {selectedPlan ? 'Edit Benefit Plan' : 'Add Benefit'}
                                    </h3>
                                    <p className="ben-form__sub">
                                        {selectedPlan
                                            ? 'Update coverage, subsidy, and eligibility for this plan.'
                                            : 'Define coverage, contributions, and who can enroll.'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className="ben-form__close"
                                    aria-label="Close"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setFormData(emptyForm());
                                        setSelectedPlan(null);
                                    }}
                                >
                                    <FaTimes />
                                </button>
                            </header>

                            <form onSubmit={handleSaveBenefit} className="contents">
                                <div className="ben-form__body">
                                    <section className="ben-form__section">
                                        <div className="ben-form__section-head">
                                            <span className="ben-form__section-icon"><FiShield /></span>
                                            <h4 className="ben-form__section-title">Basic Information</h4>
                                        </div>
                                        <div className="ben-form__grid ben-form__grid--2">
                                            <div className="ben-form__field">
                                                <label className="ben-form__label">
                                                    Benefit Name <span className="ben-form__req">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={formData.name}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    className="ben-form__control"
                                                    required
                                                    placeholder="e.g. Group Health Insurance"
                                                />
                                            </div>
                                            <div className="ben-form__field">
                                                <label className="ben-form__label">Benefit Code</label>
                                                <input
                                                    type="text"
                                                    value={formData.benefitCode}
                                                    onChange={(e) => setFormData({ ...formData, benefitCode: e.target.value })}
                                                    className="ben-form__control"
                                                    placeholder="e.g. HEALTH-001"
                                                />
                                            </div>
                                            <div className="ben-form__field">
                                                <label className="ben-form__label">
                                                    Category <span className="ben-form__req">*</span>
                                                </label>
                                                <select
                                                    value={formData.category}
                                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                                    className="ben-form__control"
                                                    required
                                                >
                                                    <option value="Health Insurance">Health Insurance</option>
                                                    <option value="Dental">Dental</option>
                                                    <option value="Vision">Vision</option>
                                                    <option value="Life Insurance">Life Insurance</option>
                                                    <option value="Retirement">Retirement</option>
                                                    <option value="Wellness">Wellness</option>
                                                    <option value="Education">Education</option>
                                                    <option value="Transportation">Transportation</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
                                            <div className="ben-form__field">
                                                <label className="ben-form__label">Provider / Underwriter</label>
                                                <input
                                                    type="text"
                                                    value={formData.provider}
                                                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                                                    className="ben-form__control"
                                                    placeholder="e.g. HDFC Ergo"
                                                />
                                            </div>
                                            <div className="ben-form__field ben-form__field--span">
                                                <label className="ben-form__label">Description</label>
                                                <textarea
                                                    value={formData.description}
                                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                    className="ben-form__control"
                                                    rows={3}
                                                    placeholder="Short summary of what this plan covers"
                                                />
                                            </div>
                                            <div className="ben-form__field">
                                                <label className="ben-form__label">Plan Type</label>
                                                <select
                                                    value={formData.planType}
                                                    onChange={(e) => setFormData({ ...formData, planType: e.target.value })}
                                                    className="ben-form__control"
                                                >
                                                    <option value="Individual">Individual</option>
                                                    <option value="Family">Family</option>
                                                    <option value="Both">Both</option>
                                                </select>
                                            </div>
                                            <div className="ben-form__field">
                                                <label className="ben-form__label">Coverage</label>
                                                <select
                                                    value={formData.coverage}
                                                    onChange={(e) => setFormData({ ...formData, coverage: e.target.value })}
                                                    className="ben-form__control"
                                                >
                                                    <option value="Full">Full</option>
                                                    <option value="Partial">Partial</option>
                                                    <option value="Employee Contribution">Employee Contribution</option>
                                                </select>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="ben-form__section">
                                        <div className="ben-form__section-head">
                                            <span className="ben-form__section-icon"><FaWallet /></span>
                                            <h4 className="ben-form__section-title">Contribution</h4>
                                        </div>
                                        <div className="ben-form__grid ben-form__grid--3">
                                            <div className="ben-form__field">
                                                <label className="ben-form__label">Employer Contribution (₹)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.companyContribution.amount}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        companyContribution: {
                                                            ...formData.companyContribution,
                                                            amount: parseFloat(e.target.value) || 0
                                                        }
                                                    })}
                                                    className="ben-form__control"
                                                />
                                            </div>
                                            <div className="ben-form__field">
                                                <label className="ben-form__label">Employee Contribution (₹)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.employeeContribution.amount}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        employeeContribution: {
                                                            ...formData.employeeContribution,
                                                            amount: parseFloat(e.target.value) || 0
                                                        }
                                                    })}
                                                    className="ben-form__control"
                                                />
                                            </div>
                                            <div className="ben-form__field">
                                                <label className="ben-form__label">Frequency</label>
                                                <select
                                                    value={formData.employeeContribution.frequency}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        employeeContribution: {
                                                            ...formData.employeeContribution,
                                                            frequency: e.target.value
                                                        }
                                                    })}
                                                    className="ben-form__control"
                                                >
                                                    <option value="Monthly">Monthly</option>
                                                    <option value="Annual">Annual</option>
                                                    <option value="One-time">One-time</option>
                                                </select>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="ben-form__section">
                                        <div className="ben-form__section-head">
                                            <span className="ben-form__section-icon"><FaUsers /></span>
                                            <h4 className="ben-form__section-title">Eligibility</h4>
                                        </div>
                                        <div className="ben-form__grid ben-form__grid--3">
                                            <div className="ben-form__field">
                                                <label className="ben-form__label">Employment Type</label>
                                                <select
                                                    value={formData.eligibility.employmentType[0] || 'Full-time'}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        eligibility: {
                                                            ...formData.eligibility,
                                                            employmentType: [e.target.value]
                                                        }
                                                    })}
                                                    className="ben-form__control"
                                                >
                                                    <option value="Full-time">Full-time</option>
                                                    <option value="Part-time">Part-time</option>
                                                    <option value="Contract">Contract</option>
                                                </select>
                                            </div>
                                            <div className="ben-form__field">
                                                <label className="ben-form__label">Departments</label>
                                                <input
                                                    type="text"
                                                    value={(formData.eligibility.departments || []).join(', ')}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        eligibility: {
                                                            ...formData.eligibility,
                                                            departments: e.target.value
                                                                .split(',')
                                                                .map((s) => s.trim())
                                                                .filter(Boolean)
                                                        }
                                                    })}
                                                    className="ben-form__control"
                                                    placeholder="Comma-separated, blank = all"
                                                />
                                            </div>
                                            <div className="ben-form__field">
                                                <label className="ben-form__label">Min. Tenure (months)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.eligibility.tenure}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        eligibility: {
                                                            ...formData.eligibility,
                                                            tenure: parseInt(e.target.value, 10) || 0
                                                        }
                                                    })}
                                                    className="ben-form__control"
                                                />
                                            </div>
                                            <div className="ben-form__field">
                                                <label className="ben-form__label">Position Levels</label>
                                                <input
                                                    type="text"
                                                    value={(formData.eligibility.positionLevels || []).join(', ')}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        eligibility: {
                                                            ...formData.eligibility,
                                                            positionLevels: e.target.value
                                                                .split(',')
                                                                .map((s) => s.trim())
                                                                .filter(Boolean)
                                                        }
                                                    })}
                                                    className="ben-form__control"
                                                    placeholder="e.g. Junior, Senior"
                                                />
                                            </div>
                                            <div className="ben-form__field">
                                                <label className="ben-form__label">Locations</label>
                                                <input
                                                    type="text"
                                                    value={(formData.eligibility.locations || []).join(', ')}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        eligibility: {
                                                            ...formData.eligibility,
                                                            locations: e.target.value
                                                                .split(',')
                                                                .map((s) => s.trim())
                                                                .filter(Boolean)
                                                        }
                                                    })}
                                                    className="ben-form__control"
                                                    placeholder="Matches employee city"
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    <section className="ben-form__section">
                                        <div className="ben-form__section-head">
                                            <span className="ben-form__section-icon"><FaCheckCircle /></span>
                                            <h4 className="ben-form__section-title">Enrollment</h4>
                                        </div>
                                        <div className="ben-form__grid ben-form__grid--2">
                                            <div className="ben-form__field">
                                                <label className="ben-form__label">Enrollment Type</label>
                                                <select
                                                    value={formData.enrollmentType}
                                                    onChange={(e) => setFormData({ ...formData, enrollmentType: e.target.value })}
                                                    className="ben-form__control"
                                                >
                                                    <option value="Optional">Optional</option>
                                                    <option value="Required">Required</option>
                                                    <option value="Automatic">Automatic</option>
                                                </select>
                                            </div>
                                            <div className="ben-form__field">
                                                <div className="ben-form__check">
                                                    <input
                                                        type="checkbox"
                                                        id="isActive"
                                                        checked={formData.isActive}
                                                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                                    />
                                                    <label htmlFor="isActive">Active plan — visible for enrollment</label>
                                                </div>
                                            </div>
                                            <div className="ben-form__field">
                                                <label className="ben-form__label">Enrollment Start</label>
                                                <input
                                                    type="date"
                                                    value={formData.enrollmentPeriod.startDate}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        enrollmentPeriod: {
                                                            ...formData.enrollmentPeriod,
                                                            startDate: e.target.value
                                                        }
                                                    })}
                                                    className="ben-form__control"
                                                />
                                            </div>
                                            <div className="ben-form__field">
                                                <label className="ben-form__label">Enrollment End</label>
                                                <input
                                                    type="date"
                                                    value={formData.enrollmentPeriod.endDate}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        enrollmentPeriod: {
                                                            ...formData.enrollmentPeriod,
                                                            endDate: e.target.value
                                                        }
                                                    })}
                                                    className="ben-form__control"
                                                />
                                            </div>
                                            <div className="ben-form__field">
                                                <label className="ben-form__label">Effective Date</label>
                                                <input
                                                    type="date"
                                                    value={formData.effectiveDate}
                                                    onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                                                    className="ben-form__control"
                                                />
                                            </div>
                                            <div className="ben-form__field">
                                                <label className="ben-form__label">Expiry / Renewal Date</label>
                                                <input
                                                    type="date"
                                                    value={formData.expiryDate}
                                                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                                                    className="ben-form__control"
                                                />
                                            </div>
                                        </div>
                                    </section>
                                </div>

                                <footer className="ben-form__foot">
                                    <button
                                        type="button"
                                        className="ben-ui__btn ben-ui__btn--ghost"
                                        onClick={() => {
                                            setShowCreateModal(false);
                                            setFormData(emptyForm());
                                            setSelectedPlan(null);
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="ben-ui__btn ben-ui__btn--primary"
                                    >
                                        {submitting ? (
                                            <>
                                                <FaSpinner className="animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            selectedPlan ? 'Update Plan' : 'Create Plan'
                                        )}
                                    </button>
                                </footer>
                            </form>
                        </div>
                    </div>,
                    document.body
                )
                : null}

            {/* Employee Benefit Drawer */}
            {drawerOpen && selectedEmployeeRow && (
                <div className="fixed inset-0 z-50 flex justify-end lg:left-64">
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setDrawerOpen(false)}
                    />
                    <div className="relative w-full max-w-xl h-full bg-white shadow-xl overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-start justify-between z-10">
                            <div>
                                <h3 className="text-xl font-semibold text-gray-800">
                                    {selectedEmployeeRow.employee.name}
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Employee ID: {selectedEmployeeRow.employee.employeeId || '—'}
                                </p>
                                <p className="text-sm text-gray-500">
                                    Department: {selectedEmployeeRow.employee.department || '—'}
                                    {selectedEmployeeRow.employee.position
                                        ? ` · Position: ${selectedEmployeeRow.employee.position}`
                                        : ''}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDrawerOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-1"
                            >
                                <FaTimes className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="px-5 pt-3 flex gap-2 border-b border-gray-100">
                            {[
                                { id: 'overview', label: 'Overview' },
                                { id: 'enrollments', label: 'Enrollments' },
                                { id: 'dependents', label: 'Dependents' },
                                { id: 'history', label: 'History' }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setDrawerTab(tab.id)}
                                    className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
                                        drawerTab === tab.id
                                            ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                                            : 'border-transparent text-gray-500'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="p-5 space-y-4">
                            {drawerTab === 'overview' && (
                                <>
                                    <h4 className="font-medium text-gray-800">Active Benefits</h4>
                                    {selectedEmployeeRow.enrollments
                                        .filter((e) => ['Active', 'Enrolled'].includes(e.status))
                                        .map((e) => (
                                            <div key={e._id} className="flex justify-between items-center border rounded-lg px-3 py-2">
                                                <span className="text-gray-800">{e.benefitPlanId?.name || 'Benefit'}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(e.status)}`}>
                                                    {e.status}
                                                </span>
                                            </div>
                                        ))}
                                    {selectedEmployeeRow.enrollments.filter((e) => ['Active', 'Enrolled'].includes(e.status)).length === 0 && (
                                        <p className="text-sm text-gray-500">No active benefits.</p>
                                    )}
                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <p className="text-xs text-gray-500">Employer Contribution</p>
                                            <p className="font-semibold text-gray-800">
                                                ₹{selectedEmployeeRow.enrollments
                                                    .filter((e) => ['Active', 'Enrolled'].includes(e.status))
                                                    .reduce((sum, e) => sum + (Number(e.companyContribution) || 0), 0)
                                                    .toLocaleString('en-IN')}
                                            </p>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <p className="text-xs text-gray-500">Employee Contribution</p>
                                            <p className="font-semibold text-gray-800">
                                                ₹{selectedEmployeeRow.enrollments
                                                    .filter((e) => ['Active', 'Enrolled'].includes(e.status))
                                                    .reduce((sum, e) => sum + (Number(e.employeeContribution) || 0), 0)
                                                    .toLocaleString('en-IN')}
                                            </p>
                                        </div>
                                    </div>
                                </>
                            )}

                            {drawerTab === 'enrollments' && (
                                <div className="space-y-3">
                                    <div className="border rounded-lg p-4 bg-slate-50 space-y-3">
                                        <h5 className="font-medium text-gray-800">Enroll employee in a benefit</h5>
                                        <select
                                            value={hrEnrollPlanId}
                                            onChange={(e) => setHrEnrollPlanId(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                                        >
                                            <option value="">Select benefit plan</option>
                                            {benefitPlans.filter((p) => p.isActive).map((p) => (
                                                <option key={p._id} value={p._id}>
                                                    {p.name} ({p.enrollmentType || 'Optional'})
                                                </option>
                                            ))}
                                        </select>
                                        <select
                                            value={hrEnrollCoverage}
                                            onChange={(e) => setHrEnrollCoverage(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                                        >
                                            <option value="Individual">Individual</option>
                                            <option value="Family">Family</option>
                                        </select>
                                        <button
                                            type="button"
                                            onClick={handleHrEnrollForEmployee}
                                            disabled={hrEnrolling || !hrEnrollPlanId}
                                            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-theme-secondary text-white rounded-lg text-sm disabled:opacity-50"
                                        >
                                            {hrEnrolling ? <FaSpinner className="animate-spin" /> : <FaPlus />}
                                            Enroll Employee
                                        </button>
                                    </div>

                                    {selectedEmployeeRow.enrollments.map((e) => (
                                        <div key={e._id} className="border rounded-lg p-4 space-y-2">
                                            <div className="flex justify-between items-start">
                                                <h5 className="font-medium text-gray-800">{e.benefitPlanId?.name}</h5>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(e.status)}`}>
                                                    {e.status}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600">Coverage: {e.coverageType}</p>
                                            <p className="text-sm text-gray-600">
                                                Employer Contribution: {formatContribution(e.companyContribution, e.paymentFrequency)}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                Employee Contribution: {formatContribution(e.employeeContribution, e.paymentFrequency)}
                                            </p>
                                            {e.status === 'Pending' && (
                                                <div className="flex gap-2 pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEnrollmentAction(e._id, 'Active')}
                                                        className="px-3 py-1.5 bg-theme-primary text-white rounded text-sm inline-flex items-center gap-1"
                                                    >
                                                        <FaCheckCircle /> Approve
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEnrollmentAction(e._id, 'Cancelled')}
                                                        className="px-3 py-1.5 bg-red-500 text-white rounded text-sm inline-flex items-center gap-1"
                                                    >
                                                        <FaTimesCircle /> Reject
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {selectedEmployeeRow.enrollments.length === 0 && (
                                        <p className="text-sm text-gray-500">No enrollments.</p>
                                    )}
                                </div>
                            )}

                            {drawerTab === 'dependents' && (
                                <div className="space-y-4">
                                    {selectedEmployeeRow.enrollments.filter(supportsDependents).length === 0 && (
                                        <p className="text-sm text-gray-500">
                                            No benefits that support dependents for this employee.
                                        </p>
                                    )}
                                    {selectedEmployeeRow.enrollments.filter(supportsDependents).map((enrollment) => (
                                        <div key={enrollment._id} className="border rounded-lg p-4 space-y-3">
                                            <h5 className="font-medium text-gray-800">
                                                {enrollment.benefitPlanId?.name}
                                            </h5>
                                            {(enrollment.dependents || []).length === 0 && (
                                                <p className="text-sm text-gray-500">No dependents added.</p>
                                            )}
                                            {(enrollment.dependents || []).map((dep, idx) => (
                                                <div key={`${dep.name}-${idx}`} className="flex justify-between items-center text-sm">
                                                    <span>
                                                        <span className="text-gray-500">{dep.relationship}</span>
                                                        {' · '}
                                                        <span className="text-gray-800">{dep.name}</span>
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveDependent(enrollment, idx)}
                                                        className="text-red-500 text-xs hover:underline"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ))}
                                            {addingDependentFor === enrollment._id ? (
                                                <div className="space-y-2 pt-2 border-t">
                                                    <input
                                                        type="text"
                                                        placeholder="Dependent name"
                                                        value={dependentForm.name}
                                                        onChange={(e) => setDependentForm({ ...dependentForm, name: e.target.value })}
                                                        className="w-full p-2 border rounded-lg text-sm"
                                                    />
                                                    <select
                                                        value={dependentForm.relationship}
                                                        onChange={(e) => setDependentForm({ ...dependentForm, relationship: e.target.value })}
                                                        className="w-full p-2 border rounded-lg text-sm"
                                                    >
                                                        <option value="Spouse">Spouse</option>
                                                        <option value="Child">Child</option>
                                                        <option value="Parent">Parent</option>
                                                        <option value="Other">Other</option>
                                                    </select>
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddDependent(enrollment)}
                                                            className="px-3 py-1.5 bg-theme-secondary text-white rounded text-sm"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setAddingDependentFor(null)}
                                                            className="px-3 py-1.5 text-gray-600 text-sm"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAddingDependentFor(enrollment._id);
                                                        setDependentForm({ name: '', relationship: 'Spouse', dateOfBirth: '' });
                                                    }}
                                                    className="inline-flex items-center gap-1 text-sm text-theme-secondary hover:underline"
                                                >
                                                    <FaPlus className="text-xs" /> Add Dependent
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {drawerTab === 'history' && (
                                <div className="space-y-3">
                                    {drawerHistory.length === 0 && (
                                        <p className="text-sm text-gray-500">No history yet.</p>
                                    )}
                                    {drawerHistory.map((event, idx) => (
                                        <div key={`${event.type}-${idx}`} className="border-l-2 border-theme-secondary/40 pl-3 py-1">
                                            <p className="text-xs text-gray-500">
                                                {event.createdAt
                                                    ? format(new Date(event.createdAt), 'dd MMM yyyy')
                                                    : '—'}
                                            </p>
                                            <p className="text-sm font-medium text-gray-800">{event.type}</p>
                                            <p className="text-sm text-gray-600">
                                                {event.message || event.planName || ''}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {planDrawer
                ? createPortal(
                    <div className="ben-drawer-root" role="presentation">
                        <button
                            type="button"
                            className="ben-drawer-backdrop"
                            aria-label="Dismiss plan details"
                            onClick={() => setPlanDrawer(null)}
                        />
                        <aside className="ben-drawer" role="dialog" aria-modal="true" aria-label={planDrawer.name}>
                            <header className="ben-drawer__head">
                                <div className="ben-drawer__head-top">
                                    <div>
                                        <div className="ben-drawer__badge-row">
                                            <span className="ben-drawer__badge">{planDrawer.category || 'Benefit'}</span>
                                            <span className="ben-drawer__tier">
                                                {planDrawer.isActive ? 'Active Tier' : 'Inactive'}
                                            </span>
                                        </div>
                                        <h2 className="ben-drawer__title">{planDrawer.name || 'Benefit plan'}</h2>
                                        <p className="ben-drawer__policy">
                                            Master Policy:{' '}
                                            <strong>{displayOrDash(planDrawer.benefitCode)}</strong>
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        className="ben-drawer__close"
                                        aria-label="Close"
                                        onClick={() => setPlanDrawer(null)}
                                    >
                                        <FaTimes />
                                    </button>
                                </div>
                            </header>
                            <div className="ben-drawer__body">
                                <div className="ben-drawer__card">
                                    <div className="ben-drawer__card-grid">
                                        <div>
                                            <p className="ben-drawer__mini-label">Underwriter</p>
                                            <p className="ben-drawer__mini-value">
                                                {displayOrDash(planDrawer.provider)}
                                            </p>
                                            <p className="ben-drawer__mini-sub">
                                                {planDrawer.enrollmentType || 'Optional'} enrollment
                                            </p>
                                        </div>
                                        <div>
                                            <p className="ben-drawer__mini-label">Annual renewal date</p>
                                            <p className="ben-drawer__mini-value">
                                                {planDrawer.expiryDate
                                                    ? format(new Date(planDrawer.expiryDate), 'dd MMM yyyy')
                                                    : 'Not set'}
                                            </p>
                                            <p className="ben-drawer__mini-sub is-muted">
                                                {planDrawer.expiryDate
                                                    ? `${Math.max(
                                                        0,
                                                        differenceInCalendarDays(new Date(planDrawer.expiryDate), new Date())
                                                    )} days remaining`
                                                    : 'No expiry set'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="ben-drawer__block">
                                    <h3 className="ben-drawer__section-title">
                                        <FiShield /> Coverage Terms &amp; Entitlements
                                    </h3>
                                    <ul className="ben-drawer__rows ben-drawer__rows--soft">
                                        <li>
                                            <span>Plan type</span>
                                            <span>{displayOrDash(planDrawer.planType)}</span>
                                        </li>
                                        <li>
                                            <span>Coverage</span>
                                            <span>{displayOrDash(planDrawer.coverage)}</span>
                                        </li>
                                        <li>
                                            <span>Eligibility</span>
                                            <span>{formatEligibility(planDrawer)}</span>
                                        </li>
                                    </ul>
                                    {planDrawer.description ? (
                                        <p className="ben-drawer__desc">{String(planDrawer.description)}</p>
                                    ) : null}
                                </div>

                                <div className="ben-drawer__block">
                                    <h3 className="ben-drawer__section-title">
                                        <FaWallet /> Subsidy &amp; Payroll Cost Model
                                    </h3>
                                    <ul className="ben-drawer__rows">
                                        <li>
                                            <span>Employer contribution</span>
                                            <span>
                                                {formatContribution(
                                                    planDrawer.companyContribution?.amount,
                                                    planDrawer.employeeContribution?.frequency
                                                )}
                                            </span>
                                        </li>
                                        <li>
                                            <span>Company subsidy</span>
                                            <span className="is-green">
                                                {Number(planDrawer.companyContribution?.percentage) > 0
                                                    ? `${planDrawer.companyContribution.percentage}% Company Subsidy`
                                                    : 'Company sponsored'}
                                            </span>
                                        </li>
                                        <li>
                                            <span>Employee contribution</span>
                                            <span>
                                                {formatContribution(
                                                    planDrawer.employeeContribution?.amount,
                                                    planDrawer.employeeContribution?.frequency
                                                )}
                                            </span>
                                        </li>
                                    </ul>
                                </div>

                                <div className="ben-drawer__block">
                                    <div className="ben-drawer__staff-head">
                                        <h3 className="ben-drawer__section-title">
                                            <FaUsers /> Enrolled Staff Sample
                                        </h3>
                                        <span className="ben-drawer__staff-count">
                                            {(enrollmentCountByPlan[String(planDrawer._id)]?.active || 0)} Active
                                        </span>
                                    </div>
                                    {planDrawerEnrollments.length === 0 ? (
                                        <div className="ben-drawer__staff-empty">
                                            <FaUsers />
                                            <span>No enrollments yet for this plan</span>
                                        </div>
                                    ) : (
                                        <ul className="ben-drawer__staff-list">
                                            {planDrawerEnrollments.map((enr) => {
                                                const emp = enr.employeeId || {};
                                                const name = emp.name || emp.email || 'Employee';
                                                const deps = Array.isArray(enr.dependents) ? enr.dependents.length : 0;
                                                return (
                                                    <li key={enr._id}>
                                                        <span className="ben-drawer__avatar">{initialsOf(name)}</span>
                                                        <div className="min-w-0">
                                                            <p className="ben-drawer__staff-name">{name}</p>
                                                            <p className="ben-drawer__staff-meta">
                                                                {[emp.employeeId, emp.department].filter(Boolean).join(' • ') || enr.status}
                                                            </p>
                                                        </div>
                                                        <span className="ben-drawer__staff-deps">
                                                            {deps} Dependent{deps === 1 ? '' : 's'}
                                                        </span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            </div>
                            <footer className="ben-drawer__foot">
                                {isHRUser ? (
                                    <>
                                        <button
                                            type="button"
                                            className="ben-ui__btn ben-ui__btn--ghost"
                                            onClick={() => {
                                                openEditModal(planDrawer);
                                                setPlanDrawer(null);
                                            }}
                                        >
                                            <FaEdit /> Edit Plan
                                        </button>
                                        <button
                                            type="button"
                                            className="ben-ui__btn ben-drawer__btn--danger"
                                            onClick={() => {
                                                handleDeleteBenefit(planDrawer._id);
                                                setPlanDrawer(null);
                                            }}
                                        >
                                            <FaTrash /> Delete
                                        </button>
                                    </>
                                ) : null}
                            </footer>
                        </aside>
                    </div>,
                    document.body
                )
                : null}
            </div>
        </div>
    );
};

export default BenefitsPage;
