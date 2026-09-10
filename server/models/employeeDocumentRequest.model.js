import mongoose from 'mongoose';

const employeeDocumentRequestSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  requestMode: { type: String, enum: ['request', 'generated', 'admin_direct'], default: 'request', index: true },
  documentType: { type: String, required: true, trim: true },
  purpose: { type: String, default: '', trim: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'uploaded', 'generated', 'completed'], default: 'pending', index: true },
  approvalRequiredFrom: { type: String, enum: ['hr_or_admin', 'admin', 'none'], default: 'hr_or_admin' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, refPath: 'approvedByType' },
  approvedByType: { type: String, enum: ['User', 'Employee'], default: 'Employee' },
  approvedAt: Date,
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, refPath: 'rejectedByType' },
  rejectedByType: { type: String, enum: ['User', 'Employee'], default: 'Employee' },
  rejectedAt: Date,
  rejectionReason: { type: String, default: '' },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, refPath: 'uploadedByType' },
  uploadedByType: { type: String, enum: ['User', 'Employee'], default: 'Employee' },
  uploadedAt: Date,
  generatedBy: { type: mongoose.Schema.Types.ObjectId, refPath: 'generatedByType' },
  generatedByType: { type: String, enum: ['User', 'Employee'], default: 'Employee' },
  generatedAt: Date,
  fileUrl: String,
  fileName: String,
  originalName: String,
  mimeType: String,
  size: Number,
  fileBinary: Buffer,
  country: { type: String, default: 'India' },
  documentSize: { type: String, default: 'A4' },
  documentFormat: { type: String, default: 'PDF' },
  templateKey: { type: String, default: '' },
  signatureFormat: { type: String, default: '' },
  requestDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  generationDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  adminRemarks: { type: String, default: '' },
  completedBy: { type: mongoose.Schema.Types.ObjectId, refPath: 'completedByType' },
  completedByType: { type: String, enum: ['User', 'Employee'], default: 'Employee' },
  completedAt: Date,
}, { timestamps: true });

employeeDocumentRequestSchema.index({ organizationId: 1, employeeId: 1, createdAt: -1 });
employeeDocumentRequestSchema.index({ organizationId: 1, status: 1, approvalRequiredFrom: 1 });

const EmployeeDocumentRequest = mongoose.model('EmployeeDocumentRequest', employeeDocumentRequestSchema);
export default EmployeeDocumentRequest;
