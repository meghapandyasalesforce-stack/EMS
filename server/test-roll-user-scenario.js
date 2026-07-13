
import { rollLeaveBalanceThroughPeriod } from './helpers/leaveBalanceRulesHelper.js';

const result = rollLeaveBalanceThroughPeriod({
  joinYear: 2024,
  joinMonthIndex: 5, // June (0-based)
  endYear: 2026,
  endMonthIndex: 5, // June (0-based)
  monthlyRate: 1.5,
  getUsedForMonth: () => 0,
  periodOpeningBalance: {
    active: true,
    openingYear: 2024,
    openingMonth: 5, // May (1-based)
    balance: 5,
  },
  initialBalance: 5,
});

console.log('=== Ledger by year ===');
console.log(JSON.stringify(result.ledgerByYear, null, 2));
console.log('=== Ledger (current year) ===');
console.log(JSON.stringify(result.ledger, null, 2));
console.log('=== Year opening balance ===');
console.log(result.yearOpeningBalance);
