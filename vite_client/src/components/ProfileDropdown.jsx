import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { FaSignOutAlt } from 'react-icons/fa';
import RoleBucketBadges from './RoleBucketBadges';
import { getProfileDisplayName } from '../utils/profileUtils';

const ProfileDropdown = ({
    isOpen = true,
    onClose,
    username: usernameProp,
    onLogout,
    onViewProfile,
    position = 'right',
    className = '',
}) => {
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);

    const username = usernameProp || getProfileDisplayName(user, employee);

    const handleViewProfile = () => {
        if (onViewProfile) {
            onViewProfile();
        } else {
            navigate('/profile-details');
        }
        if (onClose) onClose();
    };

    const handleLogoutClick = () => {
        if (onLogout) {
            onLogout();
        }
        if (onClose) onClose();
    };

    if (!isOpen) return null;

    const positionClasses = {
        right: 'right-0',
        left: 'left-0',
        center: 'left-1/2 -translate-x-1/2',
    };

    return (
        <div
            className={`absolute top-full ${positionClasses[position]} mt-2 bg-white text-black rounded-xl shadow-2xl p-2 z-50 w-[min(14rem,calc(100vw-2rem))] border border-gray-100 animate-scaleIn ${className}`}
            role="menu"
            data-hrms-popup
        >
            <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Welcome,</p>
                <button
                    type="button"
                    role="menuitem"
                    onClick={handleViewProfile}
                    className="block w-full text-left text-sm font-bold text-gray-900 truncate mt-1 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] rounded"
                    title={username}
                >
                    {username}
                </button>
                <RoleBucketBadges className="mt-2" />
            </div>
            {onViewProfile && (
                <button
                    type="button"
                    className="flex items-center w-full px-4 py-3 text-sm text-left text-[#20C997] hover:bg-gray-50 rounded-lg transition-colors font-medium"
                    onClick={handleViewProfile}
                >
                    View Profile →
                </button>
            )}
            <div className="border-t border-gray-100 my-1"></div>
            <button
                type="button"
                className="flex items-center w-full px-4 py-3 text-sm text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                onClick={handleLogoutClick}
            >
                <FaSignOutAlt className="mr-2 shrink-0" />
                Logout
            </button>
        </div>
    );
};

export default ProfileDropdown;
