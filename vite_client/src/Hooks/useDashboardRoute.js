import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from '../utils/axios';
import { handleApiError } from '../utils/errorHandler';
import { retryAxios } from '../utils/retry';

/**
 * React Query hook for fetching dashboard route with caching
 * Caches the route for 30 minutes to avoid unnecessary API calls
 * 
 * @param {Object} options - React Query options
 * @returns {Object} Query result with route data
 */
export const useDashboardRoute = (options = {}) => {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: ['dashboardRoute'],
    queryFn: async () => {
      try {
        // Don't use retryAxios here - let React Query handle retries
        // This avoids double retry logic
        const response = await axios.get('/v1/organization/dashboard/route', {
          withCredentials: true
        });
        
        if (response.data?.success) {
          const routeData = {
            route: response.data.dashboardRoute,
            routeSource: response.data.routeSource,
            role: response.data.role,
            identification: response.data.identification || null,
            department: response.data.department || null,
            position: response.data.position || null,
            assignedRole: response.data.assignedRole || null
          };
          
          // Prefetch dashboard data based on route (non-blocking)
          // Use requestIdleCallback or setTimeout to ensure it doesn't block the main query
          if (typeof window !== 'undefined' && window.requestIdleCallback) {
            window.requestIdleCallback(() => {
              prefetchDashboardData(queryClient, routeData.route);
            }, { timeout: 2000 });
          } else {
            // Fallback for browsers without requestIdleCallback
            setTimeout(() => {
              prefetchDashboardData(queryClient, routeData.route);
            }, 0);
          }
          
          return routeData;
        }
        throw new Error('Invalid response from server');
      } catch (error) {
        // Don't handle 401 errors here - let error boundary handle auth errors
        if (error.response?.status === 401) {
          throw error;
        }
        
        // Log other errors but don't show toast (fallback will handle)
        handleApiError(error, { 
          context: 'Dashboard Routing',
          showToast: false 
        });
        throw error;
      }
    },
    staleTime: 1000 * 60 * 30, // 30 minutes - route rarely changes
    gcTime: 1000 * 60 * 60, // 1 hour cache (React Query v5 uses gcTime instead of cacheTime)
    retry: (failureCount, error) => {
      // Don't retry on 401 (auth errors) or 403 (permission errors)
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false;
      }
      // Retry once for other errors (network issues, 5xx errors)
      return failureCount < 1;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    ...options,
  });
};

/**
 * Prefetch dashboard data based on route (non-blocking)
 * This improves perceived performance by loading data in parallel
 * Only prefetches if data is not already cached or stale
 */
const prefetchDashboardData = (queryClient, route) => {
  // Helper to check if query is already cached and fresh
  const shouldPrefetch = (queryKey, staleTime = 1000 * 60 * 2) => {
    const queryState = queryClient.getQueryState(queryKey);
    if (!queryState) return true; // Not cached, should prefetch
    
    // Check if data is stale
    if (queryState.dataUpdatedAt) {
      const age = Date.now() - queryState.dataUpdatedAt;
      return age > staleTime; // Prefetch if stale
    }
    
    return true; // No data, should prefetch
  };
  
  // Prefetch common data that all dashboards might need
  if (shouldPrefetch(['employees'])) {
    queryClient.prefetchQuery({
      queryKey: ['employees'],
      queryFn: async () => {
        try {
          const response = await retryAxios(() =>
            axios.get('/v1/admin/employee', { withCredentials: true }),
            { maxRetries: 1, delay: 500 }
          );
          return response.data?.employees || [];
        } catch {
          // Silently fail - this is just prefetching
          // Return empty array to prevent error state
          return [];
        }
      },
      staleTime: 1000 * 60 * 2, // 2 minutes
    }).catch(() => {
      // Silently fail - prefetching should not block
    });
  }
  
  // Prefetch route-specific data based on dashboard type
  if (route === '/dashboard-hr' || route === '/dashboard-manager') {
    if (shouldPrefetch(['leaves'])) {
      queryClient.prefetchQuery({
        queryKey: ['leaves'],
        queryFn: async () => {
          try {
            const response = await retryAxios(() =>
              axios.get('/v1/admin/leave', { withCredentials: true }),
              { maxRetries: 1, delay: 500 }
            );
            return response.data?.leaves || [];
          } catch {
            return [];
          }
        },
        staleTime: 1000 * 60 * 2,
      }).catch(() => {
        // Silently fail
      });
    }
  }
  
  if (route === '/dashboard-finance' || route === '/dashboard-administration') {
    if (shouldPrefetch(['payrolls'], 1000 * 60 * 5)) {
      queryClient.prefetchQuery({
        queryKey: ['payrolls'],
        queryFn: async () => {
          try {
            const response = await retryAxios(() =>
              axios.get('/v1/admin/payroll', { withCredentials: true }),
              { maxRetries: 1, delay: 500 }
            );
            return response.data?.payrolls || [];
          } catch {
            return [];
          }
        },
        staleTime: 1000 * 60 * 5, // 5 minutes for payroll
      }).catch(() => {
        // Silently fail
      });
    }
  }
  
  if (route === '/dashboard-administration' || route === '/dashboard-manager' || route === '/dashboard-admin') {
    if (shouldPrefetch(['projects'])) {
      queryClient.prefetchQuery({
        queryKey: ['projects'],
        queryFn: async () => {
          try {
            const response = await retryAxios(() =>
              axios.get('/v1/admin/project', { withCredentials: true }),
              { maxRetries: 1, delay: 500 }
            );
            return response.data?.projects || [];
          } catch {
            return [];
          }
        },
        staleTime: 1000 * 60 * 2,
      }).catch(() => {
        // Silently fail
      });
    }
  }
};

