import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { ADMIN_LIFECYCLE_ENDPOINT, BOTH_LIFECYCLE_ENDPOINT, BOTH_DOCUMENT_ENDPOINT } from '../../utils/constant';
import LoadingSpinner from '../../components/LoadingSpinner';
import { 
    FaChevronDown, FaUpload, FaDownload, FaEye, FaTrash, 
    FaPlus, FaTimes, FaCheck, FaClock, FaExclamationTriangle, 
    FaFileAlt, FaUser, FaBuilding, FaGraduationCap, FaMapMarkerAlt, 
    FaIdCard, FaShieldAlt, FaUsers, FaHistory, 
    FaUserTie, FaCheckCircle, FaTimesCircle, FaSync
} from 'react-icons/fa';
import { CmBadge, CmButton, statusTone } from '../../components/corporateModern';

const STATUS_COLORS = {
    Clear: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    Failed: 'bg-red-100 text-red-800 border-red-200',
    'In Progress': 'bg-amber-100 text-amber-800 border-amber-200',
    'Not Started': 'bg-slate-100 text-slate-700 border-slate-200',
    Initiated: 'bg-blue-100 text-blue-800 border-blue-200',
    'Partially Clear': 'bg-amber-100 text-amber-800 border-amber-200',
    Waived: 'bg-gray-100 text-gray-600 border-gray-200',
    Discrepancy: 'bg-orange-100 text-orange-800 border-orange-200',
    'Pending Employee Submission': 'bg-purple-100 text-purple-800 border-purple-200',
    'Draft Saved': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    Submitted: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    'Under HR Review': 'bg-teal-100 text-teal-800 border-teal-200',
    'Additional Information Required': 'bg-rose-100 text-rose-800 border-rose-200',
    Resubmitted: 'bg-violet-100 text-violet-800 border-violet-200',
    'Verification In Progress': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    Verified: 'bg-green-100 text-green-800 border-green-200',
    Rejected: 'bg-red-100 text-red-800 border-red-200',
};

const CHECK_ICONS = {
    employment: FaBuilding,
    education: FaGraduationCap,
    address: FaMapMarkerAlt,
    reference: FaUsers,
    criminal: FaShieldAlt,
    identity: FaIdCard,
};

const CHECK_LABELS = {
    employment: 'Employment Verification',
    education: 'Education Verification',
    address: 'Address Verification',
    reference: 'Reference Check',
    criminal: 'Criminal Verification',
    identity: 'Identity Verification',
};

function resolveCheckTitle(check = {}) {
    const type = String(check.checkType || check.type || '').toLowerCase().trim();
    if (CHECK_LABELS[type]) return CHECK_LABELS[type];
    if (check.label && !/^verification check$/i.test(check.label)) return check.label;
    if (type) return type.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return 'Verification Check';
}

const MetaField = ({ icon: MetaIcon, label, value, dense = false }) => (
    <div className={`flex min-w-0 items-start gap-2 ${dense ? 'px-2.5 py-1.5' : 'px-3 py-2.5'}`}>
        <div className={`mt-0.5 flex shrink-0 items-center justify-center rounded text-slate-500 ${dense ? 'h-5 w-5' : 'h-6 w-6'}`}>
            <MetaIcon className="text-[11px]" />
        </div>
        <div className="min-w-0 leading-tight">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
            <p className={`truncate font-semibold text-slate-800 ${dense ? 'text-xs' : 'text-[13px]'}`}>{value || '—'}</p>
        </div>
    </div>
);

function MetaFieldGrid({ children, dense = false }) {
    return (
        <div className={`overflow-hidden border border-slate-200/90 bg-white ${dense ? 'rounded-lg' : 'rounded-xl'}`}>
            <div className="grid grid-cols-2 sm:grid-cols-3 [&>*]:border-b [&>*]:border-r [&>*]:border-slate-100">
                {children}
            </div>
        </div>
    );
}

const REQUIRED_DOCS = {
    employment: [
        { name: 'Experience Letter', required: true },
        { name: 'Offer Letter', required: true },
        { name: 'Relieving Letter', required: false },
        { name: 'Salary Slip', required: false },
        { name: 'Appointment Letter', required: false },
    ],
    education: [
        { name: 'Degree Certificate', required: true },
        { name: 'Marksheet', required: true },
        { name: 'Diploma', required: false },
        { name: 'Transcript', required: false },
    ],
    address: [
        { name: 'Aadhaar', required: true },
        { name: 'Passport', required: false },
        { name: 'Driving Licence', required: false },
        { name: 'Utility Bill', required: false },
    ],
    identity: [
        { name: 'Aadhaar', required: true },
        { name: 'PAN', required: true },
        { name: 'Passport', required: false },
    ],
    criminal: [
        { name: 'Police Verification Certificate', required: false },
        { name: 'Government ID', required: true },
    ],
    reference: [],
};

const OnboardingBgvPanel = ({
    workflowId,
    employeeId,
    employeeName: employeeNameProp,
    isHRView,
    isOnboardingEmployee = false,
    onUpdated,
    workflow,
    disableDocumentUpload = false,
}) => {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [bgvCase, setBgvCase] = useState(null);
    const [expandedChecks, setExpandedChecks] = useState(new Set());
    const [featureDisabled, setFeatureDisabled] = useState(false);

    const canInitiate = Boolean(isHRView || isOnboardingEmployee);
    const canEdit = Boolean(isOnboardingEmployee && !isHRView);
    const canVerify = Boolean(isHRView);

    const load = useCallback(async () => {
        if (!workflowId && !employeeId) return;
        try {
            setLoading(true);
            if (isHRView) {
                const { data } = await axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/bgv/hr/dashboard`, {
                    withCredentials: true,
                });
                if (data.data?.enabled === false) {
                    setFeatureDisabled(true);
                    setBgvCase(null);
                    return;
                }
                setFeatureDisabled(false);
                const cases = data.data?.cases || [];
                const targetEmp = String(employeeId || '');
                const match = cases.find((c) => {
                    const caseEmp = String(
                        c.employee?._id
                        || c.employee?.id
                        || c.employeeId?._id
                        || c.employeeId
                        || '',
                    );
                    return targetEmp && caseEmp && caseEmp === targetEmp;
                }) || cases.find((c) => String(c.onboardingWorkflowId?._id || c.onboardingWorkflowId || '') === String(workflowId))
                  || null;
                if (match?._id) {
                    const detail = await axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/bgv/hr/${match._id}/detail`, {
                        withCredentials: true,
                    });
                    setBgvCase(detail.data.data);
                } else {
                    setBgvCase(null);
                }
            } else {
                const { data } = await axios.get(`${BOTH_LIFECYCLE_ENDPOINT}/employee/bgv/dashboard`, {
                    withCredentials: true,
                });
                if (data.data?.enabled === false) {
                    setFeatureDisabled(true);
                    setBgvCase(null);
                    return;
                }
                setFeatureDisabled(false);
                setBgvCase(data.data);
            }
        } catch (err) {
            if (err.response?.data?.enabled === false) {
                setFeatureDisabled(true);
                setBgvCase(null);
            } else {
                setBgvCase(null);
                if (!isHRView && err.response?.status !== 404) {
                    toast.error(err.response?.data?.message || 'Could not load background verification');
                }
            }
        } finally {
            setLoading(false);
        }
    }, [workflowId, employeeId, isHRView]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!isHRView) {
            const interval = setInterval(load, 10000);
            return () => clearInterval(interval);
        }
    }, [load, isHRView]);

    const createCase = async () => {
        try {
            setSubmitting(true);
            if (isHRView) {
                await axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/bgv`, {
                    employeeId,
                    onboardingWorkflowId: workflowId,
                    subjectType: 'employee',
                }, { withCredentials: true });
            } else {
                await axios.post(
                    `${BOTH_LIFECYCLE_ENDPOINT}/employee/onboarding/${workflowId}/bgv`,
                    {},
                    { withCredentials: true },
                );
            }
            toast.success('Background verification initiated');
            await load();
            onUpdated?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to initiate BGV');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleExpand = (checkId) => {
        setExpandedChecks((prev) => {
            // Dossier HR view: one check detail open at a time (screenshot layout).
            if (isHRView) {
                if (prev.has(checkId)) return new Set();
                return new Set([checkId]);
            }
            const next = new Set(prev);
            if (next.has(checkId)) next.delete(checkId);
            else next.add(checkId);
            return next;
        });
    };

    if (loading) return <LoadingSpinner message="Loading BGV..." />;

    if (featureDisabled) {
        return (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
                <FaExclamationTriangle className="mx-auto mb-3 text-3xl text-gray-400" />
                <p className="text-sm text-gray-600">
                    Background verification is disabled. Contact HR to enable it.
                </p>
            </div>
        );
    }

    const hasCase = Boolean(bgvCase?.hasBgvCase || bgvCase?._id);
    const mirroredStatus = hasCase
        ? (bgvCase.overallStatus || workflow?.bgvStatus || 'Not Started')
        : 'Not Started';
    const blocksJoining = Boolean(workflow?.bgvBlocksJoining) && !['Clear', 'Waived'].includes(mirroredStatus);
    const checks = bgvCase?.checks || bgvCase?.checks || [];
    const displayEmployeeName = (employeeNameProp || [
        bgvCase?.employeeId?.name || bgvCase?.employee?.name || workflow?.employeeId?.name,
        bgvCase?.employeeId?.lastName || bgvCase?.employee?.lastName || workflow?.employeeId?.lastName,
    ].filter(Boolean).join(' ')).trim();

    const resolveCheckSubject = (check) => {
        const data = check.verificationData || {};
        if (check.checkType === 'employment') return data.previousCompany || data.company || null;
        if (check.checkType === 'education') {
            const first = (data.educationRecords || [])[0];
            return first?.institute || data.institute || null;
        }
        if (check.checkType === 'address') {
            const addr = data.currentAddress || {};
            return [addr.city, addr.state].filter(Boolean).join(', ') || addr.line1 || null;
        }
        if (check.checkType === 'reference') {
            const refs = check.references || [];
            const named = refs.map((r) => r.name).filter(Boolean);
            return named.length ? named.join(', ') : null;
        }
        return null;
    };

    // ─────────────────────────────────────────────────────────────────────
    // HR dossier BGV tab — SpringVerify layout (ZIP/screenshot). Same
    // handlers/state as before; employee view below is unchanged.
    // ─────────────────────────────────────────────────────────────────────
    if (isHRView) {
        const clearedCount = checks.filter((c) =>
            ['Clear', 'Verified', 'Waived'].includes(String(c.status || '')),
        ).length;
        const scorePct = typeof bgvCase?.integrityScore === 'number'
            ? Math.round(bgvCase.integrityScore)
            : checks.length
                ? Math.round((clearedCount / checks.length) * 100)
                : (mirroredStatus === 'Clear' ? 100 : 0);
        const vendorLabel = bgvCase?.vendor || bgvCase?.provider || 'SpringVerify India HQ';
        const packageLabel = bgvCase?.packageName || bgvCase?.screeningPackage || 'Comprehensive Tech L7';
        const apiId = bgvCase?.externalId || bgvCase?.caseNumber || bgvCase?._id || '—';
        const turnaround = bgvCase?.turnaroundDays
            ? `${bgvCase.turnaroundDays} Business Days`
            : '4 Business Days';
        const expectedSignoff = bgvCase?.expectedCompletionDate
            ? new Date(bgvCase.expectedCompletionDate).toLocaleDateString()
            : (bgvCase?.updatedAt ? new Date(bgvCase.updatedAt).toLocaleDateString() : '—');
        const inProgressCheck = checks.find((c) =>
            /progress|review|submitted|initiated/i.test(String(c.status || '')),
        );

        const pipelineStatusLabel = (status) => {
            const s = String(status || 'Not Started');
            if (['Clear', 'Verified', 'Waived'].includes(s)) return 'Clear / Passed';
            if (/^initiated$/i.test(s)) return 'Initiated';
            if (/progress|review|submitted/i.test(s)) return 'In-Progress';
            if (['Failed', 'Rejected', 'Discrepancy'].includes(s)) return s;
            return s;
        };

        const isPipelineProgress = (status) => {
            const s = String(status || '');
            return /progress|review|submitted|initiated/i.test(s)
                && !['Clear', 'Verified', 'Waived'].includes(s);
        };

        const summaryBadgeClass = (status) => {
            const s = String(status || '');
            if (['Clear', 'Verified', 'Waived'].includes(s)) return 'cm-dossier-bgv__chip cm-dossier-bgv__chip--ok';
            if (/progress|review|submitted|initiated/i.test(s)) return 'cm-dossier-bgv__chip cm-dossier-bgv__chip--info';
            if (['Failed', 'Rejected', 'Discrepancy'].includes(s)) return 'cm-dossier-bgv__chip cm-dossier-bgv__chip--alert';
            return 'cm-dossier-bgv__chip';
        };

        return (
            <div className="cm-dossier-bgv">
                {blocksJoining && (
                    <div className="cm-dossier-bgv__banner" role="status">
                        <FaExclamationTriangle aria-hidden />
                        Joining blocked until BGV is Clear
                    </div>
                )}

                <div className="cm-dossier-bgv__grid">
                    <div className="cm-card cm-dossier-bgv__main">
                        <div className="cm-dossier-bgv__engine-head">
                            <div className="cm-dossier-bgv__engine-identity">
                                <span className="cm-dossier-bgv__engine-icon" aria-hidden>
                                    <FaShieldAlt />
                                </span>
                                <div className="min-w-0">
                                    <h2 className="cm-dossier-bgv__title">SpringVerify Automated BGV Engine</h2>
                                    <p className="cm-dossier-bgv__subtitle">
                                        API Integration ID: #{String(apiId).slice(-12).toUpperCase()}
                                        {' '}• Package: {packageLabel}
                                    </p>
                                </div>
                            </div>
                            {canInitiate && (
                                <button
                                    type="button"
                                    className="cm-dossier-bgv__reinit"
                                    onClick={createCase}
                                    disabled={submitting}
                                >
                                    <FaPlus aria-hidden />
                                    {hasCase
                                        ? (submitting ? 'Working…' : 'Re-initiate Check')
                                        : (submitting ? 'Starting…' : 'Initiate Check')}
                                </button>
                            )}
                        </div>

                        {!hasCase && (
                            <div className="cm-dossier-bgv__empty">
                                <FaFileAlt aria-hidden />
                                <p className="font-semibold">
                                    {canInitiate ? 'Start Background Verification' : 'Pending Initiation'}
                                </p>
                                <p className="text-sm text-[var(--dossier-muted,var(--cm-muted))]">
                                    {canInitiate
                                        ? 'Initiate background verification to start checks and update onboarding progress.'
                                        : 'Background verification has not been initiated yet.'}
                                </p>
                                {canInitiate && (
                                    <CmButton className="mt-3" onClick={createCase} disabled={submitting}>
                                        {submitting ? 'Starting…' : 'Start Background Verification'}
                                    </CmButton>
                                )}
                            </div>
                        )}

                        {hasCase && (
                            <>
                                <div className="cm-dossier-bgv__pipeline-wrap">
                                    <h3 className="cm-dossier-bgv__section-label">
                                        Verification Progression Pipeline
                                    </h3>
                                    <div className="cm-dossier-bgv__pipeline">
                                        {checks.map((check, idx) => {
                                            const checkId = check.checkId || check._id;
                                            const status = String(check.status || 'Not Started');
                                            const clear = ['Clear', 'Verified', 'Waived'].includes(status);
                                            const progress = isPipelineProgress(status);
                                            const subject = resolveCheckSubject(check);
                                            return (
                                                <div
                                                    key={checkId}
                                                    className={`cm-dossier-bgv__step${progress ? ' cm-dossier-bgv__step--active' : ''}`}
                                                >
                                                    <div className="cm-dossier-bgv__step-top">
                                                        <span className="cm-dossier-bgv__step-num">
                                                            Step {idx + 1}
                                                        </span>
                                                        {clear ? (
                                                            <FaCheckCircle className="cm-dossier-bgv__step-icon cm-dossier-bgv__step-icon--ok" />
                                                        ) : progress ? (
                                                            <FaSync className={`cm-dossier-bgv__step-icon${/progress/i.test(status) ? ' cm-dossier-bgv__step-icon--spin' : ' is-info'}`} />
                                                        ) : (
                                                            <FaClock className="cm-dossier-bgv__step-icon" />
                                                        )}
                                                    </div>
                                                    <p className="cm-dossier-bgv__step-title">
                                                        {resolveCheckTitle(check)}
                                                    </p>
                                                    <p className={`cm-dossier-bgv__step-status${clear ? ' is-ok' : ''}${progress ? ' is-info' : ''}`}>
                                                        {pipelineStatusLabel(status)}
                                                    </p>
                                                    {subject && (
                                                        <p className="cm-dossier-bgv__step-note">{subject}</p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="cm-dossier-bgv__summary">
                                    <h3 className="cm-dossier-bgv__summary-title">
                                        Itemized Background Investigation Summary
                                    </h3>
                                    <ul className="cm-dossier-bgv__summary-list">
                                        {checks.map((check) => {
                                            const checkType = String(check.checkType || check.type || '').toLowerCase().trim();
                                            const Icon = CHECK_ICONS[checkType] || FaFileAlt;
                                            const checkId = check.checkId || check._id;
                                            const subject = resolveCheckSubject(check);
                                            const title = resolveCheckTitle(check);
                                            return (
                                                <li key={`sum-${checkId}`}>
                                                    <div className="cm-dossier-bgv__summary-row">
                                                        <span className="cm-dossier-bgv__summary-icon" aria-hidden>
                                                            <Icon />
                                                        </span>
                                                        <span className="cm-dossier-bgv__summary-text">
                                                            {subject
                                                                ? `${subject} • ${title}`
                                                                : title}
                                                        </span>
                                                        <span className={summaryBadgeClass(check.status)}>
                                                            {check.status || 'Not Started'}
                                                        </span>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            </>
                        )}
                    </div>

                    <aside className="cm-card cm-dossier-bgv__scorecard">
                        <div className="cm-dossier-bgv__scorecard-head">
                            <h2 className="cm-dossier-bgv__title">Integrity Scorecard</h2>
                            <FaShieldAlt className="text-[var(--dossier-primary,#00694f)]" aria-hidden />
                        </div>
                        <div className="cm-dossier-bgv__score-panel">
                            <p className="cm-dossier-bgv__score-value">{scorePct}%</p>
                            <p className="cm-dossier-bgv__score-label">
                                {scorePct >= 90 ? 'Green Clear Threshold' : mirroredStatus || 'In Progress'}
                            </p>
                            <p className="cm-dossier-bgv__score-note">
                                {clearedCount} of {checks.length || 0} checks clear
                                {mirroredStatus === 'Clear'
                                    ? ' — zero red flags across completed checks.'
                                    : ' — screening in progress.'}
                            </p>
                        </div>
                        <dl className="cm-dossier-bgv__meta">
                            <div>
                                <dt>Vendor</dt>
                                <dd>{vendorLabel}</dd>
                            </div>
                            <div>
                                <dt>Turnaround Time</dt>
                                <dd>{turnaround}</dd>
                            </div>
                            <div>
                                <dt>Expected Signoff</dt>
                                <dd className="cm-dossier-bgv__meta-accent">{expectedSignoff}</dd>
                            </div>
                            <div>
                                <dt>Overall Status</dt>
                                <dd>{mirroredStatus}</dd>
                            </div>
                        </dl>
                        <div className="cm-dossier-bgv__score-actions">
                            <button
                                type="button"
                                className="cm-dossier-bgv__download"
                                onClick={() => toast.info('BGV report download will be available when the vendor PDF is ready.')}
                            >
                                <FaDownload aria-hidden />
                                Download Full BGV Report (PDF)
                            </button>
                            {inProgressCheck && (
                                <button
                                    type="button"
                                    className="cm-dossier-bgv__expedite"
                                    onClick={() => {
                                        toast.info(`${resolveCheckTitle(inProgressCheck)} is ${inProgressCheck.status || 'in progress'}.`);
                                    }}
                                >
                                    Expedite {resolveCheckTitle(inProgressCheck)}
                                </button>
                            )}
                        </div>
                    </aside>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {blocksJoining && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-800">
                    <FaExclamationTriangle className="text-[10px]" />
                    Joining blocked until BGV is Clear
                </div>
            )}

            {!hasCase && canInitiate && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-10 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
                        <FaFileAlt className="text-2xl" />
                    </div>
                    <h3 className="mb-2 text-base font-semibold text-slate-800">Start Background Verification</h3>
                    <p className="mx-auto mb-6 max-w-md text-sm text-slate-500">
                        {isOnboardingEmployee && !isHRView
                            ? 'Begin your background verification by completing each verification type with details and document uploads.'
                            : 'Initiate background verification to start checks and update onboarding progress.'}
                    </p>
                    <button type="button" onClick={createCase} disabled={submitting}
                        className="rounded-xl bg-sky-600 px-7 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50">
                        {submitting ? (
                            <span className="flex items-center gap-2">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                Starting…
                            </span>
                        ) : (
                            'Start Background Verification'
                        )}
                    </button>
                </div>
            )}

            {!hasCase && !canInitiate && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-10 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-200/80 text-slate-500">
                        <FaClock className="text-2xl" />
                    </div>
                    <h3 className="mb-2 text-base font-semibold text-slate-800">Pending Initiation</h3>
                    <p className="text-sm text-slate-500">
                        Background verification has not been initiated yet.
                    </p>
                </div>
            )}

            {hasCase && (
                <div className="space-y-3">
                    {checks.map((check) => {
                        const checkType = String(check.checkType || check.type || '').toLowerCase().trim();
                        const Icon = CHECK_ICONS[checkType] || FaFileAlt;
                        const isExpanded = expandedChecks.has(check.checkId || check._id);
                        const canSubmit = check.canSubmit !== false && ['Not Started', 'Pending Employee Submission', 'Draft Saved'].includes(check.status);
                        const canEdit = check.canEdit !== false && ['Not Started', 'Pending Employee Submission', 'Draft Saved', 'Additional Information Required'].includes(check.status);
                        const canResubmit = check.canResubmit !== false && ['Additional Information Required', 'Rejected', 'Failed'].includes(check.status);
                        const checkSubject = resolveCheckSubject(check);
                        const checkTitle = resolveCheckTitle(check);

                        return (
                            <div key={check.checkId || check._id} className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)]">
                                <div
                                    className="cursor-pointer"
                                    onClick={() => toggleExpand(check.checkId || check._id)}
                                >
                                    <div className="px-4 py-3.5">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                                                <Icon className="text-base" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="truncate text-[15px] font-semibold text-slate-800">
                                                        {checkTitle}
                                                    </p>
                                                    {check.status && (
                                                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[check.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                                            {['Clear', 'Verified'].includes(check.status) && <FaCheckCircle className="text-[10px]" />}
                                                            {check.status}
                                                        </span>
                                                    )}
                                                    {check.mandatory && (
                                                        <span className="text-[11px] font-medium text-slate-400">Required</span>
                                                    )}
                                                </div>
                                                {checkSubject && (
                                                    <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
                                                        {checkSubject}
                                                    </p>
                                                )}
                                            </div>
                                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                                <FaChevronDown className="text-xs" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="space-y-3 border-t border-slate-100 bg-slate-50/40 p-3 sm:p-4">
                                        {isHRView && (
                                            <MetaFieldGrid>
                                                <MetaField
                                                    icon={FaUser}
                                                    label="Employee"
                                                    value={displayEmployeeName || '—'}
                                                />
                                                <MetaField
                                                    icon={FaIdCard}
                                                    label="Employee ID"
                                                    value={bgvCase.employeeId?.employeeId || bgvCase.employee?.employeeId || '—'}
                                                />
                                                <MetaField
                                                    icon={FaBuilding}
                                                    label="Department"
                                                    value={bgvCase.employeeId?.department || bgvCase.employee?.department || '—'}
                                                />
                                                <MetaField
                                                    icon={FaUserTie}
                                                    label="Designation"
                                                    value={
                                                        bgvCase.employeeId?.designation
                                                        || bgvCase.employee?.designation
                                                        || bgvCase.employeeId?.jobTitle
                                                        || bgvCase.employee?.jobTitle
                                                        || bgvCase.employeeId?.position
                                                        || bgvCase.employee?.position
                                                        || '—'
                                                    }
                                                />
                                                <MetaField
                                                    icon={FaUsers}
                                                    label="Reporting Manager"
                                                    value={bgvCase.employeeId?.manager || bgvCase.employee?.reportingManager || bgvCase.employee?.manager || '—'}
                                                />
                                                <MetaField
                                                    icon={FaClock}
                                                    label="Submitted"
                                                    value={bgvCase.createdAt ? new Date(bgvCase.createdAt).toLocaleDateString() : '—'}
                                                />
                                                <MetaField
                                                    icon={FaHistory}
                                                    label="Last Updated"
                                                    value={bgvCase.updatedAt ? new Date(bgvCase.updatedAt).toLocaleDateString() : '—'}
                                                />
                                                {check.vendor ? (
                                                    <MetaField
                                                        icon={FaUserTie}
                                                        label="Vendor"
                                                        value={check.vendor}
                                                    />
                                                ) : (
                                                    <MetaField
                                                        icon={FaShieldAlt}
                                                        label="Check Status"
                                                        value={check.status || '—'}
                                                    />
                                                )}
                                            </MetaFieldGrid>
                                        )}
                                        <BgvCheckDetail
                                            check={check}
                                            bgvCase={bgvCase}
                                            isHRView={isHRView}
                                            canEdit={canEdit}
                                            canSubmit={canSubmit}
                                            canResubmit={canResubmit}
                                            canVerify={canVerify}
                                            submitting={submitting}
                                            setSubmitting={setSubmitting}
                                            onUpdated={load}
                                            disableDocumentUpload={disableDocumentUpload}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

        </div>
    );
};

const BgvCheckDetail = ({ check, bgvCase, isHRView, canEdit, canSubmit, canResubmit, canVerify, submitting, setSubmitting, onUpdated, disableDocumentUpload = false }) => {
    const [formData, setFormData] = useState({});
    const [uploading, setUploading] = useState(false);
    const [showDocs, setShowDocs] = useState(false);
    const docsSectionRef = React.useRef(null);

    const handleSaveDraft = async () => {
        try {
            setSubmitting(true);
            const endpoint = isHRView
                ? `${ADMIN_LIFECYCLE_ENDPOINT}/bgv/${bgvCase._id}/checks/${check.checkId || check._id}/draft/${check.checkType}`
                : `${BOTH_LIFECYCLE_ENDPOINT}/employee/bgv/${bgvCase._id || bgvCase.bgvCaseId}/checks/${check.checkId || check._id}/draft/${check.checkType}`;
            await axios.post(endpoint, formData, { withCredentials: true });
            toast.success('Draft saved');
            onUpdated();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save draft');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        try {
            setSubmitting(true);
            const endpoint = isHRView 
                ? `${ADMIN_LIFECYCLE_ENDPOINT}/bgv/${bgvCase._id}/checks/${check.checkId || check._id}/verify`
                : `${BOTH_LIFECYCLE_ENDPOINT}/employee/bgv/${bgvCase._id || bgvCase.bgvCaseId}/checks/${check.checkId || check._id}/submit`;
            
            if (isHRView) {
                await axios.post(endpoint, { verified: true, notes: formData.notes || '' }, { withCredentials: true });
                toast.success('Check verified');
            } else {
                await axios.post(endpoint, { notes: formData.notes || '' }, { withCredentials: true });
                toast.success('Submitted for HR review');
            }
            onUpdated();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to submit');
        } finally {
            setSubmitting(false);
        }
    };

    const handleReject = async () => {
        try {
            setSubmitting(true);
            await axios.post(
                `${ADMIN_LIFECYCLE_ENDPOINT}/bgv/${bgvCase._id}/checks/${check.checkId || check._id}/verify`,
                { verified: false, notes: formData.notes || '' },
                { withCredentials: true }
            );
            toast.success('Check rejected');
            onUpdated();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to reject');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRequestInfo = async () => {
        const request = (formData.infoRequest || '').trim();
        if (!request) {
            toast.error('Enter what additional information is needed');
            return;
        }
        try {
            setSubmitting(true);
            await axios.post(
                `${ADMIN_LIFECYCLE_ENDPOINT}/bgv/${bgvCase._id}/checks/${check.checkId || check._id}/request-info`,
                { request },
                { withCredentials: true }
            );
            toast.success('Additional information requested');
            onUpdated();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to request info');
        } finally {
            setSubmitting(false);
        }
    };

    const handleViewDocuments = () => {
        const docs = check.uploadedDocuments || check.documents || [];
        if (!docs.length) {
            toast.info('No documents uploaded for this check yet');
            setShowDocs(true);
            return;
        }
        setShowDocs(true);
        requestAnimationFrame(() => {
            docsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        const firstUrl = docs[0]?.url || docs[0]?.documentUrl;
        if (firstUrl) window.open(firstUrl, '_blank', 'noopener,noreferrer');
    };

    const handleDocumentUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('file', file);
            
            const uploadEndpoint = `${BOTH_DOCUMENT_ENDPOINT}/upload`;
            const { data } = await axios.post(uploadEndpoint, formData, {
                withCredentials: true,
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const docEndpoint = isHRView
                ? `${ADMIN_LIFECYCLE_ENDPOINT}/bgv/${bgvCase._id}/checks/${check.checkId || check._id}/documents`
                : `${BOTH_LIFECYCLE_ENDPOINT}/employee/bgv/${bgvCase._id || bgvCase.bgvCaseId}/checks/${check.checkId || check._id}/upload`;
            
            await axios.post(docEndpoint, {
                documentUrl: data.data.url,
                documentName: file.name,
                documentType: file.type,
            }, { withCredentials: true });

            toast.success('Document uploaded');
            onUpdated();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to upload document');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteDocument = async (docId) => {
        try {
            setSubmitting(true);
            const endpoint = isHRView
                ? `${ADMIN_LIFECYCLE_ENDPOINT}/bgv/${bgvCase._id}/checks/${check.checkId || check._id}/documents/${docId}`
                : `${BOTH_LIFECYCLE_ENDPOINT}/employee/bgv/${bgvCase._id || bgvCase.bgvCaseId}/checks/${check.checkId || check._id}/documents/${docId}`;
            
            await axios.delete(endpoint, { withCredentials: true });
            toast.success('Document deleted');
            onUpdated();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete document');
        } finally {
            setSubmitting(false);
        }
    };

    const requiredDocs = REQUIRED_DOCS[check.checkType] || [];
    const uploadedDocs = check.uploadedDocuments || check.documents || [];

    return (
        <div className={isHRView ? 'cm-dossier-bgv__check-body' : 'space-y-4'}>
            {check.infoRequest && (
                <div className={isHRView ? 'cm-banner cm-banner--attention' : 'rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5'}>
                    <p className={isHRView ? 'flex items-center gap-2' : 'flex items-center gap-2 text-sm font-semibold text-rose-800'}>
                        <FaExclamationTriangle className="text-xs" />
                        Additional Information Required
                    </p>
                    <p className={isHRView ? 'mt-1.5 text-sm' : 'mt-1.5 text-sm text-rose-700'} style={isHRView ? { color: 'var(--cm-tertiary-deep)' } : undefined}>{check.infoRequest.request}</p>
                </div>
            )}

            {check.hrRemarks && (
                <div className={isHRView ? 'cm-dossier-bgv__inset' : 'rounded-xl border border-sky-200 bg-sky-50 px-4 py-3.5'}>
                    <p className={isHRView ? 'cm-label' : 'text-sm font-semibold text-sky-800'} style={isHRView ? { color: 'var(--cm-primary-deep)' } : undefined}>HR Remarks</p>
                    <p className={isHRView ? 'mt-1 text-sm' : 'mt-1.5 text-sm text-sky-700'} style={isHRView ? { color: 'var(--cm-on-variant)' } : undefined}>{check.hrRemarks}</p>
                </div>
            )}

            {check.checkType === 'employment' && canEdit && (
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h4 className="mb-4 text-sm font-semibold text-slate-800">Employment Details</h4>
                    <EmploymentForm formData={formData} setFormData={setFormData} verificationData={check.verificationData} />
                </div>
            )}

            {check.checkType === 'education' && canEdit && (
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h4 className="mb-4 text-sm font-semibold text-slate-800">Education Details</h4>
                    <EducationForm formData={formData} setFormData={setFormData} verificationData={check.verificationData} />
                </div>
            )}

            {check.checkType === 'address' && canEdit && (
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h4 className="mb-4 text-sm font-semibold text-slate-800">Address Details</h4>
                    <AddressForm formData={formData} setFormData={setFormData} verificationData={check.verificationData} />
                </div>
            )}

            {check.checkType === 'reference' && canEdit && (
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h4 className="mb-4 text-sm font-semibold text-slate-800">Reference Details</h4>
                    <ReferenceForm 
                        formData={formData} 
                        setFormData={setFormData} 
                        references={check.references || []}
                        bgvCase={bgvCase}
                        check={check}
                        onUpdated={onUpdated}
                    />
                </div>
            )}

            {check.checkType === 'criminal' && canEdit && (
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h4 className="mb-4 text-sm font-semibold text-slate-800">Criminal Declaration</h4>
                    <CriminalForm formData={formData} setFormData={setFormData} check={check} />
                </div>
            )}

            {requiredDocs.length > 0 && ((canEdit && !disableDocumentUpload) || isHRView) && (
                <div className={isHRView ? 'overflow-hidden rounded-lg border border-slate-200/90 bg-white' : 'overflow-hidden rounded-xl border border-slate-200 bg-white'}>
                    <h4 className={isHRView ? 'cm-label border-b border-slate-100 px-2.5 py-1.5 mb-0' : 'border-b border-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-800'}>Required Documents</h4>
                    <div className="divide-y divide-slate-100">
                        {requiredDocs.map((doc) => {
                            const uploaded = uploadedDocs.find(d => d.name === doc.name || d.documentName === doc.name);
                            return (
                                <div key={doc.name} className={`flex items-center justify-between gap-3 ${isHRView ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
                                    <div className="flex min-w-0 items-center gap-2">
                                        <FaFileAlt className="shrink-0 text-xs text-slate-400" />
                                        <div className="min-w-0">
                                            <span className={`font-medium text-slate-700 ${isHRView ? 'text-xs' : 'text-sm'}`}>{doc.name}</span>
                                            {doc.required && <span className="ml-1.5 text-[11px] font-semibold text-rose-500">Required</span>}
                                        </div>
                                    </div>
                                    {uploaded ? (
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                                <FaCheck className="text-[10px]" />
                                                Uploaded
                                            </span>
                                            {canEdit && (
                                            <button
                                                onClick={() => handleDeleteDocument(uploaded._id || uploaded.documentId)}
                                                disabled={submitting}
                                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-50"
                                            >
                                                <FaTrash className="text-sm" />
                                            </button>
                                            )}
                                        </div>
                                    ) : canEdit ? (
                                        <label className="cursor-pointer">
                                            <input
                                                type="file"
                                                onChange={handleDocumentUpload}
                                                disabled={uploading || submitting}
                                                className="hidden"
                                            />
                                            <span className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-100">
                                                <FaUpload className="text-xs" />
                                                Upload
                                            </span>
                                        </label>
                                    ) : (
                                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                            Pending
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {(uploadedDocs.length > 0 || showDocs) && (
                <div ref={docsSectionRef} className={isHRView ? 'cm-dossier-bgv__inset' : 'rounded-xl border border-slate-200 bg-white p-5'}>
                    <h4 className={isHRView ? 'cm-label mb-2' : 'mb-4 text-sm font-semibold text-slate-800'}>Uploaded Documents</h4>
                    {uploadedDocs.length === 0 ? (
                        <p className={isHRView ? 'text-xs' : 'text-sm text-slate-500'} style={isHRView ? { color: 'var(--cm-muted)' } : undefined}>No documents uploaded for this check yet.</p>
                    ) : (
                        <div className={isHRView ? 'space-y-1.5' : 'space-y-2.5'}>
                            {uploadedDocs.map((doc) => (
                                <div key={doc._id || doc.documentId} className={isHRView ? 'flex items-center justify-between rounded-lg px-2.5 py-1.5' : 'flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-3'} style={isHRView ? { background: 'var(--cm-surface)' } : undefined}>
                                    <div className="flex items-center gap-2.5">
                                        <div className={isHRView ? 'flex h-7 w-7 items-center justify-center rounded-md' : 'flex h-9 w-9 items-center justify-center rounded-lg bg-white text-emerald-600 ring-1 ring-emerald-100'} style={isHRView ? { background: 'rgba(28,202,155,0.12)', color: 'var(--cm-primary-deep)' } : undefined}>
                                            <FaFileAlt className="text-sm" />
                                        </div>
                                        <div>
                                            <span className={isHRView ? 'text-xs font-medium' : 'text-sm font-medium text-slate-700'} style={isHRView ? { color: 'var(--cm-on-surface)' } : undefined}>{doc.name || doc.documentName}</span>
                                            {doc.version && <span className={isHRView ? 'ml-2 text-[10px]' : 'ml-2 text-xs text-slate-400'} style={isHRView ? { color: 'var(--cm-muted)' } : undefined}>v{doc.version}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <a href={doc.url || doc.documentUrl} target="_blank" rel="noopener noreferrer" className={isHRView ? 'cm-icon-btn' : 'flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 transition-colors hover:bg-sky-100'}>
                                            <FaEye className="text-sm" />
                                        </a>
                                        <a href={doc.url || doc.documentUrl} download className={isHRView ? 'cm-icon-btn' : 'flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200'}>
                                            <FaDownload className="text-sm" />
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {check.timeline && check.timeline.length > 0 && (
                <div className={isHRView ? 'cm-dossier-bgv__inset' : 'rounded-xl border border-slate-200 bg-white p-5'}>
                    <h4 className={isHRView ? 'cm-label mb-2' : 'mb-4 text-sm font-semibold text-slate-800'}>Timeline</h4>
                    <div className={isHRView ? 'space-y-1.5' : 'space-y-2'}>
                        {check.timeline.map((event, idx) => (
                            <div key={idx} className={isHRView ? 'flex items-center gap-2.5 text-xs' : 'flex items-center gap-3 text-sm text-slate-600'} style={isHRView ? { color: 'var(--cm-on-variant)' } : undefined}>
                                <div className={isHRView ? 'flex h-6 w-6 items-center justify-center rounded-md' : 'flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500'} style={isHRView ? { background: 'var(--cm-surface)', color: 'var(--cm-muted)' } : undefined}>
                                    <FaClock className="text-xs" />
                                </div>
                                <div className="flex-1">
                                    <span className="font-medium">{event.action || event.milestone}</span>
                                    {event.timestamp && (
                                        <span className={isHRView ? 'ml-2 text-[10px]' : 'ml-2 text-xs text-slate-400'} style={isHRView ? { color: 'var(--cm-muted)' } : undefined}>
                                            {new Date(event.timestamp).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className={isHRView ? 'cm-dossier-bgv__check-actions' : 'border-t border-slate-200 pt-4'}>
                {canEdit && (
                    <div className="flex flex-wrap gap-2.5">
                        <button
                            onClick={handleSaveDraft}
                            disabled={submitting}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                        >
                            Save Draft
                        </button>
                        {(canSubmit || canResubmit) && (
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 disabled:opacity-50"
                            >
                                {canResubmit ? 'Resubmit' : 'Submit'}
                            </button>
                        )}
                    </div>
                )}
                {canVerify && !isHRView && (
                    <div className="space-y-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">HR notes / info request</label>
                            <textarea
                                value={formData.notes || formData.infoRequest || ''}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value, infoRequest: e.target.value })}
                                rows={2}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                                placeholder="Add remarks or describe additional information needed…"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                title="Verify"
                                aria-label="Verify"
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
                            >
                                <FaCheck className="text-sm" />
                            </button>
                            <button
                                type="button"
                                title="Reject"
                                aria-label="Reject"
                                onClick={handleReject}
                                disabled={submitting}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-50"
                            >
                                <FaTimes className="text-sm" />
                            </button>
                            <button
                                type="button"
                                title="View Documents"
                                aria-label="View Documents"
                                onClick={handleViewDocuments}
                                disabled={submitting}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                            >
                                <FaEye className="text-sm" />
                            </button>
                            <button
                                type="button"
                                title="Request Information"
                                aria-label="Request Information"
                                onClick={handleRequestInfo}
                                disabled={submitting}
                                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50"
                            >
                                Request Info
                            </button>
                        </div>
                    </div>
                )}
                {canVerify && isHRView && (
                    <div className="cm-dossier-bgv__verify">
                        <div>
                            <label className="cm-label mb-1 block">HR notes / info request</label>
                            <textarea
                                value={formData.notes || formData.infoRequest || ''}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value, infoRequest: e.target.value })}
                                rows={2}
                                className="cm-input cm-dossier-bgv__notes w-full"
                                placeholder="Add remarks or describe additional information needed…"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <CmButton
                                variant="primary"
                                size="icon"
                                title="Verify"
                                aria-label="Verify"
                                onClick={handleSubmit}
                                disabled={submitting}
                            >
                                <FaCheck className="text-sm" />
                            </CmButton>
                            <CmButton
                                variant="outline"
                                size="icon"
                                title="Reject"
                                aria-label="Reject"
                                onClick={handleReject}
                                disabled={submitting}
                                style={{ color: 'var(--cm-error)', borderColor: 'rgba(186,26,26,0.35)' }}
                            >
                                <FaTimes className="text-sm" />
                            </CmButton>
                            <CmButton
                                variant="outline"
                                size="icon"
                                title="View Documents"
                                aria-label="View Documents"
                                onClick={handleViewDocuments}
                                disabled={submitting}
                            >
                                <FaEye className="text-sm" />
                            </CmButton>
                            <CmButton
                                variant="secondary"
                                size="sm"
                                title="Request Information"
                                aria-label="Request Information"
                                onClick={handleRequestInfo}
                                disabled={submitting}
                                style={{ color: 'var(--cm-tertiary-deep)' }}
                            >
                                Request Info
                            </CmButton>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const EmploymentForm = ({ formData, setFormData, verificationData }) => {
    const data = verificationData || {};
    
    useEffect(() => {
        setFormData({
            previousCompany: data.previousCompany || '',
            designation: data.designation || '',
            employeeId: data.employeeId || '',
            joiningDate: data.joiningDate || '',
            relievingDate: data.relievingDate || '',
            hrContact: data.hrContact || '',
            managerName: data.managerName || '',
            salary: data.salary || '',
            reasonForLeaving: data.reasonForLeaving || '',
        });
    }, [verificationData, setFormData]);

    return (
        <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Previous Company</label>
                <input
                    type="text"
                    value={formData.previousCompany || ''}
                    onChange={(e) => setFormData({ ...formData, previousCompany: e.target.value })}
                    className="w-full text-sm border rounded px-2 py-1.5"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Designation</label>
                <input
                    type="text"
                    value={formData.designation || ''}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full text-sm border rounded px-2 py-1.5"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Employee ID (Optional)</label>
                <input
                    type="text"
                    value={formData.employeeId || ''}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    className="w-full text-sm border rounded px-2 py-1.5"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Joining Date</label>
                <input
                    type="date"
                    value={formData.joiningDate || ''}
                    onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                    className="w-full text-sm border rounded px-2 py-1.5"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Relieving Date</label>
                <input
                    type="date"
                    value={formData.relievingDate || ''}
                    onChange={(e) => setFormData({ ...formData, relievingDate: e.target.value })}
                    className="w-full text-sm border rounded px-2 py-1.5"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">HR Contact</label>
                <input
                    type="text"
                    value={formData.hrContact || ''}
                    onChange={(e) => setFormData({ ...formData, hrContact: e.target.value })}
                    className="w-full text-sm border rounded px-2 py-1.5"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Manager Name</label>
                <input
                    type="text"
                    value={formData.managerName || ''}
                    onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                    className="w-full text-sm border rounded px-2 py-1.5"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Salary (Optional)</label>
                <input
                    type="text"
                    value={formData.salary || ''}
                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                    className="w-full text-sm border rounded px-2 py-1.5"
                />
            </div>
            <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Reason for Leaving</label>
                <textarea
                    value={formData.reasonForLeaving || ''}
                    onChange={(e) => setFormData({ ...formData, reasonForLeaving: e.target.value })}
                    className="w-full text-sm border rounded px-2 py-1.5"
                    rows={2}
                />
            </div>
        </div>
    );
};

const EducationForm = ({ formData, setFormData, verificationData }) => {
    const [records, setRecords] = useState(verificationData?.educationRecords || []);

    const addRecord = () => {
        setRecords([...records, { institute: '', degree: '', branch: '', passingYear: '', percentage: '' }]);
    };

    const removeRecord = (index) => {
        setRecords(records.filter((_, i) => i !== index));
    };

    const updateRecord = (index, field, value) => {
        const updated = [...records];
        updated[index][field] = value;
        setRecords(updated);
    };

    useEffect(() => {
        setFormData({ educationRecords: records });
    }, [records, setFormData]);

    return (
        <div className="space-y-3">
            {records.map((record, index) => (
                <div key={index} className="p-3 border rounded bg-white relative">
                    <button
                        onClick={() => removeRecord(index)}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                    >
                        <FaTimes />
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Institute/University</label>
                            <input
                                type="text"
                                value={record.institute || ''}
                                onChange={(e) => updateRecord(index, 'institute', e.target.value)}
                                className="w-full text-sm border rounded px-2 py-1.5"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Degree</label>
                            <input
                                type="text"
                                value={record.degree || ''}
                                onChange={(e) => updateRecord(index, 'degree', e.target.value)}
                                className="w-full text-sm border rounded px-2 py-1.5"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Branch/Specialization</label>
                            <input
                                type="text"
                                value={record.branch || ''}
                                onChange={(e) => updateRecord(index, 'branch', e.target.value)}
                                className="w-full text-sm border rounded px-2 py-1.5"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Passing Year</label>
                            <input
                                type="number"
                                value={record.passingYear || ''}
                                onChange={(e) => updateRecord(index, 'passingYear', e.target.value)}
                                className="w-full text-sm border rounded px-2 py-1.5"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Percentage/CGPA</label>
                            <input
                                type="text"
                                value={record.percentage || ''}
                                onChange={(e) => updateRecord(index, 'percentage', e.target.value)}
                                className="w-full text-sm border rounded px-2 py-1.5"
                            />
                        </div>
                    </div>
                </div>
            ))}
            <button
                onClick={addRecord}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
                <FaPlus /> Add Education Record
            </button>
        </div>
    );
};

const AddressForm = ({ formData, setFormData, verificationData }) => {
    const data = verificationData || {};
    
    useEffect(() => {
        setFormData({
            currentAddress: data.currentAddress || {},
            permanentAddress: data.permanentAddress || {},
        });
    }, [verificationData, setFormData]);

    const updateAddress = (type, field, value) => {
        setFormData({
            ...formData,
            [type]: {
                ...formData[type],
                [field]: value,
            },
        });
    };

    return (
        <div className="space-y-4">
            <div>
                <p className="text-sm font-medium mb-2">Current Address</p>
                <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Line 1</label>
                        <input
                            type="text"
                            value={formData.currentAddress?.line1 || ''}
                            onChange={(e) => updateAddress('currentAddress', 'line1', e.target.value)}
                            className="w-full text-sm border rounded px-2 py-1.5"
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Line 2</label>
                        <input
                            type="text"
                            value={formData.currentAddress?.line2 || ''}
                            onChange={(e) => updateAddress('currentAddress', 'line2', e.target.value)}
                            className="w-full text-sm border rounded px-2 py-1.5"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
                        <input
                            type="text"
                            value={formData.currentAddress?.city || ''}
                            onChange={(e) => updateAddress('currentAddress', 'city', e.target.value)}
                            className="w-full text-sm border rounded px-2 py-1.5"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
                        <input
                            type="text"
                            value={formData.currentAddress?.state || ''}
                            onChange={(e) => updateAddress('currentAddress', 'state', e.target.value)}
                            className="w-full text-sm border rounded px-2 py-1.5"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Pincode</label>
                        <input
                            type="text"
                            value={formData.currentAddress?.pincode || ''}
                            onChange={(e) => updateAddress('currentAddress', 'pincode', e.target.value)}
                            className="w-full text-sm border rounded px-2 py-1.5"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Country</label>
                        <input
                            type="text"
                            value={formData.currentAddress?.country || ''}
                            onChange={(e) => updateAddress('currentAddress', 'country', e.target.value)}
                            className="w-full text-sm border rounded px-2 py-1.5"
                        />
                    </div>
                </div>
            </div>
            <div>
                <p className="text-sm font-medium mb-2">Permanent Address</p>
                <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Line 1</label>
                        <input
                            type="text"
                            value={formData.permanentAddress?.line1 || ''}
                            onChange={(e) => updateAddress('permanentAddress', 'line1', e.target.value)}
                            className="w-full text-sm border rounded px-2 py-1.5"
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Line 2</label>
                        <input
                            type="text"
                            value={formData.permanentAddress?.line2 || ''}
                            onChange={(e) => updateAddress('permanentAddress', 'line2', e.target.value)}
                            className="w-full text-sm border rounded px-2 py-1.5"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
                        <input
                            type="text"
                            value={formData.permanentAddress?.city || ''}
                            onChange={(e) => updateAddress('permanentAddress', 'city', e.target.value)}
                            className="w-full text-sm border rounded px-2 py-1.5"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
                        <input
                            type="text"
                            value={formData.permanentAddress?.state || ''}
                            onChange={(e) => updateAddress('permanentAddress', 'state', e.target.value)}
                            className="w-full text-sm border rounded px-2 py-1.5"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Pincode</label>
                        <input
                            type="text"
                            value={formData.permanentAddress?.pincode || ''}
                            onChange={(e) => updateAddress('permanentAddress', 'pincode', e.target.value)}
                            className="w-full text-sm border rounded px-2 py-1.5"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Country</label>
                        <input
                            type="text"
                            value={formData.permanentAddress?.country || ''}
                            onChange={(e) => updateAddress('permanentAddress', 'country', e.target.value)}
                            className="w-full text-sm border rounded px-2 py-1.5"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

const ReferenceForm = ({ formData, setFormData, references, bgvCase, check, onUpdated }) => {
    const [localRefs, setLocalRefs] = useState(references || []);
    const [submitting, setSubmitting] = useState(false);

    const addReference = async () => {
        try {
            setSubmitting(true);
            await axios.post(
                `${BOTH_LIFECYCLE_ENDPOINT}/employee/bgv/${bgvCase._id || bgvCase.bgvCaseId}/checks/${check.checkId || check._id}/references`,
                {
                    name: '',
                    company: '',
                    designation: '',
                    relationship: '',
                    phone: '',
                    email: '',
                },
                { withCredentials: true }
            );
            toast.success('Reference added');
            onUpdated();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add reference');
        } finally {
            setSubmitting(false);
        }
    };

    const updateReference = async (refId, data) => {
        try {
            setSubmitting(true);
            await axios.put(
                `${BOTH_LIFECYCLE_ENDPOINT}/employee/bgv/${bgvCase._id || bgvCase.bgvCaseId}/checks/${check.checkId || check._id}/references/${refId}`,
                data,
                { withCredentials: true }
            );
            toast.success('Reference updated');
            onUpdated();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update reference');
        } finally {
            setSubmitting(false);
        }
    };

    const deleteReference = async (refId) => {
        try {
            setSubmitting(true);
            await axios.delete(
                `${BOTH_LIFECYCLE_ENDPOINT}/employee/bgv/${bgvCase._id || bgvCase.bgvCaseId}/checks/${check.checkId || check._id}/references/${refId}`,
                { withCredentials: true }
            );
            toast.success('Reference deleted');
            onUpdated();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete reference');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-3">
            {localRefs.map((ref) => (
                <div key={ref._id} className="p-3 border rounded bg-white relative">
                    <button
                        onClick={() => deleteReference(ref._id)}
                        disabled={submitting}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                    >
                        <FaTimes />
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                            <input
                                type="text"
                                value={ref.name || ''}
                                onChange={(e) => updateReference(ref._id, { ...ref, name: e.target.value })}
                                disabled={submitting}
                                className="w-full text-sm border rounded px-2 py-1.5"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
                            <input
                                type="text"
                                value={ref.company || ''}
                                onChange={(e) => updateReference(ref._id, { ...ref, company: e.target.value })}
                                disabled={submitting}
                                className="w-full text-sm border rounded px-2 py-1.5"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Designation</label>
                            <input
                                type="text"
                                value={ref.designation || ''}
                                onChange={(e) => updateReference(ref._id, { ...ref, designation: e.target.value })}
                                disabled={submitting}
                                className="w-full text-sm border rounded px-2 py-1.5"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Relationship</label>
                            <input
                                type="text"
                                value={ref.relationship || ''}
                                onChange={(e) => updateReference(ref._id, { ...ref, relationship: e.target.value })}
                                disabled={submitting}
                                className="w-full text-sm border rounded px-2 py-1.5"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                            <input
                                type="text"
                                value={ref.phone || ''}
                                onChange={(e) => updateReference(ref._id, { ...ref, phone: e.target.value })}
                                disabled={submitting}
                                className="w-full text-sm border rounded px-2 py-1.5"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                            <input
                                type="email"
                                value={ref.email || ''}
                                onChange={(e) => updateReference(ref._id, { ...ref, email: e.target.value })}
                                disabled={submitting}
                                className="w-full text-sm border rounded px-2 py-1.5"
                            />
                        </div>
                    </div>
                </div>
            ))}
            <button
                onClick={addReference}
                disabled={submitting}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
                <FaPlus /> Add Reference
            </button>
        </div>
    );
};

const CriminalForm = ({ formData, setFormData, check }) => {
    const [accepted, setAccepted] = useState(check.declarationAccepted || false);

    const handleAccept = async () => {
        try {
            await axios.post(
                `${BOTH_LIFECYCLE_ENDPOINT}/employee/bgv/${bgvCase._id || bgvCase.bgvCaseId}/checks/${check.checkId || check._id}/declaration`,
                { accepted: !accepted },
                { withCredentials: true }
            );
            setAccepted(!accepted);
            toast.success(accepted ? 'Declaration declined' : 'Declaration accepted');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update declaration');
        }
    };

    return (
        <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm font-medium text-amber-800 mb-2">Criminal Verification Declaration</p>
                <p className="text-xs text-amber-700 mb-3">
                    I hereby declare that I have no criminal record and authorize the company to conduct background verification.
                </p>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={accepted}
                        onChange={handleAccept}
                        className="w-4 h-4"
                    />
                    <span className="text-sm text-amber-800">I accept this declaration</span>
                </label>
            </div>
        </div>
    );
};

export default OnboardingBgvPanel;
