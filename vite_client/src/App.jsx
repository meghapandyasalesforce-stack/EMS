import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import Header from './Shared/Header';
import InstallPrompt from './components/InstallPrompt';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import { checkAuthSession } from './context/Auth/authSlice';
import { clearEmployeeDetails } from './context/employeeDetailsSlice';
import {
  authRoutes,
  dashboardRoutes,
  employeeRoutes,
  projectRoutes,
  profileDetailRoutes,
  leaveRoutes,
  payrollRoutes,
  attendanceRoutes,
  organizationRoutes,
  adminRoutes,
  hrRoutes,
  otherRoutes,
  renderRoutes,
  renderProtectedRoutes
} from './routes/index.jsx';

// All routes are now defined in routes/index.jsx
// Components are lazy-loaded through the route configuration

function App() {
    const location = useLocation();
    const dispatch = useDispatch();
    const authChecked = useSelector((state) => state.auth.authChecked);
    const hideHeaderRoutes = ['/', '/login', '/register', '/organization/register', '/organization/login', '/forgot-password']; // Routes where Header and Sidebar should not be shown
    useEffect(() => {
        let cancelled = false;
        const bootstrapSession = async () => {
            try {
                const result = await dispatch(checkAuthSession());
                if (cancelled) return;
                if (checkAuthSession.rejected.match(result)) {
                    // Remove stale persisted employee details when session is invalid/deleted.
                    dispatch(clearEmployeeDetails());
                }
            } catch {
                if (!cancelled) {
                    dispatch(clearEmployeeDetails());
                }
            }
        };
        if (!authChecked) {
            bootstrapSession();
        }
        return () => {
            cancelled = true;
        };
    }, [authChecked, dispatch]);

    // Check if pathname is in hideHeaderRoutes or starts with /reset-password (for token routes)
    const shouldHideLayout = hideHeaderRoutes.includes(location.pathname) || location.pathname.startsWith('/reset-password');
    
    if (!authChecked) {
        return <LoadingSpinner message="Initializing session..." />;
    }

    return (
        <div className="min-h-screen bg-[var(--color-bg-soft)] text-[var(--color-text)]">
            {!shouldHideLayout && <Header />} {/* Conditionally render Header */}
            <InstallPrompt /> {/* PWA Install Prompt */}
            {shouldHideLayout ? (
                // Full-screen layout for auth pages (no header, no sidebar, no flex container)
                <Routes>
                    {renderRoutes(authRoutes)}
                </Routes>
            ) : (
                // Push content right of fixed main nav
                <div className="flex min-h-[calc(100vh-64px)] ml-0 lg:ml-64">
                    <div className="flex-1 min-w-0 overflow-auto bg-[var(--color-bg)]">
                        <Routes>
                            {renderRoutes(authRoutes)}
                            {renderProtectedRoutes(dashboardRoutes)}
                            {renderProtectedRoutes(employeeRoutes)}
                            {renderProtectedRoutes(projectRoutes)}
                            {renderProtectedRoutes(profileDetailRoutes)}
                            {renderProtectedRoutes(leaveRoutes)}
                            {renderProtectedRoutes(payrollRoutes)}
                            {renderProtectedRoutes(attendanceRoutes)}
                            {renderProtectedRoutes(organizationRoutes)}
                            {renderProtectedRoutes(adminRoutes)}
                            {renderProtectedRoutes(hrRoutes)}
                            {renderProtectedRoutes(otherRoutes)}
                        </Routes>
                    </div>
                </div>
            )}
        </div>
    );
}

function AppWrapper() {
    return (
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <App />
        </Router>
    );
}

export default AppWrapper;
