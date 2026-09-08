import crypto from 'crypto';
import path from 'path';
import EmployeeDocumentRequest from '../models/employeeDocumentRequest.model.js';
import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import { getOrganizationId } from '../helpers/organizationHelper.js';
import { buildDocumentS3Key } from '../helpers/documentFilePathHelper.js';
import { sendDocumentFile } from '../helpers/documentFileStorageHelper.js';
import { uploadFile, deleteFile } from '../helpers/storageHelper.js';
import { sendNotification } from '../helpers/notificationService.js';
import logger from '../helpers/logger.js';

const getUploadBuffer = (file) => {
  if (file?.buffer?.length) return file.buffer;
  return null;
};

const uploadRequestFileToS3 = async (buffer, organizationId, originalName, mimeType) => {
  const ext = path.extname(originalName || '').toLowerCase() || '';
  const safeBase = String(originalName || 'employee-document')
    .replace(ext, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 60) || 'employee-document';
  const filename = `employee-doc-request-${safeBase}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
  const s3Key = buildDocumentS3Key(organizationId, filename);
  await uploadFile(buffer, s3Key, mimeType || 'application/octet-stream', false);
  return { s3Key, filename };
};

const sendBinaryDocument = (res, { buffer, downloadName, mimeType }) => {
  const safeName = String(downloadName || 'employee-document').replace(/[^\w.\- ]+/g, '_');
  res.status(200);
  res.setHeader('Content-Type', mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.setHeader('Content-Length', String(buffer.length));
  return res.end(buffer);
};

const formatEmployeeName = (employee) => {
  const name = [employee?.name, employee?.lastName].filter(Boolean).join(' ').trim();
  return name || 'An employee';
};

/**
 * HR / Admin recipients who should see new employee document requests.
 */
const getDocumentRequestApproverRecipients = async (organizationId) => {
  const recipientIds = new Set();

  const admins = await User.find({
    role: 'admin',
    organizationId,
    isActive: true,
  }).select('_id').lean();
  admins.forEach((admin) => recipientIds.add(admin._id.toString()));

  const platformHrUsers = await User.find({
    organizationId,
    isActive: true,
    roles: { $in: ['hr_admin', 'hr_executive', 'org_owner'] },
  }).select('_id').lean();
  platformHrUsers.forEach((user) => recipientIds.add(user._id.toString()));

  const hrEmployees = await Employee.find({
    organizationId,
    status: 'active',
    $or: [
      { functionalRoles: { $in: ['hr', 'HR'] } },
      { department: { $regex: /hr/i } },
      { jobTitle: { $regex: /hr/i } },
      { position: { $regex: /hr/i } },
    ],
  }).select('_id').lean();
  hrEmployees.forEach((hr) => recipientIds.add(hr._id.toString()));

  return [...recipientIds];
};

/**
 * Notify HR/Admin that an employee submitted a document request.
 */
const notifyHrOfNewDocumentRequest = async (request, employee, senderReq) => {
  try {
    const recipients = await getDocumentRequestApproverRecipients(request.organizationId);
    const employeeName = formatEmployeeName(employee);
    const excludeIds = new Set(
      [request.employeeId, request.requestedBy, actorId(senderReq)]
        .filter(Boolean)
        .map((id) => String(id))
    );

    const targetRecipients = recipients.filter((userId) => !excludeIds.has(String(userId)));
    if (targetRecipients.length === 0) {
      logger.warn('No HR/Admin recipients found for document request notification', {
        requestId: request._id,
        organizationId: request.organizationId,
        recipientCountBeforeExclude: recipients.length,
      });
      return;
    }

    const purposeSuffix = request.purpose ? ` Purpose: ${request.purpose}` : '';
    const results = await Promise.allSettled(
      targetRecipients.map((userId) =>
        sendNotification({
          userId,
          organizationId: request.organizationId,
          title: 'New Document Request',
          message: `${employeeName} requested a ${request.documentType}.${purposeSuffix}`,
          type: 'document_request',
          priority: 'high',
          metadata: {
            requestId: String(request._id),
            documentType: request.documentType,
            employeeId: String(request.employeeId),
            employeeName,
            action: 'requested',
            link: '/admin/document-management',
          },
          senderId: actorId(senderReq),
          senderType: actorType(senderReq),
        })
      )
    );

    const failed = results.filter((r) => r.status === 'rejected');
    logger.info('Document request HR notifications dispatched', {
      requestId: request._id,
      recipientCount: targetRecipients.length,
      failedCount: failed.length,
    });
  } catch (err) {
    logger.error('Failed to notify HR of new document request', {
      error: err.message,
      requestId: request._id,
    });
  }
};

/**
 * Send a document-request notification to the employee who raised the request.
 */
const notifyEmployee = async (request, action, senderReq) => {
  try {
    const actionMessages = {
      approved: `Your ${request.documentType} request has been approved.`,
      rejected: `Your ${request.documentType} request has been rejected.${request.rejectionReason ? ' Reason: ' + request.rejectionReason : ''}`,
      uploaded: `The document for your ${request.documentType} request has been uploaded and is ready for download.`,
      completed: `Your ${request.documentType} request has been completed.`,
    };
    const message = actionMessages[action] || `Your ${request.documentType} request has been updated.`;
    await sendNotification({
      userId: request.employeeId,
      title: 'Document Request Update',
      message,
      type: 'document_request',
      priority: 'medium',
      metadata: {
        requestId: request._id,
        documentType: request.documentType,
        action,
      },
      senderId: actorId(senderReq),
      senderType: actorType(senderReq),
    });
  } catch (err) {
    logger.error('Failed to send document request notification', { error: err.message, requestId: request._id, action });
  }
};

const isAdmin = (req) => Boolean(req.authContext?.isOrgOwner || req.user?.role === 'admin');
const isHrManager = (req) => Boolean(req.authContext?.isHrManager);
const isHrExecutive = (req) => Boolean(req.authContext?.isHrExecutive);
const hasHrFunctionalRole = (req) => {
  const roles = req.employee?.functionalRoles || [];
  return roles.some((role) => String(role).toLowerCase() === 'hr');
};
const isHrStaff = (req) => isHrManager(req) || isHrExecutive(req) || hasHrFunctionalRole(req);
const isHrOrAdmin = (req) => isAdmin(req) || isHrStaff(req);
const actorId = (req) => req.employee?._id || req.user?._id;
const actorType = (req) => req.employee?._id ? 'Employee' : 'User';
const isSelf = (req, employeeId) => String(req.employee?._id || '') === String(employeeId || '');

const resolveApprovalRequirement = (req) => {
  if (isAdmin(req)) return 'none';
  if (isHrManager(req)) return 'admin';
  return 'hr_or_admin';
};

const canApproveRequest = (req, request) => {
  if (isAdmin(req)) return true;
  if (request.approvalRequiredFrom === 'hr_or_admin' && isHrStaff(req)) return true;
  return false;
};

const canManageUpload = (req, request) => {
  if (isAdmin(req)) return true;
  if (request.approvalRequiredFrom === 'hr_or_admin' && isHrStaff(req)) return true;
  return false;
};

const buildGeneratedText = (request) => {
  const details = request.generationDetails || {};
  const employeeName = details.employeeName || details.name || 'Employee';
  const companyName = details.companyName || 'Company';
  const title = request.documentType || 'Employment Letter';
  return `${title}\n\nThis is to certify that ${employeeName} is associated with ${companyName}.\n\nPurpose: ${request.purpose || details.purpose || 'Official employment document'}\nCountry: ${request.country}\nFormat: ${request.documentSize} / ${request.documentFormat}\n\nSignature: ${request.signatureFormat || 'Authorized Signatory'}\n\nGenerated on ${new Date().toLocaleDateString('en-IN')}.\n`;
};

export const createEmployeeDocumentRequest = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    const requester = actorId(req);
    if (!organizationId || !requester) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const targetEmployeeId = isAdmin(req) && req.body.employeeId ? req.body.employeeId : req.employee?._id;
    if (!targetEmployeeId) return res.status(400).json({ success: false, message: 'employeeId is required' });
    const approvalRequiredFrom = resolveApprovalRequirement(req);
    const status = approvalRequiredFrom === 'none' ? 'approved' : 'pending';
    const request = await EmployeeDocumentRequest.create({
      organizationId, employeeId: targetEmployeeId, requestedBy: requester,
      requestMode: approvalRequiredFrom === 'none' ? 'admin_direct' : 'request',
      documentType: String(req.body.documentType || 'Employment Letter').trim(),
      purpose: String(req.body.purpose || '').trim(), country: req.body.country || 'India',
      documentSize: req.body.documentSize || 'A4', documentFormat: req.body.documentFormat || 'PDF',
      templateKey: req.body.templateKey || '', signatureFormat: req.body.signatureFormat || '',
      requestDetails: req.body.requestDetails || {}, approvalRequiredFrom, status,
      ...(status === 'approved' ? { approvedBy: requester, approvedByType: actorType(req), approvedAt: new Date() } : {}),
    });

    // Notify HR/Admin when an employee raises a request that needs approval
    if (status === 'pending') {
      const employee = await Employee.findById(targetEmployeeId).select('name lastName email').lean();
      await notifyHrOfNewDocumentRequest(request, employee, req);
    }

    res.status(201).json({ success: true, data: request });
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to create document request', error: error.message }); }
};

export const listMyEmployeeDocumentRequests = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    const employeeId = req.employee?._id || req.query.employeeId;
    if (!organizationId || !employeeId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const data = await EmployeeDocumentRequest.find({ organizationId, employeeId }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to load document requests', error: error.message }); }
};

export const listApprovalEmployeeDocumentRequests = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    if (!organizationId || !isHrOrAdmin(req)) return res.status(403).json({ success: false, message: 'Access denied' });
    const filter = { organizationId };
    if (!isAdmin(req)) filter.approvalRequiredFrom = 'hr_or_admin';
    const data = await EmployeeDocumentRequest.find(filter)
      .populate('employeeId', 'name lastName email employeeId')
      .populate('requestedBy', 'name lastName email')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to load approval requests', error: error.message }); }
};

export const approveEmployeeDocumentRequest = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    const request = await EmployeeDocumentRequest.findOne({ _id: req.params.id, organizationId });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (!canApproveRequest(req, request)) return res.status(403).json({ success: false, message: 'Access denied' });
    request.status = 'approved'; request.approvedBy = actorId(req); request.approvedByType = actorType(req); request.approvedAt = new Date();
    if (req.body.remarks) request.adminRemarks = req.body.remarks;
    await request.save();
    await notifyEmployee(request, 'approved', req);
    res.json({ success: true, data: request });
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to approve request', error: error.message }); }
};

export const rejectEmployeeDocumentRequest = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    const request = await EmployeeDocumentRequest.findOne({ _id: req.params.id, organizationId });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (!canApproveRequest(req, request)) return res.status(403).json({ success: false, message: 'Access denied' });
    request.status = 'rejected'; request.rejectedBy = actorId(req); request.rejectedByType = actorType(req); request.rejectedAt = new Date(); request.rejectionReason = req.body.reason || '';
    if (req.body.remarks) request.adminRemarks = req.body.remarks;
    await request.save();
    await notifyEmployee(request, 'rejected', req);
    res.json({ success: true, data: request });
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to reject request', error: error.message }); }
};

export const uploadEmployeeDocumentRequestFile = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    const request = await EmployeeDocumentRequest.findOne({ _id: req.params.id, organizationId });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (!canManageUpload(req, request)) return res.status(403).json({ success: false, message: 'Access denied' });
    if (!['approved', 'uploaded', 'completed'].includes(request.status)) return res.status(400).json({ success: false, message: 'Request must be approved before upload' });
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: 'Document file is required' });
    const buffer = getUploadBuffer(file);
    if (!buffer) return res.status(400).json({ success: false, message: 'Uploaded file buffer is empty. Please try uploading again.' });

    if (request.fileUrl) {
      await deleteFile(request.fileUrl);
    }

    const { s3Key, filename } = await uploadRequestFileToS3(
      buffer,
      organizationId,
      file.originalname,
      file.mimetype
    );

    request.fileUrl = s3Key;
    request.fileName = filename;
    request.originalName = file.originalname;
    request.mimeType = file.mimetype;
    request.size = buffer.length;
    request.fileBinary = undefined;
    request.uploadedBy = actorId(req);
    request.uploadedByType = actorType(req);
    request.uploadedAt = new Date();
    request.status = 'uploaded';
    if (req.body?.remarks) request.adminRemarks = req.body.remarks;
    await request.save();
    await notifyEmployee(request, 'uploaded', req);
    res.json({ success: true, data: request });
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to upload document', error: error.message }); }
};

export const generateEmployeeDocument = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    const requester = actorId(req);
    if (!organizationId || !requester) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const targetEmployeeId = isAdmin(req) && req.body.employeeId ? req.body.employeeId : req.employee?._id;
    if (!targetEmployeeId) return res.status(400).json({ success: false, message: 'employeeId is required' });
    const targetEmployee = await Employee.findOne({ _id: targetEmployeeId, organizationId }).select('name lastName email department position jobTitle').lean();
    const generationDetails = { ...(req.body.generationDetails || {}), employeeName: req.body.generationDetails?.employeeName || `${targetEmployee?.name || ''} ${targetEmployee?.lastName || ''}`.trim() };
    const request = await EmployeeDocumentRequest.create({ organizationId, employeeId: targetEmployeeId, requestedBy: requester, requestMode: isAdmin(req) ? 'admin_direct' : 'generated', status: 'generated', approvalRequiredFrom: isAdmin(req) ? 'none' : resolveApprovalRequirement(req), documentType: String(req.body.documentType || 'Employment Letter').trim(), purpose: String(req.body.purpose || '').trim(), country: req.body.country || 'India', documentSize: req.body.documentSize || 'A4', documentFormat: req.body.documentFormat || 'PDF', templateKey: req.body.templateKey || '', signatureFormat: req.body.signatureFormat || '', generationDetails, generatedBy: requester, generatedByType: actorType(req), generatedAt: new Date() });
    const buffer = Buffer.from(buildGeneratedText(request), 'utf8');
    const fileName = `${request.documentType.replace(/\s+/g, '-').toLowerCase()}-${request._id}.txt`;
    const { s3Key, filename } = await uploadRequestFileToS3(buffer, organizationId, fileName, 'text/plain');
    request.fileUrl = s3Key;
    request.fileName = filename;
    request.originalName = fileName;
    request.mimeType = 'text/plain';
    request.size = buffer.length;
    request.fileBinary = undefined;
    await request.save();
    res.status(201).json({ success: true, data: request });
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to generate document', error: error.message }); }
};

export const downloadEmployeeDocumentRequestFile = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    const request = await EmployeeDocumentRequest.findOne({ _id: req.params.id, organizationId });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (!isAdmin(req) && !isHrManager(req) && !isSelf(req, request.employeeId)) return res.status(403).json({ success: false, message: 'Access denied' });

    const downloadName = request.originalName || request.fileName || 'employee-document';
    const mimeType = request.mimeType || 'application/octet-stream';

    if (request.fileUrl) {
      return sendDocumentFile(res, {
        fileUrl: request.fileUrl,
        downloadName,
        mimeType,
        inline: false,
      });
    }

    // Legacy Mongo-stored binaries (pre-S3 migration)
    if (request.fileBinary?.length) {
      return sendBinaryDocument(res, {
        buffer: Buffer.isBuffer(request.fileBinary) ? request.fileBinary : Buffer.from(request.fileBinary),
        downloadName,
        mimeType,
      });
    }

    return res.status(404).json({ success: false, message: 'File not found' });
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to download document', error: error.message }); }
};

export const markEmployeeDocumentRequestComplete = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    const request = await EmployeeDocumentRequest.findOne({ _id: req.params.id, organizationId });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (!isHrOrAdmin(req)) return res.status(403).json({ success: false, message: 'Access denied' });
    // Enforce HR Manager → Admin-only rule: HR Managers cannot complete requests that require admin approval
    if (!isAdmin(req) && request.approvalRequiredFrom === 'admin') {
      return res.status(403).json({ success: false, message: 'Only Admin can complete this request' });
    }
    if (!['approved', 'uploaded', 'generated'].includes(request.status)) {
      return res.status(400).json({ success: false, message: 'Request must be approved/uploaded before marking complete' });
    }
    request.status = 'completed';
    request.completedBy = actorId(req);
    request.completedByType = actorType(req);
    request.completedAt = new Date();
    if (req.body.remarks) request.adminRemarks = req.body.remarks;
    await request.save();
    await notifyEmployee(request, 'completed', req);
    res.json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to complete request', error: error.message });
  }
};

/**
 * Delete a document request.
 * - Employee can delete their own requests (any status).
 * - HR can delete requests they are authorized to manage (approvalRequiredFrom: 'hr_or_admin').
 * - Admin can delete any request.
 */
export const deleteEmployeeDocumentRequest = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    const request = await EmployeeDocumentRequest.findOne({ _id: req.params.id, organizationId });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    const canDelete =
      isAdmin(req) ||
      (isHrManager(req) && request.approvalRequiredFrom === 'hr_or_admin') ||
      isSelf(req, request.employeeId);

    if (!canDelete) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (request.fileUrl) {
      await deleteFile(request.fileUrl);
    }
    await EmployeeDocumentRequest.deleteOne({ _id: request._id });
    return res.json({ success: true, message: 'Request deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete request', error: error.message });
  }
};
