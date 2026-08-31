import { toSentenceCase } from '../../utils/textFormat.js';
import { isHR } from '../../utils/managerHelper.js';

/** Admin, executive, or HR — can use admin learning APIs and manage courses. */
export const canManageLearning = (user, employee) => {
    const userObj = user || employee;
    if (!userObj) return false;
    const role = userObj.role;
    if (role === 'admin' || role === 'executive') return true;
    return isHR(userObj);
};

export const enrollmentStatusStyle = (status) => {
    if (status === 'Completed') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
    if (status === 'In Progress') return 'bg-teal-50 text-teal-700 ring-1 ring-teal-200';
    if (status === 'Enrolled' || status === 'Not Started') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
    if (status === 'Dropped' || status === 'Failed') return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200';
    return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
};

export const courseStatusStyle = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'published') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
    if (s === 'archived') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
    return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
};

export const formatEnrollmentStatusLabel = (status) => {
    const key = String(status || '').toLowerCase();
    const map = {
        completed: 'Completed',
        'in progress': 'In progress',
        enrolled: 'Enrolled',
        'not started': 'Not started',
        dropped: 'Dropped',
        failed: 'Failed',
    };
    return map[key] || toSentenceCase(status || '—');
};

export const formatCourseStatusLabel = (status) => {
    const key = String(status || '').toLowerCase();
    const map = {
        published: 'Published',
        draft: 'Draft',
        archived: 'Archived',
    };
    return map[key] || toSentenceCase(status || '—');
};

export const isExternalCourse = (course) =>
    ['YOUTUBE', 'YOUTUBE_PLAYLIST', 'EXTERNAL_LINK'].includes(course?.resourceType);

export const isEnrollmentOverdue = (enrollment) =>
    Boolean(
        enrollment?.dueDate &&
        enrollment?.status !== 'Completed' &&
        new Date(enrollment.dueDate).getTime() < new Date().setHours(0, 0, 0, 0)
    );

/**
 * Pull the video / playlist ids out of a YouTube URL so the course can be embedded
 * with the IFrame player, which is the only way to measure watch progress.
 */
export const parseYouTubeResource = (url) => {
    if (!url || typeof url !== 'string') return null;

    let parsed;
    try {
        parsed = new URL(url.trim());
    } catch {
        return null;
    }

    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const isShortLink = host === 'youtu.be';
    if (!isShortLink && !['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
        return null;
    }

    const playlistId = parsed.searchParams.get('list');
    let videoId = parsed.searchParams.get('v');

    if (isShortLink) {
        videoId = parsed.pathname.slice(1).split('/')[0] || null;
    } else if (!videoId) {
        const embedMatch = parsed.pathname.match(/^\/(embed|v|shorts|live)\/([^/?]+)/);
        if (embedMatch) videoId = embedMatch[2];
    }

    if (!videoId && !playlistId) return null;
    return { videoId: videoId || null, playlistId: playlistId || null };
};

export const externalResourceLabel = (resourceType) => {
    if (resourceType === 'YOUTUBE') return 'YouTube video';
    if (resourceType === 'YOUTUBE_PLAYLIST') return 'YouTube playlist';
    if (resourceType === 'EXTERNAL_LINK') return 'External course';
    return 'Course modules';
};
