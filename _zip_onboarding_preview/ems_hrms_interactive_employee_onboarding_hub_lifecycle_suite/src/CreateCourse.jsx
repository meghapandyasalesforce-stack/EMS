import { useEffect, useRef, useState } from 'react';
import { Sidebar, Header } from './Layout.jsx';
export default function CreateCourse() {
 const [tab, setTab] = useState('details');
 const [modal, setModal] = useState(null);
 const [toast, setToast] = useState('');
 const timer = useRef();
 const previousFocus = useRef();
 const openModal = id => { previousFocus.current = document.activeElement; setModal(id); };
 const closeModal = () => { setModal(null); previousFocus.current?.focus(); };
 const triggerToast = (message = 'Course draft saved successfully.') => {
  clearTimeout(timer.current); setToast(message);
  timer.current = setTimeout(() => setToast(''), 3000);
 };
 const showSuccessAssign = () => { closeModal(); triggerToast('Course published successfully and assigned to 342 engineers.'); };
 useEffect(() => () => clearTimeout(timer.current), []);
 useEffect(() => {
  if (!modal) return;
  const dialog = document.getElementById('modal-' + modal);
  dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true');
  const items = () => [...dialog.querySelectorAll('button, input, select, textarea, [href]')].filter(el => !el.disabled);
  items()[0]?.focus();
  const oldOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const keydown = event => {
   if (event.key === 'Escape') closeModal();
   if (event.key === 'Tab') {
    const controls = items(), first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
   }
  };
  document.addEventListener('keydown', keydown);
  return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', keydown); };
 }, [modal]);
 return (<><Sidebar activePage="create-course" /><div className="pl-64"><Header /><main className="relative pt-16 bg-surface min-h-screen"><div className="flex flex-col w-full pb-24">

<div className="bg-[#0E2B3D] text-white px-8 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xl z-30">
<div className="flex items-center gap-3">
<span className="px-2.5 py-1 bg-[#1CCA9B]/20 text-[#1CCA9B] font-label-caps text-label-caps rounded-full font-bold uppercase tracking-wider">Simulator Rig</span>
<span className="font-title-md text-title-md text-white/90">Create Course Studio States</span>
</div>
<div className="flex flex-wrap items-center gap-1.5 bg-white/5 p-1 rounded-xl">
<button className={"px-3 py-1 rounded-lg font-label-md text-label-md transition-all" + (tab === 'details' ? ' bg-[#008564] text-white font-semibold' : ' text-white/70 hover:text-white hover:bg-white/5')} id="sim-btn-details" onClick={() => { setTab('details') }}>1. Details</button>
<button className={"px-3 py-1 rounded-lg font-label-md text-label-md transition-all" + (tab === 'modules' ? ' bg-[#008564] text-white font-semibold' : ' text-white/70 hover:text-white hover:bg-white/5')} id="sim-btn-modules" onClick={() => { setTab('modules') }}>2. Modules</button>
<button className={"px-3 py-1 rounded-lg font-label-md text-label-md transition-all" + (tab === 'assessment' ? ' bg-[#008564] text-white font-semibold' : ' text-white/70 hover:text-white hover:bg-white/5')} id="sim-btn-assessment" onClick={() => { setTab('assessment') }}>3. Assessment</button>
<button className={"px-3 py-1 rounded-lg font-label-md text-label-md transition-all" + (tab === 'settings' ? ' bg-[#008564] text-white font-semibold' : ' text-white/70 hover:text-white hover:bg-white/5')} id="sim-btn-settings" onClick={() => { setTab('settings') }}>4. Settings</button>
<button className="px-3 py-1 rounded-lg font-label-md text-label-md transition-all text-[#89f7ce] hover:bg-white/5" onClick={() => { openModal('cover-modal') }}>5. Cover Image</button>
<button className="px-3 py-1 rounded-lg font-label-md text-label-md transition-all text-[#89f7ce] hover:bg-white/5" onClick={() => { openModal('lesson-modal') }}>6. Add Lesson</button>
<button className="px-3 py-1 rounded-lg font-label-md text-label-md transition-all text-[#89f7ce] hover:bg-white/5" onClick={() => { openModal('question-modal') }}>7. Question</button>
<button className="px-3 py-1 rounded-lg font-label-md text-label-md transition-all text-[#89f7ce] hover:bg-white/5" onClick={() => { openModal('preview-modal') }}>8. Learner View</button>
<button className="px-3 py-1 rounded-lg font-label-md text-label-md transition-all text-[#89f7ce] hover:bg-white/5" onClick={() => { triggerToast() }}>9. Toast</button>
<button className="px-3 py-1 rounded-lg font-label-md text-label-md transition-all bg-[#1CCA9B] text-[#002116] font-semibold" onClick={() => { openModal('publish-modal') }}>10. Publish</button>
<button className="px-3 py-1 rounded-lg font-label-md text-label-md transition-all text-rose-300 hover:bg-white/5" onClick={() => { openModal('cancel-modal') }}>11. Discard</button>
</div>
</div>

<div className="max-w-7xl mx-auto w-full px-8 pt-8 space-y-8">

<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)]">
<div className="space-y-1">
<div className="flex items-center gap-2">
<span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#00694f] font-label-caps text-label-caps font-semibold">Drafting Mode</span>
<span className="text-outline font-body-sm">• Last edited 12 Oct 2023, 14:32 IST by Priya Sharma</span>
</div>
<h1 className="font-headline-lg text-headline-lg text-on-surface">Advanced Enterprise Security &amp; Cloud Compliance (L5-L8)</h1>
</div>
<div className="flex items-center gap-3">
<button className="px-4 py-2 rounded-lg font-label-lg text-label-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors" onClick={() => { openModal('cancel-modal') }}>Cancel</button>
<button className="px-4 py-2 rounded-lg font-label-lg text-label-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-2" onClick={() => { triggerToast() }}>
<span className="material-symbols-outlined text-base">save</span> Save Draft
        </button>
<button className="px-4 py-2 rounded-lg font-label-lg text-label-lg text-[#00694f] border border-[#00694f] hover:bg-emerald-50 transition-colors flex items-center gap-2" onClick={() => { openModal('preview-modal') }}>
<span className="material-symbols-outlined text-base">visibility</span> Preview
        </button>
<button className="px-4 py-2 rounded-lg font-label-lg text-label-lg text-white bg-[#00694f] hover:bg-[#00513c] transition-colors shadow-md flex items-center gap-2" onClick={() => { openModal('publish-modal') }}>
<span className="material-symbols-outlined text-base">publish</span> Publish Course
        </button>
</div>
</div>

<div className="flex items-center gap-2 border-b border-outline-variant/30 pb-0">
<button className={"px-5 py-3 font-title-md text-title-md border-b-2 flex items-center gap-2 transition-all" + (tab === 'details' ? ' border-[#00694f] text-[#00694f]' : ' border-transparent text-outline')} id="tab-btn-details" onClick={() => { setTab('details') }}>
<span className="material-symbols-outlined text-lg">description</span> 1. Course Details
      </button>
<button className={"px-5 py-3 font-title-md text-title-md border-b-2 hover:text-on-surface flex items-center gap-2 transition-all" + (tab === 'modules' ? ' border-[#00694f] text-[#00694f]' : ' border-transparent text-outline')} id="tab-btn-modules" onClick={() => { setTab('modules') }}>
<span className="material-symbols-outlined text-lg">view_module</span> 2. Modules &amp; Lessons <span className="px-2 py-0.5 rounded-full bg-surface-container text-xs">4</span>
</button>
<button className={"px-5 py-3 font-title-md text-title-md border-b-2 hover:text-on-surface flex items-center gap-2 transition-all" + (tab === 'assessment' ? ' border-[#00694f] text-[#00694f]' : ' border-transparent text-outline')} id="tab-btn-assessment" onClick={() => { setTab('assessment') }}>
<span className="material-symbols-outlined text-lg">quiz</span> 3. Assessment
      </button>
<button className={"px-5 py-3 font-title-md text-title-md border-b-2 hover:text-on-surface flex items-center gap-2 transition-all" + (tab === 'settings' ? ' border-[#00694f] text-[#00694f]' : ' border-transparent text-outline')} id="tab-btn-settings" onClick={() => { setTab('settings') }}>
<span className="material-symbols-outlined text-lg">settings</span> 4. Settings &amp; Audience
      </button>
</div>

