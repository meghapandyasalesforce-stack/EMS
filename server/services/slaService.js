/**
 * SLA Service
 * Handles SLA tracking, violation detection, and escalations
 */

import logger from '../helpers/logger.js';
import { SLA, SLAViolation } from '../models/sla.model.js';
import Employee from '../models/employee.model.js';
import { sendNotification } from '../helpers/notificationService.js';

/**
 * Track entity and start SLA monitoring
 */
export const trackEntity = async ({
    organizationId,
    entityType,
    entityId,
    priority = 'Medium',
    metadata = {}
}) => {
    try {
        // Find applicable SLA
        const sla = await findApplicableSLA(organizationId, entityType, priority, metadata);
        
        if (!sla) {
            logger.info('No SLA found for entity', { entityType, entityId });
            return null;
        }

        // Calculate target times
        const now = new Date();
        const responseTarget = calculateTargetTime(now, sla.responseTime);
        const resolutionTarget = calculateTargetTime(now, sla.resolutionTime);

        // Create violation tracking record
        const violation = await SLAViolation.create({
            organizationId,
            slaId: sla._id,
            entityType,
            entityId,
            violationType: 'Both',
            responseTime: {
                target: responseTarget,
                violated: false
            },
            resolutionTime: {
                target: resolutionTarget,
                violated: false
            },
            status: 'Active',
            metadata
        });

        // Schedule escalation checks
        scheduleEscalationChecks(violation._id, sla);

        return violation;
    } catch (error) {
        logger.error('Error tracking entity for SLA', {
            error: error.message,
            entityType,
            entityId,
            stack: error.stack
        });
        return null;
    }
};

/**
 * Mark entity as responded
 */
export const markResponded = async (violationId) => {
    try {
        const violation = await SLAViolation.findById(violationId);
        if (!violation) return;

        const now = new Date();
        const isViolated = now > violation.responseTime.target;

        violation.responseTime.actual = now;
        violation.responseTime.violated = isViolated;
        if (isViolated) {
            violation.responseTime.violatedAt = now;
        }

        await violation.save();

        if (isViolated) {
            await handleViolation(violation, 'ResponseTime');
        }
    } catch (error) {
        logger.error('Error marking entity as responded', { error: error.message });
    }
};

/**
 * Mark entity as resolved
 */
export const markResolved = async (violationId) => {
    try {
        const violation = await SLAViolation.findById(violationId);
        if (!violation || violation.status !== 'Active') return;

        const now = new Date();
        const isViolated = now > violation.resolutionTime.target;

        violation.resolutionTime.actual = now;
        violation.resolutionTime.violated = isViolated;
        if (isViolated) {
            violation.resolutionTime.violatedAt = now;
        }

        violation.status = 'Resolved';
        violation.resolvedAt = now;
        await violation.save();

        if (isViolated) {
            await handleViolation(violation, 'ResolutionTime');
        }
    } catch (error) {
        logger.error('Error marking entity as resolved', { error: error.message });
    }
};

/**
 * Check and escalate violations
 */
export const checkAndEscalate = async (violationId) => {
    try {
        const violation = await SLAViolation.findById(violationId).populate('slaId');
        if (!violation || violation.status !== 'Active') return;

        const sla = violation.slaId;
        if (!sla) return;

        const now = new Date();
        const hoursSinceCreation = (now - violation.createdAt) / (1000 * 60 * 60);

        // Check each escalation level
        for (const level of sla.escalationLevels || []) {
            if (level.level <= violation.currentLevel) continue;

            if (hoursSinceCreation >= level.triggerAfterHours) {
                await escalateToLevel(violation, level);
                violation.currentLevel = level.level;
                await violation.save();
            }
        }
    } catch (error) {
        logger.error('Error checking and escalating', { error: error.message });
    }
};

/**
 * Find applicable SLA for entity
 */
