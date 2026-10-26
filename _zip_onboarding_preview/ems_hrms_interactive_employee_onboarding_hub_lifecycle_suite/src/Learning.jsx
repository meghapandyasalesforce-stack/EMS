import { useEffect, useRef, useState } from 'react';
import { Sidebar, Header } from './Layout.jsx';
import { initialCourses, initialAssignments } from './learningData.js';
import { CourseCard, LearningAssignmentRow } from './LearningComponents.jsx';
const blankCourse=()=>({title:'',category:'Engineering',duration:'',description:''});
export default function Learning() {
 const [tab,setTab]=useState('courses');
 const [courses,setCourses]=useState(initialCourses);
 const [assignments,setAssignments]=useState(initialAssignments);
 const [search,setSearch]=useState('');
 const [category,setCategory]=useState('All Categories');
 const [level,setLevel]=useState('All Levels');
 const [modal,setModal]=useState(null);
 const [drawer,setDrawer]=useState(false);
 const [activeId,setActiveId]=useState(1);
 const [draft,setDraft]=useState(blankCourse);
 const [editingId,setEditingId]=useState(null);
 const [recipient,setRecipient]=useState('Ananya Deshmukh (Platform Engg)');
 const [dueDate,setDueDate]=useState('');
 const [reminders,setReminders]=useState(true);
 const [assignmentId,setAssignmentId]=useState(null);
 const [certificateSearch,setCertificateSearch]=useState('');
 const [toast,setToast]=useState('');
 const timer=useRef();
 const activeCourse=courses.find(course=>course.id===activeId)||courses[0]||initialCourses[0];
 const filteredCourses=courses.filter(course=>!course.archived&&(category==='All Categories'||course.category===category||category==='Engineering & Security'&&['Engineering','Security'].includes(course.category))&&(level==='All Levels'||course.level===level)&&[course.title,course.description].some(value=>value.toLowerCase().includes(search.toLowerCase())));
 const showToast=message=>{clearTimeout(timer.current);setToast(message);timer.current=setTimeout(()=>setToast(''),3500);};
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 const switchTab=setTab;
 const closeModal=()=>setModal(null);
 const openModal=id=>{if(id==='assignModal')setAssignmentId(null);if(id==='createModal'){setEditingId(null);setDraft(blankCourse());}setModal(id);};
 const closeDrawer=()=>setDrawer(false);
 const openDrawer=()=>setDrawer(true);
 const openCourse=id=>{setActiveId(id);setDrawer(true);};
 const assignCourse=id=>{setActiveId(id);setAssignmentId(null);setModal('assignModal');};
 const resetFilters=()=>{setSearch('');setCategory('All Categories');setLevel('All Levels');setTab('courses');};
 const switchState=state=>{setModal(null);setDrawer(false);if(state==='default')resetFilters();else if(state==='create-modal'){setTab('courses');openModal('createModal');}else if(state==='detail-drawer'){setTab('courses');openDrawer();}else if(state==='assign-modal'){setTab('courses');assignCourse(activeCourse.id);}else if(state==='assignments-tab')setTab('assignments');else if(state==='certificates-tab')setTab('certificates');else if(state==='filtered'){resetFilters();setCategory('Engineering & Security');}else setTab(state);};
 const editCourse=()=>{setEditingId(activeCourse.id);setDraft({...activeCourse});setDrawer(false);setModal('createModal');};
 const saveCourse=()=>{
  if(!draft.title.trim()||!draft.duration.trim()||!draft.description.trim()){showToast('Enter a title, duration, and course description.');return;}
  if(editingId)setCourses(previous=>previous.map(course=>course.id===editingId?{...course,...draft,title:draft.title.trim()}:course));
  else setCourses(previous=>[...previous,{...draft,id:Math.max(0,...previous.map(course=>course.id))+1,title:draft.title.trim(),level:'Beginner',lead:'Priya Sharma',completion:0,enrolled:0,image:initialCourses[0].image}]);
  closeModal();resetFilters();showToast(editingId?'Course updated.':'Course added to the local catalog.');
 };
 const archiveCourse=()=>{setCourses(previous=>previous.map(course=>course.id===activeId?{...course,archived:true}:course));setDrawer(false);showToast('Course archived.');};
 const promptRemove=id=>{setAssignmentId(id);setModal('removeConfirmModal');};
 const removeAssignment=()=>{setAssignments(previous=>previous.filter(item=>item.id!==assignmentId));closeModal();showToast('Assignment removed.');};
 const reassign=id=>{const item=assignments.find(item=>item.id===id);setAssignmentId(id);setActiveId(item.courseId);setRecipient(item.employee==='Karthik Ramanathan'?'Karthik Ramanathan (Core Infra)':item.employee==='Priya Sharma'?'Priya Sharma (People Operations)':'Ananya Deshmukh (Platform Engg)');setDueDate(item.due);setModal('assignModal');};
 const saveAssignment=()=>{
  if(!dueDate){showToast('Choose an assignment due date.');return;}
  if(activeCourse.archived){showToast('Choose an active course from the catalog.');return;}
  const employee=recipient.includes(' (')?recipient.split(' (')[0]:recipient;
  const department=recipient.includes('(')?recipient.split('(')[1].replace(')',''):'Team';
  const record={courseId:activeCourse.id,employee,department,due:dueDate,progress:0,status:'Not Started',reminders};
  setAssignments(previous=>assignmentId?previous.map(item=>item.id===assignmentId?{...item,...record}:item):[...previous,{...record,id:Math.max(0,...previous.map(item=>item.id))+1}]);
  setAssignmentId(null);closeModal();setTab('assignments');showToast('Course assigned locally.');
 };
 useEffect(()=>{
  const id=modal||(drawer?'courseDetailDrawer':null);if(!id)return;
  const dialog=document.getElementById(id),previous=document.activeElement;
  dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',id);
  const controls=()=>[...dialog.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled);controls()[0]?.focus();
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const keydown=event=>{if(event.key==='Escape'){if(modal)setModal(null);else setDrawer(false);}if(event.key==='Tab'){const items=controls(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};
  document.addEventListener('keydown',keydown);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keydown);previous?.focus();};
 },[modal,drawer]);
 return (<><Sidebar activePage="learning" /><div className="pl-64"><Header /><main className="relative pt-16 bg-surface min-h-screen"><div className="flex flex-col w-full min-h-screen bg-surface text-on-surface">

<div className="bg-inverse-surface text-inverse-on-surface px-space-xl py-space-sm flex items-center justify-between text-label-caps z-30 shadow-md">
<div className="flex items-center gap-space-sm overflow-x-auto py-1">
<span className="text-inverse-primary font-bold tracking-wider uppercase">Simulator Rig:</span>
<button className="px-2 py-1 rounded bg-surface/10 hover:bg-surface/20 transition-colors text-inverse-on-surface whitespace-nowrap" onClick={event => { switchState('default') }}>1. Default Roster</button>
<button className="px-2 py-1 rounded bg-surface/10 hover:bg-surface/20 transition-colors text-inverse-on-surface whitespace-nowrap" onClick={event => { switchState('create-modal') }}>2. Create Modal</button>
<button className="px-2 py-1 rounded bg-surface/10 hover:bg-surface/20 transition-colors text-inverse-on-surface whitespace-nowrap" onClick={event => { switchState('detail-drawer') }}>3. Detail Drawer</button>
<button className="px-2 py-1 rounded bg-surface/10 hover:bg-surface/20 transition-colors text-inverse-on-surface whitespace-nowrap" onClick={event => { switchState('assign-modal') }}>4. Assign Modal</button>
<button className="px-2 py-1 rounded bg-surface/10 hover:bg-surface/20 transition-colors text-inverse-on-surface whitespace-nowrap" onClick={event => { switchState('assignments-tab') }}>5. Assignments Tab</button>
<button className="px-2 py-1 rounded bg-surface/10 hover:bg-surface/20 transition-colors text-inverse-on-surface whitespace-nowrap" onClick={event => { switchState('certificates-tab') }}>6. Certificates Tab</button>
<button className="px-2 py-1 rounded bg-surface/10 hover:bg-surface/20 transition-colors text-inverse-on-surface whitespace-nowrap" onClick={event => { switchState('filtered') }}>7. Filtered</button>
<button className="px-2 py-1 rounded bg-surface/10 hover:bg-surface/20 transition-colors text-inverse-on-surface whitespace-nowrap" onClick={event => { switchState('empty') }}>8. Empty State</button>
<button className="px-2 py-1 rounded bg-surface/10 hover:bg-surface/20 transition-colors text-inverse-on-surface whitespace-nowrap" onClick={event => { switchState('loading') }}>9. Loading Skeleton</button>
</div>
<div className="flex items-center gap-2">
<span className="h-2 w-2 rounded-full bg-inverse-primary animate-ping"></span>
<span className="hidden sm:inline">L&amp;D Suite Active</span>
</div>
</div>

<div className="px-space-xl py-space-xl max-w-7xl mx-auto w-full space-y-space-xl">

<div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
<div>
<div className="flex items-center gap-2 mb-1">
<span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-caps text-label-caps uppercase">Engage &amp; Support</span>
<span className="text-outline text-body-sm">• Updated 10 mins ago</span>
</div>
<h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Enterprise Learning &amp; Development Hub</h1><a href="#/create-course" className="inline-block mt-2 text-primary text-body-sm hover:underline">Open Create Course Studio</a>
<p className="text-on-surface-variant font-body-md mt-1">Orchestrate internal training tracks, compliance certifications, and employee skill roadmaps.</p>
</div>
<div className="flex items-center gap-space-sm">
<button className="flex items-center gap-2 px-space-md py-2.5 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-label-lg transition-all shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] active:scale-95" onClick={event => { openModal('createModal') }}>
<span className="material-symbols-outlined text-lg">add</span>
          Create Course
        </button>
<button className="p-2.5 bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/40 rounded-lg text-on-surface transition-all">
<span className="material-symbols-outlined text-lg">download</span>
</button>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] border border-outline-variant/30 flex flex-col justify-between relative overflow-hidden group hover:border-primary/50 transition-all">
<div className="absolute -right-6 -bottom-6 w-24 h-24 bg-primary/5 rounded-full group-hover:scale-125 transition-transform"></div>
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps text-outline uppercase">Active Courses</span>
<span className="p-2 rounded-lg bg-primary/10 text-primary material-symbols-outlined text-lg">school</span>
</div>
<div className="mt-4">
<div className="text-3xl font-display-sm text-on-surface font-bold">24</div>
<div className="flex items-center gap-1 mt-1 text-primary text-body-sm font-medium">
<span className="material-symbols-outlined text-sm">trending_up</span>
<span>+3 added this month</span>
</div>
</div>
</div>
<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] border border-outline-variant/30 flex flex-col justify-between relative overflow-hidden group hover:border-primary/50 transition-all">
<div className="absolute -right-6 -bottom-6 w-24 h-24 bg-secondary/5 rounded-full group-hover:scale-125 transition-transform"></div>
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps text-outline uppercase">Enrolled Employees</span>
<span className="p-2 rounded-lg bg-secondary/10 text-secondary material-symbols-outlined text-lg">groups</span>
</div>
<div className="mt-4">
<div className="text-3xl font-display-sm text-on-surface font-bold">1,420</div>
<div className="flex items-center gap-1 mt-1 text-secondary text-body-sm font-medium">
<span className="material-symbols-outlined text-sm">group_add</span>
<span>84% active participation</span>
</div>
</div>
</div>
<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] border border-outline-variant/30 flex flex-col justify-between relative overflow-hidden group hover:border-primary/50 transition-all">
<div className="absolute -right-6 -bottom-6 w-24 h-24 bg-primary/5 rounded-full group-hover:scale-125 transition-transform"></div>
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps text-outline uppercase">Completion Rate</span>
<span className="p-2 rounded-lg bg-primary/10 text-primary material-symbols-outlined text-lg">task_alt</span>
</div>
<div className="mt-4">
<div className="text-3xl font-display-sm text-on-surface font-bold">91.8%</div>
<div className="flex items-center gap-1 mt-1 text-primary text-body-sm font-medium">
<span className="material-symbols-outlined text-sm">check_circle</span>
<span>+2.4% vs last quarter</span>
</div>
</div>
</div>
<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] border border-outline-variant/30 flex flex-col justify-between relative overflow-hidden group hover:border-primary/50 transition-all">
<div className="absolute -right-6 -bottom-6 w-24 h-24 bg-tertiary/5 rounded-full group-hover:scale-125 transition-transform"></div>
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps text-outline uppercase">Certifications Issued</span>
<span className="p-2 rounded-lg bg-tertiary/10 text-tertiary material-symbols-outlined text-lg">military_tech</span>
</div>
<div className="mt-4">
<div className="text-3xl font-display-sm text-on-surface font-bold">840</div>
<div className="flex items-center gap-1 mt-1 text-tertiary text-body-sm font-medium">
<span className="material-symbols-outlined text-sm">verified</span>
<span>Verified digital badges</span>
</div>
</div>
</div>
</div>

