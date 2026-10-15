import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiUsers, FiShield, FiChevronDown, FiChevronRight, FiUserPlus } from 'react-icons/fi';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';

const DASHBOARD_ROUTE_OPTIONS = [
  { value: '/dashboard-employee', label: 'Employee Dashboard' },
  { value: '/dashboard-manager', label: 'Manager Dashboard' },
  { value: '/dashboard-hr', label: 'HR Dashboard' },
  { value: '/dashboard-finance', label: 'Finance Dashboard' },
  { value: '/dashboard-administration', label: 'Administration Dashboard' },
  { value: '/dashboard-admin', label: 'Admin Dashboard' },
  { value: '/organization/dashboard', label: 'Organization Dashboard' }
];

const RoleHierarchy = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [expandedRoles, setExpandedRoles] = useState(new Set());
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    level: 1,
    dashboardRoute: '/dashboard-employee',
    permissions: [],
    canManageRoles: false,
    canAccessReports: false,
    canManageSystem: false,
    parentRole: null
  });

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await axios.get('/v1/admin/roles');
      setRoles(response.data);
      setLoading(false);
    } catch (error) {
      // Removed console.error for production
      toast.error('Failed to fetch roles');
      setLoading(false);
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        ...(formData.parentRole ? { parentRole: formData.parentRole } : {})
      };
      await axios.post('/v1/admin/roles', payload);
      toast.success('Role created successfully');
      setShowCreateModal(false);
      resetForm();
      fetchRoles();
    } catch (error) {
      // Removed console.error for production
      toast.error(error.response?.data?.message || 'Failed to create role');
    }
  };

  const handleUpdateRole = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        ...(formData.parentRole ? { parentRole: formData.parentRole } : { parentRole: null })
      };
      await axios.put(`/v1/admin/roles/${selectedRole._id}`, payload);
      toast.success('Role updated successfully');
      setShowEditModal(false);
      resetForm();
      fetchRoles();
    } catch (error) {
      // Removed console.error for production
      toast.error(error.response?.data?.message || 'Failed to update role');
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (window.confirm('Are you sure you want to delete this role?')) {
      try {
        await axios.delete(`/v1/admin/roles/${roleId}`);
        toast.success('Role deleted successfully');
        fetchRoles();
      } catch (error) {
        // Removed console.error for production
        toast.error(error.response?.data?.message || 'Failed to delete role');
      }
    }
  };

  const fetchEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const response = await axios.get('/v1/employee/auth/get-all-employees');
      const employeesData = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
          ? response.data.data
          : Array.isArray(response.data?.employees)
            ? response.data.employees
            : [];
      setEmployees(employeesData);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch employees');
      setEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const openAssignModal = async (role) => {
    setSelectedRole(role);
    setSelectedEmployeeId('');
    setShowAssignModal(true);
    if (!employees.length) {
      await fetchEmployees();
    }
  };

  const handleAssignRole = async (e) => {
    e.preventDefault();
    if (!selectedEmployeeId || !selectedRole?._id) {
      toast.error('Please select an employee');
      return;
    }
    try {
      await axios.post('/v1/admin/roles/assign', {
        employeeId: selectedEmployeeId,
        roleId: selectedRole._id
      });
      toast.success(`Role "${selectedRole.name}" assigned successfully`);
      setShowAssignModal(false);
      setSelectedEmployeeId('');
      setSelectedRole(null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to assign role');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      level: 1,
      dashboardRoute: '/dashboard-employee',
      permissions: [],
      canManageRoles: false,
      canAccessReports: false,
      canManageSystem: false,
      parentRole: null
    });
    setSelectedRole(null);
  };

  const openEditModal = (role) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description,
      level: role.level,
      dashboardRoute: role.dashboardRoute || '/dashboard-employee',
      permissions: role.permissions || [],
      canManageRoles: role.canManageRoles || false,
      canAccessReports: role.canAccessReports || false,
      canManageSystem: role.canManageSystem || false,
      parentRole: role.parentRole?._id || null
    });
    setShowEditModal(true);
  };

  const toggleRoleExpansion = (roleId) => {
    const newExpanded = new Set(expandedRoles);
    if (newExpanded.has(roleId)) {
      newExpanded.delete(roleId);
    } else {
      newExpanded.add(roleId);
    }
    setExpandedRoles(newExpanded);
  };

  const renderRoleTree = (role, level = 0) => {
    const isExpanded = expandedRoles.has(role._id);
    const hasChildren = role.childRoles && role.childRoles.length > 0;

    return (
      <div key={role._id} className={`${level > 0 ? 'ml-2 sm:ml-4 lg:ml-8' : ''}`}>
        <div className="mb-4 flex flex-col rounded-2xl border border-gray-200 bg-gradient-to-r from-gray-50 to-white p-4 transition-all duration-300 hover:border-theme-secondary hover:shadow-lg sm:p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6 group">
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            {hasChildren && (
              <button
                onClick={() => toggleRoleExpansion(role._id)}
                className="p-2 hover:bg-theme-secondary/10 rounded-xl transition-all duration-200 group-hover:bg-theme-secondary/10 flex-shrink-0"
              >
                {isExpanded ? <FiChevronDown className="w-5 h-5 text-theme-secondary" /> : <FiChevronRight className="w-5 h-5 text-theme-secondary" />}
              </button>
            )}
            {!hasChildren && <div className="w-9 flex-shrink-0" />}
            
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-[var(--color-secondary)] rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 flex-shrink-0">
                <FiShield className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 text-xl mb-1 truncate">{role.name}</h3>
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                  <span className="px-2 py-1 bg-gray-100 rounded-lg font-medium">Level {role.level}</span>
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg font-medium">
                    {DASHBOARD_ROUTE_OPTIONS.find((opt) => opt.value === role.dashboardRoute)?.label || role.dashboardRoute || 'Employee Dashboard'}
                  </span>
                  <span className="px-2 py-1 bg-theme-secondary/10 text-theme-secondary rounded-lg font-medium">{role.permissions?.length || 0} permissions</span>
                </div>
                {role.description && (
                  <p className="text-sm text-gray-600 mt-2 max-w-md line-clamp-2">{role.description}</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 lg:ml-4 lg:mt-0 lg:flex-nowrap">
            <span className="px-4 py-2 bg-gradient-to-r from-blue-500 to-[var(--color-secondary)] text-white text-sm font-semibold rounded-xl shadow-md whitespace-nowrap">
              {role.permissions?.length || 0} permissions
            </span>
            <div className="flex gap-1 sm:gap-2">
              <button
                onClick={() => openAssignModal(role)}
                className="p-3 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all duration-200 group-hover:bg-green-50"
                title="Assign Role"
              >
                <FiUserPlus className="w-5 h-5" />
              </button>
              <button
                onClick={() => openEditModal(role)}
                className="p-3 text-gray-400 hover:text-theme-secondary hover:bg-theme-secondary/10 rounded-xl transition-all duration-200 group-hover:bg-theme-secondary/10"
                title="Edit Role"
              >
                <FiEdit className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleDeleteRole(role._id)}
                className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 group-hover:bg-red-50"
                title="Delete Role"
              >
                <FiTrash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div className="ml-2 border-l-2 border-gray-200 pl-2 sm:ml-4 sm:pl-4 lg:ml-6 lg:pl-6">
            {role.childRoles.map(childRole => renderRoleTree(childRole, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const getTopLevelRoles = () => {
    return roles.filter(role => !role.parentRole);
  };

  if (loading) {
    return (
      <div className="page-shell bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="page-shell-inner hrms-stack">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Role Management</h1>
            <p className="text-lg text-gray-600">Manage user roles and permissions</p>
          </div>
          
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
              <h2 className="text-2xl font-bold text-gray-900">Role Hierarchy</h2>
              <p className="text-gray-600 mt-1">Manage and organize your role structure</p>
            </div>
            <div className="p-8 text-center sm:p-12 lg:p-16">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-theme-secondary border-t-blue-600 mx-auto mb-6"></div>
              <p className="text-gray-600 text-lg font-medium">Loading roles...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="page-shell-inner hrms-stack">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Role Management</h1>
            <p className="text-lg text-gray-600">Manage user roles and permissions</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:gap-3 flex-shrink-0">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-theme-primary px-4 py-3 font-medium text-white shadow-md transition-all duration-200 hover:opacity-90 hover:shadow-lg sm:px-6"
            >
              <FiPlus className="w-5 h-5" />
              Create Role
            </button>
            <button className="flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-theme-secondary bg-theme-secondary/10 px-4 py-3 font-medium text-theme-secondary shadow-sm transition-all duration-200 hover:bg-theme-secondary/10 hover:shadow-md sm:px-6">
              <FiShield className="w-5 h-5" />
              Permissions
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Total Roles</p>
                <p className="text-4xl font-bold text-gray-900 mb-1">{roles.length}</p>
                <p className="text-xs text-gray-400">All roles in system</p>
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-[var(--color-secondary)] rounded-2xl flex items-center justify-center shadow-lg">
                <FiShield className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Top Level Roles</p>
                <p className="text-4xl font-bold text-gray-900 mb-1">{getTopLevelRoles().length}</p>
                <p className="text-xs text-gray-400">Primary roles</p>
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-[var(--color-primary)] rounded-2xl flex items-center justify-center shadow-lg">
                <FiUsers className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Child Roles</p>
                <p className="text-4xl font-bold text-gray-900 mb-1">
                  {roles.filter(role => role.parentRole).length}
                </p>
                <p className="text-xs text-gray-400">Subordinate roles</p>
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Avg Permissions</p>
                <p className="text-4xl font-bold text-gray-900 mb-1">
                  {roles.length > 0 ? Math.round(roles.reduce((acc, role) => acc + (role.permissions?.length || 0), 0) / roles.length) : 0}
                </p>
                <p className="text-xs text-gray-400">Per role</p>
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Roles Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
            <h2 className="text-2xl font-bold text-gray-900">Role Hierarchy</h2>
            <p className="text-gray-600 mt-1">Manage and organize your role structure</p>
          </div>
          
          {getTopLevelRoles().length === 0 ? (
            <div className="p-8 text-center sm:p-12 lg:p-16">
              <div className="flex items-center justify-center w-24 h-24 bg-gradient-to-br from-[var(--color-secondary)] to-blue-200 rounded-3xl mx-auto mb-8">
                <FiShield className="w-12 h-12 text-theme-secondary" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">No roles created yet</h3>
              <p className="text-gray-500 mb-8 text-lg">Get started by creating your first role to organize permissions and access levels.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-4 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold text-lg"
              >
                <FiPlus className="w-5 h-5 inline mr-2" />
                Create your first role
              </button>
            </div>
          ) : (
            <div className="p-4 sm:p-6 lg:p-8">
              {getTopLevelRoles().map(role => renderRoleTree(role))}
            </div>
          )}
        </div>
      </div>

      {/* Create Role Modal */}
      {showCreateModal && (
        <RoleModal
          title="Create Role"
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleCreateRole}
          onClose={() => {
            setShowCreateModal(false);
            resetForm();
          }}
          roles={roles}
        />
      )}

      {/* Edit Role Modal */}
      {showEditModal && (
        <RoleModal
          title="Edit Role"
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleUpdateRole}
          onClose={() => {
            setShowEditModal(false);
            resetForm();
          }}
          roles={roles.filter(role => role._id !== selectedRole?._id)}
        />
      )}

      {/* Assign Role Modal */}
      {showAssignModal && selectedRole && (
        <AssignRoleModal
          role={selectedRole}
          employees={employees}
          selectedEmployeeId={selectedEmployeeId}
          setSelectedEmployeeId={setSelectedEmployeeId}
          loadingEmployees={loadingEmployees}
          onSubmit={handleAssignRole}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedEmployeeId('');
            setSelectedRole(null);
          }}
        />
      )}
    </div>
  );
};

// Role Modal Component
const RoleModal = ({ title, formData, setFormData, onSubmit, onClose, roles }) => {
  const modules = [
    'dashboard', 'employees', 'attendance', 'payroll', 'leave',
    'projects', 'notifications', 'reports', 'settings', 'calendar'
  ];

  const actions = ['read', 'write', 'delete', 'approve', 'export', 'import'];

  const handlePermissionChange = (module, action, checked) => {
    const newPermissions = [...formData.permissions];
    const moduleIndex = newPermissions.findIndex(p => p.module === module);
    
    if (moduleIndex === -1) {
      newPermissions.push({ module, actions: checked ? [action] : [] });
    } else {
      const actions = newPermissions[moduleIndex].actions;
      if (checked) {
        actions.push(action);
      } else {
        const actionIndex = actions.indexOf(action);
        if (actionIndex > -1) actions.splice(actionIndex, 1);
      }
      newPermissions[moduleIndex].actions = actions;
    }
    
    setFormData({ ...formData, permissions: newPermissions });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-gray-100 bg-white p-5 shadow-2xl sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Role Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary transition-all duration-200 text-lg"
                placeholder="Enter role name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Level
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
                className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary transition-all duration-200 text-lg"
                placeholder="1-10"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary transition-all duration-200 text-lg"
              rows="3"
              placeholder="Describe the role's purpose and responsibilities"
            />
          </div>

          {/* Parent Role */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Parent Role (Optional)
            </label>
            <select
              value={formData.parentRole || ''}
              onChange={(e) => setFormData({ ...formData, parentRole: e.target.value || null })}
              className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary transition-all duration-200 text-lg"
            >
              <option value="">No Parent Role</option>
              {roles.map(role => (
                <option key={role._id} value={role._id}>
                  {role.name} (Level {role.level})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Dashboard Route
            </label>
            <select
              value={formData.dashboardRoute}
              onChange={(e) => setFormData({ ...formData, dashboardRoute: e.target.value })}
              className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary transition-all duration-200 text-lg"
            >
              {DASHBOARD_ROUTE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm text-gray-500">
              Employees assigned to this role will prefer this dashboard after login.
            </p>
          </div>

          {/* Special Permissions */}
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700">Special Permissions</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: 'canManageRoles', label: 'Can Manage Roles', icon: '👥' },
                { key: 'canAccessReports', label: 'Can Access Reports', icon: '📊' },
                { key: 'canManageSystem', label: 'Can Manage System', icon: '⚙️' }
              ].map(permission => (
                <label key={permission.key} className="flex items-center p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={formData[permission.key]}
                    onChange={(e) => setFormData({ ...formData, [permission.key]: e.target.checked })}
                    className="w-5 h-5 text-theme-secondary border-gray-300 rounded focus:ring-2 focus:ring-[var(--color-primary)] mr-3"
                  />
                  <span className="text-2xl mr-3">{permission.icon}</span>
                  <span className="font-medium text-gray-900">{permission.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Module Permissions */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-4">Module Permissions</label>
            <div className="space-y-6">
              {modules.map(module => (
                <div key={module} className="border border-gray-200 rounded-2xl p-6 bg-gray-50">
                  <h4 className="font-bold text-gray-900 capitalize mb-4 text-lg">{module}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {actions.map(action => (
                      <label key={action} className="flex items-center p-3 bg-white rounded-lg hover:bg-theme-secondary/10 cursor-pointer transition-colors border border-gray-100">
                        <input
                          type="checkbox"
                          checked={formData.permissions.find(p => p.module === module)?.actions.includes(action) || false}
                          onChange={(e) => handlePermissionChange(module, action, e.target.checked)}
                          className="w-4 h-4 text-theme-secondary border-gray-300 rounded focus:ring-2 focus:ring-[var(--color-primary)] mr-3"
                        />
                        <span className="font-medium text-gray-700 capitalize">{action}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
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
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {title.includes('Create') ? 'Create Role' : 'Update Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AssignRoleModal = ({
  role,
  employees,
  selectedEmployeeId,
  setSelectedEmployeeId,
  loadingEmployees,
  onSubmit,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-gray-100 bg-white p-5 shadow-2xl sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-900">Assign Role</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
            <input
              type="text"
              disabled
              value={`${role?.name || ''} (Level ${role?.level || '-'})`}
              className="w-full p-4 border border-gray-300 rounded-xl bg-gray-50 text-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Select Employee</label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary transition-all duration-200"
              required
            >
              <option value="">{loadingEmployees ? 'Loading employees...' : 'Choose an employee...'}</option>
              {!loadingEmployees &&
                employees.map((employee) => (
                  <option key={employee._id} value={employee._id}>
                    {employee.name} {employee.lastName} - {employee.employeeId}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-gray-600 hover:text-gray-800 font-semibold rounded-xl hover:bg-gray-100 transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
            >
              <FiUserPlus className="w-4 h-4" />
              Assign Role
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RoleHierarchy;
