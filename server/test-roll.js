
import { rollLeaveBalanceThroughPeriod, roundLeaveDays } from './helpers/leaveBalanceRulesHelper.js';

const result = rollLeaveBalanceThroughPeriod({
    joinYear: 2024,
    joinMonthIndex: 5, // June
    endYear: 2024,
    endMonthIndex: 6, // July
    monthlyRate: 1.5,
    getUsedForMonth: () => 0,
    periodOpeningBalance: {
        openingYear: 2024,
        openingMonth: 5, // May
        balance: 5,
    },
    initialBalance: 5,
});

console.log('Result:', JSON.stringify(result, null, 2));
console.log('ledgerByYear:', result.ledgerByYear);
