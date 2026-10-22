import {
    FaUsers,
    FaUserMinus,
    FaMoneyBillWave,
    FaCalendarCheck,
    FaStar,
    FaHandshake,
    FaShieldAlt,
} from 'react-icons/fa';

export const REPORT_NAV = [
    { path: 'headcount', label: 'Headcount', icon: FaUsers },
    { path: 'attrition', label: 'Attrition', icon: FaUserMinus },
    { path: 'payroll', label: 'Payroll', icon: FaMoneyBillWave },
    { path: 'attendance', label: 'Attendance', icon: FaCalendarCheck },
    { path: 'performance', label: 'Performance', icon: FaStar },
    { path: 'recruitment', label: 'Recruitment', icon: FaHandshake },
    { path: 'compliance', label: 'Compliance', icon: FaShieldAlt },
];

export const CHART_COLORS = {
    primary: '#0E9370',
    primaryDark: '#0d9488',
    secondary: '#14b8a6',
    orange: '#fb923c',
    red: '#ef4444',
    purple: '#8b5cf6',
    blue: '#3b82f6',
    gray: '#94a3b8',
};

export const MINT_GRADIENT = 'linear-gradient(135deg, #0E9370 0%, #00694F 100%)';
