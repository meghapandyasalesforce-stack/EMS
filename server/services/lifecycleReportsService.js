/**
 * Phase 2.6 — Enterprise Lifecycle Reports & Analytics
 * Aggregates onboarding, offboarding, offer, BGV, document, and HR metrics.
 */

import mongoose from 'mongoose';
import { OnboardingWorkflow, OffboardingWorkflow } from '../models/onboarding.model.js';
import { OfferLetter, BackgroundVerificationCase } from '../models/lifecycleGap.model.js';
import { Document } from '../models/document.model.js';
import Employee from '../models/employee.model.js';
import { ExitInterviewSession, LifecycleScheduledReport } from '../models/lifecycle.model.js';
import { getOrCreateLifecycleSettings } from './lifecycleConfigService.js';
import { buildExitInterviewAnalytics } from './lifecycleExitInterviewService.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';
import { notify } from '../helpers/notificationManager.js';
import { jsPDF } from 'jspdf';
import {
    LIFECYCLE_REPORT_CATEGORIES,
    LIFECYCLE_SCHEDULE_FREQUENCIES,
    DEFAULT_REPORTING_POLICY,
} from '../constants/lifecycleReports.js';

const MS_PER_DAY = 86400000;

function toObjectId(value) {
    if (!value) return null;
    if (value instanceof mongoose.Types.ObjectId) return value;
    try {
        return new mongoose.Types.ObjectId(value);
    } catch {
        return null;
    }
}

function parseDateRange(filters = {}) {
    const end = filters.endDate ? new Date(filters.endDate) : new Date();
    const start = filters.startDate
        ? new Date(filters.startDate)
        : new Date(end.getTime() - (Number(filters.dateRangeDays) || 90) * MS_PER_DAY);
    return { start, end };
}

function buildOnboardingMatch(organizationId, filters = {}) {
    const { start, end } = parseDateRange(filters);
    const match = {
        organizationId: toObjectId(organizationId),
        isTemplate: { $ne: true },
        startDate: { $gte: start, $lte: end },
    };
    if (filters.status) match.status = filters.status;
    return { match, start, end };
}

function buildOffboardingMatch(organizationId, filters = {}) {
    const { start, end } = parseDateRange(filters);
    const match = {
        organizationId: toObjectId(organizationId),
        startDate: { $gte: start, $lte: end },
    };
    if (filters.status) match.status = filters.status;
    if (filters.reason) match.reason = filters.reason;
    return { match, start, end };
}

async function resolveEmployeeFilter(organizationId, filters = {}) {
    if (!filters.department && !filters.location && !filters.designation && !filters.managerId) {
        return null;
    }
    const empQuery = { organizationId: toObjectId(organizationId), status: { $ne: 'Terminated' } };
    if (filters.department) empQuery.department = filters.department;
    if (filters.location) empQuery.city = filters.location;
    if (filters.designation) empQuery.jobTitle = filters.designation;
    if (filters.managerId) empQuery.managerId = toObjectId(filters.managerId);
    const employees = await Employee.find(empQuery).select('_id').lean();
    return employees.map((e) => e._id);
}

function monthLabel(year, month) {
    const d = new Date(year, month - 1, 1);
    return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
}

export async function getReportingPolicy(organizationId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    const policy = settings.reportingPolicy || {};
    const { isReportCategoryEnabled } = await import('./lifecycleFeatureRuntimeService.js');
    const baseCategories = policy.enabledCategories?.length
        ? policy.enabledCategories
        : [...LIFECYCLE_REPORT_CATEGORIES];
    return {
        ...DEFAULT_REPORTING_POLICY,
        ...policy,
        enabledCategories: baseCategories.filter((cat) => isReportCategoryEnabled(settings, cat)),
    };
}

