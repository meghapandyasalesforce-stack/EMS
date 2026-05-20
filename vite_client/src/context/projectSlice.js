import { createSlice } from "@reduxjs/toolkit";
import axios from "../utils/axios";
import { toast } from "react-toastify";
import { BOTH_TASK_ENDPOINT } from "../utils/constant";

const projectSlice = createSlice({
  name: "project",
  initialState: {
    allProjects: [],
    projectTasks: [],
    /** Used for daily task log fetch on project detail — not project create/update */
    status: 'idle',
    error: null
  },
  reducers: {
    setAllProjects: (state, action) => {
      state.allProjects = action.payload;
    },
    addProject: (state, action) => {
      // Keep populated projectLeader / projectMembers from API (objects with _id, name, etc.)
      state.allProjects.unshift(action.payload);
    },
    updateProject: (state, action) => {
      const { _id } = action.payload;
      const index = state.allProjects.findIndex(project => project._id === _id);
      if (index !== -1) {
        state.allProjects[index] = action.payload;
      }
    },
    deleteProject: (state, action) => {
      state.allProjects = state.allProjects.filter(
        project => project._id !== action.payload
      );
    },
    setProjectTasks: (state, action) => {
      state.projectTasks = action.payload;
      state.status = 'idle';
      state.error = null;
    },
    setProjectTasksLoading: (state) => {
      state.status = 'loading';
    },
    setProjectTasksError: (state, action) => {
      state.error = action.payload;
      state.status = 'failed';
    },
    clearProjectTasksError: (state) => {
      state.error = null;
      state.status = 'idle';
    }
  }
});

// Thunk: fetch daily task logs for a project (Team daily logs tab)
export const fetchProjectTasks = (projectId, filters = {}) => async (dispatch) => {
  try {
    dispatch(setProjectTasksLoading());
    const queryString = new URLSearchParams(filters).toString();
    const res = await axios.get(
      `${BOTH_TASK_ENDPOINT}/admin/projects/${projectId}/tasks?${queryString}`
    );
    dispatch(setProjectTasks(res.data?.tasks ?? []));
  } catch (error) {
    const message = error.response?.data?.error || 'Failed to fetch project tasks';
    dispatch(setProjectTasksError(message));
    toast.error(message);
  }
};

export const {
  setAllProjects,
  addProject,
  updateProject,
  deleteProject,
  setProjectTasks,
  setProjectTasksLoading,
  setProjectTasksError,
  clearProjectTasksError,
} = projectSlice.actions;

// Backward-compatible aliases (avoid breaking any other imports)
export const setLoading = setProjectTasksLoading;
export const setError = setProjectTasksError;

export default projectSlice.reducer;
