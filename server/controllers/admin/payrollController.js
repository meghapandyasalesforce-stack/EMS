import Payroll from "../../models/payroll.model.js";
import Employee from"../../models/employee.model.js"
import Attendance from "../../models/attendance.model.js";
import Leave from "../../models/leave.model.js";
import { transferToBank } from "../../helpers/paymentService.js";
import logger from "../../helpers/logger.js";
import { getManagerEmployeeIds, isEmployeeLinkedToManager, buildManagerMatchQuery } from "../../helpers/managerHelper.js";
import { logCreate, logUpdate } from "../../helpers/auditLogger.js";



// Update payroll details
export const updatePayroll = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const adminId = req.user?._id;

        // Ensure earnings and deductions are objects
        const earnings = updates.earnings || {};
        const deductions = updates.deductions || {};

        // Calculate total earnings
        earnings.totalEarnings = 
            (earnings.basicWage || 0) +
            (earnings.houseRentAllowance || 0) +
            (earnings.transportAllowance || 0) +
            (earnings.medicalAllowance || 0) +
            (earnings.overtime || 0) +
            (earnings.gratuity || 0) +
            (earnings.specialAllowance || 0) +
            (earnings.performanceBonus || 0) +
            (earnings.projectBonus || 0) +
            (earnings.attendanceBonus || 0) +
            (earnings.pfEmployer || 0) +
            (earnings.esiEmployer || 0);

        // Calculate total deductions
        deductions.total = 
            (deductions.pfEmployee || 0) +
            (deductions.esiEmployee || 0) +
            (deductions.professionalTax || 0) +
            (deductions.incomeTax || 0) +
            (deductions.advanceSalary || 0) +
            (deductions.loanDeduction || 0) +
            (deductions.otherDeductions || 0);

        // Calculate CTC (Cost to Company)
        const ctc = earnings.totalEarnings;

        // Calculate in-hand salary
        const inHandSalary = earnings.totalEarnings - deductions.total;

        // Update final object with tracking
        const updateData = {
            ...updates,
            earnings,
            deductions,
            ctc,
            inHandSalary,
            lastModifiedBy: adminId
        };

        // Get payroll before update for audit log
        const payrollBefore = await Payroll.findById(id).populate('employeeId', 'name lastName email jobTitle department employeeId').lean();
        
        if (!payrollBefore) {
            return res.status(404).json({ 
                success: false,
                message: 'Payroll not found' 
            });
        }

        // Perform the update
        const payroll = await Payroll.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        ).populate('employeeId', 'name lastName email jobTitle department employeeId');

        // Log audit trail
        await logUpdate({
            entityType: 'Payroll',
            entityId: payroll._id,
            entityName: `Payroll for ${payroll.employeeId?.name || 'Employee'}`,
            req,
            before: payrollBefore,
            after: payroll.toObject(),
            metadata: {
                month: payroll.month,
                year: payroll.year,
                inHandSalary: payroll.inHandSalary,
                ctc: payroll.ctc
            }
        });

        res.status(200).json({
            success: true,
            message: 'Payroll updated successfully',
            data: payroll
        });
    } catch (error) {
        logger.error('Update Payroll Error', { error: error.message, stack: error.stack });
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
};

// Get payroll details for logged-in employee
export const getEmployeePayroll = async (req, res) => {
    try {
        const employeeId = req.employee._id; // Authenticated employee's ID
        const { month, year } = req.query;

        // Fetch employee details
        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Import organization helper for multi-tenancy support
        const { addOrganizationFilter } = await import('../../helpers/organizationHelper.js');
        
        // Build query with organization filter - SECURITY: Ensures multi-tenancy isolation
        const query = addOrganizationFilter(req, {
            employeeId,
            month,
            year,
            isVisible: true
        });

        // Try to find visible payroll
        let payroll = await Payroll.findOne(query)
            .populate('employeeId', 'name designation salary jobTitle department');

        // If not found, create a default payroll
        if (!payroll) {
            const basicSalary = employee.salary;

            // Default earnings
            const earnings = {
                basicWage: basicSalary,
                houseRentAllowance: 0,
                overtime: 0,
                gratuity: 0,
                specialAllowance: 0,
                pfEmployer: 0,
                esiEmployer: 0
            };
            earnings.totalEarnings = Object.values(earnings).reduce((sum, val) => sum + (val || 0), 0);

            // Default deductions
            const deductions = {
                pfEmployee: 0,
                esiEmployee: 0,
                tax: 0,
                otherDeductions: 0
            };
            deductions.total = Object.values(deductions).reduce((sum, val) => sum + (val || 0), 0);

            // Calculate CTC and In-Hand
            const ctc = earnings.totalEarnings;
            const inHandSalary = earnings.totalEarnings - deductions.total;

            payroll = new Payroll({
                employeeId,
                month,
                year,
                basicSalary,
                earnings,
                deductions,
                ctc,
                inHandSalary,
                status: 'Pending'
            });

            await payroll.save();
        }

        res.json(payroll);
    } catch (error) {
        logger.error('Payroll Error', { error: error.message, stack: error.stack });
        res.status(500).json({ message: error.message });
    }
};


// Get all payrolls for a specific month and year (for employees - only visible ones)
export const getAllPayrolls = async (req, res) => {
    try {
        // Import organization helper for multi-tenancy support
        const { addOrganizationFilter } = await import('../../helpers/organizationHelper.js');
        
        const { month, year } = req.query;
        const isAdmin = req.user?.role === 'admin';
        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        
        // Build query with organization filter - SECURITY: Ensures multi-tenancy isolation
        const query = addOrganizationFilter(req, { month, year });
        
        if (!isAdmin) {
            query.isVisible = true;
        }

        // If user is a manager, filter by manager field
        // Example: Manager "Arun Kumar" sees payrolls for employees with manager="Arun Kumar" or "Arun"
        if (isManager && req.employee) {
            const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
            const managerEmployeeIds = await getManagerEmployeeIds(Employee, organizationId, req.employee);
            query.employeeId = { $in: managerEmployeeIds };
            
            const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();
            logger.info('Manager filtering payrolls by manager field', {
                managerId: req.employee._id,
                managerName: managerName,
                employeeCount: managerEmployeeIds.length
            });
        }

        const payrolls = await Payroll.find(query)
            .populate('employeeId', 'name designation salary jobTitle department');

        res.json({
            success: true,
            payrolls: payrolls,
            message: 'Payrolls retrieved successfully'
        });
    } catch (error) {
        logger.error('Get All Payrolls Error', { error: error.message, stack: error.stack });
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
};

// Create new payroll
export const createPayroll = async (req, res) => {
    try {
        const payrollData = req.body;
        
        // Calculate totals
        const earnings = payrollData.earnings || {};
        const deductions = payrollData.deductions || {};
        
        earnings.totalEarnings = Object.values(earnings).reduce((sum, val) => sum + (val || 0), 0);
        deductions.total = Object.values(deductions).reduce((sum, val) => sum + (val || 0), 0);
        
        const ctc = earnings.totalEarnings;
        const inHandSalary = earnings.totalEarnings - deductions.total;
        
        const payroll = new Payroll({
            ...payrollData,
            earnings,
            deductions,
            ctc,
            inHandSalary
        });
        
        await payroll.save();
        
        const populatedPayroll = await Payroll.findById(payroll._id)
            .populate('employeeId', 'name lastName email jobTitle department employeeId');
        
        // Log audit trail
        await logCreate({
            entityType: 'Payroll',
            entityId: payroll._id,
            entityName: `Payroll for ${populatedPayroll.employeeId?.name || 'Employee'}`,
            req,
            before: null,
            after: populatedPayroll.toObject(),
            metadata: {
                month: payroll.month,
                year: payroll.year,
                inHandSalary: payroll.inHandSalary,
                ctc: payroll.ctc
            }
        });
        
        res.status(201).json(populatedPayroll);
    } catch (error) {
        logger.error('Create Payroll Error', { error: error.message, stack: error.stack });
        res.status(500).json({ message: error.message });
    }
};

// Get specific employee's payroll data for admin
export const getEmployeePayrollForAdmin = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { page = 1, limit = 12 } = req.query;

        // If user is a manager (not admin or HR), verify employee is linked to them
        // Example: Manager "Arun Kumar" can only view payroll for employees with manager="Arun Kumar" or "Arun"
        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        if (isManager && req.employee) {
            const employee = await Employee.findById(employeeId).select('manager').lean();
            if (!employee) {
                return res.status(404).json({ 
                    success: false,
                    message: 'Employee not found.' 
                });
            }
            
            // Check if employee's manager field matches this manager
            const isLinked = isEmployeeLinkedToManager(employee, req.employee);
            
            if (!isLinked) {
                const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();
                logger.warn('Manager trying to access payroll for unlinked employee', {
                    managerId: req.employee._id,
                    managerName: managerName,
                    employeeManager: employee.manager,
                    employeeId: employeeId
                });
                return res.status(403).json({ 
                    success: false,
                    message: 'You can only view payroll for employees linked to you.' 
                });
            }
        }

        const skip = (page - 1) * limit;

        // Import organization helper for multi-tenancy support
        const { addOrganizationFilter } = await import('../../helpers/organizationHelper.js');
        
        // Build query with organization filter - SECURITY: Ensures multi-tenancy isolation
        const query = addOrganizationFilter(req, { employeeId });

        const payrolls = await Payroll.find(query)
            .sort({ year: -1, month: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('employeeId', 'name lastName email jobTitle department employeeId');

        const total = await Payroll.countDocuments(query);

        res.json({
            payrolls,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            total
        });
    } catch (error) {
        logger.error('Get Employee Payroll for Admin Error', { error: error.message, stack: error.stack });
        res.status(500).json({ message: error.message });
    }
};

// Get specific payroll by employee ID, month, and year (admin view)
export const getPayrollByEmployeeMonthYear = async (req, res) => {
    try {
        const { employeeId, month, year } = req.params;

        // If user is a manager (not admin or HR), verify employee is linked to them
        // Example: Manager "Arun Kumar" can only view payroll for employees with manager="Arun Kumar" or "Arun"
        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        if (isManager && req.employee) {
            const employee = await Employee.findById(employeeId).select('manager').lean();
            if (!employee) {
                return res.status(404).json({ 
                    success: false,
                    message: 'Employee not found.' 
                });
            }
            
            // Check if employee's manager field matches this manager
            const isLinked = isEmployeeLinkedToManager(employee, req.employee);
            
            if (!isLinked) {
                const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();
                logger.warn('Manager trying to access payroll for unlinked employee', {
                    managerId: req.employee._id,
                    managerName: managerName,
                    employeeManager: employee.manager,
                    employeeId: employeeId
                });
                return res.status(403).json({ 
                    success: false,
                    message: 'You can only view payroll for employees linked to you.' 
                });
            }
        }
        
        // Import organization helper for multi-tenancy support
        const { addOrganizationFilter } = await import('../../helpers/organizationHelper.js');
        
        // Build query with organization filter - SECURITY: Ensures multi-tenancy isolation
        const query = addOrganizationFilter(req, {
            employeeId,
            month: decodeURIComponent(month),
            year: parseInt(year)
        });
        
        const payroll = await Payroll.findOne(query)
            .populate('employeeId', 'name lastName email jobTitle department employeeId');

        if (!payroll) {
            return res.status(404).json({ message: 'Payroll not found' });
        }

        res.json(payroll);
    } catch (error) {
        logger.error('Get Payroll by Employee Month Year Error', { error: error.message, stack: error.stack });
        res.status(500).json({ message: error.message });
    }
};

// Get current month payroll for specific employee (admin view)
export const getCurrentMonthPayrollForAdmin = async (req, res) => {
    try {
        const { employeeId } = req.params;
        
        // If user is a manager (not admin or HR), verify employee is linked to them
        // Example: Manager "Arun Kumar" can only view payroll for employees with manager="Arun Kumar" or "Arun"
        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        if (isManager && req.employee) {
            const employee = await Employee.findById(employeeId).select('manager').lean();
            if (!employee) {
                return res.status(404).json({ 
                    success: false,
                    message: 'Employee not found.' 
                });
            }
            
            // Check if employee's manager field matches this manager
            const isLinked = isEmployeeLinkedToManager(employee, req.employee);
            
            if (!isLinked) {
                const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();
                logger.warn('Manager trying to access payroll for unlinked employee', {
                    managerId: req.employee._id,
                    managerName: managerName,
                    employeeManager: employee.manager,
                    employeeId: employeeId
                });
                return res.status(403).json({ 
                    success: false,
                    message: 'You can only view payroll for employees linked to you.' 
                });
            }
        }
        
        const currentDate = new Date();
        const month = currentDate.toLocaleString('default', { month: 'long' });
        const year = currentDate.getFullYear();

        let payroll = await Payroll.findOne({
            employeeId,
            month,
            year
        }).populate('employeeId', 'name lastName email jobTitle department employeeId');

        // If no payroll exists for current month, create a default one
        if (!payroll) {
            const employee = await Employee.findById(employeeId);
            if (!employee) {
                return res.status(404).json({ message: 'Employee not found' });
            }

            const basicSalary = employee.salary || 0;
            
            // Default earnings calculation
            const earnings = {
                basicWage: basicSalary,
                houseRentAllowance: Math.round(basicSalary * 0.4), // 40% of basic
                transportAllowance: 2000,
                medicalAllowance: 1500,
                overtime: 0,
                gratuity: 0,
                specialAllowance: 0,
                performanceBonus: 0,
                projectBonus: 0,
                attendanceBonus: 0,
                pfEmployer: Math.round(basicSalary * 0.12), // 12% of basic
                esiEmployer: Math.round(basicSalary * 0.0325) // 3.25% of basic
            };
            earnings.totalEarnings = Object.values(earnings).reduce((sum, val) => sum + (val || 0), 0);

            // Default deductions calculation
            const deductions = {
                pfEmployee: Math.round(basicSalary * 0.12), // 12% of basic
                esiEmployee: Math.round(basicSalary * 0.0075), // 0.75% of basic
                professionalTax: 200,
                incomeTax: Math.round(basicSalary * 0.1), // 10% of basic
                advanceSalary: 0,
                loanDeduction: 0,
                otherDeductions: 0
            };
            deductions.total = Object.values(deductions).reduce((sum, val) => sum + (val || 0), 0);

            // Calculate CTC and in-hand salary
            const ctc = earnings.totalEarnings;
            const inHandSalary = earnings.totalEarnings - deductions.total;

            payroll = new Payroll({
                employeeId,
                month,
                year,
                basicSalary,
                earnings,
                deductions,
                ctc,
                inHandSalary,
                status: 'Pending'
            });

            await payroll.save();
        }

        res.json(payroll);
    } catch (error) {
        logger.error('Get Current Month Payroll for Admin Error', { error: error.message, stack: error.stack });
        res.status(500).json({ message: error.message });
    }
};

// Get all employees' payroll data for admin (Optimized - No N+1 queries)
export const getAllEmployeesPayroll = async (req, res) => {
    try {
        const { parsePagination, sendPaginatedResponse } = await import('../../helpers/paginationHelper.js');
        const { addOrganizationFilter } = await import('../../helpers/organizationHelper.js');
        
        // Parse pagination
        const { page, limit, skip } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });

        // Use current month/year if not provided
        const month = req.query.month || new Date().toLocaleString('default', { month: 'long' });
        const year = parseInt(req.query.year) || new Date().getFullYear();

        // Build query with organization filter
        const query = addOrganizationFilter(req, { salary: { $exists: true } });

        // If user is a manager (not admin or HR), filter by manager field
        // Example: Manager "Arun Kumar" sees payrolls for employees with manager="Arun Kumar" or "Arun"
        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        if (isManager && req.employee) {
            const managerQuery = buildManagerMatchQuery(req.employee);
            if (managerQuery && managerQuery.$or) {
                query.$or = managerQuery.$or;
            }
            query.status = 'active'; // Only active employees for managers
            
            const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();
            logger.info('Manager filtering employee payrolls by manager field', {
                managerId: req.employee._id,
                managerName: managerName
            });
        }

        // Get employees with pagination
        const [employees, totalEmployees] = await Promise.all([
            Employee.find(query)
                .select('name salary designation jobTitle department _id')
                .skip(skip)
                .limit(limit)
                .lean(),
            Employee.countDocuments(query)
        ]);

        // Get all payrolls for these employees in one query (fixes N+1)
        const employeeIds = employees.map(emp => emp._id);
        const payrolls = await Payroll.find({
            employeeId: { $in: employeeIds },
            month,
            year
        }).lean();

        // Create a map for O(1) lookup
        const payrollMap = new Map();
        payrolls.forEach(payroll => {
            payrollMap.set(payroll.employeeId.toString(), payroll);
        });

        // Build payroll summary per employee
        const payrollSummaries = employees.map(employee => {
            const payroll = payrollMap.get(employee._id.toString());
            return {
                employeeId: employee._id,
                name: employee.name,
                designation: employee.designation,
                jobTitle: employee.jobTitle,
                department: employee.department,
                basicSalary: employee.salary,
                ctc: payroll?.ctc || employee.salary,
                inHandSalary: payroll?.inHandSalary || employee.salary,
                totalEarnings: payroll?.earnings?.totalEarnings || 0,
                totalDeductions: payroll?.deductions?.total || 0,
                leaves: payroll?.leaves?.length || 0,
                status: payroll?.status || 'Not Generated',
                isVisible: payroll?.isVisible !== false
            };
        });

        return sendPaginatedResponse(res, payrollSummaries, page, limit, totalEmployees, 'Payroll data retrieved successfully');
    } catch (error) {
        logger.error('Admin Payroll Error', { error: error.message, stack: error.stack });
        res.status(500).json({ message: error.message });
    }
};

// Toggle payroll visibility
export const togglePayrollVisibility = async (req, res) => {
    try {
        const { id } = req.params;
        const { isVisible } = req.body;

        const payroll = await Payroll.findByIdAndUpdate(
            id,
            { isVisible },
            { new: true }
        ).populate('employeeId', 'name lastName email');

        if (!payroll) {
            return res.status(404).json({ 
                success: false,
                message: 'Payroll not found' 
            });
        }

        // Send push notification when payroll is made visible
        if (isVisible && payroll.employeeId) {
            try {
                const { notifyPayrollReleased } = await import('../../helpers/pushNotificationTriggers.js');
                await notifyPayrollReleased(payroll.employeeId._id || payroll.employeeId, payroll);
            } catch (notifError) {
                logger.warn('Failed to send payroll release notification', {
                    error: notifError.message,
                    payrollId: payroll._id
                });
                // Don't fail the request if notification fails
            }
        }

        res.status(200).json({
            success: true,
            message: `Payroll ${isVisible ? 'visible' : 'hidden'} successfully`,
            data: payroll
        });
    } catch (error) {
        logger.error('Toggle Visibility Error', { error: error.message, stack: error.stack });
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
};

// Generate default payrolls for all employees for a given month/year if missing
export const generatePayrollsForMonthYear = async (req, res) => {
    try {
        const { month, year } = req.body;
        if (!month || !year) {
            return res.status(400).json({ success: false, message: 'month and year are required' });
        }

        const employees = await Employee.find({ salary: { $exists: true } }).select('salary');
        let created = 0;

        // Helper: calculate working days (Mon-Fri) in target month
        const monthIndex = new Date(`${month} 1, ${year}`).getMonth();
        const startOfMonth = new Date(year, monthIndex, 1);
        const endOfMonth = new Date(year, monthIndex + 1, 0);

        const workingDaysInMonth = (() => {
            let working = 0;
            for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
                const day = d.getDay();
                if (day !== 0 && day !== 6) working += 1; // Mon-Fri
            }
            return working || 1; // avoid division by zero
        })();

        for (const emp of employees) {
            const exists = await Payroll.findOne({ employeeId: emp._id, month, year });
            if (exists) continue;

            const basicSalary = emp.salary || 0;
            
            // Attendance aggregation for the month
            const attendanceRecords = await Attendance.find({
                userId: emp._id,
                date: { $gte: startOfMonth, $lte: endOfMonth }
            });

            const presentDays = attendanceRecords.filter(r => ['present', 'loggedOut'].includes(r.status)).length;
            const halfDays = attendanceRecords.filter(r => r.status === 'half-day').length;
            const totalOvertimeHours = attendanceRecords.reduce((sum, r) => sum + (r.overtimeHours || 0), 0);

            // Approved leaves within month
            const approvedLeaves = await Leave.find({
                employee: emp._id,
                status: 'approved',
                $or: [
                    { startDate: { $lte: endOfMonth }, endDate: { $gte: startOfMonth } }
                ]
            });
            const leaveDays = approvedLeaves.reduce((sum, lv) => sum + (lv.duration || 0), 0);

            const effectivePresent = presentDays + (halfDays * 0.5) + leaveDays;
            const unpaidDays = Math.max(0, workingDaysInMonth - effectivePresent);
            const perDayRate = basicSalary / workingDaysInMonth;
            const adjustedBasic = Math.max(0, Math.round(basicSalary - unpaidDays * perDayRate));
            const overtimeRatePerHour = perDayRate / 8;
            const overtimePay = Math.round(totalOvertimeHours * overtimeRatePerHour);

            const earnings = {
                basicWage: adjustedBasic,
                houseRentAllowance: Math.round(basicSalary * 0.4),
                transportAllowance: 2000,
                medicalAllowance: 1500,
                overtime: overtimePay,
                gratuity: 0,
                specialAllowance: 0,
                performanceBonus: 0,
                projectBonus: 0,
                attendanceBonus: unpaidDays === 0 ? 0 : 0,
                pfEmployer: Math.round(basicSalary * 0.12),
                esiEmployer: Math.round(basicSalary * 0.0325)
            };
            earnings.totalEarnings = Object.values(earnings).reduce((s, v) => s + (v || 0), 0);

            const deductions = {
                pfEmployee: Math.round(basicSalary * 0.12),
                esiEmployee: Math.round(basicSalary * 0.0075),
                professionalTax: 200,
                incomeTax: Math.round(basicSalary * 0.1),
                advanceSalary: 0,
                loanDeduction: 0,
                otherDeductions: 0
            };
            deductions.total = Object.values(deductions).reduce((s, v) => s + (v || 0), 0);

            const payroll = new Payroll({
                employeeId: emp._id,
                month,
                year,
                basicSalary,
                earnings,
                deductions,
                ctc: earnings.totalEarnings,
                inHandSalary: earnings.totalEarnings - deductions.total,
                status: 'Pending'
            });
            await payroll.save();
            created += 1;
        }

        return res.json({ success: true, created });
    } catch (error) {
        logger.error('Generate Payrolls Error', { error: error.message, stack: error.stack });
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Disburse payrolls for a given month/year
export const disbursePayrolls = async (req, res) => {
    try {
        // CEO-only access check (extra security layer)
        const isCEO = req.employee && (
            (req.employee.position || '').toLowerCase().trim() === 'ceo' ||
            (req.employee.position || '').toLowerCase().trim().includes('chief executive')
        );
        
        if (!isCEO) {
            logger.warn('Unauthorized payroll disbursement attempt', {
                userId: req.user?._id || req.employee?._id,
                role: req.user?.role || req.employee?.role,
                position: req.employee?.position
            });
            return res.status(403).json({ 
                success: false, 
                message: 'Access restricted to CEO only. Only the CEO can disburse payroll.' 
            });
        }

        const adminId = req.employee?._id || req.user?._id;
        const { month, year } = req.body;
        if (!month || !year) {
            return res.status(400).json({ success: false, message: 'month and year are required' });
        }

        // Import organization helper for multi-tenancy support
        const { addOrganizationFilter } = await import('../../helpers/organizationHelper.js');
        
        // Build query with organization filter - SECURITY: Ensures multi-tenancy isolation
        const query = addOrganizationFilter(req, { 
            month, 
            year, 
            status: { $in: ['Processed', 'Pending'] } 
        });

        // Fetch payrolls eligible for payment (Processed or Pending depending on policy)
        const payrolls = await Payroll.find(query)
            .populate('employeeId', 'financialDetails name lastName');

        if (!payrolls.length) {
            return res.json({ success: true, total: 0, paid: 0, failed: 0, results: [] });
        }

        const results = [];
        let paid = 0;
        let failed = 0;

        for (const pr of payrolls) {
            const employee = pr.employeeId;
            const fin = employee?.financialDetails || {};
            const amount = Math.round(pr.inHandSalary || 0);

            const transfer = await transferToBank({
                amount,
                beneficiary: {
                    accountNo: fin.accountNo,
                    ifsc: fin.ifsc,
                    accountName: fin.accountName,
                    bankName: fin.bankName
                }
            });

            if (transfer.success) {
                pr.status = 'Paid';
                pr.paidDate = new Date();
                pr.lastModifiedBy = adminId;
                pr.payment = {
                    provider: transfer.provider,
                    reference: transfer.reference,
                    status: 'Success',
                    processedAt: new Date()
                };
                await pr.save();
                paid += 1;
                results.push({ 
                    payrollId: pr._id, 
                    employee: employee._id, 
                    employeeName: `${employee.name || ''} ${employee.lastName || ''}`.trim(),
                    employeeEmail: employee.email,
                    amount, 
                    status: 'Success', 
                    reference: transfer.reference 
                });
            } else {
                pr.payment = {
                    provider: 'mock-bank',
                    status: 'Failed',
                    processedAt: new Date(),
                    error: transfer.error
                };
                pr.lastModifiedBy = adminId;
                await pr.save();
                failed += 1;
                results.push({ 
                    payrollId: pr._id, 
                    employee: employee._id, 
                    employeeName: `${employee.name || ''} ${employee.lastName || ''}`.trim(),
                    employeeEmail: employee.email,
                    amount, 
                    status: 'Failed', 
                    error: transfer.error 
                });
            }
        }

        return res.json({ success: true, total: payrolls.length, paid, failed, results });
    } catch (error) {
        logger.error('Disburse Payrolls Error', { error: error.message, stack: error.stack });
        return res.status(500).json({ success: false, message: error.message });
    }
};