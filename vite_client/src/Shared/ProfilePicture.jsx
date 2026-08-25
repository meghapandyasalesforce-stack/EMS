import React, { useState, useEffect } from 'react';
import { FiCamera } from 'react-icons/fi';
import logger from '../utils/logger';
import { useSignedProfilePhoto } from '../Hooks/useSignedProfilePhoto';

const ProfilePicture = ({ 
  user, 
  size = 'md', 
  showEditButton = false, 
  onEditClick,
  className = '',
  /** @deprecated — avatars always use normalized square photos from server */
  fit = 'cover',
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
    '2xl': 'w-32 h-32',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg',
    xl: 'text-2xl',
    '2xl': 'text-4xl',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
    '2xl': 'w-16 h-16'
  };

  // Resolve a short-lived signed URL for the private profile photo (no timers).
  const userType = user?.role === 'admin' ? 'admin' : 'employee';
  const userId = user?._id || user?.id || null;
  const { photoUrl } = useSignedProfilePhoto(
    user?.profilePhoto || user?.profilePicture,
    { userType, userId }
  );
  const imageUrl = photoUrl;
  
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
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`${sizeClasses[size]} relative aspect-square overflow-hidden rounded-full border-2 border-gray-200 bg-gray-100`}
      >
        {imageUrl && !imageError ? (
          <>
            <div
              role="img"
              aria-label="Profile Picture"
              className="absolute inset-0 scale-[1.12] bg-cover bg-no-repeat"
              style={{
                backgroundImage: `url("${imageUrl}")`,
                backgroundPosition: 'center 22%',
              }}
            />
            <img
              src={imageUrl}
              alt=""
              aria-hidden="true"
              className="hidden"
              onError={() => {
                logger.error('Failed to load profile image', {
                  imageUrl,
                  profilePhoto: user?.profilePhoto,
                  timestamp: new Date().toISOString(),
                });
                setImageError(true);
              }}
              onLoad={() => setImageError(false)}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[var(--color-primary)] via-[var(--color-secondary)] to-[var(--color-accent)] shadow-inner">
            <span className={`font-bold text-white ${textSizeClasses[size]}`}>
              {getInitials()}
            </span>
          </div>
        )}
      </div>
      
      {showEditButton && onEditClick && (
        <button
          onClick={onEditClick}
          className="absolute -bottom-1 -right-1 text-white rounded-full p-1 shadow-lg transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--color-primary)' }}
          title="Update Profile Photo"
        >
          <FiCamera className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

export default ProfilePicture;
