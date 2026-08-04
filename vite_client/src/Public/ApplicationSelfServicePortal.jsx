import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { FaCheckCircle, FaTimesCircle, FaCalendarAlt, FaExternalLinkAlt, FaFileAlt, FaFileContract } from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import { fileToAttachment } from '../../utils/recruitmentFileUpload';
import CoverLetterUploadField from '../../components/recruitment/CoverLetterUploadField';

const fieldClass =
    'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15';

/**
 * Public candidate self-service — track / update / withdraw application.
 */
const ApplicationSelfServicePortal = () => {
    const { token } = useParams();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [phone, setPhone] = useState('');
    const [coverLetterFile, setCoverLetterFile] = useState(null);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const { data: res } = await axios.get(`/v1/public/recruitment/application/${token}`);
            setData(res.data);
            setPhone(res.data?.phone || '');
            setCoverLetterFile(null);
        } catch {
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        try {
            setBusy(true);
            const payload = { phone };
            if (coverLetterFile) {
                payload.coverLetterAttachment = await fileToAttachment(coverLetterFile);
            }
            await axios.post(`/v1/public/recruitment/application/${token}`, payload);
            toast.success('Updated');
            load();
        } catch (err) {
            toast.error(err.message || err.response?.data?.message || 'Update failed');
        } finally {
            setBusy(false);
        }
    };

    const withdraw = async () => {
        const reason = window.prompt('Reason for withdrawing (optional)') || 'Withdrawn by candidate';
        try {
            setBusy(true);
            await axios.post(`/v1/public/recruitment/application/${token}`, { action: 'withdraw', reason });
            setDone('withdraw');
            toast.success('Application withdrawn');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Withdraw failed');
        } finally {
            setBusy(false);
        }
    };

    if (loading) return <LoadingSpinner message="Loading application…" />;

    if (!data) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-100 to-slate-50 p-6">
                <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
                        <FaTimesCircle className="text-2xl" />
                    </div>
                    <h1 className="mt-4 text-xl font-semibold text-slate-900">Link unavailable</h1>
                    <p className="mt-2 text-sm text-slate-500">This application link may have expired or is invalid.</p>
                </div>
            </div>
        );
    }

    if (done === 'withdraw' || data.status === 'Withdrawn') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-100 to-slate-50 p-6">
                <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-500">
                        <FaCheckCircle className="text-2xl" />
                    </div>
                    <h1 className="mt-4 text-xl font-semibold text-slate-900">Application withdrawn</h1>
                    <p className="mt-2 text-sm text-slate-500">Your application has been withdrawn. The recruiting team has been notified.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white py-10 px-4">
            <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-slate-900 px-6 py-6 text-white">
                    <p className="text-xs font-semibold uppercase tracking-wider text-teal-300">Application portal</p>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight">{data.job?.jobTitle || 'Your application'}</h1>
                    <p className="mt-1 text-sm text-slate-300">
                        {data.firstName} {data.lastName} · {data.email}
                    </p>
                </div>

                <div className="p-6">
                    <div className="grid gap-3 sm:grid-cols-2">
                        {[
                            ['Status', data.status],
                            ['Stage', data.stage],
                            ['Department', data.job?.department || '—'],
                            ['Applied', data.applicationDate ? new Date(data.applicationDate).toLocaleDateString() : '—'],
                        ].map(([label, value]) => (
                            <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
                                <p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p>
                            </div>
                        ))}
                    </div>

                    {(data.interviewSchedule || []).length > 0 && (
                        <div className="mt-8">
                            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                <FaCalendarAlt className="text-teal-700" /> Interviews
                            </h2>
                            <ul className="mt-3 space-y-2">
                                {data.interviewSchedule.map((iv, i) => (
                                    <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm">
                                        <div>
                                            <p className="font-medium text-slate-900">{iv.interviewType}</p>
                                            <p className="text-slate-500">
                                                {iv.status}
                                                {iv.scheduledDate ? ` · ${new Date(iv.scheduledDate).toLocaleString()}` : ''}
                                            </p>
                                        </div>
                                        {iv.meetingLink && (
                                            <a
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100"
                                                href={iv.meetingLink}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                Join <FaExternalLinkAlt className="h-2.5 w-2.5" />
                                            </a>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {data.offer && (
                        <div className="mt-8 overflow-hidden rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white">
                            <div className="border-b border-teal-100 px-4 py-3 sm:px-5">
                                <h2 className="flex items-center gap-2 text-sm font-semibold text-teal-900">
                                    <FaFileContract className="text-teal-700" /> Offer letter
                                </h2>
                                <p className="mt-0.5 text-xs text-teal-800/80">
                                    {data.offer.canRespond
                                        ? 'An offer has been sent for this application — review and respond.'
                                        : `Offer status: ${data.offer.status}`}
                                </p>
                            </div>
                            <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                                {[
                                    ['Position', data.offer.position || '—'],
                                    ['Department', data.offer.department || '—'],
                                    ['Salary', data.offer.salary != null
                                        ? `${data.offer.currency || 'INR'} ${Number(data.offer.salary).toLocaleString()}`
                                        : '—'],
                                    ['Start date', data.offer.startDate
                                        ? new Date(data.offer.startDate).toLocaleDateString()
                                        : '—'],
                                    ['Expires', data.offer.expiryDate
                                        ? new Date(data.offer.expiryDate).toLocaleDateString()
                                        : '—'],
                                    ['Status', data.offer.status],
                                ].map(([label, value]) => (
                                    <div key={label} className="rounded-xl border border-teal-100/80 bg-white/80 px-3 py-2.5">
                                        <p className="text-xs font-medium uppercase tracking-wide text-teal-700/70">{label}</p>
                                        <p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p>
                                    </div>
                                ))}
                            </div>
                            {(data.offer.benefits || []).length > 0 && (
                                <div className="border-t border-teal-100 px-4 py-3 sm:px-5">
                                    <p className="text-xs font-medium uppercase tracking-wide text-teal-700/70">Benefits</p>
                                    <p className="mt-1 text-sm text-slate-700">{data.offer.benefits.join(', ')}</p>
                                </div>
                            )}
                            <div className="flex flex-wrap gap-2 border-t border-teal-100 px-4 py-3 sm:px-5">
                                {data.offer.portalUrl && (
                                    <a
                                        href={data.offer.portalUrl}
                                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                                    >
                                        {data.offer.canRespond ? 'View & respond to offer' : 'View offer letter'}
                                        <FaExternalLinkAlt className="h-3 w-3" />
                                    </a>
                                )}
                                {data.offer.pdfUrl && (
                                    <a
                                        href={data.offer.pdfUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-2.5 text-sm font-medium text-teal-900 hover:bg-teal-50"
                                    >
                                        <FaFileAlt /> Download PDF
                                    </a>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="mt-8 space-y-4 border-t border-slate-100 pt-6">
                        <h2 className="text-sm font-semibold text-slate-900">Update your details</h2>
                        <label className="block text-sm font-medium text-slate-700">
                            Phone
                            <input className={fieldClass} placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
                        </label>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                            <p className="flex items-center gap-2 font-medium text-slate-800">
                                <FaFileAlt className="text-teal-700" /> Current cover letter
                            </p>
                            <p className="mt-1 text-slate-600">
                                {data.coverLetterAttachment?.fileName
                                    || data.coverLetter
                                    || 'No file uploaded yet'}
                            </p>
                            {data.coverLetterAttachment?.url && (
                                <a
                                    href={data.coverLetterAttachment.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
                                >
                                    View file <FaExternalLinkAlt className="h-2.5 w-2.5" />
                                </a>
                            )}
                        </div>
                        <CoverLetterUploadField
                            file={coverLetterFile}
                            onChange={setCoverLetterFile}
                            label="Replace cover letter"
                            variant="slate"
                        />
                        <div className="flex flex-wrap gap-2 pt-1">
                            <button
                                type="button"
                                disabled={busy}
                                onClick={save}
                                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                            >
                                {busy ? 'Saving…' : 'Save changes'}
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={withdraw}
                                className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                            >
                                Withdraw application
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ApplicationSelfServicePortal;
