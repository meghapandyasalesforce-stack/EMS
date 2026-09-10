import { formatStatusLabel } from './textFormat.js';

export const LIVE_STATUSES = {
    survey: 'Active',
    job: 'Open',
    course: 'Published',
};

export const getStatusHint = (status, type) => {
    const live = LIVE_STATUSES[type];
    if (status === 'Draft') {
        if (type === 'job') {
            return `Draft — not visible on the career portal or internal jobs until status is ${formatStatusLabel('open').toLowerCase()}.`;
        }
        if (type === 'course') {
            return 'Draft — employees cannot enroll until you publish.';
        }
        return `Draft — employees cannot see or respond until status is ${formatStatusLabel('active').toLowerCase()}.`;
    }
    if (status === live) {
        if (type === 'job') {
            return `${formatStatusLabel('open')} — job is live when visibility options below are enabled.`;
        }
        if (type === 'course') {
            return `${formatStatusLabel('published')} — employees can browse and enroll.`;
        }
        return `${formatStatusLabel('active')} — employees can see and respond to this survey.`;
    }
    return null;
};

export const toastForSave = (entityLabel, status, type) => {
    const live = LIVE_STATUSES[type];
    if (status === 'Draft') {
        return `${entityLabel} saved as draft — not visible to employees yet.`;
    }
    if (status === live) {
        if (type === 'job') {
            return `${entityLabel} is ${formatStatusLabel('open').toLowerCase()} — visible when portal/internal visibility is enabled.`;
        }
        return `${entityLabel} is live — visible to employees.`;
    }
    return `${entityLabel} saved (${formatStatusLabel(status)}).`;
};
