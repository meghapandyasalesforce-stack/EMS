import mongoose from "mongoose";

const companyPolicySchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    policyType: {
        type: String,
        required: true,
        enum: [
            'leave', 'attendance', 'payroll', 'work_hours', 
            'dress_code', 'code_of_conduct', 'data_security',
            'remote_work', 'overtime', 'expense', 'travel',
            'performance', 'disciplinary', 'benefits', 'custom'
        ]
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    content: {
        type: String, // Full policy document/HTML
        required: true
    },
    rules: [{
        ruleName: String,
        ruleDescription: String,
        ruleValue: mongoose.Schema.Types.Mixed, // Can be string, number, boolean, object
        applicableTo: {
            type: String,
            enum: ['all', 'department', 'role', 'employee'],
            default: 'all'
        },
        applicableValues: [String], // Department names, role names, or employee IDs
        enforcement: {
            type: String,
            enum: ['mandatory', 'recommended', 'optional'],
            default: 'mandatory'
        }
    }],
    effectiveDate: {
        type: Date,
        default: Date.now
    },
    expiryDate: Date,
    isActive: {
        type: Boolean,
        default: true
    },
    requiresAcknowledgment: {
        type: Boolean,
        default: false
    },
    applicableRoles: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role'
    }],
    applicableDepartments: [String],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    version: {
        type: Number,
        default: 1
    },
    previousVersions: [{
        version: Number,
        content: String,
        effectiveDate: Date,
        modifiedBy: mongoose.Schema.Types.ObjectId,
        modifiedAt: Date
    }]
}, { timestamps: true });

// Indexes
companyPolicySchema.index({ organizationId: 1, policyType: 1 });
companyPolicySchema.index({ organizationId: 1, isActive: 1 });
companyPolicySchema.index({ effectiveDate: 1, expiryDate: 1 });

const CompanyPolicy = mongoose.model("CompanyPolicy", companyPolicySchema, "companypolicies");
export default CompanyPolicy;

