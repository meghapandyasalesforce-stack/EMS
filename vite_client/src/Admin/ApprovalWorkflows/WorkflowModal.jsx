import React, { useState, useEffect } from 'react';
import { FiX, FiPlus, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';

const WorkflowModal = ({ workflow, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    entityType: 'Leave',
    isActive: true,
    steps: [],
    autoApprove: {
      enabled: false,
      conditions: {}
    },
    escalation: {
      enabled: true,
      escalateAfterHours: 24,
      escalateTo: 'NextLevel'
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (workflow) {
      setFormData({
        name: workflow.name || '',
        description: workflow.description || '',
        entityType: workflow.entityType || 'Leave',
        isActive: workflow.isActive !== undefined ? workflow.isActive : true,
        steps: workflow.steps || [],
        autoApprove: workflow.autoApprove || { enabled: false, conditions: {} },
        escalation: workflow.escalation || { enabled: true, escalateAfterHours: 24, escalateTo: 'NextLevel' }
      });
    }
  }, [workflow]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (workflow) {
        await axios.put(`/v1/admin/approvals/workflows/${workflow._id}`, formData);
        toast.success('Workflow updated successfully');
      } else {
        await axios.post('/v1/admin/approvals/workflows', formData);
        toast.success('Workflow created successfully');
      }
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save workflow');
    } finally {
      setLoading(false);
    }
  };

  const addStep = () => {
    const stepNumber = formData.steps.length + 1;
    setFormData({
      ...formData,
      steps: [
        ...formData.steps,
        {
          stepNumber,
          stepName: `Step ${stepNumber}`,
          approverType: 'Manager',
          isRequired: true,
          canDelegate: false,
          timeoutHours: 48
        }
      ]
    });
  };

  const updateStep = (index, field, value) => {
    const newSteps = [...formData.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setFormData({ ...formData, steps: newSteps });
  };

  const removeStep = (index) => {
    const newSteps = formData.steps.filter((_, i) => i !== index);
    // Renumber steps
    newSteps.forEach((step, i) => {
      step.stepNumber = i + 1;
    });
    setFormData({ ...formData, steps: newSteps });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {workflow ? 'Edit Workflow' : 'Create Workflow'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Workflow Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Entity Type *</label>
              <select
                value={formData.entityType}
                onChange={(e) => setFormData({ ...formData, entityType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary"
                required
              >
                <option value="Leave">Leave</option>
                <option value="Expense">Expense</option>
                <option value="Document">Document</option>
                <option value="WorkforcePlan">Workforce Plan</option>
                <option value="Project">Project</option>
                <option value="AttendanceRegularization">Attendance Regularization</option>
                <option value="TaxRegimeChange">Tax Regime Change</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary"
              rows="3"
            />
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-semibold text-gray-700">Approval Steps</label>
              <button
                type="button"
                onClick={addStep}
                className="flex items-center gap-2 px-4 py-2 bg-theme-primary text-white rounded-lg hover:opacity-90 transition-colors"
              >
                <FiPlus className="w-4 h-4" />
                Add Step
              </button>
            </div>

            <div className="space-y-4">
              {formData.steps.map((step, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-gray-900">Step {step.stepNumber}</h4>
                    <button
                      type="button"
                      onClick={() => removeStep(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Step Name</label>
                      <input
                        type="text"
                        value={step.stepName}
                        onChange={(e) => updateStep(index, 'stepName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Approver Type</label>
                      <select
                        value={step.approverType}
                        onChange={(e) => updateStep(index, 'approverType', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        required
                      >
                        <option value="Manager">Manager</option>
                        <option value="HR">HR</option>
                        <option value="Finance">Finance</option>
                        <option value="Executive">Executive</option>
                        <option value="Role">Role</option>
                        <option value="Department">Department</option>
                        <option value="Employee">Employee</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Timeout (Hours)</label>
                      <input
                        type="number"
                        value={step.timeoutHours}
                        onChange={(e) => updateStep(index, 'timeoutHours', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        min="1"
                      />
                    </div>
                    <div className="flex items-center gap-4 pt-6">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={step.isRequired}
                          onChange={(e) => updateStep(index, 'isRequired', e.target.checked)}
                          className="w-4 h-4"
                        />
                        Required
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={step.canDelegate}
                          onChange={(e) => updateStep(index, 'canDelegate', e.target.checked)}
                          className="w-4 h-4"
                        />
                        Can Delegate
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-theme-primary text-white rounded-lg hover:opacity-90 transition-colors font-medium disabled:opacity-50"
            >
              {loading ? 'Saving...' : workflow ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkflowModal;

