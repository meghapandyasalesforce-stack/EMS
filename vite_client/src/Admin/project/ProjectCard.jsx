import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Box, 
  Typography, 
  Chip, 
  Avatar, 
  AvatarGroup,
  Card,
  CardContent,
  Divider,
  LinearProgress,
  Checkbox,
  Tooltip,
  Button
} from '@mui/material';
import { 
  FiUsers, 
  FiClock, 
  FiCheckCircle, 
  FiPause, 
  FiAlertCircle,
  FiTrendingUp,
  FiExternalLink,
  FiEdit2
} from 'react-icons/fi';

const ProjectCard = ({ project, isOverdue = false, progress = 0, isCEO = false, selected = false, onSelect }) => {
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

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Card sx={{
        height: '100%',
        cursor: 'pointer',
        borderRadius: 3,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        transition: 'all 0.3s ease-in-out',
        background: isOverdue 
          ? 'linear-gradient(135deg, #ffebee 0%, #ffffff 100%)'
          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
        border: isOverdue 
          ? '2px solid #f44336'
          : selected 
          ? '2px solid #1976d2'
          : '1px solid rgba(0,0,0,0.05)',
        '&:hover': {
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
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
        <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header with Status and Checkbox */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            {onSelect && (
              <Checkbox
                checked={selected}
                onChange={(e) => {
                  e.stopPropagation();
                  onSelect(!selected);
                }}
                onClick={(e) => e.stopPropagation()}
                sx={{ mt: -1, ml: -1 }}
              />
            )}
            <Box sx={{ flex: 1, mr: 1 }}>
              <Typography variant="h6" sx={{ 
                fontWeight: 600, 
                color: 'text.primary',
                lineHeight: 1.3,
                mb: 0.5
              }}>
                {project.name}
              </Typography>
              {project.description && (
                <Typography variant="body2" sx={{ 
                  color: 'text.secondary',
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {project.description}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-end' }}>
              <Chip
                icon={statusInfo.icon}
                label={statusInfo.label}
                size="small"
                sx={{
                  backgroundColor: statusInfo.bgColor,
                  color: statusInfo.color,
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  height: 24,
                  '& .MuiChip-icon': {
                    color: statusInfo.color
                  }
                }}
              />
              {project.priority && (
                <Chip
                  label={project.priority.charAt(0).toUpperCase() + project.priority.slice(1)}
                  size="small"
                  sx={{
                    backgroundColor: 
                      project.priority === 'critical' ? '#ffebee' :
                      project.priority === 'high' ? '#fff3e0' :
                      project.priority === 'medium' ? '#e3f2fd' : '#f1f8e9',
                    color: 
                      project.priority === 'critical' ? '#c62828' :
                      project.priority === 'high' ? '#e65100' :
                      project.priority === 'medium' ? '#1565c0' : '#33691e',
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    height: 20
                  }}
                />
              )}
            </Box>
          </Box>

          <Divider sx={{ mb: 2, opacity: 0.3 }} />

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

          {/* Overdue Alert */}
          {isOverdue && (
            <Box sx={{ mb: 2, p: 1, bgcolor: '#ffebee', borderRadius: 1 }}>
              <Typography variant="caption" color="error" fontWeight={600}>
                ⚠️ Overdue
              </Typography>
            </Box>
          )}

          {/* Project Leader */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1, fontWeight: 500 }}>
              Project Leader
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Avatar sx={{ 
                width: 32, 
                height: 32, 
                mr: 1.5,
                backgroundColor: '#1976d2',
                fontSize: '0.875rem',
                fontWeight: 600
              }}>
                {project.projectLeader?.name?.charAt(0) || '?'}
              </Avatar>
              <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
                {project.projectLeader?.name || 'Not assigned'}
              </Typography>
            </Box>
          </Box>

          {/* Project Members */}
          {memberCount > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1, fontWeight: 500 }}>
                Team Members ({memberCount})
              </Typography>
              <AvatarGroup max={4} sx={{ justifyContent: 'flex-start' }}>
                {project.projectMembers?.slice(0, 4).map((member, index) => (
                  <Avatar 
                    key={member._id || index}
                    sx={{ 
                      width: 28, 
                      height: 28,
                      backgroundColor: '#4caf50',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}
                  >
                    {member.name?.charAt(0) || 'M'}
                  </Avatar>
                ))}
                {memberCount > 4 && (
                  <Avatar sx={{ 
                    width: 28, 
                    height: 28,
                    backgroundColor: '#9e9e9e',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    +{memberCount - 4}
                  </Avatar>
                )}
              </AvatarGroup>
            </Box>
          )}

          {/* Dates */}
          {(project.startDate || project.endDate) && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {project.startDate && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
                    <FiClock size={12} style={{ marginRight: 4 }} />
                    Start: {new Date(project.startDate).toLocaleDateString()}
                  </Typography>
                )}
                {project.endDate && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
                    <FiClock size={12} style={{ marginRight: 4 }} />
                    End: {new Date(project.endDate).toLocaleDateString()}
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {/* Cost Information (CEO Only) */}
          {isCEO && (project.budget || project.revenue || project.actualCost) && (
            <Box sx={{ mb: 2, p: 1.5, bgcolor: '#e3f2fd', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                Financial Overview
              </Typography>
              {project.budget && (
                <Typography variant="caption" sx={{ display: 'block' }}>
                  Budget: ${(project.budget / 1000).toFixed(1)}K
                </Typography>
              )}
              {project.actualCost && (
                <Typography variant="caption" sx={{ display: 'block' }}>
                  Cost: ${(project.actualCost / 1000).toFixed(1)}K
                </Typography>
              )}
              {project.revenue && (
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, color: '#4caf50' }}>
                  Revenue: ${(project.revenue / 1000).toFixed(1)}K
                </Typography>
              )}
              {project.budget && project.actualCost && (
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                  Remaining: ${((project.budget - project.actualCost) / 1000).toFixed(1)}K
                </Typography>
              )}
            </Box>
          )}

          {/* Footer */}
          <Box sx={{ mt: 'auto', pt: 2 }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              color: 'text.secondary'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FiUsers size={14} style={{ marginRight: 4 }} />
                <Typography variant="caption" sx={{ fontWeight: 500 }}>
                  {memberCount} member{memberCount !== 1 ? 's' : ''}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="text"
                  startIcon={<FiExternalLink size={12} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    openProjectDetails();
                  }}
                  sx={{ textTransform: 'none', minWidth: 'auto', px: 1 }}
                >
                  View
                </Button>
                <Button
                  size="small"
                  variant="text"
                  startIcon={<FiEdit2 size={12} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    openProjectDetails();
                  }}
                  sx={{ textTransform: 'none', minWidth: 'auto', px: 1, color: statusInfo.color }}
                >
                  Edit
                </Button>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ProjectCard;
