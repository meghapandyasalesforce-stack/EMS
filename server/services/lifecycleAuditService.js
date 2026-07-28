/**
 * Lifecycle audit wrapper — every lifecycle config action goes through here.
 */

import { createAuditLog } from '../helpers/auditLogger.js';
import logger from '../helpers/logger.js';

export async function logLifecycleAudit({
    action,
    entityType,
    entityId,
    entityName = null,
    req = null,
    actor = null,
    before = null,
    after = null,
    metadata = null,
    status = 'Success',
}) {
    try {
        await createAuditLog({
            action,
            entityType,
            entityId,
            entityName,
            req,
            before,
            after,
            status,
            metadata: {
                ...metadata,
                actorId: actor?._id || actor,
                module: 'lifecycle',
            },
        });
    } catch (error) {
        logger.error('Lifecycle audit log failed', { error: error.message, entityType, entityId });
    }
}

export function appendWorkflowTimeline(workflow, {
    action,
    description,
    actor,
    actorName,
    metadata = {},
    before = null,
    after = null,
}) {
    if (!workflow.activityFeed) workflow.activityFeed = [];
    workflow.activityFeed.unshift({
        action,
        description,
        actor: actor?._id || actor,
        actorName: actorName || actor?.name || (actor ? undefined : 'System'),
        metadata: {
            ...metadata,
            ...(before !== null ? { before } : {}),
            ...(after !== null ? { after } : {}),
        },
        createdAt: new Date(),
    });
}
