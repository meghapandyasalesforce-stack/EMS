import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FaBriefcase, FaMapMarkerAlt, FaChevronDown, FaSlidersH } from 'react-icons/fa';
import axios from '../utils/axios';
import { AtsEmpty } from '../components/recruitment/atsUi';
import { CmSearch } from '../components/corporateModern';

const employmentChip = (type = '') => {
    const t = String(type).toLowerCase();
    if (t.includes('contract')) return 'ats-chip ats-chip--tertiary';
    if (t.includes('part')) return 'ats-chip ats-chip--part';
    return 'ats-chip ats-chip--primary';
};

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
            const hay = `${job.jobTitle || ''} ${job.department || ''} ${job.location || ''} ${job.employmentType || ''}`.toLowerCase();
            return hay.includes(q);
        });
    }, [jobs, query, dept, loc, empType]);

    const hasFilters = !!(dept || loc || empType);

    return (
        <div className="cm-hrms ats-ui ats-public-shell">
            <header className="ats-public-header">
                <div className="ats-public-header__inner">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="min-w-0">
                            <h1 className="ats-page-title">Find Your Next Role</h1>
                            <p className="ats-page-subtitle">
                                Explore open opportunities across all departments.
                            </p>
                        </div>
                        <div className="w-full max-w-md shrink-0">
                            <CmSearch
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search jobs, keywords, or skills..."
                            />
                        </div>
                    </div>
                </div>
            </header>

            <main className="ats-public-main space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="ats-filter-pills">
                        {[
                            { key: 'dept', label: 'Department', value: dept, set: setDept, options: filterOptions.departments },
                            { key: 'loc', label: 'Location', value: loc, set: setLoc, options: filterOptions.locations },
                            { key: 'emp', label: 'Employment Type', value: empType, set: setEmpType, options: filterOptions.employmentTypes },
                        ].map((f) => (
                            <div key={f.key} className="relative">
                                <button
                                    type="button"
                                    className={`ats-filter-pill ${f.value ? 'ats-filter-pill--active' : ''}`}
                                    onClick={() => setOpenFilter(openFilter === f.key ? null : f.key)}
                                >
                                    {f.value || f.label}
                                    <FaChevronDown className="h-2.5 w-2.5 opacity-60" />
                                </button>
                                {openFilter === f.key && (
                                    <div
                                        className="absolute left-0 z-20 mt-2 max-h-56 min-w-[180px] overflow-y-auto rounded-xl bg-white py-2"
                                        style={{ boxShadow: 'var(--ats-shadow-md)' }}
                                    >
                                        <button
                                            type="button"
                                            className="block w-full px-4 py-2 text-left text-sm hover:bg-[rgba(28,202,155,0.08)]"
                                            onClick={() => { f.set(''); setOpenFilter(null); }}
                                        >
                                            All
                                        </button>
                                        {f.options.map((opt) => (
                                            <button
                                                key={opt}
                                                type="button"
                                                className="block w-full px-4 py-2 text-left text-sm hover:bg-[rgba(28,202,155,0.08)]"
                                                onClick={() => { f.set(opt); setOpenFilter(null); }}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        {hasFilters && (
                            <button
                                type="button"
                                className="ats-link text-sm"
                                onClick={() => { setDept(''); setLoc(''); setEmpType(''); setOpenFilter(null); }}
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: 'rgba(15,45,38,0.45)' }}>
                        <FaSlidersH className="h-3 w-3" /> {filteredJobs.length} roles
                    </span>
                </div>

                {loading && (
                    <p className="text-sm" style={{ color: 'rgba(15,45,38,0.55)' }}>Loading open positions…</p>
                )}
                {error && (
                    <p className="text-sm font-medium" style={{ color: 'var(--ats-error)' }}>{error}</p>
                )}
                {!loading && !error && filteredJobs.length === 0 && (
                    <AtsEmpty
                        icon={FaBriefcase}
                        title={jobs.length === 0 ? 'No open positions at the moment' : 'No jobs match your filters'}
                        hint={jobs.length === 0 ? 'Please check back soon for new openings.' : 'Try a different keyword or clear filters.'}
                    />
                )}
                {!loading && !error && filteredJobs.length > 0 && (
                    <div className="ats-job-grid">
                        {filteredJobs.map((job) => (
                            <Link
                                key={job._id}
                                to={`/careers/${organizationId}/jobs/${job._id}`}
                                className="ats-job-card"
                            >
                                <div className="ats-job-card__top">
                                    <span className={employmentChip(job.employmentType)}>
                                        {String(job.employmentType || 'Full-time').toUpperCase()}
                                    </span>
                                </div>
                                <h3 className="ats-job-card__title">{job.jobTitle}</h3>
                                <p className="ats-job-card__dept">{job.department}</p>
                                <p className="ats-job-card__loc">
                                    <FaMapMarkerAlt className="h-3 w-3" />
                                    {job.location || '—'}
                                </p>
                                <span className="ats-job-card__cta">View Details</span>
                            </Link>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default CareerPortal;
