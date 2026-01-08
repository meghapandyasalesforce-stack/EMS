import mongoose from "mongoose";

const courseSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
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
    category: {
        type: String,
        enum: ['Technical', 'Soft Skills', 'Leadership', 'Compliance', 
               'Product Knowledge', 'Safety', 'Customer Service', 'Sales', 'Other'],
        required: true
    },
    level: {
        type: String,
        enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
        default: 'Beginner'
    },
    duration: {
        type: Number, // in hours
        required: true
    },
    instructor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    externalInstructor: {
        name: String,
        email: String,
        company: String
    },
    content: [{
        moduleTitle: String,
        moduleDescription: String,
        contentType: {
            type: String,
            enum: ['Video', 'Document', 'Quiz', 'Assignment', 'Link', 'Interactive']
        },
        contentUrl: String,
        duration: Number,
        order: Number,
        isRequired: {
            type: Boolean,
            default: true
        }
    }],
    prerequisites: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course'
    }],
    skills: [String],
    tags: [String],
    status: {
        type: String,
        enum: ['Draft', 'Published', 'Archived'],
        default: 'Draft'
    },
    enrollmentType: {
        type: String,
        enum: ['Open', 'Approval Required', 'Assigned Only'],
        default: 'Open'
    },
    maxEnrollments: Number,
    currentEnrollments: {
        type: Number,
        default: 0
    },
    startDate: Date,
    endDate: Date,
    certificate: {
        enabled: {
            type: Boolean,
            default: false
        },
        template: String,
        validityPeriod: Number // in months
    },
    passingScore: {
        type: Number,
        default: 70
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

const enrollmentSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true,
        index: true
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true
    },
    enrollmentDate: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['Enrolled', 'In Progress', 'Completed', 'Dropped', 'Failed'],
        default: 'Enrolled'
    },
    progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    completedModules: [{
        moduleId: mongoose.Schema.Types.ObjectId,
        completedDate: Date,
        score: Number
    }],
    startDate: Date,
    completionDate: Date,
    lastAccessedDate: Date,
    score: Number,
    finalGrade: String,
    certificate: {
        issued: {
            type: Boolean,
            default: false
        },
        certificateId: String,
        issuedDate: Date,
        expiryDate: Date,
        certificateUrl: String
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    notes: String
}, {
    timestamps: true
});

const learningPathSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true
    },
    description: String,
    courses: [{
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course'
        },
        order: Number,
        isRequired: {
            type: Boolean,
            default: true
        }
    }],
    targetRoles: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role'
    }],
    targetDepartments: [String],
    estimatedDuration: Number,
    status: {
        type: String,
        enum: ['Draft', 'Active', 'Archived'],
        default: 'Draft'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    }
}, {
    timestamps: true
});

const skillSchema = new mongoose.Schema({
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
    skillName: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['Technical', 'Soft Skills', 'Language', 'Certification', 'Other']
    },
    proficiencyLevel: {
        type: String,
        enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
        required: true
    },
    yearsOfExperience: Number,
    verified: {
        type: Boolean,
        default: false
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    verifiedAt: Date,
    certifications: [{
        name: String,
        issuer: String,
        issueDate: Date,
        expiryDate: Date,
        certificateUrl: String
    }],
    lastUsed: Date,
    notes: String
}, {
    timestamps: true
});

// Indexes
courseSchema.index({ organizationId: 1, status: 1 });
courseSchema.index({ organizationId: 1, category: 1 });
enrollmentSchema.index({ organizationId: 1, employeeId: 1, status: 1 });
enrollmentSchema.index({ organizationId: 1, courseId: 1 });
learningPathSchema.index({ organizationId: 1, status: 1 });
skillSchema.index({ organizationId: 1, employeeId: 1 });

export const Course = mongoose.model('Course', courseSchema);
export const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
export const LearningPath = mongoose.model('LearningPath', learningPathSchema);
export const Skill = mongoose.model('Skill', skillSchema);

