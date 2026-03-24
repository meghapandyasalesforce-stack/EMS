import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../utils/axios';
import { BOTH_ATTENDANCE_ENDPOINT } from './../utils/constant';
import { getUserRole } from '../utils/authHelper';

// Thunks

export const clockIn = createAsyncThunk(
  "attendance/clockIn",
  async (clockInData, { rejectWithValue }) => {
    try {
      // Ensure latitude and longitude are numbers, not strings
      // Only include location if it's valid (not null, undefined, 0, or NaN)
      const normalizeCoord = (value, isLatitude) => {
        if (value == null || value === '' || value === 'null' || value === 'undefined') {
          return undefined;
        }
        const num = Number(value);
        if (isNaN(num)) {
          return undefined;
        }
        // Validate coordinate ranges
        if (isLatitude) {
          if (num < -90 || num > 90) return undefined; // Invalid latitude
        } else {
          if (num < -180 || num > 180) return undefined; // Invalid longitude
        }
        // Note: We allow 0 as a valid coordinate (though unlikely for real locations)
        // The backend will validate that both aren't 0
        return num;
      };

      const lat = normalizeCoord(clockInData.latitude, true);
      const lng = normalizeCoord(clockInData.longitude, false);
      
      const payload = {
        ...clockInData,
        accuracy: clockInData.accuracy != null ? Number(clockInData.accuracy) : undefined
      };
      
      // Only include location if we have valid coordinates
      // This ensures we don't send invalid data, but also don't remove valid data
      if (lat !== undefined && lng !== undefined && 
          typeof lat === 'number' && typeof lng === 'number' &&
          !isNaN(lat) && !isNaN(lng)) {
        payload.latitude = lat;
        payload.longitude = lng;
      } else {
        // If location was expected but is missing, log warning
      }
      
      // Remove undefined accuracy to avoid sending it
      if (payload.accuracy === undefined) delete payload.accuracy;
      
      const res = await axios.post(
        `${BOTH_ATTENDANCE_ENDPOINT}/clock-in`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      return res.data;
    } catch (err) {
      // Enhanced error handling for location-related errors
      const errorData = err.response?.data;
      let errorMessage = err.response?.data?.message || "Clock-in failed";
      
      // Provide specific error messages
      if (errorData?.code === 'LOCATION_REQUIRED') {
        errorMessage = 'Location is required to clock in. Please enable location services and try again.';
      } else if (errorData?.code === 'OUTSIDE_RADIUS') {
        errorMessage = errorData.message || 'You are outside the allowed check-in radius.';
      }
      
      return rejectWithValue({
        message: errorMessage,
        status: err.response?.status,
        data: err.response?.data
      });
    }
  }
);

export const clockOut = createAsyncThunk(
  'attendance/clockOut',
  async (clockOutData, { rejectWithValue }) => {
    try {
      // Normalize location coordinates similar to clockIn
      const normalizeCoord = (value, isLatitude) => {
        if (value == null || value === '' || value === 'null' || value === 'undefined') {
          return undefined;
        }
        const num = Number(value);
        if (isNaN(num) || num === 0) {
          return undefined;
        }
        // Validate coordinate ranges
        if (isLatitude) {
          if (num < -90 || num > 90) return undefined; // Invalid latitude
        } else {
          if (num < -180 || num > 180) return undefined; // Invalid longitude
        }
        return num;
      };

      const lat = normalizeCoord(clockOutData.latitude, true);
      const lng = normalizeCoord(clockOutData.longitude, false);
      
      const payload = {
        ...clockOutData,
        latitude: lat,
        longitude: lng,
        accuracy: clockOutData.accuracy != null ? Number(clockOutData.accuracy) : undefined
      };
      
      // Remove undefined values to avoid sending them
      if (payload.latitude === undefined) delete payload.latitude;
      if (payload.longitude === undefined) delete payload.longitude;
      if (payload.accuracy === undefined) delete payload.accuracy;
      
      const res = await axios.post(`${BOTH_ATTENDANCE_ENDPOINT}/clock-out`, payload);
      return res.data;
    } catch (err) {
      // Removed console.error for production
      return rejectWithValue({
        message: err.response?.data?.message || "Clock-out failed",
        status: err.response?.status,
        data: err.response?.data
      });
    }
  }
);

export const breakIn = createAsyncThunk(
  'attendance/breakIn',
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${BOTH_ATTENDANCE_ENDPOINT}/break-in`, null);
      return res.data;
    } catch (err) {
      // Removed console.error for production
      return rejectWithValue({
        message: err.response?.data?.message || "Break-in failed",
        status: err.response?.status,
        data: err.response?.data
      });
    }
  }
);

export const breakOut = createAsyncThunk(
  'attendance/breakOut',
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${BOTH_ATTENDANCE_ENDPOINT}/break-out`, null);
      return res.data;
    } catch (err) {
      // Removed console.error for production
      return rejectWithValue({
        message: err.response?.data?.message || "Break-out failed",
        status: err.response?.status,
        data: err.response?.data
      });
    }
  }
);

