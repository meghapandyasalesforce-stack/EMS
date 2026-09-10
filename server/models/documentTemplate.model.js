import mongoose from 'mongoose';

/**
 * Document Template Schema
 * Stores predefined document templates for self-service document generation.
 * Admin/HR can configure templates; employees use them to generate documents.
 */
const documentTemplateSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },

  // Template identification
  name: {
    type: String,
    required: true,
    trim: true,
  },
  documentType: {
    type: String,
    required: true,
    trim: true,
    enum: [
      'Experience Letter',
      'Employment Letter',
      'Appreciation Letter',
      'Salary Certificate',
      'Employment Verification Letter',
      'Joining/Appointment Letter',
      'Promotion/Increment Letter',
      'Relieving Letter',
      'Other',
    ],
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },

  // Country-wise configuration
  country: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },

  // Template body — HTML-like content with {{placeholder}} syntax
  // Protected content that employees cannot modify
  bodyContent: {
    type: String,
    required: true,
  },

  // Dynamic fields that employees must fill in
  // Each field has: key, label, type (text/date/select/number), required, options (for select)
  dynamicFields: [{
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    fieldType: {
      type: String,
      enum: ['text', 'date', 'number', 'select', 'textarea'],
      default: 'text',
    },
    required: { type: Boolean, default: true },
    options: [String], // For select type
    defaultValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
  }],

  // Auto-populated placeholders from system data
  // These are filled from Employee/Organization models automatically
  systemPlaceholders: [{
    key: { type: String, required: true, trim: true },
    source: {
      type: String,
      enum: ['employee', 'organization', 'system'],
      required: true,
    },
    field: { type: String, required: true, trim: true }, // e.g., 'name', 'joiningDate', 'department'
    label: { type: String, trim: true },
    format: { type: String, default: '' }, // e.g., 'date:DD MMM YYYY'
  }],

  // Signature configuration
  signature: {
    enabled: { type: Boolean, default: true },
    signatoryName: { type: String, default: '', trim: true },
    signatoryDesignation: { type: String, default: '', trim: true },
    signatoryDepartment: { type: String, default: '', trim: true },
    signatureImageUrl: { type: String, default: '' },
    signatureImageBinary: { type: Buffer },
    companyName: { type: String, default: '', trim: true },
    includeCompanySeal: { type: Boolean, default: false },
    // Company stamp
    stampEnabled: { type: Boolean, default: false },
    stampImageBinary: { type: Buffer },
    stampMimeType: { type: String, default: '' },
    stampFileName: { type: String, default: '' },
  },

  // Formatting options
  formatting: {
    paperSize: { type: String, enum: ['A4', 'Letter', 'Legal'], default: 'A4' },
    orientation: { type: String, enum: ['portrait', 'landscape'], default: 'portrait' },
    marginTop: { type: Number, default: 20 },
    marginBottom: { type: Number, default: 20 },
    marginLeft: { type: Number, default: 15 },
    marginRight: { type: Number, default: 15 },
    fontSize: { type: Number, default: 11 },
    fontFamily: { type: String, default: 'helvetica' },
    includeLetterhead: { type: Boolean, default: true },
    includeDate: { type: Boolean, default: true },
    includeReferenceNumber: { type: Boolean, default: true },
  },

  // Access control
  isActive: { type: Boolean, default: true, index: true },
  isSelfService: {
    type: Boolean,
    default: true,
    index: true,
  },

  // Who can use this template (empty = all employees in org)
  allowedDepartments: [String],
  allowedRoles: [String],

  // Audit trail
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
}, { timestamps: true });

// Compound indexes for efficient lookups
documentTemplateSchema.index({ organizationId: 1, documentType: 1, country: 1, isActive: 1 });
documentTemplateSchema.index({ organizationId: 1, isSelfService: 1, isActive: 1 });

const DocumentTemplate = mongoose.model('DocumentTemplate', documentTemplateSchema);
export default DocumentTemplate;
