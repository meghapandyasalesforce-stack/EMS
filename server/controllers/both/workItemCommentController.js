import mongoose from "mongoose";
import Project from "../../models/project.model.js";
import ProjectWorkItem from "../../models/projectWorkItem.model.js";
import { addOrganizationFilter, getOrganizationId } from "../../helpers/organizationHelper.js";
import { isAssignedToProject } from "../../helpers/projectMembershipHelper.js";
import { isProjectManager } from "../../helpers/projectManagerHelper.js";
import { sendSuccess, sendError, sendForbidden, sendInternalError } from "../../helpers/responseHelper.js";
import logger from "../../helpers/logger.js";

const MAX_COMMENT_LEN = 2000;
const AUTHOR_SELECT = "name lastName email employeeId";

async function loadProjectForCommentAccess(req, projectId) {
  const employeeId = req.employee?._id;
  if (!employeeId) return { project: null, canComment: false };

  const query = addOrganizationFilter(req, { _id: projectId });
  const project = await Project.findOne(query)
    .select("_id organizationId projectLeader projectMembers")
    .lean();

  if (!project) return { project: null, canComment: false };

  const assigned = isAssignedToProject(project, employeeId);
  // Org project managers / admins with workspace access can also comment when managing
  const workspaceElevated =
    Boolean(req.authContext?.isOrgOwner) ||
    Boolean(req.authContext?.isProjectManager) ||
    Boolean(req.authContext?.isHrManager) ||
    isProjectManager(req.employee);

  return {
    project,
    canComment: assigned || workspaceElevated,
  };
}

async function populateWorkItemComments(workItemId) {
  return ProjectWorkItem.findById(workItemId)
    .populate("assignee", AUTHOR_SELECT)
    .populate("assignees", AUTHOR_SELECT)
    .populate("comments.author", AUTHOR_SELECT)
    .populate("dueDateHistory.changedBy", AUTHOR_SELECT)
    .lean();
}

/**
 * Shared add-comment handler used by admin and employee routes.
 * POST body: { text }
 */
export const addWorkItemComment = async (req, res) => {
  try {
    const { workItemId } = req.params;
    const employeeId = req.employee?._id;
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";

    if (!employeeId) {
      return sendForbidden(res, "Employee profile required to comment");
    }
    if (!mongoose.Types.ObjectId.isValid(workItemId)) {
      return sendError(res, "Invalid work item id", 400);
    }
    if (!text) {
      return sendError(res, "Comment text is required", 400);
    }
    if (text.length > MAX_COMMENT_LEN) {
      return sendError(res, `Comment must be at most ${MAX_COMMENT_LEN} characters`, 400);
    }

    const filter = addOrganizationFilter(req, { _id: workItemId });
    const item = await ProjectWorkItem.findOne(filter);
    if (!item) {
      return sendError(res, "Work item not found", 404);
    }

    const { project, canComment } = await loadProjectForCommentAccess(req, item.projectId);
    if (!project) {
      return sendError(res, "Project not found", 404);
    }
    if (!canComment) {
      return sendForbidden(
        res,
        "Only project members (or project managers) can comment on tasks"
      );
    }

    item.comments.push({
      author: employeeId,
      text: text.slice(0, MAX_COMMENT_LEN),
    });
    await item.save();

    const populated = await populateWorkItemComments(item._id);
    const newest = populated?.comments?.[populated.comments.length - 1] || null;

    return sendSuccess(
      res,
      { comment: newest, workItem: populated },
      "Comment added",
      201
    );
  } catch (error) {
    logger.error("addWorkItemComment", { error: error.message, stack: error.stack });
    return sendInternalError(res, "Failed to add comment", error);
  }
};

export { AUTHOR_SELECT };
