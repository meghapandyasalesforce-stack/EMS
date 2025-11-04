import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api/v1/admin/payroll';

// Async thunks
export const fetchAdminEmployeePayrollHistory = createAsyncThunk(
    'adminEmployeePayroll/fetchPayrollHistory',
    async ({ employeeId, page = 1, limit = 12 }, { rejectWithValue }) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/admin-employee-payroll/${employeeId}`, {
                params: { page, limit },
                withCredentials: true
            });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch payroll history');
        }
    }
);

export const fetchAdminCurrentMonthPayroll = createAsyncThunk(
    'adminEmployeePayroll/fetchCurrentMonthPayroll',
    async (employeeId, { rejectWithValue }) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/admin-current-payroll/${employeeId}`, {
                withCredentials: true
            });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch current month payroll');
        }
    }
);

export const fetchAdminPayrollDetails = createAsyncThunk(
    'adminEmployeePayroll/fetchPayrollDetails',
    async (payrollId, { rejectWithValue }) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/details/${payrollId}`, {
                withCredentials: true
            });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch payroll details');
        }
    }
);

export const downloadAdminPayslip = createAsyncThunk(
    'adminEmployeePayroll/downloadPayslip',
    async (payrollId, { rejectWithValue }) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/download/${payrollId}`, {
                withCredentials: true
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

const adminEmployeePayrollSlice = createSlice({
    name: 'adminEmployeePayroll',
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
            .addCase(fetchAdminEmployeePayrollHistory.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAdminEmployeePayrollHistory.fulfilled, (state, action) => {
                state.loading = false;
                state.payrollHistory = action.payload;
            })
            .addCase(fetchAdminEmployeePayrollHistory.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Fetch Current Month Payroll
            .addCase(fetchAdminCurrentMonthPayroll.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAdminCurrentMonthPayroll.fulfilled, (state, action) => {
                state.loading = false;
                state.currentMonthPayroll = action.payload;
            })
            .addCase(fetchAdminCurrentMonthPayroll.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Fetch Payroll Details
            .addCase(fetchAdminPayrollDetails.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAdminPayrollDetails.fulfilled, (state, action) => {
                state.loading = false;
                state.selectedPayroll = action.payload;
            })
            .addCase(fetchAdminPayrollDetails.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Download Payslip
            .addCase(downloadAdminPayslip.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(downloadAdminPayslip.fulfilled, (state, action) => {
                state.loading = false;
                state.payslipData = action.payload;
            })
            .addCase(downloadAdminPayslip.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    }
});

export const { clearError, clearSelectedPayroll, clearPayslipData } = adminEmployeePayrollSlice.actions;
export default adminEmployeePayrollSlice.reducer;
