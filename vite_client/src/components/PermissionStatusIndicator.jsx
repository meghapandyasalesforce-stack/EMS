import React from 'react';
import { FiMapPin, FiCamera, FiBell, FiCheckCircle, FiAlertCircle, FiXCircle } from 'react-icons/fi';
import { usePermissions } from '../hooks/usePermissions';

const PermissionStatusIndicator = ({ type, showLabel = true, size = 'md' }) => {
  const { getPermissionStatus, isPermissionGranted, isPermissionDenied } = usePermissions();

  const status = getPermissionStatus(type);
  const granted = isPermissionGranted(type);
  const denied = isPermissionDenied(type);

  const getIcon = () => {
    switch (type) {
      case 'location':
        return <FiMapPin className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />;
      case 'camera':
        return <FiCamera className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />;
      case 'notifications':
        return <FiBell className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />;
      default:
        return null;
    }
  };

  const getStatusIcon = () => {
    if (granted) {
      return <FiCheckCircle className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />;
    }
    if (denied) {
      return <FiXCircle className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />;
    }
    return <FiAlertCircle className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />;
  };

  const getStatusColor = () => {
    if (granted) return 'text-green-600';
    if (denied) return 'text-red-600';
    return 'text-yellow-600';
  };

  const getLabel = () => {
    switch (type) {
      case 'location':
        return 'Location';
      case 'camera':
        return 'Camera';
      case 'notifications':
        return 'Notifications';
      default:
        return 'Permission';
    }
  };

  return (
    <div className={`flex items-center space-x-2 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
      <div className={`${getStatusColor()}`}>
        {getIcon()}
      </div>
      {showLabel && (
        <>
          <span className="text-gray-700">{getLabel()}</span>
          <div className={getStatusColor()}>
            {getStatusIcon()}
          </div>
        </>
      )}
    </div>
  );
};

export default PermissionStatusIndicator;

