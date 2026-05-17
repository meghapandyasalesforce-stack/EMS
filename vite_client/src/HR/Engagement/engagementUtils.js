import { isHR } from '../../utils/managerHelper';

export const canManageEngagement = (user, employee) => {
    const userObj = user || employee;
    if (!userObj) return false;
    const role = userObj.role;
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
    if (status === 'Resolved') return 'bg-emerald-100 text-emerald-700';
    if (status === 'Open') return 'bg-amber-100 text-amber-700';
    if (status === 'In Review') return 'bg-[#20C997]/10 text-[#0d9488]';
    if (status === 'Closed') return 'bg-slate-100 text-slate-600';
    return 'bg-slate-100 text-slate-600';
};
