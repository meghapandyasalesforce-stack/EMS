import React, { useState } from 'react';
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
  renderRoutes
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

    const shouldHideLayout = hideHeaderRoutes.includes(location.pathname);
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
                // Standard layout with sidebar for other pages
                <div className="flex min-h-[calc(100vh-64px)]">
                    {shouldShowSidebar && (
                        <div className="w-64 bg-white shadow-lg border-r border-gray-100">
                            <ProfileSidebar
                                activeSection={activeSection} // Pass active section
                                onSectionClick={setActiveSection} // Update active section
                            />
                        </div>
                    )}
                    <div className="flex-1 overflow-auto bg-gradient-to-br from-gray-50/50 to-white">
                        <Routes>
                            {renderRoutes(dashboardRoutes)}
                            {renderRoutes(employeeRoutes)}
                            {renderRoutes(projectRoutes)}
                            {renderRoutes(profileDetailRoutes)}
                            {renderRoutes(leaveRoutes)}
                            {renderRoutes(payrollRoutes)}
                            {renderRoutes(attendanceRoutes)}
                            {renderRoutes(organizationRoutes)}
                            {renderRoutes(adminRoutes)}
                            {renderRoutes(hrRoutes)}
                            {renderRoutes(otherRoutes)}
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
