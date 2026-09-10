/**
 * Merge session-verified auth profile with persisted employee details.
 * Auth user wins on conflict when both refer to the same employee document.
 */

const DISPLAY_FIELDS = ['name', 'lastName', 'jobTitle', 'department', 'position', 'profilePhoto'];

function hasDisplayValue(value) {
  return value != null && String(value).trim() !== '';
}

function pickDisplayField(authValue, employeeValue) {
  return hasDisplayValue(authValue) ? authValue : employeeValue;
}

export function getProfileDocumentId(profile) {
  if (!profile) return '';
  const id = profile._id ?? profile.id;
  return id != null ? String(id) : '';
}

/**
 * Resolve which model owns the profile photo for signed-URL fetches.
 * Workforce photos live on Employee. Admin User sessions may carry role "admin"
 * while displaying a linked employee Me-profile — those must still use employee.
 */
export function resolveProfilePhotoOwner(user) {
  if (!user) return { userType: 'employee', userId: null };

  const docId = user._id || user.id || null;
  const linkedEmployeeId = user.employeeProfileId || null;
  const looksLikeEmployee = Boolean(
    user.employeeId ||
      user.jobTitle ||
      user.joiningDate ||
      user.department ||
      (linkedEmployeeId && docId && String(linkedEmployeeId) === String(docId))
  );

  if (user.role === 'admin') {
    // Admin account with a separate linked employee profile (photo on Employee)
    if (linkedEmployeeId && docId && String(linkedEmployeeId) !== String(docId)) {
      return { userType: 'employee', userId: linkedEmployeeId };
    }
    if (looksLikeEmployee) {
      return { userType: 'employee', userId: docId };
    }
    return { userType: 'admin', userId: docId };
  }

  return { userType: 'employee', userId: docId };
}

/**
 * @param {Object|null} authUser - From auth slice (checkAuthSession / login)
 * @param {Object|null} persistedEmployee - From employeeDetails slice (redux-persist)
 * @returns {Object|null}
 */
export function mergeSessionProfile(authUser, persistedEmployee) {
  if (!authUser && !persistedEmployee) return null;
  if (!authUser) return persistedEmployee;
  if (!persistedEmployee) return authUser;

  const uid = getProfileDocumentId(authUser);
  const eid = getProfileDocumentId(persistedEmployee);
  const linkedProfileId = authUser.employeeProfileId
    ? String(authUser.employeeProfileId)
    : '';

  if (uid && eid && uid !== eid) {
    const isLinkedAdminProfile =
      authUser.role === 'admin' &&
      linkedProfileId &&
      (linkedProfileId === eid || Boolean(persistedEmployee.employeeId));

    if (isLinkedAdminProfile) {
      const merged = { ...persistedEmployee, ...authUser };
      for (const field of DISPLAY_FIELDS) {
        merged[field] = pickDisplayField(persistedEmployee[field], authUser[field]);
      }
      merged._id = eid;
      merged.employeeProfileId = eid;
      merged.role = authUser.role;
      return merged;
    }

    return authUser;
  }

  const merged = { ...persistedEmployee, ...authUser };
  for (const field of DISPLAY_FIELDS) {
    // Prefer the persisted employee photo when auth still has a bare (unsigned)
    // https object URL — private S3 objects need a fresh signed URL via employee id.
    if (field === 'profilePhoto') {
      const authPhoto = authUser.profilePhoto;
      const empPhoto = persistedEmployee.profilePhoto;
      const authIsBareHttps =
        (typeof authPhoto === 'string' && /^https?:\/\//i.test(authPhoto) && !/[?&]X-Amz-Signature=/i.test(authPhoto)) ||
        (authPhoto &&
          typeof authPhoto === 'object' &&
          typeof authPhoto.url === 'string' &&
          /^https?:\/\//i.test(authPhoto.url) &&
          !/[?&]X-Amz-Signature=/i.test(authPhoto.url));
      merged[field] = authIsBareHttps && empPhoto
        ? empPhoto
        : pickDisplayField(authUser[field], persistedEmployee[field]);
      continue;
    }
    merged[field] = pickDisplayField(authUser[field], persistedEmployee[field]);
  }
  return merged;
}

/**
 * Resolve a display name from merged profile or raw auth/employee slices.
 */
export function getProfileDisplayName(profile, authUser, persistedEmployee) {
  const sources = [
    profile?.name,
    authUser?.name,
    persistedEmployee?.name,
    authUser?.username,
    persistedEmployee?.username,
    authUser?.email?.split('@')?.[0],
    persistedEmployee?.email?.split('@')?.[0],
  ];
  return sources.find(hasDisplayValue) || '';
}
