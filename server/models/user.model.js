import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import logger from "../helpers/logger.js";
import { BCRYPT_SALT_ROUNDS } from "../config/constants.js";

const userSchema = new mongoose.Schema({
    // Organization reference (multi-tenancy)
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters long']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters long'],
        select: false // SECURITY: Never include password in queries by default
    },
    phone: {
        type: String,
        trim: true,
        match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number']
    },
    title: {
        type: String,
        trim: true
    },
    position: {
        type: String,
        trim: true
    },
    role: {
        type: String,
        enum: [ 'admin', 'employee'],
        default: 'admin'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Email verification
    emailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: {
        type: String,
        sparse: true
    },
    emailVerificationExpires: {
        type: Date
    },
    // Two-factor authentication
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },
    twoFactorSecret: {
        type: String,
        sparse: true
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    // Account lockout for security
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date
    }

},{ timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
    // SECURITY: Role assignment based on email domain has been removed.
    // Role must be explicitly set during user creation or defaults to 'admin' as per schema.
    // This prevents security vulnerabilities from email domain-based role assignment.

    // Hash password only when modified
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

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        if (!candidatePassword) {
            return false; // Return false instead of throwing for invalid input
        }
        if (!this.password) {
            logger.warn('Password comparison attempted but user has no password', { 
                userId: this._id 
            });
            return false;
        }
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        logger.error('Password comparison error', { 
            error: error.message, 
            stack: error.stack,
            userId: this._id 
        });
        // Return false instead of throwing to allow login controller to handle 401 properly
        return false;
    }
};

// Add toJSON method to remove sensitive data
userSchema.methods.toJSON = function() {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

// Add database indexes for better query performance
// Compound unique index: email must be unique per organization
userSchema.index({ email: 1, organizationId: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ role: 1, isActive: 1 }); // Compound index for common queries
userSchema.index({ organizationId: 1, role: 1 }); // For filtering by org and role

const User= mongoose.model("User", userSchema,"users");

export default User