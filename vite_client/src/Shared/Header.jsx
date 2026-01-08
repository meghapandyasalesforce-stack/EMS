import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { FaBell, FaEnvelope, FaUserCircle, FaBars, FaTimes, FaSignOutAlt } from "react-icons/fa";
import { useSelector, useDispatch } from "react-redux";
import { logoutUser } from "../context/Auth/authSlice";
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
            // Clear attendance sessions
            dispatch(resetAttendance());
            
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
            await persistor.purge();
            
            // SECURITY FIX: Tokens are stored in httpOnly cookies and cleared by server on logout
            // Only clear non-sensitive UI-related data from localStorage
            localStorage.removeItem('csrfToken'); // CSRF token is safe to store (not a secret)
            localStorage.removeItem('role'); // UI state only
            localStorage.removeItem('email'); // UI state only
            localStorage.removeItem('organizationId'); // UI state only
            localStorage.removeItem('userId'); // UI state only
            localStorage.removeItem('isOrganizationLogin'); // UI state only
            navigate('/login'); // Use navigate for consistent routing
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
                                        className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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

    // Desktop Sidebar - Now non-minimizable
    const DesktopSidebar = () => (
        <div className="fixed top-0 left-0 h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white w-64 flex flex-col z-40 overflow-hidden shadow-2xl border-r border-gray-700/50">
            <div className="flex items-center justify-between p-5 border-b border-gray-700/50 flex-shrink-0 bg-gray-800/50 backdrop-blur-sm">
                <h3 className="font-extrabold text-3xl tracking-tight">
                    <span className="text-green-400 drop-shadow-lg">p</span>
                    <span className="text-white">a</span>
                    <span className="text-white">a</span>
                    <span className="text-white">r</span>
                    <span className="text-green-400 drop-shadow-lg">s</span>
                    <span className="text-white">i</span>
                    <span className="text-white">v</span>
                </h3>
            </div>

            {/* Make the nav scrollable so bottom sections (notifications/logout) stay visible */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                {navItems.map((item, index) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`group flex items-center p-3.5 mx-2 rounded-xl transition-all duration-300 mb-1 ${
                            isActive(item.path) 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30 scale-105' 
                                : 'hover:bg-gray-700/50 text-gray-300 hover:text-white hover:translate-x-1'
                        }`}
                        style={{ animationDelay: `${index * 50}ms` }}
                    >
                        <span className={`text-lg flex-shrink-0 transition-transform duration-300 ${isActive(item.path) ? 'scale-110' : 'group-hover:scale-110'}`}>
                            {item.icon}
                        </span>
                        <span className="ml-3 truncate font-medium">{item.name}</span>
                        {isActive(item.path) && (
                            <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                        )}
                    </Link>
                ))}
            </nav>

            {/* Notifications section - Fixed at bottom */}
            <div className="p-4 border-t border-gray-700/50 flex-shrink-0 bg-gray-800/50 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Notifications</span>
                    <div className="relative">
                        <NotificationDropdown />
                    </div>
                </div>
            </div>

            {/* Logout button at bottom - Fixed at bottom */}
            <div className="p-4 border-t border-gray-700/50 flex-shrink-0 bg-gray-800/50 backdrop-blur-sm">
                <button
                    onClick={openLogoutModal}
                    className="flex items-center justify-center gap-3 w-full p-3 rounded-xl text-gray-300 hover:text-white hover:bg-red-500/20 transition-all duration-300 group border border-transparent hover:border-red-500/30"
                >
                    <FaSignOutAlt className="text-lg flex-shrink-0 transition-transform group-hover:rotate-12" />
                    <span className="font-medium">Logout</span>
                </button>
            </div>
        </div>
    );

    // Mobile Header
    const MobileHeader = () => (
        <header className="fixed top-0 left-0 right-0 bg-gradient-to-r from-gray-800 to-gray-900 text-white shadow-xl z-30 border-b border-gray-700/50">
            <div className="flex justify-between items-center p-4">
                <button 
                    onClick={toggleMobileMenu} 
                    className="text-white focus:outline-none p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
                >
                    <FaBars className="text-xl" />
                </button>

                <div className="flex items-center gap-3">
                    <NotificationDropdown />

                    <div className="relative text-xl text-white cursor-pointer hover:text-blue-300 transition-colors p-2 rounded-lg hover:bg-gray-700/50">
                        <FaEnvelope />
                    </div>

                    <div className="relative">
                        <FaUserCircle
                            className="text-2xl text-white cursor-pointer hover:text-blue-300 transition-colors p-1 rounded-lg hover:bg-gray-700/50"
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
                <div className="bg-gradient-to-b from-gray-800 to-gray-900 text-white shadow-2xl animate-slideDown border-b border-gray-700/50">
                    <div className="px-4 py-4 border-b border-gray-700/50 flex justify-between items-center bg-gray-800/50 backdrop-blur-sm">
                        <h3 className="font-extrabold text-2xl tracking-tight">
                            <span className="text-green-400 drop-shadow-lg">p</span>
                            <span className="text-white">a</span>
                            <span className="text-white">a</span>
                            <span className="text-white">r</span>
                            <span className="text-green-400 drop-shadow-lg">s</span>
                            <span className="text-white">i</span>
                            <span className="text-white">v</span>
                        </h3>
                        <button 
                            onClick={toggleMobileMenu} 
                            className="text-white p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
                        >
                            <FaTimes className="text-xl" />
                        </button>
                    </div>
                    <nav className="flex flex-col py-2">
                        {navItems.map((item, index) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center p-4 mx-2 rounded-xl transition-all duration-300 ${
                                    isActive(item.path) 
                                        ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg' 
                                        : 'hover:bg-gray-700/50 text-gray-300'
                                }`}
                                onClick={() => setMobileMenuOpen(false)}
                                style={{ animationDelay: `${index * 50}ms` }}
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