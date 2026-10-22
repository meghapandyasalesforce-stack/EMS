import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { FaEnvelope, FaUserCircle, FaBars, FaTimes } from "react-icons/fa";
import { useSelector, useDispatch } from "react-redux";
import { logoutUser, setAvailablePortals, setActivePortal, clearPortals } from "../context/Auth/authSlice";
import { clearEmployeeDetails } from "../context/employeeDetailsSlice";
import { clearTimezoneContext } from "../context/timezoneSlice";
import { resetAttendance } from "../context/attendanceSlice";
import { toast } from 'react-toastify';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { persistor } from '../context/store';
import NotificationDropdown from '../components/NotificationDropdown';
import { getNavigationItems } from '../utils/navigationConfig';
import { syncPortalsForSession, getEffectiveActivePortal } from '../utils/portalConfig';
import PortalSwitcher from '../components/PortalSwitcher';
import ProfileDropdown from '../components/ProfileDropdown';
import SidebarNavList from '../components/SidebarNavList';
import ProfilePicture from './ProfilePicture';
import useDocumentModeSettings from '../Hooks/useDocumentModeSettings';
import { mergeSessionProfile } from '../utils/profileUtils';
import { clearOrgAdminCredentials } from '../utils/orgAdminCredentials';
import { isHrmsAuthenticatedUser } from '../utils/authSessionUtils';

