import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, useLocation } from 'react-router-dom';
import Header from './Shared/Header';
import ProfileSidebar from './Employee/ProfileSidebar';
import InstallPrompt from './components/InstallPrompt';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
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
    const hideHeaderRoutes = ['/', '/login', '/register', '/organization/register', '/organization/login', '/forgot-password']; // Routes where Header and Sidebar should not be shown
    const showSidebarRoutes = [
        '/profile-details',
        '/contact-details',
        '/next-of-kin-details',
        '/education-qualifications',
        '/guarantor-details',
        '/family-details',
        '/job-details',
        '/financial-details',
    ]; // Routes where ProfileSidebar should be shown

    const [activeSection, setActiveSection] = useState('Personal Details'); // Track active section

    // Keep sidebar selection in sync with current URL (handles refresh / deep link)
    useEffect(() => {
        const pathToSectionMap = {
            '/profile-details': 'Personal Details',
            '/contact-details': 'Contact Details',
            '/next-of-kin-details': 'Next of kin Details',
            '/education-qualifications': 'Education Qualifications',
            '/guarantor-details': 'Guarantor Details',
            '/family-details': 'Family Details',
            '/job-details': 'Job Details',
            '/financial-details': 'Financial Details',
        };
        const mapped = pathToSectionMap[location.pathname];
        if (mapped && mapped !== activeSection) {
            setActiveSection(mapped);
        }
    }, [location.pathname, activeSection]);

    // Check if pathname is in hideHeaderRoutes or starts with /reset-password (for token routes)
    const shouldHideLayout = hideHeaderRoutes.includes(location.pathname) || location.pathname.startsWith('/reset-password');
    const shouldShowSidebar = showSidebarRoutes.includes(location.pathname);
    
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            {!shouldHideLayout && <Header />} {/* Conditionally render Header */}
            <InstallPrompt /> {/* PWA Install Prompt */}
            {shouldHideLayout ? (
                // Full-screen layout for auth pages (no header, no sidebar, no flex container)
                <Routes>
                    {renderRoutes(authRoutes)}
                </Routes>
            ) : (
                // Push content right of fixed main nav so profile sidebar + content don't sit under it
                <div className="flex min-h-[calc(100vh-64px)] ml-0 lg:ml-64">
                    {shouldShowSidebar && (
                        <div className="w-64 flex-shrink-0 bg-white shadow-lg border-r border-gray-100">
                            <ProfileSidebar
                                activeSection={activeSection} // Pass active section
                                onSectionClick={setActiveSection} // Update active section
                            />
                        </div>
                    )}
                    <div className="flex-1 min-w-0 overflow-auto bg-gradient-to-br from-gray-50/50 to-white">
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
