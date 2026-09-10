import React, { useState, useEffect } from 'react';
import { FiCamera } from 'react-icons/fi';
import logger from '../utils/logger';
import { useSignedProfilePhoto } from '../Hooks/useSignedProfilePhoto';
import { resolveProfilePhotoOwner } from '../utils/profileUtils';

const ProfilePicture = ({ 
  user, 
  size = 'md', 
  showEditButton = false, 
  onEditClick,
  className = '',
  showWhiteRing = false,
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

  const cameraButtonSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
    xl: 'h-7 w-7',
    '2xl': 'h-8 w-8',
  };

  const cameraIconSizes = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-3.5 h-3.5',
    '2xl': 'w-4 h-4',
  };

  // Resolve a short-lived signed URL for the private profile photo (no timers).
  const { userType, userId } = resolveProfilePhotoOwner(user);
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
  }, [
    user?.profilePhoto?.url,
    user?.profilePhoto?.filename,
    typeof user?.profilePhoto === 'string' ? user.profilePhoto : null,
    imageUrl,
  ]);

  const circleClasses = showWhiteRing
    ? 'border-4 border-white shadow-md'
    : 'border border-gray-200/80 shadow-sm';

  return (
    <div className={`relative shrink-0 ${sizeClasses[size]} ${className}`}>
      <div
        className={`${sizeClasses[size]} relative aspect-square overflow-hidden rounded-full bg-gray-100 ${circleClasses}`}
      >
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt="Profile Picture"
            className="h-full w-full object-cover"
            style={{ objectPosition: 'center 22%' }}
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
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #00C2CB 0%, #3E64E3 50%, #B87B83 100%)',
            }}
          >
            <span className={`font-bold uppercase text-white ${textSizeClasses[size]}`}>
              {getInitials()}
            </span>
          </div>
        )}
      </div>
      
      {showEditButton && onEditClick && (
        <button
          onClick={onEditClick}
          className={`absolute bottom-0 right-0 flex items-center justify-center rounded-full bg-[#20C997] text-white shadow-lg transition-colors hover:opacity-90 ${cameraButtonSizes[size]}`}
          title="Update Profile Photo"
        >
          <FiCamera className={cameraIconSizes[size]} />
        </button>
      )}
    </div>
  );
};

export default ProfilePicture;
