import React, { useState } from 'react';
import { FiMapPin, FiCamera, FiBell, FiX, FiCheckCircle, FiAlertCircle, FiInfo } from 'react-icons/fi';
import { usePermissions } from '../Hooks/usePermissions';

const PermissionRequestDialog = ({ 
  isOpen, 
  onClose, 
  requestedPermissions = [],
  onPermissionsGranted 
}) => {
  const { 
    permissions, 
    requestLocationPermission, 
    requestCameraPermission, 
    requestNotificationPermission,
    getPermissionInstructions 
  } = usePermissions();

  const [requesting, setRequesting] = useState(false);
  const [results, setResults] = useState({});

  if (!isOpen) return null;

  const getPermissionIcon = (type) => {
    switch (type) {
      case 'location':
        return <FiMapPin className="w-6 h-6" />;
      case 'camera':
        return <FiCamera className="w-6 h-6" />;
      case 'notifications':
        return <FiBell className="w-6 h-6" />;
      default:
        return <FiInfo className="w-6 h-6" />;
    }
  };

  const getPermissionTitle = (type) => {
    switch (type) {
      case 'location':
        return 'Location Access';
      case 'camera':
        return 'Camera Access';
      case 'notifications':
        return 'Notifications';
      default:
        return 'Permission';
    }
  };

  const getPermissionDescription = (type) => {
    switch (type) {
      case 'location':
        return 'We need your location to verify your attendance and ensure you\'re at the correct workplace.';
      case 'camera':
        return 'We need camera access to capture your photo during check-in for security purposes.';
      case 'notifications':
        return 'We need notification permission to send you important updates about your attendance, tasks, and announcements.';
      default:
        return 'This permission is required for the app to function properly.';
    }
  };

  const handleRequestPermission = async (type) => {
    setRequesting(true);
    try {
      let result;
      switch (type) {
        case 'location':
          result = await requestLocationPermission();
          break;
        case 'camera':
          result = await requestCameraPermission();
          break;
        case 'notifications':
          result = await requestNotificationPermission();
          break;
        default:
          return;
      }

      setResults(prev => ({
        ...prev,
        [type]: result
      }));

      // If all requested permissions are granted, call callback
      if (onPermissionsGranted && result.granted) {
        const allGranted = requestedPermissions.every(perm => 
          results[perm]?.granted || (perm === type && result.granted)
        );
        if (allGranted) {
          setTimeout(() => {
            onPermissionsGranted();
            onClose();
          }, 1000);
        }
      }
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [type]: { granted: false, error: error.message }
      }));
    } finally {
      setRequesting(false);
    }
  };

  const handleRequestAll = async () => {
    setRequesting(true);
    const allResults = {};

    for (const type of requestedPermissions) {
      try {
        let result;
        switch (type) {
          case 'location':
            result = await requestLocationPermission();
            break;
          case 'camera':
            result = await requestCameraPermission();
            break;
          case 'notifications':
            result = await requestNotificationPermission();
            break;
        }
        allResults[type] = result;
      } catch (error) {
        allResults[type] = { granted: false, error: error.message };
      }
    }

    setResults(allResults);
    setRequesting(false);

    if (onPermissionsGranted) {
      const allGranted = requestedPermissions.every(perm => allResults[perm]?.granted);
      if (allGranted) {
        setTimeout(() => {
          onPermissionsGranted();
          onClose();
        }, 1000);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">Permission Request</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-gray-600 mb-6">
            This app needs the following permissions to function properly. Please grant them to continue.
          </p>

          {requestedPermissions.map((type) => {
            const permission = permissions[type];
            const result = results[type];
            const isGranted = result?.granted || permission?.status === 'granted';
            const isDenied = result?.granted === false || permission?.status === 'denied';
            const instructions = getPermissionInstructions(type);

            return (
              <div
                key={type}
                className={`border-2 rounded-lg p-4 ${
                  isGranted
                    ? 'border-green-500 bg-green-50'
                    : isDenied
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-300 bg-gray-50'
                }`}
              >
                <div className="flex items-start space-x-4">
                  <div
                    className={`p-3 rounded-full ${
                      isGranted
                        ? 'bg-green-100 text-green-600'
                        : isDenied
                        ? 'bg-red-100 text-red-600'
                        : 'bg-blue-100 text-blue-600'
                    }`}
                  >
                    {getPermissionIcon(type)}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-800">
                        {getPermissionTitle(type)}
                      </h3>
                      {isGranted && (
                        <FiCheckCircle className="w-5 h-5 text-green-600" />
                      )}
                      {isDenied && (
                        <FiAlertCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>

                    <p className="text-sm text-gray-600 mb-3">
                      {getPermissionDescription(type)}
                    </p>

                    {isDenied && instructions && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm font-medium text-yellow-800 mb-2">
                          How to enable:
                        </p>
                        <ol className="text-xs text-yellow-700 space-y-1 list-decimal list-inside">
                          {instructions.steps.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {!isGranted && !isDenied && (
                      <button
                        onClick={() => handleRequestPermission(type)}
                        disabled={requesting}
                        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        {requesting ? 'Requesting...' : 'Grant Permission'}
                      </button>
                    )}

                    {isGranted && (
                      <p className="text-sm text-green-700 font-medium mt-2">
                        ✓ Permission granted
                      </p>
                    )}

                    {isDenied && (
                      <p className="text-sm text-red-700 font-medium mt-2">
                        ✗ Permission denied. Please enable it in browser settings.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          {requestedPermissions.length > 1 && (
            <button
              onClick={handleRequestAll}
              disabled={requesting || requestedPermissions.every(type => 
                results[type]?.granted || permissions[type]?.status === 'granted'
              )}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {requesting ? 'Requesting All...' : 'Grant All Permissions'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PermissionRequestDialog;

