import { useEffect, useRef, useState } from 'react';
import { Sidebar, Header } from './Layout.jsx';
import { initialTickets } from './helpdeskData.js';
import TicketRow from './TicketRow.jsx';
const emptyDraft = () => ({category:'Payroll & Compensation',priority:'Medium',subject:'',description:'',attachments:[]});
export default function Helpdesk() {
 const [tickets,setTickets] = useState(initialTickets);
 const [search,setSearch] = useState('');
 const [filters,setFilters] = useState({status:'Status: All Statuses',priority:'Priority: All Priorities',category:'Category: All Categories'});
 const [mode,setMode] = useState('default');
 const [page,setPage] = useState(1);
 const [modal,setModal] = useState(null);
 const [drawer,setDrawer] = useState(false);
 const [activeId,setActiveId] = useState('#TK-4091');
 const [editing,setEditing] = useState({assignee:'Unassigned',priority:'Urgent',status:'Open'});
 const [draft,setDraft] = useState(emptyDraft);
 const [reply,setReply] = useState('');
 const [internal,setInternal] = useState(false);
 const [resolution,setResolution] = useState('');
 const [toast,setToast] = useState('');
 const timer = useRef();
 const active = tickets.find(ticket => ticket.id === activeId) || tickets[0];
 const filtered = mode === 'empty' ? [] : tickets.filter(ticket => [ticket.id,ticket.subject,ticket.employee].some(value => value.toLowerCase().includes(search.toLowerCase())) && (filters.status.startsWith('Status:') || ticket.status === filters.status) && (filters.priority.startsWith('Priority:') || ticket.priority === filters.priority) && (filters.category.startsWith('Category:') || ticket.category === filters.category));
 const totalPages = Math.max(1,Math.ceil(filtered.length / 4));
 const pageItems = filtered.slice((page-1)*4,page*4);
 useEffect(() => setPage(previous => Math.min(previous,totalPages)),[totalPages]);
 useEffect(() => () => clearTimeout(timer.current),[]);
 const showToast = message => { clearTimeout(timer.current); setToast(message); timer.current=setTimeout(() => setToast(''),3500); };
 const setFilter = (key,value) => { setFilters(previous => ({...previous,[key]:value})); setPage(1); setMode('default'); };
 const openCreateModal = () => setModal('create');
 const closeCreateModal = () => setModal(null);
 const openDrawer = (id = '#TK-4091') => { const ticket=tickets.find(item => item.id===id); if(!ticket)return; setActiveId(id); setEditing({assignee:ticket.assignee,priority:ticket.priority,status:ticket.status}); setReply(''); setInternal(false); setDrawer(true); };
 const closeDrawer = () => setDrawer(false);
 const resolveTicket = () => { setResolution(''); setModal('resolve'); };
 const closeResolutionModal = () => setModal(null);
 const changeTicket = patch => setTickets(previous => previous.map(ticket => ticket.id===activeId ? {...ticket,...patch,updated:'Just now'} : ticket));
 const updateTicket = () => { changeTicket(editing); showToast('Ticket parameters updated successfully.'); };
 const confirmResolution = () => {
  if(!resolution.trim()){showToast('Enter resolution notes before confirming.');return;}
  changeTicket({...editing,status:'Resolved',comments:[...active.comments,{author:'Priya Sharma',text:resolution.trim(),internal:false}]});
  setModal(null); setDrawer(false); showToast(active.id+' marked as resolved.');
 };
 const submitTicket = () => {
  if(!draft.subject.trim() || !draft.description.trim()){showToast('Enter a subject and description.');return;}
  const id='#TK-'+(Math.max(...tickets.map(ticket=>Number(ticket.id.split('-')[1])))+1);
  setTickets(previous => [{...draft,id,subject:draft.subject.trim(),description:draft.description.trim(),employee:'Priya Sharma',department:'Engineering',avatar:initialTickets[0].avatar,status:'Open',assignee:'Unassigned',updated:'Just now',comments:[]},...previous]);
  setDraft(emptyDraft()); setModal(null); resetFilters(); showToast('New ticket '+id+' created.');
 };
 const postComment = () => {
  if(!reply.trim())return;
  changeTicket({comments:[...active.comments,{author:'Priya Sharma',text:reply.trim(),internal}]});
  setReply(''); showToast(internal ? 'Internal note added.' : 'Reply posted to thread.');
 };
 const selectFiles = files => {
  const selected=[...files];
  if(selected.some(file => file.size > 25*1024*1024 || !/\.(pdf|png|jpe?g)$/i.test(file.name))){showToast('Choose PDF, PNG or JPG files up to 25MB each.');return;}
  setDraft(previous=>({...previous,attachments:[...previous.attachments,...selected.map(file=>file.name)]}));
 };
 const resetFilters = () => { setSearch('');setFilters({status:'Status: All Statuses',priority:'Priority: All Priorities',category:'Category: All Categories'});setMode('default');setPage(1); };
 const filterTable = type => { if(type==='sla'){showToast('Average response time is illustrative sample data.');return;}setFilter('status',({open:'Open',progress:'In Progress',resolved:'Resolved'})[type]); };
 const switchState = state => {
  setModal(null);setDrawer(false);
  if(state==='default')resetFilters();
  else if(state==='modal')openCreateModal();
  else if(state==='drawer'||state==='comment')openDrawer();
  else if(state==='filtered'){resetFilters();setFilter('status','Open');}
  else setMode(state);
 };
 useEffect(() => {
  const id=modal==='create'?'create-modal':modal==='resolve'?'resolution-modal':drawer?'ticket-drawer':null;
  if(!id)return;
  const dialog=document.getElementById(id),previous=document.activeElement;
  const controls=()=>[...dialog.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled);
  controls()[0]?.focus();
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const keydown=event=>{if(event.key==='Escape'){if(modal)setModal(null);else setDrawer(false);}if(event.key==='Tab'){const items=controls(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};
  document.addEventListener('keydown',keydown);
  return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keydown);previous?.focus();};
 },[modal,drawer]);
 return (<><Sidebar activePage="helpdesk" /><div className="pl-64"><Header /><main className="relative pt-16 bg-surface min-h-screen"><div className="flex flex-col w-full bg-surface min-h-screen text-on-surface">

<div className="bg-inverse-surface text-inverse-on-surface px-8 py-3 flex items-center justify-between sticky top-16 z-30 shadow-md">
<div className="flex items-center gap-3">
<span className="material-symbols-outlined text-primary-fixed-dim">tune</span>
<span className="font-label-caps text-label-caps uppercase tracking-wider text-inverse-on-surface/60">Simulator Rig:</span>
</div>
<div className="flex items-center gap-2 overflow-x-auto py-1">
<button className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md transition-all hover:opacity-90" onClick={() => { switchState('default') }}>1. Default Roster</button>
<button className="px-3 py-1.5 rounded-lg bg-inverse-primary text-on-primary-fixed font-label-md text-label-md transition-all hover:opacity-90" onClick={() => { switchState('modal') }}>2. Create Ticket Modal</button>
<button className="px-3 py-1.5 rounded-lg bg-inverse-primary text-on-primary-fixed font-label-md text-label-md transition-all hover:opacity-90" onClick={() => { switchState('drawer') }}>3. Ticket Detail Drawer</button>
<button className="px-3 py-1.5 rounded-lg bg-inverse-primary text-on-primary-fixed font-label-md text-label-md transition-all hover:opacity-90" onClick={() => { switchState('comment') }}>4. Add Comment</button>
<button className="px-3 py-1.5 rounded-lg bg-inverse-primary text-on-primary-fixed font-label-md text-label-md transition-all hover:opacity-90" onClick={() => { switchState('filtered') }}>5. Filtered View</button>
<button className="px-3 py-1.5 rounded-lg bg-inverse-primary text-on-primary-fixed font-label-md text-label-md transition-all hover:opacity-90" onClick={() => { switchState('empty') }}>6. Empty State</button>
<button className="px-3 py-1.5 rounded-lg bg-inverse-primary text-on-primary-fixed font-label-md text-label-md transition-all hover:opacity-90" onClick={() => { switchState('loading') }}>7. Loading Skeleton</button>
</div>
</div>
<div className="p-8 space-y-8 max-w-[1600px] mx-auto w-full" id="main-content-area">

<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
<div>
<h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Helpdesk &amp; Support Suite</h1>
<p className="font-body-md text-on-surface-variant mt-1">Manage internal employee grievances, IT requests, and payroll inquiries with full lifecycle tracking.</p>
</div>
<button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg font-semibold shadow-lg shadow-primary/20 hover:bg-primary-container transition-all" onClick={() => { openCreateModal() }}>
<span className="material-symbols-outlined text-xl">add</span>
        + Create Ticket
      </button>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
<div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] border border-outline-variant/30 cursor-pointer hover:border-primary transition-all group" onClick={() => { filterTable('open') }}>
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps uppercase text-outline tracking-wider">Open Tickets</span>
<div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-all">
<span className="material-symbols-outlined">report_problem</span>
</div>
</div>
<div className="mt-4 flex items-baseline gap-2">
<span className="font-display-sm text-display-sm font-bold text-on-surface">24</span>
<span className="font-label-md text-label-md text-error font-medium">+3 today</span>
</div>
</div>
<div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] border border-outline-variant/30 cursor-pointer hover:border-primary transition-all group" onClick={() => { filterTable('progress') }}>
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps uppercase text-outline tracking-wider">In Progress</span>
<div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-all">
<span className="material-symbols-outlined">hourglass_top</span>
</div>
</div>
<div className="mt-4 flex items-baseline gap-2">
<span className="font-display-sm text-display-sm font-bold text-on-surface">14</span>
<span className="font-label-md text-label-md text-on-surface-variant font-medium">Avg load normal</span>
</div>
</div>
<div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] border border-outline-variant/30 cursor-pointer hover:border-primary transition-all group" onClick={() => { filterTable('resolved') }}>
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps uppercase text-outline tracking-wider">Resolved</span>
<div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-all">
<span className="material-symbols-outlined">task_alt</span>
</div>
</div>
<div className="mt-4 flex items-baseline gap-2">
<span className="font-display-sm text-display-sm font-bold text-on-surface">142</span>
<span className="font-label-md text-label-md text-primary font-medium">98.2% SLA</span>
</div>
</div>
<div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] border border-outline-variant/30 cursor-pointer hover:border-primary transition-all group" onClick={() => { filterTable('sla') }}>
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps uppercase text-outline tracking-wider">Avg Response Time</span>
<div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-all">
<span className="material-symbols-outlined">timer</span>
</div>
</div>
<div className="mt-4 flex items-baseline gap-2">
<span className="font-display-sm text-display-sm font-bold text-on-surface">1.4h</span>
<span className="font-label-md text-label-md text-primary font-medium">-0.3h vs last wk</span>
</div>
</div>
</div>

