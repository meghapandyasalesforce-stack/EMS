import { useQuery } from '@tanstack/react-query';
import axios from '../utils/axios';
import { handleApiError } from '../utils/errorHandler';
import { retryAxios } from '../utils/retry';

/**
 * React Query hook for fetching dashboard data with caching
 */

/**
 * Fetch employees data
 * Tries admin endpoint first, falls back to employee endpoint for HR/Manager users
 */
export const useEmployees = (options = {}) => {
  return useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      // Try admin endpoint first
      try {
        const response = await retryAxios(() => 
          axios.get('/v1/admin/employee', { withCredentials: true }),
          { maxRetries: 1, delay: 500 }
        );
        // Backend returns: { success: true, data: [...], pagination: {...} }
        return response.data?.data || response.data?.employees || [];
      } catch (error) {
        // Handle backend unavailable (503) gracefully
        if (error.response?.status === 503 || error.isBackendUnavailable) {
          return [];
        }
        // Try employee endpoint as fallback for HR/Manager users
        if (error.response?.status === 403 || error.response?.status === 401) {
          try {
            const response = await retryAxios(() => 
              axios.get('/v1/employee', { withCredentials: true }),
              { maxRetries: 1, delay: 500 }
            );
            // Backend returns: { success: true, employees: [...], total: ... }
            // For managers, this returns department employees
            return response.data?.employees || response.data?.data || [];
          } catch (fallbackError) {
            // Handle 503 in fallback too
            if (fallbackError.response?.status === 503 || fallbackError.isBackendUnavailable) {
              return [];
            }
            // Silently fail - user might not have access
            return [];
          }
        }
        // Silently fail for other errors
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
        // Backend returns: { success: true, data: [...], pagination: {...} }
        return response.data?.data || response.data?.projects || [];
      } catch (error) {
        // Handle backend unavailable (503) gracefully
        if (error.response?.status === 503 || error.isBackendUnavailable) {
          return [];
        }
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
        // Handle backend unavailable (503) gracefully
        if (error.response?.status === 503 || error.isBackendUnavailable) {
          return [];
        }
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
 * Tries admin endpoint first, falls back to employee endpoint for HR/Manager users
 */
export const useLeaves = (options = {}) => {
  return useQuery({
    queryKey: ['leaves'],
    queryFn: async () => {
      // Try admin endpoint first (correct path is /get-all-leaves)
      try {
        const response = await retryAxios(() => 
          axios.get('/v1/admin/leave/get-all-leaves', { withCredentials: true }),
          { maxRetries: 1, delay: 500 }
        );
        return response.data?.leaves || response.data?.data || [];
      } catch (error) {
        // Handle backend unavailable (503) gracefully
        if (error.response?.status === 503 || error.isBackendUnavailable) {
          return [];
        }
        // Try employee endpoint as fallback for HR/Manager users
        // Note: This only returns the user's own leaves, not department leaves
        if (error.response?.status === 403 || error.response?.status === 401 || error.response?.status === 404) {
          try {
            const response = await retryAxios(() => 
              axios.get('/v1/employee/leave/get-my-leaves', { withCredentials: true }),
              { maxRetries: 1, delay: 500 }
            );
            // Backend returns: { leaves: [...], statistics: {...} }
            return response.data?.leaves || [];
          } catch (fallbackError) {
            // Handle 503 in fallback too
            if (fallbackError.response?.status === 503 || fallbackError.isBackendUnavailable) {
              return [];
            }
            // Silently fail - user might not have access
            return [];
          }
        }
        // Silently fail for other errors
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
        // Handle backend unavailable (503) gracefully
        if (error.response?.status === 503 || error.isBackendUnavailable) {
          return [];
        }
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
        // Handle backend unavailable (503) gracefully
        if (error.response?.status === 503 || error.isBackendUnavailable) {
          return [];
        }
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
        // Handle backend unavailable (503) gracefully
        if (error.response?.status === 503 || error.isBackendUnavailable) {
          return [];
        }
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
 * Note: This endpoint may not exist - gracefully handles 404
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
          { maxRetries: 1, delay: 500 }
        );
        return response.data || {};
      } catch (error) {
        // Handle backend unavailable (503) gracefully
        if (error.response?.status === 503 || error.isBackendUnavailable) {
          return {};
        }
        // Silently handle 404 - endpoint might not exist
        if (error.response?.status === 404) {
          return {};
        }
        // Silently fail for other errors
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
        // Handle backend unavailable (503) gracefully
        if (error.response?.status === 503 || error.isBackendUnavailable) {
          return {};
        }
        handleApiError(error, { context: 'Organization Stats', showToast: false });
        return {};
      }
    },
    staleTime: 1000 * 60 * 5,
    ...options,
  });
};

/**
 * Fetch executive financial summary
 */
export const useFinancialSummary = (options = {}) => {
  return useQuery({
    queryKey: ['executive', 'financial-summary', options.period, options.startDate, options.endDate],
    queryFn: async () => {
      try {
        const params = {};
        if (options.period) params.period = options.period;
        if (options.startDate) params.startDate = options.startDate;
        if (options.endDate) params.endDate = options.endDate;

        const response = await retryAxios(() => 
          axios.get('/v1/admin/executive/financial-summary', { 
            params,
            withCredentials: true 
          }),
          { maxRetries: 2, delay: 500 }
        );
        return response.data?.data || {};
      } catch (error) {
        handleApiError(error, { context: 'Financial Summary', showToast: false });
        return {};
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...options,
  });
};

/**
 * Fetch executive KPIs
 */
export const useExecutiveKPIs = (options = {}) => {
  return useQuery({
    queryKey: ['executive', 'kpis', options.startDate, options.endDate],
    queryFn: async () => {
      try {
        const params = {};
        if (options.startDate) params.startDate = options.startDate;
        if (options.endDate) params.endDate = options.endDate;

        const response = await retryAxios(() => 
          axios.get('/v1/admin/executive/kpis', { 
            params,
            withCredentials: true 
          }),
          { maxRetries: 2, delay: 500 }
        );
        return response.data?.data || {};
      } catch (error) {
        handleApiError(error, { context: 'Executive KPIs', showToast: false });
        return {};
      }
    },
    staleTime: 1000 * 60 * 2,
    ...options,
  });
};

/**
 * Fetch critical alerts
 */
export const useCriticalAlerts = (options = {}) => {
  return useQuery({
    queryKey: ['executive', 'alerts'],
    queryFn: async () => {
      try {
        const response = await retryAxios(() => 
          axios.get('/v1/admin/executive/alerts', { 
            withCredentials: true 
          }),
          { maxRetries: 2, delay: 500 }
        );
        return response.data?.data || { alerts: [], total: 0, critical: 0 };
      } catch (error) {
        handleApiError(error, { context: 'Critical Alerts', showToast: false });
        return { alerts: [], total: 0, critical: 0 };
      }
    },
    staleTime: 1000 * 60 * 1, // 1 minute - alerts should be fresh
    refetchInterval: 1000 * 60 * 2, // Refetch every 2 minutes
    ...options,
  });
};

/**
 * Fetch project portfolio
 */
export const useProjectPortfolio = (options = {}) => {
  return useQuery({
    queryKey: ['executive', 'project-portfolio'],
    queryFn: async () => {
      try {
        const response = await retryAxios(() => 
          axios.get('/v1/admin/executive/project-portfolio', { 
            withCredentials: true 
          }),
          { maxRetries: 2, delay: 500 }
        );
        return response.data?.data || {};
      } catch (error) {
        handleApiError(error, { context: 'Project Portfolio', showToast: false });
        return {};
      }
    },
    staleTime: 1000 * 60 * 3,
    ...options,
  });
};

/**
 * Fetch policy compliance data
 * Admin only - gracefully handles 403 for non-admin users
 */
export const usePolicyCompliance = (options = {}) => {
  return useQuery({
    queryKey: ['policy-compliance'],
    queryFn: async () => {
      try {
        const response = await retryAxios(() => 
          axios.get('/v1/organization/policies/compliance', { withCredentials: true }),
          { maxRetries: 1, delay: 500 }
        );
        return response.data?.compliance || [];
      } catch (error) {
        // Handle backend unavailable (503) gracefully
        if (error.response?.status === 503 || error.isBackendUnavailable) {
          return [];
        }
        // Silently handle 403 - non-admin users don't have access
        if (error.response?.status === 403 || error.response?.status === 401) {
          return [];
        }
        // Silently fail for other errors
        return [];
      }
    },
    staleTime: 1000 * 60 * 5,
    ...options,
  });
};

/**
 * Phase 2: Fetch department performance
 */
export const useDepartmentPerformance = (options = {}) => {
  return useQuery({
    queryKey: ['executive', 'department-performance', options.period],
    queryFn: async () => {
      try {
        const params = { period: options.period || 'month' };
        const response = await retryAxios(() => 
          axios.get('/v1/admin/executive/department-performance', { 
            params,
            withCredentials: true 
          }),
          { maxRetries: 2, delay: 500 }
        );
        return response.data?.data || {};
      } catch (error) {
        handleApiError(error, { context: 'Department Performance', showToast: false });
        return {};
      }
    },
    staleTime: 1000 * 60 * 5,
    ...options,
  });
};

/**
 * Phase 2: Fetch employee trends
 */
export const useEmployeeTrends = (options = {}) => {
  return useQuery({
    queryKey: ['executive', 'employee-trends', options.months],
    queryFn: async () => {
      try {
        const params = { months: options.months || 12 };
        const response = await retryAxios(() => 
          axios.get('/v1/admin/executive/employee-trends', { 
            params,
            withCredentials: true 
          }),
          { maxRetries: 2, delay: 500 }
        );
        return response.data?.data || {};
      } catch (error) {
        handleApiError(error, { context: 'Employee Trends', showToast: false });
        return {};
      }
    },
    staleTime: 1000 * 60 * 5,
    ...options,
  });
};

/**
 * Phase 3: Fetch strategic insights
 */
export const useStrategicInsights = (options = {}) => {
  return useQuery({
    queryKey: ['executive', 'strategic-insights'],
    queryFn: async () => {
      try {
        const response = await retryAxios(() => 
          axios.get('/v1/admin/executive/strategic-insights', { 
            withCredentials: true 
          }),
          { maxRetries: 2, delay: 500 }
        );
        return response.data?.data || { insights: [], summary: {} };
      } catch (error) {
        handleApiError(error, { context: 'Strategic Insights', showToast: false });
        return { insights: [], summary: {} };
      }
    },
    staleTime: 1000 * 60 * 10, // 10 minutes - insights don't change frequently
    ...options,
  });
};

/**
 * Phase 3: Fetch predictive analytics
 */
export const usePredictiveAnalytics = (options = {}) => {
  return useQuery({
    queryKey: ['executive', 'predictive-analytics', options.forecastMonths],
    queryFn: async () => {
      try {
        const params = { forecastMonths: options.forecastMonths || 6 };
        const response = await retryAxios(() => 
          axios.get('/v1/admin/executive/predictive-analytics', { 
            params,
            withCredentials: true 
          }),
          { maxRetries: 2, delay: 500 }
        );
        return response.data?.data || {};
      } catch (error) {
        handleApiError(error, { context: 'Predictive Analytics', showToast: false });
        return {};
      }
    },
    staleTime: 1000 * 60 * 15, // 15 minutes - forecasts don't change frequently
    ...options,
  });
};

