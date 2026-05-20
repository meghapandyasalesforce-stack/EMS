import mongoose from "mongoose";
import Project from "../../models/project.model.js";
import ProjectWorkItem from "../../models/projectWorkItem.model.js";
import Employee from "../../models/employee.model.js";
import { addOrganizationFilter, getOrganizationId } from "../../helpers/organizationHelper.js";
import logger from "../../helpers/logger.js";

const MAX_ITEMS_PER_REQUEST = 80;
const MAX_TITLE_LEN = 500;

async function findProjectInOrg(req, projectId) {
    const query = addOrganizationFilter(req, { _id: projectId });
    return Project.findOne(query).select("_id organizationId").lean();
}

async function validateAssignee(req, assigneeId) {
    if (!assigneeId) return { ok: true };
    const organizationId = getOrganizationId(req);
    const emp = await Employee.findOne({
        _id: assigneeId,
        ...(organizationId ? { organizationId } : {}),
        $or: [{ status: "active" }, { active: true }]
    }).select("_id").lean();
    return emp ? { ok: true } : { ok: false, error: "Assignee not found or inactive in this organization" };
}

function countWorkItemNodes(items, depth = 0) {
    if (!Array.isArray(items) || depth > 10) return 0;
    let n = 0;
    for (const it of items) {
        if (!it || typeof it !== "object") continue;
        n += 1;
        if (Array.isArray(it.subtasks) && it.subtasks.length) {
            n += countWorkItemNodes(it.subtasks, depth + 1);
        }
    }
    return n;
}

async function insertWorkItemTree(req, projectId, organizationId, items, parentId = null, sortBase = 0) {
    if (!Array.isArray(items)) return;

    let idx = 0;
    for (const raw of items) {
        if (!raw || typeof raw !== "object") continue;
        const title = typeof raw.title === "string" ? raw.title.trim() : "";
        if (!title) continue;

        const assigneeCheck = await validateAssignee(req, raw.assignee);
        if (!assigneeCheck.ok) {
            throw new Error(assigneeCheck.error);
        }

        let resolvedParent = parentId;
        if (!resolvedParent && raw.parentTask) {
            if (!mongoose.Types.ObjectId.isValid(raw.parentTask)) {
                throw new Error("Invalid parent work item id");
            }
            const parentDoc = await ProjectWorkItem.findOne(
                addOrganizationFilter(req, { _id: raw.parentTask, projectId })
            ).select("_id").lean();
            if (!parentDoc) {
                throw new Error("Parent work item not found");
            }
            resolvedParent = parentDoc._id;
        }

        const doc = await ProjectWorkItem.create({
            organizationId,
            projectId,
            parentTask: resolvedParent,
            title: title.slice(0, MAX_TITLE_LEN),
            description: typeof raw.description === "string" ? raw.description.trim().slice(0, 2000) : undefined,
            assignee: raw.assignee || undefined,
            dueDate: raw.dueDate ? new Date(raw.dueDate) : undefined,
            priority: ["low", "medium", "high", "critical"].includes(raw.priority) ? raw.priority : "medium",
            status: ["todo", "in-progress", "completed", "on-hold"].includes(raw.status) ? raw.status : "todo",
            sortOrder: sortBase + idx
        });
        idx += 1;

        if (raw.subtasks?.length) {
            await insertWorkItemTree(req, projectId, organizationId, raw.subtasks, doc._id, 0);
        }
    }
}

export async function createWorkItemsForProject(req, projectId, organizationId, workItems) {
    if (!workItems?.length) return;
    const total = countWorkItemNodes(workItems);
    if (total > MAX_ITEMS_PER_REQUEST) {
        throw new Error(`Too many work items in one request (max ${MAX_ITEMS_PER_REQUEST})`);
    }
    await insertWorkItemTree(req, projectId, organizationId, workItems, null, 0);
}

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

/** GET /admin/project/:id/work-items */
export const getProjectWorkItems = async (req, res) => {
    try {
        const { id: projectId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({ success: false, error: "Invalid project id" });
        }

        const project = await findProjectInOrg(req, projectId);
        if (!project) {
            return res.status(404).json({ success: false, error: "Project not found" });
        }

        const organizationId = getOrganizationId(req);
        const filter = addOrganizationFilter(req, { projectId });
        const flat = await ProjectWorkItem.find(filter)
            .sort({ sortOrder: 1, createdAt: 1 })
            .populate("assignee", "name lastName email employeeId")
            .lean();

        const tree = buildTree(flat);

        res.json({
            success: true,
            workItems: tree,
            flat
        });
    } catch (error) {
        logger.error("getProjectWorkItems", { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            error: "Failed to fetch project work items",
            details: error.message
        });
    }
};

