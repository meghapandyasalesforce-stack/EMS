import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../utils/axios';
import { ORGANIZATION_ENDPOINT } from '../utils/constant';
import { applyBranding } from '../utils/theme';

// Async thunks
export const fetchOrganizationProfile = createAsyncThunk(
    'organization/fetchProfile',
    async (_, { rejectWithValue }) => {
        try {
            const response = await axios.get(`${ORGANIZATION_ENDPOINT}/profile`);
            return response.data.organization;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch organization profile');
        }
    }
);

export const updateOrganizationProfile = createAsyncThunk(
    'organization/updateProfile',
    async (data, { rejectWithValue }) => {
        try {
            const response = await axios.put(`${ORGANIZATION_ENDPOINT}/profile`, data);
            return response.data.organization;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to update organization profile');
        }
    }
);

export const uploadOrganizationLogo = createAsyncThunk(
    'organization/uploadLogo',
    async (file, { rejectWithValue }) => {
        try {
            const formData = new FormData();
            formData.append('logo', file);
            const response = await axios.post(`${ORGANIZATION_ENDPOINT}/logo`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            return response.data.logo;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to upload logo');
        }
    }
);

export const deleteOrganizationLogo = createAsyncThunk(
    'organization/deleteLogo',
    async (_, { rejectWithValue }) => {
        try {
            await axios.delete(`${ORGANIZATION_ENDPOINT}/logo`);
            return null;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to delete logo');
        }
    }
);

export const updateOrganizationSettings = createAsyncThunk(
    'organization/updateSettings',
    async (settings, { rejectWithValue }) => {
        try {
            const response = await axios.put(`${ORGANIZATION_ENDPOINT}/settings`, settings);
            return {
                settings: response.data.settings,
                timezone: response.data.timezone,
                migrationCompleted: response.data.migrationCompleted || false
            };
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to update settings');
        }
    }
);

export const updateSubscriptionPlan = createAsyncThunk(
    'organization/updateSubscription',
    async (data, { rejectWithValue }) => {
        try {
            const response = await axios.put(`${ORGANIZATION_ENDPOINT}/subscription`, data);
            return response.data.organization;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to update subscription');
        }
    }
);

export const fetchOrganizationStatistics = createAsyncThunk(
    'organization/fetchStatistics',
    async (_, { rejectWithValue }) => {
        try {
            const response = await axios.get(`${ORGANIZATION_ENDPOINT}/statistics`);
            return response.data.statistics;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch statistics');
        }
    }
);

export const fetchOrganizationUsers = createAsyncThunk(
    'organization/fetchUsers',
    async (params = {}, { rejectWithValue }) => {
        try {
            const response = await axios.get(`${ORGANIZATION_ENDPOINT}/users`, { params });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch users');
        }
    }
);

export const fetchOrganizationActivity = createAsyncThunk(
    'organization/fetchActivity',
    async (params = {}, { rejectWithValue }) => {
        try {
            const response = await axios.get(`${ORGANIZATION_ENDPOINT}/activity`, { params });
            return response.data.activity;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch activity');
        }
    }
);

const organizationSlice = createSlice({
    name: 'organization',
    initialState: {
        profile: null,
        statistics: null,
        users: [],
        activity: null,
        loading: false,
        error: null,
        usersPagination: null,
        migrationCompleted: false
    },
    reducers: {
        clearOrganization: (state) => {
            state.profile = null;
            state.statistics = null;
            state.users = [];
            state.activity = null;
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        // Fetch Profile
        builder
            .addCase(fetchOrganizationProfile.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchOrganizationProfile.fulfilled, (state, action) => {
                state.loading = false;
                state.profile = action.payload;
                // Apply organization branding (falls back to Stitch Kinetic defaults)
                applyBranding(action.payload?.branding || {});
            })
            .addCase(fetchOrganizationProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });

        // Update Profile
        builder
            .addCase(updateOrganizationProfile.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateOrganizationProfile.fulfilled, (state, action) => {
                state.loading = false;
                state.profile = action.payload;
            })
            .addCase(updateOrganizationProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });

        // Upload Logo
        builder
            .addCase(uploadOrganizationLogo.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(uploadOrganizationLogo.fulfilled, (state, action) => {
                state.loading = false;
                if (state.profile) {
                    state.profile.logo = action.payload;
                }
            })
            .addCase(uploadOrganizationLogo.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });

        // Delete Logo
        builder
            .addCase(deleteOrganizationLogo.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(deleteOrganizationLogo.fulfilled, (state) => {
                state.loading = false;
                if (state.profile) {
                    state.profile.logo = null;
                }
            })
            .addCase(deleteOrganizationLogo.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });

        // Update Settings
        builder
            .addCase(updateOrganizationSettings.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateOrganizationSettings.fulfilled, (state, action) => {
                state.loading = false;
                if (state.profile) {
                    state.profile.settings = action.payload.settings || action.payload;
                    if (action.payload.timezone) {
                        state.profile.timezone = action.payload.timezone;
                    }
                }
                // Store migration status if available
                if (action.payload.migrationCompleted !== undefined) {
                    state.migrationCompleted = action.payload.migrationCompleted;
                }
            })
            .addCase(updateOrganizationSettings.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });

        // Update Subscription
        builder
            .addCase(updateSubscriptionPlan.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateSubscriptionPlan.fulfilled, (state, action) => {
                state.loading = false;
                if (state.profile) {
                    state.profile.subscriptionPlan = action.payload.subscriptionPlan;
                    state.profile.maxEmployees = action.payload.maxEmployees;
                }
            })
            .addCase(updateSubscriptionPlan.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });

        // Fetch Statistics
        builder
            .addCase(fetchOrganizationStatistics.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchOrganizationStatistics.fulfilled, (state, action) => {
                state.loading = false;
                state.statistics = action.payload;
            })
            .addCase(fetchOrganizationStatistics.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });

        // Fetch Users
        builder
            .addCase(fetchOrganizationUsers.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchOrganizationUsers.fulfilled, (state, action) => {
                state.loading = false;
                state.users = action.payload.users;
                state.usersPagination = action.payload.pagination;
            })
            .addCase(fetchOrganizationUsers.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });

        // Fetch Activity
        builder
            .addCase(fetchOrganizationActivity.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchOrganizationActivity.fulfilled, (state, action) => {
                state.loading = false;
                state.activity = action.payload;
            })
            .addCase(fetchOrganizationActivity.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    }
});

export const { clearOrganization } = organizationSlice.actions;
export default organizationSlice.reducer;

