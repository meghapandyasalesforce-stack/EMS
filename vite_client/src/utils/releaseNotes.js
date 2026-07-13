/**
 * Release Notes Configuration
 * ----------------------------
 * To push a new update popup to all users:
 * 1. Bump APP_VERSION (e.g. "1.0.0" → "1.1.0")
 * 2. Add a new entry at the TOP of RELEASE_NOTES array
 * 3. Deploy — users will see the popup once on next login/refresh
 */

export const APP_VERSION = '1.1.0';

export const RELEASE_NOTES = [
    {
        version: '1.1.0',
        date: 'July 2026',
        title: 'Smarter Alerts, Payroll & Attendance',
        changes: [
            { type: 'new', text: 'Get timely browser alerts for important updates at work' },
            { type: 'new', text: 'Automatic emails when leave or attendance correction requests need action' },
            { type: 'new', text: 'Clearer tax (TDS) handling in payroll, with organization-level settings' },
            { type: 'new', text: 'Automatic check-out when a workday ends without checkout' },
            { type: 'improved', text: 'Easier way to turn on alerts and confirm they work from Settings' },
            { type: 'fixed', text: 'Attendance correction alerts now reach managers and HR reliably' },
            { type: 'fixed', text: 'Test alert from Settings now works as expected' },
        ],
    },
    {
        version: '1.0.0',
        date: 'June 2025',
        title: 'Welcome to EMS Paarsiv',
        changes: [
            { type: 'new', text: 'Dashboards for employees, managers, and HR' },
            { type: 'new', text: 'Attendance tracking with check-in and check-out' },
            { type: 'new', text: 'Leave requests and approval workflows' },
            { type: 'new', text: 'Payroll and salary structure management' },
            { type: 'new', text: 'Document uploads, including Aadhaar Card' },
            { type: 'new', text: 'One-on-one meeting scheduling' },
            { type: 'new', text: 'Attendance correction requests' },
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
