import { useEffect, useRef, useState } from 'react';
import { Sidebar, Header } from './Layout.jsx';
import { initialAttendanceRecords } from './attendanceData.js';
import { AttendanceRow, AttendanceRoster } from './AttendanceComponents.jsx';
export default function Attendance() {
 const [view,setView]=useState('overview');
 const [drawer,setDrawer]=useState(false);
 const [drawerTitle,setDrawerTitle]=useState('Present Employees');
 const [drawerSearch,setDrawerSearch]=useState('');
 const [drilldown,setDrilldown]=useState(false);
 const [activeId,setActiveId]=useState(1);
 const [modal,setModal]=useState(false);
 const [search,setSearch]=useState('');
 const [department,setDepartment]=useState('All Departments');
 const [status,setStatus]=useState('All Statuses');
 const [showDateFilters,setShowDateFilters]=useState(false);
 const [fromDate,setFromDate]=useState('');
 const [toDate,setToDate]=useState('');
 const [manual,setManual]=useState({employee:'Sarah Jenkins (ENG-042)',punchIn:'09:00',punchOut:'17:00',reason:'',date:'2023-10-24'});
 const [manualRequests,setManualRequests]=useState([]);
 const [toast,setToast]=useState('');
 const timer=useRef();
 const active=initialAttendanceRecords.find(row=>row.id===activeId)||initialAttendanceRecords[0];
 const historyRows=initialAttendanceRecords.filter(row=>(!fromDate||row.date>=fromDate)&&(!toDate||row.date<=toDate)&&(department==='All Departments'||row.department===department)&&(status==='All Statuses'||row.status===(status==='Late'?'Late Arrival':status))&&[row.name,row.employeeId,row.department].some(value=>value.toLowerCase().includes(search.toLowerCase())));
 const drawerRows=initialAttendanceRecords.filter(row=>row.status===({'Present Employees':'Present','Absent Employees':'Absent','Late Arrivals':'Late Arrival','Remote Workers':'Remote','On Leave':'On Leave'})[drawerTitle]&&[row.name,row.employeeId].some(value=>value.toLowerCase().includes(drawerSearch.toLowerCase())));
 const switchState=setView;
 const switchTab=setView;
 const toggleDrawer=title=>{if(title){setDrawerTitle(title);setDrawerSearch('');setDrawer(true);}else setDrawer(previous=>!previous);};
 const toggleDrilldown=()=>setDrilldown(previous=>!previous);
 const openRecord=id=>{setActiveId(id);setDrawer(false);setDrilldown(true);};
 const openModal=()=>setModal(previous=>!previous);
 const [exportMenu,setExportMenu]=useState(false);
 const toggleExportMenu=()=>setExportMenu(previous=>!previous);
 const triggerToast=(message='Export preview: no file was generated.')=>{clearTimeout(timer.current);setExportMenu(false);setToast(/export|report generated/i.test(message)?'Export is a prototype. No file was generated.':/reminder sent/i.test(message)?'Reminder preview only. No message was sent.':message);timer.current=setTimeout(()=>setToast(''),3000);};
 const toggleDateFilter=()=>{setView('history');setShowDateFilters(previous=>!previous);};
 const submitManual=()=>{if(!manual.date||!manual.punchIn||!manual.punchOut||manual.punchOut<=manual.punchIn||!manual.reason.trim()){triggerToast('Choose a date, a valid punch range, and a reason.');return;}setManualRequests(previous=>[...previous,{...manual,reason:manual.reason.trim()}]);setModal(false);setView('history');triggerToast('Manual attendance request saved locally for review.');};
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 useEffect(()=>{const id=modal?'manual-modal':drilldown?'drilldown-drawer':drawer?'drawer':null;if(!id)return;const dialog=document.getElementById(id),previous=document.activeElement;dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',id.replaceAll('-',' '));const controls=()=>[...dialog.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled);controls()[0]?.focus();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';const keydown=event=>{if(event.key==='Escape'){if(modal)setModal(false);else if(drilldown)setDrilldown(false);else setDrawer(false);}if(event.key==='Tab'){const items=controls(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};document.addEventListener('keydown',keydown);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keydown);previous?.focus();};},[modal,drilldown,drawer]);
 return (<><Sidebar activePage="attendance" /><div className="pl-64"><Header /><main className="relative pt-16 bg-surface min-h-[calc(100vh-4rem)] p-space-xl"><div className="flex flex-col w-full">

<div className="bg-surface-container-high px-space-xl py-space-sm mb-space-lg rounded-xl flex flex-wrap items-center justify-between gap-space-md shadow-sm">
<div className="flex items-center gap-space-xs">
<span className="material-symbols-outlined text-primary text-[18px]">tune</span>
<span className="font-label-caps text-on-surface-variant">Simulator States:</span>
</div>
<div className="flex flex-wrap items-center gap-space-xs">
<button className={"px-space-md py-1 rounded-full text-label-md transition-all" + (view==='overview' ? ' bg-primary text-on-primary' : ' bg-surface text-on-surface')} id="btn-overview" onClick={event=>{switchState('overview')}}>1. Today Overview</button>
<button className={"px-space-md py-1 rounded-full text-label-md hover:bg-surface-container transition-all" + (view==='history' ? ' bg-primary text-on-primary' : ' bg-surface text-on-surface')} id="btn-history" onClick={event=>{switchState('history')}}>2. History Ledger</button>
<button className="px-space-md py-1 rounded-full text-label-md bg-surface text-on-surface hover:bg-surface-container transition-all" onClick={event=>{toggleDrawer()}}>3. Drawer Present</button>
<button className="px-space-md py-1 rounded-full text-label-md bg-surface text-on-surface hover:bg-surface-container transition-all" onClick={event=>{toggleDateFilter()}}>4. Date Filter</button>
<button className="px-space-md py-1 rounded-full text-label-md bg-surface text-on-surface hover:bg-surface-container transition-all" onClick={event=>{toggleDrilldown()}}>5. Drill-down</button>
<button className="px-space-md py-1 rounded-full text-label-md bg-surface text-on-surface hover:bg-surface-container transition-all" onClick={event=>{openModal()}}>6. Manual Entry</button>
<button className="px-space-md py-1 rounded-full text-label-md bg-surface text-on-surface hover:bg-surface-container transition-all" onClick={event=>{triggerToast()}}>7. Export Toast</button>
<button className={"px-space-md py-1 rounded-full text-label-md hover:bg-surface-container transition-all" + (view==='empty' ? ' bg-primary text-on-primary' : ' bg-surface text-on-surface')} id="btn-empty" onClick={event=>{switchState('empty')}}>8. Empty State</button>
<button className={"px-space-md py-1 rounded-full text-label-md hover:bg-surface-container transition-all" + (view==='loading' ? ' bg-primary text-on-primary' : ' bg-surface text-on-surface')} id="btn-loading" onClick={event=>{switchState('loading')}}>9. Loading Skeleton</button>
</div>
</div>

<div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-xl">
<div>
<h1 className="font-headline-lg text-on-surface">Attendance & Time Tracking Suite</h1><p className="text-body-sm text-secondary">Local sample data ? <a href="#/attendance-regularization" className="hover:underline">Regularization &amp; WFH requests</a></p>
<p className="text-body-md text-on-surface-variant">Monitor live workforce presence, analyze historical compliance, and manage time anomalies.</p>
</div>
<div className="flex items-center gap-space-md">
<button className="h-10 px-space-lg bg-primary text-on-primary font-label-lg rounded-lg hover:bg-primary-container transition-all flex items-center gap-space-xs shadow-sm" onClick={event=>{openModal()}}>
<span className="material-symbols-outlined text-[18px]">add</span>Mark Manual Entry
      </button>
<div className="relative">
<button className="h-10 px-space-md bg-surface-container-low text-on-surface font-label-lg rounded-lg hover:bg-surface-container transition-all flex items-center gap-space-xs shadow-sm" onClick={event=>{toggleExportMenu()}}>
<span className="material-symbols-outlined text-[18px]">download</span>Export
          <span className="material-symbols-outlined text-[16px]">expand_more</span>
</button>

<div className={" absolute right-0 mt-2 w-48 bg-surface rounded-xl shadow-xl p-space-sm z-30" + (exportMenu ? '' : ' hidden')} id="export-menu">
<button className="w-full text-left px-space-md py-2 rounded-lg hover:bg-surface-container text-body-md flex items-center gap-space-xs" onClick={event=>{triggerToast('CSV Export generated successfully!')}}>
<span className="material-symbols-outlined text-[16px]">description</span>Export as CSV
          </button>
<button className="w-full text-left px-space-md py-2 rounded-lg hover:bg-surface-container text-body-md flex items-center gap-space-xs" onClick={event=>{triggerToast('Excel Report generated successfully!')}}>
<span className="material-symbols-outlined text-[16px]">table_chart</span>Export as Excel
          </button>
</div>
</div>
</div>
</div>

<div className="flex items-center gap-space-sm mb-space-xl border-b border-surface-container-high pb-space-sm">
<button className={"px-space-lg py-2 rounded-lg font-label-lg transition-all" + (view==='overview' ? ' bg-primary text-on-primary' : ' bg-surface text-on-surface')} id="tab-overview" onClick={event=>{switchTab('overview')}}>Today Overview</button>
<button className={"px-space-lg py-2 rounded-lg font-label-lg transition-all text-on-surface-variant hover:bg-surface-container" + (view==='history' ? ' bg-primary text-on-primary' : ' bg-surface text-on-surface')} id="tab-history" onClick={event=>{switchTab('history')}}>Attendance History</button>
</div>

<div className={"flex flex-col gap-space-xl" + (view==='overview' ? '' : ' hidden')} id="view-overview">

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-space-md">
<div className="bg-surface-container-low p-space-lg rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group" onClick={event=>{toggleDrawer('Present Employees')}}>
<div className="flex items-center justify-between mb-space-sm">
<span className="text-label-md text-on-surface-variant">Present</span>
<span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-on-primary transition-all"><span className="material-symbols-outlined text-[18px]">check_circle</span></span>
</div>
<div className="text-display-sm text-on-surface">1,215</div>
<div className="text-body-sm text-primary mt-space-xs flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">trending_up</span>+2.4% vs yesterday</div>
</div>
<div className="bg-surface-container-low p-space-lg rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group" onClick={event=>{toggleDrawer('Absent Employees')}}>
<div className="flex items-center justify-between mb-space-sm">
<span className="text-label-md text-on-surface-variant">Absent</span>
<span className="w-8 h-8 rounded-full bg-error/10 text-error flex items-center justify-center group-hover:bg-error group-hover:text-on-error transition-all"><span className="material-symbols-outlined text-[18px]">cancel</span></span>
</div>
<div className="text-display-sm text-on-surface">32</div>
<div className="text-body-sm text-error mt-space-xs flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">trending_down</span>-0.8% anomaly</div>
</div>
<div className="bg-surface-container-low p-space-lg rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group" onClick={event=>{toggleDrawer('Late Arrivals')}}>
<div className="flex items-center justify-between mb-space-sm">
<span className="text-label-md text-on-surface-variant">Late</span>
<span className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all"><span className="material-symbols-outlined text-[18px]">schedule</span></span>
</div>
<div className="text-display-sm text-on-surface">45</div>
<div className="text-body-sm text-amber-600 mt-space-xs">Requires review</div>
</div>
<div className="bg-surface-container-low p-space-lg rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group" onClick={event=>{toggleDrawer('Remote Workers')}}>
<div className="flex items-center justify-between mb-space-sm">
<span className="text-label-md text-on-surface-variant">Remote</span>
<span className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center group-hover:bg-secondary group-hover:text-on-secondary transition-all"><span className="material-symbols-outlined text-[18px]">home_work</span></span>
</div>
<div className="text-display-sm text-on-surface">410</div>
<div className="text-body-sm text-on-surface-variant mt-space-xs">Geo-verified</div>
</div>
<div className="bg-surface-container-low p-space-lg rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group" onClick={event=>{toggleDrawer('On Leave')}}>
<div className="flex items-center justify-between mb-space-sm">
<span className="text-label-md text-on-surface-variant">On Leave</span>
<span className="w-8 h-8 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center group-hover:bg-tertiary group-hover:text-on-tertiary transition-all"><span className="material-symbols-outlined text-[18px]">event_available</span></span>
</div>
<div className="text-display-sm text-on-surface">18</div>
<div className="text-body-sm text-on-surface-variant mt-space-xs">Approved PTO</div>
</div>
</div>

<div className="grid grid-cols-1 lg:grid-cols-3 gap-space-xl">
<div className="lg:col-span-2 bg-surface-container-low p-space-xl rounded-xl shadow-sm">
<div className="flex items-center justify-between mb-space-lg">
<div>
<h3 className="font-headline-sm text-on-surface">Weekly Attendance Trend</h3>
<p className="text-body-sm text-on-surface-variant">Click any data point to inspect exact punch-ins and GPS logs.</p>
</div>
<div className="flex items-center gap-space-xs">
<button className="px-space-sm py-1 bg-primary text-on-primary rounded-lg text-label-md">On-Time</button>
<button className="px-space-sm py-1 bg-surface text-on-surface-variant rounded-lg text-label-md">Late</button>
<button className="px-space-sm py-1 bg-surface text-on-surface-variant rounded-lg text-label-md">Absent</button>
</div>
</div>

<div className="h-64 w-full flex items-end justify-between gap-4 pt-space-xl px-space-md bg-surface rounded-xl cursor-pointer relative group" onClick={event=>{toggleDrilldown()}}>
<div className="absolute inset-0 flex items-center justify-center bg-primary/0 group-hover:bg-primary/5 transition-all rounded-xl">
<span className="opacity-0 group-hover:opacity-100 bg-on-surface text-surface px-space-md py-space-xs rounded-lg text-label-md transition-all shadow-md">Click data point to drill-down</span>
</div>

<div className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
<div className="w-full bg-primary/80 hover:bg-primary rounded-t-lg transition-all h-[80%]"></div>
<span className="text-body-sm text-on-surface-variant">Mon</span>
</div>

<div className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
<div className="w-full bg-primary hover:bg-primary-container rounded-t-lg transition-all h-[92%]"></div>
<span className="text-body-sm text-on-surface-variant">Tue</span>
</div>

<div className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
<div className="w-full bg-primary/70 hover:bg-primary rounded-t-lg transition-all h-[75%]"></div>
<span className="text-body-sm text-on-surface-variant">Wed</span>
</div>

<div className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
<div className="w-full bg-amber-500 hover:bg-amber-600 rounded-t-lg transition-all h-[60%]"></div>
<span className="text-body-sm text-on-surface-variant">Thu</span>
</div>

<div className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
<div className="w-full bg-primary hover:bg-primary-container rounded-t-lg transition-all h-[88%]"></div>
<span className="text-body-sm text-on-surface-variant">Fri</span>
</div>
</div>
</div>

<div className="bg-surface-container-low p-space-xl rounded-xl shadow-sm flex flex-col justify-between">
<div>
<h3 className="font-headline-sm text-on-surface mb-space-sm">Compliance Meter</h3>
<p className="text-body-sm text-on-surface-variant mb-space-lg">Overall organization shift adherence rate for the current pay cycle.</p>
<div className="flex items-center justify-center py-space-lg">
<div className="relative w-40 h-40 rounded-full border-8 border-primary/20 flex items-center justify-center">
<div className="absolute inset-0 rounded-full border-8 border-primary border-t-transparent animate-spin" style={{"animationDuration":"8s"}}></div>
<div className="text-center">
<span className="text-display-sm text-on-surface">94.8%</span>
<span className="block text-body-sm text-primary font-medium">Optimal</span>
</div>
</div>
</div>
</div>
<div className="space-y-space-sm pt-space-md">
<div className="flex justify-between text-body-sm"><span className="text-on-surface-variant">Biometric Sync</span><span className="text-primary font-medium">100% Online</span></div>
<div className="flex justify-between text-body-sm"><span className="text-on-surface-variant">Pending Approvals</span><span className="text-on-surface font-medium">12 Requests</span></div>
</div>
</div>
</div>
</div>

<div className={"flex flex-col gap-space-xl" + (view==='history' ? '' : ' hidden')} id="view-history"><p className="text-body-sm text-outline">Sample date: 24 Oct 2023. Use the date-range control to filter history.</p>{showDateFilters&&<div className="p-4 bg-surface-container-low rounded-xl flex flex-wrap gap-3"><label>From<input type="date" aria-label="History from date" value={fromDate} onChange={event=>setFromDate(event.target.value)} className="ml-2 p-2 rounded"/></label><label>To<input type="date" aria-label="History to date" value={toDate} onChange={event=>setToDate(event.target.value)} className="ml-2 p-2 rounded"/></label><button onClick={()=>{setFromDate("");setToDate("");}}>Clear dates</button></div>}{manualRequests.length>0&&<section className="p-4 rounded-xl bg-surface-container-low"><h3 className="font-semibold">Local Manual Attendance Requests</h3>{manualRequests.map((request,index)=><p key={index} className="mt-2 text-body-sm">{request.employee} · {request.date} · {request.punchIn}–{request.punchOut} · Pending local review</p>)}</section>}

<div className="bg-surface-container-low p-space-lg rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-space-md">
<div className="flex flex-wrap items-center gap-space-md flex-1">
<div className="relative flex-1 min-w-[240px]">
<span className="absolute inset-y-0 left-0 flex items-center pl-space-md pointer-events-none text-on-surface-variant"><span className="material-symbols-outlined text-[18px]">search</span></span>
<input className="w-full h-10 pl-10 pr-space-md bg-surface border border-outline-variant rounded-lg text-body-md text-on-surface focus:outline-none focus:border-primary" type="text" value={search} onChange={event=>setSearch(event.target.value)} aria-label="Search attendance history"/>
</div>
<div className="flex items-center gap-space-sm">
<select className="h-10 px-space-md bg-surface border border-outline-variant rounded-lg text-body-md text-on-surface focus:outline-none focus:border-primary" aria-label="History department" value={department} onChange={event=>setDepartment(event.target.value)}>
<option>All Departments</option>
<option >Engineering</option>
<option>Product Design</option>
<option>People Ops</option><option>Marketing</option>
</select>
<select className="h-10 px-space-md bg-surface border border-outline-variant rounded-lg text-body-md text-on-surface focus:outline-none focus:border-primary" aria-label="History status" value={status} onChange={event=>setStatus(event.target.value)}>
<option>All Statuses</option>
<option>Present</option>
<option>Late</option>
<option>Absent</option>
</select>
</div>
</div>
<div className="flex items-center gap-space-sm">
<button className="h-10 px-space-md bg-surface border border-outline-variant rounded-lg text-body-md text-on-surface hover:bg-surface-container flex items-center gap-space-xs">
<span className="material-symbols-outlined text-[18px]">date_range</span>Oct 01 - Oct 24, 2023
        </button>
</div>
</div>

<div className="bg-surface-container-low rounded-xl shadow-sm overflow-hidden">
<table className="w-full text-left border-collapse">
<thead>
<tr className="bg-surface-container border-b border-surface-container-high text-label-caps text-on-surface-variant">
<th className="p-space-md">Employee</th>
<th className="p-space-md">Date</th>
<th className="p-space-md">Punch In</th>
<th className="p-space-md">Punch Out</th>
<th className="p-space-md">Total Hours</th>
<th className="p-space-md">Status</th>
<th className="p-space-md text-right">Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-surface-container-high text-body-md text-on-surface">{historyRows.map(row=><AttendanceRow key={row.id} row={row} onOpen={openRecord}/>)}{historyRows.length===0&&<tr><td colSpan={7} className="p-8 text-center text-outline">No attendance records match this date range.</td></tr>}</tbody>
</table>

<div className="p-space-md flex items-center justify-between border-t border-surface-container-high bg-surface-container-low">
<span className="text-body-sm text-on-surface-variant">Showing {historyRows.length} sample attendance records</span>
<span className="text-body-sm text-outline">All matching sample records displayed</span>
</div>
</div>
</div>

<div className={"flex flex-col items-center justify-center py-16 bg-surface-container-low rounded-xl shadow-sm text-center" + (view==='empty' ? '' : ' hidden')} id="view-empty">
<div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-space-md text-on-surface-variant shadow-sm">
<span className="material-symbols-outlined text-[32px]">event_busy</span>
</div>
<h3 className="font-headline-sm text-on-surface mb-space-xs">No Attendance Records Found</h3>
<p className="text-body-md text-on-surface-variant max-w-md mb-space-lg">We couldn't find any attendance logs matching your current filter criteria. Try adjusting your search or date range.</p>
<button className="px-space-lg py-2 bg-primary text-on-primary font-label-lg rounded-lg hover:bg-primary-container transition-all" onClick={event=>{switchState('overview')}}>Reset Filters</button>
</div>

<div className={"flex flex-col gap-space-xl animate-pulse" + (view==='loading' ? '' : ' hidden')} id="view-loading">
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-space-md">
<div className="h-28 bg-surface-container-high rounded-xl"></div>
<div className="h-28 bg-surface-container-high rounded-xl"></div>
<div className="h-28 bg-surface-container-high rounded-xl"></div>
<div className="h-28 bg-surface-container-high rounded-xl"></div>
<div className="h-28 bg-surface-container-high rounded-xl"></div>
</div>
<div className="h-80 bg-surface-container-high rounded-xl"></div>
</div>

<div className={"fixed inset-y-0 right-0 w-full max-w-md bg-surface shadow-2xl z-50 transform transition-transform duration-300 flex flex-col" + (drawer ? '' : ' hidden')} id="drawer"><AttendanceRoster title={drawerTitle} records={drawerRows} search={drawerSearch} onSearch={setDrawerSearch} onClose={()=>setDrawer(false)} onOpen={openRecord} onReminder={()=>triggerToast("Reminder preview only. No message was sent.")} /></div>

<div className={"fixed inset-y-0 right-0 w-full max-w-lg bg-surface shadow-2xl z-50 transform transition-transform duration-300 flex flex-col" + (drilldown ? '' : ' hidden')} id="drilldown-drawer">
<div className="p-space-lg bg-on-surface text-surface flex items-center justify-between">
<div>
<h3 className="font-headline-sm text-white">Attendance Dossier</h3>
<p className="text-body-sm text-slate-300">{active.name} · {active.department}</p>
</div>
<button className="p-1 hover:bg-white/10 rounded-full transition-all" onClick={event=>{toggleDrilldown()}}><span className="material-symbols-outlined text-[24px]">close</span></button>
</div>
<div className="flex-1 overflow-y-auto p-space-xl space-y-space-xl">

<div className="bg-surface-container-low p-space-lg rounded-xl shadow-sm">
<h4 className="font-label-caps text-on-surface-variant mb-space-md">Punch Timestamps</h4>
<div className="grid grid-cols-2 gap-space-md">
<div className="bg-surface p-space-md rounded-lg">
<span className="text-body-sm text-on-surface-variant">Punch In</span>
<div className="text-headline-sm text-primary">{active.punchIn}</div>
<span className="text-body-sm text-on-surface-variant">Biometric Terminal #4</span>
</div>
<div className="bg-surface p-space-md rounded-lg">
<span className="text-body-sm text-on-surface-variant">Punch Out</span>
<div className="text-headline-sm text-on-surface">{active.punchOut}</div>
<span className="text-body-sm text-on-surface-variant">Mobile App (Geo-verified)</span>
</div>
</div>
</div>

<div className="bg-surface-container-low p-space-lg rounded-xl shadow-sm">
<h4 className="font-label-caps text-on-surface-variant mb-space-md">Illustrative Location Preview (not live GPS)</h4>
<div className="w-full h-40 bg-cover bg-center rounded-lg relative overflow-hidden" data-alt="Satellite map view of downtown San Francisco headquarters with a glowing green pin marking the office perimeter and employee check-in coordinate." data-location="San Francisco HQ, 500 Howard St" style={{"backgroundImage":"url('https://lh3.googleusercontent.com/aida-public/AB6AXuBrRb69Q-OY903sH4DPgEboeHplnbVQVgbxOc4YPKiTBybCRM9ylV-izDzOHoElHWAH3dnGs9d8RDeywI6McbuinAUHAKTEyuPmX0Scoq2X9FC9CUl6_ctE7BkH_od8D34nRo69GFo_qB-ijEiPfyxVxzXgBjVGzlOJDPnWCgF1-ESY_NVr1Vl1aWzCqByn_F7YI3sEtcM9gK--H9cy5wJQBEwXM8i6ncpBtF2JdM1_SwtbFTVeDDjz')"}}>
<div className="absolute bottom-2 left-2 bg-surface/90 backdrop-blur-md px-space-md py-1 rounded text-body-sm font-medium">Lat: 37.7891, Lng: -122.3995 (Within 12m)</div>
</div>
</div>

<div className="bg-surface-container-low p-space-lg rounded-xl shadow-sm">
<h4 className="font-label-caps text-on-surface-variant mb-space-md">Productive Breakdown</h4>
<div className="space-y-space-sm">
<div className="flex justify-between text-body-md"><span className="text-on-surface-variant">Active Working</span><span className="font-medium">7h 15m</span></div>
<div className="flex justify-between text-body-md"><span className="text-on-surface-variant">Break Time</span><span className="font-medium">59m</span></div>
<div className="flex justify-between text-body-md"><span className="text-on-surface-variant">Idle Time</span><span className="font-medium">20m</span></div>
</div>
</div>
</div>
</div>

<div className={"fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-space-md" + (modal ? '' : ' hidden')} id="manual-modal">
<div className="bg-surface w-full max-w-md rounded-xl shadow-2xl p-space-xl relative">
<div className="flex items-center justify-between mb-space-lg">
<h3 className="font-headline-sm text-on-surface">Mark Manual Attendance</h3>
<button className="p-1 hover:bg-surface-container rounded-full" onClick={event=>{openModal()}}><span className="material-symbols-outlined text-[20px]">close</span></button>
</div>
<div className="space-y-space-md"><label className="block text-body-sm">Date<input aria-label="Manual date" type="date" className="block p-2 bg-surface-container-low rounded" value={manual.date} onChange={event=>setManual(previous=>({...previous,date:event.target.value}))}/></label>
<div>
<label className="block text-label-md text-on-surface-variant mb-space-xs">Select Employee</label>
<select className="w-full h-10 px-space-md bg-surface-container-low border border-outline-variant rounded-lg text-body-md text-on-surface" aria-label="Manual employee" value={manual.employee} onChange={event=>setManual(previous=>({...previous,employee:event.target.value}))}>
<option>Sarah Jenkins (ENG-042)</option>
<option>Marcus Ross (DES-109)</option>
<option>Amanda Lee (MKT-012)</option>
</select>
</div>
<div className="grid grid-cols-2 gap-space-md">
<div>
<label className="block text-label-md text-on-surface-variant mb-space-xs">Punch In Time</label>
<input className="w-full h-10 px-space-md bg-surface-container-low border border-outline-variant rounded-lg text-body-md text-on-surface" type="time"  aria-label="Manual punchIn" value={manual.punchIn} onChange={event=>setManual(previous=>({...previous,punchIn:event.target.value}))} />
</div>
<div>
<label className="block text-label-md text-on-surface-variant mb-space-xs">Punch Out Time</label>
<input className="w-full h-10 px-space-md bg-surface-container-low border border-outline-variant rounded-lg text-body-md text-on-surface" type="time"  aria-label="Manual punchOut" value={manual.punchOut} onChange={event=>setManual(previous=>({...previous,punchOut:event.target.value}))} />
</div>
</div>
<div>
<label className="block text-label-md text-on-surface-variant mb-space-xs">Reason for Regularization</label>
<textarea className="w-full h-24 p-space-md bg-surface-container-low border border-outline-variant rounded-lg text-body-md text-on-surface" placeholder="Forgot badge swipe..." aria-label="Manual reason" value={manual.reason} onChange={event=>setManual(previous=>({...previous,reason:event.target.value}))} />
</div>
<div className="flex justify-end gap-space-sm pt-space-md">
<button className="h-10 px-space-lg bg-surface border border-outline-variant rounded-lg text-body-md text-on-surface" onClick={event=>{openModal()}}>Cancel</button>
<button className="h-10 px-space-lg bg-primary text-on-primary font-label-lg rounded-lg hover:bg-primary-container" onClick={event=>{submitManual()}}>Submit Request</button>
</div>
</div>
</div>
</div>

<div className={"fixed bottom-6 right-6 bg-on-surface text-surface px-space-lg py-space-md rounded-xl shadow-2xl z-50 transform  transition-all duration-300 flex items-center gap-space-md" + (toast ? '' : ' translate-y-20 opacity-0 pointer-events-none')} id="toast" role="status">
<span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
<span className="text-body-md font-medium" id="toast-msg">{toast}</span>
</div>

</div></main></div></>);
}
