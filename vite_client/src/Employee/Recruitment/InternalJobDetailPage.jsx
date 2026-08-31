import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
    FaArrowLeft, FaMapMarkerAlt, FaUserPlus, FaClock,
    FaCheck, FaMoneyBillWave, FaArrowRight, FaCode,
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { fileToAttachment } from '../../utils/recruitmentFileUpload';
import CoverLetterUploadField from '../../components/recruitment/CoverLetterUploadField';
import { AtsPage, AtsBadge, CmButton } from '../../components/recruitment/atsUi';
import { formatJobPostedLabel } from '../../utils/jobPostedDate';

const fieldClass = 'cm-input w-full';

const formatSalary = (range) => {
    if (!range || (range.min == null && range.max == null)) return null;
    const currency = range.currency || 'USD';
    const fmt = (n) => {
        if (n == null) return null;
        if (n >= 1000) return `${Math.round(n / 1000)}k`;
        return String(n);
    };
    const min = fmt(range.min);
    const max = fmt(range.max);
    if (min && max) return `$${min} - $${max} ${currency}`;
    if (min) return `From $${min} ${currency}`;
    if (max) return `Up to $${max} ${currency}`;
    return null;
};

const CheckList = ({ items }) => (
    <ul className="ats-check-list mt-3">
        {(items || []).map((item, idx) => (
            <li key={`${idx}-${String(item).slice(0, 24)}`}>{item}</li>
        ))}
    </ul>
);

const applicationStatusDisplay = (status = '') => {
    const s = String(status || '').trim();
    if (!s || /^applied$/i.test(s)) return 'Application Submitted';
    return s;
};

const InternalJobDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [mode, setMode] = useState('apply');
    const [showApplyForm, setShowApplyForm] = useState(false);
    const [myApplication, setMyApplication] = useState(null);
    const [referForm, setReferForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
    const [coverLetterFile, setCoverLetterFile] = useState(null);
    const [referCoverLetterFile, setReferCoverLetterFile] = useState(null);
    const [resumeFile, setResumeFile] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [{ data: jobRes }, appsRes] = await Promise.all([
                    axios.get(`/v1/both/recruitment/internal-jobs/${id}`, { withCredentials: true }),
                    axios.get('/v1/both/recruitment/my-applications', { withCredentials: true }).catch(() => ({ data: {} })),
                ]);
                if (cancelled) return;
                setJob(jobRes.data);
                const apps = appsRes.data?.data || [];
                const mine = apps.find((a) => {
                    const jobRef = a.jobPostingId?._id || a.jobPostingId;
                    return String(jobRef) === String(id);
                });
                setMyApplication(mine || null);
            } catch {
                if (!cancelled) {
                    toast.error('Job not found');
                    navigate('/employee/internal-jobs');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [id, navigate]);

    const apply = async () => {
        if (myApplication) {
            openMyApplication();
            return;
        }
        try {
            setBusy(true);
            const coverLetterAttachment = coverLetterFile ? await fileToAttachment(coverLetterFile) : undefined;
            const resumeAtt = resumeFile ? await fileToAttachment(resumeFile) : undefined;
            const { data } = await axios.post(
                `/v1/both/recruitment/internal-jobs/${id}/apply`,
                {
                    coverLetterAttachment,
                    coverLetter: coverLetterAttachment ? `Uploaded: ${coverLetterAttachment.fileName}` : undefined,
                    resume: resumeAtt
                        ? { url: resumeAtt.url, fileName: resumeAtt.fileName, uploadedAt: new Date().toISOString() }
                        : undefined,
                },
                { withCredentials: true }
            );
            const linked = data?.alreadyApplied;
            toast.success(data?.message || (linked ? 'Already applied — shown in My Applications' : 'Application submitted'));
            setMyApplication(data?.data || { status: 'Applied', jobPostingId: { _id: id } });
            setCoverLetterFile(null);
            setResumeFile(null);
            setShowApplyForm(false);
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Apply failed';
            toast.error(msg);
            if (err.response?.status === 409) {
                setMyApplication((prev) => prev || { status: 'Applied', jobPostingId: { _id: id } });
            }
        } finally {
            setBusy(false);
        }
    };

    const openMyApplication = () => {
        const token = myApplication?.selfServiceToken;
        if (token) {
            window.open(`/application/${token}`, '_blank', 'noopener,noreferrer');
            return;
        }
        const appId = myApplication?._id;
        navigate(appId
            ? `/employee/internal-jobs?tab=applications&highlight=${appId}`
            : '/employee/internal-jobs?tab=applications');
    };

    const openApplyForm = () => {
        setMode('apply');
        setShowApplyForm(true);
        // Scroll after paint so the form is in the DOM
        requestAnimationFrame(() => {
            document.getElementById('internal-apply-form')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    };

    const refer = async (e) => {
        e.preventDefault();
        try {
            setBusy(true);
            const coverLetterAttachment = referCoverLetterFile ? await fileToAttachment(referCoverLetterFile) : undefined;
            await axios.post(
                `/v1/both/recruitment/internal-jobs/${id}/refer`,
                {
                    ...referForm,
                    coverLetterAttachment,
                    coverLetter: coverLetterAttachment ? `Uploaded: ${coverLetterAttachment.fileName}` : undefined,
                },
                { withCredentials: true }
            );
            toast.success('Referral submitted — invite emailed to candidate');
            setReferForm({ firstName: '', lastName: '', email: '', phone: '' });
            setReferCoverLetterFile(null);
            setMode('apply');
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Referral failed');
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <AtsPage>
                <LoadingSpinner message="Loading job…" />
            </AtsPage>
        );
    }
    if (!job) return null;

    const responsibilities = Array.isArray(job.responsibilities) ? job.responsibilities.filter(Boolean) : [];
    const requirements = Array.isArray(job.requirements) ? job.requirements.filter(Boolean) : [];
    const salaryLabel = formatSalary(job.salaryRange);
    const postedLabel = formatJobPostedLabel(job);
    const alreadyApplied = !!myApplication;
    const statusLabel = alreadyApplied
        ? applicationStatusDisplay(myApplication.status)
        : 'Ready to apply';

    return (
        <AtsPage>
            <div className="flex items-start gap-3">
                <button
                    type="button"
                    className="ats-back !mb-0 mt-1.5"
                    onClick={() => navigate('/employee/internal-jobs')}
                    aria-label="Back to openings"
                >
                    <FaArrowLeft className="h-4 w-4" />
                </button>
                <h1 className="m-0 text-2xl font-bold leading-tight text-gray-800 sm:text-3xl">{job.jobTitle}</h1>
            </div>

            <div className="ats-detail-layout">
                <div className="space-y-4 min-w-0">
                    <div className="cm-card">
                        <div className="mb-4 flex flex-wrap gap-2">
                            {job.status === 'Open' && (
                                <span className="ats-chip ats-chip--primary">Actively Hiring</span>
                            )}
                            <span className="ats-chip ats-chip--neutral">{job.employmentType || 'Full-time'}</span>
                            {job.position && <span className="ats-chip ats-chip--neutral">{job.position}</span>}
                        </div>
                        <h2 className="cm-title-sm m-0">About the Role</h2>
                        <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'rgba(15,45,38,0.75)' }}>
                            {job.jobDescription}
                        </div>
                    </div>

                    {responsibilities.length > 0 && (
                        <div className="cm-card">
                            <h2 className="cm-title-sm m-0">Key Responsibilities</h2>
                            <CheckList items={responsibilities} />
                        </div>
                    )}

                    {requirements.length > 0 && (
                        <div className="cm-card">
                            <h2 className="cm-title-sm m-0">Requirements</h2>
                            <CheckList items={requirements} />
                        </div>
                    )}
                </div>

                <div className="cm-card ats-side-panel h-fit lg:sticky lg:top-4">
                    <div className="flex items-center gap-3">
                        <div
                            className="flex h-10 w-10 items-center justify-center rounded-xl"
                            style={{ background: 'rgba(28,202,155,0.15)', color: '#006c51' }}
                        >
                            <FaCode className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="m-0 font-bold" style={{ color: 'var(--ats-secondary)' }}>{job.department}</p>
                            <p className="m-0 text-xs" style={{ color: 'rgba(15,45,38,0.45)' }}>Department</p>
                        </div>
                    </div>

                    <div className="space-y-2 border-t border-[rgba(15,45,38,0.08)] pt-3">
                        <div className="ats-meta-row">
                            <FaMapMarkerAlt />
                            <span>{job.location || '—'}</span>
                        </div>
                        {salaryLabel && (
                            <div className="ats-meta-row">
                                <FaMoneyBillWave />
                                <span>{salaryLabel}</span>
                            </div>
                        )}
                        {postedLabel && (
                            <div className="ats-meta-row">
                                <FaClock />
                                <span>{postedLabel}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 border-t border-[rgba(15,45,38,0.08)] pt-3">
                        {alreadyApplied ? (
                            <CmButton className="w-full" onClick={openMyApplication}>
                                View My Application <FaArrowRight className="h-3 w-3" />
                            </CmButton>
                        ) : (
                            <CmButton
                                className="w-full"
                                disabled={busy}
                                onClick={openApplyForm}
                            >
                                Apply Now <FaArrowRight className="h-3 w-3" />
                            </CmButton>
                        )}
                        <CmButton
                            type="button"
                            variant="outline"
                            className="w-full"
                            disabled={busy}
                            onClick={() => {
                                setShowApplyForm(false);
                                setMode('refer');
                            }}
                        >
                            <FaUserPlus className="h-3.5 w-3.5" /> Refer Someone
                        </CmButton>
                    </div>

                    {mode === 'apply' && showApplyForm && !alreadyApplied && (
                        <div id="internal-apply-form" className="space-y-3 border-t border-[rgba(15,45,38,0.08)] pt-3">
                            <p className="m-0 text-sm font-semibold" style={{ color: 'var(--ats-secondary)' }}>
                                Application form
                            </p>
                            <p className="m-0 text-xs" style={{ color: 'rgba(15,45,38,0.55)' }}>
                                Fill in the details below, then submit. Resume and cover letter are optional.
                            </p>
                            <CoverLetterUploadField
                                file={resumeFile}
                                onChange={setResumeFile}
                                label="Resume"
                            />
                            <CoverLetterUploadField
                                file={coverLetterFile}
                                onChange={setCoverLetterFile}
                            />
                            <CmButton disabled={busy} onClick={apply} className="w-full">
                                {busy ? 'Submitting…' : 'Submit Application'}
                            </CmButton>
                            <button
                                type="button"
                                className="ats-link w-full text-center text-sm"
                                onClick={() => setShowApplyForm(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    {mode === 'refer' && (
                        <form onSubmit={refer} className="space-y-3 border-t border-[rgba(15,45,38,0.08)] pt-3">
                            <div
                                className="rounded-lg px-3 py-2.5 text-xs"
                                style={{ background: 'rgba(255,127,80,0.12)', color: '#7f2700' }}
                            >
                                Referral bonus stays <strong>Pending</strong> until HR applies hire / probation rules.
                            </div>
                            <div className="grid gap-2.5">
                                <label className="block">
                                    <span className="ats-form-label">First name *</span>
                                    <input required className={fieldClass} value={referForm.firstName} onChange={(e) => setReferForm((p) => ({ ...p, firstName: e.target.value }))} />
                                </label>
                                <label className="block">
                                    <span className="ats-form-label">Last name</span>
                                    <input className={fieldClass} value={referForm.lastName} onChange={(e) => setReferForm((p) => ({ ...p, lastName: e.target.value }))} />
                                </label>
                                <label className="block">
                                    <span className="ats-form-label">Email *</span>
                                    <input required type="email" className={fieldClass} value={referForm.email} onChange={(e) => setReferForm((p) => ({ ...p, email: e.target.value }))} />
                                </label>
                                <label className="block">
                                    <span className="ats-form-label">Phone</span>
                                    <input className={fieldClass} value={referForm.phone} onChange={(e) => setReferForm((p) => ({ ...p, phone: e.target.value }))} />
                                </label>
                            </div>
                            <CoverLetterUploadField
                                file={referCoverLetterFile}
                                onChange={setReferCoverLetterFile}
                                label="Cover letter / referral note"
                            />
                            <CmButton type="submit" disabled={busy} className="w-full">
                                {busy ? 'Submitting…' : 'Submit Referral'}
                            </CmButton>
                        </form>
                    )}

                    <div className="border-t border-[rgba(15,45,38,0.08)] pt-3 text-center">
                        <p className="cm-label mb-2">Status</p>
                        <AtsBadge tone={alreadyApplied ? 'success' : 'neutral'} className="!max-w-none">
                            {alreadyApplied && <FaCheck className="h-3 w-3" />}
                            {statusLabel}
                        </AtsBadge>
                    </div>
                </div>
            </div>
        </AtsPage>
    );
};

export default InternalJobDetailPage;
