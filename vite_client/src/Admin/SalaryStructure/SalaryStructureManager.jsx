import React, { useEffect, useMemo, useState } from "react";
import {
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiEdit,
  FiPlus,
  FiSave,
  FiSettings,
  FiTarget,
  FiTrash2,
  FiTrendingDown,
  FiTrendingUp,
  FiUser,
  FiUsers,
  FiXCircle
} from "react-icons/fi";
import { FaCalculator } from "react-icons/fa";
import { toast } from "react-toastify";
import axios from "../../utils/axios";

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
      // Removed console.error for production
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
      // Removed console.error for production
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
      // Removed console.error for production
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
      // Removed console.error for production
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
        // Removed console.error for production
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
      // Removed console.error for production
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
      // Removed console.error for production
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

  const totalStructures = structures.length;
  const activeStructures = useMemo(
    () => structures.filter((structure) => structure?.isActive).length,
    [structures]
  );
  const avgDeductions = useMemo(() => {
    if (!structures.length) return 0;
    const total = structures.reduce((sum, structure) => {
      const deductionPercent = Object.values(structure?.deductions || {}).reduce((sub, value) => {
        const parsed = Number(value?.percentage || 0);
        return sub + (Number.isFinite(parsed) ? parsed : 0);
      }, 0);
      return sum + deductionPercent;
    }, 0);
    return total / structures.length;
  }, [structures]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F3F7F5] flex items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-500" />
          <p className="mt-3 text-sm font-medium text-slate-600">Loading salary structures...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F7F5]">
      <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 sm:py-6 md:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Salary Structure Management</h1>
            <p className="mt-1 text-sm text-slate-500">
              Configure earnings, deductions, bonus rules and overtime in one place.
            </p>
          </div>
          <div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-theme-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 sm:w-auto"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              <FiPlus className="h-4 w-4" />
              Create Structure
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Total structures</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{totalStructures}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Active structures</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{activeStructures}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Avg. deduction %</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{avgDeductions.toFixed(1)}%</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Salary Structures</h2>
            <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {totalStructures} total
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
            {structures.map(structure => (
              <div 
                key={structure._id} 
                className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600">
                      <FiDollarSign className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{structure.name}</h3>
                      <p className="text-xs text-slate-500 capitalize flex items-center gap-1">
                        <FiUser className="h-3 w-3" />
                        {structure.applicableTo}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => openCalculateModal(structure)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      title="Calculate Salary"
                    >
                      <FaCalculator className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openApplyModal(structure)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-emerald-600"
                      title="Apply to Employee"
                    >
                      <FiUsers className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(structure)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-amber-600"
                      title="Edit Structure"
                    >
                      <FiEdit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteStructure(structure._id)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                      title="Delete Structure"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <p className="mb-4 line-clamp-2 text-sm text-slate-600">{structure.description || "No description added."}</p>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <FiTarget className="h-3 w-3" />
                      Applicable To:
                    </span>
                    <span className="font-semibold text-slate-900 capitalize text-sm">{structure.applicableTo}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <FiCalendar className="h-3 w-3" />
                      Created:
                    </span>
                    <span className="font-semibold text-slate-900 text-sm">
                      {new Date(structure.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <FiCheckCircle className="h-3 w-3" />
                      Status:
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                      structure.isActive 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {structure.isActive ? (
                        <>
                          <FiCheckCircle className="h-3 w-3" />
                          Active
                        </>
                      ) : (
                        <>
                          <FiXCircle className="h-3 w-3" />
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
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <h3 className="text-xl font-semibold text-slate-900">No Salary Structures</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              Create your first structure to start assigning salary components to employees.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-theme-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              <FiPlus className="h-4 w-4" />
              Create First Structure
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl md:p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <FiSettings className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900">{title}</h3>
            <p className="text-slate-600">Configure salary structure details and rules</p>
          </div>
        </div>
        
        <form onSubmit={onSubmit} className="space-y-8">
          {/* Basic Information */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-600">
                <FiUser className="h-4 w-4" />
              </div>
              <h4 className="text-lg font-bold text-gray-900">Basic Information</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Structure Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Enter structure name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Applicable To
                </label>
                <select
                  value={formData.applicableTo}
                  onChange={(e) => setFormData({ ...formData, applicableTo: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="all">All Employees</option>
                  <option value="department">Department</option>
                  <option value="position">Position</option>
                  <option value="level">Role Level</option>
                </select>
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                rows="3"
                placeholder="Describe this salary structure..."
              />
            </div>
          </div>

          {/* Earnings Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <FiTrendingUp className="h-4 w-4" />
              </div>
              <h4 className="text-lg font-bold text-gray-900">Earnings</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(formData.earnings).map(([field, config]) => (
                <div key={field} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-3 capitalize">
                    {field.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  {field === 'specialAllowance' ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value="Auto (Gross - Basic - HRA)"
                          className="flex-1 cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600"
                          readOnly
                        />
                        <span className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600">
                          Auto
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Special Allowance is auto-calculated during payroll generation as the balance amount.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        step="0.01"
                        value={config.isPercentage ? config.percentage : config.fixedAmount}
                        onChange={(e) => handleEarningChange(field, config.isPercentage ? 'percentage' : 'fixedAmount', parseFloat(e.target.value) || 0)}
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                        placeholder="0.00"
                      />
                      <select
                        value={config.isPercentage ? 'percentage' : 'fixed'}
                        onChange={(e) => handleEarningChange(field, 'isPercentage', e.target.value === 'percentage')}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      >
                        <option value="percentage">%</option>
                        <option value="fixed">₹</option>
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Deductions Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
                <FiTrendingDown className="h-4 w-4" />
              </div>
              <h4 className="text-lg font-bold text-gray-900">Deductions</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(formData.deductions).map(([field, config]) => (
                <div key={field} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-3 capitalize">
                    {field.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.01"
                      value={config.isPercentage ? config.percentage : config.fixedAmount}
                      onChange={(e) => handleDeductionChange(field, config.isPercentage ? 'percentage' : 'fixedAmount', parseFloat(e.target.value) || 0)}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      placeholder="0.00"
                    />
                    <select
                      value={config.isPercentage ? 'percentage' : 'fixed'}
                      onChange={(e) => handleDeductionChange(field, 'isPercentage', e.target.value === 'percentage')}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
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
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <FiCheckCircle className="h-4 w-4" />
              </div>
              <h4 className="text-lg font-bold text-gray-900">Bonus Structure</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(formData.bonusStructure).map(([field, config]) => (
                <div key={field} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-semibold text-slate-700 capitalize">
                      {field.replace(/([A-Z])/g, ' $1').trim()}
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(e) => handleBonusChange(field, 'enabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-700"></div>
                    </label>
                  </div>
                  {config.enabled && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-2">Percentage</label>
                        <input
                          type="number"
                          step="0.01"
                          value={config.percentage}
                          onChange={(e) => handleBonusChange(field, 'percentage', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-2">Max Amount (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={config.maxAmount}
                          onChange={(e) => handleBonusChange(field, 'maxAmount', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
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
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                <FiClock className="h-4 w-4" />
              </div>
              <h4 className="text-lg font-bold text-gray-900">Overtime Rules</h4>
            </div>
            <div className="space-y-6">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label className="text-sm font-semibold text-slate-700">Enable Overtime</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.overtimeRules.enabled}
                    onChange={(e) => handleOvertimeChange('enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-700"></div>
                </label>
              </div>
              {formData.overtimeRules.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Rate (x)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.overtimeRules.rate}
                      onChange={(e) => handleOvertimeChange('rate', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      placeholder="1.5"
                    />
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Max Hours/Day</label>
                    <input
                      type="number"
                      value={formData.overtimeRules.maxHoursPerDay}
                      onChange={(e) => handleOvertimeChange('maxHoursPerDay', parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      placeholder="4"
                    />
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Max Hours/Month</label>
                    <input
                      type="number"
                      value={formData.overtimeRules.maxHoursPerMonth}
                      onChange={(e) => handleOvertimeChange('maxHoursPerMonth', parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
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
              className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-theme-primary px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              <FiSave className="h-4 w-4" />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl md:p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <FiUsers className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Apply Salary Structure</h3>
            <p className="text-slate-600">Assign this structure to an employee</p>
          </div>
        </div>
        
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Structure
            </label>
            <input
              type="text"
              value={structure?.name || ''}
              className="w-full rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 font-medium text-slate-700"
              disabled
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Select Employee
            </label>
            <select
              value={selectedEmployee || ''}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
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
              className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-theme-primary px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              <FiUsers className="h-4 w-4" />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl md:p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <FaCalculator className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Calculate Salary</h3>
            <p className="text-slate-600">Calculate salary based on structure and employee data</p>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Structure
            </label>
            <input
              type="text"
              value={structure?.name || ''}
              className="w-full rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 font-medium text-slate-700"
              disabled
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Select Employee
            </label>
            <select
              value={selectedEmployee || ''}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-theme-primary px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              <FaCalculator className="h-4 w-4" />
              Calculate Salary
            </button>
          )}

          {calculatedSalary && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <FiDollarSign className="h-4 w-4" />
                </div>
                <h4 className="text-lg font-bold text-slate-900">Calculated Salary Breakdown</h4>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-slate-600">Basic Salary:</span>
                    <span className="text-lg font-bold text-slate-900">₹{calculatedSalary.employee.currentSalary}</span>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-slate-600">Total Earnings:</span>
                    <span className="text-lg font-bold text-emerald-700">₹{calculatedSalary.calculatedSalary.totalEarnings}</span>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-slate-600">Total Deductions:</span>
                    <span className="text-lg font-bold text-red-600">₹{calculatedSalary.calculatedSalary.totalDeductions}</span>
                  </div>
                </div>
                <div className="rounded-xl bg-emerald-600 p-4 text-white">
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
            className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalaryStructureManager;
