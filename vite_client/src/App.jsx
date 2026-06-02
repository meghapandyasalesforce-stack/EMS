import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import Header from './Shared/Header';
import InstallPrompt from './components/InstallPrompt';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import { checkAuthSession } from './context/Auth/authSlice';
import { clearEmployeeDetails } from './context/employeeDetailsSlice';
import { fetchOrganizationTimezone, setTimezoneContext, clearTimezoneContext } from './context/timezoneSlice';
import {
  authRoutes,
  dashboardRoutes,
  employeeRoutes,
  projectRoutes,
  leaveRoutes,
  payrollRoutes,
  attendanceRoutes,
  organizationRoutes,
  adminRoutes,
  hrRoutes,
  otherRoutes,
  renderRoutes,
  renderProtectedRoutes,
  renderProfileRoutes
} from './routes/index.jsx';

// All routes are now defined in routes/index.jsx
// Components are lazy-loaded through the route configuration

function ScrollToTop() {
    const { pathname } = useLocation();
    useEffect(() => {
        document.querySelector('.main-scroll-area')?.scrollTo(0, 0);
    }, [pathname]);
    return null;
}

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
                if (checkAuthSession.fulfilled.match(result)) {
                    const ctx = result.payload?.timezoneContext;
                    if (ctx) {
                        dispatch(setTimezoneContext(ctx));
                    } else if (result.payload?.employee) {
                        dispatch(fetchOrganizationTimezone());
                    }
                }
                if (checkAuthSession.rejected.match(result)) {
                    dispatch(clearEmployeeDetails());
                    dispatch(clearTimezoneContext());
                }
            } catch {
                if (!cancelled) {
                    dispatch(clearEmployeeDetails());
                    dispatch(clearTimezoneContext());
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
            {!shouldHideLayout && <Header />}
            <InstallPrompt />
            {shouldHideLayout ? (
                <Routes>
                    {renderRoutes(authRoutes)}
                </Routes>
            ) : (
                <div className="flex min-h-[calc(100vh-64px)] ml-0 lg:ml-64">
                    <div className="main-scroll-area flex-1 min-w-0 overflow-auto bg-[var(--color-bg)]">
                        <ScrollToTop />
                        <Routes>
                            {renderRoutes(authRoutes)}
                            {renderProtectedRoutes(dashboardRoutes)}
                            {renderProtectedRoutes(employeeRoutes)}
                            {renderProtectedRoutes(projectRoutes)}
                            {renderProfileRoutes()}
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
        <Router future={{ v7_relativeSplatPath: true }}>
            <App />
        </Router>
    );
}

export default AppWrapper;
