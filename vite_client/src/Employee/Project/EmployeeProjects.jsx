import React, { useEffect } from 'react';
import { FiChevronRight, FiFolder, FiUser, FiAlertCircle } from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMyProjects } from '../../context/employeeTaskSlice';
import { useNavigate } from 'react-router-dom';

const EmployeeProjects = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { myProjects = [], status = 'idle', error = null } = useSelector(state => state.employeeTask || {});
  const projects = Array.isArray(myProjects) ? myProjects : [];

  useEffect(() => {
    dispatch(fetchMyProjects());
  }, [dispatch]);

  const handleProjectClick = (projectId) => {
    navigate(`/employee/projects/${projectId}`);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'On Hold':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 p-5 ml-64 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading projects...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-5 ml-64 flex items-center justify-center">
        <div className="max-w-lg bg-white rounded-lg shadow-md border border-gray-200 p-5 text-center">
          <div className="flex justify-center mb-3">
            <FiAlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">Error Loading Projects</h2>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-5 ml-64">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-5 mb-5 border border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Projects Dashboard</h1>
              <p className="text-sm text-gray-600 mt-0.5">Manage and track your assigned projects</p>
            </div>
            <div className="flex gap-2">
              <button className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-600 transition">
                Active Projects
              </button>
              <button className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition">
                Statistics
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <SummaryCard 
            title="Total Projects" 
            count={projects.length} 
            icon={<FiFolder className="w-6 h-6 text-blue-600" />} 
            bg="bg-blue-50" 
            iconBg="bg-blue-100"
          />
          <SummaryCard 
            title="In Progress" 
            count={projects.filter(p => p.status === 'In Progress').length} 
            icon={<CheckIcon />} 
            bg="bg-green-50" 
            iconBg="bg-green-100"
          />
          <SummaryCard 
            title="Completed" 
            count={projects.filter(p => p.status === 'Completed').length} 
            icon={<DoneIcon />} 
            bg="bg-emerald-50" 
            iconBg="bg-emerald-100"
          />
          <SummaryCard 
            title="On Hold" 
            count={projects.filter(p => p.status === 'On Hold').length} 
            icon={<AlertIcon />} 
            bg="bg-yellow-50" 
            iconBg="bg-yellow-100"
          />
        </div>

        {/* Projects Table */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">My Projects</h2>
            <p className="text-sm text-gray-600 mt-0.5">View and manage your assigned projects</p>
          </div>

          {projects.length === 0 ? (
            <div className="p-8 text-center">
              <div className="flex items-center justify-center w-14 h-14 bg-blue-50 rounded-full mx-auto mb-3">
                <FiFolder className="w-7 h-7 text-blue-500" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">No Projects Assigned</h3>
              <p className="text-sm text-gray-500 mb-1">You are not assigned to any projects yet.</p>
              <p className="text-xs text-gray-400">Contact your manager to get assigned to projects.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      { key: 'project', label: 'Project' },
                      { key: 'leader', label: 'Leader' },
                      { key: 'start', label: 'Start Date' },
                      { key: 'end', label: 'End Date' },
                      { key: 'status', label: 'Status' },
                      { key: 'actions', label: 'Actions' }
                    ].map((header) => (
                      <th
                        key={header.key}
                        className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {header.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {projects.map((project) => (
                    <tr
                      key={project._id}
                      className="hover:bg-blue-50 cursor-pointer transition-all duration-200 hover:shadow-sm"
                      onClick={() => handleProjectClick(project._id)}
                    >
                      {/* Project name */}
                      <td className="px-5 py-3">
                        <div className="flex items-center">
                          <div className="h-9 w-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FiFolder className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="ml-3 min-w-0 flex-1">
                            <div className="text-sm font-semibold text-gray-900 truncate">{project.name}</div>
                            {project.description && (
                              <div className="text-xs text-gray-500 truncate mt-0.5">{project.description}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Leader */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <FiUser className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {project.projectLeader?.name || 'Not assigned'}
                          </span>
                        </div>
                      </td>

                      {/* Dates */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {project.startDate ? new Date(project.startDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          }) : 'Not set'}
                        </div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {project.endDate ? new Date(project.endDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          }) : 'Not set'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg ${getStatusColor(
                            project.status
                          )}`}
                        >
                          {project.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-blue-50 transition">
                          <FiChevronRight className="w-4 h-4 text-gray-400 hover:text-blue-600 transition" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* --- Helper Components --- */
const SummaryCard = ({ title, count, icon, bg, iconBg }) => (
  <div className={`${bg} rounded-lg shadow-sm border border-gray-200 p-4 transition hover:shadow-md`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium text-gray-600 mb-1">{title}</p>
        <p className="text-xl font-semibold text-gray-900">{count}</p>
      </div>
      <div className={`w-9 h-9 ${iconBg} rounded-lg flex items-center justify-center`}>
        {icon}
      </div>
    </div>
  </div>
);

const CheckIcon = () => (
  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const DoneIcon = () => (
  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const AlertIcon = () => (
  <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
  </svg>
);

export default EmployeeProjects;
