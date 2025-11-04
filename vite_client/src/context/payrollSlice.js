// redux/slices/payrollSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { ADMIN_PAYROLL_ENDPOINT } from '../utils/constant';

// Helper to read and decode cookie values (non-HTTPOnly only)
function getCookie(name) {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(name + '='));
  if (!match) return undefined;
  try {
    return decodeURIComponent(match.split('=')[1]);
  } catch (e) {
    return match.split('=')[1];
  }
}

export const fetchPayrolls = createAsyncThunk(
  'payroll/fetchPayrolls',
  async ({ month, year }, thunkAPI) => {
    try {
      const response = await axios.get(
        `${ADMIN_PAYROLL_ENDPOINT}/get-all-employee-payroll?month=${month}&year=${year}`,
        { withCredentials: true }
      );
      // Assuming the API returns an array directly
      return Array.isArray(response.data) ? response.data : [response.data];
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const createPayroll = createAsyncThunk(
  'payroll/createPayroll',
  async (payrollData, thunkAPI) => {
    try {
      const csrf = getCookie('csrfToken');
      const response = await axios.post(
        `${ADMIN_PAYROLL_ENDPOINT}/create-payroll`,
        payrollData,
        { withCredentials: true, headers: { 'x-csrf-token': csrf } }
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const updatePayroll = createAsyncThunk(
  'payroll/updatePayroll',
  async ({ payrollId, updatedData }, thunkAPI) => {
    try {
      const csrf = getCookie('csrfToken');
      const response = await axios.put(
        `${ADMIN_PAYROLL_ENDPOINT}/update-payroll/${payrollId}`,
        updatedData,
        { withCredentials: true, headers: { 'x-csrf-token': csrf } }
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const generatePayrolls = createAsyncThunk(
  'payroll/generatePayrolls',
  async ({ month, year }, thunkAPI) => {
    try {
      const csrf = getCookie('csrfToken');

      const response = await axios.post(
        `${ADMIN_PAYROLL_ENDPOINT}/generate-bulk`,
        { month, year },
        { withCredentials: true, headers: { 'x-csrf-token': csrf } }
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);


const payrollSlice = createSlice({
  name: 'payroll',
  initialState: {
    data: [],
    status: 'idle',
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPayrolls.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchPayrolls.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload;
      })
      .addCase(fetchPayrolls.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message;
      })
      .addCase(createPayroll.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(createPayroll.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data.push(action.payload);
      })
      .addCase(createPayroll.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(updatePayroll.fulfilled, (state, action) => {
        const updated = action.payload;
        const index = state.data.findIndex((p) => p._id === updated._id);
        if (index !== -1) {
          state.data[index] = updated;
        }
      })
      .addCase(generatePayrolls.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(generatePayrolls.fulfilled, (state) => {
        state.status = 'succeeded';
      })
      .addCase(generatePayrolls.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export default payrollSlice.reducer;
