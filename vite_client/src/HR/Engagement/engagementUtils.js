import { isHR } from '../../utils/managerHelper';
import { formatStatusLabel } from '../../utils/textFormat.js';

export const canManageEngagement = (user, employee) => {
    if (!user && !employee) return false;
    const userObj = { ...(employee || {}), ...(user || {}) };
    if (employee?.functionalRoles) userObj.functionalRoles = employee.functionalRoles;
    if (employee?.department) userObj.department = employee.department;
    if (employee?.jobTitle) userObj.jobTitle = employee.jobTitle;
    if (employee?.position) userObj.position = employee.position;
    const role = userObj.role || user?.role || employee?.role;
    if (role === 'admin' || role === 'executive') return true;
    return isHR(userObj);
};

export const surveyStatusStyle = (status) => {
    if (status === 'Active') return 'bg-emerald-100 text-emerald-700 ring-emerald-600/20';
    if (status === 'Draft') return 'bg-amber-100 text-amber-700 ring-amber-600/20';
    if (status === 'Closed') return 'bg-slate-100 text-slate-600 ring-slate-500/20';
    if (status === 'Archived') return 'bg-slate-100 text-slate-500 ring-slate-500/20';
    return 'bg-slate-100 text-slate-600 ring-slate-500/20';
};

export const feedbackStatusStyle = (status) => {
    if (status === 'Resolved' || status === 'Implemented' || status === 'Accepted') {
        return 'bg-emerald-100 text-emerald-700';
    }
    if (status === 'Open' || status === 'Submitted') return 'bg-amber-100 text-amber-700';
    if (status === 'In Review' || status === 'Under Review' || status === 'In Progress') {
        return 'bg-[#0E9370]/10 text-[#07523E]';
    }
    if (status === 'Closed' || status === 'Rejected') return 'bg-slate-100 text-slate-600';
    return 'bg-slate-100 text-slate-600';
};

export const RECOGNITION_CATEGORIES = [
    'Achievement',
    'Teamwork',
    'Leadership',
    'Innovation',
    'Customer Appreciation',
    'Performance',
    'Going Extra Mile',
];

export const formatRecognitionRecipientLabel = (r, personNameFn = (p) => `${p?.name || ''} ${p?.lastName || ''}`.trim() || 'Someone') => {
    if (r?.recipientLabel) return r.recipientLabel;
    const type = r?.recipientType || 'Individual';
    if (type === 'Department') return r.targetDepartment || 'Department';
    if (type === 'Team') {
        if (r.teamLabel) return r.teamLabel;
        const count = r.recipientIds?.length || 0;
        return count > 1 ? `Team (${count} members)` : 'Team';
    }
    return personNameFn(r.recipientId);
};

export const recognitionStatusStyle = (status) => {
    if (status === 'Approved') return 'bg-emerald-100 text-emerald-700';
    if (status === 'Pending') return 'bg-amber-100 text-amber-700';
    if (status === 'Rejected') return 'bg-slate-100 text-slate-600';
    return 'bg-slate-100 text-slate-600';
};

/** Display label for engagement survey / feedback / recognition statuses. */
export const formatEngagementStatusLabel = (status) => formatStatusLabel(status);
