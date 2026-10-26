export default function RequisitionRow({ item, openDetailDrawer, promptApproveModal, promptRejectModal, promptConvertModal }) {
 const pill = 'px-2.5 py-0.5 rounded-full text-xs font-semibold ';
 const statusColor = item.status === 'Approved' ? 'bg-primary-fixed text-on-primary-fixed-variant' : item.status === 'Rejected' ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container';
 return <tr className="hover:bg-surface-container-low/60 transition-colors group">
  <td className="px-space-md py-3.5 font-mono text-xs font-bold text-primary"><button className="hover:underline" onClick={() => openDetailDrawer(item.id)}>{item.id}</button></td>
  <td className="px-space-md py-3.5"><div className="font-semibold">{item.role}</div><div className="text-xs text-outline mt-0.5">Raised: {item.date}</div></td>
  <td className="px-space-md py-3.5">{item.dept}<span className="text-xs text-outline block">{item.headcount}</span></td>
  <td className="px-space-md py-3.5">{item.requestedBy}<span className="text-xs text-outline block">Bengaluru HQ</span></td>
  <td className="px-space-md py-3.5">{item.budget}</td>
  <td className="px-space-md py-3.5"><span className={pill + (item.priority.startsWith('P0') ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container')}>{item.priority}</span></td>
  <td className="px-space-md py-3.5"><span className={pill + statusColor}>{item.status}</span></td>
  <td className="px-space-md py-3.5 text-right whitespace-nowrap">
   {item.status === 'Submitted' && <><button aria-label={'Approve ' + item.id} className="p-1.5 text-primary" onClick={() => promptApproveModal(item.id)}><span className="material-symbols-outlined text-lg">check_circle</span></button><button aria-label={'Reject ' + item.id} className="p-1.5 text-error" onClick={() => promptRejectModal(item.id)}><span className="material-symbols-outlined text-lg">cancel</span></button></>}
   {item.status === 'Approved' && <button className="px-2 py-1 bg-primary text-on-primary rounded text-xs" onClick={() => promptConvertModal(item.id)}>Convert</button>}
   <button aria-label={'View ' + item.id} className="p-1.5 text-outline" onClick={() => openDetailDrawer(item.id)}><span className="material-symbols-outlined text-lg">arrow_forward</span></button>
  </td>
 </tr>;
}
