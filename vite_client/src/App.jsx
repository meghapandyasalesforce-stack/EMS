import React, { useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import Header from './Shared/Header';
import InstallPrompt from './components/InstallPrompt';
import ReleaseNotesPopup from './components/ReleaseNotesPopup';
import HrmsPopupDismissListener from './components/HrmsPopupDismissListener';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import { checkAuthSession } from './context/Auth/authSlice';
import store from './context/store';
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
import { isHrmsAuthenticatedUser } from './utils/authSessionUtils';

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
    const sessionValidated = useSelector((state) => state.auth.sessionValidated);
    const authUser = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const permissions = useSelector((state) => state.auth.permissions) || [];
    const roleBuckets = useSelector((state) => state.auth.roleBuckets) || [];
    const permissionFlags = useSelector((state) => state.auth.permissionFlags) || {};
    const hideHeaderRoutes = ['/', '/login', '/register', '/organization/register', '/organization/login', '/forgot-password'];
    const isCareerRoute = location.pathname.startsWith('/careers/');
    const isCareerJobApply = /\/careers\/[^/]+\/jobs\//.test(location.pathname);
    const isHrmsUser = sessionValidated && isHrmsAuthenticatedUser({
        user: authUser,
        employee,
        permissions,
        roleBuckets,
        permissionFlags,
    });
    const isCareerPublicMode = isCareerRoute && sessionValidated && !isHrmsUser;
    const shouldHideLayout = hideHeaderRoutes.includes(location.pathname)
        || location.pathname.startsWith('/reset-password')
        || location.pathname.startsWith('/offer/')
        || location.pathname.startsWith('/application/');
    const useHrmsShell = !shouldHideLayout && (!isCareerRoute || isHrmsUser);
    const sessionBootstrapped = useRef(false);
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
                    if (!store.getState().auth.user) {
                        dispatch(clearEmployeeDetails());
                        dispatch(clearTimezoneContext());
                    }
                }
            } catch {
                if (!cancelled && !store.getState().auth.user) {
                    dispatch(clearEmployeeDetails());
                    dispatch(clearTimezoneContext());
                }
            }
        };
        if (!sessionBootstrapped.current) {
            sessionBootstrapped.current = true;
            bootstrapSession();
        }
        return () => {
            cancelled = true;
        };
    }, [dispatch]);

    if (!sessionValidated) {
        return <LoadingSpinner message="Initializing session..." />;
    }

    return (
        <div
            className={
                useHrmsShell
                    ? 'app-shell flex h-dvh max-w-[100vw] flex-col overflow-hidden bg-[var(--color-bg-soft)] text-[var(--color-text)]'
                    : (isCareerPublicMode && isCareerJobApply
                        ? 'flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-[var(--color-bg-soft)] text-[var(--color-text)]'
                        : isCareerPublicMode
                            ? 'flex min-h-screen w-full flex-col bg-[var(--color-bg-soft)] text-[var(--color-text)]'
                            : 'min-h-screen w-full bg-[var(--color-bg-soft)] text-[var(--color-text)]')
            }
        >
            {(useHrmsShell || isCareerPublicMode) && <Header />}
            <InstallPrompt />
            <ReleaseNotesPopup />
            <HrmsPopupDismissListener />
            {useHrmsShell ? (
                <div className="app-main-column flex min-h-0 w-full flex-1 flex-col overflow-hidden lg:ml-64 lg:w-[calc(100%-16rem)] lg:max-w-[calc(100vw-16rem)]">
                    <div
                        className={
                            isCareerJobApply
                                ? 'main-scroll-area hrms-page-canvas flex min-h-0 flex-1 min-w-0 max-w-full flex-col overflow-hidden safe-area-x'
                                : 'main-scroll-area hrms-page-canvas min-h-0 flex-1 min-w-0 max-w-full overflow-y-auto overflow-x-hidden safe-area-x'
                        }
                    >
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
            ) : (
                <div
                    className={
                        isCareerPublicMode && isCareerJobApply
                            ? 'flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden'
                            : isCareerPublicMode
                                ? 'min-w-0 w-full max-w-full flex-1 box-border'
                                : 'min-w-0 w-full max-w-full box-border'
                    }
                >
                    <Routes>
                        {renderRoutes(authRoutes)}
                    </Routes>
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
