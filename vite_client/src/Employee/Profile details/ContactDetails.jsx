import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateEmployeeInfo } from '../../context/employeeDetailsSlice';
import {
    NATIONAL_ID_TYPE_VALUES,
    getNationalIdPlaceholder,
    validateNationalIdInput,
} from '../../utils/nationalIdValidation';
import { toast } from 'react-toastify';

const ContactDetails = () => {
    const dispatch = useDispatch();
    const { employee, updatingInfo } = useSelector((state) => state.employeeDetails);

    const [formData, setFormData] = useState({
        phone1: '',
        phone2: '',
        personalEmail: '',
        address: '',
        birthDate: '',
        gender: '',
        nationalIdType: '',
        nationalId: '',
    });

    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (employee) {
            setFormData({
                phone1: employee.phone1 || '',
                phone2: employee.phone2 || '',
                personalEmail: employee.personalEmail || '',
                address: employee.address || '',
                birthDate: employee.birthDate ? new Date(employee.birthDate).toISOString().split('T')[0] : '',
                gender: employee.gender || '',
                nationalIdType: employee.nationalIdType || '',
                nationalId: employee.nationalId || '',
            });
        }
    }, [employee]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const { phone1, personalEmail, address, birthDate, gender, nationalId, nationalIdType } = formData;

        if (!phone1 || !personalEmail || !address) {
            toast.error('Please fill in all required fields.');
            return;
        }

        if (birthDate) {
            const selectedDate = new Date(birthDate);
            if (Number.isNaN(selectedDate.getTime()) || selectedDate > new Date()) {
                toast.error('Please enter a valid birth date.');
                return;
            }
        }

        let nationalPayload = {};
        if (nationalId?.trim()) {
            if (!nationalIdType) {
                toast.error('Select which national ID document you are using.');
                return;
            }
            const check = validateNationalIdInput(nationalIdType, nationalId);
            if (!check.ok) {
                toast.error(check.message);
                return;
            }
            nationalPayload = { nationalId: check.normalized, nationalIdType };
        } else if (nationalIdType && !nationalId?.trim()) {
            toast.error('Enter the ID number, or clear the document type.');
            return;
        } else if (employee?.nationalId || employee?.nationalIdType) {
            nationalPayload = { nationalId: '' };
        }

        try {
            const payload = {
                phone1,
                phone2: formData.phone2,
                personalEmail,
                address,
                ...(birthDate ? { birthDate } : {}),
                ...(gender ? { gender } : {}),
                ...nationalPayload,
            };

            await dispatch(updateEmployeeInfo(payload)).unwrap();
            toast.success('Contact details updated successfully!');
            setIsEditing(false);
        } catch (err) {
            toast.error(typeof err === 'string' ? err : (err?.message || 'Something went wrong.'));
        }
    };

    if (!employee) {
        return (
            <div className="flex justify-center items-center p-4">
                Loading employee info...
            </div>
        );
    }

    return (
        <div className="w-full font-sans">
                {isEditing ? (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4 md:gap-5">
                        <div className="flex flex-col sm:flex-row flex-wrap -mx-2">
                            <div className="w-full sm:w-1/2 px-2 mb-4 sm:mb-0">
                                <label className="block mb-2 text-sm font-medium text-gray-700">Phone 1*</label>
                                <input
                                    type="text"
                                    name="phone1"
                                    value={formData.phone1}
                                    onChange={handleChange}
                                    className="w-full p-2 md:p-2.5 border rounded bg-theme-secondary/10 text-sm"
                                    required
                                />
                            </div>
                            <div className="w-full sm:w-1/2 px-2">
                                <label className="block mb-2 text-sm font-medium text-gray-700">Phone 2</label>
                                <input
                                    type="text"
                                    name="phone2"
                                    value={formData.phone2}
                                    onChange={handleChange}
                                    className="w-full p-2 md:p-2.5 border rounded bg-theme-secondary/10 text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-700">Personal Email*</label>
                            <input
                                type="email"
                                name="personalEmail"
                                value={formData.personalEmail}
                                onChange={handleChange}
                                className="w-full p-2 md:p-2.5 border rounded bg-theme-secondary/10 text-sm"
                                required
                            />
                        </div>

                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-700">Address*</label>
                            <textarea
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                className="w-full p-2 md:p-2.5 border rounded bg-theme-secondary/10 text-sm resize-none"
                                rows={4}
                                required
                            />
                        </div>

                        <div className="flex flex-col sm:flex-row flex-wrap -mx-2">
                            <div className="w-full sm:w-1/2 px-2 mb-4 sm:mb-0">
                                <label className="block mb-2 text-sm font-medium text-gray-700">Birth Date</label>
                                <input
                                    type="date"
                                    name="birthDate"
                                    value={formData.birthDate}
                                    onChange={handleChange}
                                    className="w-full p-2 md:p-2.5 border rounded bg-theme-secondary/10 text-sm"
                                    max={new Date().toISOString().split('T')[0]}
                                />
                            </div>
                            <div className="w-full sm:w-1/2 px-2">
                                <label className="block mb-2 text-sm font-medium text-gray-700">Gender</label>
                                <select
                                    name="gender"
                                    value={formData.gender}
                                    onChange={handleChange}
                                    className="w-full p-2 md:p-2.5 border rounded bg-theme-secondary/10 text-sm"
                                >
                                    <option value="">Select gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                    <option value="Prefer not to say">Prefer not to say</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-700">National ID document</label>
                            <select
                                name="nationalIdType"
                                value={formData.nationalIdType}
                                onChange={handleChange}
                                className="w-full p-2 md:p-2.5 border rounded bg-theme-secondary/10 text-sm mb-2"
                            >
                                <option value="">Select document type</option>
                                {NATIONAL_ID_TYPE_VALUES.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                            <label className="block mb-2 text-sm font-medium text-gray-700">ID number</label>
                            <input
                                type={formData.nationalIdType === 'Aadhaar' ? 'tel' : 'text'}
                                name="nationalId"
                                value={formData.nationalId}
                                onChange={handleChange}
                                inputMode={formData.nationalIdType === 'Aadhaar' ? 'numeric' : 'text'}
                                autoComplete="off"
                                className="w-full p-2 md:p-2.5 border rounded bg-theme-secondary/10 text-sm"
                                placeholder={getNationalIdPlaceholder(formData.nationalIdType)}
                                disabled={!formData.nationalIdType}
                            />
                            {formData.nationalIdType && (
                                <p className="text-xs text-gray-500 mt-1">
                                    Format is checked when you save based on the document selected.
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                            <button
                                type="submit"
                                disabled={updatingInfo}
                                className="bg-theme-primary hover:bg-theme-primary text-white font-semibold py-2 px-4 sm:px-6 rounded"
                            >
                                {updatingInfo ? 'Saving...' : 'Save'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 sm:px-6 rounded"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-slate-800">Contact Details</h3>
                            <button
                                type="button"
                                onClick={() => setIsEditing(true)}
                                className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
                            >
                                Edit
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {[
                                { label: 'Phone 1', value: formData.phone1 || 'N/A' },
                                { label: 'Phone 2', value: formData.phone2 || 'N/A' },
                                { label: 'Personal Email', value: formData.personalEmail || 'N/A' },
                                { label: 'Birth Date', value: formData.birthDate ? new Date(formData.birthDate).toLocaleDateString() : 'N/A' },
                                { label: 'Gender', value: formData.gender || 'N/A' },
                            ].map((item) => (
                                <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                                    <p className="mt-1 text-sm font-medium text-slate-800 break-words">{item.value}</p>
                                </div>
                            ))}
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address</p>
                            <p className="mt-1 text-sm font-medium text-slate-800 whitespace-pre-line">{formData.address || 'N/A'}</p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">National ID</p>
                            <p className="mt-1 text-sm font-medium text-slate-800">
                                {formData.nationalId
                                    ? `${formData.nationalIdType ? `${formData.nationalIdType} - ` : ''}${formData.nationalId}`
                                    : 'N/A'}
                            </p>
                        </div>
                    </div>
                )}
        </div>
    );
};

export default ContactDetails;