import React from 'react';
import { getUserRoleBadge } from '../utils/managerHelper';

/**
 * Role Badge Component
 * Displays a badge indicating the user's role (Admin, HR, Manager, Employee)
 */
const RoleBadge = ({ user, className = '' }) => {
    if (!user) return null;
    
    const badge = getUserRoleBadge(user);
    
    const colorClasses = {
        purple: 'bg-purple-100 text-purple-800 border-purple-200',
        blue: 'bg-blue-100 text-blue-800 border-blue-200',
        green: 'bg-green-100 text-green-800 border-green-200',
        gray: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    
    return (
        <span 
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses[badge.color]} ${className}`}
            title={`Role: ${badge.label}`}
        >
            {badge.label}
        </span>
    );
};

export default RoleBadge;

