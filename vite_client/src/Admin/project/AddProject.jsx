import React, { useState, useEffect, useMemo } from 'react';
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
  Autocomplete,
  useMediaQuery,
  useTheme,
  InputAdornment,
  Grid
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { fetchEmployees } from '../../context/employeeSlice';
import useAddProject from '../../Hooks/useAddProject';
import { isManager, isHR } from '../../utils/managerHelper';
import { isExecutive } from '../../utils/navigationConfig';
import {
  canViewProjectFinancials,
  projectFinancialPayload,
} from '../../utils/projectFinancialsHelper';
import { FiPlus, FiTrash2 } from 'react-icons/fi';

/** @typedef {{ title: string, description: string, assignee: string|null, dueDate: string, priority: string, subtasks: { title: string, description: string }[] }} WorkPlanRow */

function buildWorkItemsPayload(rows) {
    return rows
        .filter((t) => t.title?.trim())
        .map((t) => ({
            title: t.title.trim(),
            description: t.description?.trim() || undefined,
            assignee: t.assignee || undefined,
            dueDate: t.dueDate || undefined,
            priority: t.priority || 'medium',
            subtasks: (t.subtasks || [])
                .filter((s) => s.title?.trim())
                .map((s) => ({
                    title: s.title.trim(),
                    description: s.description?.trim() || undefined,
                    priority: s.priority || 'medium',
                })),
        }));
}

