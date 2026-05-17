import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { FaBell, FaEnvelope, FaUserCircle, FaBars, FaTimes, FaSignOutAlt } from "react-icons/fa";
import { useSelector, useDispatch } from "react-redux";
import { logoutUser } from "../context/Auth/authSlice";
import { clearEmployeeDetails } from "../context/employeeDetailsSlice";
import { resetAttendance } from "../context/attendanceSlice";
import { toast } from 'react-toastify';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { persistor } from '../context/store';
import NotificationDropdown from '../components/NotificationDropdown';
import { getNavigationItems } from '../utils/navigationConfig';

const Header = () => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [logoutModalOpen, setLogoutModalOpen] = useState(false);
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const location = useLocation();

    // Get user data from Redux store with memoized selector
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const { username, email } = useMemo(() => {
        return user ? { username: user.name || user.username, email: user.email } : { username: null, email: null };
    }, [user]);

    // Check screen size for responsive behavior
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

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

    const handleLogout = async () => {
        try {
            dispatch(resetAttendance());
            dispatch(clearEmployeeDetails());
            
            await dispatch(logoutUser(email)).unwrap();
            
            // Purge persisted state
            await persistor.purge();
            
            // SECURITY FIX: Tokens are stored in httpOnly cookies and cleared by server on logout
            // Only clear non-sensitive UI-related data from localStorage
            // CSRF token in localStorage is acceptable (see SECURITY.md)
            localStorage.removeItem('csrfToken'); // CSRF token is safe to store (not a secret)
            localStorage.removeItem('role'); // UI state only
            localStorage.removeItem('email'); // UI state only
            localStorage.removeItem('organizationId'); // UI state only
            localStorage.removeItem('userId'); // UI state only
            localStorage.removeItem('isOrganizationLogin'); // UI state only
            toast.success('Logged out successfully');
            navigate('/login');
        } catch (error) {
            // Removed console.error for production
            toast.error(error.message || 'Logout failed. Please try again.'); // Display a user-friendly error message
            
            // Clear attendance even if logout API fails
            dispatch(resetAttendance());
            dispatch(clearEmployeeDetails());
            await persistor.purge();
            
            localStorage.removeItem('csrfToken');
            localStorage.removeItem('role');
            localStorage.removeItem('email');
            localStorage.removeItem('organizationId');
            localStorage.removeItem('userId');
            localStorage.removeItem('isOrganizationLogin');
            navigate('/login');
        } finally {
            setLogoutModalOpen(false);
        }
    };

    const toggleDropdown = () => setDropdownOpen(!dropdownOpen);
    const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
    const openLogoutModal = () => setLogoutModalOpen(true);
    const closeLogoutModal = () => setLogoutModalOpen(false);

    // Get navigation items based on user role, department, and position
    const navItems = useMemo(() => {
        return getNavigationItems(user, employee);
    }, [user, employee]);

    // Light nav matches employee app pages (--color-bg / --color-bg-soft); keep dark for admin
    const isAdminUser = useMemo(
        () => (user?.role || employee?.role || '').toLowerCase() === 'admin',
        [user, employee]
    );
    const useLightEmployeeNav = !isAdminUser;

    // Highlight active route
    const isActive = (path) => location.pathname === path;

    // Logout Confirmation Modal
    const LogoutConfirmationModal = () => (
        <Transition appear show={logoutModalOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={closeLogoutModal}>
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
    );

    // Desktop Sidebar - non-admin: light surface to match employee pages; admin: dark
    const DesktopSidebar = () => (
        <div
            className={
                useLightEmployeeNav
                    ? 'fixed top-0 left-0 z-40 flex h-screen w-64 flex-col overflow-hidden border-r border-slate-200/90 bg-[var(--color-bg)] text-[var(--color-text)] shadow-sm'
                    : 'fixed top-0 left-0 z-40 flex h-screen w-64 flex-col overflow-hidden border-r border-gray-700/50 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white shadow-2xl'
            }
        >
            <div
                className={
                    useLightEmployeeNav
                        ? 'flex flex-shrink-0 items-center justify-between border-b border-slate-200/90 bg-[var(--color-bg-soft)] p-5'
                        : 'flex flex-shrink-0 items-center justify-between border-b border-gray-700/50 bg-gray-800/50 p-5 backdrop-blur-sm'
                }
            >
                <h3 className="text-3xl font-extrabold tracking-tight">
                    <span className="drop-shadow-lg" style={{ color: 'var(--color-primary)' }}>p</span>
                    <span className={useLightEmployeeNav ? 'text-slate-800' : 'text-white'}>a</span>
                    <span className={useLightEmployeeNav ? 'text-slate-800' : 'text-white'}>a</span>
                    <span className={useLightEmployeeNav ? 'text-slate-800' : 'text-white'}>r</span>
                    <span className="drop-shadow-lg" style={{ color: 'var(--color-primary)' }}>s</span>
                    <span className={useLightEmployeeNav ? 'text-slate-800' : 'text-white'}>i</span>
                    <span className={useLightEmployeeNav ? 'text-slate-800' : 'text-white'}>v</span>
                </h3>
            </div>

            <nav
                className={
                    useLightEmployeeNav
                        ? 'scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent flex-1 overflow-y-auto overflow-x-hidden px-2 py-3'
                        : 'scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent flex-1 overflow-y-auto overflow-x-hidden px-2 py-3'
                }
            >
                {navItems.map((item, index) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`group mb-1 flex items-center rounded-xl p-3.5 mx-2 transition-all duration-300 ${
                            isActive(item.path)
                                ? 'scale-105 text-white shadow-lg'
                                : useLightEmployeeNav
                                    ? 'text-slate-600 hover:translate-x-1 hover:bg-slate-100/90 hover:text-slate-900'
                                    : 'text-gray-300 hover:translate-x-1 hover:bg-gray-700/50 hover:text-white'
                        }`}
                        style={{
                            animationDelay: `${index * 50}ms`,
                            ...(isActive(item.path)
                                ? { backgroundColor: 'var(--color-primary)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.12)' }
                                : {}),
                        }}
                    >
                        <span className={`text-lg flex-shrink-0 transition-transform duration-300 ${isActive(item.path) ? 'scale-110' : 'group-hover:scale-110'}`}>
                            {item.icon}
                        </span>
                        <span className="ml-3 truncate font-medium">{item.name}</span>
                        {isActive(item.path) && (
                            <div className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-white"></div>
                        )}
                    </Link>
                ))}
            </nav>

            <div
                className={
                    useLightEmployeeNav
                        ? 'flex-shrink-0 border-t border-slate-200/90 bg-[var(--color-bg-soft)] p-4'
                        : 'flex-shrink-0 border-t border-gray-700/50 bg-gray-800/50 p-4 backdrop-blur-sm'
                }
            >
                <div className="flex items-center justify-between gap-2">
                    <span
                        className={
                            useLightEmployeeNav
                                ? 'text-xs font-semibold uppercase tracking-wide text-slate-500'
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

            <div
                className={
                    useLightEmployeeNav
                        ? 'flex-shrink-0 border-t border-slate-200/90 bg-[var(--color-bg-soft)] p-4'
                        : 'flex-shrink-0 border-t border-gray-700/50 bg-gray-800/50 p-4 backdrop-blur-sm'
                }
            >
                <button
                    onClick={openLogoutModal}
                    className={
                        useLightEmployeeNav
                            ? 'group flex w-full items-center justify-center gap-3 rounded-xl border border-transparent p-3 text-slate-600 transition-all duration-300 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
                            : 'group flex w-full items-center justify-center gap-3 rounded-xl border border-transparent p-3 text-gray-300 transition-all duration-300 hover:border-red-500/30 hover:bg-red-500/20 hover:text-white'
                    }
                >
                    <FaSignOutAlt className="text-lg flex-shrink-0 transition-transform group-hover:rotate-12" />
                    <span className="font-medium">Logout</span>
                </button>
            </div>
        </div>
    );

    // Mobile Header
    const MobileHeader = () => (
        <header
            className={
                useLightEmployeeNav
                    ? 'fixed top-0 right-0 left-0 z-30 border-b border-slate-200/90 bg-[var(--color-bg)] text-slate-800 shadow-sm'
                    : 'fixed top-0 right-0 left-0 z-30 border-b border-gray-700/50 bg-gradient-to-r from-gray-800 to-gray-900 text-white shadow-xl'
            }
        >
            <div className="flex items-center justify-between p-4">
                <button
                    onClick={toggleMobileMenu}
                    className={
                        useLightEmployeeNav
                            ? 'rounded-lg p-2 text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none'
                            : 'rounded-lg p-2 text-white transition-colors hover:bg-gray-700/50 focus:outline-none'
                    }
                >
                    <FaBars className="text-xl" />
                </button>

                <div className="flex items-center gap-3">
                    <NotificationDropdown />

                    <div
                        className={
                            useLightEmployeeNav
                                ? 'relative cursor-pointer rounded-lg p-2 text-xl text-slate-600 transition-colors hover:bg-slate-100'
                                : 'relative cursor-pointer rounded-lg p-2 text-xl text-white transition-colors hover:bg-gray-700/50'
                        }
                        style={{ ['--hover-color']: 'var(--color-secondary)' }}
                    >
                        <FaEnvelope className="hover:opacity-80" />
                    </div>

                    <div className="relative">
                        <FaUserCircle
                            className={
                                useLightEmployeeNav
                                    ? 'cursor-pointer rounded-lg p-1 text-2xl text-slate-600 transition-colors hover:bg-slate-100 hover:opacity-90'
                                    : 'cursor-pointer rounded-lg p-1 text-2xl text-white transition-colors hover:bg-gray-700/50 hover:opacity-90'
                            }
                            onClick={toggleDropdown}
                        />
                        {dropdownOpen && (
                            <div className="absolute top-full right-0 mt-2 bg-white text-black rounded-xl shadow-2xl p-2 z-50 w-56 border border-gray-100 animate-scaleIn">
                                <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Welcome,</p>
                                    <p className="text-sm font-bold text-gray-900 truncate mt-1">{username}</p>
                                </div>
                                <button
                                    className="flex items-center w-full px-4 py-3 text-sm text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                                    onClick={openLogoutModal}
                                >
                                    <FaSignOutAlt className="mr-2" />
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
                <div
                    className={
                        useLightEmployeeNav
                            ? 'animate-slideDown border-b border-slate-200/90 bg-[var(--color-bg)] text-slate-800 shadow-lg'
                            : 'animate-slideDown border-b border-gray-700/50 bg-gradient-to-b from-gray-800 to-gray-900 text-white shadow-2xl'
                    }
                >
                    <div
                        className={
                            useLightEmployeeNav
                                ? 'flex items-center justify-between border-b border-slate-200/90 bg-[var(--color-bg-soft)] px-4 py-4'
                                : 'flex items-center justify-between border-b border-gray-700/50 bg-gray-800/50 px-4 py-4 backdrop-blur-sm'
                        }
                    >
                        <h3 className="text-2xl font-extrabold tracking-tight">
                            <span className="drop-shadow-lg" style={{ color: 'var(--color-primary)' }}>p</span>
                            <span className={useLightEmployeeNav ? 'text-slate-800' : 'text-white'}>a</span>
                            <span className={useLightEmployeeNav ? 'text-slate-800' : 'text-white'}>a</span>
                            <span className={useLightEmployeeNav ? 'text-slate-800' : 'text-white'}>r</span>
                            <span className="drop-shadow-lg" style={{ color: 'var(--color-primary)' }}>s</span>
                            <span className={useLightEmployeeNav ? 'text-slate-800' : 'text-white'}>i</span>
                            <span className={useLightEmployeeNav ? 'text-slate-800' : 'text-white'}>v</span>
                        </h3>
                        <button
                            onClick={toggleMobileMenu}
                            className={
                                useLightEmployeeNav
                                    ? 'rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-200/80'
                                    : 'rounded-lg p-2 text-white transition-colors hover:bg-gray-700/50'
                            }
                        >
                            <FaTimes className="text-xl" />
                        </button>
                    </div>
                    <nav className="flex flex-col py-2">
                        {navItems.map((item, index) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`mx-2 flex items-center rounded-xl p-4 transition-all duration-300 ${
                                    isActive(item.path)
                                        ? 'text-white shadow-lg'
                                        : useLightEmployeeNav
                                            ? 'text-slate-600 hover:bg-slate-100'
                                            : 'text-gray-300 hover:bg-gray-700/50'
                                }`}
                                onClick={() => setMobileMenuOpen(false)}
                                style={{
                                    animationDelay: `${index * 50}ms`,
                                    ...(isActive(item.path) ? { backgroundColor: 'var(--color-primary)' } : {}),
                                }}
                            >
                                <span className={`text-lg mr-3 transition-transform ${isActive(item.path) ? 'scale-110' : ''}`}>
                                    {item.icon}
                                </span>
                                <span className="font-medium">{item.name}</span>
                                {isActive(item.path) && (
                                    <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                                )}
                            </Link>
                        ))}
                    </nav>
                </div>
            )}
        </header>
    );

    return (
        <>
            {isMobile ? <MobileHeader /> : <DesktopSidebar />}

            {/* Add margin to main content for desktop sidebar */}
            {/* Removed duplicate margin - DashboardAdmin handles its own margin */}

            {/* Add padding top for mobile header */}
            {isMobile && <div className="pt-16"></div>}

            {/* Logout Confirmation Modal */}
            <LogoutConfirmationModal />
        </>
    );
};

export default Header;