const findApplicableSLA = async (organizationId, entityType, priority, metadata) => {
    try {
        const slas = await SLA.find({
            organizationId,
            entityType,
            isActive: true
        }).sort({ priority: -1 });

        // Find best matching SLA based on conditions
        for (const sla of slas) {
            if (matchesConditions(sla, priority, metadata)) {
                return sla;
            }
        }

        // Return default SLA if no conditions match
        return slas[0] || null;
    } catch (error) {
        logger.error('Error finding applicable SLA', { error: error.message });
        return null;
    }
};

/**
 * Check if entity matches SLA conditions
 */
const matchesConditions = (sla, priority, metadata) => {
    if (!sla.conditions) return true;

    // Check amount conditions
    if (metadata.amount !== undefined) {
        if (sla.conditions.minAmount && metadata.amount < sla.conditions.minAmount) return false;
        if (sla.conditions.maxAmount && metadata.amount > sla.conditions.maxAmount) return false;
    }

    // Check department conditions
    if (sla.conditions.departments && sla.conditions.departments.length > 0) {
        if (!metadata.department || !sla.conditions.departments.includes(metadata.department)) {
            return false;
        }
    }

    return true;
};

/**
 * Calculate target time based on SLA
 */
const calculateTargetTime = (startTime, timeConfig) => {
    const hours = timeConfig.hours || 24;
    const targetTime = new Date(startTime);
    targetTime.setHours(targetTime.getHours() + hours);

    if (timeConfig.businessHoursOnly) {
        // Adjust for business hours (9 AM - 5 PM, Mon-Fri)
        return adjustForBusinessHours(targetTime, startTime, hours);
    }

    return targetTime;
};

/**
 * Adjust time for business hours only
 */
const adjustForBusinessHours = (targetTime, startTime, hours) => {
    // Simplified: add business hours only
    let businessHoursAdded = 0;
    let current = new Date(startTime);

    while (businessHoursAdded < hours) {
        const dayOfWeek = current.getDay();
        const hour = current.getHours();

        // Skip weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            current.setDate(current.getDate() + 1);
            current.setHours(9, 0, 0, 0);
            continue;
        }

        // Business hours: 9 AM - 5 PM
        if (hour >= 9 && hour < 17) {
            businessHoursAdded++;
        } else if (hour < 9) {
            current.setHours(9, 0, 0, 0);
            continue;
        } else {
            // After hours, move to next day
            current.setDate(current.getDate() + 1);
            current.setHours(9, 0, 0, 0);
            continue;
        }

        current.setHours(current.getHours() + 1);
    }

    return current;
};

/**
 * Schedule escalation checks
 */
const scheduleEscalationChecks = async (violationId, sla) => {
    if (!sla.escalationLevels || sla.escalationLevels.length === 0) return;

    // Schedule checks for each escalation level
    for (const level of sla.escalationLevels) {
        setTimeout(async () => {
            await checkAndEscalate(violationId);
        }, level.triggerAfterHours * 60 * 60 * 1000);
    }
};

/**
 * Escalate to specific level
 */
const escalateToLevel = async (violation, level) => {
    try {
        const escalationTarget = await determineEscalationTarget(violation, level);
        
        if (!escalationTarget) {
            logger.warn('No escalation target found', { level: level.name });
            return;
        }

        // Record escalation
        violation.escalatedTo.push({
            level: level.level,
            escalatedAt: new Date(),
            escalatedTo: escalationTarget.id,
            notified: false
        });
        await violation.save();

        // Send notifications
        await notifyEscalation(violation, level, escalationTarget);

        // Perform actions
        if (level.actions) {
            for (const action of level.actions) {
                await performEscalationAction(violation, action, escalationTarget);
            }
        }
    } catch (error) {
        logger.error('Error escalating to level', { error: error.message });
    }
};

/**
 * Determine escalation target
 */
