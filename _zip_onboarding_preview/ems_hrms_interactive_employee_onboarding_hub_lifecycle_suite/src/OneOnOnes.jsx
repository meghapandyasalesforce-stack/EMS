import { useEffect, useRef, useState } from 'react';
import { Sidebar, Header } from './Layout.jsx';
import { initialMeetings } from './meetingData.js';
import { MeetingCalendar, MeetingList } from './MeetingViews.jsx';
const blankMeeting=()=>({participant:'Rohan Sen',date:'2025-10-10',time:'11:00',cadence:'Bi-weekly (Every 2 weeks)',agenda:'Career progression and quarterly review.'});
export default function OneOnOnes() {
 const [view,setView]=useState('calendar');
 const [sim,setSim]=useState('calendar');
 const [modal,setModal]=useState(null);
 const [meetings,setMeetings]=useState(initialMeetings);
 const [activeId,setActiveId]=useState(1);
 const [selectedDate,setSelectedDate]=useState('2025-10-09');
 const [draft,setDraft]=useState(blankMeeting);
 const [reschedule,setReschedule]=useState({newDate:'2025-10-11',newTime:'11:30'});
 const [cancelReason,setCancelReason]=useState('');
 const [actionText,setActionText]=useState('');
 const [toast,setToast]=useState('');
 const timer=useRef();
 const active=meetings.find(meeting=>meeting.id===activeId)||meetings[0];
 const showToast=message=>{clearTimeout(timer.current);setToast(message);timer.current=setTimeout(()=>setToast(''),3500);};
 const closeModal=()=>setModal(null);
 const openModal=id=>{if(id==='reschedule-modal')setReschedule({newDate:active.date,newTime:active.time});setModal(id);};
 const openMeeting=id=>{setActiveId(id);setView('detail');setSim('detail');setActionText('');};
 const startReschedule=id=>{const meeting=meetings.find(item=>item.id===id);setActiveId(id);setReschedule({newDate:meeting.date,newTime:meeting.time});setModal('reschedule-modal');};
 const updateActive=patch=>setMeetings(previous=>previous.map(meeting=>meeting.id===activeId?{...meeting,...patch}:meeting));
 const switchState=state=>{setSim(state);setModal(null);if(['calendar','list','detail','empty'].includes(state))setView(state);else if(state==='schedule'){setView('calendar');openModal('schedule-modal');}else{setView('detail');openModal(state+'-modal');}};
 const valid=(date,time)=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&/^\d{2}:\d{2}$/.test(time)&&!Number.isNaN(Date.parse(date+'T'+time));
 const scheduleMeetingSuccess=()=>{
  if(!draft.participant.trim()||!valid(draft.date,draft.time)){showToast('Enter a participant, date, and time.');return;}
  if(meetings.some(item=>item.status!=='Cancelled'&&item.date===draft.date&&item.time===draft.time&&item.participant.toLowerCase()===draft.participant.trim().toLowerCase())){showToast('This participant already has a meeting in that time slot.');return;}
  const id=Math.max(...meetings.map(item=>item.id))+1;
  setMeetings(previous=>[...previous,{...draft,id,title:'One-on-One with '+draft.participant.trim(),participant:draft.participant.trim(),role:'Participant',duration:45,location:'Google Meet',status:'Confirmed',notes:'',actions:[]}]);
  setSelectedDate(draft.date);setActiveId(id);setModal(null);setView('calendar');setSim('calendar');showToast('Meeting scheduled locally. No invite was sent.');
 };
 const rescheduleSuccess=()=>{
  if(!valid(reschedule.newDate,reschedule.newTime)){showToast('Enter a valid date and time.');return;}
  updateActive({date:reschedule.newDate,time:reschedule.newTime,status:'Confirmed'});setSelectedDate(reschedule.newDate);closeModal();setView('detail');showToast('Meeting rescheduled locally.');
 };
 const cancelSuccess=()=>{updateActive({status:'Cancelled',cancelReason});closeModal();setView('calendar');showToast('Meeting cancelled locally. No notification was sent.');};
 const markAsDone=()=>{updateActive({status:'Completed'});setView('calendar');showToast('Meeting marked as completed.');};
 const addActionItem=()=>{if(!actionText.trim()){showToast('Enter an action item first.');return;}updateActive({actions:[...active.actions,{id:Date.now(),text:actionText.trim(),owner:active.participant,done:false}]});setActionText('');};
 const toggleAction=id=>updateActive({actions:active.actions.map(item=>item.id===id?{...item,done:!item.done}:item)});
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 useEffect(()=>{
  if(!modal)return;
  const dialog=document.getElementById(modal),previous=document.activeElement;
  const controls=()=>[...dialog.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled);controls()[0]?.focus();
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const keydown=event=>{if(event.key==='Escape')closeModal();if(event.key==='Tab'){const items=controls(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};
  document.addEventListener('keydown',keydown);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keydown);previous?.focus();};
 },[modal]);
 return (<><Sidebar activePage="one-on-one-meetings" /><div className="pl-64"><Header /><main className="relative pt-16 bg-surface min-h-screen"><div className="flex flex-col w-full min-h-screen bg-surface text-on-surface">

<div className="sticky top-16 z-30 bg-[#0E2B3D] text-white px-space-xl py-3 flex flex-wrap items-center justify-between gap-4 shadow-md">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-[#1CCA9B]">tune</span>
<span className="font-label-caps text-label-caps uppercase tracking-wider text-white/70">One-on-Ones Simulator:</span>
</div>
<div className="flex flex-wrap items-center gap-1.5" id="sim-rig-bar">
<button className={"sim-btn px-3 py-1 rounded-lg text-label-md font-label-md transition-all" + (sim==='calendar' ? ' bg-[#1CCA9B] text-[#0E2B3D] font-semibold' : ' bg-white/10 text-white')} data-state="calendar" onClick={event=>{switchState('calendar')}}>1. Calendar View</button>
<button className={"sim-btn px-3 py-1 rounded-lg text-label-md font-label-md transition-all hover:bg-white/20" + (sim==='list' ? ' bg-[#1CCA9B] text-[#0E2B3D] font-semibold' : ' bg-white/10 text-white')} data-state="list" onClick={event=>{switchState('list')}}>2. List View</button>
<button className={"sim-btn px-3 py-1 rounded-lg text-label-md font-label-md transition-all hover:bg-white/20" + (sim==='schedule' ? ' bg-[#1CCA9B] text-[#0E2B3D] font-semibold' : ' bg-white/10 text-white')} data-state="schedule" onClick={event=>{switchState('schedule')}}>3. Schedule Modal</button>
<button className={"sim-btn px-3 py-1 rounded-lg text-label-md font-label-md transition-all hover:bg-white/20" + (sim==='detail' ? ' bg-[#1CCA9B] text-[#0E2B3D] font-semibold' : ' bg-white/10 text-white')} data-state="detail" onClick={event=>{switchState('detail')}}>4. Detail Screen</button>
<button className={"sim-btn px-3 py-1 rounded-lg text-label-md font-label-md transition-all hover:bg-white/20" + (sim==='reschedule' ? ' bg-[#1CCA9B] text-[#0E2B3D] font-semibold' : ' bg-white/10 text-white')} data-state="reschedule" onClick={event=>{switchState('reschedule')}}>5. Reschedule</button>
<button className={"sim-btn px-3 py-1 rounded-lg text-label-md font-label-md transition-all hover:bg-white/20" + (sim==='cancel' ? ' bg-[#1CCA9B] text-[#0E2B3D] font-semibold' : ' bg-white/10 text-white')} data-state="cancel" onClick={event=>{switchState('cancel')}}>6. Cancel Confirm</button>
<button className={"sim-btn px-3 py-1 rounded-lg text-label-md font-label-md transition-all hover:bg-white/20" + (sim==='empty' ? ' bg-[#1CCA9B] text-[#0E2B3D] font-semibold' : ' bg-white/10 text-white')} data-state="empty" onClick={event=>{switchState('empty')}}>7. Empty State</button>
</div>
</div>

<div className="p-space-xl max-w-7xl mx-auto w-full flex-1 pb-24">

<div className="flex flex-col md:flex-row md:items-center justify-between gap-space-lg mb-space-xl">
<div>
<div className="flex items-center gap-2 mb-1">
<span className="px-2 py-0.5 rounded-full text-label-caps font-label-caps bg-surface-container text-primary">Engage &amp; Support</span>
<span className="text-outline">•</span>
<span className="text-body-sm text-outline">Synchronized Leadership Cadence</span>
</div>
<h1 className="text-headline-lg font-headline-lg text-on-surface">One-on-One Meetings Suite</h1>
</div>
<div className="flex items-center gap-space-md">

<div className="flex bg-surface-container p-1 rounded-xl">
<button className={"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-label-md font-label-md transition-all" + (view==='calendar' ? ' bg-surface shadow-sm text-primary font-semibold' : '')} id="view-toggle-calendar" onClick={event=>{switchState('calendar')}}>
<span className="material-symbols-outlined text-base">calendar_view_month</span>Calendar
          </button>
<button className={"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-label-md font-label-md transition-all text-on-surface-variant hover:text-on-surface" + (view==='list' ? ' bg-surface shadow-sm text-primary font-semibold' : '')} id="view-toggle-list" onClick={event=>{switchState('list')}}>
<span className="material-symbols-outlined text-base">view_list</span>List
          </button>
</div>
<button className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg shadow-sm hover:bg-[#0B7458] transition-all" onClick={event=>{openModal('schedule-modal')}}>
<span className="material-symbols-outlined text-lg">add</span>Schedule Meeting
        </button>
</div>
</div>

<div className="flex items-center justify-between flex-wrap gap-space-md mb-space-xl bg-surface-container-low p-2 rounded-2xl">
<div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
<button className="px-3.5 py-1.5 bg-surface text-primary rounded-xl font-label-md font-medium shadow-sm">Upcoming (4)</button>
<button className="px-3.5 py-1.5 text-on-surface-variant hover:text-on-surface rounded-xl font-label-md transition-colors">Past (12)</button>
<button className="px-3.5 py-1.5 text-on-surface-variant hover:text-on-surface rounded-xl font-label-md transition-colors">With Me (8)</button>
<button className="px-3.5 py-1.5 text-on-surface-variant hover:text-on-surface rounded-xl font-label-md transition-colors">With Team (8)</button>
</div>
<div className="flex items-center gap-2 w-full md:w-auto">
<div className="relative flex-1 md:w-64">
<span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-base">search</span>
<input className="w-full pl-9 pr-4 py-1.5 bg-surface rounded-xl border border-outline-variant text-body-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Filter by participant or agenda..." type="text"/>
</div>
</div>
</div>

<div id="view-container">

<div className={"space-y-space-xl" + (view==='calendar' ? '' : ' hidden')} id="state-calendar"><MeetingCalendar meetings={meetings} selectedDate={selectedDate} onDate={setSelectedDate} onOpen={openMeeting} onReschedule={startReschedule} /></div>

<div className={"space-y-space-md" + (view==='list' ? '' : ' hidden')} id="state-list"><MeetingList meetings={meetings} onOpen={openMeeting} onReschedule={startReschedule} /></div>

<div className={"space-y-space-xl" + (view==='detail' ? '' : ' hidden')} id="state-detail">
<div className="flex items-center justify-between bg-surface-container-lowest p-space-lg rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] border border-[#E2E8F0]">
<div className="flex items-center gap-4">
<button className="p-2 bg-surface-container hover:bg-surface-container-high rounded-xl text-on-surface" onClick={event=>{switchState('calendar')}}><span className="material-symbols-outlined">arrow_back</span></button>
<div>
<div className="flex items-center gap-3">
<h2 className="font-headline-md font-headline-md text-on-surface">{active.title}</h2>
<span className="px-2 py-0.5 rounded-full text-label-caps font-label-caps bg-[#D1F5EA] text-[#07523E]">{active.status}</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{active.date} · {active.time} · {active.duration} mins · {active.location}</p>
</div>
</div>
<div className="flex items-center gap-2">
<button className="px-3.5 py-2 bg-surface-container hover:bg-surface-container-high rounded-xl text-label-md font-label-md text-on-surface font-medium" onClick={event=>{openModal('reschedule-modal')}}>Reschedule</button>
<button className="px-3.5 py-2 bg-error-container hover:bg-error/20 rounded-xl text-label-md font-label-md text-error font-medium" onClick={event=>{openModal('cancel-modal')}}>Cancel</button>
<button className="px-4 py-2 bg-primary hover:bg-[#0B7458] text-on-primary rounded-xl text-label-md font-label-md font-medium shadow-sm flex items-center gap-1.5" onClick={event=>{markAsDone()}}><span className="material-symbols-outlined text-base">check</span>Mark as Done</button>
</div>
</div>
<div className="grid grid-cols-1 lg:grid-cols-3 gap-space-xl">

<div className="lg:col-span-1 space-y-space-xl">

<div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] border border-[#E2E8F0]">
<h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">Participants</h3>
<div className="space-y-3">
<div className="flex items-center justify-between p-2 rounded-xl bg-surface-container-low">
<div className="flex items-center gap-3">
<img className="w-10 h-10 rounded-full object-cover" data-alt="Portrait of Priya Sharma, HR Director" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCA-isLiXOk8mz7xhBN3yl5MdjpVxDORYKOH0HAhtxF-1Aj-N58vovrxYlkTC3LQ12_PiLmN-kILbtDYgsdFHl7FLrkBiq_8dBtDfdh0cjmhRInlop-RZQBAU3tIQ0vOxDUQ6Pt7nb-eoTychCZutIYNpR80XlSDwCSUQfxXmLsQMHuezcNlD8Xg7YPAS7keZUKoLtpW-g4ihmPBfY9vADkqKmXYOEa1dvab4A2ojVWc8YPtzE_nUkr"/>
<div>
<p className="font-title-md text-title-md text-on-surface">Priya Sharma</p>
<p className="font-body-sm text-body-sm text-outline">Organizer (You)</p>
</div>
</div>
<span className="material-symbols-outlined text-primary">check_circle</span>
</div>
<div className="flex items-center justify-between p-2 rounded-xl bg-surface-container-low">
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center font-semibold" aria-hidden="true">{active.participant.split(" ").map(word=>word[0]).join("")}</div>
<div>
<p className="font-title-md text-title-md text-on-surface">{active.participant}</p>
<p className="font-body-sm text-body-sm text-outline">Participant</p>
</div>
</div>
<span className="material-symbols-outlined text-[#1CCA9B]">check_circle</span>
</div>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] border border-[#E2E8F0]">
<h3 className="font-headline-sm text-headline-sm text-on-surface mb-3">Meeting Agenda</h3>
<p className="whitespace-pre-wrap text-body-sm text-on-surface-variant">{active.agenda}</p>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] border border-[#E2E8F0]">
<h3 className="font-headline-sm text-headline-sm text-on-surface mb-3">Past Meetings Log</h3>
<div className="space-y-3 font-body-sm text-body-sm">
<div className="p-3 bg-surface-container-low rounded-xl">
<div className="flex justify-between font-semibold text-on-surface">
<span>July 12, 2025</span>
<span className="text-[#07523E]">Completed</span>
</div>
<p className="text-outline mt-1">Focus: Mid-year review &amp; feedback on architecture patterns.</p>
</div>
<div className="p-3 bg-surface-container-low rounded-xl">
<div className="flex justify-between font-semibold text-on-surface">
<span>April 10, 2025</span>
<span className="text-[#07523E]">Completed</span>
</div>
<p className="text-outline mt-1">Focus: Q2 onboarding goals &amp; mentorship alignment.</p>
</div>
</div>
</div>
</div>

<div className="lg:col-span-2 space-y-space-xl">

<div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] border border-[#E2E8F0]">
<div className="flex items-center justify-between mb-4">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-primary">edit_note</span>
<h3 className="font-headline-sm text-headline-sm text-on-surface">Shared Live Notes</h3>
</div>
<span className="px-2 py-0.5 bg-[#D1F5EA] text-[#07523E] rounded-full text-label-caps font-label-caps">Saved in this session</span>
</div>
<textarea className="w-full p-4 bg-surface-container-low rounded-xl border border-outline-variant font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Type meeting notes for this session..." rows="6" value={active.notes} onChange={event=>updateActive({notes:event.target.value})} aria-label="Meeting notes" />
<div className="flex justify-between items-center mt-3 text-body-sm text-outline">
<span>Notes are stored locally for this session.</span>
<button className="text-primary font-medium hover:underline">Export as PDF / Markdown</button>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] border border-[#E2E8F0]">
<div className="flex items-center justify-between mb-4">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-primary">task_alt</span>
<h3 className="font-headline-sm text-headline-sm text-on-surface">Action Items &amp; Deliverables</h3>
</div>
<button className="px-3 py-1.5 bg-primary/10 text-primary rounded-xl font-label-md text-label-md hover:bg-primary/20 transition-all" onClick={event=>{addActionItem()}}>+ Add Action Item</button>
</div>
<div className="space-y-3" id="action-items-list">{active.actions.map(item=><label key={item.id} className="flex items-center justify-between gap-3 p-3 bg-surface-container-low rounded-xl"><span className="flex gap-3"><input type="checkbox" checked={item.done} onChange={()=>toggleAction(item.id)} aria-label={item.text}/><span className={item.done?'line-through text-outline':''}>{item.text}</span></span><span className="text-label-caps text-outline">Owner: {item.owner}</span></label>)}<input aria-label="New action item" className="w-full p-3 rounded-xl bg-surface-container-low" placeholder="Enter a new action item..." value={actionText} onChange={event=>setActionText(event.target.value)} /></div>
</div>
</div>
</div>
</div>

<div className={"py-16 px-4 text-center max-w-md mx-auto" + (view==='empty' ? '' : ' hidden')} id="state-empty">
<div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-6 text-primary">
<span className="material-symbols-outlined text-4xl">event_busy</span>
</div>
<h3 className="font-headline-md font-headline-md text-on-surface mb-2">No One-on-One Meetings Found</h3>
<p className="font-body-md text-body-md text-on-surface-variant mb-6">You don't have any upcoming 1-on-1 sessions scheduled in this view. Foster team alignment by starting a cadence today.</p>
<button className="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg shadow-sm hover:bg-[#0B7458] transition-all" onClick={event=>{openModal('schedule-modal')}}>Schedule First Meeting</button>
</div>
</div>
</div>


<div className={"fixed inset-0 z-50 bg-[#0E2B3D]/40 backdrop-blur-sm items-center justify-center p-4" + (modal==='schedule-modal' ? ' flex' : ' hidden')} id="schedule-modal" role="dialog" aria-modal="true" aria-label="schedule modal">
<div className="bg-surface-container-lowest w-full max-w-xl rounded-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden">
<div className="px-space-lg py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-surface-container-low">
<h3 className="font-headline-sm text-headline-sm text-on-surface">Schedule One-on-One Meeting</h3>
<button className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant" onClick={event=>{closeModal('schedule-modal')}}><span className="material-symbols-outlined">close</span></button>
</div>
<div className="p-space-lg space-y-4">
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">Participant Search</label>
<div className="relative">
<span className="material-symbols-outlined absolute left-3 top-2.5 text-outline">search</span>
<input className="w-full pl-9 pr-4 py-2 bg-surface rounded-xl border border-outline-variant text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" id="participant-search-input" placeholder="Type name (e.g. Priya Sharma, Rohan Sen)..." type="text"  aria-label="participant" value={draft.participant} onChange={event=>setDraft(previous=>({...previous,participant:event.target.value}))} />
</div>
</div>
<div className="grid grid-cols-2 gap-4">
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">Date</label>
<input className="w-full px-3 py-2 bg-surface rounded-xl border border-outline-variant text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" type="date"  aria-label="date" value={draft.date} onChange={event=>setDraft(previous=>({...previous,date:event.target.value}))} />
</div>
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">Time Slot</label>
<input className="w-full px-3 py-2 bg-surface rounded-xl border border-outline-variant text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" type="time"  aria-label="time" value={draft.time} onChange={event=>setDraft(previous=>({...previous,time:event.target.value}))} />
</div>
</div>
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">Recurrence Cadence</label>
<select className="w-full px-3 py-2 bg-surface rounded-xl border border-outline-variant text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" aria-label="Recurrence cadence" value={draft.cadence} onChange={event=>setDraft(previous=>({...previous,cadence:event.target.value}))}>
<option>Bi-weekly (Every 2 weeks)</option>
<option>Weekly</option>
<option>Monthly</option>
<option>One-time session</option>
</select>
</div>
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">Agenda Notes</label>
<textarea className="w-full px-3 py-2 bg-surface rounded-xl border border-outline-variant text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Initial talking points or goals for the session..." rows="3" aria-label="Meeting agenda" value={draft.agenda} onChange={event=>setDraft(previous=>({...previous,agenda:event.target.value}))} />
</div>
</div>
<div className="px-space-lg py-4 border-t border-[#E2E8F0] bg-surface-container-low flex justify-end gap-2">
<button className="px-4 py-2 bg-surface-container hover:bg-surface-container-high rounded-xl text-label-md font-label-md text-on-surface" onClick={event=>{closeModal('schedule-modal')}}>Cancel</button>
<button className="px-5 py-2 bg-primary hover:bg-[#0B7458] text-on-primary rounded-xl text-label-md font-label-md shadow-sm" onClick={event=>{scheduleMeetingSuccess()}}>Schedule Meeting</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 bg-[#0E2B3D]/40 backdrop-blur-sm items-center justify-center p-4" + (modal==='reschedule-modal' ? ' flex' : ' hidden')} id="reschedule-modal" role="dialog" aria-modal="true" aria-label="reschedule modal">
<div className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden">
<div className="px-space-lg py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-surface-container-low">
<h3 className="font-headline-sm text-headline-sm text-on-surface">Reschedule Meeting</h3>
<button className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant" onClick={event=>{closeModal('reschedule-modal')}}><span className="material-symbols-outlined">close</span></button>
</div>
<div className="p-space-lg space-y-4">
<p className="font-body-sm text-body-sm text-on-surface-variant">Select a new date and time for your meeting with {active.participant}.</p>
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">New Date</label>
<input className="w-full px-3 py-2 bg-surface rounded-xl border border-outline-variant text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" type="date"  aria-label="newDate" value={reschedule.newDate} onChange={event=>setReschedule(previous=>({...previous,newDate:event.target.value}))} />
</div>
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">New Time Slot</label>
<input className="w-full px-3 py-2 bg-surface rounded-xl border border-outline-variant text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" type="time"  aria-label="newTime" value={reschedule.newTime} onChange={event=>setReschedule(previous=>({...previous,newTime:event.target.value}))} />
</div>
</div>
<div className="px-space-lg py-4 border-t border-[#E2E8F0] bg-surface-container-low flex justify-end gap-2">
<button className="px-4 py-2 bg-surface-container hover:bg-surface-container-high rounded-xl text-label-md font-label-md text-on-surface" onClick={event=>{closeModal('reschedule-modal')}}>Cancel</button>
<button className="px-5 py-2 bg-primary hover:bg-[#0B7458] text-on-primary rounded-xl text-label-md font-label-md shadow-sm" onClick={event=>{rescheduleSuccess()}}>Confirm Reschedule</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 bg-[#0E2B3D]/40 backdrop-blur-sm items-center justify-center p-4" + (modal==='cancel-modal' ? ' flex' : ' hidden')} id="cancel-modal" role="dialog" aria-modal="true" aria-label="cancel modal">
<div className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden">
<div className="px-space-lg py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-surface-container-low">
<h3 className="font-headline-sm text-headline-sm text-error">Cancel Meeting</h3>
<button className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant" onClick={event=>{closeModal('cancel-modal')}}><span className="material-symbols-outlined">close</span></button>
</div>
<div className="p-space-lg space-y-4">
<p className="font-body-md text-body-md text-on-surface">Are you sure you want to cancel this one-on-one? This updates the local meeting record.</p>
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">Reason for cancellation (Optional)</label>
<textarea className="w-full px-3 py-2 bg-surface rounded-xl border border-outline-variant text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Brief note explaining why this meeting is being cancelled..." rows="3" aria-label="Cancellation reason" value={cancelReason} onChange={event=>setCancelReason(event.target.value)} />
</div>
</div>
<div className="px-space-lg py-4 border-t border-[#E2E8F0] bg-surface-container-low flex justify-end gap-2">
<button className="px-4 py-2 bg-surface-container hover:bg-surface-container-high rounded-xl text-label-md font-label-md text-on-surface" onClick={event=>{closeModal('cancel-modal')}}>Keep Meeting</button>
<button className="px-5 py-2 bg-error hover:bg-[#BE123C] text-on-error rounded-xl text-label-md font-label-md shadow-sm" onClick={event=>{cancelSuccess()}}>Yes, Cancel Meeting</button>
</div>
</div>
</div>

<div className={"fixed bottom-6 right-6 z-50 bg-[#0E2B3D] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 transform  transition-all duration-300" + (toast ? '' : ' translate-y-24 opacity-0 pointer-events-none')} id="toast" role="status">
<span className="material-symbols-outlined text-[#1CCA9B]">check_circle</span>
<span className="font-label-lg text-label-lg" id="toast-message">{toast}</span>
</div>
</div></main></div></>);
}