<div className={"space-y-6" + (tab === 'details' ? '' : ' hidden')} id="section-details">
<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
<div className="lg:col-span-2 space-y-6 bg-surface-container-lowest p-8 rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)]">
<h2 className="font-headline-md text-headline-md text-on-surface pb-4 border-b border-outline-variant/20">Core Metadata</h2>
<div className="space-y-2">
<label className="font-label-lg text-label-lg text-on-surface flex items-center justify-between">
<span>Course Title <span className="text-rose-500">*</span></span>
<span className="text-outline text-xs">Max 120 characters</span>
</label>
<input className="w-full h-11 px-4 rounded-xl border border-outline-variant bg-surface text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-[#00694f]" type="text" defaultValue="Advanced Enterprise Security &amp; Cloud Compliance (L5-L8)"/>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
<div className="space-y-2">
<label className="font-label-lg text-label-lg text-on-surface">Category <span className="text-rose-500">*</span></label>
<div className="relative">
<select className="w-full h-11 px-4 rounded-xl border border-outline-variant bg-surface text-on-surface font-body-md appearance-none focus:outline-none focus:ring-2 focus:ring-[#00694f]">
<option>Security &amp; Compliance</option>
<option>Engineering &amp; Architecture</option>
<option>Leadership &amp; Management</option>
<option>Finance &amp; Operations</option>
</select>
<span className="material-symbols-outlined absolute right-3 top-3 text-outline pointer-events-none">expand_more</span>
</div>
</div>
<div className="space-y-2">
<label className="font-label-lg text-label-lg text-on-surface">Difficulty Level <span className="text-rose-500">*</span></label>
<div className="relative">
<select className="w-full h-11 px-4 rounded-xl border border-outline-variant bg-surface text-on-surface font-body-md appearance-none focus:outline-none focus:ring-2 focus:ring-[#00694f]">
<option>Advanced (L5 - L8)</option>
<option>Intermediate (L3 - L4)</option>
<option>Foundational (L1 - L2)</option>
<option>Executive Suite</option>
</select>
<span className="material-symbols-outlined absolute right-3 top-3 text-outline pointer-events-none">expand_more</span>
</div>
</div>
</div>
<div className="space-y-2">
<label className="font-label-lg text-label-lg text-on-surface">Course Description <span className="text-rose-500">*</span></label>
<textarea className="w-full p-4 rounded-xl border border-outline-variant bg-surface text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-[#00694f]" rows="4" defaultValue="Comprehensive training covering zero-trust architecture, AWS/Azure security posture management, and Indian regulatory compliance (DPDP Act 2023, ISO 27001)." />
</div>
<div className="space-y-2">
<label className="font-label-lg text-label-lg text-on-surface">Instructor Lead</label>
<div className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant/40">
<img className="w-10 h-10 rounded-full object-cover" data-alt="Professional studio portrait of Priya Sharma, HR Director at a corporate tech office in Bangalore, smiling confidently in navy blazer." src="https://lh3.googleusercontent.com/aida-public/AB6AXuC-EwxwSi-48gm4c_0pqOYqYNcmN-MZ1jiuBEX2eeRnvlsIKm1WSmn9Z3AgiezchDd-ikwZZeQQPeZjk7eaa9IPfc8vp1D_xGqNYxofQL8vziPLLjZPQiqaoT6ZK6NptUcNGBjdqL4E04Jb6qBQIa6obfUyiMC_vzfV6LPJ8DgH15Hpvp--VGs9zC04T02DZRoe1AJyjNgQpK-51mnSbypmRg0olPHcfD-Oslm4G2GfmCIH0SSYZ-I7"/>
<div className="flex-1">
<p className="font-label-lg text-label-lg font-semibold text-on-surface">Priya Sharma</p>
<p className="font-body-sm text-outline">Chief Information Security Officer • Mumbai Hub</p>
</div>
<button className="px-3 py-1.5 text-xs font-semibold text-[#00694f] bg-emerald-50 rounded-lg hover:bg-emerald-100">Change Lead</button>
</div>
</div>
</div>

<div className="space-y-6">
<div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] space-y-4">
<h3 className="font-headline-md text-headline-md text-on-surface">Cover Artwork</h3>
<div className="relative group cursor-pointer rounded-xl overflow-hidden border-2 border-dashed border-outline-variant hover:border-[#00694f] transition-all bg-surface-container-low h-48 flex flex-col items-center justify-center text-center p-4" onClick={() => { openModal('cover-modal') }}>
<div className="absolute inset-0 bg-cover bg-center opacity-90 group-hover:scale-105 transition-transform duration-500" data-alt="Abstract dark navy and glowing emerald digital security grid visualization with modern typography overlay for enterprise training course thumbnail." style={{"backgroundImage":"url('https://lh3.googleusercontent.com/aida-public/AB6AXuBYnsx9tcIaDa_bgja0x4JDUtayVz2YCI1a7aHMZPYtwtLLeOzMMeTVn1rR-snROagY1GiFNxkqCBhl07otJI9F9I34V7xZ2A3wRl7EiEg9bb3WfDiKZ8Nqub2eAb_lRRF6BiiWrigSvk3GLB_vOj4eWQVZjETc7nofW3CLEptrqP2ahKxpVAvAWIjYa_3iBZhGBQExnHpf2DLwLhhMNdj31Wj3ylDU1q5W_-jFX_d1ujYIZXn_91Mo')"}}></div>
<div className="absolute inset-0 bg-[#0E2B3D]/40 group-hover:bg-[#0E2B3D]/20 transition-colors"></div>
<div className="relative z-10 bg-surface/90 backdrop-blur-md p-3 rounded-full shadow-lg text-[#00694f] mb-2 group-hover:scale-110 transition-transform">
<span className="material-symbols-outlined text-2xl">edit</span>
</div>
<p className="relative z-10 font-label-lg text-label-lg font-semibold text-white drop-shadow">Change Artwork</p>
<p className="relative z-10 font-body-sm text-white/80 drop-shadow">PNG, JPG up to 10MB (1200x630px)</p>
</div>
<div className="space-y-2 pt-2">
<div className="flex justify-between font-body-sm">
<span className="text-outline">Estimated Duration</span>
<span className="font-semibold text-on-surface">4 Hours 30 Mins</span>
</div>
<div className="flex justify-between font-body-sm">
<span className="text-outline">Credits Assigned</span>
<span className="font-semibold text-on-surface">15 CPE Points</span>
</div>
<div className="flex justify-between font-body-sm">
<span className="text-outline">Target Enrollment</span>
<span className="font-semibold text-on-surface">L5 - L8 Engineers</span>
</div>
</div>
</div>
</div>
</div>
</div>

