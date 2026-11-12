import React, { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import useOrgStructureCatalog from '../../Hooks/useOrgStructureCatalog';
import GoogleMapsComponent from '../../utils/GoogleMaps';
import { FiEdit2, FiPlus, FiRefreshCw, FiTrash2 } from 'react-icons/fi';

const RESOURCES = [
    { key: 'departments', label: 'Departments', nameField: 'name' },
    { key: 'teams', label: 'Teams', nameField: 'name' },
    { key: 'jobRoles', label: 'Job Roles', nameField: 'name' },
    { key: 'designations', label: 'Designations', nameField: 'name' },
    { key: 'locations', label: 'Locations', nameField: 'name' },
    { key: 'employmentTypes', label: 'Employment Types', nameField: 'name' },
    { key: 'workModes', label: 'Work Modes', nameField: 'name' },
];

const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20';

const EMPTY_LOCATION_FORM = {
    type: 'branch',
    city: '',
    latitude: '',
    longitude: '',
    maximumRadius: 500,
};

function locationHasPunchPin(item) {
    const lat = Number(item?.coordinates?.latitude);
    const lng = Number(item?.coordinates?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (lat === 0 && lng === 0) return false;
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function deptNameById(departments, id) {
    if (!id) return null;
    const d = (departments || []).find((x) => String(x._id) === String(id));
    return d?.name || null;
}

export default function OrgStructurePage() {
    const [activeTab, setActiveTab] = useState('departments');
    const [newName, setNewName] = useState('');
    const [newCode, setNewCode] = useState('');
    const [teamDepartmentId, setTeamDepartmentId] = useState('');
    const [jobRoleDepartmentId, setJobRoleDepartmentId] = useState('');
    const [locationForm, setLocationForm] = useState(EMPTY_LOCATION_FORM);
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const { catalog, loading, reload } = useOrgStructureCatalog();

    const items = useMemo(() => {
        const list = catalog[activeTab] || [];
        return Array.isArray(list) ? list : [];
    }, [catalog, activeTab]);

    const handleSeed = async () => {
        try {
            await axios.post('/v1/admin/org-structure/seed', {}, { withCredentials: true });
            toast.success('Organization structure initialized');
            reload();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to initialize structure');
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newName.trim()) {
            toast.error('Name is required');
            return;
        }
        if (activeTab === 'teams' && !teamDepartmentId) {
            toast.error('Select a department for the team');
            return;
        }
        if (activeTab === 'locations') {
            const latRaw = String(locationForm.latitude).trim();
            const lngRaw = String(locationForm.longitude).trim();
            if ((latRaw && !lngRaw) || (!latRaw && lngRaw)) {
                toast.error('Enter both latitude and longitude, or click the map');
                return;
            }
            const radius = Number(locationForm.maximumRadius);
            if (!Number.isFinite(radius) || radius < 50 || radius > 1000) {
                toast.error('Punch radius must be between 50 and 1000 meters');
                return;
            }
        }
        setSaving(true);
        try {
            const payload = { name: newName.trim(), code: newCode.trim() || undefined };
            if (activeTab === 'teams') {
                payload.departmentId = teamDepartmentId;
            }
            if (activeTab === 'jobRoles' && jobRoleDepartmentId) {
                payload.departmentId = jobRoleDepartmentId;
            }
            if (activeTab === 'locations') {
                payload.type = locationForm.type || 'branch';
                payload.address = { city: locationForm.city.trim() };
                payload.maximumRadius = Number(locationForm.maximumRadius) || 500;
                const latRaw = String(locationForm.latitude).trim();
                const lngRaw = String(locationForm.longitude).trim();
                if (latRaw && lngRaw) {
                    payload.coordinates = { latitude: Number(latRaw), longitude: Number(lngRaw) };
                } else if (editingId) {
                    payload.clearCoordinates = true;
                }
            }
            if (editingId && activeTab === 'locations') {
                await axios.put(`/v1/admin/org-structure/${activeTab}/${editingId}`, payload, { withCredentials: true });
                toast.success('Location updated');
            } else {
                await axios.post(`/v1/admin/org-structure/${activeTab}`, payload, { withCredentials: true });
                toast.success('Created');
            }
            setNewName('');
            setNewCode('');
            setEditingId(null);
            setLocationForm(EMPTY_LOCATION_FORM);
            reload();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Create failed');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Deactivate this item?')) return;
        try {
            await axios.delete(`/v1/admin/org-structure/${activeTab}/${id}`, { withCredentials: true });
            toast.success('Deactivated');
            reload();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Delete failed');
        }
    };

    const resetLocationEditor = () => {
        setEditingId(null);
        setNewName('');
        setNewCode('');
        setLocationForm(EMPTY_LOCATION_FORM);
    };

    const startEditLocation = (item) => {
        setEditingId(item._id);
        setNewName(item.name || '');
        setNewCode(item.code || '');
        setLocationForm({
            type: item.type || 'branch',
            city: item.address?.city || '',
            latitude: item.coordinates?.latitude ?? '',
            longitude: item.coordinates?.longitude ?? '',
            maximumRadius: item.maximumRadius || 500,
        });
    };

    const activeResource = RESOURCES.find((r) => r.key === activeTab);
    const isLocationTab = activeTab === 'locations';

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="page-shell">
                <div className="page-shell-inner hrms-stack">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Organization Structure</h1>
                            <p className="mt-1 text-sm text-gray-600 max-w-2xl">
                                Build your company catalog: departments, teams, job roles, and designations.
                                These are labels for hiring and org chart they do not choose login dashboards.
                                Access &amp; home screen is set with System Role when you add an employee.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleSeed}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                                <FiRefreshCw /> Initialize defaults
                            </button>
                        </div>
                    </div>

                    <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
                        <strong className="font-semibold">Tip:</strong> Create a department first, then teams under it,
                        then job roles for the work people do (e.g. Backend Developer, Finance Manager). Designations are
                        seniority levels only (e.g. Junior, Senior, Manager) — not job titles. Access &amp; home is
                        separate when you add an employee.
                    </div>

                    <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
                        {RESOURCES.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => {
                                    setActiveTab(tab.key);
                                    resetLocationEditor();
                                }}
                                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                                    activeTab === tab.key
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {isLocationTab ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
                            Add each office, drop a pin, and set how far from that pin an employee can punch in.
                            Then assign the branch on the employee. A branch without a pin still uses the single pin on Attendance Rules.
                        </div>
                    ) : null}

                    <div className={`grid gap-6 ${isLocationTab ? 'grid-cols-1' : 'lg:grid-cols-3'}`}>
                        <form onSubmit={handleCreate} className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${isLocationTab ? '' : 'lg:col-span-1'}`}>
                            <h2 className="mb-3 text-sm font-semibold text-slate-800">
                                {editingId && isLocationTab ? 'Edit location' : `Add ${activeResource?.label.slice(0, -1) || 'item'}`}
                            </h2>
                            {activeTab === 'teams' ? (
                                <select
                                    className={`${inputClass} mb-3`}
                                    value={teamDepartmentId}
                                    onChange={(e) => setTeamDepartmentId(e.target.value)}
                                    required
                                >
                                    <option value="">Department (required)</option>
                                    {(catalog.departments || []).map((d) => (
                                        <option key={d._id} value={d._id}>{d.name}</option>
                                    ))}
                                </select>
                            ) : null}
                            {activeTab === 'jobRoles' ? (
                                <select
                                    className={`${inputClass} mb-3`}
                                    value={jobRoleDepartmentId}
                                    onChange={(e) => setJobRoleDepartmentId(e.target.value)}
                                >
                                    <option value="">Department (optional — all depts if empty)</option>
                                    {(catalog.departments || []).map((d) => (
                                        <option key={d._id} value={d._id}>{d.name}</option>
                                    ))}
                                </select>
                            ) : null}
                            <input
                                className={`${inputClass} mb-3`}
                                placeholder="Name"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                required
                            />
                            <input
                                className={`${inputClass} mb-3`}
                                placeholder="Code (optional)"
                                value={newCode}
                                onChange={(e) => setNewCode(e.target.value)}
                            />
                            {isLocationTab ? (
                                <div className="mb-4 space-y-3">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <select
                                            className={inputClass}
                                            value={locationForm.type}
                                            onChange={(e) => setLocationForm((prev) => ({ ...prev, type: e.target.value }))}
                                        >
                                            <option value="head">Head office</option>
                                            <option value="branch">Branch</option>
                                            <option value="remote_hub">Remote hub</option>
                                        </select>
                                        <input
                                            className={inputClass}
                                            placeholder="City"
                                            value={locationForm.city}
                                            onChange={(e) => setLocationForm((prev) => ({ ...prev, city: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <p className="mb-2 text-sm font-medium text-slate-700">
                                            Punch radius: {locationForm.maximumRadius} m
                                        </p>
                                        <input
                                            type="range"
                                            min="50"
                                            max="1000"
                                            value={locationForm.maximumRadius}
                                            onChange={(e) => setLocationForm((prev) => ({
                                                ...prev,
                                                maximumRadius: Number(e.target.value),
                                            }))}
                                            className="w-full"
                                        />
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <input
                                            className={inputClass}
                                            type="number"
                                            step="any"
                                            placeholder="Latitude"
                                            value={locationForm.latitude}
                                            onChange={(e) => setLocationForm((prev) => ({ ...prev, latitude: e.target.value }))}
                                        />
                                        <input
                                            className={inputClass}
                                            type="number"
                                            step="any"
                                            placeholder="Longitude"
                                            value={locationForm.longitude}
                                            onChange={(e) => setLocationForm((prev) => ({ ...prev, longitude: e.target.value }))}
                                        />
                                    </div>
                                    <GoogleMapsComponent
                                        latitude={locationForm.latitude === '' ? undefined : Number(locationForm.latitude)}
                                        longitude={locationForm.longitude === '' ? undefined : Number(locationForm.longitude)}
                                        onMarkerDrag={(lat, lng) => setLocationForm((prev) => ({
                                            ...prev,
                                            latitude: String(lat),
                                            longitude: String(lng),
                                        }))}
                                        onLocationSelect={(lat, lng) => setLocationForm((prev) => ({
                                            ...prev,
                                            latitude: String(lat),
                                            longitude: String(lng),
                                        }))}
                                    />
                                    <p className="text-xs text-slate-500">
                                        Click the map or drag the marker to set where this branch can punch in. Leave the pin empty to keep using the organization attendance pin.
                                    </p>
                                </div>
                            ) : null}
                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                >
                                    <FiPlus /> {saving ? 'Saving…' : editingId && isLocationTab ? 'Save location' : 'Add'}
                                </button>
                                {editingId && isLocationTab ? (
                                    <button
                                        type="button"
                                        onClick={resetLocationEditor}
                                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>
                                ) : null}
                            </div>
                        </form>

                        <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${isLocationTab ? '' : 'lg:col-span-2'}`}>
                            <h2 className="mb-3 text-sm font-semibold text-slate-800">
                                {activeResource?.label} ({items.length})
                            </h2>
                            {loading ? (
                                <p className="text-sm text-slate-500">Loading…</p>
                            ) : items.length === 0 ? (
                                <p className="text-sm text-slate-500">
                                    No items yet. Click &quot;Initialize defaults&quot; or add one manually.
                                </p>
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {items.map((item) => {
                                        let subtitle = item.code || '';
                                        if (activeTab === 'teams' && item.departmentId) {
                                            const dn = deptNameById(catalog.departments, item.departmentId);
                                            subtitle = [subtitle, dn ? `Dept: ${dn}` : null].filter(Boolean).join(' · ');
                                        }
                                        if (isLocationTab) {
                                            const typeLabel = item.type === 'head'
                                                ? 'Head office'
                                                : item.type === 'remote_hub'
                                                    ? 'Remote hub'
                                                    : 'Branch';
                                            const pinLabel = locationHasPunchPin(item)
                                                ? `punch radius ${item.maximumRadius || 500}m`
                                                : 'no punch pin';
                                            subtitle = [item.address?.city, typeLabel, pinLabel, item.code]
                                                .filter(Boolean)
                                                .join(' · ');
                                        }
                                        if (activeTab === 'jobRoles' && Array.isArray(item.departmentIds) && item.departmentIds.length) {
                                            const names = item.departmentIds
                                                .map((id) => deptNameById(catalog.departments, id))
                                                .filter(Boolean);
                                            if (names.length) {
                                                subtitle = [subtitle, `Dept: ${names.join(', ')}`].filter(Boolean).join(' · ');
                                            }
                                        }
                                        return (
                                            <li key={item._id} className="flex items-center justify-between py-3">
                                                <div>
                                                    <p className="font-medium text-slate-900">{item.name}</p>
                                                    {subtitle ? (
                                                        <p className="text-xs text-slate-500">{subtitle}</p>
                                                    ) : null}
                                                </div>
                                                <div className="flex items-center">
                                                    {isLocationTab ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => startEditLocation(item)}
                                                            className="rounded p-2 text-slate-500 hover:bg-slate-100"
                                                            title="Edit punch pin"
                                                        >
                                                            <FiEdit2 />
                                                        </button>
                                                    ) : null}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(item._id)}
                                                        className="rounded p-2 text-red-500 hover:bg-red-50"
                                                        title="Deactivate"
                                                    >
                                                        <FiTrash2 />
                                                    </button>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
