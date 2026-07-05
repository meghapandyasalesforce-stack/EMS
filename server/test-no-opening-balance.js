
import { rollLeaveBalanceThroughPeriod } from './helpers/leaveBalanceRulesHelper.js';

const result = rollLeaveBalanceThroughPeriod({
  joinYear: 2024,
  joinMonthIndex: 5, // June (0-based)
  endYear: 2026,
  endMonthIndex: 5, // June (0-based)
  monthlyRate: 1.5,
  getUsedForMonth: () => 0,
  // No periodOpeningBalance!
  initialBalance: 0,
});

console.log('=== Ledger by year ===');
console.log(JSON.stringify(result.ledgerByYear, null, 2));
console.log('=== Ledger (current year) ===');
console.log(JSON.stringify(result.ledger, null, 2));
