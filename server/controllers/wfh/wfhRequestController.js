import WfhRequest from "../../models/wfhRequest.model.js";
import { shouldScopeDataToManagedTeam } from '../../helpers/permissionService.js';
import Employee from "../../models/employee.model.js";
import logger from "../../helpers/logger.js";
import { getOrganizationId, addOrganizationFilter } from "../../helpers/organizationHelper.js";
import { getLeaveNotificationEmails } from "../../helpers/leaveEmailHelper.js";
import { sendWfhApprovalEmail, sendWfhRejectionEmail, sendWfhRequestEmail } from "../../helpers/emailSender.js";
import { runInBackground } from "../../helpers/backgroundTasks.js";
import { getManagerEmployeeIds } from "../../helpers/managerHelper.js";

/**
 * Create a Work From Home request (employee).
 * Informational only — notifies manager/HR/admin by email.
 * Does NOT affect attendance, punches, or leave.
 */
export const createWfhRequest = async (req, res) => {
    try {
        if (!req.employee || !req.employee._id) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please log in again.',
                code: 'AUTHENTICATION_REQUIRED'
            });
        }

        const organizationId = getOrganizationId(req);
        if (!organizationId) {
            return res.status(400).json({
                success: false,
                message: 'Organization ID is required',
                code: 'MISSING_ORGANIZATION_ID'
            });
        }

        const { wfhDate, wfhDateFrom, wfhDateTo, wfhType, halfDayType, reason, remarks } = req.body;
        const fromDateRaw = wfhDateFrom || wfhDate;
        const fromDate = fromDateRaw ? new Date(fromDateRaw) : null;
        const toDateRaw = wfhDateTo || fromDateRaw;
        const toDate = toDateRaw ? new Date(toDateRaw) : null;

        // Default to full_day for backward compatibility
        const normalizedWfhType = wfhType || 'full_day';

        if (!fromDate || Number.isNaN(fromDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'A valid WFH start date is required'
            });
        }
        if (!toDate || Number.isNaN(toDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'A valid WFH end date is required'
            });
        }
        if (toDate < fromDate) {
            return res.status(400).json({
                success: false,
                message: 'WFH end date cannot be before the start date'
            });
        }

        // Half Day WFH specific validations
        if (normalizedWfhType === 'half_day') {
            if (!halfDayType || !['first_half', 'second_half'].includes(halfDayType)) {
                return res.status(400).json({
                    success: false,
                    message: 'Please select First Half or Second Half for Half Day WFH'
                });
            }
            // Half Day WFH can only be for a single date
            if (fromDate.toDateString() !== toDate.toDateString()) {
                return res.status(400).json({
                    success: false,
                    message: 'Half Day WFH can only be requested for a single date'
                });
            }
        }

        if (!reason || !String(reason).trim()) {
            return res.status(400).json({
                success: false,
                message: 'Reason is required'
            });
        }

        const wfhRequest = await WfhRequest.create({
            organizationId,
            employeeId: req.employee._id,
            wfhDate: fromDate,
            wfhDateTo: toDate,
            wfhType: normalizedWfhType,
            halfDayType: normalizedWfhType === 'half_day' ? halfDayType : undefined,
            reason: String(reason).trim(),
            remarks: remarks ? String(remarks).trim() : ''
        });

        // Send notification email in the background so the API responds quickly.
        runInBackground('wfh-request-email', async () => {
            const employee = await Employee.findById(req.employee._id).lean();
            if (!employee) return;

            const { managerEmail, ccEmails } = await getLeaveNotificationEmails(employee, organizationId);

            if (!managerEmail && (!ccEmails || ccEmails.length === 0)) {
                logger.warn('No recipients found for WFH request email', {
                    wfhRequestId: wfhRequest._id,
                    employeeId: employee._id
                });
                return;
            }

            // If no manager, send directly to the first CC recipient (HR/Admin)
            const toEmail = managerEmail || ccEmails[0];
            const cc = managerEmail ? ccEmails : ccEmails.slice(1);

            await sendWfhRequestEmail(
                {
                    employeeName: [employee.name, employee.lastName].filter(Boolean).join(' '),
                    employeeId: employee.employeeId,
                    department: employee.department,
                    designation: employee.position,
                    wfhDate: wfhRequest.wfhDate,
                    wfhDateTo: wfhRequest.wfhDateTo,
                    wfhType: wfhRequest.wfhType,
                    halfDayType: wfhRequest.halfDayType,
                    reason: wfhRequest.reason,
                    remarks: wfhRequest.remarks,
                    submittedAt: wfhRequest.createdAt,
                    managerName: employee.manager || 'Manager'
                },
                toEmail,
                cc,
                employee.email
            );

            await WfhRequest.updateOne({ _id: wfhRequest._id }, { $set: { emailSent: true } });

            logger.info('WFH request email dispatched', {
                wfhRequestId: wfhRequest._id,
                employeeId: employee._id
            });
        });

        return res.status(201).json({
            success: true,
            message: 'Work From Home request submitted successfully. Your manager, HR, and admin will be notified by email.',
            request: wfhRequest
        });
    } catch (error) {
        logger.error('Error creating WFH request', {
            error: error.message,
            stack: error.stack,
            employeeId: req.employee?._id
        });
        return res.status(500).json({
            success: false,
            message: 'Failed to submit Work From Home request'
        });
    }
};

