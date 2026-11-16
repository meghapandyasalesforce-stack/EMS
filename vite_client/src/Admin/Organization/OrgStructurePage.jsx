import React, { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import useOrgStructureCatalog from '../../Hooks/useOrgStructureCatalog';
import GoogleMapsComponent from '../../utils/GoogleMaps';
import {
    FiPlus,
    FiRefreshCw,
    FiTrash2,
    FiEdit2,
    FiGrid,
    FiUsers,
    FiBriefcase,
    FiAward,
    FiMapPin,
    FiClock,
    FiMonitor,
    FiArrowRight,
    FiInfo,
    FiSearch,
    FiX,
} from 'react-icons/fi';
import './orgStructure.css';

const EMPTY_LOCATION_FORM = {
    type: 'branch',
    city: '',
    latitude: '',
    longitude: '',
    maximumRadius: 500,
};

const RESOURCES = [
    {
        key: 'departments',
        label: 'Departments',
        singular: 'department',
        icon: FiGrid,
        description: 'Define the departments that bring your organization together.',
        example: 'e.g. Engineering',
        help: 'Group people by their area of expertise.',
    },
    {
        key: 'teams',
        label: 'Teams',
        singular: 'team',
        icon: FiUsers,
        description: 'Bring people together in teams within each department.',
        example: 'e.g. Product Development',
        help: 'Every team belongs to a department.',
    },
    {
        key: 'jobRoles',
        label: 'Job Roles',
        singular: 'job role',
        icon: FiBriefcase,
        description: 'Define the work people do across your organization.',
        example: 'e.g. Backend Developer',
        help: 'Job roles describe responsibilities, not access permissions.',
    },
    {
        key: 'designations',
        label: 'Designations',
        singular: 'designation',
        icon: FiAward,
        description: 'Create consistent seniority levels for your people.',
        example: 'e.g. Senior',
        help: 'Use levels such as Junior, Senior, or Manager.',
    },
    {
        key: 'locations',
        label: 'Locations',
        singular: 'location',
        icon: FiMapPin,
        description: 'Organize the places where your people work.',
        example: 'e.g. Bengaluru Office',
        help: 'Set your office location and its allowed attendance radius.',
    },
    {
        key: 'employmentTypes',
        label: 'Employment Types',
        singular: 'employment type',
        icon: FiClock,
        description: 'Set up the ways people are employed at your company.',
        example: 'e.g. Full-time',
        help: 'Define categories such as Full-time or Contract.',
    },
    {
        key: 'workModes',
        label: 'Work Modes',
        singular: 'work mode',
        icon: FiMonitor,
        description: 'Define flexible ways of working for your organization.',
        example: 'e.g. Hybrid',
        help: 'Add work arrangements such as On-site, Remote, or Hybrid.',
    },
];

function deptNameById(departments, id) {
    if (!id) return null;

    const department = (departments || []).find(
        (item) => String(item._id) === String(id)
    );

    return department?.name || null;
}

export default function OrgStructurePage() {
    const [activeTab, setActiveTab] = useState('departments');
    const [newName, setNewName] = useState('');
    const [newCode, setNewCode] = useState('');
    const [teamDepartmentId, setTeamDepartmentId] = useState('');
    const [jobRoleDepartmentId, setJobRoleDepartmentId] = useState('');
    const [locationForm, setLocationForm] = useState({
        ...EMPTY_LOCATION_FORM,
    });
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [search, setSearch] = useState('');

    const { catalog, loading, error, reload } =
        useOrgStructureCatalog();

    const isLocationTab = activeTab === 'locations';
    const hasDepartment =
        activeTab === 'teams' || activeTab === 'jobRoles';

    const activeResource = RESOURCES.find(
        (resource) => resource.key === activeTab
    );

    const ActiveIcon = activeResource.icon;

    const items = useMemo(() => {
        const list = catalog[activeTab] || [];
        return Array.isArray(list) ? list : [];
    }, [catalog, activeTab]);

    const totalItems = RESOURCES.reduce(
        (total, resource) =>
            total + (catalog[resource.key]?.length || 0),
        0
    );

    const departmentNames = (item) => {
        const ids =
            activeTab === 'teams'
                ? [item.departmentId]
                : item.departmentIds || [];

        return ids
            .map((id) => deptNameById(catalog.departments, id))
            .filter(Boolean)
            .join(', ');
    };

    const filteredItems = items.filter((item) => {
        const text = [
            item.name,
            item.code,
            hasDepartment ? departmentNames(item) : '',
            isLocationTab ? item.address?.city : '',
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        return text.includes(search.trim().toLowerCase());
    });

    const resetForm = () => {
        setNewName('');
        setNewCode('');
        setTeamDepartmentId('');
        setJobRoleDepartmentId('');
        setLocationForm({ ...EMPTY_LOCATION_FORM });
        setEditingId(null);
    };

    const closeForm = () => {
        setShowForm(false);
        resetForm();
    };

    const openCreateForm = () => {
        resetForm();
        setShowForm(true);
    };

    const handleTabChange = (key) => {
        resetForm();
        setActiveTab(key);
        setSearch('');
        setShowForm(false);
    };

    const updateLocation = (field, value) => {
        setLocationForm((previous) => ({
            ...previous,
            [field]: value,
        }));
    };

    const updateMapCoordinates = (latitude, longitude) => {
        setLocationForm((previous) => ({
            ...previous,
            latitude: String(latitude),
            longitude: String(longitude),
        }));
    };

    const handleEditLocation = (item) => {
        setNewName(item.name || '');
        setNewCode(item.code || '');
        setEditingId(item._id);

        setLocationForm({
            type: item.type || 'branch',
            city: item.address?.city || '',
            latitude:
                item.coordinates?.latitude == null
                    ? ''
                    : String(item.coordinates.latitude),
            longitude:
                item.coordinates?.longitude == null
                    ? ''
                    : String(item.coordinates.longitude),
            maximumRadius: item.maximumRadius ?? 500,
        });

        setShowForm(true);
    };

    const handleCreate = async (event) => {
        event.preventDefault();

        if (!newName.trim()) {
            toast.error('Name is required');
            return;
        }

        if (activeTab === 'teams' && !teamDepartmentId) {
            toast.error('Select a department for the team');
            return;
        }

        const latRaw = String(locationForm.latitude).trim();
        const lngRaw = String(locationForm.longitude).trim();
        const radius = Number(locationForm.maximumRadius);

        if (isLocationTab) {
            if ((latRaw && !lngRaw) || (!latRaw && lngRaw)) {
                toast.error(
                    'Enter both latitude and longitude, or click the map'
                );
                return;
            }

            if (latRaw && lngRaw) {
                const latitude = Number(latRaw);
                const longitude = Number(lngRaw);

                if (
                    !Number.isFinite(latitude) ||
                    latitude < -90 ||
                    latitude > 90 ||
                    !Number.isFinite(longitude) ||
                    longitude < -180 ||
                    longitude > 180
                ) {
                    toast.error(
                        'Enter a valid latitude (-90 to 90) and longitude (-180 to 180)'
                    );
                    return;
                }
            }

            if (
                !Number.isFinite(radius) ||
                radius < 50 ||
                radius > 1000
            ) {
                toast.error(
                    'Punch radius must be between 50 and 1000 meters'
                );
                return;
            }
        }

        setSaving(true);

        try {
            const payload = {
                name: newName.trim(),
                code: newCode.trim() || undefined,
            };

            if (activeTab === 'teams') {
                payload.departmentId = teamDepartmentId;
            }

            if (activeTab === 'jobRoles' && jobRoleDepartmentId) {
                payload.departmentId = jobRoleDepartmentId;
            }

            if (isLocationTab) {
                payload.type = locationForm.type || 'branch';
                payload.address = {
                    city: locationForm.city.trim(),
                };
                payload.maximumRadius = radius;

                if (latRaw && lngRaw) {
                    payload.coordinates = {
                        latitude: Number(latRaw),
                        longitude: Number(lngRaw),
                    };
                } else if (editingId) {
                    payload.clearCoordinates = true;
                }
            }

            if (editingId && isLocationTab) {
                await axios.put(
                    `/v1/admin/org-structure/locations/${editingId}`,
                    payload,
                    { withCredentials: true }
                );

                toast.success('Location updated');
            } else {
                await axios.post(
                    `/v1/admin/org-structure/${activeTab}`,
                    payload,
                    { withCredentials: true }
                );

                toast.success('Created');
            }

            resetForm();
            setShowForm(false);
            reload();
        } catch (err) {
            toast.error(
                err.response?.data?.message || 'Save failed'
            );
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        // eslint-disable-next-line no-alert -- Confirm before deactivation.
        if (!window.confirm('Deactivate this item?')) return;

        try {
            await axios.delete(
                `/v1/admin/org-structure/${activeTab}/${id}`,
                { withCredentials: true }
            );

            toast.success('Deactivated');
            reload();
        } catch (err) {
            toast.error(
                err.response?.data?.message || 'Delete failed'
            );
        }
    };

    const numericLatitude = Number(locationForm.latitude);
    const numericLongitude = Number(locationForm.longitude);

    const mapLatitude =
        String(locationForm.latitude).trim() !== '' &&
        Number.isFinite(numericLatitude) &&
        numericLatitude >= -90 &&
        numericLatitude <= 90
            ? numericLatitude
            : undefined;

    const mapLongitude =
        String(locationForm.longitude).trim() !== '' &&
        Number.isFinite(numericLongitude) &&
        numericLongitude >= -180 &&
        numericLongitude <= 180
            ? numericLongitude
            : undefined;

    const formActions = (
        <div className="os-form-actions">
            <button
                type="button"
                className="os-button os-button-secondary"
                onClick={closeForm}
                disabled={saving}
            >
                Cancel
            </button>

            <button
                type="submit"
                className="os-button os-button-primary"
                disabled={saving}
            >
                {saving
                    ? 'Saving…'
                    : editingId && isLocationTab
                      ? 'Save location'
                      : 'Save'}
                <FiArrowRight />
            </button>
        </div>
    );

    return (
        <div className="org-structure-page">
            <div className="page-shell">
                <div className="page-shell-inner org-structure-content">
                    <header className="os-header">
                        <div className="os-title-group">
                            <span className="os-title-icon">
                                <FiGrid />
                            </span>

                            <div>
                                <div className="os-eyebrow">
                                    ORGANIZATION / COMPANY CATALOG
                                </div>
                                <h1>Organization structure</h1>
                                <p>
                                    Manage the departments, roles, and working
                                    arrangements that define your company.
                                </p>
                            </div>
                        </div>

                    </header>

                    <div className="os-workspace">
                        <nav
                            className="os-navigation"
                            aria-label="Structure categories"
                        >
                            {RESOURCES.map((tab) => {
                                const Icon = tab.icon;

                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        aria-current={
                                            activeTab === tab.key
                                                ? 'page'
                                                : undefined
                                        }
                                        className={`os-nav-item ${
                                            activeTab === tab.key
                                                ? 'is-active'
                                                : ''
                                        }`}
                                        onClick={() =>
                                            handleTabChange(tab.key)
                                        }
                                        disabled={saving}
                                    >
                                        <Icon />
                                        <span>{tab.label}</span>
                                        <span className="os-count">
                                            {loading
                                                ? '—'
                                                : catalog[tab.key]
                                                      ?.length || 0}
                                        </span>
                                    </button>
                                );
                            })}
                        </nav>

                        <section
                            className="os-main"
                            aria-label={activeResource.label}
                        >
                            <div className="os-section-heading">
                                <div>
                                    <h2>
                                        {activeResource.label}
                                        <span>
                                            {loading ? '—' : items.length}
                                        </span>
                                    </h2>
                                    <p>{activeResource.description}</p>
                                </div>

                                <div className="os-toolbar">
                                    <label className="os-search">
                                        <FiSearch />
                                        <input
                                            aria-label={`Search ${activeResource.label.toLowerCase()}`}
                                            placeholder={`Search ${activeResource.label.toLowerCase()}…`}
                                            value={search}
                                            onChange={(event) =>
                                                setSearch(
                                                    event.target.value
                                                )
                                            }
                                        />

                                        {search && (
                                            <button
                                                type="button"
                                                aria-label="Clear search"
                                                onClick={() =>
                                                    setSearch('')
                                                }
                                            >
                                                <FiX />
                                            </button>
                                        )}
                                    </label>

                                    <button
                                        type="button"
                                        className="os-button os-button-primary"
                                        aria-expanded={showForm}
                                        aria-controls="os-create-form"
                                        onClick={() => {
                                            if (showForm) {
                                                closeForm();
                                            } else {
                                                openCreateForm();
                                            }
                                        }}
                                        disabled={loading || saving}
                                    >
                                        <FiPlus />
                                        Add {activeResource.singular}
                                    </button>
                                </div>
                            </div>

                            {showForm && (
                                <form
                                    id="os-create-form"
                                    className="os-form-panel"
                                    onSubmit={handleCreate}
                                >
                                    <div className="os-form-heading">
                                        <div>
                                            <h3>
                                                {editingId
                                                    ? 'Edit'
                                                    : 'New'}{' '}
                                                {activeResource.singular}
                                            </h3>
                                            <p>{activeResource.help}</p>
                                        </div>

                                        <button
                                            type="button"
                                            className="os-close"
                                            aria-label="Close add form"
                                            onClick={closeForm}
                                            disabled={saving}
                                        >
                                            <FiX />
                                        </button>
                                    </div>

                                    <div className="os-form-fields">
                                        <label htmlFor="os-name">
                                            Name{' '}
                                            <span className="os-required">
                                                *
                                            </span>
                                            <input
                                                id="os-name"
                                                className="org-structure-input"
                                                placeholder={
                                                    activeResource.example
                                                }
                                                value={newName}
                                                onChange={(event) =>
                                                    setNewName(
                                                        event.target.value
                                                    )
                                                }
                                                required
                                                autoFocus
                                                disabled={saving}
                                            />
                                        </label>

                                        <label htmlFor="os-code">
                                            Code <span>(optional)</span>
                                            <input
                                                id="os-code"
                                                className="org-structure-input"
                                                placeholder="Short identifier"
                                                value={newCode}
                                                onChange={(event) =>
                                                    setNewCode(
                                                        event.target.value
                                                    )
                                                }
                                                disabled={saving}
                                            />
                                        </label>

                                        {hasDepartment && (
                                            <label htmlFor="os-department">
                                                Department{' '}
                                                {activeTab ===
                                                    'jobRoles' && (
                                                    <span>(optional)</span>
                                                )}

                                                <select
                                                    id="os-department"
                                                    className="org-structure-input"
                                                    value={
                                                        activeTab === 'teams'
                                                            ? teamDepartmentId
                                                            : jobRoleDepartmentId
                                                    }
                                                    onChange={(event) => {
                                                        if (
                                                            activeTab ===
                                                            'teams'
                                                        ) {
                                                            setTeamDepartmentId(
                                                                event.target
                                                                    .value
                                                            );
                                                        } else {
                                                            setJobRoleDepartmentId(
                                                                event.target
                                                                    .value
                                                            );
                                                        }
                                                    }}
                                                    required={
                                                        activeTab === 'teams'
                                                    }
                                                    disabled={saving}
                                                >
                                                    <option value="">
                                                        {activeTab === 'teams'
                                                            ? 'Select a department'
                                                            : 'All departments'}
                                                    </option>

                                                    {(
                                                        catalog.departments ||
                                                        []
                                                    ).map((department) => (
                                                        <option
                                                            key={department._id}
                                                            value={department._id}
                                                        >
                                                            {department.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        )}

                                        {isLocationTab && (
                                            <label htmlFor="os-city">
                                                City <span>(optional)</span>
                                                <input
                                                    id="os-city"
                                                    className="org-structure-input"
                                                    placeholder="e.g. Bengaluru"
                                                    value={locationForm.city}
                                                    onChange={(event) =>
                                                        updateLocation(
                                                            'city',
                                                            event.target.value
                                                        )
                                                    }
                                                    disabled={saving}
                                                />
                                            </label>
                                        )}

                                        {!isLocationTab && formActions}
                                    </div>

                                    {isLocationTab && (
                                        <fieldset
                                            disabled={saving}
                                            style={{
                                                border: 0,
                                                padding: 0,
                                                margin: '20px 0 0',
                                                minWidth: 0,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    borderTop:
                                                        '1px solid #dbe9df',
                                                    paddingTop: 18,
                                                }}
                                            >
                                                <label
                                                    htmlFor="os-radius"
                                                    style={{
                                                        display: 'block',
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        color: '#405e49',
                                                    }}
                                                >
                                                    Maximum Attendance Radius:{' '}
                                                    {locationForm.maximumRadius ||
                                                        '—'}{' '}
                                                    m
                                                </label>

                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 12,
                                                        marginTop: 12,
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            fontSize: 11,
                                                            whiteSpace:
                                                                'nowrap',
                                                        }}
                                                    >
                                                        50 m
                                                    </span>

                                                    <input
                                                        id="os-radius"
                                                        type="range"
                                                        min="50"
                                                        max="1000"
                                                        step="1"
                                                        value={
                                                            locationForm.maximumRadius ===
                                                            ''
                                                                ? 500
                                                                : locationForm.maximumRadius
                                                        }
                                                        onChange={(event) =>
                                                            updateLocation(
                                                                'maximumRadius',
                                                                Number(
                                                                    event.target
                                                                        .value
                                                                )
                                                            )
                                                        }
                                                        aria-valuetext={`${locationForm.maximumRadius} metres`}
                                                        style={{
                                                            flex: 1,
                                                            minWidth: 0,
                                                            accentColor:
                                                                '#2c7452',
                                                        }}
                                                    />

                                                    <span
                                                        style={{
                                                            fontSize: 11,
                                                            whiteSpace:
                                                                'nowrap',
                                                        }}
                                                    >
                                                        1,000 m
                                                    </span>
                                                </div>

                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 9,
                                                        marginTop: 10,
                                                    }}
                                                >
                                                    <input
                                                        type="number"
                                                        aria-label="Maximum attendance radius in metres"
                                                        className="org-structure-input"
                                                        min="50"
                                                        max="1000"
                                                        step="1"
                                                        required
                                                        value={
                                                            locationForm.maximumRadius
                                                        }
                                                        onChange={(event) =>
                                                            updateLocation(
                                                                'maximumRadius',
                                                                event.target
                                                                    .value
                                                            )
                                                        }
                                                        style={{
                                                            width: 100,
                                                            marginTop: 0,
                                                        }}
                                                    />
                                                    <span
                                                        style={{
                                                            fontSize: 11,
                                                            color: '#748779',
                                                        }}
                                                    >
                                                        metres
                                                    </span>
                                                </div>
                                            </div>

                                            <div style={{ marginTop: 20 }}>
                                                <h4
                                                    style={{
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        color: '#405e49',
                                                        marginBottom: 10,
                                                    }}
                                                >
                                                    Office Location Map
                                                </h4>

                                                <div
                                                    style={{
                                                        borderRadius: 8,
                                                        overflow: 'hidden',
                                                        border:
                                                            '1px solid #dbe5de',
                                                    }}
                                                >
                                                    <GoogleMapsComponent
                                                        latitude={
                                                            mapLatitude
                                                        }
                                                        longitude={
                                                            mapLongitude
                                                        }
                                                        onMarkerDrag={
                                                            updateMapCoordinates
                                                        }
                                                        onLocationSelect={
                                                            updateMapCoordinates
                                                        }
                                                    />
                                                </div>

                                                <p
                                                    style={{
                                                        fontSize: 11,
                                                        color: '#748779',
                                                        lineHeight: 1.7,
                                                        marginTop: 8,
                                                    }}
                                                >
                                                    Click the map or drag the
                                                    marker to set where this
                                                    location can punch in.
                                                    Leave both coordinates
                                                    empty to use the
                                                    organization attendance
                                                    pin.
                                                </p>
                                            </div>

                                            <div style={{ marginTop: 18 }}>
                                                <h4
                                                    style={{
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        color: '#405e49',
                                                        marginBottom: 10,
                                                    }}
                                                >
                                                    Manual Coordinate Entry
                                                </h4>

                                                <div className="os-form-fields">
                                                    <label htmlFor="os-latitude">
                                                        Latitude
                                                        <input
                                                            id="os-latitude"
                                                            type="number"
                                                            className="org-structure-input"
                                                            min="-90"
                                                            max="90"
                                                            step="any"
                                                            placeholder="e.g. 26.8561688"
                                                            value={
                                                                locationForm.latitude
                                                            }
                                                            onChange={(
                                                                event
                                                            ) =>
                                                                updateLocation(
                                                                    'latitude',
                                                                    event
                                                                        .target
                                                                        .value
                                                                )
                                                            }
                                                        />
                                                    </label>

                                                    <label htmlFor="os-longitude">
                                                        Longitude
                                                        <input
                                                            id="os-longitude"
                                                            type="number"
                                                            className="org-structure-input"
                                                            min="-180"
                                                            max="180"
                                                            step="any"
                                                            placeholder="e.g. 75.7721217"
                                                            value={
                                                                locationForm.longitude
                                                            }
                                                            onChange={(
                                                                event
                                                            ) =>
                                                                updateLocation(
                                                                    'longitude',
                                                                    event
                                                                        .target
                                                                        .value
                                                                )
                                                            }
                                                        />
                                                    </label>
                                                </div>

                                                <button
                                                    type="button"
                                                    className="os-text-button"
                                                    style={{ marginTop: 10 }}
                                                    onClick={() =>
                                                        setLocationForm(
                                                            (previous) => ({
                                                                ...previous,
                                                                latitude: '',
                                                                longitude: '',
                                                            })
                                                        )
                                                    }
                                                >
                                                    Clear coordinates
                                                </button>
                                            </div>

                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'flex-end',
                                                    borderTop:
                                                        '1px solid #dbe9df',
                                                    paddingTop: 16,
                                                    marginTop: 18,
                                                }}
                                            >
                                                {formActions}
                                            </div>
                                        </fieldset>
                                    )}
                                </form>
                            )}

                            <div className="os-list-panel">
                                {loading ? (
                                    <div className="os-empty" role="status">
                                        <FiRefreshCw className="os-spin" />
                                        <h3>Loading your catalog…</h3>
                                    </div>
                                ) : error ? (
                                    <div className="os-empty" role="alert">
                                        <FiInfo />
                                        <h3>Unable to load your catalog</h3>
                                        <p>
                                            Please try again to see your
                                            organization structure.
                                        </p>
                                        <button
                                            type="button"
                                            className="os-text-button"
                                            onClick={reload}
                                        >
                                            Try again <FiRefreshCw />
                                        </button>
                                    </div>
                                ) : items.length === 0 ? (
                                    <div className="os-empty">
                                        <span className="os-empty-icon">
                                            <ActiveIcon />
                                        </span>
                                        <div>
                                            <h3>
                                                No{' '}
                                                {activeResource.label.toLowerCase()}{' '}
                                                yet
                                            </h3>
                                            <p>
                                                Add your first{' '}
                                                {activeResource.singular} to get started.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            className="os-button os-button-secondary"
                                            onClick={openCreateForm}
                                        >
                                            <FiPlus />
                                            Create {activeResource.singular}
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="os-table-scroll">
                                            <table className="os-table">
                                                <thead>
                                                    <tr>
                                                        <th scope="col">
                                                            {
                                                                activeResource.singular
                                                            }{' '}
                                                            name
                                                        </th>
                                                        <th scope="col">
                                                            Code
                                                        </th>
                                                        {hasDepartment && (
                                                            <th scope="col">
                                                                Department
                                                            </th>
                                                        )}
                                                        <th scope="col">
                                                            Status
                                                        </th>
                                                        <th
                                                            scope="col"
                                                            className="os-actions-column"
                                                        >
                                                            Actions
                                                        </th>
                                                    </tr>
                                                </thead>

                                                <tbody>
                                                    {filteredItems.map(
                                                        (item) => (
                                                            <tr
                                                                key={item._id}
                                                            >
                                                                <td>
                                                                    <div className="os-name-cell">
                                                                        <span className="os-item-icon">
                                                                            <ActiveIcon />
                                                                        </span>
                                                                        <div>
                                                                            <strong>
                                                                                {
                                                                                    item.name
                                                                                }
                                                                            </strong>

                                                                            {isLocationTab && (
                                                                                <div
                                                                                    style={{
                                                                                        marginTop: 3,
                                                                                        fontSize: 10,
                                                                                        color: '#7d9082',
                                                                                    }}
                                                                                >
                                                                                    {[
                                                                                        item
                                                                                            .address
                                                                                            ?.city,
                                                                                        `${item.maximumRadius ?? 500} m radius`,
                                                                                    ]
                                                                                        .filter(
                                                                                            Boolean
                                                                                        )
                                                                                        .join(
                                                                                            ' · '
                                                                                        )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>

                                                                <td data-label="Code">
                                                                    <span className="os-code">
                                                                        {item.code ||
                                                                            '—'}
                                                                    </span>
                                                                </td>

                                                                {hasDepartment && (
                                                                    <td data-label="Department">
                                                                        {departmentNames(
                                                                            item
                                                                        ) ||
                                                                            (activeTab ===
                                                                            'jobRoles'
                                                                                ? 'All departments'
                                                                                : '—')}
                                                                    </td>
                                                                )}

                                                                <td>
                                                                    <span className="os-status">
                                                                        <span />
                                                                        Active
                                                                    </span>
                                                                </td>

                                                                <td className="os-actions-column">
                                                                    <div
                                                                        style={{
                                                                            display:
                                                                                'inline-flex',
                                                                            alignItems:
                                                                                'center',
                                                                            gap: 2,
                                                                        }}
                                                                    >
                                                                        {isLocationTab && (
                                                                            <button
                                                                                type="button"
                                                                                className="os-delete"
                                                                                aria-label={`Edit ${item.name}`}
                                                                                title={`Edit ${item.name}`}
                                                                                disabled={
                                                                                    saving
                                                                                }
                                                                                onClick={() =>
                                                                                    handleEditLocation(
                                                                                        item
                                                                                    )
                                                                                }
                                                                            >
                                                                                <FiEdit2 />
                                                                            </button>
                                                                        )}

                                                                        <button
                                                                            type="button"
                                                                            className="os-delete"
                                                                            aria-label={`Deactivate ${item.name}`}
                                                                            title={`Deactivate ${item.name}`}
                                                                            disabled={
                                                                                saving
                                                                            }
                                                                            onClick={() =>
                                                                                handleDelete(
                                                                                    item._id
                                                                                )
                                                                            }
                                                                        >
                                                                            <FiTrash2 />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {filteredItems.length === 0 && (
                                            <div
                                                className="os-no-results"
                                                role="status"
                                            >
                                                <FiSearch />
                                                <h3>
                                                    No matching{' '}
                                                    {activeResource.label.toLowerCase()}
                                                </h3>
                                                <p>
                                                    Try a different name,
                                                    code, or department.
                                                </p>
                                                <button
                                                    type="button"
                                                    className="os-text-button"
                                                    onClick={() =>
                                                        setSearch('')
                                                    }
                                                >
                                                    Clear search
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}

                                <div className="os-list-footer">
                                    <span>
                                        {loading
                                            ? 'Loading catalog'
                                            : error
                                              ? 'Catalog unavailable'
                                              : `Showing ${filteredItems.length} of ${items.length} ${activeResource.label.toLowerCase()}`}
                                    </span>
                                    <span>
                                        {loading ? '—' : totalItems} entries
                                        across 7 categories
                                    </span>
                                </div>
                            </div>

                            <div className="os-guidance">
                                <FiInfo />
                                <p>
                                    Start with departments, then add teams
                                    and job roles. Designations describe
                                    seniority. Employee access is managed
                                    separately with System Roles.
                                </p>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}