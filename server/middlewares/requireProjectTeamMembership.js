import mongoose from 'mongoose';
import Project from '../models/project.model.js';
import { getOrganizationId } from '../helpers/organizationHelper.js';
import { canPostProjectUpdates } from '../helpers/projectMembershipHelper.js';
import { sendError, sendForbidden, sendInternalError } from '../helpers/responseHelper.js';

// Employee routes expose only the projects the employee participates in.
export default async function requireProjectTeamMembership(req, res, next) {
  try {
    const id = req.params.id || req.params.projectId;
    const organizationId = getOrganizationId(req);
    if (!organizationId || !mongoose.Types.ObjectId.isValid(id)) return sendError(res, 'Invalid project or organization', 400);
    const project = await Project.findOne({ _id: id, organizationId });
    if (!project || !canPostProjectUpdates(project, req)) return sendForbidden(res, 'You are not a member of this project');
    next();
  } catch (error) {
    return sendInternalError(res, 'Failed to check project membership', error);
  }
}
