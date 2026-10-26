import { useEffect, useRef, useState } from 'react';
import { Sidebar, Header } from './Layout.jsx';
import { initialResumeInbox } from './resumeInboxData.js';
import { initialMailboxConfig } from './mailboxConfigData.js';
import ResumeInboxRow from './ResumeInboxRow.jsx';
export default function ResumeInbox() {
 const [rows,setRows]=useState(initialResumeInbox);
 const [search,setSearch]=useState('');
 const [sourceFilter,setSourceFilter]=useState('all');
 const [statusFilter,setStatusFilter]=useState('all');
 const [selected,setSelected]=useState([]);
 const [view,setView]=useState('table');
 const [modal,setModal]=useState(null);
 const [drawer,setDrawer]=useState(false);
 const [assignmentIds,setAssignmentIds]=useState([]);
 const [requisition,setRequisition]=useState('REQ-2025-089');
 const [deleteId,setDeleteId]=useState(null);
 const [config,setConfig]=useState({...initialMailboxConfig,'cfg-interval':'Every 5 minutes'});
 const [savedConfig,setSavedConfig]=useState(null);
 const [connection,setConnection]=useState('unknown');
 const [lastSync,setLastSync]=useState('Sample data');
 const [assignedStage,setAssignedStage]=useState('Applied');
 const [assignmentNote,setAssignmentNote]=useState('');
 const [toast,setToast]=useState({message:'',icon:'check_circle'});
 const timer=useRef();const pollTimer=useRef();
 const queue=rows.filter(row=>!row.assigned&&!row.imported);
 const filtered=queue.filter(row=>(sourceFilter==='all'||row.source===sourceFilter)&&(statusFilter==='all'||row.status===statusFilter)&&[row.name,row.skills,row.role].some(value=>value.toLowerCase().includes(search.toLowerCase())));
 const deleteTarget=rows.find(row=>row.id===deleteId);
 const assignmentLabel=assignmentIds.length===1?rows.find(row=>row.id===assignmentIds[0])?.name:assignmentIds.length+' selected candidates';
 const triggerToast=(message,icon='check_circle')=>{clearTimeout(timer.current);setToast({message,icon});timer.current=setTimeout(()=>setToast({message:'',icon}),3800);};
 const toggleConfigDrawer=setDrawer;
 const closeAssignPopover=()=>setModal(null);
 const openAssignPopover=name=>{const row=rows.find(row=>row.name===name||row.id===name);if(!row)return;setAssignmentIds([row.id]);setModal('assign');};
 const confirmAssign=()=>{setRows(previous=>previous.map(row=>assignmentIds.includes(row.id)?{...row,assigned:requisition,stage:assignedStage,assignmentNote}:row));setSelected(previous=>previous.filter(id=>!assignmentIds.includes(id)));setModal(null);triggerToast('Assignment saved locally for '+assignmentIds.length+' candidate(s).');};
 const importCandidate=name=>{const row=rows.find(row=>row.name===name||row.id===name);if(!row)return;setRows(previous=>previous.map(item=>item.id===row.id?{...item,imported:true}:item));setSelected(previous=>previous.filter(id=>id!==row.id));triggerToast('Import recorded locally. ATS services are not connected.');};
 const retryParse=(name,id)=>{const row=rows.find(row=>row.id===id||row.id===name||row.name===name);if(!row)return;setRows(previous=>previous.map(item=>item.id===row.id?{...item,status:'parsed',score:'82%'}:item));triggerToast('Sample re-parse result applied: 82%. No OCR service was called.');};
 const openDeleteDialog=(name,id)=>{const row=rows.find(row=>row.id===id||row.id===name||row.name===name);if(!row)return;setDeleteId(row.id);setModal('delete');};
 const closeDeleteDialog=()=>{setModal(null);setDeleteId(null);};
 const confirmDelete=()=>{setRows(previous=>previous.filter(row=>row.id!==deleteId));setSelected(previous=>previous.filter(id=>id!==deleteId));closeDeleteDialog();triggerToast('Resume removed from this local inbox queue.');};
 const toggleSelected=id=>setSelected(previous=>previous.includes(id)?previous.filter(value=>value!==id):[...previous,id]);
 const toggleSelectAll=checked=>setSelected(checked?filtered.map(row=>row.id):[]);
 const bulkAssign=()=>{if(!selected.length){triggerToast('Select at least one candidate.','warning');return;}setAssignmentIds([...selected]);setModal('assign');};
 const resetFilters=()=>{setSearch('');setSourceFilter('all');setStatusFilter('all');setView('table');setSelected([]);};
 const triggerPoll=()=>{clearTimeout(pollTimer.current);setView('polling');pollTimer.current=setTimeout(()=>{setView('table');setLastSync('Preview refreshed');triggerToast('Local inbox preview refreshed. No mailbox was contacted.');},600);};
 const testConnection=()=>{setConnection('preview');triggerToast('Connection preview only. No IMAP handshake was performed.');};
 const saveMailboxConfig=()=>{if(!config['cfg-host'].trim()||!config['cfg-user'].trim()){triggerToast('Enter a mailbox host and user.','warning');return;}setSavedConfig({...config});setDrawer(false);triggerToast('Mailbox settings saved for this session only.');};
 const setSimState=state=>{clearTimeout(pollTimer.current);setModal(null);setDrawer(false);setView('table');if(state==='live')resetFilters();else if(state==='polling')setView('polling');else if(state==='empty')setView('empty');else if(state==='assign'&&queue.length)openAssignPopover(queue[0].id);else if(state==='delete'&&queue.length)openDeleteDialog(queue.at(-1).id);else if(['drawer','conn-ok','conn-err'].includes(state)){setDrawer(true);setConnection(state==='conn-ok'?'preview':state==='conn-err'?'error':'unknown');}};
 useEffect(()=>()=>{clearTimeout(timer.current);clearTimeout(pollTimer.current);},[]);
 useEffect(()=>{
  const id=modal==='assign'?'assign-popover':modal==='delete'?'delete-modal':drawer?'mailbox-drawer':null;if(!id)return;const dialog=document.getElementById(id),previous=document.activeElement;
  dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',id.replaceAll('-',' '));const controls=()=>[...dialog.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled);controls()[0]?.focus();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const keydown=event=>{if(event.key==='Escape'){setModal(null);setDrawer(false);}if(event.key==='Tab'){const items=controls(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};document.addEventListener('keydown',keydown);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keydown);previous?.focus();};
 },[modal,drawer]);
 return (<><Sidebar activePage="resume-inbox" /><div className="pl-64"><Header /><main className="relative pt-16 bg-surface min-h-screen"><div className="flex flex-col w-full">

<div className="bg-surface-container-low px-space-xl py-space-sm shadow-sm flex flex-wrap items-center justify-between gap-space-sm sticky top-16 z-30">
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-primary text-base">tune</span>
<span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant font-bold">Simulator Controls:</span>
</div>
<div className="flex flex-wrap items-center gap-1.5">
<button className="px-2.5 py-1 rounded font-label-md text-label-md bg-primary text-on-primary font-semibold shadow-sm transition-all" id="sim-btn-live" onClick={event=>{setSimState('live')}}>1. Live Inbox Table</button>
<button className="px-2.5 py-1 rounded font-label-md text-label-md bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-medium transition-all" id="sim-btn-polling" onClick={event=>{setSimState('polling')}}>2. Polling Loading</button>
<button className="px-2.5 py-1 rounded font-label-md text-label-md bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-medium transition-all" id="sim-btn-assign" onClick={event=>{setSimState('assign')}}>3. Assign to Job Popover</button>
<button className="px-2.5 py-1 rounded font-label-md text-label-md bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-medium transition-all" id="sim-btn-drawer" onClick={event=>{setSimState('drawer')}}>4. Mailbox Drawer</button>
<button className="px-2.5 py-1 rounded font-label-md text-label-md bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-medium transition-all" id="sim-btn-conn-ok" onClick={event=>{setSimState('conn-ok')}}>5. Connection OK</button>
<button className="px-2.5 py-1 rounded font-label-md text-label-md bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-medium transition-all" id="sim-btn-conn-err" onClick={event=>{setSimState('conn-err')}}>6. Connection Err</button>
<button className="px-2.5 py-1 rounded font-label-md text-label-md bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-medium transition-all" id="sim-btn-empty" onClick={event=>{setSimState('empty')}}>7. Empty State</button>
<button className="px-2.5 py-1 rounded font-label-md text-label-md bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-medium transition-all" id="sim-btn-delete" onClick={event=>{setSimState('delete')}}>8. Delete Dialog</button>
</div>
</div>
<div className="p-space-xl space-y-space-xl max-w-7xl mx-auto w-full">

<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-lg">
<div className="space-y-1">
<nav className="flex items-center gap-1.5 text-on-surface-variant font-label-md text-label-md">
<span>Dashboard</span>
<span className="material-symbols-outlined text-sm">chevron_right</span>
<span>Hire &amp; Lifecycle</span>
<span className="material-symbols-outlined text-sm">chevron_right</span>
<span>Recruitment Hub</span>
<span className="material-symbols-outlined text-sm">chevron_right</span>
<span className="text-primary font-semibold">Resume Inbox</span>
</nav>
<div className="flex items-center gap-3">
<h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Automated Resume Inbox &amp; AI Parsing Queue</h1><p className="text-body-sm text-secondary">Local sample inbox ? {savedConfig ? "Settings saved for this session" : "Mailbox not connected"}</p>
<span className="px-2 py-0.5 rounded-full font-label-caps text-label-caps uppercase bg-primary-container/20 text-primary font-bold">ATS v3.8</span>
</div>
<div className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant">
<span className="inline-block w-2.5 h-2.5 rounded-full bg-primary-container animate-pulse"></span>
<span className="font-medium text-on-surface">Mailbox IMAP Listener: Active</span>
<span>•</span>
<span>Last synced: <span id="sync-timer">{lastSync}</span></span>
<span>•</span>
<span className="text-primary font-semibold" id="queue-count-badge">{queue.length+' Unassigned Inbound Resumes'}</span>
</div>
</div>

<div className="flex items-center gap-space-sm flex-wrap">
<button className="inline-flex items-center gap-2 px-space-md h-10 rounded-lg bg-surface-container text-on-surface font-label-lg text-label-lg hover:bg-surface-container-high transition-all shadow-sm" id="poll-btn" onClick={event=>{triggerPoll()}}>
<span className="material-symbols-outlined text-base" id="poll-icon">sync</span>
<span id="poll-text">Poll Now</span>
</button>
<button className="inline-flex items-center gap-2 px-space-md h-10 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg hover:opacity-95 transition-all shadow-sm" onClick={event=>{toggleConfigDrawer(true)}}>
<span className="material-symbols-outlined text-base">settings_input_component</span>
<span>Configure Mailbox</span>
</button>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">

<div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between relative overflow-hidden">
<div className="flex items-start justify-between">
<div className="space-y-1">
<span className="font-label-caps text-label-caps uppercase tracking-wider text-outline font-semibold">Total Inbound Resumes</span>
<div className="flex items-baseline gap-2">
<span className="font-display-sm text-display-sm font-bold text-on-surface">148</span>
<span className="font-label-caps text-label-caps text-primary font-bold inline-flex items-center"><span className="material-symbols-outlined text-xs">trending_up</span>+18.4%</span>
</div>
</div>
<div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-xl">mark_email_read</span>
</div>
</div>
<div className="mt-space-md pt-2">
<span className="font-label-md text-label-md text-on-surface-variant">This Month (Mar 2025)</span>
</div>
</div>

<div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between relative overflow-hidden">
<div className="flex items-start justify-between">
<div className="space-y-1">
<span className="font-label-caps text-label-caps uppercase tracking-wider text-outline font-semibold">Unprocessed in Queue</span>
<div className="flex items-baseline gap-2">
<span className="font-display-sm text-display-sm font-bold text-on-surface" id="kpi-queue-count">{queue.length}</span>
<span className="font-label-caps text-label-caps text-secondary font-medium">Avg parse 1.8s</span>
</div>
</div>
<div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-secondary">
<span className="material-symbols-outlined text-xl">hourglass_top</span>
</div>
</div>
<div className="mt-space-md pt-2">
<div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
<div className="bg-primary h-full rounded-full" style={{"width":"35%"}}></div>
</div>
</div>
</div>

<div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between relative overflow-hidden">
<div className="flex items-start justify-between">
<div className="space-y-1">
<span className="font-label-caps text-label-caps uppercase tracking-wider text-outline font-semibold">High ATS Match (&gt;85%)</span>
<div className="flex items-baseline gap-2">
<span className="font-display-sm text-display-sm font-bold text-primary">34</span>
<span className="font-label-caps text-label-caps text-on-surface-variant">Candidates</span>
</div>
</div>
<div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-xl">verified</span>
</div>
</div>
<div className="mt-space-md pt-2">
<span className="font-label-md text-label-md text-on-surface-variant">Fast-track candidate ready</span>
</div>
</div>

<div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between relative overflow-hidden">
<div className="flex items-start justify-between">
<div className="space-y-1">
<span className="font-label-caps text-label-caps uppercase tracking-wider text-outline font-semibold">Auto-Import Efficacy</span>
<div className="flex items-baseline gap-2">
<span className="font-display-sm text-display-sm font-bold text-on-surface">91.4%</span>
<span className="font-label-caps text-label-caps text-primary font-bold">Healthy</span>
</div>
</div>
<div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-xl">auto_awesome</span>
</div>
</div>
<div className="mt-space-md pt-2">
<span className="font-label-md text-label-md text-on-surface-variant">Zero manual tagging errors</span>
</div>
</div>
</div>

<div className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm flex flex-wrap items-center justify-between gap-space-md">
<div className="flex items-center gap-space-sm flex-1 min-w-[280px]">
<div className="relative w-full max-w-md">
<span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-lg">search</span>
<input className="w-full pl-9 pr-4 py-2 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="inbox-search"  placeholder="Search by name, skill (Go, K8s), or employer..." type="text" aria-label="inbox-search" value={search} onChange={event=>{setSearch(event.target.value);setSelected([]);setView("table");}} />
</div>
</div>
<div className="flex items-center gap-space-sm flex-wrap">
<div className="flex items-center gap-1.5 bg-surface-container-low px-3 py-1.5 rounded-lg">
<span className="font-label-caps text-label-caps text-outline uppercase font-semibold">Source:</span>
<select className="bg-transparent font-label-md text-label-md text-on-surface focus:outline-none cursor-pointer" id="source-filter"  aria-label="source-filter" value={sourceFilter} onChange={event=>{setSourceFilter(event.target.value);setSelected([]);setView("table");}}>
<option value="all">All Channels</option>
<option value="email">Inbound Email</option>
<option value="linkedin">LinkedIn Direct</option>
<option value="portal">Careers Portal</option>
<option value="referral">Internal Referral</option>
</select>
</div>
<div className="flex items-center gap-1.5 bg-surface-container-low px-3 py-1.5 rounded-lg">
<span className="font-label-caps text-label-caps text-outline uppercase font-semibold">Parsing Status:</span>
<select className="bg-transparent font-label-md text-label-md text-on-surface focus:outline-none cursor-pointer" id="status-filter"  aria-label="status-filter" value={statusFilter} onChange={event=>{setStatusFilter(event.target.value);setSelected([]);setView("table");}}>
<option value="all">All Statuses</option>
<option value="parsed">Auto-Parsed</option>
<option value="review">Needs Review</option>
<option value="error">Parse Error</option>
</select>
</div>
<button className="p-2 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors" onClick={event=>{resetFilters()}} title="Reset Filters">
<span className="material-symbols-outlined text-lg">filter_alt_off</span>
</button>
</div>
</div>

<div className="relative min-h-[460px]">

<div className={"bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden" + (view==='table' ? '' : ' hidden')} id="view-inbox-table">

<div className="px-space-lg py-3 bg-surface-container-low flex items-center justify-between text-on-surface-variant font-label-md text-label-md">
<div className="flex items-center gap-3">
<input className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer" id="select-all" aria-label="Select all inbox resumes" checked={filtered.length>0&&filtered.every(row=>selected.includes(row.id))} onChange={event=>toggleSelectAll(event.target.checked)} type="checkbox"/>
<span id="selection-summary">{selected.length ? selected.length+' candidates selected for bulk operation' : 'Showing '+filtered.length+' resumes matching filters'}</span>
</div>
<div className="flex items-center gap-2">
<button className="px-2.5 py-1 rounded bg-surface text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors shadow-sm" onClick={event=>{bulkAssign()}}>Bulk Assign</button>
<button className="px-2.5 py-1 rounded bg-surface text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors shadow-sm" onClick={event=>{triggerToast('CSV export is a prototype; no file was generated.')}}>Export CSV</button>
</div>
</div>

<div className="overflow-x-auto">
<table className="w-full text-left border-collapse">
<thead>
<tr className="bg-surface-container-high/40 text-outline font-label-caps text-label-caps uppercase tracking-wider">
<th className="py-3 px-space-md w-10"></th>
<th className="py-3 px-space-md">Received</th>
<th className="py-3 px-space-md">Candidate Details</th>
<th className="py-3 px-space-md">Source Channel</th>
<th className="py-3 px-space-md">Inferred Role</th>
<th className="py-3 px-space-md">AI Match</th>
<th className="py-3 px-space-md">Parse Status</th>
<th className="py-3 px-space-md">Extracted Skills</th>
<th className="py-3 px-space-md text-right">Actions</th>
</tr>
</thead>
<tbody className="divide-y-0 text-body-md font-body-md text-on-surface" id="resume-table-body">{filtered.length===0&&<tr><td colSpan={9} className="p-12 text-center text-outline">No resumes match the current filters.</td></tr>}{filtered.map(row=><ResumeInboxRow key={row.id} row={row} selected={selected.includes(row.id)} toggleSelected={toggleSelected} onAssign={openAssignPopover} onImport={importCandidate} onRetry={retryParse} onDelete={openDeleteDialog}/>)}</tbody>
</table>
</div>

<div className="p-space-md bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-space-sm text-on-surface-variant font-label-md text-label-md">
<div>{filtered.length} matching sample resumes</div>
<span>All matching records displayed</span>
</div>
</div>

<div className={"absolute inset-0 bg-surface/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center p-space-xl z-20" + (view==='polling' ? '' : ' hidden')} id="view-polling-state">
<div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-space-md"></div>
<h3 className="font-headline-md text-headline-md text-on-surface font-bold">Mailbox Polling Preview</h3>
<p className="font-body-md text-body-md text-on-surface-variant mt-1 text-center max-w-md">Simulating the inbox refresh UI. No mailbox is contacted.</p>
<div className="mt-space-lg flex items-center gap-2 text-primary font-label-md text-label-md">
<span className="material-symbols-outlined text-base animate-pulse">downloading</span>
<span>Parsing incoming candidate attachments with Gemini ATS Engine</span>
</div>
</div>

<div className={"bg-surface-container-lowest rounded-xl shadow-sm p-space-xl text-center flex flex-col items-center justify-center min-h-[420px]" + (view==='empty' ? '' : ' hidden')} id="view-empty-state">
<div className="w-20 h-20 rounded-full bg-primary-container/10 flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-4xl">inbox</span>
</div>
<h3 className="font-headline-md text-headline-md text-on-surface font-bold">All caught up! Zero unassigned resumes in inbox</h3>
<p className="font-body-md text-body-md text-on-surface-variant max-w-md mt-1 mb-space-lg">
          The inbound IMAP queue is currently clear. Any new candidate application sent to careers@emscloud.internal will appear here in real-time.
        </p>
<div className="flex items-center gap-space-sm">
<button className="inline-flex items-center gap-2 px-space-md h-10 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg hover:opacity-90 shadow-sm transition-all" onClick={event=>{triggerPoll()}}>
<span className="material-symbols-outlined text-base">sync</span>
<span>Trigger Manual Poll</span>
</button>
<button className="px-space-md h-10 rounded-lg bg-surface-container text-on-surface font-label-lg text-label-lg hover:bg-surface-container-high transition-colors" onClick={event=>{setSimState('live')}}>
            Reset to Sample Resumes
          </button>
</div>
</div>
</div>
</div>

<div className={"fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" + (modal==='assign' ? '' : ' hidden')} id="assign-popover">
<div className="bg-surface-container-lowest rounded-xl shadow-xl max-w-lg w-full p-space-lg space-y-space-md relative animate-in fade-in zoom-in-95">
<div className="flex items-center justify-between pb-2 border-b-0">
<div className="flex items-center gap-2 text-primary">
<span className="material-symbols-outlined">assignment_ind</span>
<h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Assign to Active Requisition</h3>
</div>
<button className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors" onClick={event=>{closeAssignPopover()}}><span className="material-symbols-outlined">close</span></button>
</div>
<div className="space-y-space-sm">
<p className="font-body-md text-body-md text-on-surface-variant">
          Moving candidate <strong className="text-on-surface font-semibold" id="assign-candidate-name">Ananya Deshmukh</strong> directly into the ATS recruitment pipeline.
        </p>
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline font-semibold mb-1">Target Requisition</label>
<select className="w-full h-10 px-3 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary shadow-sm cursor-pointer" id="assign-requisition-select" aria-label="assign-requisition-select" value={requisition} onChange={event=>{setRequisition(event.target.value);}}>
<option value="REQ-2025-089">REQ-2025-089 • Lead Distributed Systems (Engineering • Bangalore)</option>
<option value="REQ-2025-072">REQ-2025-072 • Senior Backend Developer (Platform • Remote)</option>
<option value="REQ-2025-061">REQ-2025-061 • Cloud Systems Architect (Infrastructure • Hyderabad)</option>
<option value="REQ-2025-104">REQ-2025-104 • Fullstack Lead (Payments Experience • Mumbai)</option>
</select>
</div>
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline font-semibold mb-1">Pipeline Stage</label>
<div className="grid grid-cols-3 gap-2">
<label className="p-2.5 rounded-lg bg-surface-container-low flex flex-col items-center text-center cursor-pointer hover:bg-primary-container/10 transition-colors">
<input  className="text-primary mb-1" name="pipeline_stage" type="radio" checked={assignedStage==='Applied'} onChange={()=>setAssignedStage('Applied')} />
<span className="font-label-md text-label-md font-semibold text-on-surface">Screening</span>
<span className="font-label-caps text-label-caps text-outline">Recruiter call</span>
</label>
<label className="p-2.5 rounded-lg bg-surface-container-low flex flex-col items-center text-center cursor-pointer hover:bg-primary-container/10 transition-colors">
<input className="text-primary mb-1" name="pipeline_stage" type="radio" checked={assignedStage==='Screening'} onChange={()=>setAssignedStage('Screening')} />
<span className="font-label-md text-label-md font-semibold text-on-surface">Tech Interview</span>
<span className="font-label-caps text-label-caps text-outline">Round 1</span>
</label>
<label className="p-2.5 rounded-lg bg-surface-container-low flex flex-col items-center text-center cursor-pointer hover:bg-primary-container/10 transition-colors">
<input className="text-primary mb-1" name="pipeline_stage" type="radio" checked={assignedStage==='Interview'} onChange={()=>setAssignedStage('Interview')} />
<span className="font-label-md text-label-md font-semibold text-on-surface">Talent Pool</span>
<span className="font-label-caps text-label-caps text-outline">Future opening</span>
</label>
</div>
</div>
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline font-semibold mb-1">Recruiter Notes (Optional)</label>
<textarea className="w-full p-2.5 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" placeholder="e.g. Strong Golang and distributed locking background with high ATS confidence..." rows="2" aria-label="Assignment note" value={assignmentNote} onChange={event=>setAssignmentNote(event.target.value)} />
</div>
</div>
<div className="flex items-center justify-end gap-space-sm pt-space-sm">
<button className="px-space-md h-10 rounded-lg bg-surface-container text-on-surface font-label-lg text-label-lg hover:bg-surface-container-high transition-colors" onClick={event=>{closeAssignPopover()}}>Cancel</button>
<button className="px-space-md h-10 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg hover:opacity-90 shadow-sm transition-all flex items-center gap-1.5" onClick={event=>{confirmAssign()}}>
<span className="material-symbols-outlined text-base">check</span>
<span>Assign &amp; Notify Team</span>
</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 overflow-hidden transition-opacity duration-300" + (drawer ? '' : ' hidden')} id="mailbox-drawer">

<div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm pointer-events-auto" id="drawer-scrim" onClick={event=>{toggleConfigDrawer(false)}}></div>
<div className="fixed inset-y-0 right-0 max-w-md w-full bg-surface-container-lowest shadow-2xl flex flex-col justify-between transform  transition-transform duration-300 pointer-events-auto overflow-y-auto" id="drawer-panel">
<div className="p-space-lg space-y-space-md">

<div className="flex items-start justify-between pb-space-sm">
<div>
<div className="flex items-center gap-2 text-primary">
<span className="material-symbols-outlined">mark_email_unread</span>
<span className="font-label-caps text-label-caps uppercase tracking-wider font-bold">Mailbox Ingestion</span>
</div>
<h2 className="font-headline-md text-headline-md text-on-surface font-bold">IMAP / SMTP Configuration</h2>
<p className="font-body-sm text-body-sm text-on-surface-variant">Automate inbound ATS CV extraction from enterprise inbox</p>
</div>
<button className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors" onClick={event=>{toggleConfigDrawer(false)}}><span className="material-symbols-outlined">close</span></button>
</div>

<div className={"p-space-md rounded-lg bg-primary-fixed/30 text-on-primary-fixed-variant flex items-start gap-2.5" + (connection==='preview' ? '' : ' hidden')} id="conn-status-success">
<span className="material-symbols-outlined text-primary text-xl">check_circle</span>
<div className="text-xs">
<p className="font-bold">Sample Connection Preview</p>
<p>No mailbox connection was made. This is a local preview.</p>
</div>
</div>
<div className={"p-space-md rounded-lg bg-error-container text-on-error-container flex items-start gap-2.5" + (connection==='error' ? '' : ' hidden')} id="conn-status-error">
<span className="material-symbols-outlined text-error text-xl">report_problem</span>
<div className="text-xs">
<p className="font-bold">Connection Failed</p>
<p>Simulated connection error. No external mailbox request was made.</p>
</div>
</div>

<div className="space-y-space-sm">
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline font-semibold mb-1">Inbound IMAP Host</label>
<div className="relative">
<span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-lg">dns</span>
<input className="w-full pl-9 pr-3 h-10 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="cfg-host" type="text"  aria-label="cfg-host" value={config["cfg-host"]} onChange={event=>{setConfig(previous=>({...previous,["cfg-host"]:event.target.value}));}} />
</div>
</div>
<div className="grid grid-cols-2 gap-space-sm">
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline font-semibold mb-1">Port &amp; Security</label>
<input className="w-full px-3 h-10 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="cfg-port" type="text"  aria-label="cfg-port" value={config["cfg-port"]} onChange={event=>{setConfig(previous=>({...previous,["cfg-port"]:event.target.value}));}} />
</div>
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline font-semibold mb-1">Polling Interval</label>
<select className="w-full px-3 h-10 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary shadow-sm cursor-pointer" id="cfg-interval" aria-label="cfg-interval" value={config["cfg-interval"]} onChange={event=>{setConfig(previous=>({...previous,["cfg-interval"]:event.target.value}));}}>
<option>Every 2 minutes</option>
<option >Every 5 minutes</option>
<option>Every 15 minutes</option>
<option>Hourly</option>
</select>
</div>
</div>
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline font-semibold mb-1">Mailbox Username / Address</label>
<div className="relative">
<span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-lg">alternate_email</span>
<input className="w-full pl-9 pr-3 h-10 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="cfg-user" type="email"  aria-label="cfg-user" value={config["cfg-user"]} onChange={event=>{setConfig(previous=>({...previous,["cfg-user"]:event.target.value}));}} />
</div>
</div>
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline font-semibold mb-1">App Password / Vault Secret</label>
<div className="relative">
<span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-lg">key</span>
<input className="w-full pl-9 pr-3 h-10 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" type="password" placeholder="Credentials are not connected in this preview" readOnly/>
</div>
</div>
<div className="p-space-md rounded-lg bg-surface-container-low space-y-2">
<div className="flex items-center justify-between">
<div>
<p className="font-label-lg text-label-lg font-semibold text-on-surface">Auto-Parse Attachments</p>
<p className="font-label-md text-label-md text-on-surface-variant">Extract text &amp; skills from PDF/DOCX</p>
</div>
<input defaultChecked className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer" type="checkbox"/>
</div>
<div className="flex items-center justify-between pt-2">
<div>
<p className="font-label-lg text-label-lg font-semibold text-on-surface">Auto-Send Acknowledgment</p>
<p className="font-label-md text-label-md text-on-surface-variant">Send confirmation email to applicant</p>
</div>
<input defaultChecked className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer" type="checkbox"/>
</div>
</div>
<button className="w-full py-2.5 rounded-lg bg-surface-container text-on-surface font-label-lg text-label-lg hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2 shadow-sm" id="btn-test-conn" onClick={event=>{testConnection()}}>
<span className="material-symbols-outlined text-base">wifi_tethering</span>
<span id="test-conn-text">Preview Connection Test</span>
</button>
</div>
</div>

<div className="p-space-lg bg-surface-container-low flex items-center justify-end gap-space-sm border-t-0">
<button className="px-space-md h-10 rounded-lg bg-surface text-on-surface font-label-lg text-label-lg hover:bg-surface-container transition-colors shadow-sm" onClick={event=>{toggleConfigDrawer(false)}}>Cancel</button>
<button className="px-space-md h-10 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg hover:opacity-90 transition-all shadow-sm flex items-center gap-1.5" onClick={event=>{saveMailboxConfig()}}>
<span className="material-symbols-outlined text-base">save</span>
<span>Save Configuration</span>
</button>
</div>
</div>
</div>

<div className={"fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" + (modal==='delete' ? '' : ' hidden')} id="delete-modal">
<div className="bg-surface-container-lowest rounded-xl shadow-xl max-w-md w-full p-space-lg space-y-space-md animate-in fade-in zoom-in-95">
<div className="w-12 h-12 rounded-full bg-error-container text-error flex items-center justify-center">
<span className="material-symbols-outlined text-2xl">delete_forever</span>
</div>
<div>
<h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Discard Resume from Inbox?</h3>
<p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Are you sure you want to discard the parsed profile for <strong className="text-on-surface" id="delete-candidate-name">Candidate</strong>? This will purge the unassigned resume from the inbox queue.
        </p>
</div>
<div className="flex items-center justify-end gap-space-sm pt-space-xs">
<button className="px-space-md h-10 rounded-lg bg-surface-container text-on-surface font-label-lg text-label-lg hover:bg-surface-container-high transition-colors" onClick={event=>{closeDeleteDialog()}}>Cancel</button>
<button className="px-space-md h-10 rounded-lg bg-error text-on-error font-label-lg text-label-lg hover:opacity-90 shadow-sm transition-all flex items-center gap-1.5" onClick={event=>{confirmDelete()}}>
<span className="material-symbols-outlined text-base">delete</span>
<span>Confirm Discard</span>
</button>
</div>
</div>
</div>

<div className={"fixed bottom-6 right-6 z-50 transform  transition-all duration-300 flex items-center gap-3 px-space-md py-3 rounded-lg bg-inverse-surface text-inverse-on-surface shadow-xl" + (toast.message ? '' : ' translate-y-20 opacity-0 pointer-events-none')} id="toast" role="status">
<span className="material-symbols-outlined text-primary-fixed" id="toast-icon">{toast.icon}</span>
<span className="font-label-lg text-label-lg font-medium" id="toast-msg">{toast.message}</span>
</div>
</div>
</main></div></>);
}
