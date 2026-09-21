import React, { useEffect, useState, useCallback } from 'react';
import {
  Button,
  Alert,
  Typography,
  CircularProgress,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
} from '@mui/material';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useSelector, useDispatch } from 'react-redux';
import { FiChevronRight, FiEdit, FiStar } from 'react-icons/fi';
import { isHR, isManager } from '../../utils/managerHelper';
import { checkAuthSession } from '../../context/Auth/authSlice';
import { ORG_POSITION_LEVELS } from '../../constants/orgPositionLevels';
import {
  fetchEmployeeDetails,
  updateEmployeeStatus,
  updateEmployeeWorkInfo,
  updateEmployeePayrollSettings,
  clearEmployeeDetails,
} from '../../context/employeeDetailsSlice';
import { deleteEmployee } from '../../context/employeeSlice';
import { BOTH_PROFILE_ENDPOINT } from '../../utils/constant';
import axiosInstance, { openDocumentPreview, saveDocumentDownload } from '../../utils/axios';
import { DETAIL_TABS } from './employeeDetails/constants';
import EmployeeDetailsHeader from './employeeDetails/EmployeeDetailsHeader';
import PersonalTab from './employeeDetails/tabs/PersonalTab';
import JobDetailsTab from './employeeDetails/tabs/JobDetailsTab';
import DocumentsTab from './employeeDetails/tabs/DocumentsTab';
import LeaveTab from './employeeDetails/tabs/LeaveTab';
import PayrollTab from './employeeDetails/tabs/PayrollTab';
import PerformanceTab from './employeeDetails/tabs/PerformanceTab';
import TimelineTab from './employeeDetails/tabs/TimelineTab';
import useAuthPermissions from '../../Hooks/useAuthPermissions';
import { PERMISSIONS } from '../../utils/permissions';
import CareerTimelineWidget from './employeeDetails/widgets/CareerTimelineWidget';
import ReportingHierarchyWidget from './employeeDetails/widgets/ReportingHierarchyWidget';
import PayrollHighlightWidget from './employeeDetails/widgets/PayrollHighlightWidget';
import {
  calculateYearsOfExperience,
  getAttendanceRate,
  getFullName,
} from './employeeDetails/utils';
import { promoteEmployeeToHrManager } from '../../utils/systemRoleApi';
import { fetchOrganizationProfile } from '../../context/organizationSlice';

const ALL_PROBATION_STATUSES = [
  'None',
  'Not Started',
  'Active',
  'Extended',
  'Confirmed',
  'Waived',
  'Rejected',
  'Terminated',
];

function normalizeProbationStatus(status) {
  const s = String(status || '').trim();
  if (!s || s === 'Not Started') return 'None';
  return s;
}

function getAllowedProbationStatuses(currentStatus, allowAfterJoining) {
  if (allowAfterJoining) return ALL_PROBATION_STATUSES;
  const current = normalizeProbationStatus(currentStatus);
  if (current === 'None') return ['None', 'Not Started'];
  if (current === 'Active' || current === 'Extended') {
    return ['Active', 'Extended', 'Confirmed', 'Waived', 'Rejected', 'Terminated'];
  }
  return ['Confirmed', 'Waived', 'Rejected', 'Terminated'].includes(current)
    ? ['Confirmed', 'Waived', 'Rejected', 'Terminated']
    : [currentStatus || 'None'];
}

