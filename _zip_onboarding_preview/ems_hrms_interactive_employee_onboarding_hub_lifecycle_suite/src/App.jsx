import Attendance from './Attendance.jsx';
import CandidateDossier from './CandidateDossier.jsx';
import WorkforcePlanning from './WorkforcePlanning.jsx';
import SurveyResults from './SurveyResults.jsx';
import SurveyBuilder from './SurveyBuilder.jsx';
import Succession from './Succession.jsx';
import ResumeInbox from './ResumeInbox.jsx';
import AttendanceRegularization from './AttendanceRegularization.jsx';
import CandidatePipeline from './CandidatePipeline.jsx';
import InterviewCalendar from './InterviewCalendar.jsx';
import Approvals from './Approvals.jsx';
import Payroll from './Payroll.jsx';
import OneOnOnes from './OneOnOnes.jsx';
import OnboardingDetail from './OnboardingDetail.jsx';
import Reports from './Reports.jsx';
import Learning from './Learning.jsx';
import RecruitmentDetail from './RecruitmentDetail.jsx';
import Helpdesk from './Helpdesk.jsx';
import HeadcountRequisitions from './HeadcountRequisitions.jsx';
import { useEffect, useState } from 'react';
import CreateCourse from './CreateCourse.jsx';
import { useOnboarding } from './useOnboarding.js';
import { Sidebar, Header } from './Layout.jsx';
import CandidateRow from './CandidateRow.jsx';
function OnboardingApp() {
 const { candidates, search, filters, tab, modal, drawer, toast, page, totalPages, filtered, pageItems, loading, selected, menu, setMenu, actionCandidate, handleSearch, updateFilter, resetFilters, switchTab, openModal, closeModal, openDrawer, closeDrawer, openCandidateDrawer, setPage, prevPage, nextPage, promptPause, promptDelete, confirmPauseWorkflow, confirmDeleteWorkflow, handleCreateSubmit, setSimState, triggerToast, toggleSelectAll, toggleSelected } = useOnboarding();
return (<><Sidebar /><div className="pl-64"><Header /><main className="relative pt-16 bg-surface min-h-screen"><div className="flex flex-col w-full">

<div className="sticky top-0 z-30 bg-[#0E2B3D] text-white px-6 py-2.5 shadow-md flex items-center justify-between gap-4 overflow-x-auto text-xs border-b border-white/10">
<div className="flex items-center gap-2 shrink-0">
<span className="material-symbols-outlined text-sm text-[#1CCA9B]">tune</span>
<span className="font-semibold tracking-wider uppercase text-[11px] text-white/90">Prototype Rig:</span>
</div>
<div className="flex items-center gap-1.5 overflow-x-auto py-0.5" id="simulator-rig">
<button className="px-2.5 py-1 rounded bg-white/20 text-white font-medium hover:bg-white/30 transition-all shrink-0" id="btn-sim-default" onClick={(event) => { setSimState('default') } }>1. Default Roster</button>
<button className="px-2.5 py-1 rounded bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all shrink-0" onClick={(event) => { openModal('create-modal') } }>2. + Create Modal</button>
<button className="px-2.5 py-1 rounded bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all shrink-0" onClick={(event) => { openDrawer('quick-drawer') } }>3. Quick Drawer</button>
<button className="px-2.5 py-1 rounded bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all shrink-0" id="btn-sim-filtered" onClick={(event) => { setSimState('filtered') } }>4. Filtered State</button>
<button className="px-2.5 py-1 rounded bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all shrink-0" onClick={(event) => { openModal('pause-modal') } }>5. Pause Confirm</button>
<button className="px-2.5 py-1 rounded bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all shrink-0" onClick={(event) => { openModal('delete-modal') } }>6. Delete Confirm</button>
<button className="px-2.5 py-1 rounded bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all shrink-0" id="btn-sim-page2" onClick={(event) => { setPage(2) } }>7. Page 2</button>
<button className="px-2.5 py-1 rounded bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all shrink-0" id="btn-sim-page3" onClick={(event) => { setPage(3) } }>8. Page 3</button>
<button className="px-2.5 py-1 rounded bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all shrink-0" id="btn-sim-empty" onClick={(event) => { setSimState('empty') } }>9. Empty State</button>
<button className="px-2.5 py-1 rounded bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all shrink-0" id="btn-sim-skeleton" onClick={(event) => { setSimState('skeleton') } }>10. Skeleton Load</button>
<button className="px-2.5 py-1 rounded bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all shrink-0" id="btn-sim-offboard" onClick={(event) => { switchTab('offboarding') } }>11. Offboarding Preview</button>
<button className="px-2.5 py-1 rounded bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all shrink-0" id="btn-sim-reports" onClick={(event) => { switchTab('reports') } }>12. Reports Preview</button>
</div>
</div>
<div className="p-8 space-y-6 max-w-7xl mx-auto w-full">

<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
<div className="space-y-1">
<nav className="flex items-center gap-2 text-xs text-secondary font-medium tracking-wide">
<span className="hover:text-primary transition-colors cursor-pointer">Dashboard</span>
<span className="material-symbols-outlined text-[14px]">chevron_right</span>
<span className="hover:text-primary transition-colors cursor-pointer">Hire &amp; Lifecycle</span>
<span className="material-symbols-outlined text-[14px]">chevron_right</span>
<span className="text-on-surface font-semibold">Onboarding Hub</span>
</nav>
<div className="flex items-center gap-3">
<h1 className="font-headline-lg text-headline-lg text-[#0E2B3D] tracking-tight">Employee Onboarding &amp; New Hire Induction</h1><a href="#/onboarding-detail" className="text-primary text-body-sm hover:underline">Open Ananya?s onboarding dossier</a>
<span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E8FAF4] text-[#00694f]">Spring 2025 Cohort</span>
</div>
<p className="font-body-md text-body-md text-secondary max-w-3xl">
          Monitor pre-boarding readiness, IT provisioning, BGV verification, and Day-1 induction compliance across distributed branches.
        </p>
</div>

<div className="flex items-center gap-3 shrink-0">
<button className="px-4 py-2 bg-surface-container-lowest text-secondary rounded-lg font-label-lg text-label-lg shadow-sm hover:bg-surface-container transition-all flex items-center gap-2" onClick={(event) => { triggerToast('Onboarding CSV export queued successfully') } }>
<span className="material-symbols-outlined text-lg">download</span>
          Export CSV
        </button>
<button className="px-5 py-2 bg-[#00694f] text-white rounded-lg font-label-lg text-label-lg shadow-md hover:bg-[#00513c] transition-all flex items-center gap-2 shadow-emerald-900/10" onClick={(event) => { openModal('create-modal') } }>
<span className="material-symbols-outlined text-lg">person_add</span>
          + Create Onboarding
        </button>
</div>
</div>

<div className="flex items-center justify-between border-b border-surface-container-high pb-4">
<div className="inline-flex p-1 bg-surface-container-low rounded-xl">
<button className={'px-4 py-2 rounded-lg font-label-lg text-label-lg transition-all flex items-center gap-2 ' + (tab === 'onboarding' ? 'font-semibold bg-surface-container-lowest text-primary shadow-sm' : 'font-medium text-secondary')} id="tab-onboarding-btn" onClick={(event) => { switchTab('onboarding') } }>
<span className="material-symbols-outlined text-base">how_to_reg</span>
          Onboarding
          <span className="px-2 py-0.5 rounded-full text-xs bg-[#E8FAF4] text-[#00694f]">18 Active</span>
</button>
<button className={'px-4 py-2 rounded-lg font-label-lg text-label-lg transition-all flex items-center gap-2 ' + (tab === 'offboarding' ? 'font-semibold bg-surface-container-lowest text-primary shadow-sm' : 'font-medium text-secondary')} id="tab-offboarding-btn" onClick={(event) => { switchTab('offboarding') } }>
<span className="material-symbols-outlined text-base">transfer_within_a_station</span>
          Offboarding
          <span className="px-2 py-0.5 rounded-full text-xs bg-surface-container text-secondary">4 In-Progress</span>
</button>
<button className={'px-4 py-2 rounded-lg font-label-lg text-label-lg transition-all flex items-center gap-2 ' + (tab === 'reports' ? 'font-semibold bg-surface-container-lowest text-primary shadow-sm' : 'font-medium text-secondary')} id="tab-reports-btn" onClick={(event) => { switchTab('reports') } }>
<span className="material-symbols-outlined text-base">monitoring</span>
          Lifecycle Reports &amp; SLAs
        </button>
</div>
<div className="hidden lg:flex items-center gap-4 text-xs text-secondary font-medium">
<span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#00694f]"></span> BGV Gateway Sync: Live</span>
<span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary-fixed-dim"></span> IT Asset Warehouse: 98% Stocked</span>
</div>
</div>

<div className={"space-y-6".replace(/\bhidden\b/g, '') + (tab === 'onboarding' ? '' : ' hidden')} id="view-onboarding">

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

<div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm space-y-2 hover:shadow-md transition-shadow">
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps uppercase text-secondary font-semibold">Total In-Flight Onboardings</span>
<span className="material-symbols-outlined text-primary p-2 bg-[#E8FAF4] rounded-lg text-lg">badge</span>
</div>
<div className="flex items-baseline gap-2">
<span className="font-display-sm text-display-sm text-on-surface font-bold">18</span>
<span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E8FAF4] text-[#00694f]">+4 this week</span>
</div>
<p className="font-body-sm text-body-sm text-secondary">12 Pre-joining, 6 Day-1 to Day-30</p>
</div>

<div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm space-y-2 hover:shadow-md transition-shadow">
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps uppercase text-secondary font-semibold">Day-1 Readiness Rate</span>
<span className="material-symbols-outlined text-primary p-2 bg-[#E8FAF4] rounded-lg text-lg">verified</span>
</div>
<div className="flex items-baseline gap-2">
<span className="font-display-sm text-display-sm text-[#00694f] font-bold">94.2%</span>
<span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E8FAF4] text-[#00694f]">On Track</span>
</div>
<p className="font-body-sm text-body-sm text-secondary">17/18 hardware &amp; credentials issued</p>
</div>

<div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm space-y-2 hover:shadow-md transition-shadow">
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps uppercase text-secondary font-semibold">BGV Verification SLA</span>
<span className="material-symbols-outlined text-secondary p-2 bg-surface-container rounded-lg text-lg">security</span>
</div>
<div className="flex items-baseline gap-2">
<span className="font-display-sm text-display-sm text-on-surface font-bold">4.2 <span className="text-base font-normal text-secondary">Days</span></span>
<span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-secondary-container text-on-secondary-fixed">98% in SLA</span>
</div>
<p className="font-body-sm text-body-sm text-secondary">SpringVerify integrated automated checks</p>
</div>

<div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm space-y-2 hover:shadow-md transition-shadow">
<div className="flex items-center justify-between">
<span className="font-label-caps text-label-caps uppercase text-secondary font-semibold">Induction Buddy Assigned</span>
<span className="material-symbols-outlined text-primary p-2 bg-[#E8FAF4] rounded-lg text-lg">diversity_3</span>
</div>
<div className="flex items-baseline gap-2">
<span className="font-display-sm text-display-sm text-on-surface font-bold">100%</span>
<span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E8FAF4] text-[#00694f]">All paired</span>
</div>
<p className="font-body-sm text-body-sm text-secondary">18 active culture peers actively mentored</p>
</div>
</div>

<div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
<div className="relative flex-1">
<span className="material-symbols-outlined absolute left-3.5 top-2.5 text-secondary text-lg">search</span>
<input className="w-full pl-10 pr-4 py-2 bg-surface-container-low rounded-xl font-body-sm text-body-sm text-on-surface placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-primary shadow-inner" id="onboard-search"  placeholder="Search by candidate name, role, email, or employee ID..." type="text" value={search} onChange={event => (handleSearch)(event.target.value)} />
</div>
<div className="flex flex-wrap items-center gap-2.5">
<select className="px-3 py-2 bg-surface-container-low rounded-xl font-body-sm text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" id="filter-status"  value={filters.status} onChange={event => (value => updateFilter('status', value))(event.target.value)}>
<option value="ALL">All Statuses</option>
<option value="Pre-Boarding">Pre-Boarding</option>
<option value="Day 1 Ready">Day 1 Ready</option>
<option value="BGV Pending">BGV Pending</option>
<option value="Paused">Paused</option>
</select>
<select className="px-3 py-2 bg-surface-container-low rounded-xl font-body-sm text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" id="filter-dept"  value={filters.dept} onChange={event => (value => updateFilter('dept', value))(event.target.value)}>
<option value="ALL">All Departments</option>
<option value="Platform Engg">Platform Engg</option>
<option value="Cloud Inf">Cloud Inf</option>
<option value="UX &amp; Design">UX &amp; Design</option>
<option value="Sales &amp; Solutions">Sales &amp; Solutions</option>
</select>
<select className="px-3 py-2 bg-surface-container-low rounded-xl font-body-sm text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" id="filter-location"  value={filters.location} onChange={event => (value => updateFilter('location', value))(event.target.value)}>
<option value="ALL">All Locations</option>
<option value="Bengaluru HQ">Bengaluru HQ</option>
<option value="Mumbai BKC">Mumbai BKC</option>
<option value="Gurugram Node">Gurugram Node</option>
</select>
<button className="px-3 py-2 rounded-xl text-secondary hover:text-on-surface hover:bg-surface-container-low text-xs font-medium transition-colors flex items-center gap-1" onClick={(event) => { resetFilters() } }>
<span className="material-symbols-outlined text-base">restart_alt</span>
            Reset
          </button>
</div>
</div>

<div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden" id="table-wrapper">
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse">
<thead>
<tr className="bg-surface-container-low/70 text-secondary font-label-caps text-label-caps uppercase tracking-wider">
<th className="py-3.5 px-4 w-12 text-center">
<input className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300" onChange={(event) => { toggleSelectAll(event.currentTarget.checked) } } type="checkbox"/>
</th>
<th className="py-3.5 px-4">Employee / New Hire</th>
<th className="py-3.5 px-4">Role &amp; Department</th>
<th className="py-3.5 px-4">Joining Date</th>
<th className="py-3.5 px-4">Buddy &amp; Manager</th>
<th className="py-3.5 px-4">Induction Progress</th>
<th className="py-3.5 px-4">BGV Status</th>
<th className="py-3.5 px-4">Status</th>
<th className="py-3.5 px-4 text-right">Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-surface-container-low text-on-surface text-body-sm font-body-sm" id="onboarding-table-body">{!loading && pageItems.map(item => <CandidateRow key={item.id} item={item} selected={selected.includes(item.id)} onSelect={toggleSelected} menu={menu} setMenu={setMenu} openCandidateDrawer={openCandidateDrawer} promptPause={promptPause} promptDelete={promptDelete} />)}</tbody>
</table>
</div>

<div className={"hidden p-6 space-y-4".replace(/\bhidden\b/g, '') + (loading ? '' : ' hidden')} id="skeleton-container">
<div className="h-10 bg-surface-container-high rounded animate-pulse"></div>
<div className="h-14 bg-surface-container-low rounded-xl animate-pulse"></div>
<div className="h-14 bg-surface-container-low rounded-xl animate-pulse"></div>
<div className="h-14 bg-surface-container-low rounded-xl animate-pulse"></div>
<div className="h-14 bg-surface-container-low rounded-xl animate-pulse"></div>
<div className="h-14 bg-surface-container-low rounded-xl animate-pulse"></div>
</div>

<div className={"hidden py-16 px-6 text-center space-y-4".replace(/\bhidden\b/g, '') + (!loading && !pageItems.length ? '' : ' hidden')} id="empty-state-container">
<div className="w-20 h-20 mx-auto rounded-full bg-[#E8FAF4] flex items-center justify-center text-[#00694f]">
<span className="material-symbols-outlined text-4xl">search_off</span>
</div>
<div className="max-w-md mx-auto space-y-1">
<h3 className="font-headline-sm text-headline-sm text-on-surface">No Onboarding Workflows Found</h3>
<p className="font-body-md text-body-md text-secondary">We could not find any active onboarding cases matching your active query or criteria filters.</p>
</div>
<button className="px-4 py-2 bg-[#00694f] text-white rounded-lg text-sm font-medium hover:bg-[#00513c] transition-all" onClick={(event) => { resetFilters() } }>
            Clear Filters &amp; View Roster
          </button>
</div>

<div className={"p-4 bg-surface-container-lowest flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-surface-container-high" + (!loading && pageItems.length ? '' : ' hidden')} id="table-pagination-footer">
<div className="flex items-center gap-2 text-xs text-secondary font-medium">
<span id="page-summary-text">{`Showing ${(page - 1) * 6 + 1}-${Math.min(page * 6, filtered.length)} of ${filtered.length} New Hires`}</span>
<span className="text-surface-container-highest">|</span>
<div className="flex items-center gap-1.5">
<span>Rows per page:</span>
<select className="bg-surface-container-low px-2 py-1 rounded text-xs text-on-surface">
<option>6</option>
<option>10</option>
<option>25</option>
</select>
</div>
</div>
<div className="flex items-center gap-1.5">
<button className="p-1.5 rounded-lg text-secondary hover:bg-surface-container disabled:opacity-40 disabled:hover:bg-transparent" disabled={page === 1} id="pagination-prev-btn" onClick={(event) => { prevPage() } }>
<span className="material-symbols-outlined text-lg">chevron_left</span>
</button>
<div className="flex items-center gap-1" id="pagination-pills">{Array.from({length: totalPages}, (_, i) => <button key={i} onClick={() => setPage(i + 1)} className={`w-8 h-8 rounded-lg text-xs ${page === i + 1 ? "bg-primary text-white font-semibold" : "text-secondary hover:bg-surface-container"}`}>{i + 1}</button>)}</div>
<button className="p-1.5 rounded-lg text-secondary hover:bg-surface-container" disabled={page >= totalPages} id="pagination-next-btn" onClick={(event) => { nextPage() } }>
<span className="material-symbols-outlined text-lg">chevron_right</span>
</button>
</div>
</div>
</div>
</div>

<div className={"hidden space-y-6".replace(/\bhidden\b/g, '') + (tab === 'offboarding' ? '' : ' hidden')} id="view-offboarding">
<div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
<div>
<h2 className="font-headline-sm text-headline-sm text-on-surface">Employee Exit &amp; Separation Protocol</h2>
<p className="font-body-md text-body-md text-secondary">Asset recovery, knowledge handover sign-offs, and compliance garden leave management.</p>
</div>
<button className="px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 flex items-center gap-2" onClick={(event) => { triggerToast('Offboarding task assignment dispatched') } }>
<span className="material-symbols-outlined text-lg">exit_to_app</span>
          Initiate Exit Protocol
        </button>
</div>

<div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
<table className="w-full text-left border-collapse">
<thead>
<tr className="bg-surface-container-low text-secondary font-label-caps text-label-caps uppercase">
<th className="py-3.5 px-4">Employee</th>
<th className="py-3.5 px-4">Department &amp; LWD</th>
<th className="py-3.5 px-4">IT Clearance</th>
<th className="py-3.5 px-4">Finance Clearance</th>
<th className="py-3.5 px-4">HR &amp; NDAs</th>
<th className="py-3.5 px-4">Exit Interview</th>
<th className="py-3.5 px-4 text-right">Action</th>
</tr>
</thead>
<tbody className="divide-y divide-surface-container-low text-on-surface text-body-sm font-body-sm">
<tr className="hover:bg-surface-container-low/50 transition-colors">
<td className="py-4 px-4 flex items-center gap-3">
<img className="w-10 h-10 rounded-full object-cover" data-alt="Corporate headshot of an Indian male senior architect in smart collared shirt against neutral soft background" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCY4g-4U5gbMCaMamo46z0teKzLsQFylEgxrj8LNSqlucEDc7dxHKoVu0jBPpVwL-e-HM5Nl05H23T6vtaHq6Nn_p5hsdehblf8FHeO0e27QCtCsqRK90X4wTmOaUWpMIfe7DckVwUqYHDppp-Ayvsjx_zmtbwczyI45S-Npw-fdN0MeExukF-RdisTWO3zalI0agIbFbHywRCdD5ovlyxyyFH37HA4cWFCO8G2gmnnYCFZcchUXCGY"/>
<div>
<p className="font-semibold text-on-surface">Devendra Pratap Singh</p>
<p className="text-xs text-secondary">EMP-2021-014 • Principal SRE</p>
</div>
</td>
<td className="py-4 px-4">
<p className="font-medium text-on-surface">Cloud Infrastructure</p>
<p className="text-xs text-secondary">LWD: 14 Mar 2025</p>
</td>
<td className="py-4 px-4"><span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E8FAF4] text-[#00694f]">Assets Returned</span></td>
<td className="py-4 px-4"><span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E8FAF4] text-[#00694f]">Full &amp; Final Done</span></td>
<td className="py-4 px-4"><span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#B45309]">IP Signoff Pending</span></td>
<td className="py-4 px-4"><span className="text-xs font-medium text-secondary">Scheduled (12 Mar, 4 PM)</span></td>
<td className="py-4 px-4 text-right"><button className="p-1 rounded text-secondary hover:text-primary"><span className="material-symbols-outlined text-lg">more_vert</span></button></td>
</tr>
<tr className="hover:bg-surface-container-low/50 transition-colors">
<td className="py-4 px-4 flex items-center gap-3">
<img className="w-10 h-10 rounded-full object-cover" data-alt="Professional studio portrait of an Indian woman engineering manager with friendly smile and navy blazer" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBRZhdn46XIS4X-XYTvafsl2tRLNDEGVkXlf_KicThNPyaMQ5Udy4zRSxQv9e02ZeuOyRRFfLg31QvR2CXE-dQO4tSJqF-EY0gub08N8UR1sV3-2DnFeR2j6KtC3Ra79Ks38q-4_ZpbdF8oGCUyv3JFneWgLc8eiogamDsGY0GNN21YlCP89dVkZ3wCjn2Npc7kNc8OodZvLo3KfbUx7ZlDgMz2tp7FOW5QqHsocMJVMxlowrUFwfSI"/>
<div>
<p className="font-semibold text-on-surface">Nandini Chawla</p>
<p className="text-xs text-secondary">EMP-2022-088 • Product Lead</p>
</div>
</td>
<td className="py-4 px-4">
<p className="font-medium text-on-surface">Product &amp; Growth</p>
<p className="text-xs text-secondary">LWD: 28 Mar 2025</p>
</td>
<td className="py-4 px-4"><span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#B45309]">Pending Device Handover</span></td>
<td className="py-4 px-4"><span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-container text-secondary">Audit in Queue</span></td>
<td className="py-4 px-4"><span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E8FAF4] text-[#00694f]">Completed</span></td>
<td className="py-4 px-4"><span className="text-xs font-medium text-secondary">Completed (8 Mar)</span></td>
<td className="py-4 px-4 text-right"><button className="p-1 rounded text-secondary hover:text-primary"><span className="material-symbols-outlined text-lg">more_vert</span></button></td>
</tr>
<tr className="hover:bg-surface-container-low/50 transition-colors">
<td className="py-4 px-4 flex items-center gap-3">
<img className="w-10 h-10 rounded-full object-cover" data-alt="Portrait of an Indian enterprise sales director in tailored suit with glasses in modern office setting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBOfr-ELfVvD5f1IlPNxvCnTEhYnsKHy-G9T563an-v7zSKCAzOxn1k5jdE4NCasBb4AWVzLVerskAZApjIRbG09ltp4IJBqXCZed0R0HfovbKkrsoFy9saJ0l-g5Lk_e_O5_RuWuXfL_uLMnSm3TnFmTwboQmXucVnuqDumkfAxOx71BKGzdieTfQkPPr4L6oYrTw3OBxvvgjMXMFFMlSx3mk06wztdJHhXhUfQmckMANSbHwDjDc6"/>
<div>
<p className="font-semibold text-on-surface">Aditya Menon</p>
<p className="text-xs text-secondary">EMP-2023-142 • Senior Account Exec</p>
</div>
</td>
<td className="py-4 px-4">
<p className="font-medium text-on-surface">Enterprise Sales</p>
<p className="text-xs text-secondary">LWD: 05 Apr 2025</p>
</td>
<td className="py-4 px-4"><span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-container text-secondary">Not Started</span></td>
<td className="py-4 px-4"><span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-container text-secondary">Pending Invoices</span></td>
<td className="py-4 px-4"><span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-container text-secondary">Draft Issued</span></td>
<td className="py-4 px-4"><span className="text-xs font-medium text-secondary">Not Scheduled</span></td>
<td className="py-4 px-4 text-right"><button className="p-1 rounded text-secondary hover:text-primary"><span className="material-symbols-outlined text-lg">more_vert</span></button></td>
</tr>
<tr className="hover:bg-surface-container-low/50 transition-colors">
<td className="py-4 px-4 flex items-center gap-3">
<img className="w-10 h-10 rounded-full object-cover" data-alt="Professional headshot of a young Indian male data analyst in smart casual attire with neutral grey background" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBByhfPGgeah4HNrHj1vUCkdPPH5Trl2Z4RScXCqIlzgrLvI5Z1SKhl53eHgdVT_hkjoAPLu2pGxvNe7l0w6g9iw1k5J1d6iVdWbyreMd-G7zq64XhJ8zhwgFWF00b2yNfAqxCtL1zufmQ87FS4GPAnTqrkHzQTwycQfdBZcqWgnPB8TX6aNEXES8NLKrYRf9rLtqiSDaTG3-FViptjXfRcNBE_u4Kb32RU4sKb72mDXAtEfUnRFiLS"/>
<div>
<p className="font-semibold text-on-surface">Tarun Vats</p>
<p className="text-xs text-secondary">EMP-2024-031 • Data Analyst</p>
</div>
</td>
<td className="py-4 px-4">
<p className="font-medium text-on-surface">Analytics &amp; BI</p>
<p className="text-xs text-secondary">LWD: 10 Apr 2025</p>
</td>
<td className="py-4 px-4"><span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-container text-secondary">Scheduled</span></td>
<td className="py-4 px-4"><span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E8FAF4] text-[#00694f]">Cleared</span></td>
<td className="py-4 px-4"><span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E8FAF4] text-[#00694f]">Completed</span></td>
<td className="py-4 px-4"><span className="text-xs font-medium text-secondary">Scheduled (18 Mar)</span></td>
<td className="py-4 px-4 text-right"><button className="p-1 rounded text-secondary hover:text-primary"><span className="material-symbols-outlined text-lg">more_vert</span></button></td>
</tr>
</tbody>
</table>
</div>
</div>

<div className={"hidden space-y-6".replace(/\bhidden\b/g, '') + (tab === 'reports' ? '' : ' hidden')} id="view-reports">
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">

<div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm space-y-4 col-span-2">
<div className="flex items-center justify-between">
<div>
<h3 className="font-headline-sm text-headline-sm text-on-surface">Cohort SLA Fulfilment (Q1 2025)</h3>
<p className="text-xs text-secondary">Target: 95% Day-1 Readiness across Indian technology centers</p>
</div>
<span className="text-xs font-bold text-[#00694f] bg-[#E8FAF4] px-2.5 py-1 rounded-full">98.2% Actual</span>
</div>

<div className="space-y-3 pt-2">
<div>
<div className="flex justify-between text-xs font-semibold mb-1">
<span>IT Provisioning &amp; Laptop Delivery</span>
<span>99.1% SLA</span>
</div>
<div className="h-3 w-full bg-surface-container-high rounded-full overflow-hidden">
<div className="h-full bg-[#00694f] rounded-full" style={{"width":"99.1%"}}></div>
</div>
</div>
<div>
<div className="flex justify-between text-xs font-semibold mb-1">
<span>BGV Turnaround (&lt; 5 Business Days)</span>
<span>96.4% SLA</span>
</div>
<div className="h-3 w-full bg-surface-container-high rounded-full overflow-hidden">
<div className="h-full bg-primary-container rounded-full" style={{"width":"96.4%"}}></div>
</div>
</div>
<div>
<div className="flex justify-between text-xs font-semibold mb-1">
<span>Induction Buddy 1-on-1 Completion</span>
<span>92.0% SLA</span>
</div>
<div className="h-3 w-full bg-surface-container-high rounded-full overflow-hidden">
<div className="h-full bg-secondary rounded-full" style={{"width":"92%"}}></div>
</div>
</div>
<div>
<div className="flex justify-between text-xs font-semibold mb-1">
<span>Statutory EPF &amp; Gratuity Signoff</span>
<span>100.0% SLA</span>
</div>
<div className="h-3 w-full bg-surface-container-high rounded-full overflow-hidden">
<div className="h-full bg-[#00694f] rounded-full" style={{"width":"100%"}}></div>
</div>
</div>
</div>
</div>

<div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm flex flex-col justify-between space-y-4">
<div>
<h3 className="font-headline-sm text-headline-sm text-on-surface">New Hire Net CSAT</h3>
<p className="text-xs text-secondary">Pulse feedback collected on Day 7 &amp; 30</p>
</div>
<div className="flex flex-col items-center justify-center py-4">

<div className="relative w-36 h-36 flex items-center justify-center">
<svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
<path className="text-surface-container-high stroke-current" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth="3.5"></path>
<path className="text-[#00694f] stroke-current" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeDasharray="91, 100" strokeLinecap="round" strokeWidth="3.5"></path>
</svg>
<div className="absolute flex flex-col items-center">
<span className="font-display-sm text-display-sm font-bold text-on-surface">4.8</span>
<span className="text-[10px] text-secondary font-semibold uppercase">out of 5.0</span>
</div>
</div>
</div>
<div className="p-3 bg-surface-container-low rounded-xl text-center">
<p className="text-xs font-semibold text-on-surface">"Super seamless laptop delivery and clear buddy mentorship."</p>
<p className="text-[11px] text-secondary mt-1">— Ananya Deshmukh (L6 Distributed Systems)</p>
</div>
</div>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 pointer-events-none transition-all duration-300".replace('pointer-events-none', '') + (drawer ? '' : ' pointer-events-none')} id="quick-drawer">
<div className={"absolute inset-0 bg-[#0E2B3D]/40 backdrop-blur-sm opacity-0 pointer-events-none transition-opacity duration-300".replace('opacity-0 pointer-events-none', '') + (drawer ? ' opacity-100 pointer-events-auto' : ' opacity-0 pointer-events-none')} id="drawer-backdrop" onClick={(event) => { closeDrawer('quick-drawer') } }></div>
<div className={"absolute right-0 top-0 h-full w-full max-w-xl bg-surface-container-lowest shadow-2xl translate-x-full transition-transform duration-300 flex flex-col pointer-events-auto".replace('translate-x-full', '') + (drawer ? '' : ' translate-x-full')} id="drawer-panel">

<div className="p-6 bg-[#0E2B3D] text-white flex items-center justify-between">
<div className="flex items-center gap-3">
<div className="w-12 h-12 rounded-full border-2 border-[#1CCA9B] overflow-hidden flex items-center justify-center font-bold shrink-0">{actionCandidate?.img ? <img className="w-full h-full object-cover" src={actionCandidate.img} alt={actionCandidate.name} /> : actionCandidate?.name.split(' ').map(part => part[0]).join('')}</div>
<div>
<div className="flex items-center gap-2">
<h2 className="text-lg font-bold">{actionCandidate?.name}</h2>
<span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#1CCA9B]/20 text-[#1CCA9B]">{actionCandidate?.status}</span>
</div>
<p className="text-xs text-white/70">{actionCandidate?.id} • {actionCandidate?.role}</p>
</div>
</div>
<button className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors" onClick={(event) => { closeDrawer('quick-drawer') } }>
<span className="material-symbols-outlined text-lg">close</span>
</button>
</div>

<div className="flex-1 overflow-y-auto p-6 space-y-6">

<div className="grid grid-cols-3 gap-3">
<div className="p-3 bg-surface-container-low rounded-xl text-center">
<span className="text-[10px] text-secondary font-semibold uppercase">Joining Date</span>
<p className="text-sm font-bold text-on-surface mt-1">{actionCandidate?.joining}</p>
</div>
<div className="p-3 bg-surface-container-low rounded-xl text-center">
<span className="text-[10px] text-secondary font-semibold uppercase">Office Location</span>
<p className="text-sm font-bold text-on-surface mt-1">{actionCandidate?.location}</p>
</div>
<div className="p-3 bg-surface-container-low rounded-xl text-center">
<span className="text-[10px] text-secondary font-semibold uppercase">BGV SpringVerify</span>
<p className="text-sm font-bold text-[#00694f] mt-1">{actionCandidate?.bgvStatus}</p>
</div>
</div>

<div className="space-y-3">
<div className="flex items-center justify-between">
<h4 className="font-title-md text-title-md text-on-surface">Induction Milestones</h4>
<span className="text-xs font-bold text-primary">{actionCandidate?.tasksDone} of {actionCandidate?.tasksTotal} Complete ({actionCandidate?.progressPct}%)</span>
</div>
<div className="space-y-2.5">
<div className="p-3 rounded-xl bg-surface-container-low/60 flex items-center justify-between">
<div className="flex items-center gap-3">
<span className="material-symbols-outlined text-[#00694f] text-lg">check_circle</span>
<div>
<p className="text-xs font-semibold text-on-surface">Offer Letter &amp; PF Nomination Form</p>
<p className="text-[11px] text-secondary">Signed via DigiSigner on 18 Feb 2025</p>
</div>
</div>
<span className="text-xs text-secondary font-medium">Done</span>
</div>
<div className="p-3 rounded-xl bg-surface-container-low/60 flex items-center justify-between">
<div className="flex items-center gap-3">
<span className="material-symbols-outlined text-[#00694f] text-lg">check_circle</span>
<div>
<p className="text-xs font-semibold text-on-surface">Hardware IT Kit Delivery</p>
<p className="text-[11px] text-secondary">MacBook Pro M3 Max 32GB dispatched (AirWay: BLR-48902)</p>
</div>
</div>
<span className="text-xs text-secondary font-medium">Delivered</span>
</div>
<div className="p-3 rounded-xl bg-surface-container-low/60 flex items-center justify-between">
<div className="flex items-center gap-3">
<span className="material-symbols-outlined text-[#00694f] text-lg">check_circle</span>
<div>
<p className="text-xs font-semibold text-on-surface">SSO &amp; GitHub Org Invitation</p>
<p className="text-[11px] text-secondary">YubiKey 5C credential generated</p>
</div>
</div>
<span className="text-xs text-secondary font-medium">Provisioned</span>
</div>
<div className="p-3 rounded-xl bg-surface-container-low/60 flex items-center justify-between">
<div className="flex items-center gap-3">
<span className="material-symbols-outlined text-[#B45309] text-lg">hourglass_top</span>
<div>
<p className="text-xs font-semibold text-on-surface">Day-1 Culture Induction Session</p>
<p className="text-[11px] text-secondary">With Culture Buddy Rajeshwar Rao &amp; HR Priya Sharma</p>
</div>
</div>
<span className="text-xs font-bold text-[#B45309]">Scheduled</span>
</div>
</div>
</div>

<div className="p-4 bg-surface-container-low rounded-xl space-y-3">
<h4 className="text-xs font-semibold text-secondary uppercase tracking-wider">Assigned Stakeholders</h4>
<div className="flex items-center justify-between">
<div className="flex items-center gap-2.5">
<div className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-fixed flex items-center justify-center font-bold text-xs">RR</div>
<div>
<p className="text-xs font-bold text-on-surface">{actionCandidate?.buddy}</p>
<p className="text-[10px] text-secondary">Assigned Culture Buddy (Staff Engg)</p>
</div>
</div>
<button className="px-2.5 py-1 text-xs bg-surface-container-lowest rounded-md text-on-surface hover:text-primary shadow-sm font-medium">Ping Buddy</button>
</div>
<div className="flex items-center justify-between">
<div className="flex items-center gap-2.5">
<div className="w-8 h-8 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-bold text-xs">AM</div>
<div>
<p className="text-xs font-bold text-on-surface">{actionCandidate?.manager}</p>
<p className="text-[10px] text-secondary">Reporting Manager (VP Engineering)</p>
</div>
</div>
<button className="px-2.5 py-1 text-xs bg-surface-container-lowest rounded-md text-on-surface hover:text-primary shadow-sm font-medium">Profile</button>
</div>
</div>
</div>

<div className="p-4 bg-surface-container-low flex items-center justify-between gap-3">
<button className="w-full py-2.5 bg-[#00694f] text-white rounded-xl font-label-lg text-label-lg font-semibold hover:bg-[#00513c] transition-colors text-center shadow-md" onClick={(event) => { triggerToast('Opening comprehensive employee dossier...') } }>
          Open Full Onboarding Detail Record
        </button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center opacity-0 pointer-events-none transition-all duration-200".replace('opacity-0 pointer-events-none', '') + (modal === 'create-modal' ? ' opacity-100 pointer-events-auto' : ' opacity-0 pointer-events-none')} id="create-modal">
<div className="absolute inset-0 bg-[#0E2B3D]/50 backdrop-blur-sm" onClick={(event) => { closeModal('create-modal') } }></div>
<div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden z-10 flex flex-col max-h-[921px]">

<div className="p-6 bg-[#0E2B3D] text-white flex items-center justify-between">
<div>
<h3 className="font-headline-sm text-headline-sm font-semibold">Initiate New Hire Onboarding Workflow</h3>
<p className="text-xs text-white/70 mt-0.5">Generate profile credentials, dispatch IT provisioning, and configure compliance milestones.</p>
</div>
<button className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors" onClick={(event) => { closeModal('create-modal') } }>
<span className="material-symbols-outlined text-lg">close</span>
</button>
</div>

<form className="p-6 space-y-4 overflow-y-auto flex-1" id="create-onboarding-form" onSubmit={(event) => { handleCreateSubmit(event) } }>
<div className="space-y-1.5">
<label className="block text-xs font-semibold text-on-surface">Select New Hire Candidate <span className="text-error">*</span></label>
<select className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-body-sm font-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" id="new-hire-select" required>
<option value="">-- Choose Offered Candidate from Recruitment Pipeline --</option>
<option value="Vikramaditya Sen|Platform Engg|EMP-2025-097|Senior Staff Architect">Vikramaditya Sen — Offer Accepted (Principal Platform Engg)</option>
<option value="Rahul Nair|Cloud Inf|EMP-2025-098|Senior Cloud SecOps">Rahul Nair — Offer Accepted (Senior Cloud SecOps)</option>
<option value="Meera Chopra|UX &amp; Design|EMP-2025-099|Lead Design System Engg">Meera Chopra — Offer Accepted (Lead Design System Engg)</option>
<option value="Anand Mohan|Sales &amp; Solutions|EMP-2025-100|Director Enterprise Sales">Anand Mohan — Offer Accepted (Director Enterprise Sales)</option>
</select>
</div>
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
<div className="space-y-1.5">
<label className="block text-xs font-semibold text-on-surface">Onboarding Template <span className="text-error">*</span></label>
<select className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-body-sm font-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" required>
<option>Engineering L6-L8 Technical Onboarding</option>
<option>Product &amp; UX Induction Track</option>
<option>Corporate &amp; Sales Acceleration Track</option>
<option>Executive Management Onboarding</option>
</select>
</div>
<div className="space-y-1.5">
<label className="block text-xs font-semibold text-on-surface">Official Joining Date <span className="text-error">*</span></label>
<input className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-body-sm font-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" required type="date" defaultValue="2025-03-24"/>
</div>
</div>
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
<div className="space-y-1.5">
<label className="block text-xs font-semibold text-on-surface">Assign Induction Culture Buddy <span className="text-error">*</span></label>
<select className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-body-sm font-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" required>
<option>Rajeshwar Rao (Staff Systems Architect)</option>
<option>Kavita Sundaram (Principal Product Designer)</option>
<option>Arunachalam Murthy (VP Engineering)</option>
<option>Priya Sharma (HR Director)</option>
</select>
</div>
<div className="space-y-1.5">
<label className="block text-xs font-semibold text-on-surface">Reporting Manager <span className="text-error">*</span></label>
<input className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-body-sm font-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" type="text" defaultValue="Arunachalam Murthy (VP Engg)"/>
</div>
</div>
<div className="space-y-1.5">
<label className="block text-xs font-semibold text-on-surface">Laptop &amp; IT Provisioning Kit</label>
<div className="grid grid-cols-2 gap-2 text-xs">
<label className="flex items-center gap-2 p-2.5 bg-surface-container-low rounded-lg cursor-pointer">
<input defaultChecked className="w-4 h-4 text-primary rounded" type="checkbox"/>
<span>MacBook Pro M3 Max (32GB)</span>
</label>
<label className="flex items-center gap-2 p-2.5 bg-surface-container-low rounded-lg cursor-pointer">
<input defaultChecked className="w-4 h-4 text-primary rounded" type="checkbox"/>
<span>Dell UltraSharp 27" 4K Monitor</span>
</label>
<label className="flex items-center gap-2 p-2.5 bg-surface-container-low rounded-lg cursor-pointer">
<input defaultChecked className="w-4 h-4 text-primary rounded" type="checkbox"/>
<span>YubiKey 5C NFC Security Key</span>
</label>
<label className="flex items-center gap-2 p-2.5 bg-surface-container-low rounded-lg cursor-pointer">
<input className="w-4 h-4 text-primary rounded" type="checkbox"/>
<span>Enterprise Noise-Cancelling Headset</span>
</label>
</div>
</div>
<div className="p-3 bg-surface-container-low rounded-xl flex items-center gap-3">
<span className="material-symbols-outlined text-primary text-xl">mark_email_read</span>
<p className="text-xs text-secondary">Automated welcome kit and pre-joining questionnaire will be dispatched upon confirmation.</p>
</div>

<div className="pt-4 flex items-center justify-end gap-3 border-t border-surface-container-high">
<button className="px-4 py-2 bg-surface-container-low text-secondary rounded-lg text-sm font-medium hover:bg-surface-container transition-colors" onClick={(event) => { closeModal('create-modal') } } type="button">
            Cancel
          </button>
<button className="px-5 py-2 bg-[#00694f] text-white rounded-lg text-sm font-semibold hover:bg-[#00513c] transition-colors shadow-md" type="submit">
            Create Onboarding &amp; Send Welcome Email
          </button>
</div>
</form>
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center opacity-0 pointer-events-none transition-all duration-200".replace('opacity-0 pointer-events-none', '') + (modal === 'pause-modal' ? ' opacity-100 pointer-events-auto' : ' opacity-0 pointer-events-none')} id="pause-modal">
<div className="absolute inset-0 bg-[#0E2B3D]/50 backdrop-blur-sm" onClick={(event) => { closeModal('pause-modal') } }></div>
<div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 z-10 space-y-4">
<div className="w-12 h-12 rounded-full bg-[#FEF3C7] text-[#B45309] flex items-center justify-center mx-auto">
<span className="material-symbols-outlined text-2xl">pause_circle</span>
</div>
<div className="text-center space-y-1">
<h3 className="font-headline-sm text-headline-sm text-on-surface">Pause Onboarding Workflow?</h3>
<p className="text-xs text-secondary" id="pause-modal-subtitle">{actionCandidate ? `Pause onboarding for ${actionCandidate.name} (${actionCandidate.id})?` : 'Select a candidate from the roster to pause their onboarding.'}</p>
</div>
<div className="space-y-3">
<div className="space-y-1">
<label className="text-xs font-semibold text-on-surface">Reason for Workflow Pause</label>
<select className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface">
<option>Candidate Joining Postponed by Mutual Agreement</option>
<option>Academic or Previous Employer Document Clearance Pending</option>
<option>Personal Medical Leave Requested</option>
<option>Background Verification Escalation</option>
</select>
</div>
<div className="space-y-1">
<label className="text-xs font-semibold text-on-surface">Target Resumption Date</label>
<input className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface" type="date" defaultValue="2025-04-01"/>
</div>
</div>
<div className="flex items-center gap-3 pt-2">
<button className="w-1/2 py-2 bg-surface-container-low text-secondary rounded-lg text-sm font-medium hover:bg-surface-container transition-colors" onClick={(event) => { closeModal('pause-modal') } }>
          Cancel
        </button>
<button className="w-1/2 py-2 bg-[#B45309] text-white rounded-lg text-sm font-semibold hover:bg-[#92400e] transition-colors shadow-sm" onClick={(event) => { confirmPauseWorkflow() } }>
          Confirm Pause
        </button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center opacity-0 pointer-events-none transition-all duration-200".replace('opacity-0 pointer-events-none', '') + (modal === 'delete-modal' ? ' opacity-100 pointer-events-auto' : ' opacity-0 pointer-events-none')} id="delete-modal">
<div className="absolute inset-0 bg-[#0E2B3D]/50 backdrop-blur-sm" onClick={(event) => { closeModal('delete-modal') } }></div>
<div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 z-10 space-y-4">
<div className="w-12 h-12 rounded-full bg-[#FFE4E6] text-error flex items-center justify-center mx-auto">
<span className="material-symbols-outlined text-2xl">delete_forever</span>
</div>
<div className="text-center space-y-1">
<h3 className="font-headline-sm text-headline-sm text-error">Confirm Record Termination</h3>
<p className="text-xs text-secondary" id="delete-modal-subtitle">{actionCandidate ? `Delete the onboarding record for ${actionCandidate.name} (${actionCandidate.id})?` : 'Select a candidate from the roster to delete their onboarding.'}</p>
</div>
<div className="p-3 bg-error-container/40 rounded-xl text-xs text-on-error-container space-y-1">
<p className="font-semibold">Destructive Action Warning:</p>
<p>This action cannot be undone. Any provisioned SSO access keys will be instantly purged.</p>
</div>
<div className="flex items-center gap-3 pt-2">
<button className="w-1/2 py-2 bg-surface-container-low text-secondary rounded-lg text-sm font-medium hover:bg-surface-container transition-colors" onClick={(event) => { closeModal('delete-modal') } }>
          Keep Onboarding
        </button>
<button className="w-1/2 py-2 bg-error text-white rounded-lg text-sm font-semibold hover:bg-error/90 transition-colors shadow-sm" onClick={(event) => { confirmDeleteWorkflow() } }>
          Confirm Delete
        </button>
</div>
</div>
</div>

<div className={"fixed bottom-6 right-6 z-50 bg-[#0E2B3D] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 translate-y-20 opacity-0 transition-all duration-300 pointer-events-none".replace('translate-y-20 opacity-0', '') + (toast ? ' translate-y-0 opacity-100' : ' translate-y-20 opacity-0')} id="toast-notification">
<span className="material-symbols-outlined text-[#1CCA9B] text-xl">check_circle</span>
<span className="text-xs font-medium" id="toast-message">{toast}</span>
</div>
</div>
</main></div></>);
}

