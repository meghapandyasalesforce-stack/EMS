import { format } from 'date-fns';

/**
 * Source of truth is job.postedDate only (never createdAt).
 * Drafts never display a posted date — even if legacy docs still have one.
 */
export function getJobPostedDate(job) {
    if (!job?.postedDate) return null;
    if (String(job.status || '') === 'Draft') return null;
    return job.postedDate;
}

export function formatJobPostedDate(postedDate, { withYear = false } = {}) {
    if (!postedDate) return null;
    const d = new Date(postedDate);
    if (Number.isNaN(d.getTime())) return null;
    return format(d, withYear ? 'd MMM yyyy' : 'd MMM');
}

/** e.g. "Posted on 11 Aug" */
export function formatJobPostedLabel(postedDateOrJob, options) {
    const postedDate = postedDateOrJob && typeof postedDateOrJob === 'object' && 'postedDate' in postedDateOrJob
        ? getJobPostedDate(postedDateOrJob)
        : postedDateOrJob;
    const datePart = formatJobPostedDate(postedDate, options);
    return datePart ? `Posted on ${datePart}` : null;
}
