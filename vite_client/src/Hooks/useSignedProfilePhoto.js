import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveProfileSignedUrl } from '../utils/axios';

/**
 * Resolve a short-lived signed URL for a private profile photo.
 * Fetches by userType + userId (DB is source of truth). profilePhoto metadata
 * is optional — used only to reuse an already pre-signed URL.
 *
 * @param {object|string|null} profilePhoto
 * @param {{userType?: string, userId?: string, preferFull?: boolean}} opts
 * @returns {{ photoUrl: string|null, loaded: boolean, refresh: ()=>void }}
 */
export function useSignedProfilePhoto(profilePhoto, { userType, userId, preferFull = false } = {}) {
  const [photoUrl, setPhotoUrl] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const photoFingerprint = useMemo(() => {
    if (!profilePhoto) return '';
    if (typeof profilePhoto === 'string') return profilePhoto;
    return [
      profilePhoto.s3Key || '',
      profilePhoto.url || '',
      profilePhoto.signedUrl || '',
      profilePhoto.thumbS3Key || '',
      profilePhoto.uploadedAt || '',
    ].join('|');
  }, [profilePhoto]);

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
    // fingerprint captures profilePhoto identity without unstable object refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoFingerprint, userId, userType, preferFull]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { photoUrl, loaded, refresh };
}

export default useSignedProfilePhoto;
