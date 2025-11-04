import mongoose from "mongoose";

const idCardSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    cardType: {
        type: String,
        enum: ['employee', 'visitor', 'contractor', 'temporary'],
        default: 'employee'
    },
    cardNumber: {
        type: String,
        required: true,
        unique: true
    },
    issueDate: {
        type: Date,
        default: Date.now
    },
    expiryDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'expired', 'suspended', 'cancelled'],
        default: 'active'
    },
    cardDesign: {
        type: {
            template: {
                type: String,
                enum: ['standard', 'premium', 'executive', 'custom'],
                default: 'standard'
            },
            backgroundColor: {
                type: String,
                default: '#ffffff'
            },
            textColor: {
                type: String,
                default: '#000000'
            },
            logoUrl: {
                type: String
            },
            companyName: {
                type: String,
                required: true
            },
            companyAddress: {
                type: String
            }
        },
        default: {
            template: 'standard',
            backgroundColor: '#ffffff',
            textColor: '#000000',
            companyName: 'Paarsiv Technologies',
            companyAddress: ''
        }
    },
    qrCode: {
        data: { type: String },
        imageUrl: { type: String }
    },
    barcode: {
        data: { type: String },
        imageUrl: { type: String }
    },
    securityFeatures: {
        hologram: { type: Boolean, default: false },
        watermark: { type: Boolean, default: false },
        microtext: { type: Boolean, default: false },
        uvPrint: { type: Boolean, default: false }
    },
    accessLevel: {
        type: String,
        enum: ['basic', 'standard', 'premium', 'admin'],
        default: 'basic'
    },
    accessZones: [{
        zone: { type: String, required: true },
        permissions: [{ type: String }] // ['enter', 'exit', '24/7', 'business_hours']
    }],
    generatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lastUsed: {
        type: Date
    },
    usageCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Index for efficient queries
idCardSchema.index({ employeeId: 1 });
idCardSchema.index({ status: 1 });
idCardSchema.index({ expiryDate: 1 });

// Note: cardNumber generation moved to controller to avoid validation issues

// Method to check if card is valid
idCardSchema.methods.isValid = function() {
    const now = new Date();
    return this.status === 'active' && this.expiryDate > now;
};

// Method to update usage
idCardSchema.methods.updateUsage = function() {
    this.lastUsed = new Date();
    this.usageCount += 1;
    return this.save();
};

// Static method to get cards expiring soon
idCardSchema.statics.getExpiringSoon = function(days = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    return this.find({
        status: 'active',
        expiryDate: { $lte: futureDate }
    }).populate('employeeId', 'name email employeeId');
};

const IdCard = mongoose.model("IdCard", idCardSchema, "idcards");
export default IdCard;
