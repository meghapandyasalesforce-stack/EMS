import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../utils/axios';
import { PLATFORM_AUTH_ENDPOINT, PLATFORM_ENDPOINT } from '../utils/constant';

export const checkPlatformSession = createAsyncThunk(
  'platform/checkSession',
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${PLATFORM_AUTH_ENDPOINT}/me`, {
        withCredentials: true,
        skipAuthRedirect: true,
      });
      return res.data?.user || res.data?.data?.user || null;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Not authenticated');
    }
  }
);

export const platformLogin = createAsyncThunk(
  'platform/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const res = await axios.post(
        `${PLATFORM_AUTH_ENDPOINT}/login`,
        { email, password },
        { withCredentials: true }
      );
      if (!res.data?.success) {
        return rejectWithValue(res.data?.message || 'Login failed');
      }
      if (res.data.csrfToken) {
        try {
          localStorage.setItem('csrfToken', res.data.csrfToken);
        } catch {
          // ignore
        }
      }
      if (res.data.user?.role) {
        try {
          localStorage.setItem('role', res.data.user.role);
        } catch {
          // ignore
        }
      }
      return res.data.user;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Login failed');
    }
  }
);

export const platformLogout = createAsyncThunk(
  'platform/logout',
  async (_, { rejectWithValue }) => {
    try {
      await axios.post(`${PLATFORM_AUTH_ENDPOINT}/logout`, {}, { withCredentials: true });
      try {
        localStorage.removeItem('csrfToken');
        localStorage.removeItem('role');
      } catch {
        // ignore
      }
      return true;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Logout failed');
    }
  }
);

export const fetchPlatformOrganizations = createAsyncThunk(
  'platform/fetchOrganizations',
  async (params = {}, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${PLATFORM_ENDPOINT}/organizations`, {
        params,
        withCredentials: true,
      });
      return {
        organizations: res.data.organizations || [],
        pagination: res.data.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 },
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to load organizations');
    }
  }
);

export const fetchPlatformOrganization = createAsyncThunk(
  'platform/fetchOrganization',
  async (orgId, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${PLATFORM_ENDPOINT}/organizations/${orgId}`, {
        withCredentials: true,
      });
      return {
        organization: res.data.organization,
        usage: res.data.usage,
        featureLabels: res.data.featureLabels || {},
        availableFeatures: res.data.availableFeatures || [],
        admins: res.data.admins || [],
        auditLogs: res.data.auditLogs || [],
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to load organization');
    }
  }
);

export const fetchPlatformDashboard = createAsyncThunk(
  'platform/fetchDashboard',
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${PLATFORM_ENDPOINT}/dashboard`, { withCredentials: true });
      return {
        stats: res.data.stats || {},
        recentOrganizations: res.data.recentOrganizations || [],
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to load dashboard');
    }
  }
);

export const fetchPlatformOperators = createAsyncThunk(
  'platform/fetchOperators',
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${PLATFORM_ENDPOINT}/operators`, { withCredentials: true });
      return {
        operators: res.data.operators || [],
        assignableRoles: res.data.assignableRoles || [],
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to load operators');
    }
  }
);

export const fetchFeatureCatalog = createAsyncThunk(
  'platform/fetchFeatureCatalog',
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${PLATFORM_ENDPOINT}/feature-catalog`, { withCredentials: true });
      return {
        catalog: res.data.catalog || [],
        featureLabels: res.data.featureLabels || {},
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to load feature catalog');
    }
  }
);

export const fetchPlatformAuditLogs = createAsyncThunk(
  'platform/fetchAuditLogs',
  async (params = {}, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${PLATFORM_ENDPOINT}/audit-logs`, {
        params,
        withCredentials: true,
      });
      return {
        auditLogs: res.data.auditLogs || [],
        pagination: res.data.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 },
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to load audit logs');
    }
  }
);

export const createPlatformOperator = createAsyncThunk(
  'platform/createOperator',
  async (payload, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${PLATFORM_ENDPOINT}/operators`, payload, {
        withCredentials: true,
      });
      return res.data.operator;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create operator');
    }
  }
);

export const updatePlatformOperator = createAsyncThunk(
  'platform/updateOperator',
  async ({ userId, payload }, { rejectWithValue }) => {
    try {
      const res = await axios.patch(`${PLATFORM_ENDPOINT}/operators/${userId}`, payload, {
        withCredentials: true,
      });
      return res.data.operator;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update operator');
    }
  }
);

