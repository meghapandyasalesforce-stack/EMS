import Attendance from "../../models/attendance.model.js";
import Employee from "../../models/employee.model.js"
import Leave from "../../models/leave.model.js";
import AttendanceRule from "../../models/attendanceRule.model.js";
import Calendar from "../../models/calendar.model.js";
import User from "../../models/user.model.js";
import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import logger from "../../helpers/logger.js";
import { sendBreakNotification, sendNotificationToUsers } from "../../helpers/notificationService.js";
import { addOrganizationFilter, getOrganizationId } from "../../helpers/organizationHelper.js";
import { buildManagerMatchQuery, getManagerEmployeeIds, isEmployeeLinkedToManager } from "../../helpers/managerHelper.js";
import { reverseGeocode, isGeocodingAvailable } from "../../helpers/geocodingService.js";
import { deleteCacheByPattern } from "../../helpers/cache.js";
import {
  getExpectedWorkingHoursFromRule,
  getEffectiveOfficeEndForEarlyDeparture,
} from "../../helpers/attendanceSecurityHelper.js";
import {
  getEffectiveTimezone,
} from "../../helpers/organizationTimezoneService.js";
import {
  getAttendanceDayContext,
  findTodayAttendance,
  buildOrgTodayAttendanceFilter,
  buildAttendancePeriodFilter,
  parseDateKeyInTimezone,
  resolveAttendanceDateKey,
} from "../../helpers/attendanceDayHelper.js";
import {
  getStartOfDayInTimezone,
  getEndOfDayInTimezone,
  getDateKeyInTimezone,
  combineDateAndTimeInTimezone,
} from "../../helpers/timezoneHelper.js";


const OFFICE_START_TIME = 9;  // 9 AM — fallback when rule has no start time

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

const DEFAULT_WORKING_DAYS = {
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: false,
  sunday: false
};

const getDateKey = (value) => {
  const d = new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getDayName = (value) => {
  const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return names[new Date(value).getDay()];
};

async function calculateWorkingDays(startDate, endDate, organizationId) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return 0;
  }

  const years = [];
  for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
    years.push(year);
  }

  const calendars = await Calendar.find({
    organizationId,
    year: { $in: years }
  }).lean();

  const calendarByYear = new Map(calendars.map((c) => [c.year, c]));
  const holidayKeysByYear = new Map();
  years.forEach((year) => {
    const calendar = calendarByYear.get(year);
    const keys = new Set(
      (calendar?.holidays || [])
        .filter((holiday) => holiday?.isActive !== false)
        .map((holiday) => getDateKey(holiday.date))
    );
    holidayKeysByYear.set(year, keys);
  });

  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const year = current.getFullYear();
    const calendar = calendarByYear.get(year);
    const workingDays = calendar?.workingDays || DEFAULT_WORKING_DAYS;
    const dayName = getDayName(current);
    const isConfiguredWorkingDay = Boolean(workingDays?.[dayName]);
    const dateKey = getDateKey(current);
    const isHoliday = holidayKeysByYear.get(year)?.has(dateKey);

    if (isConfiguredWorkingDay && !isHoliday) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}


