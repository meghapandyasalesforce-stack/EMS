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
  Grid,
} from '@mui/material';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useSelector, useDispatch } from 'react-redux';
import { FiChevronRight, FiEdit, FiStar } from 'react-icons/fi';
import { isHR, isManager } from '../../utils/managerHelper';
import {
  fetchEmployeeDetails,
  updateEmployeeStatus,
  updateEmployeeWorkInfo,
  clearEmployeeDetails,
} from '../../context/employeeDetailsSlice';
import { deleteEmployee } from '../../context/employeeSlice';
import { BOTH_DOCUMENT_ENDPOINT, BOTH_PROFILE_ENDPOINT } from '../../utils/constant';
import axiosInstance, { getBackendBaseURL } from '../../utils/axios';
import { DETAIL_TABS } from './employeeDetails/constants';
import EmployeeDetailsHeader from './employeeDetails/EmployeeDetailsHeader';
import PersonalTab from './employeeDetails/tabs/PersonalTab';
import JobDetailsTab from './employeeDetails/tabs/JobDetailsTab';
import DocumentsTab from './employeeDetails/tabs/DocumentsTab';
import LeaveTab from './employeeDetails/tabs/LeaveTab';
import PayrollTab from './employeeDetails/tabs/PayrollTab';
import PerformanceTab from './employeeDetails/tabs/PerformanceTab';
import TimelineTab from './employeeDetails/tabs/TimelineTab';
import AccessTab from './employeeDetails/tabs/AccessTab';
import useAuthPermissions from '../../Hooks/useAuthPermissions';
import { PERMISSIONS } from '../../utils/permissions';
import LeaveBalancesWidget from './employeeDetails/widgets/LeaveBalancesWidget';
import CareerTimelineWidget from './employeeDetails/widgets/CareerTimelineWidget';
import ReportingHierarchyWidget from './employeeDetails/widgets/ReportingHierarchyWidget';
import PayrollHighlightWidget from './employeeDetails/widgets/PayrollHighlightWidget';
import {
  calculateYearsOfExperience,
  getAttendanceRate,
  getFullName,
} from './employeeDetails/utils';
import SuggestRoleUpdateModal from '../../components/SuggestRoleUpdateModal';
import {
  assignEmployeeSystemRole,
  fetchEmployeeAccess,
  fetchSuggestedSystemRole,
  promoteEmployeeToHrManager,
} from '../../utils/systemRoleApi';
import { getRoleLabel } from '../../utils/systemRoleHelpers';

