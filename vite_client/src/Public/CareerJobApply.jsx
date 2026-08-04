import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from '../utils/axios';
import { fileToAttachment } from '../utils/recruitmentFileUpload';
import CoverLetterUploadField from '../components/recruitment/CoverLetterUploadField';

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
        return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading…</div>;
    }

    if (!job) {
        return (
            <div className="mx-auto max-w-xl px-4 py-16 text-center">
                <p className="text-red-600">{error || 'Job not found'}</p>
                <Link to={`/careers/${organizationId}`} className="mt-4 inline-block text-slate-700 underline">Back to careers</Link>
            </div>
        );
    }

    if (done) {
        const portalPath = trackUrl
            ? (trackUrl.startsWith('http') ? new URL(trackUrl).pathname : trackUrl)
            : '';
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-100 to-slate-50 px-4 py-16">
                <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-2xl text-teal-600">✓</div>
                    <h1 className="mt-4 text-2xl font-bold text-slate-900">Application submitted</h1>
                    <p className="mt-2 text-sm text-slate-600">Thank you. Our recruitment team will review your application.</p>
                    {portalPath && (
                        <Link
                            to={portalPath}
                            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                            Track your application
                        </Link>
                    )}
                    <Link to={`/careers/${organizationId}`} className="mt-4 inline-block text-sm text-slate-600 underline hover:text-slate-900">
                        View other openings
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="mx-auto max-w-3xl px-4 py-8">
                <Link to={`/careers/${organizationId}`} className="text-sm text-slate-600 hover:underline">← All openings</Link>
                <h1 className="mt-4 text-3xl font-bold text-slate-900">{job.jobTitle}</h1>
                <p className="mt-1 text-slate-600">{job.department} · {job.location} · {job.employmentType}</p>
                <div className="mt-6 whitespace-pre-wrap rounded-xl border bg-white p-5 text-sm text-slate-700 shadow-sm">
                    {job.jobDescription}
                </div>

                <form onSubmit={submit} className="mt-8 space-y-4 rounded-xl border bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">Apply for this role</h2>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block text-sm">
                            <span className="mb-1 block font-medium">First name *</span>
                            <input required className="w-full rounded-lg border px-3 py-2" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
                        </label>
                        <label className="block text-sm">
                            <span className="mb-1 block font-medium">Last name *</span>
                            <input required className="w-full rounded-lg border px-3 py-2" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
                        </label>
                        <label className="block text-sm">
                            <span className="mb-1 block font-medium">Email *</span>
                            <input type="email" required className="w-full rounded-lg border px-3 py-2" value={form.email} onChange={(e) => set('email', e.target.value)} />
                        </label>
                        <label className="block text-sm">
                            <span className="mb-1 block font-medium">Phone</span>
                            <input className="w-full rounded-lg border px-3 py-2" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
                        </label>
                    </div>
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
                    <label className="flex items-start gap-2 text-sm">
                        <input type="checkbox" className="mt-1" checked={form.consentAccepted} onChange={(e) => set('consentAccepted', e.target.checked)} required />
                        <span>I consent to the processing of my personal data for recruitment purposes.</span>
                    </label>
                    <button type="submit" disabled={submitting} className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-60">
                        {submitting ? 'Submitting…' : 'Submit application'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CareerJobApply;