export const fetchLogs = createAsyncThunk(
  'attendance/fetchLogs',
  async (params, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BOTH_ATTENDANCE_ENDPOINT}/get-logs`, {
        params
      });
      return res.data;
    } catch (err) {
      // Removed console.error for production
      return rejectWithValue({
        message: err.response?.data?.message || "Failed to fetch logs",
        status: err.response?.status,
        data: err.response?.data
      });
    }
  }
);

export const fetchTodayStatus = createAsyncThunk(
  'attendance/fetchTodayStatus',
  async (options = {}, { rejectWithValue }) => {
    try {
      const role = getUserRole();
      const forceAdmin = options?.forceAdmin === true;
      const useMyStatus = !forceAdmin && role && role !== 'admin';

      if (useMyStatus) {
        const res = await axios.get(`${BOTH_ATTENDANCE_ENDPOINT}/my-today-status`);
        return res.data;
      }

      const res = await axios.get(`${BOTH_ATTENDANCE_ENDPOINT}/today-status`);
      return res.data;
    } catch (err) {
      if (!options?.forceAdmin && (err.response?.status === 403 || err.response?.status === 401)) {
        try {
          const res = await axios.get(`${BOTH_ATTENDANCE_ENDPOINT}/my-today-status`);
          return res.data;
        } catch (fallbackError) {
          return rejectWithValue({
            message: fallbackError.response?.data?.message || "Failed to get today status",
            status: fallbackError.response?.status,
            data: fallbackError.response?.data
          });
        }
      }
      // Removed console.error for production
      return rejectWithValue({
        message: err.response?.data?.message || "Failed to get today status",
        status: err.response?.status,
        data: err.response?.data
      });
    }
  }
);

// Employee-only endpoint to get own today session (avoids admin-only route)
export const fetchMyTodayStatus = createAsyncThunk(
  'attendance/fetchMyTodayStatus',
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BOTH_ATTENDANCE_ENDPOINT}/my-today-status`);
      return res.data;
    } catch (err) {
      return rejectWithValue({
        message: err.response?.data?.message || "Failed to get my today status",
        status: err.response?.status,
        data: err.response?.data
      });
    }
  }
);

export const fetchAllAttendanceStats = createAsyncThunk(
  'attendance/fetchAllStats',
  async (params, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BOTH_ATTENDANCE_ENDPOINT}/all-employee-list`, {
        params
      });
      return res.data;
    } catch (err) {
      // Removed console.error for production
      return rejectWithValue({
        message: err.response?.data?.message || "Failed to get stats",
        status: err.response?.status,
        data: err.response?.data
      });
    }
  }
);

export const fetchEmployeeList = createAsyncThunk(
  'attendance/fetchEmployeeList',
  async (params, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BOTH_ATTENDANCE_ENDPOINT}/all-employee-list`, {
        params: {
          department: params?.department,
          includeInactive: params?.includeInactive
        }
      });
      return res.data;
    } catch (err) {
      // Removed console.error for production
      return rejectWithValue({
        message: err.response?.data?.message || "Failed to get employee list",
        status: err.response?.status,
        data: err.response?.data
      });
    }
  }
);

