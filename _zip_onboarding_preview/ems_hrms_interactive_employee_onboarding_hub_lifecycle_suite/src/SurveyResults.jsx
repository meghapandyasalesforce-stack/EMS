import { useEffect, useRef, useState } from 'react';
import { Sidebar, Header } from './Layout.jsx';
import { initialSurveyComments } from './surveyResultsData.js';
import SurveyCommentStream from './SurveyCommentStream.jsx';
export default function SurveyResults() {
 const [state,setState]=useState('overview');
 const [metric,setMetric]=useState('');
 const [modal,setModal]=useState(null);
 const [exportMenu,setExportMenu]=useState(false);
 const [commentType,setCommentType]=useState('all');
 const [comments,setComments]=useState(initialSurveyComments);
 const [reportQuestion,setReportQuestion]=useState('Q1: I feel empowered to make decisions in my role');
 const [action,setAction]=useState({title:'Q3 Sales Commission Review & Alignment',owner:'Priya Sharma (HR Director)',due:'2024-11-15',details:'Review Mumbai sales feedback from survey comments, consult finance leads, and publish updated variable incentive tiers.'});
 const [actionPlans,setActionPlans]=useState([]);
 const [toast,setToast]=useState({title:'',message:''});
 const timer=useRef();
 const reportLink=typeof window==='undefined'?'/#/survey-results':window.location.origin+window.location.pathname+'#/survey-results';
 const visibleComments=comments.filter(comment=>commentType==='all'||(commentType==='constructive'?(comment.sentiment==='constructive'||comment.flagged):comment.sentiment===commentType));
 const commentCounts={all:comments.length,positive:comments.filter(comment=>comment.sentiment==='positive').length,neutral:comments.filter(comment=>comment.sentiment==='neutral').length,constructive:comments.filter(comment=>comment.sentiment==='constructive'||comment.flagged).length};
 const summaries={eNPS:{title:'Metric Drill-down: eNPS Score (+58)',description:'Sample Employee Net Promoter Score: +58. Promoters: 72%; detractors: 14%.'},Engagement:{title:'Metric Drill-down: Overall Engagement (88%)',description:'Sample engagement has risen by 4.2% quarter-over-quarter across 1,420 respondents.'},Participation:{title:'Metric Drill-down: Participation Rate (94.2%)',description:'Sample participation: 1,420 of 1,508 employees completed the survey. People Ops participation: 98%.'},Sentiment:{title:'Metric Drill-down: Sentiment',description:'Illustrative sentiment categories from the supplied report. Use the comment filters to inspect the three sample comments.'}};
 const drilldown=summaries[metric]||{title:'Department Inspection: '+metric.replace('comments-',''),description:'Selected sample department: '+metric.replace('comments-','')+'. Supporting charts below retain the supplied illustrative breakdown.'};
 const notify=(title,message)=>{clearTimeout(timer.current);setToast({title,message});timer.current=setTimeout(()=>setToast({title:'',message:''}),4000);};
 const switchState=value=>{setState(value);if(value==='drilldown')setMetric('eNPS');if(value==='participation')setMetric('Participation');};
 const toggleDropdown=()=>setExportMenu(previous=>!previous);
 const openDrawer=setMetric;
 const closeDrawer=()=>setMetric('');
 const openModal=setModal;
 const closeModal=()=>setModal(null);
 const triggerExportToast=(format='PDF',message='')=>{setExportMenu(false);notify(message?'Local preview':format+' export preview',message?'No external HRMS update was sent.':'No file was generated. This is a report preview.');};
 const hideExportToast=()=>setToast({title:'',message:''});
 const filterComments=setCommentType;
 const flagComment=id=>setComments(previous=>previous.map(comment=>comment.id===id?{...comment,flagged:!comment.flagged}:comment));
 const selectDepartmentBar=setMetric;
 const saveActionPlan=()=>{if(!action.title.trim()||!action.owner||!action.due||!action.details.trim()){notify('Action details required','Enter an initiative title, owner, due date, and milestones.');return;}setActionPlans(previous=>[...previous,{...action,title:action.title.trim()}]);closeModal();notify('Action plan saved','Stored in this session only.');};
 const copyReportLink=async()=>{try{await navigator.clipboard.writeText(reportLink);notify('Local report link copied','No secure share token was generated.');closeModal();}catch{notify('Copy unavailable','Select and copy the report link manually.');}};
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 useEffect(()=>{if(['questions','departments','participation'].includes(state))document.getElementById('results-'+state)?.scrollIntoView({behavior:'smooth',block:'start'});},[state]);
 useEffect(()=>{const close=event=>{if(!event.target.closest('#export-menu')&&!event.target.closest('[data-results-export]'))setExportMenu(false);};window.addEventListener('click',close);return()=>window.removeEventListener('click',close);},[]);
 useEffect(()=>{
  const id=modal||(metric?'drilldown-drawer':null);if(!id)return;const dialog=document.getElementById(id),previous=document.activeElement;dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',id.replaceAll('-',' '));const controls=()=>[...dialog.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled);controls()[0]?.focus();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';const keydown=event=>{if(event.key==='Escape'){if(modal)setModal(null);else setMetric('');}if(event.key==='Tab'){const items=controls(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};document.addEventListener('keydown',keydown);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keydown);previous?.focus();};
 },[modal,metric]);
 return (<><Sidebar activePage="survey-results" /><div className="pl-64"><Header /><main className="relative pt-16 bg-surface min-h-screen"><div className="flex flex-col w-full pb-20">

<div className="sticky top-16 z-30 bg-surface-container-lowest/95 backdrop-blur-md px-space-xl py-3 shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex items-center justify-between border-b border-outline-variant/20">
<div className="flex items-center gap-2 overflow-x-auto py-1">
<span className="font-label-caps text-label-caps uppercase tracking-wider text-outline mr-2 shrink-0">State Rig:</span>
<button className={"px-3 py-1.5 rounded-lg font-label-md text-label-md transition-all shrink-0" + (state==='overview' ? ' bg-primary text-on-primary' : '')} id="btn-overview" onClick={event=>{switchState('overview')}}>1. Overview Dashboard</button>
<button className={"px-3 py-1.5 rounded-lg font-label-md text-label-md bg-surface-container-low text-on-surface-variant hover:bg-surface-container transition-all shrink-0" + (state==='drilldown' ? ' bg-primary text-on-primary' : '')} id="btn-drilldown" onClick={event=>{switchState('drilldown')}}>2. Drill-down Drawer</button>
<button className={"px-3 py-1.5 rounded-lg font-label-md text-label-md bg-surface-container-low text-on-surface-variant hover:bg-surface-container transition-all shrink-0" + (state==='questions' ? ' bg-primary text-on-primary' : '')} id="btn-questions" onClick={event=>{switchState('questions')}}>3. Question Breakdown</button>
<button className={"px-3 py-1.5 rounded-lg font-label-md text-label-md bg-surface-container-low text-on-surface-variant hover:bg-surface-container transition-all shrink-0" + (state==='departments' ? ' bg-primary text-on-primary' : '')} id="btn-departments" onClick={event=>{switchState('departments')}}>4. Dept &amp; Comments</button>
<button className={"px-3 py-1.5 rounded-lg font-label-md text-label-md bg-surface-container-low text-on-surface-variant hover:bg-surface-container transition-all shrink-0" + (state==='participation' ? ' bg-primary text-on-primary' : '')} id="btn-participation" onClick={event=>{switchState('participation')}}>5. Participation</button>
<button className="px-3 py-1.5 rounded-lg font-label-md text-label-md bg-surface-container-low text-on-surface-variant hover:bg-surface-container transition-all shrink-0 flex items-center gap-1" onClick={event=>{triggerExportToast()}}><span className="material-symbols-outlined text-sm">download</span>6. Export Toast</button>
<button className={"px-3 py-1.5 rounded-lg font-label-md text-label-md bg-surface-container-low text-on-surface-variant hover:bg-surface-container transition-all shrink-0" + (state==='empty' ? ' bg-primary text-on-primary' : '')} id="btn-empty" onClick={event=>{switchState('empty')}}>7. Empty State</button>
</div>
<div className="hidden lg:flex items-center gap-2 pl-4 border-l border-outline-variant/30 shrink-0">
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-label-caps font-label-caps font-semibold bg-primary/10 text-primary">Q3 Pulse 2024</span>
<span className="text-xs text-outline">Bengaluru HQ</span>
</div>
</div>

<div className="p-space-xl max-w-[1600px] mx-auto w-full space-y-space-xl">

<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
<div>
<div className="flex items-center gap-2 text-outline font-label-caps text-label-caps uppercase tracking-wider mb-1">
<span>Surveys &amp; Analytics Suite</span>
<span>•</span>
<span>Closed 24 Oct 2024</span>
</div>
<h1 className="font-headline-lg text-headline-lg text-on-surface">Q3 Employee Experience &amp; Culture Pulse</h1><p className="text-body-sm text-secondary">Sample survey analytics ? <a href="#/survey-builder" className="hover:underline">Open Survey Builder</a></p>
</div>
<div className="flex items-center gap-3 flex-wrap">
<div className="relative">
<button className="px-4 py-2 bg-surface-container-lowest text-on-surface rounded-lg font-label-lg text-label-lg shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] hover:bg-surface-container-low transition-all flex items-center gap-2" data-results-export onClick={event=>{toggleDropdown('export-menu')}}>
<span className="material-symbols-outlined text-lg text-primary">ios_share</span>
            Export Report
            <span className="material-symbols-outlined text-sm">expand_more</span>
</button>
<div className={"absolute right-0 mt-2 w-48 bg-surface-container-lowest rounded-xl shadow-[0_10px_30px_-4px_rgba(14,43,61,0.12)] border border-outline-variant/30 py-1 z-20" + (exportMenu ? '' : ' hidden')} id="export-menu">
<button className="w-full text-left px-4 py-2 hover:bg-surface-container-low text-body-md flex items-center gap-2" onClick={event=>{triggerExportToast('PDF')}}><span className="material-symbols-outlined text-base text-primary">picture_as_pdf</span>Download PDF</button>
<button className="w-full text-left px-4 py-2 hover:bg-surface-container-low text-body-md flex items-center gap-2" onClick={event=>{triggerExportToast('Excel')}}><span className="material-symbols-outlined text-base text-primary">table_view</span>Export Excel</button>
<button className="w-full text-left px-4 py-2 hover:bg-surface-container-low text-body-md flex items-center gap-2" onClick={event=>{triggerExportToast('CSV')}}><span className="material-symbols-outlined text-base text-primary">csv</span>Download CSV</button>
</div>
</div>
<button className="px-4 py-2 bg-surface-container-lowest text-on-surface rounded-lg font-label-lg text-label-lg shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] hover:bg-surface-container-low transition-all flex items-center gap-2" onClick={event=>{openModal('share-modal')}}>
<span className="material-symbols-outlined text-lg text-primary">share</span>
          Share
        </button>
<button className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-lg text-label-lg shadow-[0_4px_20px_-2px_rgba(14,43,61,0.1)] hover:bg-primary/90 transition-all flex items-center gap-2" onClick={event=>{openModal('action-plan-modal')}}>
<span className="material-symbols-outlined text-lg">add_task</span>
          Create Action Plan
        </button>
</div>
</div>

<div className={"bg-surface-container-lowest rounded-2xl p-12 text-center shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] flex flex-col items-center justify-center min-h-[500px]" + (state==='empty' ? '' : ' hidden')} id="state-empty-container">
<div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-6">
<span className="material-symbols-outlined text-4xl">poll</span>
</div>
<h2 className="font-headline-md text-headline-md text-on-surface mb-2">No Survey Responses Recorded Yet</h2>
<p className="text-body-md text-outline max-w-md mb-8">This survey is currently active or has not received any submissions from Bengaluru or remote hubs. Remind participants or check distribution lists.</p>
<div className="flex gap-4">
<button className="px-5 py-2.5 bg-primary text-on-primary rounded-lg font-label-lg text-label-lg shadow-[0_4px_20px_-2px_rgba(14,43,61,0.1)]" onClick={event=>{openModal('reminder-modal')}}>Send Bulk Reminders</button>
<button className="px-5 py-2.5 bg-surface-container-low text-on-surface rounded-lg font-label-lg text-label-lg" onClick={event=>{switchState('overview')}}>View Demo Data</button>
</div>
</div>

<div className={"space-y-space-xl" + (state!=='empty' ? '' : ' hidden')} id="populated-content"><p className="text-body-sm text-outline">Selected question: {reportQuestion}. Charts retain the supplied sample distributions.</p>{actionPlans.length>0&&<section className="p-5 bg-surface-container-lowest rounded-xl space-y-3"><h3 className="text-headline-sm">Local Action Plans</h3>{actionPlans.map((plan,index)=><div key={index} className="p-3 bg-surface-container-low rounded"><p className="font-semibold">{plan.title}</p><p className="text-body-sm">{plan.owner} · {plan.due}</p><p className="text-body-sm">{plan.details}</p></div>)}</section>}

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-lg">

<div className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] hover:shadow-[0_10px_30px_-4px_rgba(14,43,61,0.12)] transition-all cursor-pointer relative group" onClick={event=>{openDrawer('eNPS')}}>
<div className="flex items-center justify-between mb-4">
<span className="font-label-caps text-label-caps uppercase tracking-wider text-outline">eNPS Score</span>
<span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-on-primary transition-colors"><span className="material-symbols-outlined text-lg">trending_up</span></span>
</div>
<div className="flex items-baseline gap-3 mb-2">
<span className="font-display-sm text-display-sm text-on-surface font-bold">+58</span>
<span className="text-primary font-label-lg text-label-lg flex items-center"><span className="material-symbols-outlined text-sm">arrow_upward</span>+12 vs Q2</span>
</div>
<p className="text-body-sm text-outline">Promoters: 72% | Detractors: 14%</p>
<div className="absolute bottom-2 right-4 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 font-medium">Drill down <span className="material-symbols-outlined text-sm">chevron_right</span></div>
</div>

<div className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] hover:shadow-[0_10px_30px_-4px_rgba(14,43,61,0.12)] transition-all cursor-pointer relative group" onClick={event=>{openDrawer('Engagement')}}>
<div className="flex items-center justify-between mb-4">
<span className="font-label-caps text-label-caps uppercase tracking-wider text-outline">Overall Engagement</span>
<span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-on-primary transition-colors"><span className="material-symbols-outlined text-lg">psychology</span></span>
</div>
<div className="flex items-baseline gap-3 mb-2">
<span className="font-display-sm text-display-sm text-on-surface font-bold">88%</span>
<span className="text-primary font-label-lg text-label-lg flex items-center"><span className="material-symbols-outlined text-sm">arrow_upward</span>+4.2%</span>
</div>
<p className="text-body-sm text-outline">Based on 1,420 responses across 6 hubs</p>
<div className="absolute bottom-2 right-4 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 font-medium">Drill down <span className="material-symbols-outlined text-sm">chevron_right</span></div>
</div>

<div className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] hover:shadow-[0_10px_30px_-4px_rgba(14,43,61,0.12)] transition-all cursor-pointer relative group" onClick={event=>{openDrawer('Participation')}}>
<div className="flex items-center justify-between mb-4">
<span className="font-label-caps text-label-caps uppercase tracking-wider text-outline">Participation Rate</span>
<span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-on-primary transition-colors"><span className="material-symbols-outlined text-lg">group</span></span>
</div>
<div className="flex items-baseline gap-3 mb-2">
<span className="font-display-sm text-display-sm text-on-surface font-bold">94.2%</span>
<span className="text-primary font-label-lg text-label-lg flex items-center"><span className="material-symbols-outlined text-sm">check_circle</span>High</span>
</div>
<p className="text-body-sm text-outline">1,420 of 1,508 employees completed</p>
<div className="absolute bottom-2 right-4 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 font-medium">Drill down <span className="material-symbols-outlined text-sm">chevron_right</span></div>
</div>

<div className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] hover:shadow-[0_10px_30px_-4px_rgba(14,43,61,0.12)] transition-all cursor-pointer relative group" onClick={event=>{openDrawer('Sentiment')}}>
<div className="flex items-center justify-between mb-4">
<span className="font-label-caps text-label-caps uppercase tracking-wider text-outline">AI Sentiment Score</span>
<span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-on-primary transition-colors"><span className="material-symbols-outlined text-lg">auto_awesome</span></span>
</div>
<div className="flex items-baseline gap-3 mb-2">
<span className="font-display-sm text-display-sm text-on-surface font-bold">4.2/5</span>
<span className="text-primary font-label-lg text-label-lg">Very Positive</span>
</div>
<p className="text-body-sm text-outline">Analyzed across 850 open comments</p>
<div className="absolute bottom-2 right-4 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 font-medium">Drill down <span className="material-symbols-outlined text-sm">chevron_right</span></div>
</div>
</div>

<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">

<div className="lg:col-span-8 bg-surface-container-lowest rounded-2xl p-8 shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] flex flex-col justify-between">
<div>
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
<div>
<h3 id="results-questions" className="text-headline-md scroll-mt-24">Question Breakdown &amp; Distribution</h3>
<p className="text-body-sm text-outline">Select a metric to inspect score distributions across departments.</p>
</div>
<select className="px-3 py-2 bg-surface-container-low rounded-lg font-body-sm border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-on-surface" aria-label="Report question" value={reportQuestion} onChange={event=>setReportQuestion(event.target.value)}>
<option>Q1: I feel empowered to make decisions in my role</option>
<option>Q2: My manager provides constructive feedback regularly</option>
<option>Q3: I have adequate growth and learning opportunities</option>
<option>Q4: Compensation and benefits are competitive</option>
</select>
</div>

<div className="space-y-4 my-6">
<div className="group cursor-pointer" onClick={event=>{selectDepartmentBar('Engineering')}}>
<div className="flex justify-between text-body-sm mb-1">
<span className="font-medium text-on-surface group-hover:text-primary transition-colors">Engineering (Bengaluru HQ)</span>
<span className="text-outline font-semibold">92% Positive</span>
</div>
<div className="w-full h-3 bg-surface-container-low rounded-full overflow-hidden flex">
<div className="bg-primary h-full transition-all duration-500" style={{"width":"92%"}}></div>
</div>
</div>
<div className="group cursor-pointer" onClick={event=>{selectDepartmentBar('Product')}}>
<div className="flex justify-between text-body-sm mb-1">
<span className="font-medium text-on-surface group-hover:text-primary transition-colors">Product &amp; Design</span>
<span className="text-outline font-semibold">88% Positive</span>
</div>
<div className="w-full h-3 bg-surface-container-low rounded-full overflow-hidden flex">
<div className="bg-primary h-full transition-all duration-500" style={{"width":"88%"}}></div>
</div>
</div>
<div className="group cursor-pointer" onClick={event=>{selectDepartmentBar('Sales')}}>
<div className="flex justify-between text-body-sm mb-1">
<span className="font-medium text-on-surface group-hover:text-primary transition-colors">Sales &amp; GTM (Mumbai)</span>
<span className="text-outline font-semibold">78% Positive</span>
</div>
<div className="w-full h-3 bg-surface-container-low rounded-full overflow-hidden flex">
<div className="bg-primary h-full transition-all duration-500" style={{"width":"78%"}}></div>
</div>
</div>
<div className="group cursor-pointer" onClick={event=>{selectDepartmentBar('People Ops')}}>
<div className="flex justify-between text-body-sm mb-1">
<span className="font-medium text-on-surface group-hover:text-primary transition-colors">People Operations &amp; HR</span>
<span className="text-outline font-semibold">95% Positive</span>
</div>
<div className="w-full h-3 bg-surface-container-low rounded-full overflow-hidden flex">
<div className="bg-primary h-full transition-all duration-500" style={{"width":"95%"}}></div>
</div>
</div>
<div className="group cursor-pointer" onClick={event=>{selectDepartmentBar('Finance')}}>
<div className="flex justify-between text-body-sm mb-1">
<span className="font-medium text-on-surface group-hover:text-primary transition-colors">Finance &amp; Legal</span>
<span className="text-outline font-semibold">82% Positive</span>
</div>
<div className="w-full h-3 bg-surface-container-low rounded-full overflow-hidden flex">
<div className="bg-primary h-full transition-all duration-500" style={{"width":"82%"}}></div>
</div>
</div>
</div>
</div>
<div className="pt-4 border-t border-outline-variant/20 flex items-center justify-between text-body-sm text-outline">
<span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm text-primary">info</span>Click any bar to open departmental breakdown drawer.</span>
<span className="font-semibold text-on-surface">Scale: 1 to 5 Likert</span>
</div>
</div>

<div className="lg:col-span-4 bg-surface-container-lowest rounded-2xl p-8 shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] flex flex-col justify-between">
<div>
<div className="flex items-center justify-between mb-6">
<h3 id="results-participation" className="text-headline-md scroll-mt-24">Top &amp; Bottom Hubs</h3>
<span className="material-symbols-outlined text-outline">hub</span>
</div>
<div className="space-y-4">
<div className="p-4 bg-surface-container-low rounded-xl">
<div className="flex items-center justify-between mb-1">
<span className="font-label-lg text-label-lg font-semibold text-on-surface">People Operations</span>
<span className="px-2 py-0.5 rounded-full text-label-caps font-semibold bg-primary/10 text-primary">Highest</span>
</div>
<p className="text-body-sm text-outline mb-2">Bengaluru HQ • 98 Responses</p>
<div className="flex items-center justify-between text-sm">
<span className="text-on-surface font-medium">Score: 4.8 / 5.0</span>
<button className="text-primary font-medium hover:underline flex items-center gap-0.5" onClick={event=>{openDrawer('People Ops')}}>Details <span className="material-symbols-outlined text-sm">chevron_right</span></button>
</div>
</div>
<div className="p-4 bg-surface-container-low rounded-xl">
<div className="flex items-center justify-between mb-1">
<span className="font-label-lg text-label-lg font-semibold text-on-surface">Sales &amp; GTM</span>
<span className="px-2 py-0.5 rounded-full text-label-caps font-semibold bg-error/10 text-error">Needs Focus</span>
</div>
<p className="text-body-sm text-outline mb-2">Mumbai Hub • 310 Responses</p>
<div className="flex items-center justify-between text-sm">
<span className="text-on-surface font-medium">Score: 3.6 / 5.0</span>
<button className="text-primary font-medium hover:underline flex items-center gap-0.5" onClick={event=>{openDrawer('Sales')}}>Details <span className="material-symbols-outlined text-sm">chevron_right</span></button>
</div>
</div>
<div className="p-4 bg-surface-container-low rounded-xl">
<div className="flex items-center justify-between mb-1">
<span className="font-label-lg text-label-lg font-semibold text-on-surface">Engineering</span>
<span className="px-2 py-0.5 rounded-full text-label-caps font-semibold bg-primary/10 text-primary">Stable</span>
</div>
<p className="text-body-sm text-outline mb-2">Bengaluru HQ • 640 Responses</p>
<div className="flex items-center justify-between text-sm">
<span className="text-on-surface font-medium">Score: 4.4 / 5.0</span>
<button className="text-primary font-medium hover:underline flex items-center gap-0.5" onClick={event=>{openDrawer('Engineering')}}>Details <span className="material-symbols-outlined text-sm">chevron_right</span></button>
</div>
</div>
</div>
</div>
<button className="w-full mt-6 py-2.5 bg-surface-container-low text-on-surface rounded-lg font-label-lg text-label-lg hover:bg-surface-container transition-all" onClick={event=>{switchState('departments')}}>View All Departments</button>
</div>
</div>

<div className="bg-surface-container-lowest rounded-2xl p-8 shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)]">
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
<div>
<h3 id="results-departments" className="text-headline-md scroll-mt-24">Departmental Scorecard &amp; Comments</h3>
<p className="text-body-sm text-outline">Compare participation, engagement scores, and open comment sentiment across all business units.</p>
</div>
<div className="flex items-center gap-3">
<div className="relative">
<span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-base">search</span>
<input className="pl-9 pr-4 py-2 bg-surface-container-low rounded-lg font-body-sm border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-on-surface" placeholder="Search department..." type="text"/>
</div>
</div>
</div>
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse">
<thead>
<tr className="border-b border-outline-variant/20 text-outline font-label-caps text-label-caps uppercase tracking-wider bg-surface-container-low/50">
<th className="py-3 px-4 rounded-l-lg">Department / Hub</th>
<th className="py-3 px-4">Headcount</th>
<th className="py-3 px-4">Participation</th>
<th className="py-3 px-4">Avg Score</th>
<th className="py-3 px-4">eNPS</th>
<th className="py-3 px-4">Comments</th>
<th className="py-3 px-4 rounded-r-lg text-right">Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-outline-variant/10 font-body-md text-on-surface">
<tr className="hover:bg-surface-container-low/50 transition-colors">
<td className="py-4 px-4 font-semibold flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-primary"></span>Engineering (Bengaluru)</td>
<td className="py-4 px-4 text-outline">680</td>
<td className="py-4 px-4"><span className="text-primary font-medium">96%</span> (652/680)</td>
<td className="py-4 px-4 font-semibold">4.4 / 5.0</td>
<td className="py-4 px-4"><span className="text-primary font-bold">+62</span></td>
<td className="py-4 px-4"><button className="text-primary hover:underline font-medium flex items-center gap-1" onClick={event=>{openDrawer('comments-eng')}}>342 remarks <span className="material-symbols-outlined text-sm">chat</span></button></td>
<td className="py-4 px-4 text-right">
<button className="px-3 py-1 bg-surface-container-low rounded font-label-md text-label-md hover:bg-surface-container" onClick={event=>{openDrawer('Engineering')}}>Inspect</button>
</td>
</tr>
<tr className="hover:bg-surface-container-low/50 transition-colors">
<td className="py-4 px-4 font-semibold flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-primary"></span>Product &amp; Design (Bengaluru)</td>
<td className="py-4 px-4 text-outline">140</td>
<td className="py-4 px-4"><span className="text-primary font-medium">95%</span> (133/140)</td>
<td className="py-4 px-4 font-semibold">4.6 / 5.0</td>
<td className="py-4 px-4"><span className="text-primary font-bold">+70</span></td>
<td className="py-4 px-4"><button className="text-primary hover:underline font-medium flex items-center gap-1" onClick={event=>{openDrawer('comments-prod')}}>88 remarks <span className="material-symbols-outlined text-sm">chat</span></button></td>
<td className="py-4 px-4 text-right">
<button className="px-3 py-1 bg-surface-container-low rounded font-label-md text-label-md hover:bg-surface-container" onClick={event=>{openDrawer('Product')}}>Inspect</button>
</td>
</tr>
<tr className="hover:bg-surface-container-low/50 transition-colors">
<td className="py-4 px-4 font-semibold flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-error"></span>Sales &amp; GTM (Mumbai)</td>
<td className="py-4 px-4 text-outline">350</td>
<td className="py-4 px-4"><span className="text-amber-600 font-medium">88%</span> (308/350)</td>
<td className="py-4 px-4 font-semibold">3.6 / 5.0</td>
<td className="py-4 px-4"><span className="text-amber-600 font-bold">+18</span></td>
<td className="py-4 px-4"><button className="text-primary hover:underline font-medium flex items-center gap-1" onClick={event=>{openDrawer('comments-sales')}}>210 remarks <span className="material-symbols-outlined text-sm">chat</span></button></td>
<td className="py-4 px-4 text-right">
<button className="px-3 py-1 bg-surface-container-low rounded font-label-md text-label-md hover:bg-surface-container" onClick={event=>{openDrawer('Sales')}}>Inspect</button>
</td>
</tr>
<tr className="hover:bg-surface-container-low/50 transition-colors">
<td className="py-4 px-4 font-semibold flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-primary"></span>People Ops &amp; HR (HQ)</td>
<td className="py-4 px-4 text-outline">100</td>
<td className="py-4 px-4"><span className="text-primary font-medium">98%</span> (98/100)</td>
<td className="py-4 px-4 font-semibold">4.8 / 5.0</td>
<td className="py-4 px-4"><span className="text-primary font-bold">+82</span></td>
<td className="py-4 px-4"><button className="text-primary hover:underline font-medium flex items-center gap-1" onClick={event=>{openDrawer('comments-hr')}}>45 remarks <span className="material-symbols-outlined text-sm">chat</span></button></td>
<td className="py-4 px-4 text-right">
<button className="px-3 py-1 bg-surface-container-low rounded font-label-md text-label-md hover:bg-surface-container" onClick={event=>{openDrawer('People Ops')}}>Inspect</button>
</td>
</tr>
</tbody>
</table>
</div>
</div>

<div className="bg-surface-container-lowest rounded-2xl p-8 shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)]">
<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
<div>
<h3 className="font-headline-md text-headline-md text-on-surface">Employee Comments &amp; AI Sentiment Stream</h3>
<p className="text-body-sm text-outline">Direct qualitative feedback categorized with AI sentiment tagging.</p>
</div>

<div className="flex items-center gap-2 flex-wrap">
<button className={"px-3 py-1.5 rounded-full text-label-md font-label-md transition-all" + (commentType==='all' ? ' bg-primary text-on-primary' : '')} id="chip-all" onClick={()=>filterComments('all')}>{commentCounts.all} All</button>
<button className={"px-3 py-1.5 rounded-full text-label-md font-label-md bg-surface-container-low text-on-surface-variant hover:bg-surface-container transition-all" + (commentType==='positive' ? ' bg-primary text-on-primary' : '')} id="chip-positive" onClick={()=>filterComments('positive')}>{commentCounts.positive} Positive</button>
<button className={"px-3 py-1.5 rounded-full text-label-md font-label-md bg-surface-container-low text-on-surface-variant hover:bg-surface-container transition-all" + (commentType==='neutral' ? ' bg-primary text-on-primary' : '')} id="chip-neutral" onClick={()=>filterComments('neutral')}>{commentCounts.neutral} Neutral</button>
<button className={"px-3 py-1.5 rounded-full text-label-md font-label-md bg-surface-container-low text-on-surface-variant hover:bg-surface-container transition-all" + (commentType==='constructive' ? ' bg-primary text-on-primary' : '')} id="chip-constructive" onClick={()=>filterComments('constructive')}>{commentCounts.constructive} Constructive / Flagged</button>
</div>
</div>
<div className="space-y-4"><SurveyCommentStream comments={visibleComments} onFlag={flagComment}/></div>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 overflow-hidden" + (Boolean(metric) ? '' : ' hidden')} id="drilldown-drawer">
<div className="absolute inset-0 bg-[#0E2B3D]/40 backdrop-blur-sm transition-opacity" onClick={event=>{closeDrawer()}}></div>
<div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
<div className="w-screen max-w-xl bg-surface-container-lowest shadow-2xl flex flex-col justify-between">
<div className="p-6 border-b border-outline-variant/20 flex items-center justify-between">
<div className="flex items-center gap-3">
<span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg" id="drawer-icon">📈</span>
<div>
<h2 className="font-headline-md text-headline-md text-on-surface" id="drawer-title">{drilldown.title}</h2>
<p className="text-body-sm text-outline">Detailed telemetry and historical benchmark comparison</p>
</div>
</div>
<button className="p-2 text-outline hover:text-on-surface rounded-lg" onClick={event=>{closeDrawer()}}><span className="material-symbols-outlined">close</span></button>
</div>
<div className="flex-1 overflow-y-auto p-6 space-y-6">
<div className="p-4 bg-surface-container-low rounded-xl">
<h4 className="font-label-lg text-label-lg font-semibold text-on-surface mb-2">Executive Summary</h4>
<p className="text-body-md text-on-surface-variant" id="drawer-desc">{drilldown.description}</p>
</div>
<div>
<h4 className="font-label-lg text-label-lg font-semibold text-on-surface mb-3">Breakdown by Tenure</h4>
<div className="space-y-3">
<div>
<div className="flex justify-between text-sm mb-1"><span>0 - 1 Year Tenure</span><span className="font-semibold">+65 eNPS</span></div>
<div className="w-full h-2.5 bg-surface-container-low rounded-full overflow-hidden"><div className="bg-primary h-full" style={{"width":"85%"}}></div></div>
</div>
<div>
<div className="flex justify-between text-sm mb-1"><span>1 - 3 Years Tenure</span><span className="font-semibold">+52 eNPS</span></div>
<div className="w-full h-2.5 bg-surface-container-low rounded-full overflow-hidden"><div className="bg-primary h-full" style={{"width":"70%"}}></div></div>
</div>
<div>
<div className="flex justify-between text-sm mb-1"><span>3+ Years Tenure</span><span className="font-semibold">+56 eNPS</span></div>
<div className="w-full h-2.5 bg-surface-container-low rounded-full overflow-hidden"><div className="bg-primary h-full" style={{"width":"78%"}}></div></div>
</div>
</div>
</div>
<div>
<h4 className="font-label-lg text-label-lg font-semibold text-on-surface mb-3">AI Recommendations</h4>
<div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-2">
<div className="flex items-start gap-2">
<span className="material-symbols-outlined text-primary text-base mt-0.5">auto_awesome</span>
<p className="text-body-sm text-on-surface">Schedule focus groups with Mumbai Sales leadership to address commission structure feedback before Q4 payroll runs.</p>
</div>
</div>
</div>
</div>
<div className="p-6 border-t border-outline-variant/20 flex justify-end gap-3">
<button className="px-4 py-2 bg-surface-container-low text-on-surface rounded-lg font-label-lg text-label-lg" onClick={event=>{closeDrawer()}}>Close</button>
<button className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-lg text-label-lg" onClick={event=>{openModal('action-plan-modal'); closeDrawer();}}>Create Action Plan</button>
</div>
</div>
</div>
</div>

<div className={"fixed bottom-6 right-6 z-50 transform  transition-all duration-300 bg-[#0E2B3D] text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 border border-white/10" + (toast.title ? '' : ' translate-y-20 opacity-0 pointer-events-none')} id="export-toast" role="status">
<div className="w-8 h-8 rounded-full bg-[#1CCA9B]/20 text-[#1CCA9B] flex items-center justify-center">
<span className="material-symbols-outlined text-lg">check</span>
</div>
<div>
<h5 className="font-label-lg text-label-lg font-semibold" id="toast-title">Report exported successfully</h5>
<p className="text-body-sm text-white/70" id="toast-desc">{toast.message}</p>
</div>
<button className="text-white/50 hover:text-white ml-4" onClick={event=>{hideExportToast()}}><span className="material-symbols-outlined text-sm">close</span></button>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center p-4" + (modal==='action-plan-modal' ? '' : ' hidden')} id="action-plan-modal">
<div className="absolute inset-0 bg-[#0E2B3D]/40 backdrop-blur-sm" onClick={event=>{closeModal('action-plan-modal')}}></div>
<div className="relative bg-surface-container-lowest rounded-2xl max-w-xl w-full p-8 shadow-2xl z-10 space-y-6">
<div className="flex items-center justify-between">
<h3 className="font-headline-md text-headline-md text-on-surface">Create Survey Action Plan</h3>
<button className="text-outline hover:text-on-surface" onClick={event=>{closeModal('action-plan-modal')}}><span className="material-symbols-outlined">close</span></button>
</div>
<div className="space-y-4">
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">Initiative Title</label>
<input className="w-full px-4 py-2.5 bg-surface-container-low rounded-lg font-body-md border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-on-surface" type="text"  aria-label="Action title" value={action.title} onChange={event=>setAction(previous=>({...previous,title:event.target.value}))} />
</div>
<div className="grid grid-cols-2 gap-4">
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">Owner / Lead</label>
<select className="w-full px-4 py-2.5 bg-surface-container-low rounded-lg font-body-md border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-on-surface" aria-label="Action owner" value={action.owner} onChange={event=>setAction(previous=>({...previous,owner:event.target.value}))}>
<option>Priya Sharma (HR Director)</option>
<option>Rahul Verma (VP Sales)</option>
<option>Ananya Roy (People Ops)</option>
</select>
</div>
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">Target Completion</label>
<input className="w-full px-4 py-2.5 bg-surface-container-low rounded-lg font-body-md border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-on-surface" type="date"  aria-label="Action due" value={action.due} onChange={event=>setAction(previous=>({...previous,due:event.target.value}))} />
</div>
</div>
<div>
<label className="block font-label-md text-label-md font-semibold text-on-surface mb-1">Action Details &amp; Milestones</label>
<textarea className="w-full px-4 py-2.5 bg-surface-container-low rounded-lg font-body-md border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-on-surface" rows="3" aria-label="Action details" value={action.details} onChange={event=>setAction(previous=>({...previous,details:event.target.value}))} />
</div>
</div>
<div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/20">
<button className="px-5 py-2.5 bg-surface-container-low text-on-surface rounded-lg font-label-lg text-label-lg" onClick={event=>{closeModal('action-plan-modal')}}>Cancel</button>
<button className="px-5 py-2.5 bg-primary text-on-primary rounded-lg font-label-lg text-label-lg" onClick={event=>{saveActionPlan();}}>Publish Action Plan</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center p-4" + (modal==='share-modal' ? '' : ' hidden')} id="share-modal">
<div className="absolute inset-0 bg-[#0E2B3D]/40 backdrop-blur-sm" onClick={event=>{closeModal('share-modal')}}></div>
<div className="relative bg-surface-container-lowest rounded-2xl max-w-md w-full p-6 shadow-2xl z-10 space-y-4">
<div className="flex items-center justify-between">
<h3 className="font-headline-md text-headline-md text-on-surface">Share Survey Report</h3>
<button className="text-outline hover:text-on-surface" onClick={event=>{closeModal('share-modal')}}><span className="material-symbols-outlined">close</span></button>
</div>
<p className="text-body-sm text-outline">Copy a link to this local report preview.</p>
<div className="flex gap-2">
<input className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-body-sm border border-outline-variant/30 text-on-surface" readOnly type="text" value={reportLink} aria-label="Local report link"/>
<button className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md shrink-0" onClick={event=>{copyReportLink();}}>Copy</button>
</div>
</div>
</div>
</div>
</main>{modal==="reminder-modal"&&<div id="reminder-modal" className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"><div className="bg-surface p-6 rounded-xl space-y-4"><h3 className="text-headline-sm">Reminder Preview</h3><p>This local preview does not send employee messages.</p><button onClick={()=>{closeModal();notify("Reminder preview saved","No email or message was sent.");}} className="p-2 bg-primary text-on-primary rounded">Save Reminder Preview</button><button onClick={closeModal} className="ml-3">Cancel</button></div></div>}</div></>);
}
