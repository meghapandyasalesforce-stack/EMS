import mongoose from "mongoose";

/**
 * Hierarchical work breakdown for a project (tasks / subtasks).
 * Separate from the "Task" collection used for daily employee work logs.
 */
const workItemCommentSchema = new mongoose.Schema(
    {
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
            required: true,
        },
        text: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000,
        },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

const dueDateHistorySchema = new mongoose.Schema(
    {
        previousDueDate: {
            type: Date,
            default: null,
        },
        newDueDate: {
            type: Date,
            default: null,
        },
        reason: {
            type: String,
            required: true,
            trim: true,
            maxlength: 500,
        },
        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
            required: true,
        },
        changedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: true }
);

const projectWorkItemSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Organization",
        required: true,
        index: true
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Project",
        required: true,
        index: true
    },
    parentTask: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProjectWorkItem",
        default: null,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    description: {
        type: String,
        trim: true,
        maxlength: 2000
    },
    /** @deprecated Prefer assignees — kept in sync as first assignee for older clients */
    assignee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        default: null
    },
    /** One or more employees assigned to this task / subtask */
    assignees: {
        type: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
        }],
        default: [],
    },
    status: {
        type: String,
        enum: ["todo", "in-progress", "completed", "on-hold"],
        default: "todo"
    },
    priority: {
        type: String,
        enum: ["low", "medium", "high", "critical"],
        default: "medium"
    },
    dueDate: {
        type: Date
    },
    /** Audit log when due date is changed (reason required). */
    dueDateHistory: {
        type: [dueDateHistorySchema],
        default: [],
    },
    sortOrder: {
        type: Number,
        default: 0
    },
    /** Shared discussion for project members (tasks and subtasks). */
    comments: {
        type: [workItemCommentSchema],
        default: [],
    },
}, { timestamps: true });

projectWorkItemSchema.index({ projectId: 1, parentTask: 1, sortOrder: 1 });
projectWorkItemSchema.index({ projectId: 1, assignees: 1 });

/** Normalize assignees from assignees[] and legacy assignee before validate/save */
projectWorkItemSchema.pre("validate", function syncAssignees(next) {
    const ids = [];
    const seen = new Set();
    const push = (val) => {
        if (!val) return;
        const id = val._id ? val._id.toString() : val.toString();
        if (!id || seen.has(id)) return;
        seen.add(id);
        ids.push(val._id || val);
    };

    if (Array.isArray(this.assignees) && this.assignees.length) {
        this.assignees.forEach(push);
    } else if (this.assignee) {
        push(this.assignee);
    }

    this.assignees = ids;
    this.assignee = ids.length ? ids[0] : undefined;
    next();
});

const ProjectWorkItem = mongoose.model(
    "ProjectWorkItem",
    projectWorkItemSchema,
    "project_work_items"
);

export default ProjectWorkItem;
