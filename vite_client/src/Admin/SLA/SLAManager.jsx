import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiAlertTriangle, FiCheckCircle, FiClock } from 'react-icons/fi';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import SLAModal from './SLAModal';
import SLAViolations from './SLAViolations';

const SLAManager = () => {
  const [slas, setSlas] = useState([]);
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSLA, setSelectedSLA] = useState(null);
  const [activeTab, setActiveTab] = useState('slas');

  useEffect(() => {
    fetchSLAs();
    fetchViolations();
  }, []);

  const fetchSLAs = async () => {
    try {
      const response = await axios.get('/v1/admin/sla');
      setSlas(response.data?.data || []);
    } catch (error) {
      toast.error('Failed to fetch SLAs');
    } finally {
      setLoading(false);
    }
  };

  const fetchViolations = async () => {
    try {
      const response = await axios.get('/v1/admin/sla/violations');
      setViolations(response.data?.data?.violations || []);
    } catch (error) {
      toast.error('Failed to fetch violations');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this SLA?')) return;

    try {
      await axios.delete(`/v1/admin/sla/${id}`);
      toast.success('SLA deleted successfully');
      fetchSLAs();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete SLA');
    }
  };

  const handleToggleActive = async (sla) => {
    try {
      await axios.put(`/v1/admin/sla/${sla._id}`, {
        isActive: !sla.isActive
      });
      toast.success(`SLA ${!sla.isActive ? 'activated' : 'deactivated'}`);
      fetchSLAs();
    } catch (error) {
      toast.error('Failed to update SLA');
    }
  };

  const activeViolations = violations.filter(v => v.status === 'Active').length;

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">SLA Management</h1>
            <p className="text-lg text-gray-600">Manage Service Level Agreements and track violations</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium"
          >
            <FiPlus className="w-5 h-5" />
            Create SLA
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total SLAs</p>
                <p className="text-2xl font-bold text-gray-900">{slas.length}</p>
              </div>
              <FiCheckCircle className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active SLAs</p>
                <p className="text-2xl font-bold text-gray-900">
                  {slas.filter(s => s.isActive).length}
                </p>
              </div>
              <FiClock className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Violations</p>
                <p className="text-2xl font-bold text-red-600">{activeViolations}</p>
              </div>
              <FiAlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Violations</p>
                <p className="text-2xl font-bold text-gray-900">{violations.length}</p>
              </div>
              <FiAlertTriangle className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-md mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('slas')}
                className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'slas'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                SLAs
              </button>
              <button
                onClick={() => setActiveTab('violations')}
                className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'violations'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Violations ({activeViolations})
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'slas' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {slas.map((sla) => (
              <div
                key={sla._id}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{sla.name}</h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          sla.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {sla.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          sla.priority === 'Critical' ? 'bg-red-100 text-red-800' :
                          sla.priority === 'High' ? 'bg-orange-100 text-orange-800' :
                          sla.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {sla.priority}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-2">{sla.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="font-medium">Type: {sla.entityType}</span>
                      <span>•</span>
                      <span>Response: {sla.responseTime?.hours || 0}h</span>
                      <span>•</span>
                      <span>Resolution: {sla.resolutionTime?.hours || 0}h</span>
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                      Escalation Levels: {sla.escalationLevels?.length || 0}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setSelectedSLA(sla);
                      setShowEditModal(true);
                    }}
                    className="flex-1 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors font-medium text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(sla)}
                    className={`p-2 rounded-lg transition-colors ${
                      sla.isActive
                        ? 'text-orange-600 hover:bg-orange-50'
                        : 'text-green-600 hover:bg-green-50'
                    }`}
                    title={sla.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {sla.isActive ? <FiCheckCircle className="w-5 h-5" /> : <FiClock className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => handleDelete(sla._id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <FiTrash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <SLAViolations violations={violations} onRefresh={fetchViolations} />
        )}

        {slas.length === 0 && activeTab === 'slas' && !loading && (
          <div className="text-center py-12 bg-white rounded-xl shadow-md">
            <FiAlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No SLAs found</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Create your first SLA
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <SLAModal
          onClose={() => {
            setShowCreateModal(false);
            setSelectedSLA(null);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchSLAs();
          }}
        />
      )}

      {showEditModal && selectedSLA && (
        <SLAModal
          sla={selectedSLA}
          onClose={() => {
            setShowEditModal(false);
            setSelectedSLA(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedSLA(null);
            fetchSLAs();
          }}
        />
      )}
    </div>
  );
};

export default SLAManager;

