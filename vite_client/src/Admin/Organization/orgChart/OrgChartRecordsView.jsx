import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiChevronLeft, FiChevronRight, FiEdit2, FiSearch } from 'react-icons/fi';
import EmployeeMemberAvatar from '../../Employee/EmployeeMemberAvatar';
import { getById, getFullName, managerStateLabel } from './chartUtils';

const PAGE_SIZE = 10;

function getManagerLabel(employees, e) {
  const manager = e.reportsTo ? getById(employees, e.reportsTo) : null;
  if (manager) return getFullName(manager);
  if (e.managerState === 'top_level' || !e.reportsTo) return 'Admin root';
  return managerStateLabel(e.managerState) || 'Admin root';
}

export default function OrgChartRecordsView({ employees, onViewInChart }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => {
      const manager = e.reportsTo ? getById(employees, e.reportsTo) : null;
      const managerName = manager ? getFullName(manager) : e.managerName || '';
      return [getFullName(e), e.jobTitle, e.employeeId, e.department, e.position, managerName].some(
        (x) =>
          String(x || '')
            .toLowerCase()
            .includes(q)
      );
    });
  }, [employees, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [query, employees]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const rangeStart = filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(page * PAGE_SIZE, filtered.length);

  return (
    <div className="records-view">
      <div className="records-header">
        <div className="records-header-text">
          <h2>Employee records</h2>
          <p>Manager links shape the chart · edit in the employee profile</p>
        </div>
        <label className="records-search">
          <FiSearch aria-hidden="true" />
          <input
            type="search"
            placeholder="Search records…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search employee records"
          />
        </label>
      </div>

      {/* Mobile cards */}
      <div className="records-cards">
        {pageItems.length ? (
          pageItems.map((e) => {
            const managerLabel = getManagerLabel(employees, e);
            return (
              <article key={e.id} className="records-card">
                <div className="records-card-top">
                  <EmployeeMemberAvatar user={e} sizeClassName="h-10 w-10" />
                  <div className="records-card-identity">
                    <strong>{getFullName(e)}</strong>
                    <span>{e.jobTitle || '—'}</span>
                    <small>{e.employeeId || '—'}</small>
                  </div>
                </div>
                <dl className="records-card-meta">
                  <div>
                    <dt>Level</dt>
                    <dd>
                      <span className="level-pill">{e.position || '—'}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Department</dt>
                    <dd>{e.department || '—'}</dd>
                  </div>
                  <div>
                    <dt>Reports to</dt>
                    <dd>{managerLabel}</dd>
                  </div>
                </dl>
                <div className="records-card-actions">
                  <button type="button" onClick={() => onViewInChart(e.id)}>
                    View in chart
                  </button>
                  <Link to={`/employees/${e.id}`} aria-label={`Edit ${getFullName(e)}`}>
                    <FiEdit2 />
                    Edit
                  </Link>
                </div>
              </article>
            );
          })
        ) : (
          <div className="records-empty">
            No matching employees. Try a different name, level or department.
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="records-table-wrap">
        <table className="records-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Position level</th>
              <th>Department</th>
              <th>Reports to</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length ? (
              pageItems.map((e) => {
                const managerLabel = getManagerLabel(employees, e);
                return (
                  <tr key={e.id}>
                    <td>
                      <div className="records-table-person">
                        <EmployeeMemberAvatar user={e} sizeClassName="h-10 w-10" />
                        <span>
                          <strong>{getFullName(e)}</strong>
                          <small>
                            {e.jobTitle} · {e.employeeId}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="level-pill">{e.position || '—'}</span>
                    </td>
                    <td>{e.department || '—'}</td>
                    <td>{managerLabel}</td>
                    <td>
                      <div className="records-table-actions">
                        <button type="button" onClick={() => onViewInChart(e.id)}>
                          View in chart
                        </button>
                        <Link
                          to={`/employees/${e.id}`}
                          aria-label={`Edit ${getFullName(e)}`}
                          title="Edit employee"
                        >
                          <FiEdit2 />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="records-empty">
                  No matching employees. Try a different name, level or department.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="records-pagination">
        <span className="records-pagination-meta">
          {filtered.length
            ? `Showing ${rangeStart}–${rangeEnd} of ${filtered.length}`
            : 'No records'}
        </span>
        <div className="records-pagination-controls">
          <button
            type="button"
            className="records-page-btn"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <FiChevronLeft />
            <span>Prev</span>
          </button>
          <span className="records-page-indicator">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className="records-page-btn"
            aria-label="Next page"
            disabled={page >= totalPages || filtered.length === 0}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <span>Next</span>
            <FiChevronRight />
          </button>
        </div>
      </div>

      <div className="records-footer">
        Live employee records · Edit reporting manager from each employee&apos;s job details
      </div>
    </div>
  );
}
