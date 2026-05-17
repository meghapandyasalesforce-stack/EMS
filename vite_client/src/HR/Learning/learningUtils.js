import { isHR } from '../../utils/managerHelper';

/** Admin, executive, or HR — can use admin learning APIs and manage courses. */
export const canManageLearning = (user, employee) => {
    const userObj = user || employee;
    if (!userObj) return false;
    const role = userObj.role;
    if (role === 'admin' || role === 'executive') return true;
    return isHR(userObj);
};

export const enrollmentStatusStyle = (status) => {
    if (status === 'Completed') return 'bg-emerald-100 text-emerald-700';
    if (status === 'In Progress') return 'bg-[#20C997]/10 text-[#0d9488]';
    if (status === 'Enrolled') return 'bg-slate-100 text-slate-600';
    if (status === 'Dropped' || status === 'Failed') return 'bg-red-100 text-red-700';
    return 'bg-slate-100 text-slate-600';
};
