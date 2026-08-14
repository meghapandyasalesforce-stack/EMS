import crypto from 'crypto';
import Employee from '../models/employee.model.js';
import Role from '../models/role.model.js';
import { getEffectiveFunctionalRoles } from '../middlewares/createAuthMiddleware.js';
import { SUGGESTION_STATUSES, SUGGESTION_STATUS_TRANSITIONS, RECOGNITION_TYPES } from '../models/engagement.model.js';
import Organization from '../models/organization.model.js';
import { PERMISSIONS } from '../config/permissions.constants.js';
import { hasPermission } from './permissionService.js';

export const DEFAULT_ANALYTICS_MIN_RESPONSES = 5;

export const getRequestActorId = (req) => req.employee?._id || req.user?._id || null;

export const isEngagementManager = (req, employeeDoc = null) => {
    if (req.user?.role === 'admin') return true;

    const emp = employeeDoc || req.employee;
    if (!emp) return false;

    const roles = getEffectiveFunctionalRoles(emp);
    if (roles.includes('hr') || roles.includes('executive')) return true;

    const role = String(emp.role || '').toLowerCase();
    if (role === 'executive') return true;

    const department = String(emp.department || '').toLowerCase();
    const position = String(emp.position || '').toLowerCase();
    const jobTitle = String(emp.jobTitle || '').toLowerCase();

    return (
        department.includes('hr') ||
        department.includes('human resource') ||
        jobTitle.includes('hr') ||
        position.includes('hr manager') ||
        (position.includes('hr') && position.includes('manager'))
    );
};

export const loadRequestEmployee = async (req) => {
    const id = getRequestActorId(req);
    if (!id) return null;

    const needsFetch =
        !req.employee?._id ||
        req.employee.department === undefined ||
        (req.employee.assignedRole === undefined && req.user?.role !== 'admin');

    if (!needsFetch && req.employee) {
        return { ...req.employee, _id: req.employee._id || id };
    }

    const doc = await Employee.findById(id)
        .select('department assignedRole functionalRoles position jobTitle role name lastName organizationId')
        .populate('assignedRole', '_id')
        .lean();

    return doc ? { ...doc, _id: doc._id || id } : null;
};

export const surveyMatchesEmployee = (survey, employee) => {
    if (!survey || !employee) return false;

    const audience = survey.targetAudience || 'All Employees';
    if (audience === 'All Employees') return true;

    if (audience === 'Department') {
        const deps = survey.targetDepartments || [];
        if (deps.length === 0) return false;
        return deps.includes(employee.department);
    }

    if (audience === 'Role') {
        const roles = survey.targetRoles || [];
        if (roles.length === 0) return false;
        const assigned = employee.assignedRole?._id || employee.assignedRole;
        return roles.some((r) => String(r) === String(assigned));
    }

    if (audience === 'Specific Employees') {
        const targets = survey.targetEmployees || [];
        if (targets.length === 0) return false;
        return targets.some((t) => String(t) === String(employee._id));
    }

    return false;
};

export const isSurveyActiveForResponse = (survey) => {
    if (!survey || survey.status !== 'Active') return false;
    const now = new Date();
    if (survey.startDate && new Date(survey.startDate) > now) return false;
    if (survey.endDate && new Date(survey.endDate) < now) return false;
    return true;
};

export const filterSurveysForEmployee = (surveys, employee) => {
    if (!Array.isArray(surveys)) return [];
    return surveys.filter(
        (s) => s.status === 'Active' && surveyMatchesEmployee(s, employee)
    );
};

const hashSecret = () => process.env.ENGAGEMENT_ANON_SECRET || process.env.JWT_SECRET || 'engagement-anon';

/** Irreversible org-scoped hash — never store raw employeeId for anonymous feedback/surveys */
export const buildAnonymousHash = (organizationId, employeeId, purpose = 'feedback') => {
    if (!organizationId || !employeeId) return null;
    return crypto
        .createHmac('sha256', hashSecret())
        .update(`${purpose}:${String(organizationId)}:${String(employeeId)}`)
        .digest('hex');
};

/**
 * Strip identity from anonymous feedback for ALL API consumers.
 * Optionally strip HR-only fields for employee-facing responses.
 */
export const sanitizeFeedbackDocument = (doc, { stripInternal = false } = {}) => {
    if (!doc) return doc;
    const out = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    delete out.submitterHash;
    if (stripInternal) {
        delete out.internalRemarks;
    }
    if (out.anonymous) {
        out.employeeId = { name: 'Anonymous', lastName: '' };
    }
    return out;
};

