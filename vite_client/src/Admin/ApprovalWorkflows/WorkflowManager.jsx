import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiCheckCircle, FiXCircle, FiSettings, FiCalendar, FiClock, FiFileText, FiBriefcase, FiDollarSign, FiArrowRight } from 'react-icons/fi';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import WorkflowModal from './WorkflowModal';
import WorkflowDetail from './WorkflowDetail';
import '../../styles/approvalWorkflows.css';

const WORKFLOW_ENTITY_ICONS = {
  Leave: FiCalendar,
  AttendanceRegularization: FiClock,
  Expense: FiFileText,
  Document: FiFileText,
  Project: FiBriefcase,
  WorkforcePlan: FiBriefcase,
  TaxRegimeChange: FiDollarSign,
};

const WorkflowTypeIcon = ({ entityType }) => {
  const Icon = WORKFLOW_ENTITY_ICONS[entityType] || FiSettings;
  return <Icon />;
};

const workflowTimeoutLabel = (steps = []) => {
  const hours = (Array.isArray(steps) ? steps : []).map(step => step.timeoutHours).filter(value => typeof value === 'number' && Number.isFinite(value) && value > 0);
  if (!hours.length) return null;
  const min = Math.min(...hours);
  const max = Math.max(...hours);
  return min === max ? `${min}h` : `${min}–${max}h`;
};

const workflowEscalationLabel = (escalation) => {
  if (escalation?.enabled === false) return 'Disabled';
  if (escalation?.enabled !== true) return 'Not configured';
  const hours = escalation.escalateAfterHours;
  return typeof hours === 'number' && Number.isFinite(hours) && hours > 0 ? `After ${hours}h` : 'Enabled';
};

