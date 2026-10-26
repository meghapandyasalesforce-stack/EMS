export default function TicketRow({ticket,onOpen}) {
 const pill='px-2.5 py-1 rounded-full text-label-md ';
 return <tr className="hover:bg-surface-container-low transition-colors">
  <td className="py-4 px-6 font-semibold text-primary"><button className="hover:underline" onClick={() => onOpen(ticket.id)} aria-label={'Open ticket '+ticket.id}>{ticket.id}</button></td>
  <td className="py-4 px-6"><div className="flex items-center gap-3"><img className="w-8 h-8 rounded-full object-cover" alt={ticket.employee} src={ticket.avatar}/><div><p className="font-medium">{ticket.employee}</p><p className="text-body-sm text-outline">{ticket.department}</p></div></div></td>
  <td className="py-4 px-6 font-medium max-w-xs"><button className="text-left hover:text-primary" onClick={() => onOpen(ticket.id)}>{ticket.subject}</button></td>
  <td className="py-4 px-6"><span className={pill+'bg-surface-container'}>{ticket.category}</span></td>
  <td className="py-4 px-6"><span className={pill+(ticket.priority==='Urgent'?'bg-error-container text-on-error-container':'bg-surface-container text-on-surface-variant')}>{ticket.priority}</span></td>
  <td className="py-4 px-6"><span className={pill+(ticket.status==='Resolved'?'bg-[#D1F5EA] text-[#07523E]':ticket.status==='Open'?'bg-[#FEF3C7] text-[#B45309]':'bg-secondary-container text-on-secondary-container')}>{ticket.status}</span></td>
  <td className="py-4 px-6 text-body-sm text-on-surface-variant">{ticket.assignee}</td>
  <td className="py-4 px-6 text-right text-body-sm text-outline">{ticket.updated}</td>
 </tr>;
}
