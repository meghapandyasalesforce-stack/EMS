import { useCallback, useEffect, useState } from 'react';
import { resolveProfileSignedUrl } from '../utils/axios';

/**
 * Resolve a short-lived signed URL for a private profile photo.
 * - Generates the signed URL only when the component renders (no timers).
 * - Re-fetches only when the resolved id/photo changes, or via refresh().
 * - Photos are served via short-lived S3 signed URLs (cached ~15 min).
 *
 * @param {object|string} profilePhoto - employee/user.profilePhoto (or profilePicture)
 * @param {{userType?: string, userId?: string}} opts - 'admin' | 'employee' and the owner id
 * @returns {{ photoUrl: string|null, loaded: boolean, refresh: ()=>void }}
 */
export function useSignedProfilePhoto(profilePhoto, { userType, userId, preferFull = false } = {}) {
  const [photoUrl, setPhotoUrl] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    if (!userId || !userType) {
      setPhotoUrl(null);
      setLoaded(true);
      return;
    }
    setLoaded(false);
    resolveProfileSignedUrl(profilePhoto, { userType, userId, preferFull })
      .then((url) => {
        setPhotoUrl(url);
        setLoaded(true);
      })
      .catch(() => {
        setPhotoUrl(null);
        setLoaded(true);
      });
  }, [profilePhoto, userId, userType, preferFull]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { photoUrl, loaded, refresh };
}

export default useSignedProfilePhoto;