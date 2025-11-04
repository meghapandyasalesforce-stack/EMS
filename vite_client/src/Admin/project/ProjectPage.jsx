import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import ProjectCard from './ProjectCard';
import useGetAllProjects from '../../Hooks/useGetAllProjects';
import { 
  TextField, 
  InputAdornment, 
  IconButton, 
  Container, 
  Typography, 
  Grid, 
  Box, 
  CircularProgress, 
  Alert,
  Button,
  Fab,
  Card,
  CardContent,
  Chip,
  Paper,
  Divider
} from '@mui/material';
import { FiSearch, FiX, FiPlus, FiTrendingUp, FiClock, FiCheckCircle, FiPause, FiAlertCircle } from 'react-icons/fi';

const ProjectsPage = () => {
  useGetAllProjects();
  const navigate = useNavigate();
  const { allProjects, loading, error } = useSelector(store => store.project);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => {
      clearTimeout(timerId);
    };
  }, [searchTerm]);

  const filteredProjects = allProjects?.filter(project => {
    if (!debouncedSearchTerm) return true;
    return (
      project.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (project.description && project.description.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
    );
  });

  // Calculate project statistics
  const getProjectStats = () => {
    if (!allProjects) return { total: 0, pending: 0, inProgress: 0, completed: 0, onHold: 0 };
    
    const stats = allProjects.reduce((acc, project) => {
      acc.total++;
      switch (project.status) {
        case 'pending':
          acc.pending++;
          break;
        case 'in-progress':
          acc.inProgress++;
          break;
        case 'completed':
          acc.completed++;
          break;
        case 'on-hold':
          acc.onHold++;
          break;
        default:
          acc.pending++;
      }
      return acc;
    }, { total: 0, pending: 0, inProgress: 0, completed: 0, onHold: 0 });
    
    return stats;
  };

  const projectStats = getProjectStats();

  // Get status color and icon
  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return { color: '#ff9800', icon: <FiClock />, label: 'Pending' };
      case 'in-progress':
        return { color: '#2196f3', icon: <FiTrendingUp />, label: 'In Progress' };
      case 'completed':
        return { color: '#4caf50', icon: <FiCheckCircle />, label: 'Completed' };
      case 'on-hold':
        return { color: '#f44336', icon: <FiPause />, label: 'On Hold' };
      default:
        return { color: '#9e9e9e', icon: <FiAlertCircle />, label: 'Unknown' };
    }
  };

  return (
    <Box sx={{
      // Adjust margin left based on sidebar state (assuming you have a state for this)
      // For mobile, we don't need margin left as sidebar becomes top navbar
      ml: { 
        xs: '0px', // Mobile - no margin
        md: '80px' // Default minimized sidebar width
      },
      transition: 'margin-left 0.3s ease',
      width: { 
        xs: '100%', // Full width on mobile
        md: 'calc(100% - 80px)' // Account for minimized sidebar
      }
    }}>
      {/* This class would be toggled based on sidebar state */}
      <Box className="sidebar-expanded" sx={{
        ml: { md: '256px' }, // Expanded sidebar width
        width: { md: 'calc(100% - 256px)' } // Account for expanded sidebar
      }}>
        <Container maxWidth="lg" sx={{ 
          py: 4,
          px: { xs: 2, sm: 3 },
          // Reset container width to account for sidebar
          maxWidth: { 
            xs: '100%', 
            sm: '100%', 
            md: 'calc(100% - 32px)', 
            lg: 'calc(100% - 32px)' 
          }
        }}>
          {/* Header, Search and Add Button */}
          <Box sx={{ 
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: 2,
            mb: 4
          }}>
            <Typography variant="h4" sx={{ 
              fontWeight: 700,
              color: 'text.primary'
            }}>
              Projects
            </Typography>

            <Box sx={{ 
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'center' },
              gap: 2,
              width: { xs: '100%', sm: 'auto' }
            }}>
              <TextField
                size="small"
                label="Search projects"
                variant="outlined"
                sx={{ 
                  width: { xs: '100%', sm: 300 },
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 1,
                  }
                }}
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
                      <IconButton 
                        onClick={() => setSearchTerm('')}
                        size="small"
                        sx={{ p: 0.5 }}
                      >
                        <FiX />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
              
              <Button
                variant="contained"
                startIcon={<FiPlus />}
                onClick={() => navigate('/add-project')}
                sx={{
                  backgroundColor: '#1976d2',
                  color: 'white',
                  fontWeight: 600,
                  px: 3,
                  py: 1,
                  borderRadius: 1,
                  textTransform: 'none',
                  fontSize: '0.875rem',
                  '&:hover': {
                    backgroundColor: '#1565c0',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                  },
                  transition: 'all 0.2s ease-in-out',
                  minWidth: { xs: '100%', sm: 'auto' }
                }}
              >
                Add Project
              </Button>
            </Box>
          </Box>

          {/* Project Statistics Dashboard */}
          {!loading && !error && (
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {/* Total Projects Card */}
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
                        p: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <FiTrendingUp size={24} />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* In Progress Card */}
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
                        p: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <FiTrendingUp size={24} />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Completed Card */}
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
                        p: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <FiCheckCircle size={24} />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* On Hold Card */}
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
                        <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                          {projectStats.onHold}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                          On Hold
                        </Typography>
                      </Box>
                      <Box sx={{ 
                        backgroundColor: 'rgba(255,255,255,0.2)', 
                        borderRadius: '50%', 
                        p: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <FiPause size={24} />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* Status Overview Section */}
          {!loading && !error && projectStats.total > 0 && (
            <Paper sx={{ 
              p: 3, 
              mb: 4, 
              borderRadius: 2,
              background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}>
                Project Status Overview
              </Typography>
              <Grid container spacing={2}>
                {[
                  { status: 'pending', count: projectStats.pending, label: 'Pending' },
                  { status: 'in-progress', count: projectStats.inProgress, label: 'In Progress' },
                  { status: 'completed', count: projectStats.completed, label: 'Completed' },
                  { status: 'on-hold', count: projectStats.onHold, label: 'On Hold' }
                ].map(({ status, count, label }) => {
                  const statusInfo = getStatusInfo(status);
                  const percentage = projectStats.total > 0 ? Math.round((count / projectStats.total) * 100) : 0;
                  
                  return (
                    <Grid item xs={12} sm={6} md={3} key={status}>
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        p: 2,
                        backgroundColor: 'white',
                        borderRadius: 2,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        transition: 'transform 0.2s ease-in-out',
                        '&:hover': { transform: 'translateY(-2px)' }
                      }}>
                        <Box sx={{ 
                          backgroundColor: statusInfo.color + '20', 
                          borderRadius: '50%', 
                          p: 1.5,
                          mr: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Box sx={{ color: statusInfo.color }}>
                            {statusInfo.icon}
                          </Box>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                            {count}
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {label}
                          </Typography>
                          <Typography variant="caption" sx={{ color: statusInfo.color, fontWeight: 500 }}>
                            {percentage}% of total
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </Paper>
          )}

          {/* Loading State */}
          {loading && (
            <Box sx={{ 
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 200
            }}>
              <CircularProgress size={60} />
            </Box>
          )}

          {/* Error State */}
          {error && (
            <Alert severity="error" sx={{ mb: 4 }}>
              {error}
            </Alert>
          )}

          {/* Projects Grid */}
          {!loading && !error && (
            <Box>
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                mb: 3 
              }}>
                <Typography variant="h5" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  All Projects ({filteredProjects?.length || 0})
                </Typography>
                {debouncedSearchTerm && (
                  <Chip 
                    label={`${filteredProjects?.length || 0} results`}
                    color="primary"
                    variant="outlined"
                    size="small"
                  />
                )}
              </Box>
              
              <Grid container spacing={3}>
                {filteredProjects?.length > 0 ? (
                  filteredProjects.map(project => (
                    <Grid item xs={12} sm={6} lg={4} key={project._id}>
                      <ProjectCard project={project} />
                    </Grid>
                  ))
                ) : (
                  <Grid item xs={12}>
                    <Paper sx={{ 
                      p: 4, 
                      textAlign: 'center',
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                    }}>
                      <Box sx={{ 
                        fontSize: 64, 
                        color: 'text.secondary', 
                        mb: 2,
                        opacity: 0.5
                      }}>
                        📋
                      </Box>
                      <Typography variant="h6" sx={{ mb: 1, color: 'text.primary' }}>
                        {debouncedSearchTerm ? 'No projects match your search' : 'No projects found'}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                        {debouncedSearchTerm 
                          ? 'Try adjusting your search terms or clear the search to see all projects.'
                          : 'Get started by creating your first project.'
                        }
                      </Typography>
                      {!debouncedSearchTerm && (
                        <Button
                          variant="contained"
                          startIcon={<FiPlus />}
                          onClick={() => navigate('/add-project')}
                          sx={{
                            backgroundColor: '#1976d2',
                            '&:hover': { backgroundColor: '#1565c0' },
                            px: 3,
                            py: 1.5,
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: 600
                          }}
                        >
                          Create Your First Project
                        </Button>
                      )}
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </Container>
      </Box>

      {/* Floating Action Button for Mobile */}
      <Fab
        color="primary"
        aria-label="add project"
        onClick={() => navigate('/add-project')}
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          display: { xs: 'flex', sm: 'none' },
          backgroundColor: '#1976d2',
          '&:hover': {
            backgroundColor: '#1565c0',
            transform: 'scale(1.1)',
          },
          transition: 'all 0.2s ease-in-out',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}
      >
        <FiPlus size={24} />
      </Fab>
    </Box>
  );
};

export default ProjectsPage;