<div className="flex items-center gap-2 border-b border-outline-variant/30 pb-0">
<button className={"px-space-md py-3 font-label-lg text-label-lg border-b-2 transition-all flex items-center gap-2" + (tab === 'courses' ? ' border-primary text-primary font-semibold' : ' border-transparent')} id="tab-courses" onClick={event => { switchTab('courses') }}>
<span className="material-symbols-outlined text-lg">library_books</span>
        Courses Catalog
      </button>
<button className={"px-space-md py-3 font-label-lg text-label-lg font-medium text-on-surface-variant hover:text-on-surface border-b-2 transition-all flex items-center gap-2" + (tab === 'assignments' ? ' border-primary text-primary font-semibold' : ' border-transparent')} id="tab-assignments" onClick={event => { switchTab('assignments') }}>
<span className="material-symbols-outlined text-lg">assignment</span>
        Assignments &amp; Progress
      </button>
<button className={"px-space-md py-3 font-label-lg text-label-lg font-medium text-on-surface-variant hover:text-on-surface border-b-2 transition-all flex items-center gap-2" + (tab === 'certificates' ? ' border-primary text-primary font-semibold' : ' border-transparent')} id="tab-certificates" onClick={event => { switchTab('certificates') }}>
<span className="material-symbols-outlined text-lg">military_tech</span>
        Certificates Ledger
      </button>
