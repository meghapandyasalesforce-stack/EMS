/**
 * Global lifecycle search — employees, candidates, offers, documents, forms, letters, workflows, tasks, exit interviews.
 */

import mongoose from 'mongoose';
import Employee from '../models/employee.model.js';
import { OnboardingWorkflow, OffboardingWorkflow } from '../models/onboarding.model.js';
import { Document } from '../models/document.model.js';
import {
    OfferLetter, LifecycleGeneratedLetter,
} from '../models/lifecycleGap.model.js';
import { LifecycleFormDefinition, ExitInterviewSession } from '../models/lifecycle.model.js';

const SEARCH_CATEGORIES = Object.freeze([
    'employees', 'candidates', 'offers', 'documents', 'forms', 'letters',
    'workflows', 'tasks', 'exit_interviews', 'reports',
]);

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toObjectId(value) {
    try { return new mongoose.Types.ObjectId(value); } catch { return null; }
}

export function listSearchCategories() {
    return SEARCH_CATEGORIES;
}

export async function globalLifecycleSearch(organizationId, {
    q = '',
    categories = [],
    limit = 20,
    department,
    status,
} = {}) {
    if (!q || q.trim().length < 2) {
        return { query: q, results: [], total: 0 };
    }

    const orgId = toObjectId(organizationId);
    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    const activeCategories = categories.length ? categories : SEARCH_CATEGORIES;
    const results = [];

    const push = (category, items) => {
        for (const item of items) {
            results.push({ category, ...item });
            if (results.length >= limit) break;
        }
    };

    if (activeCategories.includes('employees') && results.length < limit) {
        const query = { organizationId: orgId, $or: [{ name: regex }, { lastName: regex }, { email: regex }, { employeeId: regex }] };
        if (department) query.department = department;
        if (status) query.status = status;
        const rows = await Employee.find(query).select('name lastName email employeeId department status').limit(limit - results.length).lean();
        push('employees', rows.map((e) => ({ id: e._id, title: `${e.name} ${e.lastName || ''}`.trim(), subtitle: e.email, meta: e.department })));
    }

    if (activeCategories.includes('offers') && results.length < limit) {
        const rows = await OfferLetter.find({ organizationId: orgId, $or: [{ candidateName: regex }, { candidateEmail: regex }, { position: regex }] })
            .select('candidateName candidateEmail position status').limit(limit - results.length).lean();
        push('offers', rows.map((o) => ({ id: o._id, title: o.candidateName, subtitle: o.position, meta: o.status })));
    }

    if (activeCategories.includes('documents') && results.length < limit) {
        const rows = await Document.find({ organizationId: orgId, $or: [{ title: regex }, { fileName: regex }, { category: regex }] })
            .select('title fileName category employeeId').limit(limit - results.length).lean();
        push('documents', rows.map((d) => ({ id: d._id, title: d.title || d.fileName, subtitle: d.category })));
    }

    if (activeCategories.includes('forms') && results.length < limit) {
        const rows = await LifecycleFormDefinition.find({ organizationId: orgId, $or: [{ name: regex }, { category: regex }] })
            .select('name category status').limit(limit - results.length).lean();
        push('forms', rows.map((f) => ({ id: f._id, title: f.name, subtitle: f.category, meta: f.status })));
    }

    if (activeCategories.includes('letters') && results.length < limit) {
        const rows = await LifecycleGeneratedLetter.find({ organizationId: orgId, $or: [{ title: regex }, { letterType: regex }] })
            .select('title letterType status').limit(limit - results.length).lean();
        push('letters', rows.map((l) => ({ id: l._id, title: l.title || l.letterType, meta: l.status })));
    }

    if (activeCategories.includes('workflows') && results.length < limit) {
        const [onb, off] = await Promise.all([
            OnboardingWorkflow.find({ organizationId: orgId, isTemplate: { $ne: true }, status: regex }).select('status progress employeeId').limit(5).populate('employeeId', 'name lastName').lean(),
            OffboardingWorkflow.find({ organizationId: orgId, status: regex }).select('status progress employeeId').limit(5).populate('employeeId', 'name lastName').lean(),
        ]);
        push('workflows', [
            ...onb.map((w) => ({ id: w._id, title: `Onboarding — ${w.employeeId?.name || ''}`, subtitle: w.status, meta: `${w.progress}%` })),
            ...off.map((w) => ({ id: w._id, title: `Offboarding — ${w.employeeId?.name || ''}`, subtitle: w.status, meta: `${w.progress}%` })),
        ]);
    }

    if (activeCategories.includes('tasks') && results.length < limit) {
        const workflows = await OnboardingWorkflow.find({ organizationId: orgId, isTemplate: { $ne: true }, 'tasks.title': regex })
            .select('tasks employeeId').limit(10).lean();
        const taskHits = [];
        for (const wf of workflows) {
            for (const t of wf.tasks || []) {
                if (regex.test(t.title)) {
                    taskHits.push({ id: t._id, workflowId: wf._id, title: t.title, subtitle: t.status, meta: t.assigneeRole });
                }
            }
        }
        push('tasks', taskHits.slice(0, limit - results.length));
    }

    if (activeCategories.includes('exit_interviews') && results.length < limit) {
        const rows = await ExitInterviewSession.find({ organizationId: orgId, status: regex })
            .select('interviewType status scheduledDate offboardingWorkflowId').limit(limit - results.length).lean();
        push('exit_interviews', rows.map((s) => ({
            id: s._id, title: s.interviewType, subtitle: s.status,
            meta: s.scheduledDate ? new Date(s.scheduledDate).toISOString().slice(0, 10) : '',
        })));
    }

    return { query: q, results: results.slice(0, limit), total: results.length };
}

export async function saveSearch(organizationId, employeeId, { name, query, categories, filters }) {
    const EmployeeSearch = mongoose.models.LifecycleSavedSearch || mongoose.model('LifecycleSavedSearch', new mongoose.Schema({
        organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        employeeId: { type: mongoose.Schema.Types.ObjectId, required: true },
        name: { type: String, required: true },
        query: String,
        categories: [String],
        filters: mongoose.Schema.Types.Mixed,
    }, { timestamps: true }));

    return EmployeeSearch.create({ organizationId, employeeId, name, query, categories, filters });
}

export async function listSavedSearches(organizationId, employeeId) {
    const Model = mongoose.models.LifecycleSavedSearch;
    if (!Model) return [];
    return Model.find({ organizationId, employeeId }).sort({ updatedAt: -1 }).lean();
}
