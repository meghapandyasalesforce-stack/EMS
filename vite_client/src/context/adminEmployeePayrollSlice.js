import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../utils/axios';
import { ADMIN_PAYROLL_ENDPOINT } from '../utils/constant';

const API_BASE_URL = ADMIN_PAYROLL_ENDPOINT;

// Async thunks
export const fetchAdminEmployeePayrollHistory = createAsyncThunk(
    'adminEmployeePayroll/fetchPayrollHistory',
    async ({ employeeId, page = 1, limit = 12 }, { rejectWithValue }) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/admin-employee-payroll/${employeeId}`, {
                params: { page, limit }
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
            // Use the correct export-pdf endpoint with blob response type
            const response = await axios.get(`${API_BASE_URL}/${payrollId}/export-pdf`, {
                responseType: 'blob', // Important: expect binary PDF data
                withCredentials: true
            });
            return response.data; // Return blob data
        } catch (error) {
            // If error response is JSON, try to parse it
            if (error.response?.data instanceof Blob) {
                try {
                    const text = await error.response.data.text();
                    const errorData = JSON.parse(text);
                    return rejectWithValue(errorData.message || 'Failed to download payslip');
                } catch (parseError) {
                    return rejectWithValue('Failed to download payslip');
                }
            }
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
                // Normalize the response to ensure payrolls is always an array
                const payload = action.payload || {};
                state.payrollHistory = {
                    payrolls: Array.isArray(payload.payrolls) ? payload.payrolls : (Array.isArray(payload) ? payload : []),
                    totalPages: payload.totalPages || 0,
                    currentPage: payload.currentPage || 1,
                    total: payload.total || 0
                };
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
                state.currentMonthPayroll = null;
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
