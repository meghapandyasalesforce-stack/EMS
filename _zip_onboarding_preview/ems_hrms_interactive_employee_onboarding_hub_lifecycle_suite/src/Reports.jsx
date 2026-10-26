import { useEffect, useRef, useState } from 'react';
import { Sidebar, Header } from './Layout.jsx';
import { departmentReports } from './reportData.js';
export default function Reports() {
 const [report,setReport]=useState('headcount');
 const [exportOpen,setExportOpen]=useState(false);
 const [cohort,setCohort]=useState('');
 const [search,setSearch]=useState('');
 const [sort,setSort]=useState({column:null,direction:1});
 const [series,setSeries]=useState({eng:true,sales:true,ops:true});
 const [subscribed,setSubscribed]=useState(false);
 const [toast,setToast]=useState('');
 const timer=useRef();
 const filtered=departmentReports.filter(row=>row.department.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>{const key=['department','staff','tenure'][sort.column];return !key?0:sort.direction*(typeof a[key]==='number'?a[key]-b[key]:a[key].localeCompare(b[key]));});
 const showToast=message=>{clearTimeout(timer.current);setToast(message);timer.current=setTimeout(()=>setToast(''),3500);};
 const switchReport=id=>{setReport(id);setExportOpen(false);};
 const triggerExport=format=>{setExportOpen(false);showToast(format+' export is a prototype preview; no file was generated.');};
 const triggerDrillDown=setCohort;
 const closeModal=()=>setCohort('');
 const sortTable=column=>setSort(previous=>({column,direction:previous.column===column?-previous.direction:1}));
 const toggleChartSeries=key=>{setSeries(previous=>({...previous,[key]:!previous[key]}));showToast('Legend preference updated. Chart shows the supplied aggregate sample.');};
 const notifyCompliance=()=>{setSubscribed(true);showToast('Interest saved for this session. Notification delivery is not connected.');};
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 useEffect(()=>{const close=()=>setExportOpen(false);const keydown=event=>{if(event.key==='Escape')setExportOpen(false);};window.addEventListener('click',close);window.addEventListener('keydown',keydown);return()=>{window.removeEventListener('click',close);window.removeEventListener('keydown',keydown);};},[]);
 useEffect(()=>{
  if(!cohort)return;
  const dialog=document.getElementById('drillDownModal'),previous=document.activeElement;
  const controls=()=>[...dialog.querySelectorAll('button')];controls()[0]?.focus();
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const keydown=event=>{if(event.key==='Escape')closeModal();if(event.key==='Tab'){const items=controls(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};
  document.addEventListener('keydown',keydown);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keydown);previous?.focus();};
 },[cohort]);
 return (<><Sidebar activePage="reports" /><div className="pl-64"><Header /><main className="relative pt-16 bg-surface min-h-screen"><div className="flex flex-col w-full pb-16">

<div className="px-space-xl py-space-md bg-surface-container-lowest flex flex-col md:flex-row md:items-center justify-between gap-4 mb-space-lg shadow-sm">
<div className="flex items-center gap-3">
<div className="w-12 h-12 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center shadow-sm">
<span className="material-symbols-outlined text-2xl" style={{"fontVariationSettings":"'FILL' 1"}}>summarize</span>
</div>
<div>
<h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Lifecycle Reports &amp; SLA Analytics</h1>
<p className="font-body-md text-on-surface-variant">Bengaluru HQ • Telemetry &amp; Workforce Insights • INR (₹) ? Sample data</p>
</div>
</div>
<div className="flex flex-wrap items-center gap-3">

<div className="flex items-center gap-2 bg-surface-container-low px-3 py-2 rounded-lg text-label-lg font-label-lg text-on-surface">
<span className="material-symbols-outlined text-outline text-lg">calendar_today</span>
<span>01 Apr 2024 – 31 Mar 2025</span>
<span className="material-symbols-outlined text-outline text-base">arrow_drop_down</span>
</div>

<div className="flex items-center gap-2 bg-surface-container-low px-3 py-2 rounded-lg text-label-lg font-label-lg text-on-surface">
<span className="material-symbols-outlined text-outline text-lg">filter_list</span>
<span>All Departments (HQ + Remote)</span>
<span className="material-symbols-outlined text-outline text-base">arrow_drop_down</span>
</div>

<div className="relative">
<button className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg font-label-lg font-medium hover:bg-surface-tint transition-colors shadow-sm" onClick={event=>{event.stopPropagation();setExportOpen(previous=>!previous);}} aria-expanded={exportOpen} aria-controls="exportDropdown" id="exportMenuBtn">
<span className="material-symbols-outlined text-lg">download</span>
<span>Export Suite</span>
<span className="material-symbols-outlined text-base">expand_more</span>
</button>
<div className={" absolute right-0 mt-2 w-48 bg-surface-container-lowest rounded-xl shadow-xl py-2 z-50" + (exportOpen ? '' : ' hidden')} id="exportDropdown">
<button className="w-full text-left px-4 py-2 text-on-surface hover:bg-surface-container flex items-center gap-2 text-body-md" onClick={() => { triggerExport('CSV') }}><span className="material-symbols-outlined text-base">description</span>CSV Spreadsheet</button>
<button className="w-full text-left px-4 py-2 text-on-surface hover:bg-surface-container flex items-center gap-2 text-body-md" onClick={() => { triggerExport('Excel') }}><span className="material-symbols-outlined text-base">table_view</span>Microsoft Excel (.xlsx)</button>
<button className="w-full text-left px-4 py-2 text-on-surface hover:bg-surface-container flex items-center gap-2 text-body-md" onClick={() => { triggerExport('PDF') }}><span className="material-symbols-outlined text-base">picture_as_pdf</span>PDF Executive Report</button>
</div>
</div>

<a className="flex items-center gap-2 bg-surface-container-high text-on-surface px-4 py-2 rounded-lg font-label-lg font-medium hover:bg-surface-container-highest transition-colors" href="#/reports" onClick={()=>showToast("Advanced analytics is a prototype preview.")}>
<span>Advanced Analytics</span>
<span className="material-symbols-outlined text-lg">arrow_forward</span>
</a>
</div>
</div>

<div className="px-space-xl grid grid-cols-1 lg:grid-cols-4 gap-space-lg">

<div className="lg:col-span-1 bg-surface-container-lowest rounded-2xl p-space-md shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] flex flex-col gap-2 h-fit">
<p className="font-label-caps text-label-caps uppercase tracking-wider text-outline px-2 mb-1">Report Categories</p>
<button className={"report-nav-btn w-full flex items-center justify-between px-3 py-3 rounded-xl font-label-lg text-label-lg transition-all" + (report === 'headcount' ? ' bg-primary text-on-primary shadow-sm' : ' hover:bg-surface-container text-on-surface')} aria-pressed={report === 'headcount'} id="btn-headcount" onClick={() => { switchReport('headcount') }}>
<span className="flex items-center gap-2.5"><span className="material-symbols-outlined text-lg">groups</span>Headcount &amp; Demographics</span>
<span className="material-symbols-outlined text-base">chevron_right</span>
</button>
<button className={"report-nav-btn w-full flex items-center justify-between px-3 py-3 rounded-xl font-label-lg text-label-lg transition-all" + (report === 'attrition' ? ' bg-primary text-on-primary shadow-sm' : ' hover:bg-surface-container text-on-surface')} aria-pressed={report === 'attrition'} id="btn-attrition" onClick={() => { switchReport('attrition') }}>
<span className="flex items-center gap-2.5"><span className="material-symbols-outlined text-lg">trending_down</span>Attrition &amp; Retention</span>
<span className="material-symbols-outlined text-base">chevron_right</span>
</button>
<button className={"report-nav-btn w-full flex items-center justify-between px-3 py-3 rounded-xl font-label-lg text-label-lg transition-all" + (report === 'payroll' ? ' bg-primary text-on-primary shadow-sm' : ' hover:bg-surface-container text-on-surface')} aria-pressed={report === 'payroll'} id="btn-payroll" onClick={() => { switchReport('payroll') }}>
<span className="flex items-center gap-2.5"><span className="material-symbols-outlined text-lg">payments</span>Payroll &amp; CTC Dispersal</span>
<span className="material-symbols-outlined text-base">chevron_right</span>
</button>
<button className={"report-nav-btn w-full flex items-center justify-between px-3 py-3 rounded-xl font-label-lg text-label-lg transition-all" + (report === 'attendance' ? ' bg-primary text-on-primary shadow-sm' : ' hover:bg-surface-container text-on-surface')} aria-pressed={report === 'attendance'} id="btn-attendance" onClick={() => { switchReport('attendance') }}>
<span className="flex items-center gap-2.5"><span className="material-symbols-outlined text-lg">schedule</span>Attendance &amp; Shifts</span>
<span className="material-symbols-outlined text-base">chevron_right</span>
</button>
<button className={"report-nav-btn w-full flex items-center justify-between px-3 py-3 rounded-xl font-label-lg text-label-lg transition-all" + (report === 'recruitment' ? ' bg-primary text-on-primary shadow-sm' : ' hover:bg-surface-container text-on-surface')} aria-pressed={report === 'recruitment'} id="btn-recruitment" onClick={() => { switchReport('recruitment') }}>
<span className="flex items-center gap-2.5"><span className="material-symbols-outlined text-lg">person_search</span>Recruitment SLA</span>
<span className="material-symbols-outlined text-base">chevron_right</span>
</button>
<button className={"report-nav-btn w-full flex items-center justify-between px-3 py-3 rounded-xl font-label-lg text-label-lg transition-all" + (report === 'compliance' ? ' bg-primary text-on-primary shadow-sm' : ' hover:bg-surface-container text-on-surface')} aria-pressed={report === 'compliance'} id="btn-compliance" onClick={() => { switchReport('compliance') }}>
<span className="flex items-center gap-2.5"><span className="material-symbols-outlined text-lg">verified_user</span>Compliance Audit</span>
<span className="px-2 py-0.5 rounded-full text-label-caps font-semibold bg-tertiary-fixed text-on-tertiary-fixed">Soon</span>
</button>
</div>

<div className="lg:col-span-3 flex flex-col gap-space-lg">

<div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
<div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] flex flex-col justify-between">
<div className="flex items-center justify-between text-outline">
<span className="font-label-md text-label-md uppercase tracking-wide">Total Active Headcount</span>
<span className="material-symbols-outlined text-primary text-xl">group</span>
</div>
<div className="mt-4">
<h3 className="font-display-sm text-display-sm text-on-surface">1,428</h3>
<p className="font-body-sm text-primary flex items-center gap-1 mt-1 font-medium">
<span className="material-symbols-outlined text-sm">trending_up</span> +4.2% from last quarter (Bengaluru &amp; NCR)
            </p>
</div>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] flex flex-col justify-between">
<div className="flex items-center justify-between text-outline">
<span className="font-label-md text-label-md uppercase tracking-wide">YTD Attrition Rate</span>
<span className="material-symbols-outlined text-error text-xl">trending_down</span>
</div>
<div className="mt-4">
<h3 className="font-display-sm text-display-sm text-on-surface">8.4%</h3>
<p className="font-body-sm text-outline flex items-center gap-1 mt-1 font-medium">
<span className="material-symbols-outlined text-sm text-primary">check_circle</span> Well within industry benchmark (12%)
            </p>
