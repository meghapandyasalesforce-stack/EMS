import Employee from '../models/employee.model.js';
import logger from '../helpers/logger.js';

/**
 * Apply approved tax regime change to employee financial details.
 */
export const applyTaxRegimeChangeApproval = async ({
  taxRegimeRequest,
  reviewerId = null,
  comments = 'Approved',
}) => {
  if (!taxRegimeRequest) {
    throw new Error('Tax regime change request is required');
  }

  if (taxRegimeRequest.status === 'approved') {
    return taxRegimeRequest;
  }

  const employee = await Employee.findById(taxRegimeRequest.employeeId).select('financialDetails');
  if (!employee) {
    throw new Error('Employee not found for tax regime change');
  }

  const prev = employee.financialDetails?.toObject
    ? employee.financialDetails.toObject()
    : { ...(employee.financialDetails || {}) };
  employee.financialDetails = {
    ...prev,
    taxRegime: taxRegimeRequest.requestedTaxRegime || 'N/A',
  };
  await employee.save();

  taxRegimeRequest.status = 'approved';
  taxRegimeRequest.reviewedBy = reviewerId || taxRegimeRequest.reviewedBy;
  taxRegimeRequest.reviewedAt = new Date();
  await taxRegimeRequest.save();

  logger.info('Tax regime change approved', {
    requestId: taxRegimeRequest._id,
    employeeId: taxRegimeRequest.employeeId,
    reviewerId,
    comments,
  });

  return taxRegimeRequest;
};

/**
 * Reject a tax regime change request.
 */
export const applyTaxRegimeChangeRejection = async ({
  taxRegimeRequest,
  reviewerId = null,
  rejectionReason = 'Rejected',
}) => {
  if (!taxRegimeRequest) {
    throw new Error('Tax regime change request is required');
  }

  if (taxRegimeRequest.status === 'rejected') {
    return taxRegimeRequest;
  }

  taxRegimeRequest.status = 'rejected';
  taxRegimeRequest.reviewedBy = reviewerId || taxRegimeRequest.reviewedBy;
  taxRegimeRequest.reviewedAt = new Date();
  taxRegimeRequest.rejectionReason = rejectionReason;
  await taxRegimeRequest.save();

  logger.info('Tax regime change rejected', {
    requestId: taxRegimeRequest._id,
    employeeId: taxRegimeRequest.employeeId,
    reviewerId,
    rejectionReason,
  });

  return taxRegimeRequest;
};

/**
 * Find active HR / admin-like employees to notify when no workflow is configured.
 */
export const findTaxRegimeApproverRecipients = async (organizationId) => {
  const employees = await Employee.find({
    organizationId,
    status: 'active',
  })
    .select('_id name lastName functionalRoles department position jobTitle')
    .lean();

  const normalize = (value = '') => String(value).trim().toLowerCase();

  return employees.filter((emp) => {
    const roles = Array.isArray(emp.functionalRoles)
      ? emp.functionalRoles.map(normalize)
      : [];
    const dept = normalize(emp.department);
    const position = normalize(emp.position);
    const jobTitle = normalize(emp.jobTitle);

    return (
      roles.includes('hr') ||
      roles.includes('admin') ||
      roles.includes('hr_manager') ||
      roles.includes('hr_executive') ||
      dept.includes('hr') ||
      dept.includes('human resource') ||
      position.includes('hr') ||
      jobTitle.includes('hr') ||
      position === 'admin' ||
      jobTitle.includes('admin')
    );
  });
};
