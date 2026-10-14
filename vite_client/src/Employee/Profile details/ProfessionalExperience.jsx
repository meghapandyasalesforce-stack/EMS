import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FiBriefcase, FiPlus, FiX, FiEdit2, FiTrash2 } from 'react-icons/fi';
import {
  addProfessionalExperience,
  deleteProfessionalExperience,
  fetchEmployeeOwnInfo,
  updateProfessionalExperience
} from '../../context/employeeDetailsSlice';

const COMPANY_OPTIONS = [
  'Infosys', 'TCS', 'Wipro', 'HCL Technologies', 'Tech Mahindra', 'Cognizant',
  'Accenture', 'Capgemini', 'IBM', 'Google', 'Microsoft', 'Amazon', 'Meta',
  'Apple', 'Salesforce', 'Oracle', 'SAP', 'Adobe', 'Deloitte', 'PwC', 'EY', 'KPMG',
  'Flipkart', 'Paytm', 'Zomato', 'Swiggy', 'Razorpay', 'PhonePe', 'BYJU\'S',
  'Reliance', 'Tata Group', 'Mahindra', 'L&T', 'Bajaj', 'Bharti Airtel', 'Jio',
];

const JOB_TITLE_OPTIONS = [
  'Software Engineer', 'Senior Software Engineer', 'Lead Software Engineer',
  'Full Stack Developer', 'Frontend Developer', 'Backend Developer',
  'DevOps Engineer', 'Data Scientist', 'Data Analyst', 'Data Engineer',
  'Machine Learning Engineer', 'AI Engineer', 'Cloud Engineer',
  'Product Manager', 'Project Manager', 'Program Manager',
  'Business Analyst', 'System Administrator', 'Network Engineer',
  'UI/UX Designer', 'QA Engineer', 'Test Engineer',
  'HR Executive', 'HR Manager', 'Recruiter', 'Talent Acquisition Specialist',
  'Marketing Manager', 'Sales Executive', 'Account Manager',
  'Finance Analyst', 'Accountant', 'Operations Manager',
  'Consultant', 'Associate', 'Analyst', 'Manager', 'Director', 'VP',
  'CTO', 'CEO', 'CFO', 'COO', 'Intern', 'Trainee',
];

const LOCATION_OPTIONS = [
  'Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata',
  'Noida', 'Gurugram', 'Ahmedabad', 'Jaipur', 'Chandigarh', 'Lucknow',
  'Indore', 'Kochi', 'Thiruvananthapuram', 'Coimbatore', 'Nagpur', 'Bhopal',
  'New York', 'San Francisco', 'London', 'Singapore', 'Dubai', 'Toronto',
  'Sydney', 'Berlin', 'Tokyo', 'Remote',
];

const SearchableSelect = ({ label, required, options, value, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isOther, setIsOther] = useState(false);
  const wrapperRef = useRef(null);

  const isPreset = options.some((o) => o.toLowerCase() === (value || '').toLowerCase());

  useEffect(() => {
    if (value && !isPreset) setIsOther(true);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter((o) => o.toLowerCase().includes(search.toLowerCase()));

  const selectCls = 'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition';

  if (isOther) {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="flex gap-2">
          <input
            className={selectCls + ' flex-1'}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <button
            type="button"
            onClick={() => { setIsOther(false); onChange(''); }}
            className="shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs text-gray-600 hover:bg-gray-100 transition"
            title="Back to list"
          >
            List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div
        className={selectCls + ' cursor-pointer flex items-center justify-between'}
        onClick={() => setOpen(!open)}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>{value || `Select ${label.toLowerCase()}`}</span>
        <svg className={`h-4 w-4 text-gray-400 transition ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-56 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-100">
            <input
              className="w-full rounded border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.map((opt) => (
              <div
                key={opt}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-theme-primary/10 ${value === opt ? 'bg-theme-primary/10 font-medium text-[var(--color-primary)]' : 'text-gray-700'}`}
                onClick={() => { onChange(opt); setOpen(false); setSearch(''); }}
              >
                {opt}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-400">No matches</div>
            )}
          </div>
          <div
            className="border-t border-gray-100 px-3 py-2 text-sm font-medium text-[var(--color-primary)] cursor-pointer hover:bg-theme-primary/5"
            onClick={() => { setIsOther(true); setOpen(false); setSearch(''); onChange(''); }}
          >
            + Other (type manually)
          </div>
        </div>
      )}
    </div>
  );
};

const emptyExperience = {
  companyName: '',
  jobTitle: '',
  employmentType: '',
  location: '',
  startDate: '',
  endDate: '',
  currentlyWorking: false,
  description: ''
};

