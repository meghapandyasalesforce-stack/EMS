/**
 * Pulse Program scheduling helpers.
 * Pure date/key computation — no DB access.
 */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Deterministic occurrence key for idempotent generation. Format: YYYY-MM-DD */
export const buildOccurrenceKey = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

/** Human-readable period label for generated pulse titles. */
export const buildPeriodLabel = (date, frequency) => {
    const d = date instanceof Date ? date : new Date(date);
    const month = MONTHS_SHORT[d.getMonth()];
    const year = d.getFullYear();

    if (frequency === 'Monthly' || frequency === 'Quarterly') {
        return `${month} ${year}`;
    }
    // Weekly / Bi-weekly: use start date
    const day = String(d.getDate()).padStart(2, '0');
    return `${day} ${month} ${year}`;
};

/** Build the survey title for a generated occurrence. */
export const buildOccurrenceTitle = (programName, date, frequency) =>
    `${programName} — ${buildPeriodLabel(date, frequency)}`;

/**
 * Get the last valid day of a month (handles Feb, 30-day months, etc.)
 */
const lastDayOfMonth = (year, month) => new Date(year, month + 1, 0).getDate();

/**
 * Clamp the day-of-month to the last valid day if the target month is shorter.
 */
const clampDay = (year, month, preferredDay) => {
    const maxDay = lastDayOfMonth(year, month);
    return Math.min(preferredDay, maxDay);
};

/**
 * Advance a date by the given frequency, handling month-end clamping.
 * Returns a new Date.
 */
export const advanceByFrequency = (from, frequency) => {
    const d = from instanceof Date ? new Date(from) : new Date(from);
    const preferredDay = d.getDate();

    switch (frequency) {
        case 'Weekly':
            d.setDate(d.getDate() + 7);
            return d;
        case 'Bi-weekly':
            d.setDate(d.getDate() + 14);
            return d;
        case 'Monthly': {
            let month = d.getMonth() + 1;
            let year = d.getFullYear();
            if (month > 11) {
                month -= 12;
                year += 1;
            }
            const day = clampDay(year, month, preferredDay);
            return new Date(year, month, day, d.getHours(), d.getMinutes(), d.getSeconds());
        }
        case 'Quarterly': {
            let month = d.getMonth() + 3;
            let year = d.getFullYear();
            while (month > 11) {
                month -= 12;
                year += 1;
            }
            const day = clampDay(year, month, preferredDay);
            return new Date(year, month, day, d.getHours(), d.getMinutes(), d.getSeconds());
        }
        default:
            // Fallback weekly
            d.setDate(d.getDate() + 7);
            return d;
    }
};

/**
 * Calculate the end date for a single Pulse occurrence (survey window).
 */
export const buildOccurrenceEndDate = (startDate, openDurationDays = 7) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + Math.max(1, openDurationDays));
    return d;
};

/**
 * Determine if a Pulse Program has remaining capacity for new occurrences.
 */
export const programHasCapacity = (program) => {
    if (program.endDate && new Date(program.endDate) < new Date()) return false;
    if (program.maxOccurrences && program.occurrenceCount >= program.maxOccurrences) return false;
    return true;
};

/**
 * Calculate the first nextRunAt for a freshly activated program.
 */
export const calculateFirstRunDate = (program) => {
    const now = new Date();
    const start = new Date(program.startDate);
    return start > now ? start : now;
};

/**
 * Calculate the safe next run date after generating an occurrence.
 * Returns null if the program has no capacity left.
 */
export const calculateNextRunDate = (program, justGeneratedDate) => {
    const next = advanceByFrequency(justGeneratedDate, program.frequency);
    if (program.endDate && next > new Date(program.endDate)) return null;
    if (program.maxOccurrences && (program.occurrenceCount + 1) >= program.maxOccurrences) return null;
    return next;
};

export const openDurationDaysFromFrequency = (frequency) => {
    switch (frequency) {
        case 'Weekly': return 5;
        case 'Bi-weekly': return 7;
        case 'Monthly': return 7;
        case 'Quarterly': return 14;
        default: return 7;
    }
};
