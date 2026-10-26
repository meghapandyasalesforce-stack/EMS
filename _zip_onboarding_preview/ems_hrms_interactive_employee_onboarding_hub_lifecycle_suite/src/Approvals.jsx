import { useEffect, useRef, useState } from 'react';
import { Sidebar, Header } from './Layout.jsx';
import { initialApprovals } from './approvalData.js';
import ApprovalQueue from './ApprovalQueue.jsx';
export default function Approvals() {
 const [requests,setRequests]=useState(initialApprovals);
 const [search,setSearch]=useState('');
 const [department,setDepartment]=useState('All Departments');
 const [urgency,setUrgency]=useState('Urgency: All');
 const [comment,setComment]=useState('');
 const [tab,setTab]=useState('all');
 const [escalated,setEscalated]=useState(false);
 const [forceEmpty,setForceEmpty]=useState(false);
 const [selected,setSelected]=useState([]);
 const [drawer,setDrawer]=useState(false);
 const [activeId,setActiveId]=useState('REQ-8492');
 const [actionIds,setActionIds]=useState([]);
 const [modal,setModal]=useState(null);
 const [rejectReason,setRejectReason]=useState('');
 const [delegate,setDelegate]=useState('Sarah Jenkins (Director, People Ops)');
 const [inquiry,setInquiry]=useState('');
 const [toast,setToast]=useState({title:'',message:''});
 const timer=useRef();
 const active=requests.find(item=>item.id===activeId)||requests[0];
 const filtered=requests.filter(item=>item.status==='Pending'&&(department==='All Departments'||item.department===department)&&(urgency==='Urgency: All'||(urgency==='High Priority / Escalated'?item.sla==='Breached':item.sla!=='Breached'))&&[item.name,item.id,item.title].some(value=>value.toLowerCase().includes(search.toLowerCase()))&&(tab==='all'||item.category===tab)&&(!escalated||item.sla==='Breached'));
 const notify=(title,message)=>{clearTimeout(timer.current);setToast({title,message});timer.current=setTimeout(()=>setToast({title:'',message:''}),4000);};
 const closeModals=()=>setModal(null);
 const closeDetailPanel=()=>setDrawer(false);
 const openDetailPanel=(id='REQ-8492')=>{setActiveId(id);setSelected([]);setDrawer(true);};
 const setActiveTab=id=>{setTab(id);setSelected([]);setForceEmpty(false);};
 const toggleEscalatedFilter=()=>{setEscalated(previous=>!previous);setSelected([]);};
 const idsFor=id=>id?[id]:selected.length?selected:[activeId];
 const changeRequests=(ids,status,extra={})=>setRequests(previous=>previous.map(item=>ids.includes(item.id)?{...item,status,...extra}:item));
 const finish=(title,message)=>{setSelected([]);closeModals();closeDetailPanel();notify(title,message);};
 const triggerApprove=id=>{const ids=idsFor(id);changeRequests(ids,'Approved');finish('Request approved',ids.length+' request(s) approved in this session.');};
 const prompt=(kind,id)=>{const ids=idsFor(id);setActionIds(ids);if(id)setActiveId(id);setDrawer(false);setModal(kind);};
 const triggerReject=id=>prompt('reject-modal',id);
 const triggerDelegate=id=>prompt('delegate-modal',id);
 const triggerMoreInfo=id=>prompt('info-modal',id);
 const confirmReject=()=>{if(!rejectReason.trim()){notify('Reason required','Enter a rejection reason.');return;}changeRequests(actionIds,'Rejected',{rejectionReason:rejectReason.trim()});setRejectReason('');finish('Request rejected','Reason saved locally. No notification was sent.');};
 const confirmDelegate=()=>{changeRequests(actionIds,'Delegated',{delegate});finish('Task delegated','Delegate saved locally. No external task was sent.');};
 const confirmInfo=()=>{if(!inquiry.trim()){notify('Message required','Enter an inquiry message.');return;}changeRequests(actionIds,'Info Requested',{inquiry:inquiry.trim()});setInquiry('');finish('Information requested','Inquiry saved locally. No message was sent.');};
 const toggleSelected=id=>setSelected(previous=>previous.includes(id)?previous.filter(value=>value!==id):[...previous,id]);
 const toggleSelectAll=checked=>setSelected(checked?filtered.map(item=>item.id):[]);
 const closeBulkToolbar=()=>setSelected([]);
 const postComment=()=>{if(!comment.trim())return;setRequests(previous=>previous.map(item=>item.id===activeId?{...item,comments:[...(item.comments||[]),comment.trim()]}:item));setComment('');};
 const resetToLedger=()=>{setSearch('');setDepartment('All Departments');setUrgency('Urgency: All');setForceEmpty(false);setTab('all');setEscalated(false);setSelected([]);};
 const setSimulatorState=state=>{setSearch('');setDepartment('All Departments');setUrgency('Urgency: All');setTab('all');closeModals();closeDetailPanel();setSelected([]);setForceEmpty(false);setEscalated(false);if(state==='ledger')setTab('all');else if(state==='segments')setTab('tax');else if(state==='escalated'){setTab('all');setEscalated(true);}else if(state==='detail')openDetailPanel();else if(state==='toast')notify('Approval preview','Use a queue action to approve a request.');else if(state==='reject')triggerReject();else if(state==='delegate')triggerDelegate();else if(state==='info')triggerMoreInfo();else if(state==='bulk'){setTab('all');setSelected(requests.filter(item=>item.status==='Pending').slice(0,3).map(item=>item.id));}else if(state==='empty')setForceEmpty(true);};
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 useEffect(()=>{
  const id=modal||(drawer?'detail-panel':null);if(!id)return;
  const dialog=document.getElementById(id),previous=document.activeElement;
  dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',id.replaceAll('-',' '));
  const controls=()=>[...dialog.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled);controls()[0]?.focus();
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';const keydown=event=>{if(event.key==='Escape'){if(modal)closeModals();else closeDetailPanel();}if(event.key==='Tab'){const items=controls(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};
  document.addEventListener('keydown',keydown);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keydown);previous?.focus();};
 },[modal,drawer]);
 return (<><Sidebar activePage="approvals" /><div className="pl-64"><Header /><main className="relative pt-16 bg-surface min-h-[calc(100vh-4rem)] p-space-xl"><div className="flex flex-col w-full">

<div className="w-full bg-[#0E2B3D] text-white py-2 px-space-xl flex items-center justify-between text-label-md overflow-x-auto shadow-sm mb-space-lg">
<div className="flex items-center gap-space-xs font-label-caps tracking-wider text-[#6cdab3]">
<span className="material-symbols-outlined text-[16px]">tune</span>
<span>Simulator Rig:</span>
</div>
<div className="flex items-center gap-space-xs flex-wrap">
<button className="px-space-sm py-1 rounded bg-white/10 hover:bg-white/20 transition-all text-white font-label-md" onClick={()=>{setSimulatorState('ledger')}}>1. Ledger</button>
<button className="px-space-sm py-1 rounded bg-white/10 hover:bg-white/20 transition-all text-white font-label-md" onClick={()=>{setSimulatorState('segments')}}>2. Segments</button>
<button className="px-space-sm py-1 rounded bg-white/10 hover:bg-white/20 transition-all text-white font-label-md" onClick={()=>{setSimulatorState('escalated')}}>3. Escalated</button>
<button className="px-space-sm py-1 rounded bg-white/10 hover:bg-white/20 transition-all text-white font-label-md" onClick={()=>{setSimulatorState('detail')}}>4. Detail Panel</button>
<button className="px-space-sm py-1 rounded bg-white/10 hover:bg-white/20 transition-all text-white font-label-md" onClick={()=>{setSimulatorState('toast')}}>5. Toast</button>
<button className="px-space-sm py-1 rounded bg-white/10 hover:bg-white/20 transition-all text-white font-label-md" onClick={()=>{setSimulatorState('reject')}}>6. Reject Modal</button>
<button className="px-space-sm py-1 rounded bg-white/10 hover:bg-white/20 transition-all text-white font-label-md" onClick={()=>{setSimulatorState('delegate')}}>7. Delegate</button>
<button className="px-space-sm py-1 rounded bg-white/10 hover:bg-white/20 transition-all text-white font-label-md" onClick={()=>{setSimulatorState('info')}}>8. Info Modal</button>
<button className="px-space-sm py-1 rounded bg-white/10 hover:bg-white/20 transition-all text-white font-label-md" onClick={()=>{setSimulatorState('bulk')}}>9. Bulk Bar</button>
<button className="px-space-sm py-1 rounded bg-white/10 hover:bg-white/20 transition-all text-white font-label-md" onClick={()=>{setSimulatorState('empty')}}>10. Caught-up</button>
</div>
</div>

<div className="w-full flex flex-col gap-space-lg px-space-xl pb-space-xl">

<div className="flex items-start justify-between flex-wrap gap-space-md">
<div className="flex flex-col gap-space-xs">
<div className="flex items-center gap-space-sm">
<h1 className="font-headline-lg text-on-surface">Pending Approvals & Governance Suite</h1><p className="text-body-sm text-secondary">Sample approval queue ? {requests.filter(item=>item.status==="Pending").length} pending</p><button onClick={resetToLedger} className="mt-2 text-primary text-body-sm hover:underline">Show all request categories</button>
<span className="px-space-sm py-0.5 bg-error-container text-on-error-container font-label-md rounded-full font-bold flex items-center gap-1">
<span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
            42 Pending
          </span>
</div>
<p className="text-body-md text-on-surface-variant max-w-2xl">
          Review, audit, and orchestrate multi-tier organizational sign-offs across departmental hierarchies with real-time compliance tracking.
        </p>
</div>
<div className="flex items-center gap-space-sm">
<button className="h-10 px-space-md bg-surface-container-high text-on-surface font-label-lg rounded-lg hover:bg-surface-container-highest transition-all flex items-center gap-space-xs">
<span className="material-symbols-outlined text-[18px]">download</span>
          Export Audit Log
        </button>
<button className="h-10 px-space-md bg-primary text-on-primary font-label-lg rounded-lg hover:bg-primary-container transition-all flex items-center gap-space-xs">
<span className="material-symbols-outlined text-[18px]">done_all</span>
          Batch Approve All
        </button>
</div>
</div>

<div className={"w-full bg-[#FFE4E6] text-[#BE123C] p-space-md rounded-xl flex items-center justify-between shadow-sm" + (escalated ? ' ring-4 ring-[#BE123C]/30' : '')} id="escalated-banner">
<div className="flex items-center gap-space-md">
<span className="material-symbols-outlined text-[24px]">warning</span>
<div className="flex flex-col">
<span className="font-title-md">SLA Breached Governance Notice</span>
<span className="text-body-md">3 high-priority statutory sign-offs pending past SLA threshold requiring immediate override.</span>
</div>
</div>
<button className="h-9 px-space-md bg-[#BE123C] text-white font-label-lg rounded-lg hover:bg-[#9F1239] transition-all flex items-center gap-space-xs" onClick={()=>{toggleEscalatedFilter()}}>
<span className="material-symbols-outlined text-[16px]">filter_alt</span>
        View Escalated (3)
      </button>
</div>

<div className="flex items-center gap-space-sm border-b border-outline-variant/30 pb-space-xs overflow-x-auto">
<button className={"px-space-lg py-space-sm rounded-t-lg font-title-md transition-all flex items-center gap-space-xs whitespace-nowrap" + (tab==='leave' ? ' text-primary border-b-2 border-primary' : '')} id="tab-leave" onClick={()=>{setActiveTab('leave')}}>
<span>Leave</span>
<span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-body-sm font-bold">{requests.filter(item=>item.category==='leave'&&item.status==='Pending').length}</span>
</button>
<button className={"px-space-lg py-space-sm rounded-t-lg font-title-md text-on-surface-variant hover:text-on-surface transition-all flex items-center gap-space-xs whitespace-nowrap" + (tab==='regularization' ? ' text-primary border-b-2 border-primary' : '')} id="tab-regularization" onClick={()=>{setActiveTab('regularization')}}>
<span>Regularization</span>
<span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-body-sm font-bold">{requests.filter(item=>item.category==='regularization'&&item.status==='Pending').length}</span>
</button>
<button className={"px-space-lg py-space-sm rounded-t-lg font-title-md text-on-surface-variant hover:text-on-surface transition-all flex items-center gap-space-xs whitespace-nowrap" + (tab==='documents' ? ' text-primary border-b-2 border-primary' : '')} id="tab-documents" onClick={()=>{setActiveTab('documents')}}>
<span>Documents</span>
<span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-body-sm font-bold">{requests.filter(item=>item.category==='documents'&&item.status==='Pending').length}</span>
</button>
<button className={"px-space-lg py-space-sm rounded-t-lg font-title-md text-on-surface-variant hover:text-on-surface transition-all flex items-center gap-space-xs whitespace-nowrap" + (tab==='tax' ? ' text-primary border-b-2 border-primary' : '')} id="tab-tax" onClick={()=>{setActiveTab('tax')}}>
<span>Tax Regime</span>
<span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-body-sm font-bold">{requests.filter(item=>item.category==='tax'&&item.status==='Pending').length}</span>
</button>
<button className={"px-space-lg py-space-sm rounded-t-lg font-title-md text-on-surface-variant hover:text-on-surface transition-all flex items-center gap-space-xs whitespace-nowrap" + (tab==='other' ? ' text-primary border-b-2 border-primary' : '')} id="tab-other" onClick={()=>{setActiveTab('other')}}>
<span>Other</span>
<span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-body-sm font-bold">{requests.filter(item=>item.category==='other'&&item.status==='Pending').length}</span>
</button>
</div>

<div className="flex items-center justify-between gap-space-md flex-wrap">
<div className="flex items-center gap-space-md flex-1 min-w-[300px]">
<div className="relative w-full max-w-md">
<span className="absolute inset-y-0 left-0 flex items-center pl-space-md pointer-events-none text-on-surface-variant">
<span className="material-symbols-outlined text-[18px]">search</span>
</span>
<input className="w-full h-10 pl-10 pr-space-md bg-surface-container-low border border-outline-variant rounded-lg text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all" value={search} onChange={event=>{setSearch(event.target.value);setSelected([]);}} aria-label="Search approvals" placeholder="Search by requester name, ID, or request type..." type="text"/>
</div>
<select className="h-10 px-3 bg-surface-container-low rounded-lg" aria-label="Department filter" value={department} onChange={event=>{setDepartment(event.target.value);setSelected([]);}}>
<option>All Departments</option>
<option>Engineering</option><option>Core Infra</option><option>Accounting</option><option>Cloud Ops</option>
<option>Product & Design</option>
<option>Finance</option>
<option>Operations</option>
</select>
<select className="h-10 px-3 bg-surface-container-low rounded-lg" aria-label="Urgency filter" value={urgency} onChange={event=>{setUrgency(event.target.value);setSelected([]);}}>
<option>Urgency: All</option>
<option>High Priority / Escalated</option>
<option>Standard Priority</option>
</select>
</div>
<div className="flex items-center gap-space-sm text-body-md text-on-surface-variant">
<span>Showing 1-5 of 42 entries</span>
</div>
</div>

<div className={"w-full flex flex-col gap-space-md" + (!forceEmpty&&filtered.length>0 ? '' : ' hidden')} id="main-content-area"><ApprovalQueue rows={filtered} selected={selected} toggleSelected={toggleSelected} toggleSelectAll={toggleSelectAll} onOpen={openDetailPanel} onApprove={triggerApprove} onReject={triggerReject} onInfo={triggerMoreInfo} onDelegate={triggerDelegate} /></div>

<div className={"w-full bg-surface-container-lowest rounded-xl p-16 flex flex-col items-center justify-center text-center shadow-sm border border-outline-variant/20" + (forceEmpty||filtered.length===0 ? '' : ' hidden')} id="empty-state-area">
<div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-space-lg">
<span className="material-symbols-outlined text-[48px]">celebration</span>
</div>
<h2 className="font-headline-lg text-on-surface mb-space-xs">All caught up! Zero pending approvals in your queue</h2>
<p className="text-body-lg text-on-surface-variant max-w-md mb-space-xl">
        Amazing work! You've successfully cleared all pending employee requests, statutory sign-offs, and governance tasks. Enjoy the clear desk.
      </p>
<button className="h-10 px-space-xl bg-primary text-on-primary font-label-lg rounded-lg hover:bg-primary-container transition-all" onClick={()=>{resetToLedger()}}>
        Refresh Queue
      </button>
</div>
</div>

<div className={"fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0E2B3D] text-white px-space-xl py-space-md rounded-2xl shadow-xl z-50 flex items-center gap-space-xl border border-white/10 animate-bounce-short" + (selected.length>0 ? '' : ' hidden')} id="bulk-toolbar">
<div className="flex items-center gap-space-md">
<span className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-body-sm">{selected.length}</span>
<span className="font-title-md">Items Selected</span>
</div>
<div className="flex items-center gap-space-sm">
<button className="h-9 px-space-lg bg-primary text-white font-label-lg rounded-lg hover:bg-[#0B7458] transition-all flex items-center gap-space-xs" onClick={()=>{triggerApprove()}}>
<span className="material-symbols-outlined text-[18px]">done_all</span> Batch Approve ({selected.length})
      </button>
<button className="h-9 px-space-lg bg-error text-white font-label-lg rounded-lg hover:bg-[#BE123C] transition-all flex items-center gap-space-xs" onClick={()=>{triggerReject()}}>
<span className="material-symbols-outlined text-[18px]">close</span> Batch Reject
      </button>
<button className="h-9 px-space-md bg-white/10 text-white font-label-lg rounded-lg hover:bg-white/20 transition-all" onClick={()=>{closeBulkToolbar()}}>
        Cancel
      </button>
</div>
</div>

<div className={"fixed inset-y-0 right-0 w-full max-w-xl bg-surface-container-lowest shadow-2xl z-50 transform transition-transform duration-300 flex flex-col border-l border-outline-variant/20" + (drawer ? '' : ' hidden')} id="detail-panel"><div className="p-6 bg-surface-container-low flex justify-between items-center"><div><h3 className="text-title-md font-semibold">{active.name}</h3><p className="text-body-sm text-outline">{active.title} ? {active.id}</p></div><button onClick={closeDetailPanel} aria-label="Close request details"><span className="material-symbols-outlined">close</span></button></div><div className="flex-1 overflow-y-auto p-6 space-y-6"><h4 className="text-label-caps text-outline">REQUEST DETAILS</h4><dl className="bg-surface-container-low p-4 rounded-xl space-y-3"><div><dt className="text-body-sm text-outline">Role and department</dt><dd>{active.role} ? {active.department}</dd></div><div><dt className="text-body-sm text-outline">Request</dt><dd>{active.details}</dd></div><div><dt className="text-body-sm text-outline">Submitted</dt><dd>{active.submitted}</dd></div><div><dt className="text-body-sm text-outline">Status / SLA</dt><dd>{active.status} ? {active.sla}</dd></div></dl><h4 className="text-label-caps text-outline">SESSION AUDIT COMMENTS</h4>{(active.comments||[]).map((text,index)=><p key={index} className="p-3 bg-surface-container-low rounded">{text}</p>)}<div className="flex gap-2"><input aria-label="Audit comment" value={comment} onChange={event=>setComment(event.target.value)} placeholder="Add an audit comment..." className="flex-1 p-3 bg-surface-container-low rounded"/><button onClick={postComment} className="px-3 bg-secondary text-white rounded">Post</button></div></div><div className="p-6 bg-surface-container-low flex gap-2 justify-end"><button onClick={()=>triggerDelegate(active.id)} className="p-2 rounded bg-surface-container-high">Delegate</button><button onClick={()=>triggerReject(active.id)} className="p-2 rounded bg-error-container text-error">Reject</button><button onClick={()=>triggerApprove(active.id)} className="p-2 rounded bg-primary text-on-primary">Approve</button></div></div>

<div className={"fixed bottom-6 right-6 bg-[#0E2B3D] text-white px-space-lg py-space-md rounded-xl shadow-2xl z-50 flex items-center gap-space-md border border-white/10 transform  transition-all duration-300" + (toast.title ? '' : ' translate-y-24 opacity-0 pointer-events-none')} id="success-toast"><div role="status"><p className="font-title-md">{toast.title}</p><p className="text-body-sm text-slate-300">{toast.message}</p></div></div>

<div className={"fixed inset-0 bg-[#0E2B3D]/40 backdrop-blur-sm z-50 flex items-center justify-center p-space-md" + (modal==='reject-modal' ? '' : ' hidden')} id="reject-modal">
<div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl p-space-xl flex flex-col gap-space-lg border border-outline-variant/20 animate-scale-up">
<div className="flex items-center justify-between">
<div className="flex items-center gap-space-sm text-error">
<span className="material-symbols-outlined text-[28px]">warning</span>
<h3 className="font-headline-sm text-on-surface">Reject Request Confirmation</h3>
</div>
<button className="p-1 text-on-surface-variant hover:text-on-surface rounded-full" onClick={()=>{closeModals()}}>
<span className="material-symbols-outlined text-[20px]">close</span>
</button>
</div>
<p className="text-body-md text-on-surface-variant">
        Please provide a mandatory compliance justification or rejection reason for this request. The reason will be stored in this local session.
      </p>
<div className="flex flex-col gap-space-xs">
<label className="font-label-md text-on-surface">Rejection Reason *</label>
<textarea className="w-full p-space-md bg-surface-container-low border border-outline-variant rounded-lg text-body-md text-on-surface focus:outline-none focus:border-error" placeholder="Enter detailed reason for rejection..." rows="4" aria-label="Rejection reason" value={rejectReason} onChange={event=>setRejectReason(event.target.value)} />
</div>
<div className="flex items-center justify-end gap-space-sm pt-space-md">
<button className="h-10 px-space-md bg-surface-container-high text-on-surface font-label-lg rounded-lg hover:bg-surface-container-highest transition-all" onClick={()=>{closeModals()}}>Cancel</button>
<button className="h-10 px-space-lg bg-error text-white font-label-lg rounded-lg hover:bg-[#BE123C] transition-all" onClick={()=>{confirmReject()}}>Confirm Rejection</button>
</div>
</div>
</div>

<div className={"fixed inset-0 bg-[#0E2B3D]/40 backdrop-blur-sm z-50 flex items-center justify-center p-space-md" + (modal==='delegate-modal' ? '' : ' hidden')} id="delegate-modal">
<div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-2xl p-space-xl flex flex-col gap-space-lg border border-outline-variant/20">
<div className="flex items-center justify-between">
<h3 className="font-headline-sm text-on-surface">Delegate Approval Task</h3>
<button className="p-1 text-on-surface-variant hover:text-on-surface rounded-full" onClick={()=>{closeModals()}}>
<span className="material-symbols-outlined text-[20px]">close</span>
</button>
</div>
<p className="text-body-md text-on-surface-variant">
        Select a peer or secondary approver to temporarily handle this sign-off queue item.
      </p>
<div className="flex flex-col gap-space-xs">
<label className="font-label-md text-on-surface">Select Delegate User</label>
<select className="w-full h-10 px-3 bg-surface-container-low rounded-lg" aria-label="Delegate user" value={delegate} onChange={event=>setDelegate(event.target.value)}>
<option>Sarah Jenkins (Director, People Ops)</option>
<option>David Chen (Head of Engineering)</option>
<option>Elena Rostova (Compliance Officer)</option>
</select>
</div>
<div className="flex items-center justify-end gap-space-sm pt-space-md">
<button className="h-10 px-space-md bg-surface-container-high text-on-surface font-label-lg rounded-lg" onClick={()=>{closeModals()}}>Cancel</button>
<button className="h-10 px-space-lg bg-primary text-on-primary font-label-lg rounded-lg" onClick={()=>{confirmDelegate()}}>Delegate Task</button>
</div>
</div>
</div>

<div className={"fixed inset-0 bg-[#0E2B3D]/40 backdrop-blur-sm z-50 flex items-center justify-center p-space-md" + (modal==='info-modal' ? '' : ' hidden')} id="info-modal">
<div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl p-space-xl flex flex-col gap-space-lg border border-outline-variant/20">
<div className="flex items-center justify-between">
<h3 className="font-headline-sm text-on-surface">Request More Information</h3>
<button className="p-1 text-on-surface-variant hover:text-on-surface rounded-full" onClick={()=>{closeModals()}}>
<span className="material-symbols-outlined text-[20px]">close</span>
</button>
</div>
<p className="text-body-md text-on-surface-variant">
        Send an inquiry message back to the requester for further clarification before proceeding with sign-off.
      </p>
<div className="flex flex-col gap-space-xs">
<label className="font-label-md text-on-surface">Inquiry Message *</label>
<textarea className="w-full p-space-md bg-surface-container-low border border-outline-variant rounded-lg text-body-md text-on-surface focus:outline-none focus:border-primary" placeholder="Ask specific questions regarding documentation or dates..." rows="4" aria-label="Inquiry message" value={inquiry} onChange={event=>setInquiry(event.target.value)} />
</div>
<div className="flex items-center justify-end gap-space-sm pt-space-md">
<button className="h-10 px-space-md bg-surface-container-high text-on-surface font-label-lg rounded-lg" onClick={()=>{closeModals()}}>Cancel</button>
<button className="h-10 px-space-lg bg-primary text-on-primary font-label-lg rounded-lg" onClick={()=>{confirmInfo()}}>Send Inquiry</button>
</div>
</div>
</div>
</div>
</main></div></>);
}
