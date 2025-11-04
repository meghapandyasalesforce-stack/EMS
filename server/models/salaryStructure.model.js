import mongoose from "mongoose";

const salaryStructureSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    description: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    applicableTo: {
        type: String,
        enum: ['all', 'department', 'position', 'level'],
        default: 'all'
    },
    applicableValues: [{
        type: String
    }],
    earnings: {
        basicWage: {
            percentage: { type: Number, default: 0, min: 0, max: 100 },
            fixedAmount: { type: Number, default: 0, min: 0 },
            isPercentage: { type: Boolean, default: true }
        },
        houseRentAllowance: {
            percentage: { type: Number, default: 0, min: 0, max: 100 },
            fixedAmount: { type: Number, default: 0, min: 0 },
            isPercentage: { type: Boolean, default: true }
        },
        transportAllowance: {
            percentage: { type: Number, default: 0, min: 0, max: 100 },
            fixedAmount: { type: Number, default: 0, min: 0 },
            isPercentage: { type: Boolean, default: true }
        },
        medicalAllowance: {
            percentage: { type: Number, default: 0, min: 0, max: 100 },
            fixedAmount: { type: Number, default: 0, min: 0 },
            isPercentage: { type: Boolean, default: true }
        },
        specialAllowance: {
            percentage: { type: Number, default: 0, min: 0, max: 100 },
            fixedAmount: { type: Number, default: 0, min: 0 },
            isPercentage: { type: Boolean, default: true }
        },
        pfEmployer: {
            percentage: { type: Number, default: 12, min: 0, max: 100 },
            fixedAmount: { type: Number, default: 0, min: 0 },
            isPercentage: { type: Boolean, default: true }
        },
        esiEmployer: {
            percentage: { type: Number, default: 3.25, min: 0, max: 100 },
            fixedAmount: { type: Number, default: 0, min: 0 },
            isPercentage: { type: Boolean, default: true }
        }
    },
    deductions: {
        pfEmployee: {
            percentage: { type: Number, default: 12, min: 0, max: 100 },
            fixedAmount: { type: Number, default: 0, min: 0 },
            isPercentage: { type: Boolean, default: true }
        },
        esiEmployee: {
            percentage: { type: Number, default: 0.75, min: 0, max: 100 },
            fixedAmount: { type: Number, default: 0, min: 0 },
            isPercentage: { type: Boolean, default: true }
        },
        professionalTax: {
            percentage: { type: Number, default: 0, min: 0, max: 100 },
            fixedAmount: { type: Number, default: 0, min: 0 },
            isPercentage: { type: Boolean, default: false }
        },
        incomeTax: {
            percentage: { type: Number, default: 0, min: 0, max: 100 },
            fixedAmount: { type: Number, default: 0, min: 0 },
            isPercentage: { type: Boolean, default: true }
        }
    },
    bonusStructure: {
        performanceBonus: {
            enabled: { type: Boolean, default: false },
            percentage: { type: Number, default: 0, min: 0, max: 100 },
            maxAmount: { type: Number, default: 0, min: 0 }
        },
        projectBonus: {
            enabled: { type: Boolean, default: false },
            percentage: { type: Number, default: 0, min: 0, max: 100 },
            maxAmount: { type: Number, default: 0, min: 0 }
        },
        attendanceBonus: {
            enabled: { type: Boolean, default: false },
            percentage: { type: Number, default: 0, min: 0, max: 100 },
            maxAmount: { type: Number, default: 0, min: 0 }
        }
    },
    overtimeRules: {
        enabled: { type: Boolean, default: true },
        rate: { type: Number, default: 1.5, min: 1, max: 3 }, // 1.5x normal rate
        maxHoursPerDay: { type: Number, default: 4, min: 0, max: 12 },
        maxHoursPerMonth: { type: Number, default: 50, min: 0, max: 200 }
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Index for efficient queries
salaryStructureSchema.index({ isActive: 1 });
salaryStructureSchema.index({ applicableTo: 1 });

// Method to calculate salary based on this structure
salaryStructureSchema.methods.calculateSalary = function(baseSalary) {
    const result = {
        earnings: {},
        deductions: {},
        totalEarnings: 0,
        totalDeductions: 0,
        netSalary: 0
    };

    // Calculate earnings
    Object.keys(this.earnings).forEach(key => {
        const earning = this.earnings[key];
        if (earning.isPercentage) {
            result.earnings[key] = (baseSalary * earning.percentage) / 100;
        } else {
            result.earnings[key] = earning.fixedAmount;
        }
        result.totalEarnings += result.earnings[key];
    });

    // Calculate deductions
    Object.keys(this.deductions).forEach(key => {
        const deduction = this.deductions[key];
        if (deduction.isPercentage) {
            result.deductions[key] = (baseSalary * deduction.percentage) / 100;
        } else {
            result.deductions[key] = deduction.fixedAmount;
        }
        result.totalDeductions += result.deductions[key];
    });

    result.netSalary = result.totalEarnings - result.totalDeductions;
    return result;
};

const SalaryStructure = mongoose.model("SalaryStructure", salaryStructureSchema, "salarystructures");
export default SalaryStructure;
