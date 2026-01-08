import React, { useState, useEffect } from 'react';
import { FiCamera } from 'react-icons/fi';
import { getUploadUrl } from '../utils/axios';
import logger from '../utils/logger';

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

  // Get the profile photo URL and convert relative paths to full URLs
  // Handle both object format {url: "...", filename: "..."} and string format
  let rawImageUrl = null;
  if (user?.profilePhoto) {
    if (typeof user.profilePhoto === 'string') {
      rawImageUrl = user.profilePhoto;
    } else if (user.profilePhoto.url) {
      // Prefer url property if available (contains full path)
      rawImageUrl = user.profilePhoto.url;
    } else if (user.profilePhoto.filename) {
      // If only filename is available, pass the whole object to getUploadUrl
      // so it can construct the correct path
      rawImageUrl = user.profilePhoto;
    }
  } else if (user?.profilePicture) {
    rawImageUrl = typeof user.profilePicture === 'string' ? user.profilePicture : user.profilePicture.url;
  }
  const imageUrl = rawImageUrl ? getUploadUrl(rawImageUrl) : null;
  
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

  const [imageError, setImageError] = useState(false);

  // Reset error state when profile photo changes
  useEffect(() => {
    setImageError(false);
  }, [user?.profilePhoto?.url, user?.profilePhoto?.filename, imageUrl]);

  return (
    <div className={`relative ${className}`}>
      <div className={`${sizeClasses[size]} rounded-full bg-gray-200 overflow-hidden flex items-center justify-center border-2 border-gray-300`}>
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt="Profile Picture"
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              // Log error for debugging (both dev and prod to help diagnose Render issues)
              logger.error('Failed to load profile image', {
                imageUrl,
                rawImageUrl,
                profilePhoto: user?.profilePhoto,
                error: e.type || 'unknown',
                timestamp: new Date().toISOString()
              });
              
              // Set error state to show fallback
              setImageError(true);
              
              // Try to fetch the image directly to get more error details
              if (imageUrl && typeof fetch !== 'undefined') {
                fetch(imageUrl, { method: 'HEAD', mode: 'no-cors' })
                  .catch((fetchError) => {
                    logger.error('Image fetch error details', {
                      url: imageUrl,
                      error: fetchError.message,
                      type: fetchError.name
                    });
                  });
              }
            }}
            onLoad={() => {
              // Image loaded successfully - reset error state and log in development
              setImageError(false);
              if (import.meta.env.DEV) {
                logger.debug('Profile image loaded successfully', { imageUrl });
              }
            }}
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
