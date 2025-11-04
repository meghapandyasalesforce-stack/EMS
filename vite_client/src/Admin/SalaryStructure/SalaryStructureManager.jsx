import React, { useState, useEffect } from 'react';
import { 
  FiDollarSign, 
  FiPlus, 
  FiEdit, 
  FiTrash2, 
  FiUsers, 
  FiSettings, 
  FiTrendingUp,
  FiTrendingDown,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiEye,
  FiSave,
  FiX,
  FiCalendar,
  FiUser,
  FiTarget,
  FiAward,
  FiPercent,
  FiCreditCard
} from 'react-icons/fi';
import { FaCalculator, FaMoneyBillWave } from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';

const SalaryStructureManager = () => {
  const [structures, setStructures] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showCalculateModal, setShowCalculateModal] = useState(false);
  const [selectedStructure, setSelectedStructure] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [calculatedSalary, setCalculatedSalary] = useState(null);

  // Structure form state
  const [structureForm, setStructureForm] = useState({
    name: '',
    description: '',
    applicableTo: 'all',
    applicableValues: [],
    earnings: {
      basicWage: { percentage: 0, fixedAmount: 0, isPercentage: true },
      houseRentAllowance: { percentage: 0, fixedAmount: 0, isPercentage: true },
      transportAllowance: { percentage: 0, fixedAmount: 0, isPercentage: true },
      medicalAllowance: { percentage: 0, fixedAmount: 0, isPercentage: true },
      specialAllowance: { percentage: 0, fixedAmount: 0, isPercentage: true },
      pfEmployer: { percentage: 12, fixedAmount: 0, isPercentage: true },
      esiEmployer: { percentage: 3.25, fixedAmount: 0, isPercentage: true }
    },
    deductions: {
      pfEmployee: { percentage: 12, fixedAmount: 0, isPercentage: true },
      esiEmployee: { percentage: 0.75, fixedAmount: 0, isPercentage: true },
      professionalTax: { percentage: 0, fixedAmount: 0, isPercentage: false },
      incomeTax: { percentage: 0, fixedAmount: 0, isPercentage: true }
    },
    bonusStructure: {
      performanceBonus: { enabled: false, percentage: 0, maxAmount: 0 },
      projectBonus: { enabled: false, percentage: 0, maxAmount: 0 },
      attendanceBonus: { enabled: false, percentage: 0, maxAmount: 0 }
    },
    overtimeRules: {
      enabled: true,
      rate: 1.5,
      maxHoursPerDay: 4,
      maxHoursPerMonth: 50
    }
  });

  useEffect(() => {
    fetchStructures();
    fetchEmployees();
  }, []);

  const fetchStructures = async () => {
    try {
      const response = await axios.get('/v1/admin/salary-structure');
      setStructures(response.data);
    } catch (error) {
      console.error('Error fetching structures:', error);
      toast.error('Failed to fetch salary structures');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await axios.get('/v1/employee/auth/get-all-employees');
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to fetch employees');
    }
  };

  const handleCreateStructure = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/v1/admin/salary-structure', structureForm);
      toast.success('Salary structure created successfully');
      setShowCreateModal(false);
      resetForm();
      fetchStructures();
    } catch (error) {
      console.error('Error creating structure:', error);
      toast.error(error.response?.data?.message || 'Failed to create salary structure');
    }
  };

  const handleUpdateStructure = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`/v1/admin/salary-structure/${selectedStructure._id}`, structureForm);
      toast.success('Salary structure updated successfully');
      setShowEditModal(false);
      resetForm();
      fetchStructures();
    } catch (error) {
      console.error('Error updating structure:', error);
      toast.error(error.response?.data?.message || 'Failed to update salary structure');
    }
  };

  const handleDeleteStructure = async (structureId) => {
    if (window.confirm('Are you sure you want to delete this salary structure?')) {
      try {
        await axios.delete(`/v1/admin/salary-structure/${structureId}`);
        toast.success('Salary structure deleted successfully');
        fetchStructures();
      } catch (error) {
        console.error('Error deleting structure:', error);
        toast.error(error.response?.data?.message || 'Failed to delete salary structure');
      }
    }
  };

  const handleApplyStructure = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/v1/admin/salary-structure/apply', {
        employeeId: selectedEmployee,
        structureId: selectedStructure._id
      });
      toast.success('Salary structure applied successfully');
      setShowApplyModal(false);
      setSelectedEmployee(null);
      setSelectedStructure(null);
    } catch (error) {
      console.error('Error applying structure:', error);
      toast.error(error.response?.data?.message || 'Failed to apply salary structure');
    }
  };

  const handleCalculateSalary = async () => {
    if (!selectedEmployee || !selectedStructure) return;
    
    try {
      const response = await axios.get(
        `/v1/admin/salary-structure/calculate/${selectedStructure._id}/${selectedEmployee}`
      );
      setCalculatedSalary(response.data);
      setShowCalculateModal(true);
    } catch (error) {
      console.error('Error calculating salary:', error);
      toast.error('Failed to calculate salary');
    }
  };

  const resetForm = () => {
    setStructureForm({
      name: '',
      description: '',
      applicableTo: 'all',
      applicableValues: [],
      earnings: {
        basicWage: { percentage: 0, fixedAmount: 0, isPercentage: true },
        houseRentAllowance: { percentage: 0, fixedAmount: 0, isPercentage: true },
        transportAllowance: { percentage: 0, fixedAmount: 0, isPercentage: true },
        medicalAllowance: { percentage: 0, fixedAmount: 0, isPercentage: true },
        specialAllowance: { percentage: 0, fixedAmount: 0, isPercentage: true },
        pfEmployer: { percentage: 12, fixedAmount: 0, isPercentage: true },
        esiEmployer: { percentage: 3.25, fixedAmount: 0, isPercentage: true }
      },
      deductions: {
        pfEmployee: { percentage: 12, fixedAmount: 0, isPercentage: true },
        esiEmployee: { percentage: 0.75, fixedAmount: 0, isPercentage: true },
        professionalTax: { percentage: 0, fixedAmount: 0, isPercentage: false },
        incomeTax: { percentage: 0, fixedAmount: 0, isPercentage: true }
      },
      bonusStructure: {
        performanceBonus: { enabled: false, percentage: 0, maxAmount: 0 },
        projectBonus: { enabled: false, percentage: 0, maxAmount: 0 },
        attendanceBonus: { enabled: false, percentage: 0, maxAmount: 0 }
      },
      overtimeRules: {
        enabled: true,
        rate: 1.5,
        maxHoursPerDay: 4,
        maxHoursPerMonth: 50
      }
    });
    setSelectedStructure(null);
  };

  const openEditModal = (structure) => {
    setSelectedStructure(structure);
    setStructureForm({
      name: structure.name,
      description: structure.description,
      applicableTo: structure.applicableTo,
      applicableValues: structure.applicableValues || [],
      earnings: structure.earnings,
      deductions: structure.deductions,
      bonusStructure: structure.bonusStructure,
      overtimeRules: structure.overtimeRules
    });
    setShowEditModal(true);
  };

  const openApplyModal = (structure) => {
    setSelectedStructure(structure);
    setShowApplyModal(true);
  };

  const openCalculateModal = (structure) => {
    setSelectedStructure(structure);
    setShowCalculateModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaMoneyBillWave className="w-8 h-8 text-white animate-pulse" />
          </div>
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-500 mx-auto"></div>
          <p className="text-gray-600 mt-4 font-medium">Loading salary structures...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 ml-0 lg:ml-64 p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl p-6 md:p-8 shadow-2xl border border-white/20">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                <FaMoneyBillWave className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
                  Salary Structure Management
                </h1>
                <p className="text-lg text-gray-600 flex items-center gap-2">
                  <FiTarget className="w-5 h-5" />
                  Create and manage comprehensive salary structures for employees
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-6 py-3 rounded-xl flex items-center gap-3 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
              >
                <FiPlus className="w-5 h-5" />
                <span>Create Structure</span>
              </button>
            </div>
          </div>
        </div>

        {/* Structures List */}
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl p-6 md:p-8 shadow-2xl border border-white/20">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
              <FiDollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Salary Structures</h2>
              <p className="text-gray-600">Manage your organization's salary structures</p>
            </div>
            <div className="ml-auto">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-xl font-semibold text-sm">
                {structures.length} Structures
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {structures.map(structure => (
              <div 
                key={structure._id} 
                className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 hover:border-indigo-300 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                      <FiDollarSign className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg mb-1">{structure.name}</h3>
                      <p className="text-sm text-gray-600 capitalize flex items-center gap-1">
                        <FiUser className="w-4 h-4" />
                        {structure.applicableTo}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => openCalculateModal(structure)}
                      className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all duration-200 hover:scale-110"
                      title="Calculate Salary"
                    >
                      <FaCalculator className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openApplyModal(structure)}
                      className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-xl transition-all duration-200 hover:scale-110"
                      title="Apply to Employee"
                    >
                      <FiUsers className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(structure)}
                      className="p-2 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 rounded-xl transition-all duration-200 hover:scale-110"
                      title="Edit Structure"
                    >
                      <FiEdit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteStructure(structure._id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200 hover:scale-110"
                      title="Delete Structure"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{structure.description}</p>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 flex items-center gap-1">
                      <FiTarget className="w-4 h-4" />
                      Applicable To:
                    </span>
                    <span className="font-semibold text-gray-900 capitalize">{structure.applicableTo}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 flex items-center gap-1">
                      <FiCalendar className="w-4 h-4" />
                      Created:
                    </span>
                    <span className="font-semibold text-gray-900">
                      {new Date(structure.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 flex items-center gap-1">
                      <FiCheckCircle className="w-4 h-4" />
                      Status:
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                      structure.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {structure.isActive ? (
                        <>
                          <FiCheckCircle className="w-3 h-3" />
                          Active
                        </>
                      ) : (
                        <>
                          <FiXCircle className="w-3 h-3" />
                          Inactive
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {structures.length === 0 && (
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl p-12 shadow-2xl border border-white/20 text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <FiDollarSign className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">No Salary Structures</h3>
            <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
              Create your first salary structure to start managing employee compensation effectively
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-8 py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 flex items-center gap-3 mx-auto"
            >
              <FiPlus className="w-5 h-5" />
              Create Your First Structure
            </button>
          </div>
        )}
        </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <StructureModal
          title={showCreateModal ? 'Create Salary Structure' : 'Edit Salary Structure'}
          formData={structureForm}
          setFormData={setStructureForm}
          onSubmit={showCreateModal ? handleCreateStructure : handleUpdateStructure}
          onClose={() => {
            setShowCreateModal(false);
            setShowEditModal(false);
            resetForm();
          }}
          employees={employees}
        />
      )}

      {/* Apply Modal */}
      {showApplyModal && (
        <ApplyModal
          structure={selectedStructure}
          employees={employees}
          selectedEmployee={selectedEmployee}
          setSelectedEmployee={setSelectedEmployee}
          onSubmit={handleApplyStructure}
          onClose={() => {
            setShowApplyModal(false);
            setSelectedEmployee(null);
            setSelectedStructure(null);
          }}
        />
      )}

      {/* Calculate Modal */}
      {showCalculateModal && (
        <CalculateModal
          structure={selectedStructure}
          employees={employees}
          selectedEmployee={selectedEmployee}
          setSelectedEmployee={setSelectedEmployee}
          calculatedSalary={calculatedSalary}
          onCalculate={handleCalculateSalary}
          onClose={() => {
            setShowCalculateModal(false);
            setSelectedEmployee(null);
            setSelectedStructure(null);
            setCalculatedSalary(null);
          }}
        />
      )}
    </div>
  );
};

// Structure Modal Component
const StructureModal = ({ title, formData, setFormData, onSubmit, onClose }) => {
  const handleEarningChange = (field, key, value) => {
    setFormData({
      ...formData,
      earnings: {
        ...formData.earnings,
        [field]: {
          ...formData.earnings[field],
          [key]: value
        }
      }
    });
  };

  const handleDeductionChange = (field, key, value) => {
    setFormData({
      ...formData,
      deductions: {
        ...formData.deductions,
        [field]: {
          ...formData.deductions[field],
          [key]: value
        }
      }
    });
  };

  const handleBonusChange = (field, key, value) => {
    setFormData({
      ...formData,
      bonusStructure: {
        ...formData.bonusStructure,
        [field]: {
          ...formData.bonusStructure[field],
          [key]: value
        }
      }
    });
  };

  const handleOvertimeChange = (key, value) => {
    setFormData({
      ...formData,
      overtimeRules: {
        ...formData.overtimeRules,
        [key]: value
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center">
            <FiSettings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
            <p className="text-gray-600">Configure salary structure details and rules</p>
          </div>
        </div>
        
        <form onSubmit={onSubmit} className="space-y-8">
          {/* Basic Information */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <FiUser className="w-4 h-4 text-white" />
              </div>
              <h4 className="text-lg font-bold text-gray-900">Basic Information</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Structure Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                  placeholder="Enter structure name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Applicable To
                </label>
                <select
                  value={formData.applicableTo}
                  onChange={(e) => setFormData({ ...formData, applicableTo: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                >
                  <option value="all">All Employees</option>
                  <option value="department">Department</option>
                  <option value="position">Position</option>
                  <option value="level">Role Level</option>
                </select>
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 resize-none"
                rows="3"
                placeholder="Describe this salary structure..."
              />
            </div>
          </div>

          {/* Earnings Section */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                <FiTrendingUp className="w-4 h-4 text-white" />
              </div>
              <h4 className="text-lg font-bold text-gray-900">Earnings</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(formData.earnings).map(([field, config]) => (
                <div key={field} className="bg-white rounded-xl p-4 border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-3 capitalize">
                    {field.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.01"
                      value={config.isPercentage ? config.percentage : config.fixedAmount}
                      onChange={(e) => handleEarningChange(field, config.isPercentage ? 'percentage' : 'fixedAmount', parseFloat(e.target.value) || 0)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                      placeholder="0.00"
                    />
                    <select
                      value={config.isPercentage ? 'percentage' : 'fixed'}
                      onChange={(e) => handleEarningChange(field, 'isPercentage', e.target.value === 'percentage')}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                    >
                      <option value="percentage">%</option>
                      <option value="fixed">₹</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Deductions Section */}
          <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-pink-600 rounded-lg flex items-center justify-center">
                <FiTrendingDown className="w-4 h-4 text-white" />
              </div>
              <h4 className="text-lg font-bold text-gray-900">Deductions</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(formData.deductions).map(([field, config]) => (
                <div key={field} className="bg-white rounded-xl p-4 border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-3 capitalize">
                    {field.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.01"
                      value={config.isPercentage ? config.percentage : config.fixedAmount}
                      onChange={(e) => handleDeductionChange(field, config.isPercentage ? 'percentage' : 'fixedAmount', parseFloat(e.target.value) || 0)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200"
                      placeholder="0.00"
                    />
                    <select
                      value={config.isPercentage ? 'percentage' : 'fixed'}
                      onChange={(e) => handleDeductionChange(field, 'isPercentage', e.target.value === 'percentage')}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200"
                    >
                      <option value="percentage">%</option>
                      <option value="fixed">₹</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bonus Structure */}
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center">
                <FiAward className="w-4 h-4 text-white" />
              </div>
              <h4 className="text-lg font-bold text-gray-900">Bonus Structure</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(formData.bonusStructure).map(([field, config]) => (
                <div key={field} className="bg-white rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-semibold text-gray-700 capitalize">
                      {field.replace(/([A-Z])/g, ' $1').trim()}
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(e) => handleBonusChange(field, 'enabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                    </label>
                  </div>
                  {config.enabled && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-2">Percentage</label>
                        <input
                          type="number"
                          step="0.01"
                          value={config.percentage}
                          onChange={(e) => handleBonusChange(field, 'percentage', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all duration-200"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-2">Max Amount (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={config.maxAmount}
                          onChange={(e) => handleBonusChange(field, 'maxAmount', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all duration-200"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Overtime Rules */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <FiClock className="w-4 h-4 text-white" />
              </div>
              <h4 className="text-lg font-bold text-gray-900">Overtime Rules</h4>
            </div>
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-white rounded-xl p-4 border border-gray-200">
                <label className="text-sm font-semibold text-gray-700">Enable Overtime</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.overtimeRules.enabled}
                    onChange={(e) => handleOvertimeChange('enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                </label>
              </div>
              {formData.overtimeRules.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Rate (x)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.overtimeRules.rate}
                      onChange={(e) => handleOvertimeChange('rate', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
                      placeholder="1.5"
                    />
                  </div>
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Max Hours/Day</label>
                    <input
                      type="number"
                      value={formData.overtimeRules.maxHoursPerDay}
                      onChange={(e) => handleOvertimeChange('maxHoursPerDay', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
                      placeholder="4"
                    />
                  </div>
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Max Hours/Month</label>
                    <input
                      type="number"
                      value={formData.overtimeRules.maxHoursPerMonth}
                      onChange={(e) => handleOvertimeChange('maxHoursPerMonth', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
                      placeholder="50"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border-2 border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50 font-semibold rounded-xl transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 flex items-center gap-2"
            >
              <FiSave className="w-4 h-4" />
              {title.includes('Create') ? 'Create Structure' : 'Update Structure'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Apply Modal Component
const ApplyModal = ({ structure, employees, selectedEmployee, setSelectedEmployee, onSubmit, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl border border-white/20">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center">
            <FiUsers className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Apply Salary Structure</h3>
            <p className="text-gray-600">Assign this structure to an employee</p>
          </div>
        </div>
        
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Structure
            </label>
            <input
              type="text"
              value={structure?.name || ''}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 font-medium text-gray-700"
              disabled
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Employee
            </label>
            <select
              value={selectedEmployee || ''}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
              required
            >
              <option value="">Choose an employee...</option>
              {employees.map(employee => (
                <option key={employee._id} value={employee._id}>
                  {employee.name} {employee.lastName} - {employee.employeeId}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border-2 border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50 font-semibold rounded-xl transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 flex items-center gap-2"
            >
              <FiUsers className="w-4 h-4" />
              Apply Structure
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Calculate Modal Component
const CalculateModal = ({ structure, employees, selectedEmployee, setSelectedEmployee, calculatedSalary, onCalculate, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-3xl shadow-2xl border border-white/20">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
            <FaCalculator className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Calculate Salary</h3>
            <p className="text-gray-600">Calculate salary based on structure and employee data</p>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Structure
            </label>
            <input
              type="text"
              value={structure?.name || ''}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 font-medium text-gray-700"
              disabled
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Employee
            </label>
            <select
              value={selectedEmployee || ''}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            >
              <option value="">Choose an employee...</option>
              {employees.map(employee => (
                <option key={employee._id} value={employee._id}>
                  {employee.name} {employee.lastName} - ₹{employee.salary}
                </option>
              ))}
            </select>
          </div>

          {selectedEmployee && (
            <button
              onClick={onCalculate}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white py-3 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 flex items-center justify-center gap-2"
            >
              <FaCalculator className="w-5 h-5" />
              Calculate Salary
            </button>
          )}

          {calculatedSalary && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <FiDollarSign className="w-4 h-4 text-white" />
                </div>
                <h4 className="text-lg font-bold text-gray-900">Calculated Salary Breakdown</h4>
              </div>
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-gray-600">Basic Salary:</span>
                    <span className="text-lg font-bold text-gray-900">₹{calculatedSalary.employee.currentSalary}</span>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-gray-600">Total Earnings:</span>
                    <span className="text-lg font-bold text-green-600">₹{calculatedSalary.calculatedSalary.totalEarnings}</span>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-gray-600">Total Deductions:</span>
                    <span className="text-lg font-bold text-red-600">₹{calculatedSalary.calculatedSalary.totalDeductions}</span>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-4 text-white">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold">Net Salary:</span>
                    <span className="text-2xl font-bold">₹{calculatedSalary.calculatedSalary.netSalary}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-6">
          <button
            onClick={onClose}
            className="px-6 py-3 border-2 border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50 font-semibold rounded-xl transition-all duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalaryStructureManager;
