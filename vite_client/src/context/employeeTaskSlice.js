import { createSlice } from "@reduxjs/toolkit";
import axios from "../utils/axios";
import { toast } from "react-toastify";
import { BOTH_TASK_ENDPOINT } from "../utils/constant";

const initialState = {
  myProjects: [],
  myTasks: [],
  workPlan: [],
  workPlanProgress: null,
  workPlanStatus: 'idle',
  workPlanError: null,
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null
};

const employeeTaskSlice = createSlice({
  name: "employeeTask",
  initialState,
  reducers: {
    setMyProjects: (state, action) => {
      state.myProjects = action.payload;
    },
    setMyTasks: (state, action) => {
      state.myTasks = action.payload;
      state.status = 'succeeded';
      state.error = null;
    },
    setWorkPlan: (state, action) => {
      state.workPlan = action.payload.workItems || [];
      state.workPlanProgress = action.payload.progress || null;
      state.workPlanStatus = 'succeeded';
      state.workPlanError = null;
    },
    setWorkPlanLoading: (state) => {
      state.workPlanStatus = 'loading';
    },
    setWorkPlanError: (state, action) => {
      state.workPlanError = action.payload;
      state.workPlanStatus = 'failed';
    },
    addTask: (state, action) => {
      state.myTasks.unshift(action.payload);
    },
    updateTask: (state, action) => {
      const index = state.myTasks.findIndex(task => task._id === action.payload._id);
      if (index !== -1) {
        state.myTasks[index] = action.payload;
      }
    },
    setLoading: (state) => {
      state.status = 'loading';
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.status = 'failed';
    },
    setStatus: (state, action) => {
      state.status = action.payload;
    },
    resetTaskState: (state) => {
      return initialState;
    }
  }
});

// Thunk actions
export const fetchMyProjects = () => async (dispatch) => {
  try {
    dispatch(setLoading());
    const res = await axios.get(`${BOTH_TASK_ENDPOINT}/get-my-projects`, { 
      withCredentials: true 
    });
    const projects = res.data?.projects || res.data?.data?.projects || res.data?.data || res.data || [];
    dispatch(setMyProjects(Array.isArray(projects) ? projects : []));
    dispatch(setStatus('succeeded'));
  } catch (error) {
    dispatch(setError(error.response?.data?.error || 'Failed to fetch projects'));
    dispatch(setStatus('failed'));
    toast.error(error.response?.data?.error || 'Failed to fetch projects');
  }
};

export const fetchMyTasks = (filters = {}) => async (dispatch) => {
  try {
    dispatch(setLoading());
    const queryString = new URLSearchParams(filters).toString();
    const res = await axios.get(`${BOTH_TASK_ENDPOINT}/all-tasks?${queryString}`, { 
      withCredentials: true 
    });
    const tasks = res.data?.tasks ?? res.data?.data?.tasks ?? [];
    dispatch(setMyTasks(tasks));
  } catch (error) {
    dispatch(setError(error.response?.data?.error || 'Failed to fetch tasks'));
    toast.error(error.response?.data?.error || 'Failed to fetch tasks');
  }
};

export const createNewTask = (taskData) => async (dispatch) => {
  try {
    dispatch(setLoading());
    const res = await axios.post(`${BOTH_TASK_ENDPOINT}/create-task`, taskData, { 
      withCredentials: true 
    });
    const createdTask = res.data?.task || res.data?.data?.task || res.data?.data;
    if (createdTask) {
      dispatch(addTask(createdTask));
    }
    dispatch(setStatus('succeeded'));
    toast.success('Task created successfully!');
    return { success: true, task: createdTask };
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Failed to create task';
    dispatch(setError(errorMessage));
    toast.error(errorMessage);
    return { success: false, error };
  }
};

export const fetchEmployeeWorkPlan = (projectId) => async (dispatch) => {
  try {
    dispatch(setWorkPlanLoading());
    const res = await axios.get(
      `${BOTH_TASK_ENDPOINT}/projects/${projectId}/work-items`,
      { withCredentials: true }
    );
    const body = res.data || {};
    dispatch(
      setWorkPlan({
        workItems: body.workItems || body.data?.workItems || [],
        progress: body.progress || body.data?.progress || null
      })
    );
    return { success: true, ...body };
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      'Failed to fetch work plan';
    dispatch(setWorkPlanError(message));
    return { success: false, error: message };
  }
};

export const updateEmployeeWorkItem = (workItemId, projectId, payload) => async (dispatch) => {
  try {
    const { projectId: _omit, ...body } = payload || {};
    const res = await axios.put(
      `${BOTH_TASK_ENDPOINT}/work-items/${workItemId}`,
      body,
      { withCredentials: true }
    );
    if (projectId) {
      await dispatch(fetchEmployeeWorkPlan(projectId));
      await dispatch(fetchMyProjects());
    }
    toast.success('Work item updated');
    return { success: true, workItem: res.data?.workItem || res.data?.data?.workItem };
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      'Failed to update work item';
    toast.error(message);
    return { success: false, error: message };
  }
};

export const updateExistingTask = (taskId, updateData) => async (dispatch) => {
  try {
    dispatch(setLoading());
    const res = await axios.put(`${BOTH_TASK_ENDPOINT}/task-status/${taskId}`, updateData, { 
      withCredentials: true 
    });
    const updatedTask = res.data?.task || res.data?.data?.task || res.data?.data;
    if (updatedTask) {
      dispatch(updateTask(updatedTask));
    }
    dispatch(setStatus('succeeded'));
    toast.success('Task updated successfully!');
    return { success: true, task: updatedTask };
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Failed to update task';
    dispatch(setError(errorMessage));
    toast.error(errorMessage);
    return { success: false, error };
  }
};

export const { 
  setMyProjects, 
  setMyTasks,
  setWorkPlan,
  setWorkPlanLoading,
  setWorkPlanError,
  addTask,
  updateTask,
  setLoading,
  setError,
  setStatus,
  resetTaskState
} = employeeTaskSlice.actions;

export default employeeTaskSlice.reducer;