export const sanitizeFeedbackList = (docs = [], options = {}) =>
    docs.map((d) => sanitizeFeedbackDocument(d, options));

export const canManageEngagementFeedback = (authContext) => {
    if (!authContext) return false;
    return (
        hasPermission(authContext, PERMISSIONS.ENGAGEMENT_FEEDBACK_MANAGE) ||
        hasPermission(authContext, PERMISSIONS.ENGAGEMENT_SUGGESTIONS_MANAGE) ||
        hasPermission(authContext, PERMISSIONS.ENGAGEMENT_MANAGE) ||
        authContext.isOrgOwner
    );
};

export const validateSuggestionStatusTransition = (fromStatus, toStatus) => {
    if (!toStatus || fromStatus === toStatus) return { valid: true };
    const allowed = SUGGESTION_STATUS_TRANSITIONS[fromStatus];
    if (!allowed) {
        return { valid: false, message: `Invalid current suggestion status: ${fromStatus}` };
    }
    if (!allowed.includes(toStatus)) {
        return {
            valid: false,
            message: `Cannot move suggestion from "${fromStatus}" to "${toStatus}".`
        };
    }
    return { valid: true };
};

export const employeeOwnsFeedback = (feedback, employee, organizationId) => {
    if (!feedback || !employee?._id) return false;
    if (!feedback.anonymous && feedback.employeeId) {
        const empId = feedback.employeeId._id || feedback.employeeId;
        return String(empId) === String(employee._id);
    }
    if (feedback.anonymous) {
        const hash = buildAnonymousHash(organizationId, employee._id, 'feedback');
        return hash && feedback.submitterHash === hash;
    }
    return false;
};

export const defaultStatusForFeedbackType = (type) => {
    if (type === 'Suggestion') return 'Submitted';
    return 'Open';
};

export const isSuggestionStatus = (status) => SUGGESTION_STATUSES.includes(status);

export const sanitizeSurveyResponses = (responses = [], surveyAnonymous = false) => {
    return responses.map((r) => {
        const out = typeof r.toObject === 'function' ? r.toObject() : { ...r };
        delete out.respondentHash;
        if (surveyAnonymous || out.isAnonymous) {
            out.employeeId = null;
        }
        return out;
    });
};

export const resolveAnalyticsMinResponses = (req) => {
    const raw = req.query?.minResponses ?? req.body?.minResponses;
    if (raw === undefined || raw === null || raw === '') {
        return DEFAULT_ANALYTICS_MIN_RESPONSES;
    }
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return DEFAULT_ANALYTICS_MIN_RESPONSES;
    // Never allow client to lower below the privacy floor; may raise up to 50
    return Math.min(50, Math.max(DEFAULT_ANALYTICS_MIN_RESPONSES, n));
};

/**
 * Apply k-anonymity threshold. Sub-threshold results must not expose exact counts.
 */
export const applyThreshold = (count, minResponses, payload = {}) => {
    if (count < minResponses) {
        return {
            available: false,
            minResponses,
            message: 'Not enough responses to display analytics.'
        };
    }
    return { available: true, responseCount: count, minResponses, ...payload };
};

/** Mongo query for active employees matching survey target audience. */
export const buildSurveyAudienceQuery = (survey, organizationId) => {
    const query = {
        organizationId,
        status: 'active'
    };
    const audience = survey?.targetAudience || 'All Employees';

    if (audience === 'Department') {
        const deps = survey.targetDepartments || [];
        if (deps.length === 0) {
            query._id = { $in: [] };
        } else {
            query.department = { $in: deps };
        }
    } else if (audience === 'Role') {
        const roles = (survey.targetRoles || []).map((r) => r?._id || r).filter(Boolean);
        if (roles.length === 0) {
            query._id = { $in: [] };
        } else {
            query.assignedRole = { $in: roles };
        }
    } else if (audience === 'Specific Employees') {
        const targets = (survey.targetEmployees || []).map((t) => t?._id || t).filter(Boolean);
        if (targets.length === 0) {
            query._id = { $in: [] };
        } else {
            query._id = { $in: targets };
        }
    }

    return query;
};

const arraysEqualAsSets = (a = [], b = []) => {
    const sa = new Set((a || []).map((v) => String(v)));
    const sb = new Set((b || []).map((v) => String(v)));
    if (sa.size !== sb.size) return false;
    for (const v of sa) {
        if (!sb.has(v)) return false;
    }
    return true;
};

