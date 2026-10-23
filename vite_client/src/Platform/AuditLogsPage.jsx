import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { FiChevronDown, FiDownload, FiRefreshCw, FiSearch } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { fetchPlatformAuditLogs } from '../context/platformSlice';
import '../styles/platformAuditLogs.css';

const FIELD_LABELS = {
  trialEndDate: 'Trial end date',
  subscriptionStatus: 'Subscription status',
  isTrialActive: 'Trial active',
  planId: 'Plan',
  maxEmployees: 'Seat limit',
  organizationName: 'Organization',
  name: 'Name',
  email: 'Email',
  isActive: 'Status',
  roles: 'Roles',
  status: 'Status',
  features: 'Features',
  moduleFeatures: 'Modules',
  domain: 'Domain',
  paymentMethod: 'Payment method',
  billingCycle: 'Billing cycle',
  createdAt: 'Created',
};

/** Internal / noisy keys — never show in the human summary. */
const HIDDEN_KEYS = new Set([
  'id',
  '_id',
  '__v',
  'password',
  'deletedAt',
  'updatedAt',
  'organizationId',
  'operatorId',
  'entityId',
  'createdBy',
  'updatedBy',
]);

const PREFERRED_ORDER = [
  'name',
  'domain',
  'email',
  'isActive',
  'status',
  'subscriptionStatus',
  'isTrialActive',
  'trialEndDate',
  'planId',
  'maxEmployees',
  'paymentMethod',
  'billingCycle',
  'roles',
  'features',
  'moduleFeatures',
  'createdAt',
];

const hasState = (value) => value !== null && value !== undefined;

const isEmptyValue = (value) => {
  if (value === null || value === undefined) return true;
  if (value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
};

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);

const labelForKey = (key) => {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return String(key)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatDisplayValue = (key, value) => {
  if (value === null || value === undefined) return '—';
  if (key === 'isActive') return value ? 'Active' : 'Inactive';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    if (!value.length) return 'None';
    if (value.every((v) => typeof v === 'string' || typeof v === 'number')) {
      return value.join(', ');
    }
    return `${value.length} items`;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    return keys.length ? `${keys.length} settings` : 'None';
  }
  if (typeof value === 'string') {
    const asDate = Date.parse(value);
    if (value.length >= 10 && !Number.isNaN(asDate) && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return value || '—';
  }
  return String(value);
};

const valuesEqual = (a, b) => {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return a === b;
  }
};

const sortKeys = (keys) =>
  [...keys].sort((a, b) => {
    const ia = PREFERRED_ORDER.indexOf(a);
    const ib = PREFERRED_ORDER.indexOf(b);
    if (ia !== -1 || ib !== -1) {
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    }
    return labelForKey(a).localeCompare(labelForKey(b));
  });

/**
 * Build a compact human summary of before/after.
 * Creates (no before) → simple "set" rows; updates → only changed fields.
 */
const buildChangeSummary = (before, after) => {
  const beforeObj = isPlainObject(before) ? before : null;
  const afterObj = isPlainObject(after) ? after : null;
  const isCreate = !beforeObj && !!afterObj;

  if (!beforeObj && !afterObj) {
    if (!hasState(before) && !hasState(after)) {
      return { mode: 'empty', rows: [] };
    }
    if (!valuesEqual(before, after)) {
      return {
        mode: 'update',
        rows: [
          {
            key: '_value',
            label: 'Value',
            beforeText: formatDisplayValue('_value', before),
            afterText: formatDisplayValue('_value', after),
          },
        ],
      };
    }
    return { mode: 'empty', rows: [] };
  }

  const keys = sortKeys(
    [
      ...new Set([
        ...Object.keys(beforeObj || {}),
        ...Object.keys(afterObj || {}),
      ]),
    ].filter((key) => !HIDDEN_KEYS.has(key))
  );

  if (isCreate) {
    const rows = keys
      .map((key) => {
        const a = afterObj[key];
        if (isEmptyValue(a)) return null;
        return {
          key,
          label: labelForKey(key),
          afterText: formatDisplayValue(key, a),
        };
      })
      .filter(Boolean);
    return { mode: 'create', rows };
  }

  const rows = keys
    .map((key) => {
      const b = beforeObj ? beforeObj[key] : undefined;
      const a = afterObj ? afterObj[key] : undefined;
      if (valuesEqual(b, a)) return null;
      if (isEmptyValue(b) && isEmptyValue(a)) return null;
      return {
        key,
        label: labelForKey(key),
        beforeText: formatDisplayValue(key, hasState(b) ? b : null),
        afterText: formatDisplayValue(key, hasState(a) ? a : null),
      };
    })
    .filter(Boolean);

  return { mode: 'update', rows };
};