</div>

<div className={"space-y-space-lg" + (tab === 'courses' ? '' : ' hidden')} id="content-courses">

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] border border-outline-variant/30 flex flex-wrap items-center justify-between gap-space-md">
<div className="flex flex-wrap items-center gap-space-md flex-1">

<div className="relative min-w-[240px] flex-1">
<span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-lg">search</span>
<input className="w-full pl-9 pr-4 py-2 bg-surface-container-low rounded-lg font-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary border border-transparent" value={search} onChange={event=>setSearch(event.target.value)} aria-label="Search courses" placeholder="Search courses by title, skill..." type="text"/>
</div>

<select className="px-3 py-2 bg-surface-container-low rounded-lg font-body-sm text-on-surface border border-transparent focus:outline-none focus:ring-2 focus:ring-primary" value={category} onChange={event=>setCategory(event.target.value)} aria-label="Filter category">
<option>All Categories</option><option>Engineering &amp; Security</option>
<option>Engineering</option>
<option>Product</option>
<option>Leadership</option>
<option>Compliance</option>
<option>Security</option>
</select>

<select className="px-3 py-2 bg-surface-container-low rounded-lg font-body-sm text-on-surface border border-transparent focus:outline-none focus:ring-2 focus:ring-primary" value={level} onChange={event=>setLevel(event.target.value)} aria-label="Filter level">
<option>All Levels</option>
<option>Beginner</option>
<option>Intermediate</option>
<option>Advanced</option>
<option>L1-L8 Executive</option>
</select>
</div>
<div className="flex items-center gap-space-sm">
<button className="px-3 py-2 text-on-surface-variant hover:text-on-surface font-label-md flex items-center gap-1 transition-colors" onClick={resetFilters}>
<span className="material-symbols-outlined text-base">restart_alt</span>
            Reset Filters
          </button>
