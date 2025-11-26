import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import axios from '../utils/axios';
import logger from '../utils/logger';
import LoadingSpinner from './LoadingSpinner';
import DashboardAdmin from '../Admin/DashboardAdmin';
import DashboardEmployee from '../Employee/Dashboard/DashboardEmployee';
import DashboardHR from '../HR/Dashboard/DashboardHR';
import DashboardManager from '../Manager/Dashboard/DashboardManager';
import DashboardFinance from '../Finance/Dashboard/DashboardFinance';
import DashboardExecutive from '../Executive/Dashboard/DashboardExecutive';
import OrganizationDashboard from '../Admin/Organization/OrganizationDashboard';
import { handleApiError } from '../utils/errorHandler';

const RoleBasedDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const [dashboardRoute, setDashboardRoute] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Get user's role
    const userRole = user?.role || employee?.role;
    
    useEffect(() => {
        const fetchDashboardRoute = async () => {
            if (!userRole) {
                setLoading(false);
                return;
            }

            try {
                // Trust server-side routing - it has the authoritative logic
                const response = await axios.get('/v1/organization/dashboard/route', {
                    withCredentials: true
                });
                
                if (response.data?.success) {
                    const route = response.data.dashboardRoute;
                    setDashboardRoute(route);
                    
                    // Redirect if on root dashboard path
                    if (location.pathname === '/dashboard' || location.pathname === '/') {
                        navigate(route, { replace: true });
                    }
                } else {
                    throw new Error('Invalid response from server');
                }
            } catch (error) {
                // Only log non-401 errors (401 means not authenticated)
                if (error.response?.status !== 401) {
                    handleApiError(error, { 
                        context: 'Dashboard Routing',
                        showToast: false // Don't show toast, just use fallback
                    });
                }
                
                // Minimal fallback - only for critical cases
                const fallbackRoute = getMinimalFallback(userRole);
                setDashboardRoute(fallbackRoute);
                
                if (location.pathname === '/dashboard' || location.pathname === '/') {
                    navigate(fallbackRoute, { replace: true });
                }
            } finally {
                setLoading(false);
            }
        };
        
        fetchDashboardRoute();
    }, [userRole, navigate, location]);
    
    /**
     * Minimal fallback routing - only used when server is unavailable
     * Server-side routing is authoritative and should be trusted
     */
    const getMinimalFallback = (role) => {
        if (!role) return '/dashboard-employee';
        
        // Check if this is an organization login
        const isOrganizationLogin = localStorage.getItem('isOrganizationLogin') === 'true';
        const userEmail = user?.email?.toLowerCase() || '';
        const isGmailUser = userEmail.endsWith('@gmail.com');
        
        // Organization admins should go to organization dashboard
        if ((isOrganizationLogin || isGmailUser) && role === 'admin') {
            return '/organization/dashboard';
        }
        
        // Simple role-based fallback
        switch(role) {
            case 'admin':
                return '/dashboard-admin';
            case 'hr_manager':
                return '/dashboard-hr';
            case 'manager':
                return '/dashboard-manager';
            case 'finance':
                return '/dashboard-finance';
            case 'employee':
            default:
                return '/dashboard-employee';
        }
    };
    
    // Render appropriate dashboard
    const renderDashboard = () => {
        if (loading) {
            return <LoadingSpinner message="Loading dashboard..." />;
        }
        
        const route = dashboardRoute || getMinimalFallback(userRole);
        
        switch(route) {
            case '/dashboard-admin':
                return <DashboardAdmin />;
            case '/dashboard-hr':
                return <DashboardHR />;
            case '/dashboard-manager':
                return <DashboardManager />;
            case '/dashboard-finance':
                return <DashboardFinance />;
            case '/dashboard-executive':
                return <DashboardExecutive />;
            case '/organization/dashboard':
                return <OrganizationDashboard />;
            case '/dashboard-employee':
            default:
                return <DashboardEmployee />;
        }
    };
    
    return renderDashboard();
};

export default RoleBasedDashboard;