const determineEscalationTarget = async (violation, level) => {
    try {
        switch (level.notifyTo) {
            case 'Manager':
                // Get manager from entity metadata
                if (violation.metadata?.managerId) {
                    const manager = await Employee.findById(violation.metadata.managerId);
                    return { id: manager?._id, name: manager?.name, email: manager?.email };
                }
                break;

            case 'HR':
                const hr = await Employee.findOne({
                    organizationId: violation.organizationId,
                    position: { $regex: /HR|Human Resources/i },
                    status: 'active'
                });
                return { id: hr?._id, name: hr?.name, email: hr?.email };

            case 'Executive':
                const executive = await Employee.findOne({
                    organizationId: violation.organizationId,
                    position: { $in: ['CEO', 'CTO', 'CFO', 'VP'] },
                    status: 'active'
                });
                return { id: executive?._id, name: executive?.name, email: executive?.email };

            case 'Role':
                if (level.notifyToRole) {
                    const employee = await Employee.findOne({
                        organizationId: violation.organizationId,
                        role: level.notifyToRole,
                        status: 'active'
                    });
                    return { id: employee?._id, name: employee?.name, email: employee?.email };
                }
                break;

            case 'Department':
                if (level.notifyToDepartment) {
                    const employee = await Employee.findOne({
                        organizationId: violation.organizationId,
                        department: level.notifyToDepartment,
                        position: { $in: ['Manager', 'Head', 'Director'] },
                        status: 'active'
                    });
                    return { id: employee?._id, name: employee?.name, email: employee?.email };
                }
                break;

            case 'Employee':
                if (level.notifyToEmployee) {
                    const employee = await Employee.findById(level.notifyToEmployee);
                    return { id: employee?._id, name: employee?.name, email: employee?.email };
                }
                break;
        }

        return null;
    } catch (error) {
        logger.error('Error determining escalation target', { error: error.message });
        return null;
    }
};

/**
 * Notify about escalation
 */
const notifyEscalation = async (violation, level, target) => {
    try {
        if (!target?.id) return;

        await sendNotification({
            userId: target.id,
            title: `SLA Escalation: ${level.name}`,
            message: `A ${violation.entityType} request has been escalated to ${level.name} level due to SLA violation.`,
            type: 'sla_escalation',
            priority: 'high',
            metadata: {
                violationId: violation._id,
                entityType: violation.entityType,
                entityId: violation.entityId,
                level: level.level
            }
        });
    } catch (error) {
        logger.error('Error notifying escalation', { error: error.message });
    }
};

/**
 * Perform escalation action
 */
const performEscalationAction = async (violation, action, target) => {
    try {
        switch (action) {
            case 'AutoAssign':
                // Auto-assign to escalation target
                // Implementation depends on entity type
                logger.info('Auto-assigning entity', { violationId: violation._id, target: target.id });
                break;

            case 'ChangePriority':
                // Change priority to high
                logger.info('Changing priority', { violationId: violation._id });
                break;

            case 'EscalateToNextLevel':
                // Already handled
                break;
        }
    } catch (error) {
        logger.error('Error performing escalation action', { error: error.message });
    }
};

/**
 * Handle violation
 */
const handleViolation = async (violation, violationType) => {
    try {
        await checkAndEscalate(violation._id);
    } catch (error) {
        logger.error('Error handling violation', { error: error.message });
    }
};

/**
 * Get SLA violations
 */
export const getViolations = async (organizationId, filters = {}) => {
    try {
        const query = { organizationId };
        if (filters.status) query.status = filters.status;
        if (filters.entityType) query.entityType = filters.entityType;
        if (filters.priority) {
            const sla = await SLA.findOne({ organizationId, priority: filters.priority });
            if (sla) query.slaId = sla._id;
        }

        return await SLAViolation.find(query)
            .populate('slaId', 'name entityType')
            .populate('escalatedTo.escalatedTo', 'name email')
            .sort({ createdAt: -1 })
            .limit(filters.limit || 50);
    } catch (error) {
        logger.error('Error getting violations', { error: error.message });
        return [];
    }
};

