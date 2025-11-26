import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import logger from "../helpers/logger.js";
import { BCRYPT_SALT_ROUNDS } from "../config/constants.js";

const employeeSchema = new mongoose.Schema({
    // Organization reference (multi-tenancy)
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    
    // Registration required fields
    name: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { 
        type: String, 
        required: true,
        trim: true,
        lowercase: true
    },
    password: { type: String, required: true },
    manager: { type: String, required: true },
    salary: { type: Number, required: true },
    role: { type: String, enum: ['admin', 'employee'], default: 'employee' },
    
    // Employee ID/Code generation
    employeeId: { 
        type: String, 
        unique: true, 
        required: true,
        default: function() {
            // Generate unique employee ID: EMP-{first3lettersOfName}-{joiningYear}-{random4Digits}
            const namePrefix = (this.name || '').substring(0, 3).toUpperCase();
            const joiningYear = (this.joiningDate ? new Date(this.joiningDate) : new Date()).getFullYear();
            const random = Math.floor(1000 + Math.random() * 9000);
            return `EMP-${namePrefix}-${joiningYear}-${random}`;
        }
    },
    
    // Profile photo
    profilePhoto: {
        url: { type: String },
        filename: { type: String },
        uploadedAt: { type: Date, default: Date.now }
    },
    
    // Joining date
    joiningDate: { 
        type: Date, 
        required: true,
        default: Date.now 
    },
    
    // Birth date
    birthDate: { 
        type: Date, 
        required: false
    },
    
    // Active/Inactive status
    status: { 
        type: String, 
        enum: ['active', 'inactive', 'suspended', 'terminated'], 
        default: 'active' 
    },
    
    // Role hierarchy
    roleLevel: { 
        type: Number, 
        default: 1,
        min: 1,
        max: 10
    },
    assignedRole: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role'
    },
    permissions: [{
        module: { type: String, required: true },
        actions: [{ type: String }] // ['read', 'write', 'delete', 'approve']
    }],
    rolePermissions: [{
        module: { type: String, required: true },
        actions: [{ type: String }] // Inherited from role
    }],

    // Enums (required for registration)
    jobCategory: {
        type: String,
        required: true,
        enum: [
            "Information Technology", "Human Resources", "Finance", "Marketing", "Sales", "Operations",
            "Customer Service", "Research and Development", "Engineering", "Legal", "Administration",
            "Management", "Design", "Product Management"
        ]
    },

    jobTitle: {
        type: String,
        required: true,
        enum: [
            "Software Engineer", "Frontend Developer", "Backend Developer", "DevOps Engineer", "HR Manager",
            "Financial Analyst", "Marketing Executive", "Sales Representative", "Product Manager",
            "QA Tester", "Customer Support Specialist", "UX/UI Designer", "Project Manager",
            "Legal Advisor", "Operations Coordinator", "Full Stack Developer"
        ]
    },

    position: {
        type: String,
        required: true,
        enum: [
            "Intern", "Junior", "Mid-Level", "Senior", "Lead", "Supervisor", "Manager",
            "Director", "VP", "CTO", "CFO", "CEO", "Developer"
        ]
    },

    department: {
        type: String,
        required: true,
        enum: [
            "Engineering", "HR", "Finance", "Sales", "Marketing", "IT Support", "Operations",
            "Customer Support", "Legal", "Product", "Research & Development", "Design", "Administration"
        ]
    },

    // Optional fields (can be added later)
    phone1: { type: String },
    phone2: { type: String },
    city: { type: String },
    address: { type: String },
    personalEmail: { type: String, match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'] },
    
    // Performance and statistics
    performanceScore: { 
        type: Number, 
        min: 0, 
        max: 100,
        default: null 
    },
    attendanceRate: { 
        type: Number, 
        min: 0, 
        max: 100,
        default: null 
    },
    projectsCompleted: { 
        type: Number, 
        default: 0 
    },

    // Optional nested objects (remove required)
    nextOfKins: [{
        name: { type: String },
        occupation: { type: String },
        phone: { type: String },
        relationship: { type: String },
        address: { type: String },
        addedAt: { type: Date, default: Date.now } // Optional: Track when added
    }],

    guarantors: [{
        name: { type: String },
        occupation: { type: String },
        phone: { type: String },
        relationship: { type: String },
        address: { type: String },
        addedAt: { type: Date, default: Date.now } // Optional: Track when added
    }],

    // Optional arrays (remove required from nested fields)
    academicRecords: [
        {
            institution: { type: String },
            details: { type: String }
        }
    ],

    professionalQualifications: [
        {
            title: { type: String },
            organization: { type: String },
            duration: { type: String },
            description: { type: String }
        }
    ],

    familyDetails: [
        {
            fullName: { type: String },
            relationship: { type: String },
            phoneNo: { type: String },
            address: { type: String },
            occupation: { type: String }
        }
    ],

    documents: [
        {
            documentType: { type: String },
            filePath: { type: String },
            fileName: { type: String },
            uploadedAt: { type: Date, default: Date.now }
        }
    ],

    financialDetails: {
        bankName: { type: String },
        ifsc: { type: String },
        accountNo: { type: String },
        accountName: { type: String }
    },
    mustResetPassword: {
        type: Boolean,
        default: true
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    active: { type: Boolean, default: true },
    // Account lockout for security
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date
    }
}, { timestamps: true });

// Hash password before saving
employeeSchema.pre('save', async function(next) {
    // Only hash password if it's been modified (or is new)
    if (this.isModified('password')) {
        try {
            const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
            this.password = await bcrypt.hash(this.password, salt);
        } catch (error) {
            return next(new Error('Error hashing password'));
        }
    }
    next();
});

// Compare password method for consistency with User model
employeeSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        if (!candidatePassword) {
            return false; // Return false instead of throwing for invalid input
        }
        if (!this.password) {
            logger.warn('Password comparison attempted but employee has no password', { 
                employeeId: this._id 
            });
            return false;
        }
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        logger.error('Password comparison error', { 
            error: error.message, 
            stack: error.stack,
            employeeId: this._id 
        });
        // Return false instead of throwing to allow login controller to handle 401 properly
        return false;
    }
};

// Add toJSON method to remove sensitive data
employeeSchema.methods.toJSON = function() {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

// Add database indexes for better query performance
// Compound unique index: email must be unique per organization
employeeSchema.index({ email: 1, organizationId: 1 }, { unique: true });
// Compound unique index: employeeId must be unique per organization
employeeSchema.index({ employeeId: 1, organizationId: 1 }, { unique: true });
employeeSchema.index({ status: 1 });
employeeSchema.index({ active: 1 });
employeeSchema.index({ department: 1 });
employeeSchema.index({ jobTitle: 1 });
employeeSchema.index({ joiningDate: 1 });
employeeSchema.index({ status: 1, active: 1 }); // Compound index for common queries
employeeSchema.index({ organizationId: 1, status: 1 }); // For filtering by org and status

const Employee = mongoose.model("Employee", employeeSchema, "employees");

export default Employee;