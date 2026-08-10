import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../utils/axios';
import { toast } from 'react-toastify';
import { FaCheckCircle, FaTimesCircle, FaCalendarAlt, FaExternalLinkAlt, FaFileAlt, FaFileContract } from 'react-icons/fa';
import LoadingSpinner from '../components/LoadingSpinner';
import { fileToAttachment } from '../utils/recruitmentFileUpload';
import CoverLetterUploadField from '../components/recruitment/CoverLetterUploadField';
import { AtsBadge, CmButton } from '../components/recruitment/atsUi';

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
            <div className="cm-hrms ats-ui ats-public-shell flex min-h-screen items-center justify-center p-6">
                <div className="cm-card max-w-md text-center">
                    <div
                        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
                        style={{ background: 'rgba(229,62,62,0.12)', color: 'var(--ats-error)' }}
                    >
                        <FaTimesCircle className="text-2xl" />
                    </div>
                    <h1 className="mt-4 text-xl font-semibold" style={{ color: 'var(--ats-secondary)' }}>Link unavailable</h1>
                    <p className="mt-2 text-sm" style={{ color: 'rgba(15,45,38,0.55)' }}>This application link may have expired or is invalid.</p>
                </div>
            </div>
        );
    }

    if (done === 'withdraw' || data.status === 'Withdrawn') {
        return (
            <div className="cm-hrms ats-ui ats-public-shell flex min-h-screen items-center justify-center p-6">
                <div className="cm-card max-w-md text-center">
                    <div
                        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
                        style={{ background: 'rgba(255,127,80,0.15)', color: '#c45a2a' }}
                    >
                        <FaCheckCircle className="text-2xl" />
                    </div>
                    <h1 className="mt-4 text-xl font-semibold" style={{ color: 'var(--ats-secondary)' }}>Application withdrawn</h1>
                    <p className="mt-2 text-sm" style={{ color: 'rgba(15,45,38,0.55)' }}>Your application has been withdrawn. The recruiting team has been notified.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="cm-hrms ats-ui ats-public-shell">
            <header className="ats-public-header">
                <div className="ats-public-header__inner">
                    <p className="ats-eyebrow">Application portal</p>
                    <h1 className="ats-page-title">{data.job?.jobTitle || 'Your application'}</h1>
                    <p className="ats-page-subtitle">
                        {data.firstName} {data.lastName} · {data.email}
                    </p>
                </div>
            </header>

            <main className="ats-public-main space-y-6">
                <div className="ats-stat-grid">
                    {[
                        ['Status', <AtsBadge key="status" status={data.status}>{data.status}</AtsBadge>],
                        ['Stage', data.stage],
                        ['Department', data.job?.department || '—'],
                        ['Applied', data.applicationDate ? new Date(data.applicationDate).toLocaleDateString() : '—'],
                    ].map(([label, value]) => (
                        <div key={label} className="cm-card !p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(15,45,38,0.45)' }}>{label}</p>
                            <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--ats-secondary)' }}>{value}</p>
                        </div>
                    ))}
                </div>

                {(data.interviewSchedule || []).length > 0 && (
                    <div className="cm-card">
                        <h2 className="cm-title-sm flex items-center gap-2">
                            <FaCalendarAlt style={{ color: 'var(--ats-primary)' }} /> Interviews
                        </h2>
                        <ul className="mt-4 space-y-2">
                            {data.interviewSchedule.map((iv, i) => (
                                <li
                                    key={i}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm"
                                    style={{ border: '1px solid rgba(15,45,38,0.08)' }}
                                >
                                    <div>
                                        <p className="font-medium" style={{ color: 'var(--ats-secondary)' }}>{iv.interviewType}</p>
                                        <p style={{ color: 'rgba(15,45,38,0.55)' }}>
                                            {iv.status}
                                            {iv.scheduledDate ? ` · ${new Date(iv.scheduledDate).toLocaleString()}` : ''}
                                        </p>
                                    </div>
                                    {iv.meetingLink && (
                                        <a
                                            className="ats-chip ats-chip--primary"
                                            href={iv.meetingLink}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            Join <FaExternalLinkAlt className="ml-1.5 h-2.5 w-2.5" />
                                        </a>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {data.offer && (
                    <div className="cm-card !p-0 overflow-hidden">
                        <div className="px-5 pt-5 pb-3" style={{ borderBottom: '1px solid rgba(28,202,155,0.15)' }}>
                            <h2 className="cm-title-sm flex items-center gap-2">
                                <FaFileContract style={{ color: 'var(--ats-primary)' }} /> Offer letter
                            </h2>
                            <p className="mt-0.5 text-xs" style={{ color: 'rgba(15,45,38,0.6)' }}>
                                {data.offer.canRespond
                                    ? 'An offer has been sent for this application — review and respond.'
                                    : `Offer status: ${data.offer.status}`}
                            </p>
                        </div>
                        <div className="grid gap-3 p-5 sm:grid-cols-2">
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
                                ['Status', <AtsBadge key="offer-status" status={data.offer.status}>{data.offer.status}</AtsBadge>],
                            ].map(([label, value]) => (
                                <div key={label} className="rounded-xl px-3 py-2.5" style={{ background: 'var(--ats-neutral)' }}>
                                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(15,45,38,0.45)' }}>{label}</p>
                                    <p className="mt-0.5 text-sm font-semibold" style={{ color: 'var(--ats-secondary)' }}>{value}</p>
                                </div>
                            ))}
                        </div>
                        {(data.offer.benefits || []).length > 0 && (
                            <div className="px-5 py-3" style={{ borderTop: '1px solid rgba(28,202,155,0.15)' }}>
                                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(15,45,38,0.45)' }}>Benefits</p>
                                <p className="mt-1 text-sm" style={{ color: 'rgba(15,45,38,0.75)' }}>{data.offer.benefits.join(', ')}</p>
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2 px-5 py-4" style={{ borderTop: '1px solid rgba(28,202,155,0.15)' }}>
                            {data.offer.portalUrl && (
                                <a href={data.offer.portalUrl}>
                                    <CmButton>
                                        {data.offer.canRespond ? 'View & respond to offer' : 'View offer letter'}
                                        <FaExternalLinkAlt className="ml-2 h-3 w-3" />
                                    </CmButton>
                                </a>
                            )}
                            {data.offer.pdfUrl && (
                                <a href={data.offer.pdfUrl} target="_blank" rel="noreferrer">
                                    <CmButton variant="outline">
                                        <FaFileAlt className="mr-2" /> Download PDF
                                    </CmButton>
                                </a>
                            )}
                        </div>
                    </div>
                )}

                <div className="cm-card space-y-4">
                    <h2 className="cm-title-sm">Update your details</h2>
                    <label className="block">
                        <span className="ats-form-label">Phone</span>
                        <input className="cm-input w-full" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </label>
                    <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--ats-neutral)' }}>
                        <p className="flex items-center gap-2 font-medium" style={{ color: 'var(--ats-secondary)' }}>
                            <FaFileAlt style={{ color: 'var(--ats-primary)' }} /> Current cover letter
                        </p>
                        <p className="mt-1" style={{ color: 'rgba(15,45,38,0.65)' }}>
                            {data.coverLetterAttachment?.fileName
                                || data.coverLetter
                                || 'No file uploaded yet'}
                        </p>
                        {data.coverLetterAttachment?.url && (
                            <a
                                href={data.coverLetterAttachment.url}
                                target="_blank"
                                rel="noreferrer"
                                className="ats-link mt-2 inline-flex items-center gap-1"
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
                        <CmButton type="button" disabled={busy} onClick={save}>
                            {busy ? 'Saving…' : 'Save changes'}
                        </CmButton>
                        <CmButton type="button" variant="outline" disabled={busy} onClick={withdraw} className="!text-[var(--ats-error)]" style={{ borderColor: 'rgba(229,62,62,0.35)' }}>
                            Withdraw application
                        </CmButton>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ApplicationSelfServicePortal;
