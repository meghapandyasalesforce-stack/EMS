import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import ProjectCard from './ProjectCard';
import useGetAllProjects from '../../Hooks/useGetAllProjects';
import { isManager, isHR } from '../../utils/managerHelper';
import { isExecutive } from '../../utils/navigationConfig';
import { 
  TextField, 
  InputAdornment, 
  IconButton, 
  Container, 
  Typography, 
  Box, 
  CircularProgress, 
  Alert,
  Button,
  Fab,
  Card,
  CardContent,
  Chip,
  Paper,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Tooltip,
  Menu,
  ListItemIcon,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Pagination,
  Stack,
  Grid
} from '@mui/material';
import { 
  FiSearch, FiX, FiPlus, FiTrendingUp, FiClock, FiCheckCircle, FiPause, 
  FiAlertCircle, FiGrid, FiList, FiFilter, FiDownload, FiRefreshCw,
  FiEdit, FiTrash2, FiMoreVertical, FiBarChart2, FiDollarSign, FiCalendar,
  FiUser, FiTag, FiFileText, FiPrinter
} from 'react-icons/fi';
import { format } from 'date-fns';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip as ChartTooltip,
  Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  ChartTooltip,
  Legend
);

const ProjectsPageEnhanced = () => {
  useGetAllProjects();
  const navigate = useNavigate();
  const { allProjects, loading, error } = useSelector(store => store.project);
  const user = useSelector((state) => state.auth.user);
  const employee = useSelector((state) => state.employeeDetails.employee);
  
  // Search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [leaderFilter, setLeaderFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState({ start: '', end: '' });
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  // View and display
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [sortBy, setSortBy] = useState('date-desc');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  
  // Bulk actions
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [bulkActionMenu, setBulkActionMenu] = useState(null);
  
  // Quick actions
  const [quickActionProject, setQuickActionProject] = useState(null);
  const [quickActionMenu, setQuickActionMenu] = useState(null);
  
  // Export
  const [exportDialog, setExportDialog] = useState(false);
  
  // Check user permissions
  const canCreateProject = useMemo(() => {
    const userRole = user?.role || employee?.role;
    if (userRole === 'admin') return true;
    const userObj = user || employee;
    const position = (userObj?.position || '').toLowerCase().trim();
    const isCEO = position === 'ceo' || position.includes('chief executive');
    return isManager(userObj) || isHR(userObj) || isCEO || isExecutive(position);
  }, [user, employee]);
  
  const isCEO = useMemo(() => {
    const position = (user?.position || employee?.position || '').toLowerCase().trim();
    return position === 'ceo' || position.includes('chief executive');
  }, [user, employee]);

  // Debounce search
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timerId);
  }, [searchTerm]);

  // Get unique project leaders for filter
  const projectLeaders = useMemo(() => {
    if (!allProjects) return [];
    const leaders = new Map();
    allProjects.forEach(project => {
      if (project.projectLeader) {
        const leaderId = project.projectLeader._id || project.projectLeader;
        if (!leaders.has(leaderId)) {
          leaders.set(leaderId, project.projectLeader);
        }
      }
    });
    return Array.from(leaders.values());
  }, [allProjects]);

  // Get unique categories for filter
  const categories = useMemo(() => {
    if (!allProjects) return [];
    const cats = new Set();
    allProjects.forEach(project => {
      if (project.category) cats.add(project.category);
    });
    return Array.from(cats);
  }, [allProjects]);

  // Filter projects
  const filteredProjects = useMemo(() => {
    if (!allProjects) return [];
    
    return allProjects.filter(project => {
      // Search filter
      const matchesSearch = !debouncedSearchTerm || 
        project.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (project.description && project.description.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
        (project.projectLeader?.name && project.projectLeader.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));
      
      // Status filter
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      
      // Priority filter
      const matchesPriority = priorityFilter === 'all' || project.priority === priorityFilter;
      
      // Leader filter
      const matchesLeader = leaderFilter === 'all' || 
        (project.projectLeader?._id || project.projectLeader) === leaderFilter;
      
      // Category filter
      const matchesCategory = categoryFilter === 'all' || project.category === categoryFilter;
      
      // Date range filter
      let matchesDateRange = true;
      if (dateRangeFilter.start) {
        const startDate = new Date(dateRangeFilter.start);
        const projectStart = project.startDate ? new Date(project.startDate) : new Date(project.createdAt);
        if (projectStart < startDate) matchesDateRange = false;
      }
      if (dateRangeFilter.end) {
        const endDate = new Date(dateRangeFilter.end);
        const projectEnd = project.endDate ? new Date(project.endDate) : new Date(project.createdAt);
        if (projectEnd > endDate) matchesDateRange = false;
      }
      
      return matchesSearch && matchesStatus && matchesPriority && matchesLeader && matchesCategory && matchesDateRange;
    });
  }, [allProjects, debouncedSearchTerm, statusFilter, priorityFilter, leaderFilter, categoryFilter, dateRangeFilter]);

  // Sort projects
  const sortedProjects = useMemo(() => {
    const sorted = [...filteredProjects];
    switch(sortBy) {
      case 'name-asc':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'name-desc':
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case 'date-desc':
        return sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      case 'date-asc':
        return sorted.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
      case 'priority':
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return sorted.sort((a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0));
      case 'status':
        const statusOrder = { 'in-progress': 1, 'pending': 2, 'on-hold': 3, 'completed': 4 };
        return sorted.sort((a, b) => (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0));
      default:
        return sorted;
    }
  }, [filteredProjects, sortBy]);

  // Paginate projects
  const paginatedProjects = useMemo(() => {
    const startIndex = (page - 1) * itemsPerPage;
    return sortedProjects.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedProjects, page, itemsPerPage]);

  const totalPages = Math.ceil(sortedProjects.length / itemsPerPage);

  // Calculate statistics
  const projectStats = useMemo(() => {
    if (!allProjects) return { 
      total: 0, pending: 0, inProgress: 0, completed: 0, onHold: 0,
      low: 0, medium: 0, high: 0, critical: 0,
      overdue: 0, totalBudget: 0, totalRevenue: 0, totalCost: 0
    };
    
    const stats = allProjects.reduce((acc, project) => {
      acc.total++;
      
      // Status counts
      switch (project.status) {
        case 'pending': acc.pending++; break;
        case 'in-progress': acc.inProgress++; break;
        case 'completed': acc.completed++; break;
        case 'on-hold': acc.onHold++; break;
      }
      
      // Priority counts
      switch (project.priority) {
        case 'low': acc.low++; break;
        case 'medium': acc.medium++; break;
        case 'high': acc.high++; break;
        case 'critical': acc.critical++; break;
      }
      
      // Overdue check
      if (project.endDate && new Date(project.endDate) < new Date() && project.status !== 'completed') {
        acc.overdue++;
      }
      
      // Cost tracking (CEO only)
      if (isCEO && project.budget) acc.totalBudget += project.budget || 0;
      if (isCEO && project.revenue) acc.totalRevenue += project.revenue || 0;
      if (isCEO && project.actualCost) acc.totalCost += project.actualCost || 0;
      
      return acc;
    }, { 
      total: 0, pending: 0, inProgress: 0, completed: 0, onHold: 0,
      low: 0, medium: 0, high: 0, critical: 0,
      overdue: 0, totalBudget: 0, totalRevenue: 0, totalCost: 0
    });
    
    return stats;
  }, [allProjects, isCEO]);

  // Check if project is overdue
  const isOverdue = useCallback((project) => {
    return project.endDate && 
           new Date(project.endDate) < new Date() && 
           project.status !== 'completed';
  }, []);

  // Calculate project progress (from updates or estimate)
  const getProjectProgress = useCallback((project) => {
    // In real implementation, this would come from project updates
    // For now, estimate based on status
    switch(project.status) {
      case 'completed': return 100;
      case 'in-progress': return 50;
      case 'pending': return 0;
      case 'on-hold': return 25;
      default: return 0;
    }
  }, []);

  // Handle bulk actions
  const handleBulkAction = useCallback((action) => {
    if (selectedProjects.length === 0) return;
    
    switch(action) {
      case 'delete':
        if (window.confirm(`Delete ${selectedProjects.length} project(s)?`)) {
          // Implement bulk delete
        }
        break;
      case 'status':
        // Open status change dialog
        break;
      case 'export':
        handleExport(selectedProjects);
        break;
    }
    setSelectedProjects([]);
    setBulkActionMenu(null);
  }, [selectedProjects]);

  // Export projects
  const handleExport = useCallback((projectsToExport = paginatedProjects) => {
    const exportData = projectsToExport.map(project => ({
      Name: project.name,
      Description: project.description || '',
      Status: project.status,
      Priority: project.priority || '',
      Leader: project.projectLeader?.name || '',
      Members: project.projectMembers?.map(m => m.name).join(', ') || '',
      StartDate: project.startDate ? format(new Date(project.startDate), 'yyyy-MM-dd') : '',
      EndDate: project.endDate ? format(new Date(project.endDate), 'yyyy-MM-dd') : '',
      ...(isCEO && {
        Budget: project.budget || 0,
        ActualCost: project.actualCost || 0,
        Revenue: project.revenue || 0,
        Currency: project.currency || 'USD'
      })
    }));
    
    // Convert to CSV
    const headers = Object.keys(exportData[0] || {});
    const csv = [
      headers.join(','),
      ...exportData.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `projects_export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    setExportDialog(false);
  }, [paginatedProjects, isCEO]);

  // Analytics data
  const analyticsData = useMemo(() => {
    if (!allProjects || allProjects.length === 0) return null;
    
    // Status distribution
    const statusData = {
      labels: ['Pending', 'In Progress', 'Completed', 'On Hold'],
      datasets: [{
        data: [projectStats.pending, projectStats.inProgress, projectStats.completed, projectStats.onHold],
        backgroundColor: ['#ff9800', '#2196f3', '#4caf50', '#f44336']
      }]
    };
    
    // Priority distribution
    const priorityData = {
      labels: ['Low', 'Medium', 'High', 'Critical'],
      datasets: [{
        data: [projectStats.low, projectStats.medium, projectStats.high, projectStats.critical],
        backgroundColor: ['#8bc34a', '#2196f3', '#ff9800', '#f44336']
      }]
    };
    
    // Revenue/Cost chart (CEO only)
    const financialData = isCEO ? {
      labels: ['Budget', 'Actual Cost', 'Revenue'],
      datasets: [{
        label: 'Amount',
        data: [projectStats.totalBudget, projectStats.totalCost, projectStats.totalRevenue],
        backgroundColor: ['#2196f3', '#ff9800', '#4caf50']
      }]
    } : null;
    
    return { statusData, priorityData, financialData };
  }, [allProjects, projectStats, isCEO]);

  return (
    <Box sx={{ width: '100%', minWidth: 0 }}>
      <Container maxWidth="xl" sx={{ 
          py: 4,
          px: { xs: 2, sm: 3 },
          maxWidth: { 
            xs: '100%', 
            sm: '100%', 
            md: 'calc(100% - 32px)', 
            lg: 'calc(100% - 32px)' 
          }
        }}>
          {/* Header Section */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ 
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: 2,
              mb: 3
            }}>
              <Box>
                <Typography variant="h4" sx={{ 
                  fontWeight: 700,
                  color: 'text.primary',
                  mb: 0.5
                }}>
                  Projects Dashboard
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Manage and track all your projects
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  startIcon={<FiBarChart2 />}
                  onClick={() => setShowAnalytics(!showAnalytics)}
                  sx={{ textTransform: 'none' }}
                >
                  Analytics
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<FiDownload />}
                  onClick={() => setExportDialog(true)}
                  sx={{ textTransform: 'none' }}
                >
                  Export
                </Button>
                {canCreateProject && (
                  <Button
                    variant="contained"
                    startIcon={<FiPlus />}
                    onClick={() => navigate('/add-project')}
                    sx={{
                      background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                      textTransform: 'none',
                      fontWeight: 600
                    }}
                  >
                    Add New Project
                  </Button>
                )}
              </Box>
            </Box>

            {/* Search and Filters Section */}
            <Paper sx={{ p: 2, mb: 3 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Main Search Bar */}
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                  <TextField
                    size="small"
                    label="Search projects"
                    variant="outlined"
                    placeholder="Search by name, description, or leader..."
                    sx={{ flex: 1, minWidth: 200 }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <FiSearch style={{ color: '#666' }} />
                        </InputAdornment>
                      ),
                      endAdornment: searchTerm && (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setSearchTerm('')} size="small">
                            <FiX />
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                  />
                  
                  <Button
                    variant="outlined"
                    startIcon={<FiFilter />}
                    onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                    sx={{ textTransform: 'none' }}
                  >
                    Advanced Filters
                  </Button>
                  
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Sort By</InputLabel>
                    <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} label="Sort By">
                      <MenuItem value="date-desc">Newest First</MenuItem>
                      <MenuItem value="date-asc">Oldest First</MenuItem>
                      <MenuItem value="name-asc">Name A-Z</MenuItem>
                      <MenuItem value="name-desc">Name Z-A</MenuItem>
                      <MenuItem value="priority">Priority</MenuItem>
                      <MenuItem value="status">Status</MenuItem>
                    </Select>
                  </FormControl>
                  
                  <ToggleButtonGroup
                    value={viewMode}
                    exclusive
                    onChange={(e, newMode) => newMode && setViewMode(newMode)}
                    size="small"
                  >
                    <ToggleButton value="grid">
                      <FiGrid />
                    </ToggleButton>
                    <ToggleButton value="list">
                      <FiList />
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                {/* Quick Filters */}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Status</InputLabel>
                    <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} label="Status">
                      <MenuItem value="all">All Status</MenuItem>
                      <MenuItem value="pending">Pending</MenuItem>
                      <MenuItem value="in-progress">In Progress</MenuItem>
                      <MenuItem value="completed">Completed</MenuItem>
                      <MenuItem value="on-hold">On Hold</MenuItem>
                    </Select>
                  </FormControl>
                  
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Priority</InputLabel>
                    <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} label="Priority">
                      <MenuItem value="all">All Priority</MenuItem>
                      <MenuItem value="low">Low</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="high">High</MenuItem>
                      <MenuItem value="critical">Critical</MenuItem>
                    </Select>
                  </FormControl>
                  
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Project Leader</InputLabel>
                    <Select value={leaderFilter} onChange={(e) => setLeaderFilter(e.target.value)} label="Project Leader">
                      <MenuItem value="all">All Leaders</MenuItem>
                      {projectLeaders.map(leader => (
                        <MenuItem key={leader._id} value={leader._id}>
                          {leader.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  
                  {(debouncedSearchTerm || statusFilter !== 'all' || priorityFilter !== 'all' || leaderFilter !== 'all' || dateRangeFilter.start || dateRangeFilter.end) && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        setSearchTerm('');
                        setStatusFilter('all');
                        setPriorityFilter('all');
                        setLeaderFilter('all');
                        setDateRangeFilter({ start: '', end: '' });
                        setCategoryFilter('all');
                      }}
                      sx={{ textTransform: 'none' }}
                    >
                      Clear All
                    </Button>
                  )}
                </Box>

                {/* Advanced Search */}
                {showAdvancedSearch && (
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', pt: 2, borderTop: 1, borderColor: 'divider' }}>
                    <TextField
                      size="small"
                      label="Start Date From"
                      type="date"
                      value={dateRangeFilter.start}
                      onChange={(e) => setDateRangeFilter({ ...dateRangeFilter, start: e.target.value })}
                      InputLabelProps={{ shrink: true }}
                      sx={{ minWidth: 150 }}
                    />
                    <TextField
                      size="small"
                      label="End Date To"
                      type="date"
                      value={dateRangeFilter.end}
                      onChange={(e) => setDateRangeFilter({ ...dateRangeFilter, end: e.target.value })}
                      InputLabelProps={{ shrink: true }}
                      sx={{ minWidth: 150 }}
                    />
                    {categories.length > 0 && (
                      <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>Category</InputLabel>
                        <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} label="Category">
                          <MenuItem value="all">All Categories</MenuItem>
                          {categories.map(cat => (
                            <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  </Box>
                )}
              </Box>
            </Paper>
          </Box>

          {/* Statistics Cards */}
          {!loading && !error && (
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  borderRadius: 2,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                  transition: 'transform 0.2s ease-in-out',
                  '&:hover': { transform: 'translateY(-4px)' }
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                          {projectStats.total}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                          Total Projects
                        </Typography>
                      </Box>
                      <Box sx={{ 
                        backgroundColor: 'rgba(255,255,255,0.2)', 
                        borderRadius: '50%', 
                        p: 1.5
                      }}>
                        <FiTrendingUp size={24} />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ 
                  background: 'linear-gradient(135deg, #2196f3 0%, #21cbf3 100%)',
                  color: 'white',
                  borderRadius: 2,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                  transition: 'transform 0.2s ease-in-out',
                  '&:hover': { transform: 'translateY(-4px)' }
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                          {projectStats.inProgress}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                          In Progress
                        </Typography>
                      </Box>
                      <Box sx={{ 
                        backgroundColor: 'rgba(255,255,255,0.2)', 
                        borderRadius: '50%', 
                        p: 1.5
                      }}>
                        <FiTrendingUp size={24} />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ 
                  background: 'linear-gradient(135deg, #4caf50 0%, #8bc34a 100%)',
                  color: 'white',
                  borderRadius: 2,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                  transition: 'transform 0.2s ease-in-out',
                  '&:hover': { transform: 'translateY(-4px)' }
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                          {projectStats.completed}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                          Completed
                        </Typography>
                      </Box>
                      <Box sx={{ 
                        backgroundColor: 'rgba(255,255,255,0.2)', 
                        borderRadius: '50%', 
                        p: 1.5
                      }}>
                        <FiCheckCircle size={24} />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ 
                  background: projectStats.overdue > 0 
                    ? 'linear-gradient(135deg, #f44336 0%, #ff7043 100%)'
                    : 'linear-gradient(135deg, #9e9e9e 0%, #bdbdbd 100%)',
                  color: 'white',
                  borderRadius: 2,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                  transition: 'transform 0.2s ease-in-out',
                  '&:hover': { transform: 'translateY(-4px)' }
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                          {projectStats.overdue}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                          Overdue
                        </Typography>
                      </Box>
                      <Box sx={{ 
                        backgroundColor: 'rgba(255,255,255,0.2)', 
                        borderRadius: '50%', 
                        p: 1.5
                      }}>
                        <FiAlertCircle size={24} />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* CEO Only: Financial Stats */}
              {isCEO && (
                <>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ 
                      background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
                      color: 'white',
                      borderRadius: 2,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                      transition: 'transform 0.2s ease-in-out',
                      '&:hover': { transform: 'translateY(-4px)' }
                    }}>
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box>
                            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
                              ${(projectStats.totalBudget / 1000).toFixed(1)}K
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                              Total Budget
                            </Typography>
                          </Box>
                          <Box sx={{ 
                            backgroundColor: 'rgba(255,255,255,0.2)', 
                            borderRadius: '50%', 
                            p: 1.5
                          }}>
                            <FiDollarSign size={24} />
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ 
                      background: 'linear-gradient(135deg, #4caf50 0%, #8bc34a 100%)',
                      color: 'white',
                      borderRadius: 2,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                      transition: 'transform 0.2s ease-in-out',
                      '&:hover': { transform: 'translateY(-4px)' }
                    }}>
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box>
                            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
                              ${(projectStats.totalRevenue / 1000).toFixed(1)}K
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                              Total Revenue
                            </Typography>
                          </Box>
                          <Box sx={{ 
                            backgroundColor: 'rgba(255,255,255,0.2)', 
                            borderRadius: '50%', 
                            p: 1.5
                          }}>
                            <FiDollarSign size={24} />
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ 
                      background: 'linear-gradient(135deg, #f44336 0%, #ff7043 100%)',
                      color: 'white',
                      borderRadius: 2,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                      transition: 'transform 0.2s ease-in-out',
                      '&:hover': { transform: 'translateY(-4px)' }
                    }}>
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box>
                            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
                              ${(projectStats.totalCost / 1000).toFixed(1)}K
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                              Total Cost
                            </Typography>
                          </Box>
                          <Box sx={{ 
                            backgroundColor: 'rgba(255,255,255,0.2)', 
                            borderRadius: '50%', 
                            p: 1.5
                          }}>
                            <FiDollarSign size={24} />
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ 
                      background: projectStats.totalRevenue > projectStats.totalCost
                        ? 'linear-gradient(135deg, #4caf50 0%, #8bc34a 100%)'
                        : 'linear-gradient(135deg, #f44336 0%, #ff7043 100%)',
                      color: 'white',
                      borderRadius: 2,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                      transition: 'transform 0.2s ease-in-out',
                      '&:hover': { transform: 'translateY(-4px)' }
                    }}>
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box>
                            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
                              ${((projectStats.totalRevenue - projectStats.totalCost) / 1000).toFixed(1)}K
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                              Net Profit
                            </Typography>
                          </Box>
                          <Box sx={{ 
                            backgroundColor: 'rgba(255,255,255,0.2)', 
                            borderRadius: '50%', 
                            p: 1.5
                          }}>
                            <FiTrendingUp size={24} />
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </>
              )}
            </Grid>
          )}

          {/* Analytics Dashboard */}
          {showAnalytics && analyticsData && (
            <Paper sx={{ p: 3, mb: 4 }}>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                Project Analytics
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" sx={{ mb: 2 }}>Status Distribution</Typography>
                  <Box sx={{ height: 300 }}>
                    <Doughnut data={analyticsData.statusData} />
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" sx={{ mb: 2 }}>Priority Distribution</Typography>
                  <Box sx={{ height: 300 }}>
                    <Doughnut data={analyticsData.priorityData} />
                  </Box>
                </Grid>
                {isCEO && analyticsData.financialData && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" sx={{ mb: 2 }}>Financial Overview</Typography>
                    <Box sx={{ height: 300 }}>
                      <Bar data={analyticsData.financialData} />
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Paper>
          )}

          {/* Bulk Actions Bar */}
          {selectedProjects.length > 0 && (
            <Paper sx={{ p: 2, mb: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography>
                  {selectedProjects.length} project(s) selected
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    color="inherit"
                    onClick={(e) => setBulkActionMenu(e.currentTarget)}
                    sx={{ textTransform: 'none' }}
                  >
                    Bulk Actions
                  </Button>
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={() => setSelectedProjects([])}
                    sx={{ textTransform: 'none' }}
                  >
                    Clear Selection
                  </Button>
                </Box>
              </Box>
            </Paper>
          )}

          {/* Projects Display */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress size={60} />
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>
          ) : (
            <>
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">
                  {viewMode === 'grid' ? 'Projects' : 'Project List'} ({sortedProjects.length})
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <FormControl size="small" sx={{ minWidth: 100 }}>
                    <Select value={itemsPerPage} onChange={(e) => { setItemsPerPage(e.target.value); setPage(1); }}>
                      <MenuItem value={12}>12 per page</MenuItem>
                      <MenuItem value={24}>24 per page</MenuItem>
                      <MenuItem value={48}>48 per page</MenuItem>
                      <MenuItem value={100}>100 per page</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Box>

              {viewMode === 'grid' ? (
                <Grid container spacing={3}>
                  {paginatedProjects.length > 0 ? (
                    paginatedProjects.map(project => (
                      <Grid item xs={12} sm={6} lg={4} key={project._id}>
                        <ProjectCard 
                          project={project} 
                          isOverdue={isOverdue(project)}
                          progress={getProjectProgress(project)}
                          isCEO={isCEO}
                          selected={selectedProjects.includes(project._id)}
                          onSelect={(selected) => {
                            if (selected) {
                              setSelectedProjects([...selectedProjects, project._id]);
                            } else {
                              setSelectedProjects(selectedProjects.filter(id => id !== project._id));
                            }
                          }}
                        />
                      </Grid>
                    ))
                  ) : (
                    <Grid item xs={12}>
                      <Paper sx={{ p: 4, textAlign: 'center' }}>
                        <Typography variant="h6" sx={{ mb: 1 }}>
                          No projects found
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Try adjusting your filters or create a new project.
                        </Typography>
                      </Paper>
                    </Grid>
                  )}
                </Grid>
              ) : (
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedProjects.length === paginatedProjects.length && paginatedProjects.length > 0}
                            indeterminate={selectedProjects.length > 0 && selectedProjects.length < paginatedProjects.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProjects(paginatedProjects.map(p => p._id));
                              } else {
                                setSelectedProjects([]);
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>Project Name</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Priority</TableCell>
                        <TableCell>Leader</TableCell>
                        <TableCell>Progress</TableCell>
                        <TableCell>Due Date</TableCell>
                        {isCEO && <TableCell>Budget</TableCell>}
                        {isCEO && <TableCell>Revenue</TableCell>}
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedProjects.map(project => (
                        <TableRow key={project._id} hover>
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selectedProjects.includes(project._id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedProjects([...selectedProjects, project._id]);
                                } else {
                                  setSelectedProjects(selectedProjects.filter(id => id !== project._id));
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="subtitle2">{project.name}</Typography>
                              {project.description && (
                                <Typography variant="caption" color="text.secondary">
                                  {project.description.substring(0, 50)}...
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={project.status}
                              size="small"
                              color={
                                project.status === 'completed' ? 'success' :
                                project.status === 'in-progress' ? 'primary' :
                                project.status === 'on-hold' ? 'warning' : 'default'
                              }
                            />
                          </TableCell>
                          <TableCell>
                            {project.priority && (
                              <Chip
                                label={project.priority}
                                size="small"
                                sx={{
                                  bgcolor: 
                                    project.priority === 'critical' ? '#ffebee' :
                                    project.priority === 'high' ? '#fff3e0' :
                                    project.priority === 'medium' ? '#e3f2fd' : '#f1f8e9',
                                  color:
                                    project.priority === 'critical' ? '#c62828' :
                                    project.priority === 'high' ? '#e65100' :
                                    project.priority === 'medium' ? '#1565c0' : '#33691e'
                                }}
                              />
                            )}
                          </TableCell>
                          <TableCell>{project.projectLeader?.name || 'N/A'}</TableCell>
                          <TableCell>
                            <Box sx={{ width: 100 }}>
                              <LinearProgress 
                                variant="determinate" 
                                value={getProjectProgress(project)} 
                                sx={{ height: 8, borderRadius: 1 }}
                              />
                              <Typography variant="caption">{getProjectProgress(project)}%</Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            {project.endDate ? (
                              <Box>
                                <Typography variant="body2">
                                  {format(new Date(project.endDate), 'MMM dd, yyyy')}
                                </Typography>
                                {isOverdue(project) && (
                                  <Chip label="Overdue" size="small" color="error" sx={{ mt: 0.5 }} />
                                )}
                              </Box>
                            ) : 'N/A'}
                          </TableCell>
                          {isCEO && (
                            <TableCell>
                              {project.budget ? `$${(project.budget / 1000).toFixed(1)}K` : 'N/A'}
                            </TableCell>
                          )}
                          {isCEO && (
                            <TableCell>
                              {project.revenue ? `$${(project.revenue / 1000).toFixed(1)}K` : 'N/A'}
                            </TableCell>
                          )}
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                setQuickActionProject(project);
                                setQuickActionMenu(e.currentTarget);
                              }}
                            >
                              <FiMoreVertical />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={(e, value) => setPage(value)}
                    color="primary"
                    size="large"
                  />
                </Box>
              )}
            </>
          )}
        </Container>

      {/* Bulk Actions Menu */}
      <Menu
        anchorEl={bulkActionMenu}
        open={Boolean(bulkActionMenu)}
        onClose={() => setBulkActionMenu(null)}
      >
        <MenuItem onClick={() => handleBulkAction('status')}>
          <ListItemIcon><FiEdit /></ListItemIcon>
          <ListItemText>Change Status</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleBulkAction('export')}>
          <ListItemIcon><FiDownload /></ListItemIcon>
          <ListItemText>Export Selected</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleBulkAction('delete')}>
          <ListItemIcon><FiTrash2 /></ListItemIcon>
          <ListItemText>Delete Selected</ListItemText>
        </MenuItem>
      </Menu>

      {/* Quick Actions Menu */}
      <Menu
        anchorEl={quickActionMenu}
        open={Boolean(quickActionMenu)}
        onClose={() => setQuickActionMenu(null)}
      >
        <MenuItem onClick={() => {
          navigate(`/projects/${quickActionProject?._id}`);
          setQuickActionMenu(null);
        }}>
          <ListItemIcon><FiFileText /></ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          navigate(`/projects/${quickActionProject?._id}`);
          setQuickActionMenu(null);
        }}>
          <ListItemIcon><FiEdit /></ListItemIcon>
          <ListItemText>Edit Project</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          handleExport([quickActionProject]);
          setQuickActionMenu(null);
        }}>
          <ListItemIcon><FiDownload /></ListItemIcon>
          <ListItemText>Export</ListItemText>
        </MenuItem>
      </Menu>

      {/* Export Dialog */}
      <Dialog open={exportDialog} onClose={() => setExportDialog(false)}>
        <DialogTitle>Export Projects</DialogTitle>
        <DialogContent>
          <Typography>Export {paginatedProjects.length} projects to CSV?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialog(false)}>Cancel</Button>
          <Button onClick={() => handleExport()} variant="contained">Export</Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button */}
      {canCreateProject && (
        <Fab
          color="primary"
          aria-label="add project"
          onClick={() => navigate('/add-project')}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            display: { xs: 'flex', sm: 'none' },
            zIndex: 1000
          }}
        >
          <FiPlus size={24} />
        </Fab>
      )}
    </Box>
  );
};

export default ProjectsPageEnhanced;

