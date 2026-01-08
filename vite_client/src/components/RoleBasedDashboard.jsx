import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from '../utils/axios';
import LoadingSpinner from './LoadingSpinner';
import { handleApiError } from '../utils/errorHandler';
import FirstLoginPermissionRequest from './FirstLoginPermissionRequest';

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
    }, [userRole, navigate, location, user, employee]);
    
    /**
     * Comprehensive fallback routing - used when server is unavailable
     * Checks ALL criteria (position, department, jobTitle, role, assignedRole)
     * Priority order matches server-side logic
     */
    const getComprehensiveFallback = () => {
        // Get all fields from Redux state
        const userPosition = (user?.position || employee?.position || '').toLowerCase().trim();
        const userDepartment = (user?.department || employee?.department || '').toLowerCase().trim();
        const userJobTitle = (user?.jobTitle || employee?.jobTitle || '').toLowerCase().trim();
        const userRole = user?.role || employee?.role;
        const userAssignedRole = user?.assignedRole || employee?.assignedRole;
        
        // Development-only logging
        if (process.env.NODE_ENV === 'development') {
            console.log('🔍 [Dashboard Routing] Comprehensive Fallback Check', {
                allFields: {
                    position: userPosition || 'NOT SET',
                    department: userDepartment || 'NOT SET',
                    jobTitle: userJobTitle || 'NOT SET',
                    role: userRole || 'NOT SET',
                    assignedRole: userAssignedRole ? 'exists' : 'none'
                }
            });
        }
        
        // PRIORITY 1: Check Assigned Role
        if (userAssignedRole?.dashboardRoute) {
            if (process.env.NODE_ENV === 'development') {
                console.log('✅ [Dashboard Routing] MATCH: Assigned Role Dashboard', {
                    assignedRole: userAssignedRole.name,
                    route: userAssignedRole.dashboardRoute
                });
            }
            return userAssignedRole.dashboardRoute;
        }
        
        // PRIORITY 2: Check Organization Admin
        const isOrganizationLogin = localStorage.getItem('isOrganizationLogin') === 'true';
        const userEmail = user?.email?.toLowerCase() || '';
        const isGmailUser = userEmail.endsWith('@gmail.com');
        if ((isOrganizationLogin || isGmailUser) && userRole === 'admin') {
            if (process.env.NODE_ENV === 'development') {
                console.log('✅ [Dashboard Routing] MATCH: Organization Dashboard');
            }
            return '/organization/dashboard';
        }
        
        // PRIORITY 3: Check Executive Position (CEO/CTO/CFO/VP)
        if (
            userPosition === 'ceo' || 
            userPosition === 'cto' || 
            userPosition === 'cfo' || 
            userPosition === 'vp'
        ) {
            if (process.env.NODE_ENV === 'development') {
                console.log('✅ [Dashboard Routing] MATCH: Administration Dashboard', {
                    position: userPosition
                });
            }
            return '/dashboard-administration';
        }
        
        // PRIORITY 4: Check HR Department/JobTitle
        if (
            userDepartment === 'hr' || 
            userDepartment.includes('hr') || 
            userDepartment.includes('human resource') ||
            userJobTitle.includes('hr manager') ||
            userJobTitle.includes('human resource') ||
            userJobTitle.includes('hr')
        ) {
            if (process.env.NODE_ENV === 'development') {
                console.log('✅ [Dashboard Routing] MATCH: HR Dashboard', {
                    department: userDepartment,
                    jobTitle: userJobTitle
                });
            }
            return '/dashboard-hr';
        }
        
        // PRIORITY 5: Check Tech Department
        if (
            userDepartment === 'technology' ||
            userDepartment === 'tech' ||
            userDepartment.includes('technology') ||
            userDepartment === 'it' ||
            (userDepartment.includes('it') && !userDepartment.includes('support'))
        ) {
            if (process.env.NODE_ENV === 'development') {
                console.log('✅ [Dashboard Routing] MATCH: Tech Dashboard', {
                    department: userDepartment
                });
            }
            return '/dashboard/tech';
        }
        
        // PRIORITY 6: Check Finance Department
        if (
            userDepartment === 'finance' || 
            userDepartment.includes('finance')
        ) {
            if (process.env.NODE_ENV === 'development') {
                console.log('✅ [Dashboard Routing] MATCH: Finance Dashboard', {
                    department: userDepartment
                });
            }
            return '/dashboard-finance';
        }
        
        // PRIORITY 7: Check Manager/Director Position
        if (
            userPosition === 'manager' || 
            userPosition === 'director'
        ) {
            if (process.env.NODE_ENV === 'development') {
                console.log('✅ [Dashboard Routing] MATCH: Manager Dashboard', {
                    position: userPosition
                });
            }
            return '/dashboard-manager';
        }
        
        // PRIORITY 8: Check Admin Role
        if (userRole === 'admin') {
            if (process.env.NODE_ENV === 'development') {
                console.log('✅ [Dashboard Routing] MATCH: Admin Dashboard');
            }
            return '/dashboard-admin';
        }
        
        // PRIORITY 9: Default → Employee Dashboard
        if (process.env.NODE_ENV === 'development') {
            console.log('⚠️ [Dashboard Routing] NO MATCH: Using Employee Dashboard (default)', {
                checkedFields: {
                    position: userPosition || 'NOT SET',
                    department: userDepartment || 'NOT SET',
                    jobTitle: userJobTitle || 'NOT SET',
                    role: userRole || 'NOT SET'
                }
            });
        }
        return '/dashboard-employee';
    };
    
    // Render appropriate dashboard - only redirect, don't render directly
    const renderDashboard = () => {
        if (loading) {
            return <LoadingSpinner message="Loading dashboard..." />;
        }
        
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
            // Redirect to the determined route
            navigate(route, { replace: true });
            return <LoadingSpinner message="Redirecting to dashboard..." />;
        }
        
        // Fallback: if somehow we're on an unknown route, redirect to determined route
        navigate(route, { replace: true });
        return <LoadingSpinner message="Redirecting to dashboard..." />;
    };
    
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