export async function buildOnboardingReports(organizationId, filters = {}) {
    const { match } = buildOnboardingMatch(organizationId, filters);
    const employeeIds = await resolveEmployeeFilter(organizationId, filters);
    if (employeeIds) match.employeeId = { $in: employeeIds };

    const [
        total,
        completed,
        inProgress,
        scheduled,
        pendingJoining,
        avgOnboardingTime,
        joiningTrend,
        documentStats,
        byStatus,
    ] = await Promise.all([
        OnboardingWorkflow.countDocuments(match),
        OnboardingWorkflow.countDocuments({ ...match, status: 'Completed' }),
        OnboardingWorkflow.countDocuments({ ...match, status: 'In Progress' }),
        OnboardingWorkflow.countDocuments({ ...match, status: { $in: ['Scheduled', 'Not Started'] } }),
        OnboardingWorkflow.countDocuments({
            ...match,
            joiningDate: { $gte: new Date() },
            status: { $nin: ['Completed', 'Cancelled'] },
        }),
        OnboardingWorkflow.aggregate([
            { $match: { ...match, status: 'Completed', actualCompletionDate: { $exists: true } } },
            { $project: { days: { $divide: [{ $subtract: ['$actualCompletionDate', '$startDate'] }, MS_PER_DAY] } } },
            { $group: { _id: null, avgDays: { $avg: '$days' }, count: { $sum: 1 } } },
        ]),
        OnboardingWorkflow.aggregate([
            { $match: { ...match, joiningDate: { $exists: true } } },
            { $group: {
                _id: { year: { $year: '$joiningDate' }, month: { $month: '$joiningDate' } },
                count: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
            } },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]),
        OnboardingWorkflow.aggregate([
            { $match: match },
            { $unwind: '$documents' },
            { $group: {
                _id: '$documents.status',
                count: { $sum: 1 },
            } },
        ]),
        OnboardingWorkflow.aggregate([
            { $match: match },
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
    ]);

    const docMap = Object.fromEntries(documentStats.map((d) => [d._id, d.count]));
    const totalDocs = Object.values(docMap).reduce((s, c) => s + c, 0);
    const verified = (docMap.Verified || 0) + (docMap.Uploaded || 0);
    const documentCompletion = {
        total: totalDocs,
        verified,
        pending: docMap.Pending || 0,
        rejected: docMap.Rejected || 0,
        completionRate: totalDocs ? Math.round((verified / totalDocs) * 100) : 0,
        byStatus: documentStats.map((d) => ({ status: d._id, count: d.count })),
    };

    return {
        summary: {
            total,
            completed,
            inProgress,
            scheduled,
            pendingJoining,
            completionRate: total ? Math.round((completed / total) * 100) : 0,
            avgOnboardingDays: Math.round(avgOnboardingTime[0]?.avgDays || 0),
        },
        joiningTrend: joiningTrend.map((t) => ({
            label: monthLabel(t._id.year, t._id.month),
            year: t._id.year,
            month: t._id.month,
            count: t.count,
            completed: t.completed,
        })),
        pendingJoining: { count: pendingJoining },
        documentCompletion,
        avgOnboardingTime: {
            avgDays: Math.round(avgOnboardingTime[0]?.avgDays || 0),
            sampleSize: avgOnboardingTime[0]?.count || 0,
        },
        byStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
    };
}

export async function buildOfferAnalytics(organizationId, filters = {}) {
    const { start, end } = parseDateRange(filters);
    const match = {
        organizationId: toObjectId(organizationId),
        createdAt: { $gte: start, $lte: end },
    };
    const [total, byStatus, acceptanceRate, avgTimeToAccept] = await Promise.all([
        OfferLetter.countDocuments(match),
        OfferLetter.aggregate([
            { $match: match },
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]),
        OfferLetter.aggregate([
            { $match: { ...match, status: { $in: ['Sent', 'Viewed', 'Accepted', 'Declined', 'Expired'] } } },
            { $group: {
                _id: null,
                sent: { $sum: 1 },
                accepted: { $sum: { $cond: [{ $eq: ['$status', 'Accepted'] }, 1, 0] } },
            } },
        ]),
        OfferLetter.aggregate([
            { $match: { ...match, status: 'Accepted', sentAt: { $exists: true }, respondedAt: { $exists: true } } },
            { $project: { days: { $divide: [{ $subtract: ['$respondedAt', '$sentAt'] }, MS_PER_DAY] } } },
            { $group: { _id: null, avgDays: { $avg: '$days' } } },
        ]),
    ]);
    const sent = acceptanceRate[0]?.sent || 0;
    const accepted = acceptanceRate[0]?.accepted || 0;
    return {
        total,
        byStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
        acceptanceRate: sent ? Math.round((accepted / sent) * 100) : 0,
        avgDaysToAccept: Math.round(avgTimeToAccept[0]?.avgDays || 0),
    };
}

export async function buildBgvAnalytics(organizationId, filters = {}) {
    const { start, end } = parseDateRange(filters);
    const match = {
        organizationId: toObjectId(organizationId),
        createdAt: { $gte: start, $lte: end },
    };
    const cases = await BackgroundVerificationCase.find(match).lean();
    const byStatus = {};
    const byCheckType = {};
    let totalChecks = 0;
    let clearedChecks = 0;
    for (const c of cases) {
        byStatus[c.overallStatus] = (byStatus[c.overallStatus] || 0) + 1;
        for (const check of c.checks || []) {
            totalChecks += 1;
            if (check.status === 'Clear' || check.status === 'Waived') clearedChecks += 1;
            byCheckType[check.checkType] = byCheckType[check.checkType] || { total: 0, clear: 0 };
            byCheckType[check.checkType].total += 1;
            if (check.status === 'Clear' || check.status === 'Waived') byCheckType[check.checkType].clear += 1;
        }
    }
    return {
        totalCases: cases.length,
        byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
        checkClearanceRate: totalChecks ? Math.round((clearedChecks / totalChecks) * 100) : 0,
        byCheckType: Object.entries(byCheckType).map(([checkType, v]) => ({
            checkType,
            total: v.total,
            clearRate: v.total ? Math.round((v.clear / v.total) * 100) : 0,
        })),
    };
}

export async function buildOffboardingReports(organizationId, filters = {}) {
    const { match } = buildOffboardingMatch(organizationId, filters);
    const employeeIds = await resolveEmployeeFilter(organizationId, filters);
    if (employeeIds) match.employeeId = { $in: employeeIds };

    const workflows = await OffboardingWorkflow.find(match)
        .populate('employeeId', 'department city jobTitle managerId dateOfJoining')
        .lean();

    const total = workflows.length;
    const completed = workflows.filter((w) => w.status === 'Completed').length;
    const byReason = {};
    const byStatus = {};
    let clearanceTotal = 0;
    let clearanceDone = 0;
    let noticeActive = 0;
    let noticeCompleted = 0;
    let fnfPending = 0;
    let fnfPaid = 0;
    let assetsPending = 0;
    let assetsReturned = 0;
    let ktPending = 0;
    let ktCompleted = 0;
    const exitDurations = [];

    for (const w of workflows) {
        byReason[w.reason || 'Other'] = (byReason[w.reason || 'Other'] || 0) + 1;
        byStatus[w.status] = (byStatus[w.status] || 0) + 1;

        for (const item of w.clearanceChecklist || []) {
            clearanceTotal += 1;
            if (item.completed) clearanceDone += 1;
        }
        if (w.noticePeriod?.status === 'Active') noticeActive += 1;
        if (w.noticePeriod?.status === 'Completed') noticeCompleted += 1;

        const fnfStatus = w.finalSettlement?.status || 'Pending';
        if (['Pending', 'In Review', 'Calculated', 'Pending Approval'].includes(fnfStatus)) fnfPending += 1;
        if (['Approved', 'Paid', 'Cleared'].includes(fnfStatus)) fnfPaid += 1;

        for (const asset of w.assets || []) {
            if (asset.status === 'Returned' || asset.returned) assetsReturned += 1;
            else assetsPending += 1;
        }
        for (const kt of w.knowledgeTransfer || []) {
            if (kt.status === 'Completed') ktCompleted += 1;
            else ktPending += 1;
        }
        if (w.status === 'Completed' && w.actualCompletionDate && w.startDate) {
            exitDurations.push((new Date(w.actualCompletionDate) - new Date(w.startDate)) / MS_PER_DAY);
        }
    }

    const exitSessions = await ExitInterviewSession.find({
        organizationId: toObjectId(organizationId),
        createdAt: { $gte: parseDateRange(filters).start, $lte: parseDateRange(filters).end },
    }).populate('employeeId', 'department').lean();
    const exitInterview = buildExitInterviewAnalytics(exitSessions);

    const avgExitDays = exitDurations.length
        ? Math.round(exitDurations.reduce((a, b) => a + b, 0) / exitDurations.length)
        : 0;

    return {
        summary: {
            total,
            completed,
            active: workflows.filter((w) => ['Initiated', 'In Progress'].includes(w.status)).length,
            completionRate: total ? Math.round((completed / total) * 100) : 0,
        },
        attrition: {
            total,
            byReason: Object.entries(byReason).map(([reason, count]) => ({ reason, count })),
            rate: total,
        },
        exitReasons: Object.entries(byReason).map(([reason, count]) => ({
            reason,
            count,
            percent: total ? Math.round((count / total) * 100) : 0,
        })),
        clearance: {
            total: clearanceTotal,
            completed: clearanceDone,
            completionRate: clearanceTotal ? Math.round((clearanceDone / clearanceTotal) * 100) : 0,
        },
        noticePeriod: {
            active: noticeActive,
            completed: noticeCompleted,
            total: noticeActive + noticeCompleted,
        },
        fnf: { pending: fnfPending, paid: fnfPaid, total: fnfPending + fnfPaid },
        assetReturn: {
            pending: assetsPending,
            returned: assetsReturned,
            returnRate: (assetsPending + assetsReturned)
                ? Math.round((assetsReturned / (assetsPending + assetsReturned)) * 100) : 0,
        },
        knowledgeTransfer: {
            pending: ktPending,
            completed: ktCompleted,
            completionRate: (ktPending + ktCompleted)
                ? Math.round((ktCompleted / (ktPending + ktCompleted)) * 100) : 0,
        },
        exitInterview,
        avgExitTime: { avgDays: avgExitDays, sampleSize: exitDurations.length },
        byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
    };
}

export async function buildHrAnalytics(organizationId, filters = {}) {
    const { start, end } = parseDateRange(filters);
    const orgId = toObjectId(organizationId);
    const empMatch = { organizationId: orgId };
    if (filters.department) empMatch.department = filters.department;
    if (filters.location) empMatch.city = filters.location;
    if (filters.designation) empMatch.jobTitle = filters.designation;
    if (filters.managerId) empMatch.managerId = toObjectId(filters.managerId);

    const [employees, onboardingInPeriod, offboardingInPeriod, headcountByDept] = await Promise.all([
        Employee.find(empMatch).select('department city jobTitle managerId status dateOfJoining').lean(),
        OnboardingWorkflow.countDocuments({
            organizationId: orgId,
            isTemplate: { $ne: true },
            startDate: { $gte: start, $lte: end },
        }),
        OffboardingWorkflow.countDocuments({
            organizationId: orgId,
            startDate: { $gte: start, $lte: end },
        }),
        Employee.aggregate([
            { $match: { organizationId: orgId, status: 'Active' } },
            { $group: { _id: '$department', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]),
    ]);

    const byDepartment = {};
    const byLocation = {};
    const byDesignation = {};
    const byManager = {};
    let activeCount = 0;

    for (const emp of employees) {
        if (emp.status === 'Active') activeCount += 1;
        if (emp.department) byDepartment[emp.department] = (byDepartment[emp.department] || 0) + 1;
        const loc = emp.city || 'Unassigned';
        byLocation[loc] = (byLocation[loc] || 0) + 1;
        const desig = emp.jobTitle || 'Unassigned';
        byDesignation[desig] = (byDesignation[desig] || 0) + 1;
        const mgr = emp.managerId ? String(emp.managerId) : 'Unassigned';
        byManager[mgr] = (byManager[mgr] || 0) + 1;
    }

    const turnoverRate = activeCount
        ? Math.round((offboardingInPeriod / activeCount) * 100 * 10) / 10
        : 0;

    return {
        department: Object.entries(byDepartment).map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count),
        location: Object.entries(byLocation).map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count),
        designation: Object.entries(byDesignation).map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count),
        manager: Object.entries(byManager).map(([managerId, count]) => ({ managerId, count }))
            .sort((a, b) => b.count - a.count),
        hiring: { count: onboardingInPeriod, period: { start, end } },
        turnover: {
            exits: offboardingInPeriod,
            activeHeadcount: activeCount,
            turnoverRate,
        },
        headcountByDepartment: headcountByDept.map((d) => ({ department: d._id, count: d.count })),
    };
}

export async function getLifecycleDashboard(organizationId, filters = {}) {
    const policy = await getReportingPolicy(organizationId);
    const enabled = new Set(policy.enabledCategories || LIFECYCLE_REPORT_CATEGORIES);
    const settings = await getOrCreateLifecycleSettings(organizationId);
    const { isFeatureEnabled } = await import('./lifecycleConfigService.js');

    const [onboarding, offers, bgv, offboarding, hr] = await Promise.all([
        enabled.has('onboarding') || enabled.has('joiningTrend') ? buildOnboardingReports(organizationId, filters) : null,
        enabled.has('offerAnalytics') && isFeatureEnabled(settings, 'offerLetter')
            ? buildOfferAnalytics(organizationId, filters) : null,
        enabled.has('bgvAnalytics') && isFeatureEnabled(settings, 'backgroundVerification')
            ? buildBgvAnalytics(organizationId, filters) : null,
        enabled.has('offboarding') || enabled.has('attrition') ? buildOffboardingReports(organizationId, filters) : null,
        enabled.has('hrAnalytics') || enabled.has('department') ? buildHrAnalytics(organizationId, filters) : null,
    ]);

    // Strip disabled offboarding subsections from payload
    if (offboarding) {
        if (!isFeatureEnabled(settings, 'fnfSettlement')) offboarding.fnf = null;
        if (!isFeatureEnabled(settings, 'exitInterview')) offboarding.exitInterview = null;
        if (!isFeatureEnabled(settings, 'noticePeriod')) offboarding.noticePeriod = null;
        if (!isFeatureEnabled(settings, 'assetReturn')) offboarding.assetReturn = null;
        if (!isFeatureEnabled(settings, 'knowledgeTransfer') && !isFeatureEnabled(settings, 'projectHandover')) {
            offboarding.knowledgeTransfer = null;
        }
        if (!isFeatureEnabled(settings, 'clearance') && !isFeatureEnabled(settings, 'hrClearance')) {
            offboarding.clearance = null;
        }
    }
    if (onboarding && !isFeatureEnabled(settings, 'documentCollection')) {
        onboarding.documentCompletion = null;
    }

    return {
        generatedAt: new Date().toISOString(),
        filters: parseDateRange(filters),
        policy,
        onboarding,
        offerAnalytics: offers,
        bgvAnalytics: bgv,
        offboarding,
        hrAnalytics: hr,
    };
}

export async function getLifecycleReportDrilldown(organizationId, category, filters = {}) {
    const orgId = toObjectId(organizationId);
    const employeeIds = await resolveEmployeeFilter(organizationId, filters);
    const { start, end } = parseDateRange(filters);
    const limit = Math.min(Number(filters.limit) || 100, 500);

    switch (category) {
        case 'pendingJoining': {
            const query = {
                organizationId: orgId,
                isTemplate: { $ne: true },
                joiningDate: { $gte: new Date() },
                status: { $nin: ['Completed', 'Cancelled'] },
            };
            if (employeeIds) query.employeeId = { $in: employeeIds };
            return OnboardingWorkflow.find(query)
                .populate('employeeId', 'name lastName employeeId department jobTitle joiningDate')
                .sort({ joiningDate: 1 })
                .limit(limit)
                .lean();
        }
        case 'joiningTrend':
        case 'onboarding': {
            const { match } = buildOnboardingMatch(organizationId, filters);
            if (employeeIds) match.employeeId = { $in: employeeIds };
            return OnboardingWorkflow.find(match)
                .populate('employeeId', 'name lastName employeeId department jobTitle')
                .sort({ startDate: -1 })
                .limit(limit)
                .lean();
        }
        case 'offerAnalytics': {
            return OfferLetter.find({
                organizationId: orgId,
                createdAt: { $gte: start, $lte: end },
            }).populate('candidateId', 'firstName lastName email')
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean();
        }
        case 'bgvAnalytics': {
            return BackgroundVerificationCase.find({
                organizationId: orgId,
                createdAt: { $gte: start, $lte: end },
            }).populate('employeeId', 'name lastName employeeId')
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean();
        }
        case 'attrition':
        case 'exitReasons':
        case 'clearance':
        case 'noticePeriod':
        case 'fnf':
        case 'assetReturn':
        case 'knowledgeTransfer':
        case 'offboarding': {
            const { match } = buildOffboardingMatch(organizationId, filters);
            if (employeeIds) match.employeeId = { $in: employeeIds };
            if (category === 'exitReasons' && filters.reason) match.reason = filters.reason;
            return OffboardingWorkflow.find(match)
                .populate('employeeId', 'name lastName employeeId department jobTitle')
                .sort({ startDate: -1 })
                .limit(limit)
                .lean();
        }
        case 'department':
        case 'location':
        case 'designation':
        case 'manager':
        case 'hiring':
        case 'turnover':
        case 'hrAnalytics': {
            const empQuery = { organizationId: orgId };
            if (filters.department) empQuery.department = filters.department;
            if (filters.location) empQuery.city = filters.location;
            if (filters.designation) empQuery.jobTitle = filters.designation;
            if (filters.managerId) empQuery.managerId = toObjectId(filters.managerId);
            return Employee.find(empQuery)
                .select('name lastName employeeId department city jobTitle managerId status dateOfJoining')
                .sort({ dateOfJoining: -1 })
                .limit(limit)
                .lean();
        }
        default:
            return [];
    }
}

function escapeCsv(value) {
    const str = value == null ? '' : String(value);
    return `"${str.replace(/"/g, '""')}"`;
}

export function rowsToCsv(columns, rows) {
    const header = columns.map((c) => c.key).join(',');
    const body = rows.map((row) => columns.map((c) => escapeCsv(c.accessor ? c.accessor(row) : row[c.key])).join(','));
    return [header, ...body].join('\n');
}

export function rowsToExcelHtml(title, columns, rows) {
    const headerCells = columns.map((c) => `<th>${c.label || c.key}</th>`).join('');
    const bodyRows = rows.map((row) => {
        const cells = columns.map((c) => {
            const val = c.accessor ? c.accessor(row) : row[c.key];
            return `<td>${val == null ? '' : String(val).replace(/</g, '&lt;')}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
    }).join('');
    return `<html><head><meta charset="utf-8"><title>${title}</title></head><body><h2>${title}</h2><table border="1"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
}

export function rowsToPdf(title, columns, rows) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(14);
    doc.text(title, 14, 15);
    doc.setFontSize(9);
    let y = 25;
    const line = columns.map((c) => c.label || c.key).join(' | ');
    doc.text(line.slice(0, 120), 14, y);
    y += 6;
    for (const row of rows.slice(0, 40)) {
        const text = columns.map((c) => {
            const val = c.accessor ? c.accessor(row) : row[c.key];
            return val == null ? '' : String(val);
        }).join(' | ');
        doc.text(text.slice(0, 140), 14, y);
        y += 5;
        if (y > 190) {
            doc.addPage();
            y = 15;
        }
    }
    return Buffer.from(doc.output('arraybuffer'));
}

const DRILLDOWN_COLUMNS = {
    pendingJoining: [
        { key: 'employee', label: 'Employee', accessor: (r) => r.employeeId?.name || '' },
        { key: 'department', label: 'Department', accessor: (r) => r.employeeId?.department || '' },
        { key: 'joiningDate', label: 'Joining Date', accessor: (r) => r.joiningDate || '' },
        { key: 'status', label: 'Status' },
        { key: 'progress', label: 'Progress', accessor: (r) => r.progress ?? '' },
    ],
    offerAnalytics: [
        { key: 'candidate', label: 'Candidate', accessor: (r) => `${r.candidateId?.firstName || ''} ${r.candidateId?.lastName || ''}`.trim() },
        { key: 'position', label: 'Position' },
        { key: 'status', label: 'Status' },
        { key: 'salary', label: 'Salary' },
        { key: 'createdAt', label: 'Created' },
    ],
    offboarding: [
        { key: 'employee', label: 'Employee', accessor: (r) => r.employeeId?.name || '' },
        { key: 'reason', label: 'Reason' },
        { key: 'status', label: 'Status' },
        { key: 'lastWorkingDate', label: 'LWD' },
        { key: 'progress', label: 'Progress' },
    ],
};

export async function exportLifecycleReport(organizationId, { category = 'onboarding', format = 'csv', filters = {} } = {}) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    const { isReportCategoryEnabled } = await import('./lifecycleFeatureRuntimeService.js');
    if (!isReportCategoryEnabled(settings, category)) {
        const { LifecycleFeatureDisabledError } = await import('./lifecycleConfigService.js');
        throw new LifecycleFeatureDisabledError(category, `Report category ${category}`);
    }
    const rows = await getLifecycleReportDrilldown(organizationId, category, filters);
    const columns = DRILLDOWN_COLUMNS[category] || DRILLDOWN_COLUMNS.offboarding;
    const title = `Lifecycle Report — ${category}`;

    if (format === 'pdf') {
        return { contentType: 'application/pdf', fileName: `lifecycle-${category}.pdf`, body: rowsToPdf(title, columns, rows) };
    }
    if (format === 'excel') {
        return {
            contentType: 'application/vnd.ms-excel',
            fileName: `lifecycle-${category}.xls`,
            body: rowsToExcelHtml(title, columns, rows),
        };
    }
    return {
        contentType: 'text/csv',
        fileName: `lifecycle-${category}.csv`,
        body: rowsToCsv(columns, rows),
    };
}

export async function listScheduledReports(organizationId) {
    return LifecycleScheduledReport.find({ organizationId: toObjectId(organizationId) })
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .lean();
}

export async function createScheduledReport(organizationId, payload, { actor, req } = {}) {
    const freq = LIFECYCLE_SCHEDULE_FREQUENCIES.find((f) => f.key === payload.frequency);
    const report = await LifecycleScheduledReport.create({
        organizationId: toObjectId(organizationId),
        name: payload.name,
        description: payload.description,
        categories: payload.categories || ['onboarding'],
        filters: payload.filters || {},
        format: payload.format || 'csv',
        frequency: payload.frequency || 'weekly',
        cronExpression: payload.cronExpression || freq?.cron,
        recipientEmployeeIds: payload.recipientEmployeeIds || [],
        recipientEmails: payload.recipientEmails || [],
        enabled: payload.enabled !== false,
        createdBy: actor?._id,
        nextRunAt: new Date(),
    });
    await logLifecycleAudit({
        action: 'Create',
        entityType: 'LifecycleScheduledReport',
        entityId: report._id,
        entityName: report.name,
        req,
        actor,
    });
    return report;
}

export async function updateScheduledReport(organizationId, reportId, payload, { actor, req } = {}) {
    const report = await LifecycleScheduledReport.findOne({
        _id: reportId,
        organizationId: toObjectId(organizationId),
    });
    if (!report) throw new Error('Scheduled report not found');
    const fields = ['name', 'description', 'categories', 'filters', 'format', 'frequency', 'cronExpression',
        'recipientEmployeeIds', 'recipientEmails', 'enabled'];
    for (const f of fields) {
        if (payload[f] !== undefined) report[f] = payload[f];
    }
    if (payload.frequency) {
        const freq = LIFECYCLE_SCHEDULE_FREQUENCIES.find((f) => f.key === payload.frequency);
        if (freq) report.cronExpression = freq.cron;
    }
    await report.save();
    await logLifecycleAudit({
        action: 'Update',
        entityType: 'LifecycleScheduledReport',
        entityId: report._id,
        entityName: report.name,
        req,
        actor,
    });
    return report;
}

export async function deleteScheduledReport(organizationId, reportId, { actor, req } = {}) {
    const report = await LifecycleScheduledReport.findOneAndDelete({
        _id: reportId,
        organizationId: toObjectId(organizationId),
    });
    if (!report) throw new Error('Scheduled report not found');
    await logLifecycleAudit({
        action: 'Delete',
        entityType: 'LifecycleScheduledReport',
        entityId: report._id,
        entityName: report.name,
        req,
        actor,
    });
    return report;
}

function computeNextRun(frequency) {
    const now = new Date();
    const next = new Date(now);
    if (frequency === 'daily') next.setDate(next.getDate() + 1);
    else if (frequency === 'weekly') next.setDate(next.getDate() + 7);
    else if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
    else next.setDate(next.getDate() + 7);
    next.setHours(6, 0, 0, 0);
    return next;
}

export async function processScheduledLifecycleReports() {
    const now = new Date();
    const due = await LifecycleScheduledReport.find({
        enabled: true,
        $or: [{ nextRunAt: { $lte: now } }, { nextRunAt: { $exists: false } }],
    }).limit(50);

    let processed = 0;
    for (const report of due) {
        try {
            const policy = await getReportingPolicy(report.organizationId);
            if (!policy.allowScheduledReports) {
                report.lastRunStatus = 'Skipped';
                report.lastRunAt = now;
                report.nextRunAt = computeNextRun(report.frequency);
                await report.save();
                continue;
            }
            const category = report.categories?.[0] || 'onboarding';
            const exportResult = await exportLifecycleReport(report.organizationId, {
                category,
                format: report.format,
                filters: report.filters,
            });
            for (const empId of report.recipientEmployeeIds || []) {
                await notify({
                    type: 'lifecycle_report_ready',
                    organizationId: report.organizationId,
                    data: {
                        report,
                        employeeId: empId,
                        category,
                        format: report.format,
                        fileName: exportResult.fileName,
                    },
                }).catch(() => {});
            }
            report.lastRunStatus = 'Success';
            report.lastRunAt = now;
            report.nextRunAt = computeNextRun(report.frequency);
            report.lastRunError = undefined;
            await report.save();
            processed += 1;
        } catch (err) {
            report.lastRunStatus = 'Failed';
            report.lastRunAt = now;
            report.lastRunError = err.message;
            report.nextRunAt = computeNextRun(report.frequency);
            await report.save();
        }
    }
    return { processed, checked: due.length };
}

export { LIFECYCLE_REPORT_CATEGORIES, LIFECYCLE_SCHEDULE_FREQUENCIES };
