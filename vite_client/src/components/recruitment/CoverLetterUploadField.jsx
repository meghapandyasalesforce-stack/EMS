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
    hint = 'PDF, Word, or image · max 5MB',
    optional = true,
    variant = 'theme', // theme | slate
}) => {
    const inputRef = useRef(null);
    const btnClass = variant === 'slate'
        ? 'bg-slate-900 hover:bg-slate-800'
        : 'bg-theme-secondary hover:bg-theme-primary';

    return (
        <div className="block text-sm">
            {label && (
                <span className="mb-1.5 block font-medium text-gray-700">
                    {label}
                    {optional && <span className="ml-1 font-normal text-gray-400">(optional)</span>}
                </span>
            )}
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50/80 px-3 py-2.5 transition hover:border-gray-400">
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition ${btnClass}`}
                >
                    <FaUpload className="h-3.5 w-3.5" />
                    Choose file
                </button>

                <div className="min-w-0 flex-1 text-center">
                    {file ? (
                        <span className="inline-flex max-w-full items-center justify-center gap-1.5 text-sm font-medium text-gray-800">
                            <FaFileAlt className="h-3.5 w-3.5 shrink-0 text-theme-secondary" />
                            <span className="truncate">{file.name}</span>
                        </span>
                    ) : (
                        <span className="text-sm text-gray-400">No file chosen</span>
                    )}
                </div>

                {file ? (
                    <button
                        type="button"
                        onClick={() => {
                            onChange(null);
                            if (inputRef.current) inputRef.current.value = '';
                        }}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white hover:text-red-600"
                        aria-label="Remove file"
                    >
                        <FaTimes className="h-3.5 w-3.5" />
                    </button>
                ) : (
                    <span className="h-8 w-8 shrink-0" aria-hidden />
                )}

                <input
                    ref={inputRef}
                    type="file"
                    accept={COVER_LETTER_ACCEPT}
                    className="sr-only"
                    onChange={(e) => onChange(e.target.files?.[0] || null)}
                />
            </div>
            {hint && <span className="mt-1.5 block text-xs text-gray-500">{hint}</span>}
        </div>
    );
};

export default CoverLetterUploadField;
