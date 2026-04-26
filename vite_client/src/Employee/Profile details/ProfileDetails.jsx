import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiShield, FiClock, FiChevronRight, FiInfo } from 'react-icons/fi';
import ProfilePhotoUpload from '../Profile/ProfilePhotoUpload';
import ProfilePicture from '../../Shared/ProfilePicture';
import ContactDetails from './ContactDetails';
import NextOfKinDetails from '../Additional details/NextOfKinDetails';
import EducationQualifications from './EducationQualifications';
import GuarantorDetails from '../Additional details/GuarantorDetails';
import FamilyDetails from '../Additional details/FamilyDetails';
import JobDetails from '../Additional details/JobDetails';
import FinancialDetails from './FinancialDetails';
import { setUser } from '../../context/Auth/authSlice';
import { fetchEmployeeOwnInfo } from '../../context/employeeDetailsSlice';

function ProfileDetails() {
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [isFetchingFreshData, setIsFetchingFreshData] = useState(false);
  const [activeTab, setActiveTab] = useState('personalDetails');
  const [formValues, setFormValues] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    professionalBio: '',
    contact: '',
    bankDetails: '',
    emergencyContact: ''
  });
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  // Fetch fresh employee data on mount and when user changes to ensure we have the latest Employee ID
  useEffect(() => {
    const fetchFreshData = async () => {
      // Wait for user to be available
      if (!user) return;
      
      if (user?.role === 'employee' || user?.role === 'hr' || user?.role === 'manager') {
        try {
          setIsFetchingFreshData(true);
          const result = await dispatch(fetchEmployeeOwnInfo()).unwrap();
          // Update auth state with fresh data including updated employeeId
          if (result && result.employeeId) {
            dispatch(setUser({
              ...user,
              ...result,
              employeeId: result.employeeId // Always use the fresh employeeId from server
            }));
          }
        } catch (err) {
          // Error is silently handled - user can refresh page if needed
        } finally {
          setIsFetchingFreshData(false);
        }
      }
    };

    fetchFreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, user?.id]); // Run when user.id changes (user logs in or data updates)

  useEffect(() => {
    if (!user) return;
    const fullName = String(user?.name || '').trim();
    const parts = fullName.split(/\s+/).filter(Boolean);
    const firstName = user?.firstName || parts[0] || '';
    const lastName = user?.lastName || parts.slice(1).join(' ') || '';
    const dateOfBirth = user?.birthDate ? new Date(user.birthDate).toISOString().slice(0, 10) : '';
    const gender = user?.gender || '';
    const professionalBio = user?.bio || user?.professionalBio || '';
    const contact = user?.phone || user?.mobile || '';
    const bankDetails = user?.bankName || user?.accountNumber ? `${user?.bankName || ''} ${user?.accountNumber || ''}`.trim() : '';
    const emergencyContact = user?.emergencyContactName || user?.emergencyContactPhone
      ? `${user?.emergencyContactName || ''} ${user?.emergencyContactPhone || ''}`.trim()
      : '';

    setFormValues({
      firstName,
      lastName,
      dateOfBirth,
      gender,
      professionalBio,
      contact,
      bankDetails,
      emergencyContact
    });
  }, [user]);

  const filledFields = [
    formValues.firstName,
    formValues.lastName,
    formValues.dateOfBirth,
    formValues.gender,
    formValues.professionalBio
  ].filter(Boolean).length;
  const completionPercent = Math.max(20, Math.min(100, Math.round((filledFields / 5) * 100)));
  const stepsLeft = Math.max(0, 5 - filledFields);

  const handleChange = (field, value) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const tabs = [
    { id: 'personalDetails', label: 'Personal Details' },
    { id: 'contactDetails', label: 'Contact Details' },
    { id: 'nextOfKinDetails', label: 'Next of kin Details' },
    { id: 'educationQualifications', label: 'Education Qualifications' },
    { id: 'guarantorDetails', label: 'Guarantor Details' },
    { id: 'familyDetails', label: 'Family Details' },
    { id: 'jobDetails', label: 'Job Details' },
    { id: 'financialDetails', label: 'Financial Details' }
  ];

  const tabPathMap = {
    personalDetails: '/profile-details',
    contactDetails: '/contact-details',
    nextOfKinDetails: '/next-of-kin-details',
    educationQualifications: '/education-qualifications',
    guarantorDetails: '/guarantor-details',
    familyDetails: '/family-details',
    jobDetails: '/job-details',
    financialDetails: '/financial-details'
  };

  const pathTabMap = {
    '/profile-details': 'personalDetails',
    '/contact-details': 'contactDetails',
    '/next-of-kin-details': 'nextOfKinDetails',
    '/education-qualifications': 'educationQualifications',
    '/guarantor-details': 'guarantorDetails',
    '/family-details': 'familyDetails',
    '/job-details': 'jobDetails',
    '/financial-details': 'financialDetails'
  };

  useEffect(() => {
    const mappedTab = pathTabMap[location.pathname];
    if (mappedTab && mappedTab !== activeTab) {
      setActiveTab(mappedTab);
    }
  }, [location.pathname, activeTab]);

  const handleTabClick = (tabId) => {
    const targetPath = tabPathMap[tabId] || '/profile-details';
    setActiveTab(tabId);
    if (location.pathname !== targetPath) {
      navigate(targetPath);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7F5] p-4 transition-all duration-300 md:p-6">
      <div className="mx-auto max-w-[1280px] space-y-5">
        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-base font-semibold text-slate-800">Profile {completionPercent}% complete</p>
            <p className="text-sm font-semibold text-[#0a8f6c]">{stepsLeft} steps left</p>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-[#20C997] to-[#0a8f6c]"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </section>

        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[300px_1fr]">
            <aside className="space-y-4">
              <div className="rounded-2xl border border-slate-100 bg-white p-5 text-center shadow-sm">
                <div className="mb-4 flex justify-center">
                  <ProfilePicture
                    key={user?.profilePhoto?.url || user?.profilePhoto?.filename || user?.id}
                    user={user}
                    size="2xl"
                    showEditButton={true}
                    onEditClick={() => setShowPhotoUpload(true)}
                  />
                </div>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900">{user?.name || 'Employee'}</h2>
                <p className="mt-1 text-sm font-semibold text-[#0a8f6c]">{user?.jobTitle || 'Team Member'}</p>

                <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-left text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Department</span>
                    <span className="font-semibold text-slate-800">{user?.department || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Employee ID</span>
                    <span className="font-semibold text-slate-800">{user?.employeeId || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Join Date</span>
                    <span className="font-semibold text-slate-800">
                      {user?.joiningDate ? new Date(user.joiningDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                    </span>
                  </div>
                  {isFetchingFreshData && (
                    <p className="pt-1 text-xs font-medium text-[#0a8f6c] animate-pulse">Refreshing latest profile info...</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Quick Shortcuts</p>
                <div className="space-y-2">
                  <button type="button" className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="inline-flex items-center gap-2"><FiShield className="text-[#0a8f6c]" /> Security Settings</span>
                    <FiChevronRight />
                  </button>
                  <button type="button" className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="inline-flex items-center gap-2"><FiClock className="text-[#0a8f6c]" /> Login History</span>
                    <FiChevronRight />
                  </button>
                </div>
              </div>
            </aside>

            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 pt-4">
                <div className="flex flex-wrap gap-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleTabClick(tab.id)}
                      className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition ${
                        activeTab === tab.id
                          ? 'border-b-2 border-[#20C997] text-[#0a8f6c]'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-5 p-5">
                {activeTab === 'personalDetails' && (
                  <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-sm font-medium text-slate-600">First Name</span>
                        <input
                          value={formValues.firstName}
                          onChange={(e) => handleChange('firstName', e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#20C997]"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-sm font-medium text-slate-600">Last Name</span>
                        <input
                          value={formValues.lastName}
                          onChange={(e) => handleChange('lastName', e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#20C997]"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-sm font-medium text-slate-600">Date of Birth</span>
                        <input
                          type="date"
                          value={formValues.dateOfBirth}
                          onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#20C997]"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-sm font-medium text-slate-600">Gender</span>
                        <select
                          value={formValues.gender}
                          onChange={(e) => handleChange('gender', e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#20C997]"
                        >
                          <option value="">Select</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </label>
                    </div>
                    <label className="space-y-1 block">
                      <span className="text-sm font-medium text-slate-600">Professional Bio</span>
                      <textarea
                        rows={4}
                        value={formValues.professionalBio}
                        onChange={(e) => handleChange('professionalBio', e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#20C997]"
                      />
                    </label>
                  </>
                )}

                {activeTab === 'contactDetails' && (
                  <ContactDetails />
                )}

                {activeTab === 'nextOfKinDetails' && (
                  <NextOfKinDetails />
                )}

                {activeTab === 'educationQualifications' && (
                  <EducationQualifications />
                )}

                {activeTab === 'guarantorDetails' && (
                  <GuarantorDetails />
                )}

                {activeTab === 'familyDetails' && (
                  <FamilyDetails />
                )}

                {activeTab === 'jobDetails' && (
                  <JobDetails />
                )}

                {activeTab === 'financialDetails' && (
                  <FinancialDetails />
                )}

                <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-[#20C997] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0a8f6c]"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>

            <div className="rounded-2xl border border-slate-100 bg-[#F0F8F5] p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#20C997]/15 text-[#0a8f6c]">
                  <FiInfo />
                </span>
                <div>
                  <p className="font-semibold text-slate-800">Official Records Notice</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Changes to legal names or bank details may require HR verification.
                    Updates typically reflect within 24-48 business hours.
                  </p>
                </div>
              </div>
            </div>
        </section>
      </div>

      {/* Profile Photo Upload Modal */}
      {showPhotoUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">Update Profile Photo</h3>
              <button
                onClick={() => setShowPhotoUpload(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <ProfilePhotoUpload
                userType="employee"
                userId={user?.id}
                onPhotoUpdate={(photoData) => {
                  // Ensure we extract the profilePhoto correctly
                  let profilePhoto = photoData;
                  
                  // Handle different response structures
                  if (photoData && typeof photoData === 'object') {
                    // If it has a profilePhoto property, use that
                    profilePhoto = photoData.profilePhoto || photoData;
                  }
                  
                  // Update user data in Redux store with the new profile photo
                  const updatedUser = { 
                    ...user, 
                    profilePhoto: profilePhoto 
                  };
                  
                  dispatch(setUser(updatedUser));
                  setShowPhotoUpload(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfileDetails;