// features/leave/leaveSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../utils/axios';
import { ADMIN_LEAVE_ENDPOINT } from '../utils/constant';

// Async thunk to get all leaves (optional filters: { status, year })
export const getAllLeaves = createAsyncThunk(
  'leave/getAll',
  async (params, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${ADMIN_LEAVE_ENDPOINT}/get-all-leaves`, {
        params: params || {},
        withCredentials: true
      });
      return response.data.leaves;
    } catch (err) {
      return rejectWithValue(err.response.data || err.message);
    }
  }
);

// Async thunk to update a leave
export const updateLeave = createAsyncThunk(
  'leave/update',
  async ({ id, updatedData }, { rejectWithValue }) => {
    try {
      const response = await axios.put(`${ADMIN_LEAVE_ENDPOINT}/update-leave-status/${id}`, updatedData ,{
  withCredentials: true
});
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response.data || err.message);
    }
  }
);

const leaveSlice = createSlice({
  name: 'leave',
  initialState: {
    leaves: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Get all leaves
      .addCase(getAllLeaves.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAllLeaves.fulfilled, (state, action) => {
        state.loading = false;
        state.leaves = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(getAllLeaves.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Update leave
      .addCase(updateLeave.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateLeave.fulfilled, (state, action) => {
        state.loading = false;
        const leave = action.payload?.leave;
        const employeeId = leave?.employee?._id || leave?.employee;
        if (employeeId && typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('leave-balance-updated', {
              detail: { employeeId: String(employeeId) },
            })
          );
        }
      })

      .addCase(updateLeave.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default leaveSlice.reducer;
