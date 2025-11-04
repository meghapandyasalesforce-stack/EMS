import React from 'react';
import { FiCamera } from 'react-icons/fi';

const ProfilePicture = ({ 
  user, 
  size = 'md', 
  showEditButton = false, 
  onEditClick,
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-24 h-24 text-2xl',
    '2xl': 'w-32 h-32 text-4xl'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
    '2xl': 'w-16 h-16'
  };

  const imageUrl = user?.profilePhoto?.url || user?.profilePhoto || user?.profilePicture;
  
  // Get initial for avatar
  const getInitials = () => {
    if (!user?.name) return 'U';
    const name = user.name.trim();
    const lastName = user?.lastName?.trim();
    if (name && lastName) {
      return `${name.charAt(0).toUpperCase()}${lastName.charAt(0).toUpperCase()}`;
    }
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className={`relative ${className}`}>
      <div className={`${sizeClasses[size]} rounded-full bg-gray-200 overflow-hidden flex items-center justify-center border-2 border-gray-300`}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Profile Picture"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-inner">
            <span className={`text-white font-bold ${sizeClasses[size].replace('w-', '')}`}>
              {getInitials()}
            </span>
          </div>
        )}
      </div>
      
      {showEditButton && onEditClick && (
        <button
          onClick={onEditClick}
          className="absolute -bottom-1 -right-1 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-1 shadow-lg transition-colors"
          title="Update Profile Photo"
        >
          <FiCamera className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

export default ProfilePicture;
