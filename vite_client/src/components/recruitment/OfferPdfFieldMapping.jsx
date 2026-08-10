import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { FaCheckCircle, FaExclamationTriangle, FaRedo, FaTimesCircle } from 'react-icons/fa';
import axios from '../../utils/axios';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import LoadingSpinner from '../LoadingSpinner';
import { CmButton } from '../corporateModern';

const REQUIRED_TOKENS = ['candidateName', 'position'];

function buildItemKey(item) {
    if (!item) return '';
    return `${item.page}|${item.x}|${item.y}|${item.text}`;
}

function fieldDecisionKey(field) {
    return field.occurrenceKey || field.itemKey || field.placeholderToken;
}

function fieldToMapping(field) {
    return {
        placeholderToken: field.placeholderToken,
        label: field.label,
        sourceText: field.sourceText,
        itemKey: field.itemKey,
        page: field.page,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        fontSize: field.fontSize,
        confidence: field.confidence,
        confidenceLevel: field.confidenceLevel === 'low' ? 'high' : field.confidenceLevel,
        replacementStrategy: 'overlay',
        required: REQUIRED_TOKENS.includes(field.placeholderToken),
    };
}

/**
 * Decision state keyed by occurrence (itemKey) so the same token can map
 * multiple annexure cells (e.g. Gross Salary appearing twice).
 */
function initialDecisions(verificationFields = []) {
    const decisions = {};
    for (const field of verificationFields) {
        if (!field.hasSuggestion && !field.detected) continue;
        const key = fieldDecisionKey(field);
        if (field.confidenceLevel === 'high') {
            decisions[key] = 'accepted';
        } else if (field.confidenceLevel === 'medium') {
            decisions[key] = 'pending';
        } else if (field.hasSuggestion) {
            decisions[key] = 'low';
        }
    }
    return decisions;
}

const OfferPdfFieldMapping = ({ template, onClose, onSaved }) => {
    const [loading, setLoading] = useState(true);
    const [detecting, setDetecting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [fieldGroups, setFieldGroups] = useState([]);
    const [extractedItems, setExtractedItems] = useState([]);
    const [hasSelectableText, setHasSelectableText] = useState(true);
    const [isVerified, setIsVerified] = useState(false);
    const [pdfUrl, setPdfUrl] = useState('');
    const [verificationFields, setVerificationFields] = useState([]);
    const [decisions, setDecisions] = useState({});
    const [manualOverrides, setManualOverrides] = useState({});
    const [validationErrors, setValidationErrors] = useState([]);
    const [detectionSummary, setDetectionSummary] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [fieldsRes, extractRes] = await Promise.all([
                axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/offers/templates/pdf/fields`, { withCredentials: true }),
                axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/offers/templates/${template._id}/pdf/extract`, { withCredentials: true }),
            ]);
            if (fieldsRes.data?.success) setFieldGroups(fieldsRes.data.data || []);
            if (extractRes.data?.success) {
                const data = extractRes.data.data;
                setExtractedItems(data.extractedTextItems || []);
                setHasSelectableText(data.hasSelectableText !== false);
                setIsVerified(data.isVerified === true);
                setPdfUrl(data.pdfUrl || template.pdfTemplate?.pdfUrl || '');
                const fields = data.verificationFields || [];
                setVerificationFields(fields);
                setDetectionSummary(data.detectionSummary || null);

                if (data.fieldMappings?.length && data.isVerified) {
                    const fromSaved = {};
                    const overrides = {};
                    for (const m of data.fieldMappings) {
                        const key = m.itemKey || `${m.placeholderToken}|${m.page}|${m.x}|${m.y}|${m.sourceText}`;
                        fromSaved[key] = 'accepted';
                        overrides[key] = m;
                    }
                    for (const field of fields) {
                        const key = fieldDecisionKey(field);
                        if (field.hasSuggestion && !fromSaved[key]) {
                            fromSaved[key] = 'ignored';
                        }
                    }
                    setDecisions(fromSaved);
                    setManualOverrides(overrides);
                } else {
                    setDecisions(initialDecisions(fields));
                    setManualOverrides({});
                }
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load PDF template');
        } finally {
            setLoading(false);
        }
    }, [template._id, template.pdfTemplate?.pdfUrl]);

    useEffect(() => { load(); }, [load]);

    const textOptions = useMemo(
        () => extractedItems.map((item) => ({
            value: buildItemKey(item),
            label: `"${item.text}" — page ${item.page + 1} (${Math.round(item.x)}, ${Math.round(item.y)})`,
            item,
        })),
        [extractedItems],
    );

    const allFieldOptions = useMemo(() => {
        const fromGroups = fieldGroups.flatMap((g) => g.fields);
        const seen = new Set();
        return fromGroups.filter((f) => {
            if (seen.has(f.token)) return false;
            seen.add(f.token);
            return true;
        });
    }, [fieldGroups]);

    const fieldByOccurrence = useMemo(() => {
        const map = new Map();
        for (const f of verificationFields) map.set(fieldDecisionKey(f), f);
        return map;
    }, [verificationFields]);

    /** Fields that actually exist / were suggested from the PDF (no invented empty rows). */
    const suggestedFields = useMemo(
        () => verificationFields.filter((f) => f.hasSuggestion || f.detected),
        [verificationFields],
    );

    const highFields = useMemo(
        () => suggestedFields.filter((f) => f.confidenceLevel === 'high' && decisions[fieldDecisionKey(f)] !== 'ignored'),
        [suggestedFields, decisions],
    );

    const mediumFields = useMemo(
        () => suggestedFields.filter((f) => f.confidenceLevel === 'medium' && decisions[fieldDecisionKey(f)] !== 'ignored'),
        [suggestedFields, decisions],
    );

    const lowFields = useMemo(
        () => suggestedFields.filter((f) => (
            f.confidenceLevel === 'low'
            && decisions[fieldDecisionKey(f)] !== 'ignored'
            && decisions[fieldDecisionKey(f)] !== 'accepted'
        )),
        [suggestedFields, decisions],
    );

    const pendingMediumCount = useMemo(
        () => mediumFields.filter((f) => decisions[fieldDecisionKey(f)] === 'pending').length,
        [mediumFields, decisions],
    );

    const buildMappingsFromDecisions = useCallback((decisionMap) => {
        const mappings = [];
        const seen = new Set();

        for (const [occKey, decision] of Object.entries(decisionMap)) {
            if (decision !== 'accepted') continue;
            if (seen.has(occKey)) continue;
            seen.add(occKey);

            if (manualOverrides[occKey]) {
                const m = manualOverrides[occKey];
                mappings.push({
                    ...m,
                    required: REQUIRED_TOKENS.includes(m.placeholderToken),
                });
                continue;
            }

            const field = fieldByOccurrence.get(occKey);
            if (field?.itemKey && field?.sourceText) {
                mappings.push(fieldToMapping(field));
            }
        }

        return mappings;
    }, [manualOverrides, fieldByOccurrence]);

    const acceptAllDetectedDecisions = useCallback(() => {
        const next = { ...decisions };
        for (const field of suggestedFields) {
            if (field.confidenceLevel === 'high' || field.confidenceLevel === 'medium') {
                const key = fieldDecisionKey(field);
                if (next[key] !== 'ignored') {
                    next[key] = 'accepted';
                }
            }
        }
        return next;
    }, [decisions, suggestedFields]);

    const buildMappingsPayload = useCallback(
        () => buildMappingsFromDecisions(decisions),
        [buildMappingsFromDecisions, decisions],
    );

    const setDecision = (occKey, decision) => {
        setValidationErrors([]);
        setDecisions((prev) => ({ ...prev, [occKey]: decision }));
    };

    const confirmField = (field) => setDecision(fieldDecisionKey(field), 'accepted');
    const ignoreField = (field) => {
        const key = fieldDecisionKey(field);
        setDecision(key, 'ignored');
        setManualOverrides((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const setManualMapping = (token, label, itemKey) => {
        setValidationErrors([]);
        const occKey = itemKey || `manual|${token}`;
        if (!itemKey) {
            setDecision(occKey, 'ignored');
            return;
        }
        const option = textOptions.find((o) => o.value === itemKey);
        const item = option?.item;
        if (!item) return;
        setManualOverrides((prev) => ({
            ...prev,
            [occKey]: {
                placeholderToken: token,
                label,
                sourceText: item.text,
                itemKey,
                page: item.page,
                x: item.x,
                y: item.y,
                width: item.width,
                height: item.height,
                fontSize: item.fontSize,
                confidence: 100,
                confidenceLevel: 'high',
                replacementStrategy: 'overlay',
                required: REQUIRED_TOKENS.includes(token),
            },
        }));
        setDecision(occKey, 'accepted');
    };

    const rerunDetection = async () => {
        try {
            setDetecting(true);
            const { data } = await axios.post(
                `${ADMIN_LIFECYCLE_ENDPOINT}/offers/templates/${template._id}/pdf/detect`,
                {},
                { withCredentials: true },
            );
            if (!data.success) throw new Error(data.message);
            toast.success('Field detection completed');
            await load();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Detection failed');
        } finally {
            setDetecting(false);
        }
    };

    const clientValidation = useMemo(() => {
        const mappings = buildMappingsPayload();
        const errors = [];
        const mapped = new Set(mappings.map((m) => m.placeholderToken));
        for (const token of REQUIRED_TOKENS) {
            if (!mapped.has(token)) {
                const label = allFieldOptions.find((f) => f.token === token)?.label || token;
                errors.push(`${label} must be mapped`);
            }
        }
        for (const mapping of mappings) {
            if (!mapping.itemKey || !mapping.sourceText) {
                errors.push(`${mapping.label || mapping.placeholderToken} has no PDF region selected`);
            }
        }
        if (pendingMediumCount > 0) {
            errors.push(`${pendingMediumCount} field(s) still need confirmation`);
        }
        return errors;
    }, [buildMappingsPayload, allFieldOptions, pendingMediumCount]);

    const saveMappings = async (decisionMap) => {
        const mappings = buildMappingsFromDecisions(decisionMap);
        const mapped = new Set(mappings.map((m) => m.placeholderToken));
        const errors = [];
        for (const token of REQUIRED_TOKENS) {
            if (!mapped.has(token)) {
                const label = allFieldOptions.find((f) => f.token === token)?.label || token;
                errors.push(`${label} must be mapped`);
            }
        }
        for (const mapping of mappings) {
            if (!mapping.itemKey || !mapping.sourceText) {
                errors.push(`${mapping.label || mapping.placeholderToken} has no PDF region selected`);
            }
        }
        if (errors.length) {
            setValidationErrors(errors);
            toast.error('Fix field confirmation before saving');
            return false;
        }

        try {
            setSaving(true);
            const { data } = await axios.put(
                `${ADMIN_LIFECYCLE_ENDPOINT}/offers/templates/${template._id}/pdf/mappings`,
                { mappings },
                { withCredentials: true },
            );
            if (!data.success) throw new Error(data.message);
            toast.success('Template confirmed — fields will be replaced automatically for each candidate');
            onSaved?.(data.data);
            onClose?.();
            return true;
        } catch (error) {
            const serverErrors = error.response?.data?.errors;
            if (Array.isArray(serverErrors)) {
                setValidationErrors(serverErrors.map((e) => e.message || String(e)));
            }
            toast.error(error.response?.data?.message || 'Confirm failed');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const confirmAllDetected = async () => {
        const next = acceptAllDetectedDecisions();
        setDecisions(next);
        setValidationErrors([]);
        await saveMappings(next);
    };

    const confirmTemplate = async () => {
        if (clientValidation.length) {
            setValidationErrors(clientValidation);
            toast.error('Fix field confirmation before saving');
            return;
        }
        await saveMappings(decisions);
    };

    if (loading) return <LoadingSpinner message="Analyzing PDF template..." />;

    const missingRequired = REQUIRED_TOKENS.filter((token) => {
        const mappings = buildMappingsPayload();
        return !mappings.some((m) => m.placeholderToken === token);
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-semibold">
                            {isVerified ? 'PDF Template Fields' : 'PDF Template Fields'}
                            {' — '}
                            {template.name}
                        </h3>
                        <p className="mt-1 text-sm text-gray-600">
                            {isVerified
                                ? 'This template is verified. Future candidates use these mappings automatically.'
                                : 'Fields were detected and mapped automatically. Confirm once — values will be replaced for every new candidate.'}
                        </p>
                        {detectionSummary && (
                            <p className="mt-2 text-xs text-gray-500">
                                Detected: {detectionSummary.high || 0} high confidence
                                {detectionSummary.medium ? `, ${detectionSummary.medium} need confirmation` : ''}
                            </p>
                        )}
                    </div>
                    <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800">Close</button>
                </div>

                {!hasSelectableText ? (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        This PDF does not contain selectable text. Automatic field detection is unavailable for this PDF.
                    </div>
                ) : (
                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="space-y-4">
                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                                <p className="mb-3 text-sm font-semibold text-blue-900">PDF Template Fields</p>
                                {suggestedFields.length === 0 ? (
                                    <p className="text-sm text-gray-500">No dynamic fields were detected in this PDF.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {highFields.map((field) => (
                                            <li
                                                key={fieldDecisionKey(field)}
                                                className="flex items-start gap-2 rounded border border-green-100 bg-white px-3 py-2 text-sm"
                                            >
                                                <FaCheckCircle className="mt-0.5 shrink-0 text-green-600" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-medium text-gray-800">{field.label}</span>
                                                        <span className="text-xs text-gray-400">
                                                            Confidence: {field.confidence}%
                                                        </span>
                                                    </div>
                                                    <p className="mt-0.5 text-xs text-green-700">Detected automatically</p>
                                                    {field.sourceText && (
                                                        <p className="mt-0.5 italic text-gray-600">
                                                            Detected: &quot;{field.sourceText}&quot;
                                                        </p>
                                                    )}
                                                </div>
                                            </li>
                                        ))}

                                        {mediumFields.map((field) => {
                                            const decision = decisions[fieldDecisionKey(field)];
                                            const confirmed = decision === 'accepted';
                                            return (
                                                <li
                                                    key={fieldDecisionKey(field)}
                                                    className="flex items-start gap-2 rounded border border-amber-100 bg-white px-3 py-2 text-sm"
                                                >
                                                    {confirmed ? (
                                                        <FaCheckCircle className="mt-0.5 shrink-0 text-green-600" />
                                                    ) : (
                                                        <FaExclamationTriangle className="mt-0.5 shrink-0 text-amber-600" />
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="font-medium text-gray-800">{field.label}</span>
                                                            <span className="text-xs text-gray-400">
                                                                Confidence: {field.confidence}%
                                                            </span>
                                                        </div>
                                                        <p className="mt-0.5 text-xs text-amber-700">
                                                            {confirmed ? 'Confirmed' : 'Needs confirmation'}
                                                        </p>
                                                        {field.sourceText && (
                                                            <p className="mt-0.5 italic text-gray-600">
                                                                Detected: &quot;{field.sourceText}&quot;
                                                            </p>
                                                        )}
                                                        {!confirmed && (
                                                            <div className="mt-2 flex flex-wrap gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => confirmField(field)}
                                                                    className="rounded border border-green-300 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800 hover:bg-green-100"
                                                                >
                                                                    Confirm
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => ignoreField(field)}
                                                                    className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                                                >
                                                                    Ignore
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </li>
                                            );
                                        })}

                                        {lowFields.map((field) => (
                                            <li
                                                key={fieldDecisionKey(field)}
                                                className="flex items-start gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm"
                                            >
                                                <FaTimesCircle className="mt-0.5 shrink-0 text-gray-400" />
                                                <div className="min-w-0 flex-1">
                                                    <span className="font-medium text-gray-800">{field.label}</span>
                                                    <p className="mt-0.5 text-xs text-gray-500">
                                                        Could not confidently identify this field.
                                                    </p>
                                                    {field.sourceText && (
                                                        <p className="mt-0.5 italic text-gray-400">
                                                            &quot;{field.sourceText}&quot;
                                                        </p>
                                                    )}
                                                    <div className="mt-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => ignoreField(field)}
                                                            className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                                        >
                                                            Ignore
                                                        </button>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {missingRequired.length > 0 && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                    <p className="font-medium">Required fields not yet mapped:</p>
                                    <ul className="mt-1 list-disc pl-5">
                                        {missingRequired.map((token) => (
                                            <li key={token}>
                                                {allFieldOptions.find((f) => f.token === token)?.label || token}
                                            </li>
                                        ))}
                                    </ul>
                                    <p className="mt-2 text-xs">
                                        Use Advanced mapping below only if automatic detection missed a required field.
                                    </p>
                                </div>
                            )}

                            <details
                                className="rounded-lg border p-4"
                                open={missingRequired.length > 0 ? true : undefined}
                            >
                                <summary className="cursor-pointer text-sm font-semibold text-gray-800">
                                    Advanced / manual mapping (fallback only)
                                </summary>
                                <p className="mt-2 text-xs text-gray-500">
                                    Not part of the normal workflow. Use only when a required field was not detected automatically.
                                </p>
                                <div className="mt-3 space-y-3">
                                    {allFieldOptions.map((field) => {
                                        const suggested = verificationFields.find((f) => f.placeholderToken === field.token);
                                        const overrideKey = Object.keys(manualOverrides).find(
                                            (k) => manualOverrides[k]?.placeholderToken === field.token,
                                        );
                                        const override = overrideKey ? manualOverrides[overrideKey] : null;
                                        const currentKey = override?.itemKey
                                            || (suggested && decisions[fieldDecisionKey(suggested)] === 'accepted' && suggested?.itemKey)
                                            || '';
                                        return (
                                            <label key={field.token} className="block text-sm">
                                                <span className="mb-1 block font-medium text-gray-700">{field.label}</span>
                                                <select
                                                    value={currentKey}
                                                    onChange={(e) => setManualMapping(field.token, field.label, e.target.value)}
                                                    className="w-full rounded-lg border px-3 py-2 text-sm"
                                                >
                                                    <option value="">Not mapped</option>
                                                    {textOptions.map((opt) => (
                                                        <option key={`${field.token}-${opt.value}`} value={opt.value}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        );
                                    })}
                                </div>
                            </details>

                            {validationErrors.length > 0 && (
                                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                                    <p className="font-medium">Cannot save until these are fixed:</p>
                                    <ul className="mt-1 list-disc pl-5">
                                        {validationErrors.map((err) => <li key={err}>{err}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                        <div>
                            <p className="mb-2 text-sm font-medium text-gray-700">Template PDF</p>
                            {pdfUrl ? (
                                <iframe
                                    title="PDF template preview"
                                    src={pdfUrl}
                                    className="h-[520px] w-full rounded-lg border bg-gray-50"
                                />
                            ) : (
                                <p className="text-sm text-gray-500">PDF preview unavailable</p>
                            )}
                        </div>
                    </div>
                )}

                <div className="mt-6 flex flex-wrap justify-end gap-2 border-t pt-4">
                    <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
                    {hasSelectableText && (
                        <>
                            <CmButton variant="outline" onClick={rerunDetection} disabled={detecting}>
                                <FaRedo className="text-xs" /> {detecting ? 'Detecting...' : 'Re-run Detection'}
                            </CmButton>
                            {!isVerified && (
                                <CmButton onClick={confirmAllDetected} disabled={saving}>
                                    {saving ? 'Saving...' : 'Confirm All Detected Fields'}
                                </CmButton>
                            )}
                            <CmButton
                                variant={isVerified ? undefined : 'outline'}
                                onClick={confirmTemplate}
                                disabled={saving || clientValidation.length > 0}
                            >
                                {saving ? 'Saving...' : (isVerified ? 'Update Mappings' : 'Save Template')}
                            </CmButton>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OfferPdfFieldMapping;