<button className="px-4 py-2 bg-secondary-container hover:bg-secondary-fixed text-on-secondary-fixed rounded-lg font-label-md font-medium transition-all" onClick={()=>setTab("courses")}>
            Apply Filters
          </button>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg" id="course-grid-container">{filteredCourses.map(course => <CourseCard key={course.id} course={course} onOpen={openCourse} onAssign={assignCourse} />)}{filteredCourses.length === 0 && <p>No matching courses. Try changing your filters.</p>}</div>
</div>

<div className={"space-y-space-lg" + (tab === 'assignments' ? '' : ' hidden')} id="content-assignments">
<div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] border border-outline-variant/30 overflow-hidden">
<div className="p-space-lg border-b border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
<div>
<h3 className="font-headline-sm text-headline-sm text-on-surface">Employee Assignment Tracking</h3>
<p className="font-body-sm text-on-surface-variant">Monitor active individual learning tracks, send automated WhatsApp/Email reminders, or reassign modules.</p>
</div>
<div className="flex items-center gap-space-sm">
<button className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md flex items-center gap-2" onClick={event => { openModal('assignModal') }}>
<span className="material-symbols-outlined text-base">person_add</span>
              New Assignment
            </button>
</div>
</div>
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse">
<thead>
<tr className="bg-surface-container-low font-label-caps text-label-caps text-outline uppercase border-b border-outline-variant/20">
<th className="p-space-md">Employee</th>
<th className="p-space-md">Assigned Course</th>
<th className="p-space-md">Due Date</th>
<th className="p-space-md">Progress</th>
<th className="p-space-md">Status</th>
<th className="p-space-md text-right">Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-outline-variant/10 font-body-sm">{assignments.map(item => <LearningAssignmentRow key={item.id} item={item} course={courses.find(course=>course.id===item.courseId)} onRemove={promptRemove} onReassign={reassign} showToast={showToast} />)}</tbody>
</table>
</div>
</div>
</div>