/** Validate and normalize survey audience targeting (server-authoritative). */
export const validateSurveyTargeting = async (payload, organizationId) => {
    const audience = payload?.targetAudience || 'All Employees';
    const normalized = {
        targetAudience: audience,
        targetDepartments: [],
        targetRoles: [],
        targetEmployees: []
    };

    if (audience === 'All Employees') {
        return { valid: true, normalized };
    }

    if (audience === 'Department') {
        const deps = [...new Set((payload.targetDepartments || []).map((d) => String(d).trim()).filter(Boolean))];
        if (deps.length === 0) {
            return { valid: false, message: 'Select at least one department for Department audience.' };
        }
        const orgDepartments = await Employee.distinct('department', {
            organizationId,
            status: 'active',
            department: { $in: deps, $nin: [null, ''] }
        });
        const validSet = new Set(orgDepartments);
        const invalid = deps.filter((d) => !validSet.has(d));
        if (invalid.length > 0) {
            return {
                valid: false,
                message: `Invalid or inactive department(s): ${invalid.join(', ')}`
            };
        }
        normalized.targetDepartments = deps;
        return { valid: true, normalized };
    }

    if (audience === 'Role') {
        const roleIds = (payload.targetRoles || []).map((r) => r?._id || r).filter(Boolean);
        if (roleIds.length === 0) {
            return { valid: false, message: 'Select at least one role for Role audience.' };
        }
        const roles = await Role.find({
            _id: { $in: roleIds },
            organizationId,
            isActive: true
        })
            .select('_id')
            .lean();
        if (roles.length !== roleIds.length) {
            return {
                valid: false,
                message: 'One or more selected roles are invalid or belong to another organization.'
            };
        }
        normalized.targetRoles = roles.map((r) => r._id);
        return { valid: true, normalized };
    }

    if (audience === 'Specific Employees') {
        const empIds = (payload.targetEmployees || []).map((e) => e?._id || e).filter(Boolean);
        if (empIds.length === 0) {
            return {
                valid: false,
                message: 'Select at least one employee for Specific Employees audience.'
            };
        }
        const employees = await Employee.find({
            _id: { $in: empIds },
            organizationId,
            status: 'active'
        })
            .select('_id')
            .lean();
        if (employees.length !== empIds.length) {
            return {
                valid: false,
                message:
                    'One or more selected employees are invalid, inactive, or belong to another organization.'
            };
        }
        normalized.targetEmployees = employees.map((e) => e._id);
        return { valid: true, normalized };
    }

    return { valid: false, message: 'Invalid target audience.' };
};

/** Block structural survey edits once responses exist. */
export const validateSurveyStructuralUpdate = (existingSurvey, updates, responseCount = 0) => {
    if (!responseCount) return { valid: true };

    if (updates.questions !== undefined) {
        const oldQs = existingSurvey.questions || [];
        const newQs = updates.questions || [];
        if (oldQs.length !== newQs.length) {
            return {
                valid: false,
                message: 'Cannot add or remove questions after responses have been submitted.'
            };
        }
        for (let i = 0; i < oldQs.length; i += 1) {
            const oldQ = oldQs[i];
            const newQ = newQs[i];
            const oldId = oldQ._id ? String(oldQ._id) : '';
            const newId = newQ._id ? String(newQ._id) : '';
            if (oldId && newId && oldId !== newId) {
                return {
                    valid: false,
                    message: 'Cannot change question IDs or order after responses exist.'
                };
            }
            if (oldQ.type !== newQ.type) {
                return {
                    valid: false,
                    message: `Cannot change question type for question ${i + 1} after responses exist.`
                };
            }
        }
    }

    if (
        updates.targetAudience !== undefined &&
        updates.targetAudience !== existingSurvey.targetAudience
    ) {
        return {
            valid: false,
            message: 'Cannot change target audience after responses have been submitted.'
        };
    }

    if (
        updates.targetDepartments !== undefined &&
        !arraysEqualAsSets(updates.targetDepartments, existingSurvey.targetDepartments)
    ) {
        return {
            valid: false,
            message: 'Cannot change target departments after responses have been submitted.'
        };
    }

    if (
        updates.targetRoles !== undefined &&
        !arraysEqualAsSets(
            (updates.targetRoles || []).map((r) => r?._id || r),
            (existingSurvey.targetRoles || []).map((r) => r?._id || r)
        )
    ) {
        return {
            valid: false,
            message: 'Cannot change target roles after responses have been submitted.'
        };
    }

    if (
        updates.targetEmployees !== undefined &&
        !arraysEqualAsSets(
            (updates.targetEmployees || []).map((e) => e?._id || e),
            (existingSurvey.targetEmployees || []).map((e) => e?._id || e)
        )
    ) {
        return {
            valid: false,
            message: 'Cannot change target employees after responses have been submitted.'
        };
    }

    if (updates.anonymous !== undefined && updates.anonymous !== existingSurvey.anonymous) {
        return {
            valid: false,
            message: 'Cannot change anonymous setting after responses have been submitted.'
        };
    }

    if (updates.type !== undefined && updates.type !== existingSurvey.type) {
        return {
            valid: false,
            message: 'Cannot change survey type after responses have been submitted.'
        };
    }

    return { valid: true };
};

