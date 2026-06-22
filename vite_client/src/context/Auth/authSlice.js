import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../../utils/axios';
import { ADMIN_AUTH_ENDPOINT, EMPLOYEE_AUTH_ENDPOINT, UNIFIED_AUTH_ENDPOINT } from './../../utils/constant';

const resolveSessionUser = (payload, existingUser) => {
  if (payload?.employee) {
    return { ...payload.employee, role: payload.employee.role || 'employee' };
  }
  if (payload?.user) {
    return { ...payload.user, role: payload.user.role || 'admin' };
  }
  return existingUser || null;
};

export const checkAuthSession = createAsyncThunk(
  'auth/checkAuthSession',
  async (_, { rejectWithValue }) => {
    try {
      const permRes = await axios.get(`${UNIFIED_AUTH_ENDPOINT}/permissions`, {
        withCredentials: true,
      });
      const permData = permRes?.data?.data || permRes?.data || {};

      let employee = null;
      let user = null;
      let timezoneContext = null;
      let timezone = null;

      try {
        const profileRes = await axios.get('/v1/both/profile-details/get-my-details', {
          withCredentials: true,
        });
        employee = profileRes.data?.employee || null;
        user = profileRes.data?.user || null;
        timezoneContext = profileRes.data?.timezoneContext || null;
        timezone = profileRes.data?.timezone || null;
      } catch (profileError) {
        const role = localStorage.getItem('role');
        if (role === 'employee') {
          throw profileError;
        }
      }

      return {
        employee,
        user,
        timezoneContext,
        timezone,
        permissions: permData.permissions || [],
        roleBuckets: permData.roleBuckets || [],
        permissionFlags: permData.permissionFlags || permData.flags || {},
        dataScope: permData.dataScope || 'self',
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Session invalid');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (userRole, { rejectWithValue }) => {
    try {
      let endpoint = '';
      
      // Determine endpoint based on user role from localStorage or parameter
      // SECURITY: Use role from JWT token or localStorage, not email domain
      const role = userRole || localStorage.getItem('role') || 'employee';
      
      if (role === 'admin') {
        endpoint = `${ADMIN_AUTH_ENDPOINT}/logout`;
      } else {
        endpoint = `${EMPLOYEE_AUTH_ENDPOINT}/logout`;
      }

      await axios.post(endpoint, {}, {
        withCredentials: true
      });
      return true;
    } catch (error) {
      // Removed console.error for production
      return rejectWithValue(error.response?.data?.message || 'Logout failed');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    loading: false,
    user: null,
    permissions: [],
    roleBuckets: [],
    permissionFlags: {},
    dataScope: 'self',
    error: null,
    authChecked: false,
  },
  reducers: {
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setUser: (state, action) => {
      state.user = action.payload;
    },
    setAuthPermissions: (state, action) => {
      const p = action.payload || {};
      state.permissions = p.permissions || [];
      state.roleBuckets = p.roleBuckets || [];
      state.permissionFlags = p.permissionFlags || {};
      state.dataScope = p.dataScope || 'self';
    },
    clearAuthPermissions: (state) => {
      state.permissions = [];
      state.roleBuckets = [];
      state.permissionFlags = {};
      state.dataScope = 'self';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkAuthSession.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(checkAuthSession.fulfilled, (state, action) => {
        state.loading = false;
        const resolvedUser = resolveSessionUser(action.payload, state.user);
        if (resolvedUser) {
          state.user = resolvedUser;
        }
        state.permissions = action.payload?.permissions || [];
        state.roleBuckets = action.payload?.roleBuckets || [];
        state.permissionFlags = action.payload?.permissionFlags || {};
        state.dataScope = action.payload?.dataScope || 'self';
        state.error = null;
        state.authChecked = true;
      })
      .addCase(checkAuthSession.rejected, (state, action) => {
        state.loading = false;
        state.user = null;
        state.permissions = [];
        state.roleBuckets = [];
        state.permissionFlags = {};
        state.dataScope = 'self';
        state.error = action.payload || null;
        state.authChecked = true;
      })
      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.loading = false;
        state.user = null;
        state.permissions = [];
        state.roleBuckets = [];
        state.permissionFlags = {};
        state.dataScope = 'self';
        state.error = null;
        state.authChecked = true;
        // Attendance will be cleared by redux-persist purge in logout handler
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.loading = false;
        state.user = null; // Still clear user even if API fails
        state.error = action.payload;
        state.authChecked = true;
      });
  },
});

export const { setLoading, setUser, setAuthPermissions, clearAuthPermissions } = authSlice.actions;
export default authSlice.reducer;