const EmployeeDetailsPage = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState('personal');
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openTerminateDialog, setOpenTerminateDialog] = useState(false);
  const [openEditWorkDialog, setOpenEditWorkDialog] = useState(false);
  const [openEditNameDialog, setOpenEditNameDialog] = useState(false);
  const [openEditPerformanceDialog, setOpenEditPerformanceDialog] = useState(false);
  const [openEditPayrollSettingsDialog, setOpenEditPayrollSettingsDialog] = useState(false);
  const [terminatingEmployee, setTerminatingEmployee] = useState(false);
  const [terminateForm, setTerminateForm] = useState({
    terminationDate: '',
    lastWorkingDate: '',
    reason: '',
    notes: '',
    eligibleForRehire: false,
  });
  const [editWorkForm, setEditWorkForm] = useState({
    jobTitle: '',
    department: '',
    position: '',
    manager: '',
    salary: '',
    joiningDate: '',
    probationStatus: 'None',
    probationStartDate: '',
    probationEndDate: '',
    probationConfirmedAt: '',
    shiftId: '',
  });
  const [editNameForm, setEditNameForm] = useState({ name: '', lastName: '' });
  const [shiftOptions, setShiftOptions] = useState([
    { key: 'shift1', name: 'Shift 1', startTime: '09:00', endTime: '17:00' },
    { key: 'shift2', name: 'Shift 2', startTime: '21:00', endTime: '06:00' },
  ]);
  const [editPerformanceForm, setEditPerformanceForm] = useState({ performanceScore: '' });
  const [editPayrollSettingsForm, setEditPayrollSettingsForm] = useState({
    deductPf: true,
    deductEsi: true,
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [deletingEmployee, setDeletingEmployee] = useState(false);
  const [managerOptions, setManagerOptions] = useState([]);
  const [jobTitleOptions, setJobTitleOptions] = useState([]);
  const [loadingDropdownOptions, setLoadingDropdownOptions] = useState(false);
  const [managerPreview, setManagerPreview] = useState(null);
  const [promotingToHr, setPromotingToHr] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const {
    employee,
    loading,
    error,
    updatingStatus,
    statusUpdateError,
    updatingWorkInfo,
    workInfoError,
    updatingPayrollSettings,
  } = useSelector((state) => state.employeeDetails);
  const currentUser = useSelector((state) => state.auth?.user);
  const orgProfile = useSelector((state) => state.organization?.profile);
  const allowProbationAfterJoining = orgProfile?.settings?.allowProbationAfterJoining === true;
  const sessionEmployee = useSelector((state) => state.employeeDetails?.employee);
  const { hasAnyPermission, hasPermission, isOrgOwner, isHrExecutive, isHrManager } = useAuthPermissions();
  const userIsHr = isHR(currentUser || sessionEmployee);
  const hidePayrollForHrExecutive = userIsHr && isHrExecutive && !isHrManager;
  const isManagerReadOnly =
    isManager(currentUser) && !isHR(currentUser) && currentUser?.role !== 'admin';
  const isAdminUser = currentUser?.role === 'admin';
  const canEditPayrollSettings =
    !isManagerReadOnly &&
    !hidePayrollForHrExecutive &&
    (isOrgOwner ||
      isHrManager ||
      isAdminUser ||
      hasPermission(PERMISSIONS.PAYROLL_EDIT));
  const canManageAccess =
    isOrgOwner ||
    hasAnyPermission([PERMISSIONS.ORG_SETTINGS_MANAGE, PERMISSIONS.EMPLOYEE_EDIT_SENSITIVE]);
  const canManageEmployeeActions =
    !isManagerReadOnly &&
    (isOrgOwner ||
      currentUser?.role === 'admin' ||
      userIsHr ||
      isHrManager ||
      isHrExecutive ||
      hasAnyPermission([PERMISSIONS.EMPLOYEE_EDIT, PERMISSIONS.EMPLOYEE_DELETE]));
  const canEditEmployeeName = canManageEmployeeActions;
  const visibleTabs = DETAIL_TABS.filter(
    (tab) =>
      (!tab.permissionGated || canManageAccess) &&
      (!tab.hrOnly || userIsHr) &&
      !(hidePayrollForHrExecutive && tab.hideForHrExecutive)
  );
  const isHrManagerProfile =
    Boolean(employee?.functionalRoles?.includes('hr')) &&
    String(employee?.jobTitle || '').toLowerCase().includes('hr manager') &&
    String(employee?.department || '').toLowerCase() === 'hr';

  useEffect(() => {
    if (activeTab === 'documents' && !userIsHr) {
      setActiveTab('personal');
    }
    if (activeTab === 'payroll' && hidePayrollForHrExecutive) {
      setActiveTab('personal');
    }
  }, [activeTab, userIsHr, hidePayrollForHrExecutive]);

  useEffect(() => {
    dispatch(fetchEmployeeDetails(employeeId));
    dispatch(fetchOrganizationProfile());
    return () => dispatch(clearEmployeeDetails());
  }, [dispatch, employeeId]);

  const fetchDropdownOptions = useCallback(async () => {
    if (isManagerReadOnly) {
      setManagerOptions([]);
      setJobTitleOptions([]);
      return;
    }
    try {
      setLoadingDropdownOptions(true);
      const [managersRes, jobTitlesRes, shiftsRes] = await Promise.all([
        axiosInstance.get('/v1/admin/employee/managers?limit=500', { withCredentials: true }),
        axiosInstance.get('/v1/admin/employee/job-titles', { withCredentials: true }),
        axiosInstance.get('/v1/admin/attendance-rules/shifts', { withCredentials: true }).catch(() => null),
      ]);
      const managersData = managersRes?.data;
      const managerList = Array.isArray(managersData?.data)
        ? managersData.data
        : Array.isArray(managersData) ? managersData : [];
      const titlesData = jobTitlesRes?.data;
      const titleList = Array.isArray(titlesData?.data?.jobTitles)
        ? titlesData.data.jobTitles
        : Array.isArray(titlesData?.jobTitles) ? titlesData.jobTitles : [];
      setManagerOptions(managerList);
      setJobTitleOptions(titleList);
      const shiftData = shiftsRes?.data?.data || shiftsRes?.data || {};
      if (Array.isArray(shiftData.shifts) && shiftData.shifts.length) {
        setShiftOptions(shiftData.shifts);
      }
    } catch {
      setManagerOptions([]);
      setJobTitleOptions([]);
    } finally {
      setLoadingDropdownOptions(false);
    }
  }, [isManagerReadOnly]);

  useEffect(() => {
    fetchDropdownOptions();
  }, [fetchDropdownOptions]);

  useEffect(() => {
    if (!employee?.managerId) {
      setManagerPreview(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosInstance.get(
          `${BOTH_PROFILE_ENDPOINT}/admin/get-info/${employee.managerId}`,
          { withCredentials: true }
        );
        if (!cancelled) setManagerPreview(res.data?.employee || null);
      } catch {
        if (!cancelled) setManagerPreview(null);
      }
    })();
    return () => { cancelled = true; };
  }, [employee?.managerId]);

  const fetchEmployeeStats = useCallback(async () => {
    if (isManagerReadOnly || !employeeId) return;
    try {
      await axiosInstance.get(`/v1/admin/employee/${employeeId}/stats`);
    } catch {
      /* stats optional */
    }
  }, [employeeId, isManagerReadOnly]);

  useEffect(() => {
    if (employee) fetchEmployeeStats();
  }, [employee, fetchEmployeeStats]);

  const handleDownloadDocument = async (doc) => {
    const documentId = doc?._id || doc;
    const fileName = typeof doc === 'object'
      ? (doc.fileName || doc.originalName || 'document')
      : 'document';
    if (!documentId) {
      alert('Document id missing.');
      return;
    }
    try {
      await saveDocumentDownload(documentId, fileName, {
        scope: 'both',
        employeeId,
        fileUrl: typeof doc === 'object' ? (doc.filePath || doc.fileUrl) : undefined,
      });
    } catch (error) {
      alert(error?.message || 'Failed to download document. Please try again.');
    }
  };

  const handleViewDocument = async (doc) => {
    if (!doc?._id) {
      alert('Document id missing.');
      return;
    }
    try {
      await openDocumentPreview(doc._id, {
        scope: 'both',
        employeeId,
        fileUrl: doc.filePath || doc.fileUrl,
        fileName: doc.fileName || doc.originalName,
        mimeType: doc.mimeType,
      });
    } catch (error) {
      alert(error?.message || 'Failed to preview document. Please try again.');
    }
  };

  const handleConfirmStatusChange = () => {
    dispatch(updateEmployeeStatus({ employeeId: employee._id, active: !employee.active }));
    setOpenDialog(false);
  };

  const handleConfirmDelete = () => {
    setDeletingEmployee(true);
    dispatch(deleteEmployee(employeeId))
      .unwrap()
      .then(() => {
        toast.success('Employee deleted successfully');
        setOpenDeleteDialog(false);
        navigate('/employees');
      })
      .catch((err) => {
        toast.error(err || 'Failed to delete employee');
        setOpenDeleteDialog(false);
      })
      .finally(() => setDeletingEmployee(false));
  };

  const handleConfirmTerminate = async () => {
    if (!employee?._id || !terminateForm.terminationDate) {
      toast.error('Termination date is required.');
      return;
    }
    setTerminatingEmployee(true);
    try {
      await axiosInstance.patch(
        `${BOTH_PROFILE_ENDPOINT}/admin/terminate/${employee._id}`,
        {
          terminationDate: terminateForm.terminationDate,
          lastWorkingDate: terminateForm.lastWorkingDate || terminateForm.terminationDate,
          reason: terminateForm.reason,
          notes: terminateForm.notes,
          eligibleForRehire: terminateForm.eligibleForRehire,
        },
        { withCredentials: true }
      );
      toast.success('Employee terminated successfully');
      setOpenTerminateDialog(false);
      dispatch(fetchEmployeeDetails(employeeId));
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.errors?.[0]?.terminationDate ||
          'Failed to terminate employee'
      );
    } finally {
      setTerminatingEmployee(false);
    }
  };

  const handleEditWorkClick = () => {
    const toDateInput = (value) =>
      value ? new Date(value).toISOString().split('T')[0] : '';
    const rawManagerId =
      employee.managerId && typeof employee.managerId === 'object'
        ? employee.managerId._id || employee.managerId.id
        : employee.managerId;
    setEditWorkForm({
      jobTitle: employee.jobTitle || '',
      department: employee.department || '',
      position: employee.position || '',
      manager: rawManagerId
        ? String(rawManagerId)
        : employee.isOrgOwnerRoot ||
            !employee.manager ||
            ['Admin', 'CEO', 'None'].includes(String(employee.manager).trim())
          ? 'Admin'
          : employee.manager || '',
      salary: employee.salary != null ? employee.salary : '',
      joiningDate: toDateInput(employee.joiningDate),
      probationStatus: employee.probation?.status || 'None',
      probationStartDate: toDateInput(employee.probation?.startDate),
      probationEndDate: toDateInput(employee.probation?.endDate),
      probationConfirmedAt: toDateInput(employee.probation?.confirmedAt),
      shiftId: employee.shiftId || '',
    });
    setOpenEditWorkDialog(true);
  };

  const handleEditWorkFormChange = (field) => (event) => {
    setEditWorkForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleEditNameClick = () => {
    setEditNameForm({
      name: employee?.name || '',
      lastName: employee?.lastName || '',
    });
    setOpenEditNameDialog(true);
  };

  const handleEditNameFormChange = (field) => (event) => {
    setEditNameForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSaveEmployeeName = async () => {
    const nextName = String(editNameForm.name || '').trim();
    const nextLastName = String(editNameForm.lastName || '').trim();
    if (!nextName) {
      setSnackbar({ open: true, message: 'First name is required', severity: 'error' });
      return;
    }

    const resultAction = await dispatch(
      updateEmployeeWorkInfo({
        employeeId,
        workData: { name: nextName, lastName: nextLastName },
      })
    );

    if (updateEmployeeWorkInfo.fulfilled.match(resultAction)) {
      setSnackbar({ open: true, message: 'Name updated successfully.', severity: 'success' });
      setOpenEditNameDialog(false);
      await refreshAfterRoleChange();
    } else {
      setSnackbar({
        open: true,
        message: resultAction.payload || 'Failed to update name',
        severity: 'error',
      });
    }
  };

  const refreshAfterRoleChange = async () => {
    const authUser = currentUser;
    const editingSelf =
      String(authUser?._id || '') === String(employeeId) ||
      String(authUser?.employeeProfileId || '') === String(employeeId);

    // Only refresh session/navbar when editing your own profile.
    // checkAuthSession overwrites employeeDetails with the logged-in user.
    if (editingSelf) {
      await dispatch(checkAuthSession());
    }
    // Always reload the employee from the URL so this profile stays open
    await dispatch(fetchEmployeeDetails(employeeId));
  };

  const handlePromoteToHrManager = async () => {
    if (!employeeId || !window.confirm(
      `Make ${getFullName(employee)} an HR Manager?\n\nJob title → HR Manager\nDepartment → HR\nEmail and password will stay the same.`
    )) {
      return;
    }

    setPromotingToHr(true);
    try {
      await promoteEmployeeToHrManager(employeeId);
      toast.success('Employee is now HR Manager. Ask them to log out and log in again.');
      dispatch(fetchEmployeeDetails(employeeId));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to promote to HR Manager');
    } finally {
      setPromotingToHr(false);
    }
  };

  const handleSaveWorkInfo = async () => {
    if (!String(editWorkForm.jobTitle || '').trim()) {
      setSnackbar({ open: true, message: 'Please select a job title.', severity: 'error' });
      return;
    }
    if (!String(editWorkForm.department || '').trim()) {
      setSnackbar({ open: true, message: 'Please select a department.', severity: 'error' });
      return;
    }
    if (!String(editWorkForm.position || '').trim()) {
      setSnackbar({ open: true, message: 'Please select a position.', severity: 'error' });
      return;
    }
    if (!String(editWorkForm.manager || '').trim()) {
      setSnackbar({ open: true, message: 'Please select a manager (or None for org root).', severity: 'error' });
      return;
    }

    let salaryValue = employee?.salary ?? 0;
    if (!hidePayrollForHrExecutive) {
      salaryValue =
        editWorkForm.salary === '' || editWorkForm.salary == null
          ? 0
          : parseFloat(editWorkForm.salary);
      if (Number.isNaN(salaryValue) || salaryValue < 0) {
        setSnackbar({ open: true, message: 'Enter a valid salary.', severity: 'error' });
        return;
      }
    }

    const managerValue = ['None', 'none', 'CEO'].includes(String(editWorkForm.manager).trim())
      ? 'Admin'
      : editWorkForm.manager;

    const workData = {
      jobTitle: String(editWorkForm.jobTitle).trim(),
      department: String(editWorkForm.department).trim(),
      position: String(editWorkForm.position).trim(),
      manager: managerValue,
      salary: salaryValue,
      probation: {
        status: editWorkForm.probationStatus || 'None',
        startDate: editWorkForm.probationStartDate || null,
        endDate: editWorkForm.probationEndDate || null,
        confirmedAt: editWorkForm.probationConfirmedAt || null,
      },
      shiftId: editWorkForm.shiftId || '',
      shiftName: editWorkForm.shiftId
        ? (shiftOptions.find((s) => s.key === editWorkForm.shiftId) || {}).name || ''
        : '',
    };
    if (editWorkForm.joiningDate) {
      workData.joiningDate = new Date(editWorkForm.joiningDate).toISOString();
    }

    const resultAction = await dispatch(
      updateEmployeeWorkInfo({
        employeeId,
        workData,
      })
    );
    if (updateEmployeeWorkInfo.fulfilled.match(resultAction)) {
      setSnackbar({
        open: true,
        message: 'Work information and system access updated. Ask them to log out and back in.',
        severity: 'success',
      });
      setOpenEditWorkDialog(false);
      await refreshAfterRoleChange();
    } else {
      setSnackbar({
        open: true,
        message: resultAction.payload || 'Failed to update work information',
        severity: 'error',
      });
    }
  };

  const handleEditPerformanceClick = () => {
    setEditPerformanceForm({ performanceScore: employee.performanceScore ?? '' });
    setOpenEditPerformanceDialog(true);
  };

  const handleSavePerformanceScore = async () => {
    const resultAction = await dispatch(
      updateEmployeeWorkInfo({
        employeeId,
        workData: { performanceScore: parseFloat(editPerformanceForm.performanceScore) || 0 },
      })
    );
    if (updateEmployeeWorkInfo.fulfilled.match(resultAction)) {
      setSnackbar({ open: true, message: 'Performance score updated.', severity: 'success' });
      setOpenEditPerformanceDialog(false);
    } else {
      setSnackbar({
        open: true,
        message: resultAction.payload || 'Failed to update score',
        severity: 'error',
      });
    }
  };

  const handleEditPayrollSettingsClick = () => {
    setEditPayrollSettingsForm({
      deductPf: employee.financialDetails?.deductPf !== false,
      deductEsi: employee.financialDetails?.deductEsi !== false,
    });
    setOpenEditPayrollSettingsDialog(true);
  };

  const handleSavePayrollSettings = async () => {
    const resultAction = await dispatch(
      updateEmployeePayrollSettings({
        employeeId,
        deductPf: editPayrollSettingsForm.deductPf,
        deductEsi: editPayrollSettingsForm.deductEsi,
      })
    );
    if (updateEmployeePayrollSettings.fulfilled.match(resultAction)) {
      setSnackbar({
        open: true,
        message: 'Payroll statutory settings updated.',
        severity: 'success',
      });
      setOpenEditPayrollSettingsDialog(false);
    } else {
      setSnackbar({
        open: true,
        message: resultAction.payload || 'Failed to update payroll settings',
        severity: 'error',
      });
    }
  };

  const renderTabContent = () => {
    if (!employee) return null;
    switch (activeTab) {
      case 'personal':
        return (
          <PersonalTab
            employee={employee}
            canEditName={canEditEmployeeName}
            onEditName={handleEditNameClick}
          />
        );
      case 'job':
        return (
          <JobDetailsTab
            employee={employee}
            isManagerReadOnly={isManagerReadOnly}
            onEditWork={handleEditWorkClick}
            canPromoteToHr={isAdminUser || canManageAccess}
            onPromoteToHr={handlePromoteToHrManager}
            promotingToHr={promotingToHr}
            isHrManagerProfile={isHrManagerProfile}
            hidePayrollFields={hidePayrollForHrExecutive}
          />
        );
      case 'documents':
        if (!userIsHr) return null;
        return (
          <DocumentsTab
            employee={employee}
            onDownload={handleDownloadDocument}
            onView={handleViewDocument}
          />
        );
      case 'leave':
        return <LeaveTab employeeId={employee._id} />;
      case 'payroll':
        return (
          <PayrollTab
            employee={employee}
            canEditPayrollSettings={canEditPayrollSettings}
            onEditPayrollSettings={handleEditPayrollSettingsClick}
          />
        );
      case 'performance':
        return (
          <PerformanceTab
            employee={employee}
            isManagerReadOnly={isManagerReadOnly}
            onEditPerformance={handleEditPerformanceClick}
            yearsExperience={calculateYearsOfExperience(employee.joiningDate)}
            attendanceRate={getAttendanceRate(employee)}
          />
        );
      case 'timeline':
        return <TimelineTab employee={employee} />;
      default:
        return (
          <PersonalTab
            employee={employee}
            canEditName={canEditEmployeeName}
            onEditName={handleEditNameClick}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#F5F7FB]">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-transparent border-t-[#20C997] border-r-[#20C997]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#F5F7FB] p-8">
        <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => navigate('/employees')}
            className="mt-4 text-sm font-semibold text-[#0d9488] hover:underline"
          >
            Back to employees
          </button>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="bg-[#F5F7FB] p-8">
        <p className="text-slate-600">Employee not found.</p>
        <button type="button" onClick={() => navigate('/employees')} className="mt-2 text-[#0d9488]">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="page-shell min-h-[calc(100vh-64px)] bg-[#F5F7FB]">
      <div className="page-shell-inner hrms-stack px-4 pt-4 sm:px-0 sm:pt-0">
        <nav className="flex flex-wrap items-center gap-3 text-base text-slate-500">
          <Link to="/employees" className="font-semibold text-[#0d9488] hover:underline">
            Employee Directory
          </Link>
          <FiChevronRight className="h-4 w-4 shrink-0" />
          <span className="font-semibold text-slate-800">{getFullName(employee)}</span>
        </nav>

        <button
          type="button"
          onClick={() => navigate('/employees')}
        className="inline-flex self-start h-10 shrink-0 items-center justify-center rounded-full border-2 border-[#20C997] px-4 text-sm font-semibold text-[#0d9488] transition hover:bg-[#20C997]/10"
        >
          Back to employees
        </button>

        {(statusUpdateError || workInfoError) && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {statusUpdateError || workInfoError}
          </div>
        )}

        <EmployeeDetailsHeader
          employee={employee}
          canManageEmployeeActions={canManageEmployeeActions}
          updatingStatus={updatingStatus}
          terminatingEmployee={terminatingEmployee}
          onStatusClick={() => setOpenDialog(true)}
          onTerminateClick={() => {
            const today = new Date().toISOString().slice(0, 10);
            setTerminateForm({
              terminationDate: today,
              lastWorkingDate: today,
              reason: '',
              notes: '',
              eligibleForRehire: false,
            });
            setOpenTerminateDialog(true);
          }}
          onDeleteClick={() => setOpenDeleteDialog(true)}
        />

        <div className="border-b border-slate-200">
          <div className="hrms-tabs-scroll" role="tablist">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`border-b-2 px-4 py-3 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? 'border-[#20C997] text-[#0d9488]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="hrms-main-rail">
          <div className="min-w-0">{renderTabContent()}</div>
          <aside className="min-w-0 space-y-4">
            {!hidePayrollForHrExecutive && <PayrollHighlightWidget employee={employee} />}
            <CareerTimelineWidget employee={employee} />
            <ReportingHierarchyWidget employee={employee} managerPreview={managerPreview} />
          </aside>
        </div>
      </div>

      {/* Status dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullScreen={isMobile}>
        <DialogTitle>Confirm status change</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Change {getFullName(employee)} from {employee.active ? 'Active' : 'Inactive'} to{' '}
            {employee.active ? 'Inactive' : 'Active'}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            onClick={handleConfirmStatusChange}
            color={employee.active ? 'error' : 'success'}
            disabled={updatingStatus}
          >
            {updatingStatus ? 'Updating…' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)} fullScreen={isMobile}>
        <DialogTitle>Delete employee</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Permanently delete {getFullName(employee)}? This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
          <Button color="error" onClick={handleConfirmDelete} disabled={deletingEmployee}>
            {deletingEmployee ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openTerminateDialog}
        onClose={() => !terminatingEmployee && setOpenTerminateDialog(false)}
        fullScreen={isMobile}
      >
        <DialogTitle>Terminate employee</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Mark {getFullName(employee)} as terminated.
          </DialogContentText>
          <Box sx={{ display: 'grid', gap: 2 }}>
            <TextField
              label="Termination date"
              type="date"
              value={terminateForm.terminationDate}
              onChange={(e) =>
                setTerminateForm((p) => ({ ...p, terminationDate: e.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />
            <TextField
              label="Last working date"
              type="date"
              value={terminateForm.lastWorkingDate}
              onChange={(e) =>
                setTerminateForm((p) => ({ ...p, lastWorkingDate: e.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Reason"
              value={terminateForm.reason}
              onChange={(e) => setTerminateForm((p) => ({ ...p, reason: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Notes"
              value={terminateForm.notes}
              onChange={(e) => setTerminateForm((p) => ({ ...p, notes: e.target.value }))}
              fullWidth
              multiline
              minRows={3}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={terminateForm.eligibleForRehire}
                onChange={(e) =>
                  setTerminateForm((p) => ({ ...p, eligibleForRehire: e.target.checked }))
                }
              />
              Eligible for rehire
            </label>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTerminateDialog(false)} disabled={terminatingEmployee}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={handleConfirmTerminate} disabled={terminatingEmployee}>
            {terminatingEmployee ? 'Terminating…' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openEditNameDialog}
        onClose={() => setOpenEditNameDialog(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            borderRadius: '12px',
            maxWidth: 480,
          },
        }}
      >
        <DialogTitle sx={{ px: 3, pt: 2.5, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '1.125rem', fontWeight: 500 }}>
            <FiEdit size={18} /> Edit name
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: '24px !important', pb: 1 }}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField
              label="First name"
              value={editNameForm.name}
              onChange={handleEditNameFormChange('name')}
              size="small"
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Last name"
              value={editNameForm.lastName}
              onChange={handleEditNameFormChange('lastName')}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setOpenEditNameDialog(false)} disabled={updatingWorkInfo}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSaveEmployeeName} disabled={updatingWorkInfo}>
            {updatingWorkInfo ? 'Saving…' : 'Save name'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openEditWorkDialog}
        onClose={() => setOpenEditWorkDialog(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            borderRadius: '12px',
            maxWidth: 760,
            overflow: 'visible',
          },
        }}
      >
        <DialogTitle sx={{ px: 3, pt: 2.5, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '1.125rem', fontWeight: 500 }}>
            <FiEdit size={18} /> Edit work information
          </Box>
        </DialogTitle>
        <DialogContent
          sx={{
            px: 3,
            // MUI sets padding-top: 0 when DialogContent follows DialogTitle, which clips outlined labels
            pt: '24px !important',
            pb: 1,
            overflow: 'visible',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: '1fr',
                sm: '1fr 1fr',
                md: 'repeat(4, minmax(0, 1fr))',
              },
            }}
          >
            <FormControl fullWidth size="small" variant="outlined">
              <InputLabel id="edit-work-job-title-label" shrink>
                Job title
              </InputLabel>
              <Select
                labelId="edit-work-job-title-label"
                value={editWorkForm.jobTitle || ''}
                onChange={handleEditWorkFormChange('jobTitle')}
                label="Job title"
                notched
                displayEmpty
                disabled={loadingDropdownOptions}
                renderValue={(selected) =>
                  selected ? selected : <span style={{ color: '#94a3b8' }}>Select job title</span>
                }
              >
                <MenuItem value="">
                  <span style={{ color: '#94a3b8' }}>Select job title</span>
                </MenuItem>
                {editWorkForm.jobTitle && !jobTitleOptions.includes(editWorkForm.jobTitle) && (
                  <MenuItem value={editWorkForm.jobTitle}>{editWorkForm.jobTitle}</MenuItem>
                )}
                {jobTitleOptions.map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small" variant="outlined">
              <InputLabel id="edit-work-department-label" shrink>
                Department
              </InputLabel>
              <Select
                labelId="edit-work-department-label"
                value={editWorkForm.department || ''}
                onChange={handleEditWorkFormChange('department')}
                label="Department"
                notched
                displayEmpty
                renderValue={(selected) =>
                  selected ? selected : <span style={{ color: '#94a3b8' }}>Select department</span>
                }
              >
                <MenuItem value="">
                  <span style={{ color: '#94a3b8' }}>Select department</span>
                </MenuItem>
                {['Engineering', 'HR', 'Finance', 'Sales', 'Marketing', 'IT Support', 'Operations', 'Customer Support', 'Legal', 'Product', 'Research & Development', 'Design', 'Administration'].map((d) => (
                  <MenuItem key={d} value={d}>{d}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small" variant="outlined">
              <InputLabel id="edit-work-position-label" shrink>
                Position
              </InputLabel>
              <Select
                labelId="edit-work-position-label"
                value={editWorkForm.position || ''}
                onChange={handleEditWorkFormChange('position')}
                label="Position"
                notched
                displayEmpty
                renderValue={(selected) =>
                  selected ? selected : <span style={{ color: '#94a3b8' }}>Select position</span>
                }
              >
                <MenuItem value="">
                  <span style={{ color: '#94a3b8' }}>Select position</span>
                </MenuItem>
                {ORG_POSITION_LEVELS.map((p) => (
                  <MenuItem key={p} value={p}>{p}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small" variant="outlined">
              <InputLabel id="edit-work-manager-label" shrink>
                Manager
              </InputLabel>
              <Select
                labelId="edit-work-manager-label"
                value={editWorkForm.manager || ''}
                onChange={handleEditWorkFormChange('manager')}
                label="Manager"
                notched
                displayEmpty
                disabled={loadingDropdownOptions}
                renderValue={(selected) => {
                  if (!selected) return <span style={{ color: '#94a3b8' }}>Select manager</span>;
                  if (selected === 'Admin' || selected === 'CEO' || selected === 'None') return 'None';
                  const match = managerOptions.find((m) => String(m?._id) === String(selected));
                  if (match) return `${match.name || ''} ${match.lastName || ''}`.trim() || String(selected);
                  return String(selected);
                }}
              >
                <MenuItem value="">
                  <span style={{ color: '#94a3b8' }}>Select manager</span>
                </MenuItem>
                <MenuItem value="Admin">None</MenuItem>
                {managerOptions
                  .filter((m) => String(m?._id) !== String(employee?._id))
                  .map((m) => {
                    const id = m?._id;
                    const name = `${m?.name || ''} ${m?.lastName || ''}`.trim();
                    return (
                      <MenuItem key={id || name} value={id || name}>
                        {name || 'N/A'}
                      </MenuItem>
                    );
                  })}
              </Select>
            </FormControl>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: '1fr',
                sm: hidePayrollForHrExecutive ? '1fr 1fr' : 'repeat(3, minmax(0, 1fr))',
              },
              mt: 2,
            }}
          >
            {!hidePayrollForHrExecutive ? (
              <TextField
                fullWidth
                size="small"
                label="Salary"
                type="number"
                value={editWorkForm.salary}
                onChange={handleEditWorkFormChange('salary')}
                placeholder="Enter salary"
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <Typography component="span" sx={{ mr: 1, color: 'text.secondary' }}>
                      ₹
                    </Typography>
                  ),
                }}
              />
            ) : null}
            <TextField
              fullWidth
              size="small"
              label="Joining date"
              type="date"
              value={editWorkForm.joiningDate}
              onChange={handleEditWorkFormChange('joiningDate')}
              placeholder="dd-mm-yyyy"
              InputLabelProps={{ shrink: true }}
            />
            <FormControl fullWidth size="small" variant="outlined">
              <InputLabel id="edit-work-shift-label" shrink>
                Shift
              </InputLabel>
              <Select
                labelId="edit-work-shift-label"
                value={editWorkForm.shiftId || ''}
                onChange={handleEditWorkFormChange('shiftId')}
                label="Shift"
                notched
                displayEmpty
              >
                <MenuItem value="">
                  <span style={{ color: '#94a3b8' }}>No Shift</span>
                </MenuItem>
                {shiftOptions.map((s) => (
                  <MenuItem key={s.key} value={s.key}>
                    {s.name}
                    {s.startTime && s.endTime ? ` (${s.startTime}–${s.endTime})` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' },
              mt: 2,
              alignItems: 'start',
            }}
          >
            <Box>
              <FormControl fullWidth size="small">
                <InputLabel id="edit-work-probation-status-label">Probation status</InputLabel>
                <Select
                  labelId="edit-work-probation-status-label"
                  value={
                    getAllowedProbationStatuses(
                      employee?.probation?.status || 'None',
                      allowProbationAfterJoining
                    ).includes(editWorkForm.probationStatus)
                      ? editWorkForm.probationStatus || 'None'
                      : employee?.probation?.status || 'None'
                  }
                  onChange={handleEditWorkFormChange('probationStatus')}
                  label="Probation status"
                >
                  {getAllowedProbationStatuses(
                    employee?.probation?.status || 'None',
                    allowProbationAfterJoining
                  ).map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.75, lineHeight: 1.4 }}
              >
                {allowProbationAfterJoining
                  ? 'Synced with Lifecycle. This organization allows starting or restarting probation after joining.'
                  : normalizeProbationStatus(employee?.probation?.status) === 'None'
                    ? 'Probation can only be started on Add Employee. Enable “Allow adding probation after joining” in Admin General Settings to start it later.'
                    : normalizeProbationStatus(employee?.probation?.status) === 'Active' ||
                        normalizeProbationStatus(employee?.probation?.status) === 'Extended'
                      ? 'You can extend or reduce the end date, or confirm probation. Restarting after confirmation is disabled for this organization.'
                      : 'Probation is complete. This organization does not allow putting the employee on probation again.'}
              </Typography>
            </Box>
            <TextField
              fullWidth
              size="small"
              label="Probation start"
              type="date"
              value={editWorkForm.probationStartDate}
              onChange={handleEditWorkFormChange('probationStartDate')}
              InputLabelProps={{ shrink: true }}
              disabled={
                !allowProbationAfterJoining &&
                normalizeProbationStatus(employee?.probation?.status) === 'None'
              }
            />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              mt: 2,
            }}
          >
            <TextField
              fullWidth
              size="small"
              label="Probation end"
              type="date"
              value={editWorkForm.probationEndDate}
              onChange={handleEditWorkFormChange('probationEndDate')}
              InputLabelProps={{ shrink: true }}
              disabled={
                !allowProbationAfterJoining &&
                !['Active', 'Extended'].includes(
                  normalizeProbationStatus(employee?.probation?.status)
                )
              }
            />
            <TextField
              fullWidth
              size="small"
              label="Confirmed on"
              type="date"
              value={editWorkForm.probationConfirmedAt}
              onChange={handleEditWorkFormChange('probationConfirmedAt')}
              InputLabelProps={{ shrink: true }}
              disabled={
                !allowProbationAfterJoining &&
                normalizeProbationStatus(employee?.probation?.status) === 'None'
              }
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenEditWorkDialog(false)} disabled={updatingWorkInfo}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSaveWorkInfo} disabled={updatingWorkInfo}>
            {updatingWorkInfo ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openEditPerformanceDialog}
        onClose={() => setOpenEditPerformanceDialog(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FiStar /> Edit performance score
          </Box>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size="small"
            label="Performance score"
            type="number"
            value={editPerformanceForm.performanceScore}
            onChange={(e) =>
              setEditPerformanceForm({ performanceScore: e.target.value })
            }
            inputProps={{ min: 0, max: 100, step: 0.1 }}
            helperText="0–100"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditPerformanceDialog(false)} disabled={updatingWorkInfo}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSavePerformanceScore} disabled={updatingWorkInfo}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openEditPayrollSettingsDialog}
        onClose={() => setOpenEditPayrollSettingsDialog(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Statutory deduction settings</DialogTitle>
        <DialogContent>
          <p className="mb-4 text-sm text-slate-600">
            Control whether PF and ESI are deducted from this employee&apos;s future payroll runs.
          </p>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <label className="flex items-start gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={editPayrollSettingsForm.deductPf}
                onChange={(e) =>
                  setEditPayrollSettingsForm((prev) => ({ ...prev, deductPf: e.target.checked }))
                }
              />
              <span>
                <strong>Deduct PF</strong>
                <span className="block text-xs text-slate-500">
                  12% employee + employer on capped basic wage (₹15,000 max)
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={editPayrollSettingsForm.deductEsi}
                onChange={(e) =>
                  setEditPayrollSettingsForm((prev) => ({ ...prev, deductEsi: e.target.checked }))
                }
              />
              <span>
                <strong>Deduct ESI</strong>
                <span className="block text-xs text-slate-500">
                  Applied when statutory wages are within ₹21,000 ceiling
                </span>
              </span>
            </label>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setOpenEditPayrollSettingsDialog(false)}
            disabled={updatingPayrollSettings}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSavePayrollSettings}
            disabled={updatingPayrollSettings}
          >
            {updatingPayrollSettings ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default EmployeeDetailsPage;