/** Merge department-level engagement metrics with privacy threshold. */
export const buildRichDepartmentBreakdown = ({
    surveyResponseByDept = [],
    feedbackByDept = [],
    suggestionByDept = [],
    recognitionByDept = [],
    enpsByDept = [],
    participationByDept = [],
    minResponses = DEFAULT_ANALYTICS_MIN_RESPONSES
}) => {
    const deptNames = new Set();
    [
        surveyResponseByDept,
        feedbackByDept,
        suggestionByDept,
        recognitionByDept,
        enpsByDept,
        participationByDept
    ].forEach((rows) => {
        (rows || []).forEach((row) => {
            if (row._id) deptNames.add(row._id);
        });
    });

    const mapCount = (rows) => {
        const m = new Map();
        (rows || []).forEach((row) => m.set(row._id || 'Unknown', row.count || 0));
        return m;
    };

    const responseMap = mapCount(surveyResponseByDept);
    const feedbackMap = mapCount(feedbackByDept);
    const suggestionMap = mapCount(suggestionByDept);
    const recognitionMap = mapCount(recognitionByDept);

    const enpsMap = new Map();
    (enpsByDept || []).forEach((row) => {
        enpsMap.set(row._id || 'Unknown', row);
    });

    const participationMap = new Map();
    (participationByDept || []).forEach((row) => {
        participationMap.set(row._id || 'Unknown', row);
    });

    return [...deptNames].map((department) => {
        const responseCount = responseMap.get(department) || 0;
        const feedbackCount = feedbackMap.get(department) || 0;
        const suggestionCount = suggestionMap.get(department) || 0;
        const recognitionCount = recognitionMap.get(department) || 0;
        const volumeTotal = responseCount + feedbackCount + suggestionCount + recognitionCount;

        if (volumeTotal < minResponses && responseCount < minResponses) {
            return {
                department,
                available: false,
                minResponses,
                message: 'Not enough responses to display analytics.'
            };
        }

        const enpsRow = enpsMap.get(department);
        let eNPS = null;
        if (enpsRow && (enpsRow.total || 0) >= minResponses) {
            const { promoters = 0, detractors = 0, total = 0 } = enpsRow;
            eNPS = Number((((promoters / total) * 100) - ((detractors / total) * 100)).toFixed(2));
        }

        const partRow = participationMap.get(department);
        let surveyParticipationRate = null;
        if (partRow && (partRow.respondents || 0) >= minResponses && partRow.eligible > 0) {
            surveyParticipationRate = Number(
                (((partRow.respondents || 0) / partRow.eligible) * 100).toFixed(2)
            );
        }

        return {
            department,
            available: true,
            minResponses,
            responseCount: responseCount >= minResponses ? responseCount : undefined,
            feedbackCount: feedbackCount >= minResponses ? feedbackCount : undefined,
            suggestionCount: suggestionCount >= minResponses ? suggestionCount : undefined,
            recognitionCount: recognitionCount >= minResponses ? recognitionCount : undefined,
            eNPS,
            surveyParticipationRate
        };
    });
};

/**
 * Resolve eligible employees for a survey (respects targeting; optional team restriction).
 * @returns {Promise<import('mongoose').Types.ObjectId[]>}
 */