const Header = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [logoutModalOpen, setLogoutModalOpen] = useState(false);
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const location = useLocation();

    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const permissions = useSelector((state) => state.auth.permissions) || [];
    const permissionFlags = useSelector((state) => state.auth.permissionFlags) || {};
    const roleBuckets = useSelector((state) => state.auth.roleBuckets) || [];
    const activePortal = useSelector((state) => state.auth.activePortal);
    const availablePortals = useSelector((state) => state.auth.availablePortals) || [];
    const sessionValidated = useSelector((state) => state.auth.sessionValidated);
    const email = useMemo(() => (user?.email || employee?.email) ?? null, [user, employee]);
    const profile = useMemo(() => mergeSessionProfile(user, employee), [user, employee]);

    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [mobileProfileDropdownOpen, setMobileProfileDropdownOpen] = useState(false);
    const profileDropdownRef = useRef(null);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 1024);
            if (window.innerWidth >= 1024) {
                setMobileMenuOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!isMobile || !mobileMenuOpen) return undefined;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previous;
        };
    }, [isMobile, mobileMenuOpen]);

    // Close nav overlays on route change so leftover backdrops cannot block sidebar clicks
    useEffect(() => {
        setMobileMenuOpen(false);
        setLogoutModalOpen(false);
        setMobileProfileDropdownOpen(false);
        document.body.style.overflow = '';
    }, [location.pathname]);

    // Close profile dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
                setMobileProfileDropdownOpen(false);
            }
        };

        if (mobileProfileDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [mobileProfileDropdownOpen]);

    useEffect(() => {
        if (!sessionValidated || (!user && !employee)) return;

        const { portals, activePortal: nextPortal } = syncPortalsForSession({
            user,
            employee,
            roleBuckets,
            permissionFlags,
            routeHint: location.pathname,
            currentActivePortal: activePortal,
        });

        const portalsKey = portals.map((p) => p.id).join(',');
        const currentKey = availablePortals.map((p) => p.id).join(',');

        if (portalsKey !== currentKey) {
            dispatch(setAvailablePortals(portals));
        }

        if (nextPortal && nextPortal !== activePortal) {
            dispatch(setActivePortal(nextPortal));
        }
    }, [
        sessionValidated,
        user,
        employee,
        roleBuckets,
        permissionFlags,
        activePortal,
        availablePortals,
        location.pathname,
        dispatch,
    ]);

    const effectivePortal = useMemo(
        () =>
            getEffectiveActivePortal({
                user,
                permissionFlags,
                roleBuckets,
                availablePortals,
                activePortal,
                routeHint: location.pathname,
            }),
        [user, permissionFlags, roleBuckets, availablePortals, activePortal, location.pathname]
    );

    const saasFeatures = useSelector((state) => state.auth.saasFeatures) || {};
    const documentModes = useDocumentModeSettings();

    const navItems = useMemo(() => {
        const items = getNavigationItems(
            user,
            employee,
            permissions,
            permissionFlags,
            effectivePortal,
            saasFeatures
        );
        if (!documentModes.ready) return items;
        const requestsOn = documentModes.enableDocumentRequests;
        const selfServiceOn = documentModes.enableSelfServiceDocuments;
        if (requestsOn && selfServiceOn) return items;
        return items.filter((item) => {
            if (item.path === '/employee/document-requests') return requestsOn || selfServiceOn;
            if (item.path === '/admin/document-management') return requestsOn || selfServiceOn;
            return true;
        });
    }, [user, employee, permissions, permissionFlags, effectivePortal, saasFeatures, documentModes]);

    // Own-profile nav on desktop only: omit on Admin portal; last item on HR / Me / other workspaces.
    const desktopNavItems = useMemo(() => {
        if (!user && !employee) return navItems;
        const otherItems = navItems.filter((item) => item.path !== '/profile-details');
        if (effectivePortal === 'admin') return otherItems;
        const existingProfile = navItems.find((item) => item.path === '/profile-details');
        const profileItem = existingProfile || { path: '/profile-details', name: 'Profile', icon: <FaUserCircle /> };
        return [...otherItems, profileItem];
    }, [navItems, user, employee, effectivePortal]);

    const handleLogout = async () => {
        try {
            dispatch(resetAttendance());
            dispatch(clearEmployeeDetails());
            dispatch(clearTimezoneContext());
            dispatch(clearPortals());

            await dispatch(logoutUser(email)).unwrap();

            await persistor.purge();

            localStorage.removeItem('csrfToken');
            localStorage.removeItem('role');
            localStorage.removeItem('email');
            localStorage.removeItem('organizationId');
            localStorage.removeItem('userId');
            localStorage.removeItem('isOrganizationLogin');
            localStorage.removeItem('activePortal');
            localStorage.removeItem('availablePortals');
            localStorage.removeItem('employeeDashboardRoute');
            clearOrgAdminCredentials();
            toast.success('Logged out successfully');
            navigate('/login');
        } catch (error) {
            toast.error(error.message || 'Logout failed. Please try again.');

            dispatch(resetAttendance());
            dispatch(clearEmployeeDetails());
            dispatch(clearTimezoneContext());
            dispatch(clearPortals());
            await persistor.purge();

            localStorage.removeItem('csrfToken');
            localStorage.removeItem('role');
            localStorage.removeItem('email');
            localStorage.removeItem('organizationId');
            localStorage.removeItem('userId');
            localStorage.removeItem('isOrganizationLogin');
            localStorage.removeItem('activePortal');
            localStorage.removeItem('availablePortals');
            localStorage.removeItem('employeeDashboardRoute');
            clearOrgAdminCredentials();
            navigate('/login');
        } finally {
            setLogoutModalOpen(false);
        }
    };

    const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
    const openLogoutModal = () => setLogoutModalOpen(true);
    const closeLogoutModal = () => setLogoutModalOpen(false);

    const useLightEmployeeNav = effectivePortal
        ? effectivePortal === 'employee'
        : (user?.role || employee?.role || '').toLowerCase() === 'employee';

    // Highlight active route — exact match for '/', startsWith for all others
    const isActive = useCallback(
        (path) =>
            path === '/profile-details'
                ? ['/profile-details', '/contact-details', '/education-qualifications', '/professional-experience', '/family-details', '/job-details', '/financial-details', '/profile-security', '/view-profile'].includes(location.pathname)
                : path === '/'
                ? location.pathname === '/'
                : location.pathname === path || location.pathname.startsWith(path + '/'),
        [location.pathname]
    );

    // Use button + navigate only (no <a href>). flushSync keeps the React
    // tree in lockstep with the URL (RR7 otherwise uses startTransition).
    const goTo = useCallback(
        (path) => {
            flushSync(() => {
                setMobileMenuOpen(false);
            });
            navigate(path);
        },
        [navigate]
    );

    const isCareerRoute = location.pathname.startsWith('/careers/');
    const isHrmsUser = sessionValidated && isHrmsAuthenticatedUser({
        user,
        employee,
        permissions,
        roleBuckets,
        permissionFlags,
    });
    const isCareerPublicMode = isCareerRoute && sessionValidated && !isHrmsUser;

    if (isCareerPublicMode) {
        const returnTo = `${location.pathname}${location.search}`;
        const loginHref = `/login?returnTo=${encodeURIComponent(returnTo)}`;
        return (
            <header className="safe-area-top relative z-30 flex h-14 w-full shrink-0 items-center justify-between border-b border-gray-700/50 bg-gradient-to-r from-gray-800 to-gray-900 px-4 text-white shadow-xl sm:px-6">
                <h3 className="text-2xl font-extrabold tracking-tight" aria-label="paarsiv">
                    <span className="drop-shadow-lg" style={{ color: 'var(--color-primary)' }}>p</span>
                    <span className="text-white">a</span>
                    <span className="text-white">a</span>
                    <span className="text-white">r</span>
                    <span className="drop-shadow-lg" style={{ color: 'var(--color-primary)' }}>s</span>
                    <span className="text-white">i</span>
                    <span className="text-white">v</span>
                </h3>
                {!user ? (
                    <Link
                        to={loginHref}
                        className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                        title="For existing company employees and HR staff only"
                    >
                        Employee Login
                    </Link>
                ) : null}
            </header>
        );
    }

    return (
        <>
            {isMobile ? (
                /* ── Mobile Header ── */
                <header
                    className={
                        useLightEmployeeNav
                            ? 'safe-area-top relative z-30 w-full shrink-0 border-b border-gray-200 bg-white text-gray-800 shadow-sm'
                            : 'safe-area-top relative z-30 w-full shrink-0 border-b border-white/10 bg-[var(--ui-secondary)] text-white shadow-sm'
                    }
                >
                    <div className="flex min-w-0 items-center justify-between gap-2 p-3 sm:p-4">
                        <button
                            type="button"
                            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                            onClick={toggleMobileMenu}
                            className={
                                useLightEmployeeNav
                                    ? 'shrink-0 rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none'
                                    : 'shrink-0 rounded-lg p-2 text-white transition-colors hover:bg-white/10 focus:outline-none'
                            }
                        >
                            {mobileMenuOpen ? <FaTimes className="text-xl" /> : <FaBars className="text-xl" />}
                        </button>

                        <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
                            <NotificationDropdown />

                            <div
                                className={
                                    useLightEmployeeNav
                                        ? 'relative hidden cursor-pointer rounded-lg p-2 text-xl text-gray-600 transition-colors hover:bg-gray-100 sm:block'
                                        : 'relative hidden cursor-pointer rounded-lg p-2 text-xl text-white transition-colors hover:bg-gray-700/50 sm:block'
                                }
                            >
                                <FaEnvelope className="hover:opacity-80" />
                            </div>

                            <div className="relative" ref={profileDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setMobileProfileDropdownOpen(!mobileProfileDropdownOpen)}
                                    className="relative shrink-0 rounded-full p-1 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                                    aria-label="Profile menu"
                                >
                                    <ProfilePicture user={profile} size="header" />
                                </button>
                                {mobileProfileDropdownOpen && (
                                    <ProfileDropdown
                                        isOpen={true}
                                        onClose={() => setMobileProfileDropdownOpen(false)}
                                        onLogout={handleLogout}
                                        onViewProfile={() => navigate('/profile-details')}
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Mobile menu backdrop */}
                    {mobileMenuOpen && (
                        <button
                            type="button"
                            aria-label="Close menu overlay"
                            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
                            onClick={() => setMobileMenuOpen(false)}
                        />
                    )}

                    {/* Mobile Menu — full viewport drawer (mobile only) */}
                    {mobileMenuOpen && (
                        <div
                            data-hrms-sidebar={useLightEmployeeNav ? undefined : true}
                            className={
                                useLightEmployeeNav
                                    ? 'fixed inset-0 z-50 flex flex-col overflow-hidden bg-white text-gray-800 lg:hidden'
                                    : 'ui-shell-sidebar fixed inset-0 z-50 flex flex-col overflow-hidden text-white lg:hidden'
                            }
                            style={{
                                paddingTop: 'env(safe-area-inset-top, 0px)',
                                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                                paddingLeft: 'env(safe-area-inset-left, 0px)',
                                paddingRight: 'env(safe-area-inset-right, 0px)',
                            }}
                        >
                            <div
                                className={
                                    useLightEmployeeNav
                                        ? 'flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3'
                                        : 'flex shrink-0 items-center justify-between border-b border-white/10 bg-[var(--ui-secondary-muted)] px-4 py-3'
                                }
                            >
                                <h3 className="text-xl font-extrabold tracking-tight" aria-label="paarsiv">
                                    {useLightEmployeeNav ? (
                                        <>
                                            <span style={{ color: 'var(--color-primary)' }}>p</span>
                                            <span className="text-gray-800">a</span>
                                            <span className="text-gray-800">a</span>
                                            <span className="text-gray-800">r</span>
                                            <span style={{ color: 'var(--color-primary)' }}>s</span>
                                            <span className="text-gray-800">i</span>
                                            <span className="text-gray-800">v</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="drop-shadow-lg" style={{ color: 'var(--color-primary)' }}>p</span>
                                            <span className="text-white">a</span>
                                            <span className="text-white">a</span>
                                            <span className="text-white">r</span>
                                            <span className="drop-shadow-lg" style={{ color: 'var(--color-primary)' }}>s</span>
                                            <span className="text-white">i</span>
                                            <span className="text-white">v</span>
                                        </>
                                    )}
                                </h3>
                                <button
                                    type="button"
                                    aria-label="Close menu"
                                    onClick={toggleMobileMenu}
                                    className={
                                        useLightEmployeeNav
                                            ? 'rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100'
                                            : 'rounded-lg p-2 text-white transition-colors hover:bg-white/10'
                                    }
                                >
                                    <FaTimes className="text-xl" />
                                </button>
                            </div>
                            <div className="shrink-0 px-2 py-2">
                                <PortalSwitcher compact lightTheme={useLightEmployeeNav} />
                            </div>
                            <nav
                                className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-2 py-2 pb-4"
                                data-hrms-sidebar-nav
                            >
                                <SidebarNavList
                                    items={navItems}
                                    isActive={isActive}
                                    onNavigate={goTo}
                                    lightTheme={useLightEmployeeNav}
                                />
                            </nav>
                        </div>
                    )}
                </header>
            ) : (
                /* ── Desktop: forest sidebar + top bar (bell / portal / profile) ── */
                <>
                    <div
                        data-hrms-sidebar
                        className={
                            useLightEmployeeNav
                                ? 'ui-shell-sidebar ui-shell-sidebar--light fixed top-0 left-0 z-[10050] flex h-screen flex-col overflow-hidden border-r text-gray-700'
                                : 'ui-shell-sidebar fixed top-0 left-0 z-[10050] flex h-screen flex-col overflow-hidden border-r text-white'
                        }
                    >
                        {/* Logo */}
                        <div
                            className={
                                useLightEmployeeNav
                                    ? 'flex flex-shrink-0 items-center justify-center border-b border-gray-200 bg-white p-6'
                                    : 'flex flex-shrink-0 items-center justify-center border-b border-white/10 p-5'
                            }
                        >
                            <h3 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--ui-font)' }}>
                                {useLightEmployeeNav ? (
                                    <>
                                        <span style={{ color: 'var(--color-primary)' }}>p</span>
                                        <span className="text-gray-800">a</span>
                                        <span className="text-gray-800">a</span>
                                        <span className="text-gray-800">r</span>
                                        <span style={{ color: 'var(--color-primary)' }}>s</span>
                                        <span className="text-gray-800">i</span>
                                        <span className="text-gray-800">v</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="drop-shadow-lg" style={{ color: 'var(--color-primary)' }}>p</span>
                                        <span className="text-white">a</span>
                                        <span className="text-white">a</span>
                                        <span className="text-white">r</span>
                                        <span className="drop-shadow-lg" style={{ color: 'var(--color-primary)' }}>s</span>
                                        <span className="text-white">i</span>
                                        <span className="text-white">v</span>
                                    </>
                                )}
                            </h3>
                        </div>

                        {/* Nav links — compact VS Code–style tree */}
                        <nav
                            data-hrms-sidebar-nav
                            className={
                                useLightEmployeeNav
                                    ? 'scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-2'
                                    : 'scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3'
                            }
                        >
                            <SidebarNavList
                                items={desktopNavItems}
                                isActive={isActive}
                                onNavigate={goTo}
                                lightTheme={useLightEmployeeNav}
                            />
                        </nav>
                    </div>

                    {/* Desktop top bar: portal switcher, bell, profile (no search) */}
                    <div className="ui-shell-topbar">
                        <PortalSwitcher lightTheme={true} />
                        <div className="ui-shell-topbar__actions">
                            <div className="relative">
                                <NotificationDropdown />
                            </div>
                            <div className="relative" ref={profileDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setMobileProfileDropdownOpen(!mobileProfileDropdownOpen)}
                                    className="relative shrink-0 rounded-full p-0.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                                    aria-label="Profile menu"
                                >
                                    <ProfilePicture user={profile} size="header" />
                                </button>
                                {mobileProfileDropdownOpen && (
                                    <ProfileDropdown
                                        isOpen={true}
                                        onClose={() => setMobileProfileDropdownOpen(false)}
                                        onLogout={openLogoutModal}
                                        onViewProfile={() => navigate('/profile-details')}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}


            {/* Logout Confirmation Modal */}
            <Transition appear show={logoutModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[11000]" onClose={closeLogoutModal}>
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black bg-opacity-25" />
                    </Transition.Child>

                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-[var(--ui-radius-lg)] bg-white p-6 text-left align-middle shadow-[var(--ui-shadow-lg)] transition-all" style={{ fontFamily: 'var(--ui-font)' }}>
                                    <Dialog.Title
                                        as="h3"
                                        className="text-lg font-semibold leading-6 text-[var(--ui-on-surface)]"
                                    >
                                        Confirm Logout
                                    </Dialog.Title>
                                    <div className="mt-2">
                                        <p className="text-sm text-[var(--ui-muted)]">
                                            Are you sure you want to logout?
                                        </p>
                                    </div>
                                    <div className="mt-4 flex justify-end space-x-3">
                                        <button
                                            type="button"
                                            className="ui-btn ui-btn--outlined"
                                            onClick={closeLogoutModal}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className="ui-btn ui-btn--danger"
                                            onClick={handleLogout}
                                        >
                                            Logout
                                        </button>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </>
    );
};

export default Header;
