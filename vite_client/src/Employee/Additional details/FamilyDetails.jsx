import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addFamilyDetail, updateFamilyDetail } from '../../context/employeeDetailsSlice';
import { toast } from 'react-toastify';

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
  /** Show add/edit form vs read-only list */
  const [formOpen, setFormOpen] = useState(false);
  /** Mongo subdoc _id when editing; null when adding */
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

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen transition-all duration-300">
      <div className="max-w-xl mx-auto p-6 bg-white rounded-xl shadow-md border border-gray-200">
        <h2 className="text-2xl font-semibold text-center text-gray-800 mb-6">Family Details</h2>

        {!formOpen && familyDetails.length > 0 ? (
          <div className="space-y-4">
            {familyDetails.map((member, index) => (
              <div
                key={member._id || index}
                className="bg-gray-100 p-5 rounded-lg shadow-sm border border-gray-300"
              >
                <p className="mb-2">
                  <strong>Name:</strong> {member.fullName || 'N/A'}
                </p>
                <p className="mb-2">
                  <strong>Occupation:</strong> {member.occupation || 'N/A'}
                </p>
                <p className="mb-2">
                  <strong>Phone:</strong> {member.phoneNo || 'N/A'}
                </p>
                <p className="mb-2">
                  <strong>Relationship:</strong> {member.relationship || 'N/A'}
                </p>
                <p className="mb-4">
                  <strong>Address:</strong> {member.address || 'N/A'}
                </p>
                <button
                  type="button"
                  className="bg-theme-primary text-white px-4 py-2 rounded hover:opacity-90 transition"
                  onClick={() => openEditForm(member)}
                >
                  Edit
                </button>
              </div>
            ))}

            {familyDetails.length < maxMembers && (
              <button
                type="button"
                className="bg-theme-primary text-white px-4 py-2 rounded hover:opacity-90 transition"
                onClick={openAddForm}
              >
                Add more
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-600">
              {editingMemberId
                ? 'Update the details below, then click Update.'
                : 'Add a new family member below.'}
            </p>
            {['fullName', 'occupation', 'relationship', 'phoneNo', 'address'].map((field) => (
              <div key={field} className="flex flex-col">
                <label htmlFor={field} className="font-medium text-gray-700 capitalize">
                  {field === 'phoneNo' ? 'Phone Number' : field.replace(/([A-Z])/g, ' $1')}
                </label>
                <input
                  type="text"
                  name={field}
                  id={field}
                  value={formData[field]}
                  onChange={handleChange}
                  required={['fullName', 'relationship'].includes(field)}
                  className="mt-1 px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary"
                />
              </div>
            ))}

            <div className="flex gap-3 pt-2 flex-wrap">
              <button
                type="submit"
                disabled={saving}
                className={`${
                  saving ? 'bg-theme-secondary' : 'bg-theme-primary hover:opacity-90'
                } text-white px-4 py-2 rounded transition`}
              >
                {saving ? 'Saving...' : editingMemberId ? 'Update' : 'Save family details'}
              </button>
              {familyDetails.length > 0 && (
                <button
                  type="button"
                  className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition"
                  onClick={closeForm}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default FamilyDetails;
