export function CandidateTags({tags,onRemove}) {
 return <>{tags.map(tag=><span key={tag} className="px-2.5 py-1 rounded-md bg-surface-container text-on-surface text-label-md flex items-center gap-2"><span>{tag}</span><button aria-label={'Remove tag '+tag} onClick={()=>onRemove(tag)} className="text-outline hover:text-error">×</button></span>)}</>;
}

export function CandidateNotes({notes,onEdit,onDelete}) {
 return <>{notes.map(note=><article key={note.id} className="bg-surface-container-lowest rounded-xl p-5 shadow-sm space-y-3"><div className="flex justify-between gap-3"><p className="text-label-md font-semibold">Dossier note <span className="text-outline text-xs">{note.private?'Internal HR':'Shared preview'}</span></p><div className="flex gap-3 text-body-sm"><button onClick={()=>onEdit(note.id)} className="text-primary">Edit</button><button onClick={()=>onDelete(note.id)} className="text-error">Delete</button></div></div><p className="text-body-sm text-on-surface-variant whitespace-pre-wrap">{note.text}</p></article>)}</>;
}
