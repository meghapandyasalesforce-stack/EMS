/** CSV utilities for engagement exports — privacy-safe, presentation layer only. */

export const csvEscape = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

export const csvRow = (cells) => cells.map(csvEscape).join(',');

export const writeCsvBom = (res) => {
    res.write('\uFEFF');
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Readable export datetime: 12-Aug-2026 13:20 */
export const formatExportDateTime = (value) => {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = MONTHS[d.getMonth()];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${mins}`;
};

export const formatDateRangeLabel = (dateRange) => {
    if (!dateRange) return 'All Time';
    const labels = {
        '7d': 'Last 7 Days',
        '30d': 'Last 30 Days',
        '3m': 'Last 3 Months',
        '6m': 'Last 6 Months'
    };
    if (dateRange.range && labels[dateRange.range]) return labels[dateRange.range];
    if (dateRange.range === 'custom' && dateRange.start && dateRange.end) {
        return `${formatExportDateTime(dateRange.start).split(' ')[0]} to ${formatExportDateTime(dateRange.end).split(' ')[0]}`;
    }
    return 'All Time';
};

export const formatScopeLabel = (scope) => {
    if (scope === 'team') return 'Team';
    if (scope === 'org') return 'Organization';
    return scope || '';
};

export const sanitizeFilenamePart = (value) =>
    String(value || 'export')
        .trim()
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 80) || 'export';

export const exportFilename = (prefix, { part } = {}) => {
    const date = new Date().toISOString().slice(0, 10);
    if (part) return `${prefix}-${sanitizeFilenamePart(part)}-${date}.csv`;
    return `${prefix}-${date}.csv`;
};

export const formatAnswerValue = (answer) => {
    if (answer === null || answer === undefined) return '';
    if (Array.isArray(answer)) {
        return answer.map((item) => formatAnswerValue(item)).filter(Boolean).join('; ');
    }
    if (typeof answer === 'object') {
        try {
            return JSON.stringify(answer);
        } catch {
            return '';
        }
    }
    return String(answer);
};

export const formatHrReply = (responses) => {
    if (!Array.isArray(responses) || !responses.length) return '';
    return responses
        .map((r) => (r?.response != null ? String(r.response).trim() : ''))
        .filter(Boolean)
        .join(' | ');
};

export const getLastUpdated = (doc) => doc?.updatedAt || doc?.resolvedAt || doc?.createdAt;

export const writeReportMetadata = (res, rows) => {
    for (const [label, value] of rows) {
        res.write(`${csvRow([label, value ?? ''])}\n`);
    }
    res.write('\n');
};

export const writeMetricsTable = (res, metrics) => {
    res.write(`${csvRow(['Metric', 'Value', 'Description'])}\n`);
    for (const m of metrics) {
        if (m.include === false) continue;
        res.write(`${csvRow([m.metric, m.value ?? '', m.description ?? ''])}\n`);
    }
};

export const feedbackDisplayName = (doc) => {
    if (!doc) return '';
    if (doc.anonymous) return 'Anonymous';
    const emp = doc.employeeId;
    if (!emp || typeof emp !== 'object') return '';
    return `${emp.name || ''} ${emp.lastName || ''}`.trim();
};

export const recognitionDisplayName = (emp) => {
    if (!emp || typeof emp !== 'object') return '';
    return `${emp.name || ''} ${emp.lastName || ''}`.trim();
};

export const surveyResponseDisplayName = (row, surveyAnonymous) => {
    if (row.isAnonymous || surveyAnonymous) return 'Anonymous';
    const emp = row.employeeId;
    if (!emp || typeof emp !== 'object') return 'Anonymous';
    return `${emp.name || ''} ${emp.lastName || ''}`.trim();
};

export const surveyEmployeeFields = (row, surveyAnonymous) => {
    const isAnon = Boolean(row.isAnonymous || surveyAnonymous);
    if (isAnon) {
        return { employee: 'Anonymous', department: '', role: '', anonymous: 'Yes' };
    }
    const emp = row.employeeId;
    if (!emp || typeof emp !== 'object') {
        return { employee: 'Anonymous', department: '', role: '', anonymous: 'Yes' };
    }
    const role = emp.assignedRole;
    const roleName = role && typeof role === 'object' ? role.name || '' : '';
    return {
        employee: `${emp.name || ''} ${emp.lastName || ''}`.trim(),
        department: emp.department || '',
        role: roleName,
        anonymous: 'No'
    };
};

export const buildSummaryMetricsFromAnalytics = (analyticsData) => {
    const s = analyticsData?.surveys || {};
    const metrics = [];

    if (s.total != null) {
        metrics.push({
            metric: 'Total Surveys',
            value: s.total,
            description: 'Total surveys created in the organization'
        });
    }
    if (s.active != null) {
        metrics.push({
            metric: 'Active Surveys',
            value: s.active,
            description: 'Currently active surveys'
        });
    }
    if (s.closed != null) {
        metrics.push({
            metric: 'Completed Surveys',
            value: s.closed,
            description: 'Surveys that have been closed or archived'
        });
    }
    if (s.draft != null) {
        metrics.push({
            metric: 'Draft Surveys',
            value: s.draft,
            description: 'Surveys saved as draft'
        });
    }
    if (s.totalResponses != null) {
        metrics.push({
            metric: 'Total Survey Responses',
            value: s.totalResponses,
            description: 'Total survey responses received in the selected scope'
        });
    }
    if (s.participationRate != null) {
        metrics.push({
            metric: 'Participation Rate',
            value: `${Number(s.participationRate).toFixed(1)}%`,
            description: 'Overall survey participation rate'
        });
    }
    if (analyticsData?.eNPSDetail?.available && analyticsData.eNPS != null) {
        metrics.push({
            metric: 'eNPS',
            value: analyticsData.eNPS,
            description: 'eNPS based on eligible responses'
        });
    } else {
        metrics.push({
            metric: 'eNPS',
            value: '',
            description:
                analyticsData?.eNPSDetail?.message ||
                'Not enough responses to display eNPS'
        });
    }
    if (analyticsData?.openFeedback != null) {
        metrics.push({
            metric: 'Open Feedback',
            value: analyticsData.openFeedback,
            description: 'Feedback currently open or in review'
        });
    }
    if (analyticsData?.suggestions?.openCount != null) {
        metrics.push({
            metric: 'Open Suggestions',
            value: analyticsData.suggestions.openCount,
            description: 'Suggestions currently open or under review'
        });
    }
    if (analyticsData?.suggestions?.total != null) {
        metrics.push({
            metric: 'Total Suggestions',
            value: analyticsData.suggestions.total,
            description: 'Total suggestions submitted in the selected scope'
        });
    }
    if (analyticsData?.recognitionCount != null) {
        metrics.push({
            metric: 'Recognition Records',
            value: analyticsData.recognitionCount,
            description: 'Approved recognition records in the selected scope'
        });
    }

    const loop = analyticsData?.closedLoop?.actionPlans;
    if (loop) {
        if (loop.closureRate != null) {
            metrics.push({
                metric: 'Action Closure Rate',
                value: `${loop.closureRate}%`,
                description: 'Completed action plans ÷ (total − cancelled)'
            });
        }
        metrics.push({
            metric: 'Open Action Plans',
            value: (loop.open || 0) + (loop.inProgress || 0),
            description: 'Open and in-progress engagement action plans'
        });
        metrics.push({
            metric: 'Completed Action Plans',
            value: loop.completed || 0,
            description: 'Completed engagement action plans'
        });
        if (loop.followUpCompletionRate != null) {
            metrics.push({
                metric: 'Follow-up Completion Rate',
                value: `${loop.followUpCompletionRate}%`,
                description: 'Completed plans linked to survey/feedback/suggestion insights'
            });
        }
    }
    if (analyticsData?.closedLoop?.suggestionsImplemented != null) {
        metrics.push({
            metric: 'Suggestions Implemented',
            value: analyticsData.closedLoop.suggestionsImplemented,
            description: 'Suggestions marked Implemented'
        });
    }
    if (analyticsData?.lifecycle?.totals?.participationRate != null) {
        metrics.push({
            metric: 'Lifecycle Survey Participation',
            value: `${analyticsData.lifecycle.totals.participationRate}%`,
            description: 'Participation across automated lifecycle surveys'
        });
    }

    return metrics;
};