<div className={"space-y-space-lg" + (tab === 'certificates' ? '' : ' hidden')} id="content-certificates">
<div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] border border-outline-variant/30 p-space-lg">
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md mb-space-lg">
<div>
<h3 className="font-headline-sm text-headline-sm text-on-surface">Issued Certifications Ledger</h3>
<p className="font-body-sm text-on-surface-variant">Cryptographically secured verifiable completion badges and downloadable enterprise credentials.</p>
</div>
<div className="flex items-center gap-space-sm">
<div className="relative">
<span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-lg">search</span>
<input className="pl-9 pr-4 py-2 bg-surface-container-low rounded-lg font-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary border border-transparent" value={certificateSearch} onChange={event=>setCertificateSearch(event.target.value)} aria-label="Search certificates" placeholder="Search by recipient..." type="text"/>
</div>
</div>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">
<div className={"bg-surface-container-low rounded-xl p-space-md border border-outline-variant/20 flex flex-col justify-between" + ("karthik ramanathan".includes(certificateSearch.toLowerCase()) ? '' : ' hidden')}>
<div>
<div className="flex items-center justify-between mb-3">
<span className="px-2.5 py-0.5 rounded-full font-label-caps text-label-caps bg-primary/10 text-primary">SEC-2024-884</span>
<span className="text-outline text-body-sm">12 Sep 2024</span>
</div>
<h4 className="font-title-md text-title-md text-on-surface">Enterprise SOC2 &amp; Data Security</h4>
<p className="font-body-sm text-on-surface-variant mt-1">Awarded to <strong className="text-on-surface">Karthik Ramanathan</strong></p>
</div>
<div className="mt-6 flex items-center justify-between pt-3 border-t border-outline-variant/20">
<span className="text-outline text-xs">SHA-256 Verified Badge</span>
<button className="px-3 py-1.5 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-label-md flex items-center gap-1.5 transition-all" onClick={event => { showToast('Certificate download is a prototype for Karthik Ramanathan.') }}>
<span className="material-symbols-outlined text-sm">download</span>
                Download PDF
              </button>
</div>
</div>
<div className={"bg-surface-container-low rounded-xl p-space-md border border-outline-variant/20 flex flex-col justify-between" + ("ananya deshmukh".includes(certificateSearch.toLowerCase()) ? '' : ' hidden')}>
<div>
<div className="flex items-center justify-between mb-3">
<span className="px-2.5 py-0.5 rounded-full font-label-caps text-label-caps bg-secondary/10 text-secondary">ENG-2024-319</span>
<span className="text-outline text-body-sm">05 Sep 2024</span>
</div>
<h4 className="font-title-md text-title-md text-on-surface">Advanced Distributed Microservices</h4>
<p className="font-body-sm text-on-surface-variant mt-1">Awarded to <strong className="text-on-surface">Ananya Deshmukh</strong></p>
</div>
<div className="mt-6 flex items-center justify-between pt-3 border-t border-outline-variant/20">
<span className="text-outline text-xs">SHA-256 Verified Badge</span>
<button className="px-3 py-1.5 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-label-md flex items-center gap-1.5 transition-all" onClick={event => { showToast('Certificate download is a prototype for Ananya Deshmukh.') }}>
<span className="material-symbols-outlined text-sm">download</span>
                Download PDF
              </button>
