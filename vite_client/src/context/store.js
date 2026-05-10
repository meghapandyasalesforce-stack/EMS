// store.js
import { configureStore, combineReducers } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import createMigrate from 'redux-persist/lib/createMigrate';

const TEAM_ATTENDANCE_HISTORY_DEFAULT = {
  loading: false,
  error: null,
  records: [],
  total: 0,
  page: 1,
  limit: 25,
  kpis: null,
  dailyTrend: [],
  memberBreakdown: [],
};

const migrations = {
  2: (state) =>
    state
      ? {
          ...state,
          attendance: {
            ...(state.attendance || {}),
            teamAttendanceHistory:
              state.attendance?.teamAttendanceHistory ?? TEAM_ATTENDANCE_HISTORY_DEFAULT,
          },
        }
      : state,
};

// Slices
import authReducer from "./Auth/authSlice";
import projectReducer from "./projectSlice";
import employeeReducer from "./employeeSlice";
import payrollReducer from "./payrollSlice";
import leaveReducer from "./leaveSlice";
import employeeLeaveReducer from "./employeeLeaveSlice";
import attendanceReducer from "./attendanceSlice";
import employeeDetailsReducer from './employeeDetailsSlice';
import notificationReducer from "./notificationSlice"
import forgotPasswordReducer from "./../context/forgotPasswordSlice"
import employeeTaskReducer from "./../context/employeeTaskSlice"
import employeePayrollReducer from "./employeePayrollSlice"
import adminEmployeePayrollReducer from "./adminEmployeePayrollSlice"
import organizationReducer from "./organizationSlice"

// Combine reducers
const rootReducer = combineReducers({
  auth: authReducer,
  project: projectReducer,
  employees: employeeReducer,
  payroll: payrollReducer,
  leave: leaveReducer,
  employeeLeave: employeeLeaveReducer,
  attendance: attendanceReducer,
  employeeDetails: employeeDetailsReducer,
  notifications: notificationReducer,
  forgotPassword: forgotPasswordReducer,
  employeeTask: employeeTaskReducer,
  employeePayroll: employeePayrollReducer,
  adminEmployeePayroll: adminEmployeePayrollReducer,
  organization: organizationReducer
});

// Persistence configuration
const persistConfig = {
  key: 'root',
  version: 2,
  storage,
  migrate: createMigrate(migrations, { debug: false }),
  // Persist auth, employeeDetails, and attendance for session continuity
  whitelist: ['auth', 'employeeDetails', 'attendance'],
};

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Configure store
const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);
export default store;
