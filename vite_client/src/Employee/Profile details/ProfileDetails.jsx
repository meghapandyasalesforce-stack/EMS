import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import ProfilePhotoUpload from '../Profile/ProfilePhotoUpload';
import ProfilePicture from '../../Shared/ProfilePicture';
import ContactDetails from './ContactDetails';
import EducationQualifications from './EducationQualifications';
import ProfessionalExperience from './ProfessionalExperience';
import FamilyDetails from '../Additional details/FamilyDetails';
import JobDetails from '../Additional details/JobDetails';
import FinancialDetails from './FinancialDetails';
import { fetchEmployeeOwnInfo, updateEmployeeInfo, setEmployeeProfile } from '../../context/employeeDetailsSlice';
import { setUser } from '../../context/Auth/authSlice';
import { mergeSessionProfile } from '../../utils/profileUtils';
import { invalidateProfilePhotoCache } from '../../utils/axios';
import { toast } from 'react-toastify';
import { FiUser, FiEdit2, FiCalendar, FiX } from 'react-icons/fi';
import ChangePasswordForm from '../../components/ChangePasswordForm';

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
    Boolean((profileSource?.professionalExperience || []).length > 0), // Experience
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
  const hrContactName = String(
    profileSource?.hrContact ||
    employeeDetails?.hrContact ||
    user?.hrContact ||
    ''
  ).trim() || 'N/A';

  const handleChange = (field, value) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const resetPersonalDetailsForm = () => {
    if (!profileSource) return;
    setFormValues(buildPersonalFormValues(profileSource));
  };

  const handlePersonalDetailsSave = async () => {
    const firstName = String(formValues.firstName || '').trim();
    const lastName = String(formValues.lastName || '').trim();
    if (!firstName) {
      toast.error('First name is required.');
      return;
    }

    setIsSavingPersonalDetails(true);
    try {
      const payload = {
        name: firstName,
        lastName,
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
          name: freshEmployee.name,
          lastName: freshEmployee.lastName,
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
    { id: 'professionalExperience', label: 'Professional Experience' },
    { id: 'familyDetails', label: 'Family Details' },
    { id: 'jobDetails', label: 'Documents' },
    { id: 'financialDetails', label: 'Financial Details' },
    { id: 'security', label: 'Security' },
  ];

  const tabPathMap = {
    personalDetails: '/profile-details',
    contactDetails: '/contact-details',
    educationQualifications: '/education-qualifications',
    professionalExperience: '/professional-experience',
    familyDetails: '/family-details',
    jobDetails: '/job-details',
    financialDetails: '/financial-details',
    security: '/profile-security',
  };

  const pathTabMap = {
    '/profile-details': 'personalDetails',
    '/contact-details': 'contactDetails',
    '/education-qualifications': 'educationQualifications',
    '/professional-experience': 'professionalExperience',
    '/family-details': 'familyDetails',
    '/job-details': 'jobDetails',
    '/financial-details': 'financialDetails',
    '/profile-security': 'security',
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
      <div className="mx-auto max-w-xl space-y-6">
        <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">No employee profile linked yet</h2>
          <p className="text-sm text-slate-600">
            {permissionFlags.isOrgOwner
              ? 'Open Admin → Employees, find your profile row, and click the Me button to link it to your Me tab. Or add a new employee and check “Show on my Me tab”.'
              : 'Your personal employee profile is not set up yet. Please contact your organization administrator.'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
          <ChangePasswordForm />
        </div>
      </div>
    );
  }

  const inputCls = 'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition placeholder:text-gray-400';

  return (
    <div className="page-shell employee-profile-page w-full transition-all duration-300">
      <div className="page-shell-inner hrms-stack">

        <section className="employee-profile-layout">
            <aside className="employee-profile-sidebar min-w-0">
              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden lg:sticky lg:top-4">
                <div className="relative bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary)]/80 h-20" />
                <div className="px-4 pb-4 text-center -mt-10 sm:px-5 sm:pb-5">
                  <div className="mb-2 flex justify-center">
                      <ProfilePicture
                        key={
                          profileSource?.profilePhoto?.s3Key
                          || profileSource?.profilePhoto?.uploadedAt
                          || profileSource?.profilePhoto?.url
                          || profileSource?.profilePhoto?.filename
                          || profileSource?.id
                          || user?.id
                        }
                        user={profileSource}
                        size="2xl"
                        showWhiteRing
                        showEditButton={true}
                        onEditClick={() => setShowPhotoUpload(true)}
                      />
                  </div>
                  <h2 className="truncate text-base font-bold text-gray-900">
                    {[profileSource?.name, profileSource?.lastName].filter(Boolean).join(' ') || user?.name || 'Employee'}
                  </h2>
                  <p className="mt-0.5 truncate text-xs font-medium text-[var(--color-primary)]">{profileSource?.jobTitle || user?.jobTitle || 'Team Member'}</p>

                  <div className="mt-4 w-full min-w-0 text-left">
                    {[
                      { label: 'Department', value: user?.department },
                      { label: 'Employee ID', value: user?.employeeId },
                      { label: 'Join date', value: joinDateValue ? new Date(joinDateValue).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null },
                      { label: 'Manager', value: managerAssignedName },
                      { label: 'HR', value: hrContactName },
                    ].map((item) => (
                      <div key={item.label} className="profile-meta-row flex items-center justify-between gap-3 border-b border-gray-50 py-2.5 last:border-0">
                        <span className="shrink-0 text-xs text-gray-500">{item.label}</span>
                        <span className="min-w-0 text-right text-xs font-semibold text-gray-800">{item.value || 'N/A'}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-lg bg-gray-50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-800">Profile completion</span>
                      <span className="text-xs font-bold text-[var(--color-primary)]">{completionPercent}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200">
                      <div className="h-2 rounded-full bg-[var(--color-primary)] transition-all duration-500" style={{ width: `${completionPercent}%` }} />
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1.5">{stepsLeft} section{stepsLeft !== 1 ? 's' : ''} remaining</p>
                  </div>
                </div>
              </div>
            </aside>

            <div className="employee-profile-main min-w-0 w-full">
              <div className="employee-profile-panel rounded-2xl border border-gray-200 bg-white overflow-hidden">
                <div className="employee-profile-tabs px-1 sm:px-4">
                  <div className="hrms-tabs-scroll" role="tablist">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        onClick={() => handleTabClick(tab.id)}
                        className={`whitespace-nowrap px-2.5 py-3 text-xs font-medium transition sm:px-4 sm:text-[13px] ${
                          activeTab === tab.id
                            ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]'
                            : 'text-gray-400 hover:text-gray-700'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="employee-profile-content">
                {activeTab === 'personalDetails' && (
                  <div className="space-y-4">
                    {isPersonalEditing ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">First name</label>
                            <input
                              value={formValues.firstName}
                              onChange={(e) => handleChange('firstName', e.target.value)}
                              className={inputCls}
                              placeholder="First name"
                              autoComplete="given-name"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Last name</label>
                            <input
                              value={formValues.lastName}
                              onChange={(e) => handleChange('lastName', e.target.value)}
                              className={inputCls}
                              placeholder="Last name"
                              autoComplete="family-name"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Date of birth</label>
                            <input type="date" value={formValues.dateOfBirth} onChange={(e) => handleChange('dateOfBirth', e.target.value)} className={inputCls} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
                            <select value={formValues.gender} onChange={(e) => handleChange('gender', e.target.value)} className={inputCls}>
                              <option value="">Select gender</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2 pt-1">
                          <button type="button" onClick={() => { resetPersonalDetailsForm(); setIsPersonalEditing(false); }} disabled={isSavingPersonalDetails} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-60">Cancel</button>
                          <button type="button" onClick={handlePersonalDetailsSave} disabled={isSavingPersonalDetails} className="rounded-lg bg-theme-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition disabled:opacity-60">{isSavingPersonalDetails ? 'Saving...' : 'Save changes'}</button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="profile-section-header flex items-center justify-between gap-3">
                          <h3 className="text-sm font-semibold text-gray-900">Personal details</h3>
                          <button type="button" onClick={() => setIsPersonalEditing(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-theme-primary px-3.5 py-2 text-sm font-medium text-white hover:opacity-90 transition">
                            <FiEdit2 size={13} /> Edit
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          {[
                            { label: 'First name', value: formValues.firstName },
                            { label: 'Last name', value: formValues.lastName },
                            { label: 'Date of birth', value: formValues.dateOfBirth },
                            { label: 'Gender', value: formValues.gender },
                          ].map((item) => (
                            <div key={item.label} className="rounded-lg bg-gray-50 px-3.5 py-3">
                              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{item.label}</p>
                              <p className="mt-1 text-sm font-semibold text-gray-900">{item.value || 'N/A'}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'contactDetails' && (
                  <div className="space-y-4">
                    <ContactDetails />
                  </div>
                )}

                {activeTab === 'educationQualifications' && (
                  <EducationQualifications />
                )}

                {activeTab === 'professionalExperience' && (
                  <ProfessionalExperience />
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

                {activeTab === 'security' && (
                  <div className="max-w-lg">
                    <ChangePasswordForm />
                  </div>
                )}

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
                userId={
                  employeeDetails?._id ||
                  employeeDetails?.id ||
                  profileSource?._id ||
                  profileSource?.id ||
                  user?.employeeProfileId ||
                  user?._id ||
                  user?.id
                }
                profilePhoto={profileSource?.profilePhoto || profileSource?.profilePicture}
                onPhotoUpdate={(photoData) => {
                  const profilePhoto = photoData?.profilePhoto || photoData;
                  const ownerId =
                    employeeDetails?._id ||
                    employeeDetails?.id ||
                    profileSource?._id ||
                    profileSource?.id ||
                    user?.employeeProfileId ||
                    user?._id ||
                    user?.id;
                  invalidateProfilePhotoCache('employee', ownerId);
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