import mongoose from "mongoose";

const onboardingTaskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: String,
    category: {
        type: String,
        enum: ['Documentation', 'IT Setup', 'HR Paperwork', 'Training', 
               'Orientation', 'Equipment', 'Access', 'Other'],
        required: true
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    dueDate: Date,
    completedDate: Date,
    status: {
        type: String,
        enum: ['Pending', 'In Progress', 'Completed', 'Overdue'],
        default: 'Pending'
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium'
    },
    attachments: [{
        name: String,
        url: String,
        uploadedAt: Date
    }],
    notes: String
}, { _id: true });

const onboardingWorkflowSchema = new mongoose.Schema({
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
    startDate: {
        type: Date,
        default: Date.now
    },
    expectedCompletionDate: Date,
    actualCompletionDate: Date,
    status: {
        type: String,
        enum: ['Not Started', 'In Progress', 'Completed', 'On Hold', 'Cancelled'],
        default: 'Not Started'
    },
    tasks: [onboardingTaskSchema],
    documents: [{
        documentType: {
            type: String,
            enum: ['Contract', 'NDA', 'Tax Forms', 'ID Proof', 'Address Proof', 
                   'Education Certificates', 'Previous Employment', 'Bank Details', 'Other']
        },
        name: String,
        url: String,
        uploadedAt: Date,
        status: {
            type: String,
            enum: ['Pending', 'Uploaded', 'Verified', 'Rejected'],
            default: 'Pending'
        },
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        verifiedAt: Date
    }],
    checklist: [{
        item: String,
        category: String,
        completed: {
            type: Boolean,
            default: false
        },
        completedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        completedAt: Date
    }],
    welcomeMessage: String,
    assignedHR: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    assignedBuddy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    notes: [{
        note: String,
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

const offboardingWorkflowSchema = new mongoose.Schema({
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
    lastWorkingDate: {
        type: Date,
        required: true
    },
    resignationDate: Date,
    reason: {
        type: String,
        enum: ['Resignation', 'Termination', 'Retirement', 'Contract End', 'Other']
    },
    reasonDetails: String,
    status: {
        type: String,
        enum: ['Initiated', 'In Progress', 'Completed', 'On Hold'],
        default: 'Initiated'
    },
    tasks: [{
        title: String,
        description: String,
        category: {
            type: String,
            enum: ['IT', 'HR', 'Finance', 'Access', 'Equipment', 'Knowledge Transfer', 'Other']
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        dueDate: Date,
        completedDate: Date,
        status: {
            type: String,
            enum: ['Pending', 'In Progress', 'Completed', 'Overdue'],
            default: 'Pending'
        }
    }],
    exitInterview: {
        scheduledDate: Date,
        conductedDate: Date,
        conductedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        questions: [{
            question: String,
            answer: String
        }],
        feedback: String,
        rating: Number
    },
    assets: [{
        assetType: String,
        assetName: String,
        assetId: String,
        returnDate: Date,
        returned: {
            type: Boolean,
            default: false
        },
        condition: String
    }],
    accessRevocation: [{
        system: String,
        accessType: String,
        revokedDate: Date,
        revokedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        }
    }],
    knowledgeTransfer: [{
        topic: String,
        transferredTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        transferDate: Date,
        documents: [String],
        status: {
            type: String,
            enum: ['Pending', 'In Progress', 'Completed'],
            default: 'Pending'
        }
    }],
    finalSettlement: {
        lastSalaryDate: Date,
        pendingDues: Number,
        deductions: Number,
        finalAmount: Number,
        paidDate: Date,
        status: {
            type: String,
            enum: ['Pending', 'Calculated', 'Paid'],
            default: 'Pending'
        }
    },
    documents: [{
        documentType: String,
        name: String,
        url: String,
        uploadedAt: Date
    }],
    progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    initiatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    }
}, {
    timestamps: true
});

// Indexes
onboardingWorkflowSchema.index({ organizationId: 1, employeeId: 1 });
onboardingWorkflowSchema.index({ organizationId: 1, status: 1 });
offboardingWorkflowSchema.index({ organizationId: 1, employeeId: 1 });
offboardingWorkflowSchema.index({ organizationId: 1, status: 1 });

export const OnboardingWorkflow = mongoose.model('OnboardingWorkflow', onboardingWorkflowSchema);
export const OffboardingWorkflow = mongoose.model('OffboardingWorkflow', offboardingWorkflowSchema);

