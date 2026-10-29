import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import axios from '../../utils/axios';
import { FiPlus, FiChevronRight } from 'react-icons/fi';
import ErrorBoundary from '../../components/ErrorBoundary';
import {
  ModalShell, LeaveDrawer, ApprovalsDrawer, EmployeeQuickViewModal,
  CelebrationsDrawer,
} from '../../HR/Dashboard/DashboardOverlays';

const Attendance = lazy(() => import('../Attendance/TodayStatusComponent'));
const Payroll = lazy(() => import('../Payroll/AdminPayroll'));
const AddEmployee = lazy(() => import('../Employee/AddEmployee'));
const Helpdesk = lazy(() => import('../../HR/Helpdesk/HelpdeskPage'));
const Calendar = lazy(() => import('../Calendar/CalendarManagement'));
const TITLES = { employees: 'Employee overview', attendance: "Today's Attendance", payroll: 'Payroll', addEmployee: 'Add Employee', helpdesk: 'Helpdesk', calendar: 'Calendar', announcements: 'Announcements', approvals: 'Overdue approvals', leave: 'Pending leave requests' };

/** Admin adapter for the existing HR overlay chrome and existing authorized workflows. */
export default function AdminDashboardOverlays({ overlay, onClose, onChanged, employees, leaves, canApproveLeave, celebrations, celebrationEvents, reacting, onReact, onEnsureEvent, announcements, onNewAnnouncement, onEmployee, onFullEmployee }) {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [announcementItems, setAnnouncementItems] = useState(announcements);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const dirty = useRef(false);
  const initialPath = useRef(location.pathname);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const kind = overlay?.kind;

  const requestClose = () => {
    const dialogs = document.querySelectorAll('[role="dialog"]');
    const dialog = dialogs[dialogs.length - 1];
    if (dialog && [...dialog.querySelectorAll('button:disabled')].some(button => /saving|processing|submitting|sending|approving|rejecting|creating|generating|updating|publishing/i.test(button.textContent))) return;
    // eslint-disable-next-line no-alert -- Keep a native confirmation before discarding workflow form data.
    if (dirty.current && !window.confirm('Close this window and discard unsaved changes?')) return;
    onClose();
  };
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  useEffect(() => {
    if (location.pathname !== initialPath.current) closeRef.current();
  }, [location.pathname]);

  useEffect(() => {
    if (!kind) return undefined;
    dirty.current = false;
    const activeElement = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('admin-dashboard-overlay');
    if (kind === 'announcements') document.body.classList.add('admin-announcements-overlay');
    const timer = setTimeout(() => document.querySelector('.hr-ov-modal button, .hr-ov-drawer button')?.focus(), 0);
    const onInput = event => {
      if (['addEmployee', 'payroll', 'helpdesk', 'leave', 'approvals'].includes(kind) && event.target.closest('[role="dialog"]')) dirty.current = true;
    };
    const onKey = event => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs.length !== 1) return; // Let nested workflow confirmations own their keyboard events.
      const nestedPanels = document.querySelectorAll('.admin-dashboard-workflow .fixed.inset-0');
      if (event.key === 'Escape' && nestedPanels.length) return;
      if (event.key === 'Escape') { event.preventDefault(); requestCloseRef.current(); }
      if (event.key !== 'Tab') return;
      const scope = nestedPanels[nestedPanels.length - 1] || dialogs[0];
      const elements = [...scope.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(element => element.getClientRects().length);
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('input', onInput);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove('admin-dashboard-overlay', 'admin-announcements-overlay');
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('input', onInput);
      activeElement?.focus?.();
    };
  }, [kind]);

  useEffect(() => {
    if (!['approvals', 'announcements'].includes(kind)) return undefined;
    let cancelled = false;
    setLoading(true); setError('');
    const url = kind === 'approvals' ? '/v1/admin/approvals/my-pending' : '/v1/both/notification/sent-announcements';
    axios.get(url, { withCredentials: true, params: kind === 'announcements' ? { scope: 'organization', page: 1, limit: 100 } : undefined })
      .then(response => {
        if (cancelled) return;
        if (kind === 'approvals') setApprovals(response.data?.data || []);
        else setAnnouncementItems(response.data?.announcements || []);
      }).catch(() => { if (!cancelled) setError(`Unable to load ${kind}.`); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [kind, attempt]);

  if (!overlay) return null;
  const refresh = () => { onChanged?.(); dirty.current = false; queryClient.invalidateQueries({ queryKey: ['leaves'] }); setAttempt(value => value + 1); };
  if (kind === 'leave' && canApproveLeave) return <LeaveDrawer open leaves={overlay.leave ? [overlay.leave] : leaves} onClose={requestClose} onChanged={() => { refresh(); onClose(); }} />;
  if (kind === 'approvals' && !loading && !error) return <ApprovalsDrawer open escalatedOnly approvals={approvals} onClose={requestClose} onChanged={refresh} />;
  if (kind === 'employee') return <EmployeeQuickViewModal open employee={overlay.employee} onClose={requestClose} onEditFull={() => onFullEmployee(overlay.employee)} />;
  if (kind === 'celebrations') return <CelebrationsDrawer open items={celebrations} focusItem={overlay.item} eventsByKey={celebrationEvents} reacting={reacting} onReact={onReact} onEnsureEvent={onEnsureEvent} onClose={requestClose} />;
  if (kind === 'announcements') return (
    <ModalShell wide eyebrow="Communications" title="Announcements" onClose={requestClose} footer={
      <><button type="button" className="hr-ov-btn hr-ov-btn--ghost" onClick={requestClose}>Cancel</button>{onNewAnnouncement && <button type="button" className="hr-ov-btn hr-ov-btn--primary" onClick={onNewAnnouncement}>New</button>}</>
    }>
      <div className="admin-announcements-popup">
        {onNewAnnouncement && <div className="admin-announcements-popup__toolbar"><button type="button" className="hr-ov-btn hr-ov-btn--primary" onClick={onNewAnnouncement}><FiPlus aria-hidden />New Announcement</button></div>}
        {loading ? <p role="status" className="hr-ov-empty">Loading announcements…</p> : error ? <div role="alert"><p>{error}</p><button type="button" className="hr-ov-btn hr-ov-btn--primary" onClick={() => setAttempt(value => value + 1)}>Retry</button></div> : announcementItems.length === 0 ? <div className="hr-ov-empty">No announcements yet.</div> : <div className="admin-announcements-popup__list">
          {announcementItems.map(item => {
            const important = item.priority === 'high' || item.metadata?.important === true || item.metadata?.priority === 'high';
            const category = important ? 'Important' : String(item.metadata?.category || item.category || 'General');
            const tone = ['important', 'update', 'general', 'event'].includes(category.toLowerCase()) ? category.toLowerCase() : 'general';
            const title = String(item.metadata?.title || item.message || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            return <article key={item._id} className="admin-announcements-popup__item"><div><div className="admin-announcements-popup__meta"><time>{item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</time><span className="admin-announcements-popup__badge" data-tone={tone}>{category}</span></div><p>{title}</p></div><FiChevronRight aria-hidden /></article>;
          })}
        </div>}
      </div>
    </ModalShell>
  );
  const Workflow = { attendance: Attendance, payroll: Payroll, addEmployee: AddEmployee, helpdesk: Helpdesk, calendar: Calendar }[kind];
  return (
    <ModalShell wide title={TITLES[kind] || 'Dashboard details'} eyebrow="Admin workspace" onClose={requestClose}>
      {loading ? <p role="status" className="hr-ov-empty">Loading details…</p> : error ? <div role="alert"><p>{error}</p><button className="hr-ov-btn hr-ov-btn--primary" onClick={() => setAttempt(value => value + 1)}>Retry</button></div> : Workflow ? (
        <ErrorBoundary><Suspense fallback={<p role="status" className="hr-ov-empty">Loading…</p>}><div className="admin-dashboard-workflow"><Workflow /></div></Suspense></ErrorBoundary>
      ) : kind === 'employees' ? (
        <div className="space-y-2">
          {employees.length === 0 ? <p className="hr-ov-empty">No employees found.</p> : employees.map(employee => <button type="button" className="admin-dash__list-row" key={employee._id || employee.id} onClick={() => onEmployee(employee)}><span><strong>{employee.name} {employee.lastName}</strong><small>{employee.position || employee.jobTitle} · {employee.department}</small></span><span>View →</span></button>)}
          <p className="text-sm text-slate-500">Showing the employees loaded by the existing dashboard roster.</p>
        </div>
      ) : kind === 'leave' ? <div className="space-y-2">{(overlay.leave ? [overlay.leave] : leaves.filter(leave => String(leave.status).toLowerCase() === 'pending')).map(leave => <div className="admin-dash__list-row" key={leave._id}><span>{leave.employeeName || leave.employee?.name || 'Employee'}</span><span>{leave.leaveType} · {leave.totalDays || leave.numberOfDays || 1} day(s)</span></div>)}<p className="text-sm text-slate-500">Approval actions require leave approval permission.</p></div> : null}
    </ModalShell>
  );
}
