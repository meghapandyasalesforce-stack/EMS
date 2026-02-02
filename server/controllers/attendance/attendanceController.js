import Attendance from "../../models/attendance.model.js";
import Employee from "../../models/employee.model.js"
import AttendanceRule from "../../models/attendanceRule.model.js";
import User from "../../models/user.model.js";
import mongoose from 'mongoose';
import logger from "../../helpers/logger.js";
import { sendBreakNotification, sendNotificationToUsers } from "../../helpers/notificationService.js";
import { addOrganizationFilter, getOrganizationId } from "../../helpers/organizationHelper.js";
import { buildManagerMatchQuery, getManagerEmployeeIds, isEmployeeLinkedToManager } from "../../helpers/managerHelper.js";
import { reverseGeocode, isGeocodingAvailable } from "../../helpers/geocodingService.js";


const OFFICE_START_TIME = 9;  // 9 AM
const OFFICE_END_TIME = 17;   // 5 PM (24-hour format)

// Helper function to detect device type from user agent
const detectDeviceType = (userAgent) => {
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    return 'mobile';
  }
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    return 'tablet';
  }
  return 'desktop';
};

// Helper function to get real IP address (handles proxies)
const getClientIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.ip ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
};

function calculateWorkingDays(startDate, endDate) {
  let count = 0;
  const current = new Date(startDate);
  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++; // Skip weekends
    current.setDate(current.getDate() + 1);
  }
  return count;
}


