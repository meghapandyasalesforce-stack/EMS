/**
 * National ID document types (India-focused). Keep in sync with employee.model nationalIdType enum.
 */
export const NATIONAL_ID_TYPE_VALUES = [
    'Aadhaar',
    'Voter ID (EPIC)',
    'Passport',
    'PAN',
    'Driving License',
    'Other'
];

/**
 * @param {string} type - One of NATIONAL_ID_TYPE_VALUES
 * @param {string} raw - User input
 * @returns {{ ok: true, normalized: string } | { ok: false, message: string }}
 */
export function validateAndNormalizeNationalId(type, raw) {
    if (!type || !NATIONAL_ID_TYPE_VALUES.includes(type)) {
        return { ok: false, message: 'Invalid national ID document type' };
    }
    if (raw === undefined || raw === null) {
        return { ok: false, message: 'National ID number is required for the selected document type' };
    }
    const s = String(raw).trim();
    if (!s) {
        return { ok: false, message: 'National ID number is required for the selected document type' };
    }

    switch (type) {
        case 'Aadhaar': {
            const digits = s.replace(/\D/g, '');
            if (digits.length !== 12) {
                return { ok: false, message: 'Aadhaar must be exactly 12 digits (spaces allowed while typing)' };
            }
            return { ok: true, normalized: digits };
        }
        case 'Voter ID (EPIC)': {
            const v = s.replace(/\s/g, '').toUpperCase();
            if (!/^[A-Z]{3}[0-9]{7}$/.test(v)) {
                return { ok: false, message: 'Voter ID (EPIC) must be 3 letters followed by 7 digits (e.g. ABC1234567)' };
            }
            return { ok: true, normalized: v };
        }
        case 'Passport': {
            const v = s.replace(/\s/g, '').toUpperCase();
            // Indian passport: letter (not S) + 7 digits, first digit 1–9
            if (!/^[A-PR-WY][1-9]\d{6}$/.test(v)) {
                return { ok: false, message: 'Indian passport number must be 1 letter + 7 digits (e.g. A1234567)' };
            }
            return { ok: true, normalized: v };
        }
        case 'PAN': {
            const v = s.replace(/\s/g, '').toUpperCase();
            if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v)) {
                return { ok: false, message: 'PAN must be in format ABCDE1234F' };
            }
            return { ok: true, normalized: v };
        }
        case 'Driving License': {
            const v = s.replace(/\s/g, '').toUpperCase();
            if (!/^[A-Z0-9\-]{6,20}$/.test(v)) {
                return { ok: false, message: 'Driving licence must be 6–20 characters (letters, digits, hyphens)' };
            }
            return { ok: true, normalized: v };
        }
        case 'Other': {
            if (s.length < 4 || s.length > 40) {
                return { ok: false, message: 'ID must be between 4 and 40 characters' };
            }
            if (!/^[A-Za-z0-9\- ]+$/.test(s)) {
                return { ok: false, message: 'ID may contain only letters, numbers, spaces, and hyphens' };
            }
            return { ok: true, normalized: s.trim() };
        }
        default:
            return { ok: false, message: 'Invalid national ID document type' };
    }
}