</div>
</div>
<div className={"bg-surface-container-low rounded-xl p-space-md border border-outline-variant/20 flex flex-col justify-between" + ("priya sharma".includes(certificateSearch.toLowerCase()) ? '' : ' hidden')}>
<div>
<div className="flex items-center justify-between mb-3">
<span className="px-2.5 py-0.5 rounded-full font-label-caps text-label-caps bg-tertiary-container/20 text-tertiary">LEGAL-2024-042</span>
<span className="text-outline text-body-sm">28 Aug 2024</span>
</div>
<h4 className="font-title-md text-title-md text-on-surface">POSH &amp; Workplace Compliance</h4>
<p className="font-body-sm text-on-surface-variant mt-1">Awarded to <strong className="text-on-surface">Priya Sharma</strong></p>
</div>
<div className="mt-6 flex items-center justify-between pt-3 border-t border-outline-variant/20">
<span className="text-outline text-xs">SHA-256 Verified Badge</span>
<button className="px-3 py-1.5 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-label-md flex items-center gap-1.5 transition-all" onClick={event => { showToast('Certificate download is a prototype for Priya Sharma.') }}>
<span className="material-symbols-outlined text-sm">download</span>
                Download PDF
              </button>
</div>
</div>
</div>
</div>
</div>

<div className={"py-16 text-center space-y-space-md bg-surface-container-lowest rounded-xl border border-outline-variant/30" + (tab === 'empty' ? '' : ' hidden')} id="content-empty">
<div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-3xl">folder_off</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-on-surface">No Learning Courses Found</h3>
<p className="font-body-md text-on-surface-variant max-w-md mx-auto">There are currently no training modules matching your exact filter criteria or the database is freshly initialized.</p>
<button className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md" onClick={event => { switchState('default') }}>Reset View &amp; Reload Roster</button>
</div>

