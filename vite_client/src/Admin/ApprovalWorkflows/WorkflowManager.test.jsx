import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import WorkflowManager from './WorkflowManager';
import axios from '../../utils/axios';
vi.mock('../../utils/axios', () => ({ default: { get: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
const base = { _id: 'workflow', name: 'Leave Approval', description: 'Manager then HR', entityType: 'Leave', isActive: true };
async function preview(config) {
    axios.get.mockResolvedValue({ data: { data: [{ ...base, ...config }] } });
    const result = render(<WorkflowManager />);
    await screen.findByRole('heading', { name: base.name });
    return result;
}
describe('workflow card configuration details', () => {
    it('shows saved step timeout ranges, auto-approval and escalation settings', async () => {
        await preview({ steps: [{ stepNumber: 1, stepName: 'Manager', timeoutHours: 48 }, { stepNumber: 2, stepName: 'HR', timeoutHours: 24 }], autoApprove: { enabled: true }, escalation: { enabled: true, escalateAfterHours: 12 } });
        expect(screen.getByText('Step timeout 24–48h')).toBeInTheDocument();
        expect(screen.getByText('Enabled', { exact: true })).toBeInTheDocument();
        expect(screen.getByText('After 12h')).toBeInTheDocument();
        expect(axios.get).toHaveBeenCalledTimes(1);
        expect(axios.get).toHaveBeenCalledWith('/v1/admin/approvals/workflows', { params: {} });
    });
    it('uses a single timeout when all configured step timeouts match', async () => {
        await preview({ steps: [{ timeoutHours: 24 }, { timeoutHours: 24 }] });
        expect(screen.getByText('Step timeout 24h')).toBeInTheDocument();
    });
    it('shows disabled settings without presenting saved escalation hours as active', async () => {
        await preview({ steps: [], autoApprove: { enabled: false }, escalation: { enabled: false, escalateAfterHours: 24 } });
        expect(screen.getAllByText('Disabled', { exact: true })).toHaveLength(2);
        expect(screen.queryByText('After 24h')).not.toBeInTheDocument();
    });
    it('handles missing legacy configuration without inventing values', async () => {
        const { container } = await preview({ steps: null });
        expect(screen.getAllByText('Not configured', { exact: true })).toHaveLength(2);
        expect(container.querySelector('.workflow-timeout')).toBeNull();
    });
    it('omits invalid durations and retains known enabled settings', async () => {
        const { container } = await preview({ steps: [{ timeoutHours: -1 }, { timeoutHours: 0 }], escalation: { enabled: true, escalateAfterHours: -1 } });
        expect(container.querySelector('.workflow-timeout')).toBeNull();
        expect(screen.getByText('Enabled', { exact: true })).toBeInTheDocument();
    });
});