/**
 * @swagger
 * /api/v1/both/attendance/clock-in:
 *   post:
 *     summary: Employee clock in
 *     description: Records employee check-in with optional location, image, and network information. Rate limited to 5 per hour.
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               workLocation:
 *                 type: string
 *                 example: Office
 *                 description: Work location name
 *               latitude:
 *                 type: number
 *                 format: float
 *                 example: 28.6139
 *                 description: GPS latitude (optional)
 *               longitude:
 *                 type: number
 *                 format: float
 *                 example: 77.2090
 *                 description: GPS longitude (optional)
 *               address:
 *                 type: string
 *                 example: 123 Main St, City, State
 *                 description: Physical address (optional)
 *               imageUrl:
 *                 type: string
 *                 format: uri
 *                 description: Profile photo URL for verification (optional)
 *               networkType:
 *                 type: string
 *                 example: wifi
 *                 description: Network type (wifi, cellular, etc.)
 *               deviceType:
 *                 type: string
 *                 example: mobile
 *                 description: Device type (mobile, tablet, desktop)
 *     responses:
 *       200:
 *         description: Clock in successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Clocked in successfully
 *                 attendance:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     checkInTime:
 *                       type: string
 *                       format: date-time
 *                     status:
 *                       type: string
 *                       example: present
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         description: Too many clock-in attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Enhanced Clock In with image capture, geolocation, and network tracking
export const clockIn = async (req, res) => {
  let userId;
  let dayContext;
  let organizationId;

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

    userId = req.employee._id;
    organizationId = getOrganizationId(req);
    
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

    dayContext = await getAttendanceDayContext(organizationId);
    const { startOfDay, attendanceDateKey, timezone: orgTimezone } = dayContext;
    
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

    const existing = await findTodayAttendance(Attendance, {
      organizationId,
      userId,
      dayContext,
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
    
    // Get office start time from rule or use default — use org timezone to avoid server-local-time drift
    let officeStartTime;
    if (activeRule?.officeHours?.startTime) {
      officeStartTime = combineDateAndTimeInTimezone(startOfDay, activeRule.officeHours.startTime, orgTimezone);
    } else if (activeRule?.checkInOutTimes?.checkInStartTime) {
      officeStartTime = combineDateAndTimeInTimezone(startOfDay, activeRule.checkInOutTimes.checkInStartTime, orgTimezone);
    } else {
      officeStartTime = combineDateAndTimeInTimezone(startOfDay, `${OFFICE_START_TIME}:00`, orgTimezone);
    }

    // Validate check-in time window if configured (warning only, don't block)
    let checkInWindowWarning = null;
    if (activeRule?.checkInOutTimes?.checkInStartTime && activeRule?.checkInOutTimes?.checkInEndTime) {
      const checkInWindowStart = combineDateAndTimeInTimezone(startOfDay, activeRule.checkInOutTimes.checkInStartTime, orgTimezone);
      const checkInWindowEnd = combineDateAndTimeInTimezone(startOfDay, activeRule.checkInOutTimes.checkInEndTime, orgTimezone);
      
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

    // Geofence: when rule applies, GPS is required; office radius is enforced only if simple punches are off
    if (activeRule) {
      const empDept = req.employee?.department;
      const appliesToDept = !activeRule.applicableDepartments?.length ||
        (empDept && activeRule.applicableDepartments.includes(empDept));
      const isExempt = activeRule.exceptions?.exemptEmployees?.some(
        (empId) => empId.toString() === req.employee?._id?.toString()
      ) || false;
      const hasRuleCoords = activeRule.coordinates &&
        typeof activeRule.coordinates.latitude === 'number' &&
        typeof activeRule.coordinates.longitude === 'number' &&
        !isNaN(activeRule.coordinates.latitude) &&
        !isNaN(activeRule.coordinates.longitude) &&
        !(activeRule.coordinates.latitude === 0 && activeRule.coordinates.longitude === 0);

      if (appliesToDept && hasRuleCoords && !isExempt) {
        const enforceRadius = !activeRule.enableSimplePunches;

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

        const bothZero = locationInfo.latitude === 0 && locationInfo.longitude === 0;

        if (!hasValidLatitude || !hasValidLongitude || bothZero) {
          logger.warn('Clock-in location validation failed', {
            userId,
            organizationId,
            latitude: locationInfo.latitude,
            longitude: locationInfo.longitude,
            enableSimplePunches: activeRule.enableSimplePunches,
          });
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
              },
              normalized: {
                latitude: locationInfo.latitude,
                longitude: locationInfo.longitude,
              },
              validation: {
                hasValidLatitude,
                hasValidLongitude,
                bothZero,
              },
              requestBodyKeys: Object.keys(req.body),
            },
          });
        }

        locationDistance = distanceInMeters(
          locationInfo.latitude,
          locationInfo.longitude,
          activeRule.coordinates.latitude,
          activeRule.coordinates.longitude
        );
        locationInfo.locationDistance = locationDistance;

        if (enforceRadius) {
          if (locationDistance > (activeRule.maximumRadius || 500)) {
            logger.warn('Clock-in outside radius', {
              userId,
              organizationId,
              distance: Math.round(locationDistance),
              maximumRadius: activeRule.maximumRadius,
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
                  longitude: locationInfo.longitude,
                },
                officeLocation: activeRule.coordinates,
              },
            });
          }
          locationMatch = true;
          locationInfo.locationMatch = true;
        } else {
          locationMatch = locationDistance <= (activeRule.maximumRadius || 500);
          locationInfo.locationMatch = locationMatch;
        }
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
      attendanceDateKey,
      timezoneUsed: orgTimezone,
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

    // Invalidate caches so employee and admin UIs get fresh data without delay
    deleteCacheByPattern('attendance:logs*').catch(err => logger.warn('Cache invalidation after clock-in', { error: err?.message }));
    deleteCacheByPattern('attendance:today*').catch(err => logger.warn('Cache invalidation after clock-in', { error: err?.message }));
    deleteCacheByPattern('attendance:on-break*').catch(err => logger.warn('Cache invalidation after clock-in', { error: err?.message }));
    deleteCacheByPattern('attendance:summary*').catch(err => logger.warn('Cache invalidation after clock-in', { error: err?.message }));
    deleteCacheByPattern('attendance:my-today*').catch(err => logger.warn('Cache invalidation after clock-in', { error: err?.message }));
    deleteCacheByPattern('attendance:employee*').catch(err => logger.warn('Cache invalidation after clock-in', { error: err?.message }));
    deleteCacheByPattern('attendance:employee-list*').catch(err => logger.warn('Cache invalidation after clock-in', { error: err?.message }));
    try {
      const { getIO } = await import('../../config/websocket.js');
      getIO().to(`org:${organizationId}`).emit('attendance:today_status_changed', {});
    } catch (e) {
      logger.warn('Socket emit after clock-in', { error: e?.message });
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
    
    // Handle duplicate attendance safely (race condition fallback with unique index)
    if (error?.code === 11000) {
      const existingSession = await findTodayAttendance(Attendance, {
        organizationId,
        userId,
        dayContext,
      });

      return res.status(400).json({
        success: false,
        message: "Already clocked in for today",
        code: 'ALREADY_CLOCKED_IN',
        session: existingSession || null
      });
    }

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
    const organizationId = getOrganizationId(req);
    const dayContext = await getAttendanceDayContext(organizationId);
    const attendance = await findTodayAttendance(Attendance, {
      organizationId,
      userId: req.employee._id,
      dayContext,
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

    // Invalidate caches so admin dashboard and employee UI get fresh data without delay
    deleteCacheByPattern('attendance:logs*').catch(err => logger.warn('Cache invalidation after break-in', { error: err?.message }));
    deleteCacheByPattern('attendance:on-break*').catch(err => logger.warn('Cache invalidation after break-in', { error: err?.message }));
    deleteCacheByPattern('attendance:today*').catch(err => logger.warn('Cache invalidation after break-in', { error: err?.message }));
    deleteCacheByPattern('attendance:summary*').catch(err => logger.warn('Cache invalidation after break-in', { error: err?.message }));
    deleteCacheByPattern('attendance:my-today*').catch(err => logger.warn('Cache invalidation after break-in', { error: err?.message }));
    deleteCacheByPattern('attendance:employee*').catch(err => logger.warn('Cache invalidation after break-in', { error: err?.message }));
    deleteCacheByPattern('attendance:employee-list*').catch(err => logger.warn('Cache invalidation after break-in', { error: err?.message }));

    // Real-time: notify admin dashboard to refresh employees on break
    try {
      const { getIO } = await import('../../config/websocket.js');
      getIO().to(`org:${organizationId}`).emit('attendance:employees_on_break_changed', {});
    } catch (e) {
      logger.warn('Socket emit after break-in', { error: e?.message });
    }

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
    const organizationId = getOrganizationId(req);
    const dayContext = await getAttendanceDayContext(organizationId);
    const attendance = await findTodayAttendance(Attendance, {
      organizationId,
      userId: req.employee._id,
      dayContext,
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

    // Invalidate caches so admin dashboard and employee UI get fresh data without delay
    deleteCacheByPattern('attendance:logs*').catch(err => logger.warn('Cache invalidation after break-out', { error: err?.message }));
    deleteCacheByPattern('attendance:on-break*').catch(err => logger.warn('Cache invalidation after break-out', { error: err?.message }));
    deleteCacheByPattern('attendance:today*').catch(err => logger.warn('Cache invalidation after break-out', { error: err?.message }));
    deleteCacheByPattern('attendance:summary*').catch(err => logger.warn('Cache invalidation after break-out', { error: err?.message }));
    deleteCacheByPattern('attendance:my-today*').catch(err => logger.warn('Cache invalidation after break-out', { error: err?.message }));
    deleteCacheByPattern('attendance:employee*').catch(err => logger.warn('Cache invalidation after break-out', { error: err?.message }));
    deleteCacheByPattern('attendance:employee-list*').catch(err => logger.warn('Cache invalidation after break-out', { error: err?.message }));

    // Real-time: notify admin dashboard to refresh employees on break
    try {
      const { getIO } = await import('../../config/websocket.js');
      getIO().to(`org:${organizationId}`).emit('attendance:employees_on_break_changed', {});
    } catch (e) {
      logger.warn('Socket emit after break-out', { error: e?.message });
    }

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @swagger
 * /api/v1/both/attendance/clock-out:
 *   post:
 *     summary: Employee clock out
 *     description: Records employee check-out. Rate limited to 5 per hour.
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               latitude:
 *                 type: number
 *                 format: float
 *                 description: GPS latitude (optional)
 *               longitude:
 *                 type: number
 *                 format: float
 *                 description: GPS longitude (optional)
 *               address:
 *                 type: string
 *                 description: Physical address (optional)
 *     responses:
 *       200:
 *         description: Clock out successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Clocked out successfully
 *                 attendance:
 *                   type: object
 *                   properties:
 *                     checkOutTime:
 *                       type: string
 *                       format: date-time
 *                     totalHours:
 *                       type: number
 *                       example: 8.5
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Enhanced Clock Out with image capture, geolocation, and network tracking
export const clockOut = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const dayContext = await getAttendanceDayContext(organizationId);
    const { startOfDay, timezone: orgTimezone } = dayContext;
    
    // Load active rule for this organization (if any)
    const activeRule = await AttendanceRule.findOne({ 
      isActive: true,
      organizationId 
    })
      .sort({ priority: -1, updatedAt: -1 })
      .lean();
    
    const attendance = await findTodayAttendance(Attendance, {
      organizationId,
      userId: req.employee._id,
      dayContext,
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

    // Validate check-out is near check-in (strict mode only). Simple punches: independent locations.
    const checkInLocation = attendance.clockInLocation;
    if (!activeRule?.enableSimplePunches &&
        checkInLocation &&
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

    // Geofence: same as clock-in — GPS required when rule applies; radius only if simple punches off
    if (activeRule) {
      const empDept = req.employee?.department;
      const appliesToDept = !activeRule.applicableDepartments?.length ||
        (empDept && activeRule.applicableDepartments.includes(empDept));
      const isExempt = activeRule.exceptions?.exemptEmployees?.some(
        (empId) => empId.toString() === req.employee?._id?.toString()
      ) || false;
      const hasRuleCoords = activeRule.coordinates &&
        typeof activeRule.coordinates.latitude === 'number' &&
        typeof activeRule.coordinates.longitude === 'number' &&
        !isNaN(activeRule.coordinates.latitude) &&
        !isNaN(activeRule.coordinates.longitude) &&
        !(activeRule.coordinates.latitude === 0 && activeRule.coordinates.longitude === 0);

      if (appliesToDept && hasRuleCoords && !isExempt) {
        const enforceRadius = !activeRule.enableSimplePunches;

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

        const bothZero = locationInfo.latitude === 0 && locationInfo.longitude === 0;

        if (!hasValidLatitude || !hasValidLongitude || bothZero) {
          logger.warn('Clock-out location validation failed', {
            latitude: locationInfo.latitude,
            longitude: locationInfo.longitude,
            enableSimplePunches: activeRule.enableSimplePunches,
          });
          return res.status(400).json({
            success: false,
            message: 'Location is required to clock out at this site. Please enable location services and try again.',
            code: 'LOCATION_REQUIRED',
            details: {
              received: {
                latitude: req.body.latitude,
                longitude: req.body.longitude,
              },
              normalized: {
                latitude: locationInfo.latitude,
                longitude: locationInfo.longitude,
              },
              validation: {
                hasValidLatitude,
                hasValidLongitude,
                bothZero,
              },
            },
          });
        }

        const dist = distanceInMeters(
          locationInfo.latitude,
          locationInfo.longitude,
          activeRule.coordinates.latitude,
          activeRule.coordinates.longitude
        );
        locationInfo.locationDistance = dist;
        if (enforceRadius) {
          if (dist > (activeRule.maximumRadius || 500)) {
            return res.status(400).json({
              success: false,
              message: `You are outside the allowed check-out radius. Distance: ${Math.round(dist)}m, Maximum allowed: ${activeRule.maximumRadius}m. Please move closer to the office location.`,
              code: 'OUTSIDE_RADIUS',
              distance: Math.round(dist),
              maximumRadius: activeRule.maximumRadius,
            });
          }
          locationInfo.locationMatch = true;
        } else {
          locationInfo.locationMatch = dist <= (activeRule.maximumRadius || 500);
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

    const expectedHours = getExpectedWorkingHoursFromRule(activeRule, startOfDay, orgTimezone);
    const effectiveEndTime = getEffectiveOfficeEndForEarlyDeparture(activeRule, startOfDay, orgTimezone);
    attendance.isEarlyDeparture = now < effectiveEndTime;

    if (attendance.effectiveHours > expectedHours) {
      attendance.overtimeHours = parseFloat(
        (attendance.effectiveHours - expectedHours).toFixed(2)
      );
    } else {
      attendance.overtimeHours = 0;
    }

    const halfDayThreshold = expectedHours / 2;
    if (attendance.effectiveHours < halfDayThreshold) {
      attendance.status = "half-day";
    }

    await attendance.save();

    // Invalidate caches so employee and admin UIs get fresh data without delay
    deleteCacheByPattern('attendance:logs*').catch(err => logger.warn('Cache invalidation after clock-out', { error: err?.message }));
    deleteCacheByPattern('attendance:today*').catch(err => logger.warn('Cache invalidation after clock-out', { error: err?.message }));
    deleteCacheByPattern('attendance:on-break*').catch(err => logger.warn('Cache invalidation after clock-out', { error: err?.message }));
    deleteCacheByPattern('attendance:summary*').catch(err => logger.warn('Cache invalidation after clock-out', { error: err?.message }));
    deleteCacheByPattern('attendance:my-today*').catch(err => logger.warn('Cache invalidation after clock-out', { error: err?.message }));
    deleteCacheByPattern('attendance:employee*').catch(err => logger.warn('Cache invalidation after clock-out', { error: err?.message }));
    deleteCacheByPattern('attendance:employee-list*').catch(err => logger.warn('Cache invalidation after clock-out', { error: err?.message }));
    try {
      const { getIO } = await import('../../config/websocket.js');
      getIO().to(`org:${organizationId}`).emit('attendance:today_status_changed', {});
    } catch (e) {
      logger.warn('Socket emit after clock-out', { error: e?.message });
    }

    const attendanceObj = attendance.toObject ? attendance.toObject() : attendance;
    res.json({
      ...attendanceObj,
      success: true,
      message: "Clocked out successfully",
      attendance: attendanceObj
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @swagger
 * /api/v1/both/attendance/get-logs:
 *   get:
 *     summary: Get attendance logs
 *     description: Retrieves attendance logs for the authenticated employee. Supports date range filtering.
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering (ISO format)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering (ISO format)
 *     responses:
 *       200:
 *         description: Attendance logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                       checkInTime:
 *                         type: string
 *                         format: date-time
 *                       checkOutTime:
 *                         type: string
 *                         format: date-time
 *                       status:
 *                         type: string
 *                         example: present
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getLogs = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const { startDate, endDate } = req.query;
    const userId = req.employee._id;
    const userIdString = String(userId);
    const employeeEmail = (req.employee?.email || '').trim().toLowerCase();
    const query = addOrganizationFilter(req, { userId });
    const orgTimezone = await getEffectiveTimezone(organizationId);

    let startDateKey;
    let endDateKey;
    let periodStart;
    let periodEnd;
    const nowDt = DateTime.now().setZone(orgTimezone);

    if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(String(startDate).slice(0, 10))) {
      startDateKey = String(startDate).slice(0, 10);
      periodStart = parseDateKeyInTimezone(startDateKey, orgTimezone).startOf('day').toJSDate();
    }
    if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(String(endDate).slice(0, 10))) {
      endDateKey = String(endDate).slice(0, 10);
      periodEnd = parseDateKeyInTimezone(endDateKey, orgTimezone).endOf('day').toJSDate();
    }
    if (!startDateKey || !endDateKey) {
      startDateKey = nowDt.startOf('month').toFormat('yyyy-MM-dd');
      endDateKey = nowDt.endOf('month').toFormat('yyyy-MM-dd');
      periodStart = nowDt.startOf('month').toJSDate();
      periodEnd = nowDt.endOf('month').toJSDate();
    }

    Object.assign(
      query,
      buildAttendancePeriodFilter({ startDateKey, endDateKey, periodStart, periodEnd })
    );

    let logs = await Attendance.find(query).sort({ date: -1 });

    // Backward compatibility: older attendance rows may have:
    // 1) missing organizationId, or
    // 2) a previous employee _id for the same email.
    // Merge these rows so employees can still view historical monthly logs.
    if (employeeEmail) {
      const sameEmailEmployees = await Employee.find({
        email: employeeEmail
      }).select('_id organizationId').lean();

      const candidateUserIds = Array.from(
        new Set(
          sameEmailEmployees
            .map((emp) => emp?._id?.toString?.())
            .filter(Boolean)
            .concat(userIdString)
        )
      );

      if (candidateUserIds.length > 0) {
        const legacyQuery = {
          userId: { $in: candidateUserIds.map((id) => new mongoose.Types.ObjectId(id)) },
          $and: [
            buildAttendancePeriodFilter({ startDateKey, endDateKey, periodStart, periodEnd }),
            {
              $or: [
                { organizationId: organizationId || null },
                { organizationId: { $exists: false } },
                { organizationId: null },
              ],
            },
          ],
        };

        const legacyLogs = await Attendance.find(legacyQuery).sort({ date: -1 });

        if (legacyLogs.length > 0) {
          const seen = new Set();
          logs = [...logs, ...legacyLogs].filter((row) => {
            const key = row?._id?.toString?.();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        }
      }
    }

    const dailyStats = {};
    const sessions = [];
    let totalLateArrivals = 0;
    let totalEarlyDepartures = 0;
    const issueDayKeys = new Set();

    // Compute effective hours from clockIn/clockOut/breaks when stored value is 0 (e.g. old data or pre clock-out).
    const getEffectiveHours = (log) => {
      if (log.effectiveHours != null && log.effectiveHours > 0) return log.effectiveHours;
      if (!log.clockIn || !log.clockOut) return 0;
      const durationMs = new Date(log.clockOut) - new Date(log.clockIn);
      let breakMs = 0;
      if (log.breaks && log.breaks.length > 0) {
        log.breaks.forEach(b => {
          if (b.breakIn && b.breakOut) breakMs += new Date(b.breakOut) - new Date(b.breakIn);
        });
      }
      return Math.round((durationMs - breakMs) / (1000 * 60 * 60) * 100) / 100;
    };

    logs.forEach(log => {
      sessions.push(log);

      const dateKey = resolveAttendanceDateKey(log, orgTimezone) || getDateKey(log.date);

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

      const effectiveHours = getEffectiveHours(log);
      dailyStats[dateKey].effectiveHours += effectiveHours;
      dailyStats[dateKey].grossHours += log.grossHours || 0;
      dailyStats[dateKey].overtimeHours += log.overtimeHours || 0;
      dailyStats[dateKey].isLateArrival = log.isLateArrival;
      dailyStats[dateKey].isEarlyDeparture = log.isEarlyDeparture;
      dailyStats[dateKey].status = log.status;

      if (log.isLateArrival) {
        totalLateArrivals++;
        issueDayKeys.add(dateKey);
      }
      if (log.isEarlyDeparture) {
        totalEarlyDepartures++;
        issueDayKeys.add(dateKey);
      }
    });

    const presentDays = Object.keys(dailyStats).length;
    const workingDays = await calculateWorkingDays(periodStart, periodEnd, organizationId);
    const absentDays = Math.max(0, workingDays - presentDays);

    // Summary stats
    const summary = {
      periodStart,
      periodEnd,
      totalDays: presentDays,
      workingDays,
      presentDays,
      absentDays,
      totalLateArrivals,
      totalEarlyDepartures: totalEarlyDepartures,
      issueDays: issueDayKeys.size,
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
      summary,
      period: {
        startDate: periodStart,
        endDate: periodEnd
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get employees currently on break
export const getEmployeesOnBreak = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const dayContext = await getAttendanceDayContext(organizationId);
    let attendanceQuery = { 
      ...buildOrgTodayAttendanceFilter(organizationId, dayContext),
      status: 'onBreak',
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
  const now = new Date();

  try {
    const organizationId = getOrganizationId(req);
    const dayContext = await getAttendanceDayContext(organizationId);
    // 1. Get all active employees for this organization
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
      '_id name lastName email department position employeeId profilePhoto'
    );
    
    // 2. Get today's attendance records with breaks populated for this organization
    // If manager, filter attendance records by manager's team employee IDs
    const attendanceQuery = buildOrgTodayAttendanceFilter(organizationId, dayContext);
    
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
          lastName: employee.lastName,
          email: employee.email,
          department: employee.department,
          position: employee.position,
          profilePhoto: employee.profilePhoto
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
          lastName: emp.lastName,
          email: emp.email,
          department: emp.department,
          position: emp.position,
          profilePhoto: emp.profilePhoto
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
    const dayContext = await getAttendanceDayContext(organizationId);
    const session = await findTodayAttendance(Attendance, {
      organizationId,
      userId: req.employee._id,
      dayContext,
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
      .select('_id name lastName email department position employeeId active profilePhoto')
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
    const organizationId = getOrganizationId(req);
    const dayContext = await getAttendanceDayContext(organizationId);
    const attendance = await findTodayAttendance(Attendance, {
      organizationId,
      userId: req.employee._id,
      dayContext,
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
/**
 * @swagger
 * /api/v1/both/attendance/summary:
 *   get:
 *     summary: Get attendance summary
 *     description: Retrieves attendance summary statistics for the authenticated user (admin sees all, employee sees own).
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for summary period
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for summary period
 *     responses:
 *       200:
 *         description: Attendance summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalDays:
 *                       type: number
 *                       example: 22
 *                     presentDays:
 *                       type: number
 *                       example: 20
 *                     absentDays:
 *                       type: number
 *                       example: 2
 *                     attendanceRate:
 *                       type: number
 *                       example: 90.91
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
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
    const workingDays = await calculateWorkingDays(periodStart, periodEnd, organizationId);

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
    const { startDate, endDate, full } = req.query;

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

    const orgTimezone = await getEffectiveTimezone(organizationId);
    const nowDt = DateTime.now().setZone(orgTimezone);

    let startDateKey;
    let endDateKey;
    let periodStart;
    let periodEnd;

    if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(String(startDate).slice(0, 10))) {
      startDateKey = String(startDate).slice(0, 10);
      periodStart = parseDateKeyInTimezone(startDateKey, orgTimezone).startOf('day').toJSDate();
    }
    if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(String(endDate).slice(0, 10))) {
      endDateKey = String(endDate).slice(0, 10);
      periodEnd = parseDateKeyInTimezone(endDateKey, orgTimezone).endOf('day').toJSDate();
    }
    if (!startDateKey || !endDateKey) {
      startDateKey = nowDt.startOf('month').toFormat('yyyy-MM-dd');
      endDateKey = nowDt.endOf('month').toFormat('yyyy-MM-dd');
      periodStart = nowDt.startOf('month').toJSDate();
      periodEnd = nowDt.endOf('month').toJSDate();
    }

    const query = addOrganizationFilter(req, { userId: employeeId });
    Object.assign(
      query,
      buildAttendancePeriodFilter({ startDateKey, endDateKey, periodStart, periodEnd })
    );

    // Get all attendance records
    const records = await Attendance.find(query).sort({ date: -1 });

    const workingDays = await calculateWorkingDays(periodStart, periodEnd, organizationId);

    // Calculate statistics
    const presentDays = records.filter(r => ['present', 'loggedOut'].includes(r.status)).length;
    const halfDays = records.filter(r => r.status === 'half-day').length;
    // NEW: Only count explicit 'absent' records; days with no record are not treated as absent
    const absentDays = records.filter(r => r.status === 'absent').length;
    // Denominator for attendance rate: only days where we have a record
    const recordedDays = presentDays + halfDays + absentDays;

    const totalEffectiveHours = records.reduce((sum, r) => sum + (r.effectiveHours || 0), 0);
    const totalOvertime = records.reduce((sum, r) => sum + (r.overtimeHours || 0), 0);

    res.json({
      success: true,
      employee: {
        _id: employee._id,
        name: employee.name,
        lastName: employee.lastName,
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
        // Attendance rate based only on days with records; no record = not counted
        attendanceRate: recordedDays > 0
          ? parseFloat(((presentDays + halfDays * 0.5) / recordedDays).toFixed(2))
          : 0,
        totalEffectiveHours: parseFloat(totalEffectiveHours.toFixed(2)),
        totalOvertime: parseFloat(totalOvertime.toFixed(2)),
        avgDailyHours: presentDays > 0 ? parseFloat((totalEffectiveHours / presentDays).toFixed(2)) : 0,
        lateArrivals: records.filter(r => r.isLateArrival).length,
        earlyDepartures: records.filter(r => r.isEarlyDeparture).length
      },
      recentRecords: (full === 'true' ? records : records.slice(0, 10)).map((r) => {
        const doc = r.toObject ? r.toObject() : r;
        const attendanceDateKey =
          doc.attendanceDateKey || resolveAttendanceDateKey(doc, orgTimezone);
        return {
          ...doc,
          attendanceDateKey,
          dateKey: attendanceDateKey,
        };
      }),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const toYmd = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const resolveProfilePhoto = (profilePhoto) => {
  const photoRef = profilePhoto?.url || profilePhoto;
  if (typeof photoRef === 'string') return photoRef;
  if (photoRef?.url) return photoRef.url;
  return null;
};

const isWorkFromHomeLocation = (workLocation) =>
  workLocation === 'work_from_home' || workLocation === 'home';

const buildCalendarLookups = async (organizationId, startDay, endDay) => {
  const years = [];
  for (let year = startDay.getFullYear(); year <= endDay.getFullYear(); year += 1) {
    years.push(year);
  }

  if (!organizationId || years.length === 0) {
    return {
      calendarByYear: new Map(),
      holidayKeysByYear: new Map()
    };
  }

  const calendars = await Calendar.find({
    organizationId,
    year: { $in: years }
  }).lean();

  const calendarByYear = new Map(calendars.map((calendar) => [calendar.year, calendar]));
  const holidayKeysByYear = new Map();

  for (const year of years) {
    const calendar = calendarByYear.get(year);
    const holidayKeys = new Set(
      (calendar?.holidays || [])
        .filter((holiday) => holiday?.isActive !== false)
        .map((holiday) => toYmd(holiday.date))
    );
    holidayKeysByYear.set(year, holidayKeys);
  }

  return { calendarByYear, holidayKeysByYear };
};

const isWorkingCalendarDay = (value, calendarByYear, holidayKeysByYear) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);

  const year = date.getFullYear();
  const calendar = calendarByYear.get(year);
  const workingDays = calendar?.workingDays || DEFAULT_WORKING_DAYS;
  const dayName = getDayName(date);
  const dateKey = toYmd(date);

  if (!workingDays?.[dayName]) return false;
  if (holidayKeysByYear.get(year)?.has(dateKey)) return false;
  return true;
};

/** Working day check for yyyy-MM-dd in org IANA timezone (team attendance history). */
const isWorkingCalendarDayKey = (dateKey, timezone, calendarByYear, holidayKeysByYear) => {
  const dt = parseDateKeyInTimezone(dateKey, timezone);
  const year = dt.year;
  const calendar = calendarByYear.get(year);
  const workingDays = calendar?.workingDays || DEFAULT_WORKING_DAYS;
  const dayName = getDayName(dt.toJSDate());

  if (!workingDays?.[dayName]) return false;
  if (holidayKeysByYear.get(year)?.has(dateKey)) return false;
  return true;
};