</div>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] flex flex-col justify-between">
<div className="flex items-center justify-between text-outline">
<span className="font-label-md text-label-md uppercase tracking-wide">Monthly Payroll Dispersal</span>
<span className="material-symbols-outlined text-primary text-xl">account_balance_wallet</span>
</div>
<div className="mt-4">
<h3 className="font-display-sm text-display-sm text-on-surface">₹18.4 Cr</h3>
<p className="font-body-sm text-primary flex items-center gap-1 mt-1 font-medium">
<span className="material-symbols-outlined text-sm">bolt</span> 100% on-time SLA achieved
            </p>
</div>
</div>
</div>

<div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] flex flex-col gap-space-lg" id="reportContentContainer">

<div className={"report-view flex flex-col gap-space-lg" + (report === 'headcount' ? '' : ' hidden')} id="view-headcount">
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
<div>
<h2 className="font-headline-md text-headline-md text-on-surface">Headcount Distribution &amp; Growth Telemetry</h2>
<p className="font-body-md text-on-surface-variant">Quarterly breakdown across engineering, product, sales, and operations hubs.</p>
</div>

<div className="flex items-center gap-3">
<label className="flex items-center gap-1.5 text-label-md font-label-md cursor-pointer">
<input checked={series.eng} className="rounded text-primary focus:ring-primary w-4 h-4"  onChange={() => toggleChartSeries('eng')} type="checkbox"/> Engineering
              </label>
