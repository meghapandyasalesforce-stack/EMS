import React, { useRef } from 'react';
import { FaUpload, FaTimes, FaFileAlt } from 'react-icons/fa';
import { COVER_LETTER_ACCEPT } from '../../utils/recruitmentFileUpload';

/**
 * Styled file picker — [Choose file] · No file chosen · [clear]
 */
const CoverLetterUploadField = ({
    file,
    onChange,
    label = 'Cover letter',
    heading,
    hint = 'PDF, Word, or image · max 5MB',
    optional = true,
    variant = 'theme', // theme | slate | ats
    layout = 'inline', // inline | card
}) => {
    const inputRef = useRef(null);
    const isAts = variant === 'ats' || variant === 'theme';
    const btnClass = variant === 'slate'
        ? 'bg-slate-900 hover:bg-slate-800'
        : 'bg-[#1CCA9B] hover:bg-[#006c51]';

    const chooseLabel = layout === 'card' ? 'Choose File' : 'Choose file';
    const fileInput = (
        <input
            ref={inputRef}
            type="file"
            accept={COVER_LETTER_ACCEPT}
            className="sr-only"
            onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
    );

    const chooseBtn = (
        <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition ${btnClass}`}
        >
            <FaUpload className="h-3.5 w-3.5" />
            {chooseLabel}
        </button>
    );

    const fileStatus = file ? (
        <span className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium" style={{ color: '#0F2D26' }}>
            <FaFileAlt className="h-3.5 w-3.5 shrink-0 text-[#1CCA9B]" />
            <span className="truncate">{file.name}</span>
        </span>
    ) : (
        <span className="text-sm" style={{ color: '#A0AEC0' }}>No file chosen</span>
    );

    const clearBtn = file ? (
        <button
            type="button"
            onClick={() => {
                onChange(null);
                if (inputRef.current) inputRef.current.value = '';
            }}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition hover:bg-white"
            style={{ color: '#A0AEC0' }}
            aria-label="Remove file"
        >
            <FaTimes className="h-3.5 w-3.5" />
        </button>
    ) : null;

    if (layout === 'card') {
        return (
            <div className="ats-upload-card">
                <p className="ats-upload-card__title">
                    {heading || `Upload ${label}`}
                    {optional ? <span>Optional</span> : null}
                </p>
                <div className="ats-upload-card__row">
                    {chooseBtn}
                    <div className="ats-upload-card__status">{fileStatus}</div>
                    {clearBtn}
                </div>
                {hint ? <p className="ats-upload-card__hint">{hint}</p> : null}
                {fileInput}
            </div>
        );
    }

    return (
        <div className="block text-sm">
            {label && (
                <span className={isAts ? 'ats-form-label' : 'mb-1.5 block font-medium text-gray-700'}>
                    {label}
                    {optional && (
                        <span className="ml-1 font-normal" style={{ color: 'rgba(15,45,38,0.4)' }}>
                            (optional)
                        </span>
                    )}
                </span>
            )}
            <div
                className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 transition"
                style={{
                    borderColor: 'rgba(15,45,38,0.18)',
                    background: 'rgba(245,250,249,0.8)',
                }}
            >
                {chooseBtn}
                <div className="min-w-0 flex-1 text-center">{fileStatus}</div>
                {clearBtn || <span className="h-8 w-8 shrink-0" aria-hidden />}
                {fileInput}
            </div>
            {hint && (
                <span className="mt-1.5 block text-xs" style={{ color: 'rgba(15,45,38,0.45)' }}>
                    {hint}
                </span>
            )}
        </div>
    );
};

export default CoverLetterUploadField;
