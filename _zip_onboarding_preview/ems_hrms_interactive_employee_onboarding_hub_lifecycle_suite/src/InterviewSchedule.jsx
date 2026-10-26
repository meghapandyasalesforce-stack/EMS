export default function InterviewSchedule({events,anchor,view,onOpen}) {
 const date=new Date(anchor+'T12:00:00Z');
 let first,count;
 if(view==='month'){first=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1,12));first.setUTCDate(first.getUTCDate()-((first.getUTCDay()+6)%7));count=42;}
 else if(view==='week'){first=new Date(date);first.setUTCDate(first.getUTCDate()-((first.getUTCDay()+6)%7));count=6;}
 else{first=new Date(date);count=1;}
 const days=Array.from({length:count},(_,index)=>{const day=new Date(first);day.setUTCDate(day.getUTCDate()+index);return day;});
 return <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 overflow-x-auto"><div className={view==='day'?'p-4':'grid '+(view==='month'?'grid-cols-7 min-w-[800px]':'grid-cols-6 min-w-[1000px]')}>
  {days.map(day=>{const key=day.toISOString().slice(0,10);const daily=events.filter(event=>event.date===key).sort((a,b)=>a.start.localeCompare(b.start));return <section key={key} className={'border-r border-b border-outline-variant/20 p-3 space-y-2 '+(view==='month'?'min-h-36':'min-h-96')}><h3 className={'font-label-md text-label-md p-2 rounded '+(key===anchor?'bg-primary text-on-primary':'bg-surface-container-low text-on-surface')}>{day.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'})}</h3>{daily.map(event=><button key={event.id} onClick={()=>onOpen(event.id)} className={'block w-full text-left p-3 rounded-lg border-l-4 border-primary space-y-1 '+(event.status==='Cancelled'?'bg-error-container/50 opacity-60':'bg-primary/10 hover:bg-primary/20')} aria-label={'Open interview for '+event.candidate}><span className="block text-label-caps text-primary font-semibold">{event.start}–{event.end} IST</span><span className="block text-label-md font-bold">{event.candidate}</span><span className="block text-body-sm">{event.round}</span><span className="block text-label-caps text-outline">{event.status}</span></button>)}{!daily.length&&<p className="text-body-sm text-outline">No interviews</p>}</section>;})}
 </div></div>;
}
