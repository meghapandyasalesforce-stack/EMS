import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../../utils/axios';
import { ADMIN_AUTH_ENDPOINT, EMPLOYEE_AUTH_ENDPOINT } from './../../utils/constant';

export const checkAuthSession = createAsyncThunk(
  'auth/checkAuthSession',
  async (_, { rejectWithValue }) => {
    try {
      // Lightweight session verification used on app bootstrap.
      // If this fails (401/404), caller should treat session as invalid.
      const response = await axios.get('/v1/both/profile-details/get-my-details', {
        withCredentials: true
      });
      return {
        employee: response.data?.employee || null,
        timezoneContext: response.data?.timezoneContext || null,
        timezone: response.data?.timezone || null,
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
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkAuthSession.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(checkAuthSession.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload?.employee ?? action.payload;
        state.error = null;
        state.authChecked = true;
      })
      .addCase(checkAuthSession.rejected, (state, action) => {
        state.loading = false;
        state.user = null;
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

export const { setLoading, setUser } = authSlice.actions;
export default authSlice.reducer;