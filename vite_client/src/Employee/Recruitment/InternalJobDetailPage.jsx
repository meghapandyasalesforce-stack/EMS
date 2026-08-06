import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaArrowLeft, FaBuilding, FaMapMarkerAlt, FaUserCheck, FaUserPlus } from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { fileToAttachment } from '../../utils/recruitmentFileUpload';
import CoverLetterUploadField from '../../components/recruitment/CoverLetterUploadField';

const fieldClass =
    'mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-theme-secondary focus:ring-2 focus:ring-theme-secondary/20';

const InternalJobDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [mode, setMode] = useState('apply');
    const [referForm, setReferForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
    const [coverLetterFile, setCoverLetterFile] = useState(null);
    const [referCoverLetterFile, setReferCoverLetterFile] = useState(null);
    const [resumeFile, setResumeFile] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await axios.get(`/v1/both/recruitment/internal-jobs/${id}`, { withCredentials: true });
                if (!cancelled) setJob(data.data);
            } catch {
                toast.error('Job not found');
                navigate('/employee/internal-jobs');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [id, navigate]);

    const apply = async () => {
        try {
            setBusy(true);
            const coverLetterAttachment = coverLetterFile ? await fileToAttachment(coverLetterFile) : undefined;
            const resumeAtt = resumeFile ? await fileToAttachment(resumeFile) : undefined;
            await axios.post(
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
            toast.success('Application submitted');
            navigate('/employee/internal-jobs');
        } catch (err) {
            toast.error(err.message || err.response?.data?.message || 'Apply failed');
        } finally {
            setBusy(false);
        }
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
            navigate('/employee/internal-jobs');
        } catch (err) {
            toast.error(err.message || err.response?.data?.message || 'Referral failed');
        } finally {
            setBusy(false);
        }
    };

    if (loading) return <LoadingSpinner message="Loading job…" />;
    if (!job) return null;

    return (
        <div className="min-h-screen bg-gray-50 p-3 sm:p-4">
            <div className="mx-auto max-w-3xl">
                <button
                    type="button"
                    onClick={() => navigate('/employee/internal-jobs')}
                    className="mb-4 inline-flex items-center gap-2 rounded-lg px-1 py-1 text-sm text-gray-600 transition hover:text-gray-900"
                >
                    <FaArrowLeft className="h-3.5 w-3.5" /> Back to openings
                </button>

                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="border-b border-gray-100 bg-gradient-to-br from-theme-primary/5 via-white to-white px-5 py-6 sm:px-6">
                        <p className="text-xs font-semibold uppercase tracking-wide text-theme-secondary">Internal role</p>
                        <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">{job.jobTitle}</h1>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
                                <FaBuilding className="h-3 w-3 text-gray-400" />{job.department}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
                                <FaMapMarkerAlt className="h-3 w-3 text-gray-400" />{job.location}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
                                {job.employmentType}
                            </span>
                        </div>
                    </div>
                    <div className="px-5 py-5 sm:px-6">
                        <h2 className="text-sm font-semibold text-gray-900">About the role</h2>
                        <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{job.jobDescription}</div>
                    </div>
                </div>

                <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
                        <button
                            type="button"
                            onClick={() => setMode('apply')}
                            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                                mode === 'apply' ? 'bg-white text-theme-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <FaUserCheck className="h-3.5 w-3.5" /> Apply myself
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('refer')}
                            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                                mode === 'refer' ? 'bg-white text-theme-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <FaUserPlus className="h-3.5 w-3.5" /> Refer a colleague
                        </button>
                    </div>

                    {mode === 'apply' ? (
                        <div className="mt-5 space-y-4">
                            <CoverLetterUploadField
                                file={resumeFile}
                                onChange={setResumeFile}
                                label="Resume"
                            />
                            <CoverLetterUploadField
                                file={coverLetterFile}
                                onChange={setCoverLetterFile}
                            />
                            <button
                                type="button"
                                disabled={busy}
                                onClick={apply}
                                className="inline-flex w-full items-center justify-center rounded-xl bg-theme-secondary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-theme-primary disabled:opacity-60 sm:w-auto"
                            >
                                {busy ? 'Submitting…' : 'Submit internal application'}
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={refer} className="mt-5 space-y-4">
                            <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-3.5 py-3 text-sm text-amber-900">
                                Referral bonus stays <strong>Pending</strong> until HR applies hire / probation rules.
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    First name *
                                    <input required className={fieldClass} value={referForm.firstName} onChange={(e) => setReferForm((p) => ({ ...p, firstName: e.target.value }))} />
                                </label>
                                <label className="block text-sm font-medium text-gray-700">
                                    Last name *
                                    <input required className={fieldClass} value={referForm.lastName} onChange={(e) => setReferForm((p) => ({ ...p, lastName: e.target.value }))} />
                                </label>
                                <label className="block text-sm font-medium text-gray-700">
                                    Email *
                                    <input required type="email" className={fieldClass} value={referForm.email} onChange={(e) => setReferForm((p) => ({ ...p, email: e.target.value }))} />
                                </label>
                                <label className="block text-sm font-medium text-gray-700">
                                    Phone
                                    <input className={fieldClass} value={referForm.phone} onChange={(e) => setReferForm((p) => ({ ...p, phone: e.target.value }))} />
                                </label>
                            </div>
                            <CoverLetterUploadField
                                file={referCoverLetterFile}
                                onChange={setReferCoverLetterFile}
                                label="Cover letter / referral note"
                            />
                            <button
                                type="submit"
                                disabled={busy}
                                className="inline-flex w-full items-center justify-center rounded-xl bg-theme-secondary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-theme-primary disabled:opacity-60 sm:w-auto"
                            >
                                {busy ? 'Submitting…' : 'Submit referral'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InternalJobDetailPage;
