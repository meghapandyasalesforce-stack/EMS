import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import {
  FiChevronDown,
  FiChevronUp,
  FiDownload,
  FiLayers,
  FiList,
  FiMaximize2,
  FiMinus,
  FiMoreHorizontal,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import OrgChartConnectors from './orgChart/OrgChartConnectors';
import OrgChartLevelsView from './orgChart/OrgChartLevelsView';
import OrgChartRecordsView from './orgChart/OrgChartRecordsView';
import './orgChart/organizationChart.css';
import axios from '../../utils/axios';
import EmployeeMemberAvatar from '../Employee/EmployeeMemberAvatar';
import {
  NODE_CENTER_X,
  buildChartLayout,
  clampPan,
  getAllowedIds,
  getAncestors,
  getById,
  getChildren,
  getDescendants,
  getFullName,
  isExecutive,
  managerStateLabel,
  matchesDepartment,
  mergeDepartmentsWithCounts,
  renderOrgChartToCanvas,
} from './orgChart/chartUtils';
import { ORG_POSITION_LEVELS } from '../../constants/orgPositionLevels';
import { useAuthPermissions } from '../../Hooks/useAuthPermissions';
import { PERMISSIONS } from '../../utils/permissions';

const POSITION_LEVELS = ORG_POSITION_LEVELS;

function downloadPngFromCanvas(canvas, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function OrganizationChartPage() {
  const { isOrgOwner, isHrManager, isHrExecutive, hasPermission } = useAuthPermissions();
  // Structure settings: HR / admin only — hide for normal line/project managers
  const canOpenOrgStructure =
    isOrgOwner ||
    isHrManager ||
    isHrExecutive ||
    hasPermission(PERMISSIONS.ORG_SETTINGS_MANAGE);

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positionLevels, setPositionLevels] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState('chart');

  const [selectedId, setSelectedId] = useState(null);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [expanded, setExpanded] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [positions, setPositions] = useState(new Map());
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [exporting, setExporting] = useState(false);

  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const touchesRef = useRef(new Map());
  const pinchRef = useRef(null);
  const fitPendingRef = useRef(false);

  const loadChart = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('/v1/admin/org-structure/chart', { withCredentials: true });
      const data = res.data?.data || res.data || {};
      const list = Array.isArray(data.employees) ? data.employees : [];
      setEmployees(list);
      setDepartments(Array.isArray(data.departments) ? data.departments : []);
      setPositionLevels(Array.isArray(data.positionLevels) ? data.positionLevels : []);
      setMeta(data.meta || null);

      const allowed = getAllowedIds(list, 'all');
      // Always show the full expanded tree by default
      setExpanded(new Set(list.map((e) => String(e.id))));
      // Side details panel opens only when a card is clicked
      setSelectedId(null);
      setMobilePanelOpen(false);
      fitPendingRef.current = true;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load organization chart');
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChart();
  }, [loadChart]);

  const departmentList = useMemo(
    () => mergeDepartmentsWithCounts(departments, employees),
    [departments, employees]
  );

  useEffect(() => {
    if (!employees.length) return;
    const allowed = getAllowedIds(employees, departmentFilter, departmentList);
    setExpanded(new Set([...allowed].map(String)));
    setSelectedId(null);
    setMobilePanelOpen(false);
    fitPendingRef.current = true;
  }, [departmentFilter, employees, departmentList]);

  const allowedIds = useMemo(
    () => getAllowedIds(employees, departmentFilter, departmentList),
    [employees, departmentFilter, departmentList]
  );

  useEffect(() => {
    const { positions: nextPositions, dimensions: nextDimensions } = buildChartLayout(
      employees,
      allowedIds,
      expanded
    );
    setPositions(nextPositions);
    setDimensions(nextDimensions);
  }, [employees, allowedIds, expanded]);

  const applyTransform = useCallback(() => {
    const world = document.getElementById('org-chart-world');
    if (world) {
      world.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
    }
  }, [pan, zoom]);

  const applyPan = useCallback(
    (nextPan, currentZoom = zoom) => {
      const el = canvasRef.current;
      if (!el) {
        setPan(nextPan);
        return;
      }
      setPan(clampPan(nextPan, currentZoom, dimensions, el.clientWidth, el.clientHeight));
    },
    [dimensions, zoom]
  );

  const fitChart = useCallback(() => {
    const el = canvasRef.current;
    if (!el || !dimensions.width) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const nextZoom = Math.max(
      0.2,
      Math.min(1, (w - 36) / dimensions.width, (h - 125) / dimensions.height)
    );
    setZoom(nextZoom);
    applyPan(
      {
        x: (w - dimensions.width * nextZoom) / 2,
        y: 54 + Math.max(0, (h - 125 - dimensions.height * nextZoom) / 2),
      },
      nextZoom
    );
  }, [dimensions, applyPan]);

  useEffect(() => {
    applyTransform();
  }, [applyTransform]);

  useEffect(() => {
    if (fitPendingRef.current && dimensions.width > 0) {
      fitPendingRef.current = false;
      fitChart();
    }
  }, [dimensions, fitChart]);

  const centerOn = useCallback(
    (id) => {
      const p = positions.get(id);
      const el = canvasRef.current;
      if (!p || !el) return;
      setZoom((z) => Math.max(0.7, z));
      const nextZoom = Math.max(0.7, zoom);
      applyPan(
        {
          x: el.clientWidth / 2 - (p.x + NODE_CENTER_X) * nextZoom,
          y: Math.max(65, el.clientHeight * 0.39) - (p.y + 64) * nextZoom,
        },
        nextZoom
      );
      setZoom(nextZoom);
    },
    [positions, zoom, applyPan]
  );

  const changeZoom = useCallback((delta, point) => {
    setZoom((prevZoom) => {
      const next = Math.min(1.7, Math.max(0.2, prevZoom + delta));
      const el = canvasRef.current;
      const c = point || { x: (el?.clientWidth || 0) / 2, y: (el?.clientHeight || 0) / 2 };
      setPan((prevPan) => {
        const raw = {
          x: c.x - ((c.x - prevPan.x) * next) / prevZoom,
          y: c.y - ((c.y - prevPan.y) * next) / prevZoom,
        };
        const el = canvasRef.current;
        return el
          ? clampPan(raw, next, dimensions, el.clientWidth, el.clientHeight)
          : raw;
      });
      return next;
    });
  }, [dimensions]);

  /**
   * Export full flowchart by drawing layout onto a canvas (no html2canvas / oklch).
   * Does not change the on-screen expand/pan state.
   */
  const exportChart = useCallback(
    async (format = 'png') => {
      if (exporting) return;
      if (!allowedIds.size) {
        toast.error('Chart is not ready to export yet.');
        return;
      }

      setExporting(true);
      try {
        const expandIds = new Set([...allowedIds].map(String));
        const { positions: exportPositions, dimensions: exportDim } = buildChartLayout(
          employees,
          allowedIds,
          expandIds
        );
        if (!exportDim.width || !exportDim.height || !exportPositions.size) {
          toast.error('Chart is not ready to export yet.');
          return;
        }

        const deptLabel =
          departmentFilter === 'all'
            ? 'All departments'
            : departmentList.find((d) => String(d.id || d.name) === departmentFilter)?.name ||
              departmentFilter;
        const title =
          departmentFilter === 'all'
            ? 'Organization Chart'
            : `Organization Chart · ${deptLabel}`;

        const canvas = renderOrgChartToCanvas({
          employees,
          positions: exportPositions,
          dimensions: exportDim,
          scale: 2,
          padding: 48,
          title,
        });

        const stamp = new Date().toISOString().slice(0, 10);
        const deptSlug =
          String(deptLabel)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'department';
        const baseName = `organization-chart-${deptSlug}-${stamp}`;

        if (format === 'pdf') {
          const { jsPDF } = await import('jspdf');
          const imgData = canvas.toDataURL('image/png');
          const orient = canvas.width >= canvas.height ? 'landscape' : 'portrait';
          const pdf = new jsPDF({ orientation: orient, unit: 'mm', format: 'a4' });
          const pageW = pdf.internal.pageSize.getWidth();
          const pageH = pdf.internal.pageSize.getHeight();
          const margin = 8;
          const maxW = pageW - margin * 2;
          const maxH = pageH - margin * 2;
          const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
          const drawW = canvas.width * ratio;
          const drawH = canvas.height * ratio;
          const x = (pageW - drawW) / 2;
          const y = (pageH - drawH) / 2;
          pdf.addImage(imgData, 'PNG', x, y, drawW, drawH, undefined, 'FAST');
          pdf.save(`${baseName}.pdf`);
          toast.success('Organization chart exported as PDF');
        } else {
          downloadPngFromCanvas(canvas, `${baseName}.png`);
          toast.success('Organization chart exported as PNG');
        }
      } catch (err) {
        toast.error(err?.message || 'Failed to export organization chart');
      } finally {
        setExporting(false);
      }
    },
    [exporting, employees, allowedIds, departmentFilter, departmentList]
  );

  const selectEmployee = useCallback(
    (id, { reveal = false } = {}) => {
      const emp = getById(employees, id);
      if (!emp) return;
      setSelectedId(id);
      setMobilePanelOpen(true);
      if (reveal) {
        if (departmentFilter !== 'all') {
          const inDept = matchesDepartment(emp, departmentFilter, departmentList);
          if (!inDept && !isExecutive(emp)) setDepartmentFilter('all');
        }
        getAncestors(employees, id)
          .slice(0, -1)
          .forEach((a) => {
            setExpanded((prev) => new Set([...prev, String(a.id)]));
          });
        setTimeout(() => centerOn(id), 50);
      }
    },
    [employees, departmentFilter, departmentList, centerOn]
  );

  const closeEmployeePanel = useCallback(() => {
    setSelectedId(null);
    setMobilePanelOpen(false);
  }, []);

  const handleViewInChart = useCallback(
    (id) => {
      setActiveView('chart');
      selectEmployee(id, { reveal: true });
    },
    [selectEmployee]
  );

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return employees
      .filter((e) =>
        [getFullName(e), e.jobTitle, e.employeeId, e.department, e.position].some((x) =>
          String(x || '')
            .toLowerCase()
            .includes(q)
        )
      )
      .slice(0, 30);
  }, [employees, searchQuery]);

  const selected = getById(employees, selectedId);
  const pathIds = useMemo(
    () => new Set(getAncestors(employees, selectedId).map((e) => String(e.id))),
    [employees, selectedId]
  );

  const visibleCount = positions.size;
  const levelCounts = useMemo(() => {
    const counts = Object.fromEntries(POSITION_LEVELS.map((l) => [l, 0]));
    for (const e of employees) {
      if (POSITION_LEVELS.includes(e.position)) counts[e.position] += 1;
    }
    return counts;
  }, [employees]);

  const activeDeptName =
    departmentFilter === 'all'
      ? null
      : departmentList.find((d) => String(d.id || d.name) === departmentFilter)?.name ||
        departmentFilter;

  const executiveCount = useMemo(
    () => employees.filter((e) => isExecutive(e) || !e.reportsTo).length,
    [employees]
  );

  const handlePointerDown = (event) => {
    if (event.target.closest('button')) return;
    touchesRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvasRef.current?.setPointerCapture(event.pointerId);
    if (touchesRef.current.size === 1) {
      dragRef.current = { x: event.clientX, y: event.clientY, px: pan.x, py: pan.y };
      canvasRef.current?.classList.add('dragging');
    } else if (touchesRef.current.size === 2) {
      const [a, b] = [...touchesRef.current.values()];
      pinchRef.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        zoom,
      };
      dragRef.current = null;
    }
  };

  const handlePointerMove = (event) => {
    if (!touchesRef.current.has(event.pointerId)) return;
    touchesRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinchRef.current && touchesRef.current.size === 2) {
      const [a, b] = [...touchesRef.current.values()];
      const rect = canvasRef.current.getBoundingClientRect();
      const next =
        pinchRef.current.zoom *
        (Math.hypot(a.x - b.x, a.y - b.y) / pinchRef.current.distance);
      changeZoom(next - zoom, {
        x: (a.x + b.x) / 2 - rect.left,
        y: (a.y + b.y) / 2 - rect.top,
      });
    } else if (dragRef.current) {
      const el = canvasRef.current;
      const raw = {
        x: dragRef.current.px + event.clientX - dragRef.current.x,
        y: dragRef.current.py + event.clientY - dragRef.current.y,
      };
      applyPan(raw);
    }
  };

  const endPointer = (event) => {
    touchesRef.current.delete(event.pointerId);
    dragRef.current = null;
    pinchRef.current = null;
    canvasRef.current?.classList.remove('dragging');
  };

  const renderPanel = () => {
    if (!selected) {
      return (
        <div className="panel-empty">
          <FiUsers className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <h2 className="text-base font-semibold text-slate-800">Meet your organization</h2>
          <p className="mt-1">Select a person to explore their role and reporting relationships.</p>
        </div>
      );
    }

    const manager =
      selected.reportsTo && allowedIds.has(String(selected.reportsTo))
        ? getById(employees, selected.reportsTo)
        : null;
    const reports = getChildren(employees, selected.id);
    const chain = getAncestors(employees, selected.id);
    const teamSize = getDescendants(employees, selected.id).length;
    const stateLabel = managerStateLabel(selected.managerState);

    return (
      <>
        <div className="panel-topline">
          <div className="panel-topline-main">
            <span className="panel-topline-title">EMPLOYEE DETAILS</span>
            {selected.employeeId ? (
              <span className="panel-topline-id">{selected.employeeId}</span>
            ) : null}
          </div>
          <button
            type="button"
            className="icon-button mobile-close"
            aria-label="Close details"
            title="Close details"
            onClick={closeEmployeePanel}
          >
            <FiX />
          </button>
        </div>
        <div className="profile-block">
          <div className="flex justify-center">
            <EmployeeMemberAvatar user={selected} sizeClassName="h-16 w-16" />
          </div>
          <h2>{getFullName(selected)}</h2>
          <p>{selected.jobTitle}</p>
          <div className="profile-badges">
            <span className="level-pill">{selected.position || '—'}</span>
            <span className={`active-badge ${selected.active ? '' : 'inactive-badge'}`}>
              {selected.active ? 'Active' : selected.status || 'Inactive'}
            </span>
          </div>
          {stateLabel ? (
            <p className="mt-2 text-xs text-amber-700">{stateLabel}</p>
          ) : null}
          {selected.hasCycle ? (
            <p className="mt-1 text-xs text-red-600">Circular reporting detected in visible data.</p>
          ) : null}
        </div>
        <dl className="employee-facts">
          <div>
            <dt>Department</dt>
            <dd>{selected.department || '—'}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{selected.city || '—'}</dd>
          </div>
          <div>
            <dt>Direct reports</dt>
            <dd>
              {reports.length} {reports.length === 1 ? 'person' : 'people'}
            </dd>
          </div>
          <div>
            <dt>Full team</dt>
            <dd>
              {teamSize} {teamSize === 1 ? 'person' : 'people'}
            </dd>
          </div>
        </dl>
        <div className="section-label">REPORTS TO</div>
        {manager ? (
          <button
            type="button"
            className="person-link"
            onClick={() => selectEmployee(manager.id, { reveal: true })}
          >
            <EmployeeMemberAvatar user={manager} sizeClassName="h-9 w-9" />
            <span className="min-w-0 flex-1">
              <strong>{getFullName(manager)}</strong>
              <small>{manager.jobTitle}</small>
            </span>
          </button>
        ) : (
          <p className="empty-copy">{stateLabel || 'Top-level employee · No reporting manager'}</p>
        )}
        <div className="section-label">
          DIRECT REPORTS <span>{String(reports.length).padStart(2, '0')}</span>
        </div>
        {reports.length ? (
          reports.map((r) => (
            <button
              key={r.id}
              type="button"
              className="person-link"
              onClick={() => selectEmployee(r.id, { reveal: true })}
            >
              <EmployeeMemberAvatar user={r} sizeClassName="h-9 w-9" />
              <span className="min-w-0 flex-1">
                <strong>{getFullName(r)}</strong>
                <small>{r.jobTitle}</small>
              </span>
            </button>
          ))
        ) : (
          <p className="empty-copy">No direct reports assigned yet.</p>
        )}
        <div className="section-label">REPORTING PATH</div>
        <div className="reporting-path">
          {chain.map((p, i) => (
            <React.Fragment key={p.id}>
              {i > 0 ? <span className="text-slate-300">›</span> : null}
              <button type="button" onClick={() => selectEmployee(p.id, { reveal: true })}>
                {(p.name || '').split(' ')[0]}
              </button>
            </React.Fragment>
          ))}
        </div>
        <Link to={`/employees/${selected.id}`} className="panel-edit-link">
          View employee record
        </Link>
      </>
    );
  };

  return (
    <div className="org-chart-page min-h-screen bg-[#F5F7FB]">
      <div className="page-shell">
        <div className="page-shell-inner org-page-inner">
          <header className="org-page-header">
            <div className="org-page-title-block">
              <p className="org-page-eyebrow">People &amp; organization</p>
              <div className="org-page-title-row">
                <h1>Organization</h1>
                {!loading && employees.length > 0 ? (
                  <div className="org-meta-inline" aria-label="Organization summary">
                    <span>
                      <strong>{employees.length}</strong> people
                    </span>
                    <span className="org-meta-sep" aria-hidden="true">
                      ·
                    </span>
                    <span>
                      <strong>{departments.length}</strong> depts
                    </span>
                    <span className="org-meta-sep" aria-hidden="true">
                      ·
                    </span>
                    <span>
                      <strong>{POSITION_LEVELS.filter((l) => levelCounts[l] > 0).length}</strong>{' '}
                      levels
                    </span>
                    {meta?.scope ? (
                      <>
                        <span className="org-meta-sep hide-mobile" aria-hidden="true">
                          ·
                        </span>
                        <span className="hide-mobile">
                          Scope: <strong>{meta.scope}</strong>
                        </span>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="org-page-actions">
              <button
                type="button"
                onClick={loadChart}
                className="org-action-btn org-action-icon"
                title="Refresh chart data"
                aria-label="Refresh"
              >
                <FiRefreshCw />
                <span className="hide-mobile">Refresh</span>
              </button>
              <Link
                to="/organization/dashboard"
                className="org-action-btn"
                title="Organization dashboard"
              >
                Dashboard
              </Link>
              {canOpenOrgStructure ? (
                <Link
                  to="/organization/structure"
                  className="org-action-btn"
                  title="Org structure settings"
                >
                  Structure
                </Link>
              ) : null}
            </div>
          </header>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="org-loading">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-transparent border-t-emerald-500 border-r-emerald-500" />
            </div>
          ) : employees.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
              No employees available in your current view. Add employees or adjust permissions to
              see the organization chart.
            </div>
          ) : (
            <>
              <div className="view-tabs">
                <div className="view-tab-list" role="tablist" aria-label="Organization views">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeView === 'chart'}
                    className={`view-tab${activeView === 'chart' ? ' active' : ''}`}
                    onClick={() => setActiveView('chart')}
                  >
                    <FiUsers aria-hidden="true" />
                    Chart
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeView === 'records'}
                    className={`view-tab${activeView === 'records' ? ' active' : ''}`}
                    onClick={() => setActiveView('records')}
                  >
                    <FiList aria-hidden="true" />
                    Records
                    <span className="view-tab-count">{employees.length}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeView === 'levels'}
                    className={`view-tab${activeView === 'levels' ? ' active' : ''}`}
                    onClick={() => setActiveView('levels')}
                  >
                    <FiLayers aria-hidden="true" />
                    Levels
                  </button>
                </div>
              </div>

              {activeView === 'records' ? (
                <OrgChartRecordsView employees={employees} onViewInChart={handleViewInChart} />
              ) : null}

              {activeView === 'levels' ? (
                <OrgChartLevelsView
                  employees={employees}
                  positionLevelsFromApi={positionLevels}
                />
              ) : null}

              {activeView === 'chart' ? (
              <div className="chart-workspace">
              <div className="chart-controls">
                <div className="mobile-filter-card show-mobile-only">
                  <label className="dept-select-wrap">
                    <span className="sr-only">Filter by department</span>
                    <select
                      className="dept-select"
                      value={departmentFilter}
                      aria-label="Filter by department"
                      onChange={(e) => {
                        setDepartmentFilter(e.target.value);
                        fitPendingRef.current = true;
                      }}
                    >
                      <option value="all">All departments ({employees.length})</option>
                      {departmentList.map((d) => {
                        const key = String(d.id || d.name);
                        return (
                          <option key={key} value={key}>
                            {d.name} ({d.employeeCount})
                          </option>
                        );
                      })}
                    </select>
                  </label>

                  <div className="search-wrap mobile-search-wrap">
                    <FiSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      placeholder="Search people…"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSearchOpen(Boolean(e.target.value.trim()));
                      }}
                      onFocus={() => searchQuery.trim() && setSearchOpen(true)}
                      aria-expanded={searchOpen}
                      aria-controls="org-chart-search-results"
                    />
                    {searchOpen && searchQuery.trim() ? (
                      <div id="org-chart-search-results" className="search-results">
                        {searchResults.length ? (
                          searchResults.map((e) => (
                            <button
                              key={e.id}
                              type="button"
                              className="search-result"
                              onClick={() => {
                                selectEmployee(e.id, { reveal: true });
                                setSearchQuery('');
                                setSearchOpen(false);
                              }}
                            >
                              <EmployeeMemberAvatar user={e} sizeClassName="h-9 w-9" />
                              <span className="min-w-0 flex-1">
                                <strong className="block truncate text-sm text-slate-900">
                                  {getFullName(e)}
                                </strong>
                                <small className="block truncate text-xs text-slate-500">
                                  {e.jobTitle} · {e.employeeId}
                                </small>
                              </span>
                              <span className="level-pill">{e.position}</span>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-4 text-sm text-slate-500">
                            No employees found. Try a name, role or employee ID.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div
                  className="dept-chips hide-mobile"
                  role="group"
                  aria-label="Filter by department"
                >
                  <button
                    type="button"
                    className={`dept-chip${departmentFilter === 'all' ? ' active' : ''}`}
                    onClick={() => {
                      setDepartmentFilter('all');
                      fitPendingRef.current = true;
                    }}
                  >
                    All
                    <span className="dept-chip-count">{employees.length}</span>
                  </button>
                  {departmentList.map((d) => {
                    const key = String(d.id || d.name);
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`dept-chip${departmentFilter === key ? ' active' : ''}`}
                        title={`${d.name} (${d.employeeCount})`}
                        onClick={() => {
                          setDepartmentFilter(key);
                          fitPendingRef.current = true;
                        }}
                      >
                        {d.name}
                        <span className="dept-chip-count">{d.employeeCount}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="chart-toolbar hide-mobile">
                  <div className="search-wrap">
                    <FiSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      placeholder="Search people…"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSearchOpen(Boolean(e.target.value.trim()));
                      }}
                      onFocus={() => searchQuery.trim() && setSearchOpen(true)}
                      aria-expanded={searchOpen}
                      aria-controls="org-chart-search-results-desktop"
                    />
                    {searchOpen && searchQuery.trim() ? (
                      <div id="org-chart-search-results-desktop" className="search-results">
                        {searchResults.length ? (
                          searchResults.map((e) => (
                            <button
                              key={e.id}
                              type="button"
                              className="search-result"
                              onClick={() => {
                                selectEmployee(e.id, { reveal: true });
                                setSearchQuery('');
                                setSearchOpen(false);
                              }}
                            >
                              <EmployeeMemberAvatar user={e} sizeClassName="h-9 w-9" />
                              <span className="min-w-0 flex-1">
                                <strong className="block truncate text-sm text-slate-900">
                                  {getFullName(e)}
                                </strong>
                                <small className="block truncate text-xs text-slate-500">
                                  {e.jobTitle} · {e.employeeId}
                                </small>
                              </span>
                              <span className="level-pill">{e.position}</span>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-4 text-sm text-slate-500">
                            No employees found. Try a name, role or employee ID.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <div className="chart-toolbar-actions desktop-chart-tools">
                    <button
                      type="button"
                      className="org-tool-btn org-tool-btn-primary"
                      onClick={() => {
                        setExpanded(new Set(employees.map((e) => String(e.id))));
                        fitPendingRef.current = true;
                      }}
                      title="Expand all branches"
                    >
                      <FiChevronDown />
                      <span>Expand</span>
                    </button>
                    <button
                      type="button"
                      className="org-tool-btn"
                      onClick={fitChart}
                      title="Reset pan and zoom to fit the chart"
                    >
                      <FiMaximize2 />
                      <span>Fit</span>
                    </button>
                    {selectedId ? (
                      <button
                        type="button"
                        className="org-tool-btn"
                        onClick={() => centerOn(selectedId)}
                        title="Center on selected"
                      >
                        Center
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="org-tool-btn"
                      disabled={exporting || !positions.size}
                      onClick={() => exportChart('png')}
                      title="Export PNG"
                    >
                      <FiDownload />
                      <span>{exporting ? '…' : 'PNG'}</span>
                    </button>
                    <button
                      type="button"
                      className="org-tool-btn"
                      disabled={exporting || !positions.size}
                      onClick={() => exportChart('pdf')}
                      title="Export PDF"
                    >
                      <FiDownload />
                      <span>{exporting ? '…' : 'PDF'}</span>
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Collapse all branches"
                      title="Collapse all"
                      onClick={() => {
                        setExpanded(new Set());
                        fitPendingRef.current = true;
                      }}
                    >
                      <FiChevronUp />
                    </button>
                  </div>
                </div>
              </div>

              <div className="chart-layout">
                <div className="canvas-column">
                  <div className="canvas-breadcrumb">
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <span className="truncate">
                      {departmentFilter === 'all'
                        ? 'All departments'
                        : activeDeptName || 'Department'}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="shrink-0">
                      {visibleCount}/{allowedIds.size} in view
                    </span>
                    {departmentFilter !== 'all' ? (
                      <>
                        <span className="text-slate-300 hide-sm">·</span>
                        <span className="hide-sm truncate">
                          Root + reporting chain ({executiveCount} leadership)
                        </span>
                      </>
                    ) : null}
                  </div>
                  <div
                    ref={canvasRef}
                    className="chart-canvas"
                    role="region"
                    aria-label="Interactive reporting chart. Drag to pan; use zoom controls or scroll."
                    tabIndex={0}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endPointer}
                    onPointerCancel={endPointer}
                    onDoubleClick={fitChart}
                    onWheel={(e) => {
                      e.preventDefault();
                      const rect = canvasRef.current.getBoundingClientRect();
                      if (e.ctrlKey || e.metaKey) {
                        changeZoom(-e.deltaY * 0.006, {
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top,
                        });
                      } else {
                        applyPan({ x: pan.x - e.deltaX, y: pan.y - e.deltaY });
                      }
                    }}
                  >
                    <div
                      id="org-chart-world"
                      className="chart-world"
                      style={{
                        width: dimensions.width || undefined,
                        height: dimensions.height || undefined,
                      }}
                    >
                      <OrgChartConnectors
                        positions={positions}
                        employees={employees}
                        pathIds={pathIds}
                        width={dimensions.width}
                        height={dimensions.height}
                      />
                      <div id="org-chart-nodes">
                        {[...positions.entries()].map(([id, p]) => {
                          const e = getById(employees, id);
                          if (!e) return null;
                          const childCount = getChildren(employees, e.id).length;
                          const isOpen = expanded.has(String(e.id));
                          const flagged =
                            e.managerState !== 'linked' && e.managerState !== 'top_level';
                          return (
                            <article
                              key={id}
                              className={`employee-node${selectedId === id || String(selectedId) === String(id) ? ' selected' : ''}${flagged ? ' flagged' : ''}`}
                              style={{ left: p.x, top: p.y }}
                            >
                              <button
                                type="button"
                                className="node-main"
                                onClick={() => selectEmployee(e.id)}
                                aria-pressed={selectedId === id || String(selectedId) === String(id)}
                              >
                                <span className="node-person">
                                  <EmployeeMemberAvatar user={e} sizeClassName="h-10 w-10" />
                                  <span className="min-w-0">
                                    <span className="node-name">{getFullName(e)}</span>
                                    <span className="node-role">{e.jobTitle}</span>
                                  </span>
                                </span>
                                <span className="node-tags">
                                  <span className="level-pill">{e.position}</span>
                                  <span className="department-label">{e.department}</span>
                                </span>
                              </button>
                              {childCount > 0 ? (
                                <button
                                  type="button"
                                  className="node-footer"
                                  aria-expanded={isOpen}
                                  onClick={() => {
                                    setExpanded((prev) => {
                                      const next = new Set([...prev].map(String));
                                      const key = String(e.id);
                                      if (next.has(key)) next.delete(key);
                                      else next.add(key);
                                      return next;
                                    });
                                    fitPendingRef.current = true;
                                  }}
                                >
                                  <span className="inline-flex items-center gap-1">
                                    <FiUsers className="h-3.5 w-3.5" />
                                    {childCount} direct {childCount === 1 ? 'report' : 'reports'}
                                  </span>
                                  {isOpen ? <FiChevronUp /> : <FiChevronDown />}
                                </button>
                              ) : (
                                <div className="node-footer leaf-footer">
                                  <span>No direct reports</span>
                                  <span className="text-xs text-slate-400">{e.employeeId}</span>
                                </div>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="canvas-bottom">
                    <span className="canvas-bottom-hint hide-mobile">
                      Reports to · Selected path highlighted
                    </span>

                    <div className="canvas-bottom-bar" role="toolbar" aria-label="Chart tools">
                      <div className="mobile-more-wrap show-mobile-only">
                        <button
                          type="button"
                          className={`canvas-pill-btn${mobileMoreOpen ? ' active' : ''}`}
                          aria-label="More chart actions"
                          aria-expanded={mobileMoreOpen}
                          aria-haspopup="menu"
                          onClick={() => setMobileMoreOpen((open) => !open)}
                        >
                          <FiMoreHorizontal />
                          <span>More</span>
                        </button>
                        {mobileMoreOpen ? (
                          <>
                            <button
                              type="button"
                              className="mobile-more-backdrop"
                              aria-label="Close menu"
                              onClick={() => setMobileMoreOpen(false)}
                            />
                            <div className="mobile-more-menu" role="menu">
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setExpanded(new Set(employees.map((e) => String(e.id))));
                                  fitPendingRef.current = true;
                                  setMobileMoreOpen(false);
                                }}
                              >
                                <FiChevronDown /> Expand all
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setExpanded(new Set());
                                  fitPendingRef.current = true;
                                  setMobileMoreOpen(false);
                                }}
                              >
                                <FiChevronUp /> Collapse all
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                disabled={exporting || !positions.size}
                                onClick={() => {
                                  setMobileMoreOpen(false);
                                  exportChart('png');
                                }}
                              >
                                <FiDownload /> Export PNG
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                disabled={exporting || !positions.size}
                                onClick={() => {
                                  setMobileMoreOpen(false);
                                  exportChart('pdf');
                                }}
                              >
                                <FiDownload /> Export PDF
                              </button>
                              {selectedId ? (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setMobileMoreOpen(false);
                                    setMobilePanelOpen(true);
                                  }}
                                >
                                  <FiUsers /> Employee details
                                </button>
                              ) : null}
                            </div>
                          </>
                        ) : null}
                      </div>

                      <div className="zoom-cluster" aria-label="Zoom controls">
                        <button
                          type="button"
                          className="zoom-cluster-btn"
                          aria-label="Zoom out"
                          disabled={zoom <= 0.2}
                          onClick={() => changeZoom(-0.1)}
                        >
                          <FiMinus />
                        </button>
                        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
                        <button
                          type="button"
                          className="zoom-cluster-btn"
                          aria-label="Zoom in"
                          disabled={zoom >= 1.7}
                          onClick={() => changeZoom(0.1)}
                        >
                          <FiPlus />
                        </button>
                        <button
                          type="button"
                          className="zoom-cluster-btn zoom-fit-btn"
                          aria-label="Fit chart to screen"
                          title="Fit to screen"
                          onClick={fitChart}
                        >
                          <FiMaximize2 />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                {selected ? (
                  <aside
                    className={`employee-panel${mobilePanelOpen ? ' mobile-open' : ''} panel-visible`}
                    aria-label="Employee details"
                  >
                    {renderPanel()}
                  </aside>
                ) : null}
              </div>
              </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default OrganizationChartPage;
