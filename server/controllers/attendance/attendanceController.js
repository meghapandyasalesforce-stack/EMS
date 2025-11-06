import Attendance from "../../models/attendance.model.js";
import Employee from "../../models/employee.model.js"
import AttendanceRule from "../../models/attendanceRule.model.js";
import User from "../../models/user.model.js";
import mongoose from 'mongoose';
import logger from "../../helpers/logger.js";
import { sendBreakNotification, sendNotificationToUsers } from "../../helpers/notificationService.js";


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
  const userId = req.employee._id;
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));

  try {
    // Load active attendance rule (if any)
    const activeRule = await AttendanceRule.findOne({ isActive: true }).lean();

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

    const existing = await Attendance.findOne({ userId, date: startOfDay });
    if (existing) {
      return res.status(400).json({
        message: "Already clocked in for today",
        session: existing
      });
    }

    const clockInTime = new Date();
    const officeStartTime = new Date(startOfDay);
    officeStartTime.setHours(OFFICE_START_TIME, 0, 0, 0);

    // Apply grace period for late arrival if rule enabled
    let effectiveStartTime = new Date(officeStartTime);
    if (activeRule?.enablePenaltyRules && activeRule?.penaltyRules?.lateArrival?.enabled) {
      const graceMinutes = Number(activeRule.penaltyRules.lateArrival.gracePeriod || 0);
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

    // Extract geolocation information
    const locationInfo = {
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      address: req.body.address,
      accuracy: req.body.accuracy
    };

    let locationMatch = false;
    let locationDistance = null;

    // Enforce geofence if rule present and simple punches disabled
    if (activeRule && !activeRule.enableSimplePunches) {
      const empDept = req.employee?.department;
      const appliesToDept = !activeRule.applicableDepartments?.length ||
        (empDept && activeRule.applicableDepartments.includes(empDept));

      if (appliesToDept) {
        if (
          typeof locationInfo.latitude !== 'number' ||
          typeof locationInfo.longitude !== 'number'
        ) {
          return res.status(400).json({
            message: 'Location is required to clock in at this site'
          });
        }
        locationDistance = distanceInMeters(
          locationInfo.latitude,
          locationInfo.longitude,
          activeRule.coordinates.latitude,
          activeRule.coordinates.longitude
        );
        if (locationDistance > (activeRule.maximumRadius || 500)) {
          return res.status(400).json({
            message: `Outside allowed radius (${Math.round(locationDistance)}m > ${activeRule.maximumRadius}m)`
          });
        }
        locationMatch = true;
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
      }
    }

    // Handle image upload
    const imageInfo = {
      url: req.body.imageUrl,
      filename: req.body.imageFilename
    };

    const attendance = await Attendance.create({
      userId,
      date: startOfDay,
      clockIn: clockInTime,
      breaks: [],
      status: "present",
      isLateArrival,
      isOnTime: !isLateArrival,
      workLocation: req.body.workLocation || "office",
      clockInImage: imageInfo,
      clockInLocation: locationInfo,
      clockInNetwork: networkInfo
    });

    // Send notification to admins about check-in
    try {
      const employee = await Employee.findById(userId).select('name lastName email department position');
      const admins = await User.find({ role: 'admin' }).select('_id');
      
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

    res.status(201).json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const breakIn = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const attendance = await Attendance.findOne({ userId: req.employee._id, date: startOfDay });

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
      const employee = await Employee.findById(req.employee._id).select('name lastName email');
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
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const attendance = await Attendance.findOne({ userId: req.employee._id, date: startOfDay });

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
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));

  try {
    // Load active rule to apply early-departure grace
    const activeRule = await AttendanceRule.findOne({ isActive: true }).lean();
    const attendance = await Attendance.findOne({ userId: req.employee._id, date: startOfDay });

    if (!attendance || attendance.clockOut) {
      return res.status(400).json({ message: "Already clocked out or no clock-in record" });
    }

    // Check if user is on break by examining the breaks array (more reliable than status field)
    const hasActiveBreak = attendance.breaks?.some(b => b.breakIn && !b.breakOut) || false;
    if (hasActiveBreak) {
      return res.status(400).json({ message: "Please end your break before clocking out" });
    }

    // Get real IP address for check-out
    const clientIP = getClientIP(req);
    const checkInIP = attendance.clockInNetwork?.ipAddress;

    // Validate IP address matches check-in IP
    if (checkInIP && checkInIP !== 'unknown') {
      // Normalize IPs (remove port if present, handle IPv6)
      const normalizeIP = (ip) => {
        if (!ip) return '';
        // Remove port if present
        const ipOnly = ip.split(':')[0];
        // Handle IPv4-mapped IPv6 addresses
        return ipOnly.replace(/^::ffff:/, '');
      };

      const normalizedCheckInIP = normalizeIP(checkInIP);
      const normalizedCheckOutIP = normalizeIP(clientIP);

      if (normalizedCheckInIP !== normalizedCheckOutIP) {
        return res.status(400).json({ 
          message: `IP address mismatch. You checked in from IP: ${checkInIP}, but you're trying to check out from IP: ${clientIP}. Please use the same device/network you used for check-in.`,
          checkInIP: checkInIP,
          checkOutIP: clientIP
        });
      }
    }

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

    // Extract geolocation information for clock out
    const locationInfo = {
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      address: req.body.address,
      accuracy: req.body.accuracy
    };

    // Enforce geofence if rule present and simple punches disabled
    if (activeRule && !activeRule.enableSimplePunches) {
      const empDept = req.employee?.department;
      const appliesToDept = !activeRule.applicableDepartments?.length ||
        (empDept && activeRule.applicableDepartments.includes(empDept));

      if (appliesToDept) {
        if (
          typeof locationInfo.latitude !== 'number' ||
          typeof locationInfo.longitude !== 'number'
        ) {
          return res.status(400).json({
            message: 'Location is required to clock out at this site'
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
            message: `Outside allowed radius for checkout (${Math.round(dist)}m > ${activeRule.maximumRadius}m)`
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
    const { startDate, endDate } = req.query;
    const userId = req.employee._id;
    const query = { userId };

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
    const startOfDay = new Date(new Date().setHours(0, 0, 0, 0));
    
    // Get all attendance records for today with status 'onBreak'
    const attendanceRecords = await Attendance.find({ 
      date: startOfDay,
      status: 'onBreak'
    })
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
  const startOfDay = new Date(new Date().setHours(0, 0, 0, 0));
  const now = new Date();

  try {
    // 1. Get all active employees
    const allEmployees = await Employee.find({}, '_id name email department position employeeId');
    
    // 2. Get today's attendance records with breaks populated
    const attendanceRecords = await Attendance.find({ date: startOfDay })
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
    const startOfDay = new Date(new Date().setHours(0, 0, 0, 0));
    const session = await Attendance.findOne({ userId: req.employee._id, date: startOfDay });
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const getEmployeeList = async (req, res) => {
  try {
    const { department, includeInactive } = req.query;
    
    const query = { active: true }; // Default to only active employees
    if (department) query.department = department;
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
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const attendance = await Attendance.findOne({ userId: req.employee._id, date: startOfDay });

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

export const getEmployeeAttendanceDetails = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;

    // Validate employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Date filtering
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const query = { userId: employeeId };
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

