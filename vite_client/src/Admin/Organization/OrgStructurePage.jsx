import React, { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import useOrgStructureCatalog from '../../Hooks/useOrgStructureCatalog';
import { FiPlus, FiRefreshCw, FiTrash2, FiGrid, FiUsers, FiBriefcase, FiAward, FiMapPin, FiClock, FiMonitor, FiArrowRight, FiInfo, FiLayers } from 'react-icons/fi';
import './orgStructure.css';

const RESOURCES = [
    { key: 'departments', label: 'Departments', singular: 'department', icon: FiGrid, description: 'Define the departments that bring your organization together.', example: 'e.g. Engineering', help: 'Group people by their area of expertise.' },
    { key: 'teams', label: 'Teams', singular: 'team', icon: FiUsers, description: 'Bring people together in teams within each department.', example: 'e.g. Product Development', help: 'Every team belongs to a department.' },
    { key: 'jobRoles', label: 'Job Roles', singular: 'job role', icon: FiBriefcase, description: 'Define the work people do across your organization.', example: 'e.g. Backend Developer', help: 'Job roles describe responsibilities, not access permissions.' },
    { key: 'designations', label: 'Designations', singular: 'designation', icon: FiAward, description: 'Create consistent seniority levels for your people.', example: 'e.g. Senior', help: 'Use levels such as Junior, Senior, or Manager.' },
    { key: 'locations', label: 'Locations', singular: 'location', icon: FiMapPin, description: 'Organize the places where your people work.', example: 'e.g. Bengaluru Office', help: 'Add offices, branches, or other work locations.' },
    { key: 'employmentTypes', label: 'Employment Types', singular: 'employment type', icon: FiClock, description: 'Set up the ways people are employed at your company.', example: 'e.g. Full-time', help: 'Define categories such as Full-time or Contract.' },
    { key: 'workModes', label: 'Work Modes', singular: 'work mode', icon: FiMonitor, description: 'Define flexible ways of working for your organization.', example: 'e.g. Hybrid', help: 'Add work arrangements such as On-site, Remote, or Hybrid.' },
];

const inputClass = 'org-structure-input';

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
    const [saving, setSaving] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const { catalog, loading, error, reload } = useOrgStructureCatalog();

    const items = useMemo(() => {
        const list = catalog[activeTab] || [];
        return Array.isArray(list) ? list : [];
    }, [catalog, activeTab]);

    const handleSeed = async () => {
        setSeeding(true);
        try {
            await axios.post('/v1/admin/org-structure/seed', {}, { withCredentials: true });
            toast.success('Organization structure initialized');
            reload();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to initialize structure');
        } finally {
            setSeeding(false);
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
        setSaving(true);
        try {
            const payload = { name: newName.trim(), code: newCode.trim() || undefined };
            if (activeTab === 'teams') {
                payload.departmentId = teamDepartmentId;
            }
            if (activeTab === 'jobRoles' && jobRoleDepartmentId) {
                payload.departmentId = jobRoleDepartmentId;
            }
            await axios.post(`/v1/admin/org-structure/${activeTab}`, payload, { withCredentials: true });
            toast.success('Created');
            setNewName('');
            setNewCode('');
            reload();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Create failed');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        // eslint-disable-next-line no-alert -- Preserve explicit confirmation before deactivation.
        if (!window.confirm('Deactivate this item?')) return;
        try {
            await axios.delete(`/v1/admin/org-structure/${activeTab}/${id}`, { withCredentials: true });
            toast.success('Deactivated');
            reload();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Delete failed');
        }
    };

    const activeResource = RESOURCES.find((r) => r.key === activeTab);

    const ActiveIcon = activeResource.icon;
    const totalItems = RESOURCES.reduce((total, resource) => total + (catalog[resource.key]?.length || 0), 0);

    return (
        <div className="org-structure-page">
            <div className="page-shell">
                <div className="page-shell-inner org-structure-content">
                    <div className="os-breadcrumb">Organization <span>/</span> <strong>Structure</strong></div>
                    <header className="os-header">
                        <div>
                            <div className="os-eyebrow">YOUR ORGANIZATION, CONNECTED</div>
                            <h1>Organization structure</h1>
                            <p>A clear foundation for your people, teams, and the way you work.</p>
                        </div>
                        <button type="button" onClick={handleSeed} disabled={seeding || loading} className="os-button os-button-secondary">
                            <FiRefreshCw className={seeding ? 'os-spin' : ''} /> {seeding ? 'Initializing…' : 'Initialize defaults'}
                        </button>
                    </header>

                    <section className="os-overview" aria-label="Structure overview">
                        <div className="os-overview-intro"><span className="os-icon-tile"><FiLayers /></span><div><h2>Build your company blueprint</h2><p>Start with departments. Add the details as you grow.</p></div></div>
                        <div className="os-overview-stats"><div><strong>{loading ? '—' : catalog.departments?.length || 0}</strong><span>Departments</span></div><div><strong>{loading ? '—' : catalog.teams?.length || 0}</strong><span>Teams</span></div><div><strong>{loading ? '—' : totalItems}</strong><span>Total entries</span></div></div>
                    </section>

                    <div className="os-workspace">
                        <nav className="os-navigation" aria-label="Structure categories">
                            <p className="os-nav-label">COMPANY CATALOG</p>
                            {RESOURCES.map((tab) => {
                                const Icon = tab.icon;
                                return <button key={tab.key} type="button" aria-current={activeTab === tab.key ? 'page' : undefined} onClick={() => { setActiveTab(tab.key); setNewName(''); setNewCode(''); }} className={`os-nav-item ${activeTab === tab.key ? 'is-active' : ''}`}><Icon /><span>{tab.label}</span><span className="os-count">{loading ? '—' : catalog[tab.key]?.length || 0}</span></button>;
                            })}
                            <div className="os-nav-note"><FiInfo /><p>These labels shape your org chart. Employee access is managed separately with System Roles.</p></div>
                        </nav>

                        <section className="os-main" aria-label={activeResource.label}>
                            <div className="os-section-heading"><div><h2>{activeResource.label} <span>{loading ? '—' : items.length}</span></h2><p>{activeResource.description}</p></div><span className="os-section-icon"><ActiveIcon /></span></div>
                            <div className="os-panels">
                                <div className="os-list-panel">
                                    <div className="os-panel-heading"><h3>All {activeResource.label.toLowerCase()}</h3><span>Company catalog</span></div>
                                    {loading ? <div className="os-empty" role="status"><FiRefreshCw className="os-spin" /><h3>Loading your catalog…</h3></div> : error ? <div className="os-empty" role="alert"><FiInfo /><h3>Unable to load your catalog</h3><p>Please try again to see your organization structure.</p><button type="button" className="os-text-button" onClick={reload}>Try again <FiRefreshCw /></button></div> : items.length === 0 ? (
                                        <div className="os-empty">
                                            <div className="os-empty-art" aria-hidden="true"><span /><div><ActiveIcon /></div><span /></div>
                                            <h3>No {activeResource.label.toLowerCase()} yet</h3>
                                            <p>Add your first {activeResource.singular} using the form, or get a head start with our default catalog.</p>
                                            <button type="button" className="os-text-button" onClick={handleSeed} disabled={seeding}> {seeding ? 'Initializing…' : 'Start with defaults'} <FiArrowRight /></button>
                                        </div>
                                    ) : (
                                        <ul className="os-item-list">{items.map((item) => {
                                            let subtitle = item.code || '';
                                            if (activeTab === 'teams' && item.departmentId) {
                                                const dn = deptNameById(catalog.departments, item.departmentId);
                                                subtitle = [subtitle, dn].filter(Boolean).join(' · ');
                                            }
                                            if (activeTab === 'jobRoles' && Array.isArray(item.departmentIds)) {
                                                const names = item.departmentIds.map((id) => deptNameById(catalog.departments, id)).filter(Boolean);
                                                subtitle = [subtitle, ...names].filter(Boolean).join(' · ');
                                            }
                                            return <li key={item._id}><span className="os-item-icon"><ActiveIcon /></span><div className="os-item-text"><strong>{item.name}</strong>{subtitle && <span>{subtitle}</span>}</div><button type="button" onClick={() => handleDelete(item._id)} className="os-delete" aria-label={`Deactivate ${item.name}`} title="Deactivate"><FiTrash2 /></button></li>;
                                        })}</ul>
                                    )}
                                    <div className="os-list-footer"><span className="os-status-dot" />{loading ? 'Loading catalog' : `${items.length} ${items.length === 1 ? activeResource.singular : activeResource.label.toLowerCase()} in your organization`}</div>
                                </div>

                                <form onSubmit={handleCreate} className="os-form-panel">
                                    <span className="os-form-icon"><FiPlus /></span>
                                    <h3>Add {activeResource.singular}</h3>
                                    <p>{activeResource.help}</p>
                                    {(activeTab === 'teams' || activeTab === 'jobRoles') && <label htmlFor="os-department">Department {activeTab === 'jobRoles' && <span>(optional)</span>}<select id="os-department" className={inputClass} value={activeTab === 'teams' ? teamDepartmentId : jobRoleDepartmentId} onChange={(e) => activeTab === 'teams' ? setTeamDepartmentId(e.target.value) : setJobRoleDepartmentId(e.target.value)} required={activeTab === 'teams'}><option value="">{activeTab === 'teams' ? 'Select a department' : 'All departments'}</option>{(catalog.departments || []).map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select></label>}
                                    <label htmlFor="os-name">Name <span className="os-required">*</span><input id="os-name" className={inputClass} placeholder={activeResource.example} value={newName} onChange={(e) => setNewName(e.target.value)} required /></label>
                                    <label htmlFor="os-code">Code <span>(optional)</span><input id="os-code" className={inputClass} placeholder="e.g. ENG" value={newCode} onChange={(e) => setNewCode(e.target.value)} /></label>
                                    <p className="os-field-hint">A short identifier for easy reference.</p>
                                    <button type="submit" disabled={saving || loading} className="os-button os-button-primary"><FiPlus />{saving ? 'Saving…' : `Add ${activeResource.singular}`}</button>
                                </form>
                            </div>
                            <div className="os-guidance"><FiInfo /><p><strong>A little structure goes a long way.</strong> Create departments first, then teams and job roles. Use designations for seniority levels like Junior, Senior, or Manager.</p></div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
