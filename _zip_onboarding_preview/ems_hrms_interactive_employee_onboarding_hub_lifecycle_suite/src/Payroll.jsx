import { useEffect, useRef, useState } from 'react';
import { Sidebar, Header } from './Layout.jsx';
import { initialPayroll } from './payrollData.js';
import PayrollRow from './PayrollRow.jsx';
const money=value=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(value);
export default function Payroll() {
 const [rows,setRows]=useState(initialPayroll);
 const [month,setMonth]=useState('October 2023');
 const [department,setDepartment]=useState('All Departments');
 const [search,setSearch]=useState('');
 const [view,setView]=useState('table');
 const [cycle,setCycle]=useState('Draft');
 const [ceoEnabled,setCeoEnabled]=useState(false);
 const [selected,setSelected]=useState([]);
 const [drawer,setDrawer]=useState(false);
 const [activeId,setActiveId]=useState('EMP-1042');
 const [toast,setToast]=useState({title:'',desc:''});
 const timer=useRef();
 const active=rows.find(row=>row.id===activeId)||rows[0];
 const filtered=rows.filter(row=>row.month===month&&(department==='All Departments'||row.department===(department==='Engineering (BLR)'?'Engineering':department))&&[row.name,row.id,row.department,row.status].some(value=>value.toLowerCase().includes(search.toLowerCase())));
 const showToast=(title,desc='')=>{clearTimeout(timer.current);setToast({title,desc});timer.current=setTimeout(()=>setToast({title:'',desc:''}),3500);};
 const openPayslipDrawer=(name,id)=>{setActiveId(id||name);setDrawer(true);};
 const closePayslipDrawer=()=>setDrawer(false);
 const setSimState=state=>{setView('table');setDrawer(false);if(state==='default'){setMonth('October 2023');setDepartment('All Departments');setSearch('');setCeoEnabled(false);setCycle('Draft');}else if(state==='drawer')openPayslipDrawer('EMP-1042');else if(state==='ceo_restricted')setCeoEnabled(false);else if(state==='ceo_enabled')setCeoEnabled(true);else if(state==='empty'||state==='error')setView(state);else if(state==='preview')setCycle('Preview');else if(state==='finalized')setCycle('Finalized');};
 const triggerPreview=()=>{if(!filtered.length){showToast('No records','Choose a period with sample payroll records.');return;}setCycle('Preview');showToast('Preview ready','Showing supplied gross-to-net sample figures.');};
 const triggerFinal=()=>{if(cycle!=='Preview'){showToast('Preview required','Generate a preview before finalizing the local cycle.');return;}setCycle('Finalized');showToast('Cycle finalized locally','No bank instruction files or statutory filings were generated.');};
 const handleDisburse=()=>{if(!ceoEnabled||cycle!=='Finalized'){showToast('Unavailable','Enable the CEO simulator and finalize a preview first.');return;}showToast('Disbursement preview','No funds were transferred and no bank request was sent.');};
 const retryConnection=()=>{setView('table');showToast('Sample view restored','No external connection was made.');};
 const processRow=id=>{if(cycle==='Finalized'){showToast('Cycle locked','Return to the default simulator before editing sample records.');return;}setRows(previous=>previous.map(row=>row.id===id?{...row,status:'Processed'}:row));showToast('Processed locally',id+' marked ready in this session.');};
 const voidRow=id=>{if(cycle==='Finalized'){showToast('Cycle locked','Return to the default simulator before editing sample records.');return;}setRows(previous=>previous.map(row=>row.id===id?{...row,status:'Voided'}:row));setSelected(previous=>previous.filter(value=>value!==id));showToast('Voided locally',id+' excluded from this sample batch.');};
 const exportRowPDF=id=>showToast('PDF export preview','No payslip file was generated for '+id+'.');
 const downloadPayslipPDF=()=>exportRowPDF(active.id);
 const openKPIDrawer=(title,val,desc)=>showToast(title+': '+val,'Sample metric: '+desc);
 const toggleSelected=id=>setSelected(previous=>previous.includes(id)?previous.filter(value=>value!==id):[...previous,id]);
 const toggleSelectAll=checked=>setSelected(checked?filtered.map(row=>row.id):[]);
 const openAddPayrollModal=()=>showToast('Add payroll preview','The compensation adjustment wizard is not connected.');
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 useEffect(()=>{
  if(!drawer)return;
  const dialog=document.getElementById('payslipDrawer'),previous=document.activeElement;
  dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Sample payslip');
  const controls=()=>[...dialog.querySelectorAll('button')];controls()[0]?.focus();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const keydown=event=>{if(event.key==='Escape')setDrawer(false);if(event.key==='Tab'){const items=controls(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};
  document.addEventListener('keydown',keydown);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keydown);previous?.focus();};
 },[drawer]);
 return (<><Sidebar activePage="payroll" /><div className="pl-64"><Header /><main className="relative pt-16 bg-surface min-h-[calc(100vh-4rem)] p-space-xl"><div className="flex flex-col w-full pb-16">

<div className="bg-surface-container-high rounded-xl p-space-sm mb-space-lg flex flex-wrap items-center gap-space-xs shadow-sm">
<span className="text-label-caps text-on-surface-variant mr-space-xs">SIMULATOR RIG:</span>
<button className="px-space-sm py-1 rounded text-body-sm font-medium bg-surface text-on-surface hover:bg-primary hover:text-on-primary transition-all sim-btn-default" onClick={event=>{setSimState('default')}}>1. Default</button>
<button className="px-space-sm py-1 rounded text-body-sm font-medium bg-surface text-on-surface hover:bg-primary hover:text-on-primary transition-all sim-btn-preview" onClick={event=>{setSimState('preview')}}>2. Preview</button>
<button className="px-space-sm py-1 rounded text-body-sm font-medium bg-surface text-on-surface hover:bg-primary hover:text-on-primary transition-all sim-btn-finalized" onClick={event=>{setSimState('finalized')}}>3. Finalized</button>
<button className="px-space-sm py-1 rounded text-body-sm font-medium bg-surface text-on-surface hover:bg-primary hover:text-on-primary transition-all sim-btn-drawer" onClick={event=>{setSimState('drawer')}}>4. Payslip Drawer</button>
<button className="px-space-sm py-1 rounded text-body-sm font-medium bg-surface text-on-surface hover:bg-primary hover:text-on-primary transition-all sim-btn-ceo_restricted" onClick={event=>{setSimState('ceo_restricted')}}>5. CEO Restricted</button>
<button className="px-space-sm py-1 rounded text-body-sm font-medium bg-surface text-on-surface hover:bg-primary hover:text-on-primary transition-all sim-btn-ceo_enabled" onClick={event=>{setSimState('ceo_enabled')}}>6. CEO Enabled</button>
<button className="px-space-sm py-1 rounded text-body-sm font-medium bg-surface text-on-surface hover:bg-primary hover:text-on-primary transition-all sim-btn-empty" onClick={event=>{setSimState('empty')}}>7. Empty</button>
<button className="px-space-sm py-1 rounded text-body-sm font-medium bg-surface text-on-surface hover:bg-primary hover:text-on-primary transition-all sim-btn-error" onClick={event=>{setSimState('error')}}>8. Error Retry</button>
</div>

<div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg">
<div>
<div className="text-label-caps text-primary tracking-wider mb-1">FINANCE &amp; PAYROLL / DISBURSEMENT SUITE</div>
<h1 className="font-headline-lg text-on-surface">Payroll Processing &amp; Statutory Compliance Suite</h1><p className="text-body-sm text-secondary">Sample payroll data · Cycle: {cycle}</p>
<p className="text-body-md text-on-surface-variant mt-1">Manage Bengaluru HQ &amp; remote payroll cycles, EPF/ESI remittances, and automated TDS filings.</p>
</div>
<div className="flex items-center gap-space-sm flex-wrap">
<button className="h-10 px-space-md bg-surface-container-high text-on-surface font-label-lg rounded-lg hover:bg-surface-container-highest transition-all flex items-center gap-space-xs shadow-sm" onClick={event=>{openAddPayrollModal()}}>
<span className="material-symbols-outlined text-[18px]">add</span>Add / Update Payroll
      </button>
<button className="h-10 px-space-md bg-secondary text-on-secondary font-label-lg rounded-lg hover:opacity-90 transition-all flex items-center gap-space-xs shadow-sm" onClick={event=>{triggerPreview()}}>
<span className="material-symbols-outlined text-[18px]">visibility</span>Generate Preview
      </button>
<button className="h-10 px-space-md bg-primary text-on-primary font-label-lg rounded-lg hover:opacity-90 transition-all flex items-center gap-space-xs shadow-sm" onClick={event=>{triggerFinal()}}>
<span className="material-symbols-outlined text-[18px]">verified</span>Generate Final
      </button>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-md mb-space-lg shadow-md flex flex-wrap items-center justify-between gap-space-md">
<div className="flex items-center gap-space-md flex-wrap flex-1">
<div className="flex items-center gap-space-xs">
<label className="text-label-md text-on-surface-variant">Cycle:</label>
<select className="h-10 px-space-md bg-surface-container-low rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/15" aria-label="Payroll month" value={month} onChange={event=>{setMonth(event.target.value);setView('table');setSelected([]);}}>
<option>October 2023</option>
<option>November 2023</option>
<option disabled>December 2023 (Future)</option>
</select>
</div>
<div className="flex items-center gap-space-xs flex-1 min-w-[200px] max-w-sm">
<div className="relative w-full">
<span className="absolute inset-y-0 left-0 flex items-center pl-space-sm pointer-events-none text-on-surface-variant">
<span className="material-symbols-outlined text-[18px]">search</span>
</span>
<input className="w-full h-10 pl-9 pr-space-md bg-surface-container-low rounded-lg text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/15" value={search} onChange={event=>setSearch(event.target.value)} aria-label="Search payroll" id="tableSearch"  placeholder="Search employee name, PF ID..." type="text"/>
</div>
</div>
<div className="flex items-center gap-space-xs">
<select className="h-10 px-space-md bg-surface-container-low rounded-lg text-body-md text-on-surface focus:outline-none" aria-label="Payroll department" value={department} onChange={event=>{setDepartment(event.target.value);setView('table');setSelected([]);}}>
<option>All Departments</option>
<option>Engineering (BLR)</option>
<option>Product &amp; Design</option>
<option>Finance &amp; Legal</option>
</select>
</div>
</div>
<div className="flex items-center gap-space-sm">
<div className="relative group" id="disburseContainer">
<button className="h-10 px-space-md bg-primary text-on-primary font-label-lg rounded-lg hover:opacity-90 transition-all flex items-center gap-space-xs shadow-sm" disabled={!ceoEnabled||cycle!=="Finalized"} id="disburseBtn" onClick={event=>{handleDisburse()}}>
<span className="material-symbols-outlined text-[18px]">account_balance</span>Disburse Funds
        </button>
<div className={"absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-inverse-surface text-inverse-on-surface text-body-sm rounded shadow-lg whitespace-nowrap group-hover:block" + (!ceoEnabled ? '' : ' hidden')} id="disburseTooltip">
          CEO only permission required
        </div>
</div>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-lg">
<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-md cursor-pointer hover:shadow-xl transition-all relative overflow-hidden group" onClick={event=>{openKPIDrawer('Total Payroll', '₹4,20,00,000', '1,420 Active Employees')}}>
<div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-6 -mt-6 group-hover:scale-125 transition-transform"></div>
<div className="text-label-caps text-on-surface-variant mb-1">TOTAL PAYROLL</div>
<div className="text-display-sm text-on-surface font-bold">₹4.2 Cr</div>
<div className="flex items-center gap-space-xs mt-2 text-body-sm text-primary font-medium">
<span className="material-symbols-outlined text-[16px]">trending_up</span>+4.2% from last month
      </div>
</div>
<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-md cursor-pointer hover:shadow-xl transition-all relative overflow-hidden group" onClick={event=>{openKPIDrawer('EPF / ESI Deductions', '₹45,20,000', 'Statutory remittances ready')}}>
<div className="absolute top-0 right-0 w-24 h-24 bg-secondary/10 rounded-full -mr-6 -mt-6 group-hover:scale-125 transition-transform"></div>
<div className="text-label-caps text-on-surface-variant mb-1">EPF / ESI DEDUCTIONS</div>
<div className="text-display-sm text-on-surface font-bold">₹45.2L</div>
<div className="flex items-center gap-space-xs mt-2 text-body-sm text-on-surface-variant">
<span className="material-symbols-outlined text-[16px]">check_circle</span>PF UAN Verified
      </div>
</div>
<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-md cursor-pointer hover:shadow-xl transition-all relative overflow-hidden group" onClick={event=>{openKPIDrawer('Net Disbursement', '₹3,74,80,000', 'Direct HDFC/ICICI Batch Transfer')}}>
<div className="absolute top-0 right-0 w-24 h-24 bg-primary-container/10 rounded-full -mr-6 -mt-6 group-hover:scale-125 transition-transform"></div>
<div className="text-label-caps text-on-surface-variant mb-1">NET DISBURSEMENT</div>
<div className="text-display-sm text-on-surface font-bold">₹3.75 Cr</div>
<div className="flex items-center gap-space-xs mt-2 text-body-sm text-primary font-medium">
<span className="material-symbols-outlined text-[16px]">schedule</span>Scheduled for 31 Oct
      </div>
</div>
<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-md cursor-pointer hover:shadow-xl transition-all relative overflow-hidden group" onClick={event=>{openKPIDrawer('Compliance Status', '100%', 'All filings compliant with EPFO & Income Tax')}}>
<div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full -mr-6 -mt-6 group-hover:scale-125 transition-transform"></div>
<div className="text-label-caps text-on-surface-variant mb-1">COMPLIANCE STATUS</div>
<div className="text-display-sm text-primary font-bold">100%</div>
<div className="flex items-center gap-space-xs mt-2 text-body-sm text-primary font-medium">
<span className="material-symbols-outlined text-[16px]">verified</span>Zero discrepancies
      </div>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-md overflow-hidden mb-space-lg" id="mainContentContainer">

<div className={"p-space-xl text-center flex flex-col items-center justify-center min-h-[400px]" + (view==='error' ? '' : ' hidden')} id="errorState">
<div className="w-16 h-16 rounded-full bg-error-container text-error flex items-center justify-center mb-space-md">
<span className="material-symbols-outlined text-[32px]">error</span>
</div>
<h3 className="font-headline-sm text-on-surface mb-2">Gateway Timeout / Database Sync Failure</h3>
<p className="text-body-md text-on-surface-variant max-w-md mb-space-lg">Unable to fetch live bank telemetry from ICICI Corporate Connect API. Please check network routing or retry connection.</p>
<button className="h-10 px-space-lg bg-primary text-on-primary font-label-lg rounded-lg hover:opacity-90 transition-all flex items-center gap-space-xs shadow-sm" onClick={event=>{retryConnection()}}>
<span className="material-symbols-outlined text-[18px]">refresh</span>Retry Connection
      </button>
</div>

<div className={"p-space-xl text-center flex flex-col items-center justify-center min-h-[400px]" + (view==='empty'||filtered.length===0&&view!=='error' ? '' : ' hidden')} id="emptyState">
<div className="w-16 h-16 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center mb-space-md">
<span className="material-symbols-outlined text-[32px]">folder_off</span>
</div>
<h3 className="font-headline-sm text-on-surface mb-2">No Payroll Batches Found</h3>
<p className="text-body-md text-on-surface-variant max-w-md mb-space-lg">There are no payroll cycles initiated for this period. Click below to initialize a new cycle.</p>
<button className="h-10 px-space-lg bg-primary text-on-primary font-label-lg rounded-lg hover:opacity-90 transition-all flex items-center gap-space-xs shadow-sm" onClick={event=>{openAddPayrollModal()}}>
<span className="material-symbols-outlined text-[18px]">add</span>Initialize New Cycle
      </button>
</div>

<div className={"overflow-x-auto" + (view==='table'&&filtered.length>0 ? '' : ' hidden')} id="tableView">
<table className="w-full text-left border-collapse">
<thead>
<tr className="bg-surface-container-low text-label-caps text-on-surface-variant">
<th className="p-space-md w-12"><input className="w-4 h-4 rounded text-primary focus:ring-primary" checked={filtered.length>0&&filtered.every(row=>selected.includes(row.id))} aria-label="Select all payroll rows" onChange={event=>toggleSelectAll(event.target.checked)} type="checkbox"/></th>
<th className="p-space-md">Employee &amp; ID</th>
<th className="p-space-md">Department</th>
<th className="p-space-md">Gross Salary</th>
<th className="p-space-md">Deductions (PF/TDS)</th>
<th className="p-space-md">Net Payable</th>
<th className="p-space-md">Status</th>
<th className="p-space-md text-right">Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-surface-container" id="payrollTableBody">{filtered.map(row=><PayrollRow key={row.id} row={row} selected={selected.includes(row.id)} toggleSelected={toggleSelected} onOpen={openPayslipDrawer} processRow={processRow} voidRow={voidRow} exportRowPDF={exportRowPDF}/>)}</tbody>
</table>

<div className="p-space-md bg-surface-container-lowest flex items-center justify-between border-t border-surface-container">
<div className="text-body-sm text-on-surface-variant">Showing {filtered.length} of {rows.filter(row=>row.month===month).length} sample employees</div>
<span className="text-body-sm text-outline">All matching sample records displayed</span>
</div>
</div>
</div>



<div className={"fixed inset-y-0 right-0 w-full max-w-md bg-surface-container-lowest shadow-2xl z-50 transform transition-transform duration-300 flex flex-col" + (drawer ? '' : ' hidden')} id="payslipDrawer">
<div className="p-space-lg bg-surface-container-low flex items-center justify-between">
<div>
<div className="text-label-caps text-primary">SAMPLE PAYSLIP</div>
<h3 className="font-headline-sm text-on-surface" id="drawerEmpName">{active.name+' ('+active.id+')'}</h3>
</div>
<button className="p-2 hover:bg-surface-container rounded-full text-on-surface-variant" onClick={event=>{closePayslipDrawer()}}><span className="material-symbols-outlined">close</span></button>
</div>
<div className="flex-1 p-space-lg overflow-y-auto space-y-4"><p className="text-body-sm text-outline">Sample payslip preview for {month}. No bank transfer or statutory filing is performed.</p><div className="bg-surface-container-low p-4 rounded-xl"><p className="text-label-md">NET PAYABLE</p><p id="drawerNetPay" className="text-display-sm text-primary font-bold">{money(active.net)}</p></div><dl className="space-y-3"><div className="flex justify-between"><dt>Gross Salary</dt><dd>{money(active.gross)}</dd></div><div className="flex justify-between"><dt>Deductions (PF/TDS)</dt><dd>{money(active.deductions)}</dd></div><div className="flex justify-between"><dt>Status</dt><dd>{active.status}</dd></div></dl></div><div className="p-space-lg bg-surface-container-low flex items-center justify-between">
<button className="w-full h-10 bg-primary text-on-primary font-label-lg rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-space-xs shadow-sm" onClick={event=>{downloadPayslipPDF()}}>
<span className="material-symbols-outlined text-[18px]">download</span>Preview PDF Export
      </button>
</div>
</div>

<div className={"fixed bottom-6 right-6 bg-inverse-surface text-inverse-on-surface px-space-lg py-space-md rounded-xl shadow-2xl z-50 transform  transition-all duration-300 flex items-center gap-space-md" + (toast.title ? '' : ' translate-y-20 opacity-0 pointer-events-none')} id="toastNotification" role="status">
<span className="material-symbols-outlined text-primary" id="toastIcon">check_circle</span>
<div>
<div className="font-title-md" id="toastTitle">{toast.title}</div>
<div className="text-body-sm text-slate-300" id="toastDesc">{toast.desc}</div>
</div>
</div>

</div></main></div></>);
}