<div className="bg-surface-container-lowest p-4 rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] flex flex-col lg:flex-row items-center justify-between gap-4">
<div className="relative w-full lg:w-96">
<span className="material-symbols-outlined absolute left-3.5 top-2.5 text-outline">search</span>
<input aria-label="Ticket input" className="w-full pl-11 pr-4 py-2 bg-surface-container-low rounded-xl font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary" value={search} onChange={event => { setSearch(event.target.value); setPage(1); setMode("default"); }} placeholder="Search tickets by ID, subject, or employee..." type="text"/>
</div>
<div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
<select aria-label="Filter status" className="px-4 py-2 bg-surface-container-low rounded-xl font-label-md text-label-md text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary" value={filters.status} onChange={event => setFilter("status", event.target.value)}>
<option>Status: All Statuses</option>
<option>Open</option>
<option>In Progress</option>
<option>Resolved</option>
</select>
<select aria-label="Filter priority" className="px-4 py-2 bg-surface-container-low rounded-xl font-label-md text-label-md text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary" value={filters.priority} onChange={event => setFilter("priority", event.target.value)}>
<option>Priority: All Priorities</option>
<option>Urgent</option>
<option>High</option>
<option>Medium</option>
<option>Low</option>
</select>
<select aria-label="Filter category" className="px-4 py-2 bg-surface-container-low rounded-xl font-label-md text-label-md text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary" value={filters.category} onChange={event => setFilter("category", event.target.value)}>
<option>Category: All Categories</option>
<option>Payroll &amp; Compensation</option>
<option>IT &amp; Hardware</option>
<option>Benefits &amp; Insurance</option>
<option>General HR</option>
</select>
</div>
</div>

<div className="bg-surface-container-lowest rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] overflow-hidden" id="table-container">
{mode === 'loading' ? <div role="status" aria-label="Loading tickets" className="p-8 space-y-4 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-12 bg-surface-container rounded" />)}</div> : filtered.length === 0 ? <div className="p-16 text-center space-y-4"><h3 className="text-headline-sm font-semibold">No Tickets Found</h3><p className="text-outline">There are no support tickets matching your filters.</p><button className="px-4 py-2 bg-primary text-on-primary rounded-xl" onClick={() => switchState('default')}>Reset Filters</button></div> : <><div className="overflow-x-auto">
<table className="w-full text-left border-collapse">
<thead>
<tr className="bg-surface-container-low border-b border-outline-variant/20 font-label-caps text-label-caps uppercase text-outline">
<th className="py-4 px-6">Ticket ID</th>
<th className="py-4 px-6">Employee</th>
<th className="py-4 px-6">Subject</th>
<th className="py-4 px-6">Category</th>
<th className="py-4 px-6">Priority</th>
<th className="py-4 px-6">Status</th>
<th className="py-4 px-6">Assigned To</th>
<th className="py-4 px-6 text-right">Updated</th>
</tr>
</thead>
<tbody className="divide-y divide-outline-variant/10 font-body-md text-on-surface" id="ticket-table-body">{pageItems.map(ticket => <TicketRow key={ticket.id} ticket={ticket} onOpen={openDrawer} />)}</tbody>
</table>
</div>