<div className={"space-y-6" + (tab === 'modules' ? '' : ' hidden')} id="section-modules">
<div className="flex items-center justify-between">
<div>
<h2 className="font-headline-md text-headline-md text-on-surface">Course Modules &amp; Lesson Plan</h2>
<p className="font-body-md text-outline">Drag and drop handles to reorder modules. Add video lectures, documents, or external links.</p>
</div>
<div className="flex items-center gap-3">
<button className="px-4 py-2 rounded-lg font-label-lg text-label-lg text-white bg-[#00694f] hover:bg-[#00513c] transition-colors flex items-center gap-2" onClick={() => { openModal('lesson-modal') }}>
<span className="material-symbols-outlined text-base">add</span> Add Module / Lesson
          </button>
</div>
</div>
<div className="space-y-4">

<div className="bg-surface-container-lowest rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] overflow-hidden border border-outline-variant/30">
<div className="bg-surface-container-low px-6 py-4 flex items-center justify-between border-b border-outline-variant/30">
<div className="flex items-center gap-3">
<span className="material-symbols-outlined text-outline cursor-grab">drag_indicator</span>
<span className="w-7 h-7 rounded-full bg-[#00694f] text-white flex items-center justify-center font-bold text-xs">1</span>
<div>
<h3 className="font-title-md text-title-md text-on-surface">Module 1: Zero Trust Architecture Fundamentals</h3>
<p className="font-body-sm text-outline">3 Lessons • 45 Minutes</p>
</div>
</div>
<div className="flex items-center gap-2">
<button className="p-2 text-outline hover:text-on-surface rounded-lg"><span className="material-symbols-outlined text-lg">edit</span></button>
<button className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><span className="material-symbols-outlined text-lg">delete</span></button>
<button className="p-2 text-outline hover:text-on-surface rounded-lg"><span className="material-symbols-outlined text-lg">expand_more</span></button>
</div>
</div>
<div className="divide-y divide-outline-variant/20">
<div className="px-6 py-3.5 flex items-center justify-between hover:bg-surface-container-low/50">
<div className="flex items-center gap-3">
<span className="material-symbols-outlined text-[#00694f]">play_circle</span>
<span className="font-body-md text-on-surface">1.1 Introduction to Perimeter-less Security</span>
</div>
<div className="flex items-center gap-3">
<span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">Video (18m)</span>
<button className="text-outline hover:text-on-surface"><span className="material-symbols-outlined text-base">more_vert</span></button>
</div>
</div>
<div className="px-6 py-3.5 flex items-center justify-between hover:bg-surface-container-low/50">
<div className="flex items-center gap-3">
<span className="material-symbols-outlined text-amber-600">description</span>
<span className="font-body-md text-on-surface">1.2 Whitepaper: NIST SP 800-207 Deep Dive</span>
</div>
<div className="flex items-center gap-3">
<span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold">PDF (12 Pages)</span>
<button className="text-outline hover:text-on-surface"><span className="material-symbols-outlined text-base">more_vert</span></button>
</div>
</div>
</div>
</div>

<div className="bg-surface-container-lowest rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] overflow-hidden border border-outline-variant/30">
<div className="bg-surface-container-low px-6 py-4 flex items-center justify-between border-b border-outline-variant/30">
<div className="flex items-center gap-3">
<span className="material-symbols-outlined text-outline cursor-grab">drag_indicator</span>
<span className="w-7 h-7 rounded-full bg-[#00694f] text-white flex items-center justify-center font-bold text-xs">2</span>
<div>
<h3 className="font-title-md text-title-md text-on-surface">Module 2: Cloud Compliance &amp; DPDP Act 2023 Alignment</h3>
<p className="font-body-sm text-outline">2 Lessons • 60 Minutes</p>
</div>
</div>
<div className="flex items-center gap-2">
<button className="p-2 text-outline hover:text-on-surface rounded-lg"><span className="material-symbols-outlined text-lg">edit</span></button>
<button className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><span className="material-symbols-outlined text-lg">delete</span></button>
<button className="p-2 text-outline hover:text-on-surface rounded-lg"><span className="material-symbols-outlined text-lg">expand_more</span></button>
</div>
</div>
</div>
</div>
</div>

