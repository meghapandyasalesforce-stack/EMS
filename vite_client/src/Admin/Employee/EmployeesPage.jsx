import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchEmployees } from '../../context/employeeSlice';
import { FaSearch, FaTimes, FaEdit, FaTrash, FaEye, FaUserPlus } from 'react-icons/fa';
import ProfilePicture from '../../Shared/ProfilePicture';
import RoleBadge from '../../components/RoleBadge';

const EmployeesPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { employees, status, error, pagination } = useSelector((state) => state.employees);
  const user = useSelector((state) => state.auth?.user);
  const employee = useSelector((state) => state.employeeDetails?.employee);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Check if user is HR or Admin
  const canAddEmployee = useMemo(() => {
    const userRole = user?.role || employee?.role || localStorage.getItem('role');
    const department = (user?.department || employee?.department || '').toLowerCase().trim();
    const jobTitle = (user?.jobTitle || employee?.jobTitle || '').toLowerCase().trim();
    const position = (user?.position || employee?.position || '').toLowerCase().trim();

    // Admin can always add employees
    if (userRole === 'admin') {
      return true;
    }

    // Check if user is HR
    const isHR = 
      department === 'hr' || 
      department.includes('hr') || 
      department.includes('human resource') ||
      jobTitle.includes('hr manager') ||
      jobTitle.includes('human resource') ||
      jobTitle.includes('hr') ||
      position.includes('hr manager') ||
      (position.includes('hr') && position.includes('manager'));

    return isHR;
  }, [user, employee]);

  useEffect(() => {
    dispatch(fetchEmployees({ page: currentPage, limit: pageSize, search: debouncedSearchTerm }));
  }, [dispatch, currentPage, debouncedSearchTerm]);

  // Debounce the search term
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => {
      clearTimeout(timerId);
    };
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  const handleRowClick = (employeeId) => {
    navigate(`/employees/${employeeId}`);
  };

  // Check if user is HR
  const isHR = useMemo(() => {
    const department = (user?.department || employee?.department || '').toLowerCase().trim();
    const jobTitle = (user?.jobTitle || employee?.jobTitle || '').toLowerCase().trim();
    const position = (user?.position || employee?.position || '').toLowerCase().trim();
    
    return department === 'hr' || 
           department.includes('hr') || 
           department.includes('human resource') ||
           jobTitle.includes('hr manager') ||
           jobTitle.includes('human resource') ||
           jobTitle.includes('hr') ||
           position.includes('hr manager') ||
           (position.includes('hr') && position.includes('manager'));
  }, [user, employee]);

  const displayUser = user || employee;

  const isInitialLoading = status === 'loading' && (!employees || employees.length === 0);

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-5 transition-all duration-300">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Employees Management</h1>
              <p className="text-sm text-gray-600 mt-1">
                {isHR 
                  ? `Showing all employees (${pagination?.total || 0} employees)`
                  : `Showing employees (${pagination?.total || 0} employees)`
                }
              </p>
            </div>
            <div className="flex items-center gap-3">
              {displayUser && <RoleBadge user={displayUser} />}
              {canAddEmployee && (
                <button
                  onClick={() => navigate('/add-employee')}
                  className="flex items-center gap-2 px-4 py-2 bg-theme-primary text-white rounded-lg hover:bg-theme-primary transition-colors shadow-sm"
                >
                  <FaUserPlus className="h-4 w-4" />
                  <span>Add Employee</span>
                </button>
              )}
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaSearch className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search employees by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary"
            />
            {searchTerm && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FaTimes className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          {status === 'failed' && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              Error loading employees: {error || 'Unknown error occurred'}
            </div>
          )}

          {status === 'loading' && !isInitialLoading && (
            <div className="text-xs text-gray-500 mb-3">Updating results...</div>
          )}

          {/* Employees Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Position
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joining Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(employees || []).map((employee) => (
                  <tr
                    key={employee._id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleRowClick(employee._id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <ProfilePicture 
                            user={employee} 
                            size="md" 
                            className="h-10 w-10"
                          />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {employee.name} {employee.lastName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {employee.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {employee.employeeId || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {employee.department || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {employee.jobTitle || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        employee.status === 'active' 
                          ? 'bg-theme-primary/10 text-theme-primary' 
                          : employee.status === 'inactive'
                          ? 'bg-yellow-100 text-yellow-800'
                          : employee.status === 'suspended'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {employee.status || 'active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {employee.joiningDate 
                        ? new Date(employee.joiningDate).toLocaleDateString()
                        : 'N/A'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(employee._id);
                          }}
                          className="text-theme-secondary hover:text-[var(--color-text)]"
                        >
                          <FaEye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle edit
                          }}
                          className="text-theme-accent hover:text-indigo-900"
                        >
                          <FaEdit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle delete
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          <FaTrash className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isInitialLoading && (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-theme-secondary"></div>
            </div>
          )}

          {!isInitialLoading && (employees || []).length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500 text-lg">
                {searchTerm ? 'No employees found matching your search.' : 'No employees found.'}
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              Page {pagination?.page || currentPage} of {pagination?.pages || 1} • Total {pagination?.total || 0}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={!pagination?.hasPrev || status === 'loading'}
                className="px-3 py-1.5 rounded-md border border-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={!pagination?.hasNext || status === 'loading'}
                className="px-3 py-1.5 rounded-md border border-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeesPage;