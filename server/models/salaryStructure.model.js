import mongoose from "mongoose";
import { computeSalaryStructureCoreEarnings, computeConfiguredComponent, pfWageFromBasicWage } from '../helpers/salaryCalculation.js';

const salaryStructureSchema = new mongoose.Schema({
    // Organization reference (multi-tenancy)
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
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

// Method to calculate salary based on this structure (baseSalary = monthly gross/CTC)
salaryStructureSchema.methods.calculateSalary = function(baseSalary) {
    const gross = Math.max(0, Number(baseSalary) || 0);
    const core = computeSalaryStructureCoreEarnings(this, gross);
    const pfWageBase = pfWageFromBasicWage(core.basicWage);

    const result = {
        earnings: {
            basicWage: core.basicWage,
            houseRentAllowance: core.houseRentAllowance,
            transportAllowance: core.transportAllowance,
            medicalAllowance: core.medicalAllowance,
            specialAllowance: core.specialAllowance,
            pfEmployer: computeConfiguredComponent(this.earnings?.pfEmployer, pfWageBase),
            esiEmployer: computeConfiguredComponent(this.earnings?.esiEmployer, core.basicWage)
        },
        deductions: {
            pfEmployee: computeConfiguredComponent(this.deductions?.pfEmployee, pfWageBase),
            esiEmployee: computeConfiguredComponent(this.deductions?.esiEmployee, core.basicWage),
            professionalTax: computeConfiguredComponent(this.deductions?.professionalTax, gross),
            incomeTax: 0
        },
        totalEarnings: 0,
        totalDeductions: 0,
        netSalary: 0
    };

    result.totalEarnings = Object.values(result.earnings).reduce((sum, v) => sum + (Number(v) || 0), 0);
    result.totalDeductions = Object.values(result.deductions).reduce((sum, v) => sum + (Number(v) || 0), 0);
    result.netSalary = result.totalEarnings - result.totalDeductions;
    return result;
};

// Add compound unique index: name must be unique per organization
salaryStructureSchema.index({ name: 1, organizationId: 1 }, { unique: true });

const SalaryStructure = mongoose.model("SalaryStructure", salaryStructureSchema, "salarystructures");
export default SalaryStructure;
