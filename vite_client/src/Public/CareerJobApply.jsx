import useCanonicalCareerUrl from '../Hooks/useCanonicalCareerUrl';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    FaArrowLeft,
    FaBriefcase,
    FaMapMarkerAlt,
    FaClock,
    FaCheckCircle,
} from 'react-icons/fa';
import { format } from 'date-fns';
import axios from '../utils/axios';
import { fileToAttachment } from '../utils/recruitmentFileUpload';
import CoverLetterUploadField from '../components/recruitment/CoverLetterUploadField';
import { CmButton } from '../components/recruitment/atsUi';
import LoadingSpinner from '../components/LoadingSpinner';
import { getJobPostedDate } from '../utils/jobPostedDate';
import { isHrmsAuthenticatedUser } from '../utils/authSessionUtils';
import '../styles/careerJobApply.css';

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
    if (min && max) return `${currency} ${min} – ${max}`;
    if (min) return `From ${currency} ${min}`;
    if (max) return `Up to ${currency} ${max}`;
    return null;
};

const formatClosingLabel = (closingDate) => {
    if (!closingDate) return null;
    const d = new Date(closingDate);
    if (Number.isNaN(d.getTime())) return null;
    return `Closes ${format(d, 'MMM d, yyyy')}`;
};

const asItems = (value) => {
    if (Array.isArray(value)) {
        return value.map((item) => String(item || '').trim()).filter(Boolean);
    }
    const text = String(value || '').trim();
    if (!text) return [];
    if (text.includes('\n')) {
        return text.split('\n').map((item) => item.trim()).filter(Boolean);
    }
    return [text];
};

function DetailSection({ title, children }) {
    if (!children) return null;
    return (
        <section className="ats-apply-page__about-card">
            <h2 className="ats-apply-page__about-title">{title}</h2>
            <div className="ats-apply-page__about-body">{children}</div>
        </section>
    );
}

function ListOrProse({ items }) {
    if (!items.length) return null;
    if (items.length === 1) {
        return <div className="ats-public-prose">{items[0]}</div>;
    }
    return (
        <ul className="ats-check-list">
            {items.map((item, idx) => (
                <li key={`${idx}-${item.slice(0, 24)}`}>{item}</li>
            ))}
        </ul>
    );
}

function RoleSummaryRow({ label, value, wide = false }) {
    if (!value) return null;
    return (
        <div className={`ats-apply-page__role-row${wide ? ' ats-apply-page__role-row--wide' : ''}`}>
            <dt>{label}</dt>
            <dd>{value}</dd>
        </div>
    );
}

const APPLY_PAGE_STYLE = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: 0,
    height: '100%',
    width: '100%',
};

const APPLY_FILL_STYLE = {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
};

const APPLY_SCROLL_STYLE = {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
};

const CareerJobApply = () => {
    const { organizationId, jobId } = useParams();
    useCanonicalCareerUrl(organizationId);
    const authUser = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const permissions = useSelector((state) => state.auth.permissions) || [];
    const roleBuckets = useSelector((state) => state.auth.roleBuckets) || [];
    const permissionFlags = useSelector((state) => state.auth.permissionFlags) || {};
    const sessionValidated = useSelector((state) => state.auth.sessionValidated);
    const inHrmsShell = sessionValidated && isHrmsAuthenticatedUser({
        user: authUser,
        employee,
        permissions,
        roleBuckets,
        permissionFlags,
    });
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [trackUrl, setTrackUrl] = useState('');
    const [error, setError] = useState('');
    const [coverLetterFile, setCoverLetterFile] = useState(null);
    const [resumeFile, setResumeFile] = useState(null);
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        consentAccepted: false,
    });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                const { data } = await axios.get(`/v1/public/recruitment/${organizationId}/jobs/${jobId}`);
                if (!cancelled) setJob(data.data);
            } catch {
                if (!cancelled) setError('Job not found or no longer open');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [organizationId, jobId]);

    useEffect(() => {
        if (inHrmsShell || loading || !job || done) return undefined;
        const html = document.documentElement;
        const body = document.body;
        const prevHtmlOverflow = html.style.overflow;
        const prevBodyOverflow = body.style.overflow;
        html.style.overflow = 'hidden';
        body.style.overflow = 'hidden';
        return () => {
            html.style.overflow = prevHtmlOverflow;
            body.style.overflow = prevBodyOverflow;
        };
    }, [inHrmsShell, loading, job, done]);

    const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const closingLabel = useMemo(() => formatClosingLabel(job?.closingDate), [job?.closingDate]);
    const salaryLabel = useMemo(() => formatSalary(job?.salaryRange), [job?.salaryRange]);
    const postedDate = useMemo(() => {
        const posted = getJobPostedDate(job);
        if (!posted) return null;
        const d = new Date(posted);
        return Number.isNaN(d.getTime()) ? null : format(d, 'MMM d, yyyy');
    }, [job]);

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            setSubmitting(true);
            let coverLetterAttachment;
            let resume;
            if (coverLetterFile) {
                coverLetterAttachment = await fileToAttachment(coverLetterFile);
            }
            if (resumeFile) {
                const att = await fileToAttachment(resumeFile);
                resume = { url: att.url, fileName: att.fileName, uploadedAt: new Date().toISOString() };
            }
            const { data } = await axios.post(`/v1/public/recruitment/${organizationId}/jobs/${jobId}/apply`, {
                ...form,
                coverLetterAttachment,
                coverLetter: coverLetterAttachment ? `Uploaded: ${coverLetterAttachment.fileName}` : undefined,
                resume,
            });
            if (data.success) {
                setTrackUrl(data.data?.trackUrl || (data.data?.selfServiceToken ? `/application/${data.data.selfServiceToken}` : ''));
                setDone(true);
            } else setError(data.message || 'Application failed');
        } catch (err) {
            setError(err.message || err.response?.data?.message || 'Application failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="cm-hrms ats-ui ats-public-shell ats-public-shell--loading">
                <LoadingSpinner message="Loading role details…" />
            </div>
        );
    }

    if (!job) {
        return (
            <div className="cm-hrms ats-ui ats-public-shell ats-public-shell--centered">
                <div className="ats-public-state-card">
                    <p className="ats-public-error">{error || 'Job not found'}</p>
                    <Link to={`/careers/${organizationId}`} className="ats-link mt-4 inline-block">
                        Back to all openings
                    </Link>
                </div>
            </div>
        );
    }

    if (done) {
        const portalPath = trackUrl
            ? (trackUrl.startsWith('http') ? new URL(trackUrl).pathname : trackUrl)
            : '';
        return (
            <div className="cm-hrms ats-ui ats-public-shell ats-public-shell--centered">
                <div className="ats-public-state-card">
                    <div className="ats-public-state-card__icon" aria-hidden>
                        <FaCheckCircle />
                    </div>
                    <h1 className="ats-public-state-card__title">Application submitted</h1>
                    <p className="ats-public-state-card__text">
                        Thank you. Our recruitment team will review your application for {job.jobTitle}.
                    </p>
                    {portalPath && (
                        <Link to={portalPath} className="mt-6 block">
                            <CmButton className="w-full">Track your application</CmButton>
                        </Link>
                    )}
                    <Link to={`/careers/${organizationId}`} className="ats-link mt-4 inline-block">
                        View other openings
                    </Link>
                </div>
            </div>
        );
    }

    const requirementItems = asItems(job.requirements);
    const responsibilityItems = asItems(job.responsibilities);

    return (
        <div
            className={`cm-hrms ats-ui ats-apply-page${inHrmsShell ? ' ats-apply-page--in-shell' : ''}`}
            style={APPLY_PAGE_STYLE}
        >
            <section className="ats-public-job-hero ats-apply-page__hero">
                <div className="ats-public-job-hero__inner">
                    <Link to={`/careers/${organizationId}`} className="ats-back">
                        <FaArrowLeft className="h-3 w-3" /> All openings
                    </Link>
                    <p className="ats-public-job-hero__eyebrow">{job.department || 'Open role'}</p>
                    <h1 className="ats-public-job-hero__title">{job.jobTitle}</h1>
                    <div className="ats-public-job-hero__tags">
                        {job.location ? (
                            <span className="ats-public-job-hero__tag">
                                <FaMapMarkerAlt aria-hidden /> {job.location}
                            </span>
                        ) : null}
                        {job.employmentType ? (
                            <span className="ats-public-job-hero__tag">
                                <FaBriefcase aria-hidden /> {job.employmentType}
                            </span>
                        ) : null}
                        {salaryLabel ? (
                            <span className="ats-public-job-hero__tag">{salaryLabel}</span>
                        ) : null}
                        {postedDate ? (
                            <span className="ats-public-job-hero__tag">
                                <FaClock aria-hidden /> Posted {postedDate}
                            </span>
                        ) : null}
                        {closingLabel ? (
                            <span className="ats-public-job-hero__tag ats-public-job-hero__tag--urgent">
                                {closingLabel}
                            </span>
                        ) : null}
                    </div>
                </div>
            </section>

            <main className="ats-apply-page__main" style={APPLY_FILL_STYLE}>
                <div className="ats-apply-page__board" style={APPLY_FILL_STYLE}>
                    <div className="ats-apply-page__grid">
                        <div className="ats-apply-page__about">
                            <DetailSection title="About the Role">
                                <div className="ats-public-prose">
                                    {job.jobDescription || 'Details for this role will be shared during the interview process.'}
                                </div>
                            </DetailSection>

                            {requirementItems.length > 0 ? (
                                <DetailSection title="Requirements">
                                    <ListOrProse items={requirementItems} />
                                </DetailSection>
                            ) : null}

                            {responsibilityItems.length > 0 ? (
                                <DetailSection title="Responsibilities">
                                    <ListOrProse items={responsibilityItems} />
                                </DetailSection>
                            ) : null}
                        </div>

                        <aside className="ats-apply-page__aside" style={APPLY_FILL_STYLE}>
                            <form onSubmit={submit} className="ats-apply-page__panel" style={APPLY_FILL_STYLE}>
                                <div className="ats-apply-page__head">
                                    <h2>Apply Now</h2>
                                    <p>
                                        Complete the form below to submit your application.
                                        Fields marked * are required.
                                    </p>
                                </div>

                                <section className="ats-apply-page__role" aria-label="Role details">
                                    <h3 className="ats-apply-page__role-title">Role Details</h3>
                                    <dl className="ats-apply-page__role-list">
                                        <RoleSummaryRow label="Department" value={job.department} />
                                        <RoleSummaryRow label="Location" value={job.location} />
                                        <RoleSummaryRow label="Employment" value={job.employmentType} />
                                        <RoleSummaryRow label="Position" value={job.position} />
                                        <RoleSummaryRow label="Compensation" value={salaryLabel} wide />
                                    </dl>
                                </section>

                                <div className="ats-apply-page__scroll" style={APPLY_SCROLL_STYLE}>
                                    <section className="ats-apply-page__section">
                                        <h3 className="ats-apply-page__section-title">Personal Information</h3>
                                        {error ? <p className="ats-public-error">{error}</p> : null}

                                        <div className="ats-apply-page__fields">
                                            <label className="ats-apply-page__field">
                                                <span className="ats-form-label">First Name *</span>
                                                <input
                                                    required
                                                    className="cm-input w-full"
                                                    value={form.firstName}
                                                    onChange={(e) => set('firstName', e.target.value)}
                                                />
                                            </label>
                                            <label className="ats-apply-page__field">
                                                <span className="ats-form-label">Last Name</span>
                                                <input
                                                    className="cm-input w-full"
                                                    value={form.lastName}
                                                    onChange={(e) => set('lastName', e.target.value)}
                                                />
                                            </label>
                                            <label className="ats-apply-page__field">
                                                <span className="ats-form-label">Email *</span>
                                                <input
                                                    type="email"
                                                    required
                                                    className="cm-input w-full"
                                                    value={form.email}
                                                    onChange={(e) => set('email', e.target.value)}
                                                />
                                            </label>
                                            <label className="ats-apply-page__field">
                                                <span className="ats-form-label">Phone</span>
                                                <input
                                                    className="cm-input w-full"
                                                    value={form.phone}
                                                    onChange={(e) => set('phone', e.target.value)}
                                                />
                                            </label>
                                        </div>
                                    </section>

                                    <section className="ats-apply-page__section">
                                        <div className="ats-apply-page__upload">
                                            <div className="ats-apply-page__upload-head">
                                                <h3 className="ats-apply-page__section-title">Resume</h3>
                                                <span className="ats-apply-page__optional">Optional</span>
                                            </div>
                                            <CoverLetterUploadField
                                                file={resumeFile}
                                                onChange={setResumeFile}
                                                heading="Upload your resume"
                                                hint="PDF, Word, or image · Max 5MB"
                                                layout="card"
                                                variant="slate"
                                                optional={false}
                                            />
                                        </div>
                                        <div className="ats-apply-page__upload">
                                            <div className="ats-apply-page__upload-head">
                                                <h3 className="ats-apply-page__section-title">Cover Letter</h3>
                                                <span className="ats-apply-page__optional">Optional</span>
                                            </div>
                                            <CoverLetterUploadField
                                                file={coverLetterFile}
                                                onChange={setCoverLetterFile}
                                                heading="Upload your cover letter"
                                                hint="PDF, Word, or image · Max 5MB"
                                                layout="card"
                                                variant="slate"
                                                optional={false}
                                            />
                                        </div>
                                    </section>

                                    <section className="ats-apply-page__section">
                                        <label className="ats-apply-page__consent">
                                            <input
                                                type="checkbox"
                                                checked={form.consentAccepted}
                                                onChange={(e) => set('consentAccepted', e.target.checked)}
                                                required
                                            />
                                            <span>I consent to the processing of my personal data for recruitment purposes.</span>
                                        </label>
                                    </section>
                                </div>

                                <div className="ats-apply-page__foot">
                                    <CmButton type="submit" disabled={submitting} className="w-full">
                                        {submitting ? 'Submitting…' : 'Submit Application'}
                                    </CmButton>
                                </div>
                            </form>
                        </aside>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CareerJobApply;
