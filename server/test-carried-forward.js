
import { rollLeaveBalanceThroughPeriod, roundLeaveDays, calendarMonthSortKey } from './helpers/leaveBalanceRulesHelper.js';

console.log('=== Testing Total Carried Forward Logic ===');

// Test Case 1: Employee joins June 2024, no opening balance, view June:
console.log('\nTest 1: View June 2024 (joining month, no opening balance)');
const juneRoll = rollLeaveBalanceThroughPeriod({
  joinYear: 2024,
  joinMonthIndex: 5,
  endYear: 2024,
  endMonthIndex: 5,
  monthlyRate: 1.5,
  initialBalance: 0,
  getUsedForMonth: () => 0,
});
const juneViewRow = juneRoll.ledgerByYear[2024].find(r => r.month === 6);
console.log('viewPooledRow:', juneViewRow);
console.log('viewPooledRow.previousBalance:', juneViewRow?.previousBalance);
console.log('juneRoll.yearOpeningBalance:', juneRoll.yearOpeningBalance);
const juneCarriedForward = juneViewRow?.previousBalance ?? juneRoll.yearOpeningBalance ?? 0;
console.log('Total Carried Forward:', juneCarriedForward);

// Test Case 2: View July 2024, no opening balance:
console.log('\nTest 2: View July 2024');
const julyRoll = rollLeaveBalanceThroughPeriod({
  joinYear: 2024,
  joinMonthIndex:5,
  endYear:2024,
  endMonthIndex:6,
  monthlyRate:1.5,
  initialBalance:0,
  getUsedForMonth:()=>0,
});
const julyViewRow = julyRoll.ledgerByYear[2024].find(r => r.month === 7);
console.log('viewPooledRow:', julyViewRow);
console.log('viewPooledRow.previousBalance:', julyViewRow?.previousBalance);
const julyCarriedForward = julyViewRow?.previousBalance ?? julyRoll.yearOpeningBalance ?? 0;
console.log('Total Carried Forward:', julyCarriedForward);

// Test Case3: With opening balance, view opening month:
console.log('\nTest3: View May 2024 (opening month, opening balance=5)');
const mayRoll = rollLeaveBalanceThroughPeriod({
  joinYear:2024, joinMonthIndex:5,
  endYear:2024, endMonthIndex:4, // May (month index4)
  monthlyRate:1.5,
  periodOpeningBalance: {openingYear:2024, openingMonth:5, balance:5},
  initialBalance:5,
  getUsedForMonth:()=>0,
});
console.log('mayRoll.ledgerByYear[2024]:', mayRoll.ledgerByYear[2024]);
