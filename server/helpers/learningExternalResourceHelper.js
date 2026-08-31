const EXTERNAL_RESOURCE_TYPES = new Set([
    'YOUTUBE',
    'YOUTUBE_PLAYLIST',
    'EXTERNAL_LINK'
]);

const YOUTUBE_HOSTS = new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtu.be'
]);

export const isExternalCourse = (course = {}) =>
    EXTERNAL_RESOURCE_TYPES.has(course.resourceType);

export const validateExternalCourseResource = (course = {}) => {
    if (!course.resourceType) {
        return null;
    }

    if (!EXTERNAL_RESOURCE_TYPES.has(course.resourceType)) {
        return 'Unsupported external resource type';
    }

    if (!course.externalUrl || typeof course.externalUrl !== 'string') {
        return 'External URL is required for external courses';
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(course.externalUrl);
    } catch {
        return 'External URL must be a valid HTTPS URL';
    }

    if (parsedUrl.protocol !== 'https:') {
        return 'External URL must use HTTPS';
    }

    if (
        (course.resourceType === 'YOUTUBE' || course.resourceType === 'YOUTUBE_PLAYLIST') &&
        !YOUTUBE_HOSTS.has(parsedUrl.hostname.toLowerCase())
    ) {
        return 'YouTube resources must use a valid youtube.com or youtu.be URL';
    }

    if (
        course.resourceType === 'YOUTUBE_PLAYLIST' &&
        !parsedUrl.searchParams.get('list')
    ) {
        return 'YouTube playlist URL must include a playlist ID';
    }

    return null;
};

export { EXTERNAL_RESOURCE_TYPES };