<label className="flex items-center gap-1.5 text-label-md font-label-md cursor-pointer">
<input checked={series.sales} className="rounded text-primary focus:ring-primary w-4 h-4"  onChange={() => toggleChartSeries('sales')} type="checkbox"/> Sales &amp; Mktg
              </label>
<label className="flex items-center gap-1.5 text-label-md font-label-md cursor-pointer">
<input checked={series.ops} className="rounded text-primary focus:ring-primary w-4 h-4"  onChange={() => toggleChartSeries('ops')} type="checkbox"/> Ops &amp; HR
              </label>
</div>
</div>

<div className="bg-surface-container-low rounded-xl p-space-md flex flex-col gap-4">
<div className="flex justify-between items-end h-48 px-4 pt-6 border-b border-outline-variant/20">
<div className="flex flex-col items-center gap-2 flex-1 group cursor-pointer" onClick={()=>triggerDrillDown('Q1 2024')} role="button" tabIndex={0} aria-label="Analyze Q1 2024" onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();triggerDrillDown('Q1 2024');}}}>
<div className="w-12 bg-primary rounded-t-lg transition-all group-hover:bg-surface-tint" style={{"height":"110px"}}></div>
<span className="font-label-sm text-outline">Q1 2024</span>
</div>
<div className="flex flex-col items-center gap-2 flex-1 group cursor-pointer" onClick={()=>triggerDrillDown('Q2 2024')} role="button" tabIndex={0} aria-label="Analyze Q2 2024" onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();triggerDrillDown('Q2 2024');}}}>
<div className="w-12 bg-primary rounded-t-lg transition-all group-hover:bg-surface-tint" style={{"height":"130px"}}></div>
<span className="font-label-sm text-outline">Q2 2024</span>
</div>
<div className="flex flex-col items-center gap-2 flex-1 group cursor-pointer" onClick={()=>triggerDrillDown('Q3 2024')} role="button" tabIndex={0} aria-label="Analyze Q3 2024" onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();triggerDrillDown('Q3 2024');}}}>
<div className="w-12 bg-primary rounded-t-lg transition-all group-hover:bg-surface-tint" style={{"height":"155px"}}></div>
<span className="font-label-sm text-outline">Q3 2024</span>
</div>
<div className="flex flex-col items-center gap-2 flex-1 group cursor-pointer" onClick={()=>triggerDrillDown('Q4 2024')} role="button" tabIndex={0} aria-label="Analyze Q4 2024" onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();triggerDrillDown('Q4 2024');}}}>
<div className="w-12 bg-primary rounded-t-lg transition-all group-hover:bg-surface-tint" style={{"height":"180px"}}></div>
<span className="font-label-sm text-outline">Q4 2024</span>
</div>
</div>
<div className="flex items-center justify-between text-body-sm text-on-surface-variant px-2">
<span>Tip: Click any bar to drill down into departmental rosters.</span>
<span className="font-semibold text-primary">Total Growth: +24.8% YoY</span>
</div>
</div>

