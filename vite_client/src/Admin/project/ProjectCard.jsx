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
  Divider
} from '@mui/material';
import { 
  FiUsers, 
  FiClock, 
  FiCheckCircle, 
  FiPause, 
  FiAlertCircle,
  FiTrendingUp 
} from 'react-icons/fi';

const ProjectCard = ({ project }) => {
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

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      onClick={() => navigate(`/projects/${project._id}`)}
    >
      <Card sx={{
        height: '100%',
        cursor: 'pointer',
        borderRadius: 3,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        transition: 'all 0.3s ease-in-out',
        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
        border: '1px solid rgba(0,0,0,0.05)',
        '&:hover': {
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          transform: 'translateY(-2px)'
        }
      }}>
        <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header with Status */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Typography variant="h6" sx={{ 
              fontWeight: 600, 
              color: 'text.primary',
              lineHeight: 1.3,
              flex: 1,
              mr: 1
            }}>
              {project.name}
            </Typography>
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
          </Box>

          <Divider sx={{ mb: 2, opacity: 0.3 }} />

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
              <Typography variant="caption" sx={{ 
                color: statusInfo.color, 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5
              }}>
                {statusInfo.label}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ProjectCard;