const minDateKey = (a, b) => (a <= b ? a : b);
const maxDateKey = (a, b) => (a >= b ? a : b);

const classifyTeamAttendanceRow = (record, leaveDaySet, userIdStr, dateYmd) => {
  if (record.status === 'absent') {
    if (leaveDaySet.has(`${userIdStr}|${dateYmd}`)) return 'leave';
    return 'absent';
  }
  if (isWorkFromHomeLocation(record.workLocation)) return 'wfh';
  if (record.isLateArrival) return 'late';
  // present, loggedOut, onBreak, half-day (with punch) — any non-absent logged session
  return 'present';
};

const matchesTeamAttendanceFilter = (row, statusFilter) => {
  if (!statusFilter || statusFilter === 'all') return true;

  if (statusFilter === 'present') {
    return ['present', 'late', 'wfh'].includes(row.uiStatus);
  }

  return row.uiStatus === statusFilter;
};

/**
 * Team attendance history — flat rows with KPIs and chart series for admin/HR/manager.
 */
export const getTeamAttendanceHistory = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      department,
      search,
      status: statusFilter,
      sort = 'date_desc',
      page = '1',
      limit = '25'
    } = req.query;

    const query = addOrganizationFilter(req, { active: true });
    const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
    if (isManager && req.employee) {
      const managerQuery = buildManagerMatchQuery(req.employee);
      if (managerQuery?.$or) query.$or = managerQuery.$or;
    } else if (department) {
      query.department = department;
    }

    let employees = await Employee.find(query)
      .select(
        '_id name lastName email department position employeeId active profilePhoto joiningDate lastWorkingDate terminationDate status'
      )
      .sort({ name: 1 })
      .lean();

    const q = (search || '').trim().toLowerCase();
    if (q) {
      employees = employees.filter((e) => {
        const name = `${e.name || ''} ${e.lastName || ''}`.toLowerCase();
        const mail = (e.email || '').toLowerCase();
        return name.includes(q) || mail.includes(q);
      });
    }

    const employeeIds = employees.map((e) => e._id);
    const lim = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 500);
    const pg = Math.max(parseInt(page, 10) || 1, 1);

    const empty = () =>
      res.json({
        success: true,
        total: 0,
        page: pg,
        limit: lim,
        kpis: {
          avgAttendancePct: 0,
          totalLateDays: 0,
          totalAbsentDays: 0,
          wfhDays: 0,
          leaveDays: 0
        },
        dailyTrend: [],
        memberBreakdown: [],
        records: []
      });

    if (!employeeIds.length) {
      return empty();
    }

    const organizationId = getOrganizationId(req);
    const orgTimezone = await getEffectiveTimezone(organizationId);
    const nowDt = DateTime.now().setZone(orgTimezone);

    let startDateKey;
    let endDateKey;
    let periodStart;
    let periodEnd;

    if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(String(startDate).slice(0, 10))) {
      startDateKey = String(startDate).slice(0, 10);
      periodStart = parseDateKeyInTimezone(startDateKey, orgTimezone).startOf('day').toJSDate();
    }
    if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(String(endDate).slice(0, 10))) {
      endDateKey = String(endDate).slice(0, 10);
      periodEnd = parseDateKeyInTimezone(endDateKey, orgTimezone).endOf('day').toJSDate();
    }
    if (!startDateKey || !endDateKey) {
      startDateKey = nowDt.startOf('month').toFormat('yyyy-MM-dd');
      endDateKey = nowDt.endOf('month').toFormat('yyyy-MM-dd');
      periodStart = nowDt.startOf('month').toJSDate();
      periodEnd = nowDt.endOf('month').toJSDate();
    }

    const leaveRows = await Leave.find(
      addOrganizationFilter(req, {
        employee: { $in: employeeIds },
        status: 'approved',
        startDate: { $lte: periodEnd },
        endDate: { $gte: periodStart }
      })
    )
      .select('employee startDate endDate')
      .lean();

    const leaveDaySet = new Set();
    for (const L of leaveRows) {
      const empKey = L.employee?.toString?.() || String(L.employee);
      let d = DateTime.fromJSDate(new Date(L.startDate), { zone: orgTimezone }).startOf('day');
      const last = DateTime.fromJSDate(new Date(L.endDate), { zone: orgTimezone }).startOf('day');
      while (d <= last) {
        const key = d.toFormat('yyyy-MM-dd');
        if (key >= startDateKey && key <= endDateKey) {
          leaveDaySet.add(`${empKey}|${key}`);
        }
        d = d.plus({ days: 1 });
      }
    }

    const { calendarByYear, holidayKeysByYear } = await buildCalendarLookups(
      organizationId,
      periodStart,
      periodEnd
    );

    const attQuery = addOrganizationFilter(req, {
      userId: { $in: employeeIds },
      ...buildAttendancePeriodFilter({ startDateKey, endDateKey, periodStart, periodEnd })
    });

    const rawRecords = await Attendance.find(attQuery)
      .populate('userId', 'name lastName email department position employeeId profilePhoto')
      .sort({ date: -1, createdAt: -1 })
      .lean();

    const mapped = [];
    const existingRowKeys = new Set();
    for (const record of rawRecords) {
      const pop = record.userId;
      if (!pop || !pop._id) continue;
      const userIdStr = pop._id.toString();
      const dateYmd = resolveAttendanceDateKey(record, orgTimezone);
      if (!dateYmd || dateYmd < startDateKey || dateYmd > endDateKey) continue;
      const rowKey = `${userIdStr}|${dateYmd}`;
      if (existingRowKeys.has(rowKey)) continue;
      existingRowKeys.add(rowKey);

      const uiStatus = classifyTeamAttendanceRow(record, leaveDaySet, userIdStr, dateYmd);

      let breakMinutes = 0;
      if (Array.isArray(record.breaks) && record.breaks.length > 0) {
        for (const b of record.breaks) {
          if (b?.breakIn && b?.breakOut) {
            const ms = new Date(b.breakOut) - new Date(b.breakIn);
            if (Number.isFinite(ms) && ms > 0) breakMinutes += Math.round(ms / 60000);
          }
        }
      }

      const displayDate = parseDateKeyInTimezone(dateYmd, orgTimezone).toJSDate();

      mapped.push({
        _id: record._id,
        date: displayDate,
        dateKey: dateYmd,
        attendanceDateKey: record.attendanceDateKey || dateYmd,
        timezoneUsed: record.timezoneUsed || orgTimezone,
        clockIn: record.clockIn,
        clockOut: record.clockOut,
        effectiveHours: record.effectiveHours,
        grossHours: record.grossHours,
        breakMinutes,
        status: record.status,
        uiStatus,
        workLocation: record.workLocation,
        isLateArrival: record.isLateArrival,
        employee: {
          _id: pop._id,
          name: pop.name,
          lastName: pop.lastName,
          email: pop.email,
          department: pop.department,
          position: pop.position,
          employeeId: pop.employeeId,
          profilePhoto: resolveProfilePhoto(pop.profilePhoto)
        }
      });
    }

    const todayKey = nowDt.toFormat('yyyy-MM-dd');

    for (const employee of employees) {
      const employeeIdStr = employee._id.toString();
      const employeePayload = {
        _id: employee._id,
        name: employee.name,
        lastName: employee.lastName,
        email: employee.email,
        department: employee.department,
        position: employee.position,
        employeeId: employee.employeeId,
        profilePhoto: resolveProfilePhoto(employee.profilePhoto)
      };

      let eligibleStartKey = startDateKey;
      if (employee.joiningDate) {
        const joiningKey = getDateKeyInTimezone(new Date(employee.joiningDate), orgTimezone);
        eligibleStartKey = maxDateKey(eligibleStartKey, joiningKey);
      }

      const employmentEndKeys = [endDateKey, todayKey];
      if (employee.lastWorkingDate) {
        employmentEndKeys.push(getDateKeyInTimezone(new Date(employee.lastWorkingDate), orgTimezone));
      } else if (employee.terminationDate) {
        employmentEndKeys.push(getDateKeyInTimezone(new Date(employee.terminationDate), orgTimezone));
      }
      const eligibleEndKey = employmentEndKeys.reduce(minDateKey);

      if (eligibleStartKey > eligibleEndKey) continue;

      let cursor = parseDateKeyInTimezone(eligibleStartKey, orgTimezone);
      const endCursor = parseDateKeyInTimezone(eligibleEndKey, orgTimezone);

      while (cursor <= endCursor) {
        const dateKey = cursor.toFormat('yyyy-MM-dd');
        if (isWorkingCalendarDayKey(dateKey, orgTimezone, calendarByYear, holidayKeysByYear)) {
          const rowKey = `${employeeIdStr}|${dateKey}`;

          if (!existingRowKeys.has(rowKey)) {
            const uiStatus = leaveDaySet.has(rowKey) ? 'leave' : 'absent';

            mapped.push({
              _id: `synthetic-${employeeIdStr}-${dateKey}-${uiStatus}`,
              date: cursor.toJSDate(),
              dateKey,
              attendanceDateKey: dateKey,
              timezoneUsed: orgTimezone,
              clockIn: null,
              clockOut: null,
              effectiveHours: 0,
              grossHours: 0,
              breakMinutes: 0,
              status: uiStatus === 'leave' ? 'leave' : 'absent',
              uiStatus,
              workLocation: null,
              isLateArrival: false,
              employee: employeePayload
            });
          }
        }

        cursor = cursor.plus({ days: 1 });
      }
    }

    const filtered = mapped.filter((row) => matchesTeamAttendanceFilter(row, statusFilter));

    const total = filtered.length;

    if (sort === 'date_asc') {
      filtered.sort((a, b) => (a.dateKey || '').localeCompare(b.dateKey || ''));
    } else {
      filtered.sort((a, b) => (b.dateKey || '').localeCompare(a.dateKey || ''));
    }

    const skip = (pg - 1) * lim;
    const pageRows = filtered.slice(skip, skip + lim);

    const strictAbsent = mapped.filter((r) => r.uiStatus === 'absent').length;
    const avgAttendancePct =
      mapped.length > 0 ? Math.round(((mapped.length - strictAbsent) / mapped.length) * 100) : 0;

    const totalLateDays = mapped.filter((r) => r.uiStatus === 'late').length;
    const totalAbsentDays = mapped.filter((r) => r.uiStatus === 'absent').length;
    const wfhDays = mapped.filter((r) => r.uiStatus === 'wfh').length;
    const leaveDays = mapped.filter((r) => r.uiStatus === 'leave').length;

    const byDate = {};
    for (const row of mapped) {
      const k = row.dateKey;
      if (!byDate[k]) byDate[k] = { total: 0, good: 0 };
      byDate[k].total += 1;
      if (row.uiStatus !== 'absent') byDate[k].good += 1;
    }
    const dailyTrend = Object.keys(byDate)
      .sort()
      .map((k) => {
        const { total: t, good: g } = byDate[k];
        const label = parseDateKeyInTimezone(k, orgTimezone)
          .toFormat('dd MMM')
          .toUpperCase();
        return {
          dateKey: k,
          label,
          pct: t ? Math.round((g / t) * 100) : 0,
          recordCount: t
        };
      });

    const byMember = {};
    for (const row of mapped) {
      const id = row.employee._id.toString();
      if (!byMember[id]) {
        byMember[id] = {
          employeeId: id,
          name: [row.employee.name, row.employee.lastName].filter(Boolean).join(' ').trim(),
          title: row.employee.position || '—',
          present: 0,
          late: 0,
          absent: 0,
          wfh: 0,
          leave: 0
        };
      }
      byMember[id][row.uiStatus] += 1;
    }
    const memberBreakdown = Object.values(byMember)
      .sort(
        (a, b) =>
          b.present + b.late + b.wfh + b.absent + b.leave - (a.present + a.late + a.wfh + a.absent + a.leave)
      )
      .slice(0, 12);

    return res.json({
      success: true,
      total,
      page: pg,
      limit: lim,
      kpis: {
        avgAttendancePct,
        totalLateDays,
        totalAbsentDays,
        wfhDays,
        leaveDays
      },
      dailyTrend,
      memberBreakdown,
      records: pageRows
    });
  } catch (error) {
    logger.error('getTeamAttendanceHistory failed', {
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load team attendance history'
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
          locationRequired: false,
          enforceOfficeRadius: false
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

    // Location required whenever rule applies and employee must follow geofence rules (incl. simple punches).
    // Office radius is enforced only when simple punches are off.
    const hasValidCoordinates = activeRule.coordinates &&
                                 typeof activeRule.coordinates.latitude === 'number' &&
                                 typeof activeRule.coordinates.longitude === 'number' &&
                                 !isNaN(activeRule.coordinates.latitude) &&
                                 !isNaN(activeRule.coordinates.longitude) &&
                                 activeRule.coordinates.latitude !== 0 &&
                                 activeRule.coordinates.longitude !== 0;

    const locationRequired = appliesToDept &&
                            !isExempt &&
                            hasValidCoordinates;

    const enforceOfficeRadius = locationRequired && !activeRule.enableSimplePunches;

    // Return public rule information
    return res.json({
      success: true,
      rule: {
        location: activeRule.location,
        address: activeRule.address,
        coordinates: activeRule.coordinates,
        maximumRadius: activeRule.maximumRadius || 500,
        enableSimplePunches: activeRule.enableSimplePunches || false,
        locationRequired,
        enforceOfficeRadius,
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

