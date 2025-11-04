import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { FiCamera, FiEdit } from 'react-icons/fi';
import ProfilePhotoUpload from '../Profile/ProfilePhotoUpload';
import ProfilePicture from '../../Shared/ProfilePicture';
import { setUser } from '../../context/Auth/authSlice';

function ProfileDetails() {
  const [employee, setEmployee] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 ml-0 md:ml-64 transition-all duration-300">
      {/* On mobile: ml-0, on medium screens and up: ml-64 for one sidebar */}
      {/* When both sidebars are open (lg screens), we need ml-128 (64x2) */}
      <div className="max-w-3xl mx-auto lg:mx-4 lg:ml-32 xl:mx-auto">
        <div className="bg-white rounded-2xl shadow-md p-6 md:p-8 text-center">
          <div className="flex justify-center mb-4 md:mb-6">
            <ProfilePicture
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
                <p className="text-base md:text-lg font-semibold text-gray-700">
                  {user?.employeeId || 'N/A'}
                </p>
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
                  // Update user data in Redux store
                  const updatedUser = { ...user, profilePhoto: photoData };
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