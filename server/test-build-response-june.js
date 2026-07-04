
// Mock the dependencies of buildEmployeeLeaveBalanceResponse
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the content of leaveBalanceResponseHelper.js to get the code we need
const helperCode = fs.readFileSync(path.join(__dirname, 'helpers', 'leaveBalanceResponseHelper.js'), 'utf8');

// Mock the imports
const mockLeaveBalanceEngine = {
  calculateBalance: async () => ({
    policy: { policyName: 'Test Policy', leaveTypes: [{ type: 'paid' }] },
    balances: [],
    populate: async function() { return this; },
    toObject: function() { return { ...this, balances: this.balances }; }
  }),
  resolvePersistedOpeningLeaveBalance: async () => ({
    active: true,
    openingYear: 2024,
    openingMonth: 6, // June
    balance: 5,
  }),
  resolveEmployeeBalanceAnchor: async () => null,
  computePooledAvailableLeave: async () => ({
    ledger: [
      { month: 6, previousBalance: 5, credit: 0, used:0, available:5, cumulativeEarned:0, cumulativeUsed:0 },
      { month: 7, previousBalance:5, credit:1.5, used:0, available:6.5, cumulativeEarned:1.5, cumulativeUsed:0 }
    ],
    ledgerByYear: {
      2024: [
        { month: 6, previousBalance:5, credit:0, used:0, available:5, cumulativeEarned:0, cumulativeUsed:0 },
        { month:7, previousBalance:5, credit:1.5, used:0, available:6.5, cumulativeEarned:1.5, cumulativeUsed:0 }
      ]
    },
    yearOpeningBalance:0,
    available:6.5
  }),
  getPooledLeaveTypeConfigs: () => [{ type: 'paid' }],
  endOfMonthDate: (y, m) => new Date(y, m, 0)
};

const mockEmployeeModel = {
  findById: async () => ({
    _id: 'test-employee',
    joiningDate: new Date(2024, 5, 1),
    organizationId: 'test-org'
  })
};

const mockLeaveModel = {
  find: async () => []
};

// Create a temporary module to run the test
const testCode = `
${helperCode}
// Replace imports with mocks
const mockLeaveBalanceEngine = ${JSON.stringify(mockLeaveBalanceEngine, null, 2)};
const mockEmployee = ${JSON.stringify({
  _id: 'test-employee',
  joiningDate: new Date(2024, 5, 1).toISOString(),
  organizationId: 'test-org'
}, null, 2)};

// Override the imported values
import.meta.env = {};
// Now let's call buildEmployeeLeaveBalanceResponse
async function test() {
  console.log('Testing June 2024...');
  const resultJune = await buildEmployeeLeaveBalanceResponse(
    'test-employee',
    2024,
    'test-org',
    { month: 6 }
  );
  console.log('June leaveSummary:', JSON.stringify(resultJune.leaveSummary, null, 2));
  
  console.log('\\nTesting July 2024...');
  const resultJuly = await buildEmployeeLeaveBalanceResponse(
    'test-employee',
    2024,
    'test-org',
    { month: 7 }
  );
  console.log('July leaveSummary:', JSON.stringify(resultJuly.leaveSummary, null, 2));
}

test().catch(console.error);
`;

// We can't easily run this as a module directly, so let's create a simpler test using the logic we know
console.log('Testing the key logic manually...');

// Simulate the variables inside buildEmployeeLeaveBalanceResponse for viewing June 2024
const viewYear = 2024;
const viewMonth = 6;
const periodOpeningBalance = {
  active: true,
  openingYear: 2024,
  openingMonth: 6,
  balance:5
};
const isOpeningMonthView = periodOpeningBalance?.active && viewYear === periodOpeningBalance.openingYear && viewMonth === Number(periodOpeningBalance.openingMonth);
const viewPooledRow = { previousBalance:5, credit:0, used:0, available:5 };
const pooledAvailable = { yearOpeningBalance:0 };

const rollBasedCarriedForward = Math.round((isOpeningMonthView ? periodOpeningBalance.balance : (viewPooledRow?.previousBalance != null ? viewPooledRow.previousBalance : pooledAvailable.yearOpeningBalance ?? 0))*100)/100;

console.log('For June 2024 (opening month):');
console.log('  isOpeningMonthView:', isOpeningMonthView);
console.log('  rollBasedCarriedForward:', rollBasedCarriedForward);

// Simulate viewing July 2024
const viewYear2 = 2024;
const viewMonth2 =7;
const isOpeningMonthView2 = periodOpeningBalance?.active && viewYear2 === periodOpeningBalance.openingYear && viewMonth2 === Number(periodOpeningBalance.openingMonth);
const viewPooledRow2 = { previousBalance:5, credit:1.5, used:0, available:6.5 };
const rollBasedCarriedForward2 = Math.round((isOpeningMonthView2 ? periodOpeningBalance.balance : (viewPooledRow2?.previousBalance != null ? viewPooledRow2.previousBalance : pooledAvailable.yearOpeningBalance ?? 0))*100)/100;

console.log('\\nFor July 2024:');
console.log('  isOpeningMonthView:', isOpeningMonthView2);
console.log('  rollBasedCarriedForward:', rollBasedCarriedForward2);
