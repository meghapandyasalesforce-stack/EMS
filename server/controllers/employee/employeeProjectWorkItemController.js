import mongoose from "mongoose";
import Project from "../../models/project.model.js";
import ProjectWorkItem from "../../models/projectWorkItem.model.js";
import { addOrganizationFilter, getOrganizationId } from "../../helpers/organizationHelper.js";
import { sendSuccess, sendError, sendForbidden, sendInternalError } from "../../helpers/responseHelper.js";
import {
    annotateFlatWithCanEdit,
    annotateTreeWithCanEdit,
    buildAssigneeAncestorMap,
    canEmployeeEditWorkItem,
    computeWorkPlanProgress
} from "../../helpers/projectWorkItemPermissionHelper.js";
import logger from "../../helpers/logger.js";
import { isProjectManager } from "../../helpers/projectManagerHelper.js";

function buildTree(flat) {
    const byParent = new Map();
    for (const item of flat) {
        const key = item.parentTask ? item.parentTask.toString() : "root";
        if (!byParent.has(key)) byParent.set(key, []);
        byParent.get(key).push(item);
    }
    const attach = (parentKey) =>
        (byParent.get(parentKey) || []).map((item) => ({
            ...item,
            subtasks: attach(item._id.toString())
        }));
    return attach("root").map((n) => ({
        ...n,
        subtasks: n.subtasks || []
    }));
}

async function getProjectForMember(req, projectId) {
    const employeeId = req.employee?._id;
    if (!employeeId) return null;

    const query = addOrganizationFilter(req, { _id: projectId });
    if (!isProjectManager(req.employee)) {
        query.$or = [{ projectLeader: employeeId }, { projectMembers: employeeId }];
    }

    return Project.findOne(query).select("_id name status organizationId").lean();
}

/** GET /both/project-task/projects/:projectId/work-items */
export const getEmployeeProjectWorkItems = async (req, res) => {
    try {
        const { projectId } = req.params;
        const employeeId = req.employee?._id;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return sendError(res, "Invalid project id", 400);
        }

        const project = await getProjectForMember(req, projectId);
        if (!project) {
            return sendForbidden(res, "You are not a member of this project");
        }

        const filter = addOrganizationFilter(req, { projectId });
        const flat = await ProjectWorkItem.find(filter)
            .sort({ sortOrder: 1, createdAt: 1 })
            .populate("assignee", "name lastName email employeeId")
            .lean();

        const flatAnnotated = annotateFlatWithCanEdit(flat, employeeId);
        const tree = annotateTreeWithCanEdit(buildTree(flat), flatAnnotated);
        const progress = computeWorkPlanProgress(flat);

        const editableCount = flatAnnotated.filter((i) => i.canEdit).length;

        return sendSuccess(
            res,
            {
                workItems: tree,
                flat: flatAnnotated,
                progress,
                editableCount
            },
            "Work plan retrieved"
        );
    } catch (error) {
        logger.error("getEmployeeProjectWorkItems", { error: error.message, stack: error.stack });
        return sendInternalError(res, "Failed to fetch work plan", error);
    }
};

/** PUT /both/project-task/work-items/:workItemId — employees: status + description only */
export const updateEmployeeProjectWorkItem = async (req, res) => {
    try {
        const { workItemId } = req.params;
        const employeeId = req.employee?._id;

        if (!mongoose.Types.ObjectId.isValid(workItemId)) {
            return sendError(res, "Invalid work item id", 400);
        }

        const filter = addOrganizationFilter(req, { _id: workItemId });
        const item = await ProjectWorkItem.findOne(filter);
        if (!item) {
            return sendError(res, "Work item not found", 404);
        }

        const project = await getProjectForMember(req, item.projectId.toString());
        if (!project) {
            return sendForbidden(res, "You do not have access to this project");
        }

        const orgFilter = addOrganizationFilter(req, { projectId: item.projectId });
        const allFlat = await ProjectWorkItem.find(orgFilter).select("_id parentTask assignee").lean();
        const { ancestorAssignees } = buildAssigneeAncestorMap(allFlat);

        if (!canEmployeeEditWorkItem(item, employeeId, ancestorAssignees)) {
            return sendForbidden(
                res,
                "You can only update tasks assigned to you, or subtasks under a task assigned to you"
            );
        }

        const { status, description } = req.body;
        const disallowed = ["title", "assignee", "dueDate", "priority", "parentTask", "sortOrder"].filter(
            (k) => req.body[k] !== undefined
        );
        if (disallowed.length) {
            return sendError(res, `Employees cannot modify: ${disallowed.join(", ")}`, 403);
        }

        if (status !== undefined) {
            const valid = ["todo", "in-progress", "completed", "on-hold"];
            if (!valid.includes(status)) {
                return sendError(res, "Invalid status", 400);
            }
            item.status = status;
        }

        if (description !== undefined) {
            item.description = description
                ? String(description).trim().slice(0, 2000)
                : undefined;
        }

        if (status === undefined && description === undefined) {
            return sendError(res, "No allowed fields to update (status or description)", 400);
        }

        await item.save();

        const populated = await ProjectWorkItem.findById(item._id)
            .populate("assignee", "name lastName email employeeId")
            .lean();

        const flatAnnotated = annotateFlatWithCanEdit(
            await ProjectWorkItem.find(orgFilter)
                .sort({ sortOrder: 1, createdAt: 1 })
                .populate("assignee", "name lastName email employeeId")
                .lean(),
            employeeId
        );
        const updated = flatAnnotated.find((i) => i._id.toString() === workItemId);
        const withFlag = { ...populated, canEdit: updated?.canEdit ?? true };

        return sendSuccess(res, { workItem: withFlag }, "Work item updated");
    } catch (error) {
        logger.error("updateEmployeeProjectWorkItem", { error: error.message, stack: error.stack });
        return sendInternalError(res, "Failed to update work item", error);
    }
};
