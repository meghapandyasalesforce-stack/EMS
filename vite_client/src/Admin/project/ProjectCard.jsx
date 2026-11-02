import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { FiEdit, FiDownload, FiTrash2 } from 'react-icons/fi';
import ProjectSummaryCard from '../../components/project/ProjectSummaryCard';
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

  const openProjectDetails = () => navigate(`/projects/${project._id}`);

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
    <div className={`workspace-project-card ${isOverdue ? 'is-overdue' : ''}`}>
      <ProjectSummaryCard
        project={project}
        progress={progress}
        showFinancials={canViewFinancials}
        onOpen={openProjectDetails}
        onActions={(event) => setMenuAnchor(event.currentTarget)}
        actionProps={{ 'aria-controls': menuOpen ? 'project-card-menu' : undefined, 'aria-haspopup': 'menu', 'aria-expanded': menuOpen }}
      />

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