// Enhanced Clock In with image capture, geolocation, and network tracking
export const clockIn = async (req, res) => {
  // Log incoming request for debugging
  logger.debug('Clock-in request received', {
    hasEmployee: !!req.employee,
    employeeId: req.employee?._id,
    body: {
      workLocation: req.body.workLocation,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      latitudeType: typeof req.body.latitude,
      longitudeType: typeof req.body.longitude,
      hasLatitude: !!req.body.latitude,
      hasLongitude: !!req.body.longitude,
      hasImage: !!req.body.imageUrl,
      hasAddress: !!req.body.address,
      networkType: req.body.networkType,
      deviceType: req.body.deviceType
    }
  });

  try {
    // Validate employee authentication
    if (!req.employee || !req.employee._id) {
      logger.error('Clock-in error: Missing employee authentication', {
        hasEmployee: !!req.employee,
        hasUser: !!req.user,
        path: req.path
      });
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in again.',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    const userId = req.employee._id;
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);

    // Get organizationId from request
    const organizationId = getOrganizationId(req);
    
    if (!organizationId) {
      logger.error('Clock-in error: Missing organizationId', {
        userId,
        hasEmployee: !!req.employee,
        hasUser: !!req.user
      });
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required',
        code: 'MISSING_ORGANIZATION_ID'
      });
    }
    
    // Load active attendance rule for this organization (if any)
    const activeRule = await AttendanceRule.findOne({ 
      isActive: true,
      organizationId 
    }).lean();
    
    logger.debug('Clock-in attempt', {
      userId,
      organizationId,
      hasActiveRule: !!activeRule,
      enableSimplePunches: activeRule?.enableSimplePunches,
      hasLocation: !!(req.body.latitude && req.body.longitude)
    });

    // Helper: distance in meters between two lat/lng points (Haversine)
    const distanceInMeters = (lat1, lon1, lat2, lon2) => {
      const toRad = (v) => (v * Math.PI) / 180;
      const R = 6371000; // meters
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const existing = await Attendance.findOne({ 
      userId, 
      date: startOfDay,
      organizationId 
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Already clocked in for today",
        code: 'ALREADY_CLOCKED_IN',
        session: existing
      });
    }

    const clockInTime = new Date();
    
    // Get office start time from rule or use default
    let officeStartTime = new Date(startOfDay);
    if (activeRule?.officeHours?.startTime) {
      // Parse time string (HH:mm format)
      const [hours, minutes] = activeRule.officeHours.startTime.split(':').map(Number);
      officeStartTime.setHours(hours || OFFICE_START_TIME, minutes || 0, 0, 0);
    } else if (activeRule?.checkInOutTimes?.checkInStartTime) {
      // Use check-in start time if available
      const [hours, minutes] = activeRule.checkInOutTimes.checkInStartTime.split(':').map(Number);
      officeStartTime.setHours(hours || OFFICE_START_TIME, minutes || 0, 0, 0);
    } else {
      // Fallback to default
      officeStartTime.setHours(OFFICE_START_TIME, 0, 0, 0);
    }

    // Validate check-in time window if configured (warning only, don't block)
    let checkInWindowWarning = null;
    if (activeRule?.checkInOutTimes?.checkInStartTime && activeRule?.checkInOutTimes?.checkInEndTime) {
      const [startHour, startMin] = activeRule.checkInOutTimes.checkInStartTime.split(':').map(Number);
      const [endHour, endMin] = activeRule.checkInOutTimes.checkInEndTime.split(':').map(Number);
      
      const checkInWindowStart = new Date(startOfDay);
      checkInWindowStart.setHours(startHour, startMin, 0, 0);
      
      const checkInWindowEnd = new Date(startOfDay);
      checkInWindowEnd.setHours(endHour, endMin, 0, 0);
      
      // Check if current time is within check-in window
      if (clockInTime < checkInWindowStart) {
        checkInWindowWarning = `Check-in is recommended between ${activeRule.checkInOutTimes.checkInStartTime} and ${activeRule.checkInOutTimes.checkInEndTime}. You are checking in early.`;
        logger.info('Early check-in (before window)', {
          userId,
          checkInTime: clockInTime.toLocaleTimeString(),
          windowStart: activeRule.checkInOutTimes.checkInStartTime
        });
      } else if (clockInTime > checkInWindowEnd) {
        checkInWindowWarning = `Check-in window ended at ${activeRule.checkInOutTimes.checkInEndTime}. Late check-in will be recorded.`;
        logger.warn('Check-in after allowed window', {
          userId,
          checkInTime: clockInTime.toLocaleTimeString(),
          windowEnd: activeRule.checkInOutTimes.checkInEndTime
        });
      }
    }

    // Apply grace period for late arrival if rule enabled
    let effectiveStartTime = new Date(officeStartTime);
    if (activeRule?.enablePenaltyRules && activeRule?.penaltyRules?.lateArrival?.enabled) {
      // Use grace period from penalty rules or checkInOutTimes
      const graceMinutes = Number(
        activeRule.penaltyRules.lateArrival.gracePeriod || 
        activeRule.checkInOutTimes?.checkInGracePeriod || 
        0
      );
      effectiveStartTime = new Date(officeStartTime.getTime() + graceMinutes * 60 * 1000);
    } else if (activeRule?.checkInOutTimes?.checkInGracePeriod) {
      // Apply grace period even if penalty rules are disabled
      const graceMinutes = Number(activeRule.checkInOutTimes.checkInGracePeriod || 0);
      effectiveStartTime = new Date(officeStartTime.getTime() + graceMinutes * 60 * 1000);
    }
    
    const isLateArrival = clockInTime > effectiveStartTime;

    // Get real IP address
    const clientIP = getClientIP(req);
    const userAgent = req.get('User-Agent') || '';
    const deviceType = detectDeviceType(userAgent);

    // Extract network information
    const networkInfo = {
      ipAddress: clientIP,
      userAgent: userAgent,
      networkType: req.body.networkType || 'unknown',
      connectionSpeed: req.body.connectionSpeed || 'unknown',
      deviceType: req.body.deviceType || deviceType // Use client-provided or detected
    };

    // Extract geolocation information and normalize to numbers
    // Values may come as strings from JSON parsing, so we need to convert them
    // Handle null, undefined, empty string, and string "null" cases
    const normalizeCoordinate = (value) => {
      if (value == null || value === '' || value === 'null' || value === 'undefined') {
        return undefined;
      }
      const num = Number(value);
      // Check if conversion resulted in NaN
      if (isNaN(num)) {
        return undefined;
      }
      // Note: We allow 0 as a valid coordinate (though unlikely for real locations)
      // The validation will check coordinate ranges separately
      return num;
    };

    const locationInfo = {
      latitude: normalizeCoordinate(req.body.latitude),
      longitude: normalizeCoordinate(req.body.longitude),
      address: req.body.address,
      accuracy: req.body.accuracy != null ? Number(req.body.accuracy) : undefined,
      locationMatch: false,
      locationDistance: null
    };

    // Log location data for debugging
    logger.debug('Location data received', {
      hasLatitude: typeof locationInfo.latitude === 'number',
      hasLongitude: typeof locationInfo.longitude === 'number',
      latitude: locationInfo.latitude,
      longitude: locationInfo.longitude,
      latitudeType: typeof locationInfo.latitude,
      longitudeType: typeof locationInfo.longitude,
      originalLatitude: req.body.latitude,
      originalLongitude: req.body.longitude,
      originalLatitudeType: typeof req.body.latitude,
      originalLongitudeType: typeof req.body.longitude,
      bodyKeys: Object.keys(req.body)
    });

    // Reverse geocode coordinates to get address if address is missing and geocoding is available
    if (typeof locationInfo.latitude === 'number' && 
        typeof locationInfo.longitude === 'number' && 
        (!locationInfo.address || locationInfo.address === 'Unknown location' || locationInfo.address === 'Location detected but address unavailable')) {
      
      if (isGeocodingAvailable()) {
        try {
          const reverseGeocodeResult = await reverseGeocode(locationInfo.latitude, locationInfo.longitude);
          if (reverseGeocodeResult.formattedAddress) {
            locationInfo.address = reverseGeocodeResult.formattedAddress;
            logger.info('Reverse geocoded address for clock-in', {
              coordinates: { lat: locationInfo.latitude, lng: locationInfo.longitude },
              address: locationInfo.address
            });
          }
        } catch (reverseGeocodeError) {
          logger.warn('Reverse geocoding failed for clock-in', {
            error: reverseGeocodeError.message,
            coordinates: { lat: locationInfo.latitude, lng: locationInfo.longitude }
          });
          // Continue with provided address or default message
          if (!locationInfo.address) {
            locationInfo.address = 'Location detected but address unavailable';
          }
        }
      }
    }

    let locationMatch = false;
    let locationDistance = null;

    // Enforce geofence if rule present and simple punches disabled
    if (activeRule && !activeRule.enableSimplePunches) {
      const empDept = req.employee?.department;
      const appliesToDept = !activeRule.applicableDepartments?.length ||
        (empDept && activeRule.applicableDepartments.includes(empDept));

      if (appliesToDept) {
        // Validate location after normalization
        // Check if location is missing or invalid
        // Note: (0,0) coordinates are technically valid but unlikely for real locations
        const hasValidLatitude = typeof locationInfo.latitude === 'number' && 
                                  !isNaN(locationInfo.latitude) && 
                                  locationInfo.latitude !== null && 
                                  locationInfo.latitude !== undefined &&
                                  locationInfo.latitude >= -90 && 
                                  locationInfo.latitude <= 90;
        
        const hasValidLongitude = typeof locationInfo.longitude === 'number' && 
                                   !isNaN(locationInfo.longitude) && 
                                   locationInfo.longitude !== null && 
                                   locationInfo.longitude !== undefined &&
                                   locationInfo.longitude >= -180 && 
                                   locationInfo.longitude <= 180;

        // Reject if both are 0 (invalid location) or if either is invalid
        const bothZero = locationInfo.latitude === 0 && locationInfo.longitude === 0;

        if (!hasValidLatitude || !hasValidLongitude || bothZero) {
          logger.warn('Clock-in location validation failed', {
            userId,
            organizationId,
            latitude: locationInfo.latitude,
            longitude: locationInfo.longitude,
            latitudeType: typeof locationInfo.latitude,
            longitudeType: typeof locationInfo.longitude,
            hasValidLatitude,
            hasValidLongitude,
            bothZero,
            originalLatitude: req.body.latitude,
            originalLongitude: req.body.longitude,
            originalLatitudeType: typeof req.body.latitude,
            originalLongitudeType: typeof req.body.longitude,
            bodyKeys: Object.keys(req.body),
            enableSimplePunches: activeRule.enableSimplePunches,
            ruleHasCoordinates: !!(activeRule.coordinates?.latitude && activeRule.coordinates?.longitude)
          });
          
          // Provide more helpful error message
          let errorMessage = 'Location is required to clock in at this site. ';
          if (!req.body.latitude && !req.body.longitude) {
            errorMessage += 'Location data was not provided. Please enable location services and try again.';
          } else if (bothZero) {
            errorMessage += 'Invalid location coordinates (0,0) received. Please ensure GPS is enabled and try again.';
          } else {
            errorMessage += 'Invalid location coordinates received. Please enable location services and try again.';
          }
          
          return res.status(400).json({
            success: false,
            message: errorMessage,
            code: 'LOCATION_REQUIRED',
            details: {
              received: {
                latitude: req.body.latitude,
                longitude: req.body.longitude,
                latitudeType: typeof req.body.latitude,
                longitudeType: typeof req.body.longitude
              },
              normalized: {
                latitude: locationInfo.latitude,
                longitude: locationInfo.longitude
              },
              validation: {
                hasValidLatitude,
                hasValidLongitude,
                bothZero
              },
              requestBodyKeys: Object.keys(req.body)
            }
          });
        }
        locationDistance = distanceInMeters(
          locationInfo.latitude,
          locationInfo.longitude,
          activeRule.coordinates.latitude,
          activeRule.coordinates.longitude
        );
        if (locationDistance > (activeRule.maximumRadius || 500)) {
          logger.warn('Clock-in outside radius', {
            userId,
            organizationId,
            distance: Math.round(locationDistance),
            maximumRadius: activeRule.maximumRadius,
            userLocation: { lat: locationInfo.latitude, lng: locationInfo.longitude },
            officeLocation: activeRule.coordinates
          });
          return res.status(400).json({
            success: false,
            message: `You are outside the allowed check-in radius. Distance: ${Math.round(locationDistance)}m, Maximum allowed: ${activeRule.maximumRadius}m. Please move closer to the office location.`,
            code: 'OUTSIDE_RADIUS',
            distance: Math.round(locationDistance),
            maximumRadius: activeRule.maximumRadius,
            details: {
              yourLocation: {
                latitude: locationInfo.latitude,
                longitude: locationInfo.longitude
              },
              officeLocation: activeRule.coordinates
            }
          });
        }
        locationMatch = true;
        locationInfo.locationMatch = true;
        locationInfo.locationDistance = locationDistance;
      }
    } else if (activeRule && activeRule.enableSimplePunches) {
      // Even with simple punches, check if location matches (for admin info)
      if (typeof locationInfo.latitude === 'number' && typeof locationInfo.longitude === 'number') {
        locationDistance = distanceInMeters(
          locationInfo.latitude,
          locationInfo.longitude,
          activeRule.coordinates.latitude,
          activeRule.coordinates.longitude
        );
        locationMatch = locationDistance <= (activeRule.maximumRadius || 500);
        locationInfo.locationMatch = locationMatch;
        locationInfo.locationDistance = locationDistance;
      }
    } else if (!activeRule && typeof locationInfo.latitude === 'number' && typeof locationInfo.longitude === 'number') {
      // If no rule is configured but location is provided, mark as verified
      locationMatch = true;
      locationInfo.locationMatch = true;
    }

    // Handle image upload
    const imageInfo = {
      url: req.body.imageUrl,
      filename: req.body.imageFilename
    };

    const attendance = await Attendance.create({
      organizationId, // Add organizationId
      userId,
      date: startOfDay,
      clockIn: clockInTime,
      breaks: [],
      status: "present",
      isLateArrival,
      isOnTime: !isLateArrival,
      // Normalize workLocation: accept 'home' as 'work_from_home' for backward compatibility
      workLocation: req.body.workLocation === 'home' ? 'work_from_home' : (req.body.workLocation || "office"),
      clockInImage: imageInfo,
      clockInLocation: locationInfo,
      clockInNetwork: networkInfo
    });

    // Send notification to admins about check-in
    try {
      const employee = await Employee.findById(userId).select('name lastName email department position organizationId');
      const admins = await User.find({ role: 'admin', organizationId }).select('_id');
      
      if (admins.length > 0 && employee) {
        const locationStatus = locationMatch 
          ? `✅ At office location (${Math.round(locationDistance || 0)}m away)` 
          : activeRule ? '⚠️ Location not verified' : '📍 Location not required';
        
        const deviceEmoji = networkInfo.deviceType === 'mobile' ? '📱' : 
                           networkInfo.deviceType === 'tablet' ? '📱' : '💻';
        
        const message = `${deviceEmoji} ${employee.name} ${employee.lastName || ''} checked in from ${networkInfo.deviceType} device. ${locationStatus}`;
        
        const adminIds = admins.map(admin => admin._id);
        await sendNotificationToUsers(
          adminIds,
          employee,
          message,
          'system',
          {
            organizationId: organizationId, // Add organizationId to metadata as fallback
            employeeId: employee._id,
            employeeName: `${employee.name} ${employee.lastName || ''}`,
            deviceType: networkInfo.deviceType,
            locationMatch: locationMatch,
            locationDistance: locationDistance,
            checkInTime: clockInTime,
            attendanceId: attendance._id
          }
        );
      }
    } catch (notifError) {
      logger.error('Error sending check-in notification to admins', { error: notifError.message });
      // Don't fail the check-in if notification fails
    }

    // Return attendance object directly with additional metadata
    const attendanceObj = attendance.toObject ? attendance.toObject() : attendance;
    res.status(201).json({
      ...attendanceObj,
      success: true,
      message: checkInWindowWarning 
        ? `Checked in successfully. ${checkInWindowWarning}` 
        : isLateArrival 
          ? 'Checked in (late arrival noted)' 
          : 'Checked in successfully',
      ...(checkInWindowWarning && { warning: checkInWindowWarning })
    });
  } catch (error) {
    // Enhanced error logging
    logger.error('Clock-in error', {
      error: error.message,
      stack: error.stack,
      userId: userId || req.employee?._id || 'unknown',
      organizationId: organizationId || 'unknown',
      body: {
        ...req.body,
        imageUrl: req.body.imageUrl ? '[Image data present]' : undefined
      },
      hasEmployee: !!req.employee,
      errorName: error.name,
      errorCode: error.code
    });
    
    // If it's a validation error from express-validator, return 400
    if (error.name === 'ValidationError' || error.statusCode === 400) {
      return res.status(400).json({ 
        success: false,
        message: error.message || 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors || error.details
      });
    }
    
    // Handle mongoose validation errors
    if (error.name === 'ValidationError' && error.errors) {
      const mongooseErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: mongooseErrors
      });
    }
    
    // Default error response
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ 
      success: false,
      message: statusCode === 500 
        ? 'An error occurred while processing your clock-in request. Please try again.' 
        : (error.message || 'Failed to clock in'),
      code: statusCode === 500 ? 'SERVER_ERROR' : 'CLOCK_IN_ERROR',
      ...(process.env.NODE_ENV === 'development' && { 
        details: error.message,
        stack: error.stack 
      })
    });
  }
};

