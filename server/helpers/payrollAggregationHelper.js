/**
 * Aggregates monthly base payroll + off-cycle adjustments for one employee/month.
 *
 * The output is intentionally shaped for UI:
 * - monthly: base monthly record (totals + ids)
 * - adjustments: off-cycle records (totals + ids)
 * - final: computed totals for UI display/payslip
 */

export function aggregatePayrollPeriod(payrolls) {
    if (!Array.isArray(payrolls)) return null;

    const monthlyCandidates = payrolls.filter((p) => p?.type === 'monthly');
    // Prefer final monthly over preview; if multiple remain (legacy data),
    // pick the most recently updated one.
    const monthly = monthlyCandidates
        .slice()
        .sort((a, b) => {
            const aIsPreview = a?.generationType === 'preview' || a?.isProvisional === true;
            const bIsPreview = b?.generationType === 'preview' || b?.isProvisional === true;
            if (aIsPreview !== bIsPreview) return aIsPreview ? 1 : -1;
            return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
        })[0] || null;
    const adjustments = payrolls.filter((p) => p?.type === 'off_cycle');
    const adjustmentsForTotal = adjustments.filter((p) => {
        const st = p?.status;
        return st === 'Processed' || st === 'Paid';
    });

    const monthlyEarningsTotal = Number(monthly?.earnings?.totalEarnings) || 0;
    const monthlyDeductionsTotal = Number(monthly?.deductions?.total) || 0;

    const fullOverrides = adjustmentsForTotal
        .filter((p) => p?.adjustmentMode === 'full_override')
        .slice()
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    const fullOverride = fullOverrides[0] || null;

    const nonFullAdjustments = fullOverride
        ? adjustmentsForTotal.filter((p) => String(p?._id) !== String(fullOverride?._id))
        : adjustmentsForTotal;

    const adjustmentsEarningsTotal = nonFullAdjustments.reduce(
        (sum, p) => sum + (Number(p?.earnings?.totalEarnings) || 0),
        0
    );
    const adjustmentsDeductionsTotal = nonFullAdjustments.reduce(
        (sum, p) => sum + (Number(p?.deductions?.total) || 0),
        0
    );

    let finalEarningsTotal;
    let finalDeductionsTotal;
    if (fullOverride) {
        finalEarningsTotal =
            (Number(fullOverride?.earnings?.totalEarnings) || 0) + adjustmentsEarningsTotal;
        finalDeductionsTotal =
            (Number(fullOverride?.deductions?.total) || 0) + adjustmentsDeductionsTotal;
    } else {
        finalEarningsTotal = monthlyEarningsTotal + adjustmentsEarningsTotal;
        finalDeductionsTotal = monthlyDeductionsTotal + adjustmentsDeductionsTotal;
    }
    const finalNet = finalEarningsTotal - finalDeductionsTotal;

    return {
        monthly,
        adjustments,
        final: {
            earningsTotal: finalEarningsTotal,
            deductionsTotal: finalDeductionsTotal,
            net: finalNet
        }
    };
}

