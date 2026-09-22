import mongoose from "mongoose";

const idCardSchema = new mongoose.Schema({
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
        required: true
    },
    cardType: {
        type: String,
        enum: ['employee', 'visitor', 'contractor', 'temporary'],
        default: 'employee'
    },
    cardNumber: {
        type: String,
        required: true
    },
    issueDate: {
        type: Date,
        default: Date.now
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
                enum: [
                    'standard',
                    'premium',
                    'executive',
                    'custom',
                    'mint',
                    'corporate',
                    'modern',
                    'professional'
                ],
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
            textColor: '#2D3130',
            companyName: 'paarsiv',
            companyAddress: 'www.paarsiv.com'
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

// Note: cardNumber generation moved to controller to avoid validation issues

// Method to check if card is valid
idCardSchema.methods.isValid = function() {
    return this.status === 'active';
};

// Method to update usage
idCardSchema.methods.updateUsage = function() {
    this.lastUsed = new Date();
    this.usageCount += 1;
    return this.save();
};

// Static method removed - expiry date no longer used
// Cards are managed by status only (active, suspended, cancelled)

// Add compound unique index: cardNumber must be unique per organization
idCardSchema.index({ cardNumber: 1, organizationId: 1 }, { unique: true });

const IdCard = mongoose.model("IdCard", idCardSchema, "idcards");
export default IdCard;
