import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import LoadingSpinner from '../../components/LoadingSpinner';

const emptyForm = {
    date: '',
    requestUnit: 'hours',
    startTime: '',
    endTime: '',
    reason: '',
};

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const dateKeyFromValue = (value) => {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return '';
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const formatDay = (key) => {
    if (!key) return '—';
    const dt = new Date(`${key}T12:00:00`);
    if (Number.isNaN(dt.getTime())) return key;
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatHours = (hours) => {
    const n = Number(hours) || 0;
    const h = Math.floor(n);
    const m = Math.round((n - h) * 60);
    return `${h}h ${String(m).padStart(2, '0')}m`;
};

const suggestedCredit = (hours) => {
    const n = Number(hours) || 0;
    if (n >= 8) return { label: '1.0 Day', unit: 'full_day' };
    if (n >= 4) return { label: '0.5 Day', unit: 'half_day' };
    return { label: formatHours(n), unit: 'hours' };
};

const unitLabel = (unit) => {
    if (unit === 'half_day') return 'Half day';
    if (unit === 'full_day') return 'Full day';
    return 'Hours';
};

const usedDaysOf = (item) => {
    const credited = Number(item?.creditDays) || 0;
    const used = Number(item?.usedDays);
    if (Number.isFinite(used) && used > 0) return used;
    return item?.isUsed ? credited : 0;
};

const remainingDaysOf = (item) => {
    const credited = Number(item?.creditDays) || 0;
    return Math.max(0, Math.round((credited - usedDaysOf(item)) * 100) / 100);
};

const creditLabel = (item) => {
    if (item.requestUnit === 'half_day') return '0.5 Day';
    if (item.requestUnit === 'full_day') return '1.0 Day';
    if (item.creditDays >= 1) return `${Number(item.creditDays).toFixed(1)} Day`;
    if (item.creditDays > 0) return `${Number(item.creditDays).toFixed(1)} Day`;
    if (item.requestedHours) return formatHours(item.requestedHours);
    return '—';
};

const MyCompOffRequests = () => {
    const navigate = useNavigate();
    const [requests, setRequests] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [calendar, setCalendar] = useState(null);
    const [validityDays, setValidityDays] = useState(90);
    const [compOffEnabled, setCompOffEnabled] = useState(true);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [submitting, setSubmitting] = useState(false);
    const [year, setYear] = useState(new Date().getFullYear());
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');

    const load = async (selectedYear) => {
        setLoading(true);
        try {
            const [compRes, logsRes, calendarRes, ruleRes] = await Promise.all([
                axios.get('/v1/both/comp-off/request', { withCredentials: true }),
                axios.get('/v1/both/attendance/get-logs', {
                    params: { startDate: `${selectedYear}-01-01`, endDate: `${selectedYear}-12-31` },
                    withCredentials: true,
                }),
                axios.get(`/v1/employee/calendar/${selectedYear}`, { withCredentials: true }).catch(() => ({ data: null })),
                axios.get('/v1/both/attendance/rule', { withCredentials: true }).catch(() => ({ data: null })),
            ]);
            setRequests(compRes.data?.compOffs || []);
            setSessions(logsRes.data?.sessions || []);
            setCalendar(calendarRes.data || null);
            const rule = ruleRes.data?.rule;
            if (rule?.compOffValidityDays) setValidityDays(rule.compOffValidityDays);
            if (rule && rule.enableCompOff === false) setCompOffEnabled(false);
            else setCompOffEnabled(true);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not load comp-off');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(year);
    }, [year]);

    const requestByDate = useMemo(() => {
        const map = new Map();
        requests.forEach((item) => {
            const key = item.workDateKey || dateKeyFromValue(item.date);
            if (!key) return;
            const current = map.get(key);
            if (!current || (current.status === 'rejected' && item.status !== 'rejected')) {
                map.set(key, item);
            }
        });
        return map;
    }, [requests]);

    const eligibleDays = useMemo(() => {
        const workingDays = calendar?.workingDays || {
            monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false,
        };
        const holidays = new Map();
        (calendar?.holidays || []).forEach((holiday) => {
            if (holiday?.isActive === false) return;
            const key = dateKeyFromValue(holiday.date);
            if (key) holidays.set(key, holiday.name || 'Holiday');
        });

        return (sessions || [])
            .map((session) => {
                const key = session.attendanceDateKey || dateKeyFromValue(session.date || session.clockIn);
                if (!key || !key.startsWith(String(year))) return null;
                if (!session.clockOut) return null;
                const dt = new Date(`${key}T12:00:00`);
                const dayName = WEEKDAYS[dt.getDay()];
                const holidayName = holidays.get(key);
                const isOffDay = holidayName || workingDays[dayName] === false;
                if (!isOffDay) return null;
                const hours = Number(session.effectiveHours) || 0;
                if (hours <= 0) return null;
                const credit = suggestedCredit(hours);
                const request = requestByDate.get(key);
                let status = 'eligible';
                if (request?.status === 'pending') status = 'requested';
                else if (request?.status === 'approved') {
                    const expired = request.expiryDate && new Date(request.expiryDate) < new Date();
                    if (expired || request.isExpired) status = 'expired';
                    else if (request.isUsed || remainingDaysOf(request) <= 0) status = 'used';
                    else status = 'credited';
                } else if (request?.status === 'rejected') status = 'rejected';
                return {
                    key,
                    dayType: holidayName ? `${holidayName} (Holiday)` : dayName === 'saturday' ? 'Weekend (Sat)' : dayName === 'sunday' ? 'Weekend (Sun)' : 'Non-working day',
                    hours,
                    credit,
                    status,
                    request,
                    clockIn: session.clockIn,
                    clockOut: session.clockOut,
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.key.localeCompare(a.key));
    }, [sessions, calendar, requestByDate, year]);

    const ledger = useMemo(() => {
        const query = search.trim().toLowerCase();
        return requests
            .filter((item) => {
                const key = item.workDateKey || dateKeyFromValue(item.date);
                if (key && !key.startsWith(String(year))) return false;
                if (statusFilter !== 'all' && item.status !== statusFilter) return false;
                if (!query) return true;
                return `${key} ${item.reason || ''} ${item.status}`.toLowerCase().includes(query);
            })
            .sort((a, b) => String(b.workDateKey || b.date).localeCompare(String(a.workDateKey || a.date)));
    }, [requests, year, statusFilter, search]);

    const stats = useMemo(() => {
        const now = new Date();
        const soon = new Date();
        soon.setDate(soon.getDate() + 30);
        let available = 0;
        let pending = 0;
        let used = 0;
        let expiring = 0;
        let expiringDate = null;
        requests.forEach((item) => {
            const key = item.workDateKey || dateKeyFromValue(item.date);
            if (item.status === 'pending') pending += 1;
            const days = Number(item.creditDays) || 0;
            const taken = usedDaysOf(item);
            const remaining = Math.max(0, Math.round((days - taken) * 100) / 100);
            if (item.status === 'approved' && days > 0) {
                const expired = item.isExpired || (item.expiryDate && new Date(item.expiryDate) < now);
                if (!key || key.startsWith(String(year))) used += taken;
                if (!expired) {
                    available += remaining;
                    if (remaining > 0 && item.expiryDate && new Date(item.expiryDate) <= soon) {
                        expiring += remaining;
                        if (!expiringDate || new Date(item.expiryDate) < new Date(expiringDate)) {
                            expiringDate = item.expiryDate;
                        }
                    }
                }
            }
        });
        return { available, pending, used, expiring, expiringDate };
    }, [requests, year]);

    const openRequest = (prefill = {}) => {
        setForm({ ...emptyForm, ...prefill });
        setShowForm(true);
    };

    const onSubmit = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        try {
            await axios.post('/v1/both/comp-off/request', form, { withCredentials: true });
            toast.success('Comp-off request sent');
            setShowForm(false);
            setForm(emptyForm);
            await load(year);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not send the request');
        } finally {
            setSubmitting(false);
        }
    };

    const cancelRequest = async (id) => {
        try {
            await axios.delete(`/v1/both/comp-off/cancel/${id}`, { withCredentials: true });
            toast.success('Request cancelled');
            await load(year);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not cancel the request');
        }
    };

    const downloadStatement = () => {
        const header = ['Date', 'Claim', 'Hours', 'Credited days', 'Status', 'Expiry', 'Reason'];
        const lines = requests.map((item) => [
            item.workDateKey || dateKeyFromValue(item.date),
            unitLabel(item.requestUnit),
            item.requestedHours || '',
            item.creditDays || '',
            item.status,
            item.expiryDate ? dateKeyFromValue(item.expiryDate) : '',
            `"${String(item.reason || '').replace(/"/g, '""')}"`,
        ].join(','));
        const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `comp-off-${year}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const useCompOff = () => {
        navigate('/leave', { state: { leaveType: 'compensatory' } });
    };

    if (loading) return <LoadingSpinner message="Loading comp-off..." />;

    return (
        <div className="min-h-full bg-[#F7F8FA] px-4 py-6 md:px-8">
            <div className="mx-auto max-w-6xl">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Workspace / Time</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <h1 className="text-3xl font-semibold text-slate-900">Comp-Off</h1>
                    <div className="flex gap-2">
                        <button type="button" onClick={downloadStatement} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                            Download statement
                        </button>
                        <button type="button" onClick={() => openRequest()} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white">
                            + Request Comp-Off
                        </button>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                    {[
                        ['Attendance', '/employee/leave-attendance'],
                        ['Leave', '/leave'],
                        ['Comp-Off', null],
                        ['Regularization', '/my-attendance-regularization'],
                        ['Calendar', '/employee/calendar'],
                    ].map(([label, path]) => (
                        <button
                            key={label}
                            type="button"
                            onClick={() => path && navigate(path)}
                            className={`rounded-full px-3 py-1.5 ${path ? 'text-slate-500 hover:bg-white' : 'bg-emerald-600 font-medium text-white'}`}
                        >
                            {label}
                            {label === 'Comp-Off' && stats.pending > 0 ? ` · ${stats.pending} pending` : ''}
                        </button>
                    ))}
                </div>

                {!compOffEnabled && (
                    <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        Comp-off is turned off for this organization. Ask an admin to enable it in Attendance Rules.
                    </p>
                )}

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard title="Available balance" value={`${stats.available.toFixed(1)} Days`} hint="Ready to use as compensatory leave" />
                    <StatCard title="Pending requests" value={`${stats.pending} Claim${stats.pending === 1 ? '' : 's'}`} hint="Waiting for a manager" />
                    <StatCard title="Used this year" value={`${stats.used.toFixed(1)} Days`} hint={`${year} credited leave that was used`} />
                    <StatCard
                        title="Expiring soon"
                        value={`${stats.expiring.toFixed(1)} Day`}
                        hint={stats.expiringDate ? `Expires ${formatDay(dateKeyFromValue(stats.expiringDate))}` : `Use within ${validityDays} days of credit`}
                        warn={stats.expiring > 0}
                    />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                    <p>Comp-off must be used within {validityDays} days of credit. A weekend or holiday punch stays eligible until you send a request. Hours after you have already punched out are requested with a start and end time. An earlier end time counts as the next morning.</p>
                </div>

                {showForm && (
                    <form onSubmit={onSubmit} className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2">
                        <label className="text-sm">
                            <span className="mb-1 block font-medium text-slate-700">Date</span>
                            <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
                        </label>
                        <label className="text-sm">
                            <span className="mb-1 block font-medium text-slate-700">Claim</span>
                            <select value={form.requestUnit} onChange={(e) => setForm({ ...form, requestUnit: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2">
                                <option value="hours">Hours</option>
                                <option value="half_day">Half day</option>
                                <option value="full_day">Full day</option>
                            </select>
                        </label>
                        {form.requestUnit === 'hours' && (
                            <>
                                <label className="text-sm">
                                    <span className="mb-1 block font-medium text-slate-700">Start</span>
                                    <input type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
                                </label>
                                <label className="text-sm">
                                    <span className="mb-1 block font-medium text-slate-700">End</span>
                                    <input type="time" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
                                </label>
                                <p className="text-xs text-slate-500 md:col-span-2">If the end time is earlier than the start, it counts as the next morning. 20:00 to 02:00 is 6 hours on the start date.</p>
                            </>
                        )}
                        <label className="text-sm md:col-span-2">
                            <span className="mb-1 block font-medium text-slate-700">Reason</span>
                            <textarea required rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2" placeholder="What was the extra work?" />
                        </label>
                        <div className="flex gap-2 md:col-span-2">
                            <button type="submit" disabled={submitting} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                                {submitting ? 'Sending...' : 'Send request'}
                            </button>
                            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Close</button>
                        </div>
                    </form>
                )}

                <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-100 px-4 py-4">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Eligible extra work days</h2>
                            <p className="text-sm text-slate-500">Weekend and holiday punches. Credit is suggested from the hours worked. Sending a request does not add leave until it is approved.</p>
                        </div>
                        <span className="text-xs text-slate-400">From your punch log</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Date</th>
                                    <th className="px-4 py-3 font-medium">Day type</th>
                                    <th className="px-4 py-3 font-medium">Hours worked</th>
                                    <th className="px-4 py-3 font-medium">Credit</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {eligibleDays.length === 0 ? (
                                    <tr><td colSpan={6} className="px-4 py-8 text-slate-500">No weekend or holiday punches in {year}. Use Request Comp-Off for work done after you punched out.</td></tr>
                                ) : eligibleDays.map((row) => (
                                    <tr key={row.key} className="border-t border-slate-100">
                                        <td className="px-4 py-3 font-medium text-slate-800">{formatDay(row.key)}</td>
                                        <td className="px-4 py-3 text-slate-600">{row.dayType}</td>
                                        <td className="px-4 py-3 text-slate-700">{formatHours(row.hours)}</td>
                                        <td className="px-4 py-3 text-slate-700">{row.credit.label}</td>
                                        <td className="px-4 py-3"><StatusPill status={row.status} /></td>
                                        <td className="px-4 py-3">
                                            {row.status === 'eligible' || row.status === 'rejected' ? (
                                                <button
                                                    type="button"
                                                    onClick={() => openRequest({
                                                        date: row.key,
                                                        requestUnit: row.credit.unit,
                                                        startTime: toTime(row.clockIn),
                                                        endTime: toTime(row.clockOut),
                                                    })}
                                                    className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
                                                >
                                                    Request Comp-Off
                                                </button>
                                            ) : null}
                                            {row.status === 'requested' ? <span className="text-xs text-slate-500">Under review</span> : null}
                                            {row.status === 'credited' ? (
                                                <button type="button" onClick={useCompOff} className="rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700">Use Comp-Off</button>
                                            ) : null}
                                            {row.status === 'used' ? <span className="text-xs text-slate-400">Fully used</span> : null}
                                            {row.status === 'expired' ? <span className="text-xs text-slate-400">Expired</span> : null}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Comp-off ledger</h2>
                            <p className="text-sm text-slate-500">Credits, pending claims, and expiries.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ledger..." className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                                <option value="all">All statuses</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                                {[0, 1, 2].map((offset) => {
                                    const value = new Date().getFullYear() - offset;
                                    return <option key={value} value={value}>{value}</option>;
                                })}
                            </select>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Date earned</th>
                                    <th className="px-4 py-3 font-medium">Credited</th>
                                    <th className="px-4 py-3 font-medium">Used on</th>
                                    <th className="px-4 py-3 font-medium">Balance</th>
                                    <th className="px-4 py-3 font-medium">Expiry</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ledger.length === 0 ? (
                                    <tr><td colSpan={7} className="px-4 py-8 text-slate-500">No comp-off records for {year}.</td></tr>
                                ) : ledger.map((item) => {
                                    const key = item.workDateKey || dateKeyFromValue(item.date);
                                    const expired = item.isExpired || (item.expiryDate && new Date(item.expiryDate) < new Date());
                                    const days = Number(item.creditDays) || 0;
                                    const taken = usedDaysOf(item);
                                    const balance = item.status === 'approved' && !expired ? Math.max(0, Math.round((days - taken) * 100) / 100) : 0;
                                    return (
                                        <tr key={item._id} className="border-t border-slate-100">
                                            <td className="px-4 py-3 font-medium text-slate-800">{formatDay(key)}</td>
                                            <td className="px-4 py-3 text-emerald-700">{creditLabel(item)}</td>
                                            <td className="px-4 py-3 text-slate-600">{taken > 0 && item.usedAt ? formatDay(dateKeyFromValue(item.usedAt)) : '—'}</td>
                                            <td className="px-4 py-3 text-slate-700">{item.status === 'approved' ? `${balance.toFixed(1)} Day` : '—'}</td>
                                            <td className="px-4 py-3 text-slate-600">{item.expiryDate ? formatDay(dateKeyFromValue(item.expiryDate)) : '—'}</td>
                                            <td className="px-4 py-3"><StatusPill status={expired && item.status === 'approved' ? 'expired' : item.isUsed ? 'used' : item.status} /></td>
                                            <td className="px-4 py-3">
                                                {item.status === 'pending' ? (
                                                    <button type="button" onClick={() => cancelRequest(item._id)} className="text-sm text-slate-500 underline">Cancel</button>
                                                ) : null}
                                                {item.status === 'approved' && !item.isUsed && !expired && balance > 0 ? (
                                                    <button type="button" onClick={useCompOff} className="rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700">Use Comp-Off</button>
                                                ) : null}
                                                {item.isUsed ? <span className="text-xs text-slate-400">Fully used</span> : null}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">Showing {ledger.length} record{ledger.length === 1 ? '' : 's'} in {year}</p>
                </section>
            </div>
        </div>
    );
};

const StatCard = ({ title, value, hint, warn = false }) => (
    <div className={`rounded-2xl border bg-white p-4 ${warn ? 'border-rose-200' : 'border-slate-200'}`}>
        <p className="text-sm text-slate-500">{title}</p>
        <p className={`mt-2 text-2xl font-semibold ${warn ? 'text-rose-600' : 'text-slate-900'}`}>{value}</p>
        <p className="mt-2 text-xs text-slate-400">{hint}</p>
    </div>
);

const StatusPill = ({ status }) => {
    const styles = {
        eligible: 'bg-emerald-50 text-emerald-700',
        requested: 'bg-slate-100 text-slate-600',
        pending: 'bg-amber-50 text-amber-700',
        credited: 'bg-emerald-50 text-emerald-700',
        approved: 'bg-emerald-50 text-emerald-700',
        used: 'bg-slate-100 text-slate-600',
        rejected: 'bg-rose-50 text-rose-700',
        expired: 'bg-slate-100 text-slate-500',
    };
    const labels = {
        eligible: 'Eligible',
        requested: 'Requested',
        pending: 'Pending',
        credited: 'Credited',
        approved: 'Credited',
        used: 'Used',
        rejected: 'Rejected',
        expired: 'Expired',
    };
    return <span className={`rounded-full px-2 py-1 text-xs font-medium ${styles[status] || styles.pending}`}>{labels[status] || status}</span>;
};

const toTime = (value) => {
    if (!value) return '';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return '';
    return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
};

export default MyCompOffRequests;
