import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
    fetchOrganizationProfile,
    updateOrganizationProfile,
    uploadOrganizationLogo,
    deleteOrganizationLogo
} from '../../context/organizationSlice';
import { getUploadUrl } from '../../utils/axios';
import {
    FiMail,
    FiPhone,
    FiMapPin,
    FiGlobe,
    FiUpload,
    FiX,
    FiSave,
    FiEdit2
} from 'react-icons/fi';
import { FaBuilding } from 'react-icons/fa';

const OrganizationProfile = () => {
    const dispatch = useDispatch();
    const { profile, loading, error } = useSelector((state) => state.organization);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        domain: '',
        address: {
            street: '',
            city: '',
            state: '',
            country: '',
            zipCode: ''
        }
    });
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);

    useEffect(() => {
        dispatch(fetchOrganizationProfile());
    }, [dispatch]);

    useEffect(() => {
        if (profile) {
            setFormData({
                name: profile.name || '',
                email: profile.email || '',
                phone: profile.phone || '',
                domain: profile.domain || '',
                address: {
                    street: profile.address?.street || '',
                    city: profile.address?.city || '',
                    state: profile.address?.state || '',
                    country: profile.address?.country || '',
                    zipCode: profile.address?.zipCode || ''
                }
            });

            // Normalize logo URL so it always points to the correct backend /uploads path
            if (profile.logo?.url) {
                setLogoPreview(getUploadUrl(profile.logo.url));
            } else if (profile.logo) {
                // Handle cases where backend stored only filename or a logo object
                setLogoPreview(getUploadUrl(profile.logo));
            } else {
                setLogoPreview(null);
            }
        }
    }, [profile]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith('address.')) {
            const addressField = name.split('.')[1];
            setFormData(prev => ({
                ...prev,
                address: {
                    ...prev.address,
                    [addressField]: value
                }
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error('Logo file size must be less than 5MB');
                return;
            }
            if (!file.type.startsWith('image/')) {
                toast.error('Please select an image file');
                return;
            }
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleLogoUpload = async () => {
        if (!logoFile) {
            toast.error('Please select a logo file');
            return;
        }
        try {
            await dispatch(uploadOrganizationLogo(logoFile)).unwrap();
            toast.success('Logo uploaded successfully');
            setLogoFile(null);
        } catch (error) {
            toast.error(error || 'Failed to upload logo');
        }
    };

    const handleLogoDelete = async () => {
        if (window.confirm('Are you sure you want to delete the logo?')) {
            try {
                await dispatch(deleteOrganizationLogo()).unwrap();
                toast.success('Logo deleted successfully');
                setLogoPreview(null);
            } catch (error) {
                toast.error(error || 'Failed to delete logo');
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Make domain clearable: if input is empty, explicitly clear it on the backend
        const payload = { ...formData };
        if (!payload.domain || !payload.domain.trim()) {
            // Send an empty string so backend's updateOrganizationProfile
            // treats it as "remove domain" and sets organization.domain = undefined
            payload.domain = '';
        }

        try {
            await dispatch(updateOrganizationProfile(payload)).unwrap();
            toast.success('Organization profile updated successfully');
            setIsEditing(false);
        } catch (error) {
            toast.error(error || 'Failed to update profile');
        }
    };

    if (loading && !profile) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-theme-secondary"></div>
            </div>
        );
    }

    return (
        <div className="page-shell">
            <div className="page-shell-inner">
            <div className="rounded-lg bg-white p-4 shadow-md sm:p-6">
                <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center min-w-0">
                        <FaBuilding className="mr-2" />
                        Organization Profile
                    </h2>
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex w-full items-center justify-center rounded-md bg-theme-primary px-4 py-2 text-white hover:opacity-90 sm:w-auto"
                        >
                            <FiEdit2 className="mr-2" />
                            Edit Profile
                        </button>
                    )}
                </div>

                {/* Logo Section */}
                <div className="mb-6 pb-6 border-b">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Organization Logo
                    </label>
                    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                        {logoPreview ? (
                            <div className="relative">
                                <img
                                    src={logoPreview}
                                    alt="Organization Logo"
                                    className="w-32 h-32 object-cover rounded-lg border-2 border-gray-300"
                                />
                                {isEditing && (
                                    <button
                                        onClick={handleLogoDelete}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                    >
                                        <FiX className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="w-32 h-32 bg-gray-200 rounded-lg flex items-center justify-center">
                                <FaBuilding className="w-16 h-16 text-gray-400" />
                            </div>
                        )}
                        {isEditing && (
                            <div className="flex flex-col space-y-2">
                                <label className="flex items-center px-4 py-2 bg-gray-100 rounded-md cursor-pointer hover:bg-gray-200">
                                    <FiUpload className="mr-2" />
                                    Upload Logo
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLogoChange}
                                        className="hidden"
                                    />
                                </label>
                                {logoFile && (
                                    <button
                                        onClick={handleLogoUpload}
                                        className="px-4 py-2 bg-theme-primary text-white rounded-md hover:opacity-90"
                                    >
                                        Save Logo
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Profile Form */}
                <form onSubmit={handleSubmit}>
                    <div className="space-y-6">
                        {/* Organization Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Organization Name <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <FaBuilding className="absolute left-3 top-3 text-gray-400" />
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    disabled={!isEditing}
                                    required
                                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:bg-gray-100"
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email Address <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <FiMail className="absolute left-3 top-3 text-gray-400" />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    disabled={!isEditing}
                                    required
                                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:bg-gray-100"
                                />
                            </div>
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Phone Number
                            </label>
                            <div className="relative">
                                <FiPhone className="absolute left-3 top-3 text-gray-400" />
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    disabled={!isEditing}
                                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:bg-gray-100"
                                />
                            </div>
                        </div>

                        {/* Domain */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Domain (Optional)
                            </label>
                            <div className="relative">
                                <FiGlobe className="absolute left-3 top-3 text-gray-400" />
                                <input
                                    type="text"
                                    name="domain"
                                    value={formData.domain}
                                    onChange={handleChange}
                                    disabled={!isEditing}
                                    placeholder="example.com"
                                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:bg-gray-100"
                                />
                            </div>
                        </div>

                        {/* Address Section */}
                        <div className="border-t pt-6">
                            <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                                <FiMapPin className="mr-2" />
                                Address
                            </h3>
                            <div className="hrms-form-grid">
                                <div className="md:col-span-2">
                                    <input
                                        type="text"
                                        name="address.street"
                                        value={formData.address.street}
                                        onChange={handleChange}
                                        disabled={!isEditing}
                                        placeholder="Street Address"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:bg-gray-100"
                                    />
                                </div>
                                <div>
                                    <input
                                        type="text"
                                        name="address.city"
                                        value={formData.address.city}
                                        onChange={handleChange}
                                        disabled={!isEditing}
                                        placeholder="City"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:bg-gray-100"
                                    />
                                </div>
                                <div>
                                    <input
                                        type="text"
                                        name="address.state"
                                        value={formData.address.state}
                                        onChange={handleChange}
                                        disabled={!isEditing}
                                        placeholder="State/Province"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:bg-gray-100"
                                    />
                                </div>
                                <div>
                                    <input
                                        type="text"
                                        name="address.country"
                                        value={formData.address.country}
                                        onChange={handleChange}
                                        disabled={!isEditing}
                                        placeholder="Country"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:bg-gray-100"
                                    />
                                </div>
                                <div>
                                    <input
                                        type="text"
                                        name="address.zipCode"
                                        value={formData.address.zipCode}
                                        onChange={handleChange}
                                        disabled={!isEditing}
                                        placeholder="ZIP/Postal Code"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:bg-gray-100"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Subscription Info (Read-only) */}
                        {profile && (
                            <div className="border-t pt-6">
                                <h3 className="text-lg font-medium text-gray-800 mb-4">
                                    Subscription Information
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-500">
                                            Plan
                                        </label>
                                        <p className="mt-1 text-lg font-semibold text-gray-800 capitalize">
                                            {profile.subscriptionPlan || 'Free'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-500">
                                            Max Employees
                                        </label>
                                        <p className="mt-1 text-lg font-semibold text-gray-800">
                                            {profile.maxEmployees || 'Unlimited'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        {isEditing && (
                            <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEditing(false);
                                        // Reset form data
                                        if (profile) {
                                            setFormData({
                                                name: profile.name || '',
                                                email: profile.email || '',
                                                phone: profile.phone || '',
                                                domain: profile.domain || '',
                                                address: {
                                                    street: profile.address?.street || '',
                                                    city: profile.address?.city || '',
                                                    state: profile.address?.state || '',
                                                    country: profile.address?.country || '',
                                                    zipCode: profile.address?.zipCode || ''
                                                }
                                            });
                                        }
                                    }}
                                    className="rounded-md border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex items-center justify-center rounded-md bg-theme-primary px-6 py-2 text-white hover:opacity-90 disabled:opacity-50"
                                >
                                    <FiSave className="mr-2" />
                                    {loading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        )}
                    </div>
                </form>
            </div>
            </div>
        </div>
    );
};

export default OrganizationProfile;

