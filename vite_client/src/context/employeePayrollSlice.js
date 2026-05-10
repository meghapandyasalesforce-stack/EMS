import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../utils/axios'; // Use configured axios instance

// Async thunks
export const fetchPayrollHistory = createAsyncThunk(
    'employeePayroll/fetchPayrollHistory',
    async ({ page = 1, limit = 12, year } = {}, { rejectWithValue }) => {
        try {
            const params = { page, limit };
            if (year !== undefined && year !== null && year !== '') params.year = year;
            const response = await axios.get(`/v1/employee/payroll/history`, {
                params
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

export const fetchPayrollByMonth = createAsyncThunk(
    'employeePayroll/fetchPayrollByMonth',
    async ({ month, year }, { rejectWithValue }) => {
        try {
            const response = await axios.get(`/v1/employee/payroll/by-month`, {
                params: { month, year }
            });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch payroll for month');
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
                responseType: 'blob' // Important: expect binary data
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
    historyLoading: false,
    payslipDownloading: false,
    error: null,
    payrollHistory: {
        payrolls: [],
        totalPages: 0,
        currentPage: 1,
        total: 0
    },
    currentMonthPayroll: null,
    selectedMonthPayroll: null,
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
        clearMonthPayrollView: (state) => {
            state.selectedMonthPayroll = null;
        },
        clearPayslipData: (state) => {
            state.payslipData = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch Payroll History
            .addCase(fetchPayrollHistory.pending, (state) => {
                state.historyLoading = true;
                state.error = null;
            })
            .addCase(fetchPayrollHistory.fulfilled, (state, action) => {
                state.historyLoading = false;
                state.payrollHistory = action.payload;
            })
            .addCase(fetchPayrollHistory.rejected, (state, action) => {
                state.historyLoading = false;
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
            .addCase(fetchPayrollByMonth.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPayrollByMonth.fulfilled, (state, action) => {
                state.loading = false;
                state.selectedMonthPayroll = action.payload;
            })
            .addCase(fetchPayrollByMonth.rejected, (state, action) => {
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
                state.payslipDownloading = true;
                state.error = null;
            })
            .addCase(downloadPayslip.fulfilled, (state, action) => {
                state.payslipDownloading = false;
                state.payslipData = action.payload;
            })
            .addCase(downloadPayslip.rejected, (state, action) => {
                state.payslipDownloading = false;
                state.error = action.payload;
            });
    }
});

export const { clearError, clearSelectedPayroll, clearPayslipData, clearMonthPayrollView } = employeePayrollSlice.actions;
export default employeePayrollSlice.reducer;
