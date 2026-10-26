const statusClasses = {
  'Day 1 Ready': 'bg-[#E8FAF4] text-primary',
  'Pre-Boarding': 'bg-secondary-container text-on-secondary-fixed',
  'BGV Pending': 'bg-[#FEF3C7] text-[#B45309]',
  Paused: 'bg-[#FFE4E6] text-error',
};
const Icon = ({ children }) => <span className="material-symbols-outlined text-sm">{children}</span>;

export default function CandidateRow({ item, selected, onSelect, menu, setMenu, openCandidateDrawer, promptPause, promptDelete }) {
  const verified = item.bgvStatus === 'Verified';
  const inProgress = item.bgvStatus === 'In-Progress';
  return (
    <tr className="hover:bg-surface-container-low/60 transition-colors group cursor-pointer" onClick={() => openCandidateDrawer(item.id)}>
      <td className="py-3.5 px-4 text-center" onClick={event => event.stopPropagation()}>
        <input aria-label={`Select ${item.name}`} type="checkbox" checked={selected} onChange={() => onSelect(item.id)} className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300" />
      </td>
      <td className="py-3.5 px-4"><div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-secondary text-sm shrink-0 overflow-hidden">
          {item.img ? <img src={item.img} className="w-full h-full object-cover" alt={item.name} /> : item.name.split(' ').map(name => name[0]).join('')}
        </div>
        <div><p className="font-semibold text-on-surface group-hover:text-primary transition-colors">{item.name}</p><p className="text-xs text-secondary">{item.email}</p><p className="text-[11px] font-mono text-outline">{item.id}</p></div>
      </div></td>
      <td className="py-3.5 px-4"><p className="font-medium text-on-surface">{item.role}</p><p className="text-xs text-secondary">{item.dept} • {item.location}</p></td>
      <td className="py-3.5 px-4 whitespace-nowrap"><p className="font-medium text-on-surface">{item.joining}</p><span className="text-[11px] text-secondary">Cohort Spring</span></td>
      <td className="py-3.5 px-4"><div className="space-y-0.5"><p className="text-xs font-semibold text-on-surface flex items-center gap-1.5"><Icon>person</Icon>{item.buddy}</p><p className="text-[11px] text-secondary">Mgr: {item.manager}</p></div></td>
      <td className="py-3.5 px-4"><div className="w-36 space-y-1"><div className="flex justify-between text-xs"><span className="font-semibold text-on-surface">{item.progressPct}%</span><span className="text-secondary text-[11px]">{item.tasksDone}/{item.tasksTotal} tasks</span></div><div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${item.progressPct}%` }} /></div></div></td>
      <td className="py-3.5 px-4 whitespace-nowrap"><span className={`flex items-center gap-1 text-xs font-semibold ${verified ? 'text-primary' : inProgress ? 'text-secondary' : 'text-[#B45309]'}`}><Icon>{verified ? 'verified' : inProgress ? 'timelapse' : 'pending_actions'}</Icon>{verified ? 'Verified' : inProgress ? 'In-Progress' : 'Docs Pending'}</span></td>
      <td className="py-3.5 px-4 whitespace-nowrap"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusClasses[item.status] || ''}`}>{item.status}</span></td>
      <td className="py-3.5 px-4 text-right" onClick={event => event.stopPropagation()}><div className="relative inline-block text-left">
        <button aria-label={`Actions for ${item.name}`} aria-expanded={menu === item.id} onClick={() => setMenu(menu === item.id ? null : item.id)} className="p-1.5 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"><Icon>more_vert</Icon></button>
        {menu === item.id && <div className="absolute right-0 mt-1 w-44 bg-surface-container-lowest rounded-xl shadow-xl border border-surface-container-high py-1 z-20 text-left">
          <button onClick={() => openCandidateDrawer(item.id)} className="w-full px-3 py-1.5 text-xs text-left hover:bg-surface-container flex items-center gap-2"><Icon>visibility</Icon>View Detail</button>
          <button onClick={() => promptPause(item.id)} className="w-full px-3 py-1.5 text-xs text-left hover:bg-surface-container flex items-center gap-2 text-[#B45309]"><Icon>pause</Icon>Pause Onboarding</button>
          <button onClick={() => promptDelete(item.id)} className="w-full px-3 py-1.5 text-xs text-left hover:bg-surface-container flex items-center gap-2 text-error"><Icon>delete</Icon>Delete Record</button>
        </div>}
      </div></td>
    </tr>
  );
}
