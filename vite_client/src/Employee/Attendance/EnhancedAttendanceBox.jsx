import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  clockIn, 
  clockOut, 
  breakIn, 
  breakOut
} from '../../context/attendanceSlice';
import { format, parseISO } from 'date-fns';
import { FiClock, FiHome, FiMapPin, FiCalendar, FiCoffee, FiPause, FiPlay, FiCamera, FiWifi } from 'react-icons/fi';
import { toast } from 'react-toastify';

const EnhancedAttendanceBox = () => {
  const dispatch = useDispatch();
  const {
    sessions,
    error,
    loading,
    dailyStats,
    breakSession
  } = useSelector((state) => state.attendance);

  const [workLocation, setWorkLocation] = useState('office');
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [currentSession, setCurrentSession] = useState(null);
  const [location, setLocation] = useState(null);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (sessions && sessions.length > 0) {
      const openSession = sessions.find(session => !session.clockOut);
      setCurrentSession(openSession || null);
    } else {
      setCurrentSession(null);
    }
  }, [sessions]);

  // Get user's current location
  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            address: 'Location captured' // You can use reverse geocoding here
          };
          setLocation(locationData);
          resolve(locationData);
        },
        (error) => {
          console.error('Error getting location:', error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  };

  // Get network information
  const getNetworkInfo = () => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const networkData = {
      ipAddress: 'Unknown', // This would need to be fetched from backend
      userAgent: navigator.userAgent,
      networkType: connection ? connection.effectiveType : 'unknown',
      connectionSpeed: connection ? connection.downlink : 'unknown'
    };
    setNetworkInfo(networkData);
    return networkData;
  };

  // Capture image from camera
  const captureImage = () => {
    return new Promise((resolve, reject) => {
      if (!videoRef.current || !canvasRef.current) {
        reject(new Error('Camera not available'));
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          const imageUrl = URL.createObjectURL(blob);
          setCapturedImage(imageUrl);
          resolve(imageUrl);
        } else {
          reject(new Error('Failed to capture image'));
        }
      }, 'image/jpeg', 0.8);
    });
  };

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user'
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCapturing(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Camera access denied or not available');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCapturing(false);
  };

  const showNotification = (message, type) => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
  };

  const handleClockIn = async () => {
    try {
      const openSession = sessions.find(session => !session.clockOut);

      if (openSession) {
        showNotification(
          `You have an open session since ${formatTime(openSession.clockIn)}. Please clock out first.`,
          'error'
        );
        return;
      }

      // Get location and network info
      const locationData = await getCurrentLocation();
      const networkData = getNetworkInfo();

      // Capture image
      await startCamera();
      const imageUrl = await captureImage();
      stopCamera();

      // Prepare clock in data
      const clockInData = {
        workLocation,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        address: locationData.address,
        accuracy: locationData.accuracy,
        networkType: networkData.networkType,
        connectionSpeed: networkData.connectionSpeed,
        imageUrl,
        imageFilename: `clockin_${Date.now()}.jpg`
      };

      await dispatch(clockIn(clockInData)).unwrap();
      showNotification('Checked in successfully!', 'success');
    } catch (err) {
      const errorMessage = err?.message || err?.payload?.message || 'Failed to check in. Please try again.';
      showNotification(errorMessage, 'error');
      stopCamera();
    }
  };

  const handleClockOut = async () => {
    if (!currentSession) return;
    try {
      // Get location and network info
      const locationData = await getCurrentLocation();
      const networkData = getNetworkInfo();

      // Capture image
      await startCamera();
      const imageUrl = await captureImage();
      stopCamera();

      // Prepare clock out data
      const clockOutData = {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        address: locationData.address,
        accuracy: locationData.accuracy,
        networkType: networkData.networkType,
        connectionSpeed: networkData.connectionSpeed,
        imageUrl,
        imageFilename: `clockout_${Date.now()}.jpg`
      };

      await dispatch(clockOut({ sessionId: currentSession._id, ...clockOutData })).unwrap();
      showNotification('Checked out successfully!', 'success');
    } catch (err) {
      const errorMessage = err?.message || 'Failed to check out';
      showNotification(errorMessage, 'error');
      stopCamera();
    }
  };

  const handleBreakIn = async () => {
    try {
      await dispatch(breakIn()).unwrap();
      showNotification('Break started!', 'success');
    } catch (err) {
      const errorMessage = err?.message || 'Failed to start break';
      showNotification(errorMessage, 'error');
    }
  };

  const handleBreakOut = async () => {
    try {
      await dispatch(breakOut()).unwrap();
      showNotification('Break ended!', 'success');
    } catch (err) {
      const errorMessage = err?.message || 'Failed to end break';
      showNotification(errorMessage, 'error');
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    try {
      return format(parseISO(timeString), 'HH:mm:ss');
    } catch {
      return timeString;
    }
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <FiClock className="mr-2" />
        Enhanced Attendance
      </h3>

      {/* Camera Preview */}
      {isCapturing && (
        <div className="mb-4 p-4 bg-gray-100 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Camera Preview</span>
            <button
              onClick={stopCamera}
              className="text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full max-w-md rounded-lg"
          />
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Location Info */}
      {location && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center text-sm text-blue-700">
            <FiMapPin className="mr-2" />
            <span>Location: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</span>
          </div>
        </div>
      )}

      {/* Network Info */}
      {networkInfo && (
        <div className="mb-4 p-3 bg-green-50 rounded-lg">
          <div className="flex items-center text-sm text-green-700">
            <FiWifi className="mr-2" />
            <span>Network: {networkInfo.networkType} ({networkInfo.connectionSpeed} Mbps)</span>
          </div>
        </div>
      )}

      {/* Work Location Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Work Location
        </label>
        <select
          value={workLocation}
          onChange={(e) => setWorkLocation(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="office">Office</option>
          <option value="work_from_home">Work from Home</option>
        </select>
      </div>

      {/* Current Session Display */}
      {currentSession && (
        <div className="mb-4 p-4 bg-green-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800">Currently Clocked In</p>
              <p className="text-xs text-green-600">
                Since: {formatTime(currentSession.clockIn)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-green-800">
                {formatDuration(Math.floor((new Date() - new Date(currentSession.clockIn)) / 1000))}
              </p>
              <p className="text-xs text-green-600">Elapsed Time</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {!currentSession ? (
          <button
            onClick={handleClockIn}
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg transition duration-300 flex items-center justify-center disabled:opacity-50"
          >
            <FiCamera className="mr-2" />
            {loading ? 'Processing...' : 'Clock In with Photo'}
          </button>
        ) : (
          <div className="space-y-2">
            <button
              onClick={handleClockOut}
              disabled={loading}
              className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg transition duration-300 flex items-center justify-center disabled:opacity-50"
            >
              <FiCamera className="mr-2" />
              {loading ? 'Processing...' : 'Clock Out with Photo'}
            </button>

            {!breakSession ? (
              <button
                onClick={handleBreakIn}
                disabled={loading}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 rounded-lg transition duration-300 flex items-center justify-center disabled:opacity-50"
              >
                <FiPause className="mr-2" />
                Start Break
              </button>
            ) : (
              <button
                onClick={handleBreakOut}
                disabled={loading}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition duration-300 flex items-center justify-center disabled:opacity-50"
              >
                <FiPlay className="mr-2" />
                End Break
              </button>
            )}
          </div>
        )}
      </div>

      {/* Notification */}
      {notification.show && (
        <div className={`mt-4 p-3 rounded-lg ${
          notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Daily Stats */}
      {dailyStats && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Today's Summary</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Total Hours:</span>
              <span className="ml-2 font-medium">{dailyStats.totalHours || '0:00'}</span>
            </div>
            <div>
              <span className="text-gray-600">Overtime:</span>
              <span className="ml-2 font-medium">{dailyStats.overtime || '0:00'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedAttendanceBox;
