import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../../utils/axios';
import { ADMIN_AUTH_ENDPOINT, EMPLOYEE_AUTH_ENDPOINT, UNIFIED_AUTH_ENDPOINT } from './../../utils/constant';
import { isPortalSwitchAllowed, syncPortalsForSession, canSwitchPortals } from '../../utils/portalConfig';
import { resolveSessionAuthUser } from '../../utils/authSessionUtils';

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
    activePortal: null,
    availablePortals: [],
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
    setActivePortal: (state, action) => {
      const portalId = action.payload;
      if (!portalId) {
        state.activePortal = null;
        localStorage.removeItem('activePortal');
        return;
      }

      const maySwitch = canSwitchPortals(
        state.user,
        state.permissionFlags,
        state.roleBuckets
      );
      const isListed = state.availablePortals.some((p) => p.id === portalId);

      if (maySwitch) {
        if (isListed) {
          state.activePortal = portalId;
          localStorage.setItem('activePortal', portalId);
        }
        return;
      }

      const lockedPortal = state.availablePortals[0]?.id;
      if (lockedPortal && portalId === lockedPortal) {
        state.activePortal = portalId;
        localStorage.setItem('activePortal', portalId);
      }
    },
    /** Org-admin only — rejects switches for delegated roles (HR, manager, employee). */
    switchPortal: (state, action) => {
      const portalId = action.payload;
      if (
        !isPortalSwitchAllowed(portalId, {
          user: state.user,
          permissionFlags: state.permissionFlags,
          roleBuckets: state.roleBuckets,
          availablePortals: state.availablePortals,
        })
      ) {
        return;
      }
      state.activePortal = portalId;
      localStorage.setItem('activePortal', portalId);
    },
    setAvailablePortals: (state, action) => {
      state.availablePortals = action.payload || [];
    },
    initializePortals: (state, action) => {
      const { portals = [], activePortal = null } = action.payload || {};
      state.availablePortals = portals;
      state.activePortal = activePortal;
      if (activePortal) {
        localStorage.setItem('activePortal', activePortal);
      }
    },
    clearPortals: (state) => {
      state.activePortal = null;
      state.availablePortals = [];
      localStorage.removeItem('activePortal');
      localStorage.removeItem('availablePortals');
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
        const permissionFlags = action.payload?.permissionFlags || {};
        const resolvedUser = resolveSessionAuthUser(
          action.payload,
          state.user,
          permissionFlags
        );
        if (resolvedUser) {
          state.user = resolvedUser;
        }
        state.permissions = action.payload?.permissions || [];
        state.roleBuckets = action.payload?.roleBuckets || [];
        state.permissionFlags = permissionFlags;
        state.dataScope = action.payload?.dataScope || 'self';
        state.error = null;
        state.authChecked = true;

        const { portals, activePortal } = syncPortalsForSession({
          user: state.user,
          employee: action.payload?.employee || null,
          roleBuckets: state.roleBuckets,
          permissionFlags: state.permissionFlags,
          currentActivePortal: state.activePortal,
        });
        state.availablePortals = portals;
        state.activePortal = activePortal;
        if (activePortal) {
          localStorage.setItem('activePortal', activePortal);
        }
      })
      .addCase(checkAuthSession.rejected, (state, action) => {
        state.loading = false;
        state.user = null;
        state.permissions = [];
        state.roleBuckets = [];
        state.permissionFlags = {};
        state.dataScope = 'self';
        state.activePortal = null;
        state.availablePortals = [];
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
        state.activePortal = null;
        state.availablePortals = [];
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

export const {
  setLoading,
  setUser,
  setAuthPermissions,
  clearAuthPermissions,
  setActivePortal,
  switchPortal,
  setAvailablePortals,
  initializePortals,
  clearPortals,
} = authSlice.actions;
export default authSlice.reducer;
