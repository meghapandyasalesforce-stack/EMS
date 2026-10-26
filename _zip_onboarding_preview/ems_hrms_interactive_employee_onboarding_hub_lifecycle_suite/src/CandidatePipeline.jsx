import { useEffect, useRef, useState } from 'react';
import { Sidebar, Header } from './Layout.jsx';
import { initialPipeline } from './pipelineData.js';
import { initialPipelineFields } from './pipelineFields.js';
import { PipelineBoard, PipelineList } from './PipelineViews.jsx';
export default function CandidatePipeline() {
 const [candidates,setCandidates]=useState(initialPipeline);
 const [fields,setFields]=useState(initialPipelineFields);
 const [view,setView]=useState('board');
 const [selected,setSelected]=useState([]);
 const [activeId,setActiveId]=useState(1);
 const [drawer,setDrawer]=useState(false);
 const [modal,setModal]=useState(null);
 const [jobMenu,setJobMenu]=useState(false);
 const [jobTitle,setJobTitle]=useState('REQ-2025-089: Sr Backend Lead');
 const [loading,setLoading]=useState(false);
 const [emptyRejected,setEmptyRejected]=useState(false);
 const [dragDemo,setDragDemo]=useState(false);
 const [bulkStage,setBulkStage]=useState('');
 const [search,setSearch]=useState('');
 const [resume,setResume]=useState('');
 const [toast,setToast]=useState('');
 const timer=useRef();
 const active=candidates.find(item=>item.id===activeId)||candidates[0];
 const job=jobTitle.split(':')[0];
 const filtered=candidates.filter(item=>item.job===job&&[item.name,item.role,item.company].some(value=>value.toLowerCase().includes(search.toLowerCase())));
 const setField=(key,value)=>setFields(previous=>({...previous,[key]:value}));
 const showToast=message=>{clearTimeout(timer.current);setToast(message);timer.current=setTimeout(()=>setToast(''),3500);};
 const switchMainView=value=>{setView(value);setLoading(false);};
 const toggleDragState=()=>setDragDemo(previous=>!previous);
 const toggleDrawer=setDrawer;
 const openCandidate=id=>{setActiveId(id);setDrawer(true);setSelected([]);};
 const toggleBulkDock=()=>setSelected(previous=>previous.length?[]:filtered.slice(0,3).map(item=>item.id));
 const clearBulkSelection=()=>setSelected([]);
 const toggleSelected=id=>setSelected(previous=>previous.includes(id)?previous.filter(value=>value!==id):[...previous,id]);
 const toggleSelectAllRows=checked=>setSelected(checked?filtered.map(item=>item.id):[]);
 const moveCandidate=(id,stage)=>setCandidates(previous=>previous.map(item=>item.id===id?{...item,stage}:item));
 const applyBulkAction=()=>{if(!bulkStage){showToast('Choose a stage before applying.');return;}const stage=bulkStage[0].toUpperCase()+bulkStage.slice(1);setCandidates(previous=>previous.map(item=>selected.includes(item.id)?{...item,stage}:item));clearBulkSelection();showToast('Selected candidates moved to '+stage+'.');};
 const toggleJobFilterDropdown=()=>setJobMenu(previous=>!previous);
 const selectJob=title=>{setJobTitle(title);setJobMenu(false);setSelected([]);};
 const openModal=setModal;
 const closeModal=()=>setModal(null);
 const toggleEmptyState=()=>setEmptyRejected(previous=>!previous);
 const toggleSkeletonLoading=()=>setLoading(previous=>!previous);
 const confirmSchedule=()=>{if(!fields.date){showToast('Choose an interview date.');return;}setCandidates(previous=>previous.map(item=>item.id===activeId?{...item,stage:'Interview',interview:{date:fields.date,slot:fields.slot,round:fields.round}}:item));closeModal();showToast('Interview preview saved for '+active.name+'. No invite was sent.');};
 const confirmRejection=()=>{const ids=selected.length?selected:[activeId];setCandidates(previous=>previous.map(item=>ids.includes(item.id)?{...item,stage:'Rejected',rejectionReason:fields.rejectReason,rejectionNotes:fields.rejectNotes}:item));clearBulkSelection();closeModal();showToast('Candidate status updated locally. No email was sent.');};
 const saveNewCandidate=()=>{
  if(!fields.firstName.trim()||!fields.lastName.trim()||!/^\S+@\S+\.\S+$/.test(fields.email)){showToast('Enter first name, last name, and a valid email.');return;}
  const item={id:Math.max(...candidates.map(item=>item.id))+1,name:fields.firstName.trim()+' '+fields.lastName.trim(),role:'Candidate',company:'Not provided',email:fields.email,phone:fields.phone,experience:fields.experience||'Not provided',notice:fields.notice,stage:fields.stage,match:'Not scored',currentCtc:'Not provided',targetCtc:'Not provided',job,resume};
  setCandidates(previous=>[...previous,item]);closeModal();setField('firstName','');setField('lastName','');setField('email','');setResume('');showToast('Candidate added locally. Resume parsing is not connected.');
 };
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 useEffect(()=>{
  const id=modal||(drawer?'quick-drawer':null);if(!id)return;const dialog=document.getElementById(id),previous=document.activeElement;
  dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',id.replaceAll('-',' '));
  const controls=()=>[...dialog.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled);controls()[0]?.focus();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const keydown=event=>{if(event.key==='Escape'){if(modal)setModal(null);else setDrawer(false);}if(event.key==='Tab'){const items=controls(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};
  document.addEventListener('keydown',keydown);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keydown);previous?.focus();};
 },[modal,drawer]);
 return (<><Sidebar activePage="candidate-pipeline" /><div className="pl-64"><Header /><main className="relative pt-16 bg-surface min-h-screen"><div className="flex flex-col w-full">

<aside aria-label="Interactive Simulator Rig" className="w-full bg-[#0E2B3D] text-white px-space-xl py-space-sm shadow-md">
<div className="flex flex-wrap items-center justify-between gap-space-sm">
<div className="flex items-center gap-space-sm">
<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-label-caps text-label-caps font-semibold bg-[#1CCA9B]/20 text-[#1CCA9B]">
<span className="w-1.5 h-1.5 rounded-full bg-[#1CCA9B] animate-pulse"></span>
          RIG ACTIVE
        </span>
<span className="font-label-md text-label-md text-white/70">Interactive State Simulators:</span>
</div>
<div className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-1">
<button className="sim-pill px-2.5 py-1 rounded font-label-md text-label-md font-medium transition-all bg-[#008564] text-white shadow-sm" id="sim-btn-board" onClick={event=>{switchMainView('board')}}>1. Board View</button>
<button className="sim-pill px-2.5 py-1 rounded font-label-md text-label-md font-medium transition-all bg-white/10 text-white/80 hover:bg-white/20" id="sim-btn-drag" onClick={event=>{toggleDragState()}}>2. Drag State Demo</button>
<button className="sim-pill px-2.5 py-1 rounded font-label-md text-label-md font-medium transition-all bg-white/10 text-white/80 hover:bg-white/20" id="sim-btn-drawer" onClick={event=>{toggleDrawer(true)}}>3. Quick Drawer</button>
<button className="sim-pill px-2.5 py-1 rounded font-label-md text-label-md font-medium transition-all bg-white/10 text-white/80 hover:bg-white/20" id="sim-btn-bulk" onClick={event=>{toggleBulkDock()}}>4. Bulk Selected Bar</button>
<button className="sim-pill px-2.5 py-1 rounded font-label-md text-label-md font-medium transition-all bg-white/10 text-white/80 hover:bg-white/20" id="sim-btn-jobfilter" onClick={event=>{toggleJobFilterDropdown()}}>5. Job Filter Open</button>
<button className="sim-pill px-2.5 py-1 rounded font-label-md text-label-md font-medium transition-all bg-white/10 text-white/80 hover:bg-white/20" id="sim-btn-schedule" onClick={event=>{openModal('modal-schedule')}}>6. Schedule Modal</button>
<button className="sim-pill px-2.5 py-1 rounded font-label-md text-label-md font-medium transition-all bg-white/10 text-white/80 hover:bg-white/20" id="sim-btn-reject" onClick={event=>{openModal('modal-reject')}}>7. Reject Modal</button>
<button className="sim-pill px-2.5 py-1 rounded font-label-md text-label-md font-medium transition-all bg-white/10 text-white/80 hover:bg-white/20" id="sim-btn-add" onClick={event=>{openModal('modal-add-candidate')}}>8. Add Candidate Modal</button>
<button className="sim-pill px-2.5 py-1 rounded font-label-md text-label-md font-medium transition-all bg-white/10 text-white/80 hover:bg-white/20" id="sim-btn-empty" onClick={event=>{toggleEmptyState()}}>9. Empty Column</button>
<button className="sim-pill px-2.5 py-1 rounded font-label-md text-label-md font-medium transition-all bg-white/10 text-white/80 hover:bg-white/20" id="sim-btn-skeleton" onClick={event=>{toggleSkeletonLoading()}}>10. Skeleton Loading</button>
<button className="sim-pill px-2.5 py-1 rounded font-label-md text-label-md font-medium transition-all bg-white/10 text-white/80 hover:bg-white/20" id="sim-btn-list" onClick={event=>{switchMainView('list')}}>11. List View Table</button>
</div>
</div>
</aside>

<div className="px-space-xl py-space-lg flex flex-col gap-space-lg">

<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
<nav aria-label="Breadcrumbs" className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant">
<span>Dashboard</span>
<span className="material-symbols-outlined text-sm">chevron_right</span>
<span>Hire &amp; Lifecycle</span>
<span className="material-symbols-outlined text-sm">chevron_right</span>
<span>Recruitment Hub</span>
<span className="material-symbols-outlined text-sm">chevron_right</span>
<span className="font-semibold text-primary">Candidate Pipeline Kanban</span>
</nav>
<div className="flex items-center gap-space-sm font-label-caps text-label-caps text-on-surface-variant">
<span className="inline-flex items-center gap-1 text-primary">
<span className="material-symbols-outlined text-sm">sync</span>
          Live Sync • Bengaluru Tech Hub (IST)
        </span>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
<div className="flex flex-col gap-1.5">
<div className="flex flex-wrap items-center gap-space-sm">
<h1 className="font-headline-md text-headline-md font-semibold text-on-surface tracking-tight">Candidate Pipeline &amp; Hiring Stages</h1><input aria-label="Search pipeline" className="mt-2 px-3 py-2 rounded-lg bg-surface-container-low text-body-sm" placeholder="Search candidates by name, role, or company..." value={search} onChange={event=>{setSearch(event.target.value);setSelected([]);}} /><p className="text-body-sm text-secondary">{filtered.length} sample candidates ? <a className="hover:underline" href="#/recruitment-detail">Requisition details</a></p>
<span className="px-2.5 py-1 rounded-full font-label-caps text-label-caps font-semibold bg-[#D1F5EA] text-[#07523E]">
            ACTIVE CAMPAIGN
          </span>
</div>
<div className="flex flex-wrap items-center gap-2 text-on-surface-variant font-body-sm text-body-sm">
<span className="font-semibold text-on-surface">REQ-2025-089:</span>
<span>Sr. Backend Lead - Distributed Systems</span>
<span className="text-outline">•</span>
<span>Platform Engineering</span>
<span className="text-outline">•</span>
<span className="inline-flex items-center gap-1 text-primary font-medium">
<span className="material-symbols-outlined text-sm">location_on</span>
            Bengaluru HQ (Hybrid)
          </span>
</div>
</div>

<div className="grid grid-cols-3 gap-space-md bg-surface-container-low p-space-sm rounded-lg">
<div className="px-3 py-1 flex flex-col">
<span className="font-label-caps text-label-caps text-outline uppercase font-semibold">Total Pipeline</span>
<span className="font-headline-sm text-headline-sm font-bold text-on-surface">42</span>
</div>
<div className="px-3 py-1 flex flex-col">
<span className="font-label-caps text-label-caps text-outline uppercase font-semibold">In Offer Stage</span>
<span className="font-headline-sm text-headline-sm font-bold text-primary">6</span>
</div>
<div className="px-3 py-1 flex flex-col">
<span className="font-label-caps text-label-caps text-outline uppercase font-semibold">Hired YTD</span>
<span className="font-headline-sm text-headline-sm font-bold text-on-surface">2</span>
</div>
</div>
</div>

<div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
<div className="flex flex-wrap items-center gap-space-sm">

<div className="relative">
<button className="h-10 px-3.5 bg-surface-container-lowest rounded-lg font-label-lg text-label-lg font-medium text-on-surface shadow-sm flex items-center gap-2 hover:bg-surface-container-low transition-colors" id="job-filter-trigger" onClick={event=>{toggleJobFilterDropdown()}}><span className="material-symbols-outlined text-primary text-base">work_outline</span><span>{jobTitle}</span><span className="text-label-caps">{filtered.length}</span></button>{jobMenu&&<div id="job-filter-menu" className="absolute z-30 top-full mt-2 w-80 p-2 rounded-xl bg-surface-container-lowest shadow-xl">{["REQ-2025-089: Sr Backend Lead","REQ-2025-092: Staff Product Designer","REQ-2025-104: Enterprise Account Exec","REQ-2025-110: Staff SRE / DevOps Lead"].map(title=><button key={title} className="block w-full text-left p-2 rounded hover:bg-surface-container" onClick={()=>selectJob(title)}>{title}</button>)}</div>}</div>

<div className="hidden md:flex items-center gap-1.5">
<span className="px-3 py-1.5 rounded-full font-label-md text-label-md bg-surface-container-lowest text-on-surface shadow-sm flex items-center gap-1.5 cursor-pointer hover:bg-surface-container-low">
<span className="text-outline font-normal">Dept:</span> Platform Engg
            <span className="material-symbols-outlined text-sm text-outline">close</span>
</span>
<span className="px-3 py-1.5 rounded-full font-label-md text-label-md bg-surface-container-lowest text-on-surface shadow-sm flex items-center gap-1.5 cursor-pointer hover:bg-surface-container-low">
<span className="text-outline font-normal">ATS Match:</span> &gt;85%
            <span className="material-symbols-outlined text-sm text-outline">close</span>
</span>
<span className="px-3 py-1.5 rounded-full font-label-md text-label-md bg-surface-container-lowest text-on-surface shadow-sm flex items-center gap-1.5 cursor-pointer hover:bg-surface-container-low">
<span className="text-outline font-normal">Recruiter:</span> Priya Sharma
            <span className="material-symbols-outlined text-sm text-outline">close</span>
</span>
<button className="px-2.5 py-1.5 rounded-full font-label-md text-label-md text-primary hover:bg-surface-container-low flex items-center gap-1">
<span className="material-symbols-outlined text-base">filter_list</span>
<span>More Filters</span>
</button>
</div>
</div>

<div className="flex items-center gap-space-sm self-end xl:self-auto">

<div className="flex items-center bg-surface-container-lowest p-1 rounded-lg shadow-sm">
<button className="px-3 py-1.5 rounded font-label-md text-label-md font-semibold bg-primary text-on-primary shadow-sm flex items-center gap-1.5 transition-all" id="view-tab-board" onClick={event=>{switchMainView('board')}}>
<span className="material-symbols-outlined text-base">view_kanban</span>
<span>Board</span>
</button>
<button className="px-3 py-1.5 rounded font-label-md text-label-md font-medium text-on-surface-variant hover:text-on-surface flex items-center gap-1.5 transition-all" id="view-tab-list" onClick={event=>{switchMainView('list')}}>
<span className="material-symbols-outlined text-base">format_list_bulleted</span>
<span>List</span>
</button>
</div>

<button className="h-10 px-4 bg-primary text-on-primary rounded-lg font-label-lg text-label-lg font-medium flex items-center gap-2 hover:bg-primary-container transition-colors shadow-sm" onClick={event=>{openModal('modal-add-candidate')}}>
<span className="material-symbols-outlined text-base">person_add</span>
<span>Add Candidate</span>
</button>
</div>
</div>

<div className={"grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-space-md" + (loading ? '' : ' hidden')} id="skeleton-board-view">
<div className="flex flex-col gap-3 bg-surface-container-low/60 p-space-sm rounded-xl animate-pulse">
<div className="h-6 bg-surface-variant rounded w-3/4"></div>
<div className="h-32 bg-surface-container-lowest rounded-xl"></div>
<div className="h-32 bg-surface-container-lowest rounded-xl"></div>
</div>
<div className="flex flex-col gap-3 bg-surface-container-low/60 p-space-sm rounded-xl animate-pulse">
<div className="h-6 bg-surface-variant rounded w-3/4"></div>
<div className="h-32 bg-surface-container-lowest rounded-xl"></div>
<div className="h-32 bg-surface-container-lowest rounded-xl"></div>
</div>
<div className="flex flex-col gap-3 bg-surface-container-low/60 p-space-sm rounded-xl animate-pulse">
<div className="h-6 bg-surface-variant rounded w-3/4"></div>
<div className="h-32 bg-surface-container-lowest rounded-xl"></div>
</div>
<div className="flex flex-col gap-3 bg-surface-container-low/60 p-space-sm rounded-xl animate-pulse">
<div className="h-6 bg-surface-variant rounded w-3/4"></div>
<div className="h-32 bg-surface-container-lowest rounded-xl"></div>
</div>
<div className="flex flex-col gap-3 bg-surface-container-low/60 p-space-sm rounded-xl animate-pulse">
<div className="h-6 bg-surface-variant rounded w-3/4"></div>
<div className="h-32 bg-surface-container-lowest rounded-xl"></div>
</div>
<div className="flex flex-col gap-3 bg-surface-container-low/60 p-space-sm rounded-xl animate-pulse">
<div className="h-6 bg-surface-variant rounded w-3/4"></div>
<div className="h-32 bg-surface-container-lowest rounded-xl"></div>
</div>
<div className="flex flex-col gap-3 bg-surface-container-low/60 p-space-sm rounded-xl animate-pulse">
<div className="h-6 bg-surface-variant rounded w-3/4"></div>
<div className="h-32 bg-surface-container-lowest rounded-xl"></div>
</div>
</div>

<div className={"w-full overflow-x-auto pb-space-xl" + (view==='board'&&!loading ? '' : ' hidden')} id="kanban-board-container"><PipelineBoard candidates={filtered} selected={selected} toggleSelected={toggleSelected} onOpen={openCandidate} onMove={moveCandidate} emptyRejected={emptyRejected} dragDemo={dragDemo} /></div>

<div className={"bg-surface-container-lowest rounded-xl shadow-md overflow-hidden" + (view==='list'&&!loading ? '' : ' hidden')} id="list-view-container"><PipelineList candidates={filtered} selected={selected} toggleSelected={toggleSelected} onOpen={openCandidate} onMove={moveCandidate} onSelectAll={toggleSelectAllRows} /></div>
</div>

<div className={"fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-[#0E2B3D] text-white px-space-lg py-3 rounded-2xl shadow-2xl flex items-center gap-space-md transition-all" + (selected.length>0 ? '' : ' hidden')} id="bulk-action-dock">
<div className="flex items-center gap-2 pr-space-md border-r border-white/20">
<span className="material-symbols-outlined text-primary text-xl">check_box</span>
<span className="font-label-lg text-label-lg font-semibold" id="bulk-count-label">{selected.length+' Candidates Selected'}</span>
</div>

<div className="flex items-center gap-space-sm">
<div className="relative">
<select className="h-9 px-3 bg-white/10 text-white rounded-lg font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer pr-8" aria-label="Bulk stage" value={bulkStage} onChange={event=>setBulkStage(event.target.value)}>
<option className="text-on-surface bg-surface" value="">Move Stage...</option>
<option className="text-on-surface bg-surface" value="screening">Move to Screening</option>
<option className="text-on-surface bg-surface" value="interview">Move to Interview</option>
<option className="text-on-surface bg-surface" value="assessment">Move to Assessment</option>
<option className="text-on-surface bg-surface" value="offer">Move to Offer</option>
</select>
</div>
<button className="h-9 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-label-md text-label-md font-medium flex items-center gap-1.5 transition-colors" onClick={event=>{openModal('modal-bulk-email')}}>
<span className="material-symbols-outlined text-base">mail</span>
<span>Send Email</span>
</button>
<button className="h-9 px-3 rounded-lg bg-[#E11D48]/20 hover:bg-[#E11D48]/30 text-[#ffb4ab] font-label-md text-label-md font-medium flex items-center gap-1.5 transition-colors" onClick={event=>{openModal('modal-reject')}}>
<span className="material-symbols-outlined text-base">block</span>
<span>Reject</span>
</button>
<button className="h-9 px-4 rounded-lg bg-primary text-white font-label-md text-label-md font-semibold hover:bg-primary-container transition-colors shadow-sm" onClick={event=>{applyBulkAction()}}>
        Apply Actions
      </button>
<button className="p-1 text-white/50 hover:text-white ml-1" onClick={event=>{clearBulkSelection()}}>
<span className="material-symbols-outlined text-base">close</span>
</button>
</div>
</div>

<div className={"fixed inset-0 bg-[#0E2B3D]/40 backdrop-blur-sm z-50 transition-opacity" + (drawer ? '' : ' hidden')} id="quick-drawer-backdrop" onClick={event=>{toggleDrawer(false)}}></div>
<aside className={"fixed top-0 right-0 h-full w-full max-w-xl bg-surface-container-lowest shadow-2xl z-50 transform transition-transform duration-300 flex flex-col justify-between overflow-y-auto" + (drawer ? '' : ' hidden')} id="quick-drawer">

<div className="p-space-lg bg-surface-container-low flex flex-col gap-space-md">
<div className="flex items-center justify-between">
<span className="px-2.5 py-0.5 rounded-full font-label-caps text-label-caps font-semibold bg-[#D1F5EA] text-[#07523E]">
          CANDIDATE QUICK PROFILE
        </span>
<button className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant" onClick={event=>{toggleDrawer(false)}}>
<span className="material-symbols-outlined text-xl">close</span>
</button>
</div>
<div className="flex items-start gap-space-md">
<div className="w-16 h-16 rounded-2xl bg-primary text-on-primary font-display-sm text-display-sm flex items-center justify-center font-bold">
<span id="drawer-initials">{active.name.split(' ').map(word=>word[0]).join('')}</span>
</div>
<div className="flex-1 flex flex-col">
<h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface" id="drawer-name">{active.name}</h2>
<p className="font-body-sm text-body-sm text-on-surface-variant" id="drawer-current-role">{active.role+' @ '+active.company}</p>
<div className="flex flex-wrap items-center gap-2 mt-2">
<span className="px-2 py-0.5 rounded-full font-label-caps text-label-caps font-bold bg-[#D1F5EA] text-[#07523E]" id="drawer-match-badge">{active.match}</span>
<span className="px-2 py-0.5 rounded font-label-caps text-label-caps bg-surface-container text-on-surface-variant">Applied 2 Days Ago</span>
</div>
</div>
</div>

<div className="flex flex-wrap items-center gap-2 pt-2">
<button className="h-9 px-3.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-medium flex items-center gap-1.5 hover:bg-primary-container" onClick={event=>{openModal('modal-schedule')}}>
<span className="material-symbols-outlined text-base">calendar_add_on</span>
<span>Schedule Interview</span>
</button>
<button className="h-9 px-3.5 rounded-lg bg-surface-container font-label-md text-label-md text-[#ba1a1a] hover:bg-error-container font-medium flex items-center gap-1.5" onClick={event=>{openModal('modal-reject')}}>
<span className="material-symbols-outlined text-base">person_remove</span>
<span>Reject</span>
</button>
<div className="relative">
<select className="h-9 px-3 bg-surface-container rounded-lg" aria-label="Candidate stage" value={active.stage} onChange={event=>moveCandidate(active.id,event.target.value)}>{["Applied","Screening","Interview","Assessment","Offer","Hired","Rejected"].map(stage=><option key={stage}>{stage}</option>)}</select>
</div>
</div>
</div>

<div className="p-space-lg flex-1 flex flex-col gap-space-lg overflow-y-auto">

<div className="grid grid-cols-3 gap-space-sm bg-surface-container-low p-space-md rounded-xl">
<div>
<p className="font-label-caps text-label-caps text-outline uppercase font-semibold">Total Exp</p>
<p className="font-title-md text-title-md font-bold text-on-surface" id="drawer-exp">{active.experience}</p>
</div>
<div>
<p className="font-label-caps text-label-caps text-outline uppercase font-semibold">Notice Period</p>
<p className="font-title-md text-title-md font-bold text-on-surface" id="drawer-notice">{active.notice}</p>
</div>
<div>
<p className="font-label-caps text-label-caps text-outline uppercase font-semibold">Current / Target</p>
<p className="font-title-md text-title-md font-bold text-primary" id="drawer-ctc">{active.currentCtc+' → '+active.targetCtc}</p>
</div>
</div>

<div className="flex flex-col gap-space-xs">
<h4 className="font-label-caps text-label-caps uppercase text-outline font-semibold">ATS Core Skill Match Breakdown</h4>
<div className="flex flex-wrap gap-1.5">
<span className="px-2.5 py-1 rounded-md font-label-md text-label-md bg-[#D1F5EA] text-[#07523E] font-medium">Distributed Systems (Expert)</span>
<span className="px-2.5 py-1 rounded-md font-label-md text-label-md bg-[#D1F5EA] text-[#07523E] font-medium">Go / Golang (9/10)</span>
<span className="px-2.5 py-1 rounded-md font-label-md text-label-md bg-[#D1F5EA] text-[#07523E] font-medium">Kafka / Event Architecture</span>
<span className="px-2.5 py-1 rounded-md font-label-md text-label-md bg-[#D1F5EA] text-[#07523E] font-medium">Kubernetes &amp; Helm</span>
<span className="px-2.5 py-1 rounded-md font-label-md text-label-md bg-surface-container text-on-surface-variant font-medium">Cassandra DB</span>
</div>
</div>

<div className="flex flex-col gap-space-xs">
<h4 className="font-label-caps text-label-caps uppercase text-outline font-semibold">Prescreening Verification</h4>
<div className="bg-surface-container-low p-space-md rounded-xl flex flex-col gap-space-sm text-body-sm font-body-sm">
<div className="flex items-start justify-between">
<span className="text-on-surface">Are you willing to work from Bengaluru HQ (Indiranagar)?</span>
<span className="font-semibold text-primary">Yes, Hybrid 3d/wk</span>
</div>
<div className="flex items-start justify-between">
<span className="text-on-surface">Do you hold valid Indian citizenship / PAN card?</span>
<span className="font-semibold text-primary">Verified</span>
</div>
<div className="flex items-start justify-between">
<span className="text-on-surface">Official Notice buy-out option with Swiggy:</span>
<span className="font-semibold text-primary">Possible (15 days)</span>
</div>
</div>
</div>

<div className="flex flex-col gap-space-xs">
<h4 className="font-label-caps text-label-caps uppercase text-outline font-semibold">Interview Panel Evaluation</h4>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-2">
<div className="flex items-center justify-between">
<div>
<p className="font-title-md text-title-md font-semibold text-on-surface">Round 1: DSA &amp; Concurrency</p>
<p className="font-label-caps text-label-caps text-outline">Interviewer: Rajesh Kumar (Staff SRE)</p>
</div>
<span className="px-2 py-0.5 rounded font-label-caps text-label-caps font-bold bg-[#D1F5EA] text-[#07523E]">STRONG HIRE (4.8 / 5)</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant italic">
            "Candidate demonstrated deep clarity regarding Raft consensus algorithm and handling high throughput write bottlenecks. Strong communication and systematic problem decomposition."
          </p>
</div>
</div>
</div>

<div className="p-space-md bg-surface-container-low flex items-center justify-between">
<button className="px-4 py-2 rounded-lg font-label-lg text-label-lg font-medium text-on-surface-variant hover:text-on-surface" onClick={event=>{toggleDrawer(false)}}>
        Close Drawer
      </button>
<a className="px-4 py-2 rounded-lg bg-[#0E2B3D] text-white font-label-lg text-label-lg font-medium hover:bg-[#16384C] flex items-center gap-1.5" href="#">
<span>Open Full Candidate Profile</span>
<span className="material-symbols-outlined text-sm">open_in_new</span>
</a>
</div>
</aside>

<div className={"fixed inset-0 z-50 bg-[#0E2B3D]/50 backdrop-blur-sm flex items-center justify-center p-space-md" + (modal==='modal-schedule' ? '' : ' hidden')} id="modal-schedule">
<div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl overflow-hidden flex flex-col">
<div className="px-space-lg py-space-md bg-surface-container-low flex items-center justify-between">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-primary text-xl">event_available</span>
<h3 className="font-title-md text-title-md font-semibold text-on-surface">Schedule Interview Round</h3>
</div>
<button className="p-1 rounded text-outline hover:text-on-surface" onClick={event=>{closeModal('modal-schedule')}}>
<span className="material-symbols-outlined text-lg">close</span>
</button>
</div>
<div className="p-space-lg flex flex-col gap-space-md font-body-sm text-body-sm">
<div className="flex flex-col gap-1">
<label className="font-label-caps text-label-caps uppercase text-outline font-semibold">Interview Round</label>
<select className="h-10 px-3 bg-surface rounded-lg text-on-surface font-body-md text-body-md focus:ring-1 focus:ring-primary" aria-label="round" value={fields.round ?? ''} onChange={event=>setField('round',event.target.value)}>
<option>Round 2: System Architecture &amp; Distributed Patterns</option>
<option>Round 1: Core Coding &amp; Data Structures</option>
<option>Round 3: Engineering Culture &amp; Leadership Fit</option>
<option>Bar Raiser: VP Engineering Discussion</option>
</select>
</div>
<div className="grid grid-cols-2 gap-space-md">
<div className="flex flex-col gap-1">
<label className="font-label-caps text-label-caps uppercase text-outline font-semibold">Date</label>
<input className="h-10 px-3 bg-surface rounded-lg text-on-surface font-body-md text-body-md focus:ring-1 focus:ring-primary" type="date"  aria-label="date" value={fields.date ?? ''} onChange={event=>setField('date',event.target.value)} />
</div>
<div className="flex flex-col gap-1">
<label className="font-label-caps text-label-caps uppercase text-outline font-semibold">Slot (IST)</label>
<select className="h-10 px-3 bg-surface rounded-lg text-on-surface font-body-md text-body-md focus:ring-1 focus:ring-primary" aria-label="slot" value={fields.slot ?? ''} onChange={event=>setField('slot',event.target.value)}>
<option>03:30 PM - 04:30 PM IST</option>
<option>11:00 AM - 12:00 PM IST</option>
<option>05:00 PM - 06:00 PM IST</option>
</select>
</div>
</div>
<div className="flex flex-col gap-1">
<label className="font-label-caps text-label-caps uppercase text-outline font-semibold">Panelists (Select)</label>
<div className="p-2 bg-surface rounded-lg flex flex-wrap gap-1.5">
<span className="px-2 py-1 rounded bg-[#D1F5EA] text-[#07523E] font-label-caps text-label-caps font-semibold flex items-center gap-1">
              Rajesh Kumar (Staff SRE)
              <span className="material-symbols-outlined text-xs cursor-pointer">close</span>
</span>
<span className="px-2 py-1 rounded bg-[#D1F5EA] text-[#07523E] font-label-caps text-label-caps font-semibold flex items-center gap-1">
              Priya Sharma (HR Lead)
              <span className="material-symbols-outlined text-xs cursor-pointer">close</span>
</span>
<button className="px-2 py-1 text-primary font-label-caps text-label-caps font-semibold hover:underline">+ Add Interviewer</button>
</div>
</div>
<div className="flex flex-col gap-1">
<label className="font-label-caps text-label-caps uppercase text-outline font-semibold">Location / Mode</label>
<div className="grid grid-cols-2 gap-2">
<label className="p-2.5 rounded-lg bg-surface-container flex items-center gap-2 cursor-pointer">
<input defaultChecked className="text-primary accent-primary" name="int-mode" type="radio"/>
<span className="font-body-sm text-body-sm font-medium">Google Meet (Auto Link)</span>
</label>
<label className="p-2.5 rounded-lg bg-surface-container flex items-center gap-2 cursor-pointer">
<input className="text-primary accent-primary" name="int-mode" type="radio"/>
<span className="font-body-sm text-body-sm font-medium">Bengaluru HQ Conf Rm 4B</span>
</label>
</div>
</div>
</div>
<div className="px-space-lg py-space-md bg-surface-container-low flex items-center justify-end gap-space-sm">
<button className="px-4 py-2 rounded-lg font-label-lg text-label-lg font-medium text-on-surface-variant hover:text-on-surface" onClick={event=>{closeModal('modal-schedule')}}>
          Cancel
        </button>
<button className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg font-medium hover:bg-primary-container shadow-sm flex items-center gap-1" onClick={event=>{confirmSchedule()}}>
<span className="material-symbols-outlined text-base">send</span>
<span>Save Interview Preview</span>
</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 bg-[#0E2B3D]/50 backdrop-blur-sm flex items-center justify-center p-space-md" + (modal==='modal-reject' ? '' : ' hidden')} id="modal-reject">
<div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl overflow-hidden flex flex-col">
<div className="px-space-lg py-space-md bg-error-container/30 flex items-center justify-between">
<div className="flex items-center gap-2 text-error">
<span className="material-symbols-outlined text-xl">person_cancel</span>
<h3 className="font-title-md text-title-md font-semibold">Reject Candidate Application</h3>
</div>
<button className="p-1 rounded text-outline hover:text-on-surface" onClick={event=>{closeModal('modal-reject')}}>
<span className="material-symbols-outlined text-lg">close</span>
</button>
</div>
<div className="p-space-lg flex flex-col gap-space-md font-body-sm text-body-sm">
<p className="text-on-surface-variant">Select the formal rejection rationale for audit logging and candidate communication.</p>
<div className="flex flex-col gap-1">
<label className="font-label-caps text-label-caps uppercase text-outline font-semibold">Primary Rejection Reason</label>
<select className="h-10 px-3 bg-surface rounded-lg text-on-surface font-body-md text-body-md focus:ring-1 focus:ring-error" aria-label="rejectReason" value={fields.rejectReason ?? ''} onChange={event=>setField('rejectReason',event.target.value)}>
<option>Technical Assessment Bar (Distributed Architecture)</option>
<option>Notice Period Constraint (&gt;60 Days non-negotiable)</option>
<option>CTC Expectation misalignment (Budget Cap Exceeded)</option>
<option>Cultural Fit &amp; Team Collaboration Values</option>
<option>Candidate Withdrew / Accepted Counter Offer</option>
</select>
</div>
<div className="flex flex-col gap-1">
<label className="font-label-caps text-label-caps uppercase text-outline font-semibold">Internal Evaluator Notes</label>
<textarea className="p-3 bg-surface rounded-lg text-on-surface font-body-md text-body-md focus:ring-1 focus:ring-error resize-none" placeholder="Enter specific interview feedback for internal record..." rows="3"   aria-label="rejectNotes" value={fields.rejectNotes ?? ''} onChange={event=>setField('rejectNotes',event.target.value)} />
</div>
<div className="p-3 bg-surface-container rounded-lg flex items-center justify-between">
<div className="flex flex-col">
<span className="font-title-md text-title-md text-on-surface font-medium">Send Graceful Rejection Email</span>
<span className="font-label-caps text-label-caps text-outline">Uses EMS Enterprise Standard Rejection Template</span>
</div>
<input defaultChecked className="w-5 h-5 rounded text-primary accent-primary" type="checkbox"/>
</div>
</div>
<div className="px-space-lg py-space-md bg-surface-container-low flex items-center justify-end gap-space-sm">
<button className="px-4 py-2 rounded-lg font-label-lg text-label-lg font-medium text-on-surface-variant hover:text-on-surface" onClick={event=>{closeModal('modal-reject')}}>
          Cancel
        </button>
<button className="px-4 py-2 rounded-lg bg-error text-on-error font-label-lg text-label-lg font-medium hover:bg-error/90 shadow-sm flex items-center gap-1" onClick={event=>{confirmRejection()}}>
<span className="material-symbols-outlined text-base">block</span>
<span>Confirm Rejection</span>
</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 bg-[#0E2B3D]/50 backdrop-blur-sm flex items-center justify-center p-space-md" + (modal==='modal-add-candidate' ? '' : ' hidden')} id="modal-add-candidate">
<div className="w-full max-w-xl bg-surface-container-lowest rounded-2xl shadow-2xl overflow-hidden flex flex-col">
<div className="px-space-lg py-space-md bg-surface-container-low flex items-center justify-between">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-primary text-xl">person_add</span>
<h3 className="font-title-md text-title-md font-semibold text-on-surface">Add New Candidate to {job}</h3>
</div>
<button className="p-1 rounded text-outline hover:text-on-surface" onClick={event=>{closeModal('modal-add-candidate')}}>
<span className="material-symbols-outlined text-lg">close</span>
</button>
</div>
<div className="p-space-lg flex flex-col gap-space-md font-body-sm text-body-sm">
<div className="grid grid-cols-2 gap-space-md">
<div className="flex flex-col gap-1">
<label className="font-label-caps text-label-caps uppercase text-outline font-semibold">First Name *</label>
<input className="h-10 px-3 bg-surface rounded-lg text-on-surface font-body-md text-body-md focus:ring-1 focus:ring-primary" placeholder="e.g. Rahul" type="text" aria-label="firstName" value={fields.firstName ?? ''} onChange={event=>setField('firstName',event.target.value)} />
</div>
<div className="flex flex-col gap-1">
<label className="font-label-caps text-label-caps uppercase text-outline font-semibold">Last Name *</label>
<input className="h-10 px-3 bg-surface rounded-lg text-on-surface font-body-md text-body-md focus:ring-1 focus:ring-primary" placeholder="e.g. Sundaram" type="text" aria-label="lastName" value={fields.lastName ?? ''} onChange={event=>setField('lastName',event.target.value)} />
</div>
</div>
<div className="grid grid-cols-2 gap-space-md">
<div className="flex flex-col gap-1">
<label className="font-label-caps text-label-caps uppercase text-outline font-semibold">Email ID *</label>
<input className="h-10 px-3 bg-surface rounded-lg text-on-surface font-body-md text-body-md focus:ring-1 focus:ring-primary" placeholder="rahul.s@domain.in" type="email" aria-label="email" value={fields.email ?? ''} onChange={event=>setField('email',event.target.value)} />
</div>
<div className="flex flex-col gap-1">
<label className="font-label-caps text-label-caps uppercase text-outline font-semibold">Phone (+91)</label>
<input className="h-10 px-3 bg-surface rounded-lg text-on-surface font-body-md text-body-md focus:ring-1 focus:ring-primary" placeholder="+91 98450 12345" type="text" aria-label="phone" value={fields.phone ?? ''} onChange={event=>setField('phone',event.target.value)} />
</div>
</div>
<div className="grid grid-cols-3 gap-space-md">
<div className="flex flex-col gap-1">
<label className="font-label-caps text-label-caps uppercase text-outline font-semibold">Total Exp</label>
<input className="h-10 px-3 bg-surface rounded-lg text-on-surface font-body-md text-body-md focus:ring-1 focus:ring-primary" placeholder="e.g. 7 Years" type="text" aria-label="experience" value={fields.experience ?? ''} onChange={event=>setField('experience',event.target.value)} />
</div>
<div className="flex flex-col gap-1">
<label className="font-label-caps text-label-caps uppercase text-outline font-semibold">Notice Period</label>
<select className="h-10 px-3 bg-surface rounded-lg text-on-surface font-body-md text-body-md focus:ring-1 focus:ring-primary" aria-label="notice" value={fields.notice ?? ''} onChange={event=>setField('notice',event.target.value)}>
<option>Immediate / &lt; 15 Days</option>
<option>30 Days</option>
<option>60 Days</option>
<option>90 Days</option>
</select>
</div>
<div className="flex flex-col gap-1">
<label className="font-label-caps text-label-caps uppercase text-outline font-semibold">Initial Stage</label>
<select className="h-10 px-3 bg-surface rounded-lg text-on-surface font-body-md text-body-md focus:ring-1 focus:ring-primary" aria-label="stage" value={fields.stage ?? ''} onChange={event=>setField('stage',event.target.value)}>
<option>Applied</option>
<option>Screening</option>
<option>Interview</option>
</select>
</div>
</div>

<div className="p-space-lg rounded-xl bg-surface-container-low flex flex-col items-center justify-center text-center gap-1 cursor-pointer hover:bg-surface-container transition-colors">
<span className="material-symbols-outlined text-3xl text-primary">cloud_upload</span>
<label className="font-label-md font-semibold">Select CV / Resume<input aria-label="Candidate resume" className="block mt-2 text-body-sm" type="file" accept=".pdf,.docx" onChange={event=>{const file=event.target.files?.[0];if(file&&(file.size>10*1024*1024||! /\.(pdf|docx)$/i.test(file.name))){showToast("Choose a PDF or DOCX file up to 10MB.");return;}setResume(file?.name||"");}} /></label><p className="text-body-sm">{resume}</p>
<p className="font-label-caps text-label-caps text-outline">PDF, DOCX up to 10MB (local preview)</p>
</div>
</div>
<div className="px-space-lg py-space-md bg-surface-container-low flex items-center justify-end gap-space-sm">
<button className="px-4 py-2 rounded-lg font-label-lg text-label-lg font-medium text-on-surface-variant hover:text-on-surface" onClick={event=>{closeModal('modal-add-candidate')}}>
          Cancel
        </button>
<button className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg font-medium hover:bg-primary-container shadow-sm" onClick={event=>{saveNewCandidate()}}>
          Save Candidate
        </button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 bg-[#0E2B3D]/50 backdrop-blur-sm flex items-center justify-center p-space-md" + (modal==='modal-bulk-email' ? '' : ' hidden')} id="modal-bulk-email">
<div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl overflow-hidden flex flex-col">
<div className="px-space-lg py-space-md bg-surface-container-low flex items-center justify-between">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-primary text-xl">mail</span>
<h3 className="font-title-md text-title-md font-semibold text-on-surface">Dispatch Bulk Communication</h3>
</div>
<button className="p-1 rounded text-outline hover:text-on-surface" onClick={event=>{closeModal('modal-bulk-email')}}>
<span className="material-symbols-outlined text-lg">close</span>
</button>
</div>
<div className="p-space-lg flex flex-col gap-space-md font-body-sm text-body-sm">
<div className="p-3 bg-surface-container-low rounded-lg text-on-surface-variant">
          Recipients: <span className="font-semibold text-on-surface">{selected.length} candidates currently selected in pipeline</span>
</div>
<div className="flex flex-col gap-1">
<label className="font-label-caps text-label-caps uppercase text-outline font-semibold">Select Email Template</label>
<select className="h-10 px-3 bg-surface rounded-lg text-on-surface font-body-md text-body-md focus:ring-1 focus:ring-primary" aria-label="template" value={fields.template ?? ''} onChange={event=>setField('template',event.target.value)}>
<option>Schedule Technical Screen Round 1</option>
<option>Follow-up on CTC &amp; Counter-offer details</option>
<option>Assessment HackerRank Invite Link</option>
<option>Notice Period Verification Form Request</option>
</select>
</div>
<div className="flex flex-col gap-1">
<label className="font-label-caps text-label-caps uppercase text-outline font-semibold">Subject Line</label>
<input className="h-10 px-3 bg-surface rounded-lg text-on-surface font-body-md text-body-md focus:ring-1 focus:ring-primary" type="text"  aria-label="subject" value={fields.subject ?? ''} onChange={event=>setField('subject',event.target.value)} />
</div>
<div className="flex flex-col gap-1">
<label className="font-label-caps text-label-caps uppercase text-outline font-semibold">Message Preview</label>
<textarea className="p-3 bg-surface rounded-lg text-on-surface font-body-md text-body-md focus:ring-1 focus:ring-primary resize-none" rows="4"   aria-label="message" value={fields.message ?? ''} onChange={event=>setField('message',event.target.value)} />
</div>
</div>
<div className="px-space-lg py-space-md bg-surface-container-low flex items-center justify-end gap-space-sm">
<button className="px-4 py-2 rounded-lg font-label-lg text-label-lg font-medium text-on-surface-variant hover:text-on-surface" onClick={event=>{closeModal('modal-bulk-email')}}>
          Cancel
        </button>
<button className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg font-medium hover:bg-primary-container shadow-sm flex items-center gap-1" onClick={event=>{closeModal('modal-bulk-email'); showToast('Communication preview saved. No emails were sent.');}}>
<span className="material-symbols-outlined text-base">send</span>
<span>Send Emails</span>
</button>
</div>
</div>
</div>

</div></main>{toast&&<div role="status" className="fixed bottom-6 right-6 z-[60] p-4 bg-inverse-surface text-inverse-on-surface rounded-xl shadow-xl">{toast}</div>}</div></>);
}
