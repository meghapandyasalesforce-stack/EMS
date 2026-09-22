import PlatformAuditLog from '../models/platformAuditLog.model.js';
import logger from './logger.js';

/**
 * Persist a platform control-panel audit event (best-effort).
 */
export const logPlatformAction = async ({
  req,
  action,
  entityType = 'Organization',
  entityId = null,
  organizationId = null,
  summary = '',
  before = null,
  after = null,
}) => {
  try {
    const operator = req?.platformOperator;
    if (!operator?._id) return null;

    return await PlatformAuditLog.create({
      organizationId: organizationId || null,
      operatorId: operator._id,
      operatorEmail: operator.email,
      action,
      entityType,
      entityId,
      summary,
      before,
      after,
      ipAddress: req.ip || req.headers?.['x-forwarded-for'] || null,
      userAgent: req.headers?.['user-agent'] || null,
    });
  } catch (error) {
    logger.warn('Failed to write platform audit log', { error: error.message, action });
    return null;
  }
};

export default logPlatformAction;