/**
 * List the logged-in employee's own WFH requests.
 */
export const getMyWfhRequests = async (req, res) => {
    try {
        if (!req.employee || !req.employee._id) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please log in again.',
                code: 'AUTHENTICATION_REQUIRED'
            });
        }

        const organizationId = getOrganizationId(req);
        const requests = await WfhRequest.find({
            organizationId,
            employeeId: req.employee._id
        })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        return res.json({ success: true, requests });
    } catch (error) {
        logger.error('Error fetching my WFH requests', {
            error: error.message,
            employeeId: req.employee?._id
        });
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch Work From Home requests'
        });
    }
};

/**
 * List all WFH requests for the organization (admin / HR / manager).
 */
export const getAllWfhRequests = async (req, res) => {
    try {
        const { startDate, endDate, page = '1', limit = '25' } = req.query;

        const organizationId = getOrganizationId(req);
        const filter = addOrganizationFilter(req, {});

        // Managers should only see WFH applications submitted by their team.
        // HR and admins retain organization-wide visibility.
        const isManager = shouldScopeDataToManagedTeam(req);
        if (isManager) {
            const teamEmployeeIds = await getManagerEmployeeIds(Employee, organizationId, req.employee);
            filter.employeeId = { $in: teamEmployeeIds };
        }
        if (startDate || endDate) {
            filter.wfhDate = {};
            if (startDate && !Number.isNaN(new Date(startDate).getTime())) {
                filter.wfhDate.$gte = new Date(startDate);
            }
            if (endDate && !Number.isNaN(new Date(endDate).getTime())) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.wfhDate.$lte = end;
            }
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

        const [requests, total] = await Promise.all([
            WfhRequest.find(filter)
                .populate({
                    path: 'employeeId',
                    select: 'name lastName email department position employeeId manager managerId profilePhoto',
                    populate: {
                        path: 'managerId',
                        select: 'name lastName employeeId'
                    }
                })
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .lean(),
            WfhRequest.countDocuments(filter)
        ]);

        return res.json({
            success: true,
            requests,
            total,
            page: pageNum,
            limit: limitNum
        });
    } catch (error) {
        logger.error('Error fetching WFH requests', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch Work From Home requests'
        });
    }
};

/**
 * Approve or reject a WFH request (admin / HR / manager).
 * PUT /api/v1/both/wfh-requests/:id/review  { action: 'approve' | 'reject', note? }
 */
