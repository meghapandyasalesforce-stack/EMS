import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema({
    // Organization reference (multi-tenancy)
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true
    },
    expenseDate: {
        type: Date,
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: [
            'Travel', 'Meals', 'Accommodation', 'Transport', 
            'Office Supplies', 'Communication', 'Training', 
            'Medical', 'Entertainment', 'Other'
        ]
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: 'USD'
    },
    description: {
        type: String,
        required: true,
        maxlength: 500
    },
    receipt: {
        url: { type: String },
        filename: { type: String },
        uploadedAt: { type: Date }
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Paid'],
        default: 'Pending'
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: {
        type: Date
    },
    rejectionReason: {
        type: String,
        maxlength: 500
    },
    paymentDate: {
        type: Date
    },
    paymentMethod: {
        type: String,
        enum: ['Bank Transfer', 'Cash', 'Check', 'Other']
    },
    paymentReference: {
        type: String
    },
    tags: [{
        type: String
    }],
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project'
    },
    notes: {
        type: String,
        maxlength: 1000
    }
}, {
    timestamps: true
});

// Indexes for better query performance
expenseSchema.index({ employeeId: 1, expenseDate: -1 });
expenseSchema.index({ status: 1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ organizationId: 1, status: 1 });
expenseSchema.index({ expenseDate: 1 });

const Expense = mongoose.model("Expense", expenseSchema, "expenses");
export default Expense;

