
import { rollLeaveBalanceThroughPeriod, resolveYearOpeningBalance } from './helpers/leaveBalanceRulesHelper.js';

console.log('=== Testing Year Opening Balance ===');
const rollResult = rollLeaveBalanceThroughPeriod({
  joinYear: 2024,
  joinMonthIndex: 5, // June 2024
  endYear: 2026,
  endMonthIndex: 5, // June 2026
  monthlyRate: 1.5,
  initialBalance:0,
  getUsedForMonth: ()=>0,
});
console.log('rollResult.ledgerByYear:', rollResult.ledgerByYear);
const yearOpening2026 = resolveYearOpeningBalance(rollResult.ledgerByYear, 2026, 2024);
console.log('yearOpeningBalance for 2026:', yearOpening2026);