export const createPlatformOrganization = createAsyncThunk(
  'platform/createOrganization',
  async (payload, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${PLATFORM_ENDPOINT}/organizations`, payload, {
        withCredentials: true,
      });
      return res.data.organization;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create organization');
    }
  }
);

export const updatePlatformPlan = createAsyncThunk(
  'platform/updatePlan',
  async ({ planId, payload }, { rejectWithValue }) => {
    try {
      const res = await axios.patch(`${PLATFORM_ENDPOINT}/plans/${planId}`, payload, {
        withCredentials: true,
      });
      return {
        plan: res.data.plan,
        plans: res.data.plans,
        featureLabels: res.data.featureLabels || {},
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update plan');
    }
  }
);

export const extendPlatformTrial = createAsyncThunk(
  'platform/extendTrial',
  async ({ orgId, days }, { rejectWithValue }) => {
    try {
      const res = await axios.post(
        `${PLATFORM_ENDPOINT}/organizations/${orgId}/extend-trial`,
        { days },
        { withCredentials: true }
      );
      return res.data.organization;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to extend trial');
    }
  }
);

export const softDeletePlatformOrganization = createAsyncThunk(
  'platform/softDeleteOrganization',
  async (orgId, { rejectWithValue }) => {
    try {
      const res = await axios.post(
        `${PLATFORM_ENDPOINT}/organizations/${orgId}/soft-delete`,
        {},
        { withCredentials: true }
      );
      return res.data.organization;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete organization');
    }
  }
);

export const restorePlatformOrganization = createAsyncThunk(
  'platform/restoreOrganization',
  async (orgId, { rejectWithValue }) => {
    try {
      const res = await axios.post(
        `${PLATFORM_ENDPOINT}/organizations/${orgId}/restore`,
        {},
        { withCredentials: true }
      );
      return res.data.organization;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to restore organization');
    }
  }
);

export const updatePlatformAdmin = createAsyncThunk(
  'platform/updateAdmin',
  async ({ orgId, userId, payload }, { rejectWithValue }) => {
    try {
      const res = await axios.patch(
        `${PLATFORM_ENDPOINT}/organizations/${orgId}/admins/${userId}`,
        payload,
        { withCredentials: true }
      );
      return res.data.admin;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update admin');
    }
  }
);

export const fetchPlatformPlans = createAsyncThunk(
  'platform/fetchPlans',
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${PLATFORM_ENDPOINT}/plans`, { withCredentials: true });
      return {
        plans: res.data.plans || [],
        featureLabels: res.data.featureLabels || {},
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to load plans');
    }
  }
);

export const updatePlatformSubscription = createAsyncThunk(
  'platform/updateSubscription',
  async ({ orgId, payload }, { rejectWithValue }) => {
    try {
      const res = await axios.patch(
        `${PLATFORM_ENDPOINT}/organizations/${orgId}/subscription`,
        payload,
        { withCredentials: true }
      );
      return res.data.organization;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update subscription');
    }
  }
);

export const updatePlatformFeatures = createAsyncThunk(
  'platform/updateFeatures',
  async ({ orgId, features, replace = false }, { rejectWithValue }) => {
    try {
      const res = await axios.patch(
        `${PLATFORM_ENDPOINT}/organizations/${orgId}/features`,
        { features, replace },
        { withCredentials: true }
      );
      return res.data.organization;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update features');
    }
  }
);

export const updatePlatformOrganization = createAsyncThunk(
  'platform/updateOrganization',
  async ({ orgId, payload }, { rejectWithValue }) => {
    try {
      const res = await axios.patch(
        `${PLATFORM_ENDPOINT}/organizations/${orgId}`,
        payload,
        { withCredentials: true }
      );
      return res.data.organization;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update organization');
    }
  }
);

