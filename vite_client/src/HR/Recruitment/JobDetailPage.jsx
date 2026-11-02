import useCareerPortalIdentifier from '../../Hooks/useCareerPortalIdentifier';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { differenceInCalendarDays, format, isValid } from 'date-fns';
import { toast } from 'react-toastify';
import {
    FaChartBar, FaCheckCircle, FaEdit, FaExternalLinkAlt,
    FaFilter, FaHistory, FaMapMarkerAlt, FaMoneyBillWave, FaBuilding,
    FaSearch, FaShareAlt, FaTimes, FaUsers, FaUserFriends, FaClock,
    FaColumns,
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { normalizeResumeScreening, parseMinimumMatchPercent, normalizeKeywordList } from '../../utils/resumeScreeningDisplay';
import { AtsPage, AtsBadge, AtsAvatar, CmButton } from '../../components/recruitment/atsUi';
import { formatJobPostedDate, getJobPostedDate } from '../../utils/jobPostedDate';
import { cmInitials } from '../../components/corporateModern';

const CHANNEL_GROUPS = [
    { key: 'referral', sources: ['Referral', 'Internal'], barClass: 'is-primary', legend: 'Internal Referrals' },
    { key: 'linkedin', sources: ['LinkedIn', 'Social Media'], barClass: 'is-secondary', legend: 'LinkedIn' },
    { key: 'portal', sources: ['Company Website', 'Email'], barClass: 'is-mint', legend: 'Careers Portal' },
    { key: 'agency', sources: ['Recruitment Agency', 'Job Board', 'Indeed', 'Glassdoor', 'Other'], barClass: 'is-tertiary', legend: 'Agency / Campus' },
];

const ACTIVE_STAGES = new Set(['Application', 'Screening', 'Interview', 'Offer']);
const PIPELINE_BUCKETS = [
    { key: 'Screening', label: 'Screen', match: (s) => s === 'Screening' || s === 'Application' },
    { key: 'Interview', label: 'Interview', match: (s) => s === 'Interview' },
    { key: 'Offer', label: 'Offer', match: (s) => s === 'Offer' },
];

const formatSalaryRange = (salaryRange) => {
    if (!salaryRange || (salaryRange.min == null && salaryRange.max == null)) return null;
    const currency = salaryRange.currency === 'INR' || !salaryRange.currency ? '₹' : `${salaryRange.currency} `;
    const fmt = (n) => {
        const num = Number(n);
        if (!Number.isFinite(num)) return null;
        if (num >= 100000) return `${(num / 100000).toFixed(num % 100000 === 0 ? 0 : 1)}L`;
        return num.toLocaleString('en-IN');
    };
    const min = fmt(salaryRange.min);
    const max = fmt(salaryRange.max);
    if (min && max) return `${currency}${min} – ${currency}${max} PA`;
    if (min) return `From ${currency}${min} PA`;
    if (max) return `Up to ${currency}${max} PA`;
    return null;
};

const jobReqId = (job) => {
    if (job?.requisitionId) return String(job.requisitionId);
    if (job?.jobCode) return String(job.jobCode);
    const id = String(job?._id || '').slice(-6).toUpperCase();
    return id ? `REQ-${id}` : 'REQ—';
};

const personName = (person) => {
    if (!person) return null;
    if (typeof person === 'string') return null;
    const combined = [person.name, person.lastName].filter(Boolean).join(' ').trim();
    if (combined) return combined;
    return [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email || null;
};

const applicantFullName = (c) => [c?.firstName, c?.lastName].filter(Boolean).join(' ').trim() || 'Candidate';

const applicantCompany = (c) => (
    c?.currentCompany || c?.currentEmployer || c?.employer || c?.company || null
);

const applicantRole = (c, jobTitle) => (
    c?.currentTitle || c?.currentRole || c?.role || c?.offerDetails?.position || jobTitle || null
);

const applicantNotice = (c) => {
    const raw = c?.noticePeriod || c?.notice || c?.availability;
    if (raw == null || raw === '') return null;
    if (typeof raw === 'number') return `${raw} Days`;
    return String(raw);
};

const applicantExperience = (c) => {
    const yrs = c?.yearsOfExperience ?? c?.experienceYears ?? c?.experience;
    if (yrs == null || yrs === '') return null;
    if (typeof yrs === 'number') return `${yrs} Yrs Exp`;
    const s = String(yrs);
    return /exp/i.test(s) ? s : `${s} Yrs Exp`;
};

const stagePillClass = (stage) => {
    const s = String(stage || '').toLowerCase();
    if (/offer|hired/.test(s)) return 'is-offer';
    if (/interview|leadership|tech/.test(s)) return 'is-interview';
    if (/screen|application|applied/.test(s)) return 'is-screen';
    if (/reject|withdraw/.test(s)) return 'is-reject';
    return 'is-default';
};

const JobDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [job, setJob] = useState(null);
    const [candidates, setCandidates] = useState([]);
    const careerIdentifier = useCareerPortalIdentifier();
    const [tab, setTab] = useState('overview');
    const [screeningStats, setScreeningStats] = useState(null);
    const [search, setSearch] = useState('');
    const [stageFilter, setStageFilter] = useState('all');
    const [sortBy, setSortBy] = useState('match');
    const [selectedIds, setSelectedIds] = useState([]);
    const [panelNote, setPanelNote] = useState('');
    const [panelNotes, setPanelNotes] = useState([]);
    const [showShare, setShowShare] = useState(false);
    const [showClose, setShowClose] = useState(false);
    const [closeReason, setCloseReason] = useState('Role Filled');
    const [criteriaForm, setCriteriaForm] = useState({
        enabled: true,
        requiredKeywords: '',
        optionalKeywords: '',
        minimumMatchPercent: 70,
        experienceRequired: '',
        education: '',
        certifications: '',
        templateId: '',
    });
    const [screeningTemplates, setScreeningTemplates] = useState([]);

    useEffect(() => {
        axios.get('/v1/admin/recruitment/screening/templates', {
            withCredentials: true,
            params: { activeOnly: 'true' },
        }).then((res) => setScreeningTemplates(res.data?.data || [])).catch(() => {});
    }, []);

    const fetchJob = useCallback(async () => {
        try {
            setLoading(true);
            const [jobRes, candRes, statsRes] = await Promise.all([
                axios.get(`/v1/admin/recruitment/jobs/${id}`, { withCredentials: true }),
                axios.get(`/v1/admin/recruitment/candidates?jobPostingId=${id}&limit=50`, { withCredentials: true }),
                axios.get(`/v1/admin/recruitment/jobs/${id}/screening-stats`, { withCredentials: true }).catch(() => null),
            ]);
            if (!jobRes.data.success) {
                toast.error('Job not found');
                navigate('/recruitment');
                return;
            }
            const jobData = jobRes.data.data;
            setJob(jobData);
            setCandidates(candRes.data?.data || []);
            setScreeningStats(statsRes?.data?.data || null);
            const sc = jobData.screeningCriteria || {};
            setCriteriaForm({
                enabled: sc.enabled !== false,
                requiredKeywords: normalizeKeywordList(sc.requiredKeywords).join('\n'),
                optionalKeywords: normalizeKeywordList(sc.optionalKeywords).join('\n'),
                minimumMatchPercent: sc.minimumMatchPercent ?? 70,
                experienceRequired: sc.experienceRequired || '',
                education: sc.education || '',
                certifications: (sc.certifications || []).join('\n'),
                templateId: sc.templateId || '',
            });
        } catch {
            toast.error('Failed to load job');
            navigate('/recruitment');
        } finally {
            setLoading(false);
        }
    }, [id, navigate]);

    useEffect(() => { fetchJob(); }, [fetchJob]);

    useEffect(() => {
        if (!id) return;
        try {
            const raw = localStorage.getItem(`rec-job-panel-notes:${id}`);
            setPanelNotes(raw ? JSON.parse(raw) : []);
        } catch {
            setPanelNotes([]);
        }
    }, [id]);

    const persistPanelNotes = (next) => {
        setPanelNotes(next);
        try {
            localStorage.setItem(`rec-job-panel-notes:${id}`, JSON.stringify(next));
        } catch { /* ignore */ }
    };

    const postPanelNote = () => {
        const text = panelNote.trim();
        if (!text) return;
        let author = 'You';
        try {
            const raw = localStorage.getItem('employee') || localStorage.getItem('user');
            const parsed = raw ? JSON.parse(raw) : null;
            author = parsed?.name || [parsed?.firstName, parsed?.lastName].filter(Boolean).join(' ') || parsed?.email || 'You';
        } catch { /* keep default */ }
        const entry = {
            id: `${Date.now()}`,
            text,
            author,
            at: new Date().toISOString(),
        };
        persistPanelNotes([entry, ...panelNotes]);
        setPanelNote('');
        toast.success('Note saved to requisition timeline');
    };

    const updateStatus = async (status) => {
        try {
            setSaving(true);
            const { data } = await axios.put(`/v1/admin/recruitment/jobs/${id}`, { status }, { withCredentials: true });
            if (data.success) {
                setJob(data.data);
                toast.success(`Status set to ${status}`);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Update failed');
        } finally {
            setSaving(false);
        }
    };

    const notifyEmployees = async () => {
        try {
            setSaving(true);
            const { data } = await axios.put(
                `/v1/admin/recruitment/jobs/${id}`,
                { forceNotify: true, internalVisible: true, status: 'Open' },
                { withCredentials: true }
            );
            if (data.success) {
                setJob(data.data);
                toast.success('In-app notification sent for this internal opening');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Notify failed');
        } finally {
            setSaving(false);
        }
    };

    const applyTemplateToCriteria = (templateId) => {
        if (!templateId) {
            setCriteriaForm((p) => ({ ...p, templateId: '' }));
            return;
        }
        const t = screeningTemplates.find((x) => x._id === templateId);
        if (!t) return;
        setCriteriaForm((p) => ({
            ...p,
            templateId,
            enabled: true,
            requiredKeywords: normalizeKeywordList(t.requiredKeywords).join('\n'),
            optionalKeywords: normalizeKeywordList(t.optionalKeywords).join('\n'),
            minimumMatchPercent: t.minimumMatchPercent ?? 70,
        }));
    };

    const saveScreeningCriteria = async () => {
        try {
            setSaving(true);
            const selected = screeningTemplates.find((t) => t._id === criteriaForm.templateId);
            const { data } = await axios.put(
                `/v1/admin/recruitment/jobs/${id}`,
                {
                    screeningCriteria: {
                        enabled: criteriaForm.enabled !== false,
                        requiredKeywords: normalizeKeywordList(criteriaForm.requiredKeywords),
                        optionalKeywords: normalizeKeywordList(criteriaForm.optionalKeywords),
                        minimumMatchPercent: parseMinimumMatchPercent(criteriaForm.minimumMatchPercent, 70),
                        experienceRequired: criteriaForm.experienceRequired.trim(),
                        education: criteriaForm.education.trim(),
                        certifications: criteriaForm.certifications.split('\n').map((s) => s.trim()).filter(Boolean),
                        templateId: criteriaForm.templateId || null,
                        templateName: selected?.name || '',
                    },
                },
                { withCredentials: true }
            );
            if (data.success) {
                setJob(data.data);
                toast.success('Screening criteria saved');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save criteria');
        } finally {
            setSaving(false);
        }
    };

    const archiveJob = async (restore = false) => {
        try {
            setSaving(true);
            const { data } = await axios.post(
                `/v1/admin/recruitment/jobs/${id}/archive`,
                { restore },
                { withCredentials: true }
            );
            toast.success(data.message || (restore ? 'Restored' : 'Archived'));
            if (restore) setJob(data.data);
            else navigate('/recruitment');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Archive failed');
        } finally {
            setSaving(false);
        }
    };

    const deleteJob = async () => {
        if (!window.confirm('Soft-delete (archive) this job? Candidates are kept.')) return;
        try {
            setSaving(true);
            await axios.delete(`/v1/admin/recruitment/jobs/${id}`, { withCredentials: true });
            toast.success('Job deleted (archived)');
            navigate('/recruitment');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Delete failed');
        } finally {
            setSaving(false);
        }
    };

    const confirmCloseJob = async () => {
        await updateStatus('Closed');
        setShowClose(false);
        toast.info(closeReason ? `Closed: ${closeReason}` : 'Requisition closed');
    };

    const copyShareLink = async () => {
        if (!careerUrl) {
            toast.error('Career link unavailable until organization is set');
            return;
        }
        try {
            await navigator.clipboard.writeText(careerUrl);
            toast.success('Job link copied to clipboard');
        } catch {
            toast.error('Copy failed — select the link manually');
        }
    };

    const stats = useMemo(() => {
        const total = candidates.length;
        const byStage = {};
        candidates.forEach((c) => {
            const stage = c.stage || 'Application';
            byStage[stage] = (byStage[stage] || 0) + 1;
        });
        const active = candidates.filter((c) => ACTIVE_STAGES.has(c.stage || 'Application')).length;
        const pipelineParts = PIPELINE_BUCKETS.map((b) => ({
            ...b,
            count: candidates.filter((c) => b.match(c.stage || 'Application')).length,
        }));
        const posted = getJobPostedDate(job);
        const postedDate = posted ? new Date(posted) : (job?.createdAt ? new Date(job.createdAt) : null);
        const daysInMarket = postedDate && isValid(postedDate)
            ? Math.max(0, differenceInCalendarDays(new Date(), postedDate))
            : 0;
        const targetDays = 30;
        const scores = candidates
            .map((c) => normalizeResumeScreening(c.resumeScreening).matchScore)
            .filter((n) => n != null && Number.isFinite(Number(n)))
            .map(Number);
        const avgMatch = screeningStats?.averageMatchScore != null
            ? Number(screeningStats.averageMatchScore)
            : (scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null);

        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const thisWeek = candidates.filter((c) => {
            const d = c.applicationDate || c.createdAt;
            return d && new Date(d).getTime() >= weekAgo;
        }).length;

        const sourceCounts = {};
        candidates.forEach((c) => {
            const src = c.source || 'Other';
            sourceCounts[src] = (sourceCounts[src] || 0) + 1;
        });

        const channels = CHANNEL_GROUPS.map((group) => {
            const groupCands = candidates.filter((c) => group.sources.includes(c.source || 'Other'));
            const count = groupCands.length;
            const qualified = groupCands.filter((c) => {
                const s = normalizeResumeScreening(c.resumeScreening);
                return s.label === 'Approved' || s.label === 'Passed' || (s.matchScore != null && s.matchScore >= 70);
            }).length;
            const toOffer = groupCands.filter((c) => c.stage === 'Offer' || c.stage === 'Hired').length;
            const matchScores = groupCands
                .map((c) => normalizeResumeScreening(c.resumeScreening).matchScore)
                .filter((n) => n != null)
                .map(Number);
            const atsMatch = matchScores.length
                ? Math.round(matchScores.reduce((a, b) => a + b, 0) / matchScores.length)
                : null;
            return {
                ...group,
                count,
                pct: total ? Math.round((count / total) * 100) : 0,
                qualifiedPct: count ? Math.round((qualified / count) * 1000) / 10 : 0,
                toOffer,
                atsMatch,
                label: group.legend,
            };
        }).filter((ch) => ch.count > 0 || total === 0);

        const displayChannels = total === 0
            ? CHANNEL_GROUPS.map((g) => ({ ...g, count: 0, pct: 0, qualifiedPct: 0, toOffer: 0, atsMatch: null, label: g.legend }))
            : channels;

        return {
            total,
            active,
            byStage,
            pipelineParts,
            daysInMarket,
            targetDays,
            avgMatch,
            thisWeek,
            displayChannels,
            throughput: total ? Math.round((active / total) * 100) : 0,
        };
    }, [candidates, job, screeningStats]);

    const filteredCandidates = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = candidates.filter((c) => {
            if (stageFilter !== 'all' && (c.stage || 'Application') !== stageFilter) return false;
            if (!q) return true;
            const hay = [
                c.firstName, c.lastName, c.email,
                applicantCompany(c), applicantRole(c, job?.jobTitle),
                c.source, c.stage, c.status,
            ].filter(Boolean).join(' ').toLowerCase();
            return hay.includes(q);
        });

        const matchScore = (c) => {
            const n = normalizeResumeScreening(c.resumeScreening).matchScore;
            return n != null && Number.isFinite(Number(n)) ? Number(n) : -1;
        };
        const appliedAt = (c) => {
            const d = c.applicationDate || c.createdAt;
            return d ? new Date(d).getTime() : 0;
        };
        const noticeDays = (c) => {
            const raw = applicantNotice(c);
            if (!raw) return Number.POSITIVE_INFINITY;
            const n = parseInt(String(raw).replace(/\D/g, ''), 10);
            return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
        };

        return [...list].sort((a, b) => {
            if (sortBy === 'recent') return appliedAt(b) - appliedAt(a);
            if (sortBy === 'name') return applicantFullName(a).localeCompare(applicantFullName(b));
            if (sortBy === 'notice') return noticeDays(a) - noticeDays(b);
            if (sortBy === 'ranked') {
                const oa = a.scores?.overallScore ?? -1;
                const ob = b.scores?.overallScore ?? -1;
                return Number(ob) - Number(oa);
            }
            return matchScore(b) - matchScore(a);
        });
    }, [candidates, search, stageFilter, sortBy, job?.jobTitle]);

    const stageOptions = useMemo(() => {
        const map = {};
        candidates.forEach((c) => {
            const s = c.stage || 'Application';
            map[s] = (map[s] || 0) + 1;
        });
        return Object.entries(map).sort((a, b) => b[1] - a[1]);
    }, [candidates]);

    const allFilteredSelected = filteredCandidates.length > 0
        && filteredCandidates.every((c) => selectedIds.includes(c._id));

    const toggleSelectAll = (checked) => {
        if (checked) {
            setSelectedIds((prev) => [...new Set([...prev, ...filteredCandidates.map((c) => c._id)])]);
        } else {
            const drop = new Set(filteredCandidates.map((c) => c._id));
            setSelectedIds((prev) => prev.filter((id) => !drop.has(id)));
        }
    };

    const toggleSelected = (candId) => {
        setSelectedIds((prev) => (
            prev.includes(candId) ? prev.filter((id) => id !== candId) : [...prev, candId]
        ));
    };

    const auditEvents = useMemo(() => {
        if (!job) return [];
        const events = [];
        const fmtWhen = (value) => {
            if (!value) return null;
            const d = new Date(value);
            if (!isValid(d)) return null;
            return format(d, 'd MMM yyyy, HH:mm');
        };

        panelNotes.forEach((note) => {
            events.push({
                id: `note-${note.id}`,
                type: 'note',
                tone: 'mint',
                actor: note.author || 'Panel',
                when: fmtWhen(note.at),
                sortAt: new Date(note.at).getTime() || 0,
                body: null,
                quote: note.text,
            });
        });

        candidates.forEach((c) => {
            const name = applicantFullName(c);
            const screening = normalizeResumeScreening(c.resumeScreening);
            if (c.applicationDate || c.createdAt) {
                events.push({
                    id: `apply-${c._id}`,
                    type: 'status',
                    tone: 'secondary',
                    actor: 'ATS',
                    when: fmtWhen(c.applicationDate || c.createdAt),
                    sortAt: new Date(c.applicationDate || c.createdAt).getTime() || 0,
                    body: (
                        <>
                            Candidate <strong className="rec-audit__name">{name}</strong> applied
                            {c.source ? <> via {c.source}</> : null}
                            {c.stage ? (
                                <>
                                    {' '}· stage{' '}
                                    <span className={`rec-app__stage ${stagePillClass(c.stage)}`}>{c.stage}</span>
                                </>
                            ) : null}
                            .
                        </>
                    ),
                });
            }
            if (screening.matchScore != null) {
                const screenedAt = c.resumeScreening?.screenedAt || c.resumeScreening?.screeningDate || c.applicationDate;
                events.push({
                    id: `score-${c._id}`,
                    type: 'scorecard',
                    tone: 'primary',
                    actor: 'Resume Screening',
                    when: fmtWhen(screenedAt),
                    sortAt: screenedAt ? new Date(screenedAt).getTime() : 0,
                    body: (
                        <>
                            Submitted ATS scorecard for <strong className="rec-audit__name">{name}</strong>.
                        </>
                    ),
                    score: `Score: ${screening.matchScore}% · ${screening.label || 'Screened'}`,
                });
            }
            (c.interviewSchedule || []).forEach((iv, idx) => {
                if (iv?.feedback?.submittedAt || iv?.feedback?.recommendation) {
                    const rating = iv.feedback.rating ?? iv.feedback.technical;
                    events.push({
                        id: `iv-${c._id}-${idx}`,
                        type: 'scorecard',
                        tone: 'mint',
                        actor: 'Interview Panel',
                        when: fmtWhen(iv.feedback.submittedAt || iv.scheduledAt || iv.date),
                        sortAt: new Date(iv.feedback.submittedAt || iv.scheduledAt || iv.date || 0).getTime() || 0,
                        body: (
                            <>
                                Submitted {iv.interviewType || 'interview'} evaluation for{' '}
                                <strong className="rec-audit__name">{name}</strong>.
                            </>
                        ),
                        score: rating != null
                            ? `Score: ${rating}${iv.feedback.recommendation ? ` · ${iv.feedback.recommendation}` : ''}`
                            : (iv.feedback.recommendation || null),
                        quote: iv.feedback.comments || null,
                    });
                }
            });
        });

        if (job.createdAt) {
            events.push({
                id: 'created',
                type: 'status',
                tone: 'primary',
                actor: personName(job.createdBy) || 'Hiring Manager',
                when: fmtWhen(job.createdAt),
                sortAt: new Date(job.createdAt).getTime() || 0,
                body: (
                    <>
                        Requisition created{job.status !== 'Draft' ? ', configured with ATS scoring rubric,' : ' as draft'}
                        {job.status === 'Open' ? ' and published.' : '.'}
                    </>
                ),
            });
        }

        const posted = getJobPostedDate(job);
        if (posted) {
            events.push({
                id: 'published',
                type: 'status',
                tone: 'mint',
                actor: 'Recruitment',
                when: fmtWhen(posted),
                sortAt: new Date(posted).getTime() || 0,
                body: (
                    <>
                        Requisition published across EMS Careers
                        {job.externalVisible ? ' and external channels' : ''}.
                    </>
                ),
            });
        }

        if (job.status === 'Closed') {
            events.push({
                id: 'closed',
                type: 'status',
                tone: 'outline',
                actor: 'Status',
                when: fmtWhen(job.updatedAt),
                sortAt: new Date(job.updatedAt || Date.now()).getTime(),
                body: <>Requisition closed and delisted from active hiring.</>,
            });
        }

        return events.sort((a, b) => b.sortAt - a.sortAt);
    }, [job, candidates, panelNotes]);

    if (loading) return <LoadingSpinner message="Loading job…" />;
    if (!job) return null;

    const careerUrl = careerIdentifier ? `${window.location.origin}/careers/${careerIdentifier}/jobs/${job._id}` : '';
    const reqId = jobReqId(job);
    const salary = formatSalaryRange(job.salaryRange);
    const postedLabel = formatJobPostedDate(getJobPostedDate(job), { withYear: true });
    const createdLabel = job.createdAt && isValid(new Date(job.createdAt))
        ? format(new Date(job.createdAt), 'd MMM yyyy')
        : null;
    const hiringLead = personName(job.hiringManager);
    const recruiterName = personName(job.recruiter);
    const keywords = [
        ...(job.screeningCriteria?.requiredKeywords || []),
        ...(job.screeningCriteria?.optionalKeywords || []),
        ...(job.requirements || []).slice(0, 4),
        ...(job.tags || []),
    ].filter(Boolean).slice(0, 8);
    const openings = job.numberOfPositions || 1;
    const filled = job.filledPositions || 0;
    const isOpen = job.status === 'Open' && !job.archivedAt;
    const trackLabel = job.department || job.position || 'Hiring Track';

    return (
        <AtsPage className="rec-hub rec-job" fullWidth>
            <div className="rec-job__crumb-row">
                <div className="rec-hub__crumb">
                    <Link to="/recruitment" className="rec-hub__crumb-link">Dashboard</Link>
                    <span className="rec-hub__crumb-sep">/</span>
                    <span>Hire &amp; Lifecycle</span>
                    <span className="rec-hub__crumb-sep">/</span>
                    <Link to="/recruitment" className="rec-hub__crumb-link">Recruitment Hub</Link>
                    <span className="rec-hub__crumb-sep">/</span>
                    <span className="rec-hub__crumb-current">{reqId}</span>
                </div>
                <div className="rec-job__top-meta">
                    <span className="rec-hub__badge rec-hub__badge--soft">
                        <span className="rec-job__pulse" />
                        {trackLabel}
                    </span>
                    {createdLabel ? (
                        <>
                            <span className="rec-job__dot">•</span>
                            <span className="rec-job__created">Created {createdLabel}</span>
                        </>
                    ) : null}
                </div>
            </div>

            <section className="rec-job__hero">
                <div className="rec-job__hero-main">
                    <div className="rec-job__title-row">
                        <h1 className="rec-job__title">{job.jobTitle}</h1>
                        <AtsBadge status={job.status}>{job.status}</AtsBadge>
                        {isOpen ? (
                            <span className="rec-hub__badge rec-hub__badge--mint">
                                <span className="rec-job__pulse" />
                                Active{postedLabel ? ` · Published ${postedLabel}` : ''}
                            </span>
                        ) : null}
                        {job.archivedAt ? <AtsBadge tone="error">Archived</AtsBadge> : null}
                    </div>
                    <div className="rec-job__meta-row">
                        {job.department ? (
                            <span><FaBuilding /> {job.department}</span>
                        ) : null}
                        {job.location ? (
                            <span><FaMapMarkerAlt /> {job.location}</span>
                        ) : null}
                        {salary ? (
                            <span className="is-salary"><FaMoneyBillWave /> {salary}</span>
                        ) : null}
                        <span>
                            <FaUserFriends /> {openings} Opening{openings === 1 ? '' : 's'}
                            {filled > 0 ? ` (${filled} filled)` : ''}
                        </span>
                        {job.employmentType ? <span className="rec-job__chip">{job.employmentType}</span> : null}
                    </div>
                </div>
                <div className="rec-job__hero-actions">
                    <button
                        type="button"
                        className="rec-hub__btn"
                        onClick={() => navigate(`/recruitment/jobs/${id}/edit`)}
                    >
                        <FaEdit /> Edit
                    </button>
                    <button
                        type="button"
                        className="rec-hub__btn rec-hub__btn--primary"
                        onClick={() => setShowShare(true)}
                        disabled={!careerUrl || job.status !== 'Open'}
                    >
                        <FaShareAlt /> Share Job
                    </button>
                    {job.status !== 'Closed' && !job.archivedAt ? (
                        <button
                            type="button"
                            className="rec-hub__btn rec-job__btn-danger"
                            onClick={() => setShowClose(true)}
                            disabled={saving}
                        >
                            <FaTimes /> Close Job
                        </button>
                    ) : null}
                </div>
            </section>

            <div className="rec-job__tabs" role="tablist" aria-label="Job sections">
                <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'overview'}
                    className={`rec-job__tab${tab === 'overview' ? ' is-active' : ''}`}
                    onClick={() => setTab('overview')}
                >
                    <FaChartBar /> Overview
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'applicants'}
                    className={`rec-job__tab${tab === 'applicants' ? ' is-active' : ''}`}
                    onClick={() => setTab('applicants')}
                >
                    <FaUsers /> Applicants
                    <span className="rec-job__tab-count">{stats.total}</span>
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'activity'}
                    className={`rec-job__tab${tab === 'activity' ? ' is-active' : ''}`}
                    onClick={() => setTab('activity')}
                >
                    <FaHistory /> Activity &amp; Audit
                    <span className="rec-job__tab-count rec-job__tab-count--soft">{auditEvents.length}</span>
                </button>
                <button
                    type="button"
                    className="rec-job__pipeline-link"
                    onClick={() => navigate(`/recruitment/pipeline?jobPostingId=${id}`)}
                >
                    <FaColumns /> Pipeline
                </button>
            </div>

            {tab === 'overview' ? (
                <div className="rec-job__overview">
                    <div className="rec-hub__kpi">
                        <div className="rec-hub__kpi-card" style={{ cursor: 'default' }}>
                            <div className="rec-hub__kpi-top">
                                <div>
                                    <p className="rec-hub__kpi-label">Total Applicants</p>
                                    <p className="rec-hub__kpi-value">{stats.total}</p>
                                </div>
                                <span className="rec-hub__kpi-icon rec-hub__kpi-icon--mint"><FaUsers /></span>
                            </div>
                            {stats.thisWeek > 0 ? (
                                <p className="rec-hub__kpi-meta rec-job__kpi-accent">
                                    +{stats.thisWeek} this wk
                                </p>
                            ) : (
                                <p className="rec-hub__kpi-meta">Cumulative ATS applications</p>
                            )}
                        </div>
                        <div className="rec-hub__kpi-card" style={{ cursor: 'default' }}>
                            <div className="rec-hub__kpi-top">
                                <div>
                                    <p className="rec-hub__kpi-label">In Active Pipeline</p>
                                    <p className="rec-hub__kpi-value">{stats.active}</p>
                                </div>
                                <span className="rec-hub__kpi-icon rec-hub__kpi-icon--blue"><FaFilter /></span>
                            </div>
                            <p className="rec-hub__kpi-meta">
                                {stats.pipelineParts.map((p) => `${p.label}: ${p.count}`).join(' · ') || 'No active stages'}
                                {stats.total ? ` · ${stats.throughput}% throughput` : ''}
                            </p>
                        </div>
                        <div className="rec-hub__kpi-card" style={{ cursor: 'default' }}>
                            <div className="rec-hub__kpi-top">
                                <div>
                                    <p className="rec-hub__kpi-label">Time in Market</p>
                                    <p className="rec-hub__kpi-value">
                                        {stats.daysInMarket}
                                        <span className="rec-job__kpi-suffix"> / {stats.targetDays} Days</span>
                                    </p>
                                </div>
                                <span className="rec-hub__kpi-icon rec-hub__kpi-icon--mint"><FaClock /></span>
                            </div>
                            <div className="rec-job__progress">
                                <div
                                    className="rec-job__progress-bar"
                                    style={{ width: `${Math.min(100, (stats.daysInMarket / stats.targetDays) * 100)}%` }}
                                />
                            </div>
                            <p className="rec-hub__kpi-meta">
                                {stats.daysInMarket <= stats.targetDays ? 'On Track' : 'Past target'}
                            </p>
                        </div>
                        <div className="rec-hub__kpi-card" style={{ cursor: 'default' }}>
                            <div className="rec-hub__kpi-top">
                                <div>
                                    <p className="rec-hub__kpi-label">Match Quality Bar</p>
                                    <p className="rec-hub__kpi-value rec-job__kpi-accent">
                                        {stats.avgMatch != null ? `${stats.avgMatch}%` : '—'}
                                    </p>
                                </div>
                                <span className="rec-hub__kpi-icon rec-hub__kpi-icon--mint"><FaCheckCircle /></span>
                            </div>
                            <p className="rec-hub__kpi-meta">
                                {screeningStats?.approvedCandidates != null
                                    ? `${screeningStats.approvedCandidates} approved · ${screeningStats.rejectedCandidates || 0} rejected`
                                    : 'ATS screening benchmark'}
                            </p>
                        </div>
                    </div>

                    <div className="rec-job__panels">
                        <section className="rec-job__panel">
                            <div className="rec-job__panel-head">
                                <div>
                                    <h2>Candidate Sourcing &amp; Pipeline Conversion</h2>
                                    <p>Channel efficacy for {reqId}</p>
                                </div>
                                <span className="rec-job__telemetry">Live data</span>
                            </div>
                            <div className="rec-job__stack-bar">
                                {stats.displayChannels.map((ch) => (
                                    ch.pct > 0 ? (
                                        <div
                                            key={ch.key}
                                            className={`rec-job__stack-seg ${ch.barClass}`}
                                            style={{ width: `${ch.pct}%` }}
                                            title={`${ch.label}: ${ch.pct}%`}
                                        />
                                    ) : null
                                ))}
                                {stats.total === 0 ? <div className="rec-job__stack-empty" /> : null}
                            </div>
                            <div className="rec-job__stack-legend">
                                {stats.displayChannels.map((ch) => (
                                    <span key={ch.key}>
                                        <i className={`rec-job__legend-dot ${ch.barClass}`} />
                                        {ch.label} ({ch.pct}%)
                                    </span>
                                ))}
                            </div>
                            <div className="rec-job__table-wrap">
                                <table className="rec-job__table">
                                    <thead>
                                        <tr>
                                            <th>Channel</th>
                                            <th>Candidates</th>
                                            <th>Qualified %</th>
                                            <th>To Offer</th>
                                            <th>ATS Match</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.displayChannels.map((ch) => (
                                            <tr key={ch.key}>
                                                <td className="font-medium">{ch.label}</td>
                                                <td className="font-semibold">{ch.count}</td>
                                                <td className={ch.qualifiedPct >= 70 ? 'is-good' : ''}>
                                                    {ch.count ? `${ch.qualifiedPct}%` : '—'}
                                                </td>
                                                <td>{ch.toOffer} candidate{ch.toOffer === 1 ? '' : 's'}</td>
                                                <td>
                                                    {ch.atsMatch != null ? (
                                                        <span className={`rec-job__match-pill${ch.atsMatch >= 90 ? ' is-high' : ''}`}>
                                                            {ch.atsMatch}%
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        <section className="rec-job__panel">
                            <div className="rec-job__panel-head">
                                <div>
                                    <h2>Hiring Team &amp; Assessment Panel</h2>
                                    <p>Hiring managers and screening criteria</p>
                                </div>
                            </div>

                            {hiringLead ? (
                                <div className="rec-job__lead">
                                    <div className="rec-job__lead-avatar">{cmInitials(hiringLead)}</div>
                                    <div className="rec-job__lead-body">
                                        <div className="rec-job__lead-name">
                                            <strong>{hiringLead}</strong>
                                            <span className="rec-job__lead-badge">Hiring Lead</span>
                                        </div>
                                        <p>{job.hiringManager?.email || job.department || 'Hiring manager'}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="rec-job__lead rec-job__lead--empty">
                                    <p>No hiring manager assigned yet.</p>
                                    <button type="button" className="ats-link" onClick={() => navigate(`/recruitment/jobs/${id}/edit`)}>
                                        Assign on Edit
                                    </button>
                                </div>
                            )}

                            <div className="rec-job__panelists">
                                <span className="rec-job__section-label">Assigned recruiters</span>
                                {recruiterName ? (
                                    <div className="rec-job__panelist">
                                        <AtsAvatar name={recruiterName} />
                                        <div>
                                            <p className="rec-job__panelist-name">{recruiterName}</p>
                                            <p className="rec-job__panelist-role">Primary Recruiter</p>
                                        </div>
                                        <span className="rec-job__panelist-status is-active">Active</span>
                                    </div>
                                ) : (
                                    <p className="rec-job__muted">No recruiter assigned.</p>
                                )}
                            </div>

                            <div className="rec-job__skills">
                                <span className="rec-job__section-label">Evaluation Criteria &amp; Tech Stack</span>
                                <div className="rec-job__skill-tags">
                                    {keywords.length ? keywords.map((kw) => (
                                        <span key={kw}>{kw}</span>
                                    )) : (
                                        <span className="rec-job__muted">Add screening keywords on the Activity tab.</span>
                                    )}
                                </div>
                            </div>

                            {screeningStats?.topMatchingCandidates?.length > 0 ? (
                                <div className="rec-job__top-matches">
                                    <span className="rec-job__section-label">Top matching candidates</span>
                                    <ul>
                                        {screeningStats.topMatchingCandidates.slice(0, 4).map((c) => (
                                            <li key={c._id}>
                                                <button type="button" className="ats-link" onClick={() => navigate(`/recruitment/candidates/${c._id}`)}>
                                                    {c.firstName} {c.lastName}
                                                </button>
                                                <span>
                                                    {c.resumeScreening?.matchScore != null ? `${c.resumeScreening.matchScore}%` : '—'}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}
                        </section>
                    </div>

                    {(job.jobDescription || (job.requirements || []).length > 0) ? (
                        <section className="rec-job__panel rec-job__desc">
                            <h2>Role Description</h2>
                            {job.jobDescription ? (
                                <p className="rec-job__desc-body">{job.jobDescription}</p>
                            ) : null}
                            {(job.requirements || []).length > 0 ? (
                                <>
                                    <h3>Requirements</h3>
                                    <ul>
                                        {job.requirements.map((r, i) => <li key={i}>{r}</li>)}
                                    </ul>
                                </>
                            ) : null}
                        </section>
                    ) : null}
                </div>
            ) : null}

            {tab === 'applicants' ? (
                <div className="rec-app">
                    <div className="rec-app__toolbar">
                        <div className="rec-app__search">
                            <FaSearch className="rec-app__search-icon" aria-hidden="true" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search applicant by name, role, previous company..."
                                aria-label="Search applicants"
                            />
                        </div>
                        <div className="rec-app__filters">
                            <label className="rec-app__filter">
                                <span>Stage</span>
                                <select
                                    value={stageFilter}
                                    onChange={(e) => setStageFilter(e.target.value)}
                                    aria-label="Filter by stage"
                                >
                                    <option value="all">All Stages ({stats.total})</option>
                                    {stageOptions.map(([stage, count]) => (
                                        <option key={stage} value={stage}>{stage} ({count})</option>
                                    ))}
                                </select>
                            </label>
                            <label className="rec-app__filter">
                                <span>Sort</span>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    aria-label="Sort applicants"
                                >
                                    <option value="match">Highest ATS Match</option>
                                    <option value="recent">Most Recent Application</option>
                                    <option value="ranked">Interview Score Rank</option>
                                    <option value="notice">Notice Period (Shortest)</option>
                                    <option value="name">Name (A–Z)</option>
                                </select>
                            </label>
                            <button
                                type="button"
                                className="rec-app__filter-btn"
                                title="Reset filters"
                                aria-label="Reset filters"
                                onClick={() => { setSearch(''); setStageFilter('all'); setSortBy('match'); }}
                            >
                                <FaFilter />
                            </button>
                        </div>
                    </div>

                    {selectedIds.length > 0 ? (
                        <div className="rec-app__bulk">
                            <span>{selectedIds.length} candidate{selectedIds.length === 1 ? '' : 's'} selected</span>
                            <button type="button" className="rec-hub__btn" onClick={() => setSelectedIds([])}>
                                Clear
                            </button>
                        </div>
                    ) : null}

                    {filteredCandidates.length === 0 ? (
                        <div className="rec-job__empty">
                            <FaUsers className="rec-job__empty-icon" />
                            <h3>No candidates found in this stage</h3>
                            <p>There are no active candidates matching the applied filters. Try broader channels or reset filters.</p>
                            <div className="rec-job__empty-actions">
                                <button type="button" className="rec-hub__btn rec-hub__btn--primary" onClick={() => setShowShare(true)}>
                                    Share Job Requisition
                                </button>
                                <button
                                    type="button"
                                    className="rec-hub__btn"
                                    onClick={() => { setSearch(''); setStageFilter('all'); setSortBy('match'); }}
                                >
                                    Reset Filters
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="rec-app__table-card">
                            <div className="rec-app__table-scroll">
                                <table className="rec-app__table">
                                    <thead>
                                        <tr>
                                            <th className="rec-app__col-check">
                                                <input
                                                    type="checkbox"
                                                    checked={allFilteredSelected}
                                                    onChange={(e) => toggleSelectAll(e.target.checked)}
                                                    aria-label="Select all applicants"
                                                />
                                            </th>
                                            <th>Candidate &amp; Background</th>
                                            <th>Current Employer</th>
                                            <th>Stage</th>
                                            <th>ATS Match</th>
                                            <th>Applied</th>
                                            <th>Notice Period</th>
                                            <th className="rec-app__col-actions">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredCandidates.map((c) => {
                                            const screening = normalizeResumeScreening(c.resumeScreening);
                                            const name = applicantFullName(c);
                                            const company = applicantCompany(c);
                                            const role = applicantRole(c, job.jobTitle);
                                            const notice = applicantNotice(c);
                                            const exp = applicantExperience(c);
                                            const stage = c.stage || c.status || 'Application';
                                            const applied = c.applicationDate
                                                ? format(new Date(c.applicationDate), 'd MMM yyyy')
                                                : '—';
                                            return (
                                                <tr key={c._id} className={selectedIds.includes(c._id) ? 'is-selected' : ''}>
                                                    <td className="rec-app__col-check">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.includes(c._id)}
                                                            onChange={() => toggleSelected(c._id)}
                                                            aria-label={`Select ${name}`}
                                                        />
                                                    </td>
                                                    <td>
                                                        <div className="rec-app__cand">
                                                            <AtsAvatar name={name} />
                                                            <div>
                                                                <button
                                                                    type="button"
                                                                    className="rec-app__cand-name"
                                                                    onClick={() => navigate(`/recruitment/candidates/${c._id}`)}
                                                                >
                                                                    {name}
                                                                </button>
                                                                <p className="rec-app__cand-meta">
                                                                    {[c.email, exp].filter(Boolean).join(' · ') || '—'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <p className="rec-app__employer">{company || '—'}</p>
                                                        {role ? <p className="rec-app__role">{role}</p> : null}
                                                    </td>
                                                    <td>
                                                        <span className={`rec-app__stage ${stagePillClass(stage)}`}>
                                                            {stage}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {screening.matchScore != null ? (
                                                            <span className="rec-app__match">{screening.matchScore}%</span>
                                                        ) : (
                                                            <span className="rec-app__dash">—</span>
                                                        )}
                                                    </td>
                                                    <td className="rec-app__date">{applied}</td>
                                                    <td>
                                                        {notice ? (
                                                            <span className="rec-app__notice">{notice}</span>
                                                        ) : (
                                                            <span className="rec-app__dash">—</span>
                                                        )}
                                                    </td>
                                                    <td className="rec-app__col-actions">
                                                        <button
                                                            type="button"
                                                            className="rec-app__dossier"
                                                            onClick={() => navigate(`/recruitment/candidates/${c._id}`)}
                                                        >
                                                            Dossier
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="rec-app__footer">
                                <span>Showing {filteredCandidates.length} of {stats.total} applicants</span>
                                <span>All matching applicants displayed</span>
                            </div>
                        </div>
                    )}
                </div>
            ) : null}

            {tab === 'activity' ? (
                <div className="rec-audit">
                    <section className="rec-audit__card">
                        <div className="rec-audit__head">
                            <div>
                                <h2>Requisition Audit Trail &amp; Team Discussions</h2>
                                <p>Timestamped lifecycle governance log and panel notes</p>
                            </div>
                        </div>

                        <div className="rec-audit__note-box">
                            <label className="rec-audit__note-label" htmlFor="panel-note">
                                Add Internal Panel Note
                            </label>
                            <textarea
                                id="panel-note"
                                className="rec-audit__textarea"
                                rows={3}
                                value={panelNote}
                                onChange={(e) => setPanelNote(e.target.value)}
                                placeholder="Write a note or mention @panelists for immediate escalation..."
                                aria-label="Requisition panel note"
                            />
                            <div className="rec-audit__note-foot">
                                <span>Markdown supported · Tag members with &apos;@&apos;</span>
                                <button
                                    type="button"
                                    className="rec-hub__btn rec-hub__btn--primary"
                                    onClick={postPanelNote}
                                    disabled={!panelNote.trim()}
                                >
                                    Post Note
                                </button>
                            </div>
                        </div>

                        <div className="rec-audit__timeline">
                            {auditEvents.length === 0 ? (
                                <p className="rec-job__muted">No activity yet for this requisition.</p>
                            ) : auditEvents.map((event) => (
                                <div key={event.id} className="rec-audit__item">
                                    <span className={`rec-audit__dot is-${event.tone || 'outline'}`} />
                                    <div className="rec-audit__content">
                                        <div className="rec-audit__meta">
                                            <strong>{event.actor}</strong>
                                            {event.when ? <span>{event.when}</span> : null}
                                        </div>
                                        {event.body ? <p className="rec-audit__body">{event.body}</p> : null}
                                        {event.quote ? (
                                            <blockquote className="rec-audit__quote">&ldquo;{event.quote}&rdquo;</blockquote>
                                        ) : null}
                                        {event.score ? (
                                            <span className="rec-audit__score">{event.score}</span>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <details className="rec-audit__admin">
                        <summary>Requisition controls &amp; screening</summary>
                        <div className="rec-audit__admin-body space-y-4">
                            <div className="rec-job__status-row">
                                {['Draft', 'Open', 'On Hold', 'Closed'].map((s) => (
                                    <CmButton
                                        key={s}
                                        type="button"
                                        size="sm"
                                        variant={job.status === s ? 'primary' : 'outline'}
                                        disabled={saving || job.status === s}
                                        onClick={() => updateStatus(s)}
                                    >
                                        {s}
                                    </CmButton>
                                ))}
                                {job.archivedAt ? (
                                    <CmButton type="button" size="sm" variant="outline" disabled={saving} onClick={() => archiveJob(true)}>
                                        Restore
                                    </CmButton>
                                ) : (
                                    <>
                                        <CmButton type="button" size="sm" variant="outline" disabled={saving} onClick={() => archiveJob(false)}>
                                            Archive
                                        </CmButton>
                                        <CmButton type="button" size="sm" variant="outline" disabled={saving} onClick={deleteJob} style={{ color: 'var(--ats-error)' }}>
                                            Delete
                                        </CmButton>
                                    </>
                                )}
                            </div>
                            {careerUrl && isOpen ? (
                                <a href={careerUrl} target="_blank" rel="noreferrer" className="ats-link inline-flex items-center gap-2">
                                    Open career apply page <FaExternalLinkAlt className="text-xs" />
                                </a>
                            ) : null}
                            {isOpen ? (
                                <button type="button" disabled={saving} onClick={notifyEmployees} className="ats-link block disabled:opacity-50">
                                    Notify employees in-app (internal board)
                                </button>
                            ) : null}
                            <div className="rec-job__criteria-form space-y-3">
                                <p className="rec-job__section-label">Screening criteria</p>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={criteriaForm.enabled}
                                        onChange={(e) => setCriteriaForm((p) => ({ ...p, enabled: e.target.checked }))}
                                    />
                                    Enable auto-screening
                                </label>
                                <select
                                    className="cm-select w-full !text-sm"
                                    value={criteriaForm.templateId || ''}
                                    onChange={(e) => applyTemplateToCriteria(e.target.value)}
                                >
                                    <option value="">None — enter keywords manually</option>
                                    {screeningTemplates.map((t) => (
                                        <option key={t._id} value={t._id}>{t.name}</option>
                                    ))}
                                </select>
                                <textarea
                                    rows={3}
                                    className="cm-input w-full !text-sm"
                                    placeholder="Required keywords (one per line)"
                                    value={criteriaForm.requiredKeywords}
                                    onChange={(e) => setCriteriaForm((p) => ({ ...p, requiredKeywords: e.target.value }))}
                                />
                                <textarea
                                    rows={2}
                                    className="cm-input w-full !text-sm"
                                    placeholder="Optional keywords (one per line)"
                                    value={criteriaForm.optionalKeywords}
                                    onChange={(e) => setCriteriaForm((p) => ({ ...p, optionalKeywords: e.target.value }))}
                                />
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    className="cm-input w-full !text-sm"
                                    value={criteriaForm.minimumMatchPercent}
                                    onChange={(e) => setCriteriaForm((p) => ({ ...p, minimumMatchPercent: e.target.value }))}
                                />
                                <CmButton type="button" size="sm" variant="outline" disabled={saving} onClick={saveScreeningCriteria}>
                                    Save criteria
                                </CmButton>
                            </div>
                        </div>
                    </details>
                </div>
            ) : null}

            {showShare ? (
                <div className="rec-job__modal-backdrop" onClick={() => setShowShare(false)} role="presentation">
                    <div className="rec-job__modal" role="dialog" aria-modal="true" aria-label="Share requisition" onClick={(e) => e.stopPropagation()}>
                        <div className="rec-job__modal-head">
                            <div>
                                <h3>Share Requisition</h3>
                                <p>{reqId} public careers URL</p>
                            </div>
                            <button type="button" className="rec-hub__icon-btn" onClick={() => setShowShare(false)} aria-label="Close">
                                <FaTimes />
                            </button>
                        </div>
                        <label className="rec-job__section-label">Candidate portal link</label>
                        <div className="rec-job__share-row">
                            <input className="cm-input flex-1 !text-xs font-mono" readOnly value={careerUrl || 'Unavailable'} />
                            <button type="button" className="rec-hub__btn rec-hub__btn--primary" onClick={copyShareLink} disabled={!careerUrl}>
                                Copy
                            </button>
                        </div>
                        <div className="rec-job__modal-foot">
                            <button type="button" className="rec-hub__btn" onClick={() => setShowShare(false)}>Done</button>
                        </div>
                    </div>
                </div>
            ) : null}

            {showClose ? (
                <div className="rec-job__modal-backdrop" onClick={() => setShowClose(false)} role="presentation">
                    <div className="rec-job__modal" role="dialog" aria-modal="true" aria-label="Close requisition" onClick={(e) => e.stopPropagation()}>
                        <div className="rec-job__modal-head">
                            <div>
                                <h3>Close Requisition?</h3>
                                <p>{reqId} will be delisted</p>
                            </div>
                            <button type="button" className="rec-hub__icon-btn" onClick={() => setShowClose(false)} aria-label="Close">
                                <FaTimes />
                            </button>
                        </div>
                        <p className="rec-job__muted mb-3">
                            Closing this requisition archives the posting. Active candidates remain in the pipeline for follow-up.
                        </p>
                        <label className="rec-job__section-label" htmlFor="close-reason">Reason for closing</label>
                        <select
                            id="close-reason"
                            className="rec-hub__select w-full"
                            value={closeReason}
                            onChange={(e) => setCloseReason(e.target.value)}
                        >
                            <option value="Role Filled">Role Filled (Candidate Selected)</option>
                            <option value="Budget Frozen">Headcount Budget Frozen / Reprioritized</option>
                            <option value="Restructuring">Org Restructuring</option>
                            <option value="Transferred Internal">Transferred to Internal Lateral Move</option>
                        </select>
                        <div className="rec-job__modal-foot">
                            <button type="button" className="rec-hub__btn" onClick={() => setShowClose(false)}>Keep Open</button>
                            <button type="button" className="rec-hub__btn rec-job__btn-danger" disabled={saving} onClick={confirmCloseJob}>
                                Confirm Close
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </AtsPage>
    );
};

export default JobDetailPage;
