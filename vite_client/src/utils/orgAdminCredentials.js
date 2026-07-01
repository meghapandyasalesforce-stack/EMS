/** Session-only storage for org admin email/password (Add Employee auto-fill). */

const EMAIL_KEY = 'orgAdminEmail';
const PASSWORD_KEY = 'orgAdminPassword';

export const normalizeEmail = (email = '') => String(email).toLowerCase().trim();

export const saveOrgAdminCredentials = (email, password) => {
    if (typeof sessionStorage === 'undefined') return;
    const normalized = normalizeEmail(email);
    if (normalized) sessionStorage.setItem(EMAIL_KEY, normalized);
    if (password) sessionStorage.setItem(PASSWORD_KEY, password);
};

export const clearOrgAdminCredentials = () => {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(EMAIL_KEY);
    sessionStorage.removeItem(PASSWORD_KEY);
};

export const getOrgAdminEmail = () => {
    if (typeof sessionStorage === 'undefined') return '';
    return sessionStorage.getItem(EMAIL_KEY) || '';
};

export const getOrgAdminPassword = () => {
    if (typeof sessionStorage === 'undefined') return '';
    return sessionStorage.getItem(PASSWORD_KEY) || '';
};

/** Resolve the org owner admin email (only org owner may share login with one employee). */
export const resolveOrgAdminEmail = (user = null, permissionFlags = null) => {
    const isOrgOwner = Boolean(permissionFlags?.isOrgOwner);

    const fromSession = getOrgAdminEmail();
    if (fromSession) return fromSession;

    const fromUser = normalizeEmail(user?.email);
    if (fromUser && (isOrgOwner || user?.role === 'admin')) return fromUser;

    if (typeof localStorage !== 'undefined') {
        return normalizeEmail(localStorage.getItem('email') || '');
    }

    return '';
};

export const isOrgAdminEmail = (email, user = null, permissionFlags = null) => {
    const adminEmail = resolveOrgAdminEmail(user, permissionFlags);
    if (!adminEmail) return false;
    return normalizeEmail(email) === adminEmail;
};

export const getCredentialsForAdminEmail = (email, user = null, permissionFlags = null) => {
    if (!isOrgAdminEmail(email, user, permissionFlags)) {
        return { email: normalizeEmail(email), password: '' };
    }
    return {
        email: resolveOrgAdminEmail(user, permissionFlags),
        password: getOrgAdminPassword(),
    };
};