export default function App() {
 const [route, setRoute] = useState(() => typeof window === 'undefined' ? '' : window.location.hash);
 useEffect(() => {
  const update = () => setRoute(window.location.hash);
  window.addEventListener('hashchange', update);
  return () => window.removeEventListener('hashchange', update);
 }, []);
 if (route === '#/recruitment-detail' || route === '#/recruitment') return <RecruitmentDetail />;
 if (route === '#/learning') return <Learning />;
 if (route === '#/reports') return <Reports />;
 if (route === '#/onboarding-detail') return <OnboardingDetail />;
 if (route === '#/one-on-one-meetings') return <OneOnOnes />;
 if (route === '#/payroll') return <Payroll />;
 if (route === '#/approvals') return <Approvals />;
 if (route === '#/interview-calendar') return <InterviewCalendar />;
 if (route === '#/candidate-pipeline') return <CandidatePipeline />;
 if (route === '#/attendance-regularization') return <AttendanceRegularization />;
 if (route === '#/resume-inbox') return <ResumeInbox />;
 if (route === '#/succession') return <Succession />;
 if (route === '#/survey-builder') return <SurveyBuilder />;
 if (route === '#/survey-results') return <SurveyResults />;
 if (route === '#/workforce-planning') return <WorkforcePlanning />;
 if (route === '#/candidate-dossier') return <CandidateDossier />;
 if (route === '#/attendance') return <Attendance />;
 if (route === '#/helpdesk') return <Helpdesk />;
 if (route === '#/headcount-requisitions') return <HeadcountRequisitions />;
 return route === '#/create-course' ? <CreateCourse /> : <OnboardingApp />;
}
