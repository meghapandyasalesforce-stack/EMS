import React, { useState, useEffect } from 'react';
import { FiX, FiPlus, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';

const SLAModal = ({ sla, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    entityType: 'Leave',
    priority: 'Medium',
    responseTime: {
      hours: 24,
      businessHoursOnly: false
    },
    resolutionTime: {
      hours: 48,
      businessHoursOnly: false
    },
    escalationLevels: [],
    conditions: {}
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sla) {
      setFormData({
        name: sla.name || '',
        description: sla.description || '',
        entityType: sla.entityType || 'Leave',
        priority: sla.priority || 'Medium',
        responseTime: sla.responseTime || { hours: 24, businessHoursOnly: false },
        resolutionTime: sla.resolutionTime || { hours: 48, businessHoursOnly: false },
        escalationLevels: sla.escalationLevels || [],
        conditions: sla.conditions || {}
      });
    }
  }, [sla]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (sla) {
        await axios.put(`/v1/admin/sla/${sla._id}`, formData);
        toast.success('SLA updated successfully');
      } else {
        await axios.post('/v1/admin/sla', formData);
        toast.success('SLA created successfully');
      }
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save SLA');
    } finally {
      setLoading(false);
    }
  };

  const addEscalationLevel = () => {
    const level = formData.escalationLevels.length + 1;
    setFormData({
      ...formData,
      escalationLevels: [
        ...formData.escalationLevels,
        {
          level,
          name: `Level ${level}`,
          triggerAfterHours: 24 * level,
          notifyTo: 'Manager',
          actions: ['Notify']
        }
      ]
    });
  };

  const updateEscalationLevel = (index, field, value) => {
    const newLevels = [...formData.escalationLevels];
    newLevels[index] = { ...newLevels[index], [field]: value };
    setFormData({ ...formData, escalationLevels: newLevels });
  };

  const removeEscalationLevel = (index) => {
    const newLevels = formData.escalationLevels.filter((_, i) => i !== index);
    newLevels.forEach((level, i) => {
      level.level = i + 1;
    });
    setFormData({ ...formData, escalationLevels: newLevels });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {sla ? 'Edit SLA' : 'Create SLA'}
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">SLA Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Entity Type *</label>
              <select
                value={formData.entityType}
                onChange={(e) => setFormData({ ...formData, entityType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="Leave">Leave</option>
                <option value="Expense">Expense</option>
                <option value="Document">Document</option>
                <option value="Helpdesk">Helpdesk</option>
                <option value="Attendance">Attendance</option>
                <option value="Project">Project</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows="3"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>

          {/* Response Time */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Response Time</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hours</label>
                <input
                  type="number"
                  value={formData.responseTime.hours}
                  onChange={(e) => setFormData({
                    ...formData,
                    responseTime: { ...formData.responseTime, hours: parseInt(e.target.value) }
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  min="1"
                  required
                />
              </div>
              <div className="flex items-center pt-8">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.responseTime.businessHoursOnly}
                    onChange={(e) => setFormData({
                      ...formData,
                      responseTime: { ...formData.responseTime, businessHoursOnly: e.target.checked }
                    })}
                    className="w-4 h-4"
                  />
                  Business Hours Only
                </label>
              </div>
            </div>
          </div>

          {/* Resolution Time */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resolution Time</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hours</label>
                <input
                  type="number"
                  value={formData.resolutionTime.hours}
                  onChange={(e) => setFormData({
                    ...formData,
                    resolutionTime: { ...formData.resolutionTime, hours: parseInt(e.target.value) }
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  min="1"
                  required
                />
              </div>
              <div className="flex items-center pt-8">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.resolutionTime.businessHoursOnly}
                    onChange={(e) => setFormData({
                      ...formData,
                      resolutionTime: { ...formData.resolutionTime, businessHoursOnly: e.target.checked }
                    })}
                    className="w-4 h-4"
                  />
                  Business Hours Only
                </label>
              </div>
            </div>
          </div>

          {/* Escalation Levels */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Escalation Levels</h3>
              <button
                type="button"
                onClick={addEscalationLevel}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FiPlus className="w-4 h-4" />
                Add Level
              </button>
            </div>

            <div className="space-y-4">
              {formData.escalationLevels.map((level, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-gray-900">Level {level.level}: {level.name}</h4>
                    <button
                      type="button"
                      onClick={() => removeEscalationLevel(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Level Name</label>
                      <input
                        type="text"
                        value={level.name}
                        onChange={(e) => updateEscalationLevel(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Trigger After (Hours)</label>
                      <input
                        type="number"
                        value={level.triggerAfterHours}
                        onChange={(e) => updateEscalationLevel(index, 'triggerAfterHours', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        min="1"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Notify To</label>
                      <select
                        value={level.notifyTo}
                        onChange={(e) => updateEscalationLevel(index, 'notifyTo', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        required
                      >
                        <option value="Manager">Manager</option>
                        <option value="HR">HR</option>
                        <option value="Executive">Executive</option>
                        <option value="Role">Role</option>
                        <option value="Department">Department</option>
                        <option value="Employee">Employee</option>
                      </select>
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
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
            >
              {loading ? 'Saving...' : sla ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SLAModal;

