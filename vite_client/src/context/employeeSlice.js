import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../utils/axios';
import { EMPLOYEE_AUTH_ENDPOINT } from '../utils/constant';
import { getUserRole } from '../utils/authHelper';

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
  async (params = {}, thunkAPI) => {
    try {
      const role = getUserRole();
      const useAdminEndpoint = role === 'admin';
      const page = Number(params.page) > 0 ? Number(params.page) : 1;
      const limit = Number(params.limit) > 0 ? Number(params.limit) : 20;
      const search = typeof params.search === 'string' ? params.search.trim() : '';
      const queryParams = { page, limit };
      if (search) queryParams.search = search;

      const fetchFromAdmin = async () => {
        const adminResponse = await axios.get('/v1/admin/employee', { withCredentials: true, params: queryParams });
        if (adminResponse.data?.data && Array.isArray(adminResponse.data.data)) {
          return {
            employees: adminResponse.data.data,
            pagination: adminResponse.data.pagination || { page, limit, total: adminResponse.data.data.length, pages: 1, hasNext: false, hasPrev: false }
          };
        }
        return { employees: [], pagination: { page, limit, total: 0, pages: 0, hasNext: false, hasPrev: false } };
      };

      const fetchFromEmployee = async () => {
        const response = await axios.get(`${EMPLOYEE_AUTH_ENDPOINT}/get-all-employees`, { withCredentials: true, params: queryParams });
        if (response.data?.data && Array.isArray(response.data.data)) {
          return {
            employees: response.data.data,
            pagination: response.data.pagination || { page, limit, total: response.data.data.length, pages: 1, hasNext: false, hasPrev: false }
          };
        } else if (response.data?.employees && Array.isArray(response.data.employees)) {
          return {
            employees: response.data.employees,
            pagination: { page, limit, total: response.data.employees.length, pages: 1, hasNext: false, hasPrev: false }
          };
        } else if (Array.isArray(response.data)) {
          return {
            employees: response.data,
            pagination: { page, limit, total: response.data.length, pages: 1, hasNext: false, hasPrev: false }
          };
        }
        return { employees: [], pagination: { page, limit, total: 0, pages: 0, hasNext: false, hasPrev: false } };
      };

      if (useAdminEndpoint) {
        return await fetchFromAdmin();
      }

      if (role) {
        return await fetchFromEmployee();
      }

      // Fallback if role is unknown
      try {
        return await fetchFromAdmin();
      } catch (adminError) {
        if (adminError.response?.status === 403 || adminError.response?.status === 401) {
          return await fetchFromEmployee();
        }
        throw adminError;
      }
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
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      pages: 0,
      hasNext: false,
      hasPrev: false
    }
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
        state.employees = action.payload?.employees || [];
        state.pagination = action.payload?.pagination || state.pagination;
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