const EmployeeDetailsPage = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState('personal');
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openTerminateDialog, setOpenTerminateDialog] = useState(false);
  const [openEditWorkDialog, setOpenEditWorkDialog] = useState(false);
  const [openEditPerformanceDialog, setOpenEditPerformanceDialog] = useState(false);
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
  });
  const [editPerformanceForm, setEditPerformanceForm] = useState({ performanceScore: '' });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [deletingEmployee, setDeletingEmployee] = useState(false);
  const [managerOptions, setManagerOptions] = useState([]);
  const [jobTitleOptions, setJobTitleOptions] = useState([]);
  const [loadingDropdownOptions, setLoadingDropdownOptions] = useState(false);
  const [managerPreview, setManagerPreview] = useState(null);
  const [roleUpdatePrompt, setRoleUpdatePrompt] = useState(null);
  const [updatingSystemRole, setUpdatingSystemRole] = useState(false);
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
  } = useSelector((state) => state.employeeDetails);
  const currentUser = useSelector((state) => state.auth?.user);
  const sessionEmployee = useSelector((state) => state.employeeDetails?.employee);
  const { hasAnyPermission, isOrgOwner, isHrExecutive, isHrManager } = useAuthPermissions();
  const userIsHr = isHR(currentUser || sessionEmployee);
  const hidePayrollForHrExecutive = userIsHr && isHrExecutive && !isHrManager;
  const canManageAccess =
    isOrgOwner ||
    hasAnyPermission([PERMISSIONS.ORG_SETTINGS_MANAGE, PERMISSIONS.EMPLOYEE_EDIT_SENSITIVE]);
  const visibleTabs = DETAIL_TABS.filter(
    (tab) =>
      (!tab.permissionGated || canManageAccess) &&
      (!tab.hrOnly || userIsHr) &&
      !(hidePayrollForHrExecutive && tab.hideForHrExecutive)
  );
  const isManagerReadOnly = isManager(currentUser) && !isHR(currentUser) && currentUser?.role !== 'admin';
  const isAdminUser = currentUser?.role === 'admin';
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
      const [managersRes, jobTitlesRes] = await Promise.all([
        axiosInstance.get('/v1/admin/employee/managers?limit=500', { withCredentials: true }),
        axiosInstance.get('/v1/admin/employee/job-titles', { withCredentials: true }),
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

  const handleDownloadDocument = async (documentId, fileName) => {
    try {
      const base = BOTH_DOCUMENT_ENDPOINT.startsWith('http') ? '' : '/api';
      const downloadUrl = `${base}${BOTH_DOCUMENT_ENDPOINT}/${employeeId}/documents/${documentId}/download`;
      const response = await fetch(downloadUrl, { method: 'GET', credentials: 'include' });
      if (!response.ok) throw new Error('Failed to download');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName || 'document');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download document. Please try again.');
    }
  };

  const handleViewDocument = (doc) => {
    const backendUrl = getBackendBaseURL();
    window.open(`${backendUrl}${doc.filePath}`, '_blank');
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
    setEditWorkForm({
      jobTitle: employee.jobTitle || '',
      department: employee.department || '',
      position: employee.position || '',
      manager: employee.managerId || employee.manager || '',
      salary: employee.salary != null ? employee.salary : '',
      joiningDate: employee.joiningDate
        ? new Date(employee.joiningDate).toISOString().split('T')[0]
        : '',
    });
    setOpenEditWorkDialog(true);
  };

  const handleEditWorkFormChange = (field) => (event) => {
    setEditWorkForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const checkRoleUpdateAfterWorkSave = async (workData) => {
    if (!canManageAccess) return;

    try {
      const [suggested, access] = await Promise.all([
        fetchSuggestedSystemRole({
          department: workData.department,
          jobTitle: workData.jobTitle,
          position: workData.position,
        }),
        fetchEmployeeAccess(employeeId),
      ]);

      if (suggested.systemRoleId !== access.systemRoleId) {
        const catalog = access.catalog || [];
        setRoleUpdatePrompt({
          suggested,
          currentRoleId: access.systemRoleId,
          currentRoleLabel: access.systemRoleLabel || getRoleLabel(access.systemRoleId, catalog),
          suggestedRoleLabel: suggested.label || getRoleLabel(suggested.systemRoleId, catalog),
        });
      }
    } catch {
      // Non-fatal — work info was still saved
    }
  };

  const handleApplyRoleUpdate = async () => {
    if (!roleUpdatePrompt) return;

    setUpdatingSystemRole(true);
    try {
      await assignEmployeeSystemRole(employeeId, roleUpdatePrompt.suggested.systemRoleId);
      toast.success(
        `System access updated to ${roleUpdatePrompt.suggestedRoleLabel}. Ask them to log out and back in.`
      );
      setRoleUpdatePrompt(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update system access');
    } finally {
      setUpdatingSystemRole(false);
    }
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

    const workData = {
      jobTitle: editWorkForm.jobTitle,
      department: editWorkForm.department,
      position: editWorkForm.position,
      manager: editWorkForm.manager,
      salary: salaryValue,
      joiningDate: editWorkForm.joiningDate
        ? new Date(editWorkForm.joiningDate).toISOString()
        : null,
    };

    const resultAction = await dispatch(
      updateEmployeeWorkInfo({
        employeeId,
        workData,
      })
    );
    if (updateEmployeeWorkInfo.fulfilled.match(resultAction)) {
      setSnackbar({ open: true, message: 'Work information updated.', severity: 'success' });
      setOpenEditWorkDialog(false);
      await checkRoleUpdateAfterWorkSave(workData);
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

  const renderTabContent = () => {
    if (!employee) return null;
    switch (activeTab) {
      case 'personal':
        return <PersonalTab employee={employee} />;
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
        return <PayrollTab employee={employee} />;
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
      case 'access':
        return (
          <AccessTab
            employeeId={employee._id}
            employee={employee}
            canEdit={canManageAccess && !isManagerReadOnly}
          />
        );
      default:
        return <PersonalTab employee={employee} />;
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
    <div className="min-h-[calc(100vh-64px)] bg-[#F5F7FB] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link to="/employees" className="font-medium text-[#0d9488] hover:underline">
            Employee Directory
          </Link>
          <FiChevronRight className="h-4 w-4 shrink-0" />
          <span className="font-medium text-slate-800">{getFullName(employee)}</span>
        </nav>

        <button
          type="button"
          onClick={() => navigate('/employees')}
          className="inline-flex items-center rounded-full border-2 border-[#20C997] px-4 py-2 text-sm font-semibold text-[#0d9488] transition hover:bg-[#20C997]/10"
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
          isManagerReadOnly={isManagerReadOnly}
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

        <div className="overflow-x-auto border-b border-slate-200">
          <div className="flex min-w-max gap-1" role="tablist">
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

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">{renderTabContent()}</div>
          <aside className="space-y-4 xl:col-span-1">
            {!hidePayrollForHrExecutive && <PayrollHighlightWidget employee={employee} />}
            <LeaveBalancesWidget employeeId={employee._id} compact />
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
        open={openEditWorkDialog}
        onClose={() => setOpenEditWorkDialog(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FiEdit /> Edit work information
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Job title</InputLabel>
                <Select
                  value={editWorkForm.jobTitle}
                  onChange={handleEditWorkFormChange('jobTitle')}
                  label="Job title"
                  disabled={loadingDropdownOptions}
                >
                  {editWorkForm.jobTitle && !jobTitleOptions.includes(editWorkForm.jobTitle) && (
                    <MenuItem value={editWorkForm.jobTitle}>{editWorkForm.jobTitle}</MenuItem>
                  )}
                  {jobTitleOptions.map((t) => (
                    <MenuItem key={t} value={t}>{t}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Department</InputLabel>
                <Select
                  value={editWorkForm.department}
                  onChange={handleEditWorkFormChange('department')}
                  label="Department"
                >
                  {['Engineering', 'HR', 'Finance', 'Sales', 'Marketing', 'IT Support', 'Operations', 'Customer Support', 'Legal', 'Product', 'Research & Development', 'Design', 'Administration'].map((d) => (
                    <MenuItem key={d} value={d}>{d}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Position</InputLabel>
                <Select
                  value={editWorkForm.position}
                  onChange={handleEditWorkFormChange('position')}
                  label="Position"
                >
                  {['Intern', 'Junior', 'Mid-Level', 'Senior', 'Lead', 'Supervisor', 'Manager', 'Director', 'Executive', 'VP', 'CTO', 'CFO', 'CEO'].map((p) => (
                    <MenuItem key={p} value={p}>{p}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Manager</InputLabel>
                <Select
                  value={editWorkForm.manager}
                  onChange={handleEditWorkFormChange('manager')}
                  label="Manager"
                  disabled={loadingDropdownOptions}
                >
                  {managerOptions.map((m) => {
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
            </Grid>
            {!hidePayrollForHrExecutive && (
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Salary"
                type="number"
                value={editWorkForm.salary}
                onChange={handleEditWorkFormChange('salary')}
                InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>₹</Typography> }}
              />
            </Grid>
            )}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Joining date"
                type="date"
                value={editWorkForm.joiningDate}
                onChange={handleEditWorkFormChange('joiningDate')}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
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

      <SuggestRoleUpdateModal
        open={Boolean(roleUpdatePrompt)}
        employeeName={employee ? getFullName(employee) : ''}
        currentRoleLabel={roleUpdatePrompt?.currentRoleLabel}
        suggestedRoleLabel={roleUpdatePrompt?.suggestedRoleLabel}
        suggestedRoleId={roleUpdatePrompt?.suggested?.systemRoleId}
        reason={roleUpdatePrompt?.suggested?.reason}
        saving={updatingSystemRole}
        onApply={handleApplyRoleUpdate}
        onDismiss={() => setRoleUpdatePrompt(null)}
      />
    </div>
  );
};

export default EmployeeDetailsPage;
