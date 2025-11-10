import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../../utils/axios';
import { ADMIN_AUTH_ENDPOINT, EMPLOYEE_AUTH_ENDPOINT } from './../../utils/constant';

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
      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.loading = false;
        state.user = null;
        state.error = null;
        // Attendance will be cleared by redux-persist purge in logout handler
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.loading = false;
        state.user = null; // Still clear user even if API fails
        state.error = action.payload;
      });
  },
});

export const { setLoading, setUser } = authSlice.actions;
export default authSlice.reducer;