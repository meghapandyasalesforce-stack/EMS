import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateEmployeeInfo, fetchEmployeeOwnInfo } from '../../context/employeeDetailsSlice';
import {
    NATIONAL_ID_TYPE_VALUES,
    getNationalIdPlaceholder,
    validateNationalIdInput,
} from '../../utils/nationalIdValidation';
import { toast } from 'react-toastify';
import { FiEdit2 } from 'react-icons/fi';

const inputClass =
    'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition placeholder:text-gray-400';
const labelClass = 'block text-xs font-medium text-gray-600 mb-1';

const InfoItem = ({ label, value, full }) => (
    <div className={`${full ? 'sm:col-span-2 md:col-span-3' : ''} rounded-lg bg-gray-50 px-4 py-3`}>
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-gray-900 break-words whitespace-pre-line">{value || 'N/A'}</p>
    </div>
);

const ContactDetails = () => {
    const dispatch = useDispatch();
    const { employee, updatingInfo } = useSelector((state) => state.employeeDetails);

    const [formData, setFormData] = useState({
        phone1: '', phone2: '', personalEmail: '', address: '',
        gender: '', nationalIdType: '', nationalId: '',
        maritalStatus: '', anniversaryDate: '', spouseName: '',
        emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelationship: '',
    });
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (employee) {
            setFormData({
                phone1: employee.phone1 || '', phone2: employee.phone2 || '',
                personalEmail: employee.personalEmail || '', address: employee.address || '',
                gender: employee.gender || '', nationalIdType: employee.nationalIdType || '',
                nationalId: employee.nationalId || '',
                maritalStatus: employee.maritalStatus || '',
                anniversaryDate: employee.anniversaryDate ? new Date(employee.anniversaryDate).toISOString().split('T')[0] : '',
                spouseName: employee.spouseName || '',
                emergencyContactName: employee.emergencyContactName || '',
                emergencyContactPhone: employee.emergencyContactPhone || '',
                emergencyContactRelationship: employee.emergencyContactRelationship || '',
            });
        }
    }, [employee]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const { phone1, personalEmail, address, nationalId, nationalIdType } = formData;
        if (!phone1 || !personalEmail || !address) { toast.error('Please fill in all required fields.'); return; }

        let nationalPayload = {};
        if (nationalId?.trim()) {
            if (!nationalIdType) { toast.error('Select which national ID document you are using.'); return; }
            const check = validateNationalIdInput(nationalIdType, nationalId);
            if (!check.ok) { toast.error(check.message); return; }
            nationalPayload = { nationalId: check.normalized, nationalIdType };
        } else if (nationalIdType && !nationalId?.trim()) {
            toast.error('Enter the ID number, or clear the document type.'); return;
        } else if (employee?.nationalId || employee?.nationalIdType) {
            nationalPayload = { nationalId: '' };
        }

        try {
            const payload = {
                phone1, phone2: formData.phone2, personalEmail, address,
                ...(formData.gender ? { gender: formData.gender } : {}),
                ...nationalPayload,
                maritalStatus: formData.maritalStatus,
                anniversaryDate: formData.maritalStatus === 'Married' ? (formData.anniversaryDate || '') : '',
                spouseName: formData.maritalStatus === 'Married' ? (formData.spouseName || '') : '',
                emergencyContactName: formData.emergencyContactName,
                emergencyContactPhone: formData.emergencyContactPhone,
                emergencyContactRelationship: formData.emergencyContactRelationship,
            };
            await dispatch(updateEmployeeInfo(payload)).unwrap();
            await dispatch(fetchEmployeeOwnInfo()).unwrap();
            toast.success('Contact details updated successfully!');
            setIsEditing(false);
        } catch (err) {
            toast.error(typeof err === 'string' ? err : (err?.message || 'Something went wrong.'));
        }
    };

    if (!employee) return <div className="flex justify-center items-center p-8 text-sm text-gray-500">Loading...</div>;

    if (isEditing) {
        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="profile-fields grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div><label className={labelClass}>Phone 1 <span className="text-red-500">*</span></label><input type="text" name="phone1" value={formData.phone1} onChange={handleChange} className={inputClass} placeholder="Primary phone" required /></div>
                    <div><label className={labelClass}>Phone 2</label><input type="text" name="phone2" value={formData.phone2} onChange={handleChange} className={inputClass} placeholder="Secondary phone" /></div>
                    <div><label className={labelClass}>Personal email <span className="text-red-500">*</span></label><input type="email" name="personalEmail" value={formData.personalEmail} onChange={handleChange} className={inputClass} placeholder="you@example.com" required /></div>
                    <div><label className={labelClass}>Gender</label>
                        <select name="gender" value={formData.gender} onChange={handleChange} className={inputClass}>
                            <option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option><option value="Prefer not to say">Prefer not to say</option>
                        </select>
                    </div>
                </div>
                <div><label className={labelClass}>Address <span className="text-red-500">*</span></label><textarea name="address" value={formData.address} onChange={handleChange} className={`${inputClass} resize-none`} rows={2} placeholder="Full address" required /></div>

                <div className="profile-fields grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div><label className={labelClass}>Marital status</label>
                        <select name="maritalStatus" value={formData.maritalStatus} onChange={handleChange} className={inputClass}>
                            <option value="">Select</option><option value="Single">Single</option><option value="Married">Married</option><option value="Divorced">Divorced</option><option value="Widowed">Widowed</option>
                        </select>
                    </div>
                    {formData.maritalStatus === 'Married' && <div><label className={labelClass}>Spouse name</label><input type="text" name="spouseName" value={formData.spouseName} onChange={handleChange} className={inputClass} placeholder="Spouse name" /></div>}
                </div>
                {formData.maritalStatus === 'Married' && (
                    <div className="profile-fields grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div><label className={labelClass}>Anniversary date</label><input type="date" name="anniversaryDate" value={formData.anniversaryDate} onChange={handleChange} className={inputClass} /></div>
                    </div>
                )}

                <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Emergency contact</p>
                    <div className="profile-fields grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div><label className={labelClass}>Name</label><input type="text" name="emergencyContactName" value={formData.emergencyContactName} onChange={handleChange} className={inputClass} placeholder="Contact name" /></div>
                        <div><label className={labelClass}>Phone</label><input type="text" name="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handleChange} className={inputClass} placeholder="Phone" /></div>
                        <div><label className={labelClass}>Relationship</label>
                            <select name="emergencyContactRelationship" value={formData.emergencyContactRelationship} onChange={handleChange} className={inputClass}>
                                <option value="">Select</option><option value="Spouse">Spouse</option><option value="Parent">Parent</option><option value="Sibling">Sibling</option><option value="Friend">Friend</option><option value="Other">Other</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">National ID</p>
                    <div className="profile-fields grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div><label className={labelClass}>Document type</label>
                            <select name="nationalIdType" value={formData.nationalIdType} onChange={handleChange} className={inputClass}>
                                <option value="">Select</option>{NATIONAL_ID_TYPE_VALUES.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div><label className={labelClass}>ID number</label>
                            <input type={formData.nationalIdType === 'Aadhaar' ? 'tel' : 'text'} name="nationalId" value={formData.nationalId} onChange={handleChange} inputMode={formData.nationalIdType === 'Aadhaar' ? 'numeric' : 'text'} autoComplete="off" className={inputClass} placeholder={getNationalIdPlaceholder(formData.nationalIdType)} disabled={!formData.nationalIdType} />
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setIsEditing(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Cancel</button>
                    <button type="submit" disabled={updatingInfo} className="rounded-lg bg-theme-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition disabled:opacity-50">{updatingInfo ? 'Saving...' : 'Save'}</button>
                </div>
            </form>
        );
    }

    return (
        <div className="space-y-4">
            <div className="profile-section-header flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-900">Contact details</h3>
                <button type="button" onClick={() => setIsEditing(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-theme-primary px-3.5 py-2 text-sm font-medium text-white hover:opacity-90 transition">
                    <FiEdit2 size={13} /> Edit
                </button>
            </div>
            <div className="profile-fields grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                <InfoItem label="Phone 1" value={formData.phone1} />
                <InfoItem label="Phone 2" value={formData.phone2} />
                <InfoItem label="Personal email" value={formData.personalEmail} />
                <InfoItem label="Gender" value={formData.gender} />
                <InfoItem label="Marital status" value={formData.maritalStatus} />
                {formData.maritalStatus === 'Married' && <InfoItem label="Spouse name" value={formData.spouseName} />}
                <InfoItem label="Address" value={formData.address} full />
                {formData.maritalStatus === 'Married' && formData.anniversaryDate && <InfoItem label="Anniversary" value={formData.anniversaryDate} />}
                <InfoItem label="National ID" value={formData.nationalId ? `${formData.nationalIdType ? `${formData.nationalIdType} — ` : ''}${formData.nationalId}` : null} />
            </div>
            {formData.emergencyContactName && (
                <div className="rounded-lg bg-red-50/50 border border-red-100 p-4">
                    <p className="text-[11px] font-medium text-red-400 uppercase tracking-wide mb-1">Emergency contact</p>
                    <p className="text-sm font-semibold text-gray-900">{formData.emergencyContactName}</p>
                    <p className="text-xs text-gray-600">{[formData.emergencyContactRelationship, formData.emergencyContactPhone].filter(Boolean).join(' • ')}</p>
                </div>
            )}
        </div>
    );
};

export default ContactDetails;
