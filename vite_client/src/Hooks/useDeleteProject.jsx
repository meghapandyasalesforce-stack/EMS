// useDeleteProject.js
import { useDispatch } from 'react-redux';
import { deleteProject } from '../context/projectSlice';
import axios from '../utils/axios';
import { ADMIN_PROJECT_ENDPOINT } from '../utils/constant';

const useDeleteProject = () => {
  const dispatch = useDispatch();

  const handleDeleteProject = async (projectId) => {
    try {
      const res = await axios.delete(
        `${ADMIN_PROJECT_ENDPOINT}/delete-project/${projectId}`,
        { withCredentials: true }
      );

      const deleteSucceeded = res.status === 200 && (res.data?.success !== false);
      if (deleteSucceeded) {
        dispatch(deleteProject(projectId));
        return { success: true };
      } else {
        return { success: false, error: res.data?.error || 'Failed to delete project' };
      }
    } catch (error) {
      // Removed console.error for production
      return { 
        success: false, 
        error: error.response?.data?.error || error.response?.data?.message || 'Failed to delete project' 
      };
    }
  };

  return handleDeleteProject;
};

export default useDeleteProject;