import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Checkbox,
  ListItemText,
  Divider,
  Tabs,
  Tab,
  useMediaQuery,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider,
  Avatar,
  Card,
  CardContent,
  InputAdornment,
  Autocomplete
} from '@mui/material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { FiEdit2, FiTrash2, FiSave, FiX, FiChevronLeft, FiRefreshCw, FiMessageSquare, FiCalendar, FiUser, FiTrendingUp, FiPlus } from 'react-icons/fi';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import useUpdateProject from '../../Hooks/useUpdateProject';
import useDeleteProject from '../../Hooks/useDeleteProject';
import { fetchEmployees } from '../../context/employeeSlice';
import useGetAllProjects from '../../Hooks/useGetAllProjects';
import { fetchProjectTasks } from '../../context/projectSlice';
import axios from '../../utils/axios';
import { ADMIN_PROJECT_ENDPOINT } from '../../utils/constant';
import {
  canViewProjectFinancials,
  projectFinancialPayload,
} from '../../utils/projectFinancialsHelper';
import { format } from 'date-fns';
import { isExecutive } from '../../utils/navigationConfig';

const ProjectDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  useGetAllProjects();
  
  // Memoized selectors to prevent unnecessary re-renders
  const project = useSelector(store => 
    store.project?.allProjects?.find(p => p._id === id)
  );
  
  // Project tasks data - memoized with useMemo to prevent unnecessary rerenders
  const projectTasks = useSelector((state) => state.project.projectTasks || []);
  const tasksStatus = useSelector((state) => state.project.status);
  const tasksError = useSelector((state) => state.project.error);
  
  // Employees data - memoized with useMemo to prevent unnecessary rerenders
  const employees = useSelector((state) => state.employees.employees || []);
  const employeesStatus = useSelector((state) => state.employees.status);
  const employeesError = useSelector((state) => state.employees.error);

  // Status values are already extracted above

  // Get current user for project leader check
  const user = useSelector((state) => state.auth.user);
  const employee = useSelector((state) => state.employeeDetails.employee);

  const canViewFinancials = useMemo(
    () => canViewProjectFinancials(user, employee),
    [user, employee]
  );

  // Filter active employees for project members - memoized
  const activeEmployees = useMemo(() => 
    employees.filter(employee => 
      employee.status === 'active' || employee.active === true
    ), [employees]
  );
  
  // State management
  const [isEditing, setIsEditing] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [editedProject, setEditedProject] = useState({
    name: '',
    status: '',
    projectLeader: '',
    projectMembers: [],
    budget: '',
    actualCost: '',
    revenue: '',
    currency: 'USD',
    category: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Project leader features state
  const [statusUpdateDialog, setStatusUpdateDialog] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  // Daily updates state
  const [updates, setUpdates] = useState([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);
  const [updateDialog, setUpdateDialog] = useState(false);
  const [newUpdate, setNewUpdate] = useState({
    update: '',
    updateDate: new Date().toISOString().split('T')[0],
    status: '',
    progress: 0,
    blockers: '',
    nextSteps: ''
  });
  const [submittingUpdate, setSubmittingUpdate] = useState(false);

  // Project work plan (tasks / subtasks — not daily logs)
  const [workPlanTree, setWorkPlanTree] = useState([]);
  const [workPlanLoading, setWorkPlanLoading] = useState(false);
  const [workPlanError, setWorkPlanError] = useState(null);
  const [newRootTaskTitle, setNewRootTaskTitle] = useState('');
  const [workItemEditOpen, setWorkItemEditOpen] = useState(false);
  const [workItemEditSaving, setWorkItemEditSaving] = useState(false);
  const [workItemEditForm, setWorkItemEditForm] = useState({
    _id: '',
    title: '',
    description: '',
    assignee: null,
    dueDate: '',
    priority: 'medium',
    status: 'todo',
  });
  const [subtaskParentId, setSubtaskParentId] = useState(null);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [subtaskSaving, setSubtaskSaving] = useState(false);

  // Check if current user is project leader
  const isProjectLeader = useMemo(() => {
    const currentUserId = user?._id || employee?._id;
    return project?.projectLeader?._id?.toString() === currentUserId?.toString();
  }, [project, user, employee]);

  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  // Initialize data and fetch employees
  // All hooks must be called before any conditional returns
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setEditedProject(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  const handleMemberChange = useCallback((employeeId) => {
    setEditedProject(prev => {
      const currentMembers = [...prev.projectMembers];
      const index = currentMembers.indexOf(employeeId);
      
      if (index === -1) {
        return {
          ...prev,
          projectMembers: [...currentMembers, employeeId]
        };
      } else {
        return {
          ...prev,
          projectMembers: currentMembers.filter(id => id !== employeeId)
        };
      }
    });
  }, []);

  // Map backend status to frontend status format
  const mapStatusToFrontend = useCallback((backendStatus) => {
    if (!backendStatus) return '';
    const statusMap = {
      'pending': 'Not Started',
      'in-progress': 'In Progress',
      'completed': 'Completed',
      'on-hold': 'On Hold'
    };
    return statusMap[backendStatus.toLowerCase()] || backendStatus;
  }, []);

  // Map frontend status to backend status format
  const mapStatusToBackend = useCallback((frontendStatus) => {
    if (!frontendStatus) return '';
    const statusMap = {
      'Not Started': 'pending',
      'In Progress': 'in-progress',
      'Completed': 'completed',
      'On Hold': 'on-hold'
    };
    return statusMap[frontendStatus] || frontendStatus.toLowerCase();
  }, []);

  const handleUpdate = useCallback(async () => {
    try {
      // Validate that all project members are active employees
      const invalidMembers = editedProject.projectMembers.filter(memberId => {
        const member = employees.find(emp => emp._id === memberId);
        return !member || (member.status !== 'active' && member.active !== true);
      });

      if (invalidMembers.length > 0) {
        toast.error('Only active employees can be added as project members');
        return;
      }

      const projectData = {
        name: editedProject.name,
        status: mapStatusToBackend(editedProject.status),
        projectLeader: editedProject.projectLeader,
        projectMembers: editedProject.projectMembers,
        description: project.description,
        priority: project.priority,
        startDate: project.startDate,
        endDate: project.endDate,
        ...(canViewFinancials && projectFinancialPayload(editedProject)),
        category: editedProject.category || undefined
      };

      // Removed console.log statements for production

      const result = await updateProject(project?._id, projectData);
      if (result.success) {
        toast.success('Project updated successfully!');
        setIsEditing(false);
        // Refresh projects list
        window.location.reload();
      } else {
        // Removed console.error for production
        toast.error(result.error || 'Failed to update project');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'An error occurred while updating the project');
    }
  }, [editedProject, employees, updateProject, project, canViewFinancials, mapStatusToBackend]);

  const handleDelete = useCallback(async () => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        const result = await deleteProject(project?._id);
        if (result.success) {
          toast.success('Project deleted successfully!');
          navigate('/projects', { replace: true });
        } else {
          toast.error(result.message || 'Failed to delete project');
        }
      } catch (error) {
        toast.error('An error occurred while deleting the project');
        // Removed console.error for production
      }
    }
  }, [deleteProject, project?._id, navigate]);

  const getEmployeeName = useCallback((employee) => {
    return `${employee.name}`;
  }, []);

  const getEmployeeById = useCallback((id) => {
    return employees.find(emp => emp._id === id);
  }, [employees]);

  const handleTabChange = useCallback((event, newValue) => {
    setTabValue(newValue);
  }, []);

  const handleBackToProject = useCallback(() => {
    navigate('/projects', { replace: true });
    useGetAllProjects();
  }, [navigate]);

  const loadWorkPlan = useCallback(async () => {
    if (!project?._id) return;
    setWorkPlanLoading(true);
    setWorkPlanError(null);
    try {
      const response = await axios.get(`${ADMIN_PROJECT_ENDPOINT}/${project._id}/work-items`, {
        withCredentials: true,
      });
      if (response.data?.success) {
        setWorkPlanTree(response.data.workItems || []);
      } else {
        setWorkPlanError('Could not load work plan');
      }
    } catch (err) {
      setWorkPlanError(err.response?.data?.error || err.message || 'Failed to load work plan');
    } finally {
      setWorkPlanLoading(false);
    }
  }, [project?._id]);

  useEffect(() => {
    if (project) {
      setEditedProject({
        name: project.name,
        status: mapStatusToFrontend(project.status),
        projectLeader: project.projectLeader?._id || '',
        projectMembers: project.projectMembers?.map(m => m._id) || [],
        budget: project.budget || '',
        actualCost: project.actualCost || '',
        revenue: project.revenue || '',
        currency: project.currency || 'USD',
        category: project.category || ''
      });
      dispatch(fetchProjectTasks(project._id));
      fetchProjectUpdates();
      loadWorkPlan();
    }
    
    dispatch(fetchEmployees({ fetchAllPages: true }));
  }, [project, dispatch, mapStatusToFrontend, loadWorkPlan]);

  useEffect(() => {
    if (location.state?.startEditing && project) {
      setIsEditing(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.startEditing, location.pathname, navigate, project]);

  const handleWorkItemStatusChange = useCallback(
    async (workItemId, status) => {
      try {
        await axios.put(
          `${ADMIN_PROJECT_ENDPOINT}/work-items/${workItemId}`,
          { status },
          { withCredentials: true }
        );
        toast.success('Task updated');
        loadWorkPlan();
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to update task');
      }
    },
    [loadWorkPlan]
  );

  const handleDeleteWorkItem = useCallback(
    async (workItemId) => {
      if (!window.confirm('Delete this task and all its subtasks?')) return;
      try {
        await axios.delete(`${ADMIN_PROJECT_ENDPOINT}/work-items/${workItemId}`, {
          withCredentials: true,
        });
        toast.success('Task removed');
        loadWorkPlan();
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to delete task');
      }
    },
    [loadWorkPlan]
  );

  const handleAddRootWorkItem = useCallback(async () => {
    if (!newRootTaskTitle.trim() || !project?._id) return;
    try {
      await axios.post(
        `${ADMIN_PROJECT_ENDPOINT}/${project._id}/work-items`,
        { items: [{ title: newRootTaskTitle.trim() }] },
        { withCredentials: true }
      );
      toast.success('Task added');
      setNewRootTaskTitle('');
      loadWorkPlan();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add task');
    }
  }, [newRootTaskTitle, project?._id, loadWorkPlan]);

  const formatDueDateInput = useCallback((dateVal) => {
    if (!dateVal) return '';
    try {
      return format(new Date(dateVal), 'yyyy-MM-dd');
    } catch {
      return '';
    }
  }, []);

  const openWorkItemEdit = useCallback((item) => {
    setWorkItemEditForm({
      _id: item._id,
      title: item.title || '',
      description: item.description || '',
      assignee: item.assignee?._id || null,
      dueDate: formatDueDateInput(item.dueDate),
      priority: item.priority || 'medium',
      status: item.status || 'todo',
    });
    setWorkItemEditOpen(true);
  }, [formatDueDateInput]);

  const handleSaveWorkItemEdit = useCallback(async () => {
    if (!workItemEditForm.title.trim()) {
      toast.error('Title is required');
      return;
    }
    setWorkItemEditSaving(true);
    try {
      await axios.put(
        `${ADMIN_PROJECT_ENDPOINT}/work-items/${workItemEditForm._id}`,
        {
          title: workItemEditForm.title.trim(),
          description: workItemEditForm.description.trim() || '',
          assignee: workItemEditForm.assignee || null,
          dueDate: workItemEditForm.dueDate || null,
          priority: workItemEditForm.priority,
          status: workItemEditForm.status,
        },
        { withCredentials: true }
      );
      toast.success('Task updated');
      setWorkItemEditOpen(false);
      loadWorkPlan();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update task');
    } finally {
      setWorkItemEditSaving(false);
    }
  }, [workItemEditForm, loadWorkPlan]);

  const handleAddSubtask = useCallback(async () => {
    if (!subtaskTitle.trim() || !subtaskParentId || !project?._id) return;
    setSubtaskSaving(true);
    try {
      await axios.post(
        `${ADMIN_PROJECT_ENDPOINT}/${project._id}/work-items`,
        {
          items: [{
            title: subtaskTitle.trim(),
            parentTask: subtaskParentId,
          }],
        },
        { withCredentials: true }
      );
      toast.success('Subtask added');
      setSubtaskTitle('');
      setSubtaskParentId(null);
      loadWorkPlan();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add subtask');
    } finally {
      setSubtaskSaving(false);
    }
  }, [subtaskTitle, subtaskParentId, project?._id, loadWorkPlan]);

  const workItemStatusLabel = useCallback((s) => {
    const map = { todo: 'To do', 'in-progress': 'In progress', completed: 'Completed', 'on-hold': 'On hold' };
    return map[s] || s;
  }, []);

  const renderWorkItem = useCallback(
    (item, depth = 0) => (
      <Box
        key={item._id}
        sx={{
          pl: depth * 2,
          mb: 1.5,
          borderLeft: depth ? '2px solid' : 'none',
          borderColor: 'divider',
        }}
      >
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Box
            display="flex"
            flexDirection={isMobile ? 'column' : 'row'}
            alignItems={isMobile ? 'stretch' : 'flex-start'}
            justifyContent="space-between"
            gap={1.5}
          >
            <Box flex={1}>
              <Typography variant="subtitle1">{item.title}</Typography>
              {item.description ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {item.description}
                </Typography>
              ) : null}
              <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
                <Chip size="small" label={`Priority: ${item.priority || 'medium'}`} variant="outlined" />
                {item.assignee ? (
                  <Chip
                    size="small"
                    icon={<FiUser size={14} />}
                    label={`${item.assignee.name || ''} ${item.assignee.lastName || ''}`.trim()}
                    variant="outlined"
                  />
                ) : null}
                {item.dueDate ? (
                  <Chip
                    size="small"
                    icon={<FiCalendar size={14} />}
                    label={format(new Date(item.dueDate), 'MMM d, yyyy')}
                    variant="outlined"
                  />
                ) : null}
              </Box>
            </Box>
            <Box display="flex" flexWrap="wrap" gap={1} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={item.status || 'todo'}
                  onChange={(e) => handleWorkItemStatusChange(item._id, e.target.value)}
                >
                  <MenuItem value="todo">{workItemStatusLabel('todo')}</MenuItem>
                  <MenuItem value="in-progress">{workItemStatusLabel('in-progress')}</MenuItem>
                  <MenuItem value="completed">{workItemStatusLabel('completed')}</MenuItem>
                  <MenuItem value="on-hold">{workItemStatusLabel('on-hold')}</MenuItem>
                </Select>
              </FormControl>
              <Button
                size="small"
                variant="outlined"
                startIcon={<FiEdit2 />}
                onClick={() => openWorkItemEdit(item)}
              >
                Edit
              </Button>
              <Button
                size="small"
                color="error"
                startIcon={<FiTrash2 />}
                onClick={() => handleDeleteWorkItem(item._id)}
              >
                Delete
              </Button>
            </Box>
          </Box>
          {subtaskParentId === item._id ? (
            <Box display="flex" gap={1} mt={1.5} flexWrap="wrap" alignItems="center">
              <TextField
                size="small"
                label="Subtask title"
                value={subtaskTitle}
                onChange={(e) => setSubtaskTitle(e.target.value)}
                sx={{ flex: 1, minWidth: 160 }}
              />
              <Button
                size="small"
                variant="contained"
                disabled={!subtaskTitle.trim() || subtaskSaving}
                onClick={handleAddSubtask}
              >
                {subtaskSaving ? 'Adding…' : 'Save subtask'}
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setSubtaskParentId(null);
                  setSubtaskTitle('');
                }}
              >
                Cancel
              </Button>
            </Box>
          ) : (
            <Button
              size="small"
              startIcon={<FiPlus />}
              sx={{ mt: 1 }}
              onClick={() => {
                setSubtaskParentId(item._id);
                setSubtaskTitle('');
              }}
            >
              Add subtask
            </Button>
          )}
        </Paper>
        {(item.subtasks || []).map((st) => renderWorkItem(st, depth + 1))}
      </Box>
    ),
    [
      isMobile,
      handleWorkItemStatusChange,
      handleDeleteWorkItem,
      workItemStatusLabel,
      openWorkItemEdit,
      subtaskParentId,
      subtaskTitle,
      subtaskSaving,
      handleAddSubtask,
    ]
  );

  // Fetch project updates
  const fetchProjectUpdates = useCallback(async () => {
    if (!project?._id) return;
    
    try {
      setLoadingUpdates(true);
      const response = await axios.get(`${ADMIN_PROJECT_ENDPOINT}/${project._id}/updates`, {
        withCredentials: true
      });
      
      if (response.data?.success) {
        setUpdates(response.data.updates || []);
      }
    } catch (error) {
      // Don't show error toast if updates don't exist yet
      if (error.response?.status !== 404) {
        toast.error('Failed to load project updates');
      }
    } finally {
      setLoadingUpdates(false);
    }
  }, [project?._id]);

  // Handle status update
  const handleStatusUpdate = useCallback(async () => {
    if (!newStatus || !project?._id) return;
    
    try {
      setUpdatingStatus(true);
      const response = await axios.put(
        `${ADMIN_PROJECT_ENDPOINT}/${project._id}/update-status`,
        { status: newStatus },
        { withCredentials: true }
      );
      
      if (response.data?.success) {
        toast.success('Project status updated successfully!');
        setStatusUpdateDialog(false);
        setNewStatus('');
        // Refresh page to get updated project data
        window.location.reload();
      } else {
        toast.error(response.data?.error || 'Failed to update status');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update project status');
    } finally {
      setUpdatingStatus(false);
    }
  }, [newStatus, project?._id, dispatch]);

  // Handle daily update submission
  const handleSubmitUpdate = useCallback(async () => {
    if (!newUpdate.update.trim() || !project?._id) return;
    
    try {
      setSubmittingUpdate(true);
      const response = await axios.post(
        `${ADMIN_PROJECT_ENDPOINT}/${project._id}/updates`,
        newUpdate,
        { withCredentials: true }
      );
      
      if (response.data?.success) {
        toast.success('Daily update posted successfully!');
        setUpdateDialog(false);
        setNewUpdate({
          update: '',
          updateDate: new Date().toISOString().split('T')[0],
          status: '',
          progress: 0,
          blockers: '',
          nextSteps: ''
        });
        fetchProjectUpdates();
      } else {
        toast.error(response.data?.error || 'Failed to post update');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to post daily update');
    } finally {
      setSubmittingUpdate(false);
    }
  }, [newUpdate, project?._id, fetchProjectUpdates]);

  // Conditional return after all hooks
  if (!project) {
    return (
      <Box p={4} textAlign="center">
        <Typography variant="h6">Project not found</Typography>
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        padding: isMobile ? 2 : 4,
        marginLeft: isMobile ? 0 : '16rem',
        transition: theme.transitions.create('margin', {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.leavingScreen,
        }),
      }}
    >
      <Box 
        display="flex" 
        flexDirection={isMobile ? 'column' : 'row'} 
        justifyContent="space-between" 
        alignItems={isMobile ? 'flex-start' : 'center'} 
        gap={2}
        mb={4}
      >
        <Button 
          onClick={() => navigate('/projects')}
          startIcon={<FiChevronLeft />}
          variant="outlined"
          size={isMobile ? 'small' : 'medium'}
        >
          Back to Projects
        </Button>
        
        <Box display="flex" gap={2} flexWrap="wrap">
          {!isEditing ? (
            <>
              {isProjectLeader && (
                <>
                  <Button 
                    onClick={() => {
                      setNewStatus(project.status);
                      setStatusUpdateDialog(true);
                    }}
                    startIcon={<FiRefreshCw />}
                    variant="contained"
                    color="info"
                    size={isMobile ? 'small' : 'medium'}
                  >
                    {isMobile ? 'Status' : 'Update Status'}
                  </Button>
                  <Button 
                    onClick={() => {
                      setNewUpdate({
                        ...newUpdate,
                        status: project.status,
                        updateDate: new Date().toISOString().split('T')[0]
                      });
                      setUpdateDialog(true);
                    }}
                    startIcon={<FiMessageSquare />}
                    variant="contained"
                    color="success"
                    size={isMobile ? 'small' : 'medium'}
                  >
                    {isMobile ? 'Update' : 'Daily Update'}
                  </Button>
                </>
              )}
              <Button 
                onClick={() => setIsEditing(true)}
                startIcon={<FiEdit2 />}
                variant="contained"
                color="primary"
                size={isMobile ? 'small' : 'medium'}
              >
                {isMobile ? 'Edit' : 'Edit Project'}
              </Button>
              <Button 
                onClick={handleDelete}
                startIcon={<FiTrash2 />}
                variant="contained"
                color="error"
                size={isMobile ? 'small' : 'medium'}
              >
                {isMobile ? 'Delete' : 'Delete Project'}
              </Button>
            </>
          ) : (
            <>
              <Button 
                onClick={handleUpdate}
                startIcon={<FiSave />}
                variant="contained"
                color="success"
                size={isMobile ? 'small' : 'medium'}
              >
                Save
              </Button>
              <Button 
                onClick={() => setIsEditing(false)}
                startIcon={<FiX />}
                variant="outlined"
                color="secondary"
                size={isMobile ? 'small' : 'medium'}
              >
                Cancel
              </Button>
            </>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 3 }} variant="scrollable" scrollButtons="auto">
        <Tab label="Project Details" />
        <Tab label="Work plan" />
        <Tab label="Team daily logs" />
        <Tab label="Daily Updates" />
      </Tabs>

      {tabValue === 0 && (
        <>
          {isEditing ? (
            <Paper elevation={3} sx={{ padding: isMobile ? 2 : 3, mb: 4 }}>
              <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <TextField
                  fullWidth
                  label="Project Name"
                  name="name"
                  value={editedProject.name}
                  onChange={handleInputChange}
                  required
                  size={isMobile ? 'small' : 'medium'}
                />
                
                <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    name="status"
                    value={editedProject.status}
                    onChange={handleInputChange}
                    label="Status"
                    required
                  >
                    <MenuItem value="Not Started">Not Started</MenuItem>
                    <MenuItem value="In Progress">In Progress</MenuItem>
                    <MenuItem value="Completed">Completed</MenuItem>
                    <MenuItem value="On Hold">On Hold</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
                  <InputLabel>Project Leader</InputLabel>
                  <Select
                    name="projectLeader"
                    value={editedProject.projectLeader}
                    onChange={handleInputChange}
                    label="Project Leader"
                    required
                  >
                    {activeEmployees.map(employee => (
                      <MenuItem key={employee._id} value={employee._id}>
                        {getEmployeeName(employee)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
                  <InputLabel>Project Members</InputLabel>
                  <Select
                    multiple
                    name="projectMembers"
                    value={editedProject.projectMembers}
                    onChange={(e) => {
                      setEditedProject(prev => ({
                        ...prev,
                        projectMembers: e.target.value
                      }));
                    }}
                    label="Project Members"
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((employeeId) => {
                          const employee = getEmployeeById(employeeId);
                          return employee ? (
                            <Chip 
                              key={employeeId} 
                              label={getEmployeeName(employee)} 
                              size={isMobile ? 'small' : 'medium'}
                            />
                          ) : null;
                        })}
                      </Box>
                    )}
                  >
                    {activeEmployees.map((employee) => (
                      <MenuItem key={employee._id} value={employee._id}>
                        <Checkbox 
                          checked={editedProject.projectMembers.indexOf(employee._id) > -1} 
                          size={isMobile ? 'small' : 'medium'}
                        />
                        <ListItemText 
                          primary={getEmployeeName(employee)} 
                          primaryTypographyProps={{ fontSize: isMobile ? '0.875rem' : '1rem' }}
                        />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Cost Tracking Fields (CEO Only) */}
                {canViewFinancials && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Cost Tracking <Chip label="CEO Only" size="small" color="primary" sx={{ ml: 1 }} />
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <TextField
                        fullWidth
                        label="Budget"
                        name="budget"
                        type="number"
                        value={editedProject.budget}
                        onChange={handleInputChange}
                        size={isMobile ? 'small' : 'medium'}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">$</InputAdornment>
                        }}
                      />
                      <TextField
                        fullWidth
                        label="Actual Cost"
                        name="actualCost"
                        type="number"
                        value={editedProject.actualCost}
                        onChange={handleInputChange}
                        size={isMobile ? 'small' : 'medium'}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">$</InputAdornment>
                        }}
                      />
                      <TextField
                        fullWidth
                        label="Revenue"
                        name="revenue"
                        type="number"
                        value={editedProject.revenue}
                        onChange={handleInputChange}
                        size={isMobile ? 'small' : 'medium'}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">$</InputAdornment>
                        }}
                      />
                      <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
                        <InputLabel>Currency</InputLabel>
                        <Select
                          name="currency"
                          value={editedProject.currency}
                          onChange={handleInputChange}
                          label="Currency"
                        >
                          <MenuItem value="USD">USD</MenuItem>
                          <MenuItem value="EUR">EUR</MenuItem>
                          <MenuItem value="GBP">GBP</MenuItem>
                          <MenuItem value="INR">INR</MenuItem>
                          <MenuItem value="CAD">CAD</MenuItem>
                          <MenuItem value="AUD">AUD</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                    <TextField
                      fullWidth
                      label="Category"
                      name="category"
                      value={editedProject.category}
                      onChange={handleInputChange}
                      size={isMobile ? 'small' : 'medium'}
                      placeholder="e.g., Development, Marketing, Research"
                    />
                  </>
                )}
              </Box>
            </Paper>
          ) : (
            <Paper elevation={3} sx={{ padding: isMobile ? 2 : 3, mb: 4 }}>
              <Typography variant={isMobile ? 'h5' : 'h4'} gutterBottom>{project.name}</Typography>
              
              <Box 
                display="flex" 
                flexDirection={isMobile ? 'column' : 'row'} 
                gap={isMobile ? 2 : 4} 
                mb={3}
              >
                <Box>
                  <Typography variant="subtitle1" color="text.secondary">Status</Typography>
                  <Chip 
                    label={mapStatusToFrontend(project.status)} 
                    color={
                      project.status === 'completed' ? 'success' :
                      project.status === 'in-progress' ? 'primary' :
                      project.status === 'on-hold' ? 'warning' : 'default'
                    }
                    size={isMobile ? 'small' : 'medium'}
                  />
                </Box>
                
                <Box>
                  <Typography variant="subtitle1" color="text.secondary">Manager</Typography>
                  <Typography variant={isMobile ? 'body2' : 'body1'}>
                    {project.projectLeader ? getEmployeeName(project.projectLeader) : 'Not assigned'}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="subtitle1" color="text.secondary">Start Date</Typography>
                  <Typography variant={isMobile ? 'body2' : 'body1'}>
                    {new Date(project.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 3 }} />

              <Typography variant="subtitle1" gutterBottom>Team Members</Typography>
              {project.projectMembers?.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {project.projectMembers.map((member) => (
                    <Chip
                      key={member._id}
                      label={getEmployeeName(member)}
                      color="secondary"
                      variant="outlined"
                      size={isMobile ? 'small' : 'medium'}
                    />
                  ))}
                </Box>
              ) : (
                <Typography color="text.secondary">No team members assigned</Typography>
              )}

              {/* Cost Information (CEO Only) */}
              {canViewFinancials && (
                <>
                  <Divider sx={{ my: 3 }} />
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Financial Overview
                  </Typography>
                  <Box 
                    display="flex" 
                    flexDirection={isMobile ? 'column' : 'row'} 
                    gap={isMobile ? 2 : 4} 
                    mb={3}
                    flexWrap="wrap"
                  >
                    {project.budget && (
                      <Box>
                        <Typography variant="subtitle1" color="text.secondary">Budget</Typography>
                        <Typography variant={isMobile ? 'body2' : 'body1'} fontWeight={600}>
                          {project.currency || 'USD'} ${(project.budget / 1000).toFixed(1)}K
                        </Typography>
                      </Box>
                    )}
                    {project.actualCost && (
                      <Box>
                        <Typography variant="subtitle1" color="text.secondary">Actual Cost</Typography>
                        <Typography variant={isMobile ? 'body2' : 'body1'} fontWeight={600} color="error.main">
                          {project.currency || 'USD'} ${(project.actualCost / 1000).toFixed(1)}K
                        </Typography>
                      </Box>
                    )}
                    {project.revenue && (
                      <Box>
                        <Typography variant="subtitle1" color="text.secondary">Revenue</Typography>
                        <Typography variant={isMobile ? 'body2' : 'body1'} fontWeight={600} color="success.main">
                          {project.currency || 'USD'} ${(project.revenue / 1000).toFixed(1)}K
                        </Typography>
                      </Box>
                    )}
                    {project.budget && project.actualCost && (
                      <Box>
                        <Typography variant="subtitle1" color="text.secondary">Remaining Budget</Typography>
                        <Typography variant={isMobile ? 'body2' : 'body1'} fontWeight={600} color={project.budget - project.actualCost > 0 ? 'success.main' : 'error.main'}>
                          {project.currency || 'USD'} ${((project.budget - project.actualCost) / 1000).toFixed(1)}K
                        </Typography>
                      </Box>
                    )}
                    {project.revenue && project.actualCost && (
                      <Box>
                        <Typography variant="subtitle1" color="text.secondary">Net Profit</Typography>
                        <Typography variant={isMobile ? 'body2' : 'body1'} fontWeight={600} color={project.revenue - project.actualCost > 0 ? 'success.main' : 'error.main'}>
                          {project.currency || 'USD'} ${((project.revenue - project.actualCost) / 1000).toFixed(1)}K
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </>
              )}

              {project.category && (
                <>
                  <Divider sx={{ my: 3 }} />
                  <Box>
                    <Typography variant="subtitle1" color="text.secondary" gutterBottom>Category</Typography>
                    <Chip label={project.category} size="small" />
                  </Box>
                </>
              )}
            </Paper>
          )}
        </>
      )}

      {tabValue === 1 && (
        <Paper elevation={3} sx={{ padding: isMobile ? 2 : 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Work plan
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Tasks and subtasks for this project. This is separate from employees&apos; daily task logs.
          </Typography>

          <Box display="flex" flexDirection={isMobile ? 'column' : 'row'} gap={1} alignItems="flex-start" sx={{ mb: 3 }}>
            <TextField
              size="small"
              fullWidth={isMobile}
              label="New task title"
              value={newRootTaskTitle}
              onChange={(e) => setNewRootTaskTitle(e.target.value)}
              sx={{ minWidth: isMobile ? '100%' : 280 }}
            />
            <Button
              variant="contained"
              startIcon={<FiPlus />}
              onClick={handleAddRootWorkItem}
              disabled={!newRootTaskTitle.trim()}
              size={isMobile ? 'medium' : 'medium'}
            >
              Add task
            </Button>
            <Button variant="outlined" startIcon={<FiRefreshCw />} onClick={loadWorkPlan} size="small">
              Refresh
            </Button>
          </Box>

          {workPlanLoading ? (
            <Box display="flex" justifyContent="center" py={3}>
              <CircularProgress />
            </Box>
          ) : workPlanError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {workPlanError}
            </Alert>
          ) : workPlanTree.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No work items yet. Add a task above, or create tasks when you add a new project.
            </Typography>
          ) : (
            <Box>{workPlanTree.map((node) => renderWorkItem(node, 0))}</Box>
          )}
        </Paper>
      )}

      {tabValue === 2 && (
        <Paper elevation={3} sx={{ padding: isMobile ? 2 : 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>Daily task logs</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Per-day work entries logged by team members (not the project work breakdown).
          </Typography>
          
          {tasksStatus === 'loading' ? (
            <Box display="flex" justifyContent="center">
              <CircularProgress />
            </Box>
          ) : tasksError ? (
            <Alert severity="error" sx={{ mb: 3 }}>
              {tasksError}
            </Alert>
          ) : projectTasks.length === 0 ? (
            <Typography variant="body1" color="text.secondary">
              No tasks found for this project.
            </Typography>
          ) : (
            <Box display="flex" flexDirection="column" gap={2}>
              {projectTasks.map(task => (
                <Paper key={task._id} elevation={2} sx={{ p: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="subtitle1">{task.taskDescription}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {task.employee?.name} • {new Date(task.date).toLocaleDateString()}
                      </Typography>
                      {task.comments && (
                        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                          {task.comments}
                        </Typography>
                      )}
                    </Box>
                    <Chip 
                      label={mapStatusToFrontend(task.status)} 
                      size="small"
                      color={
                        task.status === 'completed' || task.status === 'Completed' ? 'success' :
                        task.status === 'in-progress' || task.status === 'In Progress' ? 'primary' :
                        task.status === 'on-hold' || task.status === 'On Hold' ? 'warning' : 'default'
                      }
                    />
                  </Box>
                </Paper>
              ))}
            </Box>
          )}
        </Paper>
      )}

      {tabValue === 3 && (
        <Paper elevation={3} sx={{ padding: isMobile ? 2 : 3, mb: 4 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6">Daily Updates</Typography>
            {isProjectLeader && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<FiMessageSquare />}
                onClick={() => {
                  setNewUpdate({
                    ...newUpdate,
                    status: project.status,
                    updateDate: new Date().toISOString().split('T')[0]
                  });
                  setUpdateDialog(true);
                }}
                size={isMobile ? 'small' : 'medium'}
              >
                Post Update
              </Button>
            )}
          </Box>

          {loadingUpdates ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : updates.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography variant="body1" color="text.secondary" mb={2}>
                No daily updates posted yet.
              </Typography>
              {isProjectLeader && (
                <Button
                  variant="outlined"
                  startIcon={<FiMessageSquare />}
                  onClick={() => {
                    setNewUpdate({
                      ...newUpdate,
                      status: project.status,
                      updateDate: new Date().toISOString().split('T')[0]
                    });
                    setUpdateDialog(true);
                  }}
                >
                  Post First Update
                </Button>
              )}
            </Box>
          ) : (
            <Box display="flex" flexDirection="column" gap={2}>
              {updates.map((update) => (
                <Card key={update._id} elevation={2}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main' }}>
                          {update.postedBy?.name?.charAt(0) || 'U'}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1" fontWeight={600}>
                            {update.postedBy?.name || 'Unknown'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                            <FiCalendar size={12} />
                            {format(new Date(update.updateDate), 'MMM dd, yyyy')}
                            {' • '}
                            {format(new Date(update.createdAt), 'h:mm a')}
                          </Typography>
                        </Box>
                      </Box>
                      <Chip
                        label={update.status}
                        size="small"
                        color={
                          update.status === 'completed' ? 'success' :
                          update.status === 'in-progress' ? 'primary' :
                          update.status === 'on-hold' ? 'warning' : 'default'
                        }
                      />
                    </Box>
                    
                    <Typography variant="body1" paragraph sx={{ whiteSpace: 'pre-wrap' }}>
                      {update.update}
                    </Typography>

                    {update.progress !== undefined && (
                      <Box mb={2}>
                        <Box display="flex" justifyContent="space-between" mb={0.5}>
                          <Typography variant="caption" color="text.secondary">Progress</Typography>
                          <Typography variant="caption" fontWeight={600}>{update.progress}%</Typography>
                        </Box>
                        <Slider
                          value={update.progress}
                          min={0}
                          max={100}
                          disabled
                          sx={{ pointerEvents: 'none' }}
                        />
                      </Box>
                    )}

                    {update.blockers && (
                      <Box mb={1}>
                        <Typography variant="caption" fontWeight={600} color="error.main">
                          Blockers:
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                          {update.blockers}
                        </Typography>
                      </Box>
                    )}

                    {update.nextSteps && (
                      <Box>
                        <Typography variant="caption" fontWeight={600} color="primary.main">
                          Next Steps:
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                          {update.nextSteps}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Paper>
      )}

      {/* Status Update Dialog */}
      <Dialog 
        open={statusUpdateDialog} 
        onClose={() => setStatusUpdateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Update Project Status</DialogTitle>
        <DialogContent>
            <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>New Status</InputLabel>
            <Select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              label="New Status"
            >
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="in-progress">In Progress</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="on-hold">On Hold</MenuItem>
            </Select>
            {project && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                Current status: <strong>{project.status}</strong>
              </Typography>
            )}
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusUpdateDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleStatusUpdate} 
            variant="contained" 
            disabled={!newStatus || updatingStatus}
          >
            {updatingStatus ? 'Updating...' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Daily Update Dialog */}
      <Dialog 
        open={updateDialog} 
        onClose={() => setUpdateDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Post Daily Update</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <TextField
              label="Update Date"
              type="date"
              value={newUpdate.updateDate}
              onChange={(e) => setNewUpdate({ ...newUpdate, updateDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            
            <TextField
              label="Update *"
              multiline
              rows={4}
              value={newUpdate.update}
              onChange={(e) => setNewUpdate({ ...newUpdate, update: e.target.value })}
              placeholder="Describe today's progress, achievements, and any important updates..."
              fullWidth
              required
            />

            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={newUpdate.status}
                onChange={(e) => setNewUpdate({ ...newUpdate, status: e.target.value })}
                label="Status"
              >
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="in-progress">In Progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="on-hold">On Hold</MenuItem>
              </Select>
            </FormControl>

            <Box>
              <Typography gutterBottom>Progress: {newUpdate.progress}%</Typography>
              <Slider
                value={newUpdate.progress}
                onChange={(e, value) => setNewUpdate({ ...newUpdate, progress: value })}
                min={0}
                max={100}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 50, label: '50%' },
                  { value: 100, label: '100%' }
                ]}
              />
            </Box>

            <TextField
              label="Blockers / Challenges"
              multiline
              rows={2}
              value={newUpdate.blockers}
              onChange={(e) => setNewUpdate({ ...newUpdate, blockers: e.target.value })}
              placeholder="Any blockers or challenges faced..."
              fullWidth
            />

            <TextField
              label="Next Steps"
              multiline
              rows={2}
              value={newUpdate.nextSteps}
              onChange={(e) => setNewUpdate({ ...newUpdate, nextSteps: e.target.value })}
              placeholder="Planned next steps..."
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpdateDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleSubmitUpdate} 
            variant="contained" 
            disabled={!newUpdate.update.trim() || submittingUpdate}
          >
            {submittingUpdate ? 'Posting...' : 'Post Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Work item edit (assignee, due date, details) */}
      <Dialog
        open={workItemEditOpen}
        onClose={() => !workItemEditSaving && setWorkItemEditOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit task</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              value={workItemEditForm.title}
              onChange={(e) => setWorkItemEditForm((f) => ({ ...f, title: e.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={workItemEditForm.description}
              onChange={(e) => setWorkItemEditForm((f) => ({ ...f, description: e.target.value }))}
              multiline
              minRows={2}
              fullWidth
            />
            <FormControl fullWidth size="small">
              <InputLabel>Priority</InputLabel>
              <Select
                label="Priority"
                value={workItemEditForm.priority}
                onChange={(e) => setWorkItemEditForm((f) => ({ ...f, priority: e.target.value }))}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={workItemEditForm.status}
                onChange={(e) => setWorkItemEditForm((f) => ({ ...f, status: e.target.value }))}
              >
                <MenuItem value="todo">To do</MenuItem>
                <MenuItem value="in-progress">In progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="on-hold">On hold</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Due date"
              type="date"
              value={workItemEditForm.dueDate}
              onChange={(e) => setWorkItemEditForm((f) => ({ ...f, dueDate: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <Autocomplete
              options={activeEmployees}
              getOptionLabel={(emp) => `${emp.name} ${emp.lastName || ''}`.trim()}
              value={
                workItemEditForm.assignee
                  ? activeEmployees.find((e) => e._id === workItemEditForm.assignee) || null
                  : null
              }
              onChange={(_, newVal) =>
                setWorkItemEditForm((f) => ({ ...f, assignee: newVal ? newVal._id : null }))
              }
              renderInput={(params) => (
                <TextField {...params} label="Assignee (optional)" />
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWorkItemEditOpen(false)} disabled={workItemEditSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveWorkItemEdit}
            disabled={workItemEditSaving || !workItemEditForm.title.trim()}
          >
            {workItemEditSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectDetailPage;