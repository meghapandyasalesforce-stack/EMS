import mongoose from "mongoose";
import { hashPassword, comparePassword } from "../helpers/passwordUtils.js";
import User from "./user.model.js";
import { organizationIsolationPlugin } from "../plugins/organizationIsolation.js";

/**
 * Employee Schema
 * @typedef {Object} Employee
 * @property {mongoose.Types.ObjectId} organizationId - Organization reference for multi-tenancy (required, indexed)
 * @property {string} name - Employee first name (required)
 * @property {string} [lastName] - Employee last name (optional)
 * @property {string} email - Employee email address (required, unique, lowercase, trimmed)
 * @property {string} password - Hashed password (required, not returned in queries)
 * @property {string} manager - Manager name or ID (required)
 * @property {number} salary - Employee salary (required)
 * @property {string} role - User role, either 'admin' or 'employee' (default: 'employee')
 * @property {string} employeeId - Employee identifier unique per organization (prefix+seq or legacy EMP-…)
 * @property {Object} profilePhoto - Profile photo metadata (url, filename, uploadedAt)
 * @property {Date} joiningDate - Employee joining date (required, default: Date.now)
 * @property {Date} birthDate - Employee birth date (optional)
 * @property {string} status - Employee status: 'active', 'inactive', 'suspended', 'terminated' (default: 'active')
 * @property {number} roleLevel - Role hierarchy level 1-10 (default: 1)
 * @property {mongoose.Types.ObjectId} assignedRole - Reference to Role model
 * @property {Array<Object>} permissions - Direct employee permissions [{module, actions}]
 * @property {Array<Object>} rolePermissions - Permissions inherited from role
 */
const employeeSchema = new mongoose.Schema({
    /**
     * Organization reference for multi-tenancy support
     * @type {mongoose.Types.ObjectId}
     * @required
     * @indexed
     * @ref Organization
     */
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },

    /**
     * Unified auth: links HR profile to User login (one password).
     * When set, login/forgot-password use User credentials.
     */
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        sparse: true,
        index: true
    },
    
    /**
     * Employee first name
     * @type {string}
     * @required
     */
    name: { type: String, required: true },
    
    /**
     * Employee last name
     * @type {string}
     */
    lastName: { type: String, required: false, default: '', trim: true },
    
    /**
     * Employee email address (unique, lowercase, trimmed)
     * @type {string}
     * @required
     * @unique
     */
    email: { 
        type: String, 
        required: true,
        trim: true,
        lowercase: true
    },
    
    /**
     * Hashed password (never returned in queries)
     * @type {string}
     * @required
     * @private
     */
    password: {
        type: String,
        required: function passwordRequired() {
            return !this.userId;
        },
        select: false
    },
    
    /**
     * Manager display label. Top-level Admin root uses "Admin" (managerId: null).
     * Legacy values "CEO" are still treated as top-level.
     * @type {string}
     */
    manager: { type: String, required: false, default: 'Admin' },
    /**
     * Preferred manager reference (ObjectId) for reporting hierarchy.
     * Null only for the single organization Admin root.
     * Legacy `manager` string is kept for backwards compatibility.
     */
    managerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: false,
        index: true
    },
    
    /**
     * Employee salary
     * @type {number}
     * @required
     * @min 0
     */
    salary: { type: Number, required: true, min: 0 },
    /** CTC revision history for cumulative TDS projection */
    salaryRevisions: [{
        salary: { type: Number, required: true, min: 0 },
        effectiveFrom: { type: Date, required: true },
        note: { type: String, trim: true },
        createdAt: { type: Date, default: Date.now }
    }],
    salaryStructure: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SalaryStructure',
        required: false
    },
    
    /**
     * User role: 'admin' or 'employee'
     * @type {string}
     * @enum ['admin', 'employee']
     * @default 'employee'
     */
    role: { type: String, enum: ['admin', 'employee'], default: 'employee' },
    
    /**
     * Explicit functional roles array for security
     * SECURITY: This replaces insecure string matching on department/position fields
     * Roles: 'hr', 'manager', 'executive', 'finance', 'tech', 'ceo', 'cto', 'cfo', 'vp'
     * @type {Array<string>}
     * @default []
     */
    functionalRoles: {
        type: [{
            type: String,
            enum: ['hr', 'manager', 'project_manager', 'executive', 'finance', 'tech', 'ceo', 'cto', 'cfo', 'vp']
        }],
        default: []
    },

    /**
     * SaaS data visibility override (Zoho-style scope separate from System Role).
     * default = derive from role (org for HR/payroll, team for managers, self for employees)
     */
    accessDataScope: {
        type: String,
        enum: ['default', 'organization', 'department', 'departments', 'team', 'self'],
        default: 'default',
    },
    /** Used when accessDataScope === 'departments' — OrgDepartment ids in this tenant */
    accessDepartmentIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrgDepartment',
    }],
    
    // Employee ID/Code generation — unique per organization (see compound index), not globally
    employeeId: { 
        type: String, 
        required: true,
        default: function() {
            // Generate unique employee ID: EMP-{first3lettersOfName}-{joiningYear}-{random4Digits}
            const namePrefix = (this.name || '').substring(0, 3).toUpperCase();
            const joiningYear = (this.joiningDate ? new Date(this.joiningDate) : new Date()).getFullYear();
            const random = Math.floor(1000 + Math.random() * 9000);
            return `EMP-${namePrefix}-${joiningYear}-${random}`;
        }
    },
    
    // Profile photo (private S3 object, served through short-lived signed URLs)
    profilePhoto: {
        url: { type: String },
        thumbnailUrl: { type: String },
        s3Key: { type: String },
        thumbS3Key: { type: String },
        filename: { type: String },
        uploadedAt: { type: Date, default: Date.now },
        optimized: { type: Boolean, default: false },
        originalSize: { type: Number },
        optimizedSize: { type: Number }
    },
    
    // Joining date
    joiningDate: { 
        type: Date, 
        required: true,
        default: Date.now 
    },

    /**
     * Employment probation (SaaS fallback when Lifecycle onboarding is not used).
     * Leave accrual/validation prefers OnboardingWorkflow.probation when present.
     */
    probation: {
        status: {
            type: String,
            enum: [
                'None',
                'Not Started',
                'Active',
                'Extended',
                'Confirmed',
                'Waived',
                'Rejected',
                'Terminated',
            ],
            default: 'None',
        },
        startDate: { type: Date },
        endDate: { type: Date },
        confirmedAt: { type: Date },
        rejectedAt: { type: Date },
    },
    
    // Birth date
    birthDate: { 
        type: Date, 
        required: false
    },
    // Marriage anniversary
    marriageDate: {
        type: Date,
        default: null,
        required: false
    },
    showMarriageAnniversary: {
        type: Boolean,
        default: true
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other', 'Prefer not to say'],
        required: false
    },
    nationalIdType: {
        type: String,
        enum: [
            'Aadhaar',
            'Voter ID (EPIC)',
            'Passport',
            'PAN',
            'Driving License',
            'Other'
        ],
        required: false
    },
    nationalId: {
        type: String,
        trim: true,
        required: false
    },
    
    // Active/Inactive status
    status: { 
        type: String, 
        enum: ['active', 'inactive', 'suspended', 'terminated'], 
        default: 'active' 
    },
    terminationDate: {
        type: Date,
        index: true
    },
    lastWorkingDate: {
        type: Date,
        index: true
    },
    terminationReason: {
        type: String,
        trim: true,
        maxlength: 500
    },
    terminationNotes: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    terminatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    eligibleForRehire: {
        type: Boolean,
        default: false
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
        trim: true,
    },

    position: {
        type: String,
        required: true,
        trim: true,
    },

    department: {
        type: String,
        required: true,
        trim: true,
    },

    /**
     * True for the single organization-owner Employee used as org-chart root.
     * Created at registration / ensure; not a second User login.
     */
    isOrgOwnerRoot: {
        type: Boolean,
        default: false,
        index: true,
    },

    /** Organization structure master references (SaaS org chart) */
    departmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrgDepartment',
        index: true,
    },
    teamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrgTeam',
        index: true,
    },
    jobFamilyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrgJobFamily',
    },
    jobRoleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrgJobRole',
        index: true,
    },
    designationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrgDesignation',
    },
    locationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrgLocation',
    },
    employmentTypeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrgEmploymentType',
    },
    workModeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrgWorkMode',
    },
    /** Denormalized labels for reports / legacy consumers */
    employmentType: { type: String, trim: true },
    workMode: { type: String, trim: true },

    /** Assigned work shift (AttendanceRule.shifts key, e.g. shift1 / shift2) */
    shiftId: {
        type: String,
        trim: true,
        default: undefined,
    },
    shiftName: {
        type: String,
        trim: true,
        default: undefined,
    },

    // Optional fields (can be added later)
    phone1: { type: String },
    phone2: { type: String },
    city: { type: String },
    address: { type: String },
    personalEmail: { type: String, match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'] },
    professionalBio: { type: String, default: '' },
    maritalStatus: { type: String, enum: ['Single', 'Married', 'Divorced', 'Widowed', ''], default: '' },
    anniversaryDate: { type: Date },
    spouseName: { type: String },
    emergencyContactName: { type: String },
    emergencyContactPhone: { type: String },
    emergencyContactRelationship: { type: String },
    
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
            /** Degree / program name (e.g. B.Tech, M.Sc). Legacy rows may only have details. */
            degree: { type: String },
            fieldOfStudy: { type: String },
            startDate: { type: Date },
            endDate: { type: Date },
            /** e.g. 8.5/10 or percentage */
            cgpa: { type: String },
            /** Free text / legacy combined field */
            details: { type: String },
        }
    ],

    professionalQualifications: [
        {
            title: { type: String },
            organization: { type: String },
            duration: { type: String },
            description: { type: String },
            filePath: { type: String },
            fileName: { type: String },
            originalName: { type: String },
            mimeType: { type: String },
            size: { type: Number },
            uploadedAt: { type: Date, default: Date.now }
        }
    ],

    professionalExperience: [
        {
            companyName: { type: String },
            jobTitle: { type: String },
            employmentType: { type: String },
            location: { type: String },
            startDate: { type: Date },
            endDate: { type: Date },
            currentlyWorking: { type: Boolean, default: false },
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
            originalName: { type: String },
            size: { type: Number },
            uploadedAt: { type: Date, default: Date.now }
        }
    ],

    financialDetails: {
        bankName: { type: String },
        ifsc: { type: String },
        accountNo: { type: String },
        accountName: { type: String },
        panNumber: { type: String },
        epfUan: { type: String },
        /** When false, PF (employee + employer) is not deducted in payroll runs. Default true. */
        deductPf: { type: Boolean, default: true },
        /** When false, ESI (employee + employer) is not deducted in payroll runs. Default true. */
        deductEsi: { type: Boolean, default: true },
        taxRegime: { type: String },
        metroCity: { type: Boolean, default: false },
        taxDeclaration: {
            financialYear: { type: String },
            section80C: {
                epf: { type: Number, default: 0 },
                ppf: { type: Number, default: 0 },
                lic: { type: Number, default: 0 },
                elss: { type: Number, default: 0 },
                tuitionFees: { type: Number, default: 0 },
                homeLoanPrincipal: { type: Number, default: 0 },
                other: { type: Number, default: 0 }
            },
            section80D: {
                selfFamilyPremium: { type: Number, default: 0 },
                parentsPremium: { type: Number, default: 0 },
                selfSeniorCitizen: { type: Boolean, default: false },
                parentsSeniorCitizen: { type: Boolean, default: false }
            },
            section80E: {
                educationLoanInterest: { type: Number, default: 0 }
            },
            section24b: {
                homeLoanInterest: { type: Number, default: 0 }
            },
            hra: {
                monthlyRent: { type: Number, default: 0 },
                landlordPan: { type: String },
                metroCity: { type: Boolean, default: false }
            },
            updatedAt: { type: Date }
        }
    },
    mustResetPassword: {
        type: Boolean,
        default: true
    },
    /** false only for new hires — one-time /job-details redirect on first login */
    hasCompletedFirstLogin: {
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
    },
    // Token invalidation: track when password was last changed
    // Tokens issued before this timestamp are invalid
    passwordChangedAt: {
        type: Date
    },
    
    // Location permission tracking
    locationPermission: {
        status: {
            type: String,
            enum: ['granted', 'denied', 'prompt', 'not-requested'],
            default: 'not-requested'
        },
        grantedAt: { type: Date },
        deniedAt: { type: Date },
        lastCheckedAt: { type: Date }
    }
}, { timestamps: true });

// Hash password before saving
employeeSchema.pre('save', async function(next) {
    // Unified auth: skip local password when linked to User
    if (this.userId && !this.isModified('password')) {
        return next();
    }
    if (this.userId && this.isModified('password') && !this.password) {
        return next();
    }
    // Only hash password if it's been modified (or is new)
    if (this.isModified('password') && this.password) {
        try {
            this.password = await hashPassword(this.password);
            // Update passwordChangedAt when password is changed (but not on initial creation)
            if (!this.isNew) {
                this.passwordChangedAt = Date.now();
            }
        } catch (error) {
            return next(error);
        }
    }
    
    // ✅ SYNC: Keep active field in sync with status field
    // If status is modified, update active accordingly
    // This ensures consistency between status (enum) and active (boolean)
    if (this.isModified('status')) {
        this.active = (this.status === 'active');
    }
    // If active is modified but status is not, sync status to match active
    // This handles cases where active is set directly
    else if (this.isModified('active') && !this.isModified('status')) {
        if (this.active === false && this.status === 'active') {
            // If setting active to false but status is still 'active', change status to 'inactive'
            this.status = 'inactive';
        } else if (this.active === true && this.status !== 'active') {
            // If setting active to true but status is not 'active', change status to 'active'
            this.status = 'active';
        }
    }
    
    next();
});

// Compare password method for consistency with User model
employeeSchema.methods.comparePassword = async function(candidatePassword) {
    if (this.userId) {
        const linkedUser = await User.findById(this.userId).select('+password');
        if (linkedUser) {
            return linkedUser.comparePassword(candidatePassword);
        }
    }
    return await comparePassword(candidatePassword, this.password, this._id?.toString());
};

/**
 * Sync active field with status field (or vice versa)
 * This ensures consistency between status (enum) and active (boolean)
 * @returns {Object} The employee document with synced fields
 */
employeeSchema.methods.syncStatusFields = function() {
    // If status is set, sync active to match
    if (this.status) {
        this.active = (this.status === 'active');
    }
    // If active is set but status doesn't match, sync status
    else if (this.active !== undefined) {
        if (this.active === false && this.status === 'active') {
            this.status = 'inactive';
        } else if (this.active === true && this.status !== 'active') {
            this.status = 'active';
        }
    }
    return this;
};

// Add toJSON method to remove sensitive data
employeeSchema.methods.toJSON = function() {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

// Add database indexes for better query performance
// Email uniqueness among workforce (non-root) employees per org.
// Exception: isOrgOwnerRoot may share the org-owner login email with exactly one Me Employee.
employeeSchema.index(
  { email: 1, organizationId: 1 },
  {
    unique: true,
    partialFilterExpression: { isOrgOwnerRoot: { $ne: true } },
    name: 'email_org_unique_non_root',
  }
);
// At most one permanent Admin/CEO org-chart root per organization
employeeSchema.index(
  { organizationId: 1 },
  {
    unique: true,
    partialFilterExpression: { isOrgOwnerRoot: true },
    name: 'one_org_owner_root_per_org',
  }
);
employeeSchema.index({ userId: 1, organizationId: 1 }, { sparse: true });
// Compound unique index: employeeId must be unique per organization
employeeSchema.index({ employeeId: 1, organizationId: 1 }, { unique: true });
employeeSchema.index({ status: 1 });
employeeSchema.index({ active: 1 });
employeeSchema.index({ department: 1 });
employeeSchema.index({ jobTitle: 1 });
employeeSchema.index({ joiningDate: 1 });
employeeSchema.index({ status: 1, active: 1 }); // Compound index for common queries
employeeSchema.index({ organizationId: 1, status: 1 }); // For filtering by org and status
employeeSchema.index({ functionalRoles: 1 }); // Index for role-based queries
employeeSchema.index({ organizationId: 1, managerId: 1, status: 1 }); // Team lookups by manager
employeeSchema.index({ organizationId: 1, terminationDate: 1 }); // Payroll selection for terminated-in-period
employeeSchema.index({ organizationId: 1, lastWorkingDate: 1 }); // Payroll selection for last-working-day flows

// Apply organization isolation plugin (SECURITY: Enforces multi-tenancy)
// Note: requireOrganizationId is false by default to avoid breaking populate() and other operations
// Controllers should explicitly add organizationId to queries for security
employeeSchema.plugin(organizationIsolationPlugin, { requireOrganizationId: false });

// Pre-save hook to auto-populate functionalRoles based on department/position (backward compatibility)
// SECURITY: This is for migration only. New code should explicitly set functionalRoles
employeeSchema.pre('save', async function(next) {
    if (this._skipFunctionalRoleInference) {
        return next();
    }
    // Only auto-populate if functionalRoles is empty (new employee or migration)
    const currentRoles = Array.isArray(this.functionalRoles) ? this.functionalRoles : [];
    if (currentRoles.length === 0 && this.department && this.position) {
        const roles = [];
        const dept = (this.department || '').toLowerCase().trim();
        const pos = (this.position || '').toLowerCase().trim();
        const jobTitle = (this.jobTitle || '').toLowerCase().trim();
        
        // HR detection
        if (dept === 'hr' || dept.includes('hr') || dept.includes('human resource') ||
            jobTitle.includes('hr manager') || jobTitle.includes('human resource') ||
            jobTitle.includes('hr') || (pos.includes('hr') && pos.includes('manager'))) {
            roles.push('hr');
        }
        
        // Project Manager (org-wide projects; not line-manager scope)
        if (jobTitle === 'project manager') {
            roles.push('project_manager');
        }

        // Line manager detection (exclude Project Manager job title)
        if (jobTitle !== 'project manager' &&
            (pos === 'manager' || pos === 'director' || pos.includes('manager') ||
            pos.includes('director') || jobTitle.includes('manager') || jobTitle.includes('director'))) {
            roles.push('manager');
        }
        
        // Executive detection
        if (pos === 'ceo' || pos === 'cto' || pos === 'cfo' || pos === 'vp' ||
            pos === 'vice president' || pos.includes('chief executive') ||
            pos.includes('chief technology') || pos.includes('chief financial') ||
            pos.includes('vice president')) {
            if (pos === 'ceo' || pos.includes('chief executive')) roles.push('ceo');
            if (pos === 'cto' || pos.includes('chief technology')) roles.push('cto');
            if (pos === 'cfo' || pos.includes('chief financial')) roles.push('cfo');
            if (pos === 'vp' || pos === 'vice president') roles.push('vp');
            roles.push('executive');
        }
        
        // Finance detection
        if (dept === 'finance' || dept.includes('finance')) {
            roles.push('finance');
        }
        
        // Tech detection
        if (dept === 'engineering' || dept === 'it support' || dept.includes('engineering') ||
            dept.includes('technology') || jobTitle.includes('engineer') || jobTitle.includes('developer')) {
            roles.push('tech');
        }
        
        // Set functional roles (remove duplicates)
        this.functionalRoles = [...new Set(roles)];
    }
    next();
});

const Employee = mongoose.model("Employee", employeeSchema, "employees");

export default Employee;