const WorkflowManager = () => {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [filter, setFilter] = useState({ entityType: '', isActive: '' });

  useEffect(() => {
    fetchWorkflows();
  }, [filter]);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter.entityType) params.entityType = filter.entityType;
      if (filter.isActive !== '') params.isActive = filter.isActive;

      const response = await axios.get('/v1/admin/approvals/workflows', { params });
      setWorkflows(response.data?.data || []);
    } catch (error) {
      toast.error('Failed to fetch workflows');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this workflow?')) return;

    try {
      await axios.delete(`/v1/admin/approvals/workflows/${id}`);
      toast.success('Workflow deleted successfully');
      fetchWorkflows();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete workflow');
    }
  };

  const handleToggleActive = async (workflow) => {
    try {
      await axios.put(`/v1/admin/approvals/workflows/${workflow._id}`, {
        isActive: !workflow.isActive
      });
      toast.success(`Workflow ${!workflow.isActive ? 'activated' : 'deactivated'}`);
      fetchWorkflows();
    } catch (error) {
      toast.error('Failed to update workflow');
    }
  };

  const handleBackfillRegularization = async () => {
    if (!window.confirm('Backfill pending attendance regularization requests into workflow?')) return;

    try {
      const response = await axios.post('/v1/admin/approvals/backfill/attendance-regularization', {});
      const data = response.data || {};
      const created = data.created ?? data.data?.created ?? 0;
      const alreadyLinked = data.alreadyLinked ?? data.data?.alreadyLinked ?? 0;
      const autoApproved = data.autoApproved ?? data.data?.autoApproved ?? 0;
      const errors = data.errors ?? data.data?.errors ?? [];

      toast.success(
        `Backfill complete: ${created} linked, ${alreadyLinked} already linked, ${autoApproved} auto-approved`
      );

      if (Array.isArray(errors) && errors.length > 0) {
        toast.warning(`${errors.length} requests could not be backfilled. Check server logs for details.`);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to backfill regularization workflow');
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading workflows...</div>;
  }

  return (
    <div className="approval-workflows-page min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="page-shell">
      <div className="page-shell-inner">
      <div className="hrms-stack">
        {/* Header */}
        <div className="workflow-page-header flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Approval Workflows</h1>
            <p className="text-lg text-gray-600">Manage multi-step approval processes</p>
          </div>
          <div className="workflow-page-actions flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleBackfillRegularization}
              className="bg-white text-gray-800 px-6 py-3 rounded-lg border border-gray-300 hover:bg-gray-50 transition-all duration-200 shadow-sm font-medium"
            >
              Backfill Regularization
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-theme-primary text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:opacity-90 transition-all duration-200 shadow-md hover:shadow-lg font-medium"
            >
              <FiPlus className="w-5 h-5" />
              Create Workflow
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="workflow-filters bg-white rounded-xl shadow-md p-6">
          <div className="workflow-filter-grid grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Entity Type</label>
              <select
                value={filter.entityType}
                onChange={(e) => setFilter({ ...filter, entityType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary"
              >
                <option value="">All Types</option>
                <option value="Leave">Leave</option>
                <option value="Expense">Expense</option>
                <option value="Document">Document</option>
                <option value="WorkforcePlan">Workforce Plan</option>
                <option value="Project">Project</option>
                <option value="AttendanceRegularization">Attendance Regularization</option>
                <option value="TaxRegimeChange">Tax Regime Change</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filter.isActive}
                onChange={(e) => setFilter({ ...filter, isActive: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary"
              >
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Workflows List */}
        <div className="workflow-card-grid grid grid-cols-1 lg:grid-cols-2 gap-6">
          {workflows.map((workflow) => (
            <div
              key={workflow._id}
              data-entity={workflow.entityType}
              className="workflow-card bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6"
            >
              <div className="workflow-card-heading">
                <span className="workflow-card-icon" aria-hidden="true"><WorkflowTypeIcon entityType={workflow.entityType} /></span>
                <div className="workflow-card-title">
                  <div className="workflow-card-tags">
                    <span className="workflow-type">{workflow.entityType}</span>
                    {workflowTimeoutLabel(workflow.steps) && <span className="workflow-timeout">Step timeout {workflowTimeoutLabel(workflow.steps)}</span>}
                  </div>
                  <h3>{workflow.name}</h3>
                </div>
                <span className={`workflow-status ${workflow.isActive ? 'is-active' : ''}`}>
                  <span aria-hidden="true" />{workflow.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="workflow-description">{workflow.description}</p>
              <div className="workflow-routing">
                <div className="workflow-routing-label"><span>Approval steps</span><span>{workflow.steps?.length || 0} Steps</span></div>
                {workflow.steps?.length > 0 && <ol className="workflow-step-preview">
                  {workflow.steps.map((step, index) => <li key={step._id || index}>
                    <span>{step.stepNumber || index + 1}</span>{step.stepName || step.approverType}
                    {index < workflow.steps.length - 1 && <FiArrowRight className="workflow-step-arrow" aria-hidden="true" />}
                  </li>)}
                </ol>}
              </div>

              <dl className="workflow-config-summary">
                <div><dt>Auto-approval</dt><dd>{workflow.autoApprove?.enabled === true ? 'Enabled' : workflow.autoApprove?.enabled === false ? 'Disabled' : 'Not configured'}</dd></div>
                <div><dt>Escalation</dt><dd>{workflowEscalationLabel(workflow.escalation)}</dd></div>
              </dl>

              <div className="workflow-card-actions flex items-center gap-2 mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setSelectedWorkflow(workflow);
                    setShowDetail(true);
                  }}
                  className="flex-1 bg-theme-secondary/10 text-theme-secondary px-4 py-2 rounded-lg hover:bg-theme-secondary/10 transition-colors font-medium text-sm"
                >
                  View Details <FiArrowRight aria-hidden="true" />
                </button>
                <button
                  onClick={() => {
                    setSelectedWorkflow(workflow);
                    setShowEditModal(true);
                  }}
                  className="p-2 text-gray-600 hover:text-theme-secondary hover:bg-theme-secondary/10 rounded-lg transition-colors"
                  title="Edit"
                >
                  <FiEdit className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleToggleActive(workflow)}
                  className={`p-2 rounded-lg transition-colors ${
                    workflow.isActive
                      ? 'text-orange-600 hover:bg-orange-50'
                      : 'text-theme-primary hover:bg-theme-primary/10'
                  }`}
                  title={workflow.isActive ? 'Deactivate' : 'Activate'}
                >
                  {workflow.isActive ? <FiXCircle className="w-5 h-5" /> : <FiCheckCircle className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => handleDelete(workflow._id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                >
                  <FiTrash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {workflows.length === 0 && !loading && (
          <div className="workflow-empty text-center py-12 bg-white rounded-xl shadow-md">
            <FiSettings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No workflows found</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-theme-secondary hover:text-theme-secondary font-medium"
            >
              Create your first workflow
            </button>
          </div>
        )}
      </div>
      </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <WorkflowModal
          onClose={() => {
            setShowCreateModal(false);
            setSelectedWorkflow(null);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchWorkflows();
          }}
        />
      )}

      {showEditModal && selectedWorkflow && (
        <WorkflowModal
          workflow={selectedWorkflow}
          onClose={() => {
            setShowEditModal(false);
            setSelectedWorkflow(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedWorkflow(null);
            fetchWorkflows();
          }}
        />
      )}

      {showDetail && selectedWorkflow && (
        <WorkflowDetail
          workflow={selectedWorkflow}
          onClose={() => {
            setShowDetail(false);
            setSelectedWorkflow(null);
          }}
        />
      )}
    </div>
  );
};

export default WorkflowManager;