<div className={"space-y-6" + (tab === 'assessment' ? '' : ' hidden')} id="section-assessment">
<div className="bg-surface-container-lowest p-8 rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] space-y-6">
<div className="flex items-center justify-between pb-6 border-b border-outline-variant/20">
<div>
<h2 className="font-headline-md text-headline-md text-on-surface">Final Quiz &amp; Passing Threshold</h2>
<p className="font-body-md text-outline">Configure grading metrics and auto-generated certification triggers.</p>
</div>
<button className="px-4 py-2 rounded-lg font-label-lg text-label-lg text-white bg-[#00694f] hover:bg-[#00513c] transition-colors flex items-center gap-2" onClick={() => { openModal('question-modal') }}>
<span className="material-symbols-outlined text-base">add</span> Add Question
          </button>
</div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
<div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-3">
<span className="material-symbols-outlined text-3xl text-[#00694f]">rule</span>
<h4 className="font-title-md text-title-md text-on-surface">Passing Score</h4>
<div className="flex items-baseline gap-2">
<span className="text-3xl font-bold text-[#00694f]">80%</span>
<span className="text-outline text-xs">Minimum correct</span>
</div>
<input className="w-full accent-[#00694f]" max="100" min="50" type="range" defaultValue="80"/>
</div>
<div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-3">
<span className="material-symbols-outlined text-3xl text-[#00694f]">timer</span>
<h4 className="font-title-md text-title-md text-on-surface">Time Limit</h4>
<div className="flex items-baseline gap-2">
<span className="text-3xl font-bold text-[#00694f]">45m</span>
<span className="text-outline text-xs">Timed assessment</span>
</div>
<select className="w-full h-9 px-3 rounded-lg border border-outline-variant bg-surface text-on-surface text-xs font-semibold">
<option>45 Minutes</option>
<option>60 Minutes</option>
<option>Unlimted Time</option>
</select>
</div>
<div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-3">
<span className="material-symbols-outlined text-3xl text-[#00694f]">replay</span>
<h4 className="font-title-md text-title-md text-on-surface">Max Attempts</h4>
<div className="flex items-baseline gap-2">
<span className="text-3xl font-bold text-[#00694f]">3</span>
<span className="text-outline text-xs">Retakes allowed</span>
</div>
<select className="w-full h-9 px-3 rounded-lg border border-outline-variant bg-surface text-on-surface text-xs font-semibold">
<option>3 Attempts</option>
<option>Unlimited Attempts</option>
<option>1 Attempt Only</option>
</select>
</div>
</div>
<div className="space-y-4 pt-4">
<h3 className="font-title-md text-title-md text-on-surface">Question Bank (5 Questions Added)</h3>
<div className="p-4 rounded-xl border border-outline-variant/40 bg-surface flex items-start justify-between gap-4">
<div className="flex gap-3">
<span className="w-6 h-6 rounded-full bg-emerald-100 text-[#00694f] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</span>
<div className="space-y-1">
<p className="font-label-lg text-label-lg font-semibold text-on-surface">Which principle forms the core foundation of Zero Trust Architecture?</p>
<p className="font-body-sm text-outline">Single Choice • 10 Points • Answer: "Never trust, always verify"</p>
</div>
</div>
<div className="flex items-center gap-2">
<button className="p-1.5 text-outline hover:text-on-surface"><span className="material-symbols-outlined text-base">edit</span></button>
<button className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"><span className="material-symbols-outlined text-base">delete</span></button>
</div>
</div>
<div className="p-4 rounded-xl border border-outline-variant/40 bg-surface flex items-start justify-between gap-4">
<div className="flex gap-3">
<span className="w-6 h-6 rounded-full bg-emerald-100 text-[#00694f] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</span>
<div className="space-y-1">
<p className="font-label-lg text-label-lg font-semibold text-on-surface">Select all mandatory compliance frameworks applicable under DPDP Act 2023 for cloud data storage:</p>
<p className="font-body-sm text-outline">Multiple Choice • 15 Points • 2 Correct Answers</p>
</div>
</div>
<div className="flex items-center gap-2">
<button className="p-1.5 text-outline hover:text-on-surface"><span className="material-symbols-outlined text-base">edit</span></button>
<button className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"><span className="material-symbols-outlined text-base">delete</span></button>
</div>
</div>
</div>
</div>
</div>

