import DocumentTemplate from '../models/documentTemplate.model.js';
import { getOrganizationId } from '../helpers/organizationHelper.js';
import { getDocumentModeSettings } from '../helpers/documentModeSettings.js';
import logger from '../helpers/logger.js';
import {
  detectFieldsFromContent,
  convertToPlaceholderSyntax,
  buildHrmsPrePopulationMap,
  isSignatureOrStampPlaceholder,
} from '../helpers/templateFieldDetector.js';

/**
 * Document Template Controller
 * Handles CRUD operations for document templates (Admin/HR management)
 * and read-only access for employees (self-service).
 */

const isAdmin = (req) => Boolean(req.authContext?.isOrgOwner || req.user?.role === 'admin');
const isHrManager = (req) => Boolean(req.authContext?.isHrManager);
const isHrOrAdmin = (req) => isAdmin(req) || isHrManager(req) || req.authContext?.isHrExecutive;
const actorId = (req) => req.employee?._id || req.user?._id;

// ─── Admin/HR: Template Management ───────────────────────────────────────────

/**
 * Create a new document template
 * @access Admin / HR Manager
 */
export const createTemplate = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    if (!organizationId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!isHrOrAdmin(req)) return res.status(403).json({ success: false, message: 'Access denied. Only Admin/HR can manage templates.' });

    const {
      name, documentType, description, country, bodyContent,
      dynamicFields, systemPlaceholders, signature, formatting,
      isSelfService, allowedDepartments, allowedRoles,
    } = req.body;

    if (!name || !documentType || !country || !bodyContent) {
      return res.status(400).json({ success: false, message: 'name, documentType, country, and bodyContent are required' });
    }

    // Detect fields from plain-text body (supports [Field], Label: ___, {{key}})
    let detectedFields = [];
    let convertedBody = bodyContent;
    try {
      detectedFields = detectFieldsFromContent(bodyContent);
      // Only convert plain-text patterns to {{}} if the body is NOT already HTML
      // HTML templates use [brackets] that are resolved at render time by resolvePlaceholders
      const bodyIsHtml = /<[a-z/][^>]*>/i.test(bodyContent);
      if (!bodyIsHtml) {
        convertedBody = convertToPlaceholderSyntax(bodyContent, detectedFields);
      }
    } catch (detectionError) {
      logger.warn('Template field detection failed, using body as-is', { error: detectionError.message });
      convertedBody = bodyContent;
      detectedFields = [];
    }

    // Merge detected fields with any explicitly provided dynamicFields (strip extra fields)
    const providedMap = new Map((dynamicFields || []).filter(f => f.key).map(f => [f.key, f]));
    const mergedDynamicFields = detectedFields.map(f => {
      const provided = providedMap.get(f.key);
      return {
        key: (provided?.key || f.key || '').trim(),
        label: (provided?.label || f.label || f.key || '').trim(),
        fieldType: provided?.fieldType || f.fieldType || 'text',
        required: provided?.required ?? f.required ?? true,
        options: provided?.options || f.options || [],
        defaultValue: provided?.defaultValue || f.defaultValue || '',
        placeholder: provided?.placeholder || f.placeholder || '',
      };
    });
    // Add any extra provided fields not in detected set
    for (const f of (dynamicFields || [])) {
      if (f.key && !mergedDynamicFields.some(mf => mf.key === f.key)) {
        mergedDynamicFields.push({
          key: (f.key || '').trim(),
          label: (f.label || f.key || '').trim(),
          fieldType: f.fieldType || 'text',
          required: f.required ?? true,
          options: f.options || [],
          defaultValue: f.defaultValue || '',
          placeholder: f.placeholder || '',
        });
      }
    }

    const template = await DocumentTemplate.create({
      organizationId,
      name: name.trim(),
      documentType,
      description: (description || '').trim(),
      country: country.trim(),
      bodyContent: convertedBody,
      dynamicFields: mergedDynamicFields.filter(f => f.key && f.key.length > 0 && f.label && f.label.length > 0 && !isSignatureOrStampPlaceholder(f.key) && !isSignatureOrStampPlaceholder(f.label)),
      systemPlaceholders: (systemPlaceholders || []).filter(sp => sp && sp.key),
      signature: signature || {},
      formatting: formatting || {},
      isSelfService: isSelfService !== false,
      allowedDepartments: allowedDepartments || [],
      allowedRoles: allowedRoles || [],
      createdBy: actorId(req),
    });

    res.status(201).json({ success: true, data: template });
  } catch (error) {
    logger.error('Failed to create document template', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to create template', error: error.message });
  }
};

/**
 * Update an existing document template
 * @access Admin / HR Manager
 */
export const updateTemplate = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    if (!organizationId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!isHrOrAdmin(req)) return res.status(403).json({ success: false, message: 'Access denied' });

    const template = await DocumentTemplate.findOne({ _id: req.params.id, organizationId });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

    const allowedFields = [
      'name', 'documentType', 'description', 'country', 'bodyContent',
      'dynamicFields', 'systemPlaceholders', 'signature', 'formatting',
      'isActive', 'isSelfService', 'allowedDepartments', 'allowedRoles',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'signature') {
          // Merge signature fields — preserve stamp binary data that was uploaded separately
          const incoming = req.body.signature || {};
          template.signature.enabled = incoming.enabled ?? template.signature.enabled;
          template.signature.signatoryName = incoming.signatoryName ?? template.signature.signatoryName;
          template.signature.signatoryDesignation = incoming.signatoryDesignation ?? template.signature.signatoryDesignation;
          template.signature.signatoryDepartment = incoming.signatoryDepartment ?? template.signature.signatoryDepartment;
          template.signature.companyName = incoming.companyName ?? template.signature.companyName;
          template.signature.includeCompanySeal = incoming.includeCompanySeal ?? template.signature.includeCompanySeal;
          // Only update stamp fields if explicitly provided (stamp upload has its own endpoint)
          if (incoming.stampEnabled !== undefined) {
            template.signature.stampEnabled = incoming.stampEnabled;
          }
          // Never overwrite stampImageBinary from form — it's managed by upload endpoint
          template.markModified('signature');
        } else {
          template[field] = req.body[field];
        }
      }
    }

    // Auto-detect and merge dynamic fields from body content
    const currentBody = template.bodyContent || '';
    const detectedFields = detectFieldsFromContent(currentBody);
    // Only convert plain-text patterns if body is NOT HTML
    const bodyIsHtml = /<[a-z/][^>]*>/i.test(currentBody);
    if (!bodyIsHtml) {
      template.bodyContent = convertToPlaceholderSyntax(currentBody, detectedFields);
    }
    // Merge detected + existing dynamic fields (strip extra fields not in schema)
    const existingMap = new Map((template.dynamicFields || []).filter(f => f.key).map(f => [f.key, f]));
    const mergedFields = [];
    for (const f of detectedFields) {
      const existing = existingMap.get(f.key);
      mergedFields.push({
        key: (existing?.key || f.key || '').trim(),
        label: (existing?.label || f.label || f.key || '').trim(),
        fieldType: existing?.fieldType || f.fieldType || 'text',
        required: existing?.required ?? f.required ?? true,
        options: existing?.options || f.options || [],
        defaultValue: existing?.defaultValue || f.defaultValue || '',
        placeholder: existing?.placeholder || f.placeholder || '',
      });
      existingMap.delete(f.key);
    }
    for (const f of existingMap.values()) {
      mergedFields.push({
        key: (f.key || '').trim(),
        label: (f.label || f.key || '').trim(),
        fieldType: f.fieldType || 'text',
        required: f.required ?? true,
        options: f.options || [],
        defaultValue: f.defaultValue || '',
        placeholder: f.placeholder || '',
      });
    }
    template.dynamicFields = mergedFields.filter(f => f.key && !isSignatureOrStampPlaceholder(f.key) && !isSignatureOrStampPlaceholder(f.label));

    template.updatedBy = actorId(req);

    await template.save();
    res.json({ success: true, data: template });
  } catch (error) {
    logger.error('Failed to update document template', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to update template', error: error.message });
  }
};

/**
 * Get a single template by ID (Admin/HR view — includes all details)
 * @access Admin / HR Manager
 */
export const getTemplateById = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    if (!organizationId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!isHrOrAdmin(req)) return res.status(403).json({ success: false, message: 'Access denied' });

    const template = await DocumentTemplate.findOne({ _id: req.params.id, organizationId })
      .populate('createdBy', 'name lastName email jobTitle position functionalRoles')
      .populate('updatedBy', 'name lastName email');
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

    res.json({ success: true, data: template });
  } catch (error) {
    logger.error('Failed to get document template', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to get template', error: error.message });
  }
};

/**
 * List all templates for the organization (Admin/HR management view)
 * @access Admin / HR Manager
 */
export const listTemplates = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    if (!organizationId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!isHrOrAdmin(req)) return res.status(403).json({ success: false, message: 'Access denied' });

    const filter = { organizationId };
    if (req.query.documentType) filter.documentType = req.query.documentType;
    if (req.query.country) filter.country = req.query.country;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

    const templates = await DocumentTemplate.find(filter)
      .select('-bodyContent -signature.signatureImageBinary -signature.stampImageBinary')
      .populate('createdBy', 'name lastName email jobTitle position functionalRoles')
      .populate('updatedBy', 'name lastName email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: templates });
  } catch (error) {
    logger.error('Failed to list document templates', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to list templates', error: error.message });
  }
};

/**
 * Delete (soft-disable) a template
 * @access Admin only
 */
export const deleteTemplate = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    if (!organizationId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!isHrOrAdmin(req)) return res.status(403).json({ success: false, message: 'Access denied' });

    const template = await DocumentTemplate.findOne({ _id: req.params.id, organizationId });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

    // Permanent delete if ?permanent=true, otherwise soft-disable
    if (req.query.permanent === 'true') {
      if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Only Admin can permanently delete templates' });
      await DocumentTemplate.deleteOne({ _id: template._id });
      return res.json({ success: true, message: 'Template deleted permanently' });
    }

    template.isActive = false;
    template.updatedBy = actorId(req);
    await template.save();

    res.json({ success: true, message: 'Template disabled successfully' });
  } catch (error) {
    logger.error('Failed to delete document template', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to delete template', error: error.message });
  }
};

// ─── Employee: Self-Service Template Access ──────────────────────────────────

/**
 * Org document mode flags (Raise a Request / Self-Service).
 * Readable by any authenticated user so employee UI can hide disabled tabs.
 */
export const getDocumentMode = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    if (!organizationId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const mode = await getDocumentModeSettings(organizationId);
    return res.json({ success: true, data: mode });
  } catch (error) {
    logger.error('Failed to get document mode settings', { error: error.message });
    return res.status(500).json({ success: false, message: 'Failed to get document mode settings' });
  }
};

/**
 * List available templates for the current employee (self-service)
 * Filters by: active, self-service enabled, employee's country/department/role
 * @access Any authenticated employee
 */
export const listAvailableTemplates = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    const employeeId = req.employee?._id;
    if (!organizationId || !employeeId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const mode = await getDocumentModeSettings(organizationId);
    if (!mode.enableSelfServiceDocuments) {
      return res.json({ success: true, data: [] });
    }

    // Get employee details for access filtering
    const Employee = (await import('../models/employee.model.js')).default;
    const employee = await Employee.findOne({ _id: employeeId, organizationId })
      .select('department position jobTitle functionalRoles')
      .lean();

    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const filter = {
      organizationId,
      isActive: true,
      isSelfService: true,
    };

    // Country filter from query (employee picks country from available options)
    if (req.query.country) filter.country = req.query.country;
    if (req.query.documentType) filter.documentType = req.query.documentType;

    let templates = await DocumentTemplate.find(filter)
      .select('name documentType description country dynamicFields systemPlaceholders formatting signature.enabled signature.signatoryName signature.signatoryDesignation')
      .sort({ documentType: 1, country: 1, name: 1 })
      .lean();

    // Filter by department/role restrictions
    templates = templates.filter((tpl) => {
      // If no restrictions, available to all
      if ((!tpl.allowedDepartments || tpl.allowedDepartments.length === 0) &&
          (!tpl.allowedRoles || tpl.allowedRoles.length === 0)) {
        return true;
      }
      // Check department
      if (tpl.allowedDepartments?.length > 0) {
        const empDept = (employee.department || '').toLowerCase();
        if (tpl.allowedDepartments.some(d => d.toLowerCase() === empDept)) return true;
      }
      // Check role
      if (tpl.allowedRoles?.length > 0) {
        const empRoles = [
          employee.position,
          employee.jobTitle,
          ...(employee.functionalRoles || []),
        ].filter(Boolean).map(r => r.toLowerCase());
        if (tpl.allowedRoles.some(r => empRoles.includes(r.toLowerCase()))) return true;
      }
      return false;
    });

    res.json({ success: true, data: templates });
  } catch (error) {
    logger.error('Failed to list available templates for employee', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to load templates', error: error.message });
  }
};

/**
 * Get a single template for self-service use (employee view)
 * Returns template details needed to fill the form — excludes admin-only fields
 * @access Any authenticated employee (with access to this template)
 */
export const getTemplateForEmployee = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    const employeeId = req.employee?._id;
    if (!organizationId || !employeeId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const template = await DocumentTemplate.findOne({
      _id: req.params.id,
      organizationId,
      isActive: true,
      isSelfService: true,
    }).lean();

    if (!template) return res.status(404).json({ success: false, message: 'Template not found or not available' });

    // Verify employee has access (department/role)
    const Employee = (await import('../models/employee.model.js')).default;
    const employee = await Employee.findOne({ _id: employeeId, organizationId })
      .select('department position jobTitle functionalRoles')
      .lean();

    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const hasAccess = (() => {
      if ((!template.allowedDepartments || template.allowedDepartments.length === 0) &&
          (!template.allowedRoles || template.allowedRoles.length === 0)) {
        return true;
      }
      if (template.allowedDepartments?.length > 0) {
        const empDept = (employee.department || '').toLowerCase();
        if (template.allowedDepartments.some(d => d.toLowerCase() === empDept)) return true;
      }
      if (template.allowedRoles?.length > 0) {
        const empRoles = [
          employee.position, employee.jobTitle,
          ...(employee.functionalRoles || []),
        ].filter(Boolean).map(r => r.toLowerCase());
        if (template.allowedRoles.some(r => empRoles.includes(r.toLowerCase()))) return true;
      }
      return false;
    })();

    if (!hasAccess) return res.status(403).json({ success: false, message: 'You do not have access to this template' });

    // Load full employee data for pre-population
    const fullEmployee = await Employee.findOne({ _id: employeeId, organizationId })
      .select('name lastName email employeeId department jobTitle position joiningDate lastWorkingDate phone1 salary manager')
      .lean();

    // Load organization for pre-population
    const Organization = (await import('../models/organization.model.js')).default;
    const org = await Organization.findById(organizationId)
      .select('name legalName email phone website domain address')
      .lean();

    // Use the stored dynamicFields — exclude stamp/signature placeholders (filled from Signature settings)
    const effectiveDynamicFields = (template.dynamicFields || []).filter(
      (f) => !isSignatureOrStampPlaceholder(f.key) && !isSignatureOrStampPlaceholder(f.label)
    );

    // Build pre-populated values using the shared HRMS mapping utility
    const hrmsMap = buildHrmsPrePopulationMap(fullEmployee, org);
    const prePopulatedValues = {};
    for (const df of effectiveDynamicFields) {
      if (hrmsMap[df.key] !== undefined && hrmsMap[df.key] !== '') {
        prePopulatedValues[df.key] = hrmsMap[df.key];
      } else if (df.defaultValue) {
        prePopulatedValues[df.key] = df.defaultValue;
      } else {
        prePopulatedValues[df.key] = '';
      }
    }

    // Return template data needed by the employee form
    res.json({
      success: true,
      data: {
        _id: template._id,
        name: template.name,
        documentType: template.documentType,
        description: template.description,
        country: template.country,
        dynamicFields: effectiveDynamicFields,
        systemPlaceholders: template.systemPlaceholders,
        formatting: template.formatting,
        signature: {
          enabled: template.signature?.enabled,
          signatoryName: template.signature?.signatoryName,
          signatoryDesignation: template.signature?.signatoryDesignation,
        },
        prePopulatedValues,
      },
    });
  } catch (error) {
    logger.error('Failed to get template for employee', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to load template', error: error.message });
  }
};

/**
 * Get available countries for self-service templates in this org
 * @access Any authenticated employee
 */
export const getAvailableCountries = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    if (!organizationId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const countries = await DocumentTemplate.distinct('country', {
      organizationId,
      isActive: true,
      isSelfService: true,
    });

    res.json({ success: true, data: countries.sort() });
  } catch (error) {
    logger.error('Failed to get available countries', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to load countries', error: error.message });
  }
};

// ─── Stamp Upload/Remove ─────────────────────────────────────────────────────

/**
 * Upload a company stamp image for a template
 * POST /admin/:id/stamp
 * @access Admin / HR Manager
 */
export const uploadStamp = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    if (!organizationId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!isHrOrAdmin(req)) return res.status(403).json({ success: false, message: 'Access denied' });

    const template = await DocumentTemplate.findOne({ _id: req.params.id, organizationId });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: 'Stamp image file is required' });

    // Validate image type
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!allowedMimes.includes(file.mimetype)) {
      return res.status(400).json({ success: false, message: 'Only PNG, JPG, and SVG images are allowed' });
    }

    // Read file buffer
    const fs = await import('fs');
    let buffer;
    if (file.buffer) {
      buffer = file.buffer;
    } else if (file.path) {
      buffer = fs.readFileSync(file.path);
    }
    if (!buffer || !buffer.length) {
      return res.status(400).json({ success: false, message: 'Failed to read uploaded file' });
    }

    // Store stamp in template
    template.signature.stampEnabled = true;
    template.signature.stampImageBinary = buffer;
    template.signature.stampMimeType = file.mimetype;
    template.signature.stampFileName = file.originalname || 'company-stamp';
    template.updatedBy = actorId(req);
    template.markModified('signature');

    await template.save();

    res.json({
      success: true,
      message: 'Stamp uploaded successfully',
      data: {
        stampEnabled: true,
        stampFileName: template.signature.stampFileName,
        stampMimeType: template.signature.stampMimeType,
      },
    });
  } catch (error) {
    logger.error('Failed to upload stamp', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to upload stamp', error: error.message });
  }
};

/**
 * Remove the company stamp from a template
 * DELETE /admin/:id/stamp
 * @access Admin / HR Manager
 */
export const removeStamp = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    if (!organizationId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!isHrOrAdmin(req)) return res.status(403).json({ success: false, message: 'Access denied' });

    const template = await DocumentTemplate.findOne({ _id: req.params.id, organizationId });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

    template.signature.stampEnabled = false;
    template.signature.stampImageBinary = undefined;
    template.signature.stampMimeType = '';
    template.signature.stampFileName = '';
    template.updatedBy = actorId(req);

    await template.save();
    res.json({ success: true, message: 'Stamp removed successfully' });
  } catch (error) {
    logger.error('Failed to remove stamp', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to remove stamp', error: error.message });
  }
};

/**
 * Get stamp image for preview (returns base64)
 * GET /admin/:id/stamp
 * @access Admin / HR Manager
 */
export const getStamp = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req) || req.user?.organizationId || req.employee?.organizationId;
    if (!organizationId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!isHrOrAdmin(req)) return res.status(403).json({ success: false, message: 'Access denied' });

    const template = await DocumentTemplate.findOne({ _id: req.params.id, organizationId });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

    if (!template.signature?.stampImageBinary || !template.signature.stampEnabled) {
      return res.status(404).json({ success: false, message: 'No stamp configured' });
    }

    const mime = template.signature.stampMimeType || 'image/png';
    const base64 = template.signature.stampImageBinary.toString('base64');
    res.json({
      success: true,
      data: {
        stampBase64: `data:${mime};base64,${base64}`,
        stampFileName: template.signature.stampFileName,
        stampMimeType: mime,
      },
    });
  } catch (error) {
    logger.error('Failed to get stamp', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to get stamp', error: error.message });
  }
};