export const resolveSurveyEligibleEmployeeIds = async (
    survey,
    organizationId,
    { restrictToIds = null } = {}
) => {
    if (!survey || !organizationId) return [];

    const query = buildSurveyAudienceQuery(survey, organizationId);

    if (Array.isArray(restrictToIds)) {
        if (restrictToIds.length === 0) return [];
        const allowed = new Set(restrictToIds.map((id) => String(id)));
        if (query._id?.$in) {
            query._id = {
                $in: query._id.$in.filter((id) => allowed.has(String(id)))
            };
            if (query._id.$in.length === 0) return [];
        } else {
            query._id = { $in: restrictToIds };
        }
    }

    const rows = await Employee.find(query).select('_id').lean();
    return rows.map((e) => e._id);
};

/** Parse trend date window from query: range=7d|30d|3m|6m|custom + startDate/endDate */
export const resolveAnalyticsDateRange = (req) => {
    const now = new Date();
    const end = req.query?.endDate ? new Date(req.query.endDate) : now;
    const range = String(req.query?.range || '30d').toLowerCase();

    if (req.query?.startDate || range === 'custom') {
        const start = req.query?.startDate
            ? new Date(req.query.startDate)
            : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { start, end: Number.isNaN(end.getTime()) ? now : end, range: 'custom' };
    }

    const days =
        range === '7d'
            ? 7
            : range === '3m'
              ? 90
              : range === '6m'
                ? 180
                : 30;

    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    return { start, end: Number.isNaN(end.getTime()) ? now : end, range: range === '3m' || range === '6m' || range === '7d' ? range : '30d' };
};

/** Mongo group _id for dashboard trend buckets (daily for short ranges, monthly for long). */
export const buildTrendGroupId = (range, dateField = '$submittedAt') => {
    const byDay = range === '7d' || range === '30d';
    if (byDay) {
        return {
            year: { $year: dateField },
            month: { $month: dateField },
            day: { $dayOfMonth: dateField }
        };
    }
    return {
        year: { $year: dateField },
        month: { $month: dateField }
    };
};

export const formatTrendPeriod = (id, range) => {
    if (!id) return '';
    const byDay = range === '7d' || range === '30d';
    if (byDay) {
        return `${id.year}-${String(id.month).padStart(2, '0')}-${String(id.day).padStart(2, '0')}`;
    }
    return `${id.year}-${String(id.month).padStart(2, '0')}`;
};

const toNumberAnswer = (answer) => {
    if (typeof answer === 'number' && !Number.isNaN(answer)) return answer;
    if (typeof answer === 'string' && answer.trim() !== '' && !Number.isNaN(Number(answer))) {
        return Number(answer);
    }
    return null;
};

const computeEnpsBreakdown = (scores) => {
    let promoters = 0;
    let passives = 0;
    let detractors = 0;
    for (const n of scores) {
        if (n >= 9) promoters += 1;
        else if (n >= 7) passives += 1;
        else detractors += 1;
    }
    const total = scores.length;
    if (total === 0) {
        return { total: 0, promoters: 0, passives: 0, detractors: 0, score: null };
    }
    const promoterPct = (promoters / total) * 100;
    const passivePct = (passives / total) * 100;
    const detractorPct = (detractors / total) * 100;
    return {
        total,
        promoters,
        passives,
        detractors,
        promoterPct: Number(promoterPct.toFixed(2)),
        passivePct: Number(passivePct.toFixed(2)),
        detractorPct: Number(detractorPct.toFixed(2)),
        score: Number((promoterPct - detractorPct).toFixed(2))
    };
};

/**
 * Build question-level aggregates from SurveyResponse documents.
 * Text answers are never included in analytics summaries.
 */
