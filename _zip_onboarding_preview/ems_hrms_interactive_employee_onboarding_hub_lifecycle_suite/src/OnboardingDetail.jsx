import { useEffect, useRef, useState } from 'react';
import { Sidebar, Header } from './Layout.jsx';
import { initialTaskChecks, initialDossierFields } from './onboardingDetailData.js';
export default function OnboardingDetail() {
 const [tab,setTab]=useState('overview');
 const [modal,setModal]=useState(null);
 const [status,setStatus]=useState('Day 1 Ready');
 const [menu,setMenu]=useState(false);
 const [fields,setFields]=useState(initialDossierFields);
 const [taskChecks,setTaskChecks]=useState(initialTaskChecks);
 const [newTasks,setNewTasks]=useState([]);
 const [notes,setNotes]=useState([]);
 const [goals,setGoals]=useState([]);
 const [assignedCourses,setAssignedCourses]=useState([]);
 const [courseChoice,setCourseChoice]=useState('Kubernetes Production Operations & Envoy Mesh');
 const [docStatus,setDocStatus]=useState('Pending Review');
 const [buddy,setBuddy]=useState('Rajeshwar Rao');
 const [bgv,setBgv]=useState(false);
 const [fileName,setFileName]=useState('');
 const [toast,setToast]=useState({message:''});
 const fileInput=useRef();
 const timer=useRef();
 const completedTasks=10+Object.values(taskChecks).filter(Boolean).length+newTasks.filter(item=>item.done).length;
 const totalTasks=20+newTasks.length;
 const percentage=Math.round(completedTasks/totalTasks*100);
 const setField=(key,value)=>setFields(previous=>({...previous,[key]:value}));
 const triggerToast=(message,type='info')=>{clearTimeout(timer.current);setToast({message,type});timer.current=setTimeout(()=>setToast({message:''}),4500);};
 const triggerBlockerToast=message=>triggerToast(message,'error');
 const switchTab=setTab;
 const toggleMenu=()=>setMenu(previous=>!previous);
 const openModal=setModal;
 const closeModal=()=>setModal(null);
 const togglePauseState=()=>{if(status==='Cancelled'){triggerToast('This onboarding has been cancelled.');return;}setStatus(previous=>previous==='Paused'?'Day 1 Ready':'Paused');};
 const simState=state=>{setStatus(state==='paused'?'Paused':'Day 1 Ready');if(state==='default')setTab('overview');};
 const handleTaskToggle=(checkbox,title)=>{
  if(status==='Cancelled'||status==='Paused'){triggerToast('Resume an active onboarding before updating tasks.');return;}
  if(title==='Configure AWS IAM SSO & Dev Clusters'&&checkbox.checked&&(!taskChecks['RFID Badge']||!taskChecks['Hardware Handover'])){triggerBlockerToast('Complete RFID Badge and Hardware Handover first.');return;}
  setTaskChecks(previous=>({...previous,[title]:checkbox.checked}));
 };
 const toggleNewTask=id=>{if(status!=='Day 1 Ready'){triggerToast('Resume an active onboarding before updating tasks.');return;}const task=newTasks.find(item=>item.id===id);if(task?.prerequisite&&(!taskChecks['RFID Badge']||!taskChecks['Hardware Handover'])){triggerBlockerToast('Complete RFID Badge and Hardware Handover first.');return;}setNewTasks(previous=>previous.map(item=>item.id===id?{...item,done:!item.done}:item));};
 const executeCancelOnboarding=()=>{if(!fields['cancel-reason-select']){triggerToast('Choose a cancellation reason.','error');return;}setStatus('Cancelled');closeModal();triggerToast('Onboarding cancelled locally: '+fields['cancel-reason-select']);};
 const submitNewTask=()=>{const title=fields['new-task-title']?.trim();if(!title){triggerToast('Task title is required.','error');return;}setNewTasks(previous=>[...previous,{id:Date.now(),title,owner:fields['new-task-owner'],due:fields['new-task-due'],stage:fields['new-task-stage'],prerequisite:fields['new-task-prereq'],done:false}]);setField('new-task-title','');closeModal();setTab('tasks');triggerToast('Task added to induction backlog.');};
 const verifyDoc=()=>{setDocStatus('Verified');triggerToast('Form 11 marked verified for this session.');};
 const confirmRejectDoc=()=>{setDocStatus('Rejected');closeModal();triggerToast('Form 11 marked rejected. No external notification was sent.');};
 const confirmBGVInitiation=()=>{setBgv(true);closeModal();setTab('bgv');triggerToast('BGV initiation recorded locally; external screening is not connected.');};
 const submitNewGoal=()=>{const title=fields['goal-title-input']?.trim();if(!title){triggerToast('Goal title is required.','error');return;}setGoals(previous=>[...previous,{title,phase:fields['goal-phase-select'],metric:fields['goal-metric-input']}]);setField('goal-title-input','');closeModal();setTab('goals');triggerToast('Milestone added.');};
 const confirmCourseAssignment=()=>{setAssignedCourses(previous=>previous.includes(courseChoice)?previous:[...previous,courseChoice]);closeModal();setTab('training');triggerToast('Course assigned locally.');};
 const postQuickNote=()=>{const text=fields['quick-note-input']?.trim();if(!text)return;setNotes(previous=>[{text,private:fields['note-visibility-toggle']},...previous]);setField('quick-note-input','');};
 const submitModalNote=()=>{const text=fields['modal-note-body']?.trim();if(!text)return;setNotes(previous=>[{text,private:fields['modal-note-privacy']},...previous]);setField('modal-note-body','');closeModal();setTab('activity');};
 const confirmBuddyReassignment=()=>{setBuddy(fields['new-buddy-select']);closeModal();triggerToast('Buddy updated locally.');};
 const handleFileChosen=input=>{const file=input.files?.[0];setFileName(file?file.name:'');};
 const submitDocUpload=()=>{if(!fileName){triggerToast('Choose a document first.','error');return;}setDocStatus('Pending Review');closeModal();triggerToast('Document filename recorded locally. No file was uploaded.');};
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 useEffect(()=>{
  if(!modal)return;
  const dialog=document.getElementById(modal),previous=document.activeElement;
  const controls=()=>[...dialog.querySelectorAll('button,input:not([type="file"]),select,textarea')].filter(el=>!el.disabled);controls()[0]?.focus();
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const keydown=event=>{if(event.key==='Escape')setModal(null);if(event.key==='Tab'){const items=controls(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};
  document.addEventListener('keydown',keydown);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keydown);previous?.focus();};
 },[modal]);
 return (<><Sidebar activePage="onboarding-detail" /><div className="pl-64"><Header /><main className="relative pt-16 bg-surface min-h-screen"><div className="flex flex-col w-full">

<div className="w-full bg-surface-container-high px-space-xl py-space-sm shadow-sm flex flex-wrap items-center justify-between gap-space-sm z-30">
<div className="flex items-center gap-space-sm flex-wrap">
<div className="flex items-center gap-1.5 text-on-surface-variant mr-1">
<span className="material-symbols-outlined text-base text-primary">tune</span>
<span className="font-label-caps text-label-caps uppercase tracking-wider font-bold">Simulator Controls:</span>
</div>
<button className="px-2.5 py-1 rounded bg-surface-container-lowest text-on-surface hover:bg-surface-variant font-label-md text-label-md shadow-sm transition-all" onClick={event => { simState('default') }}>1. Default Dossier</button>
<button className="px-2.5 py-1 rounded bg-surface-container-lowest text-on-surface hover:bg-surface-variant font-label-md text-label-md shadow-sm transition-all" onClick={event => { simState('paused') }}>2. Paused State</button>
<button className="px-2.5 py-1 rounded bg-surface-container-lowest text-on-surface hover:bg-surface-variant font-label-md text-label-md shadow-sm transition-all" onClick={event => { simState('resumed') }}>3. Resumed State</button>
<button className="px-2.5 py-1 rounded bg-surface-container-lowest text-error hover:bg-error-container font-label-md text-label-md shadow-sm transition-all" onClick={event => { openModal('modal-cancel') }}>4. Cancel Modal</button>
<button className="px-2.5 py-1 rounded bg-surface-container-lowest text-primary hover:bg-surface-variant font-label-md text-label-md shadow-sm transition-all" onClick={event => { openModal('modal-add-task') }}>5. Add Task</button>
<button className="px-2.5 py-1 rounded bg-surface-container-lowest text-on-surface hover:bg-surface-variant font-label-md text-label-md shadow-sm transition-all" onClick={event => { triggerBlockerToast('Mandatory Form 11 EPFO Declaration signature is required before IT token binding.') }}>6. Blocker Toast</button>
<button className="px-2.5 py-1 rounded bg-surface-container-lowest text-on-surface hover:bg-surface-variant font-label-md text-label-md shadow-sm transition-all" onClick={event => { openModal('modal-bgv') }}>7. Initiate BGV</button>
<button className="px-2.5 py-1 rounded bg-surface-container-lowest text-on-surface hover:bg-surface-variant font-label-md text-label-md shadow-sm transition-all" onClick={event => { openModal('modal-goal') }}>8. Add Goal</button>
<button className="px-2.5 py-1 rounded bg-surface-container-lowest text-on-surface hover:bg-surface-variant font-label-md text-label-md shadow-sm transition-all" onClick={event => { openModal('modal-course') }}>9. Assign Course</button>
<button className="px-2.5 py-1 rounded bg-surface-container-lowest text-on-surface hover:bg-surface-variant font-label-md text-label-md shadow-sm transition-all" onClick={event => { openModal('modal-note') }}>10. Add Note</button>
</div>
<span className="font-label-caps text-label-caps text-on-surface-variant hidden xl:inline">Live Reactive Induction Dossier Suite</span>
</div>
<div className="px-space-xl py-space-lg space-y-space-lg">

<div className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant">
<a className="hover:text-primary transition-colors flex items-center gap-1" href="#">
<span className="material-symbols-outlined text-sm">home</span>
        Dashboard
      </a>
<span className="material-symbols-outlined text-xs">chevron_right</span>
<a className="hover:text-primary transition-colors" href="#">Hire &amp; Lifecycle</a>
<span className="material-symbols-outlined text-xs">chevron_right</span>
<a className="hover:text-primary transition-colors" href="#">Onboarding Hub</a>
<span className="material-symbols-outlined text-xs">chevron_right</span>
<span className="text-on-surface font-semibold bg-surface-container-low px-2 py-0.5 rounded">EMP-2025-091 (Ananya Deshmukh)</span>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-md p-space-lg transition-all duration-300">
<div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-space-lg">

<div className="flex items-start gap-space-md">
<div className="relative">
<img className="w-20 h-20 rounded-xl object-cover shadow-sm ring-2 ring-primary/20" data-alt="Professional studio headshot of Ananya Deshmukh, an Indian female tech leader in her early 30s with confident warm expression, dark hair, wearing a slate blue blazer against a bright architectural studio background with soft mint green reflections." src="https://lh3.googleusercontent.com/aida-public/AB6AXuAdjypwNnAx8Anvv5ajgvOF8ZctcrWFmMUbKhV6MKCegeAJ5cCCyVAlWFrxxtWRHq5KVqLIFC3IGocd4OwNxDEmK9vdxfScz8GUMSpNjZz48coWuCBGKMbVCy01ntLc-lRsxcW60q7_qIpnxmdkPh0m5sV5ibrR4PdrfyLThscqATcD62WfgyiJgO2SBfTOlrLPMTkL0iUoBLya3gBuzJM3mlPUSADPg3bcdiF5OQJ9kMn_hywDCeQ8"/>
<span className="absolute -bottom-1 -right-1 bg-primary text-on-primary rounded-full p-0.5 shadow flex items-center justify-center">
<span className="material-symbols-outlined text-base">check</span>
</span>
</div>
<div className="space-y-1">
<div className="flex items-center gap-space-sm flex-wrap">
<h1 className="font-headline-md text-headline-md text-on-surface tracking-tight">Ananya Deshmukh</h1>
<span className="px-2.5 py-0.5 rounded-full font-label-md text-label-md font-semibold bg-primary-fixed text-on-primary-fixed flex items-center gap-1" id="badge-status">{status}</span>
<span className="font-label-caps text-label-caps uppercase tracking-wider bg-surface-container px-2 py-1 rounded text-secondary font-semibold">EMP-2025-091</span>
</div>
<p className="font-body-md text-body-md text-on-surface font-medium">Lead Distributed Systems Architect</p>
<p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1.5">
<span className="material-symbols-outlined text-sm text-outline">domain</span>
              Platform Engineering • Bengaluru HQ (Prestige Tech Park, Tower B)
            </p>
<div className="flex items-center gap-3 pt-1 text-on-surface-variant font-label-md text-label-md">
<span className="flex items-center gap-1 text-primary font-semibold">
<span className="material-symbols-outlined text-sm">calendar_today</span>
                Joining: 03 Mar 2025
              </span>
<span className="text-outline">•</span>
<span className="bg-surface-container-high px-2 py-0.5 rounded text-on-surface">5 Days Remaining</span>
</div>
</div>
</div>

<div className="flex items-center gap-space-md bg-surface-container-low px-space-lg py-3 rounded-xl shadow-inner mx-auto lg:mx-0">
<div className="relative w-20 h-20 flex items-center justify-center">
<svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
<circle cx="50" cy="50" fill="none" r="40" stroke="#dee8ff" strokeWidth="8"></circle>
<circle className="transition-all duration-700 ease-out" cx="50" cy="50" fill="none" id="radial-progress-bar" r="40" stroke="#00694f" strokeDasharray="251.32" strokeDashoffset={251.32*(1-percentage/100)} strokeLinecap="round" strokeWidth="8"></circle>
</svg>
<div className="absolute inset-0 flex flex-col items-center justify-center text-center">
<span className="font-headline-sm text-headline-sm font-bold text-on-surface leading-none" id="radial-progress-text">{percentage+'%'}</span>
<span className="font-label-caps text-label-caps text-on-surface-variant uppercase text-[10px]">Induction</span>
</div>
</div>
<div className="space-y-0.5">
<p className="font-label-lg text-label-lg font-semibold text-on-surface"><span id="task-completed-count">{completedTasks}</span> of <span id="task-total-count">{totalTasks}</span> Tasks Completed</p>
<p className="font-body-sm text-body-sm text-on-surface-variant">4 milestones remaining before onboarding sign-off</p>
<div className="flex items-center gap-2 pt-1">
<span className="inline-block w-2 h-2 rounded-full bg-primary"></span>
<span className="font-label-caps text-label-caps text-primary font-semibold">Pre-Boarding 100% Complete</span>
</div>
</div>
</div>

<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
<button className="px-space-md py-2 rounded-lg bg-surface-container-high hover:bg-surface-container text-on-surface font-label-lg text-label-lg font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm" id="btn-pause-toggle" onClick={event => { togglePauseState() }}>
<span className="material-symbols-outlined text-base" id="icon-pause-toggle">{status==='Paused'?'play_circle':'pause_circle'}</span>
<span id="text-pause-toggle">{status==='Paused'?'Resume Onboarding':'Pause Onboarding'}</span>
</button>
<button className="px-space-md py-2 rounded-lg bg-surface-container-low hover:bg-error-container text-error font-label-lg text-label-lg font-semibold flex items-center justify-center gap-1.5 transition-all" onClick={event => { openModal('modal-cancel') }}>
<span className="material-symbols-outlined text-base">cancel</span>
            Cancel Onboarding
          </button>

<div className="relative inline-block text-left">
<button className="p-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-all flex items-center justify-center" onClick={event => { toggleMenu('hero-action-dropdown') }}>
<span className="material-symbols-outlined">more_vert</span>
</button>
<div className={" absolute right-0 mt-2 w-56 rounded-xl bg-surface-container-lowest shadow-xl ring-1 ring-on-surface/5 z-50 py-1 font-body-sm text-body-sm" + (menu ? '' : ' hidden')} id="hero-action-dropdown">
<a className="flex items-center gap-2.5 px-4 py-2 hover:bg-surface-container text-on-surface" href="#" onClick={event => { triggerToast('Compiling comprehensive Induction Dossier PDF (EMP-2025-091)...'); toggleMenu('hero-action-dropdown'); return false; }}>
<span className="material-symbols-outlined text-base text-primary">picture_as_pdf</span>
                Export Dossier PDF
              </a>
<a className="flex items-center gap-2.5 px-4 py-2 hover:bg-surface-container text-on-surface" href="#" onClick={event => { triggerToast("Prototype action: Reminder notification pushed to Rajeshwar Rao via Slack & Email. No external service is connected."); toggleMenu('hero-action-dropdown'); return false; }}>
<span className="material-symbols-outlined text-base text-secondary">notifications_active</span>
                Send Reminder to Buddy
              </a>
<a className="flex items-center gap-2.5 px-4 py-2 hover:bg-surface-container text-on-surface" href="#" onClick={event => { openModal('modal-buddy-reassign'); toggleMenu('hero-action-dropdown'); return false; }}>
<span className="material-symbols-outlined text-base text-tertiary">swap_horiz</span>
                Re-assign Buddy
              </a>
</div>
</div>
</div>
</div>
</div>

<div className="border-b border-transparent">
<div className="flex items-center gap-1 overflow-x-auto pb-1" id="tab-nav-container">
<button className={"tab-button active flex items-center gap-2 px-space-md py-2.5 rounded-lg font-label-lg text-label-lg font-semibold transition-all" + (tab==='overview' ? ' bg-primary text-on-primary shadow-sm' : '')} data-tab-btn="overview" onClick={event => { switchTab('overview') }}>
<span className="material-symbols-outlined text-base">dashboard</span>
          Overview
        </button>
<button className={"tab-button flex items-center gap-2 px-space-md py-2.5 rounded-lg font-label-lg text-label-lg font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all" + (tab==='tasks' ? ' bg-primary text-on-primary shadow-sm' : '')} data-tab-btn="tasks" onClick={event => { switchTab('tasks') }}>
<span className="material-symbols-outlined text-base">checklist</span>
          Tasks
          <span className="px-1.5 py-0.2 rounded-full font-label-caps text-label-caps bg-surface-container-high text-on-surface font-bold" id="tab-task-badge">{completedTasks+'/'+totalTasks}</span>
</button>
<button className={"tab-button flex items-center gap-2 px-space-md py-2.5 rounded-lg font-label-lg text-label-lg font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all" + (tab==='documents' ? ' bg-primary text-on-primary shadow-sm' : '')} data-tab-btn="documents" onClick={event => { switchTab('documents') }}>
<span className="material-symbols-outlined text-base">folder_open</span>
          Documents
          <span className="px-1.5 py-0.2 rounded-full font-label-caps text-label-caps bg-surface-container-high text-on-surface font-bold">4/5</span>
</button>
<button className={"tab-button flex items-center gap-2 px-space-md py-2.5 rounded-lg font-label-lg text-label-lg font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all" + (tab==='bgv' ? ' bg-primary text-on-primary shadow-sm' : '')} data-tab-btn="bgv" onClick={event => { switchTab('bgv') }}>
<span className="material-symbols-outlined text-base">verified_user</span>
          Background Check (BGV)
          <span className="px-1.5 py-0.2 rounded-full font-label-caps text-label-caps bg-primary-fixed text-on-primary-fixed font-bold">98% Green</span>
</button>
<button className={"tab-button flex items-center gap-2 px-space-md py-2.5 rounded-lg font-label-lg text-label-lg font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all" + (tab==='goals' ? ' bg-primary text-on-primary shadow-sm' : '')} data-tab-btn="goals" onClick={event => { switchTab('goals') }}>
<span className="material-symbols-outlined text-base">flag</span>
          Goals &amp; Milestones
          <span className="px-1.5 py-0.2 rounded-full font-label-caps text-label-caps bg-surface-container-high text-on-surface font-bold">3 Plannings</span>
</button>
<button className={"tab-button flex items-center gap-2 px-space-md py-2.5 rounded-lg font-label-lg text-label-lg font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all" + (tab==='training' ? ' bg-primary text-on-primary shadow-sm' : '')} data-tab-btn="training" onClick={event => { switchTab('training') }}>
<span className="material-symbols-outlined text-base">school</span>
          Training &amp; LMS
          <span className="px-1.5 py-0.2 rounded-full font-label-caps text-label-caps bg-surface-container-high text-on-surface font-bold">2/3</span>
</button>
<button className={"tab-button flex items-center gap-2 px-space-md py-2.5 rounded-lg font-label-lg text-label-lg font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all" + (tab==='activity' ? ' bg-primary text-on-primary shadow-sm' : '')} data-tab-btn="activity" onClick={event => { switchTab('activity') }}>
<span className="material-symbols-outlined text-base">history_edu</span>
          Activity &amp; Notes
        </button>
</div>
</div>

<div className={"tab-panel space-y-space-lg" + (tab==='overview' ? '' : ' hidden')} id="tab-overview"><p className="text-body-sm text-secondary">Current buddy: {buddy}</p>

<div className="bg-error-container text-on-error-container p-space-md rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-space-sm shadow-sm">
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-2xl text-error">warning</span>
<div>
<p className="font-label-lg text-label-lg font-bold">1 Urgent Attention Blocker: Form 11 (EPFO Pension Declaration) Pending Digital Signature</p>
<p className="font-body-sm text-body-sm opacity-90">Required by EPFO regulatory guidelines prior to PF portal batch push on 05 Mar 2025.</p>
</div>
</div>
<div className="flex items-center gap-space-sm">
<button className="px-space-sm py-1.5 rounded-lg bg-surface-container-lowest text-on-error-container font-label-md text-label-md font-semibold hover:bg-white shadow-sm flex items-center gap-1" onClick={event => { triggerToast("Prototype action: Automated SMS & WhatsApp DocuSign link preview to Ananya (+91 98840 XXXXX). No external service is connected.") }}>
<span className="material-symbols-outlined text-sm">send</span>
            Send Instant Ping
          </button>
<button className="px-space-sm py-1.5 rounded-lg bg-error text-on-error font-label-md text-label-md font-semibold hover:opacity-90 shadow-sm" onClick={event => { switchTab('documents') }}>
            View Document
          </button>
</div>
</div>

<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">

<div className="lg:col-span-8 bg-surface-container-lowest p-space-lg rounded-xl shadow-md space-y-space-md">
<div className="flex items-center justify-between">
<div>
<h2 className="font-title-md text-title-md text-on-surface font-bold">Induction Runway &amp; Key Milestones</h2>
<p className="font-body-sm text-body-sm text-on-surface-variant">Scheduled physical &amp; virtual touchpoints</p>
</div>
<span className="font-label-caps text-label-caps uppercase bg-primary-fixed text-on-primary-fixed px-2.5 py-1 rounded-full font-bold">Batch 2025-Q1-B</span>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
<div className="bg-surface-container-low p-space-md rounded-xl space-y-2">
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant font-bold">Stage 01</span>
<span className="px-2 py-0.5 rounded-full font-label-caps text-label-caps bg-primary text-on-primary font-semibold">Completed</span>
</div>
<h3 className="font-label-lg text-label-lg font-bold text-on-surface">Offer Accepted &amp; Signed</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant">Formal Letter of Appointment countersigned via DocuSign.</p>
<div className="flex items-center gap-1.5 font-label-md text-label-md text-primary font-medium pt-1">
<span className="material-symbols-outlined text-sm">event_available</span>
                12 Feb 2025 • 17:42 IST
              </div>
</div>
<div className="bg-surface-container-low p-space-md rounded-xl space-y-2">
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant font-bold">Stage 02</span>
<span className="px-2 py-0.5 rounded-full font-label-caps text-label-caps bg-primary text-on-primary font-semibold">Delivered</span>
</div>
<h3 className="font-label-lg text-label-lg font-bold text-on-surface">Welcome Swag Kit Dispatched</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant">EMS hoodie, thermos flask, notebook delivered via BlueDart (AWB #BD8892104).</p>
<div className="flex items-center gap-1.5 font-label-md text-label-md text-primary font-medium pt-1">
<span className="material-symbols-outlined text-sm">local_shipping</span>
                18 Feb 2025 • Signature Verified
              </div>
</div>
<div className="bg-surface-container-low p-space-md rounded-xl space-y-2">
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant font-bold">Stage 03</span>
<span className="px-2 py-0.5 rounded-full font-label-caps text-label-caps bg-secondary-fixed text-on-secondary-fixed font-semibold">Ready for Pickup</span>
</div>
<h3 className="font-label-lg text-label-lg font-bold text-on-surface">IT Hardware Handover</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant">MacBook Pro 16" M3 Max (64GB RAM, 1TB SSD), YubiKey 5C NFC staged at IT Desk.</p>
<div className="flex items-center gap-1.5 font-label-md text-label-md text-secondary font-medium pt-1">
<span className="material-symbols-outlined text-sm">laptop_mac</span>
                28 Feb 2025 • Desk 4B-12, Bengaluru
              </div>
</div>
<div className="bg-surface-container-low p-space-md rounded-xl space-y-2">
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant font-bold">Stage 04</span>
<span className="px-2 py-0.5 rounded-full font-label-caps text-label-caps bg-surface-container-highest text-on-surface font-semibold">Upcoming</span>
</div>
<h3 className="font-label-lg text-label-lg font-bold text-on-surface">Official Induction Day 1</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant">Orientation with Executive Leadership &amp; Platform Engineering Team Meet.</p>
<div className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface font-medium pt-1">
<span className="material-symbols-outlined text-sm">meeting_room</span>
                03 Mar 2025 • 09:30 IST, Town Hall Room 2A
              </div>
</div>
</div>

<div className="bg-surface-container p-space-sm rounded-lg flex items-center justify-between text-on-surface">
<span className="font-label-md text-label-md flex items-center gap-2">
<span className="material-symbols-outlined text-primary text-base">flag_circle</span>
              Next Critical Checkpoint: <strong>30-Day Check-in &amp; Review on 03 Apr 2025</strong>
</span>
<button className="font-label-caps text-label-caps text-primary hover:underline font-bold uppercase" onClick={event => { triggerToast("Prototype action: Calendar invite synced to Arunachalam Murthy and Ananya Deshmukh. No external service is connected.") }}>Sync Calendar</button>
</div>
</div>

<div className="lg:col-span-4 bg-surface-container-lowest p-space-lg rounded-xl shadow-md space-y-space-md flex flex-col justify-between">
<div>
<div className="flex items-center justify-between mb-space-sm">
<h2 className="font-title-md text-title-md text-on-surface font-bold">Onboarding Squad</h2>
<span className="material-symbols-outlined text-on-surface-variant">diversity_3</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">Primary contacts assigned to guide Ananya</p>
<div className="space-y-space-sm">

<div className="p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container transition-all">
<div className="flex items-start gap-3">
<img className="w-11 h-11 rounded-lg object-cover" data-alt="Portrait of Rajeshwar Rao, a 35-year-old male SRE architect with glasses, smiling friendly in front of a modern Bangalore software engineering floor with ambient mint lighting." src="https://lh3.googleusercontent.com/aida-public/AB6AXuAluuDATEKCxZ0Yq40wtWYadtl9SPQS7LgZRr3kbIk2R-A4W4phVaoxPdIr32JJ--AIb34QFDCMq8IBTTRfd5UG3e6ULnfvInH2iJxDbsr0K8XgCtqHy6d5z6mG0ZMGofQfgyqlAtp6_YpVY7EicsYZF75LAMVuYNTRagzFJKMRtJ1nWh--B2K1jy39KtXhpxR3w74SdlpDHune3Xv6hcd5idGX5xOfMu7YwEGibjcSvkQjztNkGSP4"/>
<div className="flex-1 min-w-0">
<div className="flex items-center justify-between">
<p className="font-label-lg text-label-lg font-bold text-on-surface truncate">Rajeshwar Rao</p>
<span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary-fixed text-on-primary-fixed uppercase">Buddy</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant truncate">Principal SRE &amp; Bar-Raiser</p>
<div className="flex items-center gap-2 mt-2">
<button className="px-2 py-1 bg-surface-container-lowest text-primary text-label-caps font-bold rounded shadow-sm hover:bg-white flex items-center gap-1" onClick={event => { triggerToast('Slack channel #ananya-onboarding-buddy opened.') }}>
<span className="material-symbols-outlined text-xs">chat</span>
                        Slack Ping
                      </button>
<button className="px-2 py-1 bg-surface-container-lowest text-on-surface text-label-caps font-bold rounded shadow-sm hover:bg-white flex items-center gap-1" onClick={event => { triggerToast("Prototype action: Dialing Rajeshwar Rao on EMS VoIP... No external service is connected.") }}>
<span className="material-symbols-outlined text-xs">call</span>
                        Call
                      </button>
</div>
</div>
</div>
</div>

<div className="p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container transition-all">
<div className="flex items-start gap-3">
<img className="w-11 h-11 rounded-lg object-cover" data-alt="Portrait of Arunachalam Murthy, an experienced technology VP in his 40s wearing an emerald casual shirt with architectural glass offices behind him." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDsSPh01TuCSBGOoMzkArFqryKqUQLJvyi8on5ORapyXgiS_hoORlpxISw4gbmUlP0iEwJnb52Uc45GcF7wWPepzWxm24ZxW8sfEr9kwFN8QdZa_XGtOqLVtrktXQyN3r_36n-SBvYzIRdwkndestvJHDbviWFKmlFXINZOX16V7xWZptJMYNnn1jphZiDi4ses8Ru85iGrMOtSq_4JaWBiK0yTwvJwRqRu2U5bRgWw7-sUCHnlkPgZ"/>
<div className="flex-1 min-w-0">
<div className="flex items-center justify-between">
<p className="font-label-lg text-label-lg font-bold text-on-surface truncate">Arunachalam Murthy</p>
<span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-secondary-fixed text-on-secondary-fixed uppercase">Manager</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant truncate">CTO &amp; VP Core Platform</p>
<div className="mt-2">
<button className="w-full py-1 bg-surface-container-lowest text-secondary text-label-caps font-bold rounded shadow-sm hover:bg-white flex items-center justify-center gap-1" onClick={event => { triggerToast('Drafting 1:1 onboarding cadence invitation for Arunachalam & Ananya...') }}>
<span className="material-symbols-outlined text-xs">calendar_add_on</span>
                        Schedule Day 1 Sync
                      </button>
</div>
</div>
</div>
</div>

<div className="p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container transition-all">
<div className="flex items-start gap-3">
<img className="w-11 h-11 rounded-lg object-cover" data-alt="Corporate headshot of Priya Sharma, HR Director, poised and professional with high contrast enterprise backdrop and teal accent tone." src="https://lh3.googleusercontent.com/aida-public/AB6AXuAaX6jPdUexEr8j1SpJWrSuCjhMHxKovxX-pQD4EACBpKa43xxboJy8F2RkD2-c-EfQGHXniIi5DYpS0nSIdQ10EE9XzKNLGEKS-i7VajR9abVVURNpv6i1zIiH-6qwg5OpfgQuxQRDD9p8cfj0CaGcSpoLTfBlcrS_WCUU3Z8ofzTxj5L6qaxuweOrFuPQzH5JGehcH3WM6Y24eMEnDupcXUf3hE0Sp94T4WjRmmASMg3dxNRIOrPS"/>
<div className="flex-1 min-w-0">
<div className="flex items-center justify-between">
<p className="font-label-lg text-label-lg font-bold text-on-surface truncate">Priya Sharma</p>
<span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-container-high text-on-surface uppercase">People Partner</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant truncate">HR Director (Talent Operations)</p>
<p className="font-label-caps text-label-caps text-primary mt-1">Direct Escalation Lead</p>
</div>
</div>
</div>
</div>
</div>
<div className="pt-space-sm">
<button className="w-full py-2 bg-surface-container-high hover:bg-surface-container text-on-surface font-label-md text-label-md font-semibold rounded-lg text-center transition-all" onClick={event => { openModal('modal-buddy-reassign') }}>
              Manage Stakeholder Assignments
            </button>
</div>
</div>
</div>
</div>

<div className={"tab-panel space-y-space-lg" + (tab==='tasks' ? '' : ' hidden')} id="tab-tasks">{newTasks.map(item=><label key={item.id} className="flex gap-3 p-4 bg-surface-container-low rounded-lg"><input type="checkbox" checked={item.done} onChange={()=>toggleNewTask(item.id)} aria-label={item.title}/><span>{item.title} · {item.owner} · {item.due}</span></label>)}
<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-md space-y-space-md">

<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm">
<div>
<h2 className="font-title-md text-title-md font-bold text-on-surface">Induction Checklist &amp; Prerequisite Chain</h2>
<p className="font-body-sm text-body-sm text-on-surface-variant">Interactive verification tasks. Checking items recalibrates dossier metrics in real-time.</p>
</div>
<div className="flex items-center gap-2">
<button className="px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg font-semibold flex items-center gap-1.5 shadow-sm hover:opacity-95 transition-all" onClick={event => { openModal('modal-add-task') }}>
<span className="material-symbols-outlined text-base">add_task</span>
              + Add Task
            </button>
</div>
</div>

<div className="space-y-space-sm">
<div className="flex items-center justify-between bg-surface-container-low px-space-md py-2 rounded-lg">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-primary text-base">verified</span>
<span className="font-label-lg text-label-lg font-bold text-on-surface">1. Pre-Boarding Compliance</span>
</div>
<span className="font-label-caps text-label-caps font-bold text-primary bg-primary-fixed px-2 py-0.5 rounded-full">All 4 Completed</span>
</div>
<div className="space-y-1.5 pl-2">
<div className="task-row flex items-center justify-between p-space-sm bg-surface-container-lowest hover:bg-surface-container-low rounded-lg transition-all group">
<div className="flex items-center gap-3">
<input className="w-5 h-5 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer accent-primary" checked={Boolean(taskChecks["Sign NDA"])} onChange={event=>handleTaskToggle(event.currentTarget,"Sign NDA")} type="checkbox"/>
<div>
<p className="font-body-md text-body-md font-semibold text-on-surface line-through text-outline">Sign Corporate Non-Disclosure Agreement (NDA)</p>
<p className="font-body-sm text-body-sm text-on-surface-variant">DocuSign Envelope ID: #DS-8812-NDA • Complete</p>
</div>
</div>
<div className="flex items-center gap-space-md text-on-surface-variant font-label-md text-label-md">
<span className="bg-surface-container px-2 py-0.5 rounded text-on-surface text-label-caps">Candidate</span>
<span>12 Feb 2025</span>
</div>
</div>
<div className="task-row flex items-center justify-between p-space-sm bg-surface-container-lowest hover:bg-surface-container-low rounded-lg transition-all group">
<div className="flex items-center gap-3">
<input className="w-5 h-5 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer accent-primary" checked={Boolean(taskChecks["PAN & Aadhaar details"])} onChange={event=>handleTaskToggle(event.currentTarget,"PAN & Aadhaar details")} type="checkbox"/>
<div>
<p className="font-body-md text-body-md font-semibold text-on-surface line-through text-outline">Submit PAN &amp; Aadhaar details via DigiLocker API</p>
<p className="font-body-sm text-body-sm text-on-surface-variant">Instant KYC verification green cleared</p>
</div>
</div>
<div className="flex items-center gap-space-md text-on-surface-variant font-label-md text-label-md">
<span className="bg-surface-container px-2 py-0.5 rounded text-on-surface text-label-caps">HR Ops</span>
<span>14 Feb 2025</span>
</div>
</div>
<div className="task-row flex items-center justify-between p-space-sm bg-surface-container-lowest hover:bg-surface-container-low rounded-lg transition-all group">
<div className="flex items-center gap-3">
<input className="w-5 h-5 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer accent-primary" checked={Boolean(taskChecks["Emergency Contacts"])} onChange={event=>handleTaskToggle(event.currentTarget,"Emergency Contacts")} type="checkbox"/>
<div>
<p className="font-body-md text-body-md font-semibold text-on-surface line-through text-outline">Provide Family Emergency Contact &amp; Medical Declaration</p>
<p className="font-body-sm text-body-sm text-on-surface-variant">Primary: Alok Deshmukh (Spouse)</p>
</div>
</div>
<div className="flex items-center gap-space-md text-on-surface-variant font-label-md text-label-md">
<span className="bg-surface-container px-2 py-0.5 rounded text-on-surface text-label-caps">Candidate</span>
<span>16 Feb 2025</span>
</div>
</div>
<div className="task-row flex items-center justify-between p-space-sm bg-surface-container-lowest hover:bg-surface-container-low rounded-lg transition-all group">
<div className="flex items-center gap-3">
<input className="w-5 h-5 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer accent-primary" checked={Boolean(taskChecks["Welcome Swag Kit"])} onChange={event=>handleTaskToggle(event.currentTarget,"Welcome Swag Kit")} type="checkbox"/>
<div>
<p className="font-body-md text-body-md font-semibold text-on-surface line-through text-outline">Confirm delivery of Welcome Swag Kit at residential address</p>
<p className="font-body-sm text-body-sm text-on-surface-variant">Bengaluru Koramangala residence</p>
</div>
</div>
<div className="flex items-center gap-space-md text-on-surface-variant font-label-md text-label-md">
<span className="bg-surface-container px-2 py-0.5 rounded text-on-surface text-label-caps">Logistics</span>
<span>18 Feb 2025</span>
</div>
</div>
</div>
</div>

<div className="space-y-space-sm">
<div className="flex items-center justify-between bg-surface-container-low px-space-md py-2 rounded-lg">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-secondary text-base">pending_actions</span>
<span className="font-label-lg text-label-lg font-bold text-on-surface">2. Day 1 Physical Induction (03 Mar 2025)</span>
</div>
<span className="font-label-caps text-label-caps font-bold text-secondary bg-secondary-fixed px-2 py-0.5 rounded-full">3 of 4 Done</span>
</div>
<div className="space-y-1.5 pl-2">
<div className="task-row flex items-center justify-between p-space-sm bg-surface-container-lowest hover:bg-surface-container-low rounded-lg transition-all">
<div className="flex items-center gap-3">
<input className="w-5 h-5 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer accent-primary" checked={Boolean(taskChecks["RFID Badge"])} onChange={event=>handleTaskToggle(event.currentTarget,"RFID Badge")} type="checkbox"/>
<div>
<p className="font-body-md text-body-md font-semibold text-on-surface line-through text-outline">Issue Corporate RFID Badge &amp; Basement Parking Access</p>
<p className="font-body-sm text-body-sm text-on-surface-variant">Badge Tag: #B9-4982 • Facilities Security</p>
</div>
</div>
<div className="flex items-center gap-space-md text-on-surface-variant font-label-md text-label-md">
<span className="bg-surface-container px-2 py-0.5 rounded text-on-surface text-label-caps">Facilities</span>
<span>03 Mar 2025</span>
</div>
</div>
<div className="task-row flex items-center justify-between p-space-sm bg-surface-container-lowest hover:bg-surface-container-low rounded-lg transition-all">
<div className="flex items-center gap-3">
<input className="w-5 h-5 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer accent-primary" checked={Boolean(taskChecks["Hardware Handover"])} onChange={event=>handleTaskToggle(event.currentTarget,"Hardware Handover")} type="checkbox"/>
<div>
<p className="font-body-md text-body-md font-semibold text-on-surface line-through text-outline">IT Hardware Handover: MacBook Pro 16" &amp; YubiKey Enrollment</p>
<p className="font-body-sm text-body-sm text-on-surface-variant">Device Asset Tag: #ASSET-MAC-9821</p>
</div>
</div>
<div className="flex items-center gap-space-md text-on-surface-variant font-label-md text-label-md">
<span className="bg-surface-container px-2 py-0.5 rounded text-on-surface text-label-caps">IT Helpdesk</span>
<span>03 Mar 2025</span>
</div>
</div>

<div className="task-row flex items-center justify-between p-space-sm bg-surface-container-low rounded-lg transition-all">
<div className="flex items-center gap-3">
<input className="w-5 h-5 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer accent-primary" checked={Boolean(taskChecks["Configure AWS IAM SSO & Dev Clusters"])} onChange={event=>handleTaskToggle(event.currentTarget,"Configure AWS IAM SSO & Dev Clusters")} type="checkbox"/>
<div>
<div className="flex items-center gap-2">
<p className="font-body-md text-body-md font-semibold text-on-surface">Provision Production Bastion &amp; AWS IAM Identity Center SSO</p>
<span className="px-2 py-0.5 rounded font-label-caps text-label-caps bg-error-container text-on-error-container font-bold flex items-center gap-1">
<span className="material-symbols-outlined text-xs">lock</span>
                      Prerequisite Required
                    </span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant">Requires physical YubiKey token verification with IT Ops desk</p>
</div>
</div>
<div className="flex items-center gap-space-md text-on-surface-variant font-label-md text-label-md">
<span className="bg-surface-container px-2 py-0.5 rounded text-on-surface text-label-caps">SecOps</span>
<span className="font-semibold text-error">03 Mar 2025</span>
</div>
</div>
<div className="task-row flex items-center justify-between p-space-sm bg-surface-container-lowest hover:bg-surface-container-low rounded-lg transition-all">
<div className="flex items-center gap-3">
<input className="w-5 h-5 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer accent-primary" checked={Boolean(taskChecks["Buddy Introduction Lunch"])} onChange={event=>handleTaskToggle(event.currentTarget,"Buddy Introduction Lunch")} type="checkbox"/>
<div>
<p className="font-body-md text-body-md font-semibold text-on-surface line-through text-outline">Buddy Introduction &amp; Cafeteria Welcome Lunch</p>
<p className="font-body-sm text-body-sm text-on-surface-variant">Reserved cafeteria dining with Platform Engineering leads</p>
</div>
</div>
<div className="flex items-center gap-space-md text-on-surface-variant font-label-md text-label-md">
<span className="bg-surface-container px-2 py-0.5 rounded text-on-surface text-label-caps">Rajeshwar (Buddy)</span>
<span>03 Mar 2025</span>
</div>
</div>
</div>
</div>

<div className="space-y-space-sm">
<div className="flex items-center justify-between bg-surface-container-low px-space-md py-2 rounded-lg">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-outline text-base">update</span>
<span className="font-label-lg text-label-lg font-bold text-on-surface">3. First Week &amp; First 30 Days</span>
</div>
<span className="font-label-caps text-label-caps font-bold text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full">Pending Progression</span>
</div>
<div className="space-y-1.5 pl-2">
<div className="task-row flex items-center justify-between p-space-sm bg-surface-container-lowest hover:bg-surface-container-low rounded-lg transition-all">
<div className="flex items-center gap-3">
<input className="w-5 h-5 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer accent-primary" checked={Boolean(taskChecks["Architecture Walkthrough"])} onChange={event=>handleTaskToggle(event.currentTarget,"Architecture Walkthrough")} type="checkbox"/>
<div>
<p className="font-body-md text-body-md font-semibold text-on-surface">Complete Core Platform Architecture Deep Dive (Kafka &amp; gRPC mesh)</p>
<p className="font-body-sm text-body-sm text-on-surface-variant">Conducted by Arunachalam Murthy &amp; SRE Leads</p>
</div>
</div>
<div className="flex items-center gap-space-md text-on-surface-variant font-label-md text-label-md">
<span className="bg-surface-container px-2 py-0.5 rounded text-on-surface text-label-caps">Platform Team</span>
<span>07 Mar 2025</span>
</div>
</div>
<div className="task-row flex items-center justify-between p-space-sm bg-surface-container-lowest hover:bg-surface-container-low rounded-lg transition-all">
<div className="flex items-center gap-3">
<input className="w-5 h-5 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer accent-primary" checked={Boolean(taskChecks["First PR Merge"])} onChange={event=>handleTaskToggle(event.currentTarget,"First PR Merge")} type="checkbox"/>
<div>
<p className="font-body-md text-body-md font-semibold text-on-surface">Ship &amp; Merge First Canary PR to Core Service Registry</p>
<p className="font-body-sm text-body-sm text-on-surface-variant">Milestone task for developer velocity ramp-up</p>
</div>
</div>
<div className="flex items-center gap-space-md text-on-surface-variant font-label-md text-label-md">
<span className="bg-surface-container px-2 py-0.5 rounded text-on-surface text-label-caps">Candidate</span>
<span>14 Mar 2025</span>
</div>
</div>
</div>
</div>
</div>
</div>

<div className={"tab-panel space-y-space-lg" + (tab==='documents' ? '' : ' hidden')} id="tab-documents">
<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-md space-y-space-md">
<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm">
<div>
<h2 className="font-title-md text-title-md font-bold text-on-surface">Mandatory Compliance &amp; Dossier Documents</h2>
<p className="font-body-sm text-body-sm text-on-surface-variant">Statutory compliance documents required under Indian Labour &amp; Tax codes</p>
</div>
<button className="px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg font-semibold flex items-center gap-1.5 shadow-sm hover:opacity-95 transition-all" onClick={event => { openModal('modal-upload-doc') }}>
<span className="material-symbols-outlined text-base">cloud_upload</span>
            Upload Document
          </button>
</div>

<div className="overflow-x-auto rounded-xl border border-outline-variant/30">
<table className="w-full text-left font-body-sm text-body-sm">
<thead className="bg-surface-container-low font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
<tr>
<th className="p-space-md">Document Name</th>
<th className="p-space-md">Source / Ref</th>
<th className="p-space-md">Uploaded Date</th>
<th className="p-space-md">Verification Status</th>
<th className="p-space-md text-right">Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-outline-variant/20 bg-surface-container-lowest">

<tr className="hover:bg-surface-container-low/60 transition-colors">
<td className="p-space-md">
<div className="flex items-center gap-2.5">
<span className="material-symbols-outlined text-primary text-xl">description</span>
<div>
<p className="font-label-lg text-label-lg font-bold text-on-surface">Countersigned Appointment Letter</p>
<p className="text-xs text-on-surface-variant">Offer-EMP-2025-091.pdf (2.4 MB)</p>
</div>
</div>
</td>
<td className="p-space-md text-on-surface-variant">DocuSign Cryptographic Seal</td>
<td className="p-space-md text-on-surface-variant">12 Feb 2025</td>
<td className="p-space-md">
<span className="px-2.5 py-0.5 rounded-full font-label-caps text-label-caps font-semibold bg-primary-fixed text-on-primary-fixed inline-flex items-center gap-1">
<span className="material-symbols-outlined text-xs">check_circle</span>
                    Verified
                  </span>
</td>
<td className="p-space-md text-right">
<button className="text-primary hover:underline font-label-md text-label-md font-semibold" onClick={event => { triggerToast('Opening Countersigned Appointment Letter viewer...') }}>View PDF</button>
</td>
</tr>

<tr className="hover:bg-surface-container-low/60 transition-colors">
<td className="p-space-md">
<div className="flex items-center gap-2.5">
<span className="material-symbols-outlined text-primary text-xl">badge</span>
<div>
<p className="font-label-lg text-label-lg font-bold text-on-surface">PAN Card &amp; Aadhaar e-Vault</p>
<p className="text-xs text-on-surface-variant">DigiLocker-UIDAI-KYC-901.xml (Encrypted)</p>
</div>
</div>
</td>
<td className="p-space-md text-on-surface-variant">National DigiLocker API Gateway</td>
<td className="p-space-md text-on-surface-variant">14 Feb 2025</td>
<td className="p-space-md">
<span className="px-2.5 py-0.5 rounded-full font-label-caps text-label-caps font-semibold bg-primary-fixed text-on-primary-fixed inline-flex items-center gap-1">
<span className="material-symbols-outlined text-xs">check_circle</span>
                    DigiLocker Validated
                  </span>
</td>
<td className="p-space-md text-right">
<button className="text-primary hover:underline font-label-md text-label-md font-semibold" onClick={event => { triggerToast('Viewing DigiLocker validation certificate...') }}>Audit Record</button>
</td>
</tr>

<tr className="hover:bg-surface-container-low/60 transition-colors">
<td className="p-space-md">
<div className="flex items-center gap-2.5">
<span className="material-symbols-outlined text-primary text-xl">history</span>
<div>
<p className="font-label-lg text-label-lg font-bold text-on-surface">Relieving &amp; Experience Letter - Flipkart</p>
<p className="text-xs text-on-surface-variant">Flipkart_Internet_Relieving_Ananya.pdf (1.1 MB)</p>
</div>
</div>
</td>
<td className="p-space-md text-on-surface-variant">Direct Candidate Upload</td>
<td className="p-space-md text-on-surface-variant">15 Feb 2025</td>
<td className="p-space-md">
<span className="px-2.5 py-0.5 rounded-full font-label-caps text-label-caps font-semibold bg-primary-fixed text-on-primary-fixed inline-flex items-center gap-1">
<span className="material-symbols-outlined text-xs">check_circle</span>
                    Verified by HR
                  </span>
</td>
<td className="p-space-md text-right">
<button className="text-primary hover:underline font-label-md text-label-md font-semibold" onClick={event => { triggerToast('Fetching original Flipkart relieving letter...') }}>Download</button>
</td>
</tr>

<tr className="bg-surface-container-low/40 hover:bg-surface-container transition-colors" id="row-doc-form11">
<td className="p-space-md">
<div className="flex items-center gap-2.5">
<span className="material-symbols-outlined text-secondary text-xl">draw</span>
<div>
<p className="font-label-lg text-label-lg font-bold text-on-surface">Form 11 (EPFO Pension Declaration)</p>
<p className="text-xs text-on-surface-variant">EPFO_Form11_SignedDraft_v1.pdf (890 KB)</p>
</div>
</div>
</td>
<td className="p-space-md text-on-surface-variant">Candidate Portal Submission</td>
<td className="p-space-md text-on-surface-variant">25 Feb 2025</td>
<td className="p-space-md">
<span className="px-2.5 py-0.5 rounded-full font-label-caps text-label-caps font-semibold bg-secondary-fixed text-on-secondary-fixed inline-flex items-center gap-1" id="badge-doc-form11">{docStatus}</span>
</td>
<td className="p-space-md text-right">
<div className="flex items-center justify-end gap-2" id="actions-doc-form11">{docStatus === 'Pending Review' ? <><button className="text-primary font-semibold p-2" onClick={()=>verifyDoc()}>Verify</button><button className="text-error p-2" onClick={()=>openModal('modal-reject-doc')}>Reject</button></> : docStatus === 'Rejected' ? <button className="text-error underline" onClick={()=>openModal('modal-upload-doc')}>Re-upload Required</button> : <span className="text-primary">Verified by Priya Sharma</span>}</div>
</td>
</tr>

<tr className="hover:bg-surface-container-low/60 transition-colors">
<td className="p-space-md">
<div className="flex items-center gap-2.5">
<span className="material-symbols-outlined text-error text-xl">receipt_long</span>
<div>
<p className="font-label-lg text-label-lg font-bold text-on-surface">Last 3 Months Salary Slips (Flipkart)</p>
<p className="text-xs text-on-surface-variant">Statutory Compensation Benchmark Audit</p>
</div>
</div>
</td>
<td className="p-space-md text-on-surface-variant">Pending Candidate Upload</td>
<td className="p-space-md text-outline">—</td>
<td className="p-space-md">
<span className="px-2.5 py-0.5 rounded-full font-label-caps text-label-caps font-semibold bg-error-container text-on-error-container inline-flex items-center gap-1">
<span className="material-symbols-outlined text-xs">error</span>
                    Missing / Upload Needed
                  </span>
</td>
<td className="p-space-md text-right">
<button className="px-2.5 py-1 rounded bg-surface-container text-on-surface font-label-caps text-label-caps font-bold hover:bg-surface-variant shadow-sm transition-all" onClick={event => { openModal('modal-upload-doc') }}>
                    Upload for Candidate
                  </button>
</td>
</tr>
</tbody>
</table>
</div>
</div>
</div>

<div className={"tab-panel space-y-space-lg" + (tab==='bgv' ? '' : ' hidden')} id="tab-bgv">{bgv&&<p className="p-3 bg-primary-fixed rounded">Screening initiation recorded in this session.</p>}
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">

<div className="lg:col-span-8 bg-surface-container-lowest p-space-lg rounded-xl shadow-md space-y-space-md">
<div className="flex items-center justify-between">
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-2xl">verified</span>
</div>
<div>
<h2 className="font-title-md text-title-md font-bold text-on-surface">SpringVerify Automated BGV Engine</h2>
<p className="font-body-sm text-body-sm text-on-surface-variant">API Integration ID: #SV-EMS-2025-99214 • Package: Comprehensive Tech L7</p>
</div>
</div>
<button className="px-space-md py-1.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:opacity-95 shadow-sm" onClick={event => { openModal('modal-bgv') }}>
              + Re-initiate Check
            </button>
</div>

<div className="p-space-md bg-surface-container-low rounded-xl space-y-space-md">
<h3 className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant font-bold">Verification Progression Pipeline</h3>
<div className="grid grid-cols-1 md:grid-cols-4 gap-space-sm relative">

<div className="p-space-sm bg-surface-container-lowest rounded-lg shadow-sm space-y-1">
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps text-outline font-bold">Step 1</span>
<span className="material-symbols-outlined text-primary text-base">check_circle</span>
</div>
<p className="font-label-lg text-label-lg font-bold text-on-surface">Address Check</p>
<p className="font-body-sm text-body-sm text-primary font-medium">Clear / Passed</p>
<p className="text-[11px] text-on-surface-variant">Physical geo-tag matched Koramangala 4th Block</p>
</div>

<div className="p-space-sm bg-surface-container-lowest rounded-lg shadow-sm space-y-1">
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps text-outline font-bold">Step 2</span>
<span className="material-symbols-outlined text-primary text-base">check_circle</span>
</div>
<p className="font-label-lg text-label-lg font-bold text-on-surface">Court &amp; Criminal</p>
<p className="font-body-sm text-body-sm text-primary font-medium">Clear / Passed</p>
<p className="text-[11px] text-on-surface-variant">eCourts, CBI &amp; Interpol databases queried</p>
</div>

<div className="p-space-sm bg-surface-container-lowest rounded-lg shadow-sm space-y-1">
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps text-outline font-bold">Step 3</span>
<span className="material-symbols-outlined text-primary text-base">check_circle</span>
</div>
<p className="font-label-lg text-label-lg font-bold text-on-surface">Past Employment</p>
<p className="font-body-sm text-body-sm text-primary font-medium">Clear / Passed</p>
<p className="text-[11px] text-on-surface-variant">Flipkart (4 yrs) &amp; Swiggy (3 yrs) HR confirmed</p>
</div>

<div className="p-space-sm bg-surface-container-high rounded-lg shadow-sm space-y-1">
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps text-outline font-bold">Step 4</span>
<span className="material-symbols-outlined text-secondary text-base animate-spin">sync</span>
</div>
<p className="font-label-lg text-label-lg font-bold text-on-surface">Education Check</p>
<p className="font-body-sm text-body-sm text-secondary font-medium">In-Progress</p>
<p className="text-[11px] text-on-surface-variant">IIT Madras B.Tech verification in final registry stage</p>
</div>
</div>
</div>

<div className="space-y-space-sm">
<h3 className="font-label-lg text-label-lg font-bold text-on-surface">Itemized Background Investigation Summary</h3>
<div className="space-y-2">
<div className="p-space-sm bg-surface-container-low rounded-lg flex items-center justify-between">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-primary text-base">school</span>
<span className="font-label-md text-label-md font-semibold text-on-surface">IIT Madras • B.Tech Computer Science &amp; Engineering (Class of 2014)</span>
</div>
<span className="font-label-caps text-label-caps px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-bold">Under Academic Dean Review</span>
</div>
<div className="p-space-sm bg-surface-container-low rounded-lg flex items-center justify-between">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-primary text-base">work</span>
<span className="font-label-md text-label-md font-semibold text-on-surface">Flipkart Internet Pvt Ltd • Staff Software Engineer (2020 - 2025)</span>
</div>
<span className="font-label-caps text-label-caps px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-bold">100% Positive Reference</span>
</div>
<div className="p-space-sm bg-surface-container-low rounded-lg flex items-center justify-between">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-primary text-base">work</span>
<span className="font-label-md text-label-md font-semibold text-on-surface">Bundl Technologies (Swiggy) • Lead Systems Engineer (2017 - 2020)</span>
</div>
<span className="font-label-caps text-label-caps px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-bold">100% Positive Reference</span>
</div>
</div>
</div>
</div>

<div className="lg:col-span-4 bg-surface-container-lowest p-space-lg rounded-xl shadow-md space-y-space-md flex flex-col justify-between">
<div>
<div className="flex items-center justify-between mb-space-sm">
<h2 className="font-title-md text-title-md font-bold text-on-surface">Integrity Scorecard</h2>
<span className="material-symbols-outlined text-primary">security</span>
</div>

<div className="bg-surface-container-low p-space-lg rounded-xl text-center space-y-1">
<span className="font-display-lg text-display-lg font-bold text-primary tracking-tight">98%</span>
<p className="font-label-lg text-label-lg font-bold text-on-surface">Green Clear Threshold</p>
<p className="font-body-sm text-body-sm text-on-surface-variant">Zero red flags detected across criminal, regulatory, credit, or identity databases.</p>
</div>
<div className="mt-space-md space-y-2 text-on-surface font-body-sm text-body-sm">
<div className="flex items-center justify-between py-1 border-b border-surface-container-high">
<span className="text-on-surface-variant">Vendor</span>
<span className="font-semibold">SpringVerify India HQ</span>
</div>
<div className="flex items-center justify-between py-1 border-b border-surface-container-high">
<span className="text-on-surface-variant">Turnaround Time</span>
<span className="font-semibold">4 Business Days</span>
</div>
<div className="flex items-center justify-between py-1 border-b border-surface-container-high">
<span className="text-on-surface-variant">Expected Signoff</span>
<span className="font-semibold text-primary">28 Feb 2025 (48 Hrs)</span>
</div>
</div>
</div>
<div className="pt-space-md space-y-2">
<button className="w-full py-2 bg-primary text-on-primary font-label-lg text-label-lg font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow-sm hover:opacity-95 transition-all" onClick={event => { triggerToast("Prototype action: Downloading Certified SpringVerify Interim Audit PDF... No external service is connected.") }}>
<span className="material-symbols-outlined text-base">download</span>
              Download Full BGV Report (PDF)
            </button>
<button className="w-full py-2 bg-surface-container-high hover:bg-surface-container text-on-surface font-label-md text-label-md font-semibold rounded-lg text-center transition-all" onClick={event => { triggerToast("Prototype action: Dispatched verification urgency ping to IIT Madras Registrar. No external service is connected.") }}>
              Expedite Education Check
            </button>
</div>
</div>
</div>
</div>

<div className={"tab-panel space-y-space-lg" + (tab==='goals' ? '' : ' hidden')} id="tab-goals">
<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-md space-y-space-md">
<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm">
<div>
<h2 className="font-title-md text-title-md font-bold text-on-surface">30-60-90 Day High-Velocity Success Plan</h2>
<p className="font-body-sm text-body-sm text-on-surface-variant">Engineered performance roadmap established by Arunachalam Murthy (CTO)</p>
</div>
<button className="px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg font-semibold flex items-center gap-1.5 shadow-sm hover:opacity-95 transition-all" onClick={event => { openModal('modal-goal') }}>
<span className="material-symbols-outlined text-base">add_circle</span>
            + Add Goal
          </button>
</div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-space-md" id="goals-container">{goals.map((goal,index)=><div key={index} className="p-4 bg-surface-container-low rounded-lg"><p className="font-semibold">{goal.title}</p><p>{goal.phase} · {goal.metric}</p></div>)}

<div className="bg-surface-container-low p-space-md rounded-xl space-y-space-sm flex flex-col justify-between">
<div className="space-y-2">
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps uppercase tracking-wider font-bold text-primary bg-primary-fixed px-2 py-0.5 rounded-full">Day 1 to 30</span>
<span className="material-symbols-outlined text-primary text-base">explore</span>
</div>
<h3 className="font-label-lg text-label-lg font-bold text-on-surface">Foundation &amp; First Canary PR</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant">Absorb architecture blueprints, establish local microservice sandbox, and ship first non-critical bugfix pull request.</p>
<div className="space-y-1.5 pt-2">
<div className="flex items-center gap-2 text-on-surface text-body-sm">
<span className="material-symbols-outlined text-primary text-sm">check_circle</span>
<span>Review Kafka topic schema catalog</span>
</div>
<div className="flex items-center gap-2 text-on-surface text-body-sm">
<span className="material-symbols-outlined text-primary text-sm">check_circle</span>
<span>Complete Zero-Trust internal auth runbook</span>
</div>
<div className="flex items-center gap-2 text-on-surface text-body-sm">
<span className="material-symbols-outlined text-outline text-sm">radio_button_unchecked</span>
<span>Ship bugfix to Service Mesh Gateway</span>
</div>
</div>
</div>
<div className="pt-space-sm border-t border-surface-container-high flex items-center justify-between text-xs text-on-surface-variant">
<span>Owner: Ananya + Buddy</span>
<span className="font-semibold text-on-surface">Target: 03 Apr 2025</span>
</div>
</div>

<div className="bg-surface-container-low p-space-md rounded-xl space-y-space-sm flex flex-col justify-between">
<div className="space-y-2">
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps uppercase tracking-wider font-bold text-secondary bg-secondary-fixed px-2 py-0.5 rounded-full">Day 31 to 60</span>
<span className="material-symbols-outlined text-secondary text-base">rocket_launch</span>
</div>
<h3 className="font-label-lg text-label-lg font-bold text-on-surface">Canary Pipeline Ownership</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant">Lead deployment design for the upcoming multi-region gRPC telemetry streaming bridge across AWS Mumbai and Singapore nodes.</p>
<div className="space-y-1.5 pt-2">
<div className="flex items-center gap-2 text-on-surface text-body-sm">
<span className="material-symbols-outlined text-outline text-sm">radio_button_unchecked</span>
<span>Draft RFC for low-latency event broker</span>
</div>
<div className="flex items-center gap-2 text-on-surface text-body-sm">
<span className="material-symbols-outlined text-outline text-sm">radio_button_unchecked</span>
<span>Benchmark gRPC serialization throughput</span>
</div>
<div className="flex items-center gap-2 text-on-surface text-body-sm">
<span className="material-symbols-outlined text-outline text-sm">radio_button_unchecked</span>
<span>Execute test failover drills with SRE team</span>
</div>
</div>
</div>
<div className="pt-space-sm border-t border-surface-container-high flex items-center justify-between text-xs text-on-surface-variant">
<span>Owner: Ananya Deshmukh</span>
<span className="font-semibold text-on-surface">Target: 03 May 2025</span>
</div>
</div>

<div className="bg-surface-container-low p-space-md rounded-xl space-y-space-sm flex flex-col justify-between">
<div className="space-y-2">
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps uppercase tracking-wider font-bold text-on-surface bg-surface-container-highest px-2 py-0.5 rounded-full">Day 61 to 90</span>
<span className="material-symbols-outlined text-on-surface text-base">military_tech</span>
</div>
<h3 className="font-label-lg text-label-lg font-bold text-on-surface">Independent SRE On-Call Lead</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant">Assume primary Level 3 on-call rotation architect slot for Core Distributed Engine, mentoring two junior engineers.</p>
<div className="space-y-1.5 pt-2">
<div className="flex items-center gap-2 text-on-surface text-body-sm">
<span className="material-symbols-outlined text-outline text-sm">radio_button_unchecked</span>
<span>Pass Tier-1 Incident Commander drill</span>
</div>
<div className="flex items-center gap-2 text-on-surface text-body-sm">
<span className="material-symbols-outlined text-outline text-sm">radio_button_unchecked</span>
<span>Deliver internal Tech Talk on Eventual Consistency</span>
</div>
<div className="flex items-center gap-2 text-on-surface text-body-sm">
<span className="material-symbols-outlined text-outline text-sm">radio_button_unchecked</span>
<span>Conduct 90-Day Comprehensive Review with CTO</span>
</div>
</div>
</div>
<div className="pt-space-sm border-t border-surface-container-high flex items-center justify-between text-xs text-on-surface-variant">
<span>Owner: Arunachalam Murthy</span>
<span className="font-semibold text-on-surface">Target: 03 Jun 2025</span>
</div>
</div>
</div>
</div>
</div>

<div className={"tab-panel space-y-space-lg" + (tab==='training' ? '' : ' hidden')} id="tab-training">
<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-md space-y-space-md">
<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm">
<div>
<h2 className="font-title-md text-title-md font-bold text-on-surface">Mandatory Learning Paths &amp; Technical Inductions</h2>
<p className="font-body-sm text-body-sm text-on-surface-variant">EMS Academy LMS Track • 2 of 3 Curriculums in Progress or Completed</p>
</div>
<button className="px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg font-semibold flex items-center gap-1.5 shadow-sm hover:opacity-95 transition-all" onClick={event => { openModal('modal-course') }}>
<span className="material-symbols-outlined text-base">school</span>
            + Assign Course
          </button>
</div>
<div className="space-y-space-md" id="courses-container">{assignedCourses.map(title=><p key={title} className="p-4 bg-surface-container-low rounded-lg">{title} · Assigned</p>)}

<div className="p-space-md bg-surface-container-low rounded-xl space-y-2">
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
<div className="flex items-center gap-3">
<span className="material-symbols-outlined text-primary text-2xl">verified_user</span>
<div>
<h3 className="font-label-lg text-label-lg font-bold text-on-surface">Enterprise InfoSec, Zero-Trust &amp; SOC2 Compliance (2025)</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant">Mandatory ISO 27001, GDPR &amp; Data Handling Protocol certification</p>
</div>
</div>
<span className="px-2.5 py-0.5 rounded-full font-label-caps text-label-caps font-bold bg-primary text-on-primary inline-flex items-center gap-1">
<span className="material-symbols-outlined text-xs">check</span>
                Completed 100%
              </span>
</div>

<div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
<div className="bg-primary h-2 rounded-full w-full"></div>
</div>
<div className="flex items-center justify-between text-xs text-on-surface-variant pt-1">
<span>Score: 100/100 on Final Assessment</span>
<span>Certified on 19 Feb 2025 • ID: #CERT-SOC2-9912</span>
</div>
</div>

<div className="p-space-md bg-surface-container-low rounded-xl space-y-2">
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
<div className="flex items-center gap-3">
<span className="material-symbols-outlined text-secondary text-2xl">hub</span>
<div>
<h3 className="font-label-lg text-label-lg font-bold text-on-surface">Go Microservices &amp; Kafka Event Streaming at Hyper-Scale</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant">EMS internal technical curriculum &amp; architectural patterns</p>
</div>
</div>
<span className="px-2.5 py-0.5 rounded-full font-label-caps text-label-caps font-bold bg-secondary-fixed text-on-secondary-fixed inline-flex items-center gap-1">
                65% Completed
              </span>
</div>

<div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
<div className="bg-secondary h-2 rounded-full" style={{"width":"65%"}}></div>
</div>
<div className="flex items-center justify-between text-xs text-on-surface-variant pt-1">
<span>5 of 8 Modules Finished • Next: Module 6 - Dead Letter Queue Handling</span>
<button className="font-label-md text-label-md font-semibold text-secondary hover:underline" onClick={event => { triggerToast('Launching EMS Academy Course Player...') }}>Continue Learning →</button>
</div>
</div>

<div className="p-space-md bg-surface-container-low rounded-xl space-y-2">
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
<div className="flex items-center gap-3">
<span className="material-symbols-outlined text-outline text-2xl">emergency</span>
<div>
<h3 className="font-label-lg text-label-lg font-bold text-on-surface">Incident Response &amp; PagerDuty War-Room Runbooks</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant">Platform Engineering SRE on-call protocol and Post-Mortem methodology</p>
</div>
</div>
<span className="px-2.5 py-0.5 rounded-full font-label-caps text-label-caps font-bold bg-surface-container-high text-on-surface inline-flex items-center gap-1">
                Not Started
              </span>
</div>

<div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
<div className="bg-outline h-2 rounded-full w-0"></div>
</div>
<div className="flex items-center justify-between text-xs text-on-surface-variant pt-1">
<span>Due by Day 45 (17 Apr 2025)</span>
<button className="font-label-md text-label-md font-semibold text-on-surface hover:underline" onClick={event => { triggerToast('Reminding Ananya about Incident Response course enrollment...') }}>Send Friendly Ping</button>
</div>
</div>
</div>
</div>
</div>

<div className={"tab-panel space-y-space-lg" + (tab==='activity' ? '' : ' hidden')} id="tab-activity">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">

<div className="lg:col-span-7 bg-surface-container-lowest p-space-lg rounded-xl shadow-md space-y-space-md">
<div className="flex items-center justify-between">
<h2 className="font-title-md text-title-md font-bold text-on-surface">Lifecycle Induction Audit Log</h2>
<span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Immutable Event Ledger</span>
</div>
<div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-container-high">
<div className="relative">
<div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-primary ring-4 ring-surface-container-lowest"></div>
<div>
<p className="font-label-lg text-label-lg font-bold text-on-surface">Form 11 Verification Alert Raised</p>
<p className="font-body-sm text-body-sm text-on-surface-variant">EPFO portal synchronization blocked pending candidate signature.</p>
<span className="font-label-caps text-label-caps text-outline">Today, 11:20 AM • System Automation</span>
</div>
</div>
<div className="relative">
<div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-primary ring-4 ring-surface-container-lowest"></div>
<div>
<p className="font-label-lg text-label-lg font-bold text-on-surface">IT Hardware Provisioning Ticket #IT-4912 Closed</p>
<p className="font-body-sm text-body-sm text-on-surface-variant">MacBook Pro M3 Max and 2x YubiKey devices imaged and locked in Desk 4B-12.</p>
<span className="font-label-caps text-label-caps text-outline">Yesterday, 16:45 PM • Vignesh (IT Helpdesk)</span>
</div>
</div>
<div className="relative">
<div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-primary ring-4 ring-surface-container-lowest"></div>
<div>
<p className="font-label-lg text-label-lg font-bold text-on-surface">Swag Kit Delivered via BlueDart</p>
<p className="font-body-sm text-body-sm text-on-surface-variant">Courier tracking #BD8892104 delivered to Bangalore Koramangala residence.</p>
<span className="font-label-caps text-label-caps text-outline">18 Feb 2025, 14:10 PM • Logistics Webhook</span>
</div>
</div>
<div className="relative">
<div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-primary ring-4 ring-surface-container-lowest"></div>
<div>
<p className="font-label-lg text-label-lg font-bold text-on-surface">DigiLocker KYC Credentials Authenticated</p>
<p className="font-body-sm text-body-sm text-on-surface-variant">Aadhaar XML and Permanent Account Number (PAN) validated directly from Gov UIDAI.</p>
<span className="font-label-caps text-label-caps text-outline">14 Feb 2025, 09:30 AM • DigiLocker Gateway</span>
</div>
</div>
<div className="relative">
<div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-primary ring-4 ring-surface-container-lowest"></div>
<div>
<p className="font-label-lg text-label-lg font-bold text-on-surface">Offer Letter Countersigned</p>
<p className="font-body-sm text-body-sm text-on-surface-variant">Candidate accepted offer of INR 68,00,000 CTC + Equity Grants.</p>
<span className="font-label-caps text-label-caps text-outline">12 Feb 2025, 17:42 PM • Priya Sharma (HR Director)</span>
</div>
</div>
</div>
</div>

<div className="lg:col-span-5 bg-surface-container-lowest p-space-lg rounded-xl shadow-md space-y-space-md flex flex-col justify-between">
<div className="space-y-space-md">
<div className="flex items-center justify-between">
<h2 className="font-title-md text-title-md font-bold text-on-surface">Internal Team Dossier Notes</h2>
<button className="px-space-sm py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold flex items-center gap-1" onClick={event => { openModal('modal-note') }}>
<span className="material-symbols-outlined text-sm">edit_note</span>
                + Add Note
              </button>
</div>

<div className="space-y-space-sm" id="notes-list-container">{notes.map((note,index)=><div key={index} className="p-3 bg-surface-container-low rounded-lg"><p className="font-semibold">Priya Sharma <span className="text-xs text-outline">{note.private ? "Confidential HR" : "Visible to Buddy"}</span></p><p className="whitespace-pre-wrap">{note.text}</p></div>)}
<div className="p-space-sm bg-surface-container-low rounded-lg space-y-1">
<div className="flex items-center justify-between">
<div className="flex items-center gap-1.5">
<span className="font-label-md text-label-md font-bold text-on-surface">Rajeshwar Rao (Buddy)</span>
<span className="px-1.5 py-0.2 rounded text-[10px] bg-primary-fixed text-on-primary-fixed font-semibold">Buddy Note</span>
</div>
<span className="text-[11px] text-outline">24 Feb, 15:30</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant">"Had a 20-min pre-join virtual coffee with Ananya yesterday. She is eager to dive into our new Kafka cluster topology and asked for the Confluence architectural ADRs early. Shared read-only links!"</p>
</div>
<div className="p-space-sm bg-surface-container-low rounded-lg space-y-1">
<div className="flex items-center justify-between">
<div className="flex items-center gap-1.5">
<span className="font-label-md text-label-md font-bold text-on-surface">Priya Sharma (HR)</span>
<span className="px-1.5 py-0.2 rounded text-[10px] bg-secondary-fixed text-on-secondary-fixed font-semibold">HR Internal</span>
</div>
<span className="text-[11px] text-outline">21 Feb, 11:15</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant">"Candidate requested an ergonomic vertical mouse alongside the standard trackpad. Hardware request ticket #IT-4912 has been modified and approved accordingly."</p>
</div>
</div>
</div>

<div className="pt-space-md border-t border-surface-container-high space-y-2">
<textarea className="w-full p-2.5 bg-surface-container-low rounded-lg font-body-sm text-body-sm text-on-surface placeholder:text-outline border-none focus:outline-none focus:ring-2 focus:ring-primary resize-none" id="quick-note-input" placeholder="Write an internal onboarding note..." rows="2" aria-label="quick note input" value={fields["quick-note-input"] ?? ''} onChange={event=>setField("quick-note-input",event.target.value)}></textarea>
<div className="flex items-center justify-between">
<label className="flex items-center gap-2 cursor-pointer font-label-md text-label-md text-on-surface-variant">
<input className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant accent-primary" id="note-visibility-toggle" type="checkbox" aria-label="note visibility toggle" checked={Boolean(fields["note-visibility-toggle"])} onChange={event=>setField("note-visibility-toggle",event.target.checked)} />
<span>Internal HR Only (Hidden from Buddy)</span>
</label>
<button className="px-space-md py-1.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:opacity-95 shadow-sm" onClick={event => { postQuickNote() }}>
                Post Note
              </button>
</div>
</div>
</div>
</div>
</div>
</div>

<div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none" id="toast-container">{toast.message&&<div role="status" className="pointer-events-auto flex items-center gap-3 p-4 rounded-xl bg-inverse-surface text-inverse-on-surface shadow-xl"><p>{toast.message}</p><button aria-label="Dismiss notification" onClick={()=>setToast({message:""})}>×</button></div>}</div>


<div className={"fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm" + (modal==='modal-cancel' ? '' : ' hidden')} id="modal-cancel" role="dialog" aria-modal="true" aria-label="modal cancel">
<div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-2xl p-space-lg space-y-space-md">
<div className="flex items-center gap-3 text-error">
<span className="material-symbols-outlined text-3xl">warning</span>
<div>
<h3 className="font-title-md text-title-md font-bold text-on-surface">Cancel Candidate Onboarding</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant">This action will halt induction and release asset reservations.</p>
</div>
</div>
<div className="space-y-space-sm">
<label className="block font-label-md text-label-md font-semibold text-on-surface">Mandatory Cancellation Reason <span className="text-error">*</span></label>
<select className="w-full px-3 py-2 bg-surface-container-low rounded-lg font-body-sm text-body-sm text-on-surface border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-error" id="cancel-reason-select" aria-label="cancel reason select" value={fields["cancel-reason-select"] ?? ''} onChange={event=>setField("cancel-reason-select",event.target.value)}>
<option value="">Select cancellation cause...</option>
<option value="Candidate Opted Out (Counter-offer)">Candidate Opted Out (Accepted counter-offer)</option>
<option value="Offer Rescinded by Management">Offer Rescinded by Management</option>
<option value="Failed Background Verification">Failed Background Verification (BGV Red Flag)</option>
<option value="Medical Emergency / Unforeseen Circumstances">Medical Emergency / Unforeseen Personal Circumstances</option>
<option value="Other Regulatory / Visa Impediment">Other Regulatory / Visa Impediment</option>
</select>
<label className="block font-label-md text-label-md font-semibold text-on-surface pt-1">Internal Justification &amp; Audit Notes</label>
<textarea className="w-full p-2.5 bg-surface-container-low rounded-lg font-body-sm text-body-sm text-on-surface border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-error" id="cancel-notes" placeholder="Provide context for executive review and payroll records..." rows="3" aria-label="cancel notes" value={fields["cancel-notes"] ?? ''} onChange={event=>setField("cancel-notes",event.target.value)}></textarea>
</div>
<div className="flex items-center justify-end gap-2 pt-2">
<button className="px-space-md py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold" onClick={event => { closeModal('modal-cancel') }}>Keep Active</button>
<button className="px-space-md py-2 rounded-lg bg-error text-on-error font-label-md text-label-md font-semibold hover:opacity-90 shadow-sm" onClick={event => { executeCancelOnboarding() }}>Confirm Cancellation</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm" + (modal==='modal-add-task' ? '' : ' hidden')} id="modal-add-task" role="dialog" aria-modal="true" aria-label="modal add task">
<div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl p-space-lg space-y-space-md">
<div className="flex items-center justify-between">
<h3 className="font-title-md text-title-md font-bold text-on-surface">Add Induction Task to Dossier</h3>
<button className="text-on-surface-variant hover:text-on-surface" onClick={event => { closeModal('modal-add-task') }}><span className="material-symbols-outlined">close</span></button>
</div>
<div className="space-y-space-sm font-body-sm text-body-sm">
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">Task Title <span className="text-error">*</span></label>
<input className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary" id="new-task-title" placeholder="e.g. Complete AWS Security Token Setup" type="text" aria-label="new task title" value={fields["new-task-title"] ?? ''} onChange={event=>setField("new-task-title",event.target.value)} />
</div>
<div className="grid grid-cols-2 gap-2">
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">Lifecycle Stage</label>
<select className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary" id="new-task-stage" aria-label="new task stage" value={fields["new-task-stage"] ?? ''} onChange={event=>setField("new-task-stage",event.target.value)}>
<option value="Pre-Boarding">Pre-Boarding</option>
<option value="Day 1 Induction">Day 1 Induction</option>
<option value="First Week">First Week</option>
<option value="First 30 Days">First 30 Days</option>
</select>
</div>
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">Assignee Owner</label>
<select className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary" id="new-task-owner" aria-label="new task owner" value={fields["new-task-owner"] ?? ''} onChange={event=>setField("new-task-owner",event.target.value)}>
<option value="HR Ops">HR Ops</option>
<option value="IT Helpdesk">IT Helpdesk</option>
<option value="Rajeshwar (Buddy)">Rajeshwar (Buddy)</option>
<option value="Candidate">Candidate</option>
</select>
</div>
</div>
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">Due Date</label>
<input className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary" id="new-task-due" type="date"  aria-label="new task due" value={fields["new-task-due"] ?? ''} onChange={event=>setField("new-task-due",event.target.value)} />
</div>
<div className="flex items-center gap-2 pt-2">
<input className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant accent-primary" id="new-task-prereq" type="checkbox" aria-label="new task prereq" checked={Boolean(fields["new-task-prereq"])} onChange={event=>setField("new-task-prereq",event.target.checked)} />
<label className="font-label-md text-label-md text-on-surface cursor-pointer" htmlFor="new-task-prereq">Mark as Blocking Prerequisite for subsequent stages</label>
</div>
</div>
<div className="flex items-center justify-end gap-2 pt-2">
<button className="px-space-md py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold" onClick={event => { closeModal('modal-add-task') }}>Cancel</button>
<button className="px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:opacity-95 shadow-sm" onClick={event => { submitNewTask() }}>Add Task to Dossier</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm" + (modal==='modal-bgv' ? '' : ' hidden')} id="modal-bgv" role="dialog" aria-modal="true" aria-label="modal bgv">
<div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl p-space-lg space-y-space-md">
<div className="flex items-center justify-between">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-primary text-2xl">verified_user</span>
<h3 className="font-title-md text-title-md font-bold text-on-surface">Initiate Background Verification (BGV)</h3>
</div>
<button className="text-on-surface-variant hover:text-on-surface" onClick={event => { closeModal('modal-bgv') }}><span className="material-symbols-outlined">close</span></button>
</div>
<div className="space-y-space-sm font-body-sm text-body-sm">
<p className="text-on-surface-variant">Select automated SpringVerify enterprise screening package for Ananya Deshmukh:</p>
<div className="space-y-2">
<label className="flex items-start gap-3 p-3 bg-surface-container-low rounded-xl cursor-pointer hover:bg-surface-container transition-colors">
<input defaultChecked className="mt-1 text-primary focus:ring-primary accent-primary" name="bgv-package" type="radio" value="Comprehensive Tech L7"/>
<div>
<p className="font-label-lg text-label-lg font-bold text-on-surface">Comprehensive Tech L7 (Recommended)</p>
<p className="text-xs text-on-surface-variant">Includes 7-year past employment audit, Tier-1 university registrar call, eCourts criminal scan, DigiLocker identity &amp; address verification.</p>
</div>
</label>
<label className="flex items-start gap-3 p-3 bg-surface-container-low rounded-xl cursor-pointer hover:bg-surface-container transition-colors">
<input className="mt-1 text-primary focus:ring-primary accent-primary" name="bgv-package" type="radio" value="Standard Staff Package"/>
<div>
<p className="font-label-lg text-label-lg font-bold text-on-surface">Standard Staff Package</p>
<p className="text-xs text-on-surface-variant">Past 1 employment, Aadhaar/PAN validation and standard criminal records query.</p>
</div>
</label>
<label className="flex items-start gap-3 p-3 bg-surface-container-low rounded-xl cursor-pointer hover:bg-surface-container transition-colors">
<input className="mt-1 text-primary focus:ring-primary accent-primary" name="bgv-package" type="radio" value="Executive Leadership Dossier"/>
<div>
<p className="font-label-lg text-label-lg font-bold text-on-surface">Executive Leadership Dossier (C-Suite)</p>
<p className="text-xs text-on-surface-variant">Directorship scan (MCA), credit bureau score, media reputational audit &amp; global sanctions list.</p>
</div>
</label>
</div>
</div>
<div className="flex items-center justify-end gap-2 pt-2">
<button className="px-space-md py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold" onClick={event => { closeModal('modal-bgv') }}>Cancel</button>
<button className="px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:opacity-95 shadow-sm" onClick={event => { confirmBGVInitiation() }}>Dispatch API Order</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm" + (modal==='modal-goal' ? '' : ' hidden')} id="modal-goal" role="dialog" aria-modal="true" aria-label="modal goal">
<div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl p-space-lg space-y-space-md">
<div className="flex items-center justify-between">
<h3 className="font-title-md text-title-md font-bold text-on-surface">Create 30-60-90 Milestone Goal</h3>
<button className="text-on-surface-variant hover:text-on-surface" onClick={event => { closeModal('modal-goal') }}><span className="material-symbols-outlined">close</span></button>
</div>
<div className="space-y-space-sm font-body-sm text-body-sm">
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">Goal Heading <span className="text-error">*</span></label>
<input className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary" id="goal-title-input" placeholder="e.g. Conduct Distributed Mesh Load Testing" type="text" aria-label="goal title input" value={fields["goal-title-input"] ?? ''} onChange={event=>setField("goal-title-input",event.target.value)} />
</div>
<div className="grid grid-cols-2 gap-2">
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">Cadence Phase</label>
<select className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary" id="goal-phase-select" aria-label="goal phase select" value={fields["goal-phase-select"] ?? ''} onChange={event=>setField("goal-phase-select",event.target.value)}>
<option value="30">Day 1 to 30 (Foundation)</option>
<option value="60">Day 31 to 60 (Ownership)</option>
<option value="90">Day 61 to 90 (Leadership)</option>
</select>
</div>
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">Primary Evaluator</label>
<input className="w-full px-3 py-2 bg-surface-container rounded-lg text-on-surface-variant border-none" readOnly type="text" value="Arunachalam Murthy (CTO)"/>
</div>
</div>
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">Success Metric / Definition of Done</label>
<textarea className="w-full p-2.5 bg-surface-container-low rounded-lg text-on-surface border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary" id="goal-metric-input" placeholder="e.g. Achieve 99.99% simulated canary uptime with zero P0 regressions." rows="2" aria-label="goal metric input" value={fields["goal-metric-input"] ?? ''} onChange={event=>setField("goal-metric-input",event.target.value)}></textarea>
</div>
</div>
<div className="flex items-center justify-end gap-2 pt-2">
<button className="px-space-md py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold" onClick={event => { closeModal('modal-goal') }}>Cancel</button>
<button className="px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:opacity-95 shadow-sm" onClick={event => { submitNewGoal() }}>Save Milestone</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm" + (modal==='modal-course' ? '' : ' hidden')} id="modal-course" role="dialog" aria-modal="true" aria-label="modal course">
<div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl p-space-lg space-y-space-md">
<div className="flex items-center justify-between">
<h3 className="font-title-md text-title-md font-bold text-on-surface">Assign EMS Academy Course</h3>
<button className="text-on-surface-variant hover:text-on-surface" onClick={event => { closeModal('modal-course') }}><span className="material-symbols-outlined">close</span></button>
</div>
<div className="space-y-space-sm font-body-sm text-body-sm">
<p className="text-on-surface-variant">Select an approved engineering or corporate compliance curriculum:</p>
<div className="space-y-2">
<label className="flex items-start gap-3 p-3 bg-surface-container-low rounded-xl cursor-pointer hover:bg-surface-container transition-colors">
<input  className="mt-1 text-primary focus:ring-primary accent-primary" name="assigned-course" type="radio" value="Kubernetes Production Operations &amp; Envoy Mesh" checked={courseChoice==="Kubernetes Production Operations & Envoy Mesh"} onChange={()=>setCourseChoice("Kubernetes Production Operations & Envoy Mesh")} />
<div>
<p className="font-label-lg text-label-lg font-bold text-on-surface">Kubernetes Production Operations &amp; Envoy Mesh</p>
<p className="text-xs text-on-surface-variant">Advanced container orchestration, multi-cluster ingress routing, and MTLS security policies. (4 Hours)</p>
</div>
</label>
<label className="flex items-start gap-3 p-3 bg-surface-container-low rounded-xl cursor-pointer hover:bg-surface-container transition-colors">
<input className="mt-1 text-primary focus:ring-primary accent-primary" name="assigned-course" type="radio" value="Indian Labor Laws &amp; Corporate POSH Induction" checked={courseChoice==="Indian Labor Laws & Corporate POSH Induction"} onChange={()=>setCourseChoice("Indian Labor Laws & Corporate POSH Induction")} />
<div>
<p className="font-label-lg text-label-lg font-bold text-on-surface">Indian Labor Laws &amp; Corporate POSH Induction</p>
<p className="text-xs text-on-surface-variant">Statutory Prevention of Sexual Harassment (POSH) mandatory annual certification. (1.5 Hours)</p>
</div>
</label>
<label className="flex items-start gap-3 p-3 bg-surface-container-low rounded-xl cursor-pointer hover:bg-surface-container transition-colors">
<input className="mt-1 text-primary focus:ring-primary accent-primary" name="assigned-course" type="radio" value="FinOps &amp; AWS Cloud Cost Engineering" checked={courseChoice==="FinOps & AWS Cloud Cost Engineering"} onChange={()=>setCourseChoice("FinOps & AWS Cloud Cost Engineering")} />
<div>
<p className="font-label-lg text-label-lg font-bold text-on-surface">FinOps &amp; AWS Cloud Cost Engineering</p>
<p className="text-xs text-on-surface-variant">Tagging standards, spot instance orchestration, and architectural cost optimization. (2 Hours)</p>
</div>
</label>
</div>
</div>
<div className="flex items-center justify-end gap-2 pt-2">
<button className="px-space-md py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold" onClick={event => { closeModal('modal-course') }}>Cancel</button>
<button className="px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:opacity-95 shadow-sm" onClick={event => { confirmCourseAssignment() }}>Assign to LMS Queue</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm" + (modal==='modal-note' ? '' : ' hidden')} id="modal-note" role="dialog" aria-modal="true" aria-label="modal note">
<div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-2xl p-space-lg space-y-space-md">
<div className="flex items-center justify-between">
<h3 className="font-title-md text-title-md font-bold text-on-surface">Add Dossier Note</h3>
<button className="text-on-surface-variant hover:text-on-surface" onClick={event => { closeModal('modal-note') }}><span className="material-symbols-outlined">close</span></button>
</div>
<div className="space-y-space-sm font-body-sm text-body-sm">
<label className="block font-label-md text-label-md font-semibold text-on-surface">Note Content</label>
<textarea className={"w-full p-2.5 bg-surface-container-low rounded-lg text-on-surface border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary" + (modal==='modal-note-body' ? '' : ' hidden')} id="modal-note-body" role="dialog" aria-modal="true" aria-label="modal note body" placeholder="Record feedback, stakeholder notes, or equipment status..." rows="4" aria-label="modal note body" value={fields["modal-note-body"] ?? ''} onChange={event=>setField("modal-note-body",event.target.value)}></textarea>
<div className="flex items-center gap-2 pt-1">
<input className={"w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant accent-primary" + (modal==='modal-note-privacy' ? '' : ' hidden')} id="modal-note-privacy" role="dialog" aria-modal="true" aria-label="modal note privacy" type="checkbox" aria-label="modal note privacy" checked={Boolean(fields["modal-note-privacy"])} onChange={event=>setField("modal-note-privacy",event.target.checked)} />
<label className="font-label-md text-label-md text-on-surface cursor-pointer" htmlFor="modal-note-privacy">Restrict view to HR Directors only</label>
</div>
</div>
<div className="flex items-center justify-end gap-2 pt-2">
<button className="px-space-md py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold" onClick={event => { closeModal('modal-note') }}>Cancel</button>
<button className="px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:opacity-95 shadow-sm" onClick={event => { submitModalNote() }}>Save Note</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm" + (modal==='modal-reject-doc' ? '' : ' hidden')} id="modal-reject-doc" role="dialog" aria-modal="true" aria-label="modal reject doc">
<div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-2xl p-space-lg space-y-space-md">
<div className="flex items-center gap-2 text-error">
<span className="material-symbols-outlined text-2xl">error</span>
<h3 className="font-title-md text-title-md font-bold text-on-surface">Reject Compliance Document</h3>
</div>
<div className="space-y-space-sm font-body-sm text-body-sm">
<p className="text-on-surface-variant">Specify rejection reason for Form 11 (EPFO Declaration). An automated notification will guide candidate to re-upload:</p>
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">Reason Code <span className="text-error">*</span></label>
<select className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-error" id="reject-code-select" aria-label="reject code select" value={fields["reject-code-select"] ?? ''} onChange={event=>setField("reject-code-select",event.target.value)}>
<option value="Blurry / Low-Resolution Scan">Blurry / Low-Resolution Scan</option>
<option value="Digital Signature Mismatch">Digital Signature Mismatch with Aadhaar</option>
<option value="Missing Page 2 or Annexures">Missing Page 2 or Annexures</option>
<option value="Previous PF Account Number (UAN) Incorrect">Previous PF Account Number (UAN) Incorrect</option>
</select>
</div>
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">Candidate Guidance Message</label>
<textarea className="w-full p-2.5 bg-surface-container-low rounded-lg text-on-surface border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-error" id="reject-msg-input" placeholder="Please upload a high-resolution PDF with your clear handwritten or e-Sign signature on Page 2." rows="3" aria-label="reject msg input" value={fields["reject-msg-input"] ?? ''} onChange={event=>setField("reject-msg-input",event.target.value)}></textarea>
</div>
</div>
<div className="flex items-center justify-end gap-2 pt-2">
<button className="px-space-md py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold" onClick={event => { closeModal('modal-reject-doc') }}>Cancel</button>
<button className="px-space-md py-2 rounded-lg bg-error text-on-error font-label-md text-label-md font-semibold hover:opacity-90 shadow-sm" onClick={event => { confirmRejectDoc() }}>Notify Candidate &amp; Reject</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm" + (modal==='modal-upload-doc' ? '' : ' hidden')} id="modal-upload-doc" role="dialog" aria-modal="true" aria-label="modal upload doc">
<div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl p-space-lg space-y-space-md">
<div className="flex items-center justify-between">
<h3 className="font-title-md text-title-md font-bold text-on-surface">Upload Onboarding Document</h3>
<button className="text-on-surface-variant hover:text-on-surface" onClick={event => { closeModal('modal-upload-doc') }}><span className="material-symbols-outlined">close</span></button>
</div>
<div className="space-y-space-sm font-body-sm text-body-sm">
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">Select Document Type</label>
<select className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary" id="upload-doc-type" aria-label="upload doc type" value={fields["upload-doc-type"] ?? ''} onChange={event=>setField("upload-doc-type",event.target.value)}>
<option value="Salary Slips">3 Months Salary Slips (Flipkart)</option>
<option value="Form 11">Form 11 / EPFO Declaration</option>
<option value="Degree Certificate">IIT Madras Degree Certificate</option>
<option value="Passport Copy">International Passport Scan</option>
</select>
</div>
<div className="p-8 border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-surface-container-low/70 transition-all text-center" onClick={event => { fileInput.current?.click() }}>
<input className="hidden" id="file-upload-input" ref={fileInput} type="file" onChange={event=>handleFileChosen(event.currentTarget)} />
<span className="material-symbols-outlined text-4xl text-primary">cloud_upload</span>
<p className="font-label-lg text-label-lg font-bold text-on-surface">Click to Browse or Drag File Here</p>
<p className="text-xs text-on-surface-variant">PDF, PNG, JPG up to 15MB. Encrypted AES-256 storage on upload.</p>
<span className="font-label-caps text-label-caps text-primary font-bold " id="chosen-file-name">{fileName}</span>
</div>
</div>
<div className="flex items-center justify-end gap-2 pt-2">
<button className="px-space-md py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold" onClick={event => { closeModal('modal-upload-doc') }}>Cancel</button>
<button className="px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:opacity-95 shadow-sm" onClick={event => { submitDocUpload() }}>Save to Dossier</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm" + (modal==='modal-buddy-reassign' ? '' : ' hidden')} id="modal-buddy-reassign" role="dialog" aria-modal="true" aria-label="modal buddy reassign">
<div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-2xl p-space-lg space-y-space-md">
<div className="flex items-center justify-between">
<h3 className="font-title-md text-title-md font-bold text-on-surface">Re-assign Onboarding Buddy</h3>
<button className="text-on-surface-variant hover:text-on-surface" onClick={event => { closeModal('modal-buddy-reassign') }}><span className="material-symbols-outlined">close</span></button>
</div>
<div className="space-y-space-sm font-body-sm text-body-sm">
<p className="text-on-surface-variant">Current Buddy: <strong>Rajeshwar Rao (Principal SRE)</strong></p>
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">Select New Buddy</label>
<select className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary" id="new-buddy-select" aria-label="new buddy select" value={fields["new-buddy-select"] ?? ''} onChange={event=>setField("new-buddy-select",event.target.value)}>
<option value="Kavita Iyer (Lead Backend Architect)">Kavita Iyer (Lead Backend Architect - Platform)</option>
<option value="Siddharth Sen (Staff Distributed Systems Engineer)">Siddharth Sen (Staff Distributed Systems Engineer)</option>
<option value="Preethi Natarajan (Principal Cloud Architect)">Preethi Natarajan (Principal Cloud Architect)</option>
</select>
</div>
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">Reason for Reassignment</label>
<input className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary" id="buddy-reason" placeholder="e.g. Buddy on planned paternity leave" type="text" aria-label="buddy reason" value={fields["buddy-reason"] ?? ''} onChange={event=>setField("buddy-reason",event.target.value)} />
</div>
</div>
<div className="flex items-center justify-end gap-2 pt-2">
<button className="px-space-md py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold" onClick={event => { closeModal('modal-buddy-reassign') }}>Cancel</button>
<button className="px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:opacity-95 shadow-sm" onClick={event => { confirmBuddyReassignment() }}>Confirm Reassignment</button>
</div>
</div>
</div>
</div>

</main></div></>);
}
