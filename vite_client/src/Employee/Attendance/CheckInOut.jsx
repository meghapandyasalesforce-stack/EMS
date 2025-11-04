import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  clockIn, 
  clockOut, 
  breakIn, 
  breakOut
} from '../../context/attendanceSlice';
import { format, parseISO } from 'date-fns';
import { 
  FiClock, 
  FiHome, 
  FiMapPin, 
  FiCoffee, 
  FiPause, 
  FiPlay, 
  FiCamera, 
  FiWifi, 
  FiNavigation,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiLoader
} from 'react-icons/fi';

const CheckInOut = () => {
  const dispatch = useDispatch();
  const {
    sessions,
    error,
    loading,
    breakSession
  } = useSelector((state) => state.attendance);

  const [workLocation, setWorkLocation] = useState('office');
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [currentSession, setCurrentSession] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [initialLoading, setInitialLoading] = useState(true);
  
  // Enhanced features state
  const [capturedImage, setCapturedImage] = useState(null);
  const [location, setLocation] = useState(null);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Calculate derived values
  const isOnBreak = !!breakSession;
  const canTakeBreak = currentSession && !isOnBreak;
  const canEndBreak = isOnBreak;

  // Get current location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      return Promise.reject('Geolocation not supported');
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          
          try {
            const apiKey = import.meta.env.VITE_GEOCODING_API_KEY || '';
            const response = await fetch(
              `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${apiKey}`
            );
            const data = await response.json();
            const address = data.results?.[0]?.formatted || 'Unknown location';
            
            const locationData = {
              latitude,
              longitude,
              accuracy,
              address
            };
            
            setLocation(locationData);
            resolve(locationData);
          } catch (err) {
            console.log('Geocoding error:', err);
            const locationData = {
              latitude,
              longitude,
              accuracy,
              address: 'Location detected but address unavailable'
            };
            setLocation(locationData);
            resolve(locationData);
          }
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    });
  };

  // Get network information
  const getNetworkInfo = () => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const networkData = {
      ipAddress: 'Detected via server',
      userAgent: navigator.userAgent,
      networkType: connection?.effectiveType || 'unknown',
      connectionSpeed: connection?.downlink ? `${connection.downlink} Mbps` : 'unknown'
    };
    setNetworkInfo(networkData);
    return networkData;
  };

  // Camera functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      showNotification('Camera access denied. Please allow camera permission.', 'error');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageDataUrl);
    stopCamera();
  };

  // Fetch attendance data on component mount
  useEffect(() => {
    const fetchAttendanceData = async () => {
      try {
        setInitialLoading(true);
        getNetworkInfo();
      } catch (error) {
        console.error('Failed to fetch attendance data:', error);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchAttendanceData();
  }, []);

  useEffect(() => {
    if (sessions && sessions.length > 0) {
      const openSession = sessions.find(session => !session.clockOut);
      setCurrentSession(openSession || null);
    } else {
      setCurrentSession(null);
    }
  }, [sessions]);

  // Update current time every second
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  // Calculate elapsed time when checked in
  useEffect(() => {
    let interval;
    if (currentSession && !isOnBreak) {
      interval = setInterval(() => {
        const now = new Date();
        const checkInTime = new Date(currentSession.clockIn);
        const elapsed = (now - checkInTime) / 1000;
        setElapsedTime(elapsed);
      }, 1000);
    } else {
      setElapsedTime(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentSession, isOnBreak]);

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

      setIsProcessing(true);
      
      let locationData = null;
      let networkData = networkInfo || getNetworkInfo();
      
      try {
        locationData = await getCurrentLocation();
      } catch (error) {
        console.warn('Location access denied or failed:', error);
        showNotification('Location access denied. Clocking in without location data.', 'warning');
      }

      const clockInData = {
        workLocation,
        latitude: locationData?.latitude,
        longitude: locationData?.longitude,
        address: locationData?.address,
        accuracy: locationData?.accuracy,
        networkType: networkData?.networkType,
        connectionSpeed: networkData?.connectionSpeed,
        imageUrl: capturedImage,
        imageFilename: capturedImage ? `clockin_${Date.now()}.jpg` : null
      };

      await dispatch(clockIn(clockInData)).unwrap();
      showNotification('Checked in successfully!', 'success');
      setCapturedImage(null);
    } catch (err) {
      const errorMessage = err?.message || err?.payload?.message || 'Failed to check in. Please try again.';
      showNotification(errorMessage, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClockOut = async () => {
    if (!currentSession) return;
    try {
      setIsProcessing(true);
      
      let locationData = null;
      let networkData = networkInfo || getNetworkInfo();
      
      try {
        locationData = await getCurrentLocation();
      } catch (error) {
        console.warn('Location access denied or failed:', error);
        showNotification('Location access denied. Clocking out without location data.', 'warning');
      }

      const clockOutData = {
        latitude: locationData?.latitude,
        longitude: locationData?.longitude,
        address: locationData?.address,
        accuracy: locationData?.accuracy,
        networkType: networkData?.networkType,
        connectionSpeed: networkData?.connectionSpeed,
        imageUrl: capturedImage,
        imageFilename: capturedImage ? `clockout_${Date.now()}.jpg` : null
      };

      await dispatch(clockOut(clockOutData)).unwrap();
      showNotification('Checked out successfully!', 'success');
      setCapturedImage(null);
    } catch (err) {
      const errorMessage = err?.message || 'Failed to check out';
      showNotification(errorMessage, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBreakIn = async () => {
    try {
      await dispatch(breakIn()).unwrap();
      showNotification('Break started successfully!', 'success');
    } catch (err) {
      const errorMessage = err?.message || err?.payload?.message || 'Failed to start break. Please try again.';
      showNotification(errorMessage, 'error');
    }
  };

  const handleBreakOut = async () => {
    try {
      await dispatch(breakOut()).unwrap();
      showNotification('Break ended successfully!', 'success');
    } catch (err) {
      const errorMessage = err?.message || err?.payload?.message || 'Failed to end break. Please try again.';
      showNotification(errorMessage, 'error');
    }
  };

  const showNotification = (message, type) => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 3000);
  };

  const formatTime = (dateString) => {
    if (!dateString) return '--:--';
    return format(parseISO(dateString), 'HH:mm');
  };

  const formatElapsedTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatHours = (seconds) => {
    const hours = seconds / 3600;
    return hours.toFixed(2);
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 px-8 py-6 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
        
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-lg">
              <FiClock className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Check In / Check Out</h2>
              <p className="text-indigo-100 text-sm font-medium">Track your work hours with precision</p>
            </div>
          </div>
          
          {/* Enhanced Real-time Clock */}
          <div className="bg-white/15 backdrop-blur-md text-white px-6 py-3 rounded-2xl flex items-center gap-3 shadow-lg border border-white/20">
            <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse shadow-lg"></div>
            <div className="text-right">
              <div className="text-2xl font-mono font-bold">{format(currentTime, 'HH:mm:ss')}</div>
              <div className="text-xs text-indigo-100 font-medium">{format(currentTime, 'EEEE, MMM dd')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-8 mt-6">
          <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 text-red-800 p-6 rounded-2xl shadow-lg" role="alert">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <FiAlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h4 className="font-semibold text-red-800 mb-1">Error</h4>
                <p className="text-sm text-red-700">{typeof error === 'string' ? error : error.message}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading || initialLoading ? (
        <div className="flex flex-col items-center justify-center p-12">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-indigo-200 rounded-full animate-spin border-t-indigo-600"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent rounded-full animate-ping border-t-indigo-400"></div>
          </div>
          <div className="mt-6 text-center">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Loading Attendance Data</h3>
            <p className="text-gray-600 text-sm">Please wait while we fetch your information...</p>
          </div>
        </div>
      ) : (
        <div className="p-8">
          {currentSession ? (
            <div className="space-y-6">
              {/* Enhanced Status Card */}
              <div className="bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 border border-emerald-200 rounded-3xl p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <FiCheckCircle className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-emerald-800 mb-1">Checked In</h3>
                      <p className="text-emerald-600 text-sm font-medium">Since {formatTime(currentSession.clockIn)}</p>
                      {isOnBreak && (
                        <div className="flex items-center gap-2 mt-2 text-amber-600 bg-amber-100 px-3 py-1 rounded-full">
                          <FiCoffee className="w-4 h-4" />
                          <span className="text-sm font-medium">On break since {formatTime(breakSession.breakIn)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-emerald-600 font-mono mb-1">
                      {formatElapsedTime(elapsedTime)}
                    </div>
                    <div className="text-sm text-emerald-600 font-medium">
                      {formatHours(elapsedTime)} hours worked
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Session Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <FiMapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Work Location</p>
                      <p className="text-lg font-bold text-blue-800">
                        {currentSession.workLocation === 'office' ? 'Office' : 'Home'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                      <FiClock className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-purple-600 font-medium uppercase tracking-wide">Check-in Time</p>
                      <p className="text-lg font-bold text-purple-800">{formatTime(currentSession.clockIn)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Working Hours Display */}
              {currentSession && !isOnBreak && (
                <div className="bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 border border-emerald-200 rounded-3xl p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-lg"></div>
                      <span className="text-emerald-800 font-bold text-lg">Active Working Time</span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-emerald-600 font-mono">
                        {formatElapsedTime(elapsedTime)}
                      </div>
                      <div className="text-sm text-emerald-600 font-medium">
                        {formatHours(elapsedTime)} hours
                      </div>
                    </div>
                  </div>
                  
                  {/* Enhanced Progress Bar */}
                  <div className="w-full bg-emerald-200 rounded-full h-3 shadow-inner">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-green-500 h-3 rounded-full transition-all duration-700 shadow-lg"
                      style={{ width: `${Math.min((elapsedTime / 3600) / 8 * 100, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-sm text-emerald-600 mt-2 font-medium">
                    <span>0h</span>
                    <span>8h Target</span>
                  </div>
                </div>
              )}

              {/* Enhanced Break Status Display */}
              {isOnBreak && (
                <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border border-amber-200 rounded-3xl p-6 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                        <FiCoffee className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-amber-800">On Break</h3>
                        <p className="text-sm text-amber-600 font-medium">Since {formatTime(breakSession.breakIn)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-amber-600 font-mono">
                        {formatElapsedTime(elapsedTime)}
                      </div>
                      <div className="text-sm text-amber-600 font-medium">
                        Break time
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Enhanced Clock Out Section */}
              <div className="bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 rounded-3xl p-8 border border-red-200 shadow-xl">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <FiClock className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">End Your Work Session</h3>
                  <p className="text-gray-600 text-sm">Take a photo for security verification (optional)</p>
                </div>
                
                <div className="flex justify-center mb-6">
                  {!capturedImage ? (
                    <button
                      onClick={startCamera}
                      className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white px-6 py-3 rounded-2xl font-semibold flex items-center gap-3 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                    >
                      <FiCamera className="w-5 h-5" />
                      Take Photo
                    </button>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <img
                          src={capturedImage}
                          alt="Captured"
                          className="w-16 h-16 object-cover rounded-2xl border-3 border-red-500 shadow-lg"
                        />
                        <button
                          onClick={() => setCapturedImage(null)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 shadow-lg"
                        >
                          <FiXCircle className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="text-red-600 font-semibold flex items-center gap-2 text-sm">
                        <FiCheckCircle className="w-5 h-5" />
                        Photo Captured
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={handleClockOut}
                    disabled={loading || isOnBreak || isProcessing}
                    className={`flex-1 py-4 px-6 rounded-2xl text-white font-bold flex items-center justify-center gap-3 text-lg shadow-lg transition-all duration-200 ${
                      loading || isOnBreak || isProcessing 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 hover:shadow-xl transform hover:scale-105'
                    }`}
                  >
                    {loading || isProcessing ? (
                      <>
                        <FiLoader className="animate-spin w-5 h-5" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <FiClock className="w-5 h-5" />
                        Check Out
                      </>
                    )}
                  </button>

                  {canTakeBreak && (
                    <button
                      onClick={handleBreakIn}
                      disabled={loading}
                      className={`py-4 px-6 rounded-2xl text-white font-bold flex items-center gap-2 text-lg shadow-lg transition-all duration-200 ${
                        loading 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 hover:shadow-xl transform hover:scale-105'
                      }`}
                    >
                      <FiPause className="w-5 h-5" />
                      {loading ? 'Processing...' : 'Break'}
                    </button>
                  )}

                  {canEndBreak && (
                    <button
                      onClick={handleBreakOut}
                      disabled={loading}
                      className={`py-4 px-6 rounded-2xl text-white font-bold flex items-center gap-2 text-lg shadow-lg transition-all duration-200 ${
                        loading 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 hover:shadow-xl transform hover:scale-105'
                      }`}
                    >
                      <FiPlay className="w-5 h-5" />
                      {loading ? 'Processing...' : 'End Break'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <FiClock className="w-10 h-10 text-indigo-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">Ready to Start Your Day?</h3>
              <p className="text-gray-600 text-base mb-8 max-w-md mx-auto">Select your work location and check in to begin tracking your time with enhanced security features</p>
              
              {/* Enhanced Work Location Selection */}
              <div className="mb-8">
                <p className="text-lg font-semibold text-gray-700 mb-6">Select Work Location:</p>
                <div className="flex justify-center space-x-6">
                  <label className={`flex items-center cursor-pointer p-6 rounded-2xl border-2 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 ${
                    workLocation === 'office' 
                      ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50' 
                      : 'border-gray-200 bg-white hover:border-blue-300'
                  }`}>
                    <input
                      type="radio"
                      name="workLocation"
                      value="office"
                      checked={workLocation === 'office'}
                      onChange={(e) => setWorkLocation(e.target.value)}
                      className="mr-4 text-blue-500 w-5 h-5"
                    />
                    <div className="flex flex-col items-center">
                      <FiMapPin className={`text-2xl mb-2 ${workLocation === 'office' ? 'text-blue-600' : 'text-gray-500'}`} />
                      <span className={`font-semibold ${workLocation === 'office' ? 'text-blue-800' : 'text-gray-700'}`}>Office</span>
                    </div>
                  </label>

                  <label className={`flex items-center cursor-pointer p-6 rounded-2xl border-2 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 ${
                    workLocation === 'home' 
                      ? 'border-green-500 bg-gradient-to-br from-green-50 to-emerald-50' 
                      : 'border-gray-200 bg-white hover:border-green-300'
                  }`}>
                    <input
                      type="radio"
                      name="workLocation"
                      value="home"
                      checked={workLocation === 'home'}
                      onChange={(e) => setWorkLocation(e.target.value)}
                      className="mr-4 text-green-500 w-5 h-5"
                    />
                    <div className="flex flex-col items-center">
                      <FiHome className={`text-2xl mb-2 ${workLocation === 'home' ? 'text-green-600' : 'text-gray-500'}`} />
                      <span className={`font-semibold ${workLocation === 'home' ? 'text-green-800' : 'text-gray-700'}`}>Home</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Enhanced Security Verification */}
              <div className="mb-8">
                <p className="text-lg font-semibold text-gray-700 mb-6">Security Verification (Optional):</p>
                <div className="flex justify-center">
                  {!capturedImage ? (
                    <button
                      onClick={startCamera}
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 text-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                    >
                      <FiCamera className="w-6 h-6" />
                      Take Photo
                    </button>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <img
                          src={capturedImage}
                          alt="Captured"
                          className="w-20 h-20 object-cover rounded-2xl border-3 border-green-500 shadow-lg"
                        />
                        <button
                          onClick={() => setCapturedImage(null)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 shadow-lg"
                        >
                          <FiXCircle className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="text-green-600 font-bold flex items-center gap-2 text-lg">
                        <FiCheckCircle className="w-6 h-6" />
                        Photo Captured
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Enhanced Location and Network Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 shadow-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <FiNavigation className="text-blue-600 w-5 h-5" />
                    </div>
                    <span className="font-bold text-gray-800 text-lg">Location</span>
                  </div>
                  <div className="text-sm text-gray-700">
                    {location ? (
                      <div>
                        <div className="flex items-center gap-2 text-green-600 mb-2">
                          <FiCheckCircle className="w-5 h-5" />
                          <span className="font-semibold">Detected</span>
                        </div>
                        <p className="text-gray-600 truncate">{location.address}</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-orange-600">
                        <FiAlertCircle className="w-5 h-5" />
                        <span className="font-semibold">Not detected</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 shadow-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <FiWifi className="text-green-600 w-5 h-5" />
                    </div>
                    <span className="font-bold text-gray-800 text-lg">Network</span>
                  </div>
                  <div className="text-sm text-gray-700">
                    {networkInfo ? (
                      <div>
                        <div className="flex items-center gap-2 text-green-600 mb-2">
                          <FiCheckCircle className="w-5 h-5" />
                          <span className="font-semibold">Connected</span>
                        </div>
                        <p className="text-gray-600">{networkInfo.networkType} • {networkInfo.connectionSpeed}</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-orange-600">
                        <FiAlertCircle className="w-5 h-5" />
                        <span className="font-semibold">Unknown</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Enhanced Check In Button */}
              <button
                onClick={handleClockIn}
                disabled={loading || isProcessing}
                className={`w-full max-w-md py-5 px-8 rounded-2xl text-white font-bold text-xl shadow-xl transition-all duration-200 ${
                  loading || isProcessing 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 hover:shadow-2xl transform hover:scale-105'
                }`}
              >
                {loading || isProcessing ? (
                  <div className="flex items-center justify-center">
                    <FiLoader className="animate-spin w-6 h-6 mr-3" />
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <FiClock className="w-6 h-6 mr-3" />
                    Check In
                  </div>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Enhanced Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <FiCamera className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Capture Photo</h3>
              </div>
              <button
                onClick={stopCamera}
                className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <FiXCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="relative mb-6">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-80 bg-gray-200 rounded-2xl shadow-lg"
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={captureImage}
                className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                <FiCamera className="w-5 h-5" />
                Capture Photo
              </button>
              <button
                onClick={stopCamera}
                className="flex-1 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white py-4 px-6 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Notification System */}
      {notification.show && (
        <div className={`fixed bottom-6 right-6 p-6 rounded-2xl shadow-2xl text-white z-50 max-w-md border-2 ${
          notification.type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-600 border-green-400' : 
          notification.type === 'warning' ? 'bg-gradient-to-r from-yellow-500 to-orange-500 border-yellow-400' : 
          'bg-gradient-to-r from-red-500 to-rose-600 border-red-400'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              {notification.type === 'success' ? (
                <FiCheckCircle className="w-6 h-6" />
              ) : notification.type === 'warning' ? (
                <FiAlertCircle className="w-6 h-6" />
              ) : (
                <FiXCircle className="w-6 h-6" />
              )}
            </div>
            <div>
              <p className="font-bold text-lg">{notification.message}</p>
              <p className="text-sm opacity-90">
                {notification.type === 'success' ? 'Action completed successfully' : 
                 notification.type === 'warning' ? 'Please take note' : 
                 'An error occurred'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckInOut;
