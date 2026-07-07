/**
 * Release Notes Configuration
 * ----------------------------
 * To push a new update popup to all users:
 * 1. Bump APP_VERSION (e.g. "1.0.0" → "1.1.0")
 * 2. Add a new entry at the TOP of RELEASE_NOTES array
 * 3. Deploy — users will see the popup once on next login/refresh
 */

export const APP_VERSION = '1.0.0';

export const RELEASE_NOTES = [
    {
        version: '1.0.0',
        date: 'June 2025',
        title: 'Welcome to EMS Paarsiv 🎉',
        changes: [
            { type: 'new', text: 'Employee, Manager, and HR dashboards' },
            { type: 'new', text: 'Attendance tracking with check-in / check-out' },
            { type: 'new', text: 'Leave management and approval workflows' },
            { type: 'new', text: 'Payroll and salary structure management' },
            { type: 'new', text: 'Document uploads including Aadhar Card' },
            { type: 'new', text: 'One-on-one meeting scheduling' },
            { type: 'new', text: 'Attendance regularization requests' },
        ],
    },
];

/** Badge color per change type */
export const CHANGE_TYPE_STYLE = {
    new:     { label: 'New',     bg: 'bg-emerald-100', text: 'text-emerald-700' },
    improved:{ label: 'Improved',bg: 'bg-blue-100',    text: 'text-blue-700'    },
    fixed:   { label: 'Fixed',   bg: 'bg-amber-100',   text: 'text-amber-700'   },
    removed: { label: 'Removed', bg: 'bg-red-100',     text: 'text-red-600'     },
};