<div className="px-6 py-4 bg-surface-container-low/50 border-t border-outline-variant/20 flex items-center justify-between">
<p className="font-body-sm text-outline">Showing {filtered.length ? (page - 1) * 4 + 1 : 0}-{Math.min(page * 4,filtered.length)} of {filtered.length} tickets</p>
<div className="flex items-center gap-2">
<button className="px-3 py-1.5 rounded-lg border border-outline-variant/40 font-label-md text-label-md text-on-surface-variant hover:bg-surface disabled:opacity-50" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
<span className="px-3 py-1.5 font-label-md text-label-md font-semibold bg-primary text-on-primary rounded-lg">{page} of {totalPages}</span>
<button className="px-3 py-1.5 rounded-lg border border-outline-variant/40 font-label-md text-label-md text-on-surface-variant hover:bg-surface" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</button>
</div>
</div></>}
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 backdrop-blur-sm" + (modal === 'create' ? '' : ' hidden')} id="create-modal" role="dialog" aria-modal="true" aria-label="Create support ticket">
<div className="bg-surface-container-lowest w-full max-w-2xl rounded-3xl shadow-2xl p-8 transform transition-all relative">
<button className="absolute top-6 right-6 text-outline hover:text-on-surface" onClick={() => { closeCreateModal() }}>
<span className="material-symbols-outlined text-2xl">close</span>
</button>
<h2 className="font-headline-md text-headline-md font-bold text-on-surface">Create Support Ticket</h2>
<p className="font-body-sm text-outline mt-1">Submit a query or grievance directly to the HR &amp; IT operations team.</p>
<div className="mt-6 space-y-4">
<div className="grid grid-cols-2 gap-4">
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline mb-1.5">Category</label>
<select aria-label="Ticket category" className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary" value={draft.category} onChange={event => setDraft(previous => ({...previous, category: event.target.value}))}>
<option>Payroll &amp; Compensation</option>
<option>IT &amp; Hardware</option>
<option>Benefits &amp; Insurance</option>
<option>General HR</option>
</select>
</div>
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline mb-1.5">Priority</label>
<select aria-label="Ticket priority" className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary" value={draft.priority} onChange={event => setDraft(previous => ({...previous, priority: event.target.value}))}>
<option>Medium</option>
<option>Urgent</option>
<option>High</option>
<option>Low</option>
</select>
</div>
</div>
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline mb-1.5">Subject</label>
<input aria-label="Ticket input" className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary" value={draft.subject} onChange={event => setDraft(previous => ({...previous,subject:event.target.value}))} placeholder="Brief summary of the issue..." type="text"/>
</div>
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline mb-1.5">Description</label>
<textarea aria-label="Provide complete details, including relevant figures (e.g., INR amounts) or device IDs..." className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Provide complete details, including relevant figures (e.g., INR amounts) or device IDs..." rows="4" value={draft.description} onChange={event => setDraft(previous => ({...previous,description:event.target.value}))} />
</div>
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline mb-1.5">Attachments</label>
<label className="block border-2 border-dashed border-outline-variant rounded-2xl p-6 text-center" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); selectFiles(event.dataTransfer.files); }}><span className="block mb-3">Attach PDF, PNG or JPG files (up to 25MB each)</span><input aria-label="Ticket attachments" type="file" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={event => selectFiles(event.target.files)} /><span className="block text-body-sm mt-2">{draft.attachments.join(', ')}</span></label>
</div>
</div>
<div className="mt-8 flex items-center justify-end gap-3">
<button className="px-5 py-2.5 rounded-xl border border-outline-variant/40 font-label-lg text-label-lg text-on-surface-variant hover:bg-surface" onClick={() => { closeCreateModal() }}>Cancel</button>
<button className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg font-semibold shadow-lg shadow-primary/20 hover:bg-primary-container" onClick={() => { submitTicket() }}>Submit Ticket</button>
</div>
</div>
</div>

