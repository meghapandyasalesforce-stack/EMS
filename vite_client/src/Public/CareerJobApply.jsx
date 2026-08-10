import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FaArrowLeft, FaBriefcase, FaBuilding, FaMapMarkerAlt } from 'react-icons/fa';
import axios from '../utils/axios';
import { fileToAttachment } from '../utils/recruitmentFileUpload';
import CoverLetterUploadField from '../components/recruitment/CoverLetterUploadField';
import { CmButton } from '../components/recruitment/atsUi';

const CareerJobApply = () => {
    const { organizationId, jobId } = useParams();
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

    const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

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
            <div className="cm-hrms ats-ui ats-public-shell flex min-h-screen items-center justify-center">
                <p style={{ color: 'rgba(15,45,38,0.55)' }}>Loading…</p>
            </div>
        );
    }

    if (!job) {
        return (
            <div className="cm-hrms ats-ui ats-public-shell flex min-h-screen items-center justify-center px-4">
                <div className="cm-card max-w-md text-center">
                    <p className="text-sm font-medium" style={{ color: 'var(--ats-error)' }}>{error || 'Job not found'}</p>
                    <Link to={`/careers/${organizationId}`} className="ats-link mt-4 inline-block">Back to careers</Link>
                </div>
            </div>
        );
    }

    if (done) {
        const portalPath = trackUrl
            ? (trackUrl.startsWith('http') ? new URL(trackUrl).pathname : trackUrl)
            : '';
        return (
            <div className="cm-hrms ats-ui ats-public-shell flex min-h-screen items-center justify-center px-4 py-16">
                <div className="cm-card w-full max-w-md text-center">
                    <div
                        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl"
                        style={{ background: 'rgba(28,202,155,0.15)', color: '#006c51' }}
                    >
                        ✓
                    </div>
                    <h1 className="mt-4 text-2xl font-bold" style={{ color: 'var(--ats-secondary)' }}>Application submitted</h1>
                    <p className="mt-2 text-sm" style={{ color: 'rgba(15,45,38,0.65)' }}>
                        Thank you. Our recruitment team will review your application.
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

    return (
        <div className="cm-hrms ats-ui ats-public-shell">
            <header className="ats-public-header">
                <div className="ats-public-header__inner">
                    <Link to={`/careers/${organizationId}`} className="ats-back">
                        <FaArrowLeft className="h-3 w-3" /> All openings
                    </Link>
                    <p className="ats-eyebrow">{job.department || 'Open role'}</p>
                    <h1 className="ats-page-title">{job.jobTitle}</h1>
                    <p className="ats-page-subtitle">{job.location} · {job.employmentType}</p>
                </div>
            </header>

            <main className="ats-public-main">
                <div className="ats-detail-layout">
                    <div className="cm-card">
                        <h2 className="cm-title-sm">About the Role</h2>
                        <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'rgba(15,45,38,0.75)' }}>
                            {job.jobDescription}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="cm-card">
                            <h2 className="cm-title-sm mb-4">Role details</h2>
                            <div className="space-y-3">
                                <div className="ats-meta-row">
                                    <FaBuilding className="h-3.5 w-3.5" />
                                    <span>{job.department || '—'}</span>
                                </div>
                                <div className="ats-meta-row">
                                    <FaMapMarkerAlt className="h-3.5 w-3.5" />
                                    <span>{job.location || '—'}</span>
                                </div>
                                <div className="ats-meta-row">
                                    <FaBriefcase className="h-3.5 w-3.5" />
                                    <span>{job.employmentType || '—'}</span>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={submit} className="cm-card space-y-4">
                            <h2 className="cm-title-sm">Apply Now</h2>
                            {error && <p className="text-sm font-medium" style={{ color: 'var(--ats-error)' }}>{error}</p>}
                            <label className="block">
                                <span className="ats-form-label">First name *</span>
                                <input required className="cm-input w-full" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
                            </label>
                            <label className="block">
                                <span className="ats-form-label">Last name *</span>
                                <input required className="cm-input w-full" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
                            </label>
                            <label className="block">
                                <span className="ats-form-label">Email *</span>
                                <input type="email" required className="cm-input w-full" value={form.email} onChange={(e) => set('email', e.target.value)} />
                            </label>
                            <label className="block">
                                <span className="ats-form-label">Phone</span>
                                <input className="cm-input w-full" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
                            </label>
                            <CoverLetterUploadField
                                file={resumeFile}
                                onChange={setResumeFile}
                                label="Resume"
                                variant="slate"
                            />
                            <CoverLetterUploadField
                                file={coverLetterFile}
                                onChange={setCoverLetterFile}
                                variant="slate"
                            />
                            <label className="flex items-start gap-2 text-sm" style={{ color: 'rgba(15,45,38,0.75)' }}>
                                <input type="checkbox" className="mt-1" checked={form.consentAccepted} onChange={(e) => set('consentAccepted', e.target.checked)} required />
                                <span>I consent to the processing of my personal data for recruitment purposes.</span>
                            </label>
                            <CmButton type="submit" disabled={submitting} className="w-full">
                                {submitting ? 'Submitting…' : 'Submit application'}
                            </CmButton>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CareerJobApply;