function AddProject() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    
    // Get user and employee from Redux
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    
    // Get employees from Redux store
    const employees = useSelector((state) => state.employees.employees || []);
    const status = useSelector((state) => state.employees.status);
    const employeesError = useSelector((state) => state.employees.error);
    
    // Project submission status
    const projectStatus = useSelector((state) => state.project.status);
    const projectError = useSelector((state) => state.project.error);
    const addProject = useAddProject();

    // Check if user has permission to create projects
    const hasPermission = useMemo(() => {
        const userRole = user?.role || employee?.role;
        if (userRole === 'admin') return true;
        const userObj = user || employee;
        const position = (userObj?.position || '').toLowerCase().trim();
        const isCEO = position === 'ceo' || position.includes('chief executive');
        return isManager(userObj) || isHR(userObj) || isCEO || isExecutive(position);
    }, [user, employee]);

    const canViewFinancials = useMemo(
        () => canViewProjectFinancials(user, employee),
        [user, employee]
    );

    const [form, setForm] = useState({ 
        name: '', 
        description: '',
        status: 'pending',
        priority: 'medium',
        startDate: '',
        endDate: '',
        projectLeader: null,
        projectMembers: [],
        budget: '',
        actualCost: '',
        revenue: '',
        currency: 'USD',
        category: '',
        tags: []
    });
    
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    /** @type {[WorkPlanRow[], function]} */
    const [workPlanRows, setWorkPlanRows] = useState([]);

    // Redirect if no permission
    useEffect(() => {
        if (user && !hasPermission) {
            navigate('/dashboard');
        }
    }, [user, hasPermission, navigate]);

    // Load full org roster for leader / member / work-plan assignee pickers (paginated API)
    useEffect(() => {
        if (!hasPermission) return;
        dispatch(fetchEmployees({ fetchAllPages: true }));
    }, [dispatch, hasPermission]);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleLeaderChange = (event, newValue) => {
        setForm({
            ...form,
            projectLeader: newValue ? newValue._id : null
        });
        setError('');
    };

    const handleMemberSelect = (employeeId) => {
        if (form.projectMembers.includes(employeeId)) {
            setForm({
                ...form,
                projectMembers: form.projectMembers.filter(id => id !== employeeId)
            });
        } else {
            setForm({
                ...form,
                projectMembers: [...form.projectMembers, employeeId]
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validate
        if (!form.name.trim()) {
            setError('Project name is required');
            return;
        }

        if (!form.projectLeader) {
            setError('Please select a project leader');
            return;
        }

        // Validate dates
        if (form.startDate && form.endDate) {
            const start = new Date(form.startDate);
            const end = new Date(form.endDate);
            if (end < start) {
                setError('End date must be after start date');
                return;
            }
        }

        // Prepare data for backend
        const projectData = {
            name: form.name.trim(),
            description: form.description.trim() || undefined,
            status: form.status,
            priority: form.priority,
            startDate: form.startDate || undefined,
            endDate: form.endDate || undefined,
            projectLeader: form.projectLeader,
            projectMembers: form.projectMembers,
            ...(canViewFinancials && projectFinancialPayload(form)),
            category: form.category || undefined,
            tags: form.tags || []
        };

        const workItems = buildWorkItemsPayload(workPlanRows);
        if (workItems.length) {
            projectData.workItems = workItems;
        }

        const result = await addProject(projectData);

        if (result.success) {
            const userRole = user?.role || employee?.role;
            if (userRole === 'admin') {
                navigate('/dashboard-admin');
            } else if (isManager(user || employee)) {
                navigate('/dashboard-manager');
            } else if (isHR(user || employee)) {
                navigate('/dashboard-hr');
            } else {
                navigate('/dashboard');
            }
        } else {
            setError(result.error?.message || 'Failed to add project');
        }
    };

    // Helper function to get employee name by ID
    const getEmployeeName = (id) => {
        const employee = employees.find(emp => emp._id === id);
        return employee ? `${employee.name} ${employee.lastName}` : '';
    };

    // Get selected leader employee object
    const selectedLeader = employees.find(emp => emp._id === form.projectLeader);

    const activeEmployees = useMemo(
        () =>
            employees.filter(
                (employee) => employee.status === 'active' || employee.active === true
            ),
        [employees]
    );

    const matchesEmployeeSearch = (employee) =>
        `${employee.name} ${employee.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());

    const filteredEmployees = activeEmployees.filter(matchesEmployeeSearch);
    const filteredActiveEmployees = activeEmployees.filter(matchesEmployeeSearch);

    // Removed console.log statements for production

    if (!hasPermission) {
        return (
            <Box p={2}>
                <Alert severity="error">
                    You do not have permission to create projects. Only Admins, Project Managers, Managers, and HR can create projects.
                </Alert>
            </Box>
        );
    }

    if (status === 'loading') {
        return (
            <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
            </Box>
        );
    }

    if (status === 'failed') {
        return (
            <Box p={2}>
                <Alert severity="error">
                    Error loading employees: {employeesError || 'Unknown error occurred'}
                </Alert>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                width: '100%',
                minWidth: 0,
                maxWidth: '100%',
                py: { xs: 2, sm: 3, md: 4 },
                px: { xs: 1.5, sm: 2.5, md: 3, lg: 4 },
            }}
        >
            <Box
                sx={{
                    width: '100%',
                    maxWidth: { xs: '100%', sm: 720, md: 860, lg: 920 },
                    mx: 'auto',
                }}
            >
                <Typography
                    variant="h4"
                    sx={{
                        fontWeight: 700,
                        mb: { xs: 2, sm: 2.5 },
                        fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2rem' },
                        lineHeight: 1.3,
                    }}
                >
                    Add New Project
                </Typography>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {projectStatus === 'loading' && (
                    <Box display="flex" justifyContent="center" py={2} mb={1}>
                        <CircularProgress size={isMobile ? 28 : 36} />
                    </Box>
                )}

                <Paper
                    elevation={3}
                    sx={{
                        p: { xs: 2, sm: 2.5, md: 3.5 },
                        borderRadius: 2,
                        overflow: 'hidden',
                    }}
                >
                    <form onSubmit={handleSubmit}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 0.5, sm: 1 } }}>
                            <TextField
                                fullWidth
                                label="Project Name"
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                margin="normal"
                                required
                                size={isMobile ? 'small' : 'medium'}
                            />

                            <TextField
                                fullWidth
                                label="Description"
                                name="description"
                                value={form.description}
                                onChange={handleChange}
                                margin="normal"
                                multiline
                                rows={isMobile ? 3 : 4}
                                size={isMobile ? 'small' : 'medium'}
                            />

                            <Grid container spacing={{ xs: 1.5, sm: 2 }}>
                                <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth margin="normal" size={isMobile ? 'small' : 'medium'}>
                                        <InputLabel>Project Status</InputLabel>
                                        <Select
                                            name="status"
                                            value={form.status}
                                            onChange={handleChange}
                                            label="Project Status"
                                            required
                                        >
                                            <MenuItem value="pending">Pending</MenuItem>
                                            <MenuItem value="in-progress">In Progress</MenuItem>
                                            <MenuItem value="completed">Completed</MenuItem>
                                            <MenuItem value="on-hold">On Hold</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth margin="normal" size={isMobile ? 'small' : 'medium'}>
                                        <InputLabel>Priority</InputLabel>
                                        <Select
                                            name="priority"
                                            value={form.priority}
                                            onChange={handleChange}
                                            label="Priority"
                                        >
                                            <MenuItem value="low">Low</MenuItem>
                                            <MenuItem value="medium">Medium</MenuItem>
                                            <MenuItem value="high">High</MenuItem>
                                            <MenuItem value="critical">Critical</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Start Date"
                                        name="startDate"
                                        type="date"
                                        value={form.startDate}
                                        onChange={handleChange}
                                        margin="normal"
                                        InputLabelProps={{ shrink: true }}
                                        size={isMobile ? 'small' : 'medium'}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="End Date"
                                        name="endDate"
                                        type="date"
                                        value={form.endDate}
                                        onChange={handleChange}
                                        margin="normal"
                                        InputLabelProps={{ shrink: true }}
                                        size={isMobile ? 'small' : 'medium'}
                                    />
                                </Grid>
                            </Grid>
                        </Box>

                        {/* Project Leader Section */}
                        <Box
                            sx={{
                                mt: { xs: 3, sm: 3.5 },
                                pt: { xs: 2.5, sm: 3 },
                                borderTop: 1,
                                borderColor: 'divider',
                            }}
                        >
                            <Typography
                                variant="h6"
                                sx={{
                                    fontWeight: 600,
                                    mb: 0.5,
                                    fontSize: { xs: '1.05rem', sm: '1.15rem', md: '1.25rem' },
                                }}
                            >
                                Project Leader <span style={{ color: 'red' }}>*</span>
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Select one project leader for this project.
                            </Typography>
                            {selectedLeader && (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                                    <Chip
                                        label={`${selectedLeader.name} ${selectedLeader.lastName}`}
                                        onDelete={() => setForm({ ...form, projectLeader: null })}
                                        color="primary"
                                        size={isMobile ? 'small' : 'medium'}
                                    />
                                </Box>
                            )}
                            <Autocomplete
                                options={filteredEmployees}
                                getOptionLabel={(employee) => `${employee.name} ${employee.lastName}`}
                                value={selectedLeader || null}
                                onChange={handleLeaderChange}
                                fullWidth
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Search and select project leader"
                                        placeholder="Type to search employees"
                                        required
                                        size={isMobile ? 'small' : 'medium'}
                                    />
                                )}
                                renderOption={(props, employee) => (
                                    <MenuItem {...props} key={employee._id}>
                                        <ListItemText
                                            primary={`${employee.name} ${employee.lastName}`}
                                            secondary={`${employee.position} - ${employee.department}`}
                                            sx={{
                                                '& .MuiListItemText-primary': { fontSize: isMobile ? '0.875rem' : '1rem' },
                                                '& .MuiListItemText-secondary': { fontSize: isMobile ? '0.75rem' : '0.875rem' },
                                            }}
                                        />
                                    </MenuItem>
                                )}
                            />
                        </Box>

                        {/* Project Members Section */}
                        <Box
                            sx={{
                                mt: { xs: 3, sm: 3.5 },
                                pt: { xs: 2.5, sm: 3 },
                                borderTop: 1,
                                borderColor: 'divider',
                            }}
                        >
                            <Typography
                                variant="h6"
                                sx={{
                                    fontWeight: 600,
                                    mb: 0.5,
                                    fontSize: { xs: '1.05rem', sm: '1.15rem', md: '1.25rem' },
                                }}
                            >
                                Project Members
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Select team members for this project. Any employee can be added as a project member.
                            </Typography>
                            {form.projectMembers.length > 0 && (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                                    {form.projectMembers.map((id) => (
                                        <Chip
                                            key={id}
                                            label={getEmployeeName(id)}
                                            onDelete={() => handleMemberSelect(id)}
                                            color="secondary"
                                            size={isMobile ? 'small' : 'medium'}
                                        />
                                    ))}
                                </Box>
                            )}
                            <Autocomplete
                                multiple
                                options={filteredActiveEmployees}
                                getOptionLabel={(employee) => `${employee.name} ${employee.lastName}`}
                                value={activeEmployees.filter((emp) => form.projectMembers.includes(emp._id))}
                                onChange={(event, newValue) => {
                                    setForm({
                                        ...form,
                                        projectMembers: newValue.map((emp) => emp._id),
                                    });
                                }}
                                fullWidth
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Search and select members"
                                        placeholder="Type to search employees"
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        size={isMobile ? 'small' : 'medium'}
                                    />
                                )}
                                renderOption={(props, employee, { selected }) => (
                                    <MenuItem {...props} key={employee._id}>
                                        <Checkbox
                                            checked={form.projectMembers.includes(employee._id)}
                                            size={isMobile ? 'small' : 'medium'}
                                        />
                                        <ListItemText
                                            primary={`${employee.name} ${employee.lastName}`}
                                            secondary={`${employee.position} - ${employee.department}`}
                                            sx={{
                                                '& .MuiListItemText-primary': { fontSize: isMobile ? '0.875rem' : '1rem' },
                                                '& .MuiListItemText-secondary': { fontSize: isMobile ? '0.75rem' : '0.875rem' },
                                            }}
                                        />
                                    </MenuItem>
                                )}
                                renderTags={(value, getTagProps) =>
                                    value.map((employee, index) => (
                                        <Chip
                                            {...getTagProps({ index })}
                                            key={employee._id}
                                            label={`${employee.name} ${employee.lastName}`}
                                            size={isMobile ? 'small' : 'medium'}
                                        />
                                    ))
                                }
                            />
                        </Box>

                        {canViewFinancials && (
                            <Box
                                sx={{
                                    mt: { xs: 3, sm: 3.5 },
                                    p: { xs: 2, sm: 2.5 },
                                    bgcolor: '#e3f2fd',
                                    borderRadius: 2,
                                }}
                            >
                                <Typography
                                    variant="h6"
                                    sx={{
                                        fontWeight: 600,
                                        mb: 0.5,
                                        fontSize: { xs: '1.05rem', sm: '1.15rem', md: '1.25rem' },
                                    }}
                                >
                                    Cost Tracking
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    Track project budget, costs, and revenue.
                                </Typography>
                                <Grid container spacing={{ xs: 1.5, sm: 2 }}>
                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            label="Budget"
                                            name="budget"
                                            type="number"
                                            value={form.budget}
                                            onChange={handleChange}
                                            margin="normal"
                                            size={isMobile ? 'small' : 'medium'}
                                            InputProps={{
                                                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <FormControl fullWidth margin="normal" size={isMobile ? 'small' : 'medium'}>
                                            <InputLabel>Currency</InputLabel>
                                            <Select
                                                name="currency"
                                                value={form.currency}
                                                onChange={handleChange}
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
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            label="Actual Cost"
                                            name="actualCost"
                                            type="number"
                                            value={form.actualCost}
                                            onChange={handleChange}
                                            margin="normal"
                                            size={isMobile ? 'small' : 'medium'}
                                            InputProps={{
                                                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            label="Revenue"
                                            name="revenue"
                                            type="number"
                                            value={form.revenue}
                                            onChange={handleChange}
                                            margin="normal"
                                            size={isMobile ? 'small' : 'medium'}
                                            InputProps={{
                                                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                            }}
                                        />
                                    </Grid>
                                </Grid>
                            </Box>
                        )}

                        {/* Work plan: tasks & subtasks (optional) */}
                        <Box
                            sx={{
                                mt: { xs: 3, sm: 3.5 },
                                pt: { xs: 2.5, sm: 3 },
                                borderTop: 1,
                                borderColor: 'divider',
                            }}
                        >
                            <Typography
                                variant="h6"
                                sx={{
                                    fontWeight: 600,
                                    mb: 0.5,
                                    fontSize: { xs: '1.05rem', sm: '1.15rem', md: '1.25rem' },
                                }}
                            >
                                Work plan{' '}
                                <Typography component="span" variant="body2" color="text.secondary">
                                    (optional)
                                </Typography>
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Add main tasks and subtasks now, or leave blank and define them later on the project page.
                            </Typography>
                            <Button
                                type="button"
                                size="small"
                                startIcon={<FiPlus />}
                                variant="outlined"
                                onClick={() =>
                                    setWorkPlanRows((prev) => [
                                        ...prev,
                                        {
                                            title: '',
                                            description: '',
                                            assignee: null,
                                            dueDate: '',
                                            priority: 'medium',
                                            subtasks: [],
                                        },
                                    ])
                                }
                                sx={{ mb: 2 }}
                            >
                                Add task
                            </Button>
                            {workPlanRows.map((row, rowIdx) => (
                                <Paper
                                    key={rowIdx}
                                    variant="outlined"
                                    sx={{
                                        p: { xs: 1.5, sm: 2 },
                                        mb: 2,
                                        borderRadius: 1.5,
                                    }}
                                >
                                    <Box
                                        display="flex"
                                        justifyContent="space-between"
                                        alignItems="center"
                                        gap={1}
                                        flexWrap="wrap"
                                        mb={1}
                                    >
                                        <Typography variant="subtitle2" color="text.secondary">
                                            Task {rowIdx + 1}
                                        </Typography>
                                        <Button
                                            type="button"
                                            size="small"
                                            color="error"
                                            startIcon={<FiTrash2 />}
                                            onClick={() =>
                                                setWorkPlanRows((prev) => prev.filter((_, i) => i !== rowIdx))
                                            }
                                        >
                                            Remove
                                        </Button>
                                    </Box>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Task title"
                                        value={row.title}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setWorkPlanRows((prev) =>
                                                prev.map((r, i) => (i === rowIdx ? { ...r, title: v } : r))
                                            );
                                        }}
                                        margin="dense"
                                        sx={{ mb: 1 }}
                                    />
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Description"
                                        value={row.description}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setWorkPlanRows((prev) =>
                                                prev.map((r, i) => (i === rowIdx ? { ...r, description: v } : r))
                                            );
                                        }}
                                        margin="dense"
                                        multiline
                                        minRows={2}
                                        sx={{ mb: 1 }}
                                    />
                                    <Grid container spacing={1.5} sx={{ mb: 1 }}>
                                        <Grid item xs={12} sm={6}>
                                            <FormControl size="small" fullWidth>
                                                <InputLabel>Priority</InputLabel>
                                                <Select
                                                    label="Priority"
                                                    value={row.priority}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        setWorkPlanRows((prev) =>
                                                            prev.map((r, i) =>
                                                                i === rowIdx ? { ...r, priority: v } : r
                                                            )
                                                        );
                                                    }}
                                                >
                                                    <MenuItem value="low">Low</MenuItem>
                                                    <MenuItem value="medium">Medium</MenuItem>
                                                    <MenuItem value="high">High</MenuItem>
                                                    <MenuItem value="critical">Critical</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <TextField
                                                size="small"
                                                fullWidth
                                                label="Due date"
                                                type="date"
                                                value={row.dueDate}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    setWorkPlanRows((prev) =>
                                                        prev.map((r, i) =>
                                                            i === rowIdx ? { ...r, dueDate: v } : r
                                                        )
                                                    );
                                                }}
                                                InputLabelProps={{ shrink: true }}
                                            />
                                        </Grid>
                                    </Grid>
                                    <Autocomplete
                                        size="small"
                                        options={filteredActiveEmployees}
                                        getOptionLabel={(emp) => `${emp.name} ${emp.lastName || ''}`}
                                        value={
                                            row.assignee
                                                ? activeEmployees.find((e) => e._id === row.assignee) || null
                                                : null
                                        }
                                        onChange={(_, newVal) => {
                                            setWorkPlanRows((prev) =>
                                                prev.map((r, i) =>
                                                    i === rowIdx
                                                        ? { ...r, assignee: newVal ? newVal._id : null }
                                                        : r
                                                )
                                            );
                                        }}
                                        fullWidth
                                        renderInput={(params) => (
                                            <TextField {...params} label="Assignee (optional)" margin="dense" />
                                        )}
                                    />
                                    <Box mt={2}>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            display="block"
                                            gutterBottom
                                        >
                                            Subtasks
                                        </Typography>
                                        <Button
                                            type="button"
                                            size="small"
                                            startIcon={<FiPlus />}
                                            onClick={() => {
                                                setWorkPlanRows((prev) =>
                                                    prev.map((r, i) =>
                                                        i === rowIdx
                                                            ? {
                                                                  ...r,
                                                                  subtasks: [
                                                                      ...(r.subtasks || []),
                                                                      {
                                                                          title: '',
                                                                          description: '',
                                                                          priority: 'medium',
                                                                      },
                                                                  ],
                                                              }
                                                            : r
                                                    )
                                                );
                                            }}
                                        >
                                            Add subtask
                                        </Button>
                                        {(row.subtasks || []).map((st, si) => (
                                            <Box
                                                key={si}
                                                display="flex"
                                                flexDirection={{ xs: 'column', sm: 'row' }}
                                                gap={1}
                                                alignItems={{ xs: 'stretch', sm: 'flex-start' }}
                                                mt={1.5}
                                                ml={{ xs: 0, sm: 1 }}
                                            >
                                                <TextField
                                                    size="small"
                                                    fullWidth
                                                    label={`Subtask ${si + 1}`}
                                                    value={st.title}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        setWorkPlanRows((prev) =>
                                                            prev.map((r, i) => {
                                                                if (i !== rowIdx) return r;
                                                                const subs = [...(r.subtasks || [])];
                                                                subs[si] = { ...subs[si], title: v };
                                                                return { ...r, subtasks: subs };
                                                            })
                                                        );
                                                    }}
                                                />
                                                <TextField
                                                    size="small"
                                                    fullWidth
                                                    label="Notes"
                                                    value={st.description || ''}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        setWorkPlanRows((prev) =>
                                                            prev.map((r, i) => {
                                                                if (i !== rowIdx) return r;
                                                                const subs = [...(r.subtasks || [])];
                                                                subs[si] = { ...subs[si], description: v };
                                                                return { ...r, subtasks: subs };
                                                            })
                                                        );
                                                    }}
                                                />
                                                <Button
                                                    type="button"
                                                    size="small"
                                                    color="error"
                                                    sx={{
                                                        alignSelf: { xs: 'flex-end', sm: 'center' },
                                                        minWidth: { xs: 'auto', sm: 40 },
                                                        flexShrink: 0,
                                                    }}
                                                    onClick={() =>
                                                        setWorkPlanRows((prev) =>
                                                            prev.map((r, i) => {
                                                                if (i !== rowIdx) return r;
                                                                return {
                                                                    ...r,
                                                                    subtasks: (r.subtasks || []).filter(
                                                                        (_, j) => j !== si
                                                                    ),
                                                                };
                                                            })
                                                        )
                                                    }
                                                >
                                                    ×
                                                </Button>
                                            </Box>
                                        ))}
                                    </Box>
                                </Paper>
                            ))}
                        </Box>

                        {/* Category */}
                        <Box
                            sx={{
                                mt: { xs: 3, sm: 3.5 },
                                pt: { xs: 2.5, sm: 3 },
                                borderTop: 1,
                                borderColor: 'divider',
                            }}
                        >
                            <TextField
                                fullWidth
                                label="Category"
                                name="category"
                                value={form.category}
                                onChange={handleChange}
                                margin="none"
                                placeholder="e.g., Development, Marketing, Research"
                                size={isMobile ? 'small' : 'medium'}
                            />
                        </Box>

                        <Box
                            sx={{
                                mt: { xs: 3, sm: 4 },
                                pt: { xs: 2.5, sm: 3 },
                                borderTop: 1,
                                borderColor: 'divider',
                                display: 'flex',
                                flexDirection: { xs: 'column-reverse', sm: 'row' },
                                justifyContent: { xs: 'stretch', sm: 'space-between' },
                                alignItems: { xs: 'stretch', sm: 'center' },
                                gap: 1.5,
                            }}
                        >
                            <Button
                                variant="contained"
                                color="primary"
                                type="submit"
                                disabled={projectStatus === 'loading'}
                                fullWidth={isMobile}
                                size={isMobile ? 'medium' : 'large'}
                                sx={{ minWidth: { sm: 140 } }}
                            >
                                {projectStatus === 'loading' ? 'Saving...' : 'Save Project'}
                            </Button>

                            <Button
                                onClick={() => {
                                    const userRole = user?.role || employee?.role;
                                    if (userRole === 'admin') {
                                        navigate('/dashboard-admin');
                                    } else if (isManager(user || employee)) {
                                        navigate('/dashboard-manager');
                                    } else if (isHR(user || employee)) {
                                        navigate('/dashboard-hr');
                                    } else {
                                        navigate('/dashboard');
                                    }
                                }}
                                variant="outlined"
                                color="secondary"
                                fullWidth={isMobile}
                                size={isMobile ? 'medium' : 'large'}
                                sx={{ minWidth: { sm: 120 } }}
                            >
                                Cancel
                            </Button>
                        </Box>
                    </form>
                </Paper>
            </Box>
        </Box>
    );
}

export default AddProject;