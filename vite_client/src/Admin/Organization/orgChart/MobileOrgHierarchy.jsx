import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { FiChevronRight, FiMaximize2, FiMinus, FiPlus, FiUsers } from 'react-icons/fi';
import EmployeeMemberAvatar from '../../Employee/EmployeeMemberAvatar';
import { getFullName } from './chartUtils';
import { hiddenDescendantCounts } from './desktopChartUtils';
import { flattenMobileHierarchy } from './mobileHierarchyUtils';

const ROW_HEIGHT = 126;
const OVERSCAN = 5;

function MobileOrgHierarchy({
  index,
  expanded,
  limits,
  revealed,
  selectedId,
  pathEmployees = [],
  departments,
  departmentFilter,
  onDepartment,
  onSelect,
  onToggle,
  onMore,
  onExpandAll,
  onCollapseAll,
  onExport,
  exporting,
  total,
  onFullscreen,
  fullscreen,
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(500);
  const [showDepartments, setShowDepartments] = useState(false);
  const scrollRef = useRef(null);
  const previousDepartment = useRef(departmentFilter);
  const rows = useMemo(() => flattenMobileHierarchy(index, expanded, limits, revealed), [index, expanded, limits, revealed]);
  const visibleIds = useMemo(() => new Set(rows.filter(row => !row.more).map(row => row.id)), [rows]);
  const hiddenCounts = useMemo(() => hiddenDescendantCounts(index, visibleIds), [index, visibleIds]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(() => setHeight(element.clientHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, [showDepartments]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const row = rows.findIndex(item => item.id === String(selectedId));
    const changedDepartment = previousDepartment.current !== departmentFilter;
    previousDepartment.current = departmentFilter;
    const top = row >= 0 ? Math.max(0, row * ROW_HEIGHT - element.clientHeight / 3) : changedDepartment ? 0 : element.scrollTop;
    element.scrollTop = top;
    setScrollTop(element.scrollTop);
  }, [rows, selectedId, departmentFilter, showDepartments]);

  useEffect(() => { if (selectedId != null) setShowDepartments(false); }, [selectedId]);

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(rows.length, Math.ceil((scrollTop + height) / ROW_HEIGHT) + OVERSCAN);
  const pathTrail = pathEmployees.length > 1 ? pathEmployees : [];

  return (
    <section className="mobile-org-hierarchy" aria-label="Mobile reporting hierarchy">
      <div className="mobile-org-departments" aria-label="Departments">
        <button type="button" className={departmentFilter === 'all' ? 'active' : ''} onClick={() => onDepartment('all')}>
          All <span>{total}</span>
        </button>
        {departments.map(department => (
          <button
            type="button"
            key={department.id || department.name}
            className={departmentFilter === String(department.id || department.name) ? 'active' : ''}
            onClick={() => onDepartment(String(department.id || department.name))}
          >
            {department.name} <span>{department.employeeCount}</span>
          </button>
        ))}
      </div>

      {pathTrail.length ? (
        <nav className="mobile-org-path" aria-label="Reporting path">
          {pathTrail.map((employee, index) => {
            const id = String(employee.id);
            const last = index === pathTrail.length - 1;
            return (
              <React.Fragment key={id}>
                {index > 0 ? <span className="mobile-org-path-sep" aria-hidden="true">›</span> : null}
                <button
                  type="button"
                  className={`mobile-org-path-item${last ? ' is-current' : ''}`}
                  onClick={() => onSelect(id)}
                  aria-current={last ? 'location' : undefined}
                >
                  {getFullName(employee)}
                </button>
              </React.Fragment>
            );
          })}
        </nav>
      ) : total > 100 ? (
        <p className="mobile-org-hint">Large org — search or filter a department, then expand branches.</p>
      ) : null}

      <div className="mobile-org-actions">
        <button type="button" onClick={onExpandAll}>Expand All</button>
        <button type="button" onClick={onCollapseAll}>Collapse All</button>
        <button type="button" onClick={() => setShowDepartments(value => !value)} aria-expanded={showDepartments}>
          {showDepartments ? 'Hierarchy' : 'Departments'}
        </button>
      </div>

      {showDepartments ? (
        <div className="mobile-org-department-list">
          {departments.map(department => (
            <button
              type="button"
              key={department.id || department.name}
              onClick={() => {
                onDepartment(String(department.id || department.name));
                setShowDepartments(false);
              }}
            >
              <FiUsers />
              <span>
                <strong>{department.name}</strong>
                <small>{department.employeeCount} employees</small>
              </span>
              <FiChevronRight />
            </button>
          ))}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="mobile-org-scroll"
          style={{ maxHeight: rows.length * ROW_HEIGHT }}
          onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
          role="region"
          aria-label="Scrollable employee hierarchy"
          tabIndex={0}
        >
          <div className="mobile-org-rows" style={{ height: rows.length * ROW_HEIGHT }}>
            {rows.slice(start, end).map((row, offset) => {
              const indent = Math.min(row.depth, 4) * 14;
              if (row.more) {
                return (
                  <div key={row.key} className="mobile-org-row" style={{ top: (start + offset) * ROW_HEIGHT, paddingLeft: indent }}>
                    <button type="button" className="mobile-org-more" onClick={() => onMore(row.parentId)}>
                      Show more direct reports <FiPlus />
                    </button>
                  </div>
                );
              }
              const children = index.children.get(row.id) || [];
              const open = expanded.has(row.id);
              const flagged = row.employee.managerState && !['linked', 'top_level'].includes(row.employee.managerState);
              return (
                <div
                  key={row.key}
                  className={`mobile-org-row${row.parentId ? ' has-parent' : ''}${row.depth === 0 ? ' is-root' : ''}`}
                  style={{ top: (start + offset) * ROW_HEIGHT, paddingLeft: indent, '--mobile-indent': `${indent}px` }}
                  data-employee-id={row.id}
                  data-parent-id={row.parentId || ''}
                >
                  <article
                    aria-label={`${getFullName(row.employee)}${row.parentId ? `, reports to ${getFullName(index.byId.get(row.parentId))}` : ', top-level employee'}`}
                    className={`mobile-org-card${String(selectedId) === row.id ? ' selected' : ''}${flagged ? ' flagged' : ''}`}
                  >
                    <button type="button" className="mobile-org-person" onClick={() => onSelect(row.id)} aria-pressed={String(selectedId) === row.id}>
                      <EmployeeMemberAvatar user={row.employee} sizeClassName="h-10 w-10 mobile-org-avatar" />
                      <span className="mobile-org-identity">
                        <strong title={getFullName(row.employee)}>{getFullName(row.employee)}</strong>
                        <small title={row.employee.jobTitle}>{row.employee.jobTitle || '—'}</small>
                        <small title={row.employee.department}>
                          {row.employee.department || row.employee.position || '—'} · {row.employee.employeeId || '—'}
                        </small>
                      </span>
                      {row.employee.position ? <span className="mobile-org-level">{row.employee.position}</span> : <FiChevronRight />}
                    </button>
                    <div className="mobile-org-card-footer">
                      {children.length ? (
                        <button
                          type="button"
                          onClick={() => onToggle(row.id)}
                          aria-expanded={open}
                          aria-label={`${open ? 'Collapse' : 'Expand'} reports of ${getFullName(row.employee)}`}
                        >
                          {open ? <FiMinus /> : <FiPlus />} {children.length} direct reports
                          {hiddenCounts.get(row.id) ? ` · ${hiddenCounts.get(row.id)} hidden` : ''}
                        </button>
                      ) : (
                        <span>No direct reports</span>
                      )}
                      {row.depth > 0 ? (
                        <span className="mobile-org-depth" title={getFullName(index.byId.get(row.parentId))}>
                          L{row.depth + 1}
                        </span>
                      ) : null}
                    </div>
                  </article>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mobile-org-export">
        <span>{visibleIds.size}/{index.byId.size} in hierarchy</span>
        <button type="button" disabled={exporting} onClick={() => onExport('png')}>PNG</button>
        <button type="button" disabled={exporting} onClick={() => onExport('pdf')}>PDF</button>
        <button type="button" onClick={onFullscreen} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
          <FiMaximize2 />
        </button>
      </div>
    </section>
  );
}

export default memo(MobileOrgHierarchy);
