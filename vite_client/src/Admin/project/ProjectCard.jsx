import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Chip, 
  Avatar, 
  Card,
  CardContent,
  Divider,
  LinearProgress,
  Button
} from '@mui/material';
import { 
  FiUsers, 
  FiClock, 
  FiCheckCircle, 
  FiPause, 
  FiAlertCircle,
  FiTrendingUp,
} from 'react-icons/fi';

const ProjectCard = ({ project, isOverdue = false, progress = 0 }) => {
  const navigate = useNavigate();

  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return { 
          color: '#ff9800', 
          icon: <FiClock size={14} />, 
          label: 'Pending',
          bgColor: '#fff3e0'
        };
      case 'in-progress':
        return { 
          color: '#2196f3', 
          icon: <FiTrendingUp size={14} />, 
          label: 'In Progress',
          bgColor: '#e3f2fd'
        };
      case 'completed':
        return { 
          color: '#4caf50', 
          icon: <FiCheckCircle size={14} />, 
          label: 'Completed',
          bgColor: '#e8f5e8'
        };
      case 'on-hold':
        return { 
          color: '#f44336', 
          icon: <FiPause size={14} />, 
          label: 'On Hold',
          bgColor: '#ffebee'
        };
      default:
        return { 
          color: '#9e9e9e', 
          icon: <FiAlertCircle size={14} />, 
          label: 'Unknown',
          bgColor: '#f5f5f5'
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
    low: { bg: '#f1f5f9', text: '#475569' }
  };
  const priorityColor = priorityColors[project.priority] || priorityColors.medium;
  const dueDateLabel = project.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A';
  const budgetLabel = project.budget ? `₹${Number(project.budget).toLocaleString('en-IN')}` : 'N/A';

  return (
    <div>
      <Card sx={{
        height: '100%',
        cursor: 'pointer',
        borderRadius: 4,
        boxShadow: '0 2px 12px rgba(15,23,42,0.06)',
        transition: 'all 0.3s ease-in-out',
        background: '#ffffff',
        border: isOverdue ? '2px solid #b91c1c' : '1px solid #e2e8f0',
        '&:hover': {
          boxShadow: '0 8px 26px rgba(15,23,42,0.12)',
          transform: 'translateY(-2px)'
        }
      }}
      role="button"
      tabIndex={0}
      onClick={openProjectDetails}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openProjectDetails();
        }
      }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box sx={{ flex: 1, mr: 1, minWidth: 0 }}>
              <Typography variant="h6" sx={{ 
                fontWeight: 600, 
                color: 'text.primary',
                lineHeight: 1.3,
                mb: 0.75,
                fontSize: { xs: '1.06rem', sm: '1.35rem' }
              }}>
                {project.name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                <Chip size="small" label={(project.category || project.department || 'Operations').toUpperCase()} sx={{ height: { xs: 20, sm: 22 }, fontSize: { xs: '0.58rem', sm: '0.65rem' }, bgcolor: '#f1f5f9', color: '#334155', fontWeight: 700 }} />
                <Chip size="small" label={isOverdue ? 'OVERDUE' : statusInfo.label.toUpperCase()} sx={{ height: { xs: 20, sm: 22 }, fontSize: { xs: '0.58rem', sm: '0.65rem' }, bgcolor: isOverdue ? '#fee2e2' : '#dcfce7', color: isOverdue ? '#b91c1c' : '#047857', fontWeight: 700 }} />
              </Box>
            </Box>
            <Chip label={priorityLabel} size="small" sx={{ bgcolor: priorityColor.bg, color: priorityColor.text, height: { xs: 20, sm: 24 }, fontWeight: 700, fontSize: { xs: '0.58rem', sm: '0.65rem' } }} />
          </Box>

          <Divider sx={{ mb: 2, opacity: 0.35 }} />

          {/* Progress Bar */}
          {progress > 0 && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">Progress</Typography>
                <Typography variant="caption" fontWeight={600}>{progress}%</Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={progress} 
                sx={{ height: 8, borderRadius: 1 }}
              />
            </Box>
          )}

          <Box sx={{ mb: 2.2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.6 }}>
              <Avatar sx={{ 
                width: { xs: 28, sm: 32 }, 
                height: { xs: 28, sm: 32 }, 
                mr: { xs: 1, sm: 1.5 },
                backgroundColor: '#1976d2',
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                fontWeight: 600
              }}>
                {project.projectLeader?.name?.charAt(0) || '?'}
              </Avatar>
              <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600, fontSize: { xs: '0.82rem', sm: '0.875rem' } }}>
                {projectLeaderName}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', ml: 0.8, fontSize: { xs: '0.76rem', sm: '0.875rem' } }}>
                • {project.projectLeader?.position || 'Project Lead'}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: { xs: 1, sm: 1.5 }, mb: 2, borderTop: '1px solid #e2e8f0', pt: 1.6 }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, fontSize: { xs: '0.62rem', sm: '0.68rem' } }}>Budget</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: { xs: '0.82rem', sm: '0.92rem' } }}>{budgetLabel}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, fontSize: { xs: '0.62rem', sm: '0.68rem' } }}>Team</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: { xs: '0.82rem', sm: '0.92rem' } }}>{memberCount} Members</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, fontSize: { xs: '0.62rem', sm: '0.68rem' } }}>{isOverdue ? 'Overdue By' : 'Due Date'}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: isOverdue ? '#b91c1c' : '#0f172a', fontSize: { xs: '0.82rem', sm: '0.92rem' } }}>{dueDateLabel}</Typography>
            </Box>
          </Box>

          {/* Footer */}
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
                  py: { xs: 0.75, sm: 0.9 }
                }}
              >
                View Details
              </Button>
              <Button
                variant="outlined"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                sx={{ minWidth: { xs: 36, sm: 42 }, borderRadius: 2, borderColor: '#dbe2ea', color: '#64748b', px: 0, fontSize: { xs: '0.92rem', sm: '1rem' } }}
              >
                ⋮
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectCard;
