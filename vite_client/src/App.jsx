import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import Header from './Shared/Header';
import InstallPrompt from './components/InstallPrompt';
import ReleaseNotesPopup from './components/ReleaseNotesPopup';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import { checkAuthSession } from './context/Auth/authSlice';
import { clearEmployeeDetails, setEmployeeProfile } from './context/employeeDetailsSlice';
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
    const hideHeaderRoutes = ['/', '/login', '/register', '/organization/register', '/organization/login', '/forgot-password'];
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
                    if (result.payload?.employee) {
                        dispatch(setEmployeeProfile(result.payload.employee));
                    } else if (!result.payload?.user) {
                        dispatch(clearEmployeeDetails());
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
    const shouldHideLayout = hideHeaderRoutes.includes(location.pathname)
        || location.pathname.startsWith('/reset-password')
        || location.pathname.startsWith('/offer/');
    
    if (!authChecked) {
        return <LoadingSpinner message="Initializing session..." />;
    }

    return (
        <div
            className={
                shouldHideLayout
                    ? 'min-h-screen max-w-[100vw] overflow-x-clip bg-[var(--color-bg-soft)] text-[var(--color-text)]'
                    : 'app-shell flex h-dvh max-w-[100vw] flex-col overflow-hidden bg-[var(--color-bg-soft)] text-[var(--color-text)]'
            }
        >
            {!shouldHideLayout && <Header />}
            <InstallPrompt />
            <ReleaseNotesPopup />
            {shouldHideLayout ? (
                <div className="min-w-0 max-w-[100vw] overflow-x-clip">
                    <Routes>
                        {renderRoutes(authRoutes)}
                    </Routes>
                </div>
            ) : (
                <div className="app-main-column flex min-h-0 flex-1 flex-col overflow-hidden lg:ml-64">
                    <div className="main-scroll-area min-h-0 flex-1 min-w-0 max-w-full overflow-y-auto overflow-x-hidden bg-[var(--color-bg)] safe-area-x">
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
