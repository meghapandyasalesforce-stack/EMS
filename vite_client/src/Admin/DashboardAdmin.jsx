import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useGetAllProjects from "../Hooks/useGetAllProjects";
import { useDispatch, useSelector } from "react-redux";
import { fetchEmployees } from "../context/employeeSlice";
import NotificationSender from "./NotificationSender";

function DashboardAdmin() {
  const dispatch = useDispatch();
  const { employees = [] } = useSelector((state) => state.employees || {});
  const { projects = [] } = useSelector((state) => state.projects || {});
  const { payrolls = [] } = useSelector((state) => state.payrolls || {});
  const employeeCount = employees?.length || 0;
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const navigate = useNavigate();

  useEffect(() => {
    dispatch(fetchEmployees());
  }, [dispatch]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useGetAllProjects();

  // Calculate main content margin - fixed sidebar is always 64 (w-64)
  const mainContentMargin = isMobile ? 'ml-0' : 'ml-64';

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Main Content - responsive to sidebar width */}
      <div className={`flex-1 p-4 md:p-8 transition-all duration-300 ${mainContentMargin}`}>
        {/* Mobile Header is now in Header component */}

        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6 md:mb-8">Admin Dashboard</h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
          <div className="bg-white p-4 md:p-6 rounded-xl shadow-md border-l-4 border-blue-500 hover:shadow-lg transition-shadow">
            <div className="flex items-center">
              <div className="p-2 md:p-3 rounded-full bg-blue-100 text-blue-600 mr-3 md:mr-4">
                <span className="text-xl">👥</span>
              </div>
              <div>
                <h3 className="text-gray-500 text-sm font-medium">Employees</h3>
                <p className="text-gray-800 text-xl md:text-2xl font-bold">{employeeCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 md:p-6 rounded-xl shadow-md border-l-4 border-green-500 hover:shadow-lg transition-shadow">
            <div className="flex items-center">
              <div className="p-2 md:p-3 rounded-full bg-green-100 text-green-600 mr-3 md:mr-4">
                <span className="text-xl">📋</span>
              </div>
              <div>
                <h3 className="text-gray-500 text-sm font-medium">Projects</h3>
                <p className="text-gray-800 text-xl md:text-2xl font-bold">{projects.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 md:p-6 rounded-xl shadow-md border-l-4 border-purple-500 hover:shadow-lg transition-shadow">
            <div className="flex items-center">
              <div className="p-2 md:p-3 rounded-full bg-purple-100 text-purple-600 mr-3 md:mr-4">
                <span className="text-xl">💰</span>
              </div>
              <div>
                <h3 className="text-gray-500 text-sm font-medium">Payrolls</h3>
                <p className="text-gray-800 text-xl md:text-2xl font-bold">{payrolls.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Announcement Section */}
        <div className="bg-white p-4 md:p-6 rounded-xl mb-6 md:mb-8">
          <NotificationSender />
        </div>

        {/* Projects and Employees Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
          {/* Projects Section */}
          <div className="bg-white p-4 md:p-6 rounded-xl shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 md:mb-6 gap-2">
              <h2 className="text-lg md:text-xl font-semibold text-gray-800">Recent Projects</h2>
              <button
                onClick={() => navigate("/add-project")}
                className="bg-blue-600 hover:bg-blue-700 text-white py-1 md:py-2 px-3 md:px-4 rounded-lg transition duration-300 flex items-center text-sm md:text-base"
              >
                <span className="mr-1">+</span> Add Project
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody>
                  {projects.slice(0, 5).map((project) => (
                    <tr key={project._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 md:py-3 px-2">
                        <div className="font-medium text-sm md:text-base">{project.name}</div>
                        <div className="text-xs md:text-sm text-gray-500">{project.status}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {projects.length > 5 && (
                <div className="text-center mt-3 md:mt-4">
                  <button 
                    onClick={() => navigate("/projects")}
                    className="text-blue-600 hover:text-blue-800 text-xs md:text-sm font-medium"
                  >
                    View All Projects →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Employees Section */}
          <div className="bg-white p-4 md:p-6 rounded-xl shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 md:mb-6 gap-2">
              <h2 className="text-lg md:text-xl font-semibold text-gray-800">Recent Employees</h2>
              <button
                onClick={() => navigate("/add-employee")}
                className="bg-blue-600 hover:bg-blue-700 text-white py-1 md:py-2 px-3 md:px-4 rounded-lg transition duration-300 flex items-center text-sm md:text-base"
              >
                <span className="mr-1">+</span> Add Employee
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody>
                  {employees.slice(0, 5)?.map((emp) => (
                    <tr key={emp._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 md:py-3 px-2">
                        <div className="font-medium text-sm md:text-base">{emp.name} {emp.lastName}</div>
                        <div className="text-xs md:text-sm text-gray-500">{emp.position}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {employees.length > 5 && (
                <div className="text-center mt-3 md:mt-4">
                  <button 
                    onClick={() => navigate("/employees")}
                    className="text-blue-600 hover:text-blue-800 text-xs md:text-sm font-medium"
                  >
                    View All Employees →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Attendance Section */}
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-md mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3">
            <h2 className="text-lg md:text-xl font-semibold text-gray-800">Attendance</h2>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <button
                onClick={() => navigate("/today-attendance")}
                className="bg-blue-600 hover:bg-blue-700 text-white py-1 md:py-2 px-3 md:px-4 rounded-lg transition duration-300 text-sm md:text-base"
              >
                Today's Attendance
              </button>
              <button
                onClick={() => navigate("/all-attendance-history")}
                className="bg-green-600 hover:bg-green-700 text-white py-1 md:py-2 px-3 md:px-4 rounded-lg transition duration-300 text-sm md:text-base"
              >
                All Attendance Report
              </button>
            </div>
          </div>
        </div>

        {/* Payrolls Section */}
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-md">
          <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-4 md:mb-6">Recent Payrolls</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <tbody>
                {(Array.isArray(payrolls) ? payrolls.slice(0, 5) : []).map((payroll) => (
                  <tr key={payroll._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 md:py-3 px-2">
                      <div className="font-medium text-sm md:text-base">{payroll.employeeName}</div>
                      <div className="text-xs md:text-sm text-gray-500">${payroll.amount} • {payroll.status}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {payrolls.length > 5 && (
              <div className="text-center mt-3 md:mt-4">
                <button 
                  onClick={() => navigate("/admin-payroll")}
                  className="text-blue-600 hover:text-blue-800 text-xs md:text-sm font-medium"
                >
                  View All Payrolls →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardAdmin;