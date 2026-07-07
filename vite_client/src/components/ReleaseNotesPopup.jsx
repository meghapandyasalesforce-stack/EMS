import React, { useEffect, useState } from 'react';
import { APP_VERSION, RELEASE_NOTES, CHANGE_TYPE_STYLE } from '../utils/releaseNotes';

const STORAGE_KEY = 'ems_last_seen_version';

const ReleaseNotesPopup = () => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        const lastSeen = localStorage.getItem(STORAGE_KEY);
        if (lastSeen !== APP_VERSION) {
            setShow(true);
        }
    }, []);

    const handleDismiss = () => {
        localStorage.setItem(STORAGE_KEY, APP_VERSION);
        setShow(false);
    };

    if (!show) return null;

    const latest = RELEASE_NOTES[0];

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-6 py-5">
                    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-100">
                        What's new
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-white">{latest.title}</h2>
                    <p className="mt-0.5 text-sm text-emerald-100">
                        Version {latest.version} · {latest.date}
                    </p>
                </div>

                {/* Changes list */}
                <div className="max-h-72 overflow-y-auto px-6 py-4">
                    <ul className="space-y-3">
                        {latest.changes.map((change, idx) => {
                            const style = CHANGE_TYPE_STYLE[change.type] || CHANGE_TYPE_STYLE.new;
                            return (
                                <li key={idx} className="flex items-start gap-3">
                                    <span
                                        className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.bg} ${style.text}`}
                                    >
                                        {style.label}
                                    </span>
                                    <span className="text-sm text-slate-700">{change.text}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                {/* Footer */}
                <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-400">
                        You won't see this again until the next update.
                    </p>
                    <button
                        type="button"
                        onClick={handleDismiss}
                        className="shrink-0 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
                    >
                        Got it!
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReleaseNotesPopup;
