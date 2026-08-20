// redux/slices/payrollSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../utils/axios';
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
  async ({ month, year, page = 1, limit = 20, search = '' }, thunkAPI) => {
    try {
      let url = `${ADMIN_PAYROLL_ENDPOINT}/get-all-employee-payroll?month=${encodeURIComponent(month)}&year=${year}&page=${page}&limit=${limit}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const response = await axios.get(url);
      const data = response.data;
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      return { list, pagination: data?.pagination ?? null };
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
      const response = await axios.put(
        `${ADMIN_PAYROLL_ENDPOINT}/update-payroll/${payrollId}`,
        updatedData
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const generatePayrolls = createAsyncThunk(
  'payroll/generatePayrolls',
  async ({ month, year, mode = 'final', forceFinalBeforePeriodEnd = false }, thunkAPI) => {
    try {
      const response = await axios.post(
        `${ADMIN_PAYROLL_ENDPOINT}/generate-bulk`,
        { month, year, mode, forceFinalBeforePeriodEnd }
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
    pagination: null,
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
        state.data = action.payload.list;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchPayrolls.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? action.error.message;
      })
      .addCase(createPayroll.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(createPayroll.fulfilled, (state, action) => {
        state.status = 'succeeded';
        // This endpoint returns a full Payroll document, while `state.data`
        // is a list of summary rows from `get-all-employee-payroll`.
        // To avoid mixing shapes, we rely on the next explicit refresh.
      })
      .addCase(createPayroll.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(updatePayroll.fulfilled, (state, action) => {
        // Controller returns: { success, message, data: payrollDoc }
        const updated = action.payload?.data ?? action.payload;
        const updatedId = updated?._id;
        if (!updatedId) return;

        const index = state.data.findIndex(
          (p) => String(p?.payrollId ?? p?._id) === String(updatedId)
        );
        if (index === -1) return;

        const earningsTotal = updated?.earnings?.totalEarnings;
        const deductionsTotal = updated?.deductions?.total;

        state.data[index] = {
          ...state.data[index],
          status: updated?.status ?? state.data[index].status,
          isVisible:
            updated?.isVisible ?? state.data[index].isVisible,
          generationType:
            updated?.generationType ?? state.data[index].generationType,
          isProvisional:
            updated?.isProvisional ?? state.data[index].isProvisional,
          computedAsOf:
            updated?.computedAsOf ?? state.data[index].computedAsOf,
          totalEarnings:
            earningsTotal ?? state.data[index].totalEarnings,
          totalDeductions:
            deductionsTotal ?? state.data[index].totalDeductions,
          inHandSalary:
            updated?.inHandSalary ?? state.data[index].inHandSalary,
          payrollLocked:
            updated?.payrollLocked ?? state.data[index].payrollLocked,
          earnings: updated?.earnings ?? state.data[index].earnings,
          deductions: updated?.deductions ?? state.data[index].deductions
        };
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
