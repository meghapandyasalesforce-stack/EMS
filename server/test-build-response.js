
// Let's mock everything to test buildEmployeeLeaveBalanceResponse directly!
import { buildEmployeeLeaveBalanceResponse } from './helpers/leaveBalanceResponseHelper.js';
import * as leaveBalanceEngine from './services/leaveBalanceEngine.js';
import * as leaveBalanceRulesHelper from './helpers/leaveBalanceRulesHelper.js';

// Mock necessary functions
jest.mock('./services/leaveBalanceEngine.js', () => ({
  calculateBalance: jest.fn(),
  resolvePersistedOpeningLeaveBalance: jest.fn(),
  resolveEmployeeBalanceAnchor: jest.fn(),
  computePooledAvailableLeave: jest.fn(),
  getPooledLeaveTypeConfigs: jest.fn().mockReturnValue([{ type: 'paid' }]),
}));

jest.mock('./models/Employee.js', () => ({
  findById: jest.fn().mockResolvedValue({
    _id: 'test-employee-id',
    joiningDate: new Date(2024, 5, 1), // June 2024
    organizationId: 'test-org-id',
  }),
}));

jest.mock('./models/LeaveBalance.js', () => ({
  findOne: jest.fn().mockResolvedValue({
    policy: { _id: 'test-policy-id', leaveTypes: [{ type: 'paid', enabled: true }] },
    balances: [],
    toObject: jest.fn().mockReturnValue({
      policy: { _id: 'test-policy-id', leaveTypes: [{ type: 'paid', enabled: true }] },
      balances: [],
    }),
    populate: jest.fn().mockResolvedValue({
      policy: { _id: 'test-policy-id', leaveTypes: [{ type: 'paid', enabled: true }] },
      balances: [],
      toObject: jest.fn().mockReturnValue({
        policy: { _id: 'test-policy-id', leaveTypes: [{ type: 'paid', enabled: true }] },
        balances: [],
      }),
    }),
  }),
}));

jest.mock('./models/Leave.js', () => ({
  find: jest.fn().mockResolvedValue([]),
}));

async function testBuildResponse() {
  // Mock computePooledAvailableLeave to return specific test data
  leaveBalanceEngine.computePooledAvailableLeave.mockResolvedValue({
    ledger: [
      {
        month: 6, // June
        previousBalance: 5,
        credit: 1.5,
        used: 0,
        available: 6.5,
        cumulativeEarned: 1.5,
        cumulativeUsed: 0,
      },
      {
        month: 7, // July
        previousBalance: 6.5,
        credit: 1.5,
        used: 0,
        available: 8,
        cumulativeEarned: 3,
        cumulativeUsed: 0,
      },
    ],
    ledgerByYear: {
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
        },
      ],
    },
    preJoinCarriedForward: 0,
    yearOpeningBalance: 0,
    available: 8,
    lifetimeEarned: 3,
    lifetimeUsed: 0,
  });

  // Mock resolvePersistedOpeningLeaveBalance to return our opening balance
  leaveBalanceEngine.resolvePersistedOpeningLeaveBalance.mockResolvedValue({
    active: true,
    openingYear: 2024,
    openingMonth: 6, // June
    balance: 5,
  });

  leaveBalanceEngine.resolveEmployeeBalanceAnchor.mockResolvedValue(null);

  // Call buildEmployeeLeaveBalanceResponse for June 2024
  const resultJune = await buildEmployeeLeaveBalanceResponse(
    'test-employee-id',
    2024,
    'test-org-id',
    { month: 6 }
  );
  console.log('June 2024 Result:', JSON.stringify(resultJune?.leaveSummary, null, 2));
  console.log('June viewPooledRow:', resultJune?.balances?.[0]?.monthlyLedger);

  // Call for July
  const resultJuly = await buildEmployeeLeaveBalanceResponse(
    'test-employee-id',
    2024,
    'test-org-id',
    { month: 7 }
  );
  console.log('July 2024 Result:', JSON.stringify(resultJuly?.leaveSummary, null, 2));
}

testBuildResponse().catch(err => console.error(err));
