import React, { useState, useEffect, useCallback } from 'react';
import { FiCreditCard, FiPlus, FiDownload, FiEye, FiEdit, FiTrash2, FiUser, FiCalendar } from 'react-icons/fi';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';

const IdCardGenerator = () => {
  const [idCards, setIdCards] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    cardType: ''
  });

  // Generate form state - simplified to only theme selection
  const [generateForm, setGenerateForm] = useState({
    employeeId: '',
    cardType: 'employee',
    expiryDate: '',
    cardDesign: {
      template: 'standard'
    },
    accessLevel: 'basic',
    accessZones: []
  });

  // Theme presets
  const themePresets = {
    standard: {
      name: 'Standard',
      backgroundColor: '#ffffff',
      textColor: '#000000',
      accentColor: '#1976d2',
      borderColor: '#e0e0e0'
    },
    corporate: {
      name: 'Corporate',
      backgroundColor: '#f8f9fa',
      textColor: '#212529',
      accentColor: '#0d6efd',
      borderColor: '#dee2e6'
    },
    executive: {
      name: 'Executive',
      backgroundColor: '#1a1a1a',
      textColor: '#ffffff',
      accentColor: '#ffd700',
      borderColor: '#333333'
    },
    modern: {
      name: 'Modern',
      backgroundColor: '#ffffff',
      textColor: '#2c3e50',
      accentColor: '#e74c3c',
      borderColor: '#bdc3c7'
    },
    professional: {
      name: 'Professional',
      backgroundColor: '#ffffff',
      textColor: '#34495e',
      accentColor: '#3498db',
      borderColor: '#95a5a6'
    }
  };

  const fetchIdCards = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.cardType) params.append('cardType', filters.cardType);

      const response = await axios.get(`/v1/admin/id-cards?${params}`);
      // Handle standardized response format: { success: true, data: [...] }
      const cardsData = response.data?.data || response.data || [];
      setIdCards(cardsData);
    } catch (error) {
      console.error('Error fetching ID cards:', error);
      toast.error('Failed to fetch ID cards');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchEmployees = async () => {
    try {
      setEmployeesLoading(true);
      const response = await axios.get('/v1/employee/auth/get-all-employees');
      console.log('Employees API response:', response.data);
      
      // Ensure we always have an array
      const employeesData = Array.isArray(response.data) ? response.data : 
                           Array.isArray(response.data?.data) ? response.data.data : 
                           Array.isArray(response.data?.employees) ? response.data.employees : [];
      
      console.log('Processed employees data:', employeesData);
      setEmployees(employeesData);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to fetch employees');
      setEmployees([]); // Set empty array on error
    } finally {
      setEmployeesLoading(false);
    }
  };

  useEffect(() => {
    // Check authentication status
    const userRole = localStorage.getItem('role');
    const userToken = localStorage.getItem('token');
    console.log('Current user role:', userRole);
    console.log('Current user token:', userToken);
    console.log('Current cookies:', document.cookie);
    
    if (userRole !== 'admin') {
      console.error('User is not logged in as admin. Current role:', userRole);
      toast.error('You must be logged in as an admin to access this feature');
      return;
    }
    
    fetchIdCards();
    fetchEmployees();
  }, [fetchIdCards]);

  const handleGenerateCard = async (e) => {
    e.preventDefault();
    try {
      console.log('Sending form data:', generateForm);
      console.log('Current user role:', localStorage.getItem('role'));
      console.log('Current user token:', localStorage.getItem('token'));
      
      // Validate required fields
      if (!generateForm.employeeId) {
        toast.error('Please select an employee');
        return;
      }
      if (!generateForm.expiryDate) {
        toast.error('Please select an expiry date');
        return;
      }
      
      // Ensure expiry date is in the future
      const expiryDate = new Date(generateForm.expiryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (expiryDate <= today) {
        toast.error('Expiry date must be in the future');
        return;
      }
      
      const response = await axios.post('/v1/admin/id-cards/generate', generateForm);
      console.log('Response:', response.data);
      toast.success('ID card generated successfully');
      setShowGenerateModal(false);
      resetGenerateForm();
      fetchIdCards();
    } catch (error) {
      console.error('Error generating ID card:', error);
      console.error('Error response:', error.response?.data);
      toast.error(error.response?.data?.message || 'Failed to generate ID card');
    }
  };

  const handleDownloadCard = async (cardId) => {
    try {
      const response = await axios.get(`/v1/admin/id-cards/${cardId}/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `id-card-${cardId}.png`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('ID card downloaded successfully');
    } catch (error) {
      console.error('Error downloading ID card:', error);
      toast.error('Failed to download ID card');
    }
  };

  const handleDeactivateCard = async (cardId) => {
    if (window.confirm('Are you sure you want to deactivate this ID card?')) {
      try {
        await axios.put(`/v1/admin/id-cards/${cardId}/deactivate`, {
          reason: 'Deactivated by admin'
        });
        toast.success('ID card deactivated successfully');
        fetchIdCards();
      } catch (error) {
        console.error('Error deactivating ID card:', error);
        toast.error('Failed to deactivate ID card');
      }
    }
  };

  const applyTheme = (themeKey) => {
    setGenerateForm(prev => ({
      ...prev,
      cardDesign: {
        template: themeKey
      }
    }));
  };

  const resetGenerateForm = () => {
    setGenerateForm({
      employeeId: '',
      cardType: 'employee',
      expiryDate: '',
      cardDesign: {
        template: 'standard'
      },
      accessLevel: 'basic',
      accessZones: []
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      expired: 'bg-red-100 text-red-800',
      suspended: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getCardTypeColor = (type) => {
    const colors = {
      employee: 'bg-blue-100 text-blue-800',
      visitor: 'bg-purple-100 text-purple-800',
      contractor: 'bg-orange-100 text-orange-800',
      temporary: 'bg-pink-100 text-pink-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const isExpiringSoon = (expiryDate) => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isExpired = (expiryDate) => {
    return new Date(expiryDate) < new Date();
  };

  useEffect(() => {
    fetchIdCards();
  }, [filters, fetchIdCards]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-6"></div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Loading ID Cards</h3>
          <p className="text-gray-600">Please wait while we fetch your ID card data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 ml-0 lg:ml-64">
      <div className="py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">ID Card Management</h1>
                <p className="text-gray-600">Generate and manage employee ID cards</p>
              </div>
              <div className="flex-shrink-0">
                <button
                  onClick={() => setShowGenerateModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 shadow-sm hover:shadow-md transition-all duration-200 font-medium"
                >
                  <FiPlus className="w-5 h-5" />
                  <span>Generate ID Card</span>
                </button>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="suspended">Suspended</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Type</label>
                <select
                  value={filters.cardType}
                  onChange={(e) => setFilters({ ...filters, cardType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
                >
                  <option value="">All Types</option>
                  <option value="employee">Employee</option>
                  <option value="visitor">Visitor</option>
                  <option value="contractor">Contractor</option>
                  <option value="temporary">Temporary</option>
                </select>
              </div>
            </div>
          </div>

          {/* ID Cards List */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-xl font-semibold text-gray-900">
                ID Cards ({Array.isArray(idCards) ? idCards.length : 0})
              </h2>
              <p className="text-sm text-gray-600 mt-1">Manage and view all generated ID cards</p>
            </div>
          <div className="p-6">
            {(Array.isArray(idCards) ? idCards.length : 0) === 0 ? (
              <div className="text-center py-12">
                <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-lg mx-auto mb-4">
                  <FiCreditCard className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No ID cards found</h3>
                <p className="text-gray-500 mb-6">Get started by generating your first ID card for an employee.</p>
                <button
                  onClick={() => setShowGenerateModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-all duration-200 font-medium"
                >
                  <FiPlus className="w-4 h-4 inline mr-2" />
                  Generate your first ID card
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(Array.isArray(idCards) ? idCards : []).map(card => (
                  <div key={card._id} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
                    {/* Card Header */}
                    <div className="p-6 pb-4">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shadow-sm">
                            <FiUser className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 text-lg leading-tight">
                              {card.employeeId?.name} {card.employeeId?.lastName}
                            </h4>
                            <p className="text-sm text-gray-500 font-medium mt-1">
                              {card.employeeId?.employeeId}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => {
                              setSelectedCard(card);
                              setShowPreviewModal(true);
                            }}
                            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all duration-200"
                            title="View card"
                          >
                            <FiEye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadCard(card._id)}
                            className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-all duration-200"
                            title="Download card"
                          >
                            <FiDownload className="w-4 h-4" />
                          </button>
                          {card.status === 'active' && (
                            <button
                              onClick={() => handleDeactivateCard(card._id)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200"
                              title="Delete card"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Details */}
                    <div className="px-6 pb-6">
                      <div className="space-y-3">
                        <div className="id-card-details">
                          <span className="id-card-label text-sm font-medium text-gray-600">Card Number:</span>
                          <span className="id-card-value text-sm font-bold text-gray-900">{card.cardNumber}</span>
                        </div>
                        <div className="id-card-details">
                          <span className="id-card-label text-sm font-medium text-gray-600">Type:</span>
                          <span className={`id-card-value px-2 py-1 rounded-full text-xs font-semibold ${getCardTypeColor(card.cardType)}`}>
                            {card.cardType}
                          </span>
                        </div>
                        <div className="id-card-details">
                          <span className="id-card-label text-sm font-medium text-gray-600">Status:</span>
                          <span className={`id-card-value px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(card.status)}`}>
                            {card.status}
                          </span>
                        </div>
                      </div>

                      {(isExpired(card.expiryDate) || isExpiringSoon(card.expiryDate)) && (
                        <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${
                          isExpired(card.expiryDate) 
                            ? 'bg-red-50 text-red-700 border border-red-200' 
                            : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                        }`}>
                          {isExpired(card.expiryDate) ? '⚠️ Card has expired' : '⚠️ Card expires soon'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      {/* Generate Modal */}
      {showGenerateModal && (
        <GenerateModal
          formData={generateForm}
          setFormData={setGenerateForm}
          onSubmit={handleGenerateCard}
          onClose={() => {
            setShowGenerateModal(false);
            resetGenerateForm();
          }}
          employees={employees}
          themePresets={themePresets}
          applyTheme={applyTheme}
          employeesLoading={employeesLoading}
        />
      )}

      {/* Preview Modal */}
      {showPreviewModal && selectedCard && (
        <PreviewModal
          card={selectedCard}
          onClose={() => {
            setShowPreviewModal(false);
            setSelectedCard(null);
          }}
          onDownload={() => handleDownloadCard(selectedCard._id)}
        />
      )}
        </div>
      </div>
    </div>
  );
};

// Generate Modal Component
const GenerateModal = ({ formData, setFormData, onSubmit, onClose, employees, themePresets, applyTheme, employeesLoading }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto border border-gray-100">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-8 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white bg-opacity-20 rounded-2xl">
                <FiCreditCard className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">Generate ID Card</h3>
                <p className="text-blue-100 mt-1">Create a new ID card for an employee</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-xl transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="p-8">
        
          <form onSubmit={onSubmit} className="space-y-8">
            {/* Employee Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Select Employee
              </label>
              <select
                value={formData.employeeId}
                onChange={(e) => {
                  console.log('Employee selected:', e.target.value);
                  console.log('Available employees:', employees);
                  setFormData({ ...formData, employeeId: e.target.value });
                }}
                className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg"
                required
              >
                <option value="">Choose an employee...</option>
                {employeesLoading ? (
                  <option value="" disabled>Loading employees...</option>
                ) : Array.isArray(employees) && employees.length > 0 ? (
                  employees.map(employee => (
                    <option key={employee._id} value={employee._id}>
                      {employee.name} {employee.lastName} - {employee.employeeId} ({employee.department})
                    </option>
                  ))
                ) : (
                  <option value="" disabled>No employees found</option>
                )}
              </select>
            </div>

            {/* Theme Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-4">
                Card Theme
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {Object.entries(themePresets).map(([key, theme]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyTheme(key)}
                    className={`p-4 rounded-2xl border-2 transition-all duration-200 hover:shadow-lg ${
                      formData.cardDesign.template === key
                        ? 'border-blue-500 bg-blue-50 shadow-lg'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div 
                      className="w-full h-20 rounded-xl mb-3 shadow-sm"
                      style={{ backgroundColor: theme.backgroundColor }}
                    >
                      <div 
                        className="w-full h-full flex items-center justify-center text-sm font-semibold"
                        style={{ color: theme.textColor }}
                      >
                        {theme.name}
                      </div>
                    </div>
                    <p className="text-sm font-medium text-gray-700">{theme.name}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Card Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Card Type
                </label>
                <select
                  value={formData.cardType}
                  onChange={(e) => setFormData({ ...formData, cardType: e.target.value })}
                  className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg"
                >
                  <option value="employee">Employee</option>
                  <option value="visitor">Visitor</option>
                  <option value="contractor">Contractor</option>
                  <option value="temporary">Temporary</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Expiry Date
                </label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Access Level
                </label>
                <select
                  value={formData.accessLevel}
                  onChange={(e) => setFormData({ ...formData, accessLevel: e.target.value })}
                  className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg"
                >
                  <option value="basic">Basic</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>


            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-8 py-3 text-gray-600 hover:text-gray-800 font-semibold rounded-xl hover:bg-gray-100 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
              >
                Generate ID Card
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Preview Modal Component
const PreviewModal = ({ card, onClose, onDownload }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100">
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white bg-opacity-20 rounded-xl">
                <FiEye className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">ID Card Preview</h3>
                <p className="text-green-100 text-sm">Preview the generated ID card</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="p-6">
        
          {/* Card Preview */}
          <div className="mb-6 flex justify-center">
            {/* Vertical ID Card - Matching the design shown */}
            <div className="w-80 h-[500px] bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
              {/* Top Section - Dark Blue with Angular Design */}
              <div className="h-32 bg-gradient-to-br from-blue-700 to-blue-900 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20">
                  <svg className="w-full h-full" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <polygon points="0,50 100,0 200,50 200,150 100,200 0,150" fill="currentColor"/>
                  </svg>
                </div>
                
                {/* PS Logo */}
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
                  <div className="w-16 h-16 bg-green-400 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-2xl font-bold text-white">PS</span>
                  </div>
                </div>
                
                {/* Profile Picture */}
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-8">
                  <div className="w-24 h-24 rounded-full border-4 border-white shadow-xl overflow-hidden">
                    {card.employeeId?.profilePhoto ? (
                      <img src={card.employeeId.profilePhoto} alt="Profile" className="w-full h-full object-cover"/>
                    ) : (
                      <FiUser className="w-full h-full p-2 bg-gray-200 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Middle Section - Personal Information */}
              <div className="pt-12 pb-6 px-6 flex flex-col items-center">
                {/* Name */}
                <h3 className="text-2xl font-bold text-gray-800 mb-2">
                  {card.employeeId?.name} {card.employeeId?.lastName}
                </h3>
                
                    {/* Title - Job Position */}
                    <div className="flex items-center gap-2 mb-6">
                      <div className="h-px w-8 bg-gray-800"></div>
                      <span className="text-gray-600 text-sm font-medium">{card.employeeId?.position || card.employeeId?.jobTitle || 'Employee'}</span>
                      <div className="h-px w-8 bg-gray-800"></div>
                    </div>
                
                {/* Information Grid */}
                <div className="w-full space-y-3">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-gray-700">Emp. ID:</span>
                    <span className="text-sm font-semibold text-gray-900">: {card.employeeId?.employeeId || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-gray-700">Blood Group:</span>
                      <span className="text-sm font-semibold text-gray-900">: {card.employeeId?.bloodGroup || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-gray-700">Emergency No:</span>
                    <span className="text-sm font-semibold text-gray-900">: {card.employeeId?.phone2 || '+91 XXXXX XXXXX'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-gray-700">Company No:</span>
                    <span className="text-sm font-semibold text-gray-900">: {card.employeeId?.phone1 || '+91 XXXXX XXXX'}</span>
                  </div>
                  {card.employeeId?.joiningDate && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-sm font-medium text-gray-700">Join Date:</span>
                      <span className="text-sm font-semibold text-gray-900">: {new Date(card.employeeId.joiningDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
                
                {/* Address */}
                <div className="w-full mt-6 flex items-start gap-2">
                  <svg className="w-4 h-4 text-gray-700 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-xs text-gray-700 leading-relaxed">
                    {card.employeeId?.address || card.cardDesign?.companyAddress || 'B 185, VARDHMAN NAGAR, Nearby Puno, Jaipur, Rajasthan, India - 302019'}
                  </p>
                </div>
              </div>

              {/* Bottom Section - Dark Blue Footer */}
              <div className="h-16 bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center mt-auto">
                <p className="text-white text-xs font-medium text-center px-4">
                  If found, please email at <span className="text-blue-200 font-semibold">paarsiv@paarsiv.com</span>
                </p>
              </div>
            </div>
          </div>

          {/* Card Details */}
          <div className="space-y-4 mb-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Card Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-xl">
                <span className="text-sm font-medium text-gray-600">Card Number</span>
                <p className="text-lg font-bold text-gray-900">{card.cardNumber}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl">
                <span className="text-sm font-medium text-gray-600">Type</span>
                <p className="text-lg font-bold text-gray-900 capitalize">{card.cardType}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl">
                <span className="text-sm font-medium text-gray-600">Status</span>
                <p className="text-lg font-bold text-gray-900 capitalize">{card.status}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl">
                <span className="text-sm font-medium text-gray-600">Issue Date</span>
                <p className="text-lg font-bold text-gray-900">{new Date(card.issueDate).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl">
              <span className="text-sm font-medium text-gray-600">Expiry Date</span>
              <p className="text-lg font-bold text-gray-900">{new Date(card.expiryDate).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              onClick={onClose}
              className="px-6 py-3 text-gray-600 hover:text-gray-800 font-semibold rounded-xl hover:bg-gray-100 transition-all duration-200"
            >
              Close
            </button>
            <button
              onClick={onDownload}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5 flex items-center space-x-2"
            >
              <FiDownload className="w-5 h-5" />
              <span>Download Card</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdCardGenerator;