export const breakIn = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const organizationId = getOrganizationId(req);
    const attendance = await Attendance.findOne({ 
      userId: req.employee._id, 
      date: startOfDay,
      organizationId 
    });

    if (!attendance) {
      return res.status(404).json({ message: "Clock-in required" });
    }
    
    // Check for active (orphaned) breaks and auto-close old ones
    const activeBreaks = attendance.breaks?.filter(b => b.breakIn && !b.breakOut) || [];
    const MAX_BREAK_DURATION_HOURS = 0.5; // Auto-close breaks older than 30 minutes (default)
    const now = new Date();
    
    let cleanedBreaks = false;
    for (const breakEntry of activeBreaks) {
      const breakStartTime = new Date(breakEntry.breakIn);
      const breakDuration = (now - breakStartTime) / (1000 * 60 * 60); // in hours
      
      // Auto-close breaks longer than 30 minutes (likely abandoned/orphaned)
      if (breakDuration > MAX_BREAK_DURATION_HOURS) {
        breakEntry.breakOut = now;
        const breakDurationMs = now - breakStartTime;
        attendance.totalBreakDuration = (attendance.totalBreakDuration || 0) + breakDurationMs;
        cleanedBreaks = true;
        logger.info(`Auto-closed orphaned break (duration: ${breakDuration.toFixed(2)} hours)`);
      }
    }
    
    // Update status if we cleaned up all active breaks
    if (cleanedBreaks) {
      const remainingActiveBreaks = attendance.breaks.filter(b => b.breakIn && !b.breakOut);
      if (remainingActiveBreaks.length === 0) {
        attendance.status = "present";
      }
      await attendance.save();
    }
    
    // Check again for any remaining active breaks after cleanup
    const remainingActiveBreaksCount = attendance.breaks?.filter(b => b.breakIn && !b.breakOut).length || 0;
    
    if (remainingActiveBreaksCount > 0) {
      return res.status(400).json({ message: "Already on break. Please end your current break first." });
    }

    // Check break limit (maximum 4 breaks per day)
    const MAX_BREAKS = 4;
    const completedBreaksCount = attendance.breaks?.filter(b => b.breakIn && b.breakOut).length || 0;
    
    if (completedBreaksCount >= MAX_BREAKS) {
      return res.status(400).json({ 
        message: `Maximum ${MAX_BREAKS} breaks allowed per day`,
        breaksUsed: completedBreaksCount,
        maxBreaks: MAX_BREAKS
      });
    }

    // Add new break
    attendance.breaks.push({ breakIn: new Date() });
    attendance.status = "onBreak";

    await attendance.save();
    
    // Get employee details and send notification to admins
    try {
      const employee = await Employee.findById(req.employee._id).select('name lastName email organizationId');
      if (employee) {
        await sendBreakNotification(employee);
      }
    } catch (notifError) {
      logger.error('Error sending break notification', { error: notifError.message });
      // Don't fail the break request if notification fails
    }
    
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const breakOut = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const organizationId = getOrganizationId(req);
    const attendance = await Attendance.findOne({ 
      userId: req.employee._id, 
      date: startOfDay,
      organizationId 
    });

    if (!attendance) {
      return res.status(404).json({ message: "No attendance record found" });
    }

    // Find the active break by examining the breaks array (more reliable than status field)
    const activeBreakIndex = attendance.breaks?.findIndex(b => b.breakIn && !b.breakOut);
    
    if (activeBreakIndex === -1 || activeBreakIndex === undefined) {
      return res.status(400).json({ message: "No active break found" });
    }

    const currentBreak = attendance.breaks[activeBreakIndex];
    currentBreak.breakOut = new Date();

    const breakDuration = new Date(currentBreak.breakOut) - new Date(currentBreak.breakIn);
    attendance.totalBreakDuration = (attendance.totalBreakDuration || 0) + breakDuration;
    
    // Only set status back to "present" if there are no other active breaks
    const hasActiveBreak = attendance.breaks.some(b => b.breakIn && !b.breakOut);
    if (!hasActiveBreak) {
      attendance.status = "present";
    }

    await attendance.save();
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Enhanced Clock Out with image capture, geolocation, and network tracking
export const clockOut = async (req, res) => {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  try {
    // Get organizationId first
    const organizationId = getOrganizationId(req);
    
    // Load active rule for this organization (if any)
    const activeRule = await AttendanceRule.findOne({ 
      isActive: true,
      organizationId 
    }).lean();
    
    const attendance = await Attendance.findOne({ 
      userId: req.employee._id, 
      date: startOfDay,
      organizationId 
    });

    if (!attendance || attendance.clockOut) {
      return res.status(400).json({ message: "Already clocked out or no clock-in record" });
    }

    // Check if user is on break by examining the breaks array (more reliable than status field)
    const hasActiveBreak = attendance.breaks?.some(b => b.breakIn && !b.breakOut) || false;
    if (hasActiveBreak) {
      return res.status(400).json({ message: "Please end your break before clocking out" });
    }

    // Get real IP address for check-out (for logging only, not for validation)
    const clientIP = getClientIP(req);

    // Helper: distance in meters between two lat/lng points (Haversine)
    const distanceInMeters = (lat1, lon1, lat2, lon2) => {
      const toRad = (v) => (v * Math.PI) / 180;
      const R = 6371000; // meters
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    // Extract geolocation information for clock out and normalize to numbers
    // Values may come as strings from JSON parsing, so we need to convert them
    // Handle null, undefined, empty string, and string "null" cases
    const normalizeCoordinate = (value) => {
      if (value == null || value === '' || value === 'null' || value === 'undefined') {
        return undefined;
      }
      const num = Number(value);
      // Check if conversion resulted in NaN
      if (isNaN(num)) {
        return undefined;
      }
      // Note: We allow 0 as a valid coordinate (though unlikely for real locations)
      // The validation will check coordinate ranges separately
      return num;
    };

    const locationInfo = {
      latitude: normalizeCoordinate(req.body.latitude),
      longitude: normalizeCoordinate(req.body.longitude),
      address: req.body.address,
      accuracy: req.body.accuracy != null ? Number(req.body.accuracy) : undefined,
      locationMatch: false,
      locationDistance: null
    };

    // Log location data for debugging
    logger.debug('Location data received for clock-out', {
      hasLatitude: typeof locationInfo.latitude === 'number',
      hasLongitude: typeof locationInfo.longitude === 'number',
      latitude: locationInfo.latitude,
      longitude: locationInfo.longitude,
      latitudeType: typeof locationInfo.latitude,
      longitudeType: typeof locationInfo.longitude,
      originalLatitude: req.body.latitude,
      originalLongitude: req.body.longitude,
      originalLatitudeType: typeof req.body.latitude,
      originalLongitudeType: typeof req.body.longitude,
      bodyKeys: Object.keys(req.body)
    });

    // Reverse geocode coordinates to get address if address is missing and geocoding is available
    if (typeof locationInfo.latitude === 'number' && 
        typeof locationInfo.longitude === 'number' && 
        (!locationInfo.address || locationInfo.address === 'Unknown location' || locationInfo.address === 'Location detected but address unavailable')) {
      
      if (isGeocodingAvailable()) {
        try {
          const reverseGeocodeResult = await reverseGeocode(locationInfo.latitude, locationInfo.longitude);
          if (reverseGeocodeResult.formattedAddress) {
            locationInfo.address = reverseGeocodeResult.formattedAddress;
            logger.info('Reverse geocoded address for clock-out', {
              coordinates: { lat: locationInfo.latitude, lng: locationInfo.longitude },
              address: locationInfo.address
            });
          }
        } catch (reverseGeocodeError) {
          logger.warn('Reverse geocoding failed for clock-out', {
            error: reverseGeocodeError.message,
            coordinates: { lat: locationInfo.latitude, lng: locationInfo.longitude }
          });
          // Continue with provided address or default message
          if (!locationInfo.address) {
            locationInfo.address = 'Location detected but address unavailable';
          }
        }
      }
    }

    // Validate location matches check-in location (location-based validation)
    const checkInLocation = attendance.clockInLocation;
    if (checkInLocation && 
        typeof checkInLocation.latitude === 'number' && 
        typeof checkInLocation.longitude === 'number' &&
        typeof locationInfo.latitude === 'number' && 
        typeof locationInfo.longitude === 'number') {
      
      const distanceFromCheckIn = distanceInMeters(
        checkInLocation.latitude,
        checkInLocation.longitude,
        locationInfo.latitude,
        locationInfo.longitude
      );

      // Allow reasonable distance (100 meters) - adjust as needed
      // This allows for GPS accuracy variations and small movements
      const maxAllowedDistance = 100; // meters
      
      if (distanceFromCheckIn > maxAllowedDistance) {
        return res.status(400).json({ 
          success: false,
          message: `Location mismatch. You checked in from a different location. Check-out location is ${Math.round(distanceFromCheckIn)}m away from check-in location. Maximum allowed distance: ${maxAllowedDistance}m. Please check out from the same location where you checked in.`,
          code: 'LOCATION_MISMATCH',
          checkInLocation: {
            latitude: checkInLocation.latitude,
            longitude: checkInLocation.longitude,
            address: checkInLocation.address
          },
          checkOutLocation: {
            latitude: locationInfo.latitude,
            longitude: locationInfo.longitude,
            address: locationInfo.address
          },
          distance: Math.round(distanceFromCheckIn),
          maxAllowedDistance: maxAllowedDistance
        });
      }
      
      logger.debug('Check-out location validated against check-in location', {
        distanceFromCheckIn: Math.round(distanceFromCheckIn),
        maxAllowedDistance: maxAllowedDistance,
        checkInLocation: { lat: checkInLocation.latitude, lng: checkInLocation.longitude },
        checkOutLocation: { lat: locationInfo.latitude, lng: locationInfo.longitude }
      });
    }

    // Enforce geofence if rule present and simple punches disabled
    if (activeRule && !activeRule.enableSimplePunches) {
      const empDept = req.employee?.department;
      const appliesToDept = !activeRule.applicableDepartments?.length ||
        (empDept && activeRule.applicableDepartments.includes(empDept));

      if (appliesToDept) {
        // Validate location after normalization
        // Check if location is missing or invalid
        // Validate location after normalization
        // Check if location is missing or invalid
        // Note: (0,0) coordinates are technically valid but unlikely for real locations
        const hasValidLatitude = typeof locationInfo.latitude === 'number' && 
                                  !isNaN(locationInfo.latitude) && 
                                  locationInfo.latitude !== null && 
                                  locationInfo.latitude !== undefined &&
                                  locationInfo.latitude >= -90 && 
                                  locationInfo.latitude <= 90;
        
        const hasValidLongitude = typeof locationInfo.longitude === 'number' && 
                                   !isNaN(locationInfo.longitude) && 
                                   locationInfo.longitude !== null && 
                                   locationInfo.longitude !== undefined &&
                                   locationInfo.longitude >= -180 && 
                                   locationInfo.longitude <= 180;

        // Reject if both are 0 (invalid location) or if either is invalid
        const bothZero = locationInfo.latitude === 0 && locationInfo.longitude === 0;

        if (!hasValidLatitude || !hasValidLongitude || bothZero) {
          logger.warn('Clock-out location validation failed', {
            latitude: locationInfo.latitude,
            longitude: locationInfo.longitude,
            latitudeType: typeof locationInfo.latitude,
            longitudeType: typeof locationInfo.longitude,
            hasValidLatitude,
            hasValidLongitude,
            bothZero,
            originalLatitude: req.body.latitude,
            originalLongitude: req.body.longitude,
            originalLatitudeType: typeof req.body.latitude,
            originalLongitudeType: typeof req.body.longitude,
            bodyKeys: Object.keys(req.body)
          });
          return res.status(400).json({
            success: false,
            message: 'Location is required to clock out at this site. Please enable location services and try again.',
            code: 'LOCATION_REQUIRED',
            details: {
              received: {
                latitude: req.body.latitude,
                longitude: req.body.longitude,
                latitudeType: typeof req.body.latitude,
                longitudeType: typeof req.body.longitude
              },
              normalized: {
                latitude: locationInfo.latitude,
                longitude: locationInfo.longitude
              },
              validation: {
                hasValidLatitude,
                hasValidLongitude,
                bothZero
              }
            }
          });
        }
        const dist = distanceInMeters(
          locationInfo.latitude,
          locationInfo.longitude,
          activeRule.coordinates.latitude,
          activeRule.coordinates.longitude
        );
        if (dist > (activeRule.maximumRadius || 500)) {
          return res.status(400).json({
            success: false,
            message: `You are outside the allowed check-out radius. Distance: ${Math.round(dist)}m, Maximum allowed: ${activeRule.maximumRadius}m. Please move closer to the office location.`,
            code: 'OUTSIDE_RADIUS',
            distance: Math.round(dist),
            maximumRadius: activeRule.maximumRadius
          });
        }
      }
    }

    const now = new Date();
    attendance.clockOut = now;
    attendance.status = "loggedOut";

    // Extract network information for clock out
    const networkInfo = {
      ipAddress: clientIP,
      userAgent: req.get('User-Agent'),
      networkType: req.body.networkType || 'unknown',
      connectionSpeed: req.body.connectionSpeed || 'unknown'
    };

    // Handle image upload for clock out
    const imageInfo = {
      url: req.body.imageUrl,
      filename: req.body.imageFilename
    };

    // Update attendance with clock out data
    attendance.clockOutImage = imageInfo;
    attendance.clockOutLocation = locationInfo;
    attendance.clockOutNetwork = networkInfo;

    // Calculate work duration
    const grossHours = now - attendance.clockIn;
    const effectiveHours = grossHours - (attendance.totalBreakDuration || 0);

    attendance.grossHours = grossHours / (1000 * 60 * 60); // convert ms to hours
    attendance.effectiveHours = effectiveHours / (1000 * 60 * 60);

    // Check for early departure
    const officeEndTime = new Date(startOfDay);
    officeEndTime.setHours(OFFICE_END_TIME, 0, 0, 0);
    let effectiveEndTime = new Date(officeEndTime);
    if (activeRule?.enablePenaltyRules && activeRule?.penaltyRules?.earlyDeparture?.enabled) {
      const graceMinutes = Number(activeRule.penaltyRules.earlyDeparture.gracePeriod || 0);
      // Allow leaving up to grace minutes early without flagging
      effectiveEndTime = new Date(officeEndTime.getTime() - graceMinutes * 60 * 1000);
    }
    attendance.isEarlyDeparture = now < effectiveEndTime;

    // Calculate overtime (anything over 8 effective hours)
    if (attendance.effectiveHours > 8) {
      attendance.overtimeHours = parseFloat((attendance.effectiveHours - 8).toFixed(2));
    }

    // Determine half-day status
    if (attendance.effectiveHours < 4) {
      attendance.status = "half-day";
    }

    await attendance.save();

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getLogs = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const { startDate, endDate } = req.query;
    const userId = req.employee._id;
    const query = addOrganizationFilter(req, { userId });

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const logs = await Attendance.find(query).sort({ date: -1 });

    const dailyStats = {};
    const sessions = [];
    let totalLateArrivals = 0;
    let totalEarlyDepartures = 0;

    logs.forEach(log => {
      sessions.push(log);

      const dateKey = log.date.toISOString().split("T")[0];

      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = {
          effectiveHours: 0,
          grossHours: 0,
          overtimeHours: 0,
          isLateArrival: false,
          isEarlyDeparture: false,
          status: "present"
        };
      }

      dailyStats[dateKey].effectiveHours += log.effectiveHours || 0;
      dailyStats[dateKey].grossHours += log.grossHours || 0;
      dailyStats[dateKey].overtimeHours += log.overtimeHours || 0;
      dailyStats[dateKey].isLateArrival = log.isLateArrival;
      dailyStats[dateKey].isEarlyDeparture = log.isEarlyDeparture;
      dailyStats[dateKey].status = log.status;

      if (log.isLateArrival) totalLateArrivals++;
      if (log.isEarlyDeparture) totalEarlyDepartures++;
    });

    // Summary stats
    const summary = {
      totalDays: Object.keys(dailyStats).length,
      totalLateArrivals,
      totalEarlyDepartures: totalEarlyDepartures,
      totalOvertime: Object.values(dailyStats).reduce((sum, day) => sum + (day.overtimeHours || 0), 0),
      totalEffectiveHours: Object.values(dailyStats).reduce((sum, day) => sum + (day.effectiveHours || 0), 0),
      avgEffectiveHours: 0,
      complianceRate: 0
    };

    if (summary.totalDays > 0) {
      summary.avgEffectiveHours = parseFloat((summary.totalEffectiveHours / summary.totalDays).toFixed(2));
      summary.complianceRate = parseFloat((1 - ((totalLateArrivals + totalEarlyDepartures) / summary.totalDays)).toFixed(2));
    }

    res.json({
      sessions,
      dailyStats,
      summary
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get employees currently on break
export const getEmployeesOnBreak = async (req, res) => {
  try {
    const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
    
    // Get all attendance records for today with status 'onBreak'
    const organizationId = getOrganizationId(req);
    let attendanceQuery = { 
      date: startOfDay,
      status: 'onBreak',
      organizationId
    };
    
    // If user is a manager (not admin or HR), filter by manager field
    // Example: Manager "Arun Kumar" sees employees on break with manager="Arun Kumar" or "Arun"
    const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
    if (isManager && req.employee) {
      const managerEmployeeIds = await getManagerEmployeeIds(Employee, organizationId, req.employee);
      attendanceQuery.userId = { $in: managerEmployeeIds };
      
      const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();
      logger.info('Manager filtering employees on break by manager field', {
        managerId: req.employee._id,
        managerName: managerName,
        employeeCount: managerEmployeeIds.length
      });
    }
    
    const attendanceRecords = await Attendance.find(attendanceQuery)
    .populate('userId', 'name lastName email employeeId department position profilePhoto')
    .lean();

    // Filter to only those with active breaks
    const employeesOnBreak = attendanceRecords
      .filter(record => {
        if (!record.breaks || record.breaks.length === 0) return false;
        // Check if there's at least one break without breakOut
        return record.breaks.some(breakEntry => breakEntry.breakIn && !breakEntry.breakOut);
      })
      .map(record => {
        // Find the active break
        const activeBreak = record.breaks.find(b => b.breakIn && !b.breakOut);
        const breakStartTime = new Date(activeBreak.breakIn);
        const breakDuration = Math.floor((new Date() - breakStartTime) / 1000 / 60); // minutes
        
        return {
          employee: record.userId,
          attendanceId: record._id,
          breakStartTime: breakStartTime,
          breakDuration: breakDuration, // in minutes
          clockIn: record.clockIn,
          workLocation: record.workLocation
        };
      });

    res.json({
      success: true,
      count: employeesOnBreak.length,
      employees: employeesOnBreak
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

export const getTodayStatus = async (req, res) => {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const now = new Date();

  try {
    // 1. Get all active employees for this organization
    const organizationId = getOrganizationId(req);
    let employeeQuery = addOrganizationFilter(req, { active: true });
    
    // If user is a manager (not admin or HR), filter by manager field
    // Example: Manager "Arun Kumar" sees attendance for employees with manager="Arun Kumar" or "Arun"
    const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
    let managerEmployeeIds = [];
    if (isManager && req.employee) {
      managerEmployeeIds = await getManagerEmployeeIds(Employee, organizationId, req.employee);
      employeeQuery._id = { $in: managerEmployeeIds };
      
      const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();
      logger.info('Manager filtering attendance by manager field', {
        managerId: req.employee._id,
        managerName: managerName,
        employeeCount: managerEmployeeIds.length
      });
    }
    
    const allEmployees = await Employee.find(
      employeeQuery, 
      '_id name email department position employeeId'
    );
    
    // 2. Get today's attendance records with breaks populated for this organization
    // If manager, filter attendance records by manager's team employee IDs
    const attendanceQuery = { 
      date: startOfDay,
      organizationId 
    };
    
    // Filter attendance records by manager's team if user is a manager
    if (isManager && managerEmployeeIds.length > 0) {
      attendanceQuery.userId = { $in: managerEmployeeIds };
    }
    
    const attendanceRecords = await Attendance.find(attendanceQuery)
      .lean();

    // 3. Create maps for easier lookup
    const employeeMap = new Map(allEmployees.map(emp => [emp._id.toString(), emp]));
    const presentEmployeeIds = new Set();

    // 4. Process present employees
    const presentStatus = [];
    const invalidRecords = [];

    attendanceRecords.forEach(record => {
      if (!record.userId) {
        invalidRecords.push({
          employee: null,
          attendanceId: record._id,
          status: 'invalid_reference',
          clockIn: record.clockIn,
          clockOut: record.clockOut,
          isLateArrival: record.isLateArrival,
          isEarlyDeparture: record.isEarlyDeparture,
          effectiveHours: record.effectiveHours,
          workLocation: record.workLocation,
          error: "User reference is null"
        });
        return;
      }

      const employeeId = record.userId.toString();
      const employee = employeeMap.get(employeeId);

      if (!employee) {
        invalidRecords.push({
          employee: null,
          attendanceId: record._id,
          status: 'invalid_reference',
          clockIn: record.clockIn,
          clockOut: record.clockOut,
          isLateArrival: record.isLateArrival,
          isEarlyDeparture: record.isEarlyDeparture,
          effectiveHours: record.effectiveHours,
          workLocation: record.workLocation,
          error: "Associated employee not found"
        });
        return;
      }

      // Check if employee is currently on break
      let isOnBreak = false;
      if (record.breaks && record.breaks.length > 0) {
        const lastBreak = record.breaks[record.breaks.length - 1];
        isOnBreak = lastBreak.breakIn && !lastBreak.breakOut;
      }

      presentEmployeeIds.add(employeeId);
      presentStatus.push({
        employee: {
          _id: employee._id,
          name: employee.name,
          email: employee.email,
          department: employee.department,
          position: employee.position
        },
        status: isOnBreak ? 'onBreak' : (record.status || 'present'),
        clockIn: record.clockIn,
        clockOut: record.clockOut,
        isLateArrival: record.isLateArrival,
        isEarlyDeparture: record.isEarlyDeparture,
        effectiveHours: record.effectiveHours,
        workLocation: record.workLocation,
        isOnBreak: isOnBreak,
        currentBreakDuration: isOnBreak ? 
          Math.floor((now - new Date(record.breaks[record.breaks.length - 1].breakIn)) / (1000 * 60)) : 
          null,
        clockInNetwork: record.clockInNetwork,
        clockInLocation: record.clockInLocation
      });
    });

    // 5. Add absent employees (those who haven't clocked in)
    const absentStatus = allEmployees
      .filter(emp => !presentEmployeeIds.has(emp._id.toString()))
      .map(emp => ({
        employee: {
          _id: emp._id,
          name: emp.name,
          email: emp.email,
          department: emp.department,
          position: emp.position
        },
        status: 'absent',
        clockIn: null,
        clockOut: null,
        isLateArrival: false,
        isEarlyDeparture: false,
        effectiveHours: 0,
        workLocation: null,
        isOnBreak: false,
        currentBreakDuration: null
      }));

    // 6. Combine all results
    const status = [...presentStatus, ...absentStatus, ...invalidRecords];

    res.json({
      success: true,
      data: status,
      counts: {
        present: presentStatus.length,
        absent: absentStatus.length,
        onBreak: presentStatus.filter(s => s.isOnBreak).length,
        invalidRecords: invalidRecords.length
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message,
      error: error.stack 
    });
  }
};

// Lightweight endpoint for employees to fetch only their own session for today
export const getMyTodayStatus = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
    const session = await Attendance.findOne({ 
      userId: req.employee._id, 
      date: startOfDay,
      organizationId 
    });
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const getEmployeeList = async (req, res) => {
  try {
    const { department, includeInactive } = req.query;
    
    const query = addOrganizationFilter(req, { active: true }); // Default to only active employees
    
    // If user is a manager (not admin or HR), filter by manager field
    // Example: Manager "Arun Kumar" sees employees with manager="Arun Kumar" or "Arun"
    const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
    if (isManager && req.employee) {
      const managerQuery = buildManagerMatchQuery(req.employee);
      if (managerQuery && managerQuery.$or) {
        query.$or = managerQuery.$or;
      }
      const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();
      logger.info('Manager filtering employee list by manager field', {
        managerId: req.employee._id,
        managerName: managerName
      });
    } else if (department) {
      query.department = department;
    }
    
    if (includeInactive === 'true') delete query.active; // Remove active filter if including inactive
    
    const employees = await Employee.find(query)
      .select('_id name email department position employeeId active')
      .sort({ name: 1 });
    
    res.json({
      success: true,
      count: employees.length,
      employees
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Force end all active breaks (helper function for edge cases)
export const forceEndBreak = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const organizationId = getOrganizationId(req);
    const attendance = await Attendance.findOne({ 
      userId: req.employee._id, 
      date: startOfDay,
      organizationId 
    });

    if (!attendance) {
      return res.status(404).json({ message: "No attendance record found" });
    }

    // Find and end all active breaks
    const now = new Date();
    let hasActiveBreaks = false;
    
    for (const breakEntry of attendance.breaks || []) {
      if (breakEntry.breakIn && !breakEntry.breakOut) {
        hasActiveBreaks = true;
        breakEntry.breakOut = now;
        const breakDurationMs = now - new Date(breakEntry.breakIn);
        attendance.totalBreakDuration = (attendance.totalBreakDuration || 0) + breakDurationMs;
      }
    }

    if (!hasActiveBreaks) {
      return res.status(400).json({ message: "No active breaks to end" });
    }

    attendance.status = "present";
    await attendance.save();

    res.json({ 
      success: true,
      message: "All active breaks have been ended",
      attendance 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get attendance summary (for both admin and employee)
 */
export const getAttendanceSummary = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const employeeId = req.employee?._id || req.user?._id;
    const { startDate, endDate, employeeId: queryEmployeeId } = req.query;

    // If queryEmployeeId is provided and user is admin, use that instead
    const targetEmployeeId = (req.user?.role === 'admin' && queryEmployeeId) 
      ? queryEmployeeId 
      : employeeId;

    if (!targetEmployeeId) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required'
      });
    }

    const employee = await Employee.findOne({ 
      _id: targetEmployeeId,
      organizationId 
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) dateFilter.date.$gte = new Date(startDate);
      if (endDate) dateFilter.date.$lte = new Date(endDate);
    }

    const query = addOrganizationFilter(req, { 
      userId: targetEmployeeId,
      ...dateFilter
    });

    // Get attendance records
    const records = await Attendance.find(query).sort({ date: -1 });

    // Calculate date range
    let periodStart, periodEnd;
    if (startDate) {
      periodStart = new Date(startDate);
    } else if (records.length > 0) {
      const dates = records.map(r => new Date(r.date).getTime()).filter(d => !isNaN(d));
      periodStart = dates.length > 0 ? new Date(Math.min(...dates)) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    } else {
      periodStart = new Date(new Date().setMonth(new Date().getMonth() - 1));
    }
    
    periodEnd = endDate ? new Date(endDate) : new Date();
    const workingDays = calculateWorkingDays(periodStart, periodEnd);

    // Calculate statistics
    const presentDays = records.filter(r => ['present', 'loggedOut'].includes(r.status)).length;
    const halfDays = records.filter(r => r.status === 'half-day').length;
    const absentDays = Math.max(0, workingDays - presentDays - halfDays);

    const totalEffectiveHours = records.reduce((sum, r) => sum + (r.effectiveHours || 0), 0);
    const totalOvertime = records.reduce((sum, r) => sum + (r.overtimeHours || 0), 0);

    res.json({
      success: true,
      data: {
        employee: {
          _id: employee._id,
          name: employee.name,
          employeeId: employee.employeeId
        },
        period: {
          start: periodStart,
          end: periodEnd,
          workingDays
        },
        statistics: {
          presentDays,
          halfDays,
          absentDays,
          attendanceRate: workingDays > 0 
            ? parseFloat(((presentDays + halfDays * 0.5) / workingDays * 100).toFixed(2)) 
            : 0,
          totalEffectiveHours: parseFloat(totalEffectiveHours.toFixed(2)),
          totalOvertime: parseFloat(totalOvertime.toFixed(2)),
          avgDailyHours: presentDays > 0 
            ? parseFloat((totalEffectiveHours / presentDays).toFixed(2)) 
            : 0,
          lateArrivals: records.filter(r => r.isLateArrival).length,
          earlyDepartures: records.filter(r => r.isEarlyDeparture).length
        }
      }
    });
  } catch (error) {
    logger.error('Error getting attendance summary', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get attendance summary'
    });
  }
};

export const getEmployeeAttendanceDetails = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;

    // Validate employee exists and belongs to same organization
    const organizationId = getOrganizationId(req);
    const employee = await Employee.findOne({ _id: employeeId, organizationId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // If user is a manager (not admin or HR), verify employee is linked to them
    // Example: Manager "Arun Kumar" can only view attendance for employees with manager="Arun Kumar" or "Arun"
    const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
    if (isManager && req.employee) {
      const isLinked = isEmployeeLinkedToManager(employee, req.employee);
      
      if (!isLinked) {
        const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();
        logger.warn('Manager trying to access attendance for unlinked employee', {
          managerId: req.employee._id,
          managerName: managerName,
          employeeManager: employee.manager,
          employeeId: employeeId
        });
        return res.status(403).json({
          success: false,
          message: 'You can only view attendance for employees linked to you.'
        });
      }
    }

    // Date filtering
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const query = addOrganizationFilter(req, { userId: employeeId });
    if (startDate || endDate) query.date = dateFilter;

    // Get all attendance records
    const records = await Attendance.find(query).sort({ date: -1 });

    // Calculate working days in period
    const periodStart = startDate ? new Date(startDate) : records.length > 0 
      ? new Date(Math.min(...records.map(r => r.date.getTime()))) 
      : new Date();
    const periodEnd = endDate ? new Date(endDate) : new Date();
    const workingDays = calculateWorkingDays(periodStart, periodEnd);

    // Calculate statistics
    const presentDays = records.filter(r => ['present', 'loggedOut'].includes(r.status)).length;
    const halfDays = records.filter(r => r.status === 'half-day').length;
    const absentDays = workingDays - presentDays - halfDays;

    const totalEffectiveHours = records.reduce((sum, r) => sum + (r.effectiveHours || 0), 0);
    const totalOvertime = records.reduce((sum, r) => sum + (r.overtimeHours || 0), 0);

    res.json({
      success: true,
      employee: {
        _id: employee._id,
        name: employee.name,
        email: employee.email,
        department: employee.department,
        position: employee.position,
        employeeId: employee.employeeId
      },
      period: {
        start: periodStart,
        end: periodEnd,
        workingDays
      },
      statistics: {
        presentDays,
        halfDays,
        absentDays,
        attendanceRate: workingDays > 0 ? parseFloat(((presentDays + halfDays * 0.5) / workingDays).toFixed(2)) : 0,
        totalEffectiveHours: parseFloat(totalEffectiveHours.toFixed(2)),
        totalOvertime: parseFloat(totalOvertime.toFixed(2)),
        avgDailyHours: presentDays > 0 ? parseFloat((totalEffectiveHours / presentDays).toFixed(2)) : 0,
        lateArrivals: records.filter(r => r.isLateArrival).length,
        earlyDepartures: records.filter(r => r.isEarlyDeparture).length
      },
      recentRecords: records.slice(0, 10) // Last 10 records
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get attendance rule details for employees (public info only)
 * Returns office location, radius, and whether simple punches are enabled
 */
export const getAttendanceRuleForEmployee = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    
    if (!organizationId) {
      logger.error('Get attendance rule error: Missing organizationId', {
        hasEmployee: !!req.employee,
        hasUser: !!req.user
      });
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required',
        code: 'MISSING_ORGANIZATION_ID'
      });
    }

    // Get active attendance rule
    const activeRule = await AttendanceRule.findOne({ 
      isActive: true,
      organizationId 
    }).lean();

    if (!activeRule) {
      // Return default values if no rule exists
      return res.json({
        success: true,
        rule: {
          location: null,
          address: null,
          coordinates: null,
          maximumRadius: 500,
          enableSimplePunches: true, // Default to true if no rule
          locationRequired: false
        }
      });
    }

    // Check if employee is exempt
    const empDept = req.employee?.department;
    const appliesToDept = !activeRule.applicableDepartments?.length ||
      (empDept && activeRule.applicableDepartments.includes(empDept));

    // Check if employee is in exempt list
    const isExempt = activeRule.exceptions?.exemptEmployees?.some(
      empId => empId.toString() === req.employee?._id?.toString()
    ) || false;

    // Determine if location is required
    // Location is required if:
    // 1. Simple punches are disabled
    // 2. Rule applies to employee's department
    // 3. Employee is not exempt
    // 4. Rule has valid coordinates
    const hasValidCoordinates = activeRule.coordinates && 
                                 typeof activeRule.coordinates.latitude === 'number' &&
                                 typeof activeRule.coordinates.longitude === 'number' &&
                                 !isNaN(activeRule.coordinates.latitude) &&
                                 !isNaN(activeRule.coordinates.longitude) &&
                                 activeRule.coordinates.latitude !== 0 &&
                                 activeRule.coordinates.longitude !== 0;

    const locationRequired = !activeRule.enableSimplePunches && 
                            appliesToDept && 
                            !isExempt &&
                            hasValidCoordinates;

    // Return public rule information
    return res.json({
      success: true,
      rule: {
        location: activeRule.location,
        address: activeRule.address,
        coordinates: activeRule.coordinates,
        maximumRadius: activeRule.maximumRadius || 500,
        enableSimplePunches: activeRule.enableSimplePunches || false,
        locationRequired: locationRequired,
        applicableToDepartment: appliesToDept,
        isExempt: isExempt
      }
    });
  } catch (error) {
    logger.error('Error fetching attendance rule for employee', {
      error: error.message,
      stack: error.stack,
      employeeId: req.employee?._id
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance rule',
      code: 'SERVER_ERROR'
    });
  }
};

