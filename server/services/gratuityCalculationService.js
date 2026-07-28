/**
 * India gratuity calculation (Payment of Gratuity Act — simplified).
 */

export function calculateGratuity({
    lastDrawnBasic = 0,
    lastDrawnDa = 0,
    yearsOfService = 0,
    monthsOfService = 0,
    isMonthlyRated = true,
    maxCap = 2000000,
} = {}) {
    const wage = Number(lastDrawnBasic) + Number(lastDrawnDa);
    if (wage <= 0 || yearsOfService < 0) {
        return { eligible: false, amount: 0, reason: 'Insufficient wage or service data' };
    }

    const totalYears = yearsOfService + (monthsOfService >= 6 ? 1 : 0);
    if (totalYears < 5) {
        return { eligible: false, amount: 0, reason: 'Minimum 5 years of service required' };
    }

    const factor = isMonthlyRated ? 15 : 15;
    const daysDivisor = isMonthlyRated ? 26 : 26;
    let amount = Math.round((factor * wage * totalYears) / daysDivisor * 100) / 100;
    if (maxCap && amount > maxCap) amount = maxCap;

    return {
        eligible: true,
        amount,
        wage,
        yearsOfService: totalYears,
        formula: `(${factor} × ${wage} × ${totalYears}) / ${daysDivisor}`,
    };
}

export function estimateGratuityFromEmployee(employee, { lastWorkingDate } = {}) {
    const doj = employee?.dateOfJoining ? new Date(employee.dateOfJoining) : null;
    const lwd = lastWorkingDate ? new Date(lastWorkingDate) : new Date();
    if (!doj) return calculateGratuity({ yearsOfService: 0 });

    let years = lwd.getFullYear() - doj.getFullYear();
    let months = lwd.getMonth() - doj.getMonth();
    if (months < 0) { years -= 1; months += 12; }

    const basic = Number(employee?.salary?.basic || employee?.salary?.gross * 0.4 || 0);
    const da = Number(employee?.salary?.da || 0);

    return calculateGratuity({
        lastDrawnBasic: basic,
        lastDrawnDa: da,
        yearsOfService: years,
        monthsOfService: months,
    });
}
