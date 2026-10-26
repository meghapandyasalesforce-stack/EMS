import { useEffect, useRef, useState } from 'react';
import { Sidebar, Header } from './Layout.jsx';
import { initialRegularizations } from './regularizationData.js';
import RegularizationRow from './RegularizationRow.jsx';
export default function AttendanceRegularization() {
 const [requests,setRequests]=useState(initialRegularizations);
 const [tab,setTab]=useState('reg');
 const [statusFilter,setStatusFilter]=useState('All Statuses');
 const [typeFilter,setTypeFilter]=useState('Type: All Requests');
 const [search,setSearch]=useState('');
 const [selected,setSelected]=useState([]);
 const [activeId,setActiveId]=useState(1);
 const [drawer,setDrawer]=useState(false);
 const [modal,setModal]=useState(false);
 const [rejectIds,setRejectIds]=useState([]);
 const [rejectReason,setRejectReason]=useState('');
 const [forceEmpty,setForceEmpty]=useState(false);
 const [highlight,setHighlight]=useState(false);
 const [toast,setToast]=useState({title:'',message:''});
 const timer=useRef();
 const active=requests.find(row=>row.id===activeId)||requests[0];
 const filtered=requests.filter(row=>(tab==='wfh'?row.type==='WFH Extension':row.type!=='WFH Extension')&&(statusFilter==='All Statuses'||row.status===statusFilter)&&(typeFilter==='Type: All Requests'||row.type===typeFilter)&&[row.name,row.employeeId,row.reason].some(value=>value.toLowerCase().includes(search.toLowerCase())));
 const eligible=filtered.filter(row=>row.ready&&row.status==='Pending');
 const notify=(title,message)=>{clearTimeout(timer.current);setToast({title,message});timer.current=setTimeout(()=>setToast({title:'',message:''}),3500);};
 const switchTab=value=>{setTab(value);setForceEmpty(false);setSelected([]);};
 const toggleDrawer=setDrawer;
 const openDetail=id=>{setActiveId(id);setSelected([]);setDrawer(true);};
 const toggleSelected=id=>{if(!eligible.some(row=>row.id===id))return;setSelected(previous=>previous.includes(id)?previous.filter(value=>value!==id):[...previous,id]);};
 const toggleAllCheckboxes=checked=>setSelected(checked?eligible.map(row=>row.id):[]);
 const approve=id=>{const ids=id?[id]:selected.length?selected:[activeId];setRequests(previous=>previous.map(row=>ids.includes(row.id)&&row.ready&&row.status==='Pending'?{...row,status:'Approved'}:row));setSelected([]);setDrawer(false);notify('Approval saved','Eligible request status updated locally. Payroll is not connected.');};
 const triggerToast=()=>approve();
 const openReject=id=>{const ids=id?[id]:selected.length?selected:[activeId];if(!ids.some(value=>requests.some(row=>row.id===value&&row.ready&&row.status==='Pending'))){notify('Action unavailable','This request is completed or awaiting manager sign-off.');return;}setRejectIds(ids);setModal(true);setDrawer(false);};
 const toggleModal=show=>{if(show)openReject();else setModal(false);};
 const submitReject=()=>{if(!rejectReason.trim()){notify('Reason required','Enter a rejection reason.');return;}setRequests(previous=>previous.map(row=>rejectIds.includes(row.id)&&row.ready&&row.status==='Pending'?{...row,status:'Rejected',rejectionReason:rejectReason.trim()}:row));setModal(false);setSelected([]);setRejectReason('');notify('Rejection saved','Reason recorded locally. No email was sent.');};
 const toggleBulkBar=show=>setSelected(show?eligible.map(row=>row.id):[]);
 const switchState=state=>{setForceEmpty(state==='empty');setHighlight(state==='not-turn');setSelected([]);setSearch('');setStatusFilter('All Statuses');setTypeFilter('Type: All Requests');setTab(state==='wfh'?'wfh':'reg');};
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 useEffect(()=>{
  const id=modal?'reject-modal':drawer?'detail-drawer':null;if(!id)return;const dialog=document.getElementById(id),previous=document.activeElement;
  dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',id.replaceAll('-',' '));const controls=()=>[...dialog.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled);controls()[0]?.focus();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const keydown=event=>{if(event.key==='Escape'){setModal(false);setDrawer(false);}if(event.key==='Tab'){const items=controls(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};document.addEventListener('keydown',keydown);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keydown);previous?.focus();};
 },[modal,drawer]);
 return (<><Sidebar activePage="attendance-regularization" /><div className="pl-64"><Header /><main className="relative pt-16 bg-surface min-h-[calc(100vh-4rem)] p-space-xl"><div className="flex flex-col w-full">

<div className="bg-surface-container-low px-space-xl py-space-sm flex items-center justify-between shadow-sm mb-space-lg rounded-xl overflow-x-auto">
<div className="flex items-center gap-space-xs text-on-surface-variant whitespace-nowrap">
<span className="material-symbols-outlined text-[16px] text-primary">science</span>
<span className="font-label-md">Simulator Rig:</span>
</div>
<div className="flex items-center gap-space-xs overflow-x-auto py-1">
<button className="px-space-md py-1 bg-primary text-on-primary rounded-full text-label-md font-label-md transition-all sim-pill" data-state="default" onClick={event=>{switchState('default')}}>1. Default</button>
<button className="px-space-md py-1 bg-surface-container-high text-on-surface rounded-full text-label-md font-label-md transition-all sim-pill" data-state="wfh" onClick={event=>{switchState('wfh')}}>2. WFH Tab</button>
<button className="px-space-md py-1 bg-surface-container-high text-on-surface rounded-full text-label-md font-label-md transition-all sim-pill" onClick={event=>{toggleDrawer(true)}}>3. Detail Drawer</button>
<button className="px-space-md py-1 bg-surface-container-high text-on-surface rounded-full text-label-md font-label-md transition-all sim-pill" onClick={event=>{triggerToast()}}>4. Approve Toast</button>
<button className="px-space-md py-1 bg-surface-container-high text-on-surface rounded-full text-label-md font-label-md transition-all sim-pill" onClick={event=>{toggleModal(true)}}>5. Reject Modal</button>
<button className="px-space-md py-1 bg-surface-container-high text-on-surface rounded-full text-label-md font-label-md transition-all sim-pill" onClick={event=>{toggleBulkBar(true)}}>6. Bulk Bar</button>
<button className="px-space-md py-1 bg-surface-container-high text-on-surface rounded-full text-label-md font-label-md transition-all sim-pill" data-state="not-turn" onClick={event=>{switchState('not-turn')}}>7. Not Your Turn</button>
<button className="px-space-md py-1 bg-surface-container-high text-on-surface rounded-full text-label-md font-label-md transition-all sim-pill" data-state="empty" onClick={event=>{switchState('empty')}}>8. Empty State</button>
</div>
</div>

<div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-xl">
<div>
<div className="flex items-center gap-space-sm mb-1">
<span className="font-label-caps text-primary bg-primary/10 px-2 py-0.5 rounded">Bengaluru HQ</span>
<span className="text-outline text-body-sm">•</span>
<span className="text-outline text-body-sm">Time &amp; Attendance Governance</span>
</div>
<h1 className="font-headline-lg text-on-surface">Attendance Regularization &amp; WFH Suite</h1>
<p className="text-on-surface-variant text-body-md mt-0.5">Manage employee punch regularizations, remote work extensions, and shift exceptions.</p>
</div>
<div className="flex items-center gap-space-md">
<button className="h-10 px-space-md bg-surface-container-high text-on-surface rounded-lg hover:bg-surface-container-highest transition-all flex items-center gap-space-xs font-label-lg">
<span className="material-symbols-outlined text-[18px]">download</span>Export CSV
      </button>
<button className="h-10 px-space-md bg-primary text-on-primary rounded-lg hover:bg-[#07523E] transition-all flex items-center gap-space-xs font-label-lg shadow-sm">
<span className="material-symbols-outlined text-[18px]">add</span>Request Regularization
      </button>
</div>
</div>

<div className="flex items-center gap-space-xl border-b border-outline-variant/30 mb-space-lg">
<button className={"pb-space-sm border-b-2 font-title-md flex items-center gap-space-xs transition-all" + (tab==='reg' ? ' border-primary text-primary' : ' border-transparent')} id="tab-reg" onClick={event=>{switchTab('reg')}}>
      Regularization <span className="px-2 py-0.5 bg-primary/15 text-primary text-label-md rounded-full">18</span>
</button>
<button className={"pb-space-sm border-b-2 text-on-surface-variant hover:text-on-surface font-title-md flex items-center gap-space-xs transition-all" + (tab==='wfh' ? ' border-primary text-primary' : ' border-transparent')} id="tab-wfh" onClick={event=>{switchTab('wfh')}}>
      WFH Requests <span className="px-2 py-0.5 bg-surface-container-high text-on-surface-variant text-label-md rounded-full">9</span>
</button>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm mb-space-lg flex flex-wrap items-center justify-between gap-space-md">
<div className="flex flex-wrap items-center gap-space-md flex-1">
<div className="relative min-w-[240px] flex-1">
<span className="absolute inset-y-0 left-0 flex items-center pl-space-md pointer-events-none text-outline">
<span className="material-symbols-outlined text-[18px]">search</span>
</span>
<input className="w-full h-10 pl-10 pr-space-md bg-surface-container-low border border-outline-variant/50 rounded-lg text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all" value={search} onChange={event=>{setSearch(event.target.value);setSelected([]);}} aria-label="Search attendance requests" placeholder="Search employee name, ID or reason..." type="text"/>
</div>
<div className="relative">
<select className="h-10 px-3 bg-surface-container-low rounded-lg" aria-label="statusFilter" value={statusFilter} onChange={event=>{setStatusFilter(event.target.value);setSelected([]);setForceEmpty(false);}}>{["All Statuses","Pending","Approved","Escalated","Rejected"].map(value=><option key={value}>{value}</option>)}</select>
</div>
<div className="relative">
<select className="h-10 px-space-md bg-surface-container-low border border-outline-variant/50 rounded-lg text-body-md text-on-surface focus:outline-none focus:border-primary" aria-label="typeFilter" value={typeFilter} onChange={event=>{setTypeFilter(event.target.value);setSelected([]);setForceEmpty(false);}}>
<option>Type: All Requests</option>
<option>Missed Punch</option>
<option>WFH Extension</option>
<option>Shift Correction</option>
</select>
</div>
<div className="relative">
<input className="h-10 px-space-md bg-surface-container-low border border-outline-variant/50 rounded-lg text-body-md text-on-surface focus:outline-none focus:border-primary" type="date" value="2023-10-01" readOnly aria-label="Sample period start"/>
</div>
</div>
<div>
<button className="h-10 px-space-md text-on-surface-variant hover:text-on-surface text-label-lg transition-colors flex items-center gap-space-xs">
<span className="material-symbols-outlined text-[18px]">restart_alt</span>Reset Filters
      </button>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden mb-space-lg" id="table-container">
<div className="overflow-x-auto">
<table className={"w-full text-left border-collapse" + (forceEmpty||filtered.length===0 ? " hidden" : "")}>
<thead>
<tr className="bg-surface-container-low border-b border-outline-variant/30 text-label-caps text-on-surface-variant">
<th className="p-space-md w-12 text-center">
<input className="w-4 h-4 rounded border-outline text-primary focus:ring-primary" aria-label="Select eligible requests" checked={eligible.length>0&&eligible.every(row=>selected.includes(row.id))} onChange={event=>toggleAllCheckboxes(event.target.checked)} type="checkbox"/>
</th>
<th className="p-space-md">Employee</th>
<th className="p-space-md">Request Type</th>
<th className="p-space-md">Original vs Requested</th>
<th className="p-space-md">Reason Excerpt</th>
<th className="p-space-md">Status</th>
<th className="p-space-md text-right">Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-outline-variant/20 text-body-md text-on-surface">{filtered.map(row=><RegularizationRow key={row.id} row={row} selected={selected.includes(row.id)} toggleSelected={toggleSelected} onApprove={approve} onReject={openReject} onOpen={openDetail} highlight={highlight}/>)}</tbody>
</table>
</div>

<div className={"flex flex-col items-center justify-center py-16 px-space-xl text-center" + (forceEmpty||filtered.length===0 ? '' : ' hidden')} id="empty-state">
<div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant mb-space-md">
<span className="material-symbols-outlined text-[32px]">inbox</span>
</div>
<h3 className="font-headline-sm text-on-surface mb-1">No Pending Requests Found</h3>
<p className="text-on-surface-variant text-body-md max-w-sm mb-space-lg">All regularization and WFH applications have been successfully processed for this filter set.</p>
<button className="h-10 px-space-lg bg-primary text-on-primary rounded-lg font-label-lg hover:bg-[#07523E] transition-all" onClick={event=>{switchState('default')}}>Clear Filters &amp; Reset</button>
</div>

<div className="px-space-lg py-space-md bg-surface-container-low border-t border-outline-variant/30 flex items-center justify-between">
<div className="text-body-sm text-outline">Showing {forceEmpty?0:filtered.length} sample requests</div>
<span className="text-body-sm text-outline">All matching records displayed</span>
</div>
</div>

<div className={"fixed bottom-8 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface px-space-xl py-space-md rounded-2xl shadow-2xl flex items-center gap-space-xl z-40 transition-all transform" + (selected.length ? ' !translate-y-0 !opacity-100 !pointer-events-auto' : ' hidden')} id="bulk-bar">
<div className="flex items-center gap-space-sm">
<span className="w-6 h-6 rounded-full bg-primary text-on-primary text-[12px] font-bold flex items-center justify-center" id="selected-count">{selected.length}</span>
<span className="font-title-md">Items Selected</span>
</div>
<div className="h-6 w-[1px] bg-slate-600"></div>
<div className="flex items-center gap-space-md">
<button className="h-9 px-space-md bg-primary text-on-primary rounded-lg font-label-lg hover:bg-primary-container transition-all flex items-center gap-space-xs" onClick={event=>{triggerToast(); toggleBulkBar(false);}}>
<span className="material-symbols-outlined text-[16px]">check</span>Approve Selected
      </button>
<button className="h-9 px-space-md bg-error text-on-error rounded-lg font-label-lg hover:bg-red-700 transition-all flex items-center gap-space-xs" onClick={event=>{toggleModal(true); toggleBulkBar(false);}}>
<span className="material-symbols-outlined text-[16px]">close</span>Reject Selected
      </button>
<button className="text-slate-400 hover:text-white p-1" onClick={event=>{toggleBulkBar(false)}}>
<span className="material-symbols-outlined text-[20px]">close</span>
</button>
</div>
</div>

<div className={"fixed inset-0 z-50 overflow-hidden" + (drawer ? '' : ' hidden')} id="detail-drawer"><div className="absolute inset-0 bg-[#0E2B3D]/40 backdrop-blur-sm" onClick={()=>toggleDrawer(false)}></div><div className="absolute right-0 inset-y-0 max-w-xl w-full bg-surface-container-lowest shadow-2xl flex flex-col"><div className="p-6 bg-surface-container-low flex justify-between"><div><h3 className="text-headline-sm">{active.name}</h3><p className="text-body-sm text-outline">{active.employeeId} · {active.department}</p></div><button aria-label="Close details" onClick={()=>toggleDrawer(false)}><span className="material-symbols-outlined">close</span></button></div><div className="flex-1 overflow-auto p-6 space-y-5"><h4 className="text-title-md font-semibold">{active.type}</h4><dl className="bg-surface-container-low rounded-xl p-4 space-y-3"><div><dt className="text-outline text-body-sm">Original</dt><dd>{active.original}</dd></div><div><dt className="text-outline text-body-sm">Requested</dt><dd>{active.requested}</dd></div><div><dt className="text-outline text-body-sm">Date</dt><dd>{active.date}</dd></div><div><dt className="text-outline text-body-sm">Reason</dt><dd>{active.reason}</dd></div><div><dt className="text-outline text-body-sm">Status</dt><dd>{active.status}</dd></div></dl><p className="text-body-sm text-outline">{active.ready?'Manager sign-off recorded in the supplied sample.':'Awaiting L1 Manager Sign-off first'}</p>{active.rejectionReason&&<p>Rejection reason: {active.rejectionReason}</p>}</div><div className="p-6 bg-surface-container-low flex justify-end gap-3"><button disabled={!active.ready||active.status!=='Pending'} onClick={()=>openReject(active.id)} className="p-2 bg-error-container text-error rounded disabled:opacity-40">Reject Request</button><button disabled={!active.ready||active.status!=='Pending'} onClick={()=>approve(active.id)} className="p-2 bg-primary text-on-primary rounded disabled:opacity-40">Approve Request</button></div></div></div>

<div className={"fixed inset-0 z-50 flex items-center justify-center" + (modal ? '' : ' hidden')} id="reject-modal">
<div className="absolute inset-0 bg-[#0E2B3D]/40 backdrop-blur-sm" onClick={event=>{toggleModal(false)}}></div>
<div className="bg-surface rounded-2xl shadow-2xl max-w-md w-full mx-space-md p-space-xl relative z-10">
<div className="flex items-center justify-between mb-space-md">
<h3 className="font-headline-sm text-on-surface">Reject Regularization Request</h3>
<button className="text-outline hover:text-on-surface" onClick={event=>{toggleModal(false)}}>
<span className="material-symbols-outlined text-[20px]">close</span>
</button>
</div>
<p className="text-on-surface-variant text-body-md mb-space-md">Please provide a mandatory justification note for rejecting this attendance adjustment. The reason is recorded in this local session.</p>
<div className="mb-space-lg">
<label className="block text-label-md font-label-md text-on-surface mb-space-xs">Rejection Reason <span className="text-error">*</span></label>
<textarea className="w-full p-space-md bg-surface-container-low border border-outline-variant/50 rounded-lg text-body-md text-on-surface focus:outline-none focus:border-error focus:ring-2 focus:ring-error/15 transition-all" id="reject-reason" placeholder="Enter clear explanation for audit compliance..." rows="4" aria-label="Rejection reason" value={rejectReason} onChange={event=>setRejectReason(event.target.value)} />
</div>
<div className="flex items-center justify-end gap-space-md">
<button className="h-10 px-space-md bg-surface-container-high text-on-surface rounded-lg hover:bg-outline-variant font-label-lg transition-all" onClick={event=>{toggleModal(false)}}>Cancel</button>
<button className="h-10 px-space-md bg-error text-on-error rounded-lg hover:bg-red-700 font-label-lg transition-all shadow-sm" onClick={event=>{submitReject()}}>Confirm Rejection</button>
</div>
</div>
</div>

<div className={"fixed top-20 right-8 bg-[#07523E] text-white px-space-lg py-space-md rounded-xl shadow-2xl flex items-center gap-space-md z-50 transition-all transform" + (toast.title ? '' : ' opacity-0 pointer-events-none')} id="toast-notification"><div role="status"><p className="font-semibold">{toast.title}</p><p className="text-body-sm">{toast.message}</p></div></div>
</div>
</main></div></>);
}
