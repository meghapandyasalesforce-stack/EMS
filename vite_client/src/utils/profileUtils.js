/**
 * Merge session-verified auth profile with persisted employee details.
 * Auth user wins on conflict when both refer to the same employee document.
 */

export function getProfileDocumentId(profile) {
  if (!profile) return '';
  const id = profile._id ?? profile.id;
  return id != null ? String(id) : '';
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

  if (uid && eid && uid !== eid) {
    return authUser;
  }

  return { ...persistedEmployee, ...authUser };
}
