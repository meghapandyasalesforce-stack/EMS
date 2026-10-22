import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaPlus,
    FaPlay,
    FaPause,
    FaArchive,
    FaEye,
    FaEdit,
    FaRedo,
    FaChartBar
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';

const MINT = '#0E9370';

const statusStyle = (status) => {
    if (status === 'Active') return 'bg-emerald-100 text-emerald-700';
    if (status === 'Draft') return 'bg-amber-100 text-amber-700';
    if (status === 'Paused') return 'bg-orange-100 text-orange-700';
    if (status === 'Completed') return 'bg-blue-100 text-blue-700';
    if (status === 'Archived') return 'bg-slate-100 text-slate-500';
    return 'bg-slate-100 text-slate-600';
};

const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const PulsePrograms = () => {
    const navigate = useNavigate();
    const [programs, setPrograms] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchPrograms = useCallback(async () => {
        try {
            const { data } = await axios.get('/v1/admin/engagement/pulse-programs');
            setPrograms(data.data || []);
        } catch {
            toast.error('Failed to load pulse programs');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchPrograms(); }, [fetchPrograms]);

    const handleAction = async (id, action, verb) => {
        try {
            await axios.post(`/v1/admin/engagement/pulse-programs/${id}/${action}`);
            toast.success(`Pulse program ${verb}`);
            fetchPrograms();
        } catch (err) {
            toast.error(err?.response?.data?.message || `Failed to ${verb} program`);
        }
    };

    if (loading) return <LoadingSpinner />;

    const active = programs.filter((p) => p.status === 'Active');
    const other = programs.filter((p) => p.status !== 'Active');

    const renderTable = (items, heading) => {
        if (!items.length) return null;
        return (
            <div className="mb-6">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{heading}</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-500">
                                <th className="py-3 pr-4">Program</th>
                                <th className="py-3 pr-4">Frequency</th>
                                <th className="py-3 pr-4">Audience</th>
                                <th className="py-3 pr-4">Status</th>
                                <th className="py-3 pr-4">Next Pulse</th>
                                <th className="py-3 pr-4">Last Pulse</th>
                                <th className="py-3 pr-4">Occurrences</th>
                                <th className="py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((p) => (
                                <tr key={p._id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                    <td className="py-3 pr-4 font-medium text-slate-900">{p.name}</td>
                                    <td className="py-3 pr-4 text-slate-600">{p.frequency}</td>
                                    <td className="py-3 pr-4 text-slate-600">{p.targetAudience}</td>
                                    <td className="py-3 pr-4">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle(p.status)}`}>
                                            {p.status}
                                        </span>
                                    </td>
                                    <td className="py-3 pr-4 text-slate-600">{fmtDate(p.nextRunAt)}</td>
                                    <td className="py-3 pr-4 text-slate-600">{fmtDate(p.lastRunAt)}</td>
                                    <td className="py-3 pr-4 text-slate-600">{p.occurrenceCount || 0}{p.maxOccurrences ? ` / ${p.maxOccurrences}` : ''}</td>
                                    <td className="py-3">
                                        <div className="flex items-center gap-1.5">
                                            <button type="button" title="View"
                                                onClick={() => navigate(`/engagement/pulse/${p._id}`)}
                                                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                                                <FaEye className="h-3.5 w-3.5" />
                                            </button>
                                            {(p.status === 'Draft') && (
                                                <>
                                                    <button type="button" title="Edit"
                                                        onClick={() => navigate(`/engagement/pulse/${p._id}/edit`)}
                                                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                                                        <FaEdit className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button type="button" title="Activate"
                                                        onClick={() => handleAction(p._id, 'activate', 'activated')}
                                                        className="rounded-lg p-1.5 text-emerald-500 hover:bg-emerald-50 hover:text-emerald-700">
                                                        <FaPlay className="h-3.5 w-3.5" />
                                                    </button>
                                                </>
                                            )}
                                            {p.status === 'Active' && (
                                                <button type="button" title="Pause"
                                                    onClick={() => handleAction(p._id, 'pause', 'paused')}
                                                    className="rounded-lg p-1.5 text-orange-500 hover:bg-orange-50 hover:text-orange-700">
                                                    <FaPause className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                            {p.status === 'Paused' && (
                                                <>
                                                    <button type="button" title="Resume"
                                                        onClick={() => handleAction(p._id, 'resume', 'resumed')}
                                                        className="rounded-lg p-1.5 text-emerald-500 hover:bg-emerald-50 hover:text-emerald-700">
                                                        <FaRedo className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button type="button" title="Edit"
                                                        onClick={() => navigate(`/engagement/pulse/${p._id}/edit`)}
                                                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                                                        <FaEdit className="h-3.5 w-3.5" />
                                                    </button>
                                                </>
                                            )}
                                            {['Paused', 'Completed', 'Draft'].includes(p.status) && (
                                                <button type="button" title="Archive"
                                                    onClick={() => handleAction(p._id, 'archive', 'archived')}
                                                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                                                    <FaArchive className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                            {p.occurrenceCount > 0 && (
                                                <button type="button" title="Analytics"
                                                    onClick={() => navigate(`/engagement/pulse/${p._id}`, { state: { tab: 'analytics' } })}
                                                    className="rounded-lg p-1.5 text-blue-500 hover:bg-blue-50 hover:text-blue-700">
                                                    <FaChartBar className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Pulse Programs</h2>
                    <p className="text-sm text-slate-500">Recurring pulse surveys that generate automatically</p>
                </div>
                <button
                    type="button"
                    onClick={() => navigate('/engagement/pulse/create')}
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
                    style={{ background: MINT }}
                >
                    <FaPlus className="h-3.5 w-3.5" />
                    Create Pulse
                </button>
            </div>

            {programs.length === 0 ? (
                <div className="py-16 text-center">
                    <h3 className="text-lg font-semibold text-slate-900">No pulse programs yet</h3>
                    <p className="mt-2 text-sm text-slate-500">Create a recurring pulse program to get started.</p>
                </div>
            ) : (
                <>
                    {renderTable(active, 'Active Programs')}
                    {renderTable(other, 'Other Programs')}
                </>
            )}
        </div>
    );
};

export default PulsePrograms;
