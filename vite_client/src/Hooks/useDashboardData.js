import { useQuery } from '@tanstack/react-query';
import axios from '../utils/axios';
import { handleApiError } from '../utils/errorHandler';
import { retryAxios } from '../utils/retry';

/**
 * React Query hook for fetching dashboard data with caching
 */

/**
 * Fetch employees data
 */
export const useEmployees = (options = {}) => {
  return useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      try {
        const response = await retryAxios(() => 
          axios.get('/v1/admin/employee', { withCredentials: true }),
          { maxRetries: 2, delay: 500 }
        );
        return response.data?.employees || [];
      } catch (error) {
        // Try employee endpoint as fallback
        if (error.response?.status === 403 || error.response?.status === 401) {
          try {
            const response = await retryAxios(() => 
              axios.get('/v1/employee', { withCredentials: true }),
              { maxRetries: 2, delay: 500 }
            );
            return response.data?.employees || [];
          } catch (fallbackError) {
            handleApiError(fallbackError, { context: 'Employees', showToast: false });
            return [];
          }
        }
        handleApiError(error, { context: 'Employees', showToast: false });
        return [];
      }
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    ...options,
  });
};

/**
 * Fetch projects data
 */
export const useProjects = (options = {}) => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      try {
        const response = await retryAxios(() => 
          axios.get('/v1/admin/project', { withCredentials: true }),
          { maxRetries: 2, delay: 500 }
        );
        return response.data?.projects || [];
      } catch (error) {
        handleApiError(error, { context: 'Projects', showToast: false });
        return [];
      }
    },
    staleTime: 1000 * 60 * 2,
    ...options,
  });
};

/**
 * Fetch payroll data
 */
export const usePayrolls = (options = {}) => {
  return useQuery({
    queryKey: ['payrolls'],
    queryFn: async () => {
      try {
        const response = await retryAxios(() => 
          axios.get('/v1/admin/payroll', { withCredentials: true }),
          { maxRetries: 2, delay: 500 }
        );
        return response.data?.payrolls || [];
      } catch (error) {
        handleApiError(error, { context: 'Payrolls', showToast: false });
        return [];
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes (payroll changes less frequently)
    ...options,
  });
};

/**
 * Fetch leaves data
 */
export const useLeaves = (options = {}) => {
  return useQuery({
    queryKey: ['leaves'],
    queryFn: async () => {
      try {
        const response = await retryAxios(() => 
          axios.get('/v1/admin/leave', { withCredentials: true }),
          { maxRetries: 2, delay: 500 }
        );
        return response.data?.leaves || [];
      } catch (error) {
        handleApiError(error, { context: 'Leaves', showToast: false });
        return [];
      }
    },
    staleTime: 1000 * 60 * 2,
    ...options,
  });
};

/**
 * Fetch expenses data
 */
export const useExpenses = (options = {}) => {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      try {
        const response = await retryAxios(() => 
          axios.get('/v1/both/expense', { withCredentials: true }),
          { maxRetries: 2, delay: 500 }
        );
        return response.data?.expenses || [];
      } catch (error) {
        handleApiError(error, { context: 'Expenses', showToast: false });
        return [];
      }
    },
    staleTime: 1000 * 60 * 2,
    ...options,
  });
};

/**
 * Fetch tasks data
 */
export const useTasks = (options = {}) => {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      try {
        const response = await retryAxios(() => 
          axios.get('/v1/both/project-task', { withCredentials: true }),
          { maxRetries: 2, delay: 500 }
        );
        return response.data?.tasks || [];
      } catch (error) {
        handleApiError(error, { context: 'Tasks', showToast: false });
        return [];
      }
    },
    staleTime: 1000 * 60 * 1, // 1 minute (tasks change frequently)
    ...options,
  });
};

/**
 * Fetch employees on break
 */
export const useEmployeesOnBreak = (options = {}) => {
  return useQuery({
    queryKey: ['employees-on-break'],
    queryFn: async () => {
      try {
        const response = await retryAxios(() => 
          axios.get('/v1/both/attendance/employees-on-break', { withCredentials: true }),
          { maxRetries: 2, delay: 500 }
        );
        return response.data?.employees || [];
      } catch (error) {
        handleApiError(error, { context: 'Employees on Break', showToast: false });
        return [];
      }
    },
    staleTime: 1000 * 30, // 30 seconds (real-time data)
    refetchInterval: 1000 * 30, // Auto-refetch every 30 seconds
    ...options,
  });
};

/**
 * Fetch attendance summary
 */
export const useAttendanceSummary = (params = {}, options = {}) => {
  return useQuery({
    queryKey: ['attendance-summary', params],
    queryFn: async () => {
      try {
        const response = await retryAxios(() => 
          axios.get('/v1/both/attendance/summary', {
            params,
            withCredentials: true,
          }),
          { maxRetries: 2, delay: 500 }
        );
        return response.data || {};
      } catch (error) {
        handleApiError(error, { context: 'Attendance Summary', showToast: false });
        return {};
      }
    },
    staleTime: 1000 * 60 * 2,
    ...options,
  });
};

/**
 * Fetch organization statistics
 */
export const useOrganizationStats = (options = {}) => {
  return useQuery({
    queryKey: ['organization-stats'],
    queryFn: async () => {
      try {
        const response = await retryAxios(() => 
          axios.get('/v1/organization/statistics', { withCredentials: true }),
          { maxRetries: 2, delay: 500 }
        );
        return response.data || {};
      } catch (error) {
        handleApiError(error, { context: 'Organization Stats', showToast: false });
        return {};
      }
    },
    staleTime: 1000 * 60 * 5,
    ...options,
  });
};

/**
 * Fetch policy compliance data
 */
export const usePolicyCompliance = (options = {}) => {
  return useQuery({
    queryKey: ['policy-compliance'],
    queryFn: async () => {
      try {
        const response = await retryAxios(() => 
          axios.get('/v1/organization/policies/compliance', { withCredentials: true }),
          { maxRetries: 2, delay: 500 }
        );
        return response.data?.compliance || [];
      } catch (error) {
        handleApiError(error, { context: 'Policy Compliance', showToast: false });
        return [];
      }
    },
    staleTime: 1000 * 60 * 5,
    ...options,
  });
};

