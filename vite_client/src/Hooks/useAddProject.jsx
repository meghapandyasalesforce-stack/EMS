import { useDispatch } from 'react-redux';
import axios from '../utils/axios';
import { addProject } from '../context/projectSlice';
import { ADMIN_PROJECT_ENDPOINT } from './../utils/constant';

const useAddProject = () => {
  const dispatch = useDispatch();

const addNewProject = async (projectData) => {
  console.log("Adding project...", projectData);
  console.log("Current user role:", localStorage.getItem('role'));
  console.log("Current user token:", localStorage.getItem('token'));
  console.log("Current cookies:", document.cookie);

  try {
    console.log("Sending project data:", projectData);
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
      console.error("Unexpected response:", res.data);
      return { success: false, error: "Invalid response structure" };
    }
  } catch (error) {
    console.error("Error adding project:", error);
    console.error("Error response:", error.response?.data);
    console.error("Error status:", error.response?.status);
    console.error("Full error:", error);
    
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
