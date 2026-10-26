import { useEffect, useRef, useState } from 'react';
import { Sidebar, Header } from './Layout.jsx';
import { initialApplicants } from './recruitmentData.js';
import ApplicantRow from './ApplicantRow.jsx';
const initialJob = {title:'Senior Backend Lead - Distributed Systems',department:'Core Platform Engg',openings:'2',minimum:'38,00,000',maximum:'48,00,000',manager:'Arunachalam Murthy (CTO & VP Technology)',summary:'We are seeking a seasoned Senior Backend Lead to own our high-throughput transactional distributed data pipelines.',status:'Open'};
export default function RecruitmentDetail() {
 const [tab,setTab] = useState('overview');
 const [applicants,setApplicants] = useState(initialApplicants);
 const [search,setSearch] = useState('');
 const [stage,setStage] = useState('all');
 const [sort,setSort] = useState('match');
 const [empty,setEmpty] = useState(false);
 const [selected,setSelected] = useState([]);
 const [bulkMenu,setBulkMenu] = useState(false);
 const [modal,setModal] = useState(null);
 const [candidateId,setCandidateId] = useState(1);
 const [job,setJob] = useState(initialJob);
 const [editing,setEditing] = useState(initialJob);
 const [closeReason,setCloseReason] = useState('Position Filled');
 const [note,setNote] = useState('');
 const [notes,setNotes] = useState([]);
 const [rejectReason,setRejectReason] = useState('Lack of Distributed Systems depth in coding');
 const [rejectNotes,setRejectNotes] = useState('');
 const [toast,setToast] = useState('');
 const timer = useRef();
 const candidate = applicants.find(item=>item.id===candidateId)||applicants[0];
 const shareLink = typeof window === 'undefined' ? '/#/recruitment-detail' : window.location.origin + window.location.pathname + '#/recruitment-detail';
 const filtered = empty ? [] : applicants.filter(item=>(stage==='all'||item.stage===stage)&&[item.name,item.role,item.company].some(value=>value.toLowerCase().includes(search.toLowerCase()))).sort((a,b)=>sort==='notice'?parseInt(a.notice)-parseInt(b.notice):sort==='recent'?new Date(b.applied)-new Date(a.applied):sort==='experience'?parseFloat(b.background.split('?').at(-1))-parseFloat(a.background.split('?').at(-1)):parseInt(b.match)-parseInt(a.match));
 const showToast = message => {clearTimeout(timer.current);setToast(message);timer.current=setTimeout(()=>setToast(''),3200);};
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 const postNote=()=>{if(!note.trim())return;setNotes(previous=>[...previous,note.trim()]);setNote('');showToast('Note saved to requisition timeline.');};
 const switchTab=setTab;
 const resetFilters=()=>{setSearch('');setStage('all');setEmpty(false);};
 const toggleEmptyState=()=>{setTab('applicants');setEmpty(previous=>!previous);};
 const openModal=id=>{if(id==='edit-drawer')setEditing({...job});setModal(id);};
 const closeModal=()=>setModal(null);
 const closeAllModals=closeModal;
 const openCandidate=id=>{setCandidateId(id);setModal('candidate-drawer');};
 const openCandidateDrawer=name=>{const item=applicants.find(item=>item.name===name);if(item)openCandidate(item.id);};
 const toggleSelected=id=>setSelected(previous=>previous.includes(id)?previous.filter(value=>value!==id):[...previous,id]);
 const toggleSelectAll=checked=>setSelected(previous=>checked?[...new Set([...previous,...filtered.map(item=>item.id)])]:previous.filter(id=>!filtered.some(item=>item.id===id)));
 const simulateBulkSelect=()=>{setTab('applicants');resetFilters();setSelected(applicants.slice(0,2).map(item=>item.id));};
 const clearBulkSelection=()=>{setSelected([]);setBulkMenu(false);};
 const toggleBulkStageMenu=()=>setBulkMenu(previous=>!previous);
 const applyBulkMove=value=>{setApplicants(previous=>previous.map(item=>selected.includes(item.id)?{...item,stage:value}:item));clearBulkSelection();showToast('Candidates moved to '+value+'.');};
 const advanceStageCandidate=()=>{setApplicants(previous=>previous.map(item=>item.id===candidateId?{...item,stage:'Offer Stage'}:item));closeModal();showToast('Candidate advanced to offer preparation.');};
 const confirmRejectCandidates=()=>{const ids=selected.length?selected:[candidateId];setApplicants(previous=>previous.map(item=>ids.includes(item.id)?{...item,stage:'Rejected',rejectionReason:rejectReason,rejectionNotes:rejectNotes}:item));closeModal();clearBulkSelection();showToast('Candidate status updated to Rejected.');};
 const confirmCloseJob=()=>{setJob(previous=>({...previous,status:'Closed'}));closeModal();showToast('Requisition closed: '+closeReason);};
 const saveEditRequisition=()=>{
  const minimum=Number(editing.minimum.replaceAll(',','')),maximum=Number(editing.maximum.replaceAll(',',''));
  if(!editing.title.trim()||!Number.isInteger(Number(editing.openings))||Number(editing.openings)<1||!Number.isFinite(minimum)||!Number.isFinite(maximum)||minimum<0||maximum<minimum){showToast('Enter a title, positive openings, and a valid CTC range.');return;}
  setJob({...editing,title:editing.title.trim()});closeModal();showToast('Requisition changes saved to this session.');
 };
 const copyShareLink=async()=>{try{await navigator.clipboard.writeText(shareLink);showToast('Job link copied to clipboard.');}catch{showToast('Copy is unavailable. Select and copy the link manually.');}};
 useEffect(()=>{
  if(!modal)return;
  const dialog=document.getElementById(modal),previous=document.activeElement;
  dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',modal.replaceAll('-',' '));
  const controls=()=>[...dialog.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled);
  controls()[0]?.focus();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const keydown=event=>{if(event.key==='Escape')setModal(null);if(event.key==='Tab'){const items=controls(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};
  document.addEventListener('keydown',keydown);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keydown);previous?.focus();};
 },[modal]);
 return (<><Sidebar activePage="recruitment" /><div className="pl-64"><Header /><main className="relative pt-16 bg-surface min-h-screen">
        <div className="flex flex-col w-full">
          
          <div
            className="sticky top-0 z-30 bg-[#0E2B3D] text-white px-6 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-3 border-b border-white/10"
          >
            <div className="flex items-center gap-2">
              <span
                className="flex h-2 w-2 rounded-full bg-[#1CCA9B] animate-pulse"
              ></span>
              <span
                className="font-label-caps text-label-caps uppercase tracking-wider text-[#1CCA9B] font-semibold"
                >Simulator Rig</span
              >
              <span className="text-white/40 text-xs">|</span>
              <span
                className="font-label-md text-label-md text-white/80 hidden sm:inline"
                >REQ-2025-089 Interactive Sandbox</span
              >
            </div>
            <div
              className="flex flex-wrap items-center gap-1.5"
              id="simulator-buttons"
            >
              <button
                className="sim-btn px-2.5 py-1 rounded bg-[#16384C] text-[#1CCA9B] font-label-md text-label-md hover:bg-white/10 transition-colors"
                onClick={event => { switchTab('overview') }}
              >
                1. Overview
              </button>
              <button
                className="sim-btn px-2.5 py-1 rounded bg-white/5 text-white/80 font-label-md text-label-md hover:bg-white/10 transition-colors"
                onClick={event => { switchTab('applicants') }}
              >
                2. Applicants
              </button>
              <button
                className="sim-btn px-2.5 py-1 rounded bg-white/5 text-white/80 font-label-md text-label-md hover:bg-white/10 transition-colors"
                onClick={event => { switchTab('activity') }}
              >
                3. Activity
              </button>
              <button
                className="sim-btn px-2.5 py-1 rounded bg-white/5 text-white/80 font-label-md text-label-md hover:bg-white/10 transition-colors"
                onClick={event => { toggleEmptyState() }}
              >
                4. Toggle Empty
              </button>
              <button
                className="sim-btn px-2.5 py-1 rounded bg-white/5 text-white/80 font-label-md text-label-md hover:bg-white/10 transition-colors"
                onClick={event => { openModal('edit-drawer') }}
              >
                5. Edit Drawer
              </button>
              <button
                className="sim-btn px-2.5 py-1 rounded bg-white/5 text-white/80 font-label-md text-label-md hover:bg-white/10 transition-colors"
                onClick={event => { openModal('share-modal') }}
              >
                6. Share Modal
              </button>
              <button
                className="sim-btn px-2.5 py-1 rounded bg-white/5 text-white/80 font-label-md text-label-md hover:bg-white/10 transition-colors"
                onClick={event => { openModal('close-job-modal') }}
              >
                7. Close Req
              </button>
              <button
                className="sim-btn px-2.5 py-1 rounded bg-white/5 text-white/80 font-label-md text-label-md hover:bg-white/10 transition-colors"
                onClick={event => { openModal('candidate-drawer') }}
              >
                8. Candidate Dossier
              </button>
              <button
                className="sim-btn px-2.5 py-1 rounded bg-white/5 text-white/80 font-label-md text-label-md hover:bg-white/10 transition-colors"
                onClick={event => { simulateBulkSelect() }}
              >
                9. Bulk Bar
              </button>
            </div>
          </div>
          
          <div
            className="px-6 py-6 md:px-10 md:py-8 max-w-7xl mx-auto w-full space-y-6"
          >
            
            <div className="flex flex-wrap items-center justify-between gap-4">
              <nav
                aria-label="Breadcrumb"
                className="flex items-center gap-2 font-label-md text-label-md text-secondary"
              >
                <a
                  className="hover:text-primary transition-colors flex items-center gap-1"
                  href="#"
                >
                  <span className="material-symbols-outlined text-base">home</span>
                  Dashboard
                </a>
                <span className="text-outline-variant">/</span>
                <a className="hover:text-primary transition-colors" href="#"
                  >Hire &amp; Lifecycle</a
                >
                <span className="text-outline-variant">/</span>
                <a className="hover:text-primary transition-colors" href="#"
                  >Recruitment Hub</a
                >
                <span className="text-outline-variant">/</span>
                <span className="font-semibold text-on-surface">REQ-2025-089</span>
              </nav>
              <div className="flex items-center gap-2">
                <span
                  className="px-2.5 py-1 rounded-full font-label-caps text-label-caps bg-secondary-container text-on-secondary-container font-semibold uppercase tracking-wider flex items-center gap-1.5"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"
                  ></span>
                  Engineering Track
                </span>
                <span className="text-outline text-sm">•</span>
                <span className="font-label-caps text-label-caps text-tertiary"
                  >Created 18 Apr 2025</span
                >
              </div>
            </div>
            
            <div
              className="bg-surface-container-lowest rounded-xl p-6 md:p-8 shadow-sm relative overflow-hidden"
            >
              
              <div
                className="absolute -right-16 -top-16 w-64 h-64 bg-primary-fixed/20 rounded-full blur-3xl pointer-events-none"
              ></div>
              <div
                className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1
                      className="font-headline-lg text-headline-lg text-on-surface tracking-tight"
                    >{job.title}</h1><p className="text-body-sm text-secondary">{job.department} ? {job.openings} openings ? ?{job.minimum}??{job.maximum}</p><span className="px-2 py-1 rounded bg-surface-container text-label-md">{job.status}</span>
                    <span
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-label-md text-label-md bg-[#D1F5EA] text-[#07523E] font-medium"
                    >
                      <span className="w-2 h-2 rounded-full bg-primary"></span>
                      Active • Published 18 Apr 2025
                    </span>
                  </div>
                  <div
                    className="flex flex-wrap items-center gap-y-2 gap-x-6 text-on-surface-variant font-body-md text-body-md"
                  >
                    <span className="flex items-center gap-1.5 text-on-surface">
                      <span
                        className="material-symbols-outlined text-primary text-lg"
                        >corporate_fare</span
                      >
                      Core Platform Engg
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="material-symbols-outlined text-outline text-lg"
                        >location_on</span
                      >
                      Bengaluru HQ (Prestige Tech Park / Hybrid)
                    </span>
                    <span
                      className="flex items-center gap-1.5 font-medium text-primary"
                    >
                      <span className="material-symbols-outlined text-lg"
                        >payments</span
                      >
                      ₹38,00,000 - ₹48,00,000 PA + 15% Bonus + ₹18L ESOP
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="material-symbols-outlined text-outline text-lg"
                        >group_work</span
                      >
                      2 Openings (1 Offered, 1 Open)
                    </span>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-label-lg text-label-lg transition-colors"
                    onClick={event => { openModal('edit-drawer') }}
                  >
                    <span className="material-symbols-outlined text-base"
                      >edit</span
                    >
                    Edit
                  </button>
                  <button
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg hover:bg-primary-container transition-colors shadow-sm"
                    onClick={event => { openModal('share-modal') }}
                  >
                    <span className="material-symbols-outlined text-base"
                      >share</span
                    >
                    Share Job
                  </button>
                  <button
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-error-container/40 text-error font-label-lg text-label-lg hover:bg-error-container transition-colors"
                    onClick={event => { openModal('close-job-modal') }}
                  >
                    <span className="material-symbols-outlined text-base"
                      >block</span
                    >
                    Close Job
                  </button>
                </div>
              </div>
            </div>
            
            <div
              className="flex items-center gap-2 bg-surface-container-low p-1.5 rounded-xl"
            >
              <button
                className={"flex items-center gap-2.5 px-5 py-2.5 rounded-lg font-label-lg text-label-lg font-semibold bg-surface-container-lowest shadow-sm transition-all" + (tab === 'overview' ? ' border-primary text-primary' : ' border-transparent')} id="tab-btn-overview"
                onClick={event => { switchTab('overview') }}
              >
                <span className="material-symbols-outlined text-lg">analytics</span>
                Overview
              </button>
              <button
                className={"flex items-center gap-2.5 px-5 py-2.5 rounded-lg font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-all" + (tab === 'applicants' ? ' border-primary text-primary' : ' border-transparent')} id="tab-btn-applicants"
                onClick={event => { switchTab('applicants') }}
              >
                <span className="material-symbols-outlined text-lg">people</span>
                Applicants
                <span
                  className="px-2 py-0.5 rounded-full font-label-caps text-label-caps bg-primary text-on-primary font-bold"
                  id="tab-applicants-counter"
                  >{applicants.length}</span>
              </button>
              <button
                className={"flex items-center gap-2.5 px-5 py-2.5 rounded-lg font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-all" + (tab === 'activity' ? ' border-primary text-primary' : ' border-transparent')} id="tab-btn-activity"
                onClick={event => { switchTab('activity') }}
              >
                <span className="material-symbols-outlined text-lg"
                  >history_edu</span
                >
                Activity &amp; Audit
                <span
                  className="px-2 py-0.5 rounded-full font-label-caps text-label-caps bg-surface-variant text-on-secondary-fixed-variant font-semibold"
                  >14</span
                >
              </button>
            </div>
            
            <div className={"space-y-6" + (tab === 'overview' ? '' : ' hidden')} id="tab-content-overview">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                <div
                  className="bg-surface-container-lowest rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="font-label-caps text-label-caps uppercase text-outline font-semibold"
                      >Total Applicants</span
                    >
                    <span
                      className="p-2 rounded-lg bg-primary-fixed/30 text-primary"
                    >
                      <span className="material-symbols-outlined text-lg"
                        >group</span
                      >
                    </span>
                  </div>
                  <div className="mt-4 flex items-baseline justify-between">
                    <span
                      className="font-display-sm text-display-sm text-on-surface"
                      >28</span
                    >
                    <span
                      className="inline-flex items-center gap-1 font-label-md text-label-md text-primary font-semibold"
                    >
                      <span className="material-symbols-outlined text-sm"
                        >trending_up</span
                      >
                      +6 this wk
                    </span>
                  </div>
                  <p
                    className="mt-1 font-body-sm text-body-sm text-on-surface-variant"
                  >
                    Cumulative ATS applications received
                  </p>
                </div>
                
                <div
                  className="bg-surface-container-lowest rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="font-label-caps text-label-caps uppercase text-outline font-semibold"
                      >In Active Pipeline</span
                    >
                    <span
                      className="p-2 rounded-lg bg-secondary-container text-secondary"
                    >
                      <span className="material-symbols-outlined text-lg"
                        >filter_alt</span
                      >
                    </span>
                  </div>
                  <div className="mt-4 flex items-baseline justify-between">
                    <span
                      className="font-display-sm text-display-sm text-on-surface"
                      >19</span
                    >
                    <span
                      className="font-label-caps text-label-caps px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-medium"
                      >68% throughput</span
                    >
                  </div>
                  <p
                    className="mt-1 font-body-sm text-body-sm text-on-surface-variant"
                  >
                    R1: 8 • R2: 6 • Leader: 3 • Offer: 2
                  </p>
                </div>
                
                <div
                  className="bg-surface-container-lowest rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="font-label-caps text-label-caps uppercase text-outline font-semibold"
                      >Time in Market</span
                    >
                    <span
                      className="p-2 rounded-lg bg-surface-container text-on-surface-variant"
                    >
                      <span className="material-symbols-outlined text-lg"
                        >timelapse</span
                      >
                    </span>
                  </div>
                  <div className="mt-4 flex items-baseline justify-between">
                    <div>
                      <span
                        className="font-display-sm text-display-sm text-on-surface"
                        >18</span
                      >
                      <span className="font-label-md text-label-md text-outline"
                        >/ 30 Days Target</span
                      >
                    </div>
                    <span
                      className="inline-flex items-center gap-1 font-label-md text-label-md text-primary font-semibold"
                    >
                      <span className="material-symbols-outlined text-sm"
                        >check_circle</span
                      >
                      On Track
                    </span>
                  </div>
                  <div
                    className="mt-2 w-full bg-surface-container rounded-full h-1.5 overflow-hidden"
                  >
                    <div
                      className="bg-primary h-1.5 rounded-full"
                      style={{"width":"60%"}}
                    ></div>
                  </div>
                </div>
                
                <div
                  className="bg-surface-container-lowest rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="font-label-caps text-label-caps uppercase text-outline font-semibold"
                      >Match Quality Bar</span
                    >
                    <span className="p-2 rounded-lg bg-[#D1F5EA] text-[#07523E]">
                      <span className="material-symbols-outlined text-lg"
                        >verified</span
                      >
                    </span>
                  </div>
                  <div className="mt-4 flex items-baseline justify-between">
                    <span className="font-display-sm text-display-sm text-primary"
                      >88%</span
                    >
                    <span
                      className="font-label-caps text-label-caps px-2 py-0.5 rounded bg-primary-fixed/40 text-on-primary-fixed-variant font-bold"
                      >Top 5% Cohort</span
                    >
                  </div>
                  <p
                    className="mt-1 font-body-sm text-body-sm text-on-surface-variant"
                  >
                    Distributed &amp; Concurrency benchmark
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                <div
                  className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-6 shadow-sm space-y-5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-title-md text-title-md text-on-surface">
                        Candidate Sourcing &amp; Pipeline Conversion
                      </h2>
                      <p
                        className="font-body-sm text-body-sm text-on-surface-variant"
                      >
                        Channel efficacy and conversion benchmarks for
                        REQ-2025-089
                      </p>
                    </div>
                    <span
                      className="font-label-caps text-label-caps text-tertiary bg-surface-container-low px-2 py-1 rounded"
                      >Real-time telemetry</span
                    >
                  </div>
                  
                  <div className="space-y-2">
                    <div className="h-4 w-full rounded-full flex overflow-hidden">
                      <div
                        className="bg-primary h-full transition-all"
                        style={{"width":"38%"}}
                        title="Internal Referrals: 38%"
                      ></div>
                      <div
                        className="bg-secondary h-full transition-all"
                        style={{"width":"32%"}}
                        title="LinkedIn Talent Hub: 32%"
                      ></div>
                      <div
                        className="bg-[#1CCA9B] h-full transition-all"
                        style={{"width":"20%"}}
                        title="Careers Portal: 20%"
                      ></div>
                      <div
                        className="bg-tertiary-fixed-dim h-full transition-all"
                        style={{"width":"10%"}}
                        title="Direct Agency: 10%"
                      ></div>
                    </div>
                    <div
                      className="flex flex-wrap items-center justify-between font-label-md text-label-md text-on-surface-variant pt-1"
                    >
                      <span className="flex items-center gap-1.5"
                        ><span
                          className="w-2.5 h-2.5 rounded-full bg-primary"
                        ></span>
                        Internal Referrals (38%)</span
                      >
                      <span className="flex items-center gap-1.5"
                        ><span
                          className="w-2.5 h-2.5 rounded-full bg-secondary"
                        ></span>
                        LinkedIn (32%)</span
                      >
                      <span className="flex items-center gap-1.5"
                        ><span
                          className="w-2.5 h-2.5 rounded-full bg-[#1CCA9B]"
                        ></span>
                        Careers Portal (20%)</span
                      >
                      <span className="flex items-center gap-1.5"
                        ><span
                          className="w-2.5 h-2.5 rounded-full bg-tertiary-fixed-dim"
                        ></span>
                        Agency / Campus (10%)</span
                      >
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-body-sm text-body-sm">
                      <thead>
                        <tr
                          className="bg-surface-container-low text-outline font-label-caps text-label-caps uppercase"
                        >
                          <th className="py-2.5 px-3 rounded-l-lg">Channel</th>
                          <th className="py-2.5 px-3">Candidates</th>
                          <th className="py-2.5 px-3">Qualified %</th>
                          <th className="py-2.5 px-3">To Offer</th>
                          <th className="py-2.5 px-3 rounded-r-lg">ATS Match</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container-low">
                        <tr className="hover:bg-surface-container-low/50">
                          <td
                            className="py-3 px-3 font-medium text-on-surface flex items-center gap-2"
                          >
                            <span
                              className="material-symbols-outlined text-primary text-base"
                              >diversity_3</span
                            >
                            Internal Employee Referrals
                          </td>
                          <td className="py-3 px-3 font-semibold">11</td>
                          <td className="py-3 px-3 text-[#07523E] font-medium">
                            81.8%
                          </td>
                          <td className="py-3 px-3">2 candidates</td>
                          <td className="py-3 px-3">
                            <span
                              className="px-2 py-0.5 rounded bg-primary-fixed/40 text-[#07523E] font-semibold text-xs"
                              >94%</span
                            >
                          </td>
                        </tr>
                        <tr className="hover:bg-surface-container-low/50">
                          <td
                            className="py-3 px-3 font-medium text-on-surface flex items-center gap-2"
                          >
                            <span
                              className="material-symbols-outlined text-secondary text-base"
                              >public</span
                            >
                            LinkedIn Talent Hub
                          </td>
                          <td className="py-3 px-3 font-semibold">9</td>
                          <td className="py-3 px-3 text-on-surface-variant">
                            55.5%
                          </td>
                          <td className="py-3 px-3">1 candidate</td>
                          <td className="py-3 px-3">
                            <span
                              className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-semibold text-xs"
                              >88%</span
                            >
                          </td>
                        </tr>
                        <tr className="hover:bg-surface-container-low/50">
                          <td
                            className="py-3 px-3 font-medium text-on-surface flex items-center gap-2"
                          >
                            <span
                              className="material-symbols-outlined text-[#00694f] text-base"
                              >domain_verification</span
                            >
                            Careers Portal Inbound
                          </td>
                          <td className="py-3 px-3 font-semibold">6</td>
                          <td className="py-3 px-3 text-on-surface-variant">
                            33.3%
                          </td>
                          <td className="py-3 px-3">0 candidates</td>
                          <td className="py-3 px-3">
                            <span
                              className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-semibold text-xs"
                              >79%</span
                            >
                          </td>
                        </tr>
                        <tr className="hover:bg-surface-container-low/50">
                          <td
                            className="py-3 px-3 font-medium text-on-surface flex items-center gap-2"
                          >
                            <span
                              className="material-symbols-outlined text-outline text-base"
                              >handshake</span
                            >
                            Direct Headhunting (StellarTech)
                          </td>
                          <td className="py-3 px-3 font-semibold">2</td>
                          <td className="py-3 px-3 text-[#07523E] font-medium">
                            100.0%
                          </td>
                          <td className="py-3 px-3">1 candidate</td>
                          <td className="py-3 px-3">
                            <span
                              className="px-2 py-0.5 rounded bg-primary-fixed/40 text-[#07523E] font-semibold text-xs"
                              >92%</span
                            >
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div
                  className="lg:col-span-5 bg-surface-container-lowest rounded-xl p-6 shadow-sm space-y-6"
                >
                  <div>
                    <h2 className="font-title-md text-title-md text-on-surface">
                      Hiring Team &amp; Assessment Panel
                    </h2>
                    <p
                      className="font-body-sm text-body-sm text-on-surface-variant"
                    >
                      Governing hiring managers and interview panel members
                    </p>
                  </div>
                  
                  <div
                    className="p-3.5 bg-surface-container-low rounded-xl flex items-center gap-3.5"
                  >
                    <img
                      className="w-12 h-12 rounded-full object-cover"
                      data-alt="Professional headshot of senior Indian male CTO Arunachalam Murthy wearing modern enterprise executive attire, mint studio backdrop, clean high contrast."
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuChEXCaN2SKwl5A30oINm35SPEAbXcxP0Zxe3NYyoQ7ROzPRD1WN1hUxIxescBcewmDCJPiRU2G5DOuPg2jMSH6gxGbxTPvH73YUt6CUeR1fUehIpN4ghMstWQWV6tv_hZjFLS-mDIyUXP_wQ6hTGVu13-5EwIj_FPTuCWXdPc7fX2K_qBmXlwC53dE5OCC_CkrjDv0VZQvH92XAcNyFmkTFeo6FlB-QbruIxQchZr3Kp39j6Q8iMpp"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-label-lg text-label-lg font-bold text-on-surface truncate"
                          >Arunachalam Murthy</span
                        >
                        <span
                          className="px-2 py-0.5 rounded font-label-caps text-label-caps bg-primary text-on-primary"
                          >Hiring Lead</span
                        >
                      </div>
                      <p
                        className="font-body-sm text-body-sm text-on-surface-variant truncate"
                      >
                        CTO &amp; VP Core Platform Engineering
                      </p>
                    </div>
                    <a
                      className="p-2 text-primary hover:bg-white rounded-lg transition-colors"
                      href="#"
                      title="Message Manager"
                    >
                      <span className="material-symbols-outlined text-lg"
                        >chat</span
                      >
                    </a>
                  </div>
                  
                  <div className="space-y-3">
                    <span
                      className="font-label-caps text-label-caps text-outline uppercase font-semibold"
                      >Assigned Interview Panelists</span
                    >
                    <div className="space-y-2">
                      <div
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-low transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-full bg-secondary text-on-secondary font-bold text-xs flex items-center justify-center"
                          >
                            VJ
                          </div>
                          <div>
                            <p
                              className="font-label-md text-label-md font-semibold text-on-surface"
                            >
                              Vikramaditya Joshi
                            </p>
                            <p
                              className="font-body-sm text-body-sm text-on-surface-variant"
                            >
                              Lead Systems Architect • Round 2 Tech
                            </p>
                          </div>
                        </div>
                        <span
                          className="px-2 py-0.5 rounded text-xs font-semibold bg-[#D1F5EA] text-[#07523E]"
                          >Completed (3)</span
                        >
                      </div>
                      <div
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-low transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-full bg-primary-container text-on-primary font-bold text-xs flex items-center justify-center"
                          >
                            RR
                          </div>
                          <div>
                            <p
                              className="font-label-md text-label-md font-semibold text-on-surface"
                            >
                              Rajeshwar Rao
                            </p>
                            <p
                              className="font-body-sm text-body-sm text-on-surface-variant"
                            >
                              Principal SRE • Bar-Raiser
                            </p>
                          </div>
                        </div>
                        <span
                          className="px-2 py-0.5 rounded text-xs font-semibold bg-surface-container text-on-surface"
                          >Active (2)</span
                        >
                      </div>
                      <div
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-low transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-full bg-outline text-white font-bold text-xs flex items-center justify-center"
                          >
                            PS
                          </div>
                          <div>
                            <p
                              className="font-label-md text-label-md font-semibold text-on-surface"
                            >
                              Priya Sharma
                            </p>
                            <p
                              className="font-body-sm text-body-sm text-on-surface-variant"
                            >
                              Director Culture &amp; Talent • Leadership
                            </p>
                          </div>
                        </div>
                        <span
                          className="px-2 py-0.5 rounded text-xs font-semibold bg-[#FEF3C7] text-[#B45309]"
                          >Pending (1)</span
                        >
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 pt-2">
                    <span
                      className="font-label-caps text-label-caps text-outline uppercase font-semibold"
                      >Evaluation Criteria &amp; Tech Stack</span
                    >
                    <div className="flex flex-wrap gap-1.5">
                      <span
                        className="px-2.5 py-1 rounded-md bg-surface-container text-on-surface font-label-md text-label-md font-medium"
                        >Go (Golang)</span
                      >
                      <span
                        className="px-2.5 py-1 rounded-md bg-surface-container text-on-surface font-label-md text-label-md font-medium"
                        >Kubernetes / EKS</span
                      >
                      <span
                        className="px-2.5 py-1 rounded-md bg-surface-container text-on-surface font-label-md text-label-md font-medium"
                        >Apache Kafka</span
                      >
                      <span
                        className="px-2.5 py-1 rounded-md bg-surface-container text-on-surface font-label-md text-label-md font-medium"
                        >Distributed Caching</span
                      >
                      <span
                        className="px-2.5 py-1 rounded-md bg-surface-container text-on-surface font-label-md text-label-md font-medium"
                        >gRPC Protocol</span
                      >
                      <span
                        className="px-2.5 py-1 rounded-md bg-surface-container text-on-surface font-label-md text-label-md font-medium"
                        >Raft / Paxos Consensus</span
                      >
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className={"space-y-4" + (tab === 'applicants' ? '' : ' hidden')} id="tab-content-applicants">
              
              <div
                className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                
                <div className="relative flex-1 max-w-md">
                  <span
                    className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-lg"
                    >search</span
                  >
                  <input
                    className="w-full pl-9 pr-4 py-2 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary"
                    value={search} onChange={event => { setSearch(event.target.value); setEmpty(false); }} id="applicant-search"
                    
                    placeholder="Search applicant by name, role, previous company..."
                    type="text"
                  />
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="font-label-caps text-label-caps text-outline uppercase font-semibold hidden lg:inline"
                      >Stage:</span
                    >
                    <select
                      className="px-3 py-2 bg-surface-container-low rounded-lg font-body-sm text-body-sm text-on-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                      value={stage} onChange={event => { setStage(event.target.value); setEmpty(false); }} id="stage-filter"
                      
                    >
                      <option value="all">All Stages (28)</option>
                      <option value="Screening">Screening (9)</option>
                      <option value="Tech Round 1">Tech Round 1 (8)</option>
                      <option value="Tech Round 2">Tech Round 2 (6)</option>
                      <option value="Leadership">Leadership Round (3)</option>
                      <option value="Offer Pending">Offer Pending (2)</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="font-label-caps text-label-caps text-outline uppercase font-semibold hidden lg:inline"
                      >Sort:</span
                    >
                    <select aria-label="Sort applicants" className="px-3 py-2 bg-surface-container-low rounded-lg" onChange={event=>setSort(event.target.value)} value={sort}><option value="match">Highest ATS Match</option><option value="recent">Most Recent Application</option><option value="experience">Experience (Years High-Low)</option><option value="notice">Notice Period (Shortest)</option></select>
                  </div>
                  <button
                    className="p-2 bg-surface-container-low hover:bg-surface-container rounded-lg text-on-surface-variant transition-colors"
                    onClick={event => { toggleEmptyState() }}
                    title="Toggle Empty Simulation"
                  >
                    <span className="material-symbols-outlined text-lg"
                      >filter_alt_off</span
                    >
                  </button>
                </div>
              </div>
              
              <div
                className={"bg-[#0E2B3D] text-white px-5 py-3 rounded-xl shadow-xl flex items-center justify-between gap-4 transition-all" + (selected.length > 0 ? '' : ' hidden')} id="bulk-action-bar"
              >
                <div className="flex items-center gap-3">
                  <span className="p-1 rounded bg-[#1CCA9B]/20 text-[#1CCA9B]">
                    <span className="material-symbols-outlined text-base"
                      >checklist</span
                    >
                  </span>
                  <span
                    className="font-label-lg text-label-lg font-bold"
                    id="bulk-count-text"
                    >{selected.length + ' Candidates Selected'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative inline-block">
                    <button
                      className="px-3.5 py-1.5 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md font-semibold hover:bg-surface transition-colors flex items-center gap-1"
                      onClick={event => { toggleBulkStageMenu() }}
                    >
                      Move to Stage
                      <span className="material-symbols-outlined text-sm"
                        >expand_more</span
                      >
                    </button>
                    <div
                      className={"absolute left-0 bottom-full mb-2 w-48 bg-surface-container-lowest text-on-surface rounded-lg shadow-xl p-1 z-50" + (bulkMenu ? '' : ' hidden')} id="bulk-stage-menu"
                    >
                      <button
                        className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-surface-container-low rounded"
                        onClick={event => { applyBulkMove('Tech Round 1') }}
                      >
                        Tech Round 1
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-surface-container-low rounded"
                        onClick={event => { applyBulkMove('Tech Round 2') }}
                      >
                        Tech Round 2
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-surface-container-low rounded"
                        onClick={event => { applyBulkMove('Leadership Round') }}
                      >
                        Leadership Round
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-surface-container-low rounded"
                        onClick={event => { applyBulkMove('Offer Stage') }}
                      >
                        Offer Stage
                      </button>
                    </div>
                  </div>
                  <button
                    className="px-3.5 py-1.5 rounded-lg bg-error hover:bg-error/90 text-on-error font-label-md text-label-md font-semibold transition-colors flex items-center gap-1"
                    onClick={event => { openModal('reject-modal') }}
                  >
                    <span className="material-symbols-outlined text-sm"
                      >person_remove</span
                    >
                    Reject Candidates
                  </button>
                  <button
                    className="p-1 text-white/60 hover:text-white rounded"
                    onClick={event => { clearBulkSelection() }}
                    title="Deselect All"
                  >
                    <span className="material-symbols-outlined text-base"
                      >close</span
                    >
                  </button>
                </div>
              </div>
              
              <div
                className={"bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden" + (filtered.length > 0 ? '' : ' hidden')} id="applicants-table-wrapper"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-body-sm text-body-sm">
                    <thead>
                      <tr
                        className="bg-surface-container-low text-outline font-label-caps text-label-caps uppercase"
                      >
                        <th className="py-3 px-4 w-12 text-center">
                          <input
                            className="rounded w-4 h-4 text-primary focus:ring-primary"
                            checked={filtered.length > 0 && filtered.every(item => selected.includes(item.id))} onChange={event => toggleSelectAll(event.target.checked)} aria-label="Select all applicants" id="select-all-checkbox"
                            
                            type="checkbox"
                          />
                        </th>
                        <th className="py-3 px-4">Candidate &amp; Background</th>
                        <th className="py-3 px-4">Current Employer</th>
                        <th className="py-3 px-4">Stage</th>
                        <th className="py-3 px-4">ATS Match</th>
                        <th className="py-3 px-4">Applied</th>
                        <th className="py-3 px-4">Notice Period</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody
                      className="divide-y divide-surface-container-low"
                      id="applicants-table-body"
                    >{filtered.map(item => <ApplicantRow key={item.id} item={item} selected={selected.includes(item.id)} toggleSelected={toggleSelected} openCandidate={openCandidate} />)}</tbody>
                  </table>
                </div>
                
                <div
                  className="p-4 bg-surface-container-lowest border-t border-surface-container-low flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant"
                >
                  <span>Showing {filtered.length} of {applicants.length} applicants</span>
                  <span className="text-outline">All matching applicants displayed</span>
                </div>
              </div>
              
              <div
                className={"bg-surface-container-lowest rounded-xl p-12 shadow-sm text-center space-y-4" + (filtered.length === 0 ? '' : ' hidden')} id="applicants-empty-state"
              >
                <div
                  className="mx-auto w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-outline"
                >
                  <span className="material-symbols-outlined text-3xl"
                    >person_search</span
                  >
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h3
                    className="font-headline-sm text-headline-sm text-on-surface font-semibold"
                  >
                    No candidates found in this stage
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    There are no active candidate dossiers matching the applied
                    filter criteria. Consider publishing to broader channels or
                    adjusting your search filters.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary-container transition-colors"
                    onClick={event => { openModal('share-modal') }}
                  >
                    Share Job Requisition
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors"
                    onClick={event => { resetFilters() }}
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            </div>
            
            <div className={"space-y-6" + (tab === 'activity' ? '' : ' hidden')} id="tab-content-activity">
              <div
                className="bg-surface-container-lowest rounded-xl p-6 shadow-sm space-y-6"
              >
                <div
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <h2 className="font-title-md text-title-md text-on-surface">
                      Requisition Audit Trail &amp; Team Discussions
                    </h2>
                    <p
                      className="font-body-sm text-body-sm text-on-surface-variant"
                    >
                      Timestamped lifecycle governance log and panel notes
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold"
                    >
                      All Events (14)
                    </button>
                    <button
                      className="px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant font-label-md text-label-md"
                    >
                      Scorecards
                    </button>
                    <button
                      className="px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant font-label-md text-label-md"
                    >
                      Status Changes
                    </button>
                  </div>
                </div>
                
                <div className="p-4 bg-surface-container-low rounded-xl space-y-3">
                  <label
                    className="font-label-caps text-label-caps uppercase text-outline font-semibold"
                    >Add Internal Panel Note</label
                  >
                  {notes.map((text,index)=><p key={index} className="p-3 bg-surface-container-low rounded">{text}</p>)}<textarea
                    className="w-full p-3 bg-surface-container-lowest rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline border-none focus:outline-none focus:ring-2 focus:ring-primary h-20 resize-none"
                    placeholder="Write a note or mention @panelists, @arunachalam, or @priya for immediate escalation..."
                   value={note} onChange={event=>setNote(event.target.value)} aria-label="Requisition note" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-outline"
                      >Markdown supported • Tag members with '@'</span
                    >
                    <button
                      className="px-4 py-1.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary-container transition-colors"
                      onClick={event => { 
                        postNote()
                       }}
                    >
                      Post Note
                    </button>
                  </div>
                </div>
                
                <div
                  className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-container"
                >
                  
                  <div className="relative">
                    <span
                      className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-[#1CCA9B] ring-4 ring-surface-container-lowest"
                    ></span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-label-md text-label-md font-bold text-on-surface"
                          >Priya Sharma (HR Director)</span
                        >
                        <span
                          className="font-label-caps text-label-caps text-outline"
                          >02 May 2025, 16:45 IST</span
                        >
                      </div>
                      <p className="font-body-md text-body-md text-on-surface">
                        Advanced candidate
                        <strong className="text-primary font-semibold"
                          >Karthik Ramanathan</strong
                        >
                        from Tech Round 2 to
                        <span
                          className="px-2 py-0.5 rounded bg-[#FEF3C7] text-[#B45309] text-xs font-semibold"
                          >Leadership Round</span
                        >
                        with Arunachalam.
                      </p>
                      <div
                        className="p-3 bg-surface-container-low rounded-lg text-xs text-on-surface-variant font-body-sm italic mt-1"
                      >
                        "Karthik scored extraordinarily well on consensus
                        protocols. Fast-tracking for leadership alignment before
                        weekend."
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <span
                      className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-secondary ring-4 ring-surface-container-lowest"
                    ></span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-label-md text-label-md font-bold text-on-surface"
                          >Vikramaditya Joshi (Lead Systems Architect)</span
                        >
                        <span
                          className="font-label-caps text-label-caps text-outline"
                          >30 Apr 2025, 11:20 IST</span
                        >
                      </div>
                      <p className="font-body-md text-body-md text-on-surface">
                        Submitted Tech Round 2 Evaluation Scorecard for
                        candidate <strong>Karthik Ramanathan</strong>.
                      </p>
                      <div
                        className="inline-flex items-center gap-2 px-3 py-1 bg-[#D1F5EA] text-[#07523E] rounded-md font-label-md text-label-md font-semibold"
                      >
                        Score: 4.8 / 5.0 • Strong Hire (Systems Mastery)
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <span
                      className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-primary ring-4 ring-surface-container-lowest"
                    ></span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-label-md text-label-md font-bold text-on-surface"
                          >Rajeshwar Rao (Principal SRE)</span
                        >
                        <span
                          className="font-label-caps text-label-caps text-outline"
                          >26 Apr 2025, 18:00 IST</span
                        >
                      </div>
                      <p className="font-body-md text-body-md text-on-surface">
                        Concluded Bar-Raiser architecture deep dive with
                        <strong>Ananya Deshmukh</strong>. Recommended approval
                        for final offer compensation package.
                      </p>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <span
                      className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-outline ring-4 ring-surface-container-lowest"
                    ></span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-label-md text-label-md font-bold text-on-surface"
                          >Finance &amp; Executive Board</span
                        >
                        <span
                          className="font-label-caps text-label-caps text-outline"
                          >20 Apr 2025, 14:15 IST</span
                        >
                      </div>
                      <p className="font-body-md text-body-md text-on-surface">
                        Headcount budget code
                        <code
                          className="px-1.5 py-0.5 rounded bg-surface-container font-mono text-xs"
                          >ENG-BLR-089</code
                        >
                        signed off by CFO Office (Tier 1 Escalation cleared).
                      </p>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <span
                      className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-primary-container ring-4 ring-surface-container-lowest"
                    ></span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-label-md text-label-md font-bold text-on-surface"
                          >Arunachalam Murthy (Hiring Manager)</span
                        >
                        <span
                          className="font-label-caps text-label-caps text-outline"
                          >18 Apr 2025, 09:30 IST</span
                        >
                      </div>
                      <p className="font-body-md text-body-md text-on-surface">
                        Requisition created, configured with ATS scoring rubric,
                        and published across EMS Cloud Careers and LinkedIn.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          
          <div
            className={"fixed inset-0 bg-[#0E2B3D]/50 backdrop-blur-sm z-50 transition-opacity" + (Boolean(modal) ? '' : ' hidden')} id="modal-backdrop"
            onClick={event => { closeAllModals() }}
          ></div>
          
          <aside
            className={"fixed top-0 right-0 h-full w-full max-w-xl bg-surface-container-lowest shadow-2xl z-50 transform transition-transform duration-300 overflow-y-auto flex flex-col justify-between" + (modal === 'edit-drawer' ? '' : ' hidden')} id="edit-drawer"
          >
            <div>
              <div
                className="p-6 bg-surface-container-low flex items-center justify-between border-b border-surface-container"
              >
                <div>
                  <h3
                    className="font-headline-sm text-headline-sm text-on-surface font-semibold"
                  >
                    Edit Job Requisition
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    REQ-2025-089 • Core Platform Engineering
                  </p>
                </div>
                <button
                  className="p-2 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container transition-colors"
                  onClick={event => { closeModal('edit-drawer') }}
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div className="space-y-1.5">
                  <label
                    className="font-label-md text-label-md font-semibold text-on-surface"
                    >Job Title</label
                  >
                  <input
                    className="w-full px-3.5 py-2.5 bg-surface-container-lowest rounded-lg font-body-md text-body-md text-on-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary"
                    type="text"
                    
                   aria-label="title" value={editing.title} onChange={event => setEditing(previous=>({...previous,title:event.target.value}))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      className="font-label-md text-label-md font-semibold text-on-surface"
                      >Department</label
                    >
                    <select
                      className="w-full px-3.5 py-2.5 bg-surface-container-lowest rounded-lg font-body-md text-body-md text-on-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary"
                     aria-label="department" value={editing.department} onChange={event=>setEditing(previous=>({...previous,department:event.target.value}))}>
                      <option >Core Platform Engg</option>
                      <option>Data Engineering</option>
                      <option>Security &amp; Infra</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label
                      className="font-label-md text-label-md font-semibold text-on-surface"
                      >Openings</label
                    >
                    <input
                      className="w-full px-3.5 py-2.5 bg-surface-container-lowest rounded-lg font-body-md text-body-md text-on-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary"
                      type="number"
                      
                     aria-label="openings" value={editing.openings} onChange={event => setEditing(previous=>({...previous,openings:event.target.value}))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      className="font-label-md text-label-md font-semibold text-on-surface"
                      >Min Annual CTC (₹)</label
                    >
                    <input
                      className="w-full px-3.5 py-2.5 bg-surface-container-lowest rounded-lg font-body-md text-body-md text-on-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary"
                      type="text"
                      
                     aria-label="minimum" value={editing.minimum} onChange={event => setEditing(previous=>({...previous,minimum:event.target.value}))} />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      className="font-label-md text-label-md font-semibold text-on-surface"
                      >Max Annual CTC (₹)</label
                    >
                    <input
                      className="w-full px-3.5 py-2.5 bg-surface-container-lowest rounded-lg font-body-md text-body-md text-on-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary"
                      type="text"
                      
                     aria-label="maximum" value={editing.maximum} onChange={event => setEditing(previous=>({...previous,maximum:event.target.value}))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label
                    className="font-label-md text-label-md font-semibold text-on-surface"
                    >Hiring Manager</label
                  >
                  <select
                    className="w-full px-3.5 py-2.5 bg-surface-container-lowest rounded-lg font-body-md text-body-md text-on-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary"
                   aria-label="manager" value={editing.manager} onChange={event=>setEditing(previous=>({...previous,manager:event.target.value}))}>
                    <option >
                      Arunachalam Murthy (CTO &amp; VP Technology)
                    </option>
                    <option>Priya Sharma (HR Director)</option>
                    <option>Rajeshwar Rao (Principal SRE)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label
                    className="font-label-md text-label-md font-semibold text-on-surface"
                    >Job Summary &amp; Scope</label
                  >
                  <textarea
                    className="w-full px-3.5 py-2.5 bg-surface-container-lowest rounded-lg font-body-md text-body-md text-on-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary h-28"
                   aria-label="Job summary" value={editing.summary} onChange={event=>setEditing(previous=>({...previous,summary:event.target.value}))} />
                </div>
              </div>
            </div>
            <div
              className="p-6 bg-surface-container-low border-t border-surface-container flex items-center justify-end gap-3"
            >
              <button
                className="px-4 py-2.5 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors"
                onClick={event => { closeModal('edit-drawer') }}
              >
                Cancel
              </button>
              <button
                className="px-5 py-2.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary-container transition-colors shadow-sm"
                onClick={event => { saveEditRequisition() }}
              >
                Save Changes
              </button>
            </div>
          </aside>
          
          <div
            className={"fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-surface-container-lowest rounded-xl shadow-2xl z-50 p-6 space-y-6" + (modal === 'share-modal' ? '' : ' hidden')} id="share-modal"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-lg bg-primary-fixed/40 text-primary">
                  <span className="material-symbols-outlined text-xl">share</span>
                </span>
                <div>
                  <h3
                    className="font-headline-sm text-headline-sm text-on-surface font-semibold"
                  >
                    Share Requisition
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    REQ-2025-089 Public Careers URL
                  </p>
                </div>
              </div>
              <button
                className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
                onClick={event => { closeModal('share-modal') }}
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            
            <div className="space-y-1.5">
              <label
                className="font-label-caps text-label-caps uppercase text-outline font-semibold"
                >Candidate Portal Link</label
              >
              <div className="flex items-center gap-2">
                <input
                  className="w-full px-3 py-2 bg-surface-container-low text-on-surface rounded-lg font-mono text-xs focus:outline-none"
                  id="share-link-input"
                  
                  type="text"
                  
                 value={shareLink} readOnly />
                <button
                  className="px-3.5 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md font-semibold hover:bg-primary-container transition-colors flex items-center gap-1 shrink-0"
                  id="copy-btn"
                  onClick={event => { copyShareLink() }}
                >
                  <span
                    className="material-symbols-outlined text-base"
                    id="copy-icon"
                    >content_copy</span
                  >
                  <span id="copy-text">Copy</span>
                </button>
              </div>
            </div>
            
            <div className="space-y-2">
              <span
                className="font-label-caps text-label-caps uppercase text-outline font-semibold"
                >Direct Broadcast</span
              >
              <div className="grid grid-cols-4 gap-2 text-center">
                <button
                  className="p-3 bg-surface-container-low hover:bg-surface-container rounded-xl flex flex-col items-center gap-1 transition-colors"
                  onClick={event => { showToast('LinkedIn sharing is a prototype; no broadcast was sent.') }}
                >
                  <span className="material-symbols-outlined text-primary text-xl"
                    >work</span
                  >
                  <span className="text-xs font-semibold text-on-surface"
                    >LinkedIn</span
                  >
                </button>
                <button
                  className="p-3 bg-surface-container-low hover:bg-surface-container rounded-xl flex flex-col items-center gap-1 transition-colors"
                  onClick={event => { 
                    showToast('WhatsApp referral sharing is a prototype.')
                   }}
                >
                  <span className="material-symbols-outlined text-[#07523E] text-xl"
                    >chat</span
                  >
                  <span className="text-xs font-semibold text-on-surface"
                    >WhatsApp</span
                  >
                </button>
                <button
                  className="p-3 bg-surface-container-low hover:bg-surface-container rounded-xl flex flex-col items-center gap-1 transition-colors"
                  onClick={event => { 
                    showToast('Slack sharing is a prototype; no message was sent.')
                   }}
                >
                  <span className="material-symbols-outlined text-secondary text-xl"
                    >tag</span
                  >
                  <span className="text-xs font-semibold text-on-surface"
                    >Slack</span
                  >
                </button>
                <button
                  className="p-3 bg-surface-container-low hover:bg-surface-container rounded-xl flex flex-col items-center gap-1 transition-colors"
                  onClick={event => { 
                    showToast('Use the share link above for this local preview.')
                   }}
                >
                  <span className="material-symbols-outlined text-outline text-xl"
                    >qr_code_2</span
                  >
                  <span className="text-xs font-semibold text-on-surface"
                    >QR Code</span
                  >
                </button>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                className="px-4 py-2 bg-surface-container text-on-surface rounded-lg font-label-md text-label-md hover:bg-surface-container-high transition-colors"
                onClick={event => { closeModal('share-modal') }}
              >
                Done
              </button>
            </div>
          </div>
          
          <div
            className={"fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface-container-lowest rounded-xl shadow-2xl z-50 p-6 space-y-5" + (modal === 'close-job-modal' ? '' : ' hidden')} id="close-job-modal"
          >
            <div className="flex items-center gap-3 text-error">
              <span className="p-2.5 rounded-full bg-error-container text-error">
                <span className="material-symbols-outlined text-2xl">warning</span>
              </span>
              <div>
                <h3
                  className="font-headline-sm text-headline-sm text-on-surface font-semibold"
                >
                  Close Requisition?
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  REQ-2025-089 will be delisted
                </p>
              </div>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Closing this requisition will automatically notify active
              applicants and archive remaining interviews on manager calendars.
            </p>
            <div className="space-y-3">
              <div className="space-y-1">
                <label
                  className="font-label-md text-label-md font-semibold text-on-surface"
                  >Reason for Closing *</label
                >
                <select
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg font-body-sm text-body-sm text-on-surface focus:ring-2 focus:ring-error"
                  value={closeReason} onChange={event=>setCloseReason(event.target.value)} aria-label="Closure reason" id="close-reason"
                >
                  <option value="Role Filled">
                    Role Filled (Candidate Selected)
                  </option>
                  <option value="Budget Frozen">
                    Headcount Budget Frozen / Reprioritized
                  </option>
                  <option value="Restructuring">Org Restructuring</option>
                  <option value="Transferred Internal">
                    Transferred to Internal Lateral Move
                  </option>
                </select>
              </div>
              <div className="space-y-1">
                <label
                  className="font-label-md text-label-md font-semibold text-on-surface"
                  >Audit Notes</label
                >
                <textarea
                  className="w-full p-2.5 bg-surface-container-low rounded-lg font-body-sm text-body-sm text-on-surface border-none focus:ring-2 focus:ring-error h-20 resize-none"
                  placeholder="Provide rationale for compliance record..."
                 value={rejectNotes} onChange={event=>setRejectNotes(event.target.value)} aria-label="Closure rationale" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                className="px-4 py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors"
                onClick={event => { closeModal('close-job-modal') }}
              >
                Keep Open
              </button>
              <button
                className="px-4 py-2.5 rounded-lg bg-error hover:bg-error/90 text-on-error font-label-md text-label-md font-semibold transition-colors"
                onClick={event => { confirmCloseJob() }}
              >
                Confirm Close Requisition
              </button>
            </div>
          </div>
          
          <aside
            className={"fixed top-0 right-0 h-full w-full max-w-2xl bg-surface-container-lowest shadow-2xl z-50 transform transition-transform duration-300 overflow-y-auto flex flex-col justify-between" + (modal === 'candidate-drawer' ? '' : ' hidden')} id="candidate-drawer"
          >
            <div>
              
              <div
                className="p-6 bg-surface-container-low flex items-start justify-between border-b border-surface-container"
              >
                <div className="flex items-center gap-4">
                  <img
                    className="w-14 h-14 rounded-full object-cover shadow-sm"
                    data-alt="Candidate profile portrait of Karthik Ramanathan, professional headshot with glasses."
                    id="dossier-avatar"
                    src={candidate.avatar || undefined} alt={candidate.name}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3
                        className="font-headline-sm text-headline-sm text-on-surface font-bold"
                        id="dossier-name"
                      >{candidate.name}</h3>
                      <span
                        className="px-2.5 py-0.5 rounded-full font-label-caps text-label-caps bg-[#FEF3C7] text-[#B45309] font-semibold"
                        id="dossier-stage-pill"
                        >{candidate.stage}</span>
                    </div>
                    <p
                      className="font-body-md text-body-md text-on-surface-variant"
                      id="dossier-role"
                    >{candidate.role + ' ? ' + candidate.company}</p>
                    <div
                      className="flex items-center gap-3 text-xs text-outline mt-1"
                    >
                      <span className="flex items-center gap-1"
                        ><span className="material-symbols-outlined text-sm"
                          >schedule</span
                        >
                        Notice:
                        <strong className="text-on-surface" id="dossier-notice"
                          >15 Days</strong
                        ></span
                      >
                      <span>•</span>
                      <span className="flex items-center gap-1"
                        ><span className="material-symbols-outlined text-sm"
                          >payments</span
                        >
                        Expected: <strong>₹44L PA</strong></span
                      >
                    </div>
                  </div>
                </div>
                <button
                  className="p-2 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container transition-colors"
                  onClick={event => { closeModal('candidate-drawer') }}
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                
                <div
                  className="p-4 bg-primary-fixed/20 rounded-xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="p-2.5 rounded-full bg-primary text-on-primary">
                      <span className="material-symbols-outlined text-xl"
                        >verified</span
                      >
                    </span>
                    <div>
                      <p
                        className="font-label-lg text-label-lg font-bold text-on-surface"
                      >
                        ATS Alignment Score:
                        <span className="text-primary" id="dossier-match">{candidate.match}</span>
                      </p>
                      <p
                        className="font-body-sm text-body-sm text-on-surface-variant"
                      >
                        High overlap in Go, distributed raft consensus, and
                        high-load streaming.
                      </p>
                    </div>
                  </div>
                  <button
                    className="px-3 py-1.5 bg-surface-container-lowest text-primary rounded-lg font-label-md text-label-md font-semibold hover:bg-white shadow-sm transition-colors"
                    onClick={event => { showToast('ATS report download is a prototype.') }}
                  >
                    View Rubric
                  </button>
                </div>
                
                <div className="space-y-3">
                  <span
                    className="font-label-caps text-label-caps uppercase text-outline font-semibold"
                    >Interview Panel Ratings</span
                  >
                  <div className="space-y-2">
                    <div
                      className="p-3.5 bg-surface-container-low rounded-xl space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="font-label-md text-label-md font-bold text-on-surface"
                          >Round 2: Distributed Architecture</span
                        >
                        <span
                          className="font-semibold text-xs px-2 py-0.5 rounded bg-[#D1F5EA] text-[#07523E]"
                          >4.8 / 5.0 (Strong Hire)</span
                        >
                      </div>
                      <p
                        className="font-body-sm text-body-sm text-on-surface-variant"
                      >
                        "Demonstrated immense clarity during the live
                        distributed cache design. Solved partitioned cache
                        consistency edge cases using custom vector clocks."
                      </p>
                      <p className="text-xs text-outline font-medium">
                        Interviewer: Vikramaditya Joshi (Submitted 30 Apr)
                      </p>
                    </div>
                    <div
                      className="p-3.5 bg-surface-container-low rounded-xl space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="font-label-md text-label-md font-bold text-on-surface"
                          >Round 1: Algorithms &amp; Concurrency</span
                        >
                        <span
                          className="font-semibold text-xs px-2 py-0.5 rounded bg-[#D1F5EA] text-[#07523E]"
                          >4.5 / 5.0 (Hire)</span
                        >
                      </div>
                      <p
                        className="font-body-sm text-body-sm text-on-surface-variant"
                      >
                        "Superb mastery of Golang channels, waitgroups, and
                        memory leak profiling under synthetic heap load."
                      </p>
                      <p className="text-xs text-outline font-medium">
                        Interviewer: Rajeshwar Rao (Submitted 25 Apr)
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <span
                    className="font-label-caps text-label-caps uppercase text-outline font-semibold"
                    >Resume Snapshot</span
                  >
                  <div
                    className="p-4 bg-surface-container-lowest rounded-xl border border-surface-container-low space-y-2 text-on-surface"
                  >
                    <p className="font-label-md text-label-md font-bold">
                      Flipkart • Staff Platform Engineer (2021 - Present)
                    </p>
                    <ul
                      className="list-disc list-inside text-xs text-on-surface-variant space-y-1"
                    >
                      <li>
                        Architected real-time order processing pipelines scaling
                        to 1.2M transactions/min during Big Billion Days.
                      </li>
                      <li>
                        Reduced AWS EKS cloud infrastructure footprint by 28%
                        via dynamic pod autoscaling algorithms.
                      </li>
                      <li>
                        Spearheaded zero-downtime Kafka cluster migration across
                        3 VPC availability zones.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div
              className="p-5 bg-surface-container-low border-t border-surface-container flex flex-wrap items-center justify-between gap-3"
            >
              <button
                className="px-4 py-2 rounded-lg bg-error-container/40 text-error hover:bg-error-container font-label-md text-label-md font-semibold transition-colors"
                onClick={event => { openModal('reject-modal') }}
              >
                Reject Candidate
              </button>
              <div className="flex items-center gap-2">
                <button
                  className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors"
                  onClick={event => { 
                    showToast(
                      'Interview scheduling is a prototype; no invite was sent.',
                    )
                   }}
                >
                  Schedule Next Round
                </button>
                <button
                  className="px-5 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary-container transition-colors shadow-sm"
                  onClick={event => { advanceStageCandidate() }}
                >
                  Advance to Offer
                </button>
              </div>
            </div>
          </aside>
          
          <div
            className={"fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface-container-lowest rounded-xl shadow-2xl z-50 p-6 space-y-5" + (modal === 'reject-modal' ? '' : ' hidden')} id="reject-modal"
          >
            <div className="flex items-center gap-3 text-error">
              <span className="p-2.5 rounded-full bg-error-container text-error">
                <span className="material-symbols-outlined text-2xl"
                  >person_remove</span
                >
              </span>
              <div>
                <h3
                  className="font-headline-sm text-headline-sm text-on-surface font-semibold"
                >
                  Reject Candidate(s)
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Send polite rejection email and archive profile
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label
                  className="font-label-md text-label-md font-semibold text-on-surface"
                  >Primary Reason *</label
                >
                <select
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg font-body-sm text-body-sm text-on-surface focus:ring-2 focus:ring-error"
                 aria-label="Rejection reason" value={rejectReason} onChange={event=>setRejectReason(event.target.value)}>
                  <option>Lack of Distributed Systems depth in coding</option>
                  <option>Compensation (CTC) expectations exceed range</option>
                  <option>Notice period too long (&gt;60 days)</option>
                  <option>Selected alternative higher-match candidate</option>
                  <option>Cultural &amp; leadership divergence</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  defaultChecked
                  className="rounded w-4 h-4 text-primary focus:ring-primary"
                  id="send-reject-email"
                  type="checkbox"
                />
                <label
                  className="font-body-sm text-body-sm text-on-surface"
                  htmlFor="send-reject-email"
                  >Send polite automated EMS rejection email</label
                >
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                className="px-4 py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors"
                onClick={event => { closeModal('reject-modal') }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2.5 rounded-lg bg-error hover:bg-error/90 text-on-error font-label-md text-label-md font-semibold transition-colors"
                onClick={event => { confirmRejectCandidates() }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
          
          <div
            className={"fixed bottom-6 right-6 z-50 bg-[#0E2B3D] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 transform   transition-all duration-300" + (toast ? '' : ' translate-y-24 opacity-0 pointer-events-none')} id="toast" role="status"
          >
            <span className="material-symbols-outlined text-[#1CCA9B] text-xl"
              >check_circle</span
            >
            <span
              className="font-label-lg text-label-lg font-medium"
              id="toast-text"
              >{toast}</span>
          </div>
        </div>
        
        </main></div></>);
}