<div className={"space-y-6" + (tab === 'settings' ? '' : ' hidden')} id="section-settings">
<div className="bg-surface-container-lowest p-8 rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] space-y-8">
<h2 className="font-headline-md text-headline-md text-on-surface pb-4 border-b border-outline-variant/20">Course Configuration &amp; Governance</h2>
<div className="space-y-6 max-w-2xl">
<div className="flex items-center justify-between p-4 rounded-xl bg-surface-container-low">
<div className="space-y-0.5">
<p className="font-label-lg text-label-lg font-semibold text-on-surface">Mandatory Compliance Enrollment</p>
<p className="font-body-sm text-outline">Enforces automated assignment and tracking for target departments.</p>
</div>
<label className="relative inline-flex items-center cursor-pointer">
<input defaultChecked className="sr-only peer" type="checkbox"/>
<div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00694f]"></div>
</label>
</div>
<div className="flex items-center justify-between p-4 rounded-xl bg-surface-container-low">
<div className="space-y-0.5">
<p className="font-label-lg text-label-lg font-semibold text-on-surface">Auto-Issue Certificate on Completion</p>
<p className="font-body-sm text-outline">Generates verifiable PDF badge with digital signature upon passing quiz.</p>
</div>
<label className="relative inline-flex items-center cursor-pointer">
<input defaultChecked className="sr-only peer" type="checkbox"/>
<div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00694f]"></div>
</label>
</div>
<div className="space-y-2">
<label className="font-label-lg text-label-lg text-on-surface">Completion Deadline</label>
<input className="w-full h-11 px-4 rounded-xl border border-outline-variant bg-surface text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-[#00694f]" type="date" defaultValue="2023-11-30"/>
<p className="font-body-sm text-outline">Employees must complete all modules and pass assessment before this date.</p>
</div>
<div className="space-y-2">
<label className="font-label-lg text-label-lg text-on-surface">Target Audience Selector</label>
<div className="grid grid-cols-2 gap-4">
<label className="flex items-center gap-3 p-4 rounded-xl border border-[#00694f] bg-emerald-50/50 cursor-pointer">
<input defaultChecked className="accent-[#00694f]" name="audience" type="radio"/>
<div>
<p className="font-label-lg text-label-lg font-semibold text-on-surface">Engineering &amp; SecOps</p>
<p className="font-body-sm text-outline">342 Employees (L5-L8)</p>
</div>
</label>
<label className="flex items-center gap-3 p-4 rounded-xl border border-outline-variant/40 bg-surface cursor-pointer">
<input className="accent-[#00694f]" name="audience" type="radio"/>
<div>
<p className="font-label-lg text-label-lg font-semibold text-on-surface">Entire Enterprise</p>
<p className="font-body-sm text-outline">1,450 Employees</p>
</div>
</label>
</div>
</div>
</div>
</div>
</div>
</div>