export const buildSurveyQuestionAnalytics = (survey, responseDocs, minResponses) => {
    const questions = survey?.questions || [];
    const hasExplicitEnps = questions.some((q) => q.type === 'eNPS');

    return questions.map((q, idx) => {
        const qid = String(q._id || idx);
        const type = q.type;
        const base = {
            questionId: q._id || null,
            questionText: q.question,
            questionType: type,
            order: q.order ?? idx
        };

        if (type === 'Text') {
            return {
                ...base,
                available: false,
                message: 'Free-text answers are not included in aggregate analytics.'
            };
        }

        const answers = [];
        for (const doc of responseDocs) {
            const rows = Array.isArray(doc.responses) ? doc.responses : [];
            const match = rows.find(
                (r) =>
                    String(r.questionId) === qid ||
                    (r.questionText && r.questionText === q.question)
            );
            if (!match || match.answer === undefined || match.answer === null || match.answer === '') {
                continue;
            }
            answers.push(match.answer);
        }

        const n = answers.length;
        if (n < minResponses) {
            return {
                ...base,
                ...applyThreshold(n, minResponses)
            };
        }

        if (type === 'Multiple Choice') {
            const options = Array.isArray(q.options) && q.options.length ? q.options : [...new Set(answers.map(String))];
            const distribution = options.map((opt) => {
                const count = answers.filter((a) => String(a) === String(opt)).length;
                return {
                    option: opt,
                    count,
                    percentage: Number(((count / n) * 100).toFixed(2))
                };
            });
            return {
                ...base,
                available: true,
                responseCount: n,
                minResponses,
                distribution
            };
        }

        if (type === 'Yes/No') {
            const yes = answers.filter((a) => String(a).toLowerCase() === 'yes').length;
            const no = answers.filter((a) => String(a).toLowerCase() === 'no').length;
            return {
                ...base,
                available: true,
                responseCount: n,
                minResponses,
                yes,
                no,
                yesPct: Number(((yes / n) * 100).toFixed(2)),
                noPct: Number(((no / n) * 100).toFixed(2))
            };
        }

        if (type === 'Rating' || type === 'Scale') {
            const nums = answers.map(toNumberAnswer).filter((v) => v !== null);
            const count = nums.length;
            if (count < minResponses) {
                return { ...base, ...applyThreshold(count, minResponses) };
            }
            const max = type === 'Rating' ? 5 : 10;
            const min = 1;
            const sum = nums.reduce((a, b) => a + b, 0);
            const distribution = [];
            for (let v = min; v <= max; v += 1) {
                const c = nums.filter((x) => x === v).length;
                distribution.push({
                    value: v,
                    count: c,
                    percentage: Number(((c / count) * 100).toFixed(2))
                });
            }
            return {
                ...base,
                available: true,
                responseCount: count,
                minResponses,
                average: Number((sum / count).toFixed(2)),
                max,
                distribution
            };
        }

        if (type === 'eNPS') {
            const nums = answers
                .map(toNumberAnswer)
                .filter((v) => v !== null && v >= 0 && v <= 10);
            const breakdown = computeEnpsBreakdown(nums);
            if (breakdown.total < minResponses) {
                return { ...base, ...applyThreshold(breakdown.total, minResponses) };
            }
            return {
                ...base,
                available: true,
                responseCount: breakdown.total,
                minResponses,
                ...breakdown,
                eNPS: breakdown.score
            };
        }

        return {
            ...base,
            available: false,
            message: 'Unsupported question type for analytics.'
        };
    }).concat(
        // Legacy eNPS from text-matched questions only when no explicit eNPS type exists
        !hasExplicitEnps
            ? (() => {
                  const scores = [];
                  for (const doc of responseDocs) {
                      for (const r of doc.responses || []) {
                          if (r.questionType === 'eNPS') continue;
                          const text = String(r.questionText || '');
                          if (!/recommend|nps|net promoter|enps/i.test(text)) continue;
                          const n = toNumberAnswer(r.answer);
                          if (n !== null && n >= 0 && n <= 10) scores.push(n);
                      }
                  }
                  if (scores.length === 0) return [];
                  const breakdown = computeEnpsBreakdown(scores);
                  const legacyBase = {
                      questionId: null,
                      questionText: 'Legacy eNPS (text-matched)',
                      questionType: 'eNPS',
                      legacy: true,
                      order: 9999
                  };
                  if (breakdown.total < minResponses) {
                      return [{ ...legacyBase, ...applyThreshold(breakdown.total, minResponses) }];
                  }
                  return [
                      {
                          ...legacyBase,
                          available: true,
                          responseCount: breakdown.total,
                          minResponses,
                          ...breakdown,
                          eNPS: breakdown.score
                      }
                  ];
              })()
            : []
    );
};

export const buildSurveyResponseTrends = (responseDocs, survey, { start, end }) => {
    const byDay = new Map();
    const dayKey = (d) => {
        const dt = new Date(d);
        return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
    };

    for (const doc of responseDocs) {
        const submitted = doc.submittedAt || doc.createdAt;
        if (!submitted) continue;
        const t = new Date(submitted).getTime();
        if (start && t < start.getTime()) continue;
        if (end && t > end.getTime()) continue;
        const key = dayKey(submitted);
        if (!byDay.has(key)) {
            byDay.set(key, { date: key, responses: 0, ratingSum: 0, ratingCount: 0, enpsScores: [] });
        }
        const bucket = byDay.get(key);
        bucket.responses += 1;

        for (const r of doc.responses || []) {
            const type = r.questionType;
            const n = toNumberAnswer(r.answer);
            if (n === null) continue;
            if (type === 'Rating' || type === 'Scale') {
                bucket.ratingSum += n;
                bucket.ratingCount += 1;
            }
            if (type === 'eNPS' || (!type && /recommend|nps|net promoter|enps/i.test(String(r.questionText || '')))) {
                if (n >= 0 && n <= 10) bucket.enpsScores.push(n);
            }
        }
    }

    const hasExplicitEnps = (survey?.questions || []).some((q) => q.type === 'eNPS');
    const days = [...byDay.keys()].sort();
    return days.map((key) => {
        const b = byDay.get(key);
        const enps = computeEnpsBreakdown(b.enpsScores);
        return {
            date: key,
            responses: b.responses,
            averageRating:
                b.ratingCount > 0 ? Number((b.ratingSum / b.ratingCount).toFixed(2)) : null,
            eNPS: hasExplicitEnps || b.enpsScores.length ? enps.score : null,
            eNPSResponseCount: enps.total
        };
    });
};

/**
 * Resolve analytics scope from permissions (org wins over team).
 * @returns {'org'|'team'|null}
 */
export const resolveEngagementAnalyticsScope = (authContext) => {
    if (!authContext) return null;
    if (
        hasPermission(authContext, PERMISSIONS.ENGAGEMENT_ANALYTICS_ORG) ||
        hasPermission(authContext, PERMISSIONS.ENGAGEMENT_MANAGE) ||
        authContext.isOrgOwner
    ) {
        return 'org';
    }
    if (hasPermission(authContext, PERMISSIONS.ENGAGEMENT_ANALYTICS_TEAM)) {
        return 'team';
    }
    return null;
};

/** Direct reports for a people manager (existing managerId hierarchy). */
export const getManagedTeamEmployeeIds = async (organizationId, managerId) => {
    if (!organizationId || !managerId) return [];
    const team = await Employee.find({
        organizationId,
        managerId,
        status: 'active'
    })
        .select('_id')
        .lean();
    return team.map((e) => e._id);
};

export { RECOGNITION_TYPES };

export const canManageRecognition = (authContext) => {
    if (!authContext) return false;
    return (
        hasPermission(authContext, PERMISSIONS.ENGAGEMENT_RECOGNITION_MANAGE) ||
        hasPermission(authContext, PERMISSIONS.ENGAGEMENT_MANAGE) ||
        authContext.isOrgOwner
    );
};

export const isRecognitionHrCreator = (req, employeeDoc = null) =>
    isEngagementManager(req, employeeDoc) || canManageRecognition(req.authContext);

export const loadRecognitionApprovalRequired = async (organizationId) => {
    if (!organizationId) return false;
    const org = await Organization.findById(organizationId)
        .select('settings.engagement.recognitionRequireApproval')
        .lean();
    return Boolean(org?.settings?.engagement?.recognitionRequireApproval);
};

export const RECOGNITION_CATEGORY_LABELS = [
    'Achievement',
    'Teamwork',
    'Leadership',
    'Innovation',
    'Customer Appreciation',
    'Performance',
    'Going Extra Mile'
];

const LEGACY_RECOGNITION_TYPES = [
    'Customer Excellence',
    'Going Above & Beyond',
    'Milestone',
    'Appreciation',
    'Other',
    'Excellence',
    'Customer Service',
    'Going Above and Beyond'
];

export const isValidRecognitionCategory = (type) =>
    RECOGNITION_CATEGORY_LABELS.includes(type) || LEGACY_RECOGNITION_TYPES.includes(type);

/** All employee IDs who should receive a recognition notification */
export const getRecognitionRecipientEmployeeIds = (recognition) => {
    const ids = new Set();
    if (recognition?.recipientId) {
        ids.add(String(recognition.recipientId?._id || recognition.recipientId));
    }
    (recognition?.recipientIds || []).forEach((id) => {
        const val = id?._id || id;
        if (val) ids.add(String(val));
    });
    return [...ids];
};

/** Human-readable recipient label for wall / history */
export const formatRecognitionRecipientLabel = (recognition) => {
    const type = recognition?.recipientType || 'Individual';
    if (type === 'Department') {
        return recognition.targetDepartment || 'Department';
    }
    if (type === 'Team') {
        if (recognition.teamLabel) return recognition.teamLabel;
        const count = recognition.recipientIds?.length || 0;
        return count > 1 ? `Team (${count} members)` : 'Team';
    }
    const r = recognition.recipientId;
    if (!r) return 'Someone';
    if (typeof r === 'object' && (r.name || r.lastName)) {
        return `${r.name || ''} ${r.lastName || ''}`.trim();
    }
    return 'Someone';
};

