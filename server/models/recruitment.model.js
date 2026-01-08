import mongoose from "mongoose";

const recruitmentSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    jobTitle: {
        type: String,
        required: true,
        trim: true
    },
    department: {
        type: String,
        required: true
    },
    position: {
        type: String,
        required: true
    },
    jobDescription: {
        type: String,
        required: true
    },
    requirements: [{
        type: String
    }],
    responsibilities: [{
        type: String
    }],
    location: {
        type: String,
        required: true
    },
    employmentType: {
        type: String,
        enum: ['Full-time', 'Part-time', 'Contract', 'Internship', 'Temporary'],
        required: true
    },
    salaryRange: {
        min: Number,
        max: Number,
        currency: {
            type: String,
            default: 'USD'
        }
    },
    status: {
        type: String,
        enum: ['Draft', 'Open', 'Closed', 'On Hold', 'Cancelled'],
        default: 'Draft'
    },
    postedDate: {
        type: Date,
        default: Date.now
    },
    closingDate: {
        type: Date
    },
    hiringManager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    recruiter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    numberOfPositions: {
        type: Number,
        default: 1
    },
    filledPositions: {
        type: Number,
        default: 0
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium'
    },
    tags: [String],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

const candidateSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    jobPostingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Recruitment',
        required: true,
        index: true
    },
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String
    },
    resume: {
        url: String,
        fileName: String,
        uploadedAt: Date
    },
    coverLetter: {
        type: String
    },
    status: {
        type: String,
        enum: ['Applied', 'Screening', 'Phone Interview', 'Technical Interview', 
               'Final Interview', 'Offer Extended', 'Offer Accepted', 'Offer Declined', 
               'Rejected', 'Withdrawn', 'On Hold'],
        default: 'Applied'
    },
    stage: {
        type: String,
        enum: ['Application', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'],
        default: 'Application'
    },
    source: {
        type: String,
        enum: ['Job Board', 'Company Website', 'Referral', 'LinkedIn', 'Indeed', 
               'Glassdoor', 'Recruitment Agency', 'Social Media', 'Other'],
        default: 'Company Website'
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    applicationDate: {
        type: Date,
        default: Date.now
    },
    interviewSchedule: [{
        interviewType: {
            type: String,
            enum: ['Phone', 'Video', 'On-site', 'Technical', 'Panel', 'Final']
        },
        scheduledDate: Date,
        scheduledTime: String,
        interviewer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        location: String,
        meetingLink: String,
        status: {
            type: String,
            enum: ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled'],
            default: 'Scheduled'
        },
        feedback: {
            rating: Number,
            comments: String,
            strengths: [String],
            weaknesses: [String],
            recommendation: {
                type: String,
                enum: ['Strong Hire', 'Hire', 'Maybe', 'No Hire']
            }
        }
    }],
    scores: {
        resumeScore: Number,
        technicalScore: Number,
        culturalFitScore: Number,
        overallScore: Number
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
    }],
    offerDetails: {
        position: String,
        startDate: Date,
        salary: Number,
        benefits: [String],
        offerLetter: {
            url: String,
            sentDate: Date,
            expiryDate: Date
        },
        status: {
            type: String,
            enum: ['Draft', 'Sent', 'Accepted', 'Declined', 'Expired']
        }
    },
    backgroundCheck: {
        status: {
            type: String,
            enum: ['Not Started', 'In Progress', 'Completed', 'Failed']
        },
        completedDate: Date,
        report: String
    },
    tags: [String],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Indexes
recruitmentSchema.index({ organizationId: 1, status: 1 });
recruitmentSchema.index({ organizationId: 1, department: 1 });
candidateSchema.index({ organizationId: 1, jobPostingId: 1, status: 1 });
candidateSchema.index({ organizationId: 1, email: 1 });

export const Recruitment = mongoose.model('Recruitment', recruitmentSchema);
export const Candidate = mongoose.model('Candidate', candidateSchema);

