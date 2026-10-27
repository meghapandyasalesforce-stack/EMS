import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FiCheck,
  FiCheckCircle,
  FiDownload,
  FiInfo,
  FiSearch,
  FiShare2,
  FiX,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { AtsPage } from '../../components/recruitment/atsUi';
import ApprovalDetailModal from './ApprovalDetailModal';
import useAuthPermissions from '../../Hooks/useAuthPermissions';
import { BOTH_EMPLOYEE_DOCUMENT_REQUEST_ENDPOINT } from '../../utils/constant';

const TABS = [
  { id: 'leave', label: 'Leave' },
  { id: 'regularization', label: 'Regularization' },
  { id: 'documents', label: 'Documents' },
  { id: 'tax', label: 'Tax Regime' },
  { id: 'other', label: 'Other' },
];

const categoryFromEntityType = (entityType) => {
  switch (entityType) {
    case 'Leave':
      return 'leave';
    case 'AttendanceRegularization':
      return 'regularization';
    case 'Document':
      return 'documents';
    case 'TaxRegimeChange':
      return 'tax';
    default:
      return 'other';
  }
};

const humanizeEntity = (entityType) =>
  String(entityType || 'Request').replace(/([a-z])([A-Z])/g, '$1 $2');

const requesterNameOf = (person) => {
  if (!person) return 'Unknown requester';
  if (typeof person === 'string') return person;
  return (
    [
      person.name,
      person.fullName,
      [person.firstName, person.lastName].filter(Boolean).join(' '),
      [person.name, person.lastName].filter(Boolean).join(' '),
    ].find((value) => value && String(value).trim()) || 'Unknown requester'
  );
};

const initialsOf = (name) =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';

const relativeSubmitted = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const isSlaBreached = (item) => {
  if (item.slaEscalated) return true;
  const due = item.currentPendingStep?.dueDate;
  if (!due) return false;
  const dueDate = new Date(due);
  return !Number.isNaN(dueDate.getTime()) && dueDate.getTime() < Date.now();
};

const normalizeWorkflow = (approval) => {
  const name = requesterNameOf(approval.requestedBy);
  const role =
    approval.requestedBy?.designation ||
    approval.requestedBy?.role ||
    approval.requestedBy?.jobTitle ||
    '';
  const department = approval.requestedBy?.department || '';
  const entityType = approval.entityType || 'Other';
  const title =
    entityType === 'TaxRegimeChange'
      ? 'Tax Regime Switch'
      : humanizeEntity(entityType);
  let details = approval.currentPendingStep?.stepName || approval.priority || '';
  if (entityType === 'TaxRegimeChange') {
    details = [
      approval.metadata?.currentTaxRegime,
      approval.metadata?.requestedTaxRegime
        ? `→ ${approval.metadata.requestedTaxRegime}`
        : null,
    ]
      .filter(Boolean)
      .join(' ');
  }
  return {
    ...approval,
    rowId: `wf-${approval._id}`,
    source: 'workflow',
    category: categoryFromEntityType(entityType),
    displayName: name,
    displayRole: role,
    displayDepartment: department,
    displayTitle: title,
    displayDetails: details || humanizeEntity(entityType),
    submittedAt: approval.createdAt || approval.currentPendingStep?.dueDate,
    slaBreached: isSlaBreached(approval),
  };
};

const normalizeTaxDirect = (item) => {
  const name = requesterNameOf(item.requestedBy);
  return {
    ...item,
    rowId: `tax-${item.taxRegimeRequestId || item._id}`,
    source: 'tax',
    category: 'tax',
    entityType: 'TaxRegimeChange',
    displayName: name,
    displayRole: item.requestedBy?.designation || item.requestedBy?.role || '',
    displayDepartment: item.requestedBy?.department || '',
    displayTitle: 'Tax Regime Switch',
    displayDetails: [
      item.metadata?.currentTaxRegime,
      item.metadata?.requestedTaxRegime ? `→ ${item.metadata.requestedTaxRegime}` : null,
    ]
      .filter(Boolean)
      .join(' ') || 'Tax regime change request',
    submittedAt: item.createdAt || item.submittedAt,
    slaBreached: Boolean(item.slaEscalated),
    isDirectTaxRegimeRequest: true,
  };
};

