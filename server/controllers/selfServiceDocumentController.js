/**
 * Self-Service Document Generation Controller
 * Handles: preview, generate PDF, download generated documents.
 * Employees generate documents for themselves only — no approval step.
 *
 * Separate from employeeDocumentRequestController.js to avoid touching the existing request flow.
 */

import DocumentTemplate from '../models/documentTemplate.model.js';
import Employee from '../models/employee.model.js';
import Organization from '../models/organization.model.js';
import { getOrganizationId } from '../helpers/organizationHelper.js';
import { generateDocumentPdf, generatePreviewHtml, buildPlaceholderValues } from '../helpers/documentPdfGenerator.js';
import logger from '../helpers/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const actorId = (req) => req.employee?._id || req.user?._id;

/**
 * Load the organization with logo base64 for PDF embedding
 */
async function loadOrganizationWithLogo(organizationId) {
  const org = await Organization.findById(organizationId)
    .select('name legalName email phone website domain address logo gstNumber panNumber')
    .lean();

  if (!org) return { org: null, logoOptions: {} };

  const logoOptions = {};
  if (org.logo?.url) {
    try {
      const baseName = path.basename(org.logo.url);
      const logosDir = path.join(__dirname, '../uploads/logos');
      const uploadsDir = path.join(__dirname, '../uploads');
      let filePath = path.join(logosDir, baseName);
      if (!fs.existsSync(filePath)) filePath = path.join(uploadsDir, baseName);
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath);
        const ext = path.extname(baseName).toLowerCase();
        const mime = ext === '.png' ? 'png' : ext === '.jpg' || ext === '.jpeg' ? 'jpeg' : 'png';
        logoOptions.orgLogoBase64 = `data:image/${mime};base64,${buf.toString('base64')}`;
        logoOptions.orgLogoFormat = mime === 'jpeg' ? 'JPEG' : 'PNG';
      }
    } catch (e) {
      logger.warn('Could not load org logo for self-service document', { error: e.message });
    }
  }

  return { org, logoOptions };
}

/**
 * Validate that the employee has access to the specified template
 */
async function validateTemplateAccess(template, employee) {
  if (!template.allowedDepartments?.length && !template.allowedRoles?.length) {
    return true; // No restrictions
  }

  if (template.allowedDepartments?.length > 0) {
    const empDept = (employee.department || '').toLowerCase();
    if (template.allowedDepartments.some(d => d.toLowerCase() === empDept)) return true;
  }

  if (template.allowedRoles?.length > 0) {
    const empRoles = [
      employee.position,
      employee.jobTitle,
      ...(employee.functionalRoles || []),
    ].filter(Boolean).map(r => r.toLowerCase());
    if (template.allowedRoles.some(r => empRoles.includes(r.toLowerCase()))) return true;
  }

  return false;
}

/**
 * Validate dynamic field values against template requirements
 */
function validateDynamicFields(template, dynamicFieldValues) {
  const errors = [];
  for (const field of (template.dynamicFields || [])) {
    if (field.required && (!dynamicFieldValues[field.key] || !String(dynamicFieldValues[field.key]).trim())) {
      errors.push(`${field.label || field.key} is required`);
    }
    if (field.fieldType === 'select' && field.options?.length > 0 && dynamicFieldValues[field.key]) {
      if (!field.options.includes(dynamicFieldValues[field.key])) {
        errors.push(`Invalid value for ${field.label || field.key}`);
      }
    }
  }
  return errors;
}

// ─── In-memory store for generated documents ─────────────────────────────────
// Uses a separate collection to store generated self-service docs for download

const generatedDocSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'DocumentTemplate', required: true },
  documentType: { type: String, required: true },
  country: { type: String, default: '' },
  fileName: { type: String, required: true },
  mimeType: { type: String, default: 'application/pdf' },
  size: { type: Number, default: 0 },
  fileBinary: { type: Buffer, required: true },
  dynamicFieldValues: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

generatedDocSchema.index({ organizationId: 1, employeeId: 1, createdAt: -1 });

const SelfServiceDocument = mongoose.models.SelfServiceDocument || mongoose.model('SelfServiceDocument', generatedDocSchema);

// ─── Controller Handlers ─────────────────────────────────────────────────────

/**
 * Preview a document (returns HTML preview, no PDF download)
 * POST /preview
 * Body: { templateId, dynamicFieldValues: {} }
 * @access Authenticated employee (own documents only)
 */
export const previewDocument = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    const employeeId = req.employee?._id;
    if (!organizationId || !employeeId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { templateId, dynamicFieldValues } = req.body;
    if (!templateId) return res.status(400).json({ success: false, message: 'templateId is required' });

    // Load template (include stamp binary for rendering)
    const template = await DocumentTemplate.findOne({
      _id: templateId,
      organizationId,
      isActive: true,
      isSelfService: true,
    });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found or not available' });

    // Load employee
    const employee = await Employee.findOne({ _id: employeeId, organizationId })
      .select('name lastName email employeeId department jobTitle position joiningDate lastWorkingDate phone1 functionalRoles')
      .lean();
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    // Validate access
    if (!(await validateTemplateAccess(template, employee))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this template' });
    }

    // Validate required fields
    const validationErrors = validateDynamicFields(template, dynamicFieldValues || {});
    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: validationErrors });
    }

    // Load org with logo
    const { org, logoOptions } = await loadOrganizationWithLogo(organizationId);

    // Build options combining logo + stamp
    const renderOptions = { ...logoOptions };

    // Load stamp — always query DB directly (stampEnabled on main doc may be stale)
    try {
      const stampDoc = await DocumentTemplate.findById(template._id)
        .select('signature.stampImageBinary signature.stampMimeType signature.stampEnabled')
        .lean();
      if (stampDoc?.signature?.stampEnabled && stampDoc?.signature?.stampImageBinary) {
        const mime = stampDoc.signature.stampMimeType || 'image/png';
        let stampBuffer = stampDoc.signature.stampImageBinary;
        if (!Buffer.isBuffer(stampBuffer)) {
          if (stampBuffer.buffer) stampBuffer = Buffer.from(stampBuffer.buffer);
          else if (stampBuffer.data) stampBuffer = Buffer.from(stampBuffer.data);
          else stampBuffer = Buffer.from(stampBuffer);
        }
        if (stampBuffer && stampBuffer.length > 0) {
          renderOptions.stampImageBase64 = `data:${mime};base64,${stampBuffer.toString('base64')}`;
          renderOptions.stampMimeType = mime;
        }
      }
    } catch (stampErr) {
      logger.warn('Failed to load stamp', { error: stampErr.message });
    }

    // Generate preview HTML
    const previewHtml = generatePreviewHtml(template.toObject(), employee, org, dynamicFieldValues || {}, renderOptions);

    res.json({ success: true, data: { html: previewHtml } });
  } catch (error) {
    logger.error('Failed to preview self-service document', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to generate preview', error: error.message });
  }
};

/**
 * Generate and download a PDF document
 * POST /generate
 * Body: { templateId, dynamicFieldValues: {} }
 * @access Authenticated employee (own documents only)
 */
export const generateDocument = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    const employeeId = req.employee?._id;
    if (!organizationId || !employeeId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { templateId, dynamicFieldValues } = req.body;
    if (!templateId) return res.status(400).json({ success: false, message: 'templateId is required' });

    // Load template (with full body content + stamp binary)
    const template = await DocumentTemplate.findOne({
      _id: templateId,
      organizationId,
      isActive: true,
      isSelfService: true,
    });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found or not available' });

    // Load employee
    const employee = await Employee.findOne({ _id: employeeId, organizationId })
      .select('name lastName email employeeId department jobTitle position joiningDate lastWorkingDate phone1 functionalRoles salary')
      .lean();
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    // Validate access
    if (!(await validateTemplateAccess(template, employee))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this template' });
    }

    // Validate required fields
    const validationErrors = validateDynamicFields(template, dynamicFieldValues || {});
    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: validationErrors });
    }

    // Load org with logo
    const { org, logoOptions } = await loadOrganizationWithLogo(organizationId);

    // Build stamp options and merge with logoOptions
    const pdfOptions = { ...logoOptions };

    // Load stamp — always query DB directly (stampEnabled on main doc may be stale)
    try {
      const stampDoc = await DocumentTemplate.findById(template._id)
        .select('signature.stampImageBinary signature.stampMimeType signature.stampEnabled')
        .lean();
      if (stampDoc?.signature?.stampEnabled && stampDoc?.signature?.stampImageBinary) {
        const mime = stampDoc.signature.stampMimeType || 'image/png';
        let stampBuffer = stampDoc.signature.stampImageBinary;
        if (!Buffer.isBuffer(stampBuffer)) {
          if (stampBuffer.buffer) stampBuffer = Buffer.from(stampBuffer.buffer);
          else if (stampBuffer.data) stampBuffer = Buffer.from(stampBuffer.data);
          else stampBuffer = Buffer.from(stampBuffer);
        }
        if (stampBuffer && stampBuffer.length > 0) {
          pdfOptions.stampImageBase64 = `data:${mime};base64,${stampBuffer.toString('base64')}`;
          pdfOptions.stampMimeType = mime;
        }
      }
    } catch (stampErr) {
      logger.warn('Failed to load stamp for PDF', { error: stampErr.message });
    }

    // Generate PDF
    const pdfBuffer = await generateDocumentPdf(
      template.toObject(),
      employee,
      org,
      dynamicFieldValues || {},
      pdfOptions
    );

    // Store the generated document for later download
    const fileName = `${template.documentType.replace(/\s+/g, '-').toLowerCase()}-${employeeId}-${Date.now()}.pdf`;

    const generatedDoc = await SelfServiceDocument.create({
      organizationId,
      employeeId,
      templateId: template._id,
      documentType: template.documentType,
      country: template.country,
      fileName,
      mimeType: 'application/pdf',
      size: pdfBuffer.length,
      fileBinary: pdfBuffer,
      dynamicFieldValues: dynamicFieldValues || {},
    });

    res.json({
      success: true,
      data: {
        documentId: generatedDoc._id,
        fileName,
        size: pdfBuffer.length,
        documentType: template.documentType,
      },
    });
  } catch (error) {
    logger.error('Failed to generate self-service document', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to generate document', error: error.message });
  }
};

/**
 * Download a previously generated self-service document
 * GET /download/:documentId
 * @access Authenticated employee (own documents only)
 */
export const downloadDocument = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    const employeeId = req.employee?._id;
    if (!organizationId || !employeeId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { documentId } = req.params;
    if (!documentId) return res.status(400).json({ success: false, message: 'documentId is required' });

    const doc = await SelfServiceDocument.findOne({ _id: documentId, organizationId });
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    // Ownership check — employee can only download their own
    if (String(doc.employeeId) !== String(employeeId)) {
      // Admin/HR can also access
      const isAdminUser = Boolean(req.authContext?.isOrgOwner || req.user?.role === 'admin');
      const isHr = Boolean(req.authContext?.isHrManager || req.authContext?.isHrExecutive);
      if (!isAdminUser && !isHr) {
        return res.status(403).json({ success: false, message: 'Access denied. You can only download your own documents.' });
      }
    }

    const disposition = req.query.inline === '1' ? 'inline' : 'attachment';
    res.setHeader('Content-Type', doc.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(doc.fileName)}"`);
    res.send(doc.fileBinary);
  } catch (error) {
    logger.error('Failed to download self-service document', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to download document', error: error.message });
  }
};

/**
 * List my generated self-service documents
 * GET /my-documents
 * @access Authenticated employee (own only)
 */
export const listMyGeneratedDocuments = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    const employeeId = req.employee?._id;
    if (!organizationId || !employeeId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const docs = await SelfServiceDocument.find({ organizationId, employeeId })
      .select('documentType country fileName size createdAt templateId dynamicFieldValues')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Attach employee name from profile
    const emp = await Employee.findById(employeeId).select('name lastName').lean();
    const empName = emp ? `${emp.name || ''} ${emp.lastName || ''}`.trim() : '';

    const enrichedDocs = docs.map(doc => ({
      ...doc,
      employeeName: doc.dynamicFieldValues?.employeeName || empName || '',
    }));

    res.json({ success: true, data: enrichedDocs });
  } catch (error) {
    logger.error('Failed to list self-service documents', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to load documents', error: error.message });
  }
};

/**
 * Delete a self-service generated document.
 * - Employee can delete their own generated documents.
 * - Admin can delete any generated document.
 * - HR Manager can delete documents within their authorized scope.
 * DELETE /delete/:documentId
 */
export const deleteSelfServiceDocument = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    const employeeId = req.employee?._id;
    if (!organizationId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { documentId } = req.params;
    const doc = await SelfServiceDocument.findOne({ _id: documentId, organizationId });
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    // Admin can delete anything
    const isAdminUser = Boolean(req.authContext?.isOrgOwner || req.user?.role === 'admin');
    if (isAdminUser) {
      await SelfServiceDocument.deleteOne({ _id: doc._id });
      return res.json({ success: true, message: 'Document deleted' });
    }

    // HR Manager can delete any self-service doc in their org
    const isHr = Boolean(req.authContext?.isHrManager || req.authContext?.isHrExecutive);
    if (isHr) {
      await SelfServiceDocument.deleteOne({ _id: doc._id });
      return res.json({ success: true, message: 'Document deleted' });
    }

    // Employee can delete only their own
    if (employeeId && String(doc.employeeId) === String(employeeId)) {
      await SelfServiceDocument.deleteOne({ _id: doc._id });
      return res.json({ success: true, message: 'Document deleted' });
    }

    return res.status(403).json({ success: false, message: 'Access denied. You can only delete your own documents.' });
  } catch (error) {
    logger.error('Failed to delete self-service document', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to delete document', error: error.message });
  }
};
