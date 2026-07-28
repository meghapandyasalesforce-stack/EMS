/**
 * Enterprise lifecycle dashboards — executive, HR, recruitment, department, manager, country, location.
 * Extends lifecycleReportsService aggregations.
 */

import Employee from '../models/employee.model.js';
import { OnboardingWorkflow, OffboardingWorkflow } from '../models/onboarding.model.js';
import { OfferLetter } from '../models/lifecycleGap.model.js';
import {
    buildOnboardingReports, buildOffboardingReports, buildHrAnalytics,
} from './lifecycleReportsService.js';
import { buildProbationDashboard } from './lifecycleProbationService.js';
import { getSoftwareInventoryDashboard } from './itProvisioningService.js';
import { buildLmsDashboard } from './lifecycleLmsService.js';

const DASHBOARD_TYPES = Object.freeze([
    'executive', 'hr', 'recruitment', 'lifecycle', 'department', 'manager', 'country', 'location',
]);

export function listDashboardTypes() {
    return DASHBOARD_TYPES.map((key) => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
    }));
}

export async function buildExecutiveDashboard(organizationId, filters = {}) {
    const [onboarding, offboarding, hr, probationWfs] = await Promise.all([
        buildOnboardingReports(organizationId, filters),
        buildOffboardingReports(organizationId, filters),
        buildHrAnalytics(organizationId, filters),
        OnboardingWorkflow.find({ organizationId, isTemplate: { $ne: true } }).select('probation status progress').lean(),
    ]);

    const headcount = await Employee.countDocuments({ organizationId, status: { $in: ['active', 'Active'] } });
    const probationDash = buildProbationDashboard(probationWfs);

    return {
        type: 'executive',
        filters,
        kpis: {
            headcount,
            activeOnboarding: onboarding.summary?.active || 0,
            activeOffboarding: offboarding.summary?.active || 0,
            avgOnboardingProgress: onboarding.summary?.avgProgress || 0,
            offersPending: hr.offers?.pending || 0,
            probationActive: probationDash.active || 0,
            probationEndingSoon: probationDash.endingSoon || 0,
        },
        charts: {
            onboardingByStatus: onboarding.byStatus || [],
            offboardingByReason: offboarding.byReason || [],
            monthlyJoiners: onboarding.monthlyTrend || [],
            monthlyLeavers: offboarding.monthlyTrend || [],
        },
    };
}

export async function buildHrDashboard(organizationId, filters = {}) {
    const [onboarding, offboarding, lms, itInventory] = await Promise.all([
        buildOnboardingReports(organizationId, filters),
        buildOffboardingReports(organizationId, filters),
        buildLmsDashboard(organizationId, filters),
        getSoftwareInventoryDashboard(organizationId),
    ]);

    const workflows = await OnboardingWorkflow.find({ organizationId, isTemplate: { $ne: true } }).select('probation').lean();
    const probation = buildProbationDashboard(workflows);

    return {
        type: 'hr',
        filters,
        kpis: {
            onboardingActive: onboarding.summary?.active || 0,
            offboardingActive: offboarding.summary?.active || 0,
            trainingCompletionRate: lms.summary?.completionRate || 0,
            softwarePending: itInventory.totals?.pending || 0,
            probationActive: probation.active || 0,
        },
        sections: { onboarding, offboarding, lms, itInventory, probation },
    };
}

export async function buildRecruitmentDashboard(organizationId, filters = {}) {
    const { start, end } = parseRange(filters);
    const offers = await OfferLetter.find({
        organizationId,
        createdAt: { $gte: start, $lte: end },
    }).lean();

    const byStatus = groupCount(offers, 'status');
    const accepted = offers.filter((o) => o.status === 'Accepted').length;
    const conversion = offers.length ? Math.round((accepted / offers.length) * 100) : 0;

    return {
        type: 'recruitment',
        kpis: { totalOffers: offers.length, accepted, conversionRate: conversion },
        charts: { byStatus: toChart(byStatus) },
        recentOffers: offers.slice(-10).reverse(),
    };
}

export async function buildLifecycleDashboard(organizationId, filters = {}) {
    const executive = await buildExecutiveDashboard(organizationId, filters);
    return { type: 'lifecycle', ...executive };
}

export async function buildDepartmentDashboard(organizationId, filters = {}) {
    const dept = filters.department;
    if (!dept) throw new Error('department filter required');
    return buildHrDashboard(organizationId, { ...filters, department: dept });
}

export async function buildManagerDashboard(organizationId, filters = {}) {
    const managerId = filters.managerId;
    if (!managerId) throw new Error('managerId filter required');
    const team = await Employee.find({ organizationId, managerId }).select('_id name lastName').lean();
    const ids = team.map((e) => e._id);
    const [onboarding, offboarding] = await Promise.all([
        OnboardingWorkflow.find({ organizationId, employeeId: { $in: ids }, isTemplate: { $ne: true } }).lean(),
        OffboardingWorkflow.find({ organizationId, employeeId: { $in: ids } }).lean(),
    ]);
    return {
        type: 'manager',
        teamSize: team.length,
        team,
        onboarding: { count: onboarding.length, workflows: onboarding },
        offboarding: { count: offboarding.length, workflows: offboarding },
    };
}

export async function buildCountryDashboard(organizationId, filters = {}) {
    const country = filters.country || 'India';
    const employees = await Employee.find({ organizationId, 'address.country': new RegExp(country, 'i') }).select('_id department status').lean();
    return aggregateLocationDashboard('country', country, employees);
}

export async function buildLocationDashboard(organizationId, filters = {}) {
    const location = filters.location;
    if (!location) throw new Error('location filter required');
    const employees = await Employee.find({ organizationId, city: new RegExp(location, 'i') }).select('_id department status').lean();
    return aggregateLocationDashboard('location', location, employees);
}

function aggregateLocationDashboard(type, label, employees) {
    const byDept = groupCount(employees, 'department');
    return {
        type,
        label,
        kpis: { headcount: employees.length, active: employees.filter((e) => e.status === 'active').length },
        charts: { byDepartment: toChart(byDept) },
    };
}

function parseRange(filters) {
    const end = filters.endDate ? new Date(filters.endDate) : new Date();
    const start = filters.startDate ? new Date(filters.startDate) : new Date(end.getTime() - 90 * 86400000);
    return { start, end };
}

function groupCount(items, field) {
    return items.reduce((acc, item) => {
        const k = item[field] || 'Unknown';
        acc[k] = (acc[k] || 0) + 1;
        return acc;
    }, {});
}

function toChart(obj) {
    return Object.entries(obj).map(([name, value]) => ({ name, value }));
}

export async function buildDashboard(organizationId, type, filters = {}) {
    switch (type) {
        case 'executive': return buildExecutiveDashboard(organizationId, filters);
        case 'hr': return buildHrDashboard(organizationId, filters);
        case 'recruitment': return buildRecruitmentDashboard(organizationId, filters);
        case 'lifecycle': return buildLifecycleDashboard(organizationId, filters);
        case 'department': return buildDepartmentDashboard(organizationId, filters);
        case 'manager': return buildManagerDashboard(organizationId, filters);
        case 'country': return buildCountryDashboard(organizationId, filters);
        case 'location': return buildLocationDashboard(organizationId, filters);
        default: throw new Error(`Unknown dashboard type: ${type}`);
    }
}
