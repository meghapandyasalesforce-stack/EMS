import AttendanceRegularization from '../models/attendanceRegularization.model.js';
import Attendance from '../models/attendance.model.js';
import AttendanceRule from '../models/attendanceRule.model.js';
import { ApprovalInstance } from '../models/approvalWorkflow.model.js';
import logger from '../helpers/logger.js';
import { ensureClockOutAfterClockIn } from '../helpers/attendanceRegularizationTimeHelper.js';

const DEFAULT_OFFICE_START = '09:00';
const DEFAULT_OFFICE_END = '17:00';

function parseTimeParts(timeValue, fallbackTime) {
    const source = typeof timeValue === 'string' && timeValue.includes(':') ? timeValue : fallbackTime;
    const [hStr, mStr] = source.split(':');
    const hours = Number(hStr);
    const minutes = Number(mStr);
    return {
        hours: Number.isFinite(hours) ? Math.max(0, Math.min(23, hours)) : 9,
        minutes: Number.isFinite(minutes) ? Math.max(0, Math.min(59, minutes)) : 0
    };
}

function setClockWithTime(anchorDay, timeValue, fallbackTime) {
    const out = new Date(anchorDay);
    const { hours, minutes } = parseTimeParts(timeValue, fallbackTime);
    out.setHours(hours, minutes, 0, 0);
    return out;
}

async function getDefaultOfficeDateTimes(organizationId, anchorDay) {
    const activeRule = await AttendanceRule.findOne({
        organizationId,
        isActive: true
    })
        .sort({ priority: -1, updatedAt: -1 })
        .select('officeHours checkInOutTimes')
        .lean();

    const startTime =
        activeRule?.officeHours?.startTime ||
        activeRule?.checkInOutTimes?.checkInStartTime ||
        DEFAULT_OFFICE_START;
    const endTime =
        activeRule?.officeHours?.endTime ||
        activeRule?.checkInOutTimes?.checkOutStartTime ||
        DEFAULT_OFFICE_END;

    return {
        defaultClockIn: setClockWithTime(anchorDay, startTime, DEFAULT_OFFICE_START),
        defaultClockOut: setClockWithTime(anchorDay, endTime, DEFAULT_OFFICE_END)
    };
}

async function populateRegularization(regularizationRequest) {
    await regularizationRequest.populate('employeeId', 'name lastName email employeeId department');
    await regularizationRequest.populate('managerId', 'name lastName email employeeId');
    await regularizationRequest.populate('reviewedBy', 'name lastName email employeeId');
    return regularizationRequest;
}

export async function applyRegularizationApproval({
    regularizationRequest,
    organizationId,
    reviewerId = null,
    managerResponse = 'Approved'
}) {
    if (!regularizationRequest) {
        throw new Error('Regularization request is required');
    }

    regularizationRequest.status = 'approved';
    regularizationRequest.reviewedAt = new Date();
    regularizationRequest.managerResponse = managerResponse;
    if (reviewerId) {
        regularizationRequest.reviewedBy = reviewerId;
    }

    await regularizationRequest.save();

    const attendanceDate = new Date(regularizationRequest.attendanceDate);
    const startOfDay = new Date(attendanceDate);
    startOfDay.setHours(0, 0, 0, 0);

    const employeeRef = regularizationRequest.employeeId?._id || regularizationRequest.employeeId;
    let attendanceRecord = await Attendance.findOne({
        userId: employeeRef,
        date: startOfDay,
        organizationId
    });

    const { defaultClockIn, defaultClockOut } = await getDefaultOfficeDateTimes(organizationId, startOfDay);

    let clockInTime = regularizationRequest.requestedClockIn || attendanceRecord?.clockIn || defaultClockIn;
    let clockOutTime = regularizationRequest.requestedClockOut || attendanceRecord?.clockOut || defaultClockOut;

    const fixed = ensureClockOutAfterClockIn(clockInTime, clockOutTime);
    clockInTime = fixed.clockInTime;
    clockOutTime = fixed.clockOutTime;

    if (!attendanceRecord) {
        attendanceRecord = new Attendance({
            organizationId,
            userId: employeeRef,
            date: startOfDay,
            clockIn: clockInTime,
            clockOut: clockOutTime,
            status: 'present',
            workLocation: 'office'
        });
    } else {
        attendanceRecord.clockIn = clockInTime;
        attendanceRecord.clockOut = clockOutTime;
        attendanceRecord.status = 'present';
    }

    try {
        await attendanceRecord.save();
    } catch (saveError) {
        if (saveError?.code === 11000) {
            attendanceRecord = await Attendance.findOne({
                userId: employeeRef,
                date: startOfDay,
                organizationId
            });

            if (!attendanceRecord) {
                throw saveError;
            }

            attendanceRecord.clockIn = clockInTime;
            attendanceRecord.clockOut = clockOutTime;
            attendanceRecord.status = 'present';
            await attendanceRecord.save();
        } else {
            throw saveError;
        }
    }

    regularizationRequest.attendanceRecordId = attendanceRecord._id;
    await regularizationRequest.save();

    logger.info('Attendance regularization approved', {
        requestId: regularizationRequest._id,
        reviewerId,
        employeeId: employeeRef,
        attendanceRecordId: attendanceRecord._id
    });

    return populateRegularization(regularizationRequest);
}

export async function applyRegularizationRejection({
    regularizationRequest,
    reviewerId = null,
    rejectionReason = 'Rejected'
}) {
    if (!regularizationRequest) {
        throw new Error('Regularization request is required');
    }

    regularizationRequest.status = 'rejected';
    regularizationRequest.reviewedAt = new Date();
    regularizationRequest.managerResponse = rejectionReason;
    if (reviewerId) {
        regularizationRequest.reviewedBy = reviewerId;
    }

    await regularizationRequest.save();

    logger.info('Attendance regularization rejected', {
        requestId: regularizationRequest._id,
        reviewerId,
        employeeId: regularizationRequest.employeeId?._id || regularizationRequest.employeeId
    });

    return populateRegularization(regularizationRequest);
}

export async function cancelRegularizationApprovalWorkflow({ approvalInstanceId, actorId = null }) {
    if (!approvalInstanceId) {
        return;
    }

    const approvalInstance = await ApprovalInstance.findById(approvalInstanceId);
    if (!approvalInstance || approvalInstance.status !== 'In Progress') {
        return;
    }

    approvalInstance.status = 'Cancelled';
    approvalInstance.rejectedAt = new Date();
    if (actorId) {
        approvalInstance.rejectedBy = actorId;
    }
    approvalInstance.rejectionReason = 'Request cancelled by employee';
    await approvalInstance.save();
}
