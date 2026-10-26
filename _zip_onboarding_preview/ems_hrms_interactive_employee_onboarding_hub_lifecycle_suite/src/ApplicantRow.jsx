export default function ApplicantRow({item,selected,toggleSelected,openCandidate}) {
 return <tr className="hover:bg-surface-container-low/60 transition-colors">
  <td className="py-3.5 px-4 text-center"><input type="checkbox" checked={selected} aria-label={'Select '+item.name} onChange={()=>toggleSelected(item.id)} className="rounded w-4 h-4 text-primary"/></td>
  <td className="py-3.5 px-4"><div className="flex items-center gap-3">{item.avatar && <img src={item.avatar} alt={item.name} className="w-10 h-10 rounded-full object-cover"/>}<div><button onClick={()=>openCandidate(item.id)} className="font-bold text-left hover:text-primary">{item.name}</button><p className="text-body-sm text-on-surface-variant">{item.background}</p></div></div></td>
  <td className="py-3.5 px-4"><p className="font-medium">{item.company}</p><p className="text-xs text-outline">{item.role}</p></td>
  <td className="py-3.5 px-4"><span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-secondary-container text-on-secondary-container">{item.stage}</span></td>
  <td className="py-3.5 px-4"><span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#D1F5EA] text-[#07523E]">{item.match}</span></td>
  <td className="py-3.5 px-4">{item.applied}</td>
  <td className="py-3.5 px-4 text-primary font-semibold">{item.notice}</td>
  <td className="py-3.5 px-4 text-right"><button onClick={()=>openCandidate(item.id)} className="px-3 py-1 bg-surface-container rounded text-primary font-semibold text-xs" aria-label={'Open dossier for '+item.name}>Dossier</button></td>
 </tr>;
}
