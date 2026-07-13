
// Mock the necessary models
const mockEmployee = {
  _id: 'test-employee',
  joiningDate: new Date(2024, 5, 1), // June 2024
  organizationId: 'test-org',
};

const mockLeaveBalance = {
  _id: 'test-balance',
  year: 2026,
  policy: {
    _id: 'test-policy',
    policyName: 'Test Policy',
    leaveTypes: [
      { type: 'paid', enabled: true }
    ],
  },
  balances: [
    {
      leaveType: 'paid',
      available: 0,
      accrued: 0,
      used: 1,
      pending: 0,
    }
  ],
  populate: async () => mockLeaveBalance,
  toObject: () => ({
    _id: 'test-balance',
    year: 2026,
    policy: mockLeaveBalance.policy,
    balances: mockLeaveBalance.balances,
  }),
};

const mockLeaveEngine = {
  calculateBalance: async () => mockLeaveBalance,
  resolvePersistedOpeningLeaveBalance: async () => ({
    active: true,
    openingYear: 2024,
    openingMonth: 5, // May 2024
    balance: 5,
  }),
  resolveEmployeeBalanceAnchor: async () => null,
  computePooledAvailableLeave: async () => {
    // Build a ledger like in our previous test
    const ledgerByYear = {
      2024: [
        {
          month: 6,
          previousBalance: 5,
          credit: 1.5,
          used: 0,
          available: 6.5,
          cumulativeEarned: 1.5,
          cumulativeUsed: 0,
        },
        {
          month: 7,
          previousBalance: 6.5,
          credit: 1.5,
          used: 0,
          available: 8,
          cumulativeEarned: 3,
          cumulativeUsed: 0,
        }
      ],
      2025: Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        previousBalance: 8 + (i * 1.5),
        credit: 1.5,
        used: 0,
        available: 8 + ((i + 1) * 1.5),
        cumulativeEarned: 3 + (i + 1) * 1.5,
        cumulativeUsed: 0,
      })),
      2026: [
        {
          month: 1,
          previousBalance: 26, // 8 + (12*1.5) = 8 + 18 =26
          credit:1.5,
          used:0,
          available:27.5,
          cumulativeEarned: 22.5,
          cumulativeUsed:0,
        },
        {
          month:2,
          previousBalance:27.5,
          credit:1.5,
          used:0,
          available:29,
          cumulativeEarned:24,
          cumulativeUsed:0,
        },
        {
          month:3,
          previousBalance:29,
          credit:1.5,
          used:0,
          available:30.5,
          cumulativeEarned:25.5,
          cumulativeUsed:0,
        },
        {
          month:4,
          previousBalance:30.5,
          credit:1.5,
          used:0,
          available:32,
          cumulativeEarned:27,
          cumulativeUsed:0,
        },
        {
          month:5,
          previousBalance:32,
          credit:1.5,
          used:0,
          available:33.5,
          cumulativeEarned:28.5,
          cumulativeUsed:0,
        },
        {
          month:6,
          previousBalance:33.5,
          credit:1.5,
          used:1, // 1 day used as per user's screenshot
          available:34, // 33.5 + 1.5 -1 = 34
          cumulativeEarned:30,
          cumulativeUsed:1,
        },
      ],
    };

    return {
      ledgerByYear,
      ledger: ledgerByYear[2026],
      available: 34,
      lifetimeEarned:30,
      lifetimeUsed:1,
      yearOpeningBalance: 26, // Dec 2025 closing
    };
  },
  getPooledLeaveTypeConfigs: () => [{ type: 'paid' }],
  endOfMonthDate: (y, m) => new Date(y, m+1, 0),
};

// Now import the function and override the dependencies!
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Override the imports using a module proxy
import('./helpers/leaveBalanceResponseHelper.js').then(async ({ buildEmployeeLeaveBalanceResponse }) => {
  // Let's try to mock the Employee model by overriding it in the module
  // Alternatively, let's read the buildEmployeeLeaveBalanceResponse and just call the part we care about!
  // Wait let's read the file directly and extract the relevant parts!
  const fs = await import('fs');
  const code = fs.readFileSync(join(__dirname, 'helpers/leaveBalanceResponseHelper.js'), 'utf8');
  console.log('Testing rollBasedCarriedForward calculation');

  // Simulate variables inside buildEmployeeLeaveBalanceResponse for user's scenario
  const viewYear = 2026;
  const viewMonth = 6; // June 2026
  const periodOpeningBalance = {
    active: true,
    openingYear: 2024,
    openingMonth: 5,
    balance: 5,
  };
  const isOpeningMonthView = periodOpeningBalance.active && viewYear === periodOpeningBalance.openingYear && viewMonth === periodOpeningBalance.openingMonth;
  console.log('isOpeningMonthView:', isOpeningMonthView); // should be false!

  // Now simulate viewPooledRow
  const pooledAvailable = await mockLeaveEngine.computePooledAvailableLeave();
  const pooledLedgerAtView = pooledAvailable.ledger;
  const viewPooledRow = pooledLedgerAtView.find(r => r.month === viewMonth) || pooledLedgerAtView[pooledLedgerAtView.length - 1];
  console.log('viewPooledRow:', viewPooledRow);
  console.log('viewPooledRow.previousBalance:', viewPooledRow?.previousBalance);

  const rollBasedCarriedForward = Math.round((isOpeningMonthView ? periodOpeningBalance.balance : (viewPooledRow?.previousBalance != null ? viewPooledRow.previousBalance : (pooledAvailable.yearOpeningBalance ?? 0))) * 100)/100;
  console.log('rollBasedCarriedForward:', rollBasedCarriedForward);

  // Now let's simulate zeroPreAccrualSummary and hasManualOverrideAtView
  const zeroPreAccrualSummary = false;
  const hasManualOverrideAtView = false;
  let totalCarriedForwardValue;
  if (zeroPreAccrualSummary) {
    totalCarriedForwardValue = 0;
  } else if (false /*isBeforeAccrualStart and manualCarriedForward*/) {
    totalCarriedForwardValue = null;
  } else {
    totalCarriedForwardValue = rollBasedCarriedForward;
  }

  console.log('totalCarriedForwardValue:', totalCarriedForwardValue);
});