<div className="flex flex-col gap-3">
<div className="flex items-center justify-between">
<h3 className="font-headline-sm text-headline-sm text-on-surface">Departmental Headcount Breakdown</h3>
<div className="relative">
<input className="px-3 py-1.5 bg-surface-container-low rounded-lg text-body-sm focus:outline-none focus:ring-2 focus:ring-primary" value={search} onChange={event=>setSearch(event.target.value)} aria-label="Search departments" placeholder="Search department..." type="text"/>
</div>
</div>
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse">
<thead>
<tr className="bg-surface-container-low text-label-caps uppercase text-outline">
<th className="p-3 rounded-l-lg cursor-pointer hover:text-on-surface" aria-sort={sort.column === 0 ? (sort.direction === 1 ? 'ascending' : 'descending') : 'none'}><button className="text-left" onClick={()=>sortTable(0)}>Department <span className="material-symbols-outlined text-xs align-middle">sort</span></button></th>
<th className="p-3 cursor-pointer hover:text-on-surface" aria-sort={sort.column === 1 ? (sort.direction === 1 ? 'ascending' : 'descending') : 'none'}><button className="text-left" onClick={()=>sortTable(1)}>Active Staff <span className="material-symbols-outlined text-xs align-middle">sort</span></button></th>
<th className="p-3 cursor-pointer hover:text-on-surface" aria-sort={sort.column === 2 ? (sort.direction === 1 ? 'ascending' : 'descending') : 'none'}><button className="text-left" onClick={()=>sortTable(2)}>Avg Tenure <span className="material-symbols-outlined text-xs align-middle">sort</span></button></th>
<th className="p-3 rounded-r-lg">Manager in Charge</th>
</tr>
</thead>
<tbody className="text-body-md text-on-surface divide-y divide-outline-variant/10">{filtered.map(row=><tr key={row.department} className="hover:bg-surface-container-low transition-colors"><td className="p-3 font-semibold">{row.department}</td><td className="p-3">{row.staff}</td><td className="p-3">{row.tenure} Years</td><td className="p-3 text-on-surface-variant">{row.manager}</td></tr>)}{filtered.length===0&&<tr><td colSpan={4} className="p-8 text-center text-outline">No departments match your search.</td></tr>}</tbody>
</table>
</div>
</div>
</div>

