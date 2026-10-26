import { useEffect, useRef, useState } from 'react';
import { Sidebar, Header } from './Layout.jsx';
import { initialRequisitions } from './requisitionData.js';
import RequisitionRow from './RequisitionRow.jsx';

export default function HeadcountRequisitions() {
 const [requisitions, setRequisitions] = useState(initialRequisitions);
 const [fields, setFields] = useState({searchInput:'', deptFilter:'', priorityFilter:'', formRoleTitle:'Lead Distributed Systems Engineer', formDept:'Platform Engg', formQty:'2', formPriority:'P1 High', formCtcMin:'?45 LPA', formCtcMax:'?65 LPA', formManager:'Arunachalam Murthy', formJustification:'Scaling Kafka ingestion cluster pods to sustain Diwali festive surge.', approveComment:'Cleared for fast-track recruitment.', rejectReason:'Budget Ceiling Exceeded', rejectNotes:''});
 const [tab, setTab] = useState('ALL');
 const [drawer, setDrawer] = useState(null);
 const [modal, setModal] = useState(null);
 const [activeId, setActiveId] = useState('REQ-2025-142');
 const [toast, setToast] = useState({message:'',type:'success'});
 const [page, setPage] = useState(1);
 const [pageSize, setPageSize] = useState(10);
 const timer = useRef();
 const active = requisitions.find(item => item.id === activeId) || requisitions[0];
 const filtered = requisitions.filter(item => (tab === 'ALL' || item.status.toUpperCase() === tab) && (!fields.deptFilter || item.dept === fields.deptFilter) && (!fields.priorityFilter || item.priority === fields.priorityFilter) && [item.id,item.role,item.requestedBy].some(value => value.toLowerCase().includes(fields.searchInput.toLowerCase())));
 const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
 const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
 useEffect(() => { setPage(1); }, [tab, fields.searchInput, fields.deptFilter, fields.priorityFilter]);
 useEffect(() => { setPage(previous => Math.min(previous, totalPages)); }, [totalPages]);
 useEffect(() => () => clearTimeout(timer.current), []);
 const hideToast = () => setToast(previous => ({...previous,message:''}));
 const showToast = (message,type = 'success') => { clearTimeout(timer.current); setToast({message,type}); timer.current = setTimeout(hideToast,4500); };
 const filterByTab = setTab;
 const resetFilters = () => { setFields(previous => ({...previous,searchInput:'',deptFilter:'',priorityFilter:''})); setTab('ALL'); setPage(1); };
 const openNewReqDrawer = () => setDrawer('new');
 const closeNewReqDrawer = () => setDrawer(null);
 const closeDetailDrawer = () => setDrawer(null);
 const openDetailDrawer = (id = 'REQ-2025-142') => { setActiveId(id); setDrawer('detail'); };
 const promptApproveModal = id => { if(id) setActiveId(id); setModal('approve'); };
 const promptRejectModal = id => { if(id) setActiveId(id); setModal('reject'); };
 const promptConvertModal = id => { if(id) setActiveId(id); setModal('convert'); };
 const closeApproveModal = () => setModal(null);
 const closeRejectModal = closeApproveModal;
 const closeConvertModal = closeApproveModal;
 const updateStatus = (status, expected) => {
  if(active.status !== expected) { showToast('This action is unavailable for the current status.','error'); return; }
  setRequisitions(previous => previous.map(item => item.id === activeId ? {...item,status} : item));
  setModal(null); setDrawer(null); showToast(activeId + ' marked ' + status + '.');
 };
 const confirmApproval = () => updateStatus('Approved','Submitted');
 const confirmRejection = () => updateStatus('Rejected','Submitted');
 const confirmConversion = () => updateStatus('Converted','Approved');
 const saveRequest = status => {
  const qty = Number(fields.formQty);
  if(!fields.formRoleTitle.trim() || !Number.isInteger(qty) || qty < 1 || qty > 10) { showToast('Enter a role title and a headcount from 1 to 10.','error'); return; }
  const id = 'REQ-' + new Date().getFullYear() + '-' + (Math.max(159,...requisitions.map(item => Number(item.id.split('-').at(-1)))) + 1);
  setRequisitions(previous => [{id,role:fields.formRoleTitle.trim(),dept:fields.formDept,headcount:qty+' FTE',requestedBy:fields.formManager,budget:fields.formCtcMin+' - '+fields.formCtcMax,priority:fields.formPriority,status,date:new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Calcutta'}),justification:fields.formJustification},...previous]);
  setDrawer(null); resetFilters(); showToast(id + (status === 'Draft' ? ' saved as draft.' : ' submitted for approval.'));
 };
 const saveDraftReq = () => saveRequest('Draft');
 const submitNewReq = () => saveRequest('Submitted');
 const simState = state => {
  setDrawer(null); setModal(null);
  if(state === 'default') resetFilters();
  if(state === 'newReq') openNewReqDrawer();
  if(state === 'detailDrawer') openDetailDrawer();
  if(state === 'approveModal') promptApproveModal('REQ-2025-142');
  if(state === 'rejectModal') promptRejectModal('REQ-2025-142');
  if(state === 'convertModal') promptConvertModal('REQ-2025-145');
  if(state === 'emptyState') setFields(previous => ({...previous,searchInput:'xyznonexistent999'}));
  if(state === 'toastState') showToast('Draft requisition saved to this session.');
 };
 useEffect(() => {
  const id = modal ? modal + 'Modal' : drawer === 'new' ? 'newReqDrawer' : drawer === 'detail' ? 'detailDrawer' : null;
  if (!id) return;
  const previous = document.activeElement, dialog = document.getElementById(id);
  dialog.setAttribute('role','dialog'); dialog.setAttribute('aria-modal','true'); dialog.setAttribute('aria-label',modal ? modal + ' requisition' : drawer === 'new' ? 'New requisition' : 'Requisition details');
  const controls = () => [...dialog.querySelectorAll('button, input, select, textarea')].filter(el => !el.disabled);
  controls()[0]?.focus();
  const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
  const keydown = event => {
   if(event.key === 'Escape') { if(modal) setModal(null); else setDrawer(null); }
   if(event.key === 'Tab') { const items=controls(), first=items[0], last=items.at(-1); if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();} else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();} }
  };
  document.addEventListener('keydown',keydown);
  return () => { document.body.style.overflow=overflow; document.removeEventListener('keydown',keydown); previous?.focus(); };
 },[drawer,modal]);
 return (<><Sidebar activePage="headcount-requisitions" /><div className="pl-64"><Header /><main className="relative pt-16 bg-surface min-h-screen"><div className="flex flex-col w-full">

<div className="bg-surface-container-high px-margin py-space-sm flex flex-wrap items-center justify-between gap-space-sm shadow-sm sticky top-16 z-30">
<div className="flex items-center gap-space-xs">
<span className="material-symbols-outlined text-primary text-base">tune</span>
<span className="font-label-caps text-label-caps uppercase font-bold tracking-wider text-on-surface-variant">Live Simulator</span>
</div>
<div className="flex flex-wrap items-center gap-1.5">
<button className="px-2.5 py-1 rounded bg-surface text-on-surface font-label-md text-label-md hover:bg-primary hover:text-on-primary transition-colors shadow-sm" onClick={() => { simState('default') }}>1. Default Roster</button>
<button className="px-2.5 py-1 rounded bg-surface text-on-surface font-label-md text-label-md hover:bg-primary hover:text-on-primary transition-colors shadow-sm" onClick={() => { simState('newReq') }}>2. + New Req Drawer</button>
<button className="px-2.5 py-1 rounded bg-surface text-on-surface font-label-md text-label-md hover:bg-primary hover:text-on-primary transition-colors shadow-sm" onClick={() => { simState('detailDrawer') }}>3. Req Detail &amp; Timeline</button>
<button className="px-2.5 py-1 rounded bg-surface text-on-surface font-label-md text-label-md hover:bg-primary hover:text-on-primary transition-colors shadow-sm" onClick={() => { simState('approveModal') }}>4. Approve Modal</button>
<button className="px-2.5 py-1 rounded bg-surface text-on-surface font-label-md text-label-md hover:bg-primary hover:text-on-primary transition-colors shadow-sm" onClick={() => { simState('rejectModal') }}>5. Reject Modal</button>
<button className="px-2.5 py-1 rounded bg-surface text-on-surface font-label-md text-label-md hover:bg-primary hover:text-on-primary transition-colors shadow-sm" onClick={() => { simState('convertModal') }}>6. Convert to Job</button>
<button className="px-2.5 py-1 rounded bg-surface text-on-surface font-label-md text-label-md hover:bg-primary hover:text-on-primary transition-colors shadow-sm" onClick={() => { simState('emptyState') }}>7. Empty State</button>
<button className="px-2.5 py-1 rounded bg-surface text-on-surface font-label-md text-label-md hover:bg-primary hover:text-on-primary transition-colors shadow-sm" onClick={() => { simState('toastState') }}>8. Draft / Toast</button>
</div>
</div>
<div className="p-margin space-y-space-lg">

<div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
<div className="space-y-1">
<nav className="flex items-center gap-1.5 font-label-caps text-label-caps uppercase tracking-wider text-outline">
<span>Dashboard</span>
<span className="material-symbols-outlined text-xs">chevron_right</span>
<span>Hire &amp; Lifecycle</span>
<span className="material-symbols-outlined text-xs">chevron_right</span>
<span>Recruitment Hub</span>
<span className="material-symbols-outlined text-xs">chevron_right</span>
<span className="text-primary font-bold">Headcount Requisitions</span>
</nav>
<div className="flex items-center gap-space-md flex-wrap">
<h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Headcount Requisitions &amp; Budget Approvals</h1>
<div className="flex items-center gap-1.5 px-3 py-1 bg-surface-container rounded-full text-on-surface-variant font-label-md text-label-md">
<span className="material-symbols-outlined text-primary text-base">account_balance_wallet</span>
<span>FY25 CapEx Pool: <strong className="text-primary font-bold">₹14.80 Cr</strong> (64 Total Openings)</span>
</div>
</div>
</div>
<div className="flex items-center gap-space-sm shrink-0">
<button className="px-3.5 py-2 rounded-lg bg-surface-container text-on-surface font-label-lg text-label-lg hover:bg-surface-variant transition-colors flex items-center gap-2 shadow-sm" onClick={() => { showToast('Exporting headcount telemetry to CSV...', 'info') }}>
<span className="material-symbols-outlined text-lg">download</span>
<span>Export CSV</span>
</button>
<button className="px-3.5 py-2 rounded-lg bg-surface-container text-on-surface font-label-lg text-label-lg hover:bg-surface-variant transition-colors flex items-center gap-2 shadow-sm" onClick={() => { showToast('Column configuration view loaded', 'info') }}>
<span className="material-symbols-outlined text-lg">view_column</span>
<span>Columns</span>
</button>
<button className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg hover:bg-primary-container transition-all flex items-center gap-2 shadow-md hover:shadow-lg" onClick={() => { openNewReqDrawer() }}>
<span className="material-symbols-outlined text-lg">add</span>
<span>+ New Requisition</span>
</button>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between space-y-3">
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps uppercase text-outline">Total Requisitions</span>
<div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-lg">fact_check</span>
</div>
</div>
<div>
<div className="flex items-baseline gap-2">
<span className="font-display-sm text-display-sm font-bold text-on-surface">24</span>
<span className="font-body-sm text-body-sm text-outline">across 6 depts</span>
</div>
<div className="flex items-center gap-2 mt-2 pt-2 bg-surface-container-low px-2 py-1 rounded">
<span className="font-label-md text-label-md text-primary font-semibold">18 Active</span>
<span className="text-outline text-xs">•</span>
<span className="font-label-md text-label-md text-on-surface-variant font-medium">6 Converted</span>
</div>
</div>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between space-y-3">
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps uppercase text-outline">Submitted / In-Review</span>
<div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-secondary">
<span className="material-symbols-outlined text-lg">pending_actions</span>
</div>
</div>
<div>
<div className="flex items-baseline gap-2">
<span className="font-display-sm text-display-sm font-bold text-on-surface">7</span>
<span className="font-body-sm text-body-sm text-secondary font-medium">Avg TAT: 3.4d</span>
</div>
<div className="flex items-center gap-1.5 mt-2 text-primary font-label-md text-label-md">
<span className="material-symbols-outlined text-sm">trending_down</span>
<span>48h SLA compliant (92%)</span>
</div>
</div>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between space-y-3">
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps uppercase text-outline">Approved &amp; Pending Conversion</span>
<div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary-container">
<span className="material-symbols-outlined text-lg">verified</span>
</div>
</div>
<div>
<div className="flex items-baseline gap-2">
<span className="font-display-sm text-display-sm font-bold text-primary">5</span>
<span className="font-body-sm text-body-sm text-on-surface font-semibold">₹3.42 Cr Allocated</span>
</div>
<div className="w-full bg-surface-container h-1.5 rounded-full mt-3 overflow-hidden">
<div className="bg-primary h-full rounded-full" style={{width:"65%"}}></div>
</div>
</div>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between space-y-3">
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps uppercase text-outline">Budget Utilization</span>
<div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-tertiary">
<span className="material-symbols-outlined text-lg">pie_chart</span>
</div>
</div>
<div>
<div className="flex items-baseline gap-2">
<span className="font-display-sm text-display-sm font-bold text-on-surface">68.4%</span>
<span className="font-body-sm text-body-sm text-outline">₹10.12 / 14.8 Cr</span>
</div>
<div className="flex items-center justify-between mt-2 text-xs font-label-md text-outline">
<span>Remaining: ₹4.68 Cr</span>
<span className="text-primary font-bold">14 Openings left</span>
</div>
</div>
</div>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm space-y-space-md">

<div className="flex items-center gap-1 border-b border-surface-container pb-space-sm overflow-x-auto" id="statusTabs">
<button className={"tab-btn px-3.5 py-1.5 rounded-lg font-label-lg text-label-lg flex items-center gap-2" + (tab === 'ALL' ? ' bg-surface-container text-on-surface font-semibold' : '')} onClick={() => { filterByTab('ALL') }}>
<span>All Requisitions</span>
<span className="px-2 py-0.5 rounded-full text-label-caps font-label-caps bg-surface-variant font-bold">{requisitions.length}</span>
</button>
<button className={"tab-btn px-3.5 py-1.5 rounded-lg font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface flex items-center gap-2" + (tab === 'DRAFT' ? ' bg-surface-container text-on-surface font-semibold' : '')} onClick={() => { filterByTab('DRAFT') }}>
<span>Draft</span>
<span className="px-2 py-0.5 rounded-full text-label-caps font-label-caps bg-surface-container font-semibold">{requisitions.filter(item => item.status.toUpperCase() === 'DRAFT').length}</span>
</button>
<button className={"tab-btn px-3.5 py-1.5 rounded-lg font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface flex items-center gap-2" + (tab === 'SUBMITTED' ? ' bg-surface-container text-on-surface font-semibold' : '')} onClick={() => { filterByTab('SUBMITTED') }}>
<span>Submitted</span>
<span className="px-2 py-0.5 rounded-full text-label-caps font-label-caps bg-secondary-container text-on-secondary-container font-semibold">{requisitions.filter(item => item.status.toUpperCase() === 'SUBMITTED').length}</span>
</button>
<button className={"tab-btn px-3.5 py-1.5 rounded-lg font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface flex items-center gap-2" + (tab === 'APPROVED' ? ' bg-surface-container text-on-surface font-semibold' : '')} onClick={() => { filterByTab('APPROVED') }}>
<span>Approved</span>
<span className="px-2 py-0.5 rounded-full text-label-caps font-label-caps bg-primary-fixed text-on-primary-fixed-variant font-semibold">{requisitions.filter(item => item.status.toUpperCase() === 'APPROVED').length}</span>
</button>
<button className={"tab-btn px-3.5 py-1.5 rounded-lg font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface flex items-center gap-2" + (tab === 'REJECTED' ? ' bg-surface-container text-on-surface font-semibold' : '')} onClick={() => { filterByTab('REJECTED') }}>
<span>Rejected</span>
<span className="px-2 py-0.5 rounded-full text-label-caps font-label-caps bg-error-container text-on-error-container font-semibold">{requisitions.filter(item => item.status.toUpperCase() === 'REJECTED').length}</span>
</button>
<button className={"tab-btn px-3.5 py-1.5 rounded-lg font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface flex items-center gap-2" + (tab === 'CONVERTED' ? ' bg-surface-container text-on-surface font-semibold' : '')} onClick={() => { filterByTab('CONVERTED') }}>
<span>Converted</span>
<span className="px-2 py-0.5 rounded-full text-label-caps font-label-caps bg-surface-container text-on-surface-variant font-semibold">{requisitions.filter(item => item.status.toUpperCase() === 'CONVERTED').length}</span>
</button>
</div>

<div className="grid grid-cols-1 md:grid-cols-12 gap-space-sm items-center">
<div className="md:col-span-4 relative">
<span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-lg">search</span>
<input className="w-full pl-9 pr-4 py-2 bg-surface rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="searchInput"  placeholder="Search by Req ID, Role, Hiring Mgr..." type="text" value={fields.searchInput ?? ''} onChange={event => setFields(previous => ({...previous, searchInput: event.target.value}))} />
</div>
<div className="md:col-span-3">
<select className="w-full px-3 py-2 bg-surface rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="deptFilter"  value={fields.deptFilter ?? ''} onChange={event => setFields(previous => ({...previous, deptFilter: event.target.value}))}>
<option value="">All Departments</option>
<option value="Platform Engg">Platform Engg</option>
<option value="Cloud Inf">Cloud Inf</option>
<option value="Product">Product Management</option>
<option value="Sales">Sales &amp; Enterprise Growth</option>
<option value="Data Science">Data &amp; AI</option>
</select>
</div>
<div className="md:col-span-2">
<select className="w-full px-3 py-2 bg-surface rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="priorityFilter"  value={fields.priorityFilter ?? ''} onChange={event => setFields(previous => ({...previous, priorityFilter: event.target.value}))}>
<option value="">All Priorities</option>
<option value="P0 Critical">P0 Critical</option>
<option value="P1 High">P1 High</option>
<option value="P2 Normal">P2 Normal</option>
</select>
</div>
<div className="md:col-span-3 flex items-center justify-end gap-2">
<button className="px-3 py-2 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container font-label-md text-label-md flex items-center gap-1 transition-colors" onClick={() => { resetFilters() }}>
<span className="material-symbols-outlined text-sm">filter_alt_off</span>
<span>Reset Filters</span>
</button>
<div className="text-xs text-outline font-label-caps">HQ: Bengaluru</div>
</div>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden" id="tableContainer">
<div className="overflow-x-auto">
<table className="w-full text-left" id="reqTable">
<thead>
<tr className="bg-surface-container-low text-on-surface-variant font-label-caps text-label-caps uppercase tracking-wider">
<th className="px-space-md py-3 font-semibold">Req ID</th>
<th className="px-space-md py-3 font-semibold">Role Title</th>
<th className="px-space-md py-3 font-semibold">Dept &amp; Headcount</th>
<th className="px-space-md py-3 font-semibold">Requested By</th>
<th className="px-space-md py-3 font-semibold">Budget Band (CTC)</th>
<th className="px-space-md py-3 font-semibold">Priority</th>
<th className="px-space-md py-3 font-semibold">Status</th>
<th className="px-space-md py-3 font-semibold text-right">Quick Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-surface-container font-body-md text-body-md text-on-surface" id="reqTableBody">{pageItems.map(item => <RequisitionRow key={item.id} item={item} openDetailDrawer={openDetailDrawer} promptApproveModal={promptApproveModal} promptRejectModal={promptRejectModal} promptConvertModal={promptConvertModal} />)}</tbody>
</table>
</div>

<div className={"py-16 px-space-md text-center flex-col items-center justify-center space-y-4" + (filtered.length === 0 ? '' : ' hidden')} id="emptyContainer">
<div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-outline mx-auto">
<span className="material-symbols-outlined text-3xl">search_off</span>
</div>
<div className="space-y-1">
<h3 className="font-headline-sm text-headline-sm text-on-surface">No requisitions found matching filters</h3>
<p className="font-body-md text-body-md text-on-surface-variant max-w-md mx-auto">
            Try adjusting your search query, priority band, or department filters to locate approved or draft headcount slots.
          </p>
</div>
<button className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container shadow-sm inline-flex items-center gap-2" onClick={() => { resetFilters() }}>
<span className="material-symbols-outlined text-base">restart_alt</span>
<span>Reset All Filters</span>
</button>
</div>

<div className={"px-space-md py-3 bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-space-sm" + (filtered.length > 0 ? '' : ' hidden')} id="paginationFooter">
<div className="flex items-center gap-2 text-on-surface-variant font-label-md text-label-md">
<span id="pageSummary">{`Showing ${filtered.length ? (page - 1) * pageSize + 1 : 0}-${Math.min(page * pageSize, filtered.length)} of ${filtered.length} Requisitions`}</span>
<span className="text-outline">•</span>
<span className="flex items-center gap-1">
<span>Show:</span>
<select className="bg-surface rounded px-2 py-0.5 text-xs text-on-surface focus:outline-none" value={pageSize + " per page"} onChange={event => { setPageSize(parseInt(event.target.value)); setPage(1); }}>
<option>10 per page</option>
<option>20 per page</option>
<option>50 per page</option>
</select>
</span>
</div>
<div className="flex items-center gap-2"><button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1 rounded bg-surface disabled:opacity-40">Previous</button><span>{page} / {totalPages}</span><button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 rounded bg-surface disabled:opacity-40">Next</button></div>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 overflow-hidden" + (drawer === 'new' ? '' : ' hidden')} id="newReqDrawer">
<div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm transition-opacity" onClick={() => { closeNewReqDrawer() }}></div>
<div className="absolute inset-y-0 right-0 pl-10 max-w-full flex">
<div className="w-screen max-w-xl bg-surface-container-lowest shadow-2xl flex flex-col">

<div className="p-space-lg bg-surface-container-low flex items-center justify-between border-b border-surface-container">
<div>
<span className="font-label-caps text-label-caps uppercase text-primary font-bold">Headcount Creation Wizard</span>
<h2 className="font-headline-sm text-headline-sm text-on-surface">Raise New Headcount Requisition</h2>
</div>
<button className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors" onClick={() => { closeNewReqDrawer() }}>
<span className="material-symbols-outlined text-xl">close</span>
</button>
</div>

<div className="flex-1 overflow-y-auto p-space-lg space-y-space-md">
<div className="space-y-1">
<label className="font-label-caps text-label-caps uppercase font-semibold text-on-surface-variant">Role Title *</label>
<input className="w-full px-3 py-2 bg-surface rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="formRoleTitle" placeholder="e.g. Lead Distributed Systems Engineer" type="text" value={fields.formRoleTitle ?? ''} onChange={event => setFields(previous => ({...previous, formRoleTitle: event.target.value}))} />
</div>
<div className="grid grid-cols-2 gap-space-md">
<div className="space-y-1">
<label className="font-label-caps text-label-caps uppercase font-semibold text-on-surface-variant">Department *</label>
<select className="w-full px-3 py-2 bg-surface rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="formDept" value={fields.formDept ?? ''} onChange={event => setFields(previous => ({...previous, formDept: event.target.value}))}>
<option value="Platform Engg">Platform Engg</option>
<option value="Cloud Inf">Cloud Inf</option>
<option value="Product">Product</option>
<option value="Data Science">Data &amp; AI</option>
<option value="Sales">Sales</option>
</select>
</div>
<div className="space-y-1">
<label className="font-label-caps text-label-caps uppercase font-semibold text-on-surface-variant">Headcount Qty *</label>
<input className="w-full px-3 py-2 bg-surface rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="formQty" max="10" min="1" type="number" value={fields.formQty ?? ''} onChange={event => setFields(previous => ({...previous, formQty: event.target.value}))} />
</div>
</div>
<div className="grid grid-cols-2 gap-space-md">
<div className="space-y-1">
<label className="font-label-caps text-label-caps uppercase font-semibold text-on-surface-variant">Priority Tier *</label>
<select className="w-full px-3 py-2 bg-surface rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="formPriority" value={fields.formPriority ?? ''} onChange={event => setFields(previous => ({...previous, formPriority: event.target.value}))}>
<option value="P0 Critical">P0 Critical (Urgent Backfill / Scale)</option>
<option value="P1 High">P1 High (Sprint Critical)</option>
<option value="P2 Normal">P2 Normal (Planned FY25)</option>
</select>
</div>
<div className="space-y-1">
<label className="font-label-caps text-label-caps uppercase font-semibold text-on-surface-variant">Requisition Type</label>
<div className="flex items-center gap-2 pt-2">
<label className="inline-flex items-center gap-1.5 cursor-pointer text-xs">
<input defaultChecked className="text-primary focus:ring-primary" name="reqType" type="radio" defaultValue="new"/>
<span>New Headcount</span>
</label>
<label className="inline-flex items-center gap-1.5 cursor-pointer text-xs">
<input className="text-primary focus:ring-primary" name="reqType" type="radio" defaultValue="replacement"/>
<span>Replacement</span>
</label>
</div>
</div>
</div>
<div className="space-y-1">
<label className="font-label-caps text-label-caps uppercase font-semibold text-on-surface-variant">Budget CTC Range (Per Head / PA)</label>
<div className="grid grid-cols-2 gap-space-sm">
<input className="px-3 py-2 bg-surface rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="formCtcMin" placeholder="Min (₹ LPA)" type="text" value={fields.formCtcMin ?? ''} onChange={event => setFields(previous => ({...previous, formCtcMin: event.target.value}))} />
<input className="px-3 py-2 bg-surface rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="formCtcMax" placeholder="Max (₹ LPA)" type="text" value={fields.formCtcMax ?? ''} onChange={event => setFields(previous => ({...previous, formCtcMax: event.target.value}))} />
</div>
</div>
<div className="space-y-1">
<label className="font-label-caps text-label-caps uppercase font-semibold text-on-surface-variant">Hiring Manager Assignee *</label>
<select className="w-full px-3 py-2 bg-surface rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="formManager" value={fields.formManager ?? ''} onChange={event => setFields(previous => ({...previous, formManager: event.target.value}))}>
<option value="Arunachalam Murthy">Arunachalam Murthy (VP Platform)</option>
<option value="Vikramaditya Joshi">Vikramaditya Joshi (Dir Cloud)</option>
<option value="Priya Sharma">Priya Sharma (HR Director)</option>
<option value="Kavita Iyer">Kavita Iyer (Lead Principal)</option>
</select>
</div>
<div className="space-y-1">
<label className="font-label-caps text-label-caps uppercase font-semibold text-on-surface-variant">Business Case &amp; Justification *</label>
<textarea className="w-full px-3 py-2 bg-surface rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="formJustification" placeholder="Provide detail regarding workload surge, telemetry bottlenecks, or enterprise commitments..." rows="4"  value={fields.formJustification ?? ''} onChange={event => setFields(previous => ({...previous, formJustification: event.target.value}))} />
</div>
<div className="p-3 bg-surface-container rounded-lg flex items-start gap-3">
<span className="material-symbols-outlined text-primary text-xl mt-0.5">info</span>
<div className="text-xs text-on-surface-variant space-y-1">
<p className="font-semibold text-on-surface">CapEx Verification Workflow</p>
<p>Requisitions exceeding ₹50 LPA require dual approval from Head of Dept and Siddharth Verma (FP&amp;A Lead).</p>
</div>
</div>
</div>

<div className="p-space-lg bg-surface-container-low border-t border-surface-container flex items-center justify-between">
<button className="px-4 py-2 rounded-lg bg-surface hover:bg-surface-variant text-on-surface font-label-md text-label-md shadow-sm transition-colors" onClick={() => { saveDraftReq() }}>
            Save as Draft
          </button>
<div className="flex items-center gap-space-sm">
<button className="px-3 py-2 text-outline hover:text-on-surface font-label-md text-label-md" onClick={() => { closeNewReqDrawer() }}>Cancel</button>
<button className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-md transition-all" onClick={() => { submitNewReq() }}>
              Submit for Approval
            </button>
</div>
</div>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 overflow-hidden" + (drawer === 'detail' ? '' : ' hidden')} id="detailDrawer">
<div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm transition-opacity" onClick={() => { closeDetailDrawer() }}></div>
<div className="absolute inset-y-0 right-0 pl-10 max-w-full flex">
<div className="w-screen max-w-2xl bg-surface-container-lowest shadow-2xl flex flex-col">

<div className="p-space-lg bg-surface-container-low flex items-start justify-between border-b border-surface-container">
<div className="space-y-1">
<div className="flex items-center gap-2">
<span className="font-mono font-bold text-primary font-label-lg text-label-lg" id="dtlReqId">{active.id}</span>
<span className="px-2.5 py-0.5 rounded-full font-label-caps text-label-caps font-bold bg-error-container text-on-error-container" id="dtlPriorityPill">{active.priority}</span>
<span className="px-2.5 py-0.5 rounded-full font-label-caps text-label-caps font-bold bg-secondary-container text-on-secondary-container" id="dtlStatusPill">{active.status}</span>
</div>
<h2 className="font-headline-md text-headline-md text-on-surface" id="dtlRoleTitle">{active.role}</h2>
<p className="text-xs text-outline font-label-md" id="dtlDeptSub">{active.dept + ' ? ' + active.headcount}</p>
</div>
<button className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors" onClick={() => { closeDetailDrawer() }}>
<span className="material-symbols-outlined text-xl">close</span>
</button>
</div>

<div className="flex-1 overflow-y-auto p-space-lg space-y-space-lg">

<div className="grid grid-cols-3 gap-space-sm">
<div className="p-space-sm bg-surface-container-low rounded-lg">
<span className="text-xs uppercase font-label-caps text-outline">Requested Budget</span>
<p className="font-title-md text-title-md font-bold text-on-surface mt-0.5" id="dtlBudget">{active.budget}</p>
<span className="text-xs text-primary font-label-caps">CapEx Tier 1</span>
</div>
<div className="p-space-sm bg-surface-container-low rounded-lg">
<span className="text-xs uppercase font-label-caps text-outline">Requested By</span>
<p className="font-title-md text-title-md font-bold text-on-surface mt-0.5" id="dtlRequester">{active.requestedBy}</p>
<span className="text-xs text-outline font-label-caps">VP Engineering</span>
</div>
<div className="p-space-sm bg-surface-container-low rounded-lg">
<span className="text-xs uppercase font-label-caps text-outline">Date Raised</span>
<p className="font-title-md text-title-md font-bold text-on-surface mt-0.5" id="dtlDate">{active.date}</p>
<span className="text-xs text-outline font-label-caps">Bengaluru HQ</span>
</div>
</div>

<div className="space-y-2">
<h4 className="font-label-caps text-label-caps uppercase text-on-surface-variant font-bold tracking-wider">Business Case &amp; Strategic Justification</h4>
<div className="p-4 bg-surface-container-low rounded-lg text-sm text-on-surface leading-relaxed" id="dtlJustification">{active.justification}</div>
</div>

<div className="p-space-md bg-surface-container rounded-xl space-y-2">
<div className="flex items-center justify-between text-xs">
<span className="font-semibold text-on-surface">FY25 Platform Engineering Pool Impact</span>
<span className="font-bold text-primary">₹1.30 Cr / ₹3.80 Cr CapEx Committed</span>
</div>
<div className="w-full bg-surface-container-lowest h-2 rounded-full overflow-hidden">
<div className="bg-primary h-full rounded-full" style={{width:"74%"}}></div>
</div>
<div className="flex items-center justify-between text-xs text-outline">
<span>Pre-approval usage: 68%</span>
<span>Post-approval impact: 74.2%</span>
</div>
</div>

<div className="space-y-3">
<div className="flex items-center justify-between">
<h4 className="font-label-caps text-label-caps uppercase text-on-surface-variant font-bold tracking-wider">Multi-Tier Approval Timeline (Kinetic HRMS)</h4>
<span className="text-xs px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed-variant font-semibold">Tier 4 Workflow</span>
</div>
<div className="space-y-4 pl-2 relative before:absolute before:left-5 before:top-3 before:bottom-3 before:w-0.5 before:bg-surface-container">

<div className="flex items-start gap-4 relative">
<div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 z-10 shadow-sm">
<span className="material-symbols-outlined text-base">check</span>
</div>
<div className="flex-1 bg-surface-container-low p-3 rounded-lg flex items-center justify-between">
<div>
<p className="font-label-lg text-label-lg font-semibold text-on-surface">Step 1: Requisition Initiated</p>
<p className="text-xs text-outline">Arunachalam Murthy (VP Platform)</p>
</div>
<div className="text-right">
<span className="text-xs font-semibold text-primary">Completed</span>
<p className="text-xs text-outline">12 Feb 2025, 10:15 AM</p>
</div>
</div>
</div>

<div className="flex items-start gap-4 relative">
<div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 z-10 shadow-sm">
<span className="material-symbols-outlined text-base">check</span>
</div>
<div className="flex-1 bg-surface-container-low p-3 rounded-lg flex items-center justify-between">
<div>
<p className="font-label-lg text-label-lg font-semibold text-on-surface">Step 2: Head of Department Review</p>
<p className="text-xs text-outline">Raghavendra Rao (CTO)</p>
</div>
<div className="text-right">
<span className="text-xs font-semibold text-primary">Approved</span>
<p className="text-xs text-outline">14 Feb 2025, 02:40 PM</p>
</div>
</div>
</div>

<div className="flex items-start gap-4 relative">
<div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 z-10 shadow-sm">
<span className="material-symbols-outlined text-base">check</span>
</div>
<div className="flex-1 bg-surface-container-low p-3 rounded-lg flex items-center justify-between">
<div>
<p className="font-label-lg text-label-lg font-semibold text-on-surface">Step 3: Finance &amp; FP&amp;A Sign-off</p>
<p className="text-xs text-outline">Siddharth Verma (FP&amp;A Lead)</p>
</div>
<div className="text-right">
<span className="text-xs font-semibold text-primary">Approved</span>
<p className="text-xs text-outline">16 Feb 2025, 11:20 AM</p>
</div>
</div>
</div>

<div className="flex items-start gap-4 relative">
<div className="w-7 h-7 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center shrink-0 z-10 shadow-sm" id="timelineStep4Icon">
<span className="material-symbols-outlined text-base">hourglass_empty</span>
</div>
<div className="flex-1 bg-surface-container-low p-3 rounded-lg flex items-center justify-between" id="timelineStep4Box">
<div>
<p className="font-label-lg text-label-lg font-semibold text-on-surface">Step 4: HR Director Headcount Allocation</p>
<p className="text-xs text-outline">Priya Sharma (HR Director)</p>
</div>
<div className="text-right" id="timelineStep4Status"><span className="text-xs font-bold text-secondary">{active.status === "Submitted" ? "Awaiting Review" : active.status}</span></div>
</div>
</div>
</div>
</div>
</div>

<div className="p-space-lg bg-surface-container-low border-t border-surface-container flex items-center justify-between" id="drawerActionsBar">
<div className="flex items-center gap-2">
<button className="px-3 py-2 rounded-lg bg-error-container text-on-error-container font-label-md text-label-md hover:opacity-90 flex items-center gap-1.5 shadow-sm" disabled={active.status !== "Submitted"} onClick={() => { promptRejectModal() }}>
<span className="material-symbols-outlined text-base">cancel</span>
<span>Reject</span>
</button>
<button className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container flex items-center gap-1.5 shadow-sm" disabled={active.status !== "Submitted"} onClick={() => { promptApproveModal() }}>
<span className="material-symbols-outlined text-base">check_circle</span>
<span>Approve Requisition</span>
</button>
</div>
<button className="px-3.5 py-2 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-variant flex items-center gap-1.5 shadow-sm" disabled={active.status !== "Approved"} id="btnConvertDrawer" onClick={() => { promptConvertModal() }}>
<span className="material-symbols-outlined text-base">work_outline</span>
<span>Convert to Job</span>
</button>
</div>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 overflow-y-auto" + (modal === 'approve' ? '' : ' hidden')} id="approveModal">
<div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
<div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm transition-opacity" onClick={() => { closeApproveModal() }}></div>
<div className="inline-block bg-surface-container-lowest rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:max-w-lg w-full relative z-10 p-space-lg space-y-space-md">
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed-variant shrink-0">
<span className="material-symbols-outlined text-xl">verified_user</span>
</div>
<div>
<h3 className="font-headline-sm text-headline-sm text-on-surface">Approve Headcount Requisition</h3>
<p className="font-mono text-xs text-primary font-bold" id="approveModalReqId">{active.id}</p>
</div>
</div>
<p className="font-body-md text-body-md text-on-surface-variant">
          You are authorizing <strong>2 FTEs</strong> under the Platform Engineering budget pool. This will release <strong>₹1.30 Cr</strong> from FY25 unallocated CapEx.
        </p>
<div className="space-y-1">
<label className="font-label-caps text-label-caps uppercase font-semibold text-on-surface-variant">Approval Endorsement &amp; Notes</label>
<textarea className="w-full px-3 py-2 bg-surface rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="approveComment" placeholder="e.g. Cleared for fast-track recruitment. CTC allocation approved per FY25 band." rows="3"  value={fields.approveComment ?? ''} onChange={event => setFields(previous => ({...previous, approveComment: event.target.value}))} />
</div>
<div className="flex items-center justify-end gap-space-sm pt-2">
<button className="px-3.5 py-2 rounded-lg text-outline hover:text-on-surface font-label-md text-label-md" onClick={() => { closeApproveModal() }}>Cancel</button>
<button className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-md flex items-center gap-1.5" onClick={() => { confirmApproval() }}>
<span className="material-symbols-outlined text-base">check</span>
<span>Confirm Approval</span>
</button>
</div>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 overflow-y-auto" + (modal === 'reject' ? '' : ' hidden')} id="rejectModal">
<div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
<div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm transition-opacity" onClick={() => { closeRejectModal() }}></div>
<div className="inline-block bg-surface-container-lowest rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:max-w-lg w-full relative z-10 p-space-lg space-y-space-md">
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded-full bg-error-container flex items-center justify-center text-on-error-container shrink-0">
<span className="material-symbols-outlined text-xl">block</span>
</div>
<div>
<h3 className="font-headline-sm text-headline-sm text-on-surface">Reject Headcount Requisition</h3>
<p className="font-mono text-xs text-error font-bold" id="rejectModalReqId">{active.id}</p>
</div>
</div>
<p className="font-body-md text-body-md text-on-surface-variant">
          Provide a mandatory institutional rationale for declining this request. An automated telemetry alert will be forwarded to the Hiring Manager.
        </p>
<div className="space-y-1">
<label className="font-label-caps text-label-caps uppercase font-semibold text-on-surface-variant">Mandatory Rejection Reason *</label>
<select className="w-full px-3 py-2 bg-surface rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-error shadow-sm" id="rejectReason" value={fields.rejectReason ?? ''} onChange={event => setFields(previous => ({...previous, rejectReason: event.target.value}))}>
<option value="Budget Ceiling Exceeded">Budget Ceiling Exceeded for FY25</option>
<option value="Headcount Freeze">Quarterly Headcount Freeze in Effect</option>
<option value="Role Overlap">Role Overlap with Existing Cloud Inf Team</option>
<option value="Business Case Incomplete">Insufficient Strategic Justification</option>
</select>
</div>
<div className="space-y-1">
<label className="font-label-caps text-label-caps uppercase font-semibold text-on-surface-variant">Detailed Feedback / Guidance</label>
<textarea className="w-full px-3 py-2 bg-surface rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-error shadow-sm" id="rejectNotes" placeholder="Explain the decision or suggest alternatives..." rows="3"  value={fields.rejectNotes ?? ''} onChange={event => setFields(previous => ({...previous, rejectNotes: event.target.value}))} />
</div>
<div className="flex items-center justify-end gap-space-sm pt-2">
<button className="px-3.5 py-2 rounded-lg text-outline hover:text-on-surface font-label-md text-label-md" onClick={() => { closeRejectModal() }}>Dismiss</button>
<button className="px-4 py-2 rounded-lg bg-error hover:opacity-90 text-on-error font-label-md text-label-md shadow-md flex items-center gap-1.5" onClick={() => { confirmRejection() }}>
<span className="material-symbols-outlined text-base">close</span>
<span>Confirm Rejection</span>
</button>
</div>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 overflow-y-auto" + (modal === 'convert' ? '' : ' hidden')} id="convertModal">
<div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
<div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm transition-opacity" onClick={() => { closeConvertModal() }}></div>
<div className="inline-block bg-surface-container-lowest rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:max-w-md w-full relative z-10 p-space-lg space-y-space-md">
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container shrink-0">
<span className="material-symbols-outlined text-xl">hub</span>
</div>
<div>
<h3 className="font-headline-sm text-headline-sm text-on-surface">Convert into Active Job</h3>
<p className="font-mono text-xs text-secondary font-bold" id="convertModalReqId">{active.id}</p>
</div>
</div>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
          This action converts this approved headcount quota into an operational hiring campaign in the <strong>EMS Job Studio</strong> with pre-filled compensation and team hierarchies.
        </p>
<div className="p-3 bg-surface-container rounded-lg text-xs space-y-1">
<div className="flex justify-between">
<span className="text-outline">Assigned Recruiter:</span>
<span className="font-semibold text-on-surface">Priya Sharma</span>
</div>
<div className="flex justify-between">
<span className="text-outline">Target Sourcing Portal:</span>
<span className="font-semibold text-on-surface">LinkedIn + EMS Career Portal</span>
</div>
</div>
<div className="flex items-center justify-end gap-space-sm pt-2">
<button className="px-3.5 py-2 rounded-lg text-outline hover:text-on-surface font-label-md text-label-md" onClick={() => { closeConvertModal() }}>Cancel</button>
<button className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-md flex items-center gap-1.5" onClick={() => { confirmConversion() }}>
<span className="material-symbols-outlined text-base">rocket_launch</span>
<span>Convert &amp; Launch Job</span>
</button>
</div>
</div>
</div>
</div>

<div className={"fixed bottom-6 right-6 z-50 transform  transition-all duration-300 " + (toast.message ? ' translate-y-0 opacity-100' : ' translate-y-24 opacity-0 pointer-events-none')} id="toastNotification" role="status">
<div className="bg-inverse-surface text-inverse-on-surface px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 max-w-md pointer-events-auto">
<span className="material-symbols-outlined text-inverse-primary" id="toastIcon">check_circle</span>
<div className="flex-1">
<p className="font-label-lg text-label-lg font-semibold" id="toastTitle">{toast.type === 'error' ? 'Notice / Declined' : 'Operation Confirmed'}</p>
<p className="font-body-sm text-body-sm text-inverse-on-surface/80" id="toastMsg">{toast.message}</p>
</div>
<button className="text-inverse-on-surface/60 hover:text-inverse-on-surface" onClick={() => { hideToast() }}>
<span className="material-symbols-outlined text-base">close</span>
</button>
</div>
</div>
</div>
</main></div></>);
}
