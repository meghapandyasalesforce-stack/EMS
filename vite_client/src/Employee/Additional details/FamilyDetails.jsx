import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addFamilyDetail, updateFamilyDetail } from '../../context/employeeDetailsSlice';
import { toast } from 'react-toastify';
import { FiUsers, FiPlus, FiEdit2, FiPhone, FiBriefcase, FiMapPin } from 'react-icons/fi';

const relationshipOptions = ['Father', 'Mother', 'Spouse', 'Sibling', 'Child', 'Guardian', 'Other'];

const FamilyDetails = () => {
  const dispatch = useDispatch();
  const { employee, addingFamilyDetail, updatingFamilyDetail } = useSelector((state) => state.employeeDetails);

  const initialFormData = {
    fullName: '',
    relationship: '',
    phoneNo: '',
    address: '',
    occupation: '',
  };

  const [formData, setFormData] = useState(initialFormData);
  const [formOpen, setFormOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState(null);

  const familyDetails = employee?.familyDetails || [];
  const saving = addingFamilyDetail || updatingFamilyDetail;
  const maxMembers = 4;

  useEffect(() => {
    if (familyDetails.length === 0) {
      setFormOpen(true);
      setEditingMemberId(null);
      setFormData(initialFormData);
    }
  }, [employee?._id, familyDetails.length]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const openAddForm = () => {
    if (familyDetails.length >= maxMembers) {
      toast.error('Maximum of 4 family members allowed.');
      return;
    }
    setEditingMemberId(null);
    setFormData(initialFormData);
    setFormOpen(true);
  };

  const openEditForm = (member) => {
    const id = member._id;
    if (!id) {
      toast.error('This family entry cannot be edited. Please refresh and try again.');
      return;
    }
    setEditingMemberId(id);
    setFormData({
      fullName: member.fullName || '',
      relationship: member.relationship || '',
      phoneNo: member.phoneNo || '',
      address: member.address || '',
      occupation: member.occupation || '',
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    if (familyDetails.length === 0) {
      setFormData(initialFormData);
      return;
    }
    setFormOpen(false);
    setEditingMemberId(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingMemberId) {
        await dispatch(
          updateFamilyDetail({
            familyMemberId: editingMemberId,
            ...formData,
          })
        ).unwrap();
        toast.success('Family detail updated successfully!');
      } else {
        await dispatch(addFamilyDetail(formData)).unwrap();
        toast.success('Family detail added successfully!');
      }
      setFormData(initialFormData);
      setEditingMemberId(null);
      setFormOpen(false);
    } catch (error) {
      toast.error(typeof error === 'string' ? error : 'Something went wrong');
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition';

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white">
        {/* Header */}
        <div className="profile-section-header flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-50">
              <FiUsers className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Family details</h2>
              <p className="text-xs text-gray-500">
                {familyDetails.length} of {maxMembers} members added
              </p>
            </div>
          </div>

          {!formOpen && familyDetails.length > 0 && familyDetails.length < maxMembers && (
            <button
              type="button"
              onClick={openAddForm}
              className="inline-flex items-center gap-1.5 rounded-lg bg-theme-primary px-3.5 py-2 text-sm font-medium text-white hover:opacity-90 transition"
            >
              <FiPlus className="h-4 w-4" />
              Add
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5">
          {!formOpen && familyDetails.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {familyDetails.map((member, index) => (
                <div
                  key={member._id || index}
                  className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">
                        {member.fullName || 'N/A'}
                      </span>
                      {member.relationship && (
                        <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                          {member.relationship}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                      {member.phoneNo && (
                        <span className="inline-flex items-center gap-1">
                          <FiPhone className="h-3 w-3" />
                          {member.phoneNo}
                        </span>
                      )}
                      {member.occupation && (
                        <span className="inline-flex items-center gap-1">
                          <FiBriefcase className="h-3 w-3" />
                          {member.occupation}
                        </span>
                      )}
                      {member.address && (
                        <span className="inline-flex items-center gap-1">
                          <FiMapPin className="h-3 w-3" />
                          {member.address}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEditForm(member)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                  >
                    <FiEdit2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-sm text-gray-500">
                {editingMemberId
                  ? 'Update the details below, then click Update.'
                  : 'Add a new family member below.'}
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col">
                  <label htmlFor="fullName" className="text-xs font-medium text-gray-600 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    id="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col">
                  <label htmlFor="relationship" className="text-xs font-medium text-gray-600 mb-1">
                    Relationship
                  </label>
                  <select
                    name="relationship"
                    id="relationship"
                    value={formData.relationship}
                    onChange={handleChange}
                    required
                    className={inputClass}
                  >
                    <option value="">Select relationship</option>
                    {relationshipOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col">
                  <label htmlFor="phoneNo" className="text-xs font-medium text-gray-600 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    name="phoneNo"
                    id="phoneNo"
                    value={formData.phoneNo}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col">
                  <label htmlFor="occupation" className="text-xs font-medium text-gray-600 mb-1">
                    Occupation
                  </label>
                  <input
                    type="text"
                    name="occupation"
                    id="occupation"
                    value={formData.occupation}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col sm:col-span-2">
                  <label htmlFor="address" className="text-xs font-medium text-gray-600 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    name="address"
                    id="address"
                    value={formData.address}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                {familyDetails.length > 0 && (
                  <button
                    type="button"
                    onClick={closeForm}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition ${
                    saving ? 'bg-theme-secondary' : 'bg-theme-primary hover:opacity-90'
                  }`}
                >
                  {saving ? 'Saving...' : editingMemberId ? 'Update' : 'Save family details'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default FamilyDetails;
