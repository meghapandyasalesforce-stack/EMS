import mongoose from "mongoose";

const policyAcknowledgmentSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    policyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CompanyPolicy',
        required: true
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    acknowledgedAt: {
        type: Date,
        default: Date.now
    },
    acknowledged: {
        type: Boolean,
        default: false
    },
    ipAddress: String,
    userAgent: String
}, { timestamps: true });

// Compound index
policyAcknowledgmentSchema.index({ organizationId: 1, employeeId: 1, policyId: 1 }, { unique: true });

const PolicyAcknowledgment = mongoose.model("PolicyAcknowledgment", policyAcknowledgmentSchema, "policyacknowledgments");
export default PolicyAcknowledgment;

