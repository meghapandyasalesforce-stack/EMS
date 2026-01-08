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

    // Check if user is CEO (for cost tracking access)
    const isCEO = useMemo(() => {
        const position = (user?.position || employee?.position || '').toLowerCase().trim();
        return position === 'ceo' || position.includes('chief executive');
    }, [user, employee]);

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

    // Redirect if no permission
    useEffect(() => {
        if (user && !hasPermission) {
            navigate('/dashboard');
        }
    }, [user, hasPermission, navigate]);

    // Fetch employees when component mounts
    useEffect(() => {
        if (hasPermission && status === 'idle') {
            dispatch(fetchEmployees());
        }
    }, [status, dispatch, hasPermission]);

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
            ...(isCEO && {
                budget: form.budget ? parseFloat(form.budget) : 0,
                actualCost: form.actualCost ? parseFloat(form.actualCost) : 0,
                revenue: form.revenue ? parseFloat(form.revenue) : 0,
                currency: form.currency || 'USD'
            }),
            category: form.category || undefined,
            tags: form.tags || []
        };

        // Removed console.log for production

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

    // Filter employees based on search term and position
    const filteredEmployees = employees.filter(employee => 
        `${employee.name} ${employee.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Filter active employees for project members
    const activeEmployees = employees.filter(employee => 
        employee.status === 'active' || employee.active === true
    );

    const filteredActiveEmployees = activeEmployees.filter(employee => 
        `${employee.name} ${employee.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Removed console.log statements for production

    if (!hasPermission) {
        return (
            <Box p={2}>
                <Alert severity="error">
                    You do not have permission to create projects. Only Admins, Managers, and HR can create projects.
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
                padding: 4,
                // Adjust margin based on sidebar state and screen size
                marginLeft: isMobile ? 0 : '20rem', // Default to expanded sidebar
                transition: theme.transitions.create('margin', {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.leavingScreen,
                }),
                // You might want to add a class or state to track sidebar collapsed state
                // Here's how you would adjust it when sidebar is minimized:
                // '&.sidebar-collapsed': {
                //     marginLeft: '5rem', // w-20 equivalent
                // },
                // For mobile, no margin needed as sidebar becomes top navbar
                [theme.breakpoints.down('md')]: {
                    marginLeft: 0,
                    padding: 2
                }
            }}
        >
            <Typography variant="h4" gutterBottom sx={{ [theme.breakpoints.down('md')]: { fontSize: '1.5rem' } }}>
                Add New Project
            </Typography>
            
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}
            
            {projectStatus === 'loading' && (
                <Box display="flex" justifyContent="center" p={2}>
                    <CircularProgress />
                </Box>
            )}

            <Paper elevation={3} sx={{ 
                padding: 3,
                [theme.breakpoints.down('md')]: {
                    padding: 2
                }
            }}>
                <form onSubmit={handleSubmit}>
                    <TextField
                        fullWidth
                        label="Project Name"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        margin="normal"
                        required
                        sx={{ [theme.breakpoints.down('md')]: { marginBottom: 2 } }}
                    />
                    
                    <TextField
                        fullWidth
                        label="Description"
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                        margin="normal"
                        multiline
                        rows={3}
                        sx={{ [theme.breakpoints.down('md')]: { marginBottom: 2 } }}
                    />
                    
                    <Box display="flex" gap={2} sx={{ [theme.breakpoints.down('md')]: { flexDirection: 'column' } }}>
                        <FormControl fullWidth margin="normal" sx={{ [theme.breakpoints.down('md')]: { marginBottom: 2 } }}>
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
                        
                        <FormControl fullWidth margin="normal" sx={{ [theme.breakpoints.down('md')]: { marginBottom: 2 } }}>
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
                    </Box>
                    
                    <Box display="flex" gap={2} sx={{ [theme.breakpoints.down('md')]: { flexDirection: 'column' } }}>
                        <TextField
                            fullWidth
                            label="Start Date"
                            name="startDate"
                            type="date"
                            value={form.startDate}
                            onChange={handleChange}
                            margin="normal"
                            InputLabelProps={{ shrink: true }}
                            sx={{ [theme.breakpoints.down('md')]: { marginBottom: 2 } }}
                        />
                        
                        <TextField
                            fullWidth
                            label="End Date"
                            name="endDate"
                            type="date"
                            value={form.endDate}
                            onChange={handleChange}
                            margin="normal"
                            InputLabelProps={{ shrink: true }}
                            sx={{ [theme.breakpoints.down('md')]: { marginBottom: 2 } }}
                        />
                    </Box>
                    
                    {/* Project Leader Section */}
                    <Box mt={3} sx={{ [theme.breakpoints.down('md')]: { marginTop: 2 } }}>
                        <Typography variant="h6" gutterBottom sx={{ [theme.breakpoints.down('md')]: { fontSize: '1.1rem' } }}>
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
                                            '& .MuiListItemText-secondary': { fontSize: isMobile ? '0.75rem' : '0.875rem' }
                                        }}
                                    />
                                </MenuItem>
                            )}
                        />
                    </Box>
                    
                    {/* Project Members Section */}
                    <Box mt={3} sx={{ [theme.breakpoints.down('md')]: { marginTop: 2 } }}>
                        <Typography variant="h6" gutterBottom sx={{ [theme.breakpoints.down('md')]: { fontSize: '1.1rem' } }}>
                            Project Members
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Select team members for this project. Any employee can be added as a project member.
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                            {form.projectMembers.map(id => (
                                <Chip
                                    key={id}
                                    label={getEmployeeName(id)}
                                    onDelete={() => handleMemberSelect(id)}
                                    color="secondary"
                                    size={isMobile ? 'small' : 'medium'}
                                />
                            ))}
                        </Box>
                        <Autocomplete
                            multiple
                            options={filteredActiveEmployees}
                            getOptionLabel={(employee) => `${employee.name} ${employee.lastName}`}
                            value={activeEmployees.filter(emp => form.projectMembers.includes(emp._id))}
                            onChange={(event, newValue) => {
                                setForm({
                                    ...form,
                                    projectMembers: newValue.map(emp => emp._id)
                                });
                            }}
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
                                    <Checkbox checked={form.projectMembers.includes(employee._id)} size={isMobile ? 'small' : 'medium'} />
                                    <ListItemText 
                                        primary={`${employee.name} ${employee.lastName}`}
                                        secondary={`${employee.position} - ${employee.department}`}
                                        sx={{ 
                                            '& .MuiListItemText-primary': { fontSize: isMobile ? '0.875rem' : '1rem' },
                                            '& .MuiListItemText-secondary': { fontSize: isMobile ? '0.75rem' : '0.875rem' }
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

                    {/* Cost Tracking Section (CEO Only) */}
                    {isCEO && (
                        <Box mt={3} sx={{ [theme.breakpoints.down('md')]: { marginTop: 2 }, p: 2, bgcolor: '#e3f2fd', borderRadius: 2 }}>
                            <Typography variant="h6" gutterBottom sx={{ [theme.breakpoints.down('md')]: { fontSize: '1.1rem' } }}>
                                Cost Tracking <Chip label="CEO Only" size="small" color="primary" sx={{ ml: 1 }} />
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Track project budget, costs, and revenue.
                            </Typography>
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Budget"
                                        name="budget"
                                        type="number"
                                        value={form.budget}
                                        onChange={handleChange}
                                        margin="normal"
                                        InputProps={{
                                            startAdornment: <InputAdornment position="start">$</InputAdornment>
                                        }}
                                        sx={{ [theme.breakpoints.down('md')]: { marginBottom: 2 } }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth margin="normal">
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
                                        InputProps={{
                                            startAdornment: <InputAdornment position="start">$</InputAdornment>
                                        }}
                                        sx={{ [theme.breakpoints.down('md')]: { marginBottom: 2 } }}
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
                                        InputProps={{
                                            startAdornment: <InputAdornment position="start">$</InputAdornment>
                                        }}
                                        sx={{ [theme.breakpoints.down('md')]: { marginBottom: 2 } }}
                                    />
                                </Grid>
                            </Grid>
                        </Box>
                    )}

                    {/* Category */}
                    <Box mt={3} sx={{ [theme.breakpoints.down('md')]: { marginTop: 2 } }}>
                        <TextField
                            fullWidth
                            label="Category"
                            name="category"
                            value={form.category}
                            onChange={handleChange}
                            margin="normal"
                            placeholder="e.g., Development, Marketing, Research"
                            sx={{ [theme.breakpoints.down('md')]: { marginBottom: 2 } }}
                        />
                    </Box>
                    
                    <Box mt={4} display="flex" justifyContent="space-between" sx={{ 
                        [theme.breakpoints.down('md')]: { 
                            flexDirection: 'column-reverse',
                            gap: 2,
                            marginTop: 3
                        }
                    }}>
                        <Button 
                            variant="contained" 
                            color="primary" 
                            type="submit"
                            disabled={projectStatus === 'loading'}
                            fullWidth={isMobile}
                            size={isMobile ? 'medium' : 'large'}
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
                        >
                            Cancel
                        </Button>
                    </Box>
                </form>
            </Paper>
        </Box>
    );
}

export default AddProject;