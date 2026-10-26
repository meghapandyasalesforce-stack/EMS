import { useEffect, useRef, useState } from 'react';
import { Sidebar, Header } from './Layout.jsx';
import { initialSuccessionPlans } from './successionData.js';
import { initialSuccessionFields } from './successionFields.js';
import SuccessionCard from './SuccessionCard.jsx';
const normalizeReadiness=value=>value.startsWith('Ready')?'Ready Now':value.startsWith('1')?'1-2 Years':'3+ Years';
export default function Succession() {
 const [plans,setPlans]=useState(initialSuccessionPlans);
 const [fields,setFields]=useState(initialSuccessionFields);
 const [view,setView]=useState('roles');
 const [search,setSearch]=useState('');
 const [department,setDepartment]=useState('ALL');
 const [risk,setRisk]=useState('ALL');
 const [readiness,setReadiness]=useState('ALL');
 const [activeId,setActiveId]=useState(1);
 const [drawer,setDrawer]=useState(false);
 const [modal,setModal]=useState(null);
 const [editingId,setEditingId]=useState(null);
 const [removeName,setRemoveName]=useState('');
 const [deleteId,setDeleteId]=useState(null);
 const [activityTarget,setActivityTarget]=useState(null);
 const [profile,setProfile]=useState('');
 const [exportMenu,setExportMenu]=useState(false);
 const [toast,setToast]=useState('');
 const timer=useRef();
 const active=plans.find(plan=>plan.id===activeId)||plans[0]||initialSuccessionPlans[0];
 const deleteTarget=plans.find(plan=>plan.id===deleteId);
 const profilePlan=plans.find(plan=>plan.successors.some(person=>person.name===profile));
 const profilePerson=plans.flatMap(plan=>plan.successors).find(person=>person.name===profile);
 const filtered=plans.filter(plan=>(department==='ALL'||plan.department===department)&&(risk==='ALL'||plan.risk===risk)&&(readiness==='ALL'||plan.successors.some(person=>person.readiness===readiness))&&[plan.title,plan.incumbent,...plan.successors.map(person=>person.name)].some(value=>value.toLowerCase().includes(search.toLowerCase())));
 const setField=(key,value)=>setFields(previous=>({...previous,[key]:value}));
 const triggerToast=message=>{clearTimeout(timer.current);setToast(message);timer.current=setTimeout(()=>setToast(''),3500);};
 const resetFilters=()=>{setSearch('');setDepartment('ALL');setRisk('ALL');setReadiness('ALL');};
 const switchView=setView;
 const rigView=preset=>{if(preset==='ninebox')setView('ninebox');else{setView('roles');resetFilters();if(preset==='empty')setSearch('XYZ_NONEXISTENT_KEYWORD');}};
 const closeModal=()=>setModal(null);
 const openModal=id=>{if(id==='create-plan-modal'){setEditingId(null);setFields(previous=>({...previous,...initialSuccessionFields}));}if(id==='remove-successor-modal')setRemoveName(active.successors[0]?.name||'');if(id==='delete-plan-modal')setDeleteId(active.id);setModal(id);};
 const openPlan=id=>{setActiveId(id);setDrawer(true);};
 const openDrawer=title=>{const plan=plans.find(plan=>plan.title.toLowerCase().includes(title.replace('CTO','Chief Technology Officer').toLowerCase()))||plans[0];if(plan)openPlan(plan.id);};
 const closeDrawer=()=>setDrawer(false);
 const toggleDropdown=()=>setExportMenu(previous=>!previous);
 const openCandidateProfile=setProfile;
 const closeCandidatePopover=()=>setProfile('');
 const triggerSamplePopover=()=>setProfile('Aarav Sharma');
 const editPlan=id=>{const plan=plans.find(plan=>plan.id===id);setEditingId(id);setFields(previous=>({...previous,title:plan.title,incumbent:plan.incumbent,department:({'Engineering':'Engineering & Tech','Product':'Product Management','Finance':'Finance & Accounts'})[plan.department]||plan.department,risk:plan.risk+' ('+({'High':'Likely transition < 6 mos','Medium':'Possible 6-18 mos','Low':'Stable > 24 mos'})[plan.risk]+')'}));setModal('create-plan-modal');};
 const handleCreatePlanSubmit=event=>{event.preventDefault();if(!fields.title.trim()||!fields.incumbent.trim()||!Number.isInteger(Number(fields.capacity))||Number(fields.capacity)<1||Number(fields.capacity)>10){triggerToast('Enter a role, incumbent, and bench capacity from 1 to 10.');return;}const values={title:fields.title.trim(),incumbent:fields.incumbent.trim(),department:({'Engineering & Tech':'Engineering','Product Management':'Product','Finance & Accounts':'Finance','People & Culture':'People'})[fields.department]||fields.department,risk:fields.risk.split(' ')[0],impact:fields.impact,capacity:Number(fields.capacity),location:fields.location,notes:fields.notes};setPlans(previous=>editingId?previous.map(plan=>plan.id===editingId?{...plan,...values}:plan):[...previous,{...values,id:Math.max(0,...previous.map(plan=>plan.id))+1,successors:[],activities:[],readiness:'Not assessed'}]);closeModal();resetFilters();setView('roles');triggerToast('Succession plan saved locally.');};
 const handleAddSuccessorSubmit=event=>{event.preventDefault();if(active.successors.some(person=>person.name===fields.successor)){triggerToast('This employee is already in the talent pool.');return;}setPlans(previous=>previous.map(plan=>plan.id===active.id?{...plan,successors:[...plan.successors,{name:fields.successor,readiness:normalizeReadiness(fields.readiness),potential:fields.potential,justification:fields.justification}]}:plan));closeModal();triggerToast('Successor nominated locally.');};
 const handleDevActivitySubmit=event=>{event.preventDefault();if(!fields.activityTitle.trim()){triggerToast('Enter an activity title.');return;}setPlans(previous=>previous.map(plan=>plan.id===active.id?{...plan,activities:[...plan.activities,{id:Date.now(),title:fields.activityTitle.trim(),assignee:fields.assignee,due:fields.due,budget:fields.budget,sponsor:fields.sponsor,milestones:fields.milestones,complete:false}]}:plan));closeModal();triggerToast('Development activity saved locally.');};
 const triggerRemoveSuccessor=name=>{setRemoveName(name);setModal('remove-successor-modal');};
 const confirmRemoveSuccessor=()=>{setPlans(previous=>previous.map(plan=>plan.id===active.id?{...plan,successors:plan.successors.filter(person=>person.name!==removeName)}:plan));closeModal();triggerToast('Successor removed from this local talent pool.');};
 const triggerDeletePlanModal=id=>{setDeleteId(typeof id==='number'?id:active.id);setModal('delete-plan-modal');};
 const confirmDeletePlan=()=>{setPlans(previous=>previous.filter(plan=>plan.id!==deleteId));closeModal();setDrawer(false);triggerToast('Plan deleted locally.');};
 const completeActivity=id=>setPlans(previous=>previous.map(plan=>plan.id===active.id?{...plan,activities:plan.activities.map(item=>item.id===id?{...item,complete:true}:item)}:plan));
 const triggerDeleteActivity=id=>{setActivityTarget(id);setModal('delete-activity-modal');};
 const confirmDeleteActivity=()=>{setPlans(previous=>previous.map(plan=>plan.id===active.id?{...plan,activities:plan.activities.filter(item=>item.id!==activityTarget)}:plan));closeModal();};
 const triggerExport=format=>{setExportMenu(false);triggerToast(format+' export is a prototype. No file was generated.');};
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 useEffect(()=>{const close=event=>{if(!event.target.closest('#export-menu')&&!event.target.closest('[data-export-trigger]'))setExportMenu(false);};const keydown=event=>{if(event.key==='Escape')setExportMenu(false);};window.addEventListener('click',close);window.addEventListener('keydown',keydown);return()=>{window.removeEventListener('click',close);window.removeEventListener('keydown',keydown);};},[]);
 useEffect(()=>{
  const id=modal||(profile?'candidate-popover':drawer?'succession-drawer':null);if(!id)return;const dialog=document.getElementById(id),previous=document.activeElement;
  dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',id.replaceAll('-',' '));const controls=()=>[...dialog.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled);controls()[0]?.focus();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const keydown=event=>{if(event.key==='Escape'){if(modal)setModal(null);else if(profile)setProfile('');else setDrawer(false);}if(event.key==='Tab'){const items=controls(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};document.addEventListener('keydown',keydown);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keydown);previous?.focus();};
 },[modal,profile,drawer]);
 return (<><Sidebar activePage="succession" /><div className="pl-64"><Header /><main className="relative pt-16 bg-surface min-h-screen"><div className="flex flex-col w-full">

<div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none" id="toast-container">{toast&&<div role="status" className="pointer-events-auto bg-inverse-surface text-inverse-on-surface p-4 rounded-xl shadow-xl">{toast}</div>}</div>

<div className="w-full bg-[#0E2B3D] text-white px- space-md py-2.5 flex items-center justify-between border-b border-white/10 shadow-md">
<div className="flex items-center gap-2 overflow-x-auto py-1 text-xs">
<span className="flex items-center gap-1 font-semibold text-[#1CCA9B] uppercase tracking-wider pl-2 pr-1">
<span className="material-symbols-outlined text-sm">tune</span> Rig
      </span>
<button className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 transition-all font-medium text-white flex items-center gap-1 active:scale-95" onClick={event=>{rigView('roles')}}>1. Critical Roles Grid</button>
<button className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 transition-all font-medium text-white flex items-center gap-1 active:scale-95" onClick={event=>{openModal('create-plan-modal')}}>2. + Create Plan</button>
<button className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 transition-all font-medium text-white flex items-center gap-1 active:scale-95" onClick={event=>{openDrawer('CTO')}}>3. Detail Drawer</button>
<button className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 transition-all font-medium text-white flex items-center gap-1 active:scale-95" onClick={event=>{openModal('add-successor-modal')}}>4. + Add Successor</button>
<button className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 transition-all font-medium text-white flex items-center gap-1 active:scale-95" onClick={event=>{openModal('remove-successor-modal')}}>5. Remove Confirm</button>
<button className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 transition-all font-medium text-white flex items-center gap-1 active:scale-95" onClick={event=>{rigView('ninebox')}}>6. 9-Box Matrix</button>
<button className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 transition-all font-medium text-white flex items-center gap-1 active:scale-95" onClick={event=>{triggerSamplePopover(event)}}>7. 9-Box Popover</button>
<button className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 transition-all font-medium text-white flex items-center gap-1 active:scale-95" onClick={event=>{openModal('dev-activity-modal')}}>8. Dev Action Modal</button>
<button className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 transition-all font-medium text-white flex items-center gap-1 active:scale-95" onClick={event=>{openModal('delete-plan-modal')}}>9. Delete Plan Confirm</button>
<button className="px-2.5 py-1 rounded bg-amber-400/20 text-amber-200 hover:bg-amber-400/30 transition-all font-medium flex items-center gap-1 active:scale-95" onClick={event=>{rigView('empty')}}>10. Empty State</button>
</div>
<div className="hidden lg:flex items-center gap-2 pr-2 text-xs text-white/60">
<span className="inline-block w-2 h-2 rounded-full bg-[#1CCA9B]"></span>
<span>Sim Active</span>
</div>
</div>

<div className="p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto w-full">

<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
<div>
<div className="flex items-center gap-2 mb-1.5">
<span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#008564]/10 text-[#00694f] flex items-center gap-1">
<span className="material-symbols-outlined text-xs">verified</span> Enterprise Pipeline v4.2
          </span>
<span className="text-xs text-[#6d7a73]">• Bengaluru HQ, Mumbai Hub &amp; Pune Tech Park</span>
</div>
<h1 className="font-display-sm text-display-sm tracking-tight text-[#111c2d]">Succession Planning &amp; Leadership Pipeline</h1><p className="text-body-sm text-secondary">Local sample data ? {plans.length} critical roles</p>
<p className="font-body-md text-body-md text-[#3d4944] mt-1 max-w-3xl">
          Identify critical role vulnerabilities, evaluate leadership bench strength, and mitigate talent continuity risks across mission-critical executive roles.
        </p>
</div>
<div className="flex flex-wrap items-center gap-3">

<div className="bg-surface-container-low p-1 rounded-xl flex items-center shadow-inner">
<button className={"px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5" + (view==='roles' ? ' bg-white text-primary shadow-sm' : '')} id="toggle-cards-btn" onClick={event=>{switchView('roles')}}>
<span className="material-symbols-outlined text-base">grid_view</span> Role Cards
          </button>
<button className={"px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 text-[#3d4944] hover:text-[#111c2d]" + (view==='ninebox' ? ' bg-white text-primary shadow-sm' : '')} id="toggle-matrix-btn" onClick={event=>{switchView('ninebox')}}>
<span className="material-symbols-outlined text-base">apps</span> 9-Box Matrix
          </button>
</div>

<div className="relative">
<button className="px-4 py-2 bg-surface-container-lowest text-[#111c2d] hover:bg-surface-container rounded-lg text-sm font-medium transition-all shadow-sm flex items-center gap-2" data-export-trigger onClick={event=>{toggleDropdown('export-menu')}}>
<span className="material-symbols-outlined text-base">download</span> Export
            <span className="material-symbols-outlined text-sm">arrow_drop_down</span>
</button>
<div className={"absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl py-1 z-30" + (exportMenu ? '' : ' hidden')} id="export-menu">
<button className="w-full text-left px-4 py-2 text-sm text-[#111c2d] hover:bg-surface-container-low flex items-center gap-2" onClick={event=>{triggerExport('PDF Executive Summary')}}>
<span className="material-symbols-outlined text-base text-[#ba1a1a]">picture_as_pdf</span> Executive PDF Deck
            </button>
<button className="w-full text-left px-4 py-2 text-sm text-[#111c2d] hover:bg-surface-container-low flex items-center gap-2" onClick={event=>{triggerExport('Excel Talent Matrix (.xlsx)')}}>
<span className="material-symbols-outlined text-base text-[#00694f]">table_view</span> Full Excel Roster
            </button>
<button className="w-full text-left px-4 py-2 text-sm text-[#111c2d] hover:bg-surface-container-low flex items-center gap-2" onClick={event=>{triggerExport('Board Presentation (PPTX)')}}>
<span className="material-symbols-outlined text-base text-[#476175]">slideshow</span> Board Slides
            </button>
</div>
</div>

<button className="px-4 py-2 bg-[#00694f] hover:bg-[#00513c] text-white rounded-lg text-sm font-medium transition-all shadow-md hover:shadow-lg flex items-center gap-2 active:scale-95" onClick={event=>{openModal('create-plan-modal')}}>
<span className="material-symbols-outlined text-base">add_circle</span> + Create Plan
        </button>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
<div className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
<div className="flex items-center justify-between mb-2">
<span className="text-xs font-semibold text-[#6d7a73] tracking-wide uppercase">Critical Roles Identified</span>
<div className="p-2 bg-surface-container-low rounded-xl text-[#00694f]">
<span className="material-symbols-outlined text-xl">shield_person</span>
</div>
</div>
<div className="flex items-baseline gap-2">
<span className="font-display-sm text-display-sm font-bold text-[#111c2d]">18</span>
<span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-[#ba1a1a]">4 High Risk</span>
</div>
<p className="text-xs text-[#3d4944] mt-2 flex items-center gap-1">
<span className="material-symbols-outlined text-xs text-[#00694f]">verified</span> 100% executive coverage mapped
        </p>
<div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#00694f] to-transparent"></div>
</div>
<div className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
<div className="flex items-center justify-between mb-2">
<span className="text-xs font-semibold text-[#6d7a73] tracking-wide uppercase">Bench Strength Ratio</span>
<div className="p-2 bg-surface-container-low rounded-xl text-[#00694f]">
<span className="material-symbols-outlined text-xl">vital_signs</span>
</div>
</div>
<div className="flex items-baseline gap-2">
<span className="font-display-sm text-display-sm font-bold text-[#111c2d]">82.4%</span>
<span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#008564]/10 text-[#00694f]">+5.1% YoY</span>
</div>
<div className="w-full bg-surface-container-high h-1.5 rounded-full mt-2.5 overflow-hidden">
<div className="bg-[#00694f] h-full rounded-full" style={{"width":"82.4%"}}></div>
</div>
</div>
<div className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
<div className="flex items-center justify-between mb-2">
<span className="text-xs font-semibold text-[#6d7a73] tracking-wide uppercase">Ready Now Successors</span>
<div className="p-2 bg-surface-container-low rounded-xl text-[#00694f]">
<span className="material-symbols-outlined text-xl">electric_bolt</span>
</div>
</div>
<div className="flex items-baseline gap-2">
<span className="font-display-sm text-display-sm font-bold text-[#111c2d]">14</span>
<span className="text-xs text-[#3d4944]">Candidates</span>
</div>
<p className="text-xs text-[#00694f] mt-2 font-medium flex items-center gap-1">
<span className="material-symbols-outlined text-xs">trending_up</span> 6 fast-tracked through Lead Academy
        </p>
<div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-transparent"></div>
</div>
<div className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
<div className="flex items-center justify-between mb-2">
<span className="text-xs font-semibold text-[#6d7a73] tracking-wide uppercase">Talent At-Risk Rate</span>
<div className="p-2 bg-surface-container-low rounded-xl text-[#476175]">
<span className="material-symbols-outlined text-xl">warning</span>
</div>
</div>
<div className="flex items-baseline gap-2">
<span className="font-display-sm text-display-sm font-bold text-[#111c2d]">6.2%</span>
<span className="text-xs text-[#3d4944] font-medium">Target: &lt;8.0%</span>
</div>
<p className="text-xs text-[#3d4944] mt-2 flex items-center gap-1">
<span className="material-symbols-outlined text-xs text-[#00694f]">check_circle</span> Healthy retention safety margin
        </p>
<div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-transparent"></div>
</div>
</div>

<div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
<div className="relative flex-1 max-w-md">
<span className="material-symbols-outlined absolute left-3 top-2.5 text-[#6d7a73] text-lg">search</span>
<input className="w-full pl-9 pr-4 py-2 bg-surface-container-low rounded-xl text-sm text-[#111c2d] placeholder-[#6d7a73] focus:outline-none focus:ring-2 focus:ring-[#00694f]" id="role-search-input"  placeholder="Search role title, incumbent or successor..." type="text" aria-label="role-search-input" value={search} onChange={event=>setSearch(event.target.value)} />
</div>
<div className="flex flex-wrap items-center gap-2.5">

<div className="flex items-center gap-1.5 text-xs text-[#6d7a73]">
<span className="font-medium">Dept:</span>
<select className="px-2.5 py-1.5 bg-surface-container-low rounded-lg text-xs font-medium text-[#111c2d] focus:outline-none focus:ring-1 focus:ring-[#00694f]" id="dept-filter"  aria-label="dept-filter" value={department} onChange={event=>setDepartment(event.target.value)}>
<option value="ALL">All Departments</option>
<option value="Engineering">Engineering &amp; Tech</option>
<option value="Product">Product Management</option>
<option value="Finance">Finance &amp; Accounts</option>
<option value="Operations">Operations</option>
</select>
</div>

<div className="flex items-center gap-1.5 text-xs text-[#6d7a73]">
<span className="font-medium">Risk:</span>
<select className="px-2.5 py-1.5 bg-surface-container-low rounded-lg text-xs font-medium text-[#111c2d] focus:outline-none focus:ring-1 focus:ring-[#00694f]" id="risk-filter"  aria-label="risk-filter" value={risk} onChange={event=>setRisk(event.target.value)}>
<option value="ALL">All Risks</option>
<option value="High">High Loss Risk</option>
<option value="Medium">Medium Loss Risk</option>
<option value="Low">Low Loss Risk</option>
</select>
</div>

<div className="flex items-center gap-1.5 text-xs text-[#6d7a73]">
<span className="font-medium">Readiness:</span>
<select className="px-2.5 py-1.5 bg-surface-container-low rounded-lg text-xs font-medium text-[#111c2d] focus:outline-none focus:ring-1 focus:ring-[#00694f]" id="readiness-filter"  aria-label="readiness-filter" value={readiness} onChange={event=>setReadiness(event.target.value)}>
<option value="ALL">All Tiers</option>
<option value="Ready Now">Has 'Ready Now'</option>
<option value="1-2 Years">Has '1-2 Years'</option>
</select>
</div>
<button className="p-2 text-[#6d7a73] hover:text-[#111c2d] hover:bg-surface-container-low rounded-lg transition-colors" onClick={event=>{resetFilters()}} title="Reset Filters">
<span className="material-symbols-outlined text-base">restart_alt</span>
</button>
</div>
</div>

<div className={"space-y-6" + (view==='roles' ? '' : ' hidden')} id="roles-view-container">
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-6" id="roles-grid">{filtered.map(plan=><SuccessionCard key={plan.id} plan={plan} onOpen={openPlan} onEdit={editPlan} onDelete={triggerDeletePlanModal} onProfile={openCandidateProfile}/>)}</div>

<div className={"bg-white rounded-2xl p-12 text-center max-w-xl mx-auto shadow-sm" + (filtered.length===0 ? '' : ' hidden')} id="empty-state-card">
<div className="w-16 h-16 rounded-full bg-surface-container-low text-[#00694f] flex items-center justify-center mx-auto mb-4">
<span className="material-symbols-outlined text-3xl">manage_search</span>
</div>
<h4 className="font-headline-sm text-headline-sm text-[#111c2d] font-semibold mb-2">No Matching Succession Plans Found</h4>
<p className="font-body-md text-body-md text-[#3d4944] mb-6">
          There are no critical leadership pipelines matching your selected filter parameters or search queries. Try adjusting or clearing your active filters.
        </p>
<button className="px-4 py-2 bg-[#00694f] text-white rounded-lg text-sm font-medium hover:bg-[#00513c] transition-colors shadow" onClick={event=>{resetFilters()}}>
          Reset All Filters
        </button>
</div>
</div>

<div className={"space-y-6" + (view==='ninebox' ? '' : ' hidden')} id="matrix-view-container"><p className="text-body-sm text-outline mb-3">Illustrative 9-box placements from the supplied sample. Plan changes update role pools and profile readiness.</p>
<div className="bg-white rounded-2xl p-6 shadow-sm">
<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
<div>
<h3 className="font-headline-md text-headline-md text-[#111c2d]">9-Box Performance vs. Potential Matrix</h3>
<p className="text-xs text-[#6d7a73] mt-0.5">Click any employee token to view leadership readiness dossier &amp; fast-track options.</p>
</div>
<div className="flex items-center gap-3">
<span className="flex items-center gap-1 text-xs text-[#3d4944]"><span className="w-3 h-3 rounded bg-emerald-500"></span> Ready Now</span>
<span className="flex items-center gap-1 text-xs text-[#3d4944]"><span className="w-3 h-3 rounded bg-amber-500"></span> 1-2 Years</span>
<span className="flex items-center gap-1 text-xs text-[#3d4944]"><span className="w-3 h-3 rounded bg-blue-500"></span> 3+ Years</span>
</div>
</div>

<div className="relative pl-12 pb-12">

<div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 origin-center text-xs font-bold tracking-widest text-[#00694f] uppercase flex items-center gap-1">
<span className="material-symbols-outlined text-sm">arrow_upward</span> Potential
          </div>

<div className="grid grid-cols-3 gap-3 min-h-[580px]">


<div className="bg-surface-container-low/70 rounded-xl p-4 flex flex-col justify-between hover:bg-surface-container-low transition-colors">
<div className="flex items-center justify-between">
<span className="text-xs font-bold text-[#111c2d]">Enigmas</span>
<span className="text-[10px] text-[#6d7a73] px-1.5 py-0.5 rounded bg-white font-medium">High Pot / Low Perf</span>
</div>
<div className="space-y-2 my-2">
<div className="p-2 bg-white rounded-lg shadow-xs hover:shadow cursor-pointer transition-all flex items-center justify-between" onClick={event=>{openCandidateProfile('Divya Rao')}}>
<div className="flex items-center gap-2">
<div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">DR</div>
<span className="text-xs font-semibold text-[#111c2d]">Divya Rao</span>
</div>
<span className="w-2 h-2 rounded-full bg-blue-500" title="3+ Years"></span>
</div>
</div>
<p className="text-[10px] text-[#6d7a73]">Strategy: Coaching &amp; role alignment</p>
</div>

<div className="bg-amber-50/60 rounded-xl p-4 flex flex-col justify-between hover:bg-amber-50 transition-colors">
<div className="flex items-center justify-between">
<span className="text-xs font-bold text-amber-900">High Potentials</span>
<span className="text-[10px] text-amber-800 px-1.5 py-0.5 rounded bg-white font-medium">High Pot / Med Perf</span>
</div>
<div className="space-y-2 my-2">
<div className="p-2 bg-white rounded-lg shadow-xs hover:shadow cursor-pointer transition-all flex items-center justify-between" onClick={event=>{openCandidateProfile('Rohan Verma')}}>
<div className="flex items-center gap-2">
<div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center">RV</div>
<div>
<p className="text-xs font-semibold text-[#111c2d]">Rohan Verma</p>
<p className="text-[10px] text-[#6d7a73]">Principal Eng</p>
</div>
</div>
<span className="w-2 h-2 rounded-full bg-amber-500" title="1-2 Years"></span>
</div>
</div>
<p className="text-[10px] text-amber-800">Strategy: Stretch projects &amp; board exposure</p>
</div>

<div className="bg-emerald-50 rounded-xl p-4 flex flex-col justify-between border-2 border-emerald-500/20 hover:border-emerald-500/40 transition-colors">
<div className="flex items-center justify-between">
<span className="text-xs font-bold text-[#00694f] flex items-center gap-1">
<span className="material-symbols-outlined text-sm text-[#00694f]">stars</span> Star Performers
                </span>
<span className="text-[10px] text-[#00694f] px-1.5 py-0.5 rounded bg-emerald-100 font-semibold">Ready Now</span>
</div>
<div className="space-y-2 my-2">
<div className="p-2 bg-white rounded-lg shadow-sm hover:shadow cursor-pointer transition-all flex items-center justify-between" onClick={event=>{openCandidateProfile('Aarav Sharma')}}>
<div className="flex items-center gap-2">
<div className="w-6 h-6 rounded-full bg-[#00694f] text-white text-xs font-bold flex items-center justify-center">AS</div>
<div>
<p className="text-xs font-semibold text-[#111c2d]">Aarav Sharma</p>
<p className="text-[10px] text-[#6d7a73]">Staff Architect</p>
</div>
</div>
<span className="w-2 h-2 rounded-full bg-emerald-500" title="Ready Now"></span>
</div>
<div className="p-2 bg-white rounded-lg shadow-sm hover:shadow cursor-pointer transition-all flex items-center justify-between" onClick={event=>{openCandidateProfile('Priya Nair')}}>
<div className="flex items-center gap-2">
<div className="w-6 h-6 rounded-full bg-[#008564] text-white text-xs font-bold flex items-center justify-center">PN</div>
<div>
<p className="text-xs font-semibold text-[#111c2d]">Priya Nair</p>
<p className="text-[10px] text-[#6d7a73]">Director Ops</p>
</div>
</div>
<span className="w-2 h-2 rounded-full bg-emerald-500" title="Ready Now"></span>
</div>
</div>
<p className="text-[10px] text-[#00694f] font-medium">Strategy: Executive mentorship &amp; key retention</p>
</div>


<div className="bg-surface-container-low/70 rounded-xl p-4 flex flex-col justify-between hover:bg-surface-container-low transition-colors">
<div className="flex items-center justify-between">
<span className="text-xs font-bold text-[#111c2d]">Dilemmas</span>
<span className="text-[10px] text-[#6d7a73] px-1.5 py-0.5 rounded bg-white font-medium">Med Pot / Low Perf</span>
</div>
<div className="py-4 text-center text-xs text-[#6d7a73] italic">No active candidates</div>
<p className="text-[10px] text-[#6d7a73]">Strategy: Performance turnaround</p>
</div>

<div className="bg-surface-container-low/70 rounded-xl p-4 flex flex-col justify-between hover:bg-surface-container-low transition-colors">
<div className="flex items-center justify-between">
<span className="text-xs font-bold text-[#111c2d]">Core Players</span>
<span className="text-[10px] text-[#6d7a73] px-1.5 py-0.5 rounded bg-white font-medium">Med Pot / Med Perf</span>
</div>
<div className="space-y-2 my-2">
<div className="p-2 bg-white rounded-lg shadow-xs hover:shadow cursor-pointer transition-all flex items-center justify-between" onClick={event=>{openCandidateProfile('Neha Sen')}}>
<div className="flex items-center gap-2">
<div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center">NS</div>
<span className="text-xs font-semibold text-[#111c2d]">Neha Sen</span>
</div>
<span className="w-2 h-2 rounded-full bg-amber-500" title="1-2 Years"></span>
</div>
<div className="p-2 bg-white rounded-lg shadow-xs hover:shadow cursor-pointer transition-all flex items-center justify-between" onClick={event=>{openCandidateProfile('Tanvi Rao')}}>
<div className="flex items-center gap-2">
<div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">TR</div>
<span className="text-xs font-semibold text-[#111c2d]">Tanvi Rao</span>
</div>
<span className="w-2 h-2 rounded-full bg-blue-500" title="3+ Years"></span>
</div>
</div>
<p className="text-[10px] text-[#6d7a73]">Strategy: Professional skill enhancement</p>
</div>

<div className="bg-emerald-50/40 rounded-xl p-4 flex flex-col justify-between hover:bg-emerald-50 transition-colors">
<div className="flex items-center justify-between">
<span className="text-xs font-bold text-[#00694f]">High Performers</span>
<span className="text-[10px] text-[#00694f] px-1.5 py-0.5 rounded bg-white font-medium">Med Pot / High Perf</span>
</div>
<div className="space-y-2 my-2">
<div className="p-2 bg-white rounded-lg shadow-xs hover:shadow cursor-pointer transition-all flex items-center justify-between" onClick={event=>{openCandidateProfile('Vikram Patel')}}>
<div className="flex items-center gap-2">
<div className="w-6 h-6 rounded-full bg-emerald-100 text-[#00694f] text-xs font-bold flex items-center justify-center">VP</div>
<div>
<p className="text-xs font-semibold text-[#111c2d]">Vikram Patel</p>
<p className="text-[10px] text-[#6d7a73]">Eng Director</p>
</div>
</div>
<span className="w-2 h-2 rounded-full bg-emerald-500" title="Ready Now"></span>
</div>
<div className="p-2 bg-white rounded-lg shadow-xs hover:shadow cursor-pointer transition-all flex items-center justify-between" onClick={event=>{openCandidateProfile('Sneha Deshmukh')}}>
<div className="flex items-center gap-2">
<div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center">SD</div>
<div>
<p className="text-xs font-semibold text-[#111c2d]">Sneha Deshmukh</p>
<p className="text-[10px] text-[#6d7a73]">Lead Manager</p>
</div>
</div>
<span className="w-2 h-2 rounded-full bg-amber-500" title="1-2 Years"></span>
</div>
</div>
<p className="text-[10px] text-[#00694f]">Strategy: Broaden scope &amp; leadership</p>
</div>


<div className="bg-rose-50/40 rounded-xl p-4 flex flex-col justify-between hover:bg-rose-50 transition-colors">
<div className="flex items-center justify-between">
<span className="text-xs font-bold text-[#ba1a1a]">Action Needed</span>
<span className="text-[10px] text-rose-800 px-1.5 py-0.5 rounded bg-white font-medium">Low Pot / Low Perf</span>
</div>
<div className="py-4 text-center text-xs text-[#6d7a73] italic">No active candidates</div>
<p className="text-[10px] text-[#ba1a1a]">Strategy: Reassign or exit plan</p>
</div>

<div className="bg-surface-container-low/70 rounded-xl p-4 flex flex-col justify-between hover:bg-surface-container-low transition-colors">
<div className="flex items-center justify-between">
<span className="text-xs font-bold text-[#111c2d]">Effective Contributors</span>
<span className="text-[10px] text-[#6d7a73] px-1.5 py-0.5 rounded bg-white font-medium">Low Pot / Med Perf</span>
</div>
<div className="space-y-2 my-2">
<div className="p-2 bg-white rounded-lg shadow-xs hover:shadow cursor-pointer transition-all flex items-center justify-between" onClick={event=>{openCandidateProfile('Kabir Joshi')}}>
<div className="flex items-center gap-2">
<div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">KJ</div>
<span className="text-xs font-semibold text-[#111c2d]">Kabir Joshi</span>
</div>
<span className="w-2 h-2 rounded-full bg-blue-500" title="3+ Years"></span>
</div>
</div>
<p className="text-[10px] text-[#6d7a73]">Strategy: Maintain steady contribution</p>
</div>

<div className="bg-surface-container-low/70 rounded-xl p-4 flex flex-col justify-between hover:bg-surface-container-low transition-colors">
<div className="flex items-center justify-between">
<span className="text-xs font-bold text-[#111c2d]">Solid Professionals</span>
<span className="text-[10px] text-[#6d7a73] px-1.5 py-0.5 rounded bg-white font-medium">Low Pot / High Perf</span>
</div>
<div className="space-y-2 my-2">
<div className="p-2 bg-white rounded-lg shadow-xs hover:shadow cursor-pointer transition-all flex items-center justify-between" onClick={event=>{openCandidateProfile('Rohan Mehta')}}>
<div className="flex items-center gap-2">
<div className="w-6 h-6 rounded-full bg-emerald-100 text-[#00694f] text-xs font-bold flex items-center justify-center">RM</div>
<div>
<p className="text-xs font-semibold text-[#111c2d]">Rohan Mehta</p>
<p className="text-[10px] text-[#6d7a73]">Sr Product Lead</p>
</div>
</div>
<span className="w-2 h-2 rounded-full bg-emerald-500" title="Ready Now"></span>
</div>
</div>
<p className="text-[10px] text-[#6d7a73]">Strategy: Recognize expertise &amp; retain</p>
</div>
</div>

<div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-xs font-bold tracking-widest text-[#00694f] uppercase flex items-center gap-1">
            Performance <span className="material-symbols-outlined text-sm">arrow_forward</span>
</div>
</div>
</div>
</div>

<div className="bg-white rounded-2xl p-6 shadow-sm">
<div className="flex items-center justify-between mb-4">
<div>
<h3 className="font-headline-sm text-headline-sm font-semibold text-[#111c2d]">Interactive Control → Result Mapping Matrix</h3>
<p className="text-xs text-[#6d7a73]">Complete blueprint of clickable triggers, state mutations, and dismiss flows across the succession suite.</p>
</div>
<span className="px-2.5 py-1 rounded bg-[#008564]/10 text-[#00694f] text-xs font-semibold">10 Verified Interactions</span>
</div>
<div className="overflow-x-auto">
<table className="w-full text-left text-xs">
<thead>
<tr className="border-b border-slate-100 text-[#6d7a73] font-semibold uppercase tracking-wider">
<th className="py-2.5 px-3">Control Element</th>
<th className="py-2.5 px-3">Action Type</th>
<th className="py-2.5 px-3">Expected Result</th>
<th className="py-2.5 px-3">Dismiss / Return Path</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100 text-[#111c2d]">
<tr className="hover:bg-surface-container-low/50">
<td className="py-2.5 px-3 font-semibold text-[#00694f]">1. Critical Roles Grid</td>
<td className="py-2.5 px-3">Rig Bar Button / Tab</td>
<td className="py-2.5 px-3">Switches view to the 4 critical role cards</td>
<td className="py-2.5 px-3">Active persistent screen</td>
</tr>
<tr className="hover:bg-surface-container-low/50">
<td className="py-2.5 px-3 font-semibold text-[#00694f]">2. + Create Plan</td>
<td className="py-2.5 px-3">Header Button / Rig #2</td>
<td className="py-2.5 px-3">Opens Create Succession Plan dialog with multi-input attributes</td>
<td className="py-2.5 px-3">Cancel button / Backdrop click / Save action</td>
</tr>
<tr className="hover:bg-surface-container-low/50">
<td className="py-2.5 px-3 font-semibold text-[#00694f]">3. Succession Detail Drawer</td>
<td className="py-2.5 px-3">Role Card Click / Rig #3</td>
<td className="py-2.5 px-3">Slides open right-hand deep drawer with pool roster &amp; activities</td>
<td className="py-2.5 px-3">Close 'X' icon / Backdrop click</td>
</tr>
<tr className="hover:bg-surface-container-low/50">
<td className="py-2.5 px-3 font-semibold text-[#00694f]">4. + Add Successor</td>
<td className="py-2.5 px-3">Drawer Header / Rig #4</td>
<td className="py-2.5 px-3">Opens Successor Nomination wizard dialog</td>
<td className="py-2.5 px-3">Cancel button / 'Add to Pipeline' toast confirmation</td>
</tr>
<tr className="hover:bg-surface-container-low/50">
<td className="py-2.5 px-3 font-semibold text-[#00694f]">5. Remove Successor</td>
<td className="py-2.5 px-3">Table Trash Action / Rig #5</td>
<td className="py-2.5 px-3">Presents archival warning confirmation modal</td>
<td className="py-2.5 px-3">Cancel / 'Yes, Remove' triggers red toast notification</td>
</tr>
<tr className="hover:bg-surface-container-low/50">
<td className="py-2.5 px-3 font-semibold text-[#00694f]">6. 9-Box Talent Matrix</td>
<td className="py-2.5 px-3">Segmented Switch / Rig #6</td>
<td className="py-2.5 px-3">Transitions canvas to 3x3 Potential vs Performance grid</td>
<td className="py-2.5 px-3">Toggle back to Role Cards anytime</td>
</tr>
<tr className="hover:bg-surface-container-low/50">
<td className="py-2.5 px-3 font-semibold text-[#00694f]">7. 9-Box Popover</td>
<td className="py-2.5 px-3">Candidate Token Click / Rig #7</td>
<td className="py-2.5 px-3">Displays candidate profile flyout card with compensation and readiness</td>
<td className="py-2.5 px-3">Close 'x' / Backdrop click / Action button</td>
</tr>
<tr className="hover:bg-surface-container-low/50">
<td className="py-2.5 px-3 font-semibold text-[#00694f]">8. Development Action</td>
<td className="py-2.5 px-3">Drawer Section / Rig #8</td>
<td className="py-2.5 px-3">Opens Milestone &amp; INR Budget allocation modal</td>
<td className="py-2.5 px-3">Cancel button / 'Save Activity'</td>
</tr>
<tr className="hover:bg-surface-container-low/50">
<td className="py-2.5 px-3 font-semibold text-[#00694f]">9. Delete Plan Confirm</td>
<td className="py-2.5 px-3">3-dots Card Menu / Rig #9</td>
<td className="py-2.5 px-3">Opens red destructive warning confirmation dialog</td>
<td className="py-2.5 px-3">Cancel / 'Yes, Delete' removes role card with toast</td>
</tr>
<tr className="hover:bg-surface-container-low/50">
<td className="py-2.5 px-3 font-semibold text-[#00694f]">10. Empty State</td>
<td className="py-2.5 px-3">Rig Bar #10 / Impossible Filter</td>
<td className="py-2.5 px-3">Renders clear illustrated empty state card</td>
<td className="py-2.5 px-3">'Reset Filters' button immediately restores cards</td>
</tr>
</tbody>
</table>
</div>
</div>
</div>


<div className={"fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" + (modal==='create-plan-modal' ? '' : ' hidden')} id="create-plan-modal">
<div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
<div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
<h3 className="font-headline-sm text-headline-sm font-semibold text-[#111c2d] flex items-center gap-2">
<span className="material-symbols-outlined text-[#00694f]">add_moderator</span> {editingId ? "Edit Succession Plan" : "Create Critical Succession Plan"}
        </h3>
<button className="text-[#6d7a73] hover:text-[#111c2d] p-1 rounded-lg" onClick={event=>{closeModal('create-plan-modal')}}>
<span className="material-symbols-outlined">close</span>
</button>
</div>
<form className="space-y-4" onSubmit={event=>{handleCreatePlanSubmit(event)}}>
<div>
<label className="block text-xs font-semibold text-[#111c2d] mb-1">Critical Role Title *</label>
<input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00694f]" placeholder="e.g. Chief Operating Officer (COO)" required type="text" aria-label="title" value={fields.title??''} onChange={event=>setField('title',event.target.value)} />
</div>
<div className="grid grid-cols-2 gap-4">
<div>
<label className="block text-xs font-semibold text-[#111c2d] mb-1">Current Incumbent Name</label>
<input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00694f]" placeholder="e.g. Meera Ramanathan" required type="text" aria-label="incumbent" value={fields.incumbent??''} onChange={event=>setField('incumbent',event.target.value)} />
</div>
<div>
<label className="block text-xs font-semibold text-[#111c2d] mb-1">Department</label>
<select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00694f]" aria-label="department" value={fields.department??''} onChange={event=>setField('department',event.target.value)}>
<option>Engineering &amp; Tech</option>
<option>Product Management</option>
<option>Finance &amp; Accounts</option>
<option>People &amp; Culture</option>
<option>Operations</option>
</select>
</div>
</div>
<div className="grid grid-cols-2 gap-4">
<div>
<label className="block text-xs font-semibold text-[#111c2d] mb-1">Impact of Loss</label>
<select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00694f]" aria-label="impact" value={fields.impact??''} onChange={event=>setField('impact',event.target.value)}>
<option>Severe (Business critical halt)</option>
<option>Critical (Significant disruption)</option>
<option>Moderate (Manageable impact)</option>
</select>
</div>
<div>
<label className="block text-xs font-semibold text-[#111c2d] mb-1">Risk of Loss (Flight Probability)</label>
<select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00694f]" aria-label="risk" value={fields.risk??''} onChange={event=>setField('risk',event.target.value)}>
<option>High (Likely transition &lt; 6 mos)</option>
<option>Medium (Possible 6-18 mos)</option>
<option>Low (Stable &gt; 24 mos)</option>
</select>
</div>
</div>
<div className="grid grid-cols-2 gap-4">
<div>
<label className="block text-xs font-semibold text-[#111c2d] mb-1">Target Bench Capacity</label>
<input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00694f]" max="10" min="1" type="number"  aria-label="capacity" value={fields.capacity??''} onChange={event=>setField('capacity',event.target.value)} />
</div>
<div>
<label className="block text-xs font-semibold text-[#111c2d] mb-1">Primary Work Location</label>
<input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00694f]" type="text"  aria-label="location" value={fields.location??''} onChange={event=>setField('location',event.target.value)} />
</div>
</div>
<div>
<label className="block text-xs font-semibold text-[#111c2d] mb-1">Strategic Contingency Notes</label>
<textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00694f]" placeholder="Describe transition vulnerabilities, specialized vendor relationships, or critical patent custodianship..." rows="2"   aria-label="notes" value={fields.notes??''} onChange={event=>setField('notes',event.target.value)} />
</div>
<div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
<button className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-[#3d4944] hover:bg-slate-50 transition-colors" onClick={event=>{closeModal('create-plan-modal')}} type="button">
            Cancel
          </button>
<button className="px-4 py-2 bg-[#00694f] hover:bg-[#00513c] text-white rounded-lg text-xs font-semibold transition-all shadow-md active:scale-95" type="submit">
            Save Succession Plan
          </button>
</div>
</form>
</div>
</div>

<div className={"fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs transition-opacity duration-200" + (drawer ? '' : ' hidden')} id="succession-drawer"><div className="absolute inset-0 bg-[#0E2B3D]/40 backdrop-blur-sm" onClick={closeDrawer}></div><div className="absolute inset-y-0 right-0 max-w-2xl w-full bg-surface shadow-2xl flex flex-col"><div className="p-6 bg-surface-container-low flex justify-between"><div><h3 id="drawer-role-title" className="text-headline-sm font-semibold">{active.title}</h3><p className="text-body-sm text-outline">{active.incumbent} · {active.department}</p></div><button aria-label="Close succession drawer" onClick={closeDrawer}><span className="material-symbols-outlined">close</span></button></div><div className="flex-1 overflow-y-auto p-6 space-y-6"><div className="flex justify-between items-center"><h4 className="text-title-md font-semibold">Successors ({active.successors.length})</h4><button className="p-2 rounded bg-primary text-on-primary" onClick={()=>openModal('add-successor-modal')}>Nominate Successor</button></div>{active.successors.map(person=><div key={person.name} className="p-4 bg-surface-container-low rounded-xl flex justify-between gap-3"><div><button className="font-semibold text-primary" onClick={()=>openCandidateProfile(person.name)}>{person.name}</button><p className="text-body-sm">{person.readiness} · {person.potential}</p></div><button className="text-error text-body-sm" onClick={()=>triggerRemoveSuccessor(person.name)}>Remove</button></div>)}<div className="flex justify-between items-center"><h4 className="text-title-md font-semibold">Development Activities</h4><button className="p-2 rounded bg-primary text-on-primary" onClick={()=>openModal('dev-activity-modal')}>Add Activity</button></div>{active.activities.map(item=><div key={item.id} className="p-4 rounded-xl bg-surface-container-low space-y-2"><p className="font-semibold">{item.title}</p><p className="text-body-sm">{item.assignee} · {item.complete?'100% Complete':'In Progress'}</p><div className="flex gap-3"><button className="text-primary text-body-sm" onClick={()=>completeActivity(item.id)}>Mark Complete</button><button className="text-error text-body-sm" onClick={()=>triggerDeleteActivity(item.id)}>Delete Activity</button></div></div>)}</div><div className="p-6 bg-surface-container-low flex justify-end"><button onClick={closeDrawer} className="p-2 rounded bg-surface-container">Close</button></div></div></div>

<div className={"fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" + (modal==='add-successor-modal' ? '' : ' hidden')} id="add-successor-modal">
<div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
<div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
<h3 className="font-headline-sm text-headline-sm font-semibold text-[#111c2d] flex items-center gap-2">
<span className="material-symbols-outlined text-[#00694f]">person_add</span> Nominate Successor to Pipeline
        </h3>
<button className="text-[#6d7a73] hover:text-[#111c2d] p-1 rounded-lg" onClick={event=>{closeModal('add-successor-modal')}}>
<span className="material-symbols-outlined">close</span>
</button>
</div>
<form className="space-y-4" onSubmit={event=>{handleAddSuccessorSubmit(event)}}>
<div>
<label className="block text-xs font-semibold text-[#111c2d] mb-1">Select Internal Employee *</label>
<select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00694f]" required aria-label="successor" value={fields.successor??''} onChange={event=>setField('successor',event.target.value)}>
<option value="Aarav Sharma">Aarav Sharma (Staff Architect, Engineering)</option>
<option value="Vikram Patel">Vikram Patel (Director, Platform Eng)</option>
<option value="Sneha Deshmukh">Sneha Deshmukh (Lead Manager, Engineering)</option>
<option value="Pooja Hegde">Pooja Hegde (Sr Director, Financial Planning)</option>
<option value="Neha Sen">Neha Sen (Lead Product Designer)</option>
</select>
</div>
<div className="grid grid-cols-2 gap-4">
<div>
<label className="block text-xs font-semibold text-[#111c2d] mb-1">Readiness Timeline *</label>
<select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00694f]" aria-label="readiness" value={fields.readiness??''} onChange={event=>setField('readiness',event.target.value)}>
<option>Ready Now (0 - 6 Months)</option>
<option>1 to 2 Years</option>
<option>3+ Years (Long Term Pipeline)</option>
</select>
</div>
<div>
<label className="block text-xs font-semibold text-[#111c2d] mb-1">9-Box Potential Rating</label>
<select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00694f]" aria-label="potential" value={fields.potential??''} onChange={event=>setField('potential',event.target.value)}>
<option>High Potential</option>
<option>Medium Potential</option>
<option>Low / Specialist Potential</option>
</select>
</div>
</div>
<div>
<label className="block text-xs font-semibold text-[#111c2d] mb-1">Leadership Readiness Justification</label>
<textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00694f]" placeholder="Outline specific accomplishments, technical patents, team feedback, and business capability readiness..." rows="3"   aria-label="justification" value={fields.justification??''} onChange={event=>setField('justification',event.target.value)} />
</div>
<div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
<button className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-[#3d4944] hover:bg-slate-50 transition-colors" onClick={event=>{closeModal('add-successor-modal')}} type="button">
            Cancel
          </button>
<button className="px-4 py-2 bg-[#00694f] hover:bg-[#00513c] text-white rounded-lg text-xs font-semibold transition-all shadow-md active:scale-95" type="submit">
            Add to Pipeline
          </button>
</div>
</form>
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" + (modal==='remove-successor-modal' ? '' : ' hidden')} id="remove-successor-modal">
<div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
<div className="w-12 h-12 rounded-full bg-rose-100 text-[#ba1a1a] flex items-center justify-center mb-4">
<span className="material-symbols-outlined text-2xl">person_remove</span>
</div>
<h3 className="font-headline-sm text-headline-sm font-semibold text-[#111c2d]">Remove Candidate from Succession Pool?</h3>
<p className="font-body-md text-body-md text-[#3d4944] mt-2" id="remove-successor-desc">
        Are you sure you want to remove <strong id="remove-target-name">Aarav Sharma</strong> from the Chief Technology Officer succession pipeline? This will archive their readiness rating and linked development roadmaps.
      </p>
<div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
<button className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-[#3d4944] hover:bg-slate-50 transition-colors" onClick={event=>{closeModal('remove-successor-modal')}}>
          Cancel
        </button>
<button className="px-4 py-2 bg-[#ba1a1a] hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors shadow" onClick={event=>{confirmRemoveSuccessor()}}>
          Yes, Remove Candidate
        </button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" + (modal==='dev-activity-modal' ? '' : ' hidden')} id="dev-activity-modal">
<div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
<div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
<h3 className="font-headline-sm text-headline-sm font-semibold text-[#111c2d] flex items-center gap-2">
<span className="material-symbols-outlined text-[#00694f]">assignment_turned_in</span> Assign Leadership Development Activity
        </h3>
<button className="text-[#6d7a73] hover:text-[#111c2d] p-1 rounded-lg" onClick={event=>{closeModal('dev-activity-modal')}}>
<span className="material-symbols-outlined">close</span>
</button>
</div>
<form className="space-y-4" onSubmit={event=>{handleDevActivitySubmit(event)}}>
<div>
<label className="block text-xs font-semibold text-[#111c2d] mb-1">Development Activity / Program Title *</label>
<input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00694f]" placeholder="e.g. INSEAD Executive General Management Program" required type="text" aria-label="activityTitle" value={fields.activityTitle??''} onChange={event=>setField('activityTitle',event.target.value)} />
</div>
<div className="grid grid-cols-2 gap-4">
<div>
<label className="block text-xs font-semibold text-[#111c2d] mb-1">Assignee</label>
<select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00694f]" aria-label="assignee" value={fields.assignee??''} onChange={event=>setField('assignee',event.target.value)}>
<option>Aarav Sharma (Staff Architect)</option>
<option>Rohan Verma (Principal Engineer)</option>
<option>Tanvi Rao (Lead Architect)</option>
<option>Vikram Patel (Director)</option>
</select>
</div>
<div>
<label className="block text-xs font-semibold text-[#111c2d] mb-1">Target Completion Date</label>
<input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00694f]" placeholder="31 Mar 2025" type="text"  aria-label="due" value={fields.due??''} onChange={event=>setField('due',event.target.value)} />
</div>
</div>
<div className="grid grid-cols-2 gap-4">
<div>
<label className="block text-xs font-semibold text-[#111c2d] mb-1">Budget Allocation (INR ₹)</label>
<input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00694f]" type="text"  aria-label="budget" value={fields.budget??''} onChange={event=>setField('budget',event.target.value)} />
</div>
<div>
<label className="block text-xs font-semibold text-[#111c2d] mb-1">Executive Sponsor</label>
<input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00694f]" type="text"  aria-label="sponsor" value={fields.sponsor??''} onChange={event=>setField('sponsor',event.target.value)} />
</div>
</div>
<div>
<label className="block text-xs font-semibold text-[#111c2d] mb-1">Key Evaluation Milestones</label>
<textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00694f]" placeholder="List measurable milestone deliverables for board review..." rows="2"   aria-label="milestones" value={fields.milestones??''} onChange={event=>setField('milestones',event.target.value)} />
</div>
<div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
<button className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-[#3d4944] hover:bg-slate-50 transition-colors" onClick={event=>{closeModal('dev-activity-modal')}} type="button">
            Cancel
          </button>
<button className="px-4 py-2 bg-[#00694f] hover:bg-[#00513c] text-white rounded-lg text-xs font-semibold transition-all shadow-md active:scale-95" type="submit">
            Save Activity Plan
          </button>
</div>
</form>
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" + (modal==='delete-plan-modal' ? '' : ' hidden')} id="delete-plan-modal">
<div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
<div className="w-12 h-12 rounded-full bg-rose-100 text-[#ba1a1a] flex items-center justify-center mb-4">
<span className="material-symbols-outlined text-2xl">delete_forever</span>
</div>
<h3 className="font-headline-sm text-headline-sm font-semibold text-[#111c2d]">Delete Succession Plan?</h3>
<p className="font-body-md text-body-md text-[#3d4944] mt-2">
        Are you sure you want to delete the critical role succession plan for <strong id="delete-plan-target-role">Chief Technology Officer (CTO)</strong>? This action cannot be undone and will remove all linked candidate pool mappings.
      </p>
<div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
<button className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-[#3d4944] hover:bg-slate-50 transition-colors" onClick={event=>{closeModal('delete-plan-modal')}}>
          Cancel
        </button>
<button className="px-4 py-2 bg-[#ba1a1a] hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors shadow" onClick={event=>{confirmDeletePlan()}}>
          Yes, Delete Plan
        </button>
</div>
</div>
</div>

<div className={"fixed z-50 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 animate-in fade-in zoom-in-95 duration-150" + (Boolean(profile) ? '' : ' hidden')} style={{position:"fixed",top:"25%",left:"50%",transform:"translateX(-50%)",zIndex:70}} id="candidate-popover">
<div className="flex items-start justify-between">
<div className="flex items-center gap-3">
<div className="w-11 h-11 rounded-full bg-[#00694f] text-white flex items-center justify-center font-bold text-base shadow-sm" id="popover-avatar">{profile.split(' ').map(word=>word[0]).join('')}</div>
<div>
<h4 className="text-sm font-bold text-[#111c2d]" id="popover-name">{profile}</h4>
<p className="text-xs text-[#6d7a73]" id="popover-title">{profilePerson ? 'Internal successor candidate' : 'Sample leadership candidate'}</p>
</div>
</div>
<button className="text-[#6d7a73] hover:text-[#111c2d]" onClick={event=>{closeCandidatePopover()}}>
<span className="material-symbols-outlined text-sm">close</span>
</button>
</div>
<div className="mt-4 space-y-2 py-2 border-y border-slate-100 text-xs">
<div className="flex items-center justify-between">
<span className="text-[#6d7a73]">Readiness Tier:</span>
<span className="px-2 py-0.5 rounded font-semibold bg-[#008564]/10 text-[#00694f]" id="popover-readiness">{profilePerson?.readiness||'Not assessed'}</span>
</div>
<div className="flex items-center justify-between">
<span className="text-[#6d7a73]">Sample CTC:</span>
<span className="font-semibold text-[#111c2d]">INR ₹ 42,50,000 / yr</span>
</div>
<div className="flex items-center justify-between">
<span className="text-[#6d7a73]">Target Succession Role:</span>
<span className="font-semibold text-[#00694f]">{profilePlan?.title||"Not nominated"}</span>
</div>
<div className="flex items-center justify-between">
<span className="text-[#6d7a73]">Location:</span>
<span className="text-[#3d4944]">Bengaluru HQ</span>
</div>
</div>
<div className="mt-4 flex items-center gap-2">
<button className="flex-1 py-1.5 bg-[#00694f] hover:bg-[#00513c] text-white text-xs font-semibold rounded-lg text-center transition-colors" onClick={event=>{if(profilePlan)openPlan(profilePlan.id); closeCandidatePopover();}}>
        Full Talent Dossier
      </button>
<button className="p-1.5 border border-slate-200 rounded-lg text-[#3d4944] hover:bg-slate-50" onClick={event=>{triggerToast('Candidate added to secondary watch-list', 'success'); closeCandidatePopover();}} title="Watchlist">
<span className="material-symbols-outlined text-base">bookmark_add</span>
</button>
</div>
</div>
</div>

</main>{modal==="delete-activity-modal"&&<div id="delete-activity-modal" className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4"><div className="bg-surface p-6 rounded-xl space-y-4"><h3 className="text-headline-sm">Delete development activity?</h3><div className="flex gap-3"><button onClick={closeModal}>Cancel</button><button className="p-2 bg-error text-on-error rounded" onClick={confirmDeleteActivity}>Confirm Delete Activity</button></div></div></div>}</div></>);
}
