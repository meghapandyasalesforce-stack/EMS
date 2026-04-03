/**
 * Client-side national ID validation (mirror server/helpers/nationalIdValidation.js).
 */
export const NATIONAL_ID_TYPE_VALUES = [
    'Aadhaar',
    'Voter ID (EPIC)',
    'Passport',
    'PAN',
    'Driving License',
    'Other'
];

export function getNationalIdPlaceholder(type) {
    switch (type) {
        case 'Aadhaar':
            return '12 digits, e.g. 1234 5678 9012';
        case 'Voter ID (EPIC)':
            return 'e.g. ABC1234567';
        case 'Passport':
            return 'e.g. A1234567';
        case 'PAN':
            return 'e.g. ABCDE1234F';
        case 'Driving License':
            return '6–20 characters as on licence';
        case 'Other':
            return 'Enter your ID number';
        default:
            return 'Select document type first';
    }
}

export function validateNationalIdInput(type, raw) {
    if (!type) {
        return { ok: false, message: 'Select a national ID document type' };
    }
    if (!raw || !String(raw).trim()) {
        return { ok: false, message: 'Enter the ID number' };
    }

    const s = String(raw).trim();

    switch (type) {
        case 'Aadhaar': {
            const digits = s.replace(/\D/g, '');
            if (digits.length !== 12) {
                return { ok: false, message: 'Aadhaar must be exactly 12 digits' };
            }
            return { ok: true, normalized: digits };
        }
        case 'Voter ID (EPIC)': {
            const v = s.replace(/\s/g, '').toUpperCase();
            if (!/^[A-Z]{3}[0-9]{7}$/.test(v)) {
                return { ok: false, message: 'Voter ID must be 3 letters + 7 digits (e.g. ABC1234567)' };
            }
            return { ok: true, normalized: v };
        }
        case 'Passport': {
            const v = s.replace(/\s/g, '').toUpperCase();
            if (!/^[A-PR-WY][1-9]\d{6}$/.test(v)) {
                return { ok: false, message: 'Use format: 1 letter + 7 digits (e.g. A1234567)' };
            }
            return { ok: true, normalized: v };
        }
        case 'PAN': {
            const v = s.replace(/\s/g, '').toUpperCase();
            if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v)) {
                return { ok: false, message: 'PAN must look like ABCDE1234F' };
            }
            return { ok: true, normalized: v };
        }
        case 'Driving License': {
            const v = s.replace(/\s/g, '').toUpperCase();
            if (!/^[A-Z0-9\-]{6,20}$/.test(v)) {
                return { ok: false, message: 'Driving licence: 6–20 letters, digits, or hyphens' };
            }
            return { ok: true, normalized: v };
        }
        case 'Other': {
            if (s.length < 4 || s.length > 40) {
                return { ok: false, message: 'ID must be 4–40 characters' };
            }
            if (!/^[A-Za-z0-9\- ]+$/.test(s)) {
                return { ok: false, message: 'Only letters, numbers, spaces, and hyphens' };
            }
            return { ok: true, normalized: s.trim() };
        }
        default:
            return { ok: false, message: 'Invalid document type' };
    }
}
