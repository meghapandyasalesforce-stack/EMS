/**
 * LMS integration adapters — course assignment, enrollment, completion sync.
 */

import logger from '../helpers/logger.js';

const lmsProviders = new Map();

export function registerLmsProvider(name, adapter) {
    lmsProviders.set(name, adapter);
}

async function httpJson(url, options = {}) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || res.statusText);
    return data;
}

registerLmsProvider('moodle', {
    async enroll({ courseId, userEmail, userName }) {
        const baseUrl = process.env.MOODLE_URL;
        const token = process.env.MOODLE_WS_TOKEN;
        if (!baseUrl || !token) throw new Error('Moodle not configured');
        const params = new URLSearchParams({
            wstoken: token,
            wsfunction: 'enrol_manual_enrol_users',
            moodlewsrestformat: 'json',
            'enrolments[0][roleid]': '5',
            'enrolments[0][userid]': userEmail,
            'enrolments[0][courseid]': courseId,
        });
        return httpJson(`${baseUrl}/webservice/rest/server.php?${params}`);
    },
    async getCompletion({ courseId, userId }) {
        const baseUrl = process.env.MOODLE_URL;
        const token = process.env.MOODLE_WS_TOKEN;
        const params = new URLSearchParams({
            wstoken: token,
            wsfunction: 'core_completion_get_course_completion_status',
            moodlewsrestformat: 'json',
            courseid: courseId,
            userid: userId,
        });
        return httpJson(`${baseUrl}/webservice/rest/server.php?${params}`);
    },
});

registerLmsProvider('talentlms', {
    async enroll({ courseId, userEmail, userName }) {
        const baseUrl = process.env.TALENTLMS_URL;
        const apiKey = process.env.TALENTLMS_API_KEY;
        if (!baseUrl || !apiKey) throw new Error('TalentLMS not configured');
        const auth = Buffer.from(`${apiKey}:`).toString('base64');
        return httpJson(`${baseUrl}/api/v1/usersignup`, {
            method: 'POST',
            headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ email: userEmail, first_name: userName, course_id: courseId }),
        });
    },
});

registerLmsProvider('docebo', {
    async enroll({ courseId, userEmail }) {
        const baseUrl = process.env.DOCEBO_URL;
        const token = process.env.DOCEBO_ACCESS_TOKEN;
        if (!baseUrl || !token) throw new Error('Docebo not configured');
        return httpJson(`${baseUrl}/learn/v1/enrollments`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ course_id: courseId, user_email: userEmail }),
        });
    },
});

registerLmsProvider('successfactors', {
    async enroll({ courseId, userEmail }) {
        const baseUrl = process.env.SF_LEARNING_URL;
        const token = process.env.SF_LEARNING_TOKEN;
        if (!baseUrl || !token) throw new Error('SAP SuccessFactors Learning not configured');
        return httpJson(`${baseUrl}/learning/odatav4/public/user/learningPlan/v1/assignments`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseID: courseId, studentID: userEmail }),
        });
    },
});

registerLmsProvider('internal', {
    async enroll({ module, workflow }) {
        return { enrolled: true, moduleId: module?.title, internal: true };
    },
    async syncCompletion({ module }) {
        return { status: module?.status, score: module?.score, completedAt: module?.completedAt };
    },
});

export async function enrollInLmsCourse({
    provider = 'internal',
    courseId,
    userEmail,
    userName,
    module,
    workflow,
}) {
    const adapter = lmsProviders.get(provider) || lmsProviders.get('internal');
    const result = await adapter.enroll({ courseId, userEmail, userName, module, workflow });
    logger.info('LMS enrollment', { provider, courseId, userEmail });
    return result;
}

export async function syncLmsCompletion({ provider = 'internal', courseId, userId, module }) {
    const adapter = lmsProviders.get(provider) || lmsProviders.get('internal');
    if (!adapter.getCompletion && adapter.syncCompletion) {
        return adapter.syncCompletion({ module });
    }
    if (adapter.getCompletion) {
        return adapter.getCompletion({ courseId, userId });
    }
    return null;
}

export async function syncWorkflowTrainingFromLms(workflow, { provider, lmsCourseMap = {} }) {
    for (const mod of workflow.trainingModules || []) {
        const courseId = lmsCourseMap[mod.title] || mod.lmsCourseId;
        if (!courseId) continue;
        const completion = await syncLmsCompletion({ provider, courseId, module: mod });
        if (completion?.status === 'completed' || completion?.completed) {
            mod.status = 'Completed';
            mod.completedAt = new Date();
            mod.score = completion.score ?? mod.score;
        }
    }
    return workflow;
}

export function listLmsProviders() {
    return [...lmsProviders.keys()];
}
