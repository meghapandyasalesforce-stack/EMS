import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCheck, FiChevronDown, FiSearch, FiX } from 'react-icons/fi';

export default function SettingsSectionPicker({ groups, sections, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [position, setPosition] = useState({});
    const trigger = useRef(null);
    const dialog = useRef(null);
    const closeButton = useRef(null);
    const id = useId();
    const selected = sections.find(section => section.id === value);
    const filtered = groups.map(group => ({
        ...group,
        options: group.sections.map(key => sections.find(section => section.id === key))
            .filter(section => section && `${section.name} ${group.name}`.toLowerCase().includes(query.trim().toLowerCase())),
    })).filter(group => group.options.length);

    useEffect(() => {
        if (!open) return undefined;
        const place = () => {
            const rect = trigger.current?.getBoundingClientRect();
            if (!rect) return;
            const width = Math.min(350, window.innerWidth - 24);
            setPosition({ '--picker-left': `${Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12))}px`,
                '--picker-top': `${rect.bottom + 6}px`, '--picker-width': `${width}px`,
                '--picker-height': `${Math.max(100, window.innerHeight - rect.bottom - 22)}px`,
                '--picker-viewport-height': `${window.visualViewport?.height || window.innerHeight}px` });
        };
        place();
        const triggerButton = trigger.current;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        closeButton.current?.focus({ preventScroll: true });
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        window.visualViewport?.addEventListener('resize', place);
        return () => {
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
            window.visualViewport?.removeEventListener('resize', place);
            document.body.style.overflow = previousOverflow;
            triggerButton?.focus({ preventScroll: true });
        };
    }, [open]);

    const handleKeyDown = event => {
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return; }
        const options = [...dialog.current.querySelectorAll('[data-section-option]')];
        const index = options.indexOf(document.activeElement);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const next = index < 0 ? (event.key === 'ArrowDown' ? 0 : options.length - 1)
                : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
            options[next]?.focus();
        }
        if (event.key === 'Tab') {
            const focusable = [...dialog.current.querySelectorAll('button, input')];
            const first = focusable[0]; const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    };

    return <>
        <div className="admin-settings__selector">
            <span id={`${id}-label`}>Settings section</span>
            <button ref={trigger} type="button" className="settings-picker__trigger" aria-labelledby={`${id}-label ${id}-value`}
                aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-dialog` : undefined}
                onClick={() => { setQuery(''); setOpen(true); }}>
                <span id={`${id}-value`}>{selected?.name || 'Choose a section'}</span><FiChevronDown aria-hidden="true" />
            </button>
        </div>
        {open && createPortal(<div className="settings-picker__layer" style={position}>
            <button type="button" className="settings-picker__backdrop" aria-label="Dismiss settings picker" tabIndex={-1} onClick={() => setOpen(false)} />
            <div ref={dialog} id={`${id}-dialog`} className="settings-picker__menu" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onKeyDown={handleKeyDown}>
                <div className="settings-picker__head"><h2 id={`${id}-title`}>Choose a section</h2><button ref={closeButton} type="button" aria-label="Close settings picker" onClick={() => setOpen(false)}><FiX /></button></div>
                <label className="settings-picker__search"><FiSearch aria-hidden="true" /><input type="search" aria-label="Search settings" placeholder="Search settings…" value={query} onChange={event => setQuery(event.target.value)} /></label>
                <div className="settings-picker__list">
                    {filtered.length ? filtered.map(group => <section key={group.id} aria-labelledby={`${id}-${group.id}`}>
                        <h3 id={`${id}-${group.id}`}>{group.name}</h3>
                        {group.options.map(section => <button key={section.id} type="button" data-section-option
                            className={section.id === value ? 'is-selected' : ''} aria-current={section.id === value ? 'page' : undefined}
                            onClick={() => { onChange(section.id); setOpen(false); }}>
                            <span className="settings-picker__option-icon" aria-hidden="true">{section.icon}</span><span>{section.name}</span>{section.id === value && <FiCheck className="settings-picker__check" aria-hidden="true" />}
                        </button>)}
                    </section>) : <p className="settings-picker__empty" role="status">No matching settings. Try another search.</p>}
                </div>
            </div>
        </div>, document.body)}
    </>;
}
