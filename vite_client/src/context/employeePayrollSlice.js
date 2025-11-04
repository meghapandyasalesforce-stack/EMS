import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../utils/axios'; // Use configured axios instance

// Async thunks
export const fetchPayrollHistory = createAsyncThunk(
    'employeePayroll/fetchPayrollHistory',
    async ({ page = 1, limit = 12 }, { rejectWithValue }) => {
        try {
            const response = await axios.get(`/v1/employee/payroll/history`, {
                params: { page, limit }
            });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch payroll history');
        }
    }
);

export const fetchCurrentMonthPayroll = createAsyncThunk(
    'employeePayroll/fetchCurrentMonthPayroll',
    async (_, { rejectWithValue }) => {
        try {
            const response = await axios.get(`/v1/employee/payroll/current`);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch current month payroll');
        }
    }
);

export const fetchPayrollDetails = createAsyncThunk(
    'employeePayroll/fetchPayrollDetails',
    async (payrollId, { rejectWithValue }) => {
        try {
            const response = await axios.get(`/v1/employee/payroll/details/${payrollId}`, {
                withCredentials: true
            });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch payroll details');
        }
    }
);

export const downloadPayslip = createAsyncThunk(
    'employeePayroll/downloadPayslip',
    async (payrollId, { rejectWithValue }) => {
        try {
            const response = await axios.get(`/v1/employee/payroll/download/${payrollId}`, {
                responseType: 'blob' // For file downloads
            });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to download payslip');
        }
    }
);

const initialState = {
    loading: false,
    error: null,
    payrollHistory: {
        payrolls: [],
        totalPages: 0,
        currentPage: 1,
        total: 0
    },
    currentMonthPayroll: null,
    selectedPayroll: null,
    payslipData: null
};

const employeePayrollSlice = createSlice({
    name: 'employeePayroll',
    initialState,
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
        clearSelectedPayroll: (state) => {
            state.selectedPayroll = null;
        },
        clearPayslipData: (state) => {
            state.payslipData = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch Payroll History
            .addCase(fetchPayrollHistory.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPayrollHistory.fulfilled, (state, action) => {
                state.loading = false;
                state.payrollHistory = action.payload;
            })
            .addCase(fetchPayrollHistory.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Fetch Current Month Payroll
            .addCase(fetchCurrentMonthPayroll.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchCurrentMonthPayroll.fulfilled, (state, action) => {
                state.loading = false;
                state.currentMonthPayroll = action.payload;
            })
            .addCase(fetchCurrentMonthPayroll.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Fetch Payroll Details
            .addCase(fetchPayrollDetails.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPayrollDetails.fulfilled, (state, action) => {
                state.loading = false;
                state.selectedPayroll = action.payload;
            })
            .addCase(fetchPayrollDetails.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Download Payslip
            .addCase(downloadPayslip.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(downloadPayslip.fulfilled, (state, action) => {
                state.loading = false;
                state.payslipData = action.payload;
            })
            .addCase(downloadPayslip.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    }
});

export const { clearError, clearSelectedPayroll, clearPayslipData } = employeePayrollSlice.actions;
export default employeePayrollSlice.reducer;
