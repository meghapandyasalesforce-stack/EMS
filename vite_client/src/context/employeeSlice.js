import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../utils/axios';
import { EMPLOYEE_AUTH_ENDPOINT } from '../utils/constant';

// employeeSlice.js
export const createEmployee = createAsyncThunk(
  'employees/createEmployee',
  async (employeeData, thunkAPI) => {
    try {
      const response = await axios.post(`${EMPLOYEE_AUTH_ENDPOINT}/register`, employeeData);
      // Return both employee data and email status
      return {
        employee: response.data.employee,
        emailSent: response.data.emailSent || false,
        emailWarning: response.data.emailWarning || null,
        emailError: response.data.emailError || null
      };
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message || 'Failed to create employee');
    }
  }
);

export const fetchEmployees = createAsyncThunk(
  'employees/fetchEmployees',
  async (_, thunkAPI) => {
    try {
      // Try admin endpoint first (for HR and Admins to see all employees)
      try {
        const adminResponse = await axios.get('/v1/admin/employee', { withCredentials: true });
        // Admin endpoint returns: { success: true, data: [...], pagination: {...} }
        if (adminResponse.data?.data && Array.isArray(adminResponse.data.data)) {
          return adminResponse.data.data;
        }
      } catch (adminError) {
        // If admin endpoint fails (403/401), try employee endpoint
        if (adminError.response?.status === 403 || adminError.response?.status === 401) {
          const response = await axios.get(`${EMPLOYEE_AUTH_ENDPOINT}/get-all-employees`, { withCredentials: true });
          // Handle different response structures
          if (response.data.employees) {
            return response.data.employees;
          } else if (Array.isArray(response.data)) {
            return response.data;
          } else if (response.data.data && Array.isArray(response.data.data)) {
            return response.data.data;
          }
          return [];
        }
        // Re-throw if it's not a permission error
        throw adminError;
      }
      return [];
    } catch (err) {
      // Removed console.error for production
      return thunkAPI.rejectWithValue(err.response?.data?.message || 'Failed to fetch employees');
    }
  }
);

// Add this new async thunk for deleting an employee
export const deleteEmployee = createAsyncThunk(
  'employees/deleteEmployee',
  async (employeeId, thunkAPI) => {
    try {
      const response = await axios.delete(`${EMPLOYEE_AUTH_ENDPOINT}/delete-employee/${employeeId}`);
      return employeeId; // Return the deleted employee's ID
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message || 'Failed to delete employee');
    }
  }
);

const employeeSlice = createSlice({
  name: 'employees',
  initialState: {
    employees: [],
    status: 'idle',
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(createEmployee.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(createEmployee.fulfilled, (state, action) => {
        state.status = 'succeeded';
        // Handle both old format (just employee) and new format (with email status)
        if (action.payload.employee) {
          state.employees.push(action.payload.employee);
        } else {
          state.employees.push(action.payload);
        }
      })
      .addCase(createEmployee.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(fetchEmployees.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchEmployees.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.employees = action.payload;
      })
      .addCase(fetchEmployees.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // Add cases for deleteEmployee
      .addCase(deleteEmployee.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(deleteEmployee.fulfilled, (state, action) => {
        state.status = 'succeeded';
        // Remove the deleted employee from the state
        state.employees = state.employees.filter(
          employee => employee._id !== action.payload
        );
      })
      .addCase(deleteEmployee.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export default employeeSlice.reducer;