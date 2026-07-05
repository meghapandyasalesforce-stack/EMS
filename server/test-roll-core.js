
import { rollLeaveBalanceThroughPeriod, roundLeaveDays, calendarMonthSortKey } from './helpers/leaveBalanceRulesHelper.js';

console.log('=== Testing User Scenario ===');
console.log('Employee joining June 2024, opening balance May 2024 = 5 days');

// Test June 2024 (view month 6, endMonthIndex 5):
const juneResult = rollLeaveBalanceThroughPeriod({
  joinYear: 2024,
  joinMonthIndex: 5, // June
  endYear: 2024,
  endMonthIndex: 5, // June
  monthlyRate: 1.5,
  periodOpeningBalance: {
    openingYear: 2024,
    openingMonth: 5, // May
    balance: 5,
  },
  initialBalance: 5,
  getUsedForMonth: () => 0,
});
console.log('\nJune 2024 result:');
console.log('  ledger:', juneResult.ledgerByYear[2024]);
console.log('  available:', juneResult.available);
console.log('  calculationStartMonth:', juneResult.calculationStartMonth);
console.log('  loopStartMonth:', juneResult.loopStartMonth);

// Test July 2024 (endMonthIndex 6):
const julyResult = rollLeaveBalanceThroughPeriod({
  joinYear: 2024,
  joinMonthIndex: 5, // June
  endYear: 2024,
  endMonthIndex: 6, // July
  monthlyRate: 1.5,
  periodOpeningBalance: {
    openingYear: 2024,
    openingMonth: 5, // May
    balance: 5,
  },
  initialBalance: 5,
  getUsedForMonth: () => 0,
});
console.log('\nJuly 2024 result:');
console.log('  ledger:', julyResult.ledgerByYear[2024]);
console.log('  available:', julyResult.available);
