import mongoose from "mongoose";

/**
 * Hierarchical work breakdown for a project (tasks / subtasks).
 * Separate from the "Task" collection used for daily employee work logs.
 */
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
    assignee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        default: null
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
    sortOrder: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

projectWorkItemSchema.index({ projectId: 1, parentTask: 1, sortOrder: 1 });

const ProjectWorkItem = mongoose.model(
    "ProjectWorkItem",
    projectWorkItemSchema,
    "project_work_items"
);

export default ProjectWorkItem;
