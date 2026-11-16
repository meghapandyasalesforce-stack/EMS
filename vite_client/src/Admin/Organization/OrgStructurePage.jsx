import React, { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import useOrgStructureCatalog from '../../Hooks/useOrgStructureCatalog';
import { FiPlus, FiRefreshCw, FiTrash2, FiGrid, FiUsers, FiBriefcase, FiAward, FiMapPin, FiClock, FiMonitor, FiArrowRight, FiInfo, FiSearch, FiX } from 'react-icons/fi';
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
    const [showForm, setShowForm] = useState(false);
    const [search, setSearch] = useState('');
    const { catalog, loading, error, reload } = useOrgStructureCatalog();

    const items = useMemo(() => {
        const list = catalog[activeTab] || [];
        return Array.isArray(list) ? list : [];
    }, [catalog, activeTab]);

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
            setShowForm(false);
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
    const hasDepartment = activeTab === 'teams' || activeTab === 'jobRoles';
    const departmentNames = (item) => {
        const ids = activeTab === 'teams' ? [item.departmentId] : item.departmentIds || [];
        return ids.map((id) => deptNameById(catalog.departments, id)).filter(Boolean).join(', ');
    };
    const filteredItems = items.filter((item) => [item.name, item.code, hasDepartment ? departmentNames(item) : ''].filter(Boolean).join(' ').toLowerCase().includes(search.trim().toLowerCase()));
    const openForm = () => setShowForm(true);

    return (
        <div className="org-structure-page">
            <div className="page-shell">
                <div className="page-shell-inner org-structure-content">
                    <header className="os-header">
                        <div className="os-title-group">
                            <span className="os-title-icon"><FiGrid /></span>
                            <div><div className="os-eyebrow">ORGANIZATION / COMPANY CATALOG</div><h1>Organization structure</h1><p>Manage the departments, roles, and working arrangements that define your company.</p></div>
                        </div>
                    </header>

                    <div className="os-workspace">
                        <nav className="os-navigation" aria-label="Structure categories">
                            {RESOURCES.map((tab) => {
                                const Icon = tab.icon;
                                return <button key={tab.key} type="button" aria-current={activeTab === tab.key ? 'page' : undefined} onClick={() => { setActiveTab(tab.key); setNewName(''); setNewCode(''); setSearch(''); setShowForm(false); }} className={`os-nav-item ${activeTab === tab.key ? 'is-active' : ''}`}><Icon /><span>{tab.label}</span><span className="os-count">{loading ? '—' : catalog[tab.key]?.length || 0}</span></button>;
                            })}
                        </nav>

                        <section className="os-main" aria-label={activeResource.label}>
                            <div className="os-section-heading">
                                <div><h2>{activeResource.label} <span>{loading ? '—' : items.length}</span></h2><p>{activeResource.description}</p></div>
                                <div className="os-toolbar">
                                    <label className="os-search"><FiSearch /><input aria-label={`Search ${activeResource.label.toLowerCase()}`} placeholder={`Search ${activeResource.label.toLowerCase()}…`} value={search} onChange={(e) => setSearch(e.target.value)} />{search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')}><FiX /></button>}</label>
                                    <button type="button" onClick={() => setShowForm(!showForm)} aria-expanded={showForm} aria-controls="os-create-form" disabled={loading || saving} className="os-button os-button-primary"><FiPlus />Add {activeResource.singular}</button>
                                </div>
                            </div>

                            {showForm && <form id="os-create-form" onSubmit={handleCreate} className="os-form-panel">
                                <div className="os-form-heading"><div><h3>New {activeResource.singular}</h3><p>{activeResource.help}</p></div><button type="button" className="os-close" aria-label="Close add form" onClick={() => setShowForm(false)} disabled={saving}><FiX /></button></div>
                                <div className="os-form-fields">
                                    <label htmlFor="os-name">Name <span className="os-required">*</span><input id="os-name" className="org-structure-input" placeholder={activeResource.example} value={newName} onChange={(e) => setNewName(e.target.value)} required autoFocus disabled={saving} /></label>
                                    <label htmlFor="os-code">Code <span>(optional)</span><input id="os-code" className="org-structure-input" placeholder="Short identifier" value={newCode} onChange={(e) => setNewCode(e.target.value)} disabled={saving} /></label>
                                    {hasDepartment && <label htmlFor="os-department">Department {activeTab === 'jobRoles' && <span>(optional)</span>}<select id="os-department" className="org-structure-input" value={activeTab === 'teams' ? teamDepartmentId : jobRoleDepartmentId} onChange={(e) => activeTab === 'teams' ? setTeamDepartmentId(e.target.value) : setJobRoleDepartmentId(e.target.value)} required={activeTab === 'teams'} disabled={saving}><option value="">{activeTab === 'teams' ? 'Select a department' : 'All departments'}</option>{(catalog.departments || []).map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select></label>}
                                    <div className="os-form-actions"><button type="button" className="os-button os-button-secondary" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button><button type="submit" disabled={saving} className="os-button os-button-primary">{saving ? 'Saving…' : 'Save'}<FiArrowRight /></button></div>
                                </div>
                            </form>}

                            <div className="os-list-panel">
                                {loading ? <div className="os-empty" role="status"><FiRefreshCw className="os-spin" /><h3>Loading your catalog…</h3></div> : error ? <div className="os-empty" role="alert"><FiInfo /><h3>Unable to load your catalog</h3><p>Please try again to see your organization structure.</p><button type="button" className="os-text-button" onClick={reload}>Try again <FiRefreshCw /></button></div> : items.length === 0 ? (
                                    <div className="os-empty"><span className="os-empty-icon"><ActiveIcon /></span><div><h3>No {activeResource.label.toLowerCase()} yet</h3><p>Add your first {activeResource.singular} to get started.</p></div><button type="button" className="os-button os-button-secondary" onClick={openForm}><FiPlus />Create {activeResource.singular}</button></div>
                                ) : <>
                                    <div className="os-table-scroll"><table className="os-table"><thead><tr><th scope="col">{activeResource.singular} name</th><th scope="col">Code</th>{hasDepartment && <th scope="col">Department</th>}<th scope="col">Status</th><th scope="col" className="os-actions-column">Actions</th></tr></thead><tbody>
                                        {filteredItems.map((item) => <tr key={item._id}><td><div className="os-name-cell"><span className="os-item-icon"><ActiveIcon /></span><strong>{item.name}</strong></div></td><td data-label="Code"><span className="os-code">{item.code || '—'}</span></td>{hasDepartment && <td data-label="Department">{departmentNames(item) || (activeTab === 'jobRoles' ? 'All departments' : '—')}</td>}<td><span className="os-status"><span />Active</span></td><td className="os-actions-column"><button type="button" onClick={() => handleDelete(item._id)} className="os-delete" aria-label={`Deactivate ${item.name}`} title={`Deactivate ${item.name}`}><FiTrash2 /></button></td></tr>)}
                                    </tbody></table></div>
                                    {filteredItems.length === 0 && <div className="os-no-results" role="status"><FiSearch /><h3>No matching {activeResource.label.toLowerCase()}</h3><p>Try a different name, code, or department.</p><button type="button" className="os-text-button" onClick={() => setSearch('')}>Clear search</button></div>}
                                </>}
                                <div className="os-list-footer"><span>{loading ? 'Loading catalog' : error ? 'Catalog unavailable' : `Showing ${filteredItems.length} of ${items.length} ${activeResource.label.toLowerCase()}`}</span><span>{loading ? '—' : totalItems} entries across 7 categories</span></div>
                            </div>
                            <div className="os-guidance"><FiInfo /><p>Start with departments, then add teams and job roles. Designations describe seniority. Employee access is managed separately with System Roles.</p></div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
