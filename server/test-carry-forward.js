
// Test buildEmployeeLeaveBalanceResponse
import { buildEmployeeLeaveBalanceResponse } from './helpers/leaveBalanceResponseHelper.js';
import leaveBalanceEngine from './services/leaveBalanceEngine.js';
import mongoose from 'mongoose';

// Let's create mock data
const mockEmployee = {
  _id: new mongoose.Types.ObjectId(),
  joiningDate: new Date(2024, 5, 1), // June 2024
  organizationId: new mongoose.Types.ObjectId(),
};

const mockPolicy = {
  _id: new mongoose.Types.ObjectId(),
  policyName: 'Test Policy',
  leaveTypes: [
    {
      type: 'paid',
      enabled: true,
    },
  ],
};

// Mock the necessary functions
jest.mock('./services/leaveBalanceEngine.js', () => ({
  calculateBalance: jest.fn(),
  resolvePersistedOpeningLeaveBalance: jest.fn(),
  resolveEmployeeBalanceAnchor: jest.fn(),
  computePooledAvailableLeave: jest.fn(),
  getPooledLeaveTypeConfigs: jest.fn().mockReturnValue([{ type: 'paid' }]),
}));

jest.mock('./models/Employee.js', () => ({
  findById: jest.fn().mockResolvedValue(mockEmployee),
}));

jest.mock('./models/LeaveBalance.js', () => ({
  findOne: jest.fn().mockResolvedValue({
    policy: mockPolicy,
    balances: [],
    toObject: jest.fn().mockReturnValue({
      policy: mockPolicy,
      balances: [],
    }),
    populate: jest.fn().mockResolvedValue({
      policy: mockPolicy,
      balances: [],
      toObject: jest.fn().mockReturnValue({
        policy: mockPolicy,
        balances: [],
      }),
    }),
  }),
}));

jest.mock('./models/Leave.js', () => ({
  find: jest.fn().mockResolvedValue([]),
}));

describe('buildEmployeeLeaveBalanceResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should show correct carried forward for opening month', async () => {
    // Mock computePooledAvailableLeave to return our test data
    leaveBalanceEngine.computePooledAvailableLeave.mockResolvedValue({
      ledger: [
        {
          month: 6,
          previousBalance: 5,
          credit: 1.5,
          used: 0,
          available: 6.5,
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
          },
        ],
      },
    });

    // Mock resolvePersistedOpeningLeaveBalance
    leaveBalanceEngine.resolvePersistedOpeningLeaveBalance.mockResolvedValue({
      active: true,
      openingYear: 2024,
      openingMonth: 6,
      balance: 5,
    });

    // Test the build function
    const result = await buildEmployeeLeaveBalanceResponse(
      mockEmployee._id,
      2024,
      mockEmployee.organizationId,
      { month: 6 } // View June
    );

    console.log('Test Result:', JSON.stringify(result?.leaveSummary, null, 2));

    // Verify that carried forward is 5, not 6.5
    expect(result?.leaveSummary?.totalCarriedForward).toBe(5);
  });
});
