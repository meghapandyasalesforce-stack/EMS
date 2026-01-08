import mongoose from "mongoose";

const projectSchema = new mongoose.Schema({
    // Organization reference (multi-tenancy)
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    name: { 
        type: String, 
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    projectLeader: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Employee", 
        required: true 
    },
    projectMembers: [{  
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee"
    }],
    status: { 
        type: String, 
        required: true,
        enum: ['pending', 'in-progress', 'completed', 'on-hold'],
        default: 'pending'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    startDate: {
        type: Date
    },
    endDate: {
        type: Date,
        validate: {
            validator: function(value) {
                if (!this.startDate || !value) return true;
                return value >= this.startDate;
            },
            message: 'End date must be after start date'
        }
    },
    // Cost tracking fields (CEO only visibility)
    budget: {
        type: Number,
        min: 0,
        default: 0
    },
    actualCost: {
        type: Number,
        min: 0,
        default: 0
    },
    revenue: {
        type: Number,
        default: 0
    },
    currency: {
        type: String,
        default: 'USD',
        enum: ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD']
    },
    // Project tags/categories
    tags: [{
        type: String,
        trim: true
    }],
    category: {
        type: String,
        trim: true
    }
}, { timestamps: true });

const Project = mongoose.model("Project", projectSchema, "projects");

export default Project;