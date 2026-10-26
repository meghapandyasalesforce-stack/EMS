import { useEffect, useRef, useState } from 'react';
import { Sidebar, Header } from './Layout.jsx';
import { initialInterviews } from './interviewData.js';
import InterviewSchedule from './InterviewSchedule.jsx';
const addDays=(iso,days)=>{const date=new Date(iso+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);};
const candidateNames={karthik:'Karthik Ramanathan',ananya:'Ananya Deshmukh',rohan:'Rohan Sengupta',tanya:'Tanya Mehra'};
export default function InterviewCalendar() {
 const [events,setEvents]=useState(initialInterviews);
 const [view,setView]=useState('week');
 const [anchor,setAnchor]=useState('2025-02-19');
 const [modal,setModal]=useState(null);
 const [activeId,setActiveId]=useState('karthik');
 const [draft,setDraft]=useState({'schedule-candidate':'karthik','schedule-req':'req-89','schedule-round-title':'Round 2: System Design & Concurrency','schedule-date':'2025-02-19','schedule-start-time':'16:30','schedule-end-time':'18:00'});
 const [panel,setPanel]=useState({'Vikramaditya Joshi':true,'Rajeshwar Rao':true,'Arunachalam Murthy':false,'Priya Sharma':false,notify:true});
 const [mode,setMode]=useState('Google Meet (Preview)');
 const [note,setNote]=useState('');
 const [reschedule,setReschedule]=useState({date:'2025-02-20',start:'11:00',end:'12:30'});
 const [cancelReason,setCancelReason]=useState('');
 const [toast,setToast]=useState({title:'',message:''});
 const timer=useRef();
 const active=events.find(event=>event.id===activeId)||events[0];
 const panelists=Object.keys(panel).filter(key=>key!=='notify'&&panel[key]);
 const hasConflict=(date,start,end,people,exclude)=>events.some(event=>event.id!==exclude&&event.status!=='Cancelled'&&event.date===date&&start<event.end&&end>event.start&&event.panelists.some(person=>people.includes(person)));
 const conflict=hasConflict(draft['schedule-date'],draft['schedule-start-time'],draft['schedule-end-time'],panelists);
 const rangeLabel=view==='month'?new Date(anchor+'T12:00:00Z').toLocaleDateString('en-IN',{month:'long',year:'numeric',timeZone:'UTC'}):view==='day'?anchor:'Week of '+addDays(anchor,-((new Date(anchor+'T12:00:00Z').getUTCDay()+6)%7));
 const showToast=(title,message)=>{clearTimeout(timer.current);setToast({title,message});timer.current=setTimeout(()=>setToast({title:'',message:''}),3500);};
 const closeModals=()=>setModal(null);
 const switchView=setView;
 const navigateDate=direction=>{if(view==='month'){const date=new Date(anchor+'T12:00:00Z');date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+direction);setAnchor(date.toISOString().slice(0,10));}else setAnchor(previous=>addDays(previous,direction*(view==='week'?7:1)));};
 const goToToday=()=>{setAnchor(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Calcutta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));setView('day');};
 const openDetailModal=id=>{setActiveId(id);setModal('modal-detail');};
 const openScheduleModal=demo=>{setDraft(previous=>({...previous,'schedule-date':demo?'2025-02-19':anchor,'schedule-start-time':demo?'14:00':'16:30','schedule-end-time':demo?'15:30':'18:00'}));if(demo)setPanel(previous=>({...previous,'Vikramaditya Joshi':true}));setModal('modal-schedule');};
 const applySuggestedTime=time=>{setDraft(previous=>({...previous,'schedule-date':time==='11:00'?addDays(previous['schedule-date'],1):previous['schedule-date'],'schedule-start-time':time,'schedule-end-time':time==='11:00'?'12:30':'18:00'}));};
 const openRescheduleModal=id=>{const item=events.find(event=>event.id===id)||active;setActiveId(item.id);setReschedule({date:item.date,start:item.start,end:item.end});setModal('modal-reschedule');};
 const openCancelModal=id=>{setActiveId(id);setModal('modal-cancel');};
 const valid=(date,start,end)=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&/^\d{2}:\d{2}$/.test(start)&&/^\d{2}:\d{2}$/.test(end)&&start<end&&!Number.isNaN(Date.parse(date+'T'+start));
 const handleScheduleSubmit=event=>{
  event.preventDefault();if(!draft['schedule-round-title'].trim()||!panelists.length||!valid(draft['schedule-date'],draft['schedule-start-time'],draft['schedule-end-time'])){showToast('Check interview details','Choose panelists and a valid date/time range.');return;}
  if(conflict){showToast('Panel conflict','Choose another time or panelist before scheduling.');return;}
  const id='interview-'+Date.now();setEvents(previous=>[...previous,{id,candidate:candidateNames[draft['schedule-candidate']],req:({'req-89':'REQ-2025-089','req-92':'REQ-2025-092','req-104':'REQ-2025-104'})[draft['schedule-req']],date:draft['schedule-date'],start:draft['schedule-start-time'],end:draft['schedule-end-time'],round:draft['schedule-round-title'].trim(),status:'Confirmed',panelists,mode,note,notify:panel.notify}]);
  setAnchor(draft['schedule-date']);setActiveId(id);closeModals();showToast('Interview scheduled locally','No calendar invite or meeting link was created.');
 };
 const handleRescheduleSubmit=event=>{event.preventDefault();if(!valid(reschedule.date,reschedule.start,reschedule.end)||hasConflict(reschedule.date,reschedule.start,reschedule.end,active.panelists,active.id)){showToast('Cannot reschedule','Check the time range and panel availability.');return;}setEvents(previous=>previous.map(item=>item.id===activeId?{...item,...reschedule,status:'Rescheduled'}:item));setAnchor(reschedule.date);closeModals();showToast('Interview rescheduled locally','No external calendar was updated.');};
 const handleCancelConfirm=()=>{setEvents(previous=>previous.map(item=>item.id===activeId?{...item,status:'Cancelled',cancelReason}:item));closeModals();showToast('Interview cancelled locally','No cancellation email was sent.');};
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 useEffect(()=>{
  if(!modal)return;const dialog=document.getElementById(modal),previous=document.activeElement;dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',modal.replaceAll('-',' '));
  const controls=()=>[...dialog.querySelectorAll('button,input,select,textarea,a')].filter(el=>!el.disabled);controls()[0]?.focus();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const keydown=event=>{if(event.key==='Escape')closeModals();if(event.key==='Tab'){const items=controls(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};
  document.addEventListener('keydown',keydown);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keydown);previous?.focus();};
 },[modal]);
 return (<><Sidebar activePage="interview-calendar" /><div className="pl-64"><Header /><main className="relative pt-16 bg-surface min-h-screen"><div className="flex flex-col w-full">

<div className={"fixed top-20 right-8 z-[100] transform transition-all duration-300 flex items-center gap-3 bg-surface-container-lowest text-on-surface px-4 py-3 rounded-xl shadow-xl" + (toast.title ? '' : ' opacity-0 pointer-events-none')} id="toast-notification" role="status">
<div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
<span className="material-symbols-outlined text-base">check_circle</span>
</div>
<div>
<p className="font-title-md text-body-md font-semibold text-on-surface" id="toast-title">{toast.title}</p>
<p className="font-body-sm text-body-sm text-on-surface-variant" id="toast-desc">{toast.message}</p>
</div>
</div>

<div className="w-full bg-surface-container-low px-space-xl py-2.5 flex items-center justify-between shadow-sm overflow-x-auto gap-4">
<div className="flex items-center gap-2 shrink-0">
<span className="material-symbols-outlined text-primary text-base">tune</span>
<span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">Demo Simulator</span>
</div>
<div className="flex items-center gap-1.5 shrink-0 flex-wrap">
<button className="sim-btn px-2.5 py-1 rounded bg-surface shadow-sm font-label-md text-label-md font-semibold text-primary hover:bg-surface-container" onClick={event=>{switchView('week')}}>1. Week View</button>
<button className="sim-btn px-2.5 py-1 rounded bg-surface shadow-sm font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container" onClick={event=>{switchView('month')}}>2. Month View</button>
<button className="sim-btn px-2.5 py-1 rounded bg-surface shadow-sm font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container" onClick={event=>{switchView('day')}}>3. Day View</button>
<button className="sim-btn px-2.5 py-1 rounded bg-surface shadow-sm font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container" onClick={event=>{openDetailModal('karthik')}}>4. Event Detail</button>
<button className="sim-btn px-2.5 py-1 rounded bg-surface shadow-sm font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container" onClick={event=>{openScheduleModal(false)}}>5. Schedule Modal</button>
<button className="sim-btn px-2.5 py-1 rounded bg-error-container text-on-error-container font-label-md text-label-md font-medium hover:bg-error/20" onClick={event=>{openScheduleModal(true)}}>6. Conflict Alert</button>
<button className="sim-btn px-2.5 py-1 rounded bg-surface shadow-sm font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container" onClick={event=>{openRescheduleModal('karthik')}}>7. Reschedule Modal</button>
<button className="sim-btn px-2.5 py-1 rounded bg-surface shadow-sm font-label-md text-label-md text-error hover:bg-error-container" onClick={event=>{openCancelModal('karthik')}}>8. Cancel Dialog</button>
</div>
</div>

<div className="px-space-xl py-space-lg flex flex-col gap-4">
<div className="flex items-center justify-between">
<div>
<nav className="flex items-center gap-1.5 font-label-md text-label-md text-outline mb-1">
<a className="hover:text-primary transition-colors" href="#">Dashboard</a>
<span className="material-symbols-outlined text-xs">chevron_right</span>
<a className="hover:text-primary transition-colors" href="#">Hire &amp; Lifecycle</a>
<span className="material-symbols-outlined text-xs">chevron_right</span>
<a className="hover:text-primary transition-colors" href="#">Recruitment Hub</a>
<span className="material-symbols-outlined text-xs">chevron_right</span>
<span className="font-semibold text-on-surface">Interview Calendar</span>
</nav>
<h1 className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight">Recruitment Interview Calendar &amp; Panel Schedule</h1>
<div className="flex items-center gap-2 mt-1">
<span className="inline-flex items-center gap-1 font-label-caps text-label-caps font-semibold px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
<span className="material-symbols-outlined text-xs">schedule</span> IST (UTC+05:30)
          </span>
<span className="font-body-sm text-body-sm text-outline">• Prestige Tech Park HQ, Bellandur, Bengaluru</span>
<span className="font-body-sm text-body-sm text-primary font-medium">• Live Sync Enabled</span>
</div>
</div>
<div className="flex items-center gap-3">
<button className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg font-semibold hover:bg-[#0B7458] shadow-md transition-all" onClick={event=>{openScheduleModal(false)}}>
<span className="material-symbols-outlined text-lg">add_circle</span>
<span>Schedule Interview</span>
</button>
</div>
</div>

<div className="flex items-center justify-between bg-surface-container-lowest p-2.5 rounded-xl shadow-sm">
<div className="flex items-center gap-2">
<div className="flex items-center bg-surface-container-low rounded-lg p-0.5">
<button className="p-1.5 rounded hover:bg-surface text-on-surface transition-colors" onClick={event=>{navigateDate(-1)}}>
<span className="material-symbols-outlined text-lg">chevron_left</span>
</button>
<button className="px-3 py-1 font-label-md text-label-md font-semibold text-on-surface hover:bg-surface rounded transition-colors" onClick={event=>{goToToday()}}>Today</button>
<button className="p-1.5 rounded hover:bg-surface text-on-surface transition-colors" onClick={event=>{navigateDate(1)}}>
<span className="material-symbols-outlined text-lg">chevron_right</span>
</button>
</div>
<span className="font-title-md text-title-md font-bold text-on-surface px-2" id="date-range-display">{rangeLabel}</span>
<span className="font-label-caps text-label-caps uppercase px-2 py-0.5 bg-primary-fixed text-on-primary-fixed rounded font-semibold">Sprint Q1-W8</span>
</div>

<div className="flex items-center bg-surface-container-low p-1 rounded-lg">
<button className={"px-3 py-1.5 rounded-md font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-all" + (view==='month' ? ' bg-surface text-primary font-bold shadow-sm' : '')} id="btn-view-month" onClick={event=>{switchView('month')}}>Month</button>
<button className={"px-3 py-1.5 rounded-md font-label-md text-label-md transition-all" + (view==='week' ? ' bg-surface text-primary font-bold shadow-sm' : '')} id="btn-view-week" onClick={event=>{switchView('week')}}>Week</button>
<button className={"px-3 py-1.5 rounded-md font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-all" + (view==='day' ? ' bg-surface text-primary font-bold shadow-sm' : '')} id="btn-view-day" onClick={event=>{switchView('day')}}>Day</button>
</div>
</div>
</div>

<div className="px-space-xl pb-space-xl grid grid-cols-12 gap-space-lg">

<div className="col-span-12 xl:col-span-3 flex flex-col gap-space-md">

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm">
<div className="flex items-center justify-between mb-3">
<span className="font-title-md text-title-md font-bold text-on-surface">February 2025</span>
<div className="flex items-center gap-1">
<button className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container-low"><span className="material-symbols-outlined text-base">chevron_left</span></button>
<button className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container-low"><span className="material-symbols-outlined text-base">chevron_right</span></button>
</div>
</div>
<div className="grid grid-cols-7 gap-1 text-center font-label-caps text-label-caps text-outline font-semibold mb-2">
<span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span>
</div>
<div className="grid grid-cols-7 gap-1 text-center font-body-sm text-body-sm">
<span className="text-outline/40 py-1">27</span><span className="text-outline/40 py-1">28</span><span className="text-outline/40 py-1">29</span><span className="text-outline/40 py-1">30</span><span className="text-outline/40 py-1">31</span><span className="py-1 hover:bg-surface-container rounded cursor-pointer">1</span><span className="py-1 hover:bg-surface-container rounded cursor-pointer text-outline">2</span>
<span className="py-1 hover:bg-surface-container rounded cursor-pointer">3</span><span className="py-1 hover:bg-surface-container rounded cursor-pointer">4</span><span className="py-1 hover:bg-surface-container rounded cursor-pointer">5</span><span className="py-1 hover:bg-surface-container rounded cursor-pointer">6</span><span className="py-1 hover:bg-surface-container rounded cursor-pointer">7</span><span className="py-1 hover:bg-surface-container rounded cursor-pointer">8</span><span className="py-1 hover:bg-surface-container rounded cursor-pointer text-outline">9</span>
<span className="py-1 hover:bg-surface-container rounded cursor-pointer">10</span><span className="py-1 hover:bg-surface-container rounded cursor-pointer">11</span><span className="py-1 hover:bg-surface-container rounded cursor-pointer">12</span><span className="py-1 hover:bg-surface-container rounded cursor-pointer">13</span><span className="py-1 hover:bg-surface-container rounded cursor-pointer">14</span><span className="py-1 hover:bg-surface-container rounded cursor-pointer">15</span><span className="py-1 hover:bg-surface-container rounded cursor-pointer text-outline">16</span>

<span className="py-1 hover:bg-primary/20 rounded cursor-pointer relative font-semibold text-on-surface">17<span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full"></span></span>
<span className="py-1 hover:bg-primary/20 rounded cursor-pointer relative font-semibold text-on-surface">18<span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-secondary rounded-full"></span></span>
<span className="py-1 bg-primary text-on-primary rounded font-bold relative shadow-sm">19<span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full"></span></span>
<span className="py-1 hover:bg-primary/20 rounded cursor-pointer relative font-semibold text-on-surface">20<span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full"></span></span>
<span className="py-1 hover:bg-primary/20 rounded cursor-pointer relative font-semibold text-on-surface">21<span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-secondary rounded-full"></span></span>
<span className="py-1 hover:bg-primary/20 rounded cursor-pointer relative font-semibold text-on-surface">22</span>
<span className="py-1 text-outline">23</span>
<span className="py-1 hover:bg-surface-container rounded cursor-pointer">24</span><span className="py-1 hover:bg-surface-container rounded cursor-pointer">25</span><span className="py-1 hover:bg-surface-container rounded cursor-pointer">26</span><span className="py-1 hover:bg-surface-container rounded cursor-pointer">27</span><span className="py-1 hover:bg-surface-container rounded cursor-pointer">28</span><span className="text-outline/40 py-1">1</span><span className="text-outline/40 py-1">2</span>
</div>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm">
<div className="flex items-center justify-between mb-2">
<span className="font-label-caps text-label-caps font-semibold uppercase tracking-wider text-outline">Job Requisitions</span>
<span className="font-label-caps text-label-caps text-primary cursor-pointer hover:underline">Select All</span>
</div>
<div className="space-y-2 mt-2">
<label className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-low cursor-pointer transition-colors">
<div className="flex items-center gap-2.5">
<input defaultChecked className="w-4 h-4 rounded text-primary accent-[#00694f]" type="checkbox"/>
<span className="w-2.5 h-2.5 rounded-full bg-[#008564]"></span>
<div className="flex flex-col">
<span className="font-label-md text-label-md font-semibold text-on-surface leading-snug">Sr. Backend Lead</span>
<span className="font-label-caps text-label-caps text-outline">REQ-2025-089</span>
</div>
</div>
<span className="font-label-caps text-label-caps bg-surface-container px-1.5 py-0.5 rounded text-on-surface-variant font-medium">8 slots</span>
</label>
<label className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-low cursor-pointer transition-colors">
<div className="flex items-center gap-2.5">
<input defaultChecked className="w-4 h-4 rounded text-primary accent-[#00694f]" type="checkbox"/>
<span className="w-2.5 h-2.5 rounded-full bg-[#476175]"></span>
<div className="flex flex-col">
<span className="font-label-md text-label-md font-semibold text-on-surface leading-snug">Staff Product Designer</span>
<span className="font-label-caps text-label-caps text-outline">REQ-2025-092</span>
</div>
</div>
<span className="font-label-caps text-label-caps bg-surface-container px-1.5 py-0.5 rounded text-on-surface-variant font-medium">4 slots</span>
</label>
<label className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-low cursor-pointer transition-colors">
<div className="flex items-center gap-2.5">
<input defaultChecked className="w-4 h-4 rounded text-primary accent-[#00694f]" type="checkbox"/>
<span className="w-2.5 h-2.5 rounded-full bg-[#ba1a1a]"></span>
<div className="flex flex-col">
<span className="font-label-md text-label-md font-semibold text-on-surface leading-snug">Enterprise AE</span>
<span className="font-label-caps text-label-caps text-outline">REQ-2025-104</span>
</div>
</div>
<span className="font-label-caps text-label-caps bg-surface-container px-1.5 py-0.5 rounded text-on-surface-variant font-medium">3 slots</span>
</label>
</div>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm">
<div className="flex items-center justify-between mb-2">
<span className="font-label-caps text-label-caps font-semibold uppercase tracking-wider text-outline">Panel Interviewers</span>
<span className="font-label-caps text-label-caps text-outline">5 Active</span>
</div>
<div className="space-y-2 mt-2">
<label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-surface-container-low cursor-pointer transition-colors">
<div className="flex items-center gap-2.5">
<input defaultChecked className="w-4 h-4 rounded text-primary accent-[#00694f]" type="checkbox"/>
<img className="w-7 h-7 rounded-full object-cover" data-alt="Close up corporate headshot portrait of Arunachalam Murthy, an experienced male Indian technology director in navy blazer against modern office glass background with soft emerald lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBuKsfauOeOBZgKVgsYdg08v35cti43qEjPa_X1rBEHCQQ81bA58D5S0nHHDfv74PaVmqmjZPDjxD_hN4MSsIJGPa_lvo8Y37jqsT5x3OxVMOMZVRD7fDMKH6aVey2C8TRYjkHzZbOEfePLNykj9Tj7MLj4Pxti-E0owAXjOAv7IEzqLLMAE3yda6alHKK66yAWf0qu-ls2XqOBroGQPQQbsjj85RS_WZZ8TDTYSl93YiiBtflKOKdU"/>
<div className="flex flex-col">
<span className="font-label-md text-label-md font-medium text-on-surface">Arunachalam Murthy</span>
<span className="font-label-caps text-label-caps text-outline">VP of Engineering</span>
</div>
</div>
<span className="w-2 h-2 rounded-full bg-primary" title="Available"></span>
</label>
<label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-surface-container-low cursor-pointer transition-colors">
<div className="flex items-center gap-2.5">
<input defaultChecked className="w-4 h-4 rounded text-primary accent-[#00694f]" type="checkbox"/>
<img className="w-7 h-7 rounded-full object-cover" data-alt="Professional studio headshot portrait of Vikramaditya Joshi, a senior Indian software architect wearing spectacles and charcoal formal shirt with warm corporate lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDUppVSXHuipjcVXLttA14H8NldbkBslNHRzxHFgiONq6cNcuZZuvMtNg2r7Ts2Es-q9mjtWpc22tA2-KGCAEPX5MYp3pMSgXsAT0ets8CVhpWFfJ9LLu75ZqPey-uMlIxKv2_dmPDmU-W_eZcpCjJNNmSDO1CRZk_EkEngtGTWm5nVgdq-izosviHsGcZxjh4Vkn9zXngLGUK-6krJPQ5WsrGtsSXoYKVFX57Y3i7y2lLOMUxXOomJ"/>
<div className="flex flex-col">
<span className="font-label-md text-label-md font-medium text-on-surface">Vikramaditya Joshi</span>
<span className="font-label-caps text-label-caps text-outline">Principal Architect</span>
</div>
</div>
<span className="w-2 h-2 rounded-full bg-error" title="Busy / 1 Conflict"></span>
</label>
<label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-surface-container-low cursor-pointer transition-colors">
<div className="flex items-center gap-2.5">
<input defaultChecked className="w-4 h-4 rounded text-primary accent-[#00694f]" type="checkbox"/>
<img className="w-7 h-7 rounded-full object-cover" data-alt="Corporate headshot portrait of Rajeshwar Rao, middle aged Indian tech executive with subtle smile in well lit Bangalore executive suite" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBpb3UXKw7t7zqTbuWwXXogj-dQV6H0r_vpvlgGY11QJzV4_DeUTPC-GLSY22nf_FXQ36XSyCg5VyYb22sqA9BBYnKtFx1VbzkBvL3Dg0Wd4Y0_-vyG46EeSw8fwxvF3bg_8rQnQEi_I0rVSeif-7biflzg_oMkDCkJnI1Wn1c6xxrAzslAgRN4RHd7wkA-MCQOQG7JVqeo4CnGe-dihxWKn5k37CLDLfcbZY8nh1whkaNjUHRk0kh5"/>
<div className="flex flex-col">
<span className="font-label-md text-label-md font-medium text-on-surface">Rajeshwar Rao</span>
<span className="font-label-caps text-label-caps text-outline">Staff Engineer</span>
</div>
</div>
<span className="w-2 h-2 rounded-full bg-primary" title="Available"></span>
</label>
<label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-surface-container-low cursor-pointer transition-colors">
<div className="flex items-center gap-2.5">
<input defaultChecked className="w-4 h-4 rounded text-primary accent-[#00694f]" type="checkbox"/>
<img className="w-7 h-7 rounded-full object-cover" data-alt="Warm professional headshot portrait of Kavita Sundaram, Indian woman design director in crisp white collared shirt with subtle emerald accents and modern workstation" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDvLILVEHL3r0V3VJQ2kr-2Clm9gNrQ6SZVtBFN-UAd7RPZE5ZB1CmrWY0Ut8srIw6LQo98ZD2UnayNUQA_Yw8BPZdCFINaKqyZFkAINk3abLXDb0WLB-PGa5V7diP4kECLUoM0o-VWzbNbww5c2zgHI6EyMM7dkmH8FN4lZnlNsGH0XTw_vObFzJMMce2joX6R2oImLkXbnZzDFbvu2J2YwnAD9_kVPWMArX10kA0AUMIKGgPKRvkw"/>
<div className="flex flex-col">
<span className="font-label-md text-label-md font-medium text-on-surface">Kavita Sundaram</span>
<span className="font-label-caps text-label-caps text-outline">Head of UX</span>
</div>
</div>
<span className="w-2 h-2 rounded-full bg-primary" title="Available"></span>
</label>
<label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-surface-container-low cursor-pointer transition-colors">
<div className="flex items-center gap-2.5">
<input defaultChecked className="w-4 h-4 rounded text-primary accent-[#00694f]" type="checkbox"/>
<img className="w-7 h-7 rounded-full object-cover" data-alt="Professional headshot of Priya Sharma, modern Indian HR Director in elegant formal teal attire in tech headquarters" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDBmIEEJE1a66mPJM_1VfOLuSeohaIE-gz5IBPd1y25bVYqFs7UhBB40rub2wJfohPa5-c2318y86vinHZUg0cVMHPGItTxZJUduEPEk-i4saJ0C6b2uoiGRJptGWh9i-F2aHYadwQSnCZLQL93h4QFNqBQawJlDtbbvZJ4H6Qyb4UShtJ6iMmXx9FtXNBh4O0FCvbt8MoQnWgs_jVcaPlyWSfaDpj-yE2fwRq7PAWCHo_cQ6kmoJci"/>
<div className="flex flex-col">
<span className="font-label-md text-label-md font-medium text-on-surface">Priya Sharma</span>
<span className="font-label-caps text-label-caps text-outline">HR Director</span>
</div>
</div>
<span className="w-2 h-2 rounded-full bg-primary" title="Available"></span>
</label>
</div>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm space-y-3">
<span className="font-label-caps text-label-caps font-semibold uppercase tracking-wider text-outline">Operations &amp; Telemetry</span>
<div className="flex items-center justify-between bg-surface-container-low p-2.5 rounded-lg">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-primary text-lg">videocam</span>
<span className="font-body-sm text-body-sm text-on-surface">Meet Rooms Active</span>
</div>
<span className="font-title-md text-title-md font-bold text-on-surface">8/10</span>
</div>
<div className="flex items-center justify-between bg-surface-container-low p-2.5 rounded-lg">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-primary text-lg">fact_check</span>
<span className="font-body-sm text-body-sm text-on-surface">Attendance Rate</span>
</div>
<span className="font-title-md text-title-md font-bold text-primary">96.2%</span>
</div>

<div className="pt-1">
<div className="flex items-center justify-between text-label-caps font-label-caps text-outline mb-1">
<span>Interview Completion Trend (7d)</span>
<span className="text-primary font-semibold">+4.2%</span>
</div>
<svg className="w-full h-8 text-primary overflow-visible" fill="none" viewBox="0 0 200 30">
<path d="M0,24 Q30,12 60,18 T120,8 T160,14 T200,4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5"></path>
<circle className="fill-primary" cx="200" cy="4" r="3.5"></circle>
</svg>
</div>
</div>
</div>

<div className="col-span-12 xl:col-span-9 flex flex-col gap-space-md">

<div className={"bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex-col" + (view==='week' ? '' : ' hidden')} id="view-week-container"><InterviewSchedule events={events} anchor={anchor} view="week" onOpen={openDetailModal} /></div>

<div className={"bg-surface-container-lowest rounded-xl shadow-sm p-4 flex-col" + (view==='month' ? '' : ' hidden')} id="view-month-container"><InterviewSchedule events={events} anchor={anchor} view="month" onOpen={openDetailModal} /></div>

<div className={"bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex-col" + (view==='day' ? '' : ' hidden')} id="view-day-container"><InterviewSchedule events={events} anchor={anchor} view="day" onOpen={openDetailModal} /></div>
</div>
</div>

<div className={"fixed inset-0 z-50 bg-[#0E2B3D]/40 backdrop-blur-sm items-center justify-center p-4" + (modal==='modal-detail' ? 'flex' : ' hidden')} id="modal-detail"><div className="bg-surface-container-lowest rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"><div className="p-6 bg-surface-container-low flex justify-between items-start"><div><h3 id="detail-candidate-name" className="text-headline-sm font-bold">{active.candidate}</h3><p className="text-body-sm text-outline">{active.req} · {active.status}</p></div><button onClick={closeModals} aria-label="Close interview details"><span className="material-symbols-outlined">close</span></button></div><div className="p-6 space-y-4"><h4 className="text-title-md font-semibold">{active.round}</h4><p>{active.date} · {active.start}–{active.end} IST</p><p className="text-body-sm">Panel: {active.panelists.length?active.panelists.join(', '):'Not specified in sample'}</p><p className="text-body-sm">{active.mode}</p><p className="whitespace-pre-wrap text-body-sm">{active.note}</p><p className="text-body-sm text-outline">Local interview preview. No live meeting link is generated.</p></div><div className="p-6 bg-surface-container-low flex justify-between"><a href="#/recruitment-detail" className="text-primary text-label-md">Recruitment page</a><div className="flex gap-2"><button className="px-3 py-2 rounded bg-surface-container" onClick={()=>openRescheduleModal(active.id)}>Reschedule</button><button className="px-3 py-2 rounded bg-error-container text-error" onClick={()=>openCancelModal(active.id)}>Cancel</button></div></div></div></div>

<div className={"fixed inset-0 z-50 bg-[#0E2B3D]/40 backdrop-blur-sm items-center justify-center p-4" + (modal==='modal-schedule' ? 'flex' : ' hidden')} id="modal-schedule">
<div className="bg-surface-container-lowest rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col transform transition-all animate-in fade-in zoom-in-95 duration-200">

<div className="bg-surface-container-low p-space-lg flex items-center justify-between border-b border-surface-container">
<div>
<h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Schedule Interview Round</h3>
<p className="font-body-sm text-body-sm text-outline">Configure panel assessment and save a local calendar record</p>
</div>
<button className="text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface transition-colors" onClick={event=>{closeModals()}}>
<span className="material-symbols-outlined text-xl">close</span>
</button>
</div>

<div className={"bg-amber-50 p-4 border-b border-amber-200 items-start gap-3" + (conflict ? '' : ' hidden')} id="conflict-warning-banner">
<span className="material-symbols-outlined text-amber-600 text-xl mt-0.5">warning</span>
<div className="flex-1">
<p className="font-label-md text-label-md font-bold text-amber-900">Schedule Conflict Detected</p>
<p className="font-body-sm text-body-sm text-amber-800 mt-0.5">
<strong>Vikramaditya Joshi</strong> is already booked for REQ-2025-089 Round 1 at 14:00 - 15:00 IST.
          </p>
<div className="mt-2 flex items-center gap-2">
<span className="font-label-caps text-label-caps text-amber-900 font-semibold uppercase">Suggested Alternatives:</span>
<button className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-label-caps text-label-caps font-bold hover:bg-amber-300" onClick={event=>{applySuggestedTime('16:30')}}>16:30 IST Today</button>
<button className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-label-caps text-label-caps font-bold hover:bg-amber-300" onClick={event=>{applySuggestedTime('11:00')}}>Tomorrow 11:00 IST</button>
</div>
</div>
</div>

<form className="p-space-lg space-y-4 max-h-[716px] overflow-y-auto" id="schedule-form" onSubmit={event=>{handleScheduleSubmit(event)}}>
<div className="grid grid-cols-2 gap-4">

<div className="col-span-2 sm:col-span-1">
<label className="block font-label-caps text-label-caps uppercase text-outline font-semibold mb-1">Select Candidate *</label>
<select className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" id="schedule-candidate" required aria-label="schedule-candidate" value={draft["schedule-candidate"]} onChange={event=>setDraft(previous=>({...previous,["schedule-candidate"]:event.target.value}))}>
<option value="karthik">Karthik Ramanathan</option>
<option value="ananya">Ananya Deshmukh</option>
<option value="rohan">Rohan Sengupta</option>
<option value="tanya">Tanya Mehra</option>
</select>
</div>

<div className="col-span-2 sm:col-span-1">
<label className="block font-label-caps text-label-caps uppercase text-outline font-semibold mb-1">Job Requisition *</label>
<select className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" id="schedule-req" required aria-label="schedule-req" value={draft["schedule-req"]} onChange={event=>setDraft(previous=>({...previous,["schedule-req"]:event.target.value}))}>
<option value="req-89">REQ-2025-089 (Sr Backend Lead)</option>
<option value="req-92">REQ-2025-092 (Staff Product Designer)</option>
<option value="req-104">REQ-2025-104 (Enterprise AE)</option>
</select>
</div>
</div>

<div>
<label className="block font-label-caps text-label-caps uppercase text-outline font-semibold mb-1">Round Title &amp; Focus *</label>
<input className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" id="schedule-round-title" placeholder="e.g. Round 2: System Architecture &amp; Coding" required type="text"  aria-label="schedule-round-title" value={draft["schedule-round-title"]} onChange={event=>setDraft(previous=>({...previous,["schedule-round-title"]:event.target.value}))} />
</div>

<div className="grid grid-cols-3 gap-3">
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline font-semibold mb-1">Date (DD MMM) *</label>
<input className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" id="schedule-date" required type="date"  aria-label="schedule-date" value={draft["schedule-date"]} onChange={event=>setDraft(previous=>({...previous,["schedule-date"]:event.target.value}))} />
</div>
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline font-semibold mb-1">Start Time (IST) *</label>
<input className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" id="schedule-start-time"  required type="time"  aria-label="schedule-start-time" value={draft["schedule-start-time"]} onChange={event=>setDraft(previous=>({...previous,["schedule-start-time"]:event.target.value}))} />
</div>
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline font-semibold mb-1">End Time (IST) *</label>
<input className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" id="schedule-end-time" required type="time"  aria-label="schedule-end-time" value={draft["schedule-end-time"]} onChange={event=>setDraft(previous=>({...previous,["schedule-end-time"]:event.target.value}))} />
</div>
</div>

<div>
<label className="block font-label-caps text-label-caps uppercase text-outline font-semibold mb-1">Assigned Panelists *</label>
<div className="grid grid-cols-2 gap-2 p-2.5 bg-surface-container-low rounded-xl">
<label className="flex items-center gap-2 p-1 text-label-md font-label-md text-on-surface">
<input  className="w-4 h-4 rounded text-primary accent-[#00694f]" id="panelist-vikram"  type="checkbox" checked={Boolean(panel["Vikramaditya Joshi"])} onChange={event=>setPanel(previous=>({...previous,["Vikramaditya Joshi"]:event.target.checked}))} /> Vikramaditya Joshi
            </label>
<label className="flex items-center gap-2 p-1 text-label-md font-label-md text-on-surface">
<input  className="w-4 h-4 rounded text-primary accent-[#00694f]" type="checkbox" checked={Boolean(panel["Rajeshwar Rao"])} onChange={event=>setPanel(previous=>({...previous,["Rajeshwar Rao"]:event.target.checked}))} /> Rajeshwar Rao
            </label>
<label className="flex items-center gap-2 p-1 text-label-md font-label-md text-on-surface">
<input className="w-4 h-4 rounded text-primary accent-[#00694f]" type="checkbox" checked={Boolean(panel["Arunachalam Murthy"])} onChange={event=>setPanel(previous=>({...previous,["Arunachalam Murthy"]:event.target.checked}))} /> Arunachalam Murthy
            </label>
<label className="flex items-center gap-2 p-1 text-label-md font-label-md text-on-surface">
<input className="w-4 h-4 rounded text-primary accent-[#00694f]" type="checkbox" checked={Boolean(panel["Priya Sharma"])} onChange={event=>setPanel(previous=>({...previous,["Priya Sharma"]:event.target.checked}))} /> Priya Sharma
            </label>
</div>
</div>

<div className="grid grid-cols-2 gap-4">
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline font-semibold mb-1">Interview Mode</label>
<select className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" aria-label="Interview mode" value={mode} onChange={event=>setMode(event.target.value)}>
<option>Google Meet (Preview)</option>
<option>Bengaluru HQ Room 4B</option>
<option>Bengaluru HQ Room 2A</option>
<option>Telephonic Screen</option>
</select>
</div>
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline font-semibold mb-1">Candidate Notifications</label>
<div className="flex items-center gap-2 h-10">
<input  className="w-4 h-4 rounded text-primary accent-[#00694f]" type="checkbox" checked={Boolean(panel["notify"])} onChange={event=>setPanel(previous=>({...previous,["notify"]:event.target.checked}))} />
<span className="font-body-sm text-body-sm text-on-surface">Save calendar notification preference</span>
</div>
</div>
</div>

<div>
<label className="block font-label-caps text-label-caps uppercase text-outline font-semibold mb-1">Preparation Note to Candidate</label>
<textarea className="w-full p-2.5 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Instructions regarding IDE setups, portfolio walkthrough, or system design prep..." rows="2" aria-label="Preparation notes" value={note} onChange={event=>setNote(event.target.value)} />
</div>

<div className="pt-4 border-t border-surface-container flex items-center justify-end gap-3">
<button className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md font-semibold hover:bg-surface-container-high transition-colors" onClick={event=>{closeModals()}} type="button">
            Cancel
          </button>
<button className="px-5 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-[#0B7458] shadow-md transition-all flex items-center gap-2" type="submit">
<span className="material-symbols-outlined text-base">send</span> Schedule Locally
          </button>
</div>
</form>
</div>
</div>

<div className={"fixed inset-0 z-50 bg-[#0E2B3D]/40 backdrop-blur-sm items-center justify-center p-4" + (modal==='modal-reschedule' ? 'flex' : ' hidden')} id="modal-reschedule">
<div className="bg-surface-container-lowest rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col transform transition-all animate-in fade-in zoom-in-95 duration-200">
<div className="bg-surface-container-low p-space-lg flex items-center justify-between border-b border-surface-container">
<div>
<h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Reschedule Interview</h3>
<p className="font-body-sm text-body-sm text-outline">Karthik Ramanathan • Round 2</p>
</div>
<button className="text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface transition-colors" onClick={event=>{closeModals()}}>
<span className="material-symbols-outlined text-xl">close</span>
</button>
</div>
<form className="p-space-lg space-y-4" onSubmit={event=>{handleRescheduleSubmit(event)}}>
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline font-semibold mb-1">Select New Date *</label>
<input className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" required type="date"  aria-label="Reschedule date" value={reschedule.date} onChange={event=>setReschedule(previous=>({...previous,date:event.target.value}))} />
</div>
<div className="grid grid-cols-2 gap-3">
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline font-semibold mb-1">Start Time (IST) *</label>
<input className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" required type="time"  aria-label="Reschedule start" value={reschedule.start} onChange={event=>setReschedule(previous=>({...previous,start:event.target.value}))} />
</div>
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline font-semibold mb-1">End Time (IST) *</label>
<input className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" required type="time"  aria-label="Reschedule end" value={reschedule.end} onChange={event=>setReschedule(previous=>({...previous,end:event.target.value}))} />
</div>
</div>
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline font-semibold mb-1">Reason for Rescheduling *</label>
<select className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" required>
<option>Candidate Requested Alternate Time</option>
<option>Panelist Operational Conflict</option>
<option>Technical / Infrastructure Issue</option>
<option>Internal Stage Priority Shift</option>
</select>
</div>
<div className="p-3 bg-surface-container-low rounded-xl">
<label className="flex items-center gap-2 cursor-pointer font-body-sm text-body-sm text-on-surface">
<input defaultChecked className="w-4 h-4 rounded text-primary accent-[#00694f]" type="checkbox"/>
<span>Save notification preference</span>
</label>
</div>
<div className="pt-3 border-t border-surface-container flex items-center justify-end gap-2">
<button className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md font-semibold hover:bg-surface-container-high transition-colors" onClick={event=>{closeModals()}} type="button">
            Back
          </button>
<button className="px-5 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-[#0B7458] shadow-md transition-all" type="submit">
            Confirm Reschedule
          </button>
</div>
</form>
</div>
</div>

<div className={"fixed inset-0 z-50 bg-[#0E2B3D]/40 backdrop-blur-sm items-center justify-center p-4" + (modal==='modal-cancel' ? 'flex' : ' hidden')} id="modal-cancel">
<div className="bg-surface-container-lowest rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col transform transition-all animate-in fade-in zoom-in-95 duration-200">
<div className="p-space-lg flex items-start gap-4">
<div className="w-12 h-12 rounded-full bg-error-container text-on-error-container shrink-0 flex items-center justify-center">
<span className="material-symbols-outlined text-2xl">event_busy</span>
</div>
<div>
<h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Cancel Interview Slot</h3>
<p className="font-body-sm text-body-sm text-outline mt-1">
            Cancel {active.round} for <strong className="text-on-surface">{active.candidate}</strong> on {active.date} at {active.start} IST?
          </p>
</div>
</div>
<div className="px-space-lg pb-space-lg space-y-3">
<div>
<label className="block font-label-caps text-label-caps uppercase text-outline font-semibold mb-1">Cancellation Reason</label>
<textarea className="w-full p-2.5 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-error" placeholder="Candidate withdrew / Position closed / Panelist emergency..." rows="2" aria-label="Cancellation reason" value={cancelReason} onChange={event=>setCancelReason(event.target.value)} />
</div>
<label className="flex items-center gap-2 cursor-pointer font-body-sm text-body-sm text-on-surface">
<input defaultChecked className="w-4 h-4 rounded text-error accent-[#ba1a1a]" type="checkbox"/>
<span>Save cancellation notification preference (local preview)</span>
</label>
</div>
<div className="p-space-lg bg-surface-container-low border-t border-surface-container flex items-center justify-end gap-2">
<button className="px-4 py-2 rounded-lg bg-surface text-on-surface font-label-md text-label-md font-semibold hover:bg-surface-container transition-colors" onClick={event=>{closeModals()}} type="button">
          Keep Interview
        </button>
<button className="px-5 py-2 rounded-lg bg-error text-on-error font-label-md text-label-md font-semibold hover:bg-[#93000a] shadow-md transition-all" onClick={event=>{handleCancelConfirm()}} type="button">
          Confirm Cancellation
        </button>
</div>
</div>
</div>
</div>

</main></div></>);
}
