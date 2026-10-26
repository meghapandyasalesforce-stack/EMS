import React, { useEffect, useState } from 'react';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import LoadingSpinner from '../../components/LoadingSpinner';

const unitLabel = (unit) => {
    if (unit === 'half_day') return 'Half day';
    if (unit === 'full_day') return 'Full day';
    return 'Hours';
};

const CompOffRequests = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('pending');
    const [busyId, setBusyId] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/v1/admin/comp-off/requests', {
                params: { status, limit: 50 },
                withCredentials: true,
            });
            const list = Array.isArray(response.data?.data) ? response.data.data : [];
            setRows(list);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not load comp-off requests');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [status]);

    const decide = async (id, action) => {
        setBusyId(id);
        try {
            await axios.put(`/v1/admin/comp-off/${action}/${id}`, {}, { withCredentials: true });
            toast.success(action === 'approve' ? 'Approved' : 'Rejected');
            await load();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not update the request');
        } finally {
            setBusyId(null);
        }
    };

    if (loading) return <LoadingSpinner message="Loading comp-off requests..." />;

    return (
        <div className="mx-auto max-w-5xl p-4 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
                <h1 className="text-2xl font-semibold text-gray-900">Comp-off requests</h1>
                <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                </select>
            </div>
            {rows.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">No {status} requests.</p>
            ) : (
                <ul className="space-y-3">
                    {rows.map((item) => {
                        const person = item.employeeId?.name
                            ? `${item.employeeId.name} ${item.employeeId.lastName || ''}`.trim()
                            : item.employeeName;
                        return (
                            <li key={item._id} className="rounded-xl border border-gray-200 bg-white p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="font-medium text-gray-900">{person}</p>
                                    <span className="text-sm text-gray-500">{item.workDateKey}</span>
                                </div>
                                <p className="mt-1 text-sm text-gray-600">
                                    {unitLabel(item.requestUnit)}
                                    {item.requestUnit === 'hours' && item.startTime ? ` · ${item.startTime}–${item.endTime} (${item.requestedHours}h)` : ''}
                                </p>
                                <p className="mt-2 text-sm text-gray-800">{item.reason}</p>
                                {item.status === 'pending' && (
                                    <div className="mt-3 flex gap-2">
                                        <button
                                            type="button"
                                            disabled={busyId === item._id}
                                            onClick={() => decide(item._id, 'approve')}
                                            className="rounded-lg bg-theme-primary px-3 py-1.5 text-sm text-white disabled:opacity-60"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busyId === item._id}
                                            onClick={() => decide(item._id, 'reject')}
                                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-60"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default CompOffRequests;
