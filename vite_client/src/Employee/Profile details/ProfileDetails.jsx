import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import ProfilePhotoUpload from '../Profile/ProfilePhotoUpload';
import ProfilePicture from '../../Shared/ProfilePicture';
import ContactDetails from './ContactDetails';
import EducationQualifications from './EducationQualifications';
import FamilyDetails from '../Additional details/FamilyDetails';
import JobDetails from '../Additional details/JobDetails';
import FinancialDetails from './FinancialDetails';
import { fetchEmployeeOwnInfo, updateEmployeeInfo, setEmployeeProfile } from '../../context/employeeDetailsSlice';
import { setUser } from '../../context/Auth/authSlice';
import { mergeSessionProfile } from '../../utils/profileUtils';
import { toast } from 'react-toastify';

function ProfileDetails() {
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [isSavingPersonalDetails, setIsSavingPersonalDetails] = useState(false);
  const [isPersonalEditing, setIsPersonalEditing] = useState(false);
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
  const employeeDetails = useSelector((state) => state.employeeDetails.employee);
  const profileLoading = useSelector((state) => state.employeeDetails.loading);
  const permissionFlags = useSelector((state) => state.auth.permissionFlags) || {};
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const profileSource = useMemo(
    () => mergeSessionProfile(user, employeeDetails),
    [user, employeeDetails]
  );

  const buildPersonalFormValues = (source) => {
    if (!source) {
      return {
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        gender: '',
        professionalBio: '',
        contact: '',
        bankDetails: '',
        emergencyContact: ''
      };
    }

    const fullName = String(source?.name || '').trim();
    const parts = fullName.split(/\s+/).filter(Boolean);
    const firstName = source?.firstName || parts[0] || '';
    const lastName = source?.lastName || parts.slice(1).join(' ') || '';
    const dateOfBirth = source?.birthDate ? new Date(source.birthDate).toISOString().slice(0, 10) : '';
    const gender = source?.gender || '';
    const professionalBio = source?.professionalBio || source?.bio || '';
    const contact = source?.phone || source?.mobile || '';
    const bankDetails = source?.bankName || source?.accountNumber ? `${source?.bankName || ''} ${source?.accountNumber || ''}`.trim() : '';
    const emergencyContact = source?.emergencyContactName || source?.emergencyContactPhone
      ? `${source?.emergencyContactName || ''} ${source?.emergencyContactPhone || ''}`.trim()
      : '';

    return {
      firstName,
      lastName,
      dateOfBirth,
      gender,
      professionalBio,
      contact,
      bankDetails,
      emergencyContact
    };
  };

  useEffect(() => {
    dispatch(fetchEmployeeOwnInfo());
  }, [dispatch]);

  useEffect(() => {
    if (!profileSource) return;
    setFormValues(buildPersonalFormValues(profileSource));
  }, [profileSource]);

  const progressChecklist = [
    Boolean(formValues.firstName && formValues.lastName && formValues.dateOfBirth && formValues.gender && formValues.professionalBio), // Personal
    Boolean(profileSource?.phone1 && profileSource?.personalEmail && profileSource?.address), // Contact
    Boolean((profileSource?.academicRecords || []).length > 0 || (profileSource?.professionalQualifications || []).length > 0), // Education
    Boolean((profileSource?.familyDetails || []).length > 0), // Family
    Boolean(profileSource?.financialDetails?.bankName && profileSource?.financialDetails?.ifsc && profileSource?.financialDetails?.accountNo && profileSource?.financialDetails?.accountName), // Financial
    Boolean(profileSource?.documents && profileSource.documents.length > 0), // Job docs
  ];
  const completedSections = progressChecklist.filter(Boolean).length;
  const totalSections = progressChecklist.length;
  const completionPercent = Math.max(10, Math.min(100, Math.round((completedSections / totalSections) * 100)));
  const stepsLeft = Math.max(0, totalSections - completedSections);
  const joinDateValue = employeeDetails?.joiningDate || user?.joiningDate;
  const managerAssignedName = (() => {
    const mgr = profileSource?.managerId || employeeDetails?.managerId || user?.managerId;
    if (mgr && typeof mgr === 'object') {
      const name = [mgr.name, mgr.lastName].filter(Boolean).join(' ').trim();
      if (name) return name;
    }
    const managerName =
      profileSource?.manager ||
      employeeDetails?.manager ||
      user?.manager ||
      '';
    return String(managerName).trim() || 'N/A';
  })();

  const handleChange = (field, value) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const resetPersonalDetailsForm = () => {
    if (!profileSource) return;
    setFormValues(buildPersonalFormValues(profileSource));
  };

  const handlePersonalDetailsSave = async () => {
    setIsSavingPersonalDetails(true);
    try {
      const payload = {
        ...(formValues.dateOfBirth ? { birthDate: formValues.dateOfBirth } : {}),
        ...(formValues.gender ? { gender: formValues.gender } : {}),
        professionalBio: formValues.professionalBio || ''
      };

      await dispatch(updateEmployeeInfo(payload)).unwrap();
      const freshEmployee = await dispatch(fetchEmployeeOwnInfo()).unwrap();

      // Patch auth.user so mergeSessionProfile returns the updated values.
      // Without this, auth.user wins in the merge and the form resets to old data.
      if (freshEmployee && user) {
        dispatch(setUser({
          ...user,
          birthDate: freshEmployee.birthDate,
          gender: freshEmployee.gender,
          professionalBio: freshEmployee.professionalBio,
        }));
      }

      toast.success('Personal details updated successfully.');
      setIsPersonalEditing(false);
    } catch (error) {
      toast.error(typeof error === 'string' ? error : (error?.message || 'Failed to update personal details.'));
    } finally {
      setIsSavingPersonalDetails(false);
    }
  };

  const tabs = [
    { id: 'personalDetails', label: 'Personal Details' },
    { id: 'contactDetails', label: 'Contact Details' },
    { id: 'educationQualifications', label: 'Education Qualifications' },
    { id: 'familyDetails', label: 'Family Details' },
    { id: 'jobDetails', label: 'Documents' },
    { id: 'financialDetails', label: 'Financial Details' }
  ];

  const tabPathMap = {
    personalDetails: '/profile-details',
    contactDetails: '/contact-details',
    educationQualifications: '/education-qualifications',
    familyDetails: '/family-details',
    jobDetails: '/job-details',
    financialDetails: '/financial-details'
  };

  const pathTabMap = {
    '/profile-details': 'personalDetails',
    '/contact-details': 'contactDetails',
    '/education-qualifications': 'educationQualifications',
    '/family-details': 'familyDetails',
    '/job-details': 'jobDetails',
    '/financial-details': 'financialDetails'
  };

  useEffect(() => {
    const mappedTab = pathTabMap[location.pathname];
    if (mappedTab && mappedTab !== activeTab) {
      setActiveTab(mappedTab);
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabClick = (tabId) => {
    const targetPath = tabPathMap[tabId] || '/profile-details';
    setActiveTab(tabId);
    if (tabId !== 'personalDetails') {
      setIsPersonalEditing(false);
    }
    if (location.pathname !== targetPath) {
      navigate(targetPath);
    }
  };

  if (profileLoading && !employeeDetails && !user?.employeeProfileId && !profileSource?.employeeId) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8 text-slate-600">
        Loading your profile…
      </div>
    );
  }

  const hasLinkedProfile = Boolean(
    employeeDetails?._id ||
    employeeDetails?.employeeId ||
    user?.employeeProfileId ||
    profileSource?.employeeId
  );

  if (profileLoading && hasLinkedProfile && !employeeDetails) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8 text-slate-600">
        Loading your profile…
      </div>
    );
  }

  if (!hasLinkedProfile) {
    return (
      <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">No employee profile linked yet</h2>
        <p className="text-sm text-slate-600">
          {permissionFlags.isOrgOwner
            ? 'Open Admin → Employees, find your profile row, and click the Me button to link it to your Me tab. Or add a new employee and check “Show on my Me tab”.'
            : 'Your personal employee profile is not set up yet. Please contact your organization administrator.'}
        </p>
      </div>
    );
  }

  return (
    <div className="page-shell min-h-full w-full bg-[#F4F7F5] transition-all duration-300">
      <div className="page-shell-inner hrms-stack">
        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
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

        <section className="hrms-split">
            <aside className="min-w-0">
              <div className="rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-sm sm:p-5 lg:sticky lg:top-4">
                <div className="mb-4 flex justify-center">
                  <ProfilePicture
                    key={
                      profileSource?.profilePhoto?.url
                      || profileSource?.profilePhoto?.filename
                      || profileSource?.id
                      || user?.id
                    }
                    user={profileSource}
                    size="2xl"
                    showEditButton={true}
                    onEditClick={() => setShowPhotoUpload(true)}
                  />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{profileSource?.name || user?.name || 'Employee'}</h2>
                <p className="mt-1 text-sm font-semibold text-[#0a8f6c]">{profileSource?.jobTitle || user?.jobTitle || 'Team Member'}</p>

                <div className="mt-5 space-y-2.5 border-t border-slate-100 pt-4 text-left text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="shrink-0 text-slate-500">Department</span>
                    <span className="text-right font-semibold text-slate-800">{user?.department || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="shrink-0 text-slate-500">Employee ID</span>
                    <span className="text-right font-semibold text-slate-800">{user?.employeeId || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="shrink-0 text-slate-500">Join Date</span>
                    <span className="text-right font-semibold text-slate-800">
                      {joinDateValue ? new Date(joinDateValue).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="shrink-0 text-slate-500">Manager Assigned</span>
                    <span className="text-right font-semibold text-slate-800">{managerAssignedName}</span>
                  </div>
                </div>
              </div>
            </aside>

            <div className="min-w-0 w-full rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-3 pt-3 sm:px-5 sm:pt-4">
                <div className="hrms-tabs-scroll" role="tablist">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      onClick={() => handleTabClick(tab.id)}
                      className={`rounded-t-lg px-3 py-2.5 text-sm font-semibold transition sm:px-4 ${
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

              <div className="min-w-0 space-y-4 p-4 sm:space-y-5 sm:p-5 md:p-6">
                {activeTab === 'personalDetails' && (
                  <>
                    {isPersonalEditing ? (
                      <>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <label className="space-y-1">
                            <span className="text-sm font-medium text-slate-600">First Name</span>
                            <input
                              value={formValues.firstName}
                              readOnly
                              className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 outline-none cursor-not-allowed"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-sm font-medium text-slate-600">Last Name</span>
                            <input
                              value={formValues.lastName}
                              readOnly
                              className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 outline-none cursor-not-allowed"
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
                    ) : (
                      <div className="space-y-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <h3 className="text-base font-semibold text-slate-800">Personal Details</h3>
                          <button
                            type="button"
                            onClick={() => setIsPersonalEditing(true)}
                            className="w-full rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1d4ed8] sm:w-auto"
                          >
                            Edit
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {[
                            { label: 'First Name', value: formValues.firstName || 'N/A' },
                            { label: 'Last Name', value: formValues.lastName || 'N/A' },
                            { label: 'Date of Birth', value: formValues.dateOfBirth || 'N/A' },
                            { label: 'Gender', value: formValues.gender || 'N/A' }
                          ].map((item) => (
                            <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                              <p className="mt-1 text-sm font-medium text-slate-800">{item.value}</p>
                            </div>
                          ))}
                        </div>

                        {/* <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Professional Bio</p>
                          <p className="mt-1 text-sm text-slate-800">{formValues.professionalBio || 'N/A'}</p>
                        </div> */}
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'contactDetails' && (
                  <ContactDetails />
                )}

                {activeTab === 'educationQualifications' && (
                  <EducationQualifications />
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

                {activeTab === 'personalDetails' && isPersonalEditing && (
                  <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        resetPersonalDetailsForm();
                        setIsPersonalEditing(false);
                      }}
                      disabled={isSavingPersonalDetails}
                      className="w-full rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handlePersonalDetailsSave}
                      disabled={isSavingPersonalDetails}
                      className="w-full rounded-xl bg-[#20C997] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0a8f6c] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      {isSavingPersonalDetails ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )}
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
                  const profilePhoto = photoData?.profilePhoto || photoData;
                  dispatch(setEmployeeProfile({ ...employeeDetails, profilePhoto }));
                  if (user) {
                    dispatch(setUser({ ...user, profilePhoto }));
                  }
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