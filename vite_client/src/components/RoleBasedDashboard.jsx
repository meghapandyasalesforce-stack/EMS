import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from '../utils/axios';
import LoadingSpinner from './LoadingSpinner';
import { handleApiError } from '../utils/errorHandler';
import { mergeSessionProfile } from '../utils/profileUtils';
import FirstLoginPermissionRequest from './FirstLoginPermissionRequest';
import { resolveDashboardFromAccessProfile } from '../utils/resolveDashboardFromAccess';

const RoleBasedDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const profile = mergeSessionProfile(user, employee);
    const [dashboardRoute, setDashboardRoute] = useState(null);
    const [loading, setLoading] = useState(true);
    
    const userRole = profile?.role;

    /**
     * Fallback when server route API unavailable.
     * SaaS: functionalRoles / assignedRole — not department name.
     */
    const getComprehensiveFallback = () => {
        if (!profile) {
            return '/dashboard-employee';
        }

        const isOrganizationLogin = localStorage.getItem('isOrganizationLogin') === 'true';
        const userEmail = user?.email?.toLowerCase() || '';
        const isGmailUser = userEmail.endsWith('@gmail.com');
        if ((isOrganizationLogin || isGmailUser) && profile?.role === 'admin') {
            return '/organization/dashboard';
        }

        return resolveDashboardFromAccessProfile({
            functionalRoles: profile.functionalRoles,
            assignedRole: profile.assignedRole,
            position: profile.position,
            jobTitle: profile.jobTitle,
            role: profile.role,
            allowLegacyJobStrings: true,
        });
    };
    
    useEffect(() => {
        // Honor one-time Job Details redirect if login sent user to /dashboard first
        if (sessionStorage.getItem('redirectToOfferLetterOnLogin') === '1') {
            navigate('/job-details', { replace: true });
            return;
        }

        const fetchDashboardRoute = async () => {
            // Wait for user data to be available
            // If userRole is missing but user/employee exists, wait a bit for Redux to update
            if (!userRole && (!user && !employee)) {
                // No user data at all - might be loading, wait a bit
                const timer = setTimeout(() => {
                    if (!user && !employee) {
                        // Still no user after waiting - redirect to login
                        navigate('/login', { replace: true });
                        setLoading(false);
                    } else {
                        // User data loaded, retry
                        setLoading(false);
                    }
                }, 500);
                return () => clearTimeout(timer);
            }

            // If userRole is still missing but we have user/employee, use fallback immediately
            if (!userRole && (user || employee)) {
                const fallbackRoute = getComprehensiveFallback();
                setDashboardRoute(fallbackRoute);
                if (location.pathname === '/dashboard' || location.pathname === '/') {
                    navigate(fallbackRoute, { replace: true });
                }
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
                
                // Comprehensive fallback - checks all criteria when server is unavailable
                const fallbackRoute = getComprehensiveFallback();
                setDashboardRoute(fallbackRoute);
                
                if (location.pathname === '/dashboard' || location.pathname === '/') {
                    navigate(fallbackRoute, { replace: true });
                }
            } finally {
                setLoading(false);
            }
        };
        
        fetchDashboardRoute();
    }, [userRole, navigate, location, user, employee, profile]);

    // Render appropriate dashboard - only redirect, don't render directly
    const renderDashboard = () => {
        if (loading) {
            return <LoadingSpinner message="Loading dashboard..." />;
        }
        
        // Always ensure we have a route - use fallback if dashboardRoute is not set
        const route = dashboardRoute || getComprehensiveFallback();
        const currentPath = location.pathname;
        
        // List of all specific dashboard routes that have direct route handlers
        const specificDashboardRoutes = [
            '/dashboard-admin',
            '/dashboard-hr',
            '/dashboard-manager',
            '/dashboard-finance',
            '/dashboard-administration',
            '/dashboard/tech',
            '/dashboard/hr',
            '/dashboard/finance',
            '/dashboard/manager',
            '/dashboard/employee',
            '/dashboard/ceo',
            '/dashboard/cto',
            '/dashboard/cfo',
            '/dashboard/vp',
            '/organization/dashboard',
            '/dashboard-employee'
        ];
        
        // If already on a specific dashboard route, return null
        // Let React Router handle it via the direct routes in routes/index.jsx
        if (specificDashboardRoutes.includes(currentPath)) {
            return null;
        }
        
        // Only handle redirects when on /dashboard or /
        if (currentPath === '/dashboard' || currentPath === '/') {
            // Always redirect to a valid route
            navigate(route, { replace: true });
            return <LoadingSpinner message="Redirecting to dashboard..." />;
        }
        
        // Fallback: if somehow we're on an unknown route, redirect to determined route
        // This ensures we never show a 404 page
        navigate(route, { replace: true });
        return <LoadingSpinner message="Redirecting to dashboard..." />;
    };
    
    // Additional safeguard: if we're on /dashboard and no route is set, redirect immediately
    useEffect(() => {
        if (!loading && (location.pathname === '/dashboard' || location.pathname === '/')) {
            const route = dashboardRoute || getComprehensiveFallback();
            if (route && route !== location.pathname) {
                navigate(route, { replace: true });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, dashboardRoute, location.pathname, navigate, user, employee]);

    return (
        <>
            {renderDashboard()}
            {/* Permission request for first-time users */}
            {user && (
                <FirstLoginPermissionRequest 
                    user={user}
                    onComplete={() => {
                        // Permissions granted - user can now use attendance features
                    }}
                />
            )}
        </>
    );
};

export default RoleBasedDashboard;