const formatWhen = (iso) => {
  if (!iso) return { date: '—', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '—', time: '' };
  return {
    date: d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    time: d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  };
};

const formatWhenFull = (iso) => {
  const { date, time } = formatWhen(iso);
  return time ? `${date} ${time}` : date;
};

const changesToText = (log) => {
  const summary = buildChangeSummary(log.before, log.after);
  if (!summary.rows.length) return '';
  if (summary.mode === 'create') {
    return summary.rows.map((r) => `${r.label}: ${r.afterText}`).join('; ');
  }
  return summary.rows
    .map((r) => `${r.label}: ${r.beforeText} → ${r.afterText}`)
    .join('; ');
};

const buildExportRows = (logs) =>
  logs.map((log) => ({
    When: formatWhenFull(log.createdAt),
    Summary: log.summary || log.action || '',
    Action: log.action || '',
    Operator: log.operatorEmail || '',
    Organization: log.organizationId ? String(log.organizationId) : '',
    Type: log.entityType || '',
    Changes: changesToText(log),
  }));

const AuditLogsPage = () => {
  const dispatch = useDispatch();
  const { globalAuditLogs, globalAuditPagination } = useSelector((state) => state.platform);
  const [organizationId, setOrganizationId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef(null);

  const load = (nextPage = page) => {
    const params = { page: nextPage, limit: 50 };
    if (organizationId.trim()) params.organizationId = organizationId.trim();
    setLoading(true);
    return dispatch(fetchPlatformAuditLogs(params))
      .unwrap()
      .catch((err) => {
        const message = typeof err === 'string' ? err : 'Failed to load audit logs';
        if (!/session expired|log in again/i.test(message)) toast.error(message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!exportOpen) return undefined;
    const onDocClick = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setExportOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [exportOpen]);

  const logs = globalAuditLogs || [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log) => {
      const hay = [
        log.action,
        log.summary,
        log.entityType,
        log.operatorEmail,
        log.organizationId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [logs, search]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev && filtered.some((l) => l.id === prev)) return prev;
      return filtered[0].id;
    });
  }, [filtered]);

  const selected = filtered.find((l) => l.id === selectedId) || null;

  const changeSummary = useMemo(
    () => (selected ? buildChangeSummary(selected.before, selected.after) : { mode: 'empty', rows: [] }),
    [selected]
  );

  const hasAnyState = selected && (hasState(selected.before) || hasState(selected.after));

  const kpi = useMemo(() => {
    const withDiff = logs.filter((l) => hasState(l.before) || hasState(l.after)).length;
    const uniqueOps = new Set(
      logs.map((l) => l.operatorEmail).filter(Boolean).map((e) => String(e).toLowerCase())
    ).size;
    return {
      loaded: logs.length,
      withDiff,
      uniqueOps,
      total: globalAuditPagination?.total ?? logs.length,
    };
  }, [logs, globalAuditPagination]);

  const exportExcel = () => {
    try {
      const rows = buildExportRows(filtered);
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 22 },
        { wch: 40 },
        { wch: 22 },
        { wch: 28 },
        { wch: 28 },
        { wch: 16 },
        { wch: 55 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Audit Logs');
      XLSX.writeFile(wb, `platform-audit-logs-page-${page}.xlsx`);
      setExportOpen(false);
      toast.success('Excel downloaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export Excel');
    }
  };

  const exportPdf = () => {
    try {
      const rows = buildExportRows(filtered);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const margin = 36;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const usableWidth = pageWidth - margin * 2;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Platform Audit Logs', margin, margin);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(90);
      doc.text(
        `Exported ${new Date().toLocaleString()} · ${rows.length} event${rows.length === 1 ? '' : 's'} (page ${page})`,
        margin,
        margin + 16
      );
      doc.setTextColor(20);

      const colGap = 10;
      const cols = [
        { key: 'When', width: 95 },
        { key: 'Summary', width: 170 },
        { key: 'Operator', width: 130 },
        { key: 'Changes', width: usableWidth - 95 - 170 - 130 - colGap * 3 },
      ];

      let y = margin + 36;
      const lineH = 12;
      const drawHeader = () => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        let x = margin;
        cols.forEach((col) => {
          doc.text(col.key, x, y);
          x += col.width + colGap;
        });
        y += 8;
        doc.setDrawColor(200);
        doc.line(margin, y, pageWidth - margin, y);
        y += 14;
        doc.setFont('helvetica', 'normal');
      };

      drawHeader();

      rows.forEach((row) => {
        const cellLines = cols.map((col) =>
          doc.splitTextToSize(String(row[col.key] || '—'), col.width)
        );
        const rowHeight = Math.max(...cellLines.map((lines) => lines.length), 1) * lineH + 6;
        if (y + rowHeight > pageHeight - margin) {
          doc.addPage();
          y = margin;
          drawHeader();
        }
        let x = margin;
        cellLines.forEach((lines, idx) => {
          doc.text(lines, x, y);
          x += cols[idx].width + colGap;
        });
        y += rowHeight;
      });

      doc.save(`platform-audit-logs-page-${page}.pdf`);
      setExportOpen(false);
      toast.success('PDF downloaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export PDF');
    }
  };

  const applyOrgFilter = (e) => {
    e.preventDefault();
    setPage(1);
    load(1);
  };

  return (
    <div className="platform-audit">
      <header className="al-header">
        <div>
          <h1 className="al-title">Audit Logs</h1>
          <p className="al-sub">
            Platform operator actions across organizations — open an entry to see what changed.
          </p>
        </div>
        <div className="al-header-actions">
          <button type="button" className="al-btn al-btn-secondary" onClick={() => load(page)}>
            <FiRefreshCw className="h-4 w-4" aria-hidden />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <div className="al-export" ref={exportMenuRef}>
            <button
              type="button"
              className="al-btn al-btn-primary"
              onClick={() => setExportOpen((v) => !v)}
              disabled={!filtered.length}
              aria-expanded={exportOpen}
              aria-haspopup="menu"
            >
              <FiDownload className="h-4 w-4" aria-hidden />
              Export
              <FiChevronDown className="h-4 w-4" aria-hidden />
            </button>
            {exportOpen && (
              <div className="al-export-menu" role="menu">
                <button type="button" role="menuitem" onClick={exportExcel}>
                  Excel (.xlsx)
                </button>
                <button type="button" role="menuitem" onClick={exportPdf}>
                  PDF (.pdf)
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="al-kpi-row">
        <div className="al-kpi">
          <div className="al-kpi-label">Total events</div>
          <div className="al-kpi-value">{kpi.total}</div>
        </div>
        <div className="al-kpi">
          <div className="al-kpi-label">Loaded page</div>
          <div className="al-kpi-value">{kpi.loaded}</div>
        </div>
        <div className="al-kpi">
          <div className="al-kpi-label">With details</div>
          <div className="al-kpi-value">{kpi.withDiff}</div>
        </div>
        <div className="al-kpi">
          <div className="al-kpi-label">Operators (page)</div>
          <div className="al-kpi-value">{kpi.uniqueOps}</div>
        </div>
      </div>

      <form className="al-filters" onSubmit={applyOrgFilter}>
        <div className="al-search-wrap">
          <FiSearch className="al-search-icon h-4 w-4" aria-hidden />
          <input
            type="search"
            className="al-input al-search"
            placeholder="Search action, summary, operator…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search audit logs"
          />
        </div>
        <input
          className="al-input al-org-input"
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
          placeholder="Filter by organization ID"
          aria-label="Organization ID filter"
        />
        <button type="submit" className="al-btn al-btn-primary">
          Apply org filter
        </button>
      </form>

      <section className="al-panel">
        <div className="al-panel-head">
          <h2 className="al-panel-title">
            Activity
            <span className="al-badge">
              {filtered.length}
              {search.trim() ? ' matching' : ' on page'}
            </span>
          </h2>
          <div className="al-panel-meta">
            Page {globalAuditPagination?.page || page} of{' '}
            {globalAuditPagination?.totalPages || 1}
          </div>
        </div>

        <div className="al-list">
          {filtered.map((log) => {
            const when = formatWhen(log.createdAt);
            const selectedRow = selectedId === log.id;
            return (
              <button
                key={log.id}
                type="button"
                className={`al-row${selectedRow ? ' is-selected' : ''}`}
                onClick={() => setSelectedId(log.id)}
                aria-pressed={selectedRow}
              >
                <div className="al-row-grid">
                  <div className="al-when">
                    <span className="al-when-date">{when.date}</span>
                    <span className="al-when-time">{when.time}</span>
                  </div>
                  <div className="al-operator">{log.operatorEmail || '—'}</div>
                  <div>
                    <div className="al-action-main">{log.summary || log.action || '—'}</div>
                    {log.entityType ? (
                      <div className="al-action-sub">{log.entityType}</div>
                    ) : null}
                  </div>
                  <div>
                    {log.organizationId ? (
                      <Link
                        to={`/platform/organizations/${log.organizationId}`}
                        className="al-org-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View org
                      </Link>
                    ) : (
                      <span className="al-org-none">—</span>
                    )}
                    <div className="al-inspect">{selectedRow ? 'Selected' : 'Details'}</div>
                  </div>
                </div>
              </button>
            );
          })}
          {!filtered.length && (
            <div className="al-empty">
              {loading ? 'Loading audit events…' : 'No audit events on this page'}
            </div>
          )}
        </div>

        {selected && (
          <div className="al-detail">
            <div className="al-detail-head">
              <div>
                <h3 className="al-detail-title">
                  {changeSummary.mode === 'create' ? 'Details' : 'What changed'}
                </h3>
                <p className="al-detail-summary">
                  {selected.summary || selected.action || 'Selected audit event'}
                </p>
              </div>
            </div>

            {!hasAnyState ? (
              <p className="al-detail-note">No extra details were saved for this action.</p>
            ) : changeSummary.rows.length === 0 ? (
              <p className="al-detail-note">Nothing meaningful changed in this record.</p>
            ) : changeSummary.mode === 'create' ? (
              <dl className="al-facts">
                {changeSummary.rows.map((row) => (
                  <div key={row.key} className="al-fact">
                    <dt>{row.label}</dt>
                    <dd>{row.afterText}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <ul className="al-changes">
                {changeSummary.rows.map((row) => (
                  <li key={row.key} className="al-change-row">
                    <span className="al-change-label">{row.label}</span>
                    <span className="al-change-values">
                      <span className="al-change-before">{row.beforeText}</span>
                      <span className="al-change-arrow" aria-hidden>
                        →
                      </span>
                      <span className="al-change-after">{row.afterText}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {globalAuditPagination?.totalPages > 1 && (
        <div className="al-pager">
          <span>
            Page {globalAuditPagination.page} of {globalAuditPagination.totalPages} ·{' '}
            {globalAuditPagination.total} total
          </span>
          <div className="al-pager-btns">
            <button
              type="button"
              className="al-btn al-btn-secondary"
              disabled={page <= 1 || loading}
              onClick={() => {
                const next = page - 1;
                setPage(next);
                load(next);
              }}
            >
              Previous
            </button>
            <button
              type="button"
              className="al-btn al-btn-secondary"
              disabled={page >= globalAuditPagination.totalPages || loading}
              onClick={() => {
                const next = page + 1;
                setPage(next);
                load(next);
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogsPage;
