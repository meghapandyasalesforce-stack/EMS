import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from '../utils/axios';

const CareerPortal = () => {
    const { organizationId } = useParams();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="border-b bg-white">
                <div className="mx-auto max-w-4xl px-4 py-8">
                    <h1 className="text-3xl font-bold text-slate-900">Careers</h1>
                    <p className="mt-2 text-slate-600">Open positions — apply online</p>
                </div>
            </header>
            <main className="mx-auto max-w-4xl px-4 py-8">
                {loading && <p className="text-slate-500">Loading jobs…</p>}
                {error && <p className="text-red-600">{error}</p>}
                {!loading && !error && jobs.length === 0 && (
                    <p className="text-slate-500">No open positions at the moment.</p>
                )}
                <div className="space-y-4">
                    {jobs.map((job) => (
                        <Link
                            key={job._id}
                            to={`/careers/${organizationId}/jobs/${job._id}`}
                            className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-400"
                        >
                            <h2 className="text-xl font-semibold text-slate-900">{job.jobTitle}</h2>
                            <p className="mt-1 text-sm text-slate-600">{job.department} · {job.location} · {job.employmentType}</p>
                        </Link>
                    ))}
                </div>
            </main>
        </div>
    );
};

export default CareerPortal;
