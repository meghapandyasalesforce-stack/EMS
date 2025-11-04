import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters long']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters long']
    },
    phone: {
        type: String,
        trim: true,
        match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number']
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
    resetPasswordToken: String,
resetPasswordExpire: Date,

},{ timestamps: true });

// Hash password and assign role before saving
userSchema.pre('save', async function(next) {
    // Only assign role when creating new user (not on updates)
    if (this.isNew && !this.role) {
        // Assign role based on email domain
        if (this.email.endsWith('@gmail.com') || this.email.endsWith('@paarsiv.com')) {
            this.role = 'admin';
        } else {
            this.role = 'employee';
        }
    }

    // Hash password only when modified
    if (this.isModified('password')) {
        try {
            const salt = await bcrypt.genSalt(10);
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
            throw new Error('Password is required');
        }
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        console.error('Password comparison error:', error);
        throw new Error('Error comparing passwords');
    }
};

// Add toJSON method to remove sensitive data
userSchema.methods.toJSON = function() {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

// Add database indexes for better query performance
// Note: email index is automatically created by unique: true
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ role: 1, isActive: 1 }); // Compound index for common queries

const User= mongoose.model("User", userSchema,"users");

export default User