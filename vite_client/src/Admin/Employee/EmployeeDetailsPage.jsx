import React, { useEffect, useState, useCallback } from 'react';
import { 
  Box, Button, Alert, Typography, Chip, Avatar,
  CircularProgress, Card, CardContent, Grid,
  Tooltip, IconButton, Snackbar,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem,
  TableContainer, Table, TableBody, TableRow, TableCell, TableHead,
  Paper, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTheme } from '@mui/material/styles';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useSelector, useDispatch } from 'react-redux';
import { 
  fetchEmployeeDetails, 
  updateEmployeeStatus,
  updateEmployeeWorkInfo,
  clearEmployeeDetails,
} from '../../context/employeeDetailsSlice';
import { deleteEmployee } from '../../context/employeeSlice';
import { BOTH_DOCUMENT_ENDPOINT } from '../../utils/constant';
import { 
  FiUser, 
  FiMail, 
  FiPhone, 
  FiMapPin, 
  FiCalendar, 
  FiDollarSign, 
  FiBriefcase, 
  FiAward, 
  FiFileText, 
  FiDownload, 
  FiEye, 
  FiEdit, 
  FiTrash2,
  FiClock,
  FiTrendingUp,
  FiShield,
  FiHeart,
  FiUsers,
  FiStar,
  FiActivity
} from 'react-icons/fi';

const EmployeeDetailsPage = () => {
  const theme = useTheme();
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openEditWorkDialog, setOpenEditWorkDialog] = useState(false);
  const [openEditPerformanceDialog, setOpenEditPerformanceDialog] = useState(false);
  const [editWorkForm, setEditWorkForm] = useState({
    jobTitle: '',
    department: '',
    position: '',
    manager: '',
    salary: '',
    joiningDate: ''
  });
  const [editPerformanceForm, setEditPerformanceForm] = useState({
    performanceScore: ''
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // Check if mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  
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
    workInfoError
  } = useSelector((state) => state.employeeDetails);

  useEffect(() => {
    dispatch(fetchEmployeeDetails(employeeId));
    
    return () => {
      dispatch(clearEmployeeDetails());
    };
  }, [dispatch, employeeId]);

  const handleStatusChangeClick = () => {
    setOpenDialog(true);
  };

  const handleDownloadDocument = async (documentId, fileName) => {
    try {
      const downloadUrl = `${BOTH_DOCUMENT_ENDPOINT}/${employeeId}/documents/${documentId}/download`;
      const response = await fetch(downloadUrl, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to download document');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName || 'document');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Failed to download document. Please try again.');
    }
  };

  const handleConfirmStatusChange = () => {
    dispatch(updateEmployeeStatus({
      employeeId: employee._id,
      active: !employee.active
    }));
    setOpenDialog(false);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleDeleteClick = () => {
    setOpenDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    dispatch(deleteEmployee(employeeId))
      .unwrap()
      .then(() => {
        navigate('/employees');
      })
      .catch((error) => {
        console.error('Error deleting employee:', error);
      });
    setOpenDeleteDialog(false);
  };

  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
  };

  const handleEditWorkClick = () => {
    setEditWorkForm({
      jobTitle: employee.jobTitle || '',
      department: employee.department || '',
      position: employee.position || '',
      manager: employee.manager || '',
      salary: employee.salary || '',
      joiningDate: employee.joiningDate ? new Date(employee.joiningDate).toISOString().split('T')[0] : ''
    });
    setOpenEditWorkDialog(true);
  };

  const handleEditWorkFormChange = (field) => (event) => {
    setEditWorkForm({
      ...editWorkForm,
      [field]: event.target.value
    });
  };

  const handleSaveWorkInfo = async () => {
    try {
      const updateData = {
        jobTitle: editWorkForm.jobTitle,
        department: editWorkForm.department,
        position: editWorkForm.position,
        manager: editWorkForm.manager,
        salary: parseFloat(editWorkForm.salary) || 0,
        joiningDate: editWorkForm.joiningDate ? new Date(editWorkForm.joiningDate).toISOString() : null
      };

      const resultAction = await dispatch(updateEmployeeWorkInfo({
        employeeId,
        workData: updateData
      }));

      if (updateEmployeeWorkInfo.fulfilled.match(resultAction)) {
        setSnackbar({
          open: true,
          message: 'Work information updated successfully!',
          severity: 'success'
        });
        setOpenEditWorkDialog(false);
      } else {
        throw new Error(resultAction.payload || 'Failed to update work information');
      }
      
    } catch (error) {
      console.error('Error updating work information:', error);
      setSnackbar({
        open: true,
        message: error.message || 'Failed to update work information. Please try again.',
        severity: 'error'
      });
    }
  };

  const handleCloseEditWorkDialog = () => {
    setOpenEditWorkDialog(false);
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Calculate years of experience from joining date
  const calculateYearsOfExperience = () => {
    if (!employee?.joiningDate) return '0';
    
    const joiningDate = new Date(employee.joiningDate);
    const currentDate = new Date();
    const diffTime = Math.abs(currentDate - joiningDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    
    return years.toString();
  };

  // Calculate attendance rate from employee data
  const calculateAttendanceRate = () => {
    if (employee?.attendanceRate !== null && employee?.attendanceRate !== undefined) {
      return employee.attendanceRate;
    }
    return 'N/A';
  };

  // Fetch employee statistics
  const fetchEmployeeStats = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/v1/admin/employee/${employeeId}/stats`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        // The stats are already updated in the employee object via the API
        console.log('Employee stats updated:', data.stats);
      }
    } catch (error) {
      console.error('Error fetching employee stats:', error);
    }
  }, [employeeId]);

  // Fetch stats when component mounts
  useEffect(() => {
    if (employee) {
      fetchEmployeeStats();
    }
  }, [employee, fetchEmployeeStats]);

  // Handle performance score edit
  const handleEditPerformanceClick = () => {
    setEditPerformanceForm({
      performanceScore: employee.performanceScore || ''
    });
    setOpenEditPerformanceDialog(true);
  };

  const handlePerformanceFormChange = (field) => (event) => {
    setEditPerformanceForm({
      ...editPerformanceForm,
      [field]: event.target.value
    });
  };

  const handleSavePerformanceScore = async () => {
    try {
      const updateData = {
        performanceScore: parseFloat(editPerformanceForm.performanceScore) || 0
      };

      const resultAction = await dispatch(updateEmployeeWorkInfo({
        employeeId,
        workData: updateData
      }));

      if (updateEmployeeWorkInfo.fulfilled.match(resultAction)) {
        setSnackbar({
          open: true,
          message: 'Performance score updated successfully!',
          severity: 'success'
        });
        setOpenEditPerformanceDialog(false);
      } else {
        throw new Error(resultAction.payload || 'Failed to update performance score');
      }
      
    } catch (error) {
      console.error('Error updating performance score:', error);
      setSnackbar({
        open: true,
        message: error.message || 'Failed to update performance score. Please try again.',
        severity: 'error'
      });
    }
  };

  const handleCloseEditPerformanceDialog = () => {
    setOpenEditPerformanceDialog(false);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Alert severity="error">
          {error}
          <Button onClick={() => navigate(-1)} sx={{ ml: 2 }}>Go Back</Button>
        </Alert>
      </Box>
    );
  }

  if (!employee) {
    return (
      <Box p={2}>
        <Alert severity="warning">
          Employee not found
          <Button onClick={() => navigate(-1)} sx={{ ml: 2 }}>Go Back</Button>
        </Alert>
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        p: 3,
        marginLeft: { 
          xs: 0, // Mobile - no margin since sidebar becomes navbar
          sm: '20px', // Minimized sidebar (w-20)
          md: '256px' // Expanded sidebar (w-64)
        },
        transition: theme.transitions.create('margin', {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.leavingScreen,
        }),
        width: {
          xs: '100%', // Mobile - full width
          sm: 'calc(100% - 20px)', // Account for minimized sidebar
          md: 'calc(100% - 256px)' // Account for expanded sidebar
        }
      }}
    >
      <Button 
        variant="outlined" 
        onClick={() => navigate(-1)}
        sx={{ mb: 2 }}
      >
        Back to Employees
      </Button>

      {statusUpdateError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {statusUpdateError}
        </Alert>
      )}

      {workInfoError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {workInfoError}
        </Alert>
      )}

      {/* Enhanced Header Section */}
      <Card sx={{ mb: 4, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between', 
            alignItems: isMobile ? 'flex-start' : 'center', 
            gap: 3
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Avatar 
                sx={{ 
                  width: 80, 
                  height: 80, 
                  bgcolor: 'rgba(255,255,255,0.2)',
                  fontSize: '2rem',
                  fontWeight: 'bold'
                }}
              >
                {employee.name?.charAt(0)}{employee.lastName?.charAt(0)}
              </Avatar>
              <Box>
                <Typography variant={isMobile ? 'h5' : 'h4'} sx={{ fontWeight: 'bold', mb: 1 }}>
                  {employee.name} {employee.lastName}
                </Typography>
                <Typography variant="h6" sx={{ opacity: 0.9, mb: 1 }}>
                  {employee.jobTitle} • {employee.department}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Chip 
                    label={employee.active ? 'Active' : 'Inactive'} 
                    color={employee.active ? 'success' : 'error'}
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                  />
                  <Chip 
                    label={employee.position || 'Employee'} 
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                  />
                  <Chip 
                    label={`ID: ${employee.employeeId || 'N/A'}`} 
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                  />
                </Box>
              </Box>
            </Box>
            
            <Box sx={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: 2,
              width: isMobile ? '100%' : 'auto'
            }}>
              <Button
                variant="contained"
                color={employee.active ? 'success' : 'error'}
                onClick={handleStatusChangeClick}
                disabled={updatingStatus}
                fullWidth={isMobile}
                size={isMobile ? 'medium' : 'small'}
                startIcon={<FiActivity />}
                sx={{ 
                  bgcolor: employee.active ? 'rgba(76, 175, 80, 0.9)' : 'rgba(244, 67, 54, 0.9)',
                  '&:hover': {
                    bgcolor: employee.active ? 'rgba(76, 175, 80, 1)' : 'rgba(244, 67, 54, 1)'
                  }
                }}
              >
                {employee.active ? 'DEACTIVATE' : 'ACTIVATE'}
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleDeleteClick}
                fullWidth={isMobile}
                size={isMobile ? 'medium' : 'small'}
                startIcon={<FiTrash2 />}
                sx={{ 
                  bgcolor: 'rgba(244, 67, 54, 0.9)',
                  '&:hover': {
                    bgcolor: 'rgba(244, 67, 54, 1)'
                  }
                }}
              >
                Delete
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Status Change Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        fullScreen={isMobile}
      >
        <DialogTitle id="alert-dialog-title">
          Confirm Status Change
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to change the status of {employee.name} {employee.lastName} from {employee.active ? 'Active' : 'Inactive'} to {employee.active ? 'Inactive' : 'Active'}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="primary">
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmStatusChange} 
            color={employee.active ? 'error' : 'success'} 
            autoFocus
            disabled={updatingStatus}
          >
            {updatingStatus ? 'Updating...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={openDeleteDialog}
        onClose={handleCloseDeleteDialog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        fullScreen={isMobile}
      >
        <DialogTitle id="alert-dialog-title">
          Confirm Employee Deletion
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to permanently delete {employee.name} {employee.lastName}? 
            This action cannot be undone and will also delete all associated records (payroll, documents, etc.).
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} color="primary">
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmDelete} 
            color="error" 
            autoFocus
            disabled={updatingStatus}
          >
            {updatingStatus ? 'Deleting...' : 'Confirm Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Enhanced Main Content Grid */}
      <Grid container spacing={3}>
        {/* Personal Information */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <FiUser style={{ marginRight: '8px', fontSize: '20px', color: '#667eea' }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Personal Information</Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', width: '40%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FiMail size={16} />
                          Work Email
                        </Box>
                      </TableCell>
                      <TableCell>{employee.email || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FiMail size={16} />
                          Personal Email
                        </Box>
                      </TableCell>
                      <TableCell>{employee.personalEmail || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FiPhone size={16} />
                          Primary Phone
                        </Box>
                      </TableCell>
                      <TableCell>{employee.phone1 || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FiPhone size={16} />
                          Secondary Phone
                        </Box>
                      </TableCell>
                      <TableCell>{employee.phone2 || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FiMapPin size={16} />
                          Address
                        </Box>
                      </TableCell>
                      <TableCell>{employee.address || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FiCalendar size={16} />
                          Date of Birth
                        </Box>
                      </TableCell>
                      <TableCell>{employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString() : 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FiUser size={16} />
                          Gender
                        </Box>
                      </TableCell>
                      <TableCell>{employee.gender || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FiShield size={16} />
                          National ID
                        </Box>
                      </TableCell>
                      <TableCell>{employee.nationalId || 'N/A'}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Work Information */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <FiBriefcase style={{ marginRight: '8px', fontSize: '20px', color: '#667eea' }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Work Information</Typography>
                </Box>
                <Tooltip title="Edit Work Information">
                  <IconButton 
                    onClick={handleEditWorkClick}
                    color="primary"
                    size="small"
                    sx={{ 
                      bgcolor: 'primary.50',
                      '&:hover': { bgcolor: 'primary.100' }
                    }}
                  >
                    <FiEdit size={16} />
                  </IconButton>
                </Tooltip>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', width: '40%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FiBriefcase size={16} />
                          Job Title
                        </Box>
                      </TableCell>
                      <TableCell>{employee.jobTitle || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FiUsers size={16} />
                          Department
                        </Box>
                      </TableCell>
                      <TableCell>{employee.department || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FiAward size={16} />
                          Position
                        </Box>
                      </TableCell>
                      <TableCell>{employee.position || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FiUsers size={16} />
                          Manager
                        </Box>
                      </TableCell>
                      <TableCell>{employee.manager || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FiDollarSign size={16} />
                          Salary
                        </Box>
                      </TableCell>
                      <TableCell>${employee.salary?.toLocaleString() || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FiCalendar size={16} />
                          Joining Date
                        </Box>
                      </TableCell>
                      <TableCell>{employee.joiningDate ? new Date(employee.joiningDate).toLocaleDateString() : 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FiCalendar size={16} />
                          Created At
                        </Box>
                      </TableCell>
                      <TableCell>{new Date(employee.createdAt).toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FiActivity size={16} />
                          Status
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={employee.active ? 'Active' : 'Inactive'} 
                          color={employee.active ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Financial Details */}
        {employee.financialDetails && (
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <FiDollarSign style={{ marginRight: '8px', fontSize: '20px', color: '#667eea' }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Financial Details</Typography>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold', width: '40%' }}>Bank Name</TableCell>
                        <TableCell>{employee.financialDetails.bankName || 'N/A'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Account Name</TableCell>
                        <TableCell>{employee.financialDetails.accountName || 'N/A'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Account Number</TableCell>
                        <TableCell>{employee.financialDetails.accountNo || 'N/A'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>IFSC Code</TableCell>
                        <TableCell>{employee.financialDetails.ifsc || 'N/A'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>PAN Number</TableCell>
                        <TableCell>{employee.financialDetails.panNumber || 'N/A'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Tax ID</TableCell>
                        <TableCell>{employee.financialDetails.taxId || 'N/A'}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Performance & Statistics */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <FiTrendingUp style={{ marginRight: '8px', fontSize: '20px', color: '#667eea' }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Performance & Statistics</Typography>
                </Box>
                <Tooltip title="Edit Performance Score">
                  <IconButton 
                    onClick={handleEditPerformanceClick}
                    color="primary"
                    size="small"
                    sx={{ 
                      bgcolor: 'primary.50',
                      '&:hover': { bgcolor: 'primary.100' }
                    }}
                  >
                    <FiEdit size={16} />
                  </IconButton>
                </Tooltip>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                      {employee.performanceScore || 'N/A'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">Performance Score</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      Set by Admin/Manager
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                      {calculateAttendanceRate()}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">Attendance Rate</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      Auto-calculated
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                      {employee.projectsCompleted || '0'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">Projects Completed</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      Auto-calculated
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'info.main' }}>
                      {calculateYearsOfExperience()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">Years Experience</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      Auto-calculated
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Enhanced Accordion sections for additional details */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 3, color: 'text.primary' }}>
          Additional Information
        </Typography>
        
        {/* Academic Records */}
        {employee.academicRecords?.length > 0 && (
          <Accordion sx={{ mb: 2, boxShadow: 2 }}>
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon />}
              sx={{ 
                bgcolor: 'primary.50',
                '&:hover': { bgcolor: 'primary.100' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <FiAward style={{ fontSize: '20px', color: '#667eea' }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Academic Records ({employee.academicRecords.length})
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer component={Paper} sx={{ boxShadow: 1 }}>
                <Table>
                  <TableHead sx={{ bgcolor: 'grey.50' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Institution</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Degree/Certificate</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Year</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Grade/GPA</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Details</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {employee.academicRecords.map((record, index) => (
                      <TableRow key={index} hover>
                        <TableCell>{record.institution || 'N/A'}</TableCell>
                        <TableCell>{record.degree || record.certificate || 'N/A'}</TableCell>
                        <TableCell>{record.year || 'N/A'}</TableCell>
                        <TableCell>{record.grade || record.gpa || 'N/A'}</TableCell>
                        <TableCell>{record.details || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Professional Qualifications */}
        {employee.professionalQualifications?.length > 0 && (
          <Accordion sx={{ mb: 2, boxShadow: 2 }}>
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon />}
              sx={{ 
                bgcolor: 'success.50',
                '&:hover': { bgcolor: 'success.100' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <FiBriefcase style={{ fontSize: '20px', color: '#4caf50' }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Professional Qualifications ({employee.professionalQualifications.length})
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer component={Paper} sx={{ boxShadow: 1 }}>
                <Table>
                  <TableHead sx={{ bgcolor: 'grey.50' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Title</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Organization</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Duration</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {employee.professionalQualifications.map((qualification, index) => (
                      <TableRow key={index} hover>
                        <TableCell>{qualification.title || 'N/A'}</TableCell>
                        <TableCell>{qualification.organization || 'N/A'}</TableCell>
                        <TableCell>{qualification.duration || 'N/A'}</TableCell>
                        <TableCell>
                          <Chip 
                            label={qualification.status || 'Completed'} 
                            color={qualification.status === 'Completed' ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{qualification.description || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Family Details */}
        {employee.familyDetails?.length > 0 && (
          <Accordion sx={{ mb: 2, boxShadow: 2 }}>
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon />}
              sx={{ 
                bgcolor: 'warning.50',
                '&:hover': { bgcolor: 'warning.100' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <FiHeart style={{ fontSize: '20px', color: '#ff9800' }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Family Details ({employee.familyDetails.length})
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer component={Paper} sx={{ boxShadow: 1 }}>
                <Table>
                  <TableHead sx={{ bgcolor: 'grey.50' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Relationship</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Phone</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Occupation</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Address</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {employee.familyDetails.map((member, index) => (
                      <TableRow key={index} hover>
                        <TableCell>{member.fullName || 'N/A'}</TableCell>
                        <TableCell>
                          <Chip 
                            label={member.relationship || 'N/A'} 
                            color="primary"
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{member.phoneNo || 'N/A'}</TableCell>
                        <TableCell>{member.occupation || 'N/A'}</TableCell>
                        <TableCell>{member.address || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Next of Kins */}
        {employee.nextOfKins?.length > 0 && (
          <Accordion sx={{ mb: 2, boxShadow: 2 }}>
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon />}
              sx={{ 
                bgcolor: 'info.50',
                '&:hover': { bgcolor: 'info.100' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <FiUsers style={{ fontSize: '20px', color: '#2196f3' }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Next of Kins ({employee.nextOfKins.length})
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer component={Paper} sx={{ boxShadow: 1 }}>
                <Table>
                  <TableHead sx={{ bgcolor: 'grey.50' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Relationship</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Phone</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Occupation</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Address</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {employee.nextOfKins.map((kin, index) => (
                      <TableRow key={index} hover>
                        <TableCell>{kin.name || 'N/A'}</TableCell>
                        <TableCell>
                          <Chip 
                            label={kin.relationship || 'N/A'} 
                            color="secondary"
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{kin.phone || 'N/A'}</TableCell>
                        <TableCell>{kin.occupation || 'N/A'}</TableCell>
                        <TableCell>{kin.address || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Guarantors */}
        {employee.guarantors?.length > 0 && (
          <Accordion sx={{ mb: 2, boxShadow: 2 }}>
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon />}
              sx={{ 
                bgcolor: 'error.50',
                '&:hover': { bgcolor: 'error.100' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <FiShield style={{ fontSize: '20px', color: '#f44336' }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Guarantors ({employee.guarantors.length})
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer component={Paper} sx={{ boxShadow: 1 }}>
                <Table>
                  <TableHead sx={{ bgcolor: 'grey.50' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Relationship</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Occupation</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Address</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {employee.guarantors.map((guarantor, index) => (
                      <TableRow key={index} hover>
                        <TableCell>{guarantor.name || 'N/A'}</TableCell>
                        <TableCell>
                          <Chip 
                            label={guarantor.relationship || 'N/A'} 
                            color="error"
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{guarantor.occupation || 'N/A'}</TableCell>
                        <TableCell>{guarantor.address || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Documents */}
        {employee.documents?.length > 0 && (
          <Accordion sx={{ mb: 2, boxShadow: 2 }}>
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon />}
              sx={{ 
                bgcolor: 'secondary.50',
                '&:hover': { bgcolor: 'secondary.100' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <FiFileText style={{ fontSize: '20px', color: '#9c27b0' }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Documents ({employee.documents.length})
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer component={Paper} sx={{ boxShadow: 1 }}>
                <Table>
                  <TableHead sx={{ bgcolor: 'grey.50' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Document Type</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>File Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>File Size</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Uploaded At</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {employee.documents.map((doc, index) => (
                      <TableRow key={index} hover>
                        <TableCell>
                          <Chip 
                            label={doc.documentType || 'Document'} 
                            color="primary"
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <FiFileText size={16} />
                            {doc.fileName || 'Unknown File'}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Box sx={{
                            display: 'flex',
                            flexDirection: isMobile ? 'column' : 'row',
                            gap: 1
                          }}>
                            <Tooltip title="Download Document">
                              <IconButton 
                                size="small"
                                onClick={() => handleDownloadDocument(doc._id, doc.fileName)}
                                color="primary"
                              >
                                <FiDownload size={16} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="View Document">
                              <IconButton 
                                size="small"
                                onClick={() => window.open(`http://localhost:5000${doc.filePath}`, '_blank')}
                                color="secondary"
                              >
                                <FiEye size={16} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Work History */}
        {employee.workHistory?.length > 0 && (
          <Accordion sx={{ mb: 2, boxShadow: 2 }}>
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon />}
              sx={{ 
                bgcolor: 'grey.50',
                '&:hover': { bgcolor: 'grey.100' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <FiClock style={{ fontSize: '20px', color: '#607d8b' }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Work History ({employee.workHistory.length})
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer component={Paper} sx={{ boxShadow: 1 }}>
                <Table>
                  <TableHead sx={{ bgcolor: 'grey.50' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Company</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Position</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Start Date</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>End Date</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {employee.workHistory.map((work, index) => (
                      <TableRow key={index} hover>
                        <TableCell>{work.company || 'N/A'}</TableCell>
                        <TableCell>{work.position || 'N/A'}</TableCell>
                        <TableCell>{work.startDate ? new Date(work.startDate).toLocaleDateString() : 'N/A'}</TableCell>
                        <TableCell>{work.endDate ? new Date(work.endDate).toLocaleDateString() : 'Current'}</TableCell>
                        <TableCell>{work.description || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Emergency Contacts */}
        {employee.emergencyContacts?.length > 0 && (
          <Accordion sx={{ mb: 2, boxShadow: 2 }}>
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon />}
              sx={{ 
                bgcolor: 'error.50',
                '&:hover': { bgcolor: 'error.100' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <FiPhone style={{ fontSize: '20px', color: '#f44336' }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Emergency Contacts ({employee.emergencyContacts.length})
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer component={Paper} sx={{ boxShadow: 1 }}>
                <Table>
                  <TableHead sx={{ bgcolor: 'grey.50' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Relationship</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Phone</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Priority</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {employee.emergencyContacts.map((contact, index) => (
                      <TableRow key={index} hover>
                        <TableCell>{contact.name || 'N/A'}</TableCell>
                        <TableCell>
                          <Chip 
                            label={contact.relationship || 'N/A'} 
                            color={contact.priority === 'Primary' ? 'error' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{contact.phone || 'N/A'}</TableCell>
                        <TableCell>{contact.email || 'N/A'}</TableCell>
                        <TableCell>
                          <Chip 
                            label={contact.priority || 'Secondary'} 
                            color={contact.priority === 'Primary' ? 'error' : 'default'}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        )}
      </Box>

      {/* Edit Work Information Dialog */}
      <Dialog
        open={openEditWorkDialog}
        onClose={handleCloseEditWorkDialog}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FiEdit style={{ fontSize: '24px', color: '#667eea' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Edit Work Information
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Job Title"
                  value={editWorkForm.jobTitle}
                  onChange={handleEditWorkFormChange('jobTitle')}
                  variant="outlined"
                  size="small"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Department</InputLabel>
                  <Select
                    value={editWorkForm.department}
                    onChange={handleEditWorkFormChange('department')}
                    label="Department"
                  >
                    <MenuItem value="Engineering">Engineering</MenuItem>
                    <MenuItem value="HR">HR</MenuItem>
                    <MenuItem value="Finance">Finance</MenuItem>
                    <MenuItem value="Sales">Sales</MenuItem>
                    <MenuItem value="Marketing">Marketing</MenuItem>
                    <MenuItem value="IT Support">IT Support</MenuItem>
                    <MenuItem value="Operations">Operations</MenuItem>
                    <MenuItem value="Customer Support">Customer Support</MenuItem>
                    <MenuItem value="Legal">Legal</MenuItem>
                    <MenuItem value="Product">Product</MenuItem>
                    <MenuItem value="Research & Development">Research & Development</MenuItem>
                    <MenuItem value="Design">Design</MenuItem>
                    <MenuItem value="Administration">Administration</MenuItem>
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
                    <MenuItem value="Intern">Intern</MenuItem>
                    <MenuItem value="Junior">Junior</MenuItem>
                    <MenuItem value="Mid-Level">Mid-Level</MenuItem>
                    <MenuItem value="Senior">Senior</MenuItem>
                    <MenuItem value="Lead">Lead</MenuItem>
                    <MenuItem value="Supervisor">Supervisor</MenuItem>
                    <MenuItem value="Manager">Manager</MenuItem>
                    <MenuItem value="Director">Director</MenuItem>
                    <MenuItem value="VP">VP</MenuItem>
                    <MenuItem value="CTO">CTO</MenuItem>
                    <MenuItem value="CFO">CFO</MenuItem>
                    <MenuItem value="CEO">CEO</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Manager"
                  value={editWorkForm.manager}
                  onChange={handleEditWorkFormChange('manager')}
                  variant="outlined"
                  size="small"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Salary"
                  type="number"
                  value={editWorkForm.salary}
                  onChange={handleEditWorkFormChange('salary')}
                  variant="outlined"
                  size="small"
                  InputProps={{
                    startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Joining Date"
                  type="date"
                  value={editWorkForm.joiningDate}
                  onChange={handleEditWorkFormChange('joiningDate')}
                  variant="outlined"
                  size="small"
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button 
            onClick={handleCloseEditWorkDialog}
            color="inherit"
            disabled={updatingWorkInfo}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveWorkInfo}
            variant="contained"
            disabled={updatingWorkInfo}
            startIcon={updatingWorkInfo ? <CircularProgress size={16} /> : <FiEdit />}
          >
            {updatingWorkInfo ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Performance Score Dialog */}
      <Dialog
        open={openEditPerformanceDialog}
        onClose={handleCloseEditPerformanceDialog}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FiStar style={{ fontSize: '24px', color: '#667eea' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Edit Performance Score
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Performance Score"
              type="number"
              value={editPerformanceForm.performanceScore}
              onChange={handlePerformanceFormChange('performanceScore')}
              variant="outlined"
              size="small"
              inputProps={{ min: 0, max: 100, step: 0.1 }}
              helperText="Enter a score between 0 and 100"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button 
            onClick={handleCloseEditPerformanceDialog}
            color="inherit"
            disabled={updatingWorkInfo}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSavePerformanceScore}
            variant="contained"
            disabled={updatingWorkInfo}
            startIcon={updatingWorkInfo ? <CircularProgress size={16} /> : <FiStar />}
          >
            {updatingWorkInfo ? 'Saving...' : 'Save Score'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EmployeeDetailsPage;