<div className={"fixed inset-0 z-50 bg-[#0E2B3D]/50 backdrop-blur-sm items-center justify-center p-4" + (modal === 'cover-modal' ? ' flex' : ' hidden')} id="modal-cover-modal">
<div className="bg-surface-container-lowest max-w-lg w-full p-8 rounded-2xl shadow-2xl space-y-6">
<div className="flex items-center justify-between">
<h3 className="font-headline-md text-headline-md text-on-surface">Upload Cover Artwork</h3>
<button className="text-outline hover:text-on-surface" onClick={() => { closeModal('cover-modal') }}><span className="material-symbols-outlined">close</span></button>
</div>
<div className="border-2 border-dashed border-outline-variant rounded-xl p-8 text-center space-y-3 bg-surface-container-low">
<span className="material-symbols-outlined text-4xl text-[#00694f]">cloud_upload</span>
<p className="font-label-lg text-label-lg text-on-surface">Drag &amp; drop image file here, or <span className="text-[#00694f] underline cursor-pointer">browse</span></p>
<p className="font-body-sm text-outline">Supports PNG, JPG, WEBP up to 10MB</p>
</div>
<div className="flex justify-end gap-3">
<button className="px-4 py-2 rounded-lg font-label-lg text-label-lg text-slate-700 bg-slate-100" onClick={() => { closeModal('cover-modal') }}>Cancel</button>
<button className="px-4 py-2 rounded-lg font-label-lg text-label-lg text-white bg-[#00694f]" onClick={() => { closeModal('cover-modal') }}>Apply Artwork</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 bg-[#0E2B3D]/50 backdrop-blur-sm items-center justify-center p-4" + (modal === 'lesson-modal' ? ' flex' : ' hidden')} id="modal-lesson-modal">
<div className="bg-surface-container-lowest max-w-xl w-full p-8 rounded-2xl shadow-2xl space-y-6">
<div className="flex items-center justify-between">
<h3 className="font-headline-md text-headline-md text-on-surface">Add New Lesson</h3>
<button className="text-outline hover:text-on-surface" onClick={() => { closeModal('lesson-modal') }}><span className="material-symbols-outlined">close</span></button>
</div>
<div className="space-y-4">
<div className="space-y-1">
<label className="font-label-lg text-label-lg text-on-surface">Lesson Title</label>
<input className="w-full h-11 px-4 rounded-xl border border-outline-variant bg-surface text-on-surface" placeholder="e.g., IAM Roles and Permissions Best Practices" type="text"/>
</div>
<div className="space-y-1">
<label className="font-label-lg text-label-lg text-on-surface">Content Type</label>
<div className="grid grid-cols-3 gap-3">
<button className="p-3 rounded-xl border border-[#00694f] bg-emerald-50 text-[#00694f] font-semibold text-xs flex flex-col items-center gap-1">
<span className="material-symbols-outlined">play_circle</span> Video Lecture
            </button>
<button className="p-3 rounded-xl border border-outline-variant/50 text-slate-700 font-semibold text-xs flex flex-col items-center gap-1">
<span className="material-symbols-outlined">description</span> PDF / Reading
            </button>
<button className="p-3 rounded-xl border border-outline-variant/50 text-slate-700 font-semibold text-xs flex flex-col items-center gap-1">
<span className="material-symbols-outlined">link</span> External URL
            </button>
</div>
</div>
<div className="space-y-1">
<label className="font-label-lg text-label-lg text-on-surface">Upload Video File / Source</label>
<input className="w-full text-sm text-outline file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-[#00694f] hover:file:bg-emerald-100" type="file"/>
</div>
</div>
<div className="flex justify-end gap-3 pt-4">
<button className="px-4 py-2 rounded-lg font-label-lg text-label-lg text-slate-700 bg-slate-100" onClick={() => { closeModal('lesson-modal') }}>Cancel</button>
<button className="px-4 py-2 rounded-lg font-label-lg text-label-lg text-white bg-[#00694f]" onClick={() => { closeModal('lesson-modal') }}>Save Lesson</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 bg-[#0E2B3D]/50 backdrop-blur-sm items-center justify-center p-4" + (modal === 'question-modal' ? ' flex' : ' hidden')} id="modal-question-modal">
<div className="bg-surface-container-lowest max-w-xl w-full p-8 rounded-2xl shadow-2xl space-y-6">
<div className="flex items-center justify-between">
<h3 className="font-headline-md text-headline-md text-on-surface">Add Quiz Question</h3>
<button className="text-outline hover:text-on-surface" onClick={() => { closeModal('question-modal') }}><span className="material-symbols-outlined">close</span></button>
</div>
<div className="space-y-4">
<div className="space-y-1">
<label className="font-label-lg text-label-lg text-on-surface">Question Prompt</label>
<textarea className="w-full p-3 rounded-xl border border-outline-variant bg-surface text-on-surface" placeholder="Enter quiz question here..." rows="2" defaultValue="" />
</div>
<div className="space-y-2">
<label className="font-label-lg text-label-lg text-on-surface">Answer Options</label>
<div className="flex items-center gap-2">
<input defaultChecked className="accent-[#00694f]" name="correct" type="radio"/>
<input className="flex-1 h-9 px-3 rounded-lg border border-outline-variant bg-surface text-xs" type="text" defaultValue="Never trust, always verify"/>
</div>
<div className="flex items-center gap-2">
<input className="accent-[#00694f]" name="correct" type="radio"/>
<input className="flex-1 h-9 px-3 rounded-lg border border-outline-variant bg-surface text-xs" type="text" defaultValue="Trust inside corporate perimeter"/>
</div>
<div className="flex items-center gap-2">
<input className="accent-[#00694f]" name="correct" type="radio"/>
<input className="flex-1 h-9 px-3 rounded-lg border border-outline-variant bg-surface text-xs" type="text" defaultValue="VPN based authentication only"/>
</div>
</div>
</div>
<div className="flex justify-end gap-3 pt-4">
<button className="px-4 py-2 rounded-lg font-label-lg text-label-lg text-slate-700 bg-slate-100" onClick={() => { closeModal('question-modal') }}>Cancel</button>
<button className="px-4 py-2 rounded-lg font-label-lg text-label-lg text-white bg-[#00694f]" onClick={() => { closeModal('question-modal') }}>Add Question</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 bg-[#0E2B3D]/70 backdrop-blur-md items-center justify-center p-6" + (modal === 'preview-modal' ? ' flex' : ' hidden')} id="modal-preview-modal">
<div className="bg-surface max-w-4xl w-full h-[870px] max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
<div className="bg-[#0E2B3D] text-white px-6 py-4 flex items-center justify-between">
<div className="flex items-center gap-3">
<span className="px-2 py-0.5 rounded bg-emerald-400/20 text-[#1CCA9B] text-xs font-semibold">Learner View Simulator</span>
<h3 className="font-title-md text-title-md">Advanced Enterprise Security &amp; Cloud Compliance</h3>
</div>
<button className="text-white/70 hover:text-white" onClick={() => { closeModal('preview-modal') }}><span className="material-symbols-outlined">close</span></button>
</div>
<div className="flex-1 overflow-y-auto p-8 space-y-6">
<div className="aspect-video bg-slate-900 rounded-2xl flex items-center justify-center relative overflow-hidden">
<div className="absolute inset-0 bg-cover bg-center opacity-60" data-alt="Cybersecurity training video lecture screen featuring professional speaker in modern corporate studio." style={{"backgroundImage":"url('https://lh3.googleusercontent.com/aida-public/AB6AXuBGhcnMHVGL9W1NJ8Aq-gwPB2J_eoSdDEyX9tMFfcclJpKYcThc4I0q1M5riI1bdMHkMizuwJVEEaHRCUPLtnFsWhHctqXgc9d8sD74v42EEIEyMBSFuftSMWWTkKZ171UdSzHgXOYHaUrp4ISrUuNejxiKSYE8-6PyIMdRgCKDV_2hWjPW1MfIH6GZXb7nmJEd1WraJ2K7QmigoGTWc4kcezUlNWdWS4l_poEuEajgSnBJDolmhaKZ')"}}></div>
<button className="relative z-10 w-16 h-16 rounded-full bg-[#00694f] text-white flex items-center justify-center shadow-xl hover:scale-105 transition-transform">
<span className="material-symbols-outlined text-3xl">play_arrow</span>
</button>
</div>
<div className="space-y-3">
<h2 className="font-headline-md text-headline-md text-on-surface">Module 1.1: Introduction to Perimeter-less Security</h2>
<p className="font-body-md text-outline">In this session, Rohan Sen (Principal Architect) explores how modern remote work forces enterprises to abandon traditional perimeter defenses in favor of zero-trust verification.</p>
</div>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 bg-[#0E2B3D]/60 backdrop-blur-sm items-center justify-center p-4" + (modal === 'publish-modal' ? ' flex' : ' hidden')} id="modal-publish-modal">
<div className="bg-surface-container-lowest max-w-md w-full p-8 rounded-2xl shadow-2xl text-center space-y-6">
<div className="w-16 h-16 bg-emerald-100 text-[#00694f] rounded-full flex items-center justify-center mx-auto">
<span className="material-symbols-outlined text-3xl">verified</span>
</div>
<div className="space-y-2">
<h3 className="font-headline-md text-headline-md text-on-surface">Course Ready to Publish</h3>
<p className="font-body-md text-outline">All 4 modules and assessments have passed quality validation. Publishing will instantly notify 342 target employees.</p>
</div>
<div className="flex flex-col gap-3">
<button className="w-full py-3 rounded-xl font-label-lg text-label-lg text-white bg-[#00694f] hover:bg-[#00513c] transition-colors shadow-md" onClick={() => { showSuccessAssign() }}>Publish &amp; Assign Now</button>
<button className="w-full py-2.5 rounded-xl font-label-lg text-label-lg text-slate-700 bg-slate-100" onClick={() => { closeModal('publish-modal') }}>Back to Editing</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 bg-[#0E2B3D]/60 backdrop-blur-sm items-center justify-center p-4" + (modal === 'cancel-modal' ? ' flex' : ' hidden')} id="modal-cancel-modal">
<div className="bg-surface-container-lowest max-w-md w-full p-8 rounded-2xl shadow-2xl text-center space-y-6">
<div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
<span className="material-symbols-outlined text-3xl">warning</span>
</div>
<div className="space-y-2">
<h3 className="font-headline-md text-headline-md text-on-surface">Discard Unsaved Changes?</h3>
<p className="font-body-md text-outline">You have recent edits made at 14:32 IST that will be permanently lost if you exit without saving.</p>
</div>
<div className="flex gap-3">
<button className="flex-1 py-2.5 rounded-xl font-label-lg text-label-lg text-slate-700 bg-slate-100" onClick={() => { closeModal('cancel-modal') }}>Keep Editing</button>
<button className="flex-1 py-2.5 rounded-xl font-label-lg text-label-lg text-white bg-rose-600 hover:bg-rose-700" onClick={() => { closeModal('cancel-modal'); triggerToast('Draft discarded successfully.'); }}>Discard</button>
</div>
</div>
</div>

<div className={"fixed bottom-6 right-6 z-50 bg-[#0E2B3D] text-white px-6 py-3.5 rounded-xl shadow-2xl flex items-center gap-3  transition-all duration-300" + (toast ? '' : ' translate-y-24 opacity-0')} id="toast" role="status">
<span className="material-symbols-outlined text-[#1CCA9B]">check_circle</span>
<span className="font-label-lg text-label-lg">{toast}</span>
</div>
</div></main></div></>);
}
