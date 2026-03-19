import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { FiCamera, FiEdit } from 'react-icons/fi';
import ProfilePhotoUpload from '../Profile/ProfilePhotoUpload';
import ProfilePicture from '../../Shared/ProfilePicture';
import { setUser } from '../../context/Auth/authSlice';
import { fetchEmployeeOwnInfo } from '../../context/employeeDetailsSlice';

function ProfileDetails() {
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [isFetchingFreshData, setIsFetchingFreshData] = useState(false);
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();

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

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen transition-all duration-300">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-md p-6 md:p-8 text-center">
          <div className="flex justify-center mb-4 md:mb-6">
            <ProfilePicture
              key={user?.profilePhoto?.url || user?.profilePhoto?.filename || user?.id}
              user={user}
              size="2xl"
              showEditButton={true}
              onEditClick={() => setShowPhotoUpload(true)}
            />
          </div>

          <div className="max-w-xl mx-auto">
            <p className="text-gray-600 text-sm">Employee Name</p>
            <h2 className="text-xl md:text-2xl font-semibold text-gray-800 mt-1 mb-4 md:mb-6">
              {user?.name || 'User name'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-4">
              <div>
                <p className="text-gray-500 text-sm">Employee ID</p>
                <div className="flex items-center gap-2">
                  <p className="text-base md:text-lg font-semibold text-gray-700">
                    {user?.employeeId || 'N/A'}
                  </p>
                  {isFetchingFreshData && (
                    <span className="text-xs text-theme-secondary animate-pulse">Updating...</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Department</p>
                <p className="text-base md:text-lg font-semibold text-gray-700">
                  {user?.department || 'Development'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-4">
              <div>
                <p className="text-gray-500 text-sm">Email</p>
                <p className="text-base md:text-lg font-semibold text-gray-700 break-words">
                  {user?.email || ''}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Job Title</p>
                <p className="text-base md:text-lg font-semibold text-gray-700">
                  {user?.jobTitle || 'Developer'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-4">
              <div>
                <p className="text-gray-500 text-sm">Job Category</p>
                <p className="text-base md:text-lg font-semibold text-gray-700">
                  {user?.position || 'Full time'}
                </p>
              </div>
              {user?.birthDate && (
                <div>
                  <p className="text-gray-500 text-sm">Birth Date</p>
                  <p className="text-base md:text-lg font-semibold text-gray-700">
                    {new Date(user.birthDate).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              )}
            </div>

            {user?.birthDate && (
              <div className="text-center mt-4">
                <p className="text-xs text-gray-400">
                  Birth Date shown for birthday tracking in "Upcoming Birthdays"
                </p>
              </div>
            )}
          </div>
        </div>
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