<div className={"fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-surface-container-lowest shadow-2xl flex flex-col transform transition-transform duration-300" + (drawer ? '' : ' hidden')} id="ticket-drawer" role="dialog" aria-modal="true" aria-label="Ticket details">
<div className="px-6 py-5 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low">
<div className="flex items-center gap-3">
<span className="font-headline-sm text-headline-sm font-bold text-primary">{active.id}</span>
<span className="px-2.5 py-1 rounded-full bg-error-container text-on-error-container font-label-md text-label-md font-semibold">{active.priority}</span>
<span className="px-2.5 py-1 rounded-full bg-[#FEF3C7] text-[#B45309] font-label-md text-label-md font-medium">{active.status}</span>
</div>
<button className="p-2 rounded-xl text-outline hover:text-on-surface hover:bg-surface" onClick={() => { closeDrawer() }}>
<span className="material-symbols-outlined text-xl">close</span>
</button>
</div>
<div className="flex-1 overflow-y-auto p-6 space-y-6">
<div>
<h2 className="font-headline-md text-headline-md font-bold text-on-surface">{active.subject}</h2>
<div className="flex items-center gap-4 mt-3 text-outline font-body-sm">
<span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">person</span> {active.employee} ({active.department})</span>
<span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">schedule</span> Updated {active.updated}</span>
</div>
</div>
<div className="bg-surface-container-low p-4 rounded-2xl space-y-4">
<div className="grid grid-cols-3 gap-4">
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline mb-1">Assignee</label>
<select aria-label="Ticket assignee" className="w-full px-3 py-2 bg-surface rounded-xl font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-primary" value={editing.assignee} onChange={event => setEditing(previous => ({...previous,assignee:event.target.value}))}>
<option>Unassigned</option>
<option>Amitabh Roy (Payroll)</option><option>Amitabh Roy</option>
<option>Priya Sharma</option>
<option>Neha Gupta</option>
</select>
</div>
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline mb-1">Priority</label>
<select aria-label="Ticket priority" className="w-full px-3 py-2 bg-surface rounded-xl font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-primary" value={editing.priority} onChange={event => setEditing(previous => ({...previous,priority:event.target.value}))}>
<option>Urgent</option>
<option>High</option>
<option>Medium</option>
<option>Low</option>
</select>
</div>
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline mb-1">Status</label>
<select aria-label="Ticket status" className="w-full px-3 py-2 bg-surface rounded-xl font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-primary" value={editing.status} onChange={event => setEditing(previous => ({...previous,status:event.target.value}))}>
<option>Open</option>
<option>In Progress</option>
<option>Resolved</option>
</select>
</div>
</div>
<div className="flex items-center justify-between pt-2">
<div className="flex items-center gap-2">
<input aria-label="Internal note" className="w-4 h-4 rounded text-primary focus:ring-primary" checked={internal} onChange={event => setInternal(event.target.checked)} id="internal-note" type="checkbox"/>
<label className="font-label-md text-label-md font-medium text-on-surface-variant" htmlFor="internal-note">Internal note (visible to staff only)</label>
</div>
<div className="flex items-center gap-2">
<button className="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary-container" onClick={() => { resolveTicket() }}>Resolve</button>
<button className="px-4 py-2 rounded-xl border border-outline-variant/40 font-label-md text-label-md font-semibold hover:bg-surface" onClick={() => { updateTicket() }}>Update</button>
</div>
</div>
</div>

<div className="space-y-4"><h3 className="text-headline-sm font-semibold">Activity &amp; Timeline</h3><p className="text-body-md text-on-surface-variant">{active.description}</p>{active.attachments.length > 0 && <p className="text-body-sm text-outline">Attachments: {active.attachments.join(', ')}</p>}{active.comments.map((comment,index) => <div key={index} className="bg-surface-container-low p-4 rounded-2xl"><p className="font-semibold">{comment.author} {comment.internal && <span className="text-secondary text-xs">Internal Note</span>}</p><p className="mt-2 whitespace-pre-wrap">{comment.text}</p></div>)}</div><div className="pt-4 border-t border-outline-variant/20 space-y-3" id="add-comment-section">
<label className="block font-label-caps text-label-caps uppercase text-outline">Add Reply or Note</label>
<textarea aria-label="Type your response here..." className="w-full px-4 py-3 bg-surface-container-low rounded-xl font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary" id="new-comment-text" placeholder="Type your response here..." rows="3" value={reply} onChange={event => setReply(event.target.value)} />
<div className="flex items-center justify-between">
<span className="text-body-sm text-outline">Replies are saved to this session.</span>
<button className="px-5 py-2 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary-container" onClick={() => { postComment() }}>Send Reply</button>
</div>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 backdrop-blur-sm" + (modal === 'resolve' ? '' : ' hidden')} id="resolution-modal" role="dialog" aria-modal="true" aria-label="Resolve ticket">
<div className="bg-surface-container-lowest w-full max-w-lg rounded-3xl shadow-2xl p-8 relative">
<h2 className="font-headline-md text-headline-md font-bold text-on-surface">Resolve Ticket {active.id}</h2>
<p className="font-body-sm text-outline mt-1">Provide resolution notes for the employee record.</p>
<div className="mt-4">
<textarea aria-label="Explain the fix or adjustment made..." className="w-full px-4 py-3 bg-surface-container-low rounded-xl font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Explain the fix or adjustment made..." rows="3" value={resolution} onChange={event => setResolution(event.target.value)} />
</div>
<div className="mt-6 flex items-center justify-end gap-3">
<button className="px-4 py-2 rounded-xl border border-outline-variant/40 font-label-md text-label-md" onClick={() => { closeResolutionModal() }}>Cancel</button>
<button className="px-5 py-2 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold" onClick={() => { confirmResolution() }}>Confirm Resolution</button>
</div>
</div>
</div>

<div className={"fixed bottom-8 right-8 z-50 transform  transition-all duration-300" + (toast ? '' : ' translate-y-20 opacity-0 pointer-events-none')} id="toast" role="status">
<div className="bg-primary text-on-primary px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3">
<span className="material-symbols-outlined text-2xl">check_circle</span>
<div>
<p className="font-label-lg font-semibold">Success</p>
<p className="font-body-sm text-on-primary/80" id="toast-msg">{toast}</p>
</div>
</div>
</div>
</div>
</main></div></>);
}
