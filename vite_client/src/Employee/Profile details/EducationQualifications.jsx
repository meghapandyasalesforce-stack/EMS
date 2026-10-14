import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchEmployeeOwnInfo,
  addAcademicRecord,
  updateAcademicRecord,
  deleteAcademicRecord,
  deleteProfessionalQualification
} from '../../context/employeeDetailsSlice';
import axios, { getUploadUrl } from '../../utils/axios';
import { BOTH_PROFILE_ENDPOINT } from '../../utils/constant';
import { FiUploadCloud, FiFileText, FiEdit2, FiTrash2, FiPlus, FiX, FiExternalLink, FiCalendar, FiAward, FiBookOpen } from 'react-icons/fi';

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
    if (s && e) return `${s} – ${e}`;
    if (s) return `${s} – Present`;
    if (e) return e;
  }
  if (record.year) return String(record.year);
  return null;
}

const EducationQualifications = () => {
  const dispatch = useDispatch();
  const { employee, loading } = useSelector((state) => state.employeeDetails);

  const [academicInput, setAcademicInput] = useState(emptyAcademic);
  const [showAcademicForm, setShowAcademicForm] = useState(false);
  const [editingAcademicId, setEditingAcademicId] = useState(null);
  const [isSavingAcademic, setIsSavingAcademic] = useState(false);
  const [isUploadingCertification, setIsUploadingCertification] = useState(false);
  const [deletingAcademicId, setDeletingAcademicId] = useState(null);
  const [deletingProfessionalId, setDeletingProfessionalId] = useState(null);
  const [apiError, setApiError] = useState(null);
  const certificationInputRef = useRef(null);
  const dragRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    dispatch(fetchEmployeeOwnInfo());
  }, [dispatch]);

  const clearError = () => setApiError(null);

  const handleSaveAcademic = async () => {
    const inst = academicInput.institution.trim();
    const deg = academicInput.degree.trim();
    const det = academicInput.details.trim();
    if (!inst || (!deg && !det)) {
      setApiError('Institution and degree (or other details) are required');
      return;
    }

    clearError();
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
    clearError();
  };

  const handleDeleteAcademic = async (academicRecordId) => {
    if (!window.confirm('Delete this academic record?')) return;
    clearError();
    setDeletingAcademicId(academicRecordId);
    try {
      const result = await dispatch(deleteAcademicRecord(academicRecordId));
      if (deleteAcademicRecord.fulfilled.match(result)) {
        dispatch(fetchEmployeeOwnInfo());
      } else {
        setApiError(result.payload || 'Failed to delete academic record');
      }
    } finally {
      setDeletingAcademicId(null);
    }
  };

  const uploadFiles = async (files) => {
    if (!files.length) return;
    clearError();
    setIsUploadingCertification(true);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('documents', file));
      await axios.post(`${BOTH_PROFILE_ENDPOINT}/upload-professional-qualification`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await dispatch(fetchEmployeeOwnInfo());
    } catch (error) {
      setApiError(error.response?.data?.message || error.message || 'Failed to upload certification');
    } finally {
      setIsUploadingCertification(false);
      if (certificationInputRef.current) certificationInputRef.current.value = '';
    }
  };

  const handleCertificationUpload = (event) => {
    uploadFiles(Array.from(event.target.files || []));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    uploadFiles(Array.from(e.dataTransfer.files || []));
  };

  const handleDeleteProfessional = async (professionalQualificationId) => {
    if (!window.confirm('Delete this certification?')) return;
    clearError();
    setDeletingProfessionalId(professionalQualificationId);
    try {
      const result = await dispatch(deleteProfessionalQualification(professionalQualificationId));
      if (deleteProfessionalQualification.fulfilled.match(result)) {
        dispatch(fetchEmployeeOwnInfo());
      } else {
        setApiError(result.payload || 'Failed to delete certification');
      }
    } finally {
      setDeletingProfessionalId(null);
    }
  };

  const getFileIcon = (name) => {
    if (!name) return <FiFileText className="text-gray-400" size={20} />;
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FiFileText className="text-red-500" size={20} />;
    if (['png', 'jpg', 'jpeg'].includes(ext)) return <FiFileText className="text-blue-500" size={20} />;
    if (['doc', 'docx'].includes(ext)) return <FiFileText className="text-blue-600" size={20} />;
    return <FiFileText className="text-gray-400" size={20} />;
  };

  if (loading && !employee) {
    return <div className="text-center py-8 text-gray-500">Loading qualifications...</div>;
  }

  const academics = employee?.academicRecords || [];
  const certifications = employee?.professionalQualifications || [];

  const inputCls = 'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition placeholder:text-gray-400';

  return (
    <div className="w-full min-w-0 space-y-6">
      {apiError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <span className="flex-1">{apiError}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-600"><FiX size={16} /></button>
        </div>
      )}

      {/* Academic Records */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="profile-section-header flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <FiBookOpen className="text-blue-600" size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Academic records</h2>
              <p className="text-xs text-gray-500">{academics.length} record{academics.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (showAcademicForm) {
                setAcademicInput(emptyAcademic);
                setEditingAcademicId(null);
              }
              setShowAcademicForm(!showAcademicForm);
              clearError();
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition ${showAcademicForm ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-theme-primary text-white hover:opacity-90'}`}
          >
            {showAcademicForm ? <><FiX size={15} /> Cancel</> : <><FiPlus size={15} /> Add</>}
          </button>
        </div>

        {showAcademicForm && (
          <div className="border-b border-gray-100 px-5 py-4 bg-gray-50/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Institution <span className="text-red-500">*</span></label>
                <input className={inputCls} placeholder="e.g. Indian Institute of Technology" value={academicInput.institution} onChange={(e) => setAcademicInput({ ...academicInput, institution: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Degree / qualification <span className="text-red-500">*</span></label>
                <input className={inputCls} placeholder="e.g. B.Tech Computer Science" value={academicInput.degree} onChange={(e) => setAcademicInput({ ...academicInput, degree: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Field of study</label>
                <input className={inputCls} placeholder="e.g. Computer Science" value={academicInput.fieldOfStudy} onChange={(e) => setAcademicInput({ ...academicInput, fieldOfStudy: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start date</label>
                <input type="date" className={inputCls} value={academicInput.startDate} onChange={(e) => setAcademicInput({ ...academicInput, startDate: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">End date</label>
                <input type="date" className={inputCls} value={academicInput.endDate} onChange={(e) => setAcademicInput({ ...academicInput, endDate: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">CGPA / grade</label>
                <input className={inputCls} placeholder="e.g. 8.7/10, 92%" value={academicInput.cgpa} onChange={(e) => setAcademicInput({ ...academicInput, cgpa: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Additional notes</label>
                <input className={inputCls} placeholder="Honors, thesis title, etc." value={academicInput.details} onChange={(e) => setAcademicInput({ ...academicInput, details: e.target.value })} />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleSaveAcademic}
                className="inline-flex items-center gap-1.5 rounded-lg bg-theme-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition disabled:opacity-60"
                disabled={loading || isSavingAcademic}
              >
                {isSavingAcademic ? 'Saving...' : editingAcademicId ? 'Update record' : 'Save record'}
              </button>
            </div>
          </div>
        )}

        <div className="px-5 py-3">
          {academics.length === 0 ? (
            <div>
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/70 px-4 py-5 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                  <FiBookOpen className="text-blue-500" size={20} />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">No academic records added yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Add your education details such as degree, institution, and study period.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {[...academics].reverse().map((record, index) => {
                const period = formatAcademicPeriod(record);
                return (
                  <div key={record._id || index} className="py-3.5 first:pt-1 last:pb-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-gray-900">{record.degree || record.details || '—'}</h3>
                        <p className="text-sm text-gray-600 mt-0.5">{record.institution}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-500">
                          {period && (
                            <span className="inline-flex items-center gap-1"><FiCalendar size={12} />{period}</span>
                          )}
                          {record.fieldOfStudy && <span>{record.fieldOfStudy}</span>}
                          {(record.cgpa || record.gpa || record.grade) && (
                            <span className="font-medium text-gray-600">{record.cgpa || record.gpa || record.grade}</span>
                          )}
                        </div>
                        {record.details && record.degree && (
                          <p className="text-xs text-gray-500 mt-1">{record.details}</p>
                        )}
                      </div>
                      {record._id && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                            onClick={() => startAcademicEdit(record)}
                            disabled={isSavingAcademic || deletingAcademicId === record._id}
                            title="Edit"
                          >
                            <FiEdit2 size={15} />
                          </button>
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                            onClick={() => handleDeleteAcademic(record._id)}
                            disabled={isSavingAcademic || deletingAcademicId === record._id}
                            title="Delete"
                          >
                            <FiTrash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Certifications Upload */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="profile-section-header flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
              <FiAward className="text-amber-600" size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Certifications</h2>
              <p className="text-xs text-gray-500">{certifications.length} file{certifications.length !== 1 ? 's' : ''} uploaded</p>
            </div>
          </div>
        </div>

        {/* Drag & drop upload area */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div
            ref={dragRef}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !isUploadingCertification && certificationInputRef.current?.click()}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 cursor-pointer transition ${isDragging ? 'border-[var(--color-primary)] bg-theme-primary/5' : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'}`}
          >
            <input
              ref={certificationInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
              multiple
              className="hidden"
              onChange={handleCertificationUpload}
            />
            <FiUploadCloud className={`mb-2 ${isDragging ? 'text-[var(--color-primary)]' : 'text-gray-400'}`} size={28} />
            {isUploadingCertification ? (
              <p className="text-sm text-gray-500">Uploading...</p>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-700">
                  Drop files here or <span className="text-[var(--color-primary)]">browse</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">PDF, images, Word, Excel supported</p>
              </>
            )}
          </div>
        </div>

        <div className="px-5 py-3">
          {certifications.length === 0 ? (
            <div>
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/70 px-4 py-5 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
                  <FiAward className="text-amber-500" size={20} />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">No certifications uploaded yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Upload your certification files here to keep your profile complete and updated.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {certifications.map((q, index) => {
                const fileName = q.originalName || q.fileName || q.title || 'Certification';
                return (
                  <div key={q._id || index} className="flex items-center gap-3 py-3 first:pt-1 last:pb-1">
                    <div className="shrink-0">
                      {getFileIcon(fileName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
                      {q.uploadedAt && (
                        <p className="text-xs text-gray-400">{new Date(q.uploadedAt).toLocaleDateString()}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {q.filePath && (
                        <a
                          href={getUploadUrl(q.filePath)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                          title="View"
                        >
                          <FiExternalLink size={15} />
                        </a>
                      )}
                      {q._id && (
                        <button
                          type="button"
                          className="rounded-md p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                          onClick={() => handleDeleteProfessional(q._id)}
                          disabled={isUploadingCertification || deletingProfessionalId === q._id}
                          title="Delete"
                        >
                          <FiTrash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EducationQualifications;
