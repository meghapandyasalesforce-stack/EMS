import CompanyPolicy from '../models/companyPolicy.model.js';
import Employee from '../models/employee.model.js';
import logger from '../helpers/logger.js';

/**
 * Middleware to enforce company policies
 * Attaches applicable policies to the request object
 */
export const enforcePolicies = async (req, res, next) => {
    try {
        const organizationId = req.organizationId;
        const employeeId = req.employee?._id || req.user?._id;
        
        if (!organizationId || !employeeId) {
            return next();
        }
        
        // Get active policies for organization
        const policies = await CompanyPolicy.find({
            organizationId,
            isActive: true,
            effectiveDate: { $lte: new Date() },
            $or: [
                { expiryDate: { $exists: false } },
                { expiryDate: { $gte: new Date() } }
            ]
        }).populate('applicableRoles', 'name level');
        
        // Get employee details
        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return next();
        }
        
        // Check applicable policies
        const applicablePolicies = policies.filter(policy => {
            // Check if policy applies to this employee
            if (policy.applicableRoles.length === 0 && 
                policy.applicableDepartments.length === 0) {
                return true; // Applies to all
            }
            
            if (policy.applicableTo === 'department' && 
                policy.applicableDepartments.includes(employee.department)) {
                return true;
            }
            
            if (policy.applicableTo === 'role' && employee.assignedRole) {
                const roleIds = policy.applicableRoles.map(r => r._id.toString());
                if (roleIds.includes(employee.assignedRole.toString())) {
                    return true;
                }
            }
            
            // Check by role reference
            if (employee.assignedRole && policy.applicableRoles.length > 0) {
                const roleIds = policy.applicableRoles.map(r => 
                    r._id ? r._id.toString() : r.toString()
                );
                if (roleIds.includes(employee.assignedRole.toString())) {
                    return true;
                }
            }
            
            // Check by department
            if (policy.applicableDepartments.length > 0) {
                if (policy.applicableDepartments.includes(employee.department)) {
                    return true;
                }
            }
            
            return false;
        });
        
        // Attach policies to request
        req.companyPolicies = applicablePolicies;
        req.employee = employee;
        
        next();
    } catch (error) {
        logger.error('Policy enforcement error', { 
            error: error.message,
            stack: error.stack 
        });
        next(); // Don't block request if policy check fails
    }
};

export default enforcePolicies;

