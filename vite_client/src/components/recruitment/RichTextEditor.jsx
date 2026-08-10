import React, { useCallback, useEffect, useRef } from 'react';
import { FaBold, FaItalic, FaListUl, FaListOl, FaLink } from 'react-icons/fa';
import { normalizeRichHtml } from './OfferLetterHtmlPreview';

const TOOLBAR_ACTIONS = [
    { cmd: 'bold', icon: FaBold, title: 'Bold' },
    { cmd: 'italic', icon: FaItalic, title: 'Italic' },
    { cmd: 'insertUnorderedList', icon: FaListUl, title: 'Bullet list' },
    { cmd: 'insertOrderedList', icon: FaListOl, title: 'Numbered list' },
];

const RichTextEditor = ({ value = '', onChange, placeholder = 'Enter content...', minHeight = 280 }) => {
    const editorRef = useRef(null);

    useEffect(() => {
        if (!editorRef.current) return;
        const normalized = normalizeRichHtml(value);
        if (editorRef.current.innerHTML !== normalized) {
            editorRef.current.innerHTML = normalized || '';
        }
    }, [value]);

    const emitChange = useCallback(() => {
        if (!editorRef.current || !onChange) return;
        onChange(editorRef.current.innerHTML);
    }, [onChange]);

    const runCommand = (command) => {
        document.execCommand(command, false, null);
        editorRef.current?.focus();
        emitChange();
    };

    const insertLink = () => {
        const url = window.prompt('Enter URL');
        if (url) document.execCommand('createLink', false, url);
        emitChange();
    };

    const insertPlaceholder = (token) => {
        document.execCommand('insertText', false, token);
        editorRef.current?.focus();
        emitChange();
    };

    return (
        <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
            <div className="flex flex-wrap items-center gap-1 border-b border-gray-100 bg-gray-50 px-2 py-1.5">
                {TOOLBAR_ACTIONS.map(({ cmd, icon: Icon, title }) => (
                    <button
                        key={cmd}
                        type="button"
                        title={title}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => runCommand(cmd)}
                        className="rounded p-1.5 text-gray-600 hover:bg-white hover:text-gray-900"
                    >
                        <Icon className="text-sm" />
                    </button>
                ))}
                <button
                    type="button"
                    title="Insert link"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={insertLink}
                    className="rounded p-1.5 text-gray-600 hover:bg-white hover:text-gray-900"
                >
                    <FaLink className="text-sm" />
                </button>
            </div>
            <div
                ref={editorRef}
                contentEditable
                role="textbox"
                aria-multiline="true"
                data-placeholder={placeholder}
                onInput={emitChange}
                onBlur={emitChange}
                className="prose prose-sm max-w-none px-4 py-3 outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
                style={{ minHeight }}
            />
        </div>
    );
};

export const OFFER_PLACEHOLDERS = [
    { token: '{{candidateName}}', label: 'Candidate name' },
    { token: '{{email}}', label: 'Email' },
    { token: '{{phone}}', label: 'Phone' },
    { token: '{{position}}', label: 'Position' },
    { token: '{{department}}', label: 'Department' },
    { token: '{{reportingManager}}', label: 'Reporting manager' },
    { token: '{{employmentType}}', label: 'Employment type' },
    { token: '{{salary}}', label: 'Annual CTC' },
    { token: '{{annualCTC}}', label: 'Annual CTC' },
    { token: '{{basicSalary}}', label: 'Basic (monthly)' },
    { token: '{{basicSalaryAnnual}}', label: 'Basic (annual)' },
    { token: '{{hra}}', label: 'HRA (monthly)' },
    { token: '{{hraAnnual}}', label: 'HRA (annual)' },
    { token: '{{specialAllowance}}', label: 'Special allowance (monthly)' },
    { token: '{{grossSalary}}', label: 'Gross (monthly)' },
    { token: '{{employeePF}}', label: 'Employee PF (monthly)' },
    { token: '{{employeeESI}}', label: 'Employee ESI (monthly)' },
    { token: '{{employerPF}}', label: 'Employer PF (monthly)' },
    { token: '{{employerESI}}', label: 'Employer ESI (monthly)' },
    { token: '{{gratuity}}', label: 'Gratuity (monthly)' },
    { token: '{{totalCTC}}', label: 'Total CTC (annual)' },
    { token: '{{startDate}}', label: 'Start date' },
    { token: '{{offerDate}}', label: 'Offer date' },
    { token: '{{offerExpiryDate}}', label: 'Expiry date' },
    { token: '{{probationPeriod}}', label: 'Probation period' },
    { token: '{{noticePeriod}}', label: 'Notice period' },
    { token: '{{workingHours}}', label: 'Working hours' },
    { token: '{{location}}', label: 'Location' },
    { token: '{{companyName}}', label: 'Company' },
    { token: '{{company}}', label: 'Company (alias)' },
    { token: '{{companyAddress}}', label: 'Company address' },
    { token: '{{companyEmail}}', label: 'Company email' },
    { token: '{{companyPhone}}', label: 'Company phone' },
    { token: '{{companyWebsite}}', label: 'Company website' },
    { token: '{{benefits}}', label: 'Benefits' },
    { token: '{{salaryWords}}', label: 'Salary in words' },
    { token: '{{annualCTCInWords}}', label: 'Annual CTC in words' },
    { token: '{{leaveEntitlement}}', label: 'Leave entitlement' },
    { token: '{{currentDate}}', label: 'Current date' },
];

export const PlaceholderChips = ({ onInsert }) => (
    <div className="flex flex-wrap gap-1.5">
        {OFFER_PLACEHOLDERS.map(({ token, label }) => (
            <button
                key={token}
                type="button"
                onClick={() => onInsert(token)}
                className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-600 hover:border-theme-primary/40 hover:text-theme-primary"
            >
                {label}
            </button>
        ))}
    </div>
);

export default RichTextEditor;
