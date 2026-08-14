import React from 'react';

const DraftAwaitingBanner = ({ count, entityLabel }) => {
    if (!count || count < 1) return null;

    const label = count === 1 ? entityLabel : `${entityLabel}s`;

    return (
        <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
            <strong>{count}</strong> {label} still in <strong>Draft</strong> — not visible to employees
            until published.
        </div>
    );
};

export default DraftAwaitingBanner;
