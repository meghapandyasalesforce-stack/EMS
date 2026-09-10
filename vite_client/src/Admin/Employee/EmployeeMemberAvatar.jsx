import React, { useEffect, useState } from 'react';
import { useSignedProfilePhoto } from '../../Hooks/useSignedProfilePhoto';
import { resolveProfilePhotoOwner } from '../../utils/profileUtils';

function getInitials(user) {
  const name = user?.name?.trim() || '';
  const lastName = user?.lastName?.trim() || '';
  if (name && lastName) return `${name.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  if (name) return name.charAt(0).toUpperCase();
  return 'U';
}

const EmployeeMemberAvatar = ({ user, sizeClassName = 'h-10 w-10' }) => {
  const [imageError, setImageError] = useState(false);

  const { userType, userId } = resolveProfilePhotoOwner(user);
  const { photoUrl } = useSignedProfilePhoto(
    user?.profilePhoto || user?.profilePicture,
    { userType, userId }
  );
  const imageUrl = photoUrl;
  const initials = getInitials(user);

  useEffect(() => {
    setImageError(false);
  }, [imageUrl]);

  return (
    <div
      className={`relative ${sizeClassName} shrink-0 overflow-hidden rounded-full border border-slate-200 shadow-sm`}
      aria-label={`Profile photo of ${user?.name || 'member'}`}
    >
      {imageUrl && !imageError ? (
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[var(--color-primary)] via-[var(--color-secondary)] to-[var(--color-accent)] text-xs font-bold text-white">
          {initials}
        </span>
      )}
    </div>
  );
};

export default EmployeeMemberAvatar;
