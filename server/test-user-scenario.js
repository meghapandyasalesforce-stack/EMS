
import { rollLeaveBalanceThroughPeriod } from './helpers/leaveBalanceRulesHelper.js';

// Simulate user's scenario: employee joins June, opening balance May is 5 days
const result = rollLeaveBalanceThroughPeriod({
  joinYear: 2024,
  joinMonthIndex: 5, // June is index 5
  endYear: 2024,
  endMonthIndex: 6, // July is index 6
  monthlyRate: 1.5,
  getUsedForMonth: () => 0,
  periodOpeningBalance: {
    active: true,
    openingYear: 2024,
    openingMonth: 5, // May (the month before joining)
    balance: 5,
  },
  initialBalance: 5,
});

console.log('ledgerByYear:', JSON.stringify(result.ledgerByYear, null, 2));
console.log('ledger:', JSON.stringify(result.ledger, null, 2));
