import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { FaClock, FaSave, FaUserClock } from 'react-icons/fa';

const DEFAULT_FORM = {
    shift1StartTime: '09:00',
    shift1EndTime: '17:00',
    shift2StartTime: '21:00',
    shift2EndTime: '06:00',
};

const PAGE_SIZE = 100;

async function fetchEmployeePage(page, search = '') {
    const params = { page, limit: PAGE_SIZE };
    if (search) params.search = search;

    const res = await axios.get('/v1/admin/employee', {
        params,
        withCredentials: true,
    });

    const body = res.data || {};
    // sendPaginatedResponse → { success, data: Employee[], pagination }
    let list = [];
    if (Array.isArray(body.data)) list = body.data;
    else if (Array.isArray(body.data?.employees)) list = body.data.employees;
    else if (Array.isArray(body.employees)) list = body.employees;
    else if (Array.isArray(body)) list = body;

    const pagination = body.pagination || {
        page,
        limit: PAGE_SIZE,
        total: list.length,
        pages: 1,
        hasNext: false,
    };

    return { list, pagination };
}

async function fetchAllEmployees(search = '') {
    const first = await fetchEmployeePage(1, search);
    const pages = Math.max(1, Number(first.pagination?.pages) || 1);
    let all = [...first.list];

    for (let page = 2; page <= pages; page += 1) {
        const next = await fetchEmployeePage(page, search);
        all = all.concat(next.list);
    }

    // De-dupe by _id
    const seen = new Set();
    return all.filter((emp) => {
        const id = String(emp?._id || '');
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
    });
}

const ShiftSettings = () => {
    const [form, setForm] = useState(DEFAULT_FORM);
    const [enableShifts, setEnableShifts] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [hasAttendanceRule, setHasAttendanceRule] = useState(true);
    const [assignShiftId, setAssignShiftId] = useState('shift1');
    const [assigning, setAssigning] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);
    const [employeesError, setEmployeesError] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [listFilter, setListFilter] = useState('all'); // all | unassigned | shift1 | shift2

    const isNetworkError = (err) =>
        !err?.response &&
        (err?.code === 'ERR_NETWORK' ||
            err?.message === 'Network Error' ||
            /ECONNREFUSED|ECONNABORTED|ECONNRESET|Failed to fetch/i.test(String(err?.message || '')));

    const load = async ({ retry = true } = {}) => {
        try {
            setLoading(true);
            const res = await axios.get('/v1/admin/attendance-rules/shifts');
            const data = res.data?.data || res.data || {};
            setHasAttendanceRule(data.hasAttendanceRule !== false);
            setEnableShifts(data.enableShifts !== false);
            setForm({
                shift1StartTime: data.shift1?.startTime || DEFAULT_FORM.shift1StartTime,
                shift1EndTime: data.shift1?.endTime || DEFAULT_FORM.shift1EndTime,
                shift2StartTime: data.shift2?.startTime || DEFAULT_FORM.shift2StartTime,
                shift2EndTime: data.shift2?.endTime || DEFAULT_FORM.shift2EndTime,
            });
        } catch (err) {
            if (retry && isNetworkError(err)) {
                await new Promise((r) => setTimeout(r, 1500));
                return load({ retry: false });
            }
            const msg = isNetworkError(err)
                ? 'Cannot reach the server. Make sure the API is running, then refresh.'
                : err.response?.data?.message || 'Failed to load shift settings';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const loadEmployees = useCallback(async (search = '', { retry = true } = {}) => {
        try {
            setLoadingEmployees(true);
            setEmployeesError('');
            const list = await fetchAllEmployees(search);
            setEmployees(list);
            if (!list.length && !search) {
                setEmployeesError('No employees found for this organization.');
            }
        } catch (err) {
            if (retry && isNetworkError(err)) {
                await new Promise((r) => setTimeout(r, 1500));
                return loadEmployees(search, { retry: false });
            }
            const msg = isNetworkError(err)
                ? 'Cannot reach the server. Make sure the API is running, then try again.'
                : err.response?.data?.message || 'Failed to load employees';
            setEmployeesError(msg);
            setEmployees([]);
            // Inline error is enough — avoid stacking duplicate toasts on retry/search
        } finally {
            setLoadingEmployees(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, []);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(employeeSearch.trim()), 300);
        return () => clearTimeout(t);
    }, [employeeSearch]);

    useEffect(() => {
        loadEmployees(debouncedSearch);
    }, [debouncedSearch, loadEmployees]);

    const handleChange = (field) => (e) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

    const handleToggleEnableShifts = async () => {
        if (toggling) return;
        if (!hasAttendanceRule) {
            toast.error('Create an Attendance Rule first (Attendance Rules tab), then enable shifts here.');
            return;
        }
        const next = !enableShifts;
        setEnableShifts(next);
        try {
            setToggling(true);
            const res = await axios.put('/v1/admin/attendance-rules/shifts', {
                enableShifts: next,
            });
            const data = res.data?.data || res.data || {};
            setEnableShifts(data.enableShifts !== false);
            setHasAttendanceRule(true);
            toast.success(
                data.enableShifts !== false
                    ? 'Shift settings enabled'
                    : 'Shift settings disabled — office hours apply for attendance'
            );
        } catch (err) {
            setEnableShifts(!next);
            toast.error(err.response?.data?.message || 'Failed to update shift settings');
        } finally {
            setToggling(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            const res = await axios.put('/v1/admin/attendance-rules/shifts', {
                ...form,
                enableShifts,
            });
            const data = res.data?.data || res.data || {};
            setEnableShifts(data.enableShifts !== false);
            setForm({
                shift1StartTime: data.shift1?.startTime || form.shift1StartTime,
                shift1EndTime: data.shift1?.endTime || form.shift1EndTime,
                shift2StartTime: data.shift2?.startTime || form.shift2StartTime,
                shift2EndTime: data.shift2?.endTime || form.shift2EndTime,
            });
            setHasAttendanceRule(true);
            toast.success(res.data?.message || 'Shift settings saved');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save shift settings');
        } finally {
            setSaving(false);
        }
    };

    const filteredEmployees = useMemo(() => {
        return employees.filter((emp) => {
            const shiftId = String(emp.shiftId || '').toLowerCase();
            if (listFilter === 'unassigned' && shiftId) return false;
            if (listFilter === 'shift1' && shiftId !== 'shift1') return false;
            if (listFilter === 'shift2' && shiftId !== 'shift2') return false;
            return true;
        });
    }, [employees, listFilter]);

    const visibleIds = useMemo(
        () => filteredEmployees.map((e) => String(e._id)),
        [filteredEmployees]
    );

    const allVisibleSelected =
        visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

    const toggleOne = (id) => {
        const sid = String(id);
        setSelectedIds((prev) =>
            prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]
        );
    };

    const toggleAllVisible = () => {
        if (allVisibleSelected) {
            setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
        } else {
            setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
        }
    };

    const handleAssignSelected = async () => {
        if (!selectedIds.length) {
            toast.info('Select employees first, then choose Shift 1, Shift 2, or No shift.');
            return;
        }
        const clearShift = assignShiftId === 'none' || assignShiftId === '';
        const label =
            clearShift ? 'No shift' : assignShiftId === 'shift2' ? 'Shift 2' : 'Shift 1';
        if (
            !window.confirm(
                clearShift
                    ? `Clear shift (No shift) for ${selectedIds.length} selected employee(s)? Others are not changed.`
                    : `Assign ${label} to ${selectedIds.length} selected employee(s)? Others are not changed.`
            )
        ) {
            return;
        }

        try {
            setAssigning(true);
            const res = await axios.post('/v1/admin/employee/bulk-assign-shift', {
                shiftId: clearShift ? 'none' : assignShiftId,
                employeeIds: selectedIds,
            });
            toast.success(res.data?.message || (clearShift ? 'Shift cleared' : 'Shift assigned'));
            setSelectedIds([]);
            await loadEmployees(debouncedSearch);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to assign shift');
        } finally {
            setAssigning(false);
        }
    };

    if (loading) {
        return (
            <div className="p-4 sm:p-5 md:p-6">
                <p className="text-sm text-gray-600">Loading shift settings…</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-5 md:p-6">
            <h2 className="mb-2 flex items-center text-xl font-bold text-gray-800 sm:mb-3 sm:text-2xl">
                <FaClock className="mr-2 text-[var(--color-primary)]" />
                Shift Settings
            </h2>
            <p className="mb-6 text-sm text-gray-600">
                Configure start and end times for Shift 1 and Shift 2. Assign employees individually —
                put some on Shift 1 (day) and others on Shift 2 (night).
            </p>

            {!hasAttendanceRule ? (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Create an Attendance Rule first (Attendance Rules tab), then save Shift Settings here.
                </div>
            ) : null}

            <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4">
                <div className="min-w-0 flex-1 pr-2">
                    <h3 className="font-medium text-gray-900">Enable shift settings</h3>
                    <p className="mt-1 text-sm text-gray-600">
                        When disabled, attendance uses office hours only. Employee shift assignments are
                        kept but ignored until you turn this back on.
                    </p>
                </div>
                <button
                    type="button"
                    aria-pressed={enableShifts}
                    aria-label={enableShifts ? 'Disable shift settings' : 'Enable shift settings'}
                    disabled={toggling}
                    onClick={handleToggleEnableShifts}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-0 p-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 disabled:cursor-wait ${
                        enableShifts ? 'bg-theme-primary' : 'bg-gray-300'
                    }`}
                >
                    <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                            enableShifts ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                </button>
            </div>

            {!enableShifts ? (
                <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    Shift settings are off. Punch-in windows and late rules use attendance office hours.
                </div>
            ) : null}

            <form
                onSubmit={handleSave}
                className={`space-y-6 ${enableShifts ? '' : 'pointer-events-none opacity-50'}`}
            >
                <fieldset disabled={!enableShifts} className="space-y-6 border-0 p-0">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <h3 className="mb-3 font-semibold text-gray-800">Shift 1</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block text-sm">
                            <span className="mb-1 block font-medium text-gray-700">Start time</span>
                            <input
                                type="time"
                                required={enableShifts}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                value={form.shift1StartTime}
                                onChange={handleChange('shift1StartTime')}
                            />
                        </label>
                        <label className="block text-sm">
                            <span className="mb-1 block font-medium text-gray-700">End time</span>
                            <input
                                type="time"
                                required={enableShifts}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                value={form.shift1EndTime}
                                onChange={handleChange('shift1EndTime')}
                            />
                        </label>
                    </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <h3 className="mb-3 font-semibold text-gray-800">Shift 2</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block text-sm">
                            <span className="mb-1 block font-medium text-gray-700">Start time</span>
                            <input
                                type="time"
                                required={enableShifts}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                value={form.shift2StartTime}
                                onChange={handleChange('shift2StartTime')}
                            />
                        </label>
                        <label className="block text-sm">
                            <span className="mb-1 block font-medium text-gray-700">End time</span>
                            <input
                                type="time"
                                required={enableShifts}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                value={form.shift2EndTime}
                                onChange={handleChange('shift2EndTime')}
                            />
                        </label>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                        If end time is earlier than start time (e.g. 21:00–06:00), it is treated as overnight.
                    </p>
                </div>

                <button
                    type="submit"
                    disabled={saving || !enableShifts}
                    className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                >
                    <FaSave />
                    {saving ? 'Saving…' : 'Save shift timings'}
                </button>
                </fieldset>
            </form>

            <div
                className={`mt-8 rounded-lg border border-gray-200 bg-white p-4 ${
                    enableShifts ? '' : 'pointer-events-none opacity-50'
                }`}
            >
                <h3 className="mb-1 flex items-center gap-2 font-semibold text-gray-800">
                    <FaUserClock className="text-[var(--color-primary)]" />
                    Assign employees to shifts
                </h3>
                <p className="mb-4 text-sm text-gray-600">
                    Select people, choose Shift 1, Shift 2, or No shift, then assign. Only the selected
                    employees are updated — nothing is applied to the whole company at once.
                </p>

                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="block flex-1 text-sm">
                        <span className="mb-1 block font-medium text-gray-700">Assign to</span>
                        <select
                            className="w-full rounded-lg border border-gray-300 px-3 py-2"
                            value={assignShiftId}
                            onChange={(e) => setAssignShiftId(e.target.value)}
                        >
                            <option value="shift1">
                                Shift 1 ({form.shift1StartTime}–{form.shift1EndTime})
                            </option>
                            <option value="shift2">
                                Shift 2 ({form.shift2StartTime}–{form.shift2EndTime})
                            </option>
                            <option value="none">No shift</option>
                        </select>
                    </label>
                    <button
                        type="button"
                        disabled={assigning || !selectedIds.length || !enableShifts}
                        onClick={handleAssignSelected}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                    >
                        {assigning
                            ? assignShiftId === 'none'
                                ? 'Clearing…'
                                : 'Assigning…'
                            : assignShiftId === 'none'
                              ? `Clear shift for selected (${selectedIds.length})`
                              : `Assign to selected (${selectedIds.length})`}
                    </button>
                </div>

                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <input
                        type="search"
                        placeholder="Search name, email, or employee ID…"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm sm:max-w-xs"
                        value={employeeSearch}
                        onChange={(e) => setEmployeeSearch(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: 'all', label: 'All' },
                            { id: 'unassigned', label: 'No shift' },
                            { id: 'shift1', label: 'Shift 1' },
                            { id: 'shift2', label: 'Shift 2' },
                        ].map((opt) => (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => setListFilter(opt.id)}
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    listFilter === opt.id
                                        ? 'bg-[var(--color-primary)] text-white'
                                        : 'border border-gray-200 bg-white text-gray-600'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
                    <label className="inline-flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={toggleAllVisible}
                            disabled={!visibleIds.length}
                        />
                        Select visible ({visibleIds.length})
                    </label>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            className="text-xs font-medium text-[var(--color-primary)]"
                            onClick={() => loadEmployees(debouncedSearch)}
                            disabled={loadingEmployees}
                        >
                            Refresh list
                        </button>
                        {selectedIds.length > 0 ? (
                            <button
                                type="button"
                                className="text-xs font-medium text-[var(--color-primary)]"
                                onClick={() => setSelectedIds([])}
                            >
                                Clear selection
                            </button>
                        ) : null}
                    </div>
                </div>

                <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-200">
                    {loadingEmployees ? (
                        <p className="p-4 text-sm text-gray-500">Loading employees…</p>
                    ) : employeesError ? (
                        <div className="space-y-2 p-4">
                            <p className="text-sm text-red-600">{employeesError}</p>
                            <button
                                type="button"
                                className="text-sm font-medium text-[var(--color-primary)]"
                                onClick={() => loadEmployees(debouncedSearch)}
                            >
                                Try again
                            </button>
                        </div>
                    ) : filteredEmployees.length === 0 ? (
                        <p className="p-4 text-sm text-gray-500">
                            {debouncedSearch
                                ? `No employees found for “${debouncedSearch}”. Clear search or try another email/name.`
                                : 'No employees match this filter.'}
                        </p>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {filteredEmployees.map((emp) => {
                                const id = String(emp._id);
                                const checked = selectedIds.includes(id);
                                const name = `${emp.name || ''} ${emp.lastName || ''}`.trim() || '—';
                                const current =
                                    emp.shiftName ||
                                    (emp.shiftId === 'shift2'
                                        ? 'Shift 2'
                                        : emp.shiftId === 'shift1'
                                          ? 'Shift 1'
                                          : 'No shift');
                                return (
                                    <li key={id}>
                                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-gray-50">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleOne(id)}
                                            />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-gray-900">
                                                    {name}
                                                </p>
                                                <p className="truncate text-xs text-gray-500">
                                                    {emp.employeeId || emp.email || ''}
                                                    {emp.department ? ` · ${emp.department}` : ''}
                                                </p>
                                            </div>
                                            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                                                {current}
                                            </span>
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
                <p className="mt-3 text-xs text-gray-500">
                    Tip: select day-shift people → Shift 1 → Assign, then night-shift people → Shift 2 →
                    Assign. Use No shift to clear an assignment. You can also edit one employee from Job
                    details.
                </p>
            </div>
        </div>
    );
};

export default ShiftSettings;