const platformSlice = createSlice({
  name: 'platform',
  initialState: {
    user: null,
    sessionChecked: false,
    loading: false,
    error: null,
    organizations: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
    currentOrg: null,
    usage: null,
    admins: [],
    auditLogs: [],
    plans: [],
    featureLabels: {},
    availableFeatures: [],
    dashboardStats: null,
    recentOrganizations: [],
    operators: [],
    assignableRoles: [],
    featureCatalog: [],
    globalAuditLogs: [],
    globalAuditPagination: { page: 1, limit: 50, total: 0, totalPages: 1 },
  },
  reducers: {
    clearPlatformError: (state) => {
      state.error = null;
    },
    clearCurrentOrg: (state) => {
      state.currentOrg = null;
      state.usage = null;
      state.admins = [];
      state.auditLogs = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkPlatformSession.pending, (state) => {
        state.loading = true;
      })
      .addCase(checkPlatformSession.fulfilled, (state, action) => {
        state.loading = false;
        state.sessionChecked = true;
        state.user = action.payload;
        state.error = null;
      })
      .addCase(checkPlatformSession.rejected, (state) => {
        state.loading = false;
        state.sessionChecked = true;
        state.user = null;
      })
      .addCase(platformLogin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(platformLogin.fulfilled, (state, action) => {
        state.loading = false;
        state.sessionChecked = true;
        state.user = action.payload;
      })
      .addCase(platformLogin.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(platformLogout.fulfilled, (state) => {
        state.user = null;
        state.organizations = [];
        state.currentOrg = null;
        state.usage = null;
        state.admins = [];
        state.auditLogs = [];
        state.dashboardStats = null;
        state.operators = [];
      })
      .addCase(fetchPlatformOrganizations.fulfilled, (state, action) => {
        state.organizations = action.payload.organizations;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchPlatformOrganization.fulfilled, (state, action) => {
        state.currentOrg = action.payload.organization;
        state.usage = action.payload.usage;
        state.featureLabels = action.payload.featureLabels;
        state.availableFeatures = action.payload.availableFeatures;
        state.admins = action.payload.admins || [];
        state.auditLogs = action.payload.auditLogs || [];
      })
      .addCase(fetchPlatformDashboard.fulfilled, (state, action) => {
        state.dashboardStats = action.payload.stats;
        state.recentOrganizations = action.payload.recentOrganizations;
      })
      .addCase(fetchPlatformOperators.fulfilled, (state, action) => {
        state.operators = action.payload.operators || [];
        state.assignableRoles = action.payload.assignableRoles || [];
      })
      .addCase(fetchFeatureCatalog.fulfilled, (state, action) => {
        state.featureCatalog = action.payload.catalog || [];
        state.featureLabels = {
          ...state.featureLabels,
          ...action.payload.featureLabels,
        };
      })
      .addCase(fetchPlatformAuditLogs.fulfilled, (state, action) => {
        state.globalAuditLogs = action.payload.auditLogs || [];
        state.globalAuditPagination = action.payload.pagination;
      })
      .addCase(fetchPlatformPlans.fulfilled, (state, action) => {
        state.plans = action.payload.plans;
        state.featureLabels = {
          ...state.featureLabels,
          ...action.payload.featureLabels,
        };
      })
      .addCase(updatePlatformPlan.fulfilled, (state, action) => {
        if (Array.isArray(action.payload.plans) && action.payload.plans.length) {
          state.plans = action.payload.plans.map((p) => ({
            id: p.planId || p.id,
            ...p,
            id: p.planId || p.id,
          }));
        } else if (action.payload.plan) {
          state.plans = state.plans.map((p) =>
            p.id === action.payload.plan.id ? { ...p, ...action.payload.plan } : p
          );
        }
        if (action.payload.featureLabels) {
          state.featureLabels = {
            ...state.featureLabels,
            ...action.payload.featureLabels,
          };
        }
      })
      .addCase(updatePlatformSubscription.fulfilled, (state, action) => {
        if (state.currentOrg && action.payload) {
          state.currentOrg = { ...state.currentOrg, ...action.payload };
        }
      })
      .addCase(extendPlatformTrial.fulfilled, (state, action) => {
        if (state.currentOrg && action.payload) {
          state.currentOrg = { ...state.currentOrg, ...action.payload };
        }
      })
      .addCase(updatePlatformFeatures.fulfilled, (state, action) => {
        if (state.currentOrg && action.payload) {
          state.currentOrg = {
            ...state.currentOrg,
            featureOverrides: action.payload.featureOverrides,
            planFeatures: action.payload.planFeatures,
            effectiveFeatures: action.payload.effectiveFeatures,
            entitlement: action.payload.entitlement || state.currentOrg.entitlement,
          };
        }
      })
      .addCase(updatePlatformOrganization.fulfilled, (state, action) => {
        if (state.currentOrg && action.payload) {
          state.currentOrg = { ...state.currentOrg, ...action.payload };
        }
      })
      .addCase(softDeletePlatformOrganization.fulfilled, (state, action) => {
        if (state.currentOrg && action.payload) {
          state.currentOrg = { ...state.currentOrg, ...action.payload };
        }
      })
      .addCase(restorePlatformOrganization.fulfilled, (state, action) => {
        if (state.currentOrg && action.payload) {
          state.currentOrg = { ...state.currentOrg, ...action.payload };
        }
      })
      .addCase(updatePlatformAdmin.fulfilled, (state, action) => {
        if (action.payload?.id) {
          state.admins = state.admins.map((a) =>
            a.id === action.payload.id ? { ...a, ...action.payload } : a
          );
        }
      });
  },
});

export const { clearPlatformError, clearCurrentOrg } = platformSlice.actions;
export default platformSlice.reducer;