export const reviewWfhRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { action, note } = req.body;

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({
                success: false,
                message: "Action must be 'approve' or 'reject'"
            });
        }
        if (action === 'reject' && (!note || !String(note).trim())) {
            return res.status(400).json({
                success: false,
                message: 'A rejection reason is required'
            });
        }

        const filter = addOrganizationFilter(req, { _id: id });
        const wfhRequest = await WfhRequest.findOne(filter);
        if (!wfhRequest) {
            return res.status(404).json({
                success: false,
                message: 'Work From Home request not found'
            });
        }

        if (wfhRequest.status === 'approved' || wfhRequest.status === 'rejected') {
            return res.status(409).json({
                success: false,
                message: `This request has already been ${wfhRequest.status}`
            });
        }

        // Managers may only act on requests from their own team.
        const organizationId = getOrganizationId(req);
        const isManager = shouldScopeDataToManagedTeam(req);
        if (isManager) {
            const teamEmployeeIds = await getManagerEmployeeIds(Employee, organizationId, req.employee);
            const inTeam = teamEmployeeIds.some(
                (empId) => String(empId) === String(wfhRequest.employeeId)
            );
            if (!inTeam) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only review Work From Home requests from your team'
                });
            }
        }

        const reviewer = req.employee || req.user;
        const reviewerName = [reviewer?.name, reviewer?.lastName].filter(Boolean).join(' ').trim();

        wfhRequest.status = action === 'approve' ? 'approved' : 'rejected';
        wfhRequest.reviewedBy = req.employee?._id || null;
        wfhRequest.reviewerName = reviewerName || 'Admin';
        wfhRequest.reviewNote = note ? String(note).trim() : '';
        wfhRequest.reviewedAt = new Date();
        await wfhRequest.save();

        // Notify the employee after the decision without delaying the API response.
        runInBackground('wfh-review-email', async () => {
            const employee = await Employee.findById(wfhRequest.employeeId)
                .select('name lastName email employeeId manager managerId organizationId')
                .populate('managerId', 'name lastName')
                .lean();
            if (!employee?.email) {
                logger.warn('Employee email not found for WFH decision notification', {
                    wfhRequestId: wfhRequest._id,
                    employeeId: wfhRequest.employeeId
                });
                return;
            }

            const employeeName = [employee.name, employee.lastName].filter(Boolean).join(' ').trim() || 'Employee';
            const linkedManagerName = employee.managerId && typeof employee.managerId === 'object'
                ? [employee.managerId.name, employee.managerId.lastName].filter(Boolean).join(' ').trim()
                : '';
            const managerName = linkedManagerName || employee.manager || 'N/A';

            const { managerEmail, ccEmails } = await getLeaveNotificationEmails(
                employee,
                employee.organizationId || organizationId
            );
            const decisionCc = [...new Set([managerEmail, ...(ccEmails || [])].filter(Boolean))];

            const wfhEmailData = {
                employeeName,
                employeeId: employee.employeeId,
                wfhDate: wfhRequest.wfhDate,
                wfhDateTo: wfhRequest.wfhDateTo,
                wfhType: wfhRequest.wfhType,
                halfDayType: wfhRequest.halfDayType,
                managerName,
                reviewerName: wfhRequest.reviewerName,
                reason: wfhRequest.reason,
                remarks: wfhRequest.remarks,
                reviewNote: wfhRequest.reviewNote
            };

            if (wfhRequest.status === 'approved') {
                await sendWfhApprovalEmail(wfhEmailData, employee.email, decisionCc);
            } else {
                await sendWfhRejectionEmail(wfhEmailData, employee.email, decisionCc);
            }

            logger.info('WFH decision email sent', {
                wfhRequestId: wfhRequest._id,
                employeeId: wfhRequest.employeeId,
                decision: wfhRequest.status
            });
        });

        return res.json({
            success: true,
            message: `Work From Home request ${wfhRequest.status}`,
            request: wfhRequest
        });
    } catch (error) {
        logger.error('Error reviewing WFH request', {
            error: error.message,
            stack: error.stack,
            requestId: req.params?.id
        });
        return res.status(500).json({
            success: false,
            message: 'Failed to review Work From Home request'
        });
    }
};
