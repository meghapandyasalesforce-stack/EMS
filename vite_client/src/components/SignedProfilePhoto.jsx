import React from 'react';
import { useSignedProfilePhoto } from '../Hooks/useSignedProfilePhoto';

/**
 * Renders a private profile photo via a short-lived signed URL.
 * Renders nothing until a signed URL is available (callers typically show a
 * initials/placeholder fallback). The signed URL is fetched only on render and
 * cached ~15 min; no timers are used.
 */
export default function SignedProfilePhoto({
  profilePhoto,
  userType = 'employee',
  userId,
  className = '',
  ...imgProps
}) {
  const { photoUrl } = useSignedProfilePhoto(profilePhoto, { userType, userId });
  if (!photoUrl) return null;
  return <img src={photoUrl} alt="" className={className} {...imgProps} />;
}