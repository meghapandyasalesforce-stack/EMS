import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchEmployeeOwnInfo,
  addAcademicRecord,
  updateAcademicRecord,
  deleteAcademicRecord,
  addProfessionalQualification,
  updateProfessionalQualification,
  deleteProfessionalQualification
} from '../../context/employeeDetailsSlice';

const emptyAcademic = {
  institution: '',
  degree: '',
  fieldOfStudy: '',
  startDate: '',
  endDate: '',
  cgpa: '',
  details: '',
};

function formatAcademicPeriod(record) {
  if (record.startDate || record.endDate) {
    const opts = { year: 'numeric', month: 'short' };
    const s = record.startDate
      ? new Date(record.startDate).toLocaleDateString(undefined, opts)
      : '';
    const e = record.endDate
      ? new Date(record.endDate).toLocaleDateString(undefined, opts)
      : '';
    if (s && e) return `${s} → ${e}`;
    if (s) return `${s} → Present`;
    if (e) return e;
  }
  if (record.year) return String(record.year);
  return '—';
}

const EducationQualifications = () => {
  const dispatch = useDispatch();
  const { employee, loading } = useSelector((state) => state.employeeDetails);

  const [academicInput, setAcademicInput] = useState(emptyAcademic);
  const [professionalInput, setProfessionalInput] = useState({
    title: '',
    organization: '',
    duration: '',
    description: ''
  });

  const [showAcademicForm, setShowAcademicForm] = useState(false);
  const [showProfessionalForm, setShowProfessionalForm] = useState(false);
  const [editingAcademicId, setEditingAcademicId] = useState(null);
  const [editingProfessionalId, setEditingProfessionalId] = useState(null);
  const [isSavingAcademic, setIsSavingAcademic] = useState(false);
  const [isSavingProfessional, setIsSavingProfessional] = useState(false);
  const [deletingAcademicId, setDeletingAcademicId] = useState(null);
  const [deletingProfessionalId, setDeletingProfessionalId] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    dispatch(fetchEmployeeOwnInfo());
  }, [dispatch]);

  const handleSaveAcademic = async () => {
    const inst = academicInput.institution.trim();
    const deg = academicInput.degree.trim();
    const det = academicInput.details.trim();
    if (!inst || (!deg && !det)) {
      setApiError('Institution and degree (or other details) are required');
      return;
    }

    setApiError(null);
    setSuccessMessage(null);
    setIsSavingAcademic(true);

    try {
      const payload = {
        institution: inst,
        degree: deg,
        fieldOfStudy: academicInput.fieldOfStudy.trim() || undefined,
        startDate: academicInput.startDate || undefined,
        endDate: academicInput.endDate || undefined,
        cgpa: academicInput.cgpa.trim() || undefined,
        details: det || undefined,
      };
      const action = editingAcademicId
        ? updateAcademicRecord({ academicRecordId: editingAcademicId, ...payload })
        : addAcademicRecord(payload);
      const result = await dispatch(action);
      const isSuccess = editingAcademicId
        ? updateAcademicRecord.fulfilled.match(result)
        : addAcademicRecord.fulfilled.match(result);

      if (isSuccess) {
        setSuccessMessage(editingAcademicId ? 'Academic record updated successfully!' : 'Academic record added successfully!');
        setAcademicInput(emptyAcademic);
        setEditingAcademicId(null);
        setShowAcademicForm(false);
        dispatch(fetchEmployeeOwnInfo());
      } else {
        setApiError(result.payload || 'Failed to save academic record');
      }
    } catch (error) {
      setApiError(error.message);
    } finally {
      setIsSavingAcademic(false);
    }
  };

  const handleSaveProfessional = async () => {
    if (!professionalInput.title || !professionalInput.organization) {
      setApiError('Title and organization are required');
      return;
    }

    setApiError(null);
    setSuccessMessage(null);
    setIsSavingProfessional(true);

    try {
      const payload = {
        title: professionalInput.title,
        organization: professionalInput.organization,
        duration: professionalInput.duration,
        description: professionalInput.description
      };
      const action = editingProfessionalId
        ? updateProfessionalQualification({
          professionalQualificationId: editingProfessionalId,
          ...payload
        })
        : addProfessionalQualification(payload);
      const result = await dispatch(action);
      const isSuccess = editingProfessionalId
        ? updateProfessionalQualification.fulfilled.match(result)
        : addProfessionalQualification.fulfilled.match(result);

      if (isSuccess) {
        setSuccessMessage(editingProfessionalId
          ? 'Professional qualification updated successfully!'
          : 'Professional qualification added successfully!');
        setProfessionalInput({
          title: '',
          organization: '',
          duration: '',
          description: ''
        });
        setEditingProfessionalId(null);
        setShowProfessionalForm(false);
        dispatch(fetchEmployeeOwnInfo());
      } else {
        const errorMessage = result.payload || 'Failed to save professional qualification';
        throw new Error(errorMessage);
      }
    } catch (error) {
      setApiError(error.message);
    } finally {
      setIsSavingProfessional(false);
    }
  };

  const startAcademicEdit = (record) => {
    setAcademicInput({
      institution: record.institution || '',
      degree: record.degree || '',
      fieldOfStudy: record.fieldOfStudy || '',
      startDate: record.startDate ? new Date(record.startDate).toISOString().split('T')[0] : '',
      endDate: record.endDate ? new Date(record.endDate).toISOString().split('T')[0] : '',
      cgpa: record.cgpa || '',
      details: record.details || ''
    });
    setEditingAcademicId(record._id);
    setShowAcademicForm(true);
    setShowProfessionalForm(false);
    setApiError(null);
    setSuccessMessage(null);
  };

  const handleDeleteAcademic = async (academicRecordId) => {
    if (!window.confirm('Delete this academic record?')) return;
    setApiError(null);
    setSuccessMessage(null);
    setDeletingAcademicId(academicRecordId);
    try {
      const result = await dispatch(deleteAcademicRecord(academicRecordId));
      if (deleteAcademicRecord.fulfilled.match(result)) {
        setSuccessMessage('Academic record deleted successfully!');
        dispatch(fetchEmployeeOwnInfo());
      } else {
        setApiError(result.payload || 'Failed to delete academic record');
      }
    } finally {
      setDeletingAcademicId(null);
    }
  };

  const startProfessionalEdit = (qualification) => {
    setProfessionalInput({
      title: qualification.title || '',
      organization: qualification.organization || '',
      duration: qualification.duration || '',
      description: qualification.description || ''
    });
    setEditingProfessionalId(qualification._id);
    setShowProfessionalForm(true);
    setShowAcademicForm(false);
    setApiError(null);
    setSuccessMessage(null);
  };

  const handleDeleteProfessional = async (professionalQualificationId) => {
    if (!window.confirm('Delete this professional qualification?')) return;
    setApiError(null);
    setSuccessMessage(null);
    setDeletingProfessionalId(professionalQualificationId);
    try {
      const result = await dispatch(deleteProfessionalQualification(professionalQualificationId));
      if (deleteProfessionalQualification.fulfilled.match(result)) {
        setSuccessMessage('Professional qualification deleted successfully!');
        dispatch(fetchEmployeeOwnInfo());
      } else {
        setApiError(result.payload || 'Failed to delete professional qualification');
      }
    } finally {
      setDeletingProfessionalId(null);
    }
  };

  if (loading && !employee) {
    return <div className="text-center py-8">Loading qualifications...</div>;
  }

  return (
    <div className="w-full min-w-0">
      <div className="w-full">
        {apiError && (
          <div className="mb-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700">
            <p>{apiError}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-4 bg-theme-primary/10 border-l-4 border-theme-primary text-theme-primary">
            <p>{successMessage}</p>
          </div>
        )}

        <div className="mb-8 bg-white p-6 rounded-lg shadow">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
            <h2 className="text-xl font-bold text-gray-800">Academic records</h2>
            <button
              type="button"
              onClick={() => {
                setShowAcademicForm(!showAcademicForm);
                if (showAcademicForm) {
                  setAcademicInput(emptyAcademic);
                  setEditingAcademicId(null);
                }
                setShowProfessionalForm(false);
                setApiError(null);
                setSuccessMessage(null);
              }}
              className="px-4 py-2 bg-theme-primary text-white rounded hover:opacity-90 transition w-full sm:w-auto"
            >
              {showAcademicForm ? 'Cancel' : 'Add academic record'}
            </button>
          </div>

          {showAcademicForm && (
            <div className="mb-6 space-y-3">
              <div className="hrms-form-grid">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Institution <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    placeholder="e.g. Indian Institute of Technology"
                    value={academicInput.institution}
                    onChange={(e) => setAcademicInput({ ...academicInput, institution: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Degree / qualification <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    placeholder="e.g. B.Tech Computer Science, HSC"
                    value={academicInput.degree}
                    onChange={(e) => setAcademicInput({ ...academicInput, degree: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Field of study (optional)</label>
                  <input
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    placeholder="e.g. Computer Science"
                    value={academicInput.fieldOfStudy}
                    onChange={(e) => setAcademicInput({ ...academicInput, fieldOfStudy: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                  <input
                    type="date"
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    value={academicInput.startDate}
                    onChange={(e) => setAcademicInput({ ...academicInput, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End date (or expected)</label>
                  <input
                    type="date"
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    value={academicInput.endDate}
                    onChange={(e) => setAcademicInput({ ...academicInput, endDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CGPA / grade (optional)</label>
                  <input
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    placeholder="e.g. 8.7/10, 92%"
                    value={academicInput.cgpa}
                    onChange={(e) => setAcademicInput({ ...academicInput, cgpa: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Additional notes (optional)</label>
                  <textarea
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    placeholder="Honors, thesis title, etc. (if not covered above, you can put degree text here instead of the degree field)"
                    rows={2}
                    value={academicInput.details}
                    onChange={(e) => setAcademicInput({ ...academicInput, details: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    If you only fill Notes and leave Degree empty, Notes is treated as the qualification line (legacy style).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSaveAcademic}
                className="px-4 py-2 bg-theme-primary text-white rounded hover:opacity-90 transition w-full sm:w-auto"
                disabled={loading || isSavingAcademic}
              >
                {isSavingAcademic ? 'Saving...' : editingAcademicId ? 'Update' : 'Save'}
              </button>
            </div>
          )}

          {!employee?.academicRecords || employee.academicRecords.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No academic records added yet.</p>
          ) : (
            <div className="space-y-4">
              {[...employee.academicRecords].reverse().map((record, index) => (
                <div key={record._id || index} className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-100">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">{record.institution}</h3>
                      <p className="text-gray-700 font-medium">
                        {record.degree || record.details || '—'}
                      </p>
                      {record.fieldOfStudy ? (
                        <p className="text-sm text-gray-600">Field: {record.fieldOfStudy}</p>
                      ) : null}
                    </div>
                    <div className="text-sm text-gray-600 sm:text-right">
                      <p>{formatAcademicPeriod(record)}</p>
                      {(record.cgpa || record.gpa || record.grade) && (
                        <p className="mt-1">
                          <span className="font-medium text-gray-700">CGPA / grade: </span>
                          {record.cgpa || record.gpa || record.grade}
                        </p>
                      )}
                    </div>
                  </div>
                  {record.details && record.degree && (
                    <p className="text-sm text-gray-600 mt-2 border-t border-gray-200 pt-2">{record.details}</p>
                  )}
                  {record._id && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:opacity-90"
                        onClick={() => startAcademicEdit(record)}
                        disabled={isSavingAcademic || deletingAcademicId === record._id}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:opacity-90"
                        onClick={() => handleDeleteAcademic(record._id)}
                        disabled={isSavingAcademic || deletingAcademicId === record._id}
                      >
                        {deletingAcademicId === record._id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
            <h2 className="text-xl font-bold text-gray-800">Professional qualifications</h2>
            <button
              type="button"
              onClick={() => {
                setShowProfessionalForm(!showProfessionalForm);
                if (showProfessionalForm) {
                  setProfessionalInput({
                    title: '',
                    organization: '',
                    duration: '',
                    description: ''
                  });
                  setEditingProfessionalId(null);
                }
                setShowAcademicForm(false);
                setApiError(null);
                setSuccessMessage(null);
              }}
              className="px-4 py-2 bg-theme-primary text-white rounded hover:opacity-90 transition w-full sm:w-auto"
            >
              {showProfessionalForm ? 'Cancel' : 'Add professional qualification'}
            </button>
          </div>

          {showProfessionalForm && (
            <div className="mb-6 space-y-3">
              <div className="hrms-form-grid">
              <input
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                placeholder="Title"
                value={professionalInput.title}
                onChange={(e) => setProfessionalInput({ ...professionalInput, title: e.target.value })}
              />
              <input
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                placeholder="Organization"
                value={professionalInput.organization}
                onChange={(e) => setProfessionalInput({ ...professionalInput, organization: e.target.value })}
              />
              <input
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                placeholder="Duration"
                value={professionalInput.duration}
                onChange={(e) => setProfessionalInput({ ...professionalInput, duration: e.target.value })}
              />
              <input
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                placeholder="Description (optional)"
                value={professionalInput.description}
                onChange={(e) => setProfessionalInput({ ...professionalInput, description: e.target.value })}
              />
              </div>
              <button
                type="button"
                onClick={handleSaveProfessional}
                className="px-4 py-2 bg-theme-primary text-white rounded hover:opacity-90 transition w-full sm:w-auto"
                disabled={loading || isSavingProfessional}
              >
                {isSavingProfessional ? 'Saving...' : editingProfessionalId ? 'Update' : 'Save'}
              </button>
            </div>
          )}

          {!employee?.professionalQualifications || employee.professionalQualifications.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No professional qualifications added yet.</p>
          ) : (
            <div className="space-y-4">
              {employee.professionalQualifications.map((qualification, index) => (
                <div key={qualification._id || index} className="bg-gray-50 p-4 rounded-lg shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-800">{qualification.title}</h3>
                  {qualification.organization && <p className="text-gray-600">{qualification.organization}</p>}
                  <p className="text-gray-600">{qualification.duration}</p>
                  {qualification.description && <p className="text-gray-600">{qualification.description}</p>}
                  {qualification._id && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:opacity-90"
                        onClick={() => startProfessionalEdit(qualification)}
                        disabled={isSavingProfessional || deletingProfessionalId === qualification._id}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:opacity-90"
                        onClick={() => handleDeleteProfessional(qualification._id)}
                        disabled={isSavingProfessional || deletingProfessionalId === qualification._id}
                      >
                        {deletingProfessionalId === qualification._id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EducationQualifications;