<div className={"report-view flex flex-col gap-space-lg" + (report === 'attrition' ? '' : ' hidden')} id="view-attrition">
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
<div>
<h2 className="font-headline-md text-headline-md text-on-surface">Attrition &amp; Voluntary Exit Analysis</h2>
<p className="font-body-md text-on-surface-variant">Detailed telemetry tracking exit reasons, retention risks, and tenure buckets.</p>
</div>
</div>

<div className="bg-surface-container-low rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3">
<span className="material-symbols-outlined text-4xl text-primary">donut_large</span>
<h4 className="font-headline-sm text-headline-sm text-on-surface">Retention Breakdown Visualizer</h4>
<p className="font-body-md text-on-surface-variant max-w-md">Voluntary resignations account for 68% of departures, primarily within the 1-2 year tenure bracket in Sales.</p>
<button className="px-4 py-2 bg-primary text-on-primary rounded-lg text-label-lg font-medium" onClick={()=>triggerDrillDown('Attrition Details')} role="button" tabIndex={0} aria-label="Analyze Attrition Details" onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();triggerDrillDown('Attrition Details');}}}>View Exit Interview Logs</button>
</div>
</div>

<div className={"report-view flex flex-col gap-space-lg" + (report === 'payroll' ? '' : ' hidden')} id="view-payroll">
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
<div>
<h2 className="font-headline-md text-headline-md text-on-surface">Payroll Dispersal &amp; CTC Analytics</h2>
<p className="font-body-md text-on-surface-variant">Monthly salary credits, tax deductions (TDS), and statutory PF/ESI compliance tracking.</p>
</div>
</div>
<div className="bg-surface-container-low rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3">
<span className="material-symbols-outlined text-4xl text-primary">account_balance</span>
<h4 className="font-headline-sm text-headline-sm text-on-surface">₹18.4 Crore Dispersed Successfully</h4>
<p className="font-body-md text-on-surface-variant max-w-md">All 1,428 employee accounts processed via direct HDFC/ICICI bank transfer gateway with zero discrepancies.</p>
</div>
</div>

