import { useEffect, useRef, useState } from 'react';
import { Sidebar, Header } from './Layout.jsx';
import { initialCandidateFields } from './candidateDossierFields.js';
import { initialDossierNotes } from './candidateDossierData.js';
import { CandidateTags, CandidateNotes } from './CandidateDossierComponents.jsx';
export default function CandidateDossier() {
 const [tab,setTab]=useState('overview');
 const [modal,setModal]=useState(null);
 const [menu,setMenu]=useState(false);
 const [locked,setLocked]=useState(false);
 const [fields,setFields]=useState(initialCandidateFields);
 const [tags,setTags]=useState(['Distributed Systems','Go / Golang','Apache Kafka','Kubernetes / EKS','Tier-1 Engg']);
 const [notes,setNotes]=useState(initialDossierNotes);
 const [editNoteId,setEditNoteId]=useState(null);
 const [deleteNoteId,setDeleteNoteId]=useState(null);
 const [emails,setEmails]=useState([]);
 const [stage,setStage]=useState('Tech Round 2');
 const [stageTarget,setStageTarget]=useState('Offer Stage');
 const [candidateStatus,setCandidateStatus]=useState('Active candidate');
 const [deleted,setDeleted]=useState(false);
 const [records,setRecords]=useState([]);
 const [toast,setToast]=useState('');
 const timer=useRef();
 const showToast=message=>{clearTimeout(timer.current);setToast(message);timer.current=setTimeout(()=>setToast(''),3500);};
 const setField=(key,value)=>setFields(previous=>{if(key==='email-template-select')return {...previous,[key]:value,'email-subject-input':value==='offer_letter'?'Offer letter preview':value==='rejection'?'Application update preview':'Interview invitation preview','email-body-input':'Dear Karthik, this is a local communication draft. No message has been sent.'};return {...previous,[key]:value};});
 const totalCtc=['offer-base-input','offer-var-input','offer-esop-input'].reduce((total,key)=>total+(Number(fields[key])||0),0);
 const formattedCtc=new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(totalCtc);
 const switchTab=setTab;
 const closeModal=()=>setModal(null);
 const blocked=()=>{if(locked){showToast('Candidate lifecycle actions are locked in this preview.');return true;}return false;};
 const openModal=id=>{if(['modal-move-stage','modal-offer','modal-hire','modal-joining','modal-withdraw','modal-blacklist','modal-archive','modal-delete'].includes(id)&&blocked())return;setModal(id);};
 const toggleDropdown=()=>setMenu(previous=>!previous);
 const closeDropdown=()=>setMenu(false);
 const toggleLockState=()=>setLocked(previous=>!previous);
 const triggerPdfDownload=()=>showToast('Resume PDF download is a prototype. No file was generated.');
 const removeTag=value=>setTags(previous=>previous.filter(tag=>tag!==value));
 const handleAddTag=event=>{event.preventDefault();const tag=fields['new-tag-input'].trim();if(!tag)return;setTags(previous=>previous.some(item=>item.toLowerCase()===tag.toLowerCase())?previous:[...previous,tag]);setField('new-tag-input','');};
 const handleSendEmail=event=>{event.preventDefault();if(!fields['email-subject-input'].trim()||!fields['email-body-input'].trim()){showToast('Enter an email subject and body.');return;}setEmails(previous=>[{subject:fields['email-subject-input'],body:fields['email-body-input']},...previous]);showToast('Communication preview saved locally. No email was sent.');};
 const handleAddNote=event=>{event.preventDefault();const text=fields['new-note-text'].trim();if(!text)return;setNotes(previous=>editNoteId?previous.map(note=>note.id===editNoteId?{...note,text,private:fields['note-private-toggle']}:note):[{id:Date.now(),text,private:fields['note-private-toggle']},...previous]);setEditNoteId(null);setField('new-note-text','');};
 const editNote=id=>{const note=notes.find(note=>note.id===id);setEditNoteId(id);setField('new-note-text',note.text);setField('note-private-toggle',note.private);setTab('notes');};
 const deleteNote=id=>{setDeleteNoteId(id);setModal('modal-delete-note');};
 const confirmDeleteNote=()=>{setNotes(previous=>previous.filter(note=>note.id!==deleteNoteId));if(editNoteId===deleteNoteId){setEditNoteId(null);setField('new-note-text','');}closeModal();};
 const log=(type,data={})=>setRecords(previous=>[{id:Date.now(),type,...data},...previous]);
 const confirmStageMove=()=>{if(blocked())return;setStage(stageTarget);closeModal();log('Stage updated',{stage:stageTarget});showToast('Stage updated locally.');};
 const confirmSendOffer=()=>{if(blocked())return;if(totalCtc<=0||['offer-base-input','offer-var-input','offer-esop-input'].some(key=>!Number.isFinite(Number(fields[key]))||Number(fields[key])<0)){showToast('Enter valid non-negative CTC components.');return;}setCandidateStatus('Offer prepared');log('Offer preview',{ctc:totalCtc});closeModal();showToast('Offer preview saved locally for '+formattedCtc+'. No offer was sent.');};
 const confirmHireAction=()=>{if(blocked())return;setCandidateStatus('Hired (local preview)');setStage('Hired');log('Hire preview');closeModal();showToast('Hire recorded locally. No employee record was provisioned.');};
 const confirmJoiningAction=()=>{if(blocked())return;setCandidateStatus('Joining confirmed (local preview)');log('Joining preview',{date:fields.field7});closeModal();showToast('Joining preference saved locally. No equipment was dispatched.');};
 const confirmWithdrawAction=()=>{if(blocked())return;setCandidateStatus('Withdrawn');closeModal();log('Withdrawn');};
 const confirmBlacklistAction=()=>{if(blocked())return;setCandidateStatus('Restricted (local preview)');closeModal();log('Restriction preview',{reason:fields.field14});};
 const confirmArchiveAction=()=>{if(blocked())return;setCandidateStatus('Archived');closeModal();log('Archived');};
 const confirmDeleteAction=()=>{if(blocked())return;if(fields['delete-confirm-input'].trim()!=='DELETE CANDIDATE'){showToast('Type DELETE CANDIDATE to confirm.');return;}setDeleted(true);closeModal();};
 const confirmScheduleInterview=event=>{event.preventDefault();if(!fields.field16||!fields.field17){showToast('Choose an interview date and time.');return;}log('Interview scheduled locally',{round:fields.field15,date:fields.field16,time:fields.field17});closeModal();showToast('Interview preview saved. No calendar invitation was sent.');};
 const confirmSubmitFeedback=event=>{event.preventDefault();log('Feedback saved locally',{recommendation:fields.field19,score:[fields.field20,fields.field21,fields.field22].map(Number).reduce((a,b)=>a+b,0)/3,text:fields.field23});closeModal();showToast('Feedback scorecard saved locally.');};
 const confirmAssignTest=()=>{log('Assessment assigned locally',{suite:fields.field24,due:fields.field25});closeModal();showToast('Assessment preview saved. No external test was dispatched.');};
 const confirmRescheduleAction=()=>{log('Interview rescheduled locally',{date:fields.field27,time:fields.field28});closeModal();showToast('Reschedule preview saved.');};
 const confirmCancelInterviewAction=()=>{log('Interview cancelled locally');closeModal();showToast('Cancellation preview saved. No panelist notification was sent.');};
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 useEffect(()=>{if(!modal)return;const dialog=document.getElementById(modal),previous=document.activeElement;dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',modal.replaceAll('-',' '));const controls=()=>[...dialog.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled);controls()[0]?.focus();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';const keydown=event=>{if(event.key==='Escape')closeModal();if(event.key==='Tab'){const items=controls(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};document.addEventListener('keydown',keydown);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keydown);previous?.focus();};},[modal]);
 if(deleted)return <><Sidebar activePage="candidate-dossier"/><div className="pl-64"><Header/><main className="pt-24 px-8"><h1 className="text-headline-lg">Candidate removed from this local preview</h1><p className="mt-3 text-outline">No external ATS record was deleted. Refresh to restore the sample.</p><a href="#/candidate-pipeline" className="inline-block mt-4 text-primary">Back to Candidate Pipeline</a></main></div></>;
 return (<><Sidebar activePage="candidate-dossier" /><div className="pl-64"><Header /><main className="relative pt-16 bg-surface min-h-screen">
        <div className="flex flex-col w-full">
          
          <div
            className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none"
            id="toast-container"
          >{toast&&<div role="status" className="pointer-events-auto p-4 rounded-xl shadow-xl bg-inverse-surface text-inverse-on-surface">{toast}</div>}</div>
          
          <aside
            aria-label={"Interactive Simulator Controls"}
            className="w-full bg-surface-container-high px-space-lg py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-sm border-b border-surface-container"
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-on-primary font-label-caps text-label-caps font-bold"
                >RIG</span
              >
              <span
                className="font-label-md text-label-md font-semibold text-on-surface"
                >Interactive State Simulator:</span
              >
              <span
                className="font-body-sm text-body-sm text-on-surface-variant hidden md:inline"
                >Instantly invoke enterprise ATS modal lifecycles &amp; test
                edge-states</span
              >
            </div>
            <div
              className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-0.5 max-w-full"
            >
              <button
                className="px-2.5 py-1 rounded bg-surface text-primary font-label-caps text-label-caps font-medium shadow-sm hover:bg-surface-container-highest transition-colors"
                onClick={event=>{switchTab('overview')}}
              >
                1. Overview
              </button>
              <button
                className="px-2.5 py-1 rounded bg-surface text-on-surface font-label-caps text-label-caps font-medium shadow-sm hover:bg-surface-container-highest transition-colors"
                onClick={event=>{openModal('modal-schedule')}}
              >
                2. Schedule Modal
              </button>
              <button
                className="px-2.5 py-1 rounded bg-surface text-on-surface font-label-caps text-label-caps font-medium shadow-sm hover:bg-surface-container-highest transition-colors"
                onClick={event=>{openModal('modal-feedback')}}
              >
                3. Feedback Modal
              </button>
              <button
                className="px-2.5 py-1 rounded bg-surface text-on-surface font-label-caps text-label-caps font-medium shadow-sm hover:bg-surface-container-highest transition-colors"
                onClick={event=>{openModal('modal-assign-test')}}
              >
                4. Assign Test
              </button>
              <button
                className="px-2.5 py-1 rounded bg-surface text-on-surface font-label-caps text-label-caps font-medium shadow-sm hover:bg-surface-container-highest transition-colors"
                onClick={event=>{openModal('modal-offer')}}
              >
                5. Offer Form Modal
              </button>
              <button
                className="px-2.5 py-1 rounded bg-surface text-on-surface font-label-caps text-label-caps font-medium shadow-sm hover:bg-surface-container-highest transition-colors"
                onClick={event=>{openModal('modal-resume-fullscreen')}}
              >
                6. Fullscreen Resume
              </button>
              <button
                className="px-2.5 py-1 rounded bg-surface text-error font-label-caps text-label-caps font-medium shadow-sm hover:bg-error-container transition-colors"
                onClick={event=>{openModal('modal-delete')}}
              >
                7. Delete Confirm
              </button>
              <button
                className="px-2.5 py-1 rounded bg-secondary-container text-on-secondary-fixed font-label-caps text-label-caps font-semibold shadow-sm hover:bg-secondary-fixed transition-colors flex items-center gap-1"
                id="sim-lock-btn"
                onClick={event=>{toggleLockState()}}
              >
                <span className="material-symbols-outlined text-sm" id="lock-icon"
                  >{locked?'lock':'lock_open'}</span>
                <span id="lock-btn-label">{locked?'8. Lock State: ON':'8. Lock State: OFF'}</span>
              </button>
              <button
                className="px-2.5 py-1 rounded bg-surface text-on-surface font-label-caps text-label-caps font-medium shadow-sm hover:bg-surface-container-highest transition-colors"
                onClick={event=>{switchTab('communication')}}
              >
                9. Email Composer
              </button>
              <button
                className="px-2.5 py-1 rounded bg-surface text-on-surface font-label-caps text-label-caps font-medium shadow-sm hover:bg-surface-container-highest transition-colors"
                onClick={event=>{openModal('modal-joining')}}
              >
                10. Confirm Joining
              </button>
            </div>
          </aside>
          
          <div
            className="px-space-xl py-space-lg flex flex-col gap-space-lg max-w-[1600px] mx-auto w-full"
          >
            
            <nav
              aria-label={"Candidate Hierarchy"}
              className="flex flex-wrap items-center gap-2 font-label-md text-label-md text-on-surface-variant"
            >
              <a
                className="hover:text-primary transition-colors flex items-center gap-1"
                href="#"
                ><span className="material-symbols-outlined text-sm">home</span
                >Dashboard</a
              >
              <span className="text-outline-variant">/</span>
              <a className="hover:text-primary transition-colors" href="#"
                >Hire &amp; Lifecycle</a
              >
              <span className="text-outline-variant">/</span>
              <a className="hover:text-primary transition-colors" href="#"
                >Recruitment Hub</a
              >
              <span className="text-outline-variant">/</span>
              <span
                className="px-2 py-0.5 rounded bg-surface-container-high font-label-caps text-label-caps font-semibold text-secondary"
                >REQ-2025-089</span
              >
              <span className="text-outline-variant">/</span>
              <span className="text-on-surface font-semibold"
                >Karthik Ramanathan</span
              >
              <span
                className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-caps text-label-caps"
                >EMS-CND-0482</span
              >
            </nav>
            
            <header
              className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-space-lg relative overflow-hidden"
            >
              
              <div
                className="absolute -top-16 -right-16 w-64 h-64 bg-primary/5 rounded-full blur-2xl pointer-events-none"
              ></div>
              
              <div
                className="flex items-start sm:items-center gap-space-md min-w-0"
              >
                <div className="relative shrink-0">
                  <img
                    className="w-20 h-20 rounded-xl object-cover shadow-sm bg-surface-container"
                    data-alt="Corporate headshot of Karthik Ramanathan, an Indian male tech lead in his early 30s with wireframe spectacles and a crisp charcoal polo, confident and approachable expression with soft neutral studio backdrop."
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCZlhejaqRaaJqY6HnCeaBxmGhaJlw4VHcKmceAJHC4bZAn0qbt_IbLoXFJL_gz8GpGg-YjE_9NdQG3QFtBXt7VN8HhgkeQ6Y1YOpQHGaPAGaNVDBqFrgeSe4q8KeckbbjwguqU81bAvNemGlLGOfHQFaIodmWV3lrIkaic7upNncv-egaVfvb6-PGzZoJGJBsBbPeKjdys5bep5YoyOnMFmaRyV85QKmXdzjrYgkOoQcM7MrnNpXqg"
                  />
                  <span
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-on-primary text-xs shadow"
                    title="Active Candidate in Pipeline"
                  >
                    <span className="material-symbols-outlined text-[14px]"
                      >check</span
                    >
                  </span>
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1
                      className="font-headline-md text-headline-md font-bold text-on-surface tracking-tight"
                    >
                      Karthik Ramanathan
                    </h1><p className="text-body-sm text-primary">{candidateStatus} · {stage}</p>
                    <span
                      className="px-2.5 py-0.5 rounded-full bg-surface-container text-primary font-label-md text-label-md font-semibold flex items-center gap-1"
                    >
                      <span
                        className="w-2 h-2 rounded-full bg-primary animate-ping"
                      ></span>
                      Interview - Tech Round 2 (System Design)
                    </span>
                    <span
                      className="px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container font-label-caps text-label-caps font-semibold flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs"
                        >verified</span
                      >
                      96% Strong Match
                    </span>
                  </div>
                  <p
                    className="font-body-md text-body-md text-on-surface-variant mt-1 flex flex-wrap items-center gap-x-3 gap-y-1"
                  >
                    <span className="font-medium text-on-surface"
                      >Applied for:</span
                    >
                    Senior Backend Lead - Distributed Systems
                    <span className="text-outline-variant">•</span>
                    <span className="flex items-center gap-1"
                      ><span
                        className="material-symbols-outlined text-sm text-outline"
                        >schedule</span
                      >Applied 12 Feb 2025</span
                    >
                    <span className="text-outline-variant">•</span>
                    <span className="flex items-center gap-1"
                      ><span
                        className="material-symbols-outlined text-sm text-outline"
                        >source</span
                      >Referral: Swetha M. (Eng Dir)</span
                    >
                  </p>
                </div>
              </div>
              
              <div
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 xl:self-center shrink-0"
              >
                
                <div
                  className={"px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface-variant font-label-md text-label-md items-center gap-2" + (locked ? ' flex' : ' hidden')} id="locked-state-banner"
                >
                  <span
                    className="material-symbols-outlined text-secondary text-base"
                    >lock</span
                  >
                  <span className="text-body-sm font-medium"
                    >Stage locked until Bar-Raiser scorecard is submitted</span
                  >
                </div>
                <div
                  className="flex flex-wrap items-center gap-2"
                  id="action-buttons-group"
                >
                  <button
                    className={"lifecycle-btn px-3 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container text-on-surface font-label-lg text-label-lg font-medium flex items-center gap-1.5 shadow-sm transition-colors" + (locked?' opacity-40 cursor-not-allowed':'')} disabled={locked}
                    onClick={event=>{openModal('modal-move-stage')}}
                  >
                    <span className="material-symbols-outlined text-lg"
                      >drive_file_move</span
                    >
                    Move Stage
                  </button>
                  <button
                    className={"lifecycle-btn px-3 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container text-on-surface font-label-lg text-label-lg font-medium flex items-center gap-1.5 shadow-sm transition-colors" + (locked?' opacity-40 cursor-not-allowed':'')} disabled={locked}
                    onClick={event=>{openModal('modal-offer')}}
                  >
                    <span className="material-symbols-outlined text-lg"
                      >payments</span
                    >
                    Send Offer
                  </button>
                  <button
                    className={"lifecycle-btn px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg font-semibold flex items-center gap-1.5 shadow-sm transition-colors" + (locked?' opacity-40 cursor-not-allowed':'')} disabled={locked}
                    onClick={event=>{openModal('modal-hire')}}
                  >
                    <span className="material-symbols-outlined text-lg"
                      >how_to_reg</span
                    >
                    Hire
                  </button>
                  
                  <div
                    className="relative inline-block text-left"
                    id="more-actions-dropdown"
                  >
                    <button
                      className="p-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface shadow-sm transition-colors"
                      onClick={event=>{toggleDropdown('actions-menu')}}
                    >
                      <span className="material-symbols-outlined text-xl"
                        >more_vert</span
                      >
                    </button>
                    <div
                      className={"absolute right-0 mt-2 w-56 rounded-xl bg-surface-container-lowest shadow-xl z-30 p-1.5 flex-col gap-1" + (menu ? '' : ' hidden')} id="actions-menu"
                    >
                      <button
                        className={"lifecycle-btn w-full text-left px-3 py-2 rounded-lg font-body-md text-body-md text-on-surface hover:bg-surface-container-low flex items-center gap-2.5 transition-colors" + (locked?' opacity-40 cursor-not-allowed':'')} disabled={locked}
                        onClick={event=>{
                          openModal('modal-joining');
                          closeDropdown('actions-menu');
                        }}
                      >
                        <span
                          className="material-symbols-outlined text-base text-primary"
                          >event_available</span
                        >
                        Confirm Joining
                      </button>
                      <button
                        className={"lifecycle-btn w-full text-left px-3 py-2 rounded-lg font-body-md text-body-md text-on-surface hover:bg-surface-container-low flex items-center gap-2.5 transition-colors" + (locked?' opacity-40 cursor-not-allowed':'')} disabled={locked}
                        onClick={event=>{
                          openModal('modal-withdraw');
                          closeDropdown('actions-menu');
                        }}
                      >
                        <span
                          className="material-symbols-outlined text-base text-outline"
                          >do_not_disturb_on</span
                        >
                        Withdraw Dossier
                      </button>
                      <button
                        className={"lifecycle-btn w-full text-left px-3 py-2 rounded-lg font-body-md text-body-md text-on-surface hover:bg-surface-container-low flex items-center gap-2.5 transition-colors" + (locked?' opacity-40 cursor-not-allowed':'')} disabled={locked}
                        onClick={event=>{
                          openModal('modal-archive');
                          closeDropdown('actions-menu');
                        }}
                      >
                        <span
                          className="material-symbols-outlined text-base text-outline"
                          >archive</span
                        >
                        Archive to Talent Pool
                      </button>
                      <button
                        className={"lifecycle-btn w-full text-left px-3 py-2 rounded-lg font-body-md text-body-md text-on-error-container hover:bg-error-container/30 flex items-center gap-2.5 transition-colors" + (locked?' opacity-40 cursor-not-allowed':'')} disabled={locked}
                        onClick={event=>{
                          openModal('modal-blacklist');
                          closeDropdown('actions-menu');
                        }}
                      >
                        <span
                          className="material-symbols-outlined text-base text-error"
                          >gavel</span
                        >
                        Mark Blacklist Flag
                      </button>
                      <div className="my-1 h-px bg-surface-container"></div>
                      <button
                        className={"lifecycle-btn w-full text-left px-3 py-2 rounded-lg font-body-md text-body-md text-error hover:bg-error-container/40 flex items-center gap-2.5 transition-colors" + (locked?' opacity-40 cursor-not-allowed':'')} disabled={locked}
                        onClick={event=>{
                          openModal('modal-delete');
                          closeDropdown('actions-menu');
                        }}
                      >
                        <span className="material-symbols-outlined text-base"
                          >delete_forever</span
                        >
                        Delete Candidate
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </header>
            
            <div
              className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start"
            >
              
              <aside
                aria-label={"Candidate Dossier Rail"}
                className="lg:col-span-4 flex flex-col gap-space-lg"
              >
                
                <section
                  className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md"
                >
                  <div className="flex items-center justify-between">
                    <h2
                      className="font-headline-sm text-headline-sm font-semibold text-on-surface flex items-center gap-2"
                    >
                      <span
                        className="material-symbols-outlined text-primary text-xl"
                        >contact_page</span
                      >
                      Candidate Dossier
                    </h2>
                    <span
                      className="px-2 py-0.5 rounded bg-primary/10 text-primary font-label-caps text-label-caps font-semibold"
                      >VERIFIED</span
                    >
                  </div>
                  <div className="space-y-3 font-body-md text-body-md">
                    <div
                      className="flex items-start justify-between py-1.5 border-b border-surface-container"
                    >
                      <span
                        className="text-on-surface-variant font-label-md text-label-md flex items-center gap-1.5"
                      >
                        <span
                          className="material-symbols-outlined text-base text-outline"
                          >mail</span
                        >
                        Email
                      </span>
                      <a
                        className="font-medium text-primary hover:underline text-right break-all"
                        href="mailto:karthik.r@techmail.internal"
                        >karthik.r@techmail.internal</a
                      >
                    </div>
                    <div
                      className="flex items-start justify-between py-1.5 border-b border-surface-container"
                    >
                      <span
                        className="text-on-surface-variant font-label-md text-label-md flex items-center gap-1.5"
                      >
                        <span
                          className="material-symbols-outlined text-base text-outline"
                          >call</span
                        >
                        Phone
                      </span>
                      <span className="font-medium text-on-surface"
                        >+91 98450 12890</span
                      >
                    </div>
                    <div
                      className="flex items-start justify-between py-1.5 border-b border-surface-container"
                    >
                      <span
                        className="text-on-surface-variant font-label-md text-label-md flex items-center gap-1.5"
                      >
                        <span
                          className="material-symbols-outlined text-base text-outline"
                          >location_on</span
                        >
                        Location
                      </span>
                      <span className="font-medium text-on-surface text-right"
                        >Bengaluru, KA (Koramangala)</span
                      >
                    </div>
                    <div
                      className="flex items-start justify-between py-1.5 border-b border-surface-container"
                    >
                      <span
                        className="text-on-surface-variant font-label-md text-label-md flex items-center gap-1.5"
                      >
                        <span
                          className="material-symbols-outlined text-base text-outline"
                          >domain</span
                        >
                        Current Role
                      </span>
                      <span className="font-medium text-on-surface text-right"
                        >Senior SRE @ Swiggy</span
                      >
                    </div>
                    <div
                      className="flex items-start justify-between py-1.5 border-b border-surface-container"
                    >
                      <span
                        className="text-on-surface-variant font-label-md text-label-md flex items-center gap-1.5"
                      >
                        <span
                          className="material-symbols-outlined text-base text-outline"
                          >history_edu</span
                        >
                        Experience
                      </span>
                      <span className="font-medium text-on-surface"
                        >8.2 Years (6 yrs Tier-1)</span
                      >
                    </div>
                    <div className="flex items-start justify-between py-1.5">
                      <span
                        className="text-on-surface-variant font-label-md text-label-md flex items-center gap-1.5"
                      >
                        <span
                          className="material-symbols-outlined text-base text-outline"
                          >hourglass_bottom</span
                        >
                        Notice Period
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-md text-label-md font-semibold"
                        >30 Days (Serving)</span
                      >
                    </div>
                  </div>
                </section>
                
                <section
                  className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <h2
                      className="font-label-lg text-label-lg font-semibold text-on-surface flex items-center gap-2"
                    >
                      <span
                        className="material-symbols-outlined text-primary text-lg"
                        >local_offer</span
                      >
                      Skills &amp; Competency Tags
                    </h2>
                    <span
                      className="font-label-caps text-label-caps text-outline"
                      id="tag-count"
                      >{tags.length+' tags'}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1" id="tags-container"><CandidateTags tags={tags} onRemove={removeTag} /></div>
                  
                  <form
                    className="flex items-center gap-2 mt-2"
                    onSubmit={event=>{handleAddTag(event)}}
                  >
                    <input
                      className="flex-1 px-3 py-1.5 rounded-lg bg-surface-container-low border-0 font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary focus:outline-none"
                      id="new-tag-input"
                      placeholder="+ Add skill tag (e.g. gRPC)"
                      type="text"
                     aria-label={"new-tag-input"} value={fields["new-tag-input"]} onChange={event=>setField("new-tag-input",event.target.value)} />
                    <button
                      className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-medium transition-colors"
                      type="submit"
                    >
                      Add
                    </button>
                  </form>
                </section>
                
                <section
                  className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="material-symbols-outlined text-primary text-xl"
                        >picture_as_pdf</span
                      >
                      <div>
                        <h2
                          className="font-headline-sm text-headline-sm font-semibold text-on-surface"
                        >
                          Karthik_R_Resume_2025.pdf
                        </h2>
                        <p className="font-label-caps text-label-caps text-outline">
                          Verified ATS Parse • 1.4 MB • Updated 10 Feb
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div
                    className="w-full h-80 rounded-lg bg-surface-container-low p-4 overflow-y-auto font-body-sm text-body-sm text-on-surface flex flex-col gap-3 relative shadow-inner"
                  >
                    <div className="border-b border-surface-container pb-2">
                      <p
                        className="font-title-md text-title-md font-bold text-on-surface"
                      >
                        KARTHIK RAMANATHAN
                      </p>
                      <p className="text-outline text-xs">
                        Bengaluru, India | +91 98450 12890 |
                        github.com/karthikr-dist
                      </p>
                    </div>
                    <div>
                      <p
                        className="font-label-caps text-label-caps uppercase text-primary font-bold tracking-wider"
                      >
                        Executive Summary
                      </p>
                      <p className="mt-1 leading-relaxed text-on-surface-variant">
                        Distributed Systems Specialist with 8+ years
                        architecting high-throughput low-latency microservices.
                        Scaled real-time order tracking ingest pipelines to
                        350,000 writes/second during peak Indian festive runs
                        (Diwali &amp; IPL campaigns) with sub-12ms p99 SLA.
                      </p>
                    </div>
                    <div>
                      <p
                        className="font-label-caps text-label-caps uppercase text-primary font-bold tracking-wider"
                      >
                        Professional Experience
                      </p>
                      <div className="mt-1">
                        <p className="font-semibold text-on-surface">
                          Staff SRE / Distributed Backend Lead - Swiggy (2021 -
                          Present)
                        </p>
                        <p className="text-outline text-xs">
                          Led platform mesh migration to AWS EKS with Envoy
                          &amp; Istio. Optimized Kafka event partitions saving
                          ₹1.2 Cr annually in cloud compute.
                        </p>
                      </div>
                      <div className="mt-2">
                        <p className="font-semibold text-on-surface">
                          Senior Software Engineer - Razorpay (2018 - 2021)
                        </p>
                        <p className="text-outline text-xs">
                          Engineered core idempotency payment engine in Go.
                          Handled UPI 2.0 webhooks with 99.999% reliability.
                        </p>
                      </div>
                    </div>
                    <div>
                      <p
                        className="font-label-caps text-label-caps uppercase text-primary font-bold tracking-wider"
                      >
                        Education
                      </p>
                      <p className="font-medium text-on-surface">
                        B.Tech, Computer Science &amp; Engineering
                      </p>
                      <p className="text-outline text-xs">
                        NIT Surathkal (Class of 2017) • CGPA: 9.14/10
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      className="flex-1 px-3 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      onClick={event=>{triggerPdfDownload()}}
                    >
                      <span className="material-symbols-outlined text-base"
                        >download</span
                      >
                      Download PDF
                    </button>
                    <button
                      className="flex-1 px-3 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      onClick={event=>{openModal('modal-resume-fullscreen')}}
                    >
                      <span className="material-symbols-outlined text-base"
                        >open_in_full</span
                      >
                      Open Full Screen
                    </button>
                  </div>
                </section>
              </aside>
              
              <main className="lg:col-span-8 flex flex-col gap-space-md">
                
                <nav
                  aria-label={"Candidate Dossier Sections"}
                  className="bg-surface-container-lowest rounded-xl p-1.5 shadow-sm flex flex-wrap items-center gap-1"
                >
                  <button
                    className={"tab-btn px-4 py-2 rounded-lg font-label-lg text-label-lg font-semibold flex items-center gap-2 transition-colors" + (tab==='overview' ? ' bg-primary text-on-primary' : ' text-on-surface-variant')} id="tab-btn-overview"
                    onClick={event=>{switchTab('overview')}}
                  >
                    <span className="material-symbols-outlined text-base"
                      >dashboard</span
                    >
                    Overview
                  </button>
                  <button
                    className={"tab-btn px-4 py-2 rounded-lg font-label-lg text-label-lg font-medium hover:text-on-surface hover:bg-surface-container-low flex items-center gap-2 transition-colors" + (tab==='interviews' ? ' bg-primary text-on-primary' : ' text-on-surface-variant')} id="tab-btn-interviews"
                    onClick={event=>{switchTab('interviews')}}
                  >
                    <span className="material-symbols-outlined text-base"
                      >co_present</span
                    >
                    Interviews
                    <span
                      className="px-1.5 py-0.2 rounded-full text-xs bg-primary/20 text-primary font-bold"
                      >2/3</span
                    >
                  </button>
                  <button
                    className={"tab-btn px-4 py-2 rounded-lg font-label-lg text-label-lg font-medium hover:text-on-surface hover:bg-surface-container-low flex items-center gap-2 transition-colors" + (tab==='assessments' ? ' bg-primary text-on-primary' : ' text-on-surface-variant')} id="tab-btn-assessments"
                    onClick={event=>{switchTab('assessments')}}
                  >
                    <span className="material-symbols-outlined text-base"
                      >quiz</span
                    >
                    Assessments
                    <span className="w-2 h-2 rounded-full bg-primary"></span>
                  </button>
                  <button
                    className={"tab-btn px-4 py-2 rounded-lg font-label-lg text-label-lg font-medium hover:text-on-surface hover:bg-surface-container-low flex items-center gap-2 transition-colors" + (tab==='communication' ? ' bg-primary text-on-primary' : ' text-on-surface-variant')} id="tab-btn-communication"
                    onClick={event=>{switchTab('communication')}}
                  >
                    <span className="material-symbols-outlined text-base"
                      >outgoing_mail</span
                    >
                    Communication
                  </button>
                  <button
                    className={"tab-btn px-4 py-2 rounded-lg font-label-lg text-label-lg font-medium hover:text-on-surface hover:bg-surface-container-low flex items-center gap-2 transition-colors" + (tab==='notes' ? ' bg-primary text-on-primary' : ' text-on-surface-variant')} id="tab-btn-notes"
                    onClick={event=>{switchTab('notes')}}
                  >
                    <span className="material-symbols-outlined text-base"
                      >sticky_note_2</span
                    >
                    Notes
                    <span
                      className="px-1.5 py-0.2 rounded-full text-xs bg-surface-container text-on-surface font-semibold"
                      id="notes-badge-count"
                      >{notes.length}</span>
                  </button>
                  <button
                    className={"tab-btn px-4 py-2 rounded-lg font-label-lg text-label-lg font-medium hover:text-on-surface hover:bg-surface-container-low flex items-center gap-2 transition-colors" + (tab==='activity' ? ' bg-primary text-on-primary' : ' text-on-surface-variant')} id="tab-btn-activity"
                    onClick={event=>{switchTab('activity')}}
                  >
                    <span className="material-symbols-outlined text-base"
                      >history</span
                    >
                    Activity &amp; Audit
                  </button>
                </nav>
                
                <div
                  className={"tab-panel flex-col gap-space-md" + (tab==='overview' ? '' : ' hidden')} id="tab-content-overview"
                >
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
                    <div
                      className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between"
                    >
                      <span
                        className="font-label-caps text-label-caps uppercase text-outline font-semibold tracking-wider"
                        >Technical Rigor Score</span
                      >
                      <div className="flex items-baseline gap-2 mt-2">
                        <span
                          className="font-display-sm text-display-sm font-bold text-primary"
                          >4.8</span
                        >
                        <span className="font-body-md text-body-md text-outline"
                          >/ 5.0</span
                        >
                      </div>
                      <div
                        className="w-full bg-surface-container rounded-full h-1.5 mt-3 overflow-hidden"
                      >
                        <div
                          className="bg-primary h-1.5 rounded-full"
                          style={{"width":"96%"}}
                        ></div>
                      </div>
                      <span
                        className="font-label-md text-label-md text-on-surface-variant mt-2"
                        >Top 4% of backend candidates</span
                      >
                    </div>
                    <div
                      className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between"
                    >
                      <span
                        className="font-label-caps text-label-caps uppercase text-outline font-semibold tracking-wider"
                        >Comp Expectations (CTC)</span
                      >
                      <div className="mt-2">
                        <div
                          className="flex justify-between items-center text-body-sm"
                        >
                          <span className="text-outline">Current CTC:</span>
                          <span className="font-semibold text-on-surface"
                            >₹34,00,000 PA</span
                          >
                        </div>
                        <div
                          className="flex justify-between items-center text-body-sm mt-1"
                        >
                          <span className="text-outline">Expected CTC:</span>
                          <span className="font-bold text-primary"
                            >₹46,00,000 PA</span
                          >
                        </div>
                      </div>
                      <span
                        className="px-2 py-1 rounded bg-secondary-container text-on-secondary-fixed font-label-caps text-label-caps font-semibold mt-3 self-start"
                      >
                        +35.2% Hike (Within Budget ₹50L)
                      </span>
                    </div>
                    <div
                      className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between"
                    >
                      <span
                        className="font-label-caps text-label-caps uppercase text-outline font-semibold tracking-wider"
                        >Screening Questionnaire</span
                      >
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className="material-symbols-outlined text-primary text-3xl"
                          >check_circle</span
                        >
                        <div>
                          <p
                            className="font-headline-sm text-headline-sm font-bold text-on-surface"
                          >
                            5 / 5 Cleared
                          </p>
                          <p
                            className="font-label-md text-label-md text-on-surface-variant"
                          >
                            Zero Knockout Triggers
                          </p>
                        </div>
                      </div>
                      <span
                        className="font-label-md text-label-md text-outline mt-3"
                        >Completed on 12 Feb 2025</span
                      >
                    </div>
                  </div>
                  
                  <div
                    className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md"
                  >
                    <h3
                      className="font-headline-sm text-headline-sm font-semibold text-on-surface flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-primary"
                        >verified_user</span
                      >
                      Key Competency &amp; Alignment Breakdown
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                      <div
                        className="p-3.5 rounded-lg bg-surface-container-low flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="font-label-lg text-label-lg font-semibold text-on-surface"
                            >High-Throughput Concurrency</span
                          >
                          <span
                            className="font-label-caps text-label-caps font-bold text-primary"
                            >ADVANCED</span
                          >
                        </div>
                        <p
                          className="font-body-sm text-body-sm text-on-surface-variant"
                        >
                          Extensive track record with Go channels, sync pools,
                          and distributed mutexes across Redis clusters.
                        </p>
                      </div>
                      <div
                        className="p-3.5 rounded-lg bg-surface-container-low flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="font-label-lg text-label-lg font-semibold text-on-surface"
                            >Event-Driven Architecture</span
                          >
                          <span
                            className="font-label-caps text-label-caps font-bold text-primary"
                            >MASTER</span
                          >
                        </div>
                        <p
                          className="font-body-sm text-body-sm text-on-surface-variant"
                        >
                          Kafka compaction strategies, consumer group
                          rebalancing, and dead-letter queues at Swiggy scale.
                        </p>
                      </div>
                      <div
                        className="p-3.5 rounded-lg bg-surface-container-low flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="font-label-lg text-label-lg font-semibold text-on-surface"
                            >Database Partitioning &amp; Raft</span
                          >
                          <span
                            className="font-label-caps text-label-caps font-bold text-primary"
                            >STRONG</span
                          >
                        </div>
                        <p
                          className="font-body-sm text-body-sm text-on-surface-variant"
                        >
                          Hands-on sharding Postgres with Citus and distributed
                          transactions using saga orchestrations.
                        </p>
                      </div>
                      <div
                        className="p-3.5 rounded-lg bg-surface-container-low flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="font-label-lg text-label-lg font-semibold text-on-surface"
                            >Cloud Native Infrastructure</span
                          >
                          <span
                            className="font-label-caps text-label-caps font-bold text-primary"
                            >ADVANCED</span
                          >
                        </div>
                        <p
                          className="font-body-sm text-body-sm text-on-surface-variant"
                        >
                          Terraform, AWS EKS, Prometheus telemetry pipelines,
                          and Istio service mesh implementations.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div
                    className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-3"
                  >
                    <h3
                      className="font-headline-sm text-headline-sm font-semibold text-on-surface"
                    >
                      Initial Screening Questionnaire Responses
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-body-sm text-body-sm">
                        <thead>
                          <tr
                            className="border-b border-surface-container text-outline font-label-caps text-label-caps uppercase"
                          >
                            <th className="py-2 px-3">Question</th>
                            <th className="py-2 px-3">Candidate Response</th>
                            <th className="py-2 px-3">ATS Knockout Match</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-container">
                          <tr>
                            <td className="py-2.5 px-3 font-medium text-on-surface">
                              Are you willing to work from Bengaluru HQ (3
                              days/week)?
                            </td>
                            <td className="py-2.5 px-3 text-on-surface">
                              "Yes, I currently reside in Koramangala, 20 mins
                              from office."
                            </td>
                            <td
                              className="py-2.5 px-3 text-primary font-semibold flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-sm"
                                >check</span
                              >
                              Pass
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-3 font-medium text-on-surface">
                              Do you possess production Go/Golang expertise of
                              4+ years?
                            </td>
                            <td className="py-2.5 px-3 text-on-surface">
                              "Yes, 5.5 years in core Go production services."
                            </td>
                            <td
                              className="py-2.5 px-3 text-primary font-semibold flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-sm"
                                >check</span
                              >
                              Pass
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-3 font-medium text-on-surface">
                              What is your maximum joining notice period?
                            </td>
                            <td className="py-2.5 px-3 text-on-surface">
                              "30 Days (Serving notice, LWD is 15 March 2025)."
                            </td>
                            <td
                              className="py-2.5 px-3 text-primary font-semibold flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-sm"
                                >check</span
                              >
                              Pass (Requirement &lt; 45d)
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                
                <div
                  className={"tab-panel flex-col gap-space-md" + (tab==='interviews' ? '' : ' hidden')} id="tab-content-interviews"
                >
                  <div
                    className="flex items-center justify-between bg-surface-container-lowest rounded-xl p-space-md shadow-sm"
                  >
                    <div>
                      <h3
                        className="font-headline-sm text-headline-sm font-semibold text-on-surface"
                      >
                        Technical Evaluation Pipeline
                      </h3>
                      <p className="font-body-sm text-body-sm text-outline">
                        3 Evaluative Stages Configured for Senior Backend Lead
                      </p>
                    </div>
                    <button
                      className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                      onClick={event=>{openModal('modal-schedule')}}
                    >
                      <span className="material-symbols-outlined text-lg"
                        >calendar_add_on</span
                      >
                      Schedule Next Round
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    
                    <div
                      className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md border-l-4 border-l-primary"
                    >
                      <div
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold"
                            >1</span
                          >
                          <div>
                            <div className="flex items-center gap-2">
                              <h4
                                className="font-headline-sm text-headline-sm font-bold text-on-surface"
                              >
                                Round 1: Low-Level Architecture &amp; Data
                                Structures
                              </h4>
                              <span
                                className="px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container font-label-caps text-label-caps font-semibold"
                                >COMPLETED</span
                              >
                            </div>
                            <p className="font-body-sm text-body-sm text-outline">
                              Interviewer: Vikramaditya Joshi (Staff Architect)
                              • Conducted on 14 Feb 2025 (60 mins)
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="px-3 py-1 rounded-lg bg-surface-container text-primary font-title-md text-title-md font-bold"
                            >4.8 / 5.0</span
                          >
                          <button
                            className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium transition-colors"
                            onClick={event=>{openModal('modal-feedback')}}
                          >
                            View Scorecard
                          </button>
                        </div>
                      </div>
                      <div
                        className="bg-surface-container-low rounded-lg p-3 text-body-sm leading-relaxed text-on-surface-variant"
                      >
                        <p className="font-semibold text-on-surface">
                          Interviewer Notes &amp; Recommendation:
                        </p>
                        <p className="mt-1">
                          "Exceptional mastery over memory layouts in Go and
                          zero-allocation slice transformations. Implemented a
                          lock-free ring buffer under 25 minutes with full
                          edge-case testing. Unanimous Strong Hire for Tech Lead
                          depth."
                        </p>
                      </div>
                    </div>
                    
                    <div
                      className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md border-l-4 border-l-secondary"
                    >
                      <div
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-fixed flex items-center justify-center font-bold"
                            >2</span
                          >
                          <div>
                            <div className="flex items-center gap-2">
                              <h4
                                className="font-headline-sm text-headline-sm font-bold text-on-surface"
                              >
                                Round 2: Distributed Systems &amp; Partitioning
                              </h4>
                              <span
                                className="px-2 py-0.5 rounded-full bg-secondary text-on-secondary font-label-caps text-label-caps font-semibold"
                                >SCHEDULED TODAY</span
                              >
                            </div>
                            <p className="font-body-sm text-body-sm text-outline">
                              Interviewer: Ananya Sengupta (Principal Engineer)
                              • Today at 16:00 IST
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium transition-colors"
                            onClick={event=>{openModal('modal-reschedule')}}
                          >
                            Reschedule
                          </button>
                          <button
                            className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-semibold transition-colors flex items-center gap-1"
                            onClick={event=>{openModal('modal-feedback')}}
                          >
                            <span className="material-symbols-outlined text-base"
                              >rate_review</span
                            >
                            + Add Feedback
                          </button>
                          <button
                            className="p-1.5 rounded-lg hover:bg-error-container/30 text-outline hover:text-error transition-colors"
                            onClick={event=>{openModal('modal-cancel-interview')}}
                            title="Cancel Round"
                          >
                            <span className="material-symbols-outlined text-base"
                              >cancel</span
                            >
                          </button>
                        </div>
                      </div>
                      <div
                        className="flex flex-wrap items-center gap-4 text-body-sm text-on-surface-variant bg-surface-container-low p-3 rounded-lg"
                      >
                        <span className="flex items-center gap-1"
                          ><span
                            className="material-symbols-outlined text-sm text-primary"
                            >videocam</span
                          >
                          Google Meet: meet.google.com/ems-tech-892</span
                        >
                        <span className="flex items-center gap-1"
                          ><span
                            className="material-symbols-outlined text-sm text-outline"
                            >timer</span
                          >
                          Duration: 75 mins</span
                        >
                        <span className="flex items-center gap-1"
                          ><span
                            className="material-symbols-outlined text-sm text-outline"
                            >draw</span
                          >
                          Collaborative Canvas: Excalidraw Room #482</span
                        >
                      </div>
                    </div>
                    
                    <div
                      className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md opacity-75"
                    >
                      <div
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-10 h-10 rounded-full bg-surface-container text-outline flex items-center justify-center font-bold"
                            >3</span
                          >
                          <div>
                            <div className="flex items-center gap-2">
                              <h4
                                className="font-headline-sm text-headline-sm font-bold text-on-surface"
                              >
                                Round 3: Engineering Leadership &amp; Bar-Raiser
                              </h4>
                              <span
                                className="px-2 py-0.5 rounded-full bg-surface-container text-outline font-label-caps text-label-caps font-semibold"
                                >PENDING ROUND 2</span
                              >
                            </div>
                            <p className="font-body-sm text-body-sm text-outline">
                              Designated Bar-Raiser: Rajesh Murthy (VP
                              Engineering)
                            </p>
                          </div>
                        </div>
                        <button
                          className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium transition-colors"
                          onClick={event=>{openModal('modal-schedule')}}
                        >
                          Pre-Book Slot
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div
                  className={"tab-panel flex-col gap-space-md" + (tab==='assessments' ? '' : ' hidden')} id="tab-content-assessments"
                >
                  <div
                    className="flex items-center justify-between bg-surface-container-lowest rounded-xl p-space-md shadow-sm"
                  >
                    <div>
                      <h3
                        className="font-headline-sm text-headline-sm font-semibold text-on-surface"
                      >
                        Technical Assessment Benchmarks
                      </h3>
                      <p className="font-body-sm text-body-sm text-outline">
                        Automated Sandbox &amp; Code Quality Evaluations
                      </p>
                    </div>
                    <button
                      className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                      onClick={event=>{openModal('modal-assign-test')}}
                    >
                      <span className="material-symbols-outlined text-lg"
                        >post_add</span
                      >
                      + Assign Test
                    </button>
                  </div>
                  
                  <div
                    className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md"
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-body-sm text-body-sm">
                        <thead>
                          <tr
                            className="border-b border-surface-container text-outline font-label-caps text-label-caps uppercase"
                          >
                            <th className="py-3 px-3">Assessment Name</th>
                            <th className="py-3 px-3">Platform</th>
                            <th className="py-3 px-3">Date Completed</th>
                            <th className="py-3 px-3">Score &amp; Percentile</th>
                            <th className="py-3 px-3">
                              Proctoring &amp; Integrity
                            </th>
                            <th className="py-3 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-container">
                          <tr>
                            <td className="py-3 px-3 font-semibold text-on-surface">
                              Distributed Systems Concurrency Suite v4
                            </td>
                            <td className="py-3 px-3 text-on-surface">
                              HackerRank Enterprise
                            </td>
                            <td className="py-3 px-3 text-on-surface">
                              13 Feb 2025
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-bold text-primary"
                                >292 / 300</span
                              >
                              <span
                                className="font-label-caps text-label-caps text-outline ml-1"
                                >(98th Percentile)</span
                              >
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className="px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container font-label-caps text-label-caps font-semibold"
                                >100% Passed • 0 Flags</span
                              >
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                className="font-medium text-primary hover:underline"
                                onClick={event=>{
                                  showToast(
                                    'Report preview only; external assessment reports are not connected.',
                                  )
                                }}
                              >
                                View Report
                              </button>
                            </td>
                          </tr>
                          <tr>
                            <td className="py-3 px-3 font-semibold text-on-surface">
                              System Architecture Case: Realtime Delivery Ingest
                            </td>
                            <td className="py-3 px-3 text-on-surface">
                              Codility Whiteboard
                            </td>
                            <td className="py-3 px-3 text-on-surface">
                              11 Feb 2025
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-bold text-primary"
                                >94 / 100</span
                              >
                              <span
                                className="font-label-caps text-label-caps text-outline ml-1"
                                >(94th Percentile)</span
                              >
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className="px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container font-label-caps text-label-caps font-semibold"
                                >Verified Safe</span
                              >
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                className="font-medium text-primary hover:underline"
                                onClick={event=>{
                                  showToast(
                                    'Codility artifact preview is not connected.',
                                  )
                                }}
                              >
                                View Report
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div className="p-3 rounded-lg bg-surface-container-low">
                        <span
                          className="font-label-caps text-label-caps text-outline uppercase font-semibold"
                          >Deadlock Prevention</span
                        >
                        <p
                          className="font-headline-sm text-headline-sm font-bold text-primary mt-1"
                        >
                          100%
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          4/4 concurrent stress tests cleared
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-surface-container-low">
                        <span
                          className="font-label-caps text-label-caps text-outline uppercase font-semibold"
                          >Code Complexity (Cyclomatic)</span
                        >
                        <p
                          className="font-headline-sm text-headline-sm font-bold text-on-surface mt-1"
                        >
                          Grade A (3.2)
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          Highly maintainable idiomatic Go
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-surface-container-low">
                        <span
                          className="font-label-caps text-label-caps text-outline uppercase font-semibold"
                          >Time Complexity</span
                        >
                        <p
                          className="font-headline-sm text-headline-sm font-bold text-primary mt-1"
                        >
                          O(log N)
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          Optimal spatial caching
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div
                  className={"tab-panel flex-col gap-space-md" + (tab==='communication' ? '' : ' hidden')} id="tab-content-communication"
                >
                  
                  <div
                    className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md"
                  >
                    <h3
                      className="font-headline-sm text-headline-sm font-semibold text-on-surface flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-primary"
                        >outgoing_mail</span
                      >
                      Dispatch Email to Candidate
                    </h3>
                    <form
                      className="flex flex-col gap-3"
                      onSubmit={event=>{handleSendEmail(event)}}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label
                            className="block font-label-md text-label-md text-on-surface font-semibold mb-1"
                            >Select Preset Template</label
                          >
                          <select
                            className="w-full px-3 py-2 rounded-lg bg-surface-container-low border-0 font-body-sm text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
                            id="email-template-select"
                            
                           aria-label={"email-template-select"} value={fields["email-template-select"]} onChange={event=>setField("email-template-select",event.target.value)}>
                            <option value="custom">-- Custom Message --</option>
                            <option  value="invite_r2">
                              Interview Invitation - Tech Round 2 (System
                              Design)
                            </option>
                            <option value="offer_letter">
                              Offer Letter Delivery &amp; CTC Annexure
                            </option>
                            <option value="take_home">
                              Take-Home Systems Coding Challenge Brief
                            </option>
                            <option value="rejection">
                              Polite Rejection (Talent Pool Keep)
                            </option>
                          </select>
                        </div>
                        <div>
                          <label
                            className="block font-label-md text-label-md text-on-surface font-semibold mb-1"
                            >To Recipient</label
                          >
                          <input
                            className="w-full px-3 py-2 rounded-lg bg-surface-container border-0 font-body-sm text-body-sm text-on-surface-variant focus:outline-none cursor-not-allowed"
                            readOnly
                            type="text"
                            
                           aria-label={"To Recipient"} value={fields["field1"]} onChange={event=>setField("field1",event.target.value)} />
                        </div>
                      </div>
                      <div>
                        <label
                          className="block font-label-md text-label-md text-on-surface font-semibold mb-1"
                          >Subject Line</label
                        >
                        <input
                          className="w-full px-3 py-2 rounded-lg bg-surface-container-low border-0 font-body-sm text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
                          id="email-subject-input"
                          type="text"
                          
                         aria-label={"email-subject-input"} value={fields["email-subject-input"]} onChange={event=>setField("email-subject-input",event.target.value)} />
                      </div>
                      <div>
                        <label
                          className="block font-label-md text-label-md text-on-surface font-semibold mb-1"
                          >Message Body</label
                        >
                        <textarea
                          className="w-full p-3 rounded-lg bg-surface-container-low border-0 font-body-sm text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:outline-none leading-relaxed"
                          id="email-body-input"
                          rows="5"
                         aria-label={"email-body-input"} value={fields["email-body-input"]} onChange={event=>setField("email-body-input",event.target.value)} />
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <button
                          className="flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface font-label-md text-label-md"
                          onClick={event=>{
                            showToast(
                              'Attachment dialog opened: max file size 10MB',
                            )
                          }}
                          type="button"
                        >
                          <span className="material-symbols-outlined text-lg"
                            >attach_file</span
                          >
                          Attach Dossier Specs / Annexure
                        </button>
                        <button
                          className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-semibold flex items-center gap-2 shadow-sm transition-colors"
                          type="submit"
                        >
                          <span className="material-symbols-outlined text-base"
                            >send</span
                          >
                          Send Email Dispatch
                        </button>
                      </div>
                    </form>
                  </div>
                  
                  <div
                    className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md"
                  >
                    <h3
                      className="font-headline-sm text-headline-sm font-semibold text-on-surface"
                    >
                      Communication Audit Trail
                    </h3>
                    <div
                      className="space-y-3 font-body-sm text-body-sm"
                      id="email-history-list"
                    >{emails.map((email,index)=><div key={index} className="p-4 bg-surface-container-low rounded-xl"><p className="font-semibold">{email.subject}</p><p className="whitespace-pre-wrap text-body-sm">{email.body}</p><p className="text-xs text-outline">Local draft ? Not sent</p></div>)}
                      <div
                        className="p-3 rounded-lg bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-on-surface"
                              >Round 1 Confirmation &amp; HackerRank Challenge
                              Link</span
                            >
                            <span
                              className="px-2 py-0.5 rounded bg-primary-container text-on-primary-container font-label-caps text-label-caps font-semibold"
                              >READ 13 FEB</span
                            >
                          </div>
                          <p className="text-xs text-outline mt-0.5">
                            Dispatched by automated ATS pipeline • Delivered to
                            karthik.r@techmail.internal
                          </p>
                        </div>
                        <span className="text-xs text-outline shrink-0"
                          >12 Feb 2025, 18:32 IST</span
                        >
                      </div>
                      <div
                        className="p-3 rounded-lg bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-on-surface"
                              >Acknowledgement: Application Received for Senior
                              Backend Lead</span
                            >
                            <span
                              className="px-2 py-0.5 rounded bg-primary-container text-on-primary-container font-label-caps text-label-caps font-semibold"
                              >DELIVERED</span
                            >
                          </div>
                          <p className="text-xs text-outline mt-0.5">
                            Inbound webhook parse • Confirmation dispatched
                          </p>
                        </div>
                        <span className="text-xs text-outline shrink-0"
                          >12 Feb 2025, 10:14 IST</span
                        >
                      </div>
                    </div>
                  </div>
                </div>
                
                <div
                  className={"tab-panel flex-col gap-space-md" + (tab==='notes' ? '' : ' hidden')} id="tab-content-notes"
                >
                  
                  <div
                    className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md"
                  >
                    <h3
                      className="font-headline-sm text-headline-sm font-semibold text-on-surface flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-primary"
                        >edit_note</span
                      >
                      Recruiter &amp; Panel Collaborative Notes
                    </h3>
                    <form
                      className="flex flex-col gap-3"
                      onSubmit={event=>{handleAddNote(event)}}
                    >
                      <textarea
                        className="w-full p-3 rounded-lg bg-surface-container-low border-0 font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary focus:outline-none"
                        id="new-note-text"
                        placeholder="Add an internal observation, comp negotiation note, or interview impression..."
                        required
                        rows="3"
                       aria-label={"new-note-text"} value={fields["new-note-text"]} onChange={event=>setField("new-note-text",event.target.value)} />
                      <div
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <label
                          className="flex items-center gap-2 cursor-pointer font-label-md text-label-md text-on-surface-variant"
                        >
                          <input
                            className="w-4 h-4 rounded text-primary focus:ring-primary"
                            id="note-private-toggle"
                            type="checkbox"
                           aria-label={"note-private-toggle"} checked={Boolean(fields["note-private-toggle"])} onChange={event=>setField("note-private-toggle",event.target.checked)} />
                          <span
                            >Mark as Private (Visible to Hiring Manager &amp; HR
                            Director only)</span
                          >
                        </label>
                        <button
                          className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-semibold flex items-center gap-1.5 shadow-sm transition-colors self-end"
                          type="submit"
                        >
                          <span className="material-symbols-outlined text-base"
                            >add_comment</span
                          >
                          Post Note
                        </button>
                      </div>
                    </form>
                  </div>
                  
                  <div className="space-y-3" id="notes-stream-container"><CandidateNotes notes={notes} onEdit={editNote} onDelete={deleteNote} /></div>
                </div>
                
                <div
                  className={"tab-panel flex-col gap-space-md" + (tab==='activity' ? '' : ' hidden')} id="tab-content-activity"
                >{records.map((record,index)=><div key={index} className="p-3 bg-surface-container-low rounded-lg my-2"><p className="font-semibold">{record.type}</p><p className="text-body-sm">{record.round||record.suite||record.stage||record.date||"Local session record"}</p></div>)}
                  <div
                    className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3
                          className="font-headline-sm text-headline-sm font-semibold text-on-surface"
                        >
                          Immutable System Audit Log
                        </h3>
                        <p className="font-body-sm text-body-sm text-outline">
                          Cryptographically timestamped dossier mutations
                        </p>
                      </div>
                      <button
                        className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium transition-colors flex items-center gap-1"
                        onClick={event=>{
                          showToast('CSV export is a prototype. No file was generated.')
                        }}
                      >
                        <span className="material-symbols-outlined text-base"
                          >file_download</span
                        >
                        Export Log
                      </button>
                    </div>
                    
                    <div
                      className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-container"
                    >
                      <div className="relative">
                        <span
                          className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-primary ring-4 ring-surface-container-lowest"
                        ></span>
                        <p
                          className="font-label-md text-label-md font-semibold text-on-surface"
                        >
                          Interview Feedback Submitted for Round 1
                        </p>
                        <p
                          className="font-body-sm text-body-sm text-on-surface-variant mt-0.5"
                        >
                          Vikramaditya Joshi submitted scorecard: 4.8 / 5.0
                          (Strong Hire recommendation logged)
                        </p>
                        <span
                          className="font-label-caps text-label-caps text-outline"
                          >14 Feb 2025, 11:46:12 IST • IP: 10.14.82.91</span
                        >
                      </div>
                      <div className="relative">
                        <span
                          className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-secondary ring-4 ring-surface-container-lowest"
                        ></span>
                        <p
                          className="font-label-md text-label-md font-semibold text-on-surface"
                        >
                          Round 2: System Design Scheduled
                        </p>
                        <p
                          className="font-body-sm text-body-sm text-on-surface-variant mt-0.5"
                        >
                          Priya Sharma booked slot with Ananya Sengupta for 14
                          Feb 16:00 IST
                        </p>
                        <span
                          className="font-label-caps text-label-caps text-outline"
                          >14 Feb 2025, 09:12:05 IST</span
                        >
                      </div>
                      <div className="relative">
                        <span
                          className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-surface-container-highest ring-4 ring-surface-container-lowest"
                        ></span>
                        <p
                          className="font-label-md text-label-md font-semibold text-on-surface"
                        >
                          HackerRank Assessment Suite Cleared
                        </p>
                        <p
                          className="font-body-sm text-body-sm text-on-surface-variant mt-0.5"
                        >
                          Automated webhook recorded 292/300 score with zero
                          proctoring infractions
                        </p>
                        <span
                          className="font-label-caps text-label-caps text-outline"
                          >13 Feb 2025, 21:04:40 IST</span
                        >
                      </div>
                      <div className="relative">
                        <span
                          className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-surface-container-highest ring-4 ring-surface-container-lowest"
                        ></span>
                        <p
                          className="font-label-md text-label-md font-semibold text-on-surface"
                        >
                          Stage Moved: Applied → Technical Evaluation
                        </p>
                        <p
                          className="font-body-sm text-body-sm text-on-surface-variant mt-0.5"
                        >
                          Candidate passed auto-screening criteria based on
                          notice period (&lt;45d) and Go experience (&gt;4y)
                        </p>
                        <span
                          className="font-label-caps text-label-caps text-outline"
                          >12 Feb 2025, 10:15:22 IST</span
                        >
                      </div>
                      <div className="relative">
                        <span
                          className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-primary-container ring-4 ring-surface-container-lowest"
                        ></span>
                        <p
                          className="font-label-md text-label-md font-semibold text-on-surface"
                        >
                          Candidate Profile Ingested
                        </p>
                        <p
                          className="font-body-sm text-body-sm text-on-surface-variant mt-0.5"
                        >
                          Referral submission by Swetha M. with resume
                          attachment Karthik_R_Resume_2025.pdf
                        </p>
                        <span
                          className="font-label-caps text-label-caps text-outline"
                          >12 Feb 2025, 10:14:01 IST</span
                        >
                      </div>
                    </div>
                  </div>
                </div>
              </main>
            </div>
          </div>
          
          
          
          
          <div
            className={"modal-backdrop fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm items-center justify-center p-4" + (modal==='modal-move-stage' ? ' flex' : ' hidden')} id="modal-move-stage"
          >
            <div
              className="bg-surface-container-lowest rounded-xl max-w-md w-full p-space-lg shadow-2xl flex flex-col gap-space-md"
            >
              <div className="flex items-center justify-between">
                <h3
                  className="font-headline-sm text-headline-sm font-bold text-on-surface"
                >
                  Advance Candidate Stage
                </h3>
                <button
                  className="p-1 rounded hover:bg-surface-container text-outline hover:text-on-surface"
                  onClick={event=>{closeModal('modal-move-stage')}}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Select the target lifecycle milestone for Karthik Ramanathan
                (REQ-2025-089):
              </p>
              <div className="space-y-2">
                <label
                  className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low hover:bg-surface-container cursor-pointer transition-colors"
                >
                  <input
                    
                    className="w-4 h-4 text-primary focus:ring-primary"
                    name="target-stage"
                    type="radio"
                    
                   aria-label={"Mark as Private (Visible to Hiring Manager & HR Director only)"}   checked={stageTarget==='Tech Round 2'} onChange={()=>setStageTarget('Tech Round 2')} />
                  <div>
                    <p
                      className="font-label-md text-label-md font-semibold text-on-surface"
                    >
                      Interview - Tech Round 2 (Current)
                    </p>
                    <p className="text-xs text-outline">
                      System Architecture discussion
                    </p>
                  </div>
                </label>
                <label
                  className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low hover:bg-surface-container cursor-pointer transition-colors"
                >
                  <input
                    className="w-4 h-4 text-primary focus:ring-primary"
                    name="target-stage"
                    type="radio"
                    
                   aria-label={"Interview - Tech Round 2 (Current) System Architecture discussion"}   checked={stageTarget==='Bar-Raiser Round'} onChange={()=>setStageTarget('Bar-Raiser Round')} />
                  <div>
                    <p
                      className="font-label-md text-label-md font-semibold text-on-surface"
                    >
                      Interview - Round 3 (Bar-Raiser)
                    </p>
                    <p className="text-xs text-outline">
                      Engineering Leadership &amp; Cultural Alignment
                    </p>
                  </div>
                </label>
                <label
                  className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low hover:bg-surface-container cursor-pointer transition-colors"
                >
                  <input
                    className="w-4 h-4 text-primary focus:ring-primary"
                    name="target-stage"
                    type="radio"
                    
                   aria-label={"Interview - Round 3 (Bar-Raiser) Engineering Leadership & Cultural Alignment"}   checked={stageTarget==='Offer Stage'} onChange={()=>setStageTarget('Offer Stage')} />
                  <div>
                    <p
                      className="font-label-md text-label-md font-semibold text-on-surface"
                    >
                      Offer Generation &amp; Negotiation
                    </p>
                    <p className="text-xs text-outline">
                      Proceed to roll out formal compensation package
                    </p>
                  </div>
                </label>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium"
                  onClick={event=>{closeModal('modal-move-stage')}}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-semibold"
                  onClick={event=>{confirmStageMove()}}
                >
                  Advance Stage
                </button>
              </div>
            </div>
          </div>
          
          <div
            className={"modal-backdrop fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm items-center justify-center p-4" + (modal==='modal-offer' ? ' flex' : ' hidden')} id="modal-offer"
          >
            <div
              className="bg-surface-container-lowest rounded-xl max-w-2xl w-full p-space-lg shadow-2xl flex flex-col gap-space-md max-h-[921px] overflow-y-auto"
            >
              <div
                className="flex items-center justify-between border-b border-surface-container pb-3"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-2xl"
                    >workspace_premium</span
                  >
                  <div>
                    <h3
                      className="font-headline-sm text-headline-sm font-bold text-on-surface"
                    >
                      Generate Offer &amp; CTC Structuring
                    </h3>
                    <p className="font-label-caps text-label-caps text-outline">
                      REQ-2025-089 • Senior Backend Lead
                    </p>
                  </div>
                </div>
                <button
                  className="p-1 rounded hover:bg-surface-container text-outline hover:text-on-surface"
                  onClick={event=>{closeModal('modal-offer')}}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    className="block font-label-md text-label-md text-on-surface font-semibold mb-1"
                    >Offer Template</label
                  >
                  <select
                    className="w-full px-3 py-2 rounded-lg bg-surface-container-low border-0 font-body-sm text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
                   aria-label={"Offer Template"} value={fields["field5"]} onChange={event=>setField("field5",event.target.value)}>
                    <option>Standard India Tech Lead Offer (Tier-1)</option>
                    <option>Accelerated Joining Incentive Package</option>
                    <option>Leadership Equity Heavy Package</option>
                  </select>
                </div>
                <div>
                  <label
                    className="block font-label-md text-label-md text-on-surface font-semibold mb-1"
                    >Target Start Date</label
                  >
                  <input
                    className="w-full px-3 py-2 rounded-lg bg-surface-container-low border-0 font-body-sm text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
                    type="date"
                    
                   aria-label={"Target Start Date"} value={fields["field6"]} onChange={event=>setField("field6",event.target.value)} />
                </div>
              </div>
              
              <div
                className="bg-surface-container-low rounded-xl p-4 flex flex-col gap-3"
              >
                <span
                  className="font-label-caps text-label-caps uppercase text-outline font-bold tracking-wider"
                  >Annual Compensation Breakdown (INR ₹)</span
                >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-on-surface-variant font-medium"
                      >Fixed Base Salary</label
                    >
                    <div className="relative mt-1">
                      <span
                        className="absolute left-2.5 top-2 text-outline font-semibold text-xs"
                        >₹</span
                      >
                      <input
                        className="w-full pl-6 pr-2 py-1.5 rounded-lg bg-surface-container-lowest border-0 font-body-sm text-body-sm text-on-surface font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                        id="offer-base-input"
                        
                        type="number"
                        
                       aria-label={"offer-base-input"} value={fields["offer-base-input"]} onChange={event=>setField("offer-base-input",event.target.value)} />
                    </div>
                    <span className="text-[10px] text-outline"
                      >₹40,00,000 / annum</span
                    >
                  </div>
                  <div>
                    <label className="text-xs text-on-surface-variant font-medium"
                      >Performance Variable (15%)</label
                    >
                    <div className="relative mt-1">
                      <span
                        className="absolute left-2.5 top-2 text-outline font-semibold text-xs"
                        >₹</span
                      >
                      <input
                        className="w-full pl-6 pr-2 py-1.5 rounded-lg bg-surface-container-lowest border-0 font-body-sm text-body-sm text-on-surface font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                        id="offer-var-input"
                        
                        type="number"
                        
                       aria-label={"offer-var-input"} value={fields["offer-var-input"]} onChange={event=>setField("offer-var-input",event.target.value)} />
                    </div>
                    <span className="text-[10px] text-outline"
                      >₹6,00,000 / annum</span
                    >
                  </div>
                  <div>
                    <label className="text-xs text-on-surface-variant font-medium"
                      >ESOP Grant (Annualized)</label
                    >
                    <div className="relative mt-1">
                      <span
                        className="absolute left-2.5 top-2 text-outline font-semibold text-xs"
                        >₹</span
                      >
                      <input
                        className="w-full pl-6 pr-2 py-1.5 rounded-lg bg-surface-container-lowest border-0 font-body-sm text-body-sm text-on-surface font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                        id="offer-esop-input"
                        
                        type="number"
                        
                       aria-label={"offer-esop-input"} value={fields["offer-esop-input"]} onChange={event=>setField("offer-esop-input",event.target.value)} />
                    </div>
                    <span className="text-[10px] text-outline"
                      >4-year vesting with 1-yr cliff</span
                    >
                  </div>
                </div>
                <div
                  className="mt-2 pt-3 border-t border-surface-container flex items-center justify-between"
                >
                  <span
                    className="font-title-md text-title-md font-bold text-on-surface"
                    >Total Target Annual CTC:</span
                  >
                  <span
                    className="font-display-sm text-display-sm font-bold text-primary"
                    id="offer-total-display"
                    >{formattedCtc}</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <button
                  className="px-3 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium flex items-center gap-1.5"
                  onClick={event=>{
                    showToast('Offer PDF preview is a prototype. No file was generated.')
                  }}
                  type="button"
                >
                  <span className="material-symbols-outlined text-base"
                    >visibility</span
                  >
                  Preview Offer PDF
                </button>
                <div className="flex items-center gap-2">
                  <button
                    className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium"
                    onClick={event=>{closeModal('modal-offer')}}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-semibold flex items-center gap-1.5 shadow-sm"
                    onClick={event=>{confirmSendOffer()}}
                  >
                    <span className="material-symbols-outlined text-base"
                      >send</span
                    >
                    Dispatched Formal Offer
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div
            className={"modal-backdrop fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm items-center justify-center p-4" + (modal==='modal-hire' ? ' flex' : ' hidden')} id="modal-hire"
          >
            <div
              className="bg-surface-container-lowest rounded-xl max-w-md w-full p-space-lg shadow-2xl flex flex-col gap-space-md"
            >
              <div className="flex items-center gap-3 text-primary">
                <span className="material-symbols-outlined text-3xl"
                  >how_to_reg</span
                >
                <div>
                  <h3
                    className="font-headline-sm text-headline-sm font-bold text-on-surface"
                  >
                    Finalize &amp; Convert to Hire
                  </h3>
                  <p className="font-label-caps text-label-caps text-outline">
                    Transition from Candidate to Employee
                  </p>
                </div>
              </div>
              <div
                className="space-y-3 font-body-sm text-body-sm text-on-surface-variant"
              >
                <p>
                  This action will finalize Karthik Ramanathan's candidacy,
                  close open requisition <strong>REQ-2025-089</strong>, and
                  auto-provision the corporate onboarding profile.
                </p>
                <div className="p-3 rounded-lg bg-surface-container-low space-y-1">
                  <div className="flex justify-between">
                    <span className="text-outline">Assigned Employee ID:</span>
                    <span className="font-bold text-on-surface"
                      >EMS-EMP-2025-1049</span
                    >
                  </div>
                  <div className="flex justify-between">
                    <span className="text-outline">Department Pod:</span>
                    <span className="font-medium text-on-surface"
                      >Core Infrastructure / Platform SRE</span
                    >
                  </div>
                  <div className="flex justify-between">
                    <span className="text-outline">Reporting Manager:</span>
                    <span className="font-medium text-on-surface"
                      >Swetha M. (VP Engg)</span
                    >
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium"
                  onClick={event=>{closeModal('modal-hire')}}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-semibold"
                  onClick={event=>{confirmHireAction()}}
                >
                  Confirm &amp; Hire
                </button>
              </div>
            </div>
          </div>
          
          <div
            className={"modal-backdrop fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm items-center justify-center p-4" + (modal==='modal-joining' ? ' flex' : ' hidden')} id="modal-joining"
          >
            <div
              className="bg-surface-container-lowest rounded-xl max-w-lg w-full p-space-lg shadow-2xl flex flex-col gap-space-md"
            >
              <div className="flex items-center justify-between">
                <h3
                  className="font-headline-sm text-headline-sm font-bold text-on-surface flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-primary"
                    >event_available</span
                  >
                  Confirm Joining &amp; IT Dispatch
                </h3>
                <button
                  className="p-1 rounded hover:bg-surface-container text-outline hover:text-on-surface"
                  onClick={event=>{closeModal('modal-joining')}}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="space-y-3 font-body-sm text-body-sm">
                <div>
                  <label
                    className="block font-label-md text-label-md text-on-surface font-semibold mb-1"
                    >Confirmed Joining Date</label
                  >
                  <input
                    className="w-full px-3 py-2 rounded-lg bg-surface-container-low border-0 font-body-sm text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
                    type="date"
                    
                   aria-label={"Confirmed Joining Date"} value={fields["field7"]} onChange={event=>setField("field7",event.target.value)} />
                </div>
                <p
                  className="font-label-md text-label-md font-semibold text-on-surface pt-1"
                >
                  Automated Pre-Joining Workflows to Trigger:
                </p>
                <div className="space-y-2">
                  <label
                    className="flex items-center gap-2.5 p-2 rounded bg-surface-container-low cursor-pointer"
                  >
                    <input
                      
                      className="w-4 h-4 text-primary focus:ring-primary"
                      type="checkbox"
                     aria-label={"Confirmed Joining Date"} checked={Boolean(fields["field8"])} onChange={event=>setField("field8",event.target.checked)} />
                    <span
                      >Dispatch Welcome Swag Kit to Koramangala, Bengaluru
                      address</span
                    >
                  </label>
                  <label
                    className="flex items-center gap-2.5 p-2 rounded bg-surface-container-low cursor-pointer"
                  >
                    <input
                      
                      className="w-4 h-4 text-primary focus:ring-primary"
                      type="checkbox"
                     aria-label={"Dispatch Welcome Swag Kit to Koramangala, Bengaluru address"} checked={Boolean(fields["field9"])} onChange={event=>setField("field9",event.target.checked)} />
                    <span
                      >Provision Apple MacBook Pro 16" M3 Max (36GB RAM) via IT
                      Asset desk</span
                    >
                  </label>
                  <label
                    className="flex items-center gap-2.5 p-2 rounded bg-surface-container-low cursor-pointer"
                  >
                    <input
                      
                      className="w-4 h-4 text-primary focus:ring-primary"
                      type="checkbox"
                     aria-label={"Provision Apple MacBook Pro 16\" M3 Max (36GB RAM) via IT Asset desk"} checked={Boolean(fields["field10"])} onChange={event=>setField("field10",event.target.checked)} />
                    <span
                      >Initiate Epfo / UAN transfer and EPFO KYC verification
                      check</span
                    >
                  </label>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium"
                  onClick={event=>{closeModal('modal-joining')}}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-semibold"
                  onClick={event=>{confirmJoiningAction()}}
                >
                  Confirm Joining Date
                </button>
              </div>
            </div>
          </div>
          
          <div
            className={"modal-backdrop fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm items-center justify-center p-4" + (modal==='modal-withdraw' ? ' flex' : ' hidden')} id="modal-withdraw"
          >
            <div
              className="bg-surface-container-lowest rounded-xl max-w-md w-full p-space-lg shadow-2xl flex flex-col gap-space-md"
            >
              <div className="flex items-center justify-between">
                <h3
                  className="font-headline-sm text-headline-sm font-bold text-on-surface"
                >
                  Candidate Withdrawal
                </h3>
                <button
                  className="p-1 rounded hover:bg-surface-container text-outline hover:text-on-surface"
                  onClick={event=>{closeModal('modal-withdraw')}}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Log why Karthik Ramanathan is withdrawing from the recruitment
                funnel:
              </p>
              <div className="space-y-2">
                <label
                  className="flex items-center gap-2.5 p-2.5 rounded bg-surface-container-low cursor-pointer"
                >
                  <input
                    
                    className="w-4 h-4 text-primary"
                    name="withdraw-reason"
                    type="radio"
                   aria-label={"Initiate Epfo / UAN transfer and EPFO KYC verification check"} defaultChecked={true} />
                  <span className="text-body-sm"
                    >Accepted competing offer (e.g. Google / Uber /
                    Atlassian)</span
                  >
                </label>
                <label
                  className="flex items-center gap-2.5 p-2.5 rounded bg-surface-container-low cursor-pointer"
                >
                  <input
                    className="w-4 h-4 text-primary"
                    name="withdraw-reason"
                    type="radio"
                   aria-label={"Accepted competing offer (e.g. Google / Uber / Atlassian)"} defaultChecked={false} />
                  <span className="text-body-sm"
                    >Counter-offered &amp; retained by current employer
                    (Swiggy)</span
                  >
                </label>
                <label
                  className="flex items-center gap-2.5 p-2.5 rounded bg-surface-container-low cursor-pointer"
                >
                  <input
                    className="w-4 h-4 text-primary"
                    name="withdraw-reason"
                    type="radio"
                   aria-label={"Counter-offered & retained by current employer (Swiggy)"} defaultChecked={false} />
                  <span className="text-body-sm"
                    >Personal / Relocation / Health constraints</span
                  >
                </label>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium"
                  onClick={event=>{closeModal('modal-withdraw')}}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/90 text-on-secondary font-label-md text-label-md font-semibold"
                  onClick={event=>{confirmWithdrawAction()}}
                >
                  Confirm Withdrawal
                </button>
              </div>
            </div>
          </div>
          
          <div
            className={"modal-backdrop fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm items-center justify-center p-4" + (modal==='modal-blacklist' ? ' flex' : ' hidden')} id="modal-blacklist"
          >
            <div
              className="bg-surface-container-lowest rounded-xl max-w-md w-full p-space-lg shadow-2xl flex flex-col gap-space-md border-t-4 border-t-error"
            >
              <div className="flex items-center gap-2 text-error">
                <span className="material-symbols-outlined text-2xl">gavel</span>
                <h3 className="font-headline-sm text-headline-sm font-bold">
                  Blacklist Candidate Flag
                </h3>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                This action tags Karthik Ramanathan across all company entity
                talent pools. Future applications will be hard-blocked
                automatically.
              </p>
              <div>
                <label
                  className="block font-label-md text-label-md text-on-surface font-semibold mb-1"
                  >Blacklist Compliance Reason</label
                >
                <select
                  className="w-full px-3 py-2 rounded-lg bg-surface-container-low border-0 font-body-sm text-body-sm text-on-surface focus:ring-2 focus:ring-error focus:outline-none"
                 aria-label={"Blacklist Compliance Reason"} value={fields["field14"]} onChange={event=>setField("field14",event.target.value)}>
                  <option>Credential or Academic Misrepresentation</option>
                  <option>Dual Employment / Moonlighting Violation</option>
                  <option>Severe Code Integrity / Plagiarism in Sandbox</option>
                  <option>No-Show On Day of Joining without Notice</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium"
                  onClick={event=>{closeModal('modal-blacklist')}}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-error hover:bg-error/90 text-on-error font-label-md text-label-md font-semibold"
                  onClick={event=>{confirmBlacklistAction()}}
                >
                  Flag &amp; Blacklist
                </button>
              </div>
            </div>
          </div>
          
          <div
            className={"modal-backdrop fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm items-center justify-center p-4" + (modal==='modal-archive' ? ' flex' : ' hidden')} id="modal-archive"
          >
            <div
              className="bg-surface-container-lowest rounded-xl max-w-md w-full p-space-lg shadow-2xl flex flex-col gap-space-md"
            >
              <h3
                className="font-headline-sm text-headline-sm font-bold text-on-surface"
              >
                Archive Candidate to Talent Pool
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Move Karthik Ramanathan to the passive "Distributed Systems -
                Silver Medalists" pipeline for consideration in future H2
                requisition cycles.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium"
                  onClick={event=>{closeModal('modal-archive')}}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-semibold"
                  onClick={event=>{confirmArchiveAction()}}
                >
                  Archive Record
                </button>
              </div>
            </div>
          </div>
          
          <div
            className={"modal-backdrop fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm items-center justify-center p-4" + (modal==='modal-delete' ? ' flex' : ' hidden')} id="modal-delete"
          >
            <div
              className="bg-surface-container-lowest rounded-xl max-w-md w-full p-space-lg shadow-2xl flex flex-col gap-space-md border-t-4 border-t-error"
            >
              <div className="flex items-center gap-2 text-error">
                <span className="material-symbols-outlined text-3xl">warning</span>
                <h3 className="font-headline-sm text-headline-sm font-bold">
                  Irreversible Deletion
                </h3>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                This permanently purges Karthik Ramanathan's scorecards, ATS
                parsed resume data, email interactions, and interview records.
                This cannot be undone.
              </p>
              <div>
                <label
                  className="block font-label-md text-label-md text-error font-semibold mb-1"
                  >To confirm, type "DELETE CANDIDATE" below:</label
                >
                <input
                  className="w-full px-3 py-2 rounded-lg bg-surface-container-low border-0 font-body-sm text-body-sm text-on-surface focus:ring-2 focus:ring-error focus:outline-none"
                  id="delete-confirm-input"
                  
                  placeholder="DELETE CANDIDATE"
                  type="text"
                 aria-label={"delete-confirm-input"} value={fields["delete-confirm-input"]} onChange={event=>setField("delete-confirm-input",event.target.value)} />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium"
                  onClick={event=>{closeModal('modal-delete')}}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-error text-on-error font-label-md text-label-md font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  disabled={fields["delete-confirm-input"]?.trim()!=="DELETE CANDIDATE"} id="btn-delete-final"
                  onClick={event=>{confirmDeleteAction()}}
                >
                  Permanently Delete
                </button>
              </div>
            </div>
          </div>
          
          <div
            className={"modal-backdrop fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm items-center justify-center p-4" + (modal==='modal-schedule' ? ' flex' : ' hidden')} id="modal-schedule"
          >
            <div
              className="bg-surface-container-lowest rounded-xl max-w-lg w-full p-space-lg shadow-2xl flex flex-col gap-space-md"
            >
              <div className="flex items-center justify-between">
                <h3
                  className="font-headline-sm text-headline-sm font-bold text-on-surface flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-primary"
                    >calendar_month</span
                  >
                  Schedule Interview Session
                </h3>
                <button
                  className="p-1 rounded hover:bg-surface-container text-outline hover:text-on-surface"
                  onClick={event=>{closeModal('modal-schedule')}}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <form
                className="space-y-3 font-body-sm text-body-sm"
                onSubmit={event=>{confirmScheduleInterview(event)}}
              >
                <div>
                  <label
                    className="block font-label-md text-label-md text-on-surface font-semibold mb-1"
                    >Interview Round</label
                  >
                  <select
                    className="w-full px-3 py-2 rounded-lg bg-surface-container-low border-0 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
                   aria-label={"Interview Round"} value={fields["field15"]} onChange={event=>setField("field15",event.target.value)}>
                    <option>
                      Round 2: Distributed Systems &amp; Partitioning
                    </option>
                    <option>
                      Round 3: Engineering Leadership &amp; Bar-Raiser
                    </option>
                    <option>Executive Fitment Chat (VP Engg)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      className="block font-label-md text-label-md text-on-surface font-semibold mb-1"
                      >Date</label
                    >
                    <input
                      className="w-full px-3 py-2 rounded-lg bg-surface-container-low border-0 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
                      type="date"
                      
                     aria-label={"Date"} value={fields["field16"]} onChange={event=>setField("field16",event.target.value)} />
                  </div>
                  <div>
                    <label
                      className="block font-label-md text-label-md text-on-surface font-semibold mb-1"
                      >Time Slot (IST)</label
                    >
                    <input
                      className="w-full px-3 py-2 rounded-lg bg-surface-container-low border-0 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
                      type="time"
                      
                     aria-label={"Time Slot (IST)"} value={fields["field17"]} onChange={event=>setField("field17",event.target.value)} />
                  </div>
                </div>
                <div>
                  <label
                    className="block font-label-md text-label-md text-on-surface font-semibold mb-1"
                    >Interviewer Panelist</label
                  >
                  <input
                    className="w-full px-3 py-2 rounded-lg bg-surface-container-low border-0 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
                    type="text"
                    
                   aria-label={"Interviewer Panelist"} value={fields["field18"]} onChange={event=>setField("field18",event.target.value)} />
                </div>
                <div>
                  <label
                    className="block font-label-md text-label-md text-on-surface font-semibold mb-1"
                    >Meeting Mode</label
                  >
                  <div className="flex items-center gap-2">
                    <span
                      className="px-3 py-2 rounded-lg bg-surface-container text-on-surface font-semibold flex items-center gap-1.5 flex-1"
                    >
                      <span
                        className="material-symbols-outlined text-primary text-base"
                        >videocam</span
                      >
                      Google Meet (Auto-generated)
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium"
                    onClick={event=>{closeModal('modal-schedule')}}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-semibold"
                    type="submit"
                  >
                    Confirm &amp; Send Cal Invites
                  </button>
                </div>
              </form>
            </div>
          </div>
          
          <div
            className={"modal-backdrop fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm items-center justify-center p-4" + (modal==='modal-feedback' ? ' flex' : ' hidden')} id="modal-feedback"
          >
            <div
              className="bg-surface-container-lowest rounded-xl max-w-xl w-full p-space-lg shadow-2xl flex flex-col gap-space-md max-h-[921px] overflow-y-auto"
            >
              <div
                className="flex items-center justify-between border-b border-surface-container pb-2"
              >
                <h3
                  className="font-headline-sm text-headline-sm font-bold text-on-surface flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-primary"
                    >rate_review</span
                  >
                  Interviewer Scorecard Submission
                </h3>
                <button
                  className="p-1 rounded hover:bg-surface-container text-outline hover:text-on-surface"
                  onClick={event=>{closeModal('modal-feedback')}}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <form
                className="space-y-4 font-body-sm text-body-sm"
                onSubmit={event=>{confirmSubmitFeedback(event)}}
              >
                <div>
                  <label
                    className="block font-label-md text-label-md text-on-surface font-semibold mb-1"
                    >Overall Recommendation</label
                  >
                  <select
                    className="w-full px-3 py-2 rounded-lg bg-surface-container-low border-0 text-on-surface font-semibold focus:ring-2 focus:ring-primary focus:outline-none"
                   aria-label={"Overall Recommendation"} value={fields["field19"]} onChange={event=>setField("field19",event.target.value)}>
                    <option >
                      Strong Hire (Top 5% backend talent)
                    </option>
                    <option>Hire (Meets standard bar)</option>
                    <option>Weak Hire (Needs leveling down)</option>
                    <option>No Hire</option>
                  </select>
                </div>
                
                <div className="space-y-3 bg-surface-container-low p-3 rounded-lg">
                  <div>
                    <div
                      className="flex justify-between text-xs font-semibold mb-1"
                    >
                      <span>Concurrency &amp; Mutex Mastery</span>
                      <span className="text-primary">4.9 / 5.0</span>
                    </div>
                    <input
                      className="w-full accent-primary"
                      max="5"
                      min="1"
                      step="0.1"
                      type="range"
                      
                     aria-label={"Overall Recommendation"} value={fields["field20"]} onChange={event=>setField("field20",event.target.value)} />
                  </div>
                  <div>
                    <div
                      className="flex justify-between text-xs font-semibold mb-1"
                    >
                      <span>Distributed Caching &amp; Invalidation</span>
                      <span className="text-primary">4.7 / 5.0</span>
                    </div>
                    <input
                      className="w-full accent-primary"
                      max="5"
                      min="1"
                      step="0.1"
                      type="range"
                      
                     aria-label={"Overall Recommendation"} value={fields["field21"]} onChange={event=>setField("field21",event.target.value)} />
                  </div>
                  <div>
                    <div
                      className="flex justify-between text-xs font-semibold mb-1"
                    >
                      <span>Fault Tolerance &amp; Partitioning</span>
                      <span className="text-primary">4.8 / 5.0</span>
                    </div>
                    <input
                      className="w-full accent-primary"
                      max="5"
                      min="1"
                      step="0.1"
                      type="range"
                      
                     aria-label={"Overall Recommendation"} value={fields["field22"]} onChange={event=>setField("field22",event.target.value)} />
                  </div>
                </div>
                <div>
                  <label
                    className="block font-label-md text-label-md text-on-surface font-semibold mb-1"
                    >Detailed Technical Feedback &amp; Justification</label
                  >
                  <textarea
                    className="w-full p-3 rounded-lg bg-surface-container-low border-0 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none leading-relaxed"
                    placeholder="Highlight algorithmic accuracy, code modularity, and operational maturity..."
                    rows="4"
                   aria-label={"Detailed Technical Feedback & Justification"} value={fields["field23"]} onChange={event=>setField("field23",event.target.value)} />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium"
                    onClick={event=>{closeModal('modal-feedback')}}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-semibold"
                    type="submit"
                  >
                    Submit Formal Scorecard
                  </button>
                </div>
              </form>
            </div>
          </div>
          
          <div
            className={"modal-backdrop fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm items-center justify-center p-4" + (modal==='modal-assign-test' ? ' flex' : ' hidden')} id="modal-assign-test"
          >
            <div
              className="bg-surface-container-lowest rounded-xl max-w-md w-full p-space-lg shadow-2xl flex flex-col gap-space-md"
            >
              <div className="flex items-center justify-between">
                <h3
                  className="font-headline-sm text-headline-sm font-bold text-on-surface"
                >
                  Assign Coding Assessment
                </h3>
                <button
                  className="p-1 rounded hover:bg-surface-container text-outline hover:text-on-surface"
                  onClick={event=>{closeModal('modal-assign-test')}}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="space-y-3 font-body-sm text-body-sm">
                <div>
                  <label
                    className="block font-label-md text-label-md text-on-surface font-semibold mb-1"
                    >Assessment Suite</label
                  >
                  <select
                    className="w-full px-3 py-2 rounded-lg bg-surface-container-low border-0 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
                   aria-label={"Assessment Suite"} value={fields["field24"]} onChange={event=>setField("field24",event.target.value)}>
                    <option>
                      HackerRank - Staff Backend Systems (Go, Kafka, EKS)
                    </option>
                    <option>
                      Codility - Distributed Cache &amp; Sharding Benchmark
                    </option>
                    <option>
                      LeetCode Enterprise - Hard Dynamic Programming Pod
                    </option>
                  </select>
                </div>
                <div>
                  <label
                    className="block font-label-md text-label-md text-on-surface font-semibold mb-1"
                    >Completion Deadline</label
                  >
                  <input
                    className="w-full px-3 py-2 rounded-lg bg-surface-container-low border-0 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
                    type="date"
                    
                   aria-label={"Completion Deadline"} value={fields["field25"]} onChange={event=>setField("field25",event.target.value)} />
                </div>
                <div>
                  <label
                    className="block font-label-md text-label-md text-on-surface font-semibold mb-1"
                    >Passing Cutoff Threshold</label
                  >
                  <div className="flex items-center gap-2">
                    <input
                      className="w-full px-3 py-2 rounded-lg bg-surface-container border-0 text-on-surface-variant font-medium"
                      readOnly
                      type="text"
                      
                     aria-label={"Passing Cutoff Threshold"} value={fields["field26"]} onChange={event=>setField("field26",event.target.value)} />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium"
                  onClick={event=>{closeModal('modal-assign-test')}}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-semibold"
                  onClick={event=>{confirmAssignTest()}}
                >
                  Dispatch Test Link
                </button>
              </div>
            </div>
          </div>
          
          <div
            className={"modal-backdrop fixed inset-0 z-50 bg-inverse-surface/60 backdrop-blur-md items-center justify-center p-4" + (modal==='modal-resume-fullscreen' ? ' flex' : ' hidden')} id="modal-resume-fullscreen"
          >
            <div
              className="bg-surface-container-lowest rounded-xl max-w-4xl w-full h-[921px] shadow-2xl flex flex-col overflow-hidden"
            >
              
              <div
                className="p-4 bg-surface-container-high flex items-center justify-between border-b border-surface-container"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl"
                    >description</span
                  >
                  <span
                    className="font-headline-sm text-headline-sm font-semibold text-on-surface"
                    >Karthik_R_Resume_2025.pdf (Inspection View)</span
                  >
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-1.5 rounded-lg bg-surface text-on-surface font-label-md text-label-md font-medium hover:bg-surface-container shadow-sm flex items-center gap-1"
                    onClick={event=>{triggerPdfDownload()}}
                  >
                    <span className="material-symbols-outlined text-base"
                      >download</span
                    >
                    Download
                  </button>
                  <button
                    className="p-1.5 rounded-lg hover:bg-surface-container text-outline hover:text-on-surface"
                    onClick={event=>{closeModal('modal-resume-fullscreen')}}
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
              </div>
              
              <div
                className="flex-1 overflow-y-auto p-8 bg-surface-container-low flex justify-center"
              >
                <div
                  className="bg-surface-container-lowest max-w-2xl w-full p-8 shadow-md rounded-lg flex flex-col gap-4 font-body-sm text-body-sm leading-relaxed text-on-surface"
                >
                  <div className="border-b border-surface-container pb-4">
                    <h1
                      className="font-display-sm text-display-sm font-bold text-on-surface"
                    >
                      KARTHIK RAMANATHAN
                    </h1>
                    <p className="text-on-surface-variant mt-1">
                      Staff Site Reliability Engineer &amp; Distributed Backend
                      Lead
                    </p>
                    <p className="text-outline text-xs mt-0.5">
                      Bengaluru, KA | karthik.r@techmail.internal |
                      github.com/karthikr-dist |
                      linkedin.com/in/karthik-r-swiggy
                    </p>
                  </div>
                  <div>
                    <h2
                      className="font-label-caps text-label-caps uppercase text-primary font-bold tracking-wider"
                    >
                      TECHNICAL SKILLS
                    </h2>
                    <p className="mt-1 text-on-surface-variant">
                      <strong>Languages:</strong> Go (Expert), Rust
                      (Intermediate), Python, SQL, C++
                    </p>
                    <p className="text-on-surface-variant">
                      <strong>Distributed Systems:</strong> Kafka, Envoy Proxy,
                      Redis, CockroachDB, Citus Postgres, Raft Protocol
                    </p>
                    <p className="text-on-surface-variant">
                      <strong>Infrastructure:</strong> AWS (EKS, MSK, RDS),
                      Terraform, Kubernetes Operators, Datadog, Prometheus,
                      Grafana
                    </p>
                  </div>
                  <div>
                    <h2
                      className="font-label-caps text-label-caps uppercase text-primary font-bold tracking-wider"
                    >
                      PROFESSIONAL WORK HISTORY
                    </h2>
                    <div className="mt-2">
                      <div
                        className="flex justify-between items-baseline font-semibold text-on-surface"
                      >
                        <span>Staff SRE / Backend Lead — Swiggy Platforms</span>
                        <span className="text-xs text-outline"
                          >Oct 2021 – Present</span
                        >
                      </div>
                      <ul
                        className="list-disc list-inside mt-1 space-y-1 text-on-surface-variant"
                      >
                        <li>
                          Architected the multi-cluster geo-routing gateway
                          processing 350,000+ API calls/sec during
                          high-concurrency food delivery rushes.
                        </li>
                        <li>
                          Engineered zero-loss failover mechanisms between AWS
                          ap-south-1a and ap-south-1b zones, reducing downtime
                          incidents to 0 in 2024.
                        </li>
                        <li>
                          Mentored 14 senior engineers across distributed
                          locking semantics and asynchronous worker pipeline
                          designs.
                        </li>
                      </ul>
                    </div>
                    <div className="mt-4">
                      <div
                        className="flex justify-between items-baseline font-semibold text-on-surface"
                      >
                        <span
                          >Senior Software Engineer — Razorpay Payment
                          Engine</span
                        >
                        <span className="text-xs text-outline"
                          >Jul 2018 – Sep 2021</span
                        >
                      </div>
                      <ul
                        className="list-disc list-inside mt-1 space-y-1 text-on-surface-variant"
                      >
                        <li>
                          Implemented the core idempotency state-machine
                          processing UPI 2.0 transaction authorization webhooks.
                        </li>
                        <li>
                          Authored in-house Go connection poolers reducing p99
                          latency from 45ms to 11ms on high-volume merchant
                          routes.
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div>
                    <h2
                      className="font-label-caps text-label-caps uppercase text-primary font-bold tracking-wider"
                    >
                      EDUCATION
                    </h2>
                    <div
                      className="flex justify-between items-baseline font-semibold text-on-surface mt-1"
                    >
                      <span
                        >National Institute of Technology Karnataka (NIT
                        Surathkal)</span
                      >
                      <span className="text-xs text-outline">2013 – 2017</span>
                    </div>
                    <p className="text-on-surface-variant text-xs">
                      Bachelor of Technology in Computer Science &amp;
                      Engineering | CGPA: 9.14 / 10.0
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div
            className={"modal-backdrop fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm items-center justify-center p-4" + (modal==='modal-reschedule' ? ' flex' : ' hidden')} id="modal-reschedule"
          >
            <div
              className="bg-surface-container-lowest rounded-xl max-w-md w-full p-space-lg shadow-2xl flex flex-col gap-space-md"
            >
              <div className="flex items-center justify-between">
                <h3
                  className="font-headline-sm text-headline-sm font-bold text-on-surface"
                >
                  Reschedule Round 2
                </h3>
                <button
                  className="p-1 rounded hover:bg-surface-container text-outline hover:text-on-surface"
                  onClick={event=>{closeModal('modal-reschedule')}}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="space-y-3 font-body-sm text-body-sm">
                <div>
                  <label
                    className="block font-label-md text-label-md text-on-surface font-semibold mb-1"
                    >New Date</label
                  >
                  <input
                    className="w-full px-3 py-2 rounded-lg bg-surface-container-low border-0 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
                    type="date"
                    
                   aria-label={"New Date"} value={fields["field27"]} onChange={event=>setField("field27",event.target.value)} />
                </div>
                <div>
                  <label
                    className="block font-label-md text-label-md text-on-surface font-semibold mb-1"
                    >New Time (IST)</label
                  >
                  <input
                    className="w-full px-3 py-2 rounded-lg bg-surface-container-low border-0 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
                    type="time"
                    
                   aria-label={"New Time (IST)"} value={fields["field28"]} onChange={event=>setField("field28",event.target.value)} />
                </div>
                <div>
                  <label
                    className="block font-label-md text-label-md text-on-surface font-semibold mb-1"
                    >Reason for Rescheduling</label
                  >
                  <input
                    className="w-full px-3 py-2 rounded-lg bg-surface-container-low border-0 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
                    type="text"
                    
                   aria-label={"Reason for Rescheduling"} value={fields["field29"]} onChange={event=>setField("field29",event.target.value)} />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium"
                  onClick={event=>{closeModal('modal-reschedule')}}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-semibold"
                  onClick={event=>{confirmRescheduleAction()}}
                >
                  Reschedule &amp; Notify
                </button>
              </div>
            </div>
          </div>
          
          <div
            className={"modal-backdrop fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm items-center justify-center p-4" + (modal==='modal-cancel-interview' ? ' flex' : ' hidden')} id="modal-cancel-interview"
          >
            <div
              className="bg-surface-container-lowest rounded-xl max-w-md w-full p-space-lg shadow-2xl flex flex-col gap-space-md"
            >
              <div className="flex items-center gap-2 text-error">
                <span className="material-symbols-outlined text-2xl"
                  >event_busy</span
                >
                <h3 className="font-headline-sm text-headline-sm font-bold">
                  Cancel Scheduled Round
                </h3>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Are you sure you want to cancel Round 2 (Distributed Systems
                &amp; Partitioning) with Ananya Sengupta? Both parties will
                receive cancellation calendar updates.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium"
                  onClick={event=>{closeModal('modal-cancel-interview')}}
                >
                  Keep Round
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-error text-on-error font-label-md text-label-md font-semibold"
                  onClick={event=>{confirmCancelInterviewAction()}}
                >
                  Cancel Interview
                </button>
              </div>
            </div>
          </div>
          
          </div></main>{modal==="modal-delete-note"&&<div id="modal-delete-note" className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"><div className="bg-surface p-6 rounded-xl space-y-4"><h3 className="text-headline-sm">Delete this note?</h3><div className="flex gap-3"><button onClick={closeModal}>Cancel</button><button onClick={confirmDeleteNote} className="p-2 bg-error text-on-error rounded">Confirm Delete Note</button></div></div></div>}</div></>);
}