export const fetchEmployeeAttendanceDetails = createAsyncThunk(
  'attendance/fetchEmployeeDetails',
  async ({ employeeId, params }, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BOTH_ATTENDANCE_ENDPOINT}/employee/${employeeId}/attendance`, {
        params: {
          startDate: params?.startDate,
          endDate: params?.endDate
        }
      });
      return res.data;
    } catch (err) {
      // Removed console.error for production
      return rejectWithValue({
        message: err.response?.data?.message || "Failed to get employee details",
        status: err.response?.status,
        data: err.response?.data
      });
    }
  }
);

// Slice

const attendanceSlice = createSlice({
  name: 'attendance',
  initialState: {
    loading: false,
    error: null,
    sessions: [],
    summary: null,
    dailyStats: null,
    todayStatus: [],
    adminStats: [],
    breakSession: null,
    employeeList: [],
    employeeAttendanceDetails: null,
    employeeStats: null
  },
  reducers: {
    resetAttendance: (state) => {
      state.loading = false;
      state.error = null;
      state.sessions = [];
      state.summary = null;
      state.dailyStats = null;
      state.todayStatus = [];
      state.adminStats = [];
      state.breakSession = null;
      state.employeeList = [];
      state.employeeDetails = null;
      state.employeeStats = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearEmployeeDetails: (state) => {
      state.employeeDetails = null;
      state.employeeStats = null;
    }
  },
  extraReducers: (builder) => {
    const pending = (state) => {
      state.loading = true;
      state.error = null;
    };

    const rejected = (state, action) => {
      state.loading = false;
      state.error = action.payload;
    };

    builder
      .addCase(clockIn.pending, pending)
      .addCase(clockIn.fulfilled, (state, action) => {
        state.loading = false;
        // Handle both response formats: direct attendance object or wrapped response
        const attendance = action.payload.attendance || action.payload;
        // Ensure we have a valid attendance object
        if (attendance && (attendance._id || attendance.id)) {
          state.sessions = [attendance];
        }
        state.error = null;
      })
      .addCase(clockIn.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        // If the error includes a session (already checked in), use it
        if (action.payload?.data?.session) {
          // Removed console.log for production
          state.sessions = [action.payload.data.session];
        } else {
          // Removed console.log for production
        }
      })

      .addCase(clockOut.pending, pending)
      .addCase(clockOut.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        const payload = action.payload?.attendance || action.payload;
        if (!payload || (!payload._id && !payload.id)) return;
        const payloadId = String(payload._id || payload.id);
        const index = state.sessions.findIndex(
          s => String(s._id || s.id) === payloadId
        );
        if (index !== -1) {
          state.sessions[index] = payload;
        } else {
          state.sessions = [payload];
        }
      })
      .addCase(clockOut.rejected, rejected)

      .addCase(breakIn.pending, pending)
      .addCase(breakIn.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        const attendance = action.payload?.attendance || action.payload;
        if (attendance && (attendance._id || attendance.id)) {
          const payloadId = String(attendance._id || attendance.id);
          const index = state.sessions.findIndex(
            s => String(s._id || s.id) === payloadId
          );
          if (index !== -1) {
            state.sessions[index] = attendance;
          } else {
            state.sessions = [attendance];
          }
          // Set breakSession to the active break object (for "On break since" display)
          const breaks = attendance.breaks || [];
          const activeBreak = breaks.find(b => b.breakIn && !b.breakOut) || breaks[breaks.length - 1];
          state.breakSession = activeBreak && activeBreak.breakIn ? activeBreak : null;
        } else {
          state.breakSession = null;
        }
      })
      .addCase(breakIn.rejected, rejected)

      .addCase(breakOut.pending, pending)
      .addCase(breakOut.fulfilled, (state, action) => {
        state.loading = false;
        state.breakSession = null;
        const payload = action.payload?.attendance || action.payload;
        if (payload && (payload._id || payload.id)) {
          const payloadId = String(payload._id || payload.id);
          const index = state.sessions.findIndex(
            s => String(s._id || s.id) === payloadId
          );
          if (index !== -1) state.sessions[index] = payload;
        }
      })
      .addCase(breakOut.rejected, rejected)

      .addCase(fetchLogs.pending, pending)
      .addCase(fetchLogs.fulfilled, (state, action) => {
        state.loading = false;
        state.summary = action.payload.summary || {};
        state.dailyStats = action.payload.dailyStats || {};
        state.error = null;
        
        // Update sessions with fetched data
        const newSessions = action.payload.sessions || [];
        
        // Always update sessions if we got data from API
        // Only keep existing sessions if API returns empty array AND we have existing sessions
        if (newSessions.length > 0) {
          // Removed console.log for production
          state.sessions = newSessions;
        } else if (state.sessions.length === 0) {
          // Only clear if we have no existing sessions and no new data
          // Removed console.log for production
        }
        
        // Find current session and break session from sessions state
        const currentSession = state.sessions.find(session => !session.clockOut);
        if (currentSession) {
          // Check if user is on break
          const currentBreak = currentSession.breaks && currentSession.breaks.length > 0 
            ? currentSession.breaks[currentSession.breaks.length - 1]
            : null;
          
          if (currentBreak && currentBreak.breakIn && !currentBreak.breakOut) {
            state.breakSession = currentBreak;
          } else {
            state.breakSession = null;
          }
        } else {
          state.breakSession = null;
        }
      })
      .addCase(fetchLogs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        // Don't clear sessions if fetch fails - keep existing state
      })

      .addCase(fetchTodayStatus.pending, pending)
      .addCase(fetchTodayStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.todayStatus = action.payload || [];
      })
      .addCase(fetchTodayStatus.rejected, rejected)

      .addCase(fetchMyTodayStatus.pending, pending)
      .addCase(fetchMyTodayStatus.fulfilled, (state, action) => {
        state.loading = false;
        const session = action.payload?.session;
        if (session) {
          state.sessions = [session];
        }
      })
      .addCase(fetchMyTodayStatus.rejected, rejected)

      .addCase(fetchAllAttendanceStats.pending, pending)
      .addCase(fetchAllAttendanceStats.fulfilled, (state, action) => {
        state.loading = false;
        state.adminStats = action.payload?.stats || [];
      })
      .addCase(fetchAllAttendanceStats.rejected, rejected)

      .addCase(fetchEmployeeList.pending, pending)
      .addCase(fetchEmployeeList.fulfilled, (state, action) => {
        state.loading = false;
        state.employeeList = action.payload?.employees || [];
      })
      .addCase(fetchEmployeeList.rejected, rejected)

      .addCase(fetchEmployeeAttendanceDetails.pending, pending)
      .addCase(fetchEmployeeAttendanceDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.employeeDetails = action.payload?.employee || null;
        state.employeeStats = {
          period: action.payload?.period,
          statistics: action.payload?.statistics,
          recentRecords: action.payload?.recentRecords
        };
      })
      .addCase(fetchEmployeeAttendanceDetails.rejected, rejected);
  }
});

export const { resetAttendance, clearEmployeeDetails, clearError } = attendanceSlice.actions;
export default attendanceSlice.reducer;