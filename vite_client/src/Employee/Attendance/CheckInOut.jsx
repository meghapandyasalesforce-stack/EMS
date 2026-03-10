import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  clockIn, 
  clockOut, 
  breakIn, 
  breakOut,
  clearError,
  fetchLogs
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
import { usePermissions } from '../../Hooks/usePermissions';
import PermissionRequestDialog from '../../components/PermissionRequestDialog';
import PermissionStatusIndicator from '../../components/PermissionStatusIndicator';
import axiosInstance from '../../utils/axios';
import { isValidCoordinates, checkLocationWithinRadius } from '../../utils/locationHelper';

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
  
  // Location-based attendance state (Kredily-style)
  const [attendanceRule, setAttendanceRule] = useState(null);
  const [distanceFromOffice, setDistanceFromOffice] = useState(null);
  const [isWithinRadius, setIsWithinRadius] = useState(null);
  const [locationWatchId, setLocationWatchId] = useState(null);
  
  // Permission management
  const {
    isPermissionGranted,
    isPermissionDenied,
    requestLocationPermission,
    requestCameraPermission,
    checkAllPermissions
  } = usePermissions();
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  
  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Function to save location permission status to backend
  const saveLocationPermissionStatus = async (status) => {
    try {
      await axiosInstance.put('/v1/both/profile-details/update-location-permission', {
        status
      });
    } catch (error) {
      // Silently fail - permission tracking is not critical for functionality
    }
  };

  // Calculate derived values
  const isOnBreak = !!breakSession;
  const canTakeBreak = currentSession && !isOnBreak;
  const canEndBreak = isOnBreak;

  // Get current location with permission check
  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      await saveLocationPermissionStatus('not-requested');
      return Promise.reject(new Error('Geolocation not supported'));
    }

    // Check if we're on HTTPS or localhost (required for geolocation)
    const isSecure = window.location.protocol === 'https:' || 
                     window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';
    
    if (!isSecure) {
      const errorMsg = 'Geolocation requires HTTPS. Please use HTTPS or localhost.';
      showNotification(errorMsg, 'error');
      return Promise.reject(new Error(errorMsg));
    }

    // Check if permission is denied
    if (isPermissionDenied('location')) {
      await saveLocationPermissionStatus('denied');
      showNotification('Location permission denied. Please enable it in browser settings.', 'error');
      return Promise.reject(new Error('Location permission denied'));
    }

    // Don't check isPermissionGranted here - just try to get location
    // The browser will use cached permission or prompt if needed
    // This avoids race conditions where permission state hasn't updated yet

    return new Promise((resolve, reject) => {
      // Set a timeout for the entire operation
      const timeoutId = setTimeout(() => {
        reject(new Error('Location request timed out. Please ensure GPS is enabled and try again.'));
      }, 30000); // 30 seconds total timeout

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          clearTimeout(timeoutId);
          let { latitude, longitude, accuracy } = position.coords;
          
          // Ensure coordinates are numbers (convert if needed)
          latitude = Number(latitude);
          longitude = Number(longitude);
          accuracy = Number(accuracy) || 0;
          
          // Validate coordinates
          if (typeof latitude !== 'number' || typeof longitude !== 'number' || 
              isNaN(latitude) || isNaN(longitude) ||
              latitude < -90 || latitude > 90 ||
              longitude < -180 || longitude > 180) {
            reject(new Error('Invalid location coordinates received'));
            return;
          }
          
          // Don't wait for geocoding - resolve immediately with coordinates
          const locationData = {
            latitude,
            longitude,
            accuracy,
            address: 'Getting address...' // Temporary, will update async
          };
          
          setLocation(locationData);
          
          // Save permission status as granted (we got location successfully)
          await saveLocationPermissionStatus('granted').catch(() => {});
          
          resolve(locationData);
          
          // Get address asynchronously (non-blocking)
          const apiKey = import.meta.env.VITE_GEOCODING_API_KEY || '';
          if (apiKey) {
            fetch(`https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${apiKey}`)
              .then(response => response.json())
              .then(data => {
                const address = data.results?.[0]?.formatted || 'Location detected but address unavailable';
                const updatedLocation = { ...locationData, address };
                setLocation(updatedLocation);
              })
              .catch(() => {
                // Silently fail - we already have coordinates
                const updatedLocation = { ...locationData, address: 'Location detected but address unavailable' };
                setLocation(updatedLocation);
              });
          } else {
            // No API key - just set default address
            const updatedLocation = { ...locationData, address: 'Location detected but address unavailable' };
            setLocation(updatedLocation);
          }
        },
        async (error) => {
          clearTimeout(timeoutId);
          let errorMessage = 'Location error: ';
          const errorCode = error?.code;
          
          // Enhanced error logging with detailed diagnostics
          const errorDetails = {
            code: errorCode,
            errorType: errorCode === 1 ? 'PERMISSION_DENIED' :
                      errorCode === 2 ? 'POSITION_UNAVAILABLE' :
                      errorCode === 3 ? 'TIMEOUT' : 'UNKNOWN',
            message: error.message,
            protocol: window.location.protocol,
            hostname: window.location.hostname,
            isHTTPS: window.location.protocol === 'https:',
            isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
            hasGeolocation: !!navigator.geolocation,
            userAgent: navigator.userAgent
          };
          
          if (errorCode === 1 || errorCode === error?.PERMISSION_DENIED) {
            errorMessage = 'Location permission denied. Please enable it in browser settings.';
            // Save denied status
            await saveLocationPermissionStatus('denied').catch(() => {});
          } else if (errorCode === 2 || errorCode === error?.POSITION_UNAVAILABLE) {
            errorMessage = 'GPS position unavailable. Please check your device settings and ensure GPS is enabled.';
          } else if (errorCode === 3 || errorCode === error?.TIMEOUT) {
            errorMessage = 'Location request timed out. Please try again or check your GPS settings.';
          } else {
            errorMessage += error.message || 'Unknown error';
          }
          
          showNotification(errorMessage, 'error');
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 25000, // 25 seconds (less than the Promise timeout)
          maximumAge: 0 // Always get fresh location, don't use cache
        }
      );
    });
  };

  // Detect device type
  const detectDeviceType = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
      return 'mobile';
    }
    if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
      return 'tablet';
    }
    return 'desktop';
  };

  // Note: calculateDistance and checkLocationWithinRadius are now imported from locationHelper

  // Fetch attendance rule on component mount
  useEffect(() => {
    const fetchAttendanceRule = async () => {
      try {
        const response = await axiosInstance.get('/v1/both/attendance/rule');
        if (response.data.success && response.data.rule) {
          setAttendanceRule(response.data.rule);
        }
      } catch (error) {
        // Silently fail - location validation will still work
      }
    };
    fetchAttendanceRule();
  }, []);

  // Real-time location monitoring for distance calculation
  useEffect(() => {
    if (!attendanceRule?.coordinates || attendanceRule?.enableSimplePunches) {
      return; // Don't monitor if no rule or simple punches enabled
    }

    if (!isPermissionGranted('location')) {
      return; // Don't monitor if location permission not granted
    }

    // Start watching location for real-time distance updates
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const officeCoords = attendanceRule.coordinates;
          
          if (officeCoords && officeCoords.latitude && officeCoords.longitude) {
            const result = checkLocationWithinRadius(
              latitude,
              longitude,
              officeCoords.latitude,
              officeCoords.longitude,
              attendanceRule.maximumRadius
            );
            
            if (result) {
              setDistanceFromOffice(result.distance);
              setIsWithinRadius(result.isWithinRadius);
            }
          }
        },
        (error) => {
          // Silently handle location watch errors
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000 // Update every 5 seconds
        }
      );
      
      setLocationWatchId(watchId);
    }

    // Cleanup: stop watching when component unmounts or rule changes
    return () => {
      if (locationWatchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(locationWatchId);
      }
    };
  }, [attendanceRule, isPermissionGranted, locationWatchId]);

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

  // Camera functions with permission check
  const startCamera = async () => {
    // Check if permission is denied
    if (isPermissionDenied('camera')) {
      showNotification('Camera permission denied. Please enable it in browser settings.', 'error');
      return;
    }

    // Request permission if not granted
    if (!isPermissionGranted('camera')) {
      try {
        const result = await requestCameraPermission();
        if (!result.granted) {
          showNotification('Camera permission is required to capture your photo.', 'warning');
          return;
        }
      } catch {
        showNotification('Failed to request camera permission.', 'error');
        return;
      }
    }

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
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        showNotification('Camera access denied. Please allow camera permission in browser settings.', 'error');
      } else {
        showNotification('Camera access denied. Please allow camera permission.', 'error');
      }
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

  // Check permissions on mount
  useEffect(() => {
    checkAllPermissions();
  }, [checkAllPermissions]);

  // Automatically show location permission dialog on mount if not granted
  useEffect(() => {
    // Wait a bit for permissions to be checked
    const timer = setTimeout(() => {
      if (!isPermissionGranted('location') && !isPermissionDenied('location')) {
        setShowPermissionDialog(true);
      }
    }, 1000); // Give time for permission check to complete

    return () => clearTimeout(timer);
  }, [isPermissionGranted, isPermissionDenied]);

  // Clear stale location-related errors on component mount
  useEffect(() => {
    if (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || '';
      const errorCode = typeof error === 'object' ? error?.code || error?.data?.code : '';
      
      // Clear if it's a location-related error (likely stale from previous attempt)
      if (errorMessage.includes('Location is required') || 
          errorMessage.includes('LOCATION_REQUIRED') ||
          errorCode === 'LOCATION_REQUIRED') {
        // Clear the error after component has mounted
        const timer = setTimeout(() => {
          dispatch(clearError());
        }, 2000); // Clear after 2 seconds
        return () => clearTimeout(timer);
      }
    }
  }, [error, dispatch]); // Include dependencies

  // Fetch attendance data on component mount
  useEffect(() => {
    const fetchAttendanceData = async () => {
      try {
        setInitialLoading(true);
        getNetworkInfo();
      } catch {
        // Removed console.error for production
      } finally {
        setInitialLoading(false);
      }
    };

    fetchAttendanceData();
  }, []);

  useEffect(() => {
    if (sessions && sessions.length > 0) {
      const openSession = sessions.find(session => !session.clockOut);
      if (openSession) {
        setCurrentSession(openSession);
      } else {
        const todayKey = format(new Date(), 'yyyy-MM-dd');
        const todaySession = sessions.find(s => {
          if (!s.date || !s.clockOut) return false;
          const sessionDateKey = format(new Date(s.date), 'yyyy-MM-dd');
          return sessionDateKey === todayKey;
        });
        setCurrentSession(todaySession || null);
      }
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

  // Calculate elapsed time when checked in (stop when clocked out)
  useEffect(() => {
    let interval;
    if (currentSession && !currentSession.clockOut && !isOnBreak) {
      // Only calculate elapsed time if not clocked out and not on break
      interval = setInterval(() => {
        const now = new Date();
        const checkInTime = new Date(currentSession.clockIn);
        const elapsed = (now - checkInTime) / 1000;
        setElapsedTime(elapsed);
      }, 1000);
    } else if (currentSession && currentSession.clockOut) {
      // If clocked out, calculate static duration
      const checkInTime = new Date(currentSession.clockIn);
      const checkOutTime = new Date(currentSession.clockOut);
      const elapsed = (checkOutTime - checkInTime) / 1000;
      setElapsedTime(elapsed);
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

      // Check permissions before proceeding
      // Note: We check permissions but still allow proceeding if location permission is pending
      // because getCurrentLocation will handle permission requests
      const needsLocation = !isPermissionGranted('location') && isPermissionDenied('location');
      const needsCamera = !isPermissionGranted('camera');
      
      if (needsLocation || needsCamera) {
        const needed = [];
        if (needsLocation) needed.push('location');
        if (needsCamera) needed.push('camera');
        
        setPendingAction(() => handleClockIn);
        setShowPermissionDialog(true);
        return;
      }

      setIsProcessing(true);
      
      let locationData = null;
      let networkData = networkInfo || getNetworkInfo();
      
      // Always get fresh location for check-in to ensure accuracy
      // Check if location is required based on attendance rule
      // IMPORTANT: Backend requires location when enableSimplePunches is false
      // This matches the backend logic: if (activeRule && !activeRule.enableSimplePunches)
      const hasRuleWithCoordinates = attendanceRule && 
                                      attendanceRule.coordinates && 
                                      attendanceRule.coordinates.latitude && 
                                      attendanceRule.coordinates.longitude;
      
      // Location is required if:
      // 1. Rule exists with coordinates AND enableSimplePunches is false (matches backend logic)
      // 2. OR locationRequired is explicitly true
      const requiresLocation = hasRuleWithCoordinates && 
                               (!attendanceRule.enableSimplePunches || attendanceRule.locationRequired === true);
      
      // Always try to get location if rule exists with coordinates (backend might require it)
      // This ensures we have location data even if frontend logic doesn't think it's required
      const shouldGetLocation = requiresLocation || hasRuleWithCoordinates;
      
      // First, check if we have cached location that's still valid
      if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number' &&
          !isNaN(location.latitude) && !isNaN(location.longitude) &&
          isValidCoordinates(location.latitude, location.longitude)) {
        locationData = location;
      }
      
      // If we don't have valid cached location and we should get it, fetch fresh location
      if (!locationData && shouldGetLocation) {
        // Location is required or rule exists - get fresh location
        let retries = 3;
        let lastError = null;
        
        while (retries > 0 && !locationData) {
          try {
            // Show progress notification
            if (retries === 3) {
              showNotification('Getting your current location...', 'info');
            }
            
            locationData = await getCurrentLocation();
            
            // Verify we actually got valid location data using helper function
            if (locationData && 
                isValidCoordinates(locationData.latitude, locationData.longitude)) {
              break; // Success!
            } else {
              throw new Error('Invalid location coordinates received');
            }
          } catch (error) {
            lastError = error;
            retries--;
            
            // If permission is denied, don't retry - stop immediately
            if (error?.code === 1 || error?.code === error?.PERMISSION_DENIED || 
                error?.message?.includes('permission') || 
                error?.message?.includes('Permission denied')) {
              showNotification('Location permission denied. Please enable it in browser settings.', 'error');
              setIsProcessing(false);
              return; // Stop immediately if permission denied
            }
            
            if (retries > 0) {
              // Wait before retry (exponential backoff)
              const delay = (4 - retries) * 1000; // 1s, 2s, 3s
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        // If all retries failed and location is required
        if (!locationData && requiresLocation) {
          let errorMsg = 'Location access failed after 3 attempts. ';
          
          if (lastError) {
            const errorCode = lastError?.code;
            
            if (errorCode === 1 || errorCode === lastError?.PERMISSION_DENIED || lastError?.message?.includes('permission')) {
              errorMsg = 'Location permission denied. Please enable it in browser settings.';
            } else if (errorCode === 2 || errorCode === lastError?.POSITION_UNAVAILABLE || lastError?.message?.includes('unavailable')) {
              errorMsg = 'GPS position unavailable. Please check your device settings and ensure GPS is enabled.';
            } else if (errorCode === 3 || errorCode === lastError?.TIMEOUT || lastError?.message?.includes('timeout')) {
              errorMsg = 'Location request timed out. Please try again or check your GPS settings.';
            } else if (lastError?.message) {
              errorMsg = lastError.message;
            }
          }
          
          showNotification(errorMsg, 'error');
          setIsProcessing(false);
          return; // Don't proceed if location is required but not available
        }
      } else if (!locationData && !shouldGetLocation) {
        // Location not required - try to get it but don't fail if unavailable
        try {
          if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number' &&
              !isNaN(location.latitude) && !isNaN(location.longitude) &&
              location.latitude !== 0 && location.longitude !== 0) {
            locationData = location;
          } else {
            locationData = await getCurrentLocation();
          }
        } catch (error) {
          // Location is optional, so continue without it
        }
      }

      // Ensure all numeric values are properly formatted and valid (only if location is provided)
      let lat, lng;
      if (locationData && locationData.latitude !== undefined && locationData.longitude !== undefined) {
        lat = Number(locationData.latitude);
        lng = Number(locationData.longitude);
        
        // Final validation before creating payload using helper function
        if (!isValidCoordinates(lat, lng)) {
          if (requiresLocation) {
            showNotification('Invalid location coordinates. Please enable location services and try again.', 'error');
            setIsProcessing(false);
            return;
          }
          // Location invalid but not required - don't include it
          lat = undefined;
          lng = undefined;
          locationData = null; // Clear invalid location data
        }
      } else {
        // No location data available
        // CRITICAL: If attendance rule exists with coordinates and enableSimplePunches is false,
        // backend WILL require location. Don't proceed without it.
        if (hasRuleWithCoordinates && !attendanceRule.enableSimplePunches) {
          // Backend will reject this - we MUST have location
          showNotification('Location is required for check-in at this site. Please enable location services and try again.', 'error');
          setIsProcessing(false);
          return;
        }
        
        if (requiresLocation) {
          showNotification('Location is required for check-in. Please enable location services.', 'error');
          setIsProcessing(false);
          return;
        }
      }
      
      // Final safety check: if location is required but missing, don't proceed
      if (requiresLocation && (lat === undefined || lng === undefined)) {
        showNotification('Location is required for check-in. Please enable location services and try again.', 'error');
        setIsProcessing(false);
        return;
      }

      // Location-based validation (Kredily-style) - only if we have valid location
      if (lat !== undefined && lng !== undefined && attendanceRule && requiresLocation) {
        if (attendanceRule.coordinates && 
            attendanceRule.coordinates.latitude && 
            attendanceRule.coordinates.longitude) {
          const locationCheck = checkLocationWithinRadius(
            lat,
            lng,
            attendanceRule.coordinates.latitude,
            attendanceRule.coordinates.longitude,
            attendanceRule.maximumRadius || 500
          );

          if (locationCheck && !locationCheck.isWithinRadius) {
            showNotification(
              `You are ${locationCheck.distance}m away from the office. Please move within ${attendanceRule.maximumRadius || 500}m radius to check in.`,
              'error'
            );
            setIsProcessing(false);
            return;
          }
        }
      }
      
      // Build clock-in data payload
      // Always include location if we have valid coordinates
      const clockInData = {
        workLocation,
        networkType: networkData?.networkType,
        connectionSpeed: networkData?.connectionSpeed,
        deviceType: detectDeviceType(),
        imageUrl: capturedImage,
        imageFilename: capturedImage ? `clockin_${Date.now()}.jpg` : null
      };
      
      // Include location data if we have valid coordinates
      if (lat !== undefined && lng !== undefined && 
          typeof lat === 'number' && typeof lng === 'number' &&
          !isNaN(lat) && !isNaN(lng)) {
        clockInData.latitude = lat;
        clockInData.longitude = lng;
        clockInData.address = locationData?.address || 'Location detected but address unavailable';
        if (locationData?.accuracy != null) {
          clockInData.accuracy = Number(locationData.accuracy);
        }
      }
      
      // Final validation: Ensure location is included if required
      if (requiresLocation && (!clockInData.latitude || !clockInData.longitude)) {
        showNotification('Location is required but was not captured. Please enable location services and try again.', 'error');
        setIsProcessing(false);
        return;
      }
      
      // CRITICAL FINAL CHECK: Backend will reject if enableSimplePunches is false and location is missing
      // This prevents sending invalid requests
      if (hasRuleWithCoordinates && !attendanceRule.enableSimplePunches && 
          (!clockInData.latitude || !clockInData.longitude)) {
        showNotification('Location is required for check-in at this site. Please enable location services and try again.', 'error');
        setIsProcessing(false);
        return;
      }
      
      // CRITICAL: Final validation before API call
      // This is the last chance to prevent invalid requests
      // Check if location is required based on attendance rule
      if (hasRuleWithCoordinates && !attendanceRule.enableSimplePunches) {
        const hasValidLocation = clockInData.latitude !== undefined && 
                                clockInData.longitude !== undefined &&
                                typeof clockInData.latitude === 'number' &&
                                typeof clockInData.longitude === 'number' &&
                                !isNaN(clockInData.latitude) &&
                                !isNaN(clockInData.longitude) &&
                                clockInData.latitude !== 0 &&
                                clockInData.longitude !== 0;
        
        if (!hasValidLocation) {
          showNotification('Location is required for check-in at this site. Please enable location services and try again.', 'error');
          setIsProcessing(false);
          return;
        }
      }

      const result = await dispatch(clockIn(clockInData)).unwrap();
      // Show success message from server if available, otherwise default
      const successMessage = result?.message || 'Checked in successfully!';
      showNotification(successMessage, 'success');
      // Show warning if present
      if (result?.warning) {
        showNotification(result.warning, 'warning');
      }
      setCapturedImage(null);
    } catch (err) {
      // Extract error message with better handling
      const errorData = err?.response?.data || err?.payload?.data || err?.payload;
      let errorMessage = 'Failed to check in. Please try again.';
      
      // Handle validation errors (array of errors)
      if (errorData?.errors && Array.isArray(errorData.errors)) {
        errorMessage = errorData.errors.map(e => e.message || e.msg || e.field ? `${e.field}: ${e.message || e.msg}` : e).join(', ');
      } 
      // Handle single error message
      else if (errorData?.message) {
        errorMessage = errorData.message;
        // Add details if available
        if (errorData.details && typeof errorData.details === 'object') {
          const detailsStr = Object.entries(errorData.details)
            .map(([key, value]) => {
              if (typeof value === 'object') {
                return `${key}: ${JSON.stringify(value)}`;
              }
              return `${key}: ${value}`;
            })
            .join(', ');
          if (detailsStr) {
            errorMessage += ` (${detailsStr})`;
          }
        }
      } 
      // Handle payload message
      else if (err?.payload?.message) {
        errorMessage = err.payload.message;
      }
      // Handle direct error message
      else if (err?.message) {
        errorMessage = err.message;
      }
      
      // Show specific error messages for common issues
      if (errorData?.code === 'LOCATION_REQUIRED') {
        if (!isPermissionGranted('location')) {
          errorMessage = 'Location is required to clock in. Please grant location permission and try again.';
          // Show permission dialog to help user grant permission
          setPendingAction(() => handleClockIn);
          setShowPermissionDialog(true);
        } else {
          errorMessage = 'Location is required to clock in. Please enable location services and try again.';
        }
      } else if (errorData?.code === 'OUTSIDE_RADIUS') {
        errorMessage = errorData.message || `You are outside the allowed check-in radius. Please move closer to the office location.`;
      } else if (errorData?.code === 'VALIDATION_ERROR') {
        errorMessage = errorData.message || 'Please check your input and try again.';
      }
      
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
      
      // Check if location is required for clock-out (same logic as clock-in)
      const requiresLocationForCheckout = attendanceRule && 
                                          attendanceRule.coordinates && 
                                          attendanceRule.coordinates.latitude && 
                                          attendanceRule.coordinates.longitude &&
                                          (attendanceRule.locationRequired === true || 
                                           (!attendanceRule.enableSimplePunches && attendanceRule.locationRequired !== false));
      
      // Check if we already have valid location data cached
      if (location && isValidCoordinates(location.latitude, location.longitude)) {
        locationData = location;
      } else if (requiresLocationForCheckout) {
        // Location is required - get fresh location
        let retries = 3;
        let lastError = null;
        
        while (retries > 0 && !locationData) {
          try {
            // Show progress notification only on first attempt
            if (retries === 3) {
              showNotification('Getting location for clock-out...', 'info');
            }
            locationData = await getCurrentLocation();
            
            // Verify we actually got valid location data using helper function
            if (locationData && isValidCoordinates(locationData.latitude, locationData.longitude)) {
              break; // Success!
            } else {
              throw new Error('Invalid location coordinates received');
            }
          } catch (error) {
            lastError = error;
            retries--;
            
            // If permission is denied, don't retry - stop immediately
            if (error?.code === 1 || error?.code === error?.PERMISSION_DENIED || 
                error?.message?.includes('permission') || 
                error?.message?.includes('Permission denied')) {
              showNotification('Location permission denied. Please enable it in browser settings.', 'error');
              setIsProcessing(false);
              return; // Stop immediately if permission denied
            }
            
            if (retries > 0) {
              // Wait before retry (exponential backoff)
              const delay = (4 - retries) * 1000; // 1s, 2s, 3s
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        // If all retries failed
        if (!locationData) {
          let errorMsg = 'Location access failed after 3 attempts. ';
          
          if (lastError) {
            const errorCode = lastError?.code;
            if (errorCode === 1 || errorCode === lastError?.PERMISSION_DENIED || lastError?.message?.includes('permission')) {
              errorMsg = 'Location permission denied. Please enable it in browser settings.';
            } else if (errorCode === 2 || errorCode === lastError?.POSITION_UNAVAILABLE || lastError?.message?.includes('unavailable')) {
              errorMsg = 'GPS position unavailable. Please check your device settings and ensure GPS is enabled.';
            } else if (errorCode === 3 || errorCode === lastError?.TIMEOUT || lastError?.message?.includes('timeout')) {
              errorMsg = 'Location request timed out. Please try again or check your GPS settings.';
            } else if (lastError?.message) {
              errorMsg = lastError.message;
            }
          }
          
          showNotification(errorMsg, 'error');
          setIsProcessing(false);
          return; // Don't proceed if location is not available
        }
      } else {
        // Location not required - try to get it but don't fail if unavailable
        try {
          if (location && isValidCoordinates(location.latitude, location.longitude)) {
            locationData = location;
          } else {
            locationData = await getCurrentLocation();
          }
      } catch (error) {
        // Location is optional, so continue without it
      }
      }

      // Double-check location data before sending
      if (requiresLocationForCheckout && !locationData) {
        showNotification('Location is required for clock-out. Please enable location services and try again.', 'error');
        setIsProcessing(false);
        return;
      }

      // Ensure all numeric values are properly formatted and valid
      // Only process location if we have locationData
      if (!locationData || !locationData.latitude || !locationData.longitude) {
        if (requiresLocationForCheckout) {
          showNotification('Location is required for clock-out. Please enable location services and try again.', 'error');
          setIsProcessing(false);
          return;
        }
        // Location not required - continue without it
        locationData = null;
      }
      
      let lat, lng;
      if (locationData) {
        lat = Number(locationData.latitude);
        lng = Number(locationData.longitude);
        
        // Final validation before creating payload using helper function
        if (!isValidCoordinates(lat, lng)) {
          if (requiresLocationForCheckout) {
            showNotification('Invalid location coordinates. Please enable location services and try again.', 'error');
            setIsProcessing(false);
            return;
          }
          // Location invalid but not required - don't include it
          lat = undefined;
          lng = undefined;
        }
      }

      // Location-based validation (Kredily-style) for clock-out
      // Use the requiresLocationForCheckout already declared above
      if (requiresLocationForCheckout) {
        if (attendanceRule.coordinates && attendanceRule.coordinates.latitude && attendanceRule.coordinates.longitude) {
          const locationCheck = checkLocationWithinRadius(
            lat,
            lng,
            attendanceRule.coordinates.latitude,
            attendanceRule.coordinates.longitude,
            attendanceRule.maximumRadius || 500
          );

          if (locationCheck && !locationCheck.isWithinRadius) {
            showNotification(
              `You are ${locationCheck.distance}m away from the office. Please move within ${attendanceRule.maximumRadius || 500}m radius to check out.`,
              'error'
            );
            setIsProcessing(false);
            return;
          }
        }
      }

      const clockOutData = {
        // Include location only if we have valid coordinates
        ...(lat !== undefined && lng !== undefined && {
          latitude: lat, // Already validated as number
          longitude: lng, // Already validated as number
          address: locationData?.address || 'Location detected but address unavailable',
          accuracy: locationData?.accuracy ? Number(locationData.accuracy) : undefined
        }),
        networkType: networkData?.networkType,
        connectionSpeed: networkData?.connectionSpeed,
        imageUrl: capturedImage,
        imageFilename: capturedImage ? `clockout_${Date.now()}.jpg` : null
      };
      
      // Final check: If location is required, ensure it's included
      if (requiresLocationForCheckout && (!clockOutData.latitude || !clockOutData.longitude)) {
        showNotification('Location is required for clock-out but was not captured. Please enable location services and try again.', 'error');
        setIsProcessing(false);
        return;
      }

      await dispatch(clockOut(clockOutData)).unwrap();
      showNotification('Checked out successfully!', 'success');
      setCapturedImage(null);
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      await dispatch(fetchLogs({ startDate: todayStr, endDate: todayStr })).catch(() => {});
    } catch (err) {
      const errorData = err?.response?.data || err?.payload?.data || err?.payload;
      let errorMessage = 'Failed to check out. Please try again.';
      
      // Handle validation errors (array of errors)
      if (errorData?.errors && Array.isArray(errorData.errors)) {
        errorMessage = errorData.errors.map(e => e.message || e.msg).join(', ');
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      } else if (err?.payload?.message) {
        errorMessage = err.payload.message;
      } else if (err?.message) {
        errorMessage = err.message;
      }
      
      // Check if it's an IP mismatch error
      if (errorMessage.includes('IP address mismatch')) {
        showNotification(
          `Cannot check out: ${errorMessage}. Please use the same device/network you used for check-in.`,
          'error'
        );
      } else if (errorMessage.includes('Location is required')) {
        showNotification(
          'Location is required for clock-out. Please enable location services and try again.',
          'error'
        );
      } else {
        showNotification(errorMessage, 'error');
      }
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <FiAlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-red-800 mb-1">Error</h4>
                  <p className="text-sm text-red-700">{typeof error === 'string' ? error : error.message}</p>
                </div>
              </div>
              <button
                onClick={() => dispatch(clearError())}
                className="text-red-600 hover:text-red-800 p-2 hover:bg-red-100 rounded-lg transition-colors"
                aria-label="Dismiss error"
                title="Dismiss error"
              >
                <FiXCircle className="w-5 h-5" />
              </button>
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
          {/* Permission Status Indicators */}
          <div className="mb-6 bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Required Permissions</h3>
              <button
                onClick={() => {
                  const needed = [];
                  if (!isPermissionGranted('location')) needed.push('location');
                  if (!isPermissionGranted('camera')) needed.push('camera');
                  if (needed.length > 0) {
                    setPendingAction(null);
                    setShowPermissionDialog(true);
                  } else {
                    showNotification('All permissions are granted!', 'success');
                  }
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Request Permissions
              </button>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <PermissionStatusIndicator type="location" size="sm" />
              <PermissionStatusIndicator type="camera" size="sm" />
            </div>
          </div>

          {/* Location Status Indicator (Kredily-style) */}
          {attendanceRule && attendanceRule.locationRequired && !attendanceRule.enableSimplePunches && attendanceRule.coordinates && (
            <div className={`mb-6 rounded-xl p-4 border-2 shadow-lg ${
              isWithinRadius === true 
                ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300' 
                : isWithinRadius === false
                ? 'bg-gradient-to-r from-red-50 to-rose-50 border-red-300'
                : 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    isWithinRadius === true 
                      ? 'bg-green-100' 
                      : isWithinRadius === false
                      ? 'bg-red-100'
                      : 'bg-yellow-100'
                  }`}>
                    {isWithinRadius === true ? (
                      <FiCheckCircle className="w-6 h-6 text-green-600" />
                    ) : isWithinRadius === false ? (
                      <FiXCircle className="w-6 h-6 text-red-600" />
                    ) : (
                      <FiLoader className="w-6 h-6 text-yellow-600 animate-spin" />
                    )}
                  </div>
                  <div>
                    <h3 className={`font-bold text-lg ${
                      isWithinRadius === true 
                        ? 'text-green-800' 
                        : isWithinRadius === false
                        ? 'text-red-800'
                        : 'text-yellow-800'
                    }`}>
                      {isWithinRadius === true 
                        ? 'Within Office Radius ✓' 
                        : isWithinRadius === false
                        ? 'Outside Office Radius ✗'
                        : 'Checking Location...'}
                    </h3>
                    {distanceFromOffice !== null && (
                      <p className={`text-sm font-medium ${
                        isWithinRadius === true 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        Distance: {distanceFromOffice}m from office
                        {attendanceRule.maximumRadius && (
                          <span className="ml-2 text-gray-600">
                            (Max: {attendanceRule.maximumRadius}m)
                          </span>
                        )}
                      </p>
                    )}
                    {attendanceRule.address && (
                      <p className="text-xs text-gray-600 mt-1">
                        Office: {attendanceRule.address}
                      </p>
                    )}
                  </div>
                </div>
                {isWithinRadius === false && (
                  <div className="text-right">
                    <div className="text-2xl font-bold text-red-600">
                      {distanceFromOffice !== null ? `${distanceFromOffice}m` : '--'}
                    </div>
                    <div className="text-xs text-red-600 font-medium">Too Far</div>
                  </div>
                )}
              </div>
              {isWithinRadius === false && (
                <div className="mt-3 pt-3 border-t border-red-200">
                  <p className="text-sm text-red-700">
                    ⚠️ Please move within {attendanceRule.maximumRadius}m of the office location to check in/out.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Permission Request Dialog - Auto-show for location permission */}
          <PermissionRequestDialog
            isOpen={showPermissionDialog}
            onClose={() => {
              setShowPermissionDialog(false);
              checkAllPermissions();
            }}
            requestedPermissions={['location']}
            canClose={isPermissionDenied('location') || isPermissionGranted('location')}
            onPermissionsGranted={() => {
              showNotification('Location permission granted successfully!', 'success');
              setShowPermissionDialog(false);
              if (pendingAction) {
                pendingAction();
                setPendingAction(null);
              }
            }}
          />

          {currentSession ? (
            <div className="space-y-6">
              {/* Enhanced Status Card */}
              <div className={`bg-gradient-to-br rounded-3xl p-6 shadow-lg border ${
                currentSession.clockOut 
                  ? 'from-blue-50 via-indigo-50 to-purple-50 border-blue-200' 
                  : 'from-emerald-50 via-green-50 to-teal-50 border-emerald-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${
                      currentSession.clockOut 
                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600' 
                        : 'bg-gradient-to-br from-emerald-500 to-green-600'
                    }`}>
                      <FiCheckCircle className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className={`text-2xl font-bold mb-1 ${
                        currentSession.clockOut ? 'text-blue-800' : 'text-emerald-800'
                      }`}>
                        {currentSession.clockOut ? 'Checked Out' : 'Checked In'}
                      </h3>
                      <p className={`text-sm font-medium ${
                        currentSession.clockOut ? 'text-blue-600' : 'text-emerald-600'
                      }`}>
                        {currentSession.clockOut 
                          ? `Check-Out: ${formatTime(currentSession.clockOut)}` 
                          : `Since ${formatTime(currentSession.clockIn)}`}
                      </p>
                      {isOnBreak && !currentSession.clockOut && (
                        <div className="flex items-center gap-2 mt-2 text-amber-600 bg-amber-100 px-3 py-1 rounded-full">
                          <FiCoffee className="w-4 h-4" />
                          <span className="text-sm font-medium">On break since {formatTime(breakSession.breakIn)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-bold font-mono mb-1 ${
                      currentSession.clockOut ? 'text-blue-600' : 'text-emerald-600'
                    }`}>
                      {formatElapsedTime(elapsedTime)}
                    </div>
                    <div className={`text-sm font-medium ${
                      currentSession.clockOut ? 'text-blue-600' : 'text-emerald-600'
                    }`}>
                      {currentSession.clockOut 
                        ? 'Total work duration' 
                        : `${formatHours(elapsedTime)} hours worked`}
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

              {/* Checked Out Status */}
              {currentSession.clockOut ? (
                <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-3xl p-8 border border-blue-200 shadow-xl">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <FiCheckCircle className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Checked Out</h3>
                    <p className="text-gray-600 text-sm mb-4">Check-Out Time: {formatTime(currentSession.clockOut)}</p>
                    <div className="bg-white rounded-2xl p-4 shadow-md">
                      <div className="text-2xl font-bold text-emerald-600 font-mono mb-1">
                        {formatElapsedTime(elapsedTime)}
                      </div>
                      <div className="text-sm text-gray-600 font-medium">
                        Total Work Duration
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Enhanced Clock Out Section */
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
                      disabled={loading || isOnBreak || isProcessing || (attendanceRule?.locationRequired && isWithinRadius === false)}
                      className={`flex-1 py-4 px-6 rounded-2xl text-white font-bold flex items-center justify-center gap-3 text-lg shadow-lg transition-all duration-200 ${
                        loading || isOnBreak || isProcessing || (attendanceRule?.locationRequired && isWithinRadius === false)
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 hover:shadow-xl transform hover:scale-105'
                      }`}
                      title={attendanceRule?.locationRequired && isWithinRadius === false 
                        ? `You are ${distanceFromOffice}m away. Please move within ${attendanceRule.maximumRadius}m to check out.`
                        : 'Check Out'}
                    >
                      {loading || isProcessing ? (
                        <>
                          <FiLoader className="animate-spin w-5 h-5" />
                          Processing...
                        </>
                      ) : attendanceRule?.locationRequired && isWithinRadius === false ? (
                        <>
                          <FiXCircle className="w-5 h-5" />
                          Outside Radius
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
              )}
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
                disabled={loading || isProcessing || (attendanceRule?.locationRequired && isWithinRadius === false)}
                className={`w-full max-w-md py-5 px-8 rounded-2xl text-white font-bold text-xl shadow-xl transition-all duration-200 ${
                  loading || isProcessing || (attendanceRule?.locationRequired && isWithinRadius === false)
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 hover:shadow-2xl transform hover:scale-105'
                }`}
                title={attendanceRule?.locationRequired && isWithinRadius === false 
                  ? `You are ${distanceFromOffice}m away. Please move within ${attendanceRule.maximumRadius}m to check in.`
                  : 'Check In'}
              >
                {loading || isProcessing ? (
                  <div className="flex items-center justify-center">
                    <FiLoader className="animate-spin w-6 h-6 mr-3" />
                    Processing...
                  </div>
                ) : attendanceRule?.locationRequired && isWithinRadius === false ? (
                  <div className="flex items-center justify-center">
                    <FiXCircle className="w-6 h-6 mr-3" />
                    Outside Radius
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
