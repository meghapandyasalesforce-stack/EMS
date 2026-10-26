import { useEffect, useRef, useState } from 'react';
import { Sidebar, Header } from './Layout.jsx';
import { initialWorkforcePlans } from './workforceData.js';
import { initialWorkforceFields } from './workforceFields.js';
import { WorkforcePlans, WorkforceForecasts } from './WorkforceViews.jsx';
const defaultUi={simState:'dashboard',activeTab:'plans',newPlanModal:false,newForecastModal:false,drillDrawer:false,drillTitle:'',confirmModal:false,confirmAction:'',confirmTitle:'',confirmText:'',rejectModal:false,rejectReason:'',recruitmentModal:false,searchQuery:'',deptFilter:'All',successToast:false,toastMsg:'',innerTab:'budget'};
export default function WorkforcePlanning() {
 const [ui,setUi]=useState(defaultUi);
 const [plans,setPlans]=useState(initialWorkforcePlans);
 const [selectedId,setSelectedId]=useState('PLN-2025-01');
 const [fields,setFields]=useState(initialWorkforceFields);
 const [forecasts,setForecasts]=useState([]);
 const [requisitions,setRequisitions]=useState([]);
 const timer=useRef();
 const {simState,activeTab,newPlanModal,newForecastModal,drillDrawer,drillTitle,confirmModal,confirmAction,confirmTitle,confirmText,rejectModal,rejectReason,recruitmentModal,searchQuery,deptFilter,successToast,toastMsg,innerTab}=ui;
 const selectedPlan=plans.find(plan=>plan.id===selectedId)||plans[0]||initialWorkforcePlans[0];
 const filteredPlans=plans.filter(plan=>(deptFilter==='All'||plan.dept===deptFilter)&&[plan.name,plan.owner,plan.id,plan.dept].some(value=>value.toLowerCase().includes(searchQuery.toLowerCase())));
 const setField=(key,value)=>setFields(previous=>({...previous,[key]:value}));
 const notify=message=>{clearTimeout(timer.current);setUi(previous=>({...previous,toastMsg:message,successToast:true}));timer.current=setTimeout(()=>setUi(previous=>({...previous,successToast:false})),3500);};
 const selectPlan=id=>setSelectedId(id);
 const triggerAction=(action,id)=>{if(id)setSelectedId(id);if(action==='Reject'){setUi(previous=>({...previous,rejectModal:true}));return;}if(action==='Recruitment'){const plan=plans.find(plan=>plan.id===(id||selectedId))||selectedPlan;setFields(previous=>({...previous,jobDept:plan.dept}));setUi(previous=>({...previous,recruitmentModal:true}));return;}setUi(previous=>({...previous,confirmAction:action,confirmTitle:action+' Workforce Plan?',confirmText:'This updates only the selected local sample plan. No budget allocation or external workflow is performed.',confirmModal:true}));};
 const executeConfirm=()=>{const expected={Submit:'Draft',Approve:'Submitted',Complete:'Approved'};if(confirmAction!=='Delete'&&selectedPlan.status!==expected[confirmAction]){notify('Action unavailable for a '+selectedPlan.status+' plan.');setUi(previous=>({...previous,confirmModal:false}));return;}if(confirmAction==='Delete')setPlans(previous=>previous.filter(plan=>plan.id!==selectedPlan.id));else setPlans(previous=>previous.map(plan=>plan.id===selectedPlan.id?{...plan,status:({Submit:'Submitted',Approve:'Approved',Complete:'Completed'})[confirmAction]}:plan));setUi(previous=>({...previous,confirmModal:false}));notify(confirmAction+' saved locally.');};
 const executeReject=()=>{if(!rejectReason.trim()){notify('Enter a rejection reason.');return;}if(selectedPlan.status!=='Submitted'){notify('Only submitted plans can be rejected.');return;}setPlans(previous=>previous.map(plan=>plan.id===selectedPlan.id?{...plan,status:'Draft',rejectionReason:rejectReason.trim()}:plan));setUi(previous=>({...previous,rejectModal:false,rejectReason:''}));notify('Plan returned to Draft with local feedback. No email was sent.');};
 const createPlan=()=>{const target=Number(fields.planTarget);if(!fields.planName.trim()||!Number.isInteger(target)||target<1||!fields.planBudget.trim()||!/[1-9]/.test(fields.planBudget)){notify('Enter a plan name, positive headcount, and budget.');return;}const id='PLN-LOCAL-'+Date.now();setPlans(previous=>[...previous,{id,name:fields.planName.trim(),dept:fields.planDept,owner:'Priya Sharma',current:0,target,budget:fields.planBudget,status:'Draft'}]);setSelectedId(id);setUi(previous=>({...previous,newPlanModal:false,activeTab:'plans',simState:'plans',searchQuery:'',deptFilter:'All'}));notify('Workforce plan created locally.');};
 const createForecast=()=>{const demand=Number(fields.forecastDemand);if(!fields.forecastName.trim()||!Number.isInteger(demand)||demand<0){notify('Enter a forecast name and non-negative demand.');return;}setForecasts(previous=>[...previous,{name:fields.forecastName.trim(),demand}]);setUi(previous=>({...previous,newForecastModal:false,activeTab:'forecasts',simState:'plans'}));notify('Demand forecast saved locally.');};
 const createRecruitment=()=>{if(selectedPlan.status!=='Approved'){notify('Approve the selected plan before creating a requisition.');return;}if(!fields.jobTitle.trim()){notify('Enter a job title.');return;}setRequisitions(previous=>[...previous,{...fields,planId:selectedPlan.id}]);setUi(previous=>({...previous,recruitmentModal:false}));notify('Requisition preview saved locally. Nothing was published externally.');};
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 useEffect(()=>{const flag=newPlanModal?'newPlanModal':newForecastModal?'newForecastModal':confirmModal?'confirmModal':rejectModal?'rejectModal':recruitmentModal?'recruitmentModal':drillDrawer?'drillDrawer':null;if(!flag)return;const dialog=document.querySelector('[data-workforce-dialog="'+flag+'"]'),previous=document.activeElement;if(!dialog)return;dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',flag);const controls=()=>[...dialog.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled);controls()[0]?.focus();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';const keydown=event=>{if(event.key==='Escape')setUi(previous=>({...previous,[flag]:false}));if(event.key==='Tab'){const items=controls(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};document.addEventListener('keydown',keydown);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keydown);previous?.focus();};},[newPlanModal,newForecastModal,confirmModal,rejectModal,recruitmentModal,drillDrawer]);
 return (<><Sidebar activePage="workforce-planning" /><div className="pl-64"><Header /><main className={"relative pt-16 bg-surface min-h-screen"}><div className={"flex flex-col w-full pb-20"}>

<div className={"sticky top-16 z-30 bg-surface-container-highest/95 backdrop-blur-md px-gutter py-3 shadow-sm border-b border-outline-variant/20 flex flex-wrap items-center justify-between gap-3"}>
<div className={"flex items-center gap-2"}>
<span className={"px-2 py-1 bg-primary text-on-primary font-label-caps text-label-caps rounded"}>SIMULATOR RIG</span>
<span className={"text-on-surface-variant font-body-sm text-body-sm hidden md:inline"}>Test states:</span>
</div>
<div className={"flex flex-wrap items-center gap-1.5"}>
<button className={"px-2.5 py-1 rounded text-label-md transition-all" + " " + (simState === 'dashboard' ? 'bg-primary text-on-primary font-medium' : 'bg-surface hover:bg-surface-container text-on-surface')} onClick={()=>{setUi(previous=>({...previous,simState:'dashboard'}))}}>1. Overview</button>
<button className={"px-2.5 py-1 rounded text-label-md transition-all" + " " + (simState === 'plans' ? 'bg-primary text-on-primary font-medium' : 'bg-surface hover:bg-surface-container text-on-surface')} onClick={()=>{setUi(previous=>({...previous,simState:'plans'}))}}>2. Plans &amp; Forecasts</button>
<button className={"px-2.5 py-1 rounded text-label-md transition-all" + " " + (simState === 'modal' ? 'bg-primary text-on-primary font-medium' : 'bg-surface hover:bg-surface-container text-on-surface')} onClick={()=>{setUi(previous=>({...previous,newPlanModal:true})); setUi(previous=>({...previous,simState:'modal'}))}}>3. New Plan Modal</button>
<button className={"px-2.5 py-1 rounded text-label-md transition-all" + " " + (simState === 'workflow' ? 'bg-primary text-on-primary font-medium' : 'bg-surface hover:bg-surface-container text-on-surface')} onClick={()=>{setUi(previous=>({...previous,simState:'workflow'}))}}>4. Stepper</button>
<button className={"px-2.5 py-1 rounded text-label-md transition-all" + " " + (simState === 'confirm' ? 'bg-primary text-on-primary font-medium' : 'bg-surface hover:bg-surface-container text-on-surface')} onClick={()=>{triggerAction('Submit'); setUi(previous=>({...previous,simState:'confirm'}))}}>5. Confirm</button>
<button className={"px-2.5 py-1 rounded text-label-md transition-all" + " " + (simState === 'reject' ? 'bg-primary text-on-primary font-medium' : 'bg-surface hover:bg-surface-container text-on-surface')} onClick={()=>{triggerAction('Reject'); setUi(previous=>({...previous,simState:'reject'}))}}>6. Reject Modal</button>
<button className={"px-2.5 py-1 rounded text-label-md transition-all" + " " + (simState === 'recruitment' ? 'bg-primary text-on-primary font-medium' : 'bg-surface hover:bg-surface-container text-on-surface')} onClick={()=>{setUi(previous=>({...previous,recruitmentModal:true})); setUi(previous=>({...previous,simState:'recruitment'}))}}>7. Recruitment</button>
<button className={"px-2.5 py-1 rounded text-label-md transition-all" + " " + (simState === 'empty' ? 'bg-primary text-on-primary font-medium' : 'bg-surface hover:bg-surface-container text-on-surface')} onClick={()=>{setUi(previous=>({...previous,simState:'empty'})); setUi(previous=>({...previous,searchQuery:'NonExistentXYZ'}))}}>8. Empty State</button>
</div>
</div>

<div className={"fixed bottom-6 right-6 z-50 bg-[#0E2B3D] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-white/10" + ((successToast) ? "" : " hidden")}>
<span className={"material-symbols-outlined text-[#1CCA9B]"}>check_circle</span>
<span className="font-label-lg text-label-lg">{toastMsg}</span>
</div>
<div className={"px-margin py-space-xl space-y-space-xl"}>

<div className={"flex flex-col md:flex-row md:items-center justify-between gap-4"}>
<div>
<h1 className={"font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight"}>Workforce Planning &amp; Requisition Suite</h1><p className="text-body-sm text-secondary">Local sample workforce data ? {plans.length} plans ? {requisitions.length} requisition previews</p>
<p className={"font-body-md text-body-md text-on-surface-variant mt-1"}>Bengaluru HQ &amp; Regional Hubs • FY 2025-2026 Strategic Capacity Planning</p>
</div>
<div className={"flex items-center gap-3"}>
<button className={"px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-lg font-label-lg flex items-center gap-2 transition-all shadow-sm"} onClick={()=>{setUi(previous=>({...previous,newForecastModal:true}))}}>
<span className={"material-symbols-outlined text-lg"}>analytics</span>
                    New Forecast
                </button>
<button className={"px-4 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-label-lg flex items-center gap-2 transition-all shadow-md"} onClick={()=>{setUi(previous=>({...previous,newPlanModal:true}))}}>
<span className={"material-symbols-outlined text-lg"}>add</span>
                    New Workforce Plan
                </button>
</div>
</div>

<div className={"grid grid-cols-1 md:grid-cols-3 gap-6"}>

<div className={"bg-surface-container-lowest p-6 rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] border border-outline-variant/30 hover:border-primary/50 cursor-pointer transition-all group"} onClick={()=>{setUi(previous=>({...previous,drillDrawer:true})); setUi(previous=>({...previous,drillTitle:'Current Headcount Analysis (Bengaluru & Pune)'}))}}>
<div className={"flex items-center justify-between"}>
<span className={"font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant"}>Current Headcount</span>
<div className={"w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-all"}>
<span className={"material-symbols-outlined"}>group</span>
</div>
</div>
<div className={"mt-4 flex items-baseline gap-3"}>
<span className={"font-display-lg text-display-lg font-bold text-on-surface"}>1,420</span>
<span className={"inline-flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"}>
<span className={"material-symbols-outlined text-sm"}>trending_up</span> +4.2% YoY
                    </span>
</div>
<div className={"mt-3 flex items-center justify-between text-body-sm text-on-surface-variant pt-3 border-t border-outline-variant/10"}>
<span>Full-Time: 1,280</span>
<span>Contractors: 140</span>
</div>
</div>

<div className={"bg-surface-container-lowest p-6 rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] border border-outline-variant/30 hover:border-primary/50 cursor-pointer transition-all group"} onClick={()=>{setUi(previous=>({...previous,drillDrawer:true})); setUi(previous=>({...previous,drillTitle:'Planned Headcount Targets (Q3-Q4)'}))}}>
<div className={"flex items-center justify-between"}>
<span className={"font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant"}>Planned Headcount</span>
<div className={"w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-all"}>
<span className={"material-symbols-outlined"}>upcoming</span>
</div>
</div>
<div className={"mt-4 flex items-baseline gap-3"}>
<span className={"font-display-lg text-display-lg font-bold text-on-surface"}>1,650</span>
<span className={"inline-flex items-center text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full"}>
                        Target Dec '25
                    </span>
</div>
<div className={"mt-3 flex items-center justify-between text-body-sm text-on-surface-variant pt-3 border-t border-outline-variant/10"}>
<span>Approved Budgets: 4 Active</span>
<span>Pending: 2</span>
</div>
</div>

<div className={"bg-surface-container-lowest p-6 rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] border border-outline-variant/30 hover:border-primary/50 cursor-pointer transition-all group"} onClick={()=>{setUi(previous=>({...previous,drillDrawer:true})); setUi(previous=>({...previous,drillTitle:'Headcount Gap & Open Requisition Deficit'}))}}>
<div className={"flex items-center justify-between"}>
<span className={"font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant"}>Headcount Gap</span>
<div className={"w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all"}>
<span className={"material-symbols-outlined"}>balance</span>
</div>
</div>
<div className={"mt-4 flex items-baseline gap-3"}>
<span className={"font-display-lg text-display-lg font-bold text-amber-600"}>+230</span>
<span className={"inline-flex items-center text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full"}>
                        Critical Hiring Needed
                    </span>
</div>
<div className={"mt-3 flex items-center justify-between text-body-sm text-on-surface-variant pt-3 border-t border-outline-variant/10"}>
<span>Engineering: +120</span>
<span>Product/Sales: +110</span>
</div>
</div>
</div>

<div className={"bg-surface-container-lowest rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] border border-outline-variant/30 p-6 space-y-6"}>

<div className={"flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-6 border-b border-outline-variant/20"}>
<div className={"flex items-center bg-surface-container-low p-1 rounded-xl"}>
<button className={"px-4 py-2 rounded-lg text-label-lg transition-all" + " " + (activeTab === 'plans' ? 'bg-surface text-on-surface font-semibold shadow-sm' : 'text-on-surface-variant hover:text-on-surface')} onClick={()=>{setUi(previous=>({...previous,activeTab:'plans'}))}}>Headcount Plans</button>
<button className={"px-4 py-2 rounded-lg text-label-lg transition-all" + " " + (activeTab === 'forecasts' ? 'bg-surface text-on-surface font-semibold shadow-sm' : 'text-on-surface-variant hover:text-on-surface')} onClick={()=>{setUi(previous=>({...previous,activeTab:'forecasts'}))}}>Demand Forecasts</button>
</div>
<div className={"flex flex-wrap items-center gap-3 w-full lg:w-auto"}>
<div className={"relative flex-1 lg:w-72"}>
<span className={"material-symbols-outlined absolute left-3 top-2.5 text-outline text-lg"}>search</span>
<input className={"w-full pl-9 pr-4 py-2 bg-surface-container-low rounded-xl text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"} aria-label="Search workforce plans" placeholder="Search plans, owners, depts..." type="text" value={searchQuery} onChange={event=>setUi(previous=>({...previous,searchQuery:event.target.value}))} />
</div>
<select className={"px-3 py-2 bg-surface-container-low rounded-xl text-body-md text-on-surface border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary"} value={deptFilter} onChange={event=>setUi(previous=>({...previous,deptFilter:event.target.value}))}>
<option defaultValue="All">All Departments</option>
<option defaultValue="Engineering">Engineering</option>
<option defaultValue="Product">Product</option>
<option defaultValue="Sales">Sales &amp; Growth</option>
<option defaultValue="People">People Ops</option>
</select>
</div>
</div>

<div className={"space-y-6" + ((activeTab === 'plans' && simState !== 'empty') ? "" : " hidden")}><WorkforcePlans plans={filteredPlans} selectedPlan={selectedPlan} onSelect={selectPlan} onAction={triggerAction} /></div>

<div className={"space-y-6" + ((activeTab === 'forecasts' && simState !== 'empty') ? "" : " hidden")}><WorkforceForecasts forecasts={forecasts} /></div>

<div className={"py-16 text-center space-y-4" + ((simState === 'empty') ? "" : " hidden")}>
<div className={"w-16 h-16 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center mx-auto text-3xl"}>
<span className={"material-symbols-outlined text-3xl"}>folder_off</span>
</div>
<h3 className={"font-headline-md text-headline-md text-on-surface font-bold"}>No Workforce Plans Found</h3>
<p className={"font-body-md text-body-md text-on-surface-variant max-w-md mx-auto"}>We couldn't find any plans matching your search or filter criteria. Try adjusting your search query or department filter.</p>
<button className={"px-4 py-2 bg-primary text-on-primary rounded-lg font-label-lg"} onClick={()=>{setUi(previous=>({...previous,simState:'dashboard'})); setUi(previous=>({...previous,searchQuery:''})); setUi(previous=>({...previous,deptFilter:'All'}))}}>Reset Filters</button>
</div>

<div className={"flex items-center justify-between pt-4 border-t border-outline-variant/20" + ((simState !== 'empty') ? "" : " hidden")}>
<span className={"font-body-sm text-body-sm text-on-surface-variant"}>Showing 1 to 4 of 12 workforce plans</span>
<div className={"flex items-center gap-1"}>
<button className={"px-3 py-1 bg-surface-container-low rounded text-on-surface-variant hover:bg-surface-container disabled:opacity-50"} disabled>Previous</button>
<button className={"px-3 py-1 bg-primary text-on-primary rounded font-medium"}>1</button>
<button className={"px-3 py-1 bg-surface-container-low rounded text-on-surface hover:bg-surface-container"}>2</button>
<button className={"px-3 py-1 bg-surface-container-low rounded text-on-surface hover:bg-surface-container"}>3</button>
<button className={"px-3 py-1 bg-surface-container-low rounded text-on-surface hover:bg-surface-container"}>Next</button>
</div>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 overflow-hidden" + ((drillDrawer) ? "" : " hidden")} data-workforce-dialog="drillDrawer">
<div className={"absolute inset-0 bg-[#0E2B3D]/40 backdrop-blur-sm transition-opacity"} onClick={()=>{setUi(previous=>({...previous,drillDrawer:false}))}}></div>
<div className={"absolute inset-y-0 right-0 max-w-full flex pl-10"}>
<div className={"w-screen max-w-md bg-surface p-6 shadow-2xl flex flex-col justify-between border-l border-outline-variant/20"}>
<div className={"space-y-6"}>
<div className={"flex items-center justify-between border-b border-outline-variant/20 pb-4"}>
<h3 className={"font-headline-md text-on-surface font-bold"}>{drillTitle}</h3>
<button className={"text-on-surface-variant hover:text-on-surface"} onClick={()=>{setUi(previous=>({...previous,drillDrawer:false}))}}><span className={"material-symbols-outlined"}>close</span></button>
</div>
<div className={"space-y-4"}>
<div className={"bg-surface-container-low p-4 rounded-xl"}>
<span className={"text-xs text-outline"}>Active Filter Region</span>
<p className={"font-bold text-on-surface text-lg"}>Bengaluru HQ &amp; Satellite Hubs</p>
</div>
<p className={"text-body-md text-on-surface-variant"}>Detailed breakdown of headcount metrics across business units, tenure distribution, and attrition velocity over the last 12 months.</p>
<div className={"space-y-2"}>
<div className={"flex justify-between p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/10"}><span className={"font-medium"}>Engineering Hub</span><span className={"font-bold text-primary"}>680 FTEs</span></div>
<div className={"flex justify-between p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/10"}><span className={"font-medium"}>Product &amp; Design</span><span className={"font-bold text-primary"}>240 FTEs</span></div>
<div className={"flex justify-between p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/10"}><span className={"font-medium"}>Sales &amp; Customer Success</span><span className={"font-bold text-primary"}>500 FTEs</span></div>
</div>
</div>
</div>
<div className={"pt-4 border-t border-outline-variant/20 flex justify-end"}>
<button className={"px-4 py-2 bg-primary text-on-primary rounded-lg font-label-lg"} onClick={()=>{setUi(previous=>({...previous,drillDrawer:false}))}}>Close Drill-Down</button>
</div>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center p-4" + ((newPlanModal) ? "" : " hidden")} data-workforce-dialog="newPlanModal">
<div className={"absolute inset-0 bg-[#0E2B3D]/40 backdrop-blur-sm"} onClick={()=>{setUi(previous=>({...previous,newPlanModal:false}))}}></div>
<div className={"relative bg-surface w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-6 z-10 border border-outline-variant/20"}>
<div className={"flex items-center justify-between border-b border-outline-variant/20 pb-4"}>
<h3 className={"font-headline-md text-on-surface font-bold"}>Create New Workforce Plan</h3>
<button className={"text-on-surface-variant hover:text-on-surface"} onClick={()=>{setUi(previous=>({...previous,newPlanModal:false}))}}><span className={"material-symbols-outlined"}>close</span></button>
</div>
<div className={"space-y-4"}>
<div>
<label className={"block text-label-md font-medium text-on-surface mb-1"}>Plan Title</label>
<input className={"w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"} placeholder="e.g. Pune AI Research Expansion" type="text" aria-label="planName" value={fields.planName} onChange={event=>setField("planName",event.target.value)} />
</div>
<div className={"grid grid-cols-2 gap-4"}>
<div>
<label className={"block text-label-md font-medium text-on-surface mb-1"}>Department</label>
<select className={"w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"} aria-label="planDept" value={fields.planDept} onChange={event=>setField("planDept",event.target.value)}>
<option>Engineering</option>
<option>Product</option>
<option>Sales</option>
</select>
</div>
<div>
<label className={"block text-label-md font-medium text-on-surface mb-1"}>Target Headcount</label>
<input className={"w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"} placeholder="50" type="number" aria-label="planTarget" value={fields.planTarget} onChange={event=>setField("planTarget",event.target.value)} />
</div>
</div>
<div>
<label className={"block text-label-md font-medium text-on-surface mb-1"}>Allocated Budget (INR)</label>
<input className={"w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"} placeholder="₹2.5 Cr" type="text" aria-label="planBudget" value={fields.planBudget} onChange={event=>setField("planBudget",event.target.value)} />
</div>
</div>
<div className={"flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/20"}>
<button className={"px-4 py-2 bg-surface border border-outline-variant text-on-surface rounded-lg font-label-lg"} onClick={()=>{setUi(previous=>({...previous,newPlanModal:false}))}}>Cancel</button>
<button className={"px-4 py-2 bg-primary text-on-primary rounded-lg font-label-lg shadow-md"} onClick={()=>{createPlan();}}>Save &amp; Submit Draft</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center p-4" + ((newForecastModal) ? "" : " hidden")} data-workforce-dialog="newForecastModal">
<div className={"absolute inset-0 bg-[#0E2B3D]/40 backdrop-blur-sm"} onClick={()=>{setUi(previous=>({...previous,newForecastModal:false}))}}></div>
<div className={"relative bg-surface w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-6 z-10 border border-outline-variant/20"}>
<div className={"flex items-center justify-between border-b border-outline-variant/20 pb-4"}>
<h3 className={"font-headline-md text-on-surface font-bold"}>New Demand Forecast Model</h3>
<button className={"text-on-surface-variant hover:text-on-surface"} onClick={()=>{setUi(previous=>({...previous,newForecastModal:false}))}}><span className={"material-symbols-outlined"}>close</span></button>
</div>
<div className={"space-y-4"}>
<div>
<label className={"block text-label-md font-medium text-on-surface mb-1"}>Forecast Title</label>
<input className={"w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"} placeholder="e.g. FY26 Q1 Headcount Demand Model" type="text" aria-label="forecastName" value={fields.forecastName} onChange={event=>setField("forecastName",event.target.value)} />
</div>
<div>
<label className={"block text-label-md font-medium text-on-surface mb-1"}>Target Growth Rate (%)</label>
<input className={"w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"} placeholder="25" type="number" aria-label="forecastDemand" value={fields.forecastDemand} onChange={event=>setField("forecastDemand",event.target.value)} />
</div>
</div>
<div className={"flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/20"}>
<button className={"px-4 py-2 bg-surface border border-outline-variant text-on-surface rounded-lg font-label-lg"} onClick={()=>{setUi(previous=>({...previous,newForecastModal:false}))}}>Cancel</button>
<button className={"px-4 py-2 bg-primary text-on-primary rounded-lg font-label-lg shadow-md"} onClick={()=>{createForecast();}}>Generate Forecast</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center p-4" + ((confirmModal) ? "" : " hidden")} data-workforce-dialog="confirmModal">
<div className={"absolute inset-0 bg-[#0E2B3D]/40 backdrop-blur-sm"} onClick={()=>{setUi(previous=>({...previous,confirmModal:false}))}}></div>
<div className={"relative bg-surface w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-6 z-10 border border-outline-variant/20"}>
<div className={"flex items-center gap-3"}>
<div className={"w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"}>
<span className={"material-symbols-outlined text-2xl"}>help</span>
</div>
<div>
<h3 className={"font-headline-sm text-on-surface font-bold"}>{confirmTitle}</h3>
<p className={"font-body-sm text-on-surface-variant mt-1"}>{confirmText}</p>
</div>
</div>
<div className={"flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/20"}>
<button className={"px-4 py-2 bg-surface border border-outline-variant text-on-surface rounded-lg font-label-lg"} onClick={()=>{setUi(previous=>({...previous,confirmModal:false}))}}>Cancel</button>
<button className={"px-4 py-2 bg-primary text-on-primary rounded-lg font-label-lg shadow-md"} onClick={()=>{executeConfirm()}}>Confirm &amp; Proceed</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center p-4" + ((rejectModal) ? "" : " hidden")} data-workforce-dialog="rejectModal">
<div className={"absolute inset-0 bg-[#0E2B3D]/40 backdrop-blur-sm"} onClick={()=>{setUi(previous=>({...previous,rejectModal:false}))}}></div>
<div className={"relative bg-surface w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-6 z-10 border border-outline-variant/20"}>
<div className={"flex items-center justify-between border-b border-outline-variant/20 pb-4"}>
<h3 className={"font-headline-md text-error font-bold flex items-center gap-2"}>
<span className={"material-symbols-outlined"}>report</span> Reject Workforce Plan
                </h3>
<button className={"text-on-surface-variant hover:text-on-surface"} onClick={()=>{setUi(previous=>({...previous,rejectModal:false}))}}><span className={"material-symbols-outlined"}>close</span></button>
</div>
<div className={"space-y-4"}>
<p className={"text-body-md text-on-surface-variant"}>Provide a rejection reason. Feedback is stored in this local session without sending email.</p>
<div>
<label className={"block text-label-md font-medium text-on-surface mb-1"}>Rejection Reason *</label>
<textarea aria-label="Rejection reason" className="w-full p-3 bg-surface-container-low rounded-lg" rows={4} value={rejectReason} onChange={event=>setUi(previous=>({...previous,rejectReason:event.target.value}))} />
</div>
</div>
<div className={"flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/20"}>
<button className={"px-4 py-2 bg-surface border border-outline-variant text-on-surface rounded-lg font-label-lg"} onClick={()=>{setUi(previous=>({...previous,rejectModal:false}))}}>Cancel</button>
<button className={"px-4 py-2 bg-error text-on-error rounded-lg font-label-lg shadow-md"} onClick={()=>{executeReject()}}>Reject &amp; Send Feedback</button>
</div>
</div>
</div>

<div className={"fixed inset-0 z-50 flex items-center justify-center p-4" + ((recruitmentModal) ? "" : " hidden")} data-workforce-dialog="recruitmentModal">
<div className={"absolute inset-0 bg-[#0E2B3D]/40 backdrop-blur-sm"} onClick={()=>{setUi(previous=>({...previous,recruitmentModal:false}))}}></div>
<div className={"relative bg-surface w-full max-w-2xl rounded-2xl shadow-2xl p-6 space-y-6 z-10 border border-outline-variant/20 max-h-[921px] overflow-y-auto"}>
<div className={"flex items-center justify-between border-b border-outline-variant/20 pb-4"}>
<h3 className={"font-headline-md text-on-surface font-bold flex items-center gap-2"}>
<span className={"material-symbols-outlined text-primary"}>person_search</span> Create Prefilled Recruitment Job Studio
                </h3>
<button className={"text-on-surface-variant hover:text-on-surface"} onClick={()=>{setUi(previous=>({...previous,recruitmentModal:false}))}}><span className={"material-symbols-outlined"}>close</span></button>
</div>
<div className={"space-y-4"}>
<div className={"p-3 bg-surface-container-low rounded-xl text-body-sm text-on-surface-variant"}>
                    Linked to Workforce Plan: <strong className={"text-on-surface"}>Bengaluru R&amp;D Expansion Q3 (PLN-2025-01)</strong>
</div>
<div className={"grid grid-cols-1 md:grid-cols-2 gap-4"}>
<div>
<label className={"block text-label-md font-medium text-on-surface mb-1"}>Job Title</label>
<input className={"w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"} type="text" aria-label="jobTitle" value={fields.jobTitle} onChange={event=>setField("jobTitle",event.target.value)} />
</div>
<div>
<label className={"block text-label-md font-medium text-on-surface mb-1"}>Department</label>
<input className={"w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"} readOnly type="text" aria-label="jobDept" value={fields.jobDept} onChange={event=>setField("jobDept",event.target.value)} />
</div>
</div>
<div className={"grid grid-cols-1 md:grid-cols-2 gap-4"}>
<div>
<label className={"block text-label-md font-medium text-on-surface mb-1"}>Location</label>
<input className={"w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"} type="text" aria-label="jobLocation" value={fields.jobLocation} onChange={event=>setField("jobLocation",event.target.value)} />
</div>
<div>
<label className={"block text-label-md font-medium text-on-surface mb-1"}>Salary Range (INR)</label>
<input className={"w-full px-3 py-2 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"} type="text" aria-label="jobSalary" value={fields.jobSalary} onChange={event=>setField("jobSalary",event.target.value)} />
</div>
</div>
<div>
<label className={"block text-label-md font-medium text-on-surface mb-1"}>Job Description Summary</label>
<textarea aria-label="jobSummary" className="w-full p-3 bg-surface-container-low rounded-lg" rows={3} value={fields.jobSummary} onChange={event=>setField("jobSummary",event.target.value)} />
</div>
</div>
<div className={"flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/20"}>
<button className={"px-4 py-2 bg-surface border border-outline-variant text-on-surface rounded-lg font-label-lg"} onClick={()=>{setUi(previous=>({...previous,recruitmentModal:false}))}}>Cancel</button>
<button className={"px-4 py-2 bg-primary text-on-primary rounded-lg font-label-lg shadow-md"} onClick={()=>{createRecruitment();}}>Publish Job Requisition</button>
</div>
</div>
</div>
</div></main></div></>);
}
