import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../utils/axios';
import { DEFAULT_TIMEZONE } from '../utils/timezoneOptions';

export const fetchOrganizationTimezone = createAsyncThunk(
  'timezone/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get('/v1/both/organization-timezone', {
        withCredentials: true,
      });
      const data = response.data;
      return {
        timezone: data?.timezone || DEFAULT_TIMEZONE,
        organizationTimezone: data?.organizationTimezone || DEFAULT_TIMEZONE,
        attendanceRuleTimezone: data?.attendanceRuleTimezone ?? null,
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to fetch organization timezone'
      );
    }
  }
);

const timezoneSlice = createSlice({
  name: 'timezone',
  initialState: {
    timezone: DEFAULT_TIMEZONE,
    organizationTimezone: DEFAULT_TIMEZONE,
    attendanceRuleTimezone: null,
    loaded: false,
    loading: false,
    error: null,
  },
  reducers: {
    setTimezoneContext: (state, action) => {
      if (!action.payload) return;
      state.timezone = action.payload.timezone || DEFAULT_TIMEZONE;
      state.organizationTimezone = action.payload.organizationTimezone || DEFAULT_TIMEZONE;
      state.attendanceRuleTimezone = action.payload.attendanceRuleTimezone ?? null;
      state.loaded = true;
    },
    clearTimezoneContext: (state) => {
      state.timezone = DEFAULT_TIMEZONE;
      state.organizationTimezone = DEFAULT_TIMEZONE;
      state.attendanceRuleTimezone = null;
      state.loaded = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOrganizationTimezone.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOrganizationTimezone.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.timezone = action.payload.timezone;
        state.organizationTimezone = action.payload.organizationTimezone;
        state.attendanceRuleTimezone = action.payload.attendanceRuleTimezone;
      })
      .addCase(fetchOrganizationTimezone.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.loaded = true;
      });
  },
});

export const { setTimezoneContext, clearTimezoneContext } = timezoneSlice.actions;
export default timezoneSlice.reducer;
