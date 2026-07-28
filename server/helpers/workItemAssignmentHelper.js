import Project from '../models/project.model.js';
import Employee from '../models/employee.model.js';
import { sendNotification } from './notificationService.js';
import { notifyTaskAssigned } from './pushNotificationTriggers.js';
import { sendNotificationEmail } from './emailSender.js';
import { toIdString } from './projectMembershipHelper.js';
import { getWorkItemAssigneeIds } from './workItemAssigneeHelper.js';
import logger from './logger.js';

/**
 * Ensure employee is in project.projectMembers (not required if already leader).
 * @returns {Promise<{ added: boolean }>}
 */
export async function ensureProjectMember(projectId, employeeId) {
  const eid = toIdString(employeeId);
  if (!projectId || !eid) return { added: false };

  const project = await Project.findById(projectId).select('projectLeader projectMembers');
  if (!project) return { added: false };

  const leaderId = toIdString(project.projectLeader);
  if (leaderId && leaderId === eid) return { added: false };

  const already = (project.projectMembers || []).some((m) => toIdString(m) === eid);
  if (already) return { added: false };

  project.projectMembers = [...(project.projectMembers || []), eid];
  await project.save();
  return { added: true };
}

async function notifyOneAssignee({
  workItem,
  assigneeId,
  organizationId,
  projectName,
  addAsMember,
}) {
  let memberAdded = false;
  if (addAsMember !== false) {
    try {
      const result = await ensureProjectMember(workItem.projectId, assigneeId);
      memberAdded = result.added;
    } catch (err) {
      logger.warn('Failed to auto-add assignee as project member', {
        workItemId: workItem._id,
        assigneeId,
        error: err.message,
      });
    }
  }

  const [assignee, project] = await Promise.all([
    Employee.findById(assigneeId).select('name lastName email organizationId').lean(),
    Project.findById(workItem.projectId).select('name organizationId').lean(),
  ]);

  if (!assignee) {
    return { notified: false, memberAdded };
  }

  const orgId = organizationId || assignee.organizationId || project?.organizationId;
  const projName = projectName || project?.name || 'a project';
  const taskTitle = workItem.title || 'Untitled task';
  const assigneeName = `${assignee.name || ''} ${assignee.lastName || ''}`.trim() || 'Team member';
  const message = `You have been assigned to "${taskTitle}" on project "${projName}".`;
  const title = 'Task assigned';
  let inAppOk = false;
  let pushOk = false;
  let emailOk = false;

  try {
    await sendNotification({
      userId: assigneeId,
      title,
      message,
      type: 'task_assigned',
      priority: 'high',
      organizationId: orgId,
      metadata: {
        workItemId: workItem._id,
        projectId: workItem.projectId,
        projectName: projName,
        taskTitle,
        dueDate: workItem.dueDate,
        priority: workItem.priority,
        eventType: 'work_item_assigned',
      },
    });
    inAppOk = true;
  } catch (notifErr) {
    logger.warn('Work item assignment in-app notification failed', {
      assigneeId,
      workItemId: workItem._id,
      error: notifErr.message,
    });
  }

  if (orgId) {
    try {
      await notifyTaskAssigned(
        assigneeId,
        {
          _id: workItem._id,
          title: taskTitle,
          projectId: workItem.projectId,
          dueDate: workItem.dueDate,
          priority: workItem.priority,
        },
        orgId
      );
      pushOk = true;
    } catch (pushErr) {
      logger.warn('Work item assignment push failed', {
        assigneeId,
        workItemId: workItem._id,
        error: pushErr.message,
      });
    }
  }

  if (assignee.email) {
    const dueLine = workItem.dueDate
      ? `<p><strong>Due:</strong> ${new Date(workItem.dueDate).toLocaleDateString()}</p>`
      : '';
    const memberNote = memberAdded
      ? '<p>You have also been added as a member of this project so you can open it in your Projects list.</p>'
      : '';
    try {
      await sendNotificationEmail(
        assignee.email,
        `Assigned: ${taskTitle} (${projName})`,
        `${message} Open the EMS app → Projects → ${projName} → Work plan to view and update it.`,
        `
          <p>Hi ${assigneeName},</p>
          <p>${message}</p>
          <p><strong>Project:</strong> ${projName}</p>
          <p><strong>Task:</strong> ${taskTitle}</p>
          ${dueLine}
          ${memberNote}
          <p>Open EMS → <strong>Projects</strong> → <strong>${projName}</strong> → <strong>Work plan</strong> to view and update it.</p>
        `
      );
      emailOk = true;
    } catch (emailErr) {
      logger.warn('Work item assignment email failed', {
        assigneeId,
        email: assignee.email,
        error: emailErr.message,
      });
    }
  }

  return {
    notified: inAppOk || pushOk || emailOk,
    memberAdded,
  };
}

/**
 * After assigning work-plan task/subtask assignees:
 * - notify newly added assignees
 * - optionally auto-add each as project member
 *
 * @param {object} opts
 * @param {string[]|null} opts.previousAssigneeIds
 */
export async function handleWorkItemAssigneeChange({
  workItem,
  previousAssigneeId = null,
  previousAssigneeIds = null,
  organizationId,
  projectName = null,
  notify = true,
  addAsMember = true,
}) {
  const currentIds = getWorkItemAssigneeIds(workItem);
  if (!currentIds.length) {
    return { notified: false, memberAdded: false, notifiedCount: 0, membersAdded: 0 };
  }

  let previousIds = [];
  if (Array.isArray(previousAssigneeIds)) {
    previousIds = previousAssigneeIds.map(toIdString).filter(Boolean);
  } else if (previousAssigneeId) {
    const id = toIdString(previousAssigneeId);
    if (id) previousIds = [id];
  }

  const previousSet = new Set(previousIds);
  const newlyAssigned = currentIds.filter((id) => !previousSet.has(id));

  if (!newlyAssigned.length) {
    return { notified: false, memberAdded: false, notifiedCount: 0, membersAdded: 0 };
  }

  if (notify === false && addAsMember === false) {
    return { notified: false, memberAdded: false, notifiedCount: 0, membersAdded: 0 };
  }

  let notifiedCount = 0;
  let membersAdded = 0;

  for (const assigneeId of newlyAssigned) {
    try {
      if (notify === false) {
        if (addAsMember !== false) {
          const result = await ensureProjectMember(workItem.projectId, assigneeId);
          if (result.added) membersAdded += 1;
        }
        continue;
      }

      const result = await notifyOneAssignee({
        workItem,
        assigneeId,
        organizationId,
        projectName,
        addAsMember,
      });
      if (result.notified) notifiedCount += 1;
      if (result.memberAdded) membersAdded += 1;
    } catch (err) {
      logger.error('Failed notifying work item assignee', {
        workItemId: workItem._id,
        assigneeId,
        error: err.message,
      });
    }
  }

  logger.info('Work item assignees processed', {
    workItemId: workItem._id,
    newlyAssigned,
    notifiedCount,
    membersAdded,
  });

  return {
    notified: notifiedCount > 0,
    memberAdded: membersAdded > 0,
    notifiedCount,
    membersAdded,
  };
}
