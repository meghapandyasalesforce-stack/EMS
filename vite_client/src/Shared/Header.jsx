import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { FaBell, FaEnvelope, FaUserCircle, FaBars, FaTimes, FaSignOutAlt } from "react-icons/fa";
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

    const isAdminUser = useMemo(
        () => (user?.role || employee?.role || '').toLowerCase() === 'admin',
        [user, employee]
    );
    const useLightEmployeeNav = effectivePortal
        ? effectivePortal === 'employee'
        : (user?.role || employee?.role || '').toLowerCase() === 'employee';

    // Highlight active route — exact match for '/', startsWith for all others
    const isActive = useCallback(
        (path) =>
            path === '/'
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
                            : 'safe-area-top relative z-30 w-full shrink-0 border-b border-gray-700/50 bg-gradient-to-r from-gray-800 to-gray-900 text-white shadow-xl'
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
                                    : 'shrink-0 rounded-lg p-2 text-white transition-colors hover:bg-gray-700/50 focus:outline-none'
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
                                    <FaUserCircle className="h-9 w-9 text-gray-600 transition-colors hover:text-gray-800 dark:text-gray-300 dark:hover:text-white" />
                                </button>
                                {mobileProfileDropdownOpen && (
                                    <div className="absolute right-0 top-12 z-50 w-64 rounded-xl bg-white shadow-xl ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700">
                                        <ProfileDropdown
                                            isOpen={true}
                                            onClose={() => setMobileProfileDropdownOpen(false)}
                                            onLogout={handleLogout}
                                            onViewProfile={() => navigate('/profile-details')}
                                        />
                                    </div>
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
                            className={
                                useLightEmployeeNav
                                    ? 'fixed inset-0 z-50 flex flex-col overflow-hidden bg-white text-gray-800 lg:hidden'
                                    : 'fixed inset-0 z-50 flex flex-col overflow-hidden bg-gradient-to-b from-gray-800 to-gray-900 text-white lg:hidden'
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
                                        : 'flex shrink-0 items-center justify-between border-b border-gray-700/50 bg-gray-800/80 px-4 py-3'
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
                                            : 'rounded-lg p-2 text-white transition-colors hover:bg-gray-700/50'
                                    }
                                >
                                    <FaTimes className="text-xl" />
                                </button>
                            </div>
                            <div className="shrink-0">
                                <PortalSwitcher compact lightTheme={useLightEmployeeNav} />
                            </div>
                            <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain py-2 pb-4" data-hrms-sidebar-nav>
                                {navItems.map((item, index) => (
                                    <button
                                        key={item.path}
                                        type="button"
                                        onClick={() => goTo(item.path)}
                                        className={`mx-2 flex w-[calc(100%-1rem)] items-center rounded-xl px-3 py-3 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
                                            isActive(item.path)
                                                ? 'text-white shadow-md'
                                                : useLightEmployeeNav
                                                    ? 'text-gray-600 hover:bg-gray-100'
                                                    : 'text-gray-300 hover:bg-gray-700/50'
                                        }`}
                                        style={{
                                            animationDelay: `${index * 50}ms`,
                                            ...(isActive(item.path)
                                                ? { backgroundColor: 'var(--color-primary)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.12)' }
                                                : {}),
                                        }}
                                    >
                                        <span className="mr-3 text-lg">
                                            {item.icon}
                                        </span>
                                        <span className="font-medium">{item.name}</span>
                                        {isActive(item.path) && (
                                            <div className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />
                                        )}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    )}
                </header>
            ) : (
                /* ── Desktop Sidebar ── */
                <div
                    data-hrms-sidebar
                    className={
                        useLightEmployeeNav
                            ? 'fixed top-0 left-0 z-[10050] flex h-screen w-64 flex-col overflow-hidden border-r border-gray-200 bg-white text-gray-700 shadow-sm'
                            : 'fixed top-0 left-0 z-[10050] flex h-screen w-64 flex-col overflow-hidden border-r border-gray-700/50 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white shadow-2xl'
                    }
                >
                    {/* Logo */}
                    <div
                        className={
                            useLightEmployeeNav
                                ? 'flex flex-shrink-0 items-center justify-center border-b border-gray-200 bg-white p-6'
                                : 'flex flex-shrink-0 items-center justify-center border-b border-gray-700/50 bg-gray-800/50 p-5 backdrop-blur-sm'
                        }
                    >
                        <h3 className={`text-3xl font-extrabold tracking-tight ${useLightEmployeeNav ? '' : ''}`}>
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

                    {useLightEmployeeNav && <PortalSwitcher lightTheme={true} />}
                    {!useLightEmployeeNav && <PortalSwitcher lightTheme={false} />}

                    {/* Nav links */}
                    <nav
                        data-hrms-sidebar-nav
                        className={
                            useLightEmployeeNav
                                ? 'scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent flex-1 overflow-y-auto overflow-x-hidden px-3 py-4'
                                : 'scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent flex-1 overflow-y-auto overflow-x-hidden px-2 py-3'
                        }
                    >
                        {navItems.map((item, index) => (
                            <button
                                key={item.path}
                                type="button"
                                onClick={() => goTo(item.path)}
                                className={`group mb-1 flex w-[calc(100%-1rem)] items-center rounded-xl p-3.5 mx-2 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1 ${
                                    isActive(item.path)
                                        ? 'text-white shadow-md'
                                        : useLightEmployeeNav
                                            ? 'text-gray-600 hover:bg-gray-100/90 hover:text-gray-900'
                                            : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                                }`}
                                style={{
                                    animationDelay: `${index * 50}ms`,
                                    ...(isActive(item.path)
                                        ? { backgroundColor: 'var(--color-primary)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.12)' }
                                        : {}),
                                }}
                            >
                                <span className={`text-lg flex-shrink-0 transition-transform duration-200 ${isActive(item.path) ? '' : 'group-hover:scale-105'}`}>
                                    {item.icon}
                                </span>
                                <span className="ml-3 truncate font-medium">{item.name}</span>
                                {isActive(item.path) && (
                                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-white"></div>
                                )}
                            </button>
                        ))}
                    </nav>

                    {/* Notifications */}
                    <div
                        className={
                            useLightEmployeeNav
                                ? 'flex-shrink-0 border-t border-gray-200 bg-white p-4'
                                : 'flex-shrink-0 border-t border-gray-700/50 bg-gray-800/50 p-4 backdrop-blur-sm'
                        }
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span
                                className={
                                    useLightEmployeeNav
                                        ? 'text-xs font-semibold uppercase tracking-wide text-gray-500'
                                        : 'text-xs font-semibold uppercase tracking-wide text-gray-400'
                                }
                            >
                                Notifications
                            </span>
                            <div className="relative">
                                <NotificationDropdown />
                            </div>
                        </div>
                    </div>

                    {/* Logout */}
                    <div
                        className={
                            useLightEmployeeNav
                                ? 'flex-shrink-0 border-t border-gray-200 bg-white p-4'
                                : 'flex-shrink-0 border-t border-gray-700/50 bg-gray-800/50 p-4 backdrop-blur-sm'
                        }
                    >
                        <button
                            onClick={openLogoutModal}
                            className={
                                useLightEmployeeNav
                                    ? 'group flex w-full items-center justify-center gap-3 rounded-xl border border-transparent p-3 text-gray-600 transition-all duration-300 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
                                    : 'group flex w-full items-center justify-center gap-3 rounded-xl border border-transparent p-3 text-gray-300 transition-all duration-300 hover:border-red-500/30 hover:bg-red-500/20 hover:text-white'
                            }
                        >
                            <FaSignOutAlt className="text-lg flex-shrink-0 transition-transform group-hover:rotate-12" />
                            <span className="font-medium">Logout</span>
                        </button>
                    </div>
                </div>
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
                                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                                    <Dialog.Title
                                        as="h3"
                                        className="text-lg font-medium leading-6 text-gray-900"
                                    >
                                        Confirm Logout
                                    </Dialog.Title>
                                    <div className="mt-2">
                                        <p className="text-sm text-gray-500">
                                            Are you sure you want to logout?
                                        </p>
                                    </div>
                                    <div className="mt-4 flex justify-end space-x-3">
                                        <button
                                            type="button"
                                            className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
                                            onClick={closeLogoutModal}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className="inline-flex justify-center rounded-md border border-transparent bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
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