const normalizeWfh = (request) => {
  const employee = request.employeeId || {};
  const name = requesterNameOf(employee);
  const start = request.startDate
    ? new Date(request.startDate).toLocaleDateString()
    : '';
  const end = request.endDate ? new Date(request.endDate).toLocaleDateString() : '';
  return {
    ...request,
    rowId: `wfh-${request._id}`,
    source: 'wfh',
    category: 'regularization',
    entityType: 'WFH',
    displayName: name,
    displayRole: employee.designation || employee.role || '',
    displayDepartment: employee.department || '',
    displayTitle: 'WFH Request',
    displayDetails: [start && end ? `${start} – ${end}` : start || end, request.reason]
      .filter(Boolean)
      .join(' · '),
    submittedAt: request.createdAt || request.submittedAt,
    slaBreached: false,
    requestedBy: employee,
  };
};

const normalizeDocVerify = (doc) => {
  const employee = doc.employeeId || doc.uploadedBy || {};
  const name = requesterNameOf(employee);
  return {
    ...doc,
    rowId: `docv-${doc._id}`,
    source: 'doc_verify',
    category: 'documents',
    entityType: 'Document',
    displayName: name,
    displayRole: employee.designation || employee.role || '',
    displayDepartment: employee.department || '',
    displayTitle: doc.documentType || doc.name || 'Document verification',
    displayDetails: doc.fileName || doc.originalName || 'Pending HR verification',
    submittedAt: doc.createdAt || doc.uploadedAt,
    slaBreached: false,
    requestedBy: employee,
  };
};

const normalizeDocRequest = (item) => {
  const employee = item.employeeId || item.requestedBy || {};
  const name = requesterNameOf(employee);
  return {
    ...item,
    rowId: `docr-${item._id}`,
    source: 'doc_request',
    category: 'documents',
    entityType: 'DocumentRequest',
    displayName: name,
    displayRole: employee.designation || employee.role || '',
    displayDepartment: employee.department || '',
    displayTitle: item.documentType || item.type || 'Document request',
    displayDetails: item.purpose || item.remarks || 'Employee document request',
    submittedAt: item.createdAt || item.requestedAt,
    slaBreached: false,
    requestedBy: employee,
  };
};

const emptyCatch = () => ({ data: { data: [] } });

const PendingApprovals = () => {
  const { isOrgOwner } = useAuthPermissions();
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('leave');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('All Departments');
  const [urgency, setUrgency] = useState('All');
  const [escalatedOnly, setEscalatedOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [drawerItem, setDrawerItem] = useState(null);
  const [modal, setModal] = useState(null);
  const [actionTargets, setActionTargets] = useState([]);
  const [rejectReason, setRejectReason] = useState('');
  const [delegateToId, setDelegateToId] = useState('');
  const [delegateComment, setDelegateComment] = useState('');
  const [delegateOptions, setDelegateOptions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('escalated') === '1') {
      setEscalatedOnly(true);
    }
  }, [searchParams]);

  const fetchPendingApprovals = useCallback(async () => {
    try {
      setLoading(true);
      const [workflowRes, taxRegimeRes, docsRes, docReqRes, wfhRes] = await Promise.all([
        axios.get('/v1/admin/approvals/my-pending').catch(emptyCatch),
        axios.get('/v1/both/tax-regime-change/admin/pending').catch(emptyCatch),
        axios.get('/v1/admin/documents/pending', { withCredentials: true }).catch(emptyCatch),
        axios
          .get(`${BOTH_EMPLOYEE_DOCUMENT_REQUEST_ENDPOINT}/approvals`, { withCredentials: true })
          .catch(emptyCatch),
        axios
          .get('/v1/both/wfh-requests/all', {
            params: { page: 1, limit: 100 },
            withCredentials: true,
          })
          .catch(() => ({ data: { requests: [] } })),
      ]);

      const workflowApprovals = (workflowRes.data?.data || []).map(normalizeWorkflow);
      const taxRegimeApprovals = taxRegimeRes.data?.data || [];
      const workflowTaxIds = new Set(
        workflowApprovals
          .filter((a) => a.entityType === 'TaxRegimeChange')
          .map((a) => String(a.entityId))
      );
      const directTaxCards = taxRegimeApprovals
        .filter((item) => !workflowTaxIds.has(String(item.taxRegimeRequestId)))
        .map(normalizeTaxDirect);

      const workflowDocIds = new Set(
        workflowApprovals
          .filter((a) => a.entityType === 'Document')
          .map((a) => String(a.entityId))
      );
      const pendingDocs = (docsRes.data?.data || docsRes.data?.documents || [])
        .filter((doc) => doc?._id && !workflowDocIds.has(String(doc._id)))
        .map(normalizeDocVerify);

      const pendingDocRequests = (docReqRes.data?.data || [])
        .filter((item) => String(item.status || '').toLowerCase() === 'pending')
        .map(normalizeDocRequest);

      const pendingWfh = (wfhRes.data?.requests || [])
        .filter((item) => ['pending', 'submitted'].includes(String(item.status || '').toLowerCase()))
        .map(normalizeWfh);

      const merged = [
        ...directTaxCards,
        ...workflowApprovals,
        ...pendingDocs,
        ...pendingDocRequests,
        ...pendingWfh,
      ];
      setApprovals(merged);
      setSelectedIds([]);
      setTab((current) => {
        const counts = Object.fromEntries(TABS.map((item) => [item.id, 0]));
        merged.forEach((item) => {
          if (counts[item.category] != null) counts[item.category] += 1;
        });
        if (counts[current] > 0) return current;
        const firstWithItems = TABS.find((item) => counts[item.id] > 0);
        return firstWithItems?.id || current;
      });
    } catch {
      toast.error('Failed to fetch pending approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingApprovals();
  }, [fetchPendingApprovals]);

  const canDecideApproval = (approval) => isOrgOwner || !approval?.requiresAdminApproval;

  const departments = useMemo(() => {
    const set = new Set(
      approvals.map((item) => item.displayDepartment).filter((value) => value && String(value).trim())
    );
    return ['All Departments', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [approvals]);

  const tabCounts = useMemo(() => {
    const counts = Object.fromEntries(TABS.map((item) => [item.id, 0]));
    approvals.forEach((item) => {
      if (counts[item.category] != null) counts[item.category] += 1;
    });
    return counts;
  }, [approvals]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return approvals.filter((item) => {
      if (item.category !== tab) return false;
      if (escalatedOnly && !item.slaBreached) return false;
      if (department !== 'All Departments' && item.displayDepartment !== department) return false;
      if (urgency === 'Overdue' && !item.slaBreached) return false;
      if (urgency === 'On time' && item.slaBreached) return false;
      if (!q) return true;
      return [item.displayName, item.rowId, item.displayTitle, item.displayDetails, item._id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [approvals, tab, escalatedOnly, department, urgency, search]);

  const byId = useMemo(() => {
    const map = new Map();
    approvals.forEach((item) => map.set(item.rowId, item));
    return map;
  }, [approvals]);

  const resolveTargets = (rowId) => {
    if (rowId) {
      const item = byId.get(rowId);
      return item ? [item] : [];
    }
    if (selectedIds.length) {
      return selectedIds.map((id) => byId.get(id)).filter(Boolean);
    }
    return [];
  };

  const processOne = async (approval, action, comments = '') => {
    if (!canDecideApproval(approval)) {
      throw new Error('This request can only be decided by an organization admin');
    }

    if (approval.source === 'tax' || approval.entityType === 'TaxRegimeChange') {
      const requestId = approval.taxRegimeRequestId || approval.entityId || approval._id;
      if (action === 'Approve') {
        await axios.patch(`/v1/both/tax-regime-change/admin/approve/${requestId}`, {
          stepNumber: approval.currentPendingStep?.stepNumber,
          comments,
        });
      } else {
        await axios.patch(`/v1/both/tax-regime-change/admin/reject/${requestId}`, {
          stepNumber: approval.currentPendingStep?.stepNumber,
          comments,
          rejectionReason: comments,
        });
      }
      return;
    }

    if (approval.source === 'wfh') {
      await axios.put(
        `/v1/both/wfh-requests/${approval._id}/review`,
        { action: action === 'Approve' ? 'approve' : 'reject', ...(comments ? { note: comments } : {}) },
        { withCredentials: true }
      );
      return;
    }

    if (approval.source === 'doc_verify') {
      if (action === 'Approve') {
        await axios.post(`/v1/admin/documents/${approval._id}/approve`, {}, { withCredentials: true });
      } else {
        await axios.post(
          `/v1/admin/documents/${approval._id}/reject`,
          { note: comments },
          { withCredentials: true }
        );
      }
      return;
    }

    if (approval.source === 'doc_request') {
      if (action === 'Approve') {
        await axios.patch(
          `${BOTH_EMPLOYEE_DOCUMENT_REQUEST_ENDPOINT}/${approval._id}/approve`,
          { remarks: comments },
          { withCredentials: true }
        );
      } else {
        await axios.patch(
          `${BOTH_EMPLOYEE_DOCUMENT_REQUEST_ENDPOINT}/${approval._id}/reject`,
          { reason: comments },
          { withCredentials: true }
        );
      }
      return;
    }

    await axios.post(`/v1/admin/approvals/process/${approval._id}`, {
      stepNumber: approval.currentPendingStep?.stepNumber,
      action,
      comments,
      ...(approval.hrOverrideAvailable ? { hrOverride: true } : {}),
      ...(approval.timeoutEscalationAvailable && !approval.hrOverrideAvailable
        ? { timeoutEscalation: true }
        : {}),
    });
  };

  const runBatch = async (targets, action, comments = '') => {
    if (!targets.length) {
      toast.warning('Select at least one request');
      return;
    }
    setBusy(true);
    let ok = 0;
    let fail = 0;
    for (const target of targets) {
      try {
        await processOne(target, action, comments);
        ok += 1;
      } catch (error) {
        fail += 1;
        if (error.response?.status === 409) {
          toast.warning(error.response?.data?.message || 'Request already processed');
        } else if (fail === 1) {
          toast.error(error.response?.data?.message || error.message || 'Failed to process approval');
        }
      }
    }
    setBusy(false);
    setModal(null);
    setRejectReason('');
    setActionTargets([]);
    setSelectedIds([]);
    setShowDetail(false);
    setDrawerItem(null);
    if (ok) toast.success(`${ok} request(s) ${action === 'Approve' ? 'approved' : 'processed'}`);
    await fetchPendingApprovals();
  };

  const openReject = (rowId) => {
    const targets = resolveTargets(rowId);
    if (!targets.length) {
      toast.warning('Select at least one request');
      return;
    }
    setActionTargets(targets);
    setRejectReason('');
    setModal('reject');
  };

  const openInfo = (rowId) => {
    const targets = resolveTargets(rowId);
    if (!targets.length) return;
    const first = targets[0];
    if (first.source === 'workflow' || first.source === 'tax') {
      setSelectedApproval(first);
      setShowDetail(true);
      return;
    }
    setDrawerItem(first);
  };

  const openDelegate = async (rowId) => {
    const targets = resolveTargets(rowId).filter((item) => item.source === 'workflow' && item._id);
    if (!targets.length) {
      toast.info('Delegation is only available for workflow approval steps');
      return;
    }
    setActionTargets(targets);
    setDelegateToId('');
    setDelegateComment('');
    setModal('delegate');
    try {
      const response = await axios.get('/v1/admin/employee', {
        params: { page: 1, limit: 100 },
        withCredentials: true,
      });
      const raw = response.data?.data ?? response.data?.employees ?? response.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.employees)
          ? raw.employees
          : Array.isArray(raw?.data)
            ? raw.data
            : [];
      setDelegateOptions(list);
    } catch {
      setDelegateOptions([]);
    }
  };

  const confirmDelegate = async () => {
    if (!delegateToId) {
      toast.warning('Select a delegate');
      return;
    }
    setBusy(true);
    let ok = 0;
    for (const target of actionTargets) {
      try {
        await axios.post(`/v1/admin/approvals/delegate/${target._id}`, {
          stepNumber: target.currentPendingStep?.stepNumber,
          delegateToId,
          comments: delegateComment,
        });
        ok += 1;
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to delegate approval');
      }
    }
    setBusy(false);
    setModal(null);
    setActionTargets([]);
    if (ok) toast.success(`${ok} request(s) delegated`);
    await fetchPendingApprovals();
  };

  const toggleSelected = (rowId) => {
    setSelectedIds((prev) =>
      prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]
    );
  };

  const toggleSelectAll = (checked) => {
    setSelectedIds(checked ? filtered.map((item) => item.rowId) : []);
  };

  const exportAuditLog = () => {
    const rows = [
      ['ID', 'Employee', 'Category', 'Request', 'Details', 'Submitted', 'Deadline', 'Type'],
      ...approvals.map((item) => [
        item.rowId,
        item.displayName,
        item.category,
        item.displayTitle,
        item.displayDetails,
        item.submittedAt ? new Date(item.submittedAt).toISOString() : '',
        item.slaBreached ? 'Overdue' : 'On time',
        item.entityType || '',
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pending-approvals-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('List exported');
  };

  const batchApproveAll = () => {
    const targets = filtered.filter((item) => canDecideApproval(item));
    if (!targets.length) {
      toast.info('No approvable requests in this view');
      return;
    }
    runBatch(targets, 'Approve');
  };

  if (loading) {
    return (
      <AtsPage>
        <div className="flex min-h-[50vh] items-center justify-center">
          <LoadingSpinner message="Loading pending approvals…" />
        </div>
      </AtsPage>
    );
  }

  return (
    <AtsPage className="ats-approvals-page ats-gov-suite">
      <div className="ats-gov-suite__inner">
        <header className="ats-gov-suite__header">
          <div className="ats-gov-suite__header-copy">
            <div className="ats-gov-suite__title-row">
              <h1 className="ats-gov-suite__title">Pending Approvals</h1>
              <span className="ats-gov-suite__pending-pill">
                <span className="ats-gov-suite__pending-dot" aria-hidden />
                {approvals.length} Pending
              </span>
            </div>
            <p className="ats-gov-suite__subtitle">
              Review and approve employee requests that are waiting for you.
            </p>
          </div>
          <div className="ats-gov-suite__header-actions">
            <button type="button" className="ats-gov-suite__btn ats-gov-suite__btn--ghost" onClick={exportAuditLog}>
              <FiDownload aria-hidden />
              Export list
            </button>
            <button
              type="button"
              className="ats-gov-suite__btn ats-gov-suite__btn--primary"
              disabled={busy}
              onClick={batchApproveAll}
            >
              <FiCheckCircle aria-hidden />
              Approve all
            </button>
          </div>
        </header>

        <div className="ats-gov-suite__tabs" role="tablist" aria-label="Approval categories">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`ats-gov-suite__tab ${tab === item.id ? 'is-active' : ''}`}
              onClick={() => {
                setTab(item.id);
                setSelectedIds([]);
              }}
            >
              <span>{item.label}</span>
              <span className="ats-gov-suite__tab-count">{tabCounts[item.id] || 0}</span>
            </button>
          ))}
        </div>

        <div className="ats-gov-suite__filters">
          <div className="ats-gov-suite__filters-left">
            <div className="ats-gov-suite__search">
              <FiSearch aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSelectedIds([]);
                }}
                placeholder="Search by name, ID, or request type..."
                aria-label="Search approvals"
              />
            </div>
            <select
              aria-label="Department filter"
              value={department}
              onChange={(event) => {
                setDepartment(event.target.value);
                setSelectedIds([]);
              }}
            >
              {departments.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              aria-label="Deadline filter"
              value={urgency}
              onChange={(event) => {
                setUrgency(event.target.value);
                setSelectedIds([]);
              }}
            >
              <option>All</option>
              <option>Overdue</option>
              <option>On time</option>
            </select>
          </div>
          <p className="ats-gov-suite__showing">
            Showing {filtered.length} of {approvals.length} requests
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="ats-gov-suite__empty">
            <div className="ats-gov-suite__empty-icon" aria-hidden>
              <FiCheckCircle />
            </div>
            <h2>Nothing waiting for you</h2>
            <p>There are no pending requests in this category right now.</p>
            <button
              type="button"
              className="ats-gov-suite__btn ats-gov-suite__btn--primary"
              onClick={() => {
                setSearch('');
                setDepartment('All Departments');
                setUrgency('All');
                setEscalatedOnly(false);
                fetchPendingApprovals();
              }}
            >
              Refresh
            </button>
          </div>
        ) : (
          <section className="ats-gov-suite__table-wrap">
            <div className="ats-gov-suite__table">
              <div className="ats-gov-suite__thead">
                <div className="ats-gov-suite__th ats-gov-suite__th--check">
                  <input
                    type="checkbox"
                    aria-label="Select all approvals"
                    checked={filtered.length > 0 && filtered.every((row) => selectedIds.includes(row.rowId))}
                    onChange={(event) => toggleSelectAll(event.target.checked)}
                  />
                </div>
                <div className="ats-gov-suite__th">Employee</div>
                <div className="ats-gov-suite__th">Request</div>
                <div className="ats-gov-suite__th">Submitted</div>
                <div className="ats-gov-suite__th">Deadline</div>
                <div className="ats-gov-suite__th ats-gov-suite__th--actions">Actions</div>
              </div>
              {filtered.map((row) => {
                const canAct = canDecideApproval(row);
                return (
                  <div key={row.rowId} className="ats-gov-suite__trow">
                    <div className="ats-gov-suite__td ats-gov-suite__td--check">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.rowId)}
                        onChange={() => toggleSelected(row.rowId)}
                        aria-label={`Select ${row.displayName}`}
                      />
                      <span className="ats-gov-suite__avatar" aria-hidden>
                        {initialsOf(row.displayName)}
                      </span>
                    </div>
                    <div className="ats-gov-suite__td">
                      <button
                        type="button"
                        className="ats-gov-suite__name"
                        onClick={() => openInfo(row.rowId)}
                      >
                        {row.displayName}
                      </button>
                      <p className="ats-gov-suite__meta">
                        {[row.displayRole, row.displayDepartment].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <div className="ats-gov-suite__td">
                      <p className="ats-gov-suite__req-title">{row.displayTitle}</p>
                      <p className="ats-gov-suite__meta">{row.displayDetails}</p>
                    </div>
                    <div className="ats-gov-suite__td ats-gov-suite__td--muted">
                      {relativeSubmitted(row.submittedAt)}
                    </div>
                    <div className="ats-gov-suite__td">
                      <span
                        className={`ats-gov-suite__sla ${row.slaBreached ? 'is-breached' : 'is-ok'}`}
                      >
                        {row.slaBreached ? 'Overdue' : 'On time'}
                      </span>
                    </div>
                    <div className="ats-gov-suite__td ats-gov-suite__td--actions">
                      {canAct ? (
                        <button
                          type="button"
                          className="ats-gov-suite__approve"
                          disabled={busy}
                          onClick={() => runBatch([row], 'Approve')}
                        >
                          Approve
                        </button>
                      ) : null}
                      {canAct ? (
                        <button
                          type="button"
                          className="ats-gov-suite__icon-btn is-reject"
                          aria-label={`Reject ${row.displayName}`}
                          disabled={busy}
                          onClick={() => openReject(row.rowId)}
                        >
                          <FiX />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="ats-gov-suite__icon-btn"
                        aria-label={`View ${row.displayName}`}
                        onClick={() => openInfo(row.rowId)}
                      >
                        <FiInfo />
                      </button>
                      {row.source === 'workflow' ? (
                        <button
                          type="button"
                          className="ats-gov-suite__icon-btn is-delegate"
                          aria-label={`Delegate ${row.displayName}`}
                          onClick={() => openDelegate(row.rowId)}
                        >
                          <FiShare2 />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="ats-gov-suite__table-foot">Showing {filtered.length} requests</p>
          </section>
        )}
      </div>

      {selectedIds.length > 0 ? (
        <div className="ats-gov-suite__bulk">
          <div className="ats-gov-suite__bulk-count">
            <span>{selectedIds.length}</span>
            Items Selected
          </div>
          <div className="ats-gov-suite__bulk-actions">
            <button
              type="button"
              className="ats-gov-suite__btn ats-gov-suite__btn--primary"
              disabled={busy}
              onClick={() => runBatch(resolveTargets(), 'Approve')}
            >
              <FiCheck aria-hidden />
              Approve ({selectedIds.length})
            </button>
            <button
              type="button"
              className="ats-gov-suite__btn ats-gov-suite__btn--danger"
              disabled={busy}
              onClick={() => openReject()}
            >
              <FiX aria-hidden />
              Reject
            </button>
            <button
              type="button"
              className="ats-gov-suite__btn ats-gov-suite__btn--ghost-dark"
              onClick={() => setSelectedIds([])}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {drawerItem ? (
        <div className="ats-gov-suite__drawer-overlay" role="presentation" onClick={() => setDrawerItem(null)}>
          <aside
            className="ats-gov-suite__drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Request details"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="ats-gov-suite__drawer-head">
              <div>
                <h3>{drawerItem.displayName}</h3>
                <p>
                  {drawerItem.displayTitle} · {drawerItem.rowId}
                </p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setDrawerItem(null)}>
                <FiX />
              </button>
            </header>
            <div className="ats-gov-suite__drawer-body">
              <dl>
                <div>
                  <dt>Role and department</dt>
                  <dd>
                    {[drawerItem.displayRole, drawerItem.displayDepartment].filter(Boolean).join(' · ') ||
                      '—'}
                  </dd>
                </div>
                <div>
                  <dt>Request</dt>
                  <dd>{drawerItem.displayDetails || '—'}</dd>
                </div>
                <div>
                  <dt>Submitted</dt>
                  <dd>{relativeSubmitted(drawerItem.submittedAt)}</dd>
                </div>
                <div>
                  <dt>Deadline</dt>
                  <dd>{drawerItem.slaBreached ? 'Overdue' : 'On time'}</dd>
                </div>
              </dl>
            </div>
            {canDecideApproval(drawerItem) ? (
              <footer className="ats-gov-suite__drawer-foot">
                <button
                  type="button"
                  className="ats-gov-suite__btn ats-gov-suite__btn--ghost"
                  onClick={() => openReject(drawerItem.rowId)}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="ats-gov-suite__btn ats-gov-suite__btn--primary"
                  disabled={busy}
                  onClick={() => runBatch([drawerItem], 'Approve')}
                >
                  Approve
                </button>
              </footer>
            ) : null}
          </aside>
        </div>
      ) : null}

      {modal === 'reject' ? (
        <div className="ats-gov-suite__modal-overlay" role="presentation" onClick={() => setModal(null)}>
          <div
            className="ats-gov-suite__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ats-gov-suite__modal-head">
              <h3 id="reject-modal-title">Reject request</h3>
              <button type="button" aria-label="Close" onClick={() => setModal(null)}>
                <FiX />
              </button>
            </div>
            <p className="ats-gov-suite__modal-copy">
              Please enter a reason for rejecting this request.
            </p>
            <label className="ats-gov-suite__field">
              <span>Reason *</span>
              <textarea
                rows={4}
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder="Why are you rejecting this?"
              />
            </label>
            <div className="ats-gov-suite__modal-actions">
              <button type="button" className="ats-gov-suite__btn ats-gov-suite__btn--ghost" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="ats-gov-suite__btn ats-gov-suite__btn--danger"
                disabled={busy || !rejectReason.trim()}
                onClick={() => runBatch(actionTargets, 'Reject', rejectReason.trim())}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modal === 'delegate' ? (
        <div className="ats-gov-suite__modal-overlay" role="presentation" onClick={() => setModal(null)}>
          <div
            className="ats-gov-suite__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delegate-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ats-gov-suite__modal-head">
              <h3 id="delegate-modal-title">Pass to someone else</h3>
              <button type="button" aria-label="Close" onClick={() => setModal(null)}>
                <FiX />
              </button>
            </div>
            <p className="ats-gov-suite__modal-copy">
              Choose another person to review this request (only if the workflow allows it).
            </p>
            <label className="ats-gov-suite__field">
              <span>Employee</span>
              <select value={delegateToId} onChange={(event) => setDelegateToId(event.target.value)}>
                <option value="">Choose employee…</option>
                {delegateOptions.map((emp) => {
                  const id = emp._id || emp.id;
                  const label = requesterNameOf(emp);
                  return (
                    <option key={id} value={id}>
                      {label}
                      {emp.department ? ` · ${emp.department}` : ''}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="ats-gov-suite__field">
              <span>Comment (optional)</span>
              <textarea
                rows={3}
                value={delegateComment}
                onChange={(event) => setDelegateComment(event.target.value)}
                placeholder="Optional note for the delegate"
              />
            </label>
            <div className="ats-gov-suite__modal-actions">
              <button type="button" className="ats-gov-suite__btn ats-gov-suite__btn--ghost" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="ats-gov-suite__btn ats-gov-suite__btn--primary"
                disabled={busy || !delegateToId}
                onClick={confirmDelegate}
              >
                Pass request
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showDetail && selectedApproval ? (
        <ApprovalDetailModal
          approval={selectedApproval}
          canAct={canDecideApproval(selectedApproval)}
          onClose={() => {
            setShowDetail(false);
            setSelectedApproval(null);
          }}
          onAction={(_approvalId, _stepNumber, action, comments) =>
            runBatch([selectedApproval], action, comments)
          }
        />
      ) : null}
    </AtsPage>
  );
};

export default PendingApprovals;
