import { useQuery } from '@tanstack/react-query';
import axios from '../../../utils/axios';

export const useHRAnalytics = (startDate, endDate) => {
    return useQuery({
        queryKey: ['hr-reports-analytics', startDate, endDate],
        queryFn: async () => {
            const params = {};
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            const response = await axios.get('/v1/admin/analytics/hr', {
                params,
                withCredentials: true,
            });
            return response.data?.data || {};
        },
        staleTime: 1000 * 60 * 5,
    });
};

export const useEmployeesList = (limit = 10) => {
    return useQuery({
        queryKey: ['hr-reports-employees', limit],
        queryFn: async () => {
            const response = await axios.get('/v1/admin/employee', {
                params: { page: 1, limit },
                withCredentials: true,
            });
            const body = response.data;
            return body?.data || body?.employees || [];
        },
        staleTime: 1000 * 60 * 3,
    });
};

export const usePayrollStatistics = () => {
    return useQuery({
        queryKey: ['hr-reports-payroll-stats'],
        queryFn: async () => {
            const response = await axios.get('/v1/admin/payroll-reports/statistics', {
                withCredentials: true,
            });
            return response.data?.data || response.data || {};
        },
        staleTime: 1000 * 60 * 5,
    });
};
