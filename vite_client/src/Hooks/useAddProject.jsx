import { useDispatch } from 'react-redux';
import axios from '../utils/axios';
import { addProject } from '../context/projectSlice';
import { ADMIN_PROJECT_ENDPOINT } from './../utils/constant';

const useAddProject = () => {
  const dispatch = useDispatch();

const addNewProject = async (projectData) => {
  // Removed console.log statements for production

  try {
    // Removed console.log for production
    const res = await axios.post(`${ADMIN_PROJECT_ENDPOINT}/create-project`, projectData, {
      withCredentials: true,
    });

    if (res.data) {
      const normalizedProject = {
        ...res.data,
        projectLeader: res.data.projectLeader?._id ? [res.data.projectLeader._id] : [],
        projectMembers: res.data.projectMembers?.map(m => m._id) || [],
      };
      dispatch(addProject(normalizedProject));
      return { success: true, project: normalizedProject };
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
