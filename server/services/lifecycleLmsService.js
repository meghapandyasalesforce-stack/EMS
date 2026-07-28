/**
 * LMS dashboard — course assignment, progress, certificates, training history.
 * Extends lmsAdapter.js without duplicating provider logic.
 */

import { OnboardingWorkflow } from '../models/onboarding.model.js';
import Employee from '../models/employee.model.js';
import { getOrCreateLifecycleSettings, isFeatureEnabled, assertAnyFeatureEnabled, assertFeatureEnabled } from './lifecycleConfigService.js';
import {
    listLmsProviders, enrollInLmsCourse, syncWorkflowTrainingFromLms,
} from './lmsAdapter.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';
import { notify } from '../helpers/notificationManager.js';

export async function buildLmsDashboard(organizationId, filters = {}) {
    await assertAnyFeatureEnabled(organizationId, ['trainingLms', 'lmsDashboard', 'mandatoryTraining'], 'Training / LMS');
    const query = { organizationId, isTemplate: { $ne: true } };
    if (filters.status) query.status = filters.status;
    const workflows = await OnboardingWorkflow.find(query)
        .populate('employeeId', 'name lastName email department')
        .select('employeeId trainingModules status progress')
        .lean();

    let totalModules = 0;
    let completedModules = 0;
    let inProgress = 0;
    const byCourse = new Map();
    const employeeRows = [];

    for (const wf of workflows) {
        const modules = wf.trainingModules || [];
        totalModules += modules.length;
        let empCompleted = 0;
        for (const mod of modules) {
            if (mod.status === 'Completed') { completedModules += 1; empCompleted += 1; }
            else if (mod.status === 'In Progress') inProgress += 1;
            const key = mod.title || mod.name || 'Untitled';
            if (!byCourse.has(key)) byCourse.set(key, { course: key, assigned: 0, completed: 0 });
            const row = byCourse.get(key);
            row.assigned += 1;
            if (mod.status === 'Completed') row.completed += 1;
        }
        if (modules.length) {
            employeeRows.push({
                workflowId: wf._id,
                employee: wf.employeeId,
                status: wf.status,
                modulesTotal: modules.length,
                modulesCompleted: empCompleted,
                progress: modules.length ? Math.round((empCompleted / modules.length) * 100) : 0,
            });
        }
    }

    return {
        summary: {
            employeesInTraining: employeeRows.length,
            totalModules,
            completedModules,
            inProgress,
            completionRate: totalModules ? Math.round((completedModules / totalModules) * 100) : 0,
        },
        byCourse: [...byCourse.values()],
        employees: employeeRows.slice(0, filters.limit || 50),
    };
}

export async function buildManagerTrainingDashboard(organizationId, managerId) {
    const team = await Employee.find({ organizationId, managerId, status: 'active' }).select('_id').lean();
    const ids = team.map((e) => e._id);
    const workflows = await OnboardingWorkflow.find({
        organizationId, employeeId: { $in: ids }, isTemplate: { $ne: true },
    }).populate('employeeId', 'name lastName').select('trainingModules employeeId').lean();

    return workflows.map((wf) => ({
        employee: wf.employeeId,
        modules: wf.trainingModules || [],
        completed: (wf.trainingModules || []).filter((m) => m.status === 'Completed').length,
        total: (wf.trainingModules || []).length,
    }));
}

export async function assignCourseToWorkflow(workflow, { courseId, title, mandatory = true, courseUrl }, { actor, req } = {}) {
    const settings = await assertAnyFeatureEnabled(
        workflow.organizationId,
        ['trainingLms', 'mandatoryTraining'],
        'Training / LMS',
    );

    const provider = settings.lmsProvider || 'internal';
    const employee = await Employee.findById(workflow.employeeId).select('name email').lean();

    workflow.trainingModules = workflow.trainingModules || [];
    const existing = workflow.trainingModules.find((m) => m.externalCourseId === courseId || m.title === title);
    if (existing) return { workflow, module: existing, duplicate: true };

    let enrollResult = {};
    if (provider !== 'internal' && courseId) {
        try {
            enrollResult = await enrollInLmsCourse({
                provider,
                courseId,
                userEmail: employee?.email,
                userName: employee?.name,
            });
        } catch (e) {
            const err = new Error(`LMS enrollment failed: ${e.message}. Course was not assigned.`);
            err.status = 502;
            err.code = 'LMS_ENROLL_FAILED';
            throw err;
        }
        if (enrollResult?.stub || enrollResult?.success === false) {
            const err = new Error(enrollResult.message || 'LMS provider is not configured. Enrollment aborted.');
            err.status = 501;
            err.code = 'LMS_NOT_CONFIGURED';
            throw err;
        }
    }

    const mod = {
        title: title || courseId || 'Course',
        type: 'course',
        status: 'Not Started',
        mandatory,
        externalCourseId: courseId,
        courseUrl,
        lmsProvider: provider,
        enrolledAt: new Date(),
        enrollmentRef: enrollResult.id || enrollResult.enrolled ? 'ok' : null,
    };
    workflow.trainingModules.push(mod);

    await logLifecycleAudit({ action: 'Assign', entityType: 'Training', entityId: workflow._id, entityName: mod.title, actor, req });
    await notify({ type: 'lifecycle_lms_enrolled', organizationId: workflow.organizationId, data: { workflowId: workflow._id, course: mod.title } }).catch(() => {});

    return { workflow, module: mod, enrollResult };
}

export async function syncAndCertifyWorkflow(workflow, { actor, req } = {}) {
    await assertAnyFeatureEnabled(workflow.organizationId, ['trainingLms', 'mandatoryTraining'], 'Training / LMS');
    await syncWorkflowTrainingFromLms(workflow);
    const certificates = (workflow.trainingModules || [])
        .filter((m) => m.status === 'Completed')
        .map((m) => ({
            course: m.title,
            completedAt: m.completedAt,
            score: m.score,
            certificateUrl: m.certificateUrl || `/api/v1/both/lifecycle/training/certificates/${workflow._id}/${encodeURIComponent(m.title)}`,
        }));

    await logLifecycleAudit({ action: 'Sync', entityType: 'Training', entityId: workflow._id, entityName: 'LMS sync', actor, req });
    return { workflow, certificates };
}

export async function getTrainingHistory(organizationId, employeeId) {
    const workflows = await OnboardingWorkflow.find({
        organizationId, employeeId, isTemplate: { $ne: true },
    }).select('trainingModules startDate status').lean();

    return workflows.flatMap((wf) => (wf.trainingModules || []).map((m) => ({
        ...m,
        workflowId: wf._id,
        workflowStatus: wf.status,
        workflowStart: wf.startDate,
    })));
}

export { listLmsProviders };