<div className={"report-view flex flex-col gap-space-lg" + (report === 'attendance' ? '' : ' hidden')} id="view-attendance">
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
<div>
<h2 className="font-headline-md text-headline-md text-on-surface">Attendance &amp; Shift Compliance</h2>
<p className="font-body-md text-on-surface-variant">Biometric check-in logs, remote punch-ins, and overtime allocation telemetry.</p>
</div>
</div>
<div className="bg-surface-container-low rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3">
<span className="material-symbols-outlined text-4xl text-primary">schedule</span>
<h4 className="font-headline-sm text-headline-sm text-on-surface">97.8% On-Time Attendance Rate</h4>
<p className="font-body-md text-on-surface-variant max-w-md">Bengaluru HQ maintains highest punctuality score across all operational hubs.</p>
</div>
</div>

<div className={"report-view flex flex-col gap-space-lg" + (report === 'recruitment' ? '' : ' hidden')} id="view-recruitment">
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
<div>
<h2 className="font-headline-md text-headline-md text-on-surface">Recruitment SLA &amp; Time-to-Hire</h2>
<p className="font-body-md text-on-surface-variant">Candidate pipeline velocity, offer acceptance ratios, and sourcing channel efficacy.</p>
</div>
</div>
<div className="bg-surface-container-low rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3">
<span className="material-symbols-outlined text-4xl text-primary">person_search</span>
<h4 className="font-headline-sm text-headline-sm text-on-surface">Average Time-to-Hire: 18 Days</h4>
<p className="font-body-md text-on-surface-variant max-w-md">Engineering roles meet the 21-day SLA target with 89% offer acceptance.</p>
</div>
</div>

<div className={"report-view flex flex-col items-center justify-center py-16 text-center gap-4" + (report === 'compliance' ? '' : ' hidden')} id="view-compliance">
<div className="w-16 h-16 rounded-full bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center">
<span className="material-symbols-outlined text-3xl">verified_user</span>
</div>
<h2 className="font-headline-lg text-headline-lg text-on-surface">Compliance Audit Suite is Coming Soon</h2>
<p className="font-body-md text-on-surface-variant max-w-md">Automated labor law tracking, POSH committee logs, and statutory PF/Gratuity audit reports are currently in final staging.</p>
<button className="mt-2 px-6 py-2.5 bg-primary text-on-primary rounded-xl" id="notifyBtn" onClick={notifyCompliance} disabled={subscribed}>{subscribed ? 'Interest saved for this session' : 'Notify Me When Live'}</button>
</div>
</div>
</div>
</div>

<div className={"fixed bottom-6 right-6 bg-[#0E2B3D] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 transform  transition-all duration-300 z-50" + (toast ? '' : ' translate-y-24 opacity-0 pointer-events-none')} id="successToast" role="status">
<span className="material-symbols-outlined text-[#1CCA9B]">task_alt</span>
<span className="font-label-lg text-label-lg font-medium" id="toastMessage">{toast}</span>
</div>

<div className={"fixed inset-0 bg-[#0E2B3D]/40 backdrop-blur-sm  items-center justify-center z-50 p-4" + (cohort ? ' flex' : ' hidden')} id="drillDownModal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
<div className="bg-surface-container-lowest rounded-2xl p-6 max-w-lg w-full shadow-2xl flex flex-col gap-4">
<div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
<h3 className="font-headline-md text-headline-md text-on-surface" id="modalTitle">Cohort Analysis: {cohort}</h3>
<button className="text-on-surface-variant hover:text-on-surface" onClick={() => { closeModal() }}><span className="material-symbols-outlined">close</span></button>
</div>
<p className="font-body-md text-on-surface-variant" id="modalBody">Detailed roster breakdown for the selected cohort, featuring department-wise headcount distribution and active manager assignments.</p>
<div className="bg-surface-container-low p-4 rounded-xl flex flex-col gap-2">
<div className="flex justify-between font-label-lg"><span className="text-on-surface">Total Roster Count</span><span className="font-bold text-primary">356 Employees</span></div>
<div className="flex justify-between font-label-lg"><span className="text-on-surface">New Joinees</span><span className="font-bold text-primary">48 Staff</span></div>
<div className="flex justify-between font-label-lg"><span className="text-on-surface">Open Requisitions</span><span className="font-bold text-primary">12 Positions</span></div>
</div>
<div className="flex justify-end pt-2">
<button className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-lg" onClick={() => { closeModal() }}>Close Details</button>
</div>
</div>
</div>
</div></main></div></>);
}
