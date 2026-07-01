import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../utils/axios';
import { EMPLOYEE_LEAVE_ENDPOINT } from '../utils/constant';

export const submitLeave = createAsyncThunk(
  'employeeLeave/submitLeave',
  async (data, { rejectWithValue }) => {
    try {
      let documentPath = null;
      if (data.document instanceof File) {
        const formData = new FormData();
        formData.append('document', data.document);
        const uploadResponse = await axios.post(
          `${EMPLOYEE_LEAVE_ENDPOINT}/upload-document`,
          formData,
          {
            withCredentials: true,
            headers: { 'Content-Type': 'multipart/form-data' },
          }
        );
        documentPath = uploadResponse.data?.document || uploadResponse.data?.data?.document || null;
      } else if (typeof data.document === 'string' && data.document.trim()) {
        documentPath = data.document.trim();
      }

      const payload = {
        startDate: data.startDate,
        endDate: data.endDate,
        leaveType: data.leaveType,
        reason: data.reason,
        isHalfDay: data.isHalfDay || false,
        halfDayType: data.isHalfDay ? data.halfDayType : null,
        document: documentPath,
      };

      const response = await axios.post(
        `${EMPLOYEE_LEAVE_ENDPOINT}/create-leave`,
        payload,
        {
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' },
        }
      );
      return response.data;
    } catch (error) {
      const backend = error.response?.data;
      const message =
        backend?.message ||
        backend?.error ||
        error.message ||
        'Something went wrong';
      return rejectWithValue(message);
    }
  }
);

export const getEmployeeLeaves = createAsyncThunk(
  'employeeLeave/getMyLeaves',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${EMPLOYEE_LEAVE_ENDPOINT}/get-my-leaves`, {
        withCredentials: true,
      });
      return {
        leaves: response.data.leaves,
        statistics: response.data.statistics,
      };
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const cancelEmployeeLeave = createAsyncThunk(
  'employeeLeave/cancelLeave',
  async (leaveId, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `${EMPLOYEE_LEAVE_ENDPOINT}/cancel/${leaveId}`,
        {},
        { withCredentials: true }
      );
      return response.data;
    } catch (error) {
      const backend = error.response?.data;
      const message =
        backend?.message ||
        backend?.error ||
        error.message ||
        'Failed to cancel leave request';
      return rejectWithValue(message);
    }
  }
);

const employeeLeaveSlice = createSlice({
  name: 'employeeLeave',
  initialState: {
    myLeaves: [],
    leaveStats: null,
    loading: false,
    error: null,
    success: false,
    cancelLoading: false,
    cancelError: null,
  },
  reducers: {
    resetStatus: (state) => {
      state.loading = false;
      state.error = null;
      state.success = false;
      state.cancelError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitLeave.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(submitLeave.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        const newLeave = action.payload.leave || action.payload;
        if (newLeave) {
          state.myLeaves = [newLeave, ...(state.myLeaves || [])];
        }
      })
      .addCase(submitLeave.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.success = false;
      })
      .addCase(getEmployeeLeaves.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getEmployeeLeaves.fulfilled, (state, action) => {
        state.loading = false;
        state.myLeaves = action.payload.leaves;
        state.leaveStats = action.payload.statistics;
      })
      .addCase(getEmployeeLeaves.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(cancelEmployeeLeave.pending, (state) => {
        state.cancelLoading = true;
        state.cancelError = null;
      })
      .addCase(cancelEmployeeLeave.fulfilled, (state, action) => {
        state.cancelLoading = false;
        const updatedLeave = action.payload?.leave;
        if (updatedLeave?._id) {
          state.myLeaves = (state.myLeaves || []).map((leave) =>
            leave._id === updatedLeave._id ? updatedLeave : leave
          );
        }
      })
      .addCase(cancelEmployeeLeave.rejected, (state, action) => {
        state.cancelLoading = false;
        state.cancelError = action.payload;
      });
  },
});

export const { resetStatus } = employeeLeaveSlice.actions;
export default employeeLeaveSlice.reducer;