<div className={"space-y-space-lg" + (tab === 'loading' ? '' : ' hidden')} id="content-loading">
<div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
<div className="bg-surface-container-lowest p-space-lg rounded-xl border border-outline-variant/20 animate-pulse space-y-4">
<div className="h-40 bg-surface-container-low rounded-lg"></div>
<div className="h-6 bg-surface-container-low rounded w-3/4"></div>
<div className="h-4 bg-surface-container-low rounded w-full"></div>
<div className="h-4 bg-surface-container-low rounded w-1/2"></div>
</div>
<div className="bg-surface-container-lowest p-space-lg rounded-xl border border-outline-variant/20 animate-pulse space-y-4">
<div className="h-40 bg-surface-container-low rounded-lg"></div>
<div className="h-6 bg-surface-container-low rounded w-3/4"></div>
<div className="h-4 bg-surface-container-low rounded w-full"></div>
<div className="h-4 bg-surface-container-low rounded w-1/2"></div>
</div>
<div className="bg-surface-container-lowest p-space-lg rounded-xl border border-outline-variant/20 animate-pulse space-y-4">
<div className="h-40 bg-surface-container-low rounded-lg"></div>
<div className="h-6 bg-surface-container-low rounded w-3/4"></div>
<div className="h-4 bg-surface-container-low rounded w-full"></div>
<div className="h-4 bg-surface-container-low rounded w-1/2"></div>
</div>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 backdrop-blur-sm" + (modal === 'createModal' ? '' : ' hidden')} id="createModal">
<div className="bg-surface-container-lowest rounded-xl max-w-lg w-full p-space-xl shadow-[0_10px_30px_-4px_rgba(14,43,61,0.12)] border border-outline-variant/30 space-y-space-lg">
<div className="flex items-center justify-between">
<h3 className="font-headline-sm text-headline-sm text-on-surface">Create New Learning Course</h3>
<button className="text-outline hover:text-on-surface" onClick={event => { closeModal('createModal') }}><span className="material-symbols-outlined">close</span></button>
</div>
<div className="space-y-space-md">
<div>
<label className="block font-label-md text-on-surface mb-1">Course Title</label>
<input className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary font-body-md" value={draft.title} onChange={event=>setDraft(previous=>({...previous,title:event.target.value}))} aria-label="Course title" placeholder="e.g., Cloud Native Security &amp; Kubernetes" type="text"/>
</div>
<div className="grid grid-cols-2 gap-4">
<div>
<label className="block font-label-md text-on-surface mb-1">Category</label>
<select className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary font-body-md" value={draft.category} onChange={event=>setDraft(previous=>({...previous,category:event.target.value}))} aria-label="Course category">
<option>Engineering</option>
<option>Security</option>
<option>Leadership</option>
<option>Compliance</option>
</select>
</div>
<div>
<label className="block font-label-md text-on-surface mb-1">Duration</label>
<input className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary font-body-md" value={draft.duration} onChange={event=>setDraft(previous=>({...previous,duration:event.target.value}))} aria-label="Course duration" placeholder="e.g., 4 Weeks" type="text"/>
</div>
</div>
<div>
<label className="block font-label-md text-on-surface mb-1">Course Description &amp; Syllabus Outline</label>
<textarea className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary font-body-md" placeholder="Enter concise curriculum details..." rows="3" value={draft.description} onChange={event=>setDraft(previous=>({...previous,description:event.target.value}))} aria-label="Course description" />
</div>
</div>
<div className="flex items-center justify-end gap-space-sm pt-2">
<button className="px-4 py-2 rounded-lg font-label-md border border-outline-variant/40 text-on-surface hover:bg-surface-container" onClick={event => { closeModal('createModal') }}>Cancel</button>
<button className="px-4 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-label-md" onClick={event => { saveCourse() }}>Publish Course</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 backdrop-blur-sm" + (modal === 'assignModal' ? '' : ' hidden')} id="assignModal">
<div className="bg-surface-container-lowest rounded-xl max-w-md w-full p-space-xl shadow-[0_10px_30px_-4px_rgba(14,43,61,0.12)] border border-outline-variant/30 space-y-space-lg">
<div className="flex items-center justify-between">
<h3 className="font-headline-sm text-headline-sm text-on-surface">Assign Course to Team or Employee</h3>
<button className="text-outline hover:text-on-surface" onClick={event => { closeModal('assignModal') }}><span className="material-symbols-outlined">close</span></button>
</div>
<div className="space-y-space-md"><div><label className="block text-label-md mb-1" htmlFor="assignment-course">Course</label><select id="assignment-course" aria-label="Assignment course" className="w-full p-2 rounded-lg bg-surface-container-low" value={activeId} onChange={event=>setActiveId(Number(event.target.value))}>{courses.filter(course=>!course.archived).map(course=><option key={course.id} value={course.id}>{course.title}</option>)}</select></div>
<div>
<label className="block font-label-md text-on-surface mb-1">Select Employee or Department</label>
<select className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary font-body-md" value={recipient} onChange={event=>setRecipient(event.target.value)} aria-label="Assignment recipient">
<option>Ananya Deshmukh (Platform Engg)</option>
<option>Karthik Ramanathan (Core Infra)</option><option>Priya Sharma (People Operations)</option>
<option>Entire Platform Engineering Squad</option>
<option>Entire Product Design Team</option>
</select>
</div>
<div>
<label className="block font-label-md text-on-surface mb-1">Due Date</label>
<input className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary font-body-md" type="date" value={dueDate} onChange={event=>setDueDate(event.target.value)} aria-label="Assignment due date"/>
</div>
<div className="flex items-center gap-2 pt-2">
<input checked={reminders} onChange={event=>setReminders(event.target.checked)} className="w-4 h-4 text-primary rounded border-outline" id="reminderToggle" type="checkbox"/>
<label className="font-body-sm text-on-surface" htmlFor="reminderToggle">Send automated WhatsApp &amp; Email reminders</label>
</div>
</div>
<div className="flex items-center justify-end gap-space-sm pt-2">
<button className="px-4 py-2 rounded-lg font-label-md border border-outline-variant/40 text-on-surface hover:bg-surface-container" onClick={event => { closeModal('assignModal') }}>Cancel</button>
<button className="px-4 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-label-md" onClick={event => { saveAssignment() }}>Assign &amp; Notify</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 backdrop-blur-sm" + (modal === 'removeConfirmModal' ? '' : ' hidden')} id="removeConfirmModal">
<div className="bg-surface-container-lowest rounded-xl max-w-sm w-full p-space-xl shadow-[0_10px_30px_-4px_rgba(14,43,61,0.12)] border border-outline-variant/30 space-y-space-lg text-center">
<div className="w-12 h-12 bg-error-container text-on-error-container rounded-full mx-auto flex items-center justify-center">
<span className="material-symbols-outlined">warning</span>
</div>
<div>
<h3 className="font-headline-sm text-headline-sm text-on-surface">Remove Assignment?</h3>
<p className="font-body-sm text-on-surface-variant mt-1">This will revoke access for this employee and archive their progress record.</p>
</div>
<div className="flex items-center justify-center gap-space-sm pt-2">
<button className="px-4 py-2 rounded-lg font-label-md border border-outline-variant/40 text-on-surface hover:bg-surface-container" onClick={event => { closeModal('removeConfirmModal') }}>Cancel</button>
<button className="px-4 py-2 bg-error hover:bg-error/90 text-on-error rounded-lg font-label-md" onClick={event => { removeAssignment() }}>Confirm Remove</button>
</div>
</div>
</div>

<div className={"fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-surface-container-lowest shadow-[0_10px_30px_-4px_rgba(14,43,61,0.2)] transform transition-transform duration-300 flex flex-col justify-between" + (drawer ? '' : ' hidden')} id="courseDetailDrawer">
<div className="p-space-xl overflow-y-auto space-y-space-lg">
<div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
<div className="flex items-center gap-2">
<span className="px-2.5 py-0.5 rounded-full font-label-caps text-label-caps bg-primary text-on-primary">{activeCourse.category}</span>
<span className="text-outline text-body-sm">{activeCourse.duration} Duration</span>
</div>
<button className="text-outline hover:text-on-surface p-1 rounded" onClick={event => { closeDrawer('courseDetailDrawer') }}><span className="material-symbols-outlined">close</span></button>
</div>
<div>
<h2 className="font-headline-md text-headline-md text-on-surface">{activeCourse.title}</h2>
<p className="font-body-md text-on-surface-variant mt-2">{activeCourse.description}</p>
</div>
<div className="grid grid-cols-3 gap-4 py-4 bg-surface-container-low rounded-xl px-4">
<div>
<span className="text-outline font-label-caps text-label-caps block uppercase">Enrolled</span>
<span className="text-title-md font-bold text-on-surface">{activeCourse.enrolled} Staff</span>
</div>
<div>
<span className="text-outline font-label-caps text-label-caps block uppercase">Completion</span>
<span className="text-title-md font-bold text-primary">{activeCourse.completion}% Rate</span>
</div>
<div>
<span className="text-outline font-label-caps text-label-caps block uppercase">Lead</span>
<span className="text-title-md font-bold text-on-surface">{activeCourse.lead}</span>
</div>
</div>
<div className="space-y-space-md">
<h4 className="font-headline-sm text-headline-sm text-on-surface">Sample Security Curriculum (4 modules)</h4>
<div className="space-y-2">
<div className="p-3 rounded-lg bg-surface-container-low flex items-center justify-between">
<div className="flex items-center gap-3">
<span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">1</span>
<span className="font-body-md font-medium text-on-surface">Trust Services Criteria &amp; Security Principles</span>
</div>
<span className="text-outline text-body-sm">45 mins</span>
</div>
<div className="p-3 rounded-lg bg-surface-container-low flex items-center justify-between">
<div className="flex items-center gap-3">
<span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">2</span>
<span className="font-body-md font-medium text-on-surface">Access Controls &amp; Cryptographic Standards</span>
</div>
<span className="text-outline text-body-sm">60 mins</span>
</div>
<div className="p-3 rounded-lg bg-surface-container-low flex items-center justify-between">
<div className="flex items-center gap-3">
<span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">3</span>
<span className="font-body-md font-medium text-on-surface">Incident Management &amp; Audit Logging</span>
</div>
<span className="text-outline text-body-sm">50 mins</span>
</div>
<div className="p-3 rounded-lg bg-surface-container-low flex items-center justify-between">
<div className="flex items-center gap-3">
<span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">4</span>
<span className="font-body-md font-medium text-on-surface">Final Compliance Certification Assessment</span>
</div>
<span className="text-outline text-body-sm">30 mins</span>
</div>
</div>
</div>
</div>
<div className="p-space-lg border-t border-outline-variant/20 bg-surface-container-low flex items-center justify-between">
<button className="px-4 py-2 text-error hover:bg-error/10 rounded-lg font-label-md" onClick={event => { archiveCourse() }}>Archive Course</button>
<div className="flex items-center gap-2">
<button className="px-4 py-2 border border-outline-variant/40 hover:bg-surface-container rounded-lg font-label-md text-on-surface" onClick={event => { editCourse() }}>Edit Course</button>
<button className="px-4 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-label-md" onClick={event => { closeDrawer('courseDetailDrawer'); openModal('assignModal') }}>Assign Course</button>
</div>
</div>
</div>

<div className={"fixed bottom-6 right-6 z-50 bg-inverse-surface text-inverse-on-surface px-space-lg py-3 rounded-xl shadow-xl transform  transition-all duration-300 flex items-center gap-3" + (toast ? '' : ' translate-y-24 opacity-0 pointer-events-none')} id="toast" role="status">
<span className="material-symbols-outlined text-inverse-primary">check_circle</span>
<span className="font-body-md" id="toast-message">{toast}</span>
</div>

</div></main></div></>);
}
