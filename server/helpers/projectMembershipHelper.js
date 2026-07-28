/**
 * Project membership checks for work-plan comments / access.
 */

import { isProjectManager } from './projectManagerHelper.js';

export function toIdString(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  return value.toString();
}

/**
 * Prefer Employee profile id (projectLeader / members are Employee refs).
 * Falls back to linked employeeProfileId on User.
 */
export function getRequesterEmployeeId(req) {
  if (req?.employee?._id) return toIdString(req.employee._id);
  if (req?.user?.employeeProfileId) return toIdString(req.user.employeeProfileId);
  if (req?.decoded?.employeeProfileId) return toIdString(req.decoded.employeeProfileId);
  if (req?.authContext?.employee?._id) return toIdString(req.authContext.employee._id);
  return null;
}

/** True when employee is project leader or listed in projectMembers. */
export function isAssignedToProject(project, employeeId) {
  if (!project || !employeeId) return false;
  const eid = toIdString(employeeId);
  if (!eid) return false;

  const leaderId = toIdString(project.projectLeader);
  if (leaderId && leaderId === eid) return true;

  const members = Array.isArray(project.projectMembers) ? project.projectMembers : [];
  return members.some((member) => toIdString(member) === eid);
}

export function isProjectLeaderEmployee(project, employeeId) {
  if (!project || !employeeId) return false;
  return toIdString(project.projectLeader) === toIdString(employeeId);
}

/**
 * Can post daily updates / update status: project leader, org PM, or org owner.
 */
export function canPostProjectUpdates(project, req) {
  const employeeId = getRequesterEmployeeId(req);
  if (employeeId && isProjectLeaderEmployee(project, employeeId)) return true;

  const ctx = req?.authContext;
  if (ctx?.isOrgOwner || ctx?.isProjectManager) return true;
  if (req?.employee && isProjectManager(req.employee)) return true;

  return false;
}