export const employeeParticipatesInRecognition = (recognition, employeeId) => {
    if (!recognition || !employeeId) return false;
    const empId = String(employeeId);
    const allRecipients = getRecognitionRecipientEmployeeIds(recognition);
    if (allRecipients.includes(empId)) return true;
    const gid = recognition.givenBy?._id || recognition.givenBy;
    return String(gid) === empId;
};

export const validateRecognitionPayload = async (body, organizationId, givenBy) => {
    const recipientType = body.recipientType || 'Individual';
    const type = body.type;
    const title = body.title;

    if (!type || !title) {
        return { valid: false, message: 'Category and title are required' };
    }
    if (!isValidRecognitionCategory(type)) {
        return { valid: false, message: 'Invalid recognition category' };
    }

    let recipientId = body.recipientId || null;
    let recipientIds = [];
    let targetDepartment = body.targetDepartment || undefined;
    let teamLabel = body.teamLabel ? String(body.teamLabel).slice(0, 120) : undefined;

    if (recipientType === 'Individual') {
        if (!recipientId) {
            return { valid: false, message: 'Select an employee to recognize' };
        }
        const recipient = await Employee.findOne({ _id: recipientId, organizationId, status: 'active' })
            .select('_id')
            .lean();
        if (!recipient) {
            return { valid: false, message: 'Recipient not found in your organization' };
        }
        if (String(recipientId) === String(givenBy)) {
            return { valid: false, message: 'You cannot recognize yourself' };
        }
        recipientIds = [recipientId];
    } else if (recipientType === 'Team') {
        const rawIds = Array.isArray(body.recipientIds) ? body.recipientIds : [];
        if (rawIds.length < 2) {
            return { valid: false, message: 'Select at least two team members' };
        }
        const employees = await Employee.find({
            _id: { $in: rawIds },
            organizationId,
            status: 'active'
        })
            .select('_id')
            .lean();
        if (employees.length !== rawIds.length) {
            return { valid: false, message: 'One or more team members are invalid or inactive' };
        }
        recipientIds = employees.map((e) => e._id);
        recipientId = recipientIds[0];
        if (recipientIds.some((id) => String(id) === String(givenBy))) {
            return { valid: false, message: 'You cannot include yourself in team recognition' };
        }
    } else if (recipientType === 'Department') {
        if (!targetDepartment || !String(targetDepartment).trim()) {
            return { valid: false, message: 'Select a department' };
        }
        targetDepartment = String(targetDepartment).trim();
        const deptEmployees = await Employee.find({
            organizationId,
            status: 'active',
            department: targetDepartment
        })
            .select('_id')
            .lean();
        if (!deptEmployees.length) {
            return { valid: false, message: 'No active employees found in that department' };
        }
        recipientIds = deptEmployees.map((e) => e._id);
        recipientId = recipientIds[0];
    } else {
        return { valid: false, message: 'Invalid recipient type' };
    }

    return {
        valid: true,
        normalized: {
            recipientType,
            recipientId,
            recipientIds,
            targetDepartment,
            teamLabel
        }
    };
};

export const canEmployeeViewRecognition = (recognition, employeeId) => {
    if (!recognition) return false;
    if (employeeParticipatesInRecognition(recognition, employeeId)) return true;
    return recognition.status === 'Approved' && recognition.isPublic;
};

export const buildRecognitionDateFilter = (startDate, endDate) => {
    if (!startDate && !endDate) return {};
    const filter = { createdAt: {} };
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
    }
    return filter;
};

export const resolveRecognitionListScope = async (req, employee, organizationId) => {
    const canManage = canManageRecognition(req.authContext);
    const hrManager = isEngagementManager(req, employee);

    if (canManage || hrManager) {
        return { manager: true, teamOnly: false, employeeIds: null };
    }

    const teamScope = resolveEngagementAnalyticsScope(req.authContext);
    if (teamScope === 'team' && employee?._id) {
        const teamIds = await getManagedTeamEmployeeIds(organizationId, employee._id);
        const scoped = [...new Set([...teamIds.map(String), String(employee._id)])];
        return { manager: true, teamOnly: true, employeeIds: scoped };
    }

    return { manager: false, teamOnly: false, employeeIds: null };
};
