import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchEmployees } from '../../context/employeeSlice';
import { FaSearch, FaTimes, FaEdit, FaTrash, FaEye, FaUserPlus, FaEllipsisV, FaChevronLeft, FaChevronRight, FaPlus } from 'react-icons/fa';
import axios from '../../utils/axios';
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
  const [activeFilter, setActiveFilter] = useState('all');
  const [todayStatusMap, setTodayStatusMap] = useState({});
  const [onLeaveTodayMap, setOnLeaveTodayMap] = useState({});
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

  useEffect(() => {
    let stale = false;
    const fetchLiveTeamSignals = async () => {
      try {
        const [attendanceRes, leavesRes] = await Promise.all([
          axios.get('/v1/both/attendance/today-status', { withCredentials: true }),
          axios.get('/v1/admin/leave/get-all-leaves', {
            params: { status: 'approved', page: 1, limit: 500 },
            withCredentials: true
          })
        ]);

        if (stale) return;

        const statusRows = Array.isArray(attendanceRes.data?.data) ? attendanceRes.data.data : [];
        const nextStatusMap = {};
        statusRows.forEach((row) => {
          const id = row?.employee?._id ? String(row.employee._id) : '';
          if (!id) return;
          nextStatusMap[id] = row;
        });
        setTodayStatusMap(nextStatusMap);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const approvedLeaves = Array.isArray(leavesRes.data?.leaves) ? leavesRes.data.leaves : [];
        const nextOnLeaveMap = {};
        approvedLeaves.forEach((leave) => {
          const employeeId = String(leave?.employee?._id || leave?.employee || '');
          if (!employeeId || !leave?.startDate || !leave?.endDate) return;
          const start = new Date(leave.startDate);
          const end = new Date(leave.endDate);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && today >= start && today <= end) {
            nextOnLeaveMap[employeeId] = true;
          }
        });
        setOnLeaveTodayMap(nextOnLeaveMap);
      } catch (_) {
        if (!stale) {
          setTodayStatusMap({});
          setOnLeaveTodayMap({});
        }
      }
    };

    fetchLiveTeamSignals();
    return () => {
      stale = true;
    };
  }, [currentPage, debouncedSearchTerm]);

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
  const teamCount = pagination?.total || (employees || []).length;

  const filteredEmployees = useMemo(() => {
    const list = employees || [];
    if (activeFilter === 'all') return list;

    return list.filter((emp) => {
      const empId = String(emp?._id || '');
      const attendance = todayStatusMap[empId];
      const statusText = String(attendance?.status || emp?.status || '').toLowerCase();
      const departmentText = String(emp?.department || '').toLowerCase();
      const titleText = String(emp?.jobTitle || '').toLowerCase();
      const positionText = String(emp?.position || '').toLowerCase();
      const probationText = `${departmentText} ${titleText}`.toLowerCase();
      const workLocationText = String(attendance?.workLocation || '').toLowerCase();
      const onLeaveToday = !!onLeaveTodayMap[empId];

      if (activeFilter === 'present') return !onLeaveToday && statusText !== 'absent' && statusText !== 'inactive';
      if (activeFilter === 'leave') return onLeaveToday;
      if (activeFilter === 'remote') return workLocationText.includes('remote') || probationText.includes('remote') || probationText.includes('wfh');
      if (activeFilter === 'probation') return probationText.includes('probation') || probationText.includes('intern') || positionText.includes('junior');
      return true;
    });
  }, [employees, activeFilter, todayStatusMap, onLeaveTodayMap]);

  const quickFilters = [
    { id: 'all', label: 'All' },
    { id: 'present', label: 'Present Today' },
    { id: 'leave', label: 'On Leave' },
    { id: 'remote', label: 'Remote/WFH' },
    { id: 'probation', label: 'Probation' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-5 transition-all duration-300">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold text-slate-900">My Team</h1>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{teamCount} MEMBERS</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-full max-w-md">
                <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search team..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-9 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <FaTimes className="h-4 w-4" />
                  </button>
                )}
              </div>
              {displayUser && <RoleBadge user={displayUser} />}
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {quickFilters.map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setActiveFilter(pill.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeFilter === pill.id
                    ? 'bg-emerald-700 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {status === 'failed' && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              Error loading employees: {error || 'Unknown error occurred'}
            </div>
          )}

          {status === 'loading' && !isInitialLoading && (
            <div className="text-xs text-gray-500 mb-3">Updating results...</div>
          )}

          <div className="mb-7 overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-12 gap-3 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <div className="col-span-4">Member</div>
              <div className="col-span-3">Designation</div>
              <div className="col-span-2">Department</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1 text-right">Today</div>
            </div>
            <div className="divide-y divide-slate-200 bg-white">
              {filteredEmployees.map((row) => {
                const empId = String(row?._id || '');
                const attendance = todayStatusMap[empId];
                const statusText = String(attendance?.status || row?.status || 'active').toLowerCase();
                const onLeave = !!onLeaveTodayMap[empId];
                const statusPill = onLeave ? 'ON LEAVE' : 'ACTIVE';
                const statusClass = onLeave ? 'text-amber-700 bg-amber-100' : 'text-emerald-700 bg-emerald-100';
                const todayValue = onLeave
                  ? 'Out of Office'
                  : attendance?.clockIn
                    ? new Date(attendance.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : statusText === 'absent'
                      ? '--:--'
                      : 'Present';

                return (
                  <button
                    key={row._id}
                    type="button"
                    onClick={() => handleRowClick(row._id)}
                    className="grid w-full grid-cols-12 gap-3 px-5 py-4 text-left hover:bg-slate-50"
                  >
                    <div className="col-span-4 flex items-center gap-3">
                      <ProfilePicture user={row} size="md" className="h-10 w-10" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{row.name} {row.lastName}</p>
                        <p className="text-xs text-slate-500">{row.employeeId || 'EMP-0000'}</p>
                      </div>
                    </div>
                    <div className="col-span-3 text-sm text-slate-700">{row.jobTitle || 'Team Member'}</div>
                    <div className="col-span-2 text-sm text-slate-700">{row.department || 'General'}</div>
                    <div className="col-span-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass}`}>
                        {statusPill}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end gap-3 text-sm text-slate-600">
                      <span>{todayValue}</span>
                      {/* <FaEllipsisV className="text-slate-400" /> */}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {isInitialLoading && (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-theme-secondary"></div>
            </div>
          )}

          {!isInitialLoading && filteredEmployees.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500 text-lg">
                {searchTerm ? 'No employees found matching your search.' : 'No employees found.'}
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              Showing 1-{filteredEmployees.length} of {teamCount}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={!pagination?.hasPrev || status === 'loading'}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <FaChevronLeft />
              </button>
              <span className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-emerald-700 px-3 text-sm font-semibold text-white">
                {pagination?.page || currentPage}
              </span>
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={!pagination?.hasNext || status === 'loading'}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <FaChevronRight />
              </button>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => canAddEmployee && navigate('/add-employee')}
        className="fixed bottom-8 right-8 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700"
        aria-label="Add employee"
      >
        <FaUserPlus className="h-4 w-4" />
      </button>
    </div>
  );
};

export default EmployeesPage;