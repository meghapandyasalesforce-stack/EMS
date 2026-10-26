import { useEffect, useRef, useState } from 'react';
import { Sidebar, Header } from './Layout.jsx';
import { initialSurveyQuestions } from './surveyData.js';
import { initialSurveySettings } from './surveySettings.js';
import { SurveyQuestionEditor, SurveyPreview, SurveyLogic } from './SurveyComponents.jsx';
export default function SurveyBuilder() {
 const [tab,setTab]=useState('details');
 const [settings,setSettings]=useState(initialSurveySettings);
 const [questions,setQuestions]=useState(initialSurveyQuestions);
 const [questionMenu,setQuestionMenu]=useState(false);
 const [modal,setModal]=useState(null);
 const [logicId,setLogicId]=useState(1);
 const [deleteId,setDeleteId]=useState(null);
 const [audience,setAudience]=useState('0');
 const [reminder,setReminder]=useState('smart');
 const [savedDraft,setSavedDraft]=useState(null);
 const [published,setPublished]=useState(false);
 const [responses,setResponses]=useState(null);
 const [toast,setToast]=useState('');
 const timer=useRef();
 const setSetting=(key,value)=>setSettings(previous=>({...previous,[key]:value}));
 const showToast=message=>{clearTimeout(timer.current);setToast(message);timer.current=setTimeout(()=>setToast(''),3000);};
 const switchTab=setTab;
 const toggleDropdown=()=>setQuestionMenu(previous=>!previous);
 const openPublishModal=()=>setModal('publish');
 const closePublishModal=()=>setModal(null);
 const confirmPublish=()=>{if(!settings.field1.trim()||!questions.length||questions.some(question=>!question.prompt.trim()||(question.type==='Multiple Choice'&&question.options.filter(option=>option.trim()).length<2)||(question.type==='Matrix'&&!question.options.some(option=>option.trim())))){showToast('Add a survey title and at least one question with a prompt.');return;}if(settings.field6&&settings.field7&&settings.field7<=settings.field6){showToast('Close date must follow the start date.');return;}setPublished(true);setSavedDraft({settings,questions,audience,reminder});setModal(null);setTab('success');showToast('Survey published as a local preview. No invitations were sent.');};
 const saveDraft=()=>{setSavedDraft({settings,questions,audience,reminder});showToast('Draft saved for this session.');};
 const openLogicModal=id=>{setLogicId(id);setModal('logic');};
 const closeLogicModal=()=>setModal(null);
 const updateQuestion=(id,patch)=>setQuestions(previous=>previous.map(question=>question.id===id?{...question,...patch}:question));
 const addQuestionCard=type=>{setQuestions(previous=>[...previous,{id:Math.max(0,...previous.map(question=>question.id))+1,type,prompt:'New '+type+' question',required:true,options:type==='Multiple Choice'?['Option 1','Option 2']:type==='Matrix'?['Communication','Resources']:[]}]);setQuestionMenu(false);};
 const duplicateCard=id=>setQuestions(previous=>{const index=previous.findIndex(question=>question.id===id);const copy={...previous[index],id:Math.max(...previous.map(question=>question.id))+1,options:[...previous[index].options],logic:null};return [...previous.slice(0,index+1),copy,...previous.slice(index+1)];});
 const deleteCard=id=>{setDeleteId(id);setModal('delete');};
 const confirmDelete=()=>{setQuestions(previous=>previous.filter(question=>question.id!==deleteId).map(question=>question.logic?.target===deleteId?{...question,logic:null}:question));setModal(null);};
 const moveQuestion=(id,delta)=>setQuestions(previous=>{const next=[...previous],index=next.findIndex(question=>question.id===id),target=index+delta;if(target<0||target>=next.length)return previous;[next[index],next[target]]=[next[target],next[index]];return next.map(question=>({...question,logic:null}));});
 const saveLogic=rule=>{updateQuestion(logicId,{logic:rule});setModal(null);showToast('Question skip rule saved locally.');};
 const selectAudienceType=setAudience;
 const finishPreview=answers=>{setResponses(answers);setTab('thankyou');};
 const copySurveyLink=async()=>{const link=window.location.origin+window.location.pathname+'#/survey-builder';try{await navigator.clipboard.writeText(link);showToast('Local builder link copied.');}catch{showToast('Copy is unavailable. Use the builder URL in your address bar.');}};
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 useEffect(()=>{
  if(!modal)return;const dialog=document.getElementById(modal==='publish'?'publish-modal':modal==='logic'?'logic-modal':'delete-question-modal'),previous=document.activeElement;dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',modal+' survey dialog');const controls=()=>[...dialog.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled);controls()[0]?.focus();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';const keydown=event=>{if(event.key==='Escape')setModal(null);if(event.key==='Tab'){const items=controls(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};document.addEventListener('keydown',keydown);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keydown);previous?.focus();};
 },[modal]);
 return (<><Sidebar activePage="survey-builder" /><div className="pl-64"><Header /><main className="relative pt-16 bg-surface min-h-screen"><div className="flex flex-col w-full min-h-screen bg-surface pb-24">

<div className="sticky top-16 z-30 bg-surface-container-lowest/90 backdrop-blur-md px-space-xl py-space-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex items-center justify-between border-b border-outline-variant/10">
<div className="flex items-center gap-space-sm overflow-x-auto">
<span className="font-label-caps text-label-caps uppercase tracking-wider text-outline mr-2">Simulator:</span>
<button className={"px-3 py-1.5 rounded-lg font-label-md text-label-md transition-all whitespace-nowrap" + (tab==='details' ? ' bg-primary text-on-primary shadow-sm' : '')} id="tab-details" onClick={event=>{switchTab('details')}}>1. Survey Details</button>
<button className={"px-3 py-1.5 rounded-lg font-label-md text-label-md bg-surface-container-low text-on-surface hover:bg-surface-container transition-all whitespace-nowrap" + (tab==='questions' ? ' bg-primary text-on-primary shadow-sm' : '')} id="tab-questions" onClick={event=>{switchTab('questions')}}>2. Question Menu</button>
<button className={"px-3 py-1.5 rounded-lg font-label-md text-label-md bg-surface-container-low text-on-surface hover:bg-surface-container transition-all whitespace-nowrap" + (tab==='audience' ? ' bg-primary text-on-primary shadow-sm' : '')} id="tab-audience" onClick={event=>{switchTab('audience')}}>3. Audience Modal</button>
<button className={"px-3 py-1.5 rounded-lg font-label-md text-label-md bg-surface-container-low text-on-surface hover:bg-surface-container transition-all whitespace-nowrap" + (tab==='schedule' ? ' bg-primary text-on-primary shadow-sm' : '')} id="tab-schedule" onClick={event=>{switchTab('schedule')}}>4. Schedule</button>
<button className={"px-3 py-1.5 rounded-lg font-label-md text-label-md bg-surface-container-low text-on-surface hover:bg-surface-container transition-all whitespace-nowrap" + (tab==='preview' ? ' bg-primary text-on-primary shadow-sm' : '')} id="tab-preview" onClick={event=>{switchTab('preview')}}>5. Respondent Preview</button>
<button className={"px-3 py-1.5 rounded-lg font-label-md text-label-md bg-surface-container-low text-on-surface hover:bg-surface-container transition-all whitespace-nowrap" + (tab==='thankyou' ? ' bg-primary text-on-primary shadow-sm' : '')} id="tab-thankyou" onClick={event=>{switchTab('thankyou')}}>6. Thank You Screen</button>
<button className={"px-3 py-1.5 rounded-lg font-label-md text-label-md bg-surface-container-low text-on-surface hover:bg-surface-container transition-all whitespace-nowrap" + (tab==='success' ? ' bg-primary text-on-primary shadow-sm' : '')} id="tab-success" onClick={event=>{switchTab('success')}}>7. Publish Success</button>
</div>
<div className="flex items-center gap-space-sm">
<button className="px-3 py-1.5 rounded-lg font-label-md text-label-md bg-surface-container-low text-on-surface hover:bg-surface-container transition-all flex items-center gap-1.5" onClick={event=>{saveDraft()}}>
<span className="material-symbols-outlined text-base">save</span> Save Draft
      </button>
<button className="px-3 py-1.5 rounded-lg font-label-md text-label-md bg-[#00694f] text-white hover:bg-[#00513c] transition-all flex items-center gap-1.5 shadow-sm" onClick={event=>{openPublishModal()}}>
<span className="material-symbols-outlined text-base">publish</span> Publish
      </button>
</div>
</div>

<div className="max-w-7xl mx-auto w-full px-space-xl py-space-xl grid grid-cols-12 gap-space-xl">

<div className="col-span-12 lg:col-span-8 space-y-space-xl">

<div className={"survey-section bg-surface-container-lowest rounded-2xl p-space-xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] space-y-space-lg" + (tab==='details' ? '' : ' hidden')} id="section-details">
<div className="flex items-center justify-between">
<div>
<h2 className="font-headline-lg text-headline-lg text-on-surface">Survey Configuration</h2>
<p className="font-body-md text-body-md text-outline">Define core parameters for your organizational pulse or feedback instrument.</p>
</div>
<span className="px-3 py-1 rounded-full text-label-caps font-label-caps font-semibold bg-[#89f7ce]/30 text-[#00513c]">Active Studio</span>
</div>
<div className="space-y-space-md">
<div>
<label className="block font-label-lg text-label-lg text-on-surface mb-1.5">Survey Title</label>
<input className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-[#00694f]" type="text"  aria-label="Survey Title" value={settings.field1} onChange={event=>setSetting('field1',event.target.value)} />
</div>
<div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
<div>
<label className="block font-label-lg text-label-lg text-on-surface mb-1.5">Survey Type</label>
<select className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-[#00694f]" aria-label="Survey Type" value={settings.field2} onChange={event=>setSetting('field2',event.target.value)}>
<option>Pulse Survey</option>
<option>Annual Engagement</option>
<option>Manager Feedback</option>
<option>Exit Interview</option>
</select>
</div>
<div>
<label className="block font-label-lg text-label-lg text-on-surface mb-1.5">Target Business Unit</label>
<select className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-[#00694f]" aria-label="Target Business Unit" value={settings.field3} onChange={event=>setSetting('field3',event.target.value)}>
<option>All India Tech Centers (BLR, HYD, DEL)</option>
<option>Product Development Only</option>
<option>Executive Leadership</option>
</select>
</div>
</div>
<div>
<label className="block font-label-lg text-label-lg text-on-surface mb-1.5">Description &amp; Objective</label>
<textarea className="w-full p-3 bg-surface border border-outline-variant rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-[#00694f]" rows="3" aria-label="Description & Objective" value={settings.field4} onChange={event=>setSetting('field4',event.target.value)} />
</div>
<div className="p-space-md bg-surface-container-low rounded-xl flex items-center justify-between">
<div className="flex items-center gap-space-md">
<div className="w-10 h-10 rounded-lg bg-[#89f7ce]/30 flex items-center justify-center text-[#00513c]">
<span className="material-symbols-outlined">visibility_off</span>
</div>
<div>
<p className="font-title-md text-title-md text-on-surface">Anonymous Responses</p>
<p className="font-body-sm text-body-sm text-outline">Hide respondent names and emails in analytics dashboards.</p>
</div>
</div>
<label className="relative inline-flex items-center cursor-pointer">
<input  className="sr-only peer" type="checkbox" aria-label="Anonymous responses" checked={Boolean(settings.field5)} onChange={event=>setSetting('field5',event.target.checked)} />
<div className="w-11 h-6 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00694f]"></div>
</label>
</div>
</div>
</div>

<div className={"survey-section bg-surface-container-lowest rounded-2xl p-space-xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] space-y-space-lg" + (tab==='questions' ? '' : ' hidden')} id="section-questions">
<div className="flex items-center justify-between">
<div>
<h2 className="font-headline-lg text-headline-lg text-on-surface">Questionnaire Builder</h2>
<p className="font-body-md text-body-md text-outline">Compose, structure, and configure logic rules for your survey items.</p>
</div>
<div className="relative">
<button className="px-4 py-2 bg-[#00694f] text-white rounded-lg font-label-md text-label-md hover:bg-[#00513c] transition-all flex items-center gap-2 shadow-sm" onClick={event=>{toggleDropdown('add-question-menu')}}>
<span className="material-symbols-outlined text-base">add</span> Add Question <span className="material-symbols-outlined text-base">expand_more</span>
</button>
<div className={"absolute right-0 mt-2 w-56 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/30 py-2 z-20" + (questionMenu ? '' : ' hidden')} id="add-question-menu">
<a className="flex items-center gap-3 px-4 py-2 text-on-surface hover:bg-surface-container-low font-body-md" href="#" onClick={event=>{addQuestionCard('Rating')}}><span className="material-symbols-outlined text-[#00694f]">star</span> Rating Scale (1-5)</a>
<a className="flex items-center gap-3 px-4 py-2 text-on-surface hover:bg-surface-container-low font-body-md" href="#" onClick={event=>{addQuestionCard('Multiple Choice')}}><span className="material-symbols-outlined text-[#00694f]">radio_button_checked</span> Multiple Choice</a>
<a className="flex items-center gap-3 px-4 py-2 text-on-surface hover:bg-surface-container-low font-body-md" href="#" onClick={event=>{addQuestionCard('eNPS')}}><span className="material-symbols-outlined text-[#00694f]">recommend</span> eNPS (0-10)</a>
<a className="flex items-center gap-3 px-4 py-2 text-on-surface hover:bg-surface-container-low font-body-md" href="#" onClick={event=>{addQuestionCard('Text')}}><span className="material-symbols-outlined text-[#00694f]">notes</span> Open Text</a>
<a className="flex items-center gap-3 px-4 py-2 text-on-surface hover:bg-surface-container-low font-body-md" href="#" onClick={event=>{addQuestionCard('Matrix')}}><span className="material-symbols-outlined text-[#00694f]">grid_view</span> Matrix Grid</a>
</div>
</div>
</div>

<div className="space-y-space-md" id="questions-list">{questions.map((question,index)=><SurveyQuestionEditor key={question.id} question={question} index={index} count={questions.length} onChange={updateQuestion} onDuplicate={duplicateCard} onDelete={deleteCard} onMove={moveQuestion} onLogic={openLogicModal}/>)}</div>
</div>

<div className={"survey-section bg-surface-container-lowest rounded-2xl p-space-xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] space-y-space-lg" + (tab==='audience' ? '' : ' hidden')} id="section-audience">
<div>
<h2 className="font-headline-lg text-headline-lg text-on-surface">Audience &amp; Target Reach</h2>
<p className="font-body-md text-body-md text-outline">Select target groups, departments, or upload custom CSV recipient lists.</p>
</div>
<div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
<div className={"cursor-pointer p-space-md rounded-xl border-2 space-y-2" + (audience==='0' ? ' border-primary bg-primary/5' : ' border-outline-variant/40')} role="button" tabIndex={0} onKeyDown={event=>{if(event.key==='Enter'||event.key===' ')setAudience('0');}} data-audience="0" onClick={event=>selectAudienceType(event.currentTarget.dataset.audience)}>
<span className="material-symbols-outlined text-[#00694f] text-2xl">groups</span>
<p className="font-title-md text-title-md text-on-surface">All Employees</p>
<p className="font-body-sm text-body-sm text-outline">Full active employee roster across all regional branches.</p>
</div>
<div className={"cursor-pointer p-space-md rounded-xl border-2 hover:border-[#00694f] bg-surface space-y-2" + (audience==='1' ? ' border-primary bg-primary/5' : ' border-outline-variant/40')} role="button" tabIndex={0} onKeyDown={event=>{if(event.key==='Enter'||event.key===' ')setAudience('1');}} data-audience="1" onClick={event=>selectAudienceType(event.currentTarget.dataset.audience)}>
<span className="material-symbols-outlined text-outline text-2xl">domain</span>
<p className="font-title-md text-title-md text-on-surface">Specific Departments</p>
<p className="font-body-sm text-body-sm text-outline">Engineering, Product, QA, and Design divisions.</p>
</div>
<div className={"cursor-pointer p-space-md rounded-xl border-2 hover:border-[#00694f] bg-surface space-y-2" + (audience==='2' ? ' border-primary bg-primary/5' : ' border-outline-variant/40')} role="button" tabIndex={0} onKeyDown={event=>{if(event.key==='Enter'||event.key===' ')setAudience('2');}} data-audience="2" onClick={event=>selectAudienceType(event.currentTarget.dataset.audience)}>
<span className="material-symbols-outlined text-outline text-2xl">upload_file</span>
<p className="font-title-md text-title-md text-on-surface">Upload CSV List</p>
<p className="font-body-sm text-body-sm text-outline">Import direct employee ID/email mapping file.</p>
</div>
</div>

<div className="p-space-lg bg-[#0E2B3D] text-white rounded-2xl flex items-center justify-between shadow-lg">
<div className="space-y-1">
<div className="flex items-center gap-2">
<span className="h-2.5 w-2.5 rounded-full bg-[#1CCA9B] animate-pulse"></span>
<span className="font-label-caps text-label-caps tracking-wider text-[#1CCA9B]">Live Recipient Engine</span>
</div>
<h3 className="font-headline-md text-headline-md text-white">Target Population Calculated</h3>
<p className="font-body-sm text-body-sm text-white/70">Filtered by active status, Indian payroll region, and permanent contract type.</p>
</div>
<div className="text-right">
<span className="font-display-lg text-display-lg text-[#1CCA9B]">1,420</span>
<p className="font-label-caps text-label-caps text-white/60">Total Recipients</p>
</div>
</div>
<div className="space-y-space-sm">
<label className="block font-label-lg text-label-lg text-on-surface">Included Departments</label>
<div className="flex flex-wrap gap-2">
<span className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface font-label-md flex items-center gap-2">Engineering (840) <button className="text-outline hover:text-error">×</button></span>
<span className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface font-label-md flex items-center gap-2">Product &amp; Design (310) <button className="text-outline hover:text-error">×</button></span>
<span className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface font-label-md flex items-center gap-2">Quality Assurance (270) <button className="text-outline hover:text-error">×</button></span>
<button className="px-3 py-1.5 rounded-lg border border-dashed border-outline text-[#00694f] font-label-md hover:bg-surface-container-low">+ Add Department</button>
</div>
</div>
</div>

<div className={"survey-section bg-surface-container-lowest rounded-2xl p-space-xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] space-y-space-lg" + (tab==='schedule' ? '' : ' hidden')} id="section-schedule">
<div>
<h2 className="font-headline-lg text-headline-lg text-on-surface">Campaign Schedule &amp; Reminders</h2>
<p className="font-body-md text-body-md text-outline">Set activation window and automated Slack/Email reminder cadence.</p>
</div>
<div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
<div>
<label className="block font-label-lg text-label-lg text-on-surface mb-1.5">Start Date &amp; Time</label>
<input className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-[#00694f]" type="datetime-local"  aria-label="Start Date & Time" value={settings.field6} onChange={event=>setSetting('field6',event.target.value)} />
</div>
<div>
<label className="block font-label-lg text-label-lg text-on-surface mb-1.5">Close Date &amp; Time</label>
<input className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-[#00694f]" type="datetime-local"  aria-label="Close Date & Time" value={settings.field7} onChange={event=>setSetting('field7',event.target.value)} />
</div>
</div>
<div className="space-y-space-sm">
<label className="block font-label-lg text-label-lg text-on-surface">Automated Reminder Frequency</label>
<div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
<label className="p-space-md rounded-xl border border-[#00694f] bg-[#00694f]/5 flex items-center gap-3 cursor-pointer">
<input  className="text-[#00694f] focus:ring-[#00694f]" name="reminder" type="radio" aria-label="Automated Reminder Frequency"  checked={reminder==='smart'} onChange={()=>setReminder('smart')} />
<div>
<p className="font-title-md text-title-md text-on-surface">Smart Reminders</p>
<p className="font-body-sm text-body-sm text-outline">Sent 48h before close to unsubmitted users.</p>
</div>
</label>
<label className="p-space-md rounded-xl border border-outline-variant/40 bg-surface flex items-center gap-3 cursor-pointer">
<input className="text-[#00694f] focus:ring-[#00694f]" name="reminder" type="radio" aria-label="Smart Reminders Sent 48h before close to unsubmitted users."  checked={reminder==='threeDays'} onChange={()=>setReminder('threeDays')} />
<div>
<p className="font-title-md text-title-md text-on-surface">Every 3 Days</p>
<p className="font-body-sm text-body-sm text-outline">Continuous gentle nudges via Slack.</p>
</div>
</label>
<label className="p-space-md rounded-xl border border-outline-variant/40 bg-surface flex items-center gap-3 cursor-pointer">
<input className="text-[#00694f] focus:ring-[#00694f]" name="reminder" type="radio" aria-label="Every 3 Days Continuous gentle nudges via Slack."  checked={reminder==='manual'} onChange={()=>setReminder('manual')} />
<div>
<p className="font-title-md text-title-md text-on-surface">Manual Only</p>
<p className="font-body-sm text-body-sm text-outline">No automated trigger emails sent.</p>
</div>
</label>
</div>
</div>
</div>

<div className={"survey-section bg-surface-container-lowest rounded-2xl p-space-xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] space-y-space-lg border-2 border-dashed border-[#00694f]/40" + (tab==='preview' ? '' : ' hidden')} id="section-preview"><SurveyPreview title={settings.field1} questions={questions} onComplete={finishPreview} /></div>

<div className={"survey-section bg-surface-container-lowest rounded-2xl p-space-xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] text-center space-y-space-lg py-12" + (tab==='thankyou' ? '' : ' hidden')} id="section-thankyou">
<div className="w-16 h-16 bg-[#89f7ce]/30 text-[#00513c] rounded-full flex items-center justify-center mx-auto text-3xl">
<span className="material-symbols-outlined text-4xl">check_circle</span>
</div>
<div className="space-y-2 max-w-md mx-auto">
<h3 className="font-headline-lg text-headline-lg text-on-surface">Thank You for Your Feedback!</h3>
<p className="font-body-md text-body-md text-outline">Your preview responses are stored in memory for this session. Aggregated insights will be shared with engineering leadership in next Monday's town hall.</p>
</div>
<button className="px-6 py-2.5 rounded-lg bg-[#00694f] text-white font-label-md hover:bg-[#00513c]" onClick={event=>{switchTab('success')}}>Simulate Completion &amp; Exit</button>
</div>

<div className={"survey-section bg-surface-container-lowest rounded-2xl p-space-xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] text-center space-y-space-lg py-12" + (tab==='success' ? '' : ' hidden')} id="section-success">
<div className="w-16 h-16 bg-[#00694f] text-white rounded-full flex items-center justify-center mx-auto">
<span className="material-symbols-outlined text-3xl">rocket_launch</span>
</div>
<div className="space-y-2 max-w-md mx-auto">
<h3 className="font-headline-lg text-headline-lg text-on-surface">Survey Successfully Published!</h3>
<p className="font-body-md text-body-md text-outline">This survey was published as a local preview. No employee notifications were sent.</p>
</div>
<div className="flex items-center justify-center gap-3 max-w-md mx-auto">
<input className="flex-1 h-10 px-3 bg-surface border border-outline-variant rounded-lg text-body-sm text-outline font-mono" readOnly type="text"  aria-label="Local builder link" value="/#/survey-builder"  />
<button className="px-4 py-2 bg-[#00694f] text-white rounded-lg font-label-md hover:bg-[#00513c] flex items-center gap-1.5 whitespace-nowrap" onClick={event=>{copySurveyLink()}}>
<span className="material-symbols-outlined text-base">content_copy</span> Copy Link
          </button>
</div>
<div className="flex justify-center gap-4 pt-4">
<button className="px-4 py-2 rounded-lg border border-outline-variant text-on-surface font-label-md" onClick={event=>{switchTab('details')}}>Back to Editor</button>
<a className="px-4 py-2 rounded-lg bg-[#0E2B3D] text-white font-label-md hover:bg-[#16384C]" href="#">View Analytics Dashboard</a>
</div>
</div>
</div>

<div className="col-span-12 lg:col-span-4 space-y-space-lg">

<div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] space-y-space-md">
<div className="flex items-center justify-between">
<h3 className="font-title-md text-title-md text-on-surface flex items-center gap-2">
<span className="material-symbols-outlined text-[#00694f]">tune</span> Studio Inspector
          </h3>
<span className="font-label-caps text-label-caps text-outline">v2.4 Live</span>
</div>
<div className="space-y-3 pt-2">
<div className="flex justify-between py-2 border-b border-outline-variant/10 font-body-sm">
<span className="text-outline">Estimated Completion Time</span>
<span className="font-semibold text-on-surface">3.5 Minutes</span>
</div>
<div className="flex justify-between py-2 border-b border-outline-variant/10 font-body-sm">
<span className="text-outline">Total Questions</span>
<span className="font-semibold text-on-surface">3 Items</span>
</div>
<div className="flex justify-between py-2 border-b border-outline-variant/10 font-body-sm">
<span className="text-outline">Anonymity Standard</span>
<span className="font-semibold text-[#00694f]">Strict Enterprise</span>
</div>
<div className="flex justify-between py-2 font-body-sm">
<span className="text-outline">Target Reach</span>
<span className="font-semibold text-on-surface">1,420 Recipients</span>
</div>
</div>
</div>

<div className="bg-[#0E2B3D] text-white rounded-2xl p-space-lg shadow-xl space-y-space-md relative overflow-hidden">
<div className="absolute -right-6 -bottom-6 w-32 h-32 bg-[#1CCA9B]/10 rounded-full blur-2xl"></div>
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-[#1CCA9B]">psychology</span>
<h3 className="font-title-md text-title-md text-white">EMS AI Pulse Co-Pilot</h3>
</div>
<p className="font-body-sm text-body-sm text-white/80">Need help framing unbiased questions tailored for Indian corporate compliance? Ask the assistant.</p>
<div className="space-y-2 pt-2">
<div className="p-2.5 rounded-lg bg-white/5 text-body-sm text-white/90 cursor-pointer hover:bg-white/10 transition-all flex items-center justify-between">
<span>Suggest burnout mitigation queries</span>
<span className="material-symbols-outlined text-xs text-[#1CCA9B]">arrow_forward</span>
</div>
<div className="p-2.5 rounded-lg bg-white/5 text-body-sm text-white/90 cursor-pointer hover:bg-white/10 transition-all flex items-center justify-between">
<span>Optimize eNPS benchmark scale</span>
<span className="material-symbols-outlined text-xs text-[#1CCA9B]">arrow_forward</span>
</div>
</div>
<div className="pt-2">
<input className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-body-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#1CCA9B]" placeholder="AI assistant preview (not connected)" type="text" aria-label="AI preview prompt" value={settings.field12} onChange={event=>setSetting('field12',event.target.value)} />
</div>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 bg-[#0E2B3D]/50 backdrop-blur-sm items-center justify-center p-4" + (modal==='publish' ? ' flex' : ' hidden')} id="publish-modal">
<div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-xl shadow-2xl space-y-space-lg animate-in fade-in zoom-in-95 duration-150">
<div className="w-12 h-12 rounded-full bg-[#00694f]/10 text-[#00694f] flex items-center justify-center">
<span className="material-symbols-outlined text-2xl">campaign</span>
</div>
<div>
<h3 className="font-headline-md text-headline-md text-on-surface">Publish Survey Now?</h3>
<p className="font-body-md text-body-md text-outline mt-1">This saves a local publish preview. No campaign invitations will be dispatched.</p>
</div>
<div className="flex items-center justify-end gap-3 pt-2">
<button className="px-4 py-2 rounded-lg border border-outline-variant text-on-surface font-label-md" onClick={event=>{closePublishModal()}}>Cancel</button>
<button className="px-4 py-2 rounded-lg bg-[#00694f] text-white font-label-md hover:bg-[#00513c]" onClick={event=>{confirmPublish()}}>Confirm &amp; Publish</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 bg-[#0E2B3D]/50 backdrop-blur-sm items-center justify-center p-4" + (modal==='logic' ? ' flex' : ' hidden')} id="logic-modal"><SurveyLogic question={questions.find(item=>item.id===logicId)} questions={questions} onSave={saveLogic} onClose={closeLogicModal} /></div>

<div className={"fixed bottom-6 right-6 z-50 bg-[#0E2B3D] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 transform  transition-all duration-300" + (toast ? '' : ' translate-y-20 opacity-0 pointer-events-none')} id="toast-notification" role="status">
<span className="material-symbols-outlined text-[#1CCA9B]">check_circle</span>
<span className="font-label-lg text-label-lg" id="toast-message">{toast}</span>
</div>
</div></main>{modal==="delete"&&<div id="delete-question-modal" className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"><div className="p-6 bg-surface rounded-xl space-y-4"><h3 className="text-headline-sm">Delete this question?</h3><div className="flex gap-3"><button onClick={()=>setModal(null)}>Cancel</button><button className="p-2 bg-error text-on-error rounded" onClick={confirmDelete}>Confirm Delete Question</button></div></div></div>}<span className="sr-only">{savedDraft?"Draft saved in session":"Unsaved draft"}{published?"Local publish preview":""}{responses?"Preview completed":""}</span></div></>);
}
