import React, { useEffect, useMemo, useState } from 'react';
import {
  FiSearch,
  FiBell,
  FiUser,
  FiChevronRight,
  FiCalendar,
  FiAlertCircle
} from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMyProjects } from '../../context/employeeTaskSlice';
import { useNavigate } from 'react-router-dom';

const EmployeeProjects = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { myProjects = [], status = 'idle', error = null } = useSelector(state => state.employeeTask || {});
  const projects = Array.isArray(myProjects) ? myProjects : [];
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  useEffect(() => {
    dispatch(fetchMyProjects());
  }, [dispatch]);

  const handleProjectClick = (projectId) => {
    navigate(`/employee/projects/${projectId}`);
  };

  const normalizeStatus = (value) => {
    const s = String(value || '').toLowerCase().trim();
    if (s.includes('complete') || s.includes('done')) return 'Completed';
    if (s.includes('hold') || s.includes('blocked')) return 'On Hold';
    if (s.includes('progress') || s.includes('active') || s.includes('ongoing')) return 'In Progress';
    return 'In Progress';
  };

  const getStatusStyles = (statusValue) => {
    const normalized = normalizeStatus(statusValue);
    if (normalized === 'Completed') {
      return {
        dot: 'bg-emerald-500',
        text: 'text-emerald-700',
        pill: 'bg-emerald-50 border-emerald-100'
      };
    }
    if (normalized === 'On Hold') {
      return {
        dot: 'bg-slate-400',
        text: 'text-slate-600',
        pill: 'bg-slate-50 border-slate-200'
      };
    }
    return {
      dot: 'bg-[#20C997]',
      text: 'text-[#0F766E]',
      pill: 'bg-[#ECFDF5] border-[#CFFAFE]'
    };
  };

  const getCategory = (project) => {
    return String(
      project?.department?.name ||
      project?.department ||
      project?.category ||
      project?.team ||
      'General'
    ).toUpperCase();
  };

  const getProgress = (project) => {
    const raw = Number(
      project?.progress ??
      project?.progressPercent ??
      project?.completionPercent ??
      project?.completionPercentage ??
      project?.completion ??
      0
    );
    if (!Number.isFinite(raw)) return 0;
    return Math.max(0, Math.min(100, Math.round(raw)));
  };

  const getInitials = (name) => {
    if (!name) return 'NA';
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  };

  const formatDueDate = (value) => {
    if (!value) return 'No due date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'No due date';
    return `Due ${date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`;
  };

  const isDueThisWeek = (value) => {
    if (!value) return false;
    const due = new Date(value);
    if (Number.isNaN(due.getTime())) return false;
    const now = new Date();
    const weekLater = new Date(now);
    weekLater.setDate(now.getDate() + 7);
    return due >= now && due <= weekLater;
  };

  const filteredProjects = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return projects.filter((project) => {
      const normalizedStatus = normalizeStatus(project?.status);
      const matchesFilter = activeFilter === 'All' || normalizedStatus === activeFilter;
      if (!matchesFilter) return false;

      if (!q) return true;
      const searchable = [
        project?.name,
        project?.description,
        project?.projectLeader?.name,
        getCategory(project),
        normalizedStatus
      ].join(' ').toLowerCase();
      return searchable.includes(q);
    });
  }, [projects, searchTerm, activeFilter]);

  const totalProjects = projects.length;
  const dueThisWeek = projects.filter((p) => isDueThisWeek(p?.endDate)).length;

  const filters = ['All', 'In Progress', 'Completed', 'On Hold'];

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FB] p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-transparent border-t-[#20C997] border-r-[#20C997]" />
          <p className="text-sm text-slate-600">Loading projects...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FB] p-6">
        <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="flex justify-center mb-3">
            <FiAlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="mb-2 text-base font-semibold text-slate-900">Error loading projects</h2>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <div className="page-shell">
      <div className="page-shell-inner">
      <div className="hrms-stack">
        <header>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-3xl font-bold tracking-tight text-[#0F172A]">Workspace</p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto lg:min-w-0 lg:flex-1 lg:justify-end">
              <div className="relative w-full min-w-0 sm:max-w-xs lg:max-w-sm">
                <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search projects..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-[#20C997] focus:ring-2 focus:ring-[#20C997]/20"
                />
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600"
                  aria-label="Notifications"
                >
                  <FiBell className="h-4 w-4" />
                </button>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                  <FiUser className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">Project Directory</h1>
              <p className="mt-1 text-sm text-slate-600">Manage and track all ongoing workspace initiatives.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => {
                const active = activeFilter === filter;
                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition sm:px-5 sm:text-sm ${
                      active
                        ? 'bg-[#20C997] text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-[#20C997]/40'
                    }`}
                  >
                    {filter}
                  </button>
                );
              })}
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#ECFDF5]">
                <FiAlertCircle className="h-6 w-6 text-[#0F766E]" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">No projects found</h3>
              <p className="mt-1 text-sm text-slate-500">
                {projects.length === 0
                  ? 'You are not assigned to any projects yet.'
                  : 'Try adjusting your search or status filter.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredProjects.map((project) => {
                const statusLabel = normalizeStatus(project?.status);
                const styles = getStatusStyles(statusLabel);
                const progress = getProgress(project);
                const leaderName = project?.projectLeader?.name || 'Not assigned';
                const initials = getInitials(leaderName);

                return (
                  <button
                    key={project._id}
                    type="button"
                    onClick={() => handleProjectClick(project._id)}
                    className="rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm transition hover:shadow-md"
                  >
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                        {getCategory(project)}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${styles.pill} ${styles.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
                        {statusLabel}
                      </span>
                    </div>

                    <h3 className="line-clamp-1 text-2xl font-semibold tracking-tight text-slate-900">{project?.name || 'Untitled Project'}</h3>
                    <p className="mt-2 line-clamp-2 min-h-[44px] text-sm leading-5 text-slate-600">
                      {project?.description || 'No project description provided.'}
                    </p>

                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Progress</p>
                        <p className="text-xs font-semibold text-[#0F766E]">{progress}%</p>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[#20C997]"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ECFDF5] text-[11px] font-semibold text-[#0F766E]">
                          {initials}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <FiCalendar className="h-3.5 w-3.5" />
                          {formatDueDate(project?.endDate)}
                        </div>
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:border-[#20C997]/40 hover:text-[#20C997]">
                        <FiChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-[#F8FAFC] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex items-center gap-8">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total Projects</p>
                <p className="text-2xl font-bold text-slate-900">{totalProjects} Active</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">This Week</p>
                <p className="text-2xl font-bold text-[#0F766E]">{dueThisWeek} Due</p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-full bg-[#0F766E] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0C685F]"
            >
              View Full Report
            </button>
          </div>
        </section>
      </div>
      </div>
      </div>
    </div>
  );
};

export default EmployeeProjects;