const formatExperiencePeriod = (record = {}) => {
  const options = { year: 'numeric', month: 'short' };
  const start = record.startDate
    ? new Date(record.startDate).toLocaleDateString(undefined, options)
    : '';
  const end = record.currentlyWorking
    ? 'Present'
    : record.endDate
      ? new Date(record.endDate).toLocaleDateString(undefined, options)
      : '';

  if (start && end) return `${start} - ${end}`;
  if (start) return `${start} - Present`;
  return end || '—';
};

const ProfessionalExperience = () => {
  const dispatch = useDispatch();
  const { employee, loading, addingProfessionalExperience } = useSelector((state) => state.employeeDetails);

  const [experienceInput, setExperienceInput] = useState(emptyExperience);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    dispatch(fetchEmployeeOwnInfo());
  }, [dispatch]);

  const experiences = useMemo(
    () => [...(employee?.professionalExperience || [])].reverse(),
    [employee?.professionalExperience]
  );

  const resetForm = () => {
    setExperienceInput(emptyExperience);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    const companyName = experienceInput.companyName.trim();
    const jobTitle = experienceInput.jobTitle.trim();

    if (!companyName || !jobTitle) {
      setApiError('Company name and job title are required');
      return;
    }

    setApiError(null);
    setSuccessMessage(null);

    const payload = {
      companyName,
      jobTitle,
      employmentType: experienceInput.employmentType.trim() || undefined,
      location: experienceInput.location.trim() || undefined,
      startDate: experienceInput.startDate || undefined,
      endDate: experienceInput.currentlyWorking ? undefined : (experienceInput.endDate || undefined),
      currentlyWorking: Boolean(experienceInput.currentlyWorking),
      description: experienceInput.description.trim() || undefined
    };

    const action = editingId
      ? updateProfessionalExperience({ professionalExperienceId: editingId, ...payload })
      : addProfessionalExperience(payload);

    const result = await dispatch(action);
    const isSuccess = editingId
      ? updateProfessionalExperience.fulfilled.match(result)
      : addProfessionalExperience.fulfilled.match(result);

    if (isSuccess) {
      setSuccessMessage(editingId ? 'Professional experience updated successfully!' : 'Professional experience added successfully!');
      resetForm();
      dispatch(fetchEmployeeOwnInfo());
      return;
    }

    setApiError(result.payload || 'Failed to save professional experience');
  };

  const startEdit = (record) => {
    setExperienceInput({
      companyName: record.companyName || '',
      jobTitle: record.jobTitle || '',
      employmentType: record.employmentType || '',
      location: record.location || '',
      startDate: record.startDate ? new Date(record.startDate).toISOString().split('T')[0] : '',
      endDate: record.endDate ? new Date(record.endDate).toISOString().split('T')[0] : '',
      currentlyWorking: Boolean(record.currentlyWorking),
      description: record.description || ''
    });
    setEditingId(record._id);
    setShowForm(true);
    setApiError(null);
    setSuccessMessage(null);
  };

  const handleDelete = async (professionalExperienceId) => {
    if (!window.confirm('Delete this professional experience?')) return;

    setApiError(null);
    setSuccessMessage(null);
    setDeletingId(professionalExperienceId);

    try {
      const result = await dispatch(deleteProfessionalExperience(professionalExperienceId));
      if (deleteProfessionalExperience.fulfilled.match(result)) {
        setSuccessMessage('Professional experience deleted successfully!');
        dispatch(fetchEmployeeOwnInfo());
      } else {
        setApiError(result.payload || 'Failed to delete professional experience');
      }
    } finally {
      setDeletingId(null);
    }
  };

  if (loading && !employee) {
    return <div className="py-8 text-center text-sm text-gray-400">Loading professional experience...</div>;
  }

  const inputCls = 'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition';

  return (
    <div className="w-full min-w-0 space-y-4">
      {apiError && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="flex-1">{apiError}</p>
          <button
            type="button"
            onClick={() => setApiError(null)}
            className="shrink-0 rounded p-0.5 text-red-400 hover:text-red-600 transition"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="profile-section-header flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50">
              <FiBriefcase className="h-4.5 w-4.5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Professional experience</h2>
              <p className="text-xs text-gray-500">{experiences.length} {experiences.length === 1 ? 'entry' : 'entries'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (showForm) {
                resetForm();
              } else {
                setShowForm(true);
                setEditingId(null);
                setExperienceInput(emptyExperience);
                setApiError(null);
                setSuccessMessage(null);
              }
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
              showForm
                ? 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                : 'bg-theme-primary text-white hover:opacity-90'
            }`}
          >
            {showForm ? (
              <>
                <FiX className="h-4 w-4" />
                Cancel
              </>
            ) : (
              <>
                <FiPlus className="h-4 w-4" />
                Add
              </>
            )}
          </button>
        </div>

        {showForm && (
          <div className="border-b border-gray-100 px-4 sm:px-5 py-4 bg-gray-50/50">
            <div className="space-y-3">
              <div className="hrms-form-grid">
                <div className="md:col-span-2">
                  <SearchableSelect
                    label="Company name"
                    required
                    options={COMPANY_OPTIONS}
                    value={experienceInput.companyName}
                    onChange={(val) => setExperienceInput({ ...experienceInput, companyName: val })}
                    placeholder="Type company name"
                  />
                </div>

                <div className="md:col-span-2">
                  <SearchableSelect
                    label="Job title"
                    required
                    options={JOB_TITLE_OPTIONS}
                    value={experienceInput.jobTitle}
                    onChange={(val) => setExperienceInput({ ...experienceInput, jobTitle: val })}
                    placeholder="Type job title"
                  />
                </div>

                <div>
                  <SearchableSelect
                    label="Employment type"
                    options={['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance', 'Self-employed']}
                    value={experienceInput.employmentType}
                    onChange={(val) => setExperienceInput({ ...experienceInput, employmentType: val })}
                    placeholder="Type employment type"
                  />
                </div>

                <div>
                  <SearchableSelect
                    label="Location"
                    options={LOCATION_OPTIONS}
                    value={experienceInput.location}
                    onChange={(val) => setExperienceInput({ ...experienceInput, location: val })}
                    placeholder="Type location"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Start date</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={experienceInput.startDate}
                    onChange={(event) => setExperienceInput({ ...experienceInput, startDate: event.target.value })}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">End date</label>
                  <input
                    type="date"
                    className={inputCls + ' disabled:bg-gray-100 disabled:cursor-not-allowed'}
                    value={experienceInput.endDate}
                    disabled={experienceInput.currentlyWorking}
                    onChange={(event) => setExperienceInput({ ...experienceInput, endDate: event.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 flex items-center gap-2 text-xs font-medium text-gray-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                      checked={experienceInput.currentlyWorking}
                      onChange={(event) =>
                        setExperienceInput({
                          ...experienceInput,
                          currentlyWorking: event.target.checked,
                          endDate: event.target.checked ? '' : experienceInput.endDate
                        })
                      }
                    />
                    I currently work here
                  </label>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-600">Description (optional)</label>
                  <textarea
                    rows={3}
                    className={inputCls + ' resize-none'}
                    placeholder="Key responsibilities, achievements, or technologies used"
                    value={experienceInput.description}
                    onChange={(event) => setExperienceInput({ ...experienceInput, description: event.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading || addingProfessionalExperience}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-theme-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {addingProfessionalExperience ? 'Saving...' : editingId ? 'Update' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {experiences.length === 0 ? (
          <div className="px-4 sm:px-5 py-4">
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/70 px-4 py-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
                <FiBriefcase className="h-5 w-5 text-indigo-500" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">No professional experience added yet</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
                Add your company history, job titles, and work details to complete this section.
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowForm(true);
                  setEditingId(null);
                  setExperienceInput(emptyExperience);
                  setApiError(null);
                  setSuccessMessage(null);
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-theme-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
              >
                <FiPlus className="h-4 w-4" />
                Add experience
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 px-4 sm:px-5 py-3">
            {experiences.map((record, index) => (
              <div key={record._id || index} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900">{record.jobTitle || '—'}</h3>
                  <p className="text-sm text-gray-600">{record.companyName || '—'}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                    {record.employmentType && <span>{record.employmentType}</span>}
                    {record.employmentType && record.location && <span>·</span>}
                    {record.location && <span>{record.location}</span>}
                    {(record.employmentType || record.location) && <span>·</span>}
                    <span>{formatExperiencePeriod(record)}</span>
                  </div>
                  {record.description && (
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2">{record.description}</p>
                  )}
                </div>

                {record._id && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition disabled:opacity-40"
                      onClick={() => startEdit(record)}
                      disabled={addingProfessionalExperience || deletingId === record._id}
                      title="Edit"
                    >
                      <FiEdit2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition disabled:opacity-40"
                      onClick={() => handleDelete(record._id)}
                      disabled={addingProfessionalExperience || deletingId === record._id}
                      title="Delete"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfessionalExperience;
