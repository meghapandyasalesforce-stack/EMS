import { describe, expect, it } from '@jest/globals';
import { buildFnfDashboard } from '../../services/fnfSettlementService.js';

describe('fnf settlement service', () => {
    it('builds dashboard counts and pending amount', () => {
        const stats = buildFnfDashboard([
            { finalSettlement: { status: 'Pending', finalAmount: 1000 } },
            { finalSettlement: { status: 'Calculated', finalAmount: 5000 } },
            { finalSettlement: { status: 'Pending Approval', finalAmount: 8000 } },
            { finalSettlement: { status: 'Approved', finalAmount: 12000 } },
            { finalSettlement: { status: 'Paid', finalAmount: 2000 } },
        ]);
        expect(stats.pending).toBe(1);
        expect(stats.calculated).toBe(1);
        expect(stats.pendingApproval).toBe(1);
        expect(stats.approved).toBe(2);
        expect(stats.totalPendingAmount).toBe(14000);
    });
});