/** POST /admin/project/:id/work-items — body: { items: [...] } or single item fields */
export const postProjectWorkItems = async (req, res) => {
    try {
        const { id: projectId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({ success: false, error: "Invalid project id" });
        }

        const project = await findProjectInOrg(req, projectId);
        if (!project) {
            return res.status(404).json({ success: false, error: "Project not found" });
        }

        const organizationId = project.organizationId || getOrganizationId(req);
        let payload = req.body.items || req.body.workItems;
        if (!payload) {
            const { title, description, assignee, dueDate, priority, status, parentTask, subtasks } = req.body;
            if (title) {
                payload = [{ title, description, assignee, dueDate, priority, status, parentTask, subtasks }];
            }
        }
        if (!payload?.length) {
            return res.status(400).json({ success: false, error: "No work items provided" });
        }

        await createWorkItemsForProject(req, projectId, organizationId, payload);

        const filter = addOrganizationFilter(req, { projectId });
        const flat = await ProjectWorkItem.find(filter)
            .sort({ sortOrder: 1, createdAt: 1 })
            .populate("assignee", "name lastName email employeeId")
            .lean();
        const tree = buildTree(flat);

        res.status(201).json({
            success: true,
            message: "Work items created",
            workItems: tree
        });
    } catch (error) {
        logger.error("postProjectWorkItems", { error: error.message, stack: error.stack });
        res.status(400).json({
            success: false,
            error: error.message || "Failed to create work items"
        });
    }
};

async function getWorkItemInOrg(req, workItemId) {
    const filter = addOrganizationFilter(req, { _id: workItemId });
    return ProjectWorkItem.findOne(filter);
}

/** PUT /admin/project/work-items/:workItemId */
export const updateProjectWorkItem = async (req, res) => {
    try {
        const { workItemId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(workItemId)) {
            return res.status(400).json({ success: false, error: "Invalid work item id" });
        }

        const item = await getWorkItemInOrg(req, workItemId);
        if (!item) {
            return res.status(404).json({ success: false, error: "Work item not found" });
        }

        const project = await findProjectInOrg(req, item.projectId.toString());
        if (!project) {
            return res.status(404).json({ success: false, error: "Project not found" });
        }

        const {
            title,
            description,
            assignee,
            dueDate,
            priority,
            status,
            sortOrder
        } = req.body;

        if (title !== undefined) {
            const t = String(title).trim();
            if (!t) return res.status(400).json({ success: false, error: "Title cannot be empty" });
            item.title = t.slice(0, MAX_TITLE_LEN);
        }
        if (description !== undefined) {
            item.description = description ? String(description).trim().slice(0, 2000) : undefined;
        }
        if (assignee !== undefined) {
            if (assignee === null || assignee === "") {
                item.assignee = undefined;
            } else {
                const assigneeCheck = await validateAssignee(req, assignee);
                if (!assigneeCheck.ok) {
                    return res.status(400).json({ success: false, error: assigneeCheck.error });
                }
                item.assignee = assignee;
            }
        }
        if (dueDate !== undefined) {
            item.dueDate = dueDate ? new Date(dueDate) : undefined;
        }
        if (priority !== undefined && ["low", "medium", "high", "critical"].includes(priority)) {
            item.priority = priority;
        }
        if (status !== undefined && ["todo", "in-progress", "completed", "on-hold"].includes(status)) {
            item.status = status;
        }
        if (sortOrder !== undefined && Number.isFinite(Number(sortOrder))) {
            item.sortOrder = Number(sortOrder);
        }

        await item.save();

        const populated = await ProjectWorkItem.findById(item._id)
            .populate("assignee", "name lastName email employeeId")
            .lean();

        res.json({
            success: true,
            message: "Work item updated",
            workItem: populated
        });
    } catch (error) {
        logger.error("updateProjectWorkItem", { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            error: "Failed to update work item",
            details: error.message
        });
    }
};

async function deleteDescendants(req, projectId, parentWorkItemId) {
    const filter = addOrganizationFilter(req, {
        projectId,
        parentTask: parentWorkItemId
    });
    const children = await ProjectWorkItem.find(filter).select("_id").lean();

    for (const ch of children) {
        await deleteDescendants(req, projectId, ch._id);
        await ProjectWorkItem.deleteOne(addOrganizationFilter(req, { _id: ch._id, projectId }));
    }
}

/** DELETE /admin/project/work-items/:workItemId */
export const deleteProjectWorkItem = async (req, res) => {
    try {
        const { workItemId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(workItemId)) {
            return res.status(400).json({ success: false, error: "Invalid work item id" });
        }

        const item = await getWorkItemInOrg(req, workItemId);
        if (!item) {
            return res.status(404).json({ success: false, error: "Work item not found" });
        }

        const projectId = item.projectId;
        await deleteDescendants(req, projectId, item._id);
        await ProjectWorkItem.deleteOne(addOrganizationFilter(req, { _id: item._id, projectId }));

        res.json({
            success: true,
            message: "Work item deleted"
        });
    } catch (error) {
        logger.error("deleteProjectWorkItem", { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            error: "Failed to delete work item",
            details: error.message
        });
    }
};
