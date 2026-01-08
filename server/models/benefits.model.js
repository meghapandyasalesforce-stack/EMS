import mongoose from "mongoose";

const benefitPlanSchema = new mongoose.Schema({
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
    category: {
        type: String,
        enum: ['Health Insurance', 'Dental', 'Vision', 'Life Insurance', 
               'Retirement', 'Wellness', 'Education', 'Transportation', 'Other'],
        required: true
    },
    description: String,
    provider: String,
    planType: {
        type: String,
        enum: ['Individual', 'Family', 'Both'],
        default: 'Both'
    },
    coverage: {
        type: String,
        enum: ['Full', 'Partial', 'Employee Contribution'],
        required: true
    },
    employeeContribution: {
        amount: Number,
        percentage: Number,
        frequency: {
            type: String,
            enum: ['Monthly', 'Annual', 'One-time']
        }
    },
    companyContribution: {
        amount: Number,
        percentage: Number
    },
    eligibility: {
        employmentType: [{
            type: String,
            enum: ['Full-time', 'Part-time', 'Contract']
        }],
        tenure: {
            type: Number, // months
            default: 0
        },
        departments: [String],
        roles: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Role'
        }]
    },
    enrollmentPeriod: {
        startDate: Date,
        endDate: Date,
        isOpen: {
            type: Boolean,
            default: false
        }
    },
    effectiveDate: Date,
    expiryDate: Date,
    documents: [{
        name: String,
        url: String
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    }
}, {
    timestamps: true
});

const employeeBenefitSchema = new mongoose.Schema({
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
    benefitPlanId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BenefitPlan',
        required: true,
        index: true
    },
    enrollmentDate: {
        type: Date,
        default: Date.now
    },
    coverageType: {
        type: String,
        enum: ['Individual', 'Family'],
        required: true
    },
    dependents: [{
        name: String,
        relationship: {
            type: String,
            enum: ['Spouse', 'Child', 'Parent', 'Other']
        },
        dateOfBirth: Date,
        ssn: String
    }],
    status: {
        type: String,
        enum: ['Enrolled', 'Pending', 'Active', 'Cancelled', 'Expired'],
        default: 'Pending'
    },
    effectiveDate: Date,
    expiryDate: Date,
    employeeContribution: Number,
    companyContribution: Number,
    totalCost: Number,
    paymentFrequency: {
        type: String,
        enum: ['Monthly', 'Annual', 'One-time']
    },
    documents: [{
        name: String,
        url: String,
        uploadedAt: Date
    }],
    notes: String
}, {
    timestamps: true
});

// Indexes
benefitPlanSchema.index({ organizationId: 1, isActive: 1 });
benefitPlanSchema.index({ organizationId: 1, category: 1 });
employeeBenefitSchema.index({ organizationId: 1, employeeId: 1, status: 1 });
employeeBenefitSchema.index({ organizationId: 1, benefitPlanId: 1 });

export const BenefitPlan = mongoose.model('BenefitPlan', benefitPlanSchema);
export const EmployeeBenefit = mongoose.model('EmployeeBenefit', employeeBenefitSchema);

