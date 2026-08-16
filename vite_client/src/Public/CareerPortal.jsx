import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    FaBriefcase,
    FaMapMarkerAlt,
    FaChevronDown,
    FaStar,
    FaClock,
    FaCode,
    FaBullhorn,
    FaDatabase,
    FaPaintBrush,
    FaUsers,
    FaLaptopCode,
    FaArrowRight,
} from 'react-icons/fa';
import { format } from 'date-fns';
import axios from '../utils/axios';
import { AtsEmpty } from '../components/recruitment/atsUi';
import { CmSearch } from '../components/corporateModern';
import LoadingSpinner from '../components/LoadingSpinner';
import useHrmsPopupDismiss from '../Hooks/useHrmsPopupDismiss';
import { formatJobPostedLabel, getJobPostedDate } from '../utils/jobPostedDate';

const formatPostedAgo = (job) => {
    const posted = getJobPostedDate(job);
    if (!posted) return null;
    const d = new Date(posted);
    if (Number.isNaN(d.getTime())) return null;
    const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
    if (days <= 0) return 'Posted today';
    if (days === 1) return 'Posted 1 day ago';
    if (days < 30) return `Posted ${days} days ago`;
    return formatJobPostedLabel(job);
};

const formatClosesMeta = (job) => {
    if (!job?.closingDate) return null;
    const d = new Date(job.closingDate);
    if (Number.isNaN(d.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const closeDay = new Date(d);
    closeDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round((closeDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays < 0) return { label: 'Closed', urgent: true };
    if (diffDays === 0) return { label: 'Closes Today', urgent: true };
    if (diffDays === 1) return { label: 'Closes Tomorrow', urgent: true };
    return { label: `Closes ${format(d, 'MMM d')}`, urgent: diffDays <= 3 };
};

const departmentVisual = (department = '') => {
    const t = String(department).toLowerCase();
    if (t.includes('design') || t.includes('ux') || t.includes('creative')) {
        return { Icon: FaPaintBrush, tone: 'design' };
    }
    if (t.includes('market') || t.includes('growth') || t.includes('sales')) {
        return { Icon: FaBullhorn, tone: 'market' };
    }
    if (t.includes('data') || t.includes('analytic') || t.includes('science')) {
        return { Icon: FaDatabase, tone: 'data' };
    }
    if (t.includes('product') || t.includes('eng') || t.includes('tech') || t.includes('software') || t.includes('it')) {
        return { Icon: FaCode, tone: 'eng' };
    }
    if (t.includes('hr') || t.includes('people') || t.includes('talent')) {
        return { Icon: FaUsers, tone: 'hr' };
    }
    return { Icon: FaLaptopCode, tone: 'default' };
};

const jobSummary = (job, max = 120) => {
    const desc = String(job.jobDescription || '').replace(/\s+/g, ' ').trim();
    if (desc.length >= 24) {
        return desc.length > max ? `${desc.slice(0, max).trim()}…` : desc;
    }
    const req = Array.isArray(job.requirements)
        ? job.requirements.filter(Boolean).join('. ')
        : String(job.requirements || '').replace(/\s+/g, ' ').trim();
    if (req.length >= 16) {
        return req.length > max ? `${req.slice(0, max).trim()}…` : req;
    }
    const resp = Array.isArray(job.responsibilities)
        ? job.responsibilities.filter(Boolean).join('. ')
        : String(job.responsibilities || '').replace(/\s+/g, ' ').trim();
    if (resp.length >= 16) {
        return resp.length > max ? `${resp.slice(0, max).trim()}…` : resp;
    }
    const dept = job.department ? `${job.department} team` : 'our team';
    const location = job.location ? ` based in ${job.location}` : '';
    return `Join the ${dept}${location} as ${job.jobTitle || 'a new hire'}. View details and apply in a few minutes.`;
};

function CareerJobCard({ job, organizationId }) {
    const visual = departmentVisual(job.department);
    const DeptIcon = visual.Icon;
    const closes = formatClosesMeta(job);
    const posted = formatPostedAgo(job);

    return (
        <Link to={`/careers/${organizationId}/jobs/${job._id}`} className="ats-open-card ats-public-job-card">
            <div className="ats-open-card__top">
                <span className={`ats-open-card__icon ats-open-card__icon--${visual.tone}`} aria-hidden>
                    <DeptIcon />
                </span>
            </div>

            {job.department ? (
                <p className={`ats-open-card__dept ats-open-card__dept--${visual.tone}`}>{job.department}</p>
            ) : null}
            <h3 className="ats-open-card__title">{job.jobTitle}</h3>
            <p className="ats-open-card__desc">{jobSummary(job, 120)}</p>

            <div className="ats-open-card__tags">
                {job.location ? (
                    <span className="ats-open-card__tag">
                        <FaMapMarkerAlt aria-hidden /> {job.location}
                    </span>
                ) : null}
                {job.employmentType ? (
                    <span className="ats-open-card__tag">
                        <FaClock aria-hidden /> {job.employmentType}
                    </span>
                ) : null}
            </div>

            <div className="ats-open-card__meta">
                <span>{posted || 'Recently posted'}</span>
                {closes ? (
                    <span className={closes.urgent ? 'ats-open-card__closes--urgent' : ''}>
                        {closes.urgent ? <FaClock aria-hidden /> : null}
                        {closes.label}
                    </span>
                ) : null}
            </div>

            <span className="ats-open-card__cta">View & Apply</span>
        </Link>
    );
}

const CareerPortal = () => {
    const { organizationId } = useParams();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [dept, setDept] = useState('');
    const [loc, setLoc] = useState('');
    const [empType, setEmpType] = useState('');
    const [openFilter, setOpenFilter] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                const { data } = await axios.get(`/v1/public/recruitment/${organizationId}/jobs`);
                if (!cancelled) setJobs(data.data || []);
            } catch {
                if (!cancelled) setError('Unable to load open positions');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [organizationId]);

    const closeFilters = useCallback(() => setOpenFilter(null), []);
    useHrmsPopupDismiss(closeFilters, Boolean(openFilter));

    const filterOptions = useMemo(() => ({
        departments: Array.from(new Set(jobs.map((j) => j.department).filter(Boolean))).sort(),
        locations: Array.from(new Set(jobs.map((j) => j.location).filter(Boolean))).sort(),
        employmentTypes: Array.from(new Set(jobs.map((j) => j.employmentType).filter(Boolean))).sort(),
    }), [jobs]);

    const filteredJobs = useMemo(() => {
        const q = query.trim().toLowerCase();
        return jobs.filter((job) => {
            if (dept && job.department !== dept) return false;
            if (loc && job.location !== loc) return false;
            if (empType && job.employmentType !== empType) return false;
            if (!q) return true;
            const hay = `${job.jobTitle || ''} ${job.department || ''} ${job.location || ''} ${job.employmentType || ''} ${job.jobDescription || ''}`.toLowerCase();
            return hay.includes(q);
        });
    }, [jobs, query, dept, loc, empType]);

    const hasFilters = !!(dept || loc || empType || query.trim());
    const featuredJob = filteredJobs.length > 1 ? filteredJobs[0] : null;
    const gridJobs = featuredJob ? filteredJobs.slice(1) : filteredJobs;
    const featuredCloses = featuredJob ? formatClosesMeta(featuredJob) : null;

    const quickStats = useMemo(() => ({
        departments: filterOptions.departments.length,
        locations: filterOptions.locations.length,
    }), [filterOptions]);

    if (loading) {
        return (
            <div className="cm-hrms ats-ui ats-public-shell ats-public-shell--loading">
                <LoadingSpinner message="Loading open positions…" />
            </div>
        );
    }

    return (
        <div className="cm-hrms ats-ui ats-public-shell ats-public-shell--portal">
            <main className="ats-public-main ats-public-main--portal">
                <div className="ats-public-board">
                    <header className="ats-public-board__hero">
                        <div className="ats-public-hero__top">
                            <div className="ats-public-hero__copy">
                                <p className="ats-public-hero__eyebrow">Careers</p>
                                <h1 className="ats-public-hero__title">Find Your Next Role</h1>
                                <p className="ats-public-hero__subtitle">
                                    Explore open opportunities across departments and apply in minutes.
                                </p>
                                <div className="ats-public-hero__stats">
                                    <div className="ats-public-hero__stat">
                                        <span className="ats-public-hero__stat-value">{filteredJobs.length}</span>
                                        <span className="ats-public-hero__stat-label">
                                            open {filteredJobs.length === 1 ? 'role' : 'roles'}
                                        </span>
                                    </div>
                                    {quickStats.departments > 0 ? (
                                        <div className="ats-public-hero__stat">
                                            <span className="ats-public-hero__stat-value">{quickStats.departments}</span>
                                            <span className="ats-public-hero__stat-label">
                                                {quickStats.departments === 1 ? 'department' : 'departments'}
                                            </span>
                                        </div>
                                    ) : null}
                                    {quickStats.locations > 0 ? (
                                        <div className="ats-public-hero__stat">
                                            <span className="ats-public-hero__stat-value">{quickStats.locations}</span>
                                            <span className="ats-public-hero__stat-label">
                                                {quickStats.locations === 1 ? 'location' : 'locations'}
                                            </span>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                            <div className="ats-public-hero__tools">
                                <p className="ats-public-hero__tools-label">Search &amp; filter roles</p>
                                <CmSearch
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search jobs, keywords, or skills…"
                                    className="ats-public-hero__search-input"
                                />
                                <div className="ats-open-filters ats-public-filters ats-public-filters--hero">
                                    {[
                                        { key: 'dept', label: 'Department', value: dept, set: setDept, options: filterOptions.departments },
                                        { key: 'loc', label: 'Location', value: loc, set: setLoc, options: filterOptions.locations },
                                        { key: 'emp', label: 'Employment Type', value: empType, set: setEmpType, options: filterOptions.employmentTypes },
                                    ].map((f) => (
                                        <div key={f.key} className="relative">
                                            <button
                                                type="button"
                                                className={`ats-open-filter-pill ${f.value ? 'ats-open-filter-pill--active' : ''}`}
                                                aria-expanded={openFilter === f.key}
                                                data-hrms-popup-trigger
                                                onClick={() => setOpenFilter(openFilter === f.key ? null : f.key)}
                                            >
                                                <span>{f.value || f.label}</span>
                                                <FaChevronDown className="h-2.5 w-2.5 shrink-0 opacity-60" />
                                            </button>
                                            {openFilter === f.key && (
                                                <div className="ats-open-filter-menu" role="menu">
                                                    <button
                                                        type="button"
                                                        className="ats-open-filter-menu__item"
                                                        onClick={() => { f.set(''); setOpenFilter(null); }}
                                                    >
                                                        All {f.label.toLowerCase()}s
                                                    </button>
                                                    {f.options.map((opt) => (
                                                        <button
                                                            key={opt}
                                                            type="button"
                                                            className={`ats-open-filter-menu__item ${f.value === opt ? 'ats-open-filter-menu__item--active' : ''}`}
                                                            onClick={() => { f.set(opt); setOpenFilter(null); }}
                                                        >
                                                            {opt}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {hasFilters ? (
                                        <button
                                            type="button"
                                            className="ats-link text-sm shrink-0"
                                            onClick={() => {
                                                setDept('');
                                                setLoc('');
                                                setEmpType('');
                                                setQuery('');
                                                setOpenFilter(null);
                                            }}
                                        >
                                            Clear all
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        {filterOptions.departments.length > 1 ? (
                            <div className="ats-public-dept-chips" aria-label="Browse by department">
                                <span className="ats-public-dept-chips__label">Browse:</span>
                                {filterOptions.departments.map((name) => (
                                    <button
                                        key={name}
                                        type="button"
                                        className={`ats-public-dept-chip ${dept === name ? 'ats-public-dept-chip--active' : ''}`}
                                        onClick={() => setDept(dept === name ? '' : name)}
                                    >
                                        {name}
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </header>

                {error && (
                    <p className="ats-public-error">{error}</p>
                )}

                {!error && filteredJobs.length === 0 && (
                    <AtsEmpty
                        icon={FaBriefcase}
                        title={jobs.length === 0 ? 'No open positions at the moment' : 'No jobs match your filters'}
                        hint={jobs.length === 0 ? 'Please check back soon for new openings.' : 'Try a different keyword or clear filters.'}
                    />
                )}

                {!error && filteredJobs.length > 0 && (
                    <div className="ats-open-roles ats-public-roles">
                        {featuredJob && (
                            <>
                                <div className="ats-public-section-head">
                                    <h2 className="ats-public-section-head__title">Featured role</h2>
                                    <p className="ats-public-section-head__hint"></p>
                                </div>
                                <article className="ats-featured-role ats-featured-role--portal">
                                    <div className="ats-featured-role__media" aria-hidden>
                                        <img
                                            className="ats-featured-role__image"
                                            src="/images/recruitment/featured-role.jpg"
                                            alt=""
                                        />
                                        <span className="ats-featured-role__badge">
                                            <FaStar /> Featured Role
                                        </span>
                                    </div>
                                    <div className="ats-featured-role__body">
                                        <div className="ats-featured-role__tags">
                                            {featuredJob.department && (
                                                <span className="ats-featured-role__tag">{featuredJob.department}</span>
                                            )}
                                            {featuredJob.location && (
                                                <span className="ats-featured-role__tag">{featuredJob.location}</span>
                                            )}
                                            {featuredJob.employmentType && (
                                                <span className="ats-featured-role__tag">{featuredJob.employmentType}</span>
                                            )}
                                        </div>
                                        <h2 className="ats-featured-role__title">{featuredJob.jobTitle}</h2>
                                        <p className="ats-featured-role__desc">
                                            {jobSummary(featuredJob, 200)}
                                        </p>
                                        <div className="ats-featured-role__footer">
                                            <div className="ats-featured-role__dates">
                                                <span>{formatPostedAgo(featuredJob) || 'Recently posted'}</span>
                                                {featuredCloses && (
                                                    <span className={featuredCloses.urgent ? 'ats-open-card__closes--urgent' : ''}>
                                                        {featuredCloses.urgent ? <FaClock aria-hidden /> : null}
                                                        {featuredCloses.label}
                                                    </span>
                                                )}
                                            </div>
                                            <Link
                                                to={`/careers/${organizationId}/jobs/${featuredJob._id}`}
                                                className="ats-featured-role__cta"
                                            >
                                                Apply Now <FaArrowRight className="h-3 w-3" />
                                            </Link>
                                        </div>
                                    </div>
                                </article>
                            </>
                        )}

                        {gridJobs.length > 0 && (
                            <>
                                <div className="ats-public-section-head">
                                    <h2 className="ats-public-section-head__title">
                                        {featuredJob ? 'More open roles' : 'Open roles'}
                                    </h2>
                                    <p className="ats-public-section-head__hint">
                                        {gridJobs.length} {gridJobs.length === 1 ? 'position' : 'positions'} available
                                    </p>
                                </div>
                                <div className="ats-open-grid ats-open-grid--portal">
                                    {gridJobs.map((job) => (
                                        <CareerJobCard key={job._id} job={job} organizationId={organizationId} />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {!error && filteredJobs.length > 0 && (
                    <div className="ats-public-value-strip">
                        {[
                            { title: 'Simple application', text: 'Apply in minutes with your resume and basic details.' },
                            { title: 'Transparent process', text: 'Track progress after you submit your application.' },
                            { title: 'Teams that grow', text: 'Roles across departments with room to develop.' },
                        ].map((item) => (
                            <div key={item.title} className="ats-public-value-strip__item">
                                <h3>{item.title}</h3>
                                <p>{item.text}</p>
                            </div>
                        ))}
                    </div>
                )}
                </div>
            </main>
        </div>
    );
};

export default CareerPortal;
