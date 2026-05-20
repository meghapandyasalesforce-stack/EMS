import { useDispatch } from 'react-redux';
import axios from '../utils/axios';
import { addProject } from '../context/projectSlice';
import { ADMIN_PROJECT_ENDPOINT } from './../utils/constant';

const useAddProject = () => {
  const dispatch = useDispatch();

const addNewProject = async (projectData) => {
  // Removed console.log statements for production

  try {
    const res = await axios.post(`${ADMIN_PROJECT_ENDPOINT}/create-project`, projectData, {
      withCredentials: true,
    });

    if (res.data) {
      const p = res.data.project;
      if (!p?._id) {
        return { success: false, error: 'Invalid response structure' };
      }
      // projectSlice addProject expects populated projectLeader / projectMembers (objects with _id)
      dispatch(addProject({ ...p }));
      return { success: true, project: p };
    } else {
      // Removed console.error for production
      return { success: false, error: "Invalid response structure" };
    }
  } catch (error) {
    // Removed console.error statements for production
    
    // Extract specific error message from response
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.message || 
                        error.message || 
                        'Failed to create project';
    
    // If there are invalid employees, show them
    if (error.response?.data?.invalidEmployees) {
      const invalidEmployees = error.response.data.invalidEmployees;
      const invalidNames = invalidEmployees.map(emp => `${emp.name} (${emp.position})`).join(', ');
      return { 
        success: false, 
        error: { 
          message: `${errorMessage}. Invalid employees: ${invalidNames}` 
        } 
      };
    }
    
    return { success: false, error: { message: errorMessage } };
  }
};

  return addNewProject;
};

export default useAddProject;
