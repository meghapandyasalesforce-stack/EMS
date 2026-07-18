import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import {
  Box,
  Typography,
  Chip,
  Avatar,
  Card,
  CardContent,
  Divider,
  LinearProgress,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  FiClock,
  FiCheckCircle,
  FiPause,
  FiAlertCircle,
  FiTrendingUp,
  FiEdit,
  FiDownload,
  FiTrash2,
  FiMoreVertical,
} from 'react-icons/fi';
import useDeleteProject from '../../Hooks/useDeleteProject';
import { isManager, isHR } from '../../utils/managerHelper';
import { isExecutive } from '../../utils/navigationConfig';
import { canViewProjectFinancials } from '../../utils/projectFinancialsHelper';

const ProjectCard = ({ project, isOverdue = false, progress = 0 }) => {
  const navigate = useNavigate();
  const deleteProject = useDeleteProject();
  const user = useSelector((state) => state.auth.user);
  const employee = useSelector((state) => state.employeeDetails.employee);

  const [menuAnchor, setMenuAnchor] = useState(null);
  const menuOpen = Boolean(menuAnchor);

  const canManage = useMemo(() => {
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

  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return {
          color: '#ff9800',
          icon: <FiClock size={14} />,
          label: 'Pending',
          bgColor: '#fff3e0',
        };
      case 'in-progress':
        return {
          color: '#2196f3',
          icon: <FiTrendingUp size={14} />,
          label: 'In Progress',
          bgColor: '#e3f2fd',
        };
      case 'completed':
        return {
          color: '#4caf50',
          icon: <FiCheckCircle size={14} />,
          label: 'Completed',
          bgColor: '#e8f5e8',
        };
      case 'on-hold':
        return {
          color: '#f44336',
          icon: <FiPause size={14} />,
          label: 'On Hold',
          bgColor: '#ffebee',
        };
      default:
        return {
          color: '#9e9e9e',
          icon: <FiAlertCircle size={14} />,
          label: 'Unknown',
          bgColor: '#f5f5f5',
        };
    }
  };

  const statusInfo = getStatusInfo(project.status);
  const memberCount = project.projectMembers?.length || 0;
  const openProjectDetails = () => navigate(`/projects/${project._id}`);
  const projectLeaderName = project.projectLeader?.name || 'Unassigned';
  const priorityLabel = `${(project.priority || 'medium').toUpperCase()} PRIORITY`;
  const priorityColors = {
    critical: { bg: '#fee2e2', text: '#b91c1c' },
    high: { bg: '#fee2e2', text: '#b91c1c' },
    medium: { bg: '#ffedd5', text: '#c2410c' },
    low: { bg: '#f1f5f9', text: '#475569' },
  };
  const priorityColor = priorityColors[project.priority] || priorityColors.medium;
  const dueDateLabel = project.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A';
  const budgetLabel = project.budget ? `₹${Number(project.budget).toLocaleString('en-IN')}` : 'N/A';

  const closeMenu = () => setMenuAnchor(null);

  const handleExport = () => {
    const row = {
      Name: project.name,
      Description: project.description || '',
      Status: project.status,
      Priority: project.priority || '',
      Leader: project.projectLeader?.name || '',
      Members: project.projectMembers?.map((m) => m.name).join(', ') || '',
      StartDate: project.startDate ? format(new Date(project.startDate), 'yyyy-MM-dd') : '',
      EndDate: project.endDate ? format(new Date(project.endDate), 'yyyy-MM-dd') : '',
      ...(canViewFinancials && {
        Budget: project.budget || 0,
        ActualCost: project.actualCost || 0,
        Revenue: project.revenue || 0,
      }),
    };

    const headers = Object.keys(row);
    const csv = [
      headers.join(','),
      headers.map((header) => `"${row[header] ?? ''}"`).join(','),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(project.name || 'project').replace(/\s+/g, '_')}_export.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    closeMenu();
    toast.success('Project exported');
  };

  const handleDelete = async () => {
    closeMenu();
    if (!window.confirm(`Delete project "${project.name}"? This cannot be undone.`)) {
      return;
    }

    const result = await deleteProject(project._id);
    if (result.success) {
      toast.success('Project deleted');
    } else {
      toast.error(result.error || 'Failed to delete project');
    }
  };

  return (
    <div>
      <Card
        sx={{
          height: '100%',
          cursor: 'pointer',
          borderRadius: 4,
          boxShadow: '0 2px 12px rgba(15,23,42,0.06)',
          transition: 'all 0.3s ease-in-out',
          background: '#ffffff',
          border: isOverdue ? '2px solid #b91c1c' : '1px solid #e2e8f0',
          '&:hover': {
            boxShadow: '0 8px 26px rgba(15,23,42,0.12)',
            transform: 'translateY(-2px)',
          },
        }}
        role="button"
        tabIndex={0}
        onClick={openProjectDetails}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openProjectDetails();
          }
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box sx={{ flex: 1, mr: 1, minWidth: 0 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  color: 'text.primary',
                  lineHeight: 1.3,
                  mb: 0.75,
                  fontSize: { xs: '1.06rem', sm: '1.35rem' },
                }}
              >
                {project.name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                <Chip
                  size="small"
                  label={(project.category || project.department || 'Operations').toUpperCase()}
                  sx={{
                    height: { xs: 20, sm: 22 },
                    fontSize: { xs: '0.58rem', sm: '0.65rem' },
                    bgcolor: '#f1f5f9',
                    color: '#334155',
                    fontWeight: 700,
                  }}
                />
                <Chip
                  size="small"
                  label={isOverdue ? 'OVERDUE' : statusInfo.label.toUpperCase()}
                  sx={{
                    height: { xs: 20, sm: 22 },
                    fontSize: { xs: '0.58rem', sm: '0.65rem' },
                    bgcolor: isOverdue ? '#fee2e2' : '#dcfce7',
                    color: isOverdue ? '#b91c1c' : '#047857',
                    fontWeight: 700,
                  }}
                />
              </Box>
            </Box>
            <Chip
              label={priorityLabel}
              size="small"
              sx={{
                bgcolor: priorityColor.bg,
                color: priorityColor.text,
                height: { xs: 20, sm: 24 },
                fontWeight: 700,
                fontSize: { xs: '0.58rem', sm: '0.65rem' },
              }}
            />
          </Box>

          <Divider sx={{ mb: 2, opacity: 0.35 }} />

          {progress > 0 && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Progress
                </Typography>
                <Typography variant="caption" fontWeight={600}>
                  {progress}%
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 1 }} />
            </Box>
          )}

          <Box sx={{ mb: 2.2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.6 }}>
              <Avatar
                sx={{
                  width: { xs: 28, sm: 32 },
                  height: { xs: 28, sm: 32 },
                  mr: { xs: 1, sm: 1.5 },
                  backgroundColor: '#1976d2',
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                  fontWeight: 600,
                }}
              >
                {project.projectLeader?.name?.charAt(0) || '?'}
              </Avatar>
              <Typography
                variant="body2"
                sx={{ color: 'text.primary', fontWeight: 600, fontSize: { xs: '0.82rem', sm: '0.875rem' } }}
              >
                {projectLeaderName}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', ml: 0.8, fontSize: { xs: '0.76rem', sm: '0.875rem' } }}
              >
                • {project.projectLeader?.position || 'Project Lead'}
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
              gap: { xs: 1, sm: 1.5 },
              mb: 2,
              borderTop: '1px solid #e2e8f0',
              pt: 1.6,
            }}
          >
            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: '#64748b',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  fontSize: { xs: '0.62rem', sm: '0.68rem' },
                }}
              >
                Budget
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: { xs: '0.82rem', sm: '0.92rem' } }}>
                {budgetLabel}
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: '#64748b',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  fontSize: { xs: '0.62rem', sm: '0.68rem' },
                }}
              >
                Team
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: { xs: '0.82rem', sm: '0.92rem' } }}>
                {memberCount} Members
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: '#64748b',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  fontSize: { xs: '0.62rem', sm: '0.68rem' },
                }}
              >
                {isOverdue ? 'Overdue By' : 'Due Date'}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 700,
                  color: isOverdue ? '#b91c1c' : '#0f172a',
                  fontSize: { xs: '0.82rem', sm: '0.92rem' },
                }}
              >
                {dueDateLabel}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mt: 'auto', pt: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 1 }}>
              <Button
                fullWidth
                variant="outlined"
                onClick={(e) => {
                  e.stopPropagation();
                  openProjectDetails();
                }}
                sx={{
                  textTransform: 'none',
                  borderRadius: 2,
                  fontWeight: 700,
                  borderColor: '#dbe2ea',
                  color: '#0f172a',
                  fontSize: { xs: '0.8rem', sm: '0.875rem' },
                  py: { xs: 0.75, sm: 0.9 },
                }}
              >
                View Details
              </Button>
              <Button
                variant="outlined"
                aria-label="Project actions"
                aria-controls={menuOpen ? 'project-card-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={menuOpen ? 'true' : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuAnchor(e.currentTarget);
                }}
                sx={{
                  minWidth: { xs: 36, sm: 42 },
                  borderRadius: 2,
                  borderColor: '#dbe2ea',
                  color: '#64748b',
                  px: 0,
                }}
              >
                <FiMoreVertical size={18} />
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Menu
        id="project-card-menu"
        anchorEl={menuAnchor}
        open={menuOpen}
        onClose={closeMenu}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 190,
              borderRadius: 2,
              boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
            },
          },
        }}
      >
        {canManage && (
          <MenuItem
            onClick={() => {
              closeMenu();
              navigate(`/projects/${project._id}`, { state: { startEditing: true } });
            }}
          >
            <ListItemIcon>
              <FiEdit size={16} />
            </ListItemIcon>
            <ListItemText>Edit Project</ListItemText>
          </MenuItem>
        )}

        <MenuItem onClick={handleExport}>
          <ListItemIcon>
            <FiDownload size={16} />
          </ListItemIcon>
          <ListItemText>Export</ListItemText>
        </MenuItem>

        {canManage && (
          <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
            <ListItemIcon sx={{ color: 'error.main' }}>
              <FiTrash2 size={16} />
            </ListItemIcon>
            <ListItemText>Delete Project</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </div>
  );
};

export default ProjectCard;
