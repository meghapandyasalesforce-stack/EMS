import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { fetchEmployees } from '../../context/employeeSlice';
import {
  FaSearch,
  FaTimes,
  FaUserPlus,
  FaChevronLeft,
  FaChevronRight,
  FaChevronDown,
  FaFileExport,
  FaFileCsv,
  FaFileExcel,
  FaFilePdf,
} from 'react-icons/fa';
import axios from '../../utils/axios';
import useAuthPermissions from '../../Hooks/useAuthPermissions';
import { PERMISSIONS } from '../../utils/permissions';
import EmployeeMemberAvatar from './EmployeeMemberAvatar';
import '../../styles/directoryUI.css';

function downloadRosterCsv(rows, filename) {
  const headers = ['Employee ID', 'Name', 'Job Title', 'Department', 'Email', 'Status'];
  const escape = (value) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      [
        row.employeeId || '',
        `${row.name || ''} ${row.lastName || ''}`.trim(),
        row.jobTitle || '',
        row.department || '',
        row.email || '',
        row.status || (row.active === false ? 'Inactive' : 'Active'),
      ]
        .map(escape)
        .join(',')
    ),
  ];
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const EmployeesPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { employees, status, error, pagination } = useSelector((state) => state.employees);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState('all');
  const [todayStatusMap, setTodayStatusMap] = useState({});
  const [onLeaveTodayMap, setOnLeaveTodayMap] = useState({});
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);
  const pageSize = 20;

  const { hasPermission, isOrgOwner, isHrManager, isHrExecutive } = useAuthPermissions();
  const canAddEmployee =
    isOrgOwner ||
    isHrManager ||
    isHrExecutive ||
    hasPermission(PERMISSIONS.EMPLOYEE_CREATE);

  useEffect(() => {
    dispatch(fetchEmployees({ page: currentPage, limit: pageSize, search: debouncedSearchTerm }));
  }, [dispatch, currentPage, debouncedSearchTerm]);

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

  useEffect(() => {
    const onPointer = (event) => {
      if (exportRef.current && !exportRef.current.contains(event.target)) setExportOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, []);

  const isInitialLoading = status === 'loading' && (!employees || employees.length === 0);
  const teamCount = pagination?.total || (employees || []).length;

  const filteredEmployees = useMemo(() => {
    const list = employees || [];
    if (activeFilter === 'all') return list;

    return list.filter((emp) => {
      const empId = String(emp?._id || '');
      const attendance = todayStatusMap[empId];
      const statusText = String(attendance?.status || emp?.status || '').toLowerCase();
      const employmentStatus = String(emp?.status || '').toLowerCase();
      const isTerminated = employmentStatus === 'terminated';
      const isInactive = emp?.active === false || employmentStatus === 'inactive' || employmentStatus === 'suspended';
      const departmentText = String(emp?.department || '').toLowerCase();
      const titleText = String(emp?.jobTitle || '').toLowerCase();
      const roleText = `${departmentText} ${titleText}`.toLowerCase();
      const workLocationText = String(attendance?.workLocation || '').toLowerCase();
      const onLeaveToday = !!onLeaveTodayMap[empId];
      const probationStatus = String(emp?.probation?.status || '').trim();

      if (isInactive || isTerminated) return false;
      if (activeFilter === 'present') return !onLeaveToday && statusText !== 'absent' && statusText !== 'inactive';
      if (activeFilter === 'leave') return onLeaveToday;
      if (activeFilter === 'remote') return workLocationText.includes('remote') || roleText.includes('remote') || roleText.includes('wfh');
      if (activeFilter === 'probation') return probationStatus === 'Active' || probationStatus === 'Extended';
      return true;
    });
  }, [employees, activeFilter, todayStatusMap, onLeaveTodayMap]);

  const liveCounts = useMemo(() => {
    const list = employees || [];
    let onLeave = 0;
    let present = 0;
    list.forEach((emp) => {
      const empId = String(emp?._id || '');
      if (onLeaveTodayMap[empId]) {
        onLeave += 1;
        return;
      }
      const attendance = todayStatusMap[empId];
      const statusText = String(attendance?.status || emp?.status || '').toLowerCase();
      if (statusText !== 'absent' && statusText !== 'inactive') present += 1;
    });
    return { onLeave, present };
  }, [employees, todayStatusMap, onLeaveTodayMap]);

  const exportRoster = useCallback(
    (format) => {
      const rows = filteredEmployees;
      if (!rows.length) {
        toast.info('No employees to export for the current filters.');
        setExportOpen(false);
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === 'pdf') {
        const win = window.open('', '_blank');
        if (!win) {
          toast.error('Pop-up blocked. Allow pop-ups to export PDF.');
          setExportOpen(false);
          return;
        }
        const body = rows
          .map(
            (row) =>
              `<tr><td>${row.employeeId || ''}</td><td>${`${row.name || ''} ${row.lastName || ''}`.trim()}</td><td>${row.jobTitle || ''}</td><td>${row.department || ''}</td></tr>`
          )
          .join('');
        win.document.write(
          `<!doctype html><html><head><title>EMS Directory</title><style>body{font-family:system-ui,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px;text-align:left;font-size:12px}th{background:#f0f3ff}</style></head><body><h1>Employee Directory</h1><table><thead><tr><th>ID</th><th>Name</th><th>Role</th><th>Department</th></tr></thead><tbody>${body}</tbody></table></body></html>`
        );
        win.document.close();
        win.focus();
        win.print();
        toast.success('Print dialog opened for PDF export');
      } else {
        const ext = format === 'xlsx' ? 'csv' : 'csv';
        downloadRosterCsv(rows, `EMS_Directory_${stamp}.${ext}`);
        toast.success(`Exported ${rows.length} employee record${rows.length === 1 ? '' : 's'}`);
      }
      setExportOpen(false);
    },
    [filteredEmployees]
  );

  const quickFilters = [
    { id: 'all', label: 'All' },
    { id: 'present', label: 'Present Today' },
    { id: 'leave', label: 'On Leave' },
    { id: 'remote', label: 'Remote/WFH' },
    { id: 'probation', label: 'Probation' },
  ];

  const rowMeta = (row) => {
    const empId = String(row?._id || '');
    const attendance = todayStatusMap[empId];
    const statusText = String(attendance?.status || row?.status || 'active').toLowerCase();
    const employmentStatus = String(row?.status || '').toLowerCase();
    const onLeave = !!onLeaveTodayMap[empId];
    const isTerminated = employmentStatus === 'terminated';
    const isInactive = row?.active === false || employmentStatus === 'inactive' || employmentStatus === 'suspended';
    const statusPill = isTerminated
      ? 'TERMINATED'
      : isInactive
        ? 'INACTIVE'
        : onLeave
          ? 'ON LEAVE'
          : statusText === 'absent'
            ? 'ABSENT'
            : 'ACTIVE';
    const statusClass = isTerminated
      ? 'text-slate-700 bg-slate-200'
      : isInactive
        ? 'text-rose-700 bg-rose-100'
        : onLeave
          ? 'text-amber-700 bg-amber-100'
          : statusText === 'absent'
            ? 'text-slate-700 bg-slate-100'
            : 'text-emerald-700 bg-emerald-100';
    const todayValue = isTerminated
      ? 'Terminated'
      : isInactive
        ? 'Inactive'
        : onLeave
          ? 'Out of Office'
          : attendance?.clockIn
            ? new Date(attendance.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : statusText === 'absent'
              ? '--:--'
              : 'Present';
    return { statusPill, statusClass, todayValue };
  };

  const exportMenu = (
    <div className="emp-directory__export-wrap" ref={exportRef}>
      <button
        type="button"
        className="emp-directory__export-btn"
        aria-haspopup="menu"
        aria-expanded={exportOpen}
        onClick={() => setExportOpen((open) => !open)}
      >
        <FaFileExport aria-hidden="true" />
        <span>Export Roster</span>
        <FaChevronDown aria-hidden="true" />
      </button>
      {exportOpen ? (
        <div className="emp-directory__export-menu" role="menu">
          <p className="emp-directory__export-menu-label">Select Format</p>
          <button type="button" role="menuitem" className="emp-directory__export-item" onClick={() => exportRoster('csv')}>
            <span><FaFileCsv aria-hidden="true" /> Comma Separated (.csv)</span>
            <small>CSV</small>
          </button>
          <button type="button" role="menuitem" className="emp-directory__export-item" onClick={() => exportRoster('xlsx')}>
            <span><FaFileExcel aria-hidden="true" /> Microsoft Excel (.csv)</span>
            <small>Excel</small>
          </button>
          <button type="button" role="menuitem" className="emp-directory__export-item" onClick={() => exportRoster('pdf')}>
            <span><FaFilePdf aria-hidden="true" /> Audit Dossier (.pdf)</span>
            <small>PDF</small>
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="emp-directory page-shell min-h-screen transition-all duration-300">
      <div className="page-shell-inner hrms-stack">
        <div className="emp-directory__header">
          <div className="emp-directory__heading">
            <p className="emp-directory__eyebrow">People · Directory</p>
            <h1 className="emp-directory__title">Employee Directory</h1>
          </div>
          <div className="emp-directory__header-end">
            <div className="emp-directory__stats" aria-label="Directory summary">
              <div className="emp-directory__stat">
                <span className="emp-directory__stat-dot" aria-hidden="true" />
                Total Headcount: <strong>{teamCount.toLocaleString()}</strong>
              </div>
              <div className="emp-directory__stat">
                Active Today: <strong className="is-primary">{liveCounts.present.toLocaleString()}</strong>
              </div>
              <div className="emp-directory__stat">
                On Leave: <strong className="is-secondary">{liveCounts.onLeave.toLocaleString()}</strong>
              </div>
            </div>
            <div className="emp-directory__actions">
              {exportMenu}
              {canAddEmployee ? (
                <button
                  type="button"
                  className="emp-directory__btn emp-directory__btn-primary"
                  onClick={() => navigate('/add-employee')}
                >
                  <FaUserPlus aria-hidden="true" />
                  + Add Employee
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {status === 'failed' && (
          <div className="emp-add__error" style={{ marginBottom: '1rem' }}>
            Error loading employees: {error || 'Unknown error occurred'}
          </div>
        )}

        {status === 'loading' && !isInitialLoading && (
          <div className="text-xs text-[var(--dir-outline)] mb-3">Updating results...</div>
        )}

        <div className="emp-directory__roster">
          <div className="emp-directory__filters emp-directory__filters--inboard">
            <div className="emp-directory__filters-row">
              <div className="emp-directory__search">
                <FaSearch aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Search by name, ID, role, or department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  aria-label="Search team"
                />
                {searchTerm ? (
                  <button
                    type="button"
                    className="emp-directory__search-clear"
                    onClick={() => setSearchTerm('')}
                    aria-label="Clear search"
                  >
                    <FaTimes />
                  </button>
                ) : null}
              </div>
              <div className="emp-directory__pills" role="toolbar" aria-label="Quick filters">
                {quickFilters.map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setActiveFilter(pill.id)}
                    className={`emp-directory__pill${activeFilter === pill.id ? ' is-active' : ''}`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="emp-directory__table-scroll">
            <div className="emp-directory__table-head">
              <div>Employee Details</div>
              <div>Role &amp; Team</div>
              <div>Department</div>
              <div>Status</div>
              <div className="text-right">Today</div>
            </div>
            <div>
              {filteredEmployees.map((row) => {
                const { statusPill, statusClass, todayValue } = rowMeta(row);
                return (
                  <button
                    key={row._id}
                    type="button"
                    onClick={() => handleRowClick(row._id)}
                    className="emp-directory__table-row"
                  >
                    <div className="emp-directory__member">
                      <EmployeeMemberAvatar user={row} sizeClassName="h-11 w-11" />
                      <div className="emp-directory__member-text">
                        <p className="emp-directory__member-name">{row.name} {row.lastName}</p>
                        <div className="emp-directory__member-meta">
                          <span className="emp-directory__id-pill">{row.employeeId || 'EMP-0000'}</span>
                          {row.email ? <span className="emp-directory__member-email">{row.email}</span> : null}
                        </div>
                      </div>
                    </div>
                    <div className="emp-directory__cell">
                      <span className="emp-directory__cell-strong">{row.jobTitle || 'Team Member'}</span>
                    </div>
                    <div className="emp-directory__cell">{row.department || 'General'}</div>
                    <div>
                      <span className={`emp-directory__status ${statusClass}`}>{statusPill}</span>
                    </div>
                    <div className="emp-directory__cell text-right emp-directory__cell-strong">{todayValue}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="emp-directory__cards">
            {filteredEmployees.map((row) => {
              const { statusPill, statusClass, todayValue } = rowMeta(row);
              return (
                <button
                  key={`card-${row._id}`}
                  type="button"
                  className="emp-directory__card"
                  onClick={() => handleRowClick(row._id)}
                >
                  <div className="emp-directory__card-top">
                    <div className="emp-directory__member">
                      <EmployeeMemberAvatar user={row} sizeClassName="h-10 w-10" />
                      <div className="emp-directory__member-text">
                        <p className="emp-directory__member-name">{row.name} {row.lastName}</p>
                        <p className="emp-directory__member-id">{row.employeeId || 'EMP-0000'}</p>
                      </div>
                    </div>
                    <span className={`emp-directory__status ${statusClass}`}>{statusPill}</span>
                  </div>
                  <div className="emp-directory__card-meta">
                    <div>
                      Role
                      <strong>{row.jobTitle || 'Team Member'}</strong>
                    </div>
                    <div>
                      Department
                      <strong>{row.department || 'General'}</strong>
                    </div>
                    <div>
                      Today
                      <strong>{todayValue}</strong>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {isInitialLoading && (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--dir-primary)]" />
            </div>
          )}

          {!isInitialLoading && filteredEmployees.length === 0 && (
            <div className="emp-directory__empty">
              <h3>No employees matched your criteria</h3>
              <p>
                {searchTerm
                  ? 'We couldn’t locate any employee records matching your search.'
                  : 'No employees found.'}
              </p>
            </div>
          )}

          <div className="emp-directory__footer">
            <p className="text-sm text-[var(--dir-on-variant)] m-0">
              Showing 1-{filteredEmployees.length} of {teamCount}
            </p>
            <div className="emp-directory__pager">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={!pagination?.hasPrev || status === 'loading'}
                className="emp-directory__pager-btn"
                aria-label="Previous page"
              >
                <FaChevronLeft />
              </button>
              <span className="emp-directory__pager-btn is-current">
                {pagination?.page || currentPage}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={!pagination?.hasNext || status === 'loading'}
                className="emp-directory__pager-btn"
                aria-label="Next page"
              >
                <FaChevronRight />
              </button>
            </div>
          </div>
        </div>
      </div>

      {canAddEmployee ? (
        <button
          type="button"
          onClick={() => navigate('/add-employee')}
          className="emp-directory__fab"
          aria-label="Add employee"
        >
          <FaUserPlus className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
};

export default EmployeesPage;
