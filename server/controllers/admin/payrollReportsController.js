import Payroll from '../../models/payroll.model.js';
import Employee from '../../models/employee.model.js';
import logger from '../../helpers/logger.js';
import { sendSuccess, sendError } from '../../helpers/responseHelper.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import { parsePagination, sendPaginatedResponse } from '../../helpers/paginationHelper.js';

/**
 * Get payroll statistics/analytics
 * GET /api/v1/admin/payroll-reports/statistics
 */
export const getPayrollStatistics = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);
        const { month, year, startDate, endDate } = req.query;

        const query = addOrganizationFilter(req, {});

        // Date range filter
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        } else if (month && year) {
            const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
            const endOfMonth = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
            query.createdAt = {
                $gte: startOfMonth,
                $lte: endOfMonth
            };
        } else if (year) {
            const startOfYear = new Date(parseInt(year), 0, 1);
            const endOfYear = new Date(parseInt(year), 11, 31, 23, 59, 59);
            query.createdAt = {
                $gte: startOfYear,
                $lte: endOfYear
            };
        }

        const payrolls = await Payroll.find(query)
            .populate('employeeId', 'name lastName department position')
            .lean();

        // Calculate statistics
        const totalPayrolls = payrolls.length;
        const totalEmployees = new Set(payrolls.map(p => p.employeeId?._id?.toString())).size;

        const totalEarnings = payrolls.reduce((sum, p) => sum + (p.earnings?.totalEarnings || 0), 0);
        const totalDeductions = payrolls.reduce((sum, p) => sum + (p.deductions?.total || 0), 0);
        const totalInHand = payrolls.reduce((sum, p) => sum + (p.inHandSalary || 0), 0);
        const totalCTC = payrolls.reduce((sum, p) => sum + (p.ctc || 0), 0);

        // Status breakdown
        const statusBreakdown = {
            pending: payrolls.filter(p => p.status === 'Pending').length,
            processed: payrolls.filter(p => p.status === 'Processed').length,
            paid: payrolls.filter(p => p.status === 'Paid').length
        };

        // Department-wise breakdown
        const departmentStats = {};
        payrolls.forEach(p => {
            const dept = p.employeeId?.department || 'Unknown';
            if (!departmentStats[dept]) {
                departmentStats[dept] = {
                    count: 0,
                    totalEarnings: 0,
                    totalDeductions: 0,
                    totalInHand: 0,
                    employees: new Set()
                };
            }
            departmentStats[dept].count++;
            departmentStats[dept].totalEarnings += p.earnings?.totalEarnings || 0;
            departmentStats[dept].totalDeductions += p.deductions?.total || 0;
            departmentStats[dept].totalInHand += p.inHandSalary || 0;
            if (p.employeeId?._id) {
                departmentStats[dept].employees.add(p.employeeId._id.toString());
            }
        });

        // Convert Set to count
        Object.keys(departmentStats).forEach(dept => {
            departmentStats[dept].employees = departmentStats[dept].employees.size;
        });

        // Average calculations
        const avgEarnings = totalPayrolls > 0 ? totalEarnings / totalPayrolls : 0;
        const avgDeductions = totalPayrolls > 0 ? totalDeductions / totalPayrolls : 0;
        const avgInHand = totalPayrolls > 0 ? totalInHand / totalPayrolls : 0;

        return sendSuccess(res, {
            summary: {
                totalPayrolls,
                totalEmployees,
                totalEarnings,
                totalDeductions,
                totalInHand,
                totalCTC,
                avgEarnings,
                avgDeductions,
                avgInHand
            },
            statusBreakdown,
            departmentStats
        }, 'Payroll statistics retrieved successfully');
    } catch (error) {
        logger.error('Get Payroll Statistics Error', {
            error: error.message,
            stack: error.stack
        });
        return sendError(res, 'Error fetching payroll statistics', 500, 'FETCH_ERROR');
    }
};

/**
 * Get monthly payroll summary
 * GET /api/v1/admin/payroll-reports/monthly-summary
 */
export const getMonthlySummary = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);
        const { year } = req.query;
        const targetYear = year ? parseInt(year) : new Date().getFullYear();

        const query = addOrganizationFilter(req, { year: targetYear });

        const payrolls = await Payroll.find(query).lean();

        // Group by month
        const monthlyData = {};
        for (let month = 1; month <= 12; month++) {
            const monthName = new Date(targetYear, month - 1).toLocaleString('default', { month: 'long' });
            monthlyData[month] = {
                month: monthName,
                monthNumber: month,
                count: 0,
                totalEarnings: 0,
                totalDeductions: 0,
                totalInHand: 0,
                employees: new Set()
            };
        }

        payrolls.forEach(p => {
            const monthNum = new Date(p.createdAt || new Date()).getMonth() + 1;
            if (monthlyData[monthNum]) {
                monthlyData[monthNum].count++;
                monthlyData[monthNum].totalEarnings += p.earnings?.totalEarnings || 0;
                monthlyData[monthNum].totalDeductions += p.deductions?.total || 0;
                monthlyData[monthNum].totalInHand += p.inHandSalary || 0;
                if (p.employeeId) {
                    monthlyData[monthNum].employees.add(p.employeeId.toString());
                }
            }
        });

        // Convert Set to count and format
        const summary = Object.values(monthlyData).map(data => ({
            ...data,
            employees: data.employees.size
        }));

        return sendSuccess(res, {
            year: targetYear,
            monthlySummary: summary
        }, 'Monthly summary retrieved successfully');
    } catch (error) {
        logger.error('Get Monthly Summary Error', {
            error: error.message,
            stack: error.stack
        });
        return sendError(res, 'Error fetching monthly summary', 500, 'FETCH_ERROR');
    }
};

/**
 * Get department-wise payroll report
 * GET /api/v1/admin/payroll-reports/department-wise
 */
export const getDepartmentWiseReport = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);
        const { month, year, startDate, endDate } = req.query;

        const query = addOrganizationFilter(req, {});

        if (month && year) {
            query.month = month;
            query.year = parseInt(year);
        } else if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const payrolls = await Payroll.find(query)
            .populate('employeeId', 'name lastName department position')
            .lean();

        // Group by department
        const departmentReport = {};
        payrolls.forEach(p => {
            const dept = p.employeeId?.department || 'Unknown';
            if (!departmentReport[dept]) {
                departmentReport[dept] = {
                    department: dept,
                    employees: [],
                    totalEarnings: 0,
                    totalDeductions: 0,
                    totalInHand: 0,
                    employeeCount: 0
                };
            }

            const earnings = p.earnings?.totalEarnings || 0;
            const deductions = p.deductions?.total || 0;
            const inHand = p.inHandSalary || 0;

            departmentReport[dept].totalEarnings += earnings;
            departmentReport[dept].totalDeductions += deductions;
            departmentReport[dept].totalInHand += inHand;
            departmentReport[dept].employeeCount++;

            departmentReport[dept].employees.push({
                employeeId: p.employeeId?._id,
                employeeName: `${p.employeeId?.name || ''} ${p.employeeId?.lastName || ''}`.trim(),
                earnings,
                deductions,
                inHand,
                status: p.status
            });
        });

        return sendSuccess(res, {
            report: Object.values(departmentReport),
            period: month && year ? `${month} ${year}` : (startDate && endDate ? `${startDate} to ${endDate}` : 'All time')
        }, 'Department-wise report retrieved successfully');
    } catch (error) {
        logger.error('Get Department Wise Report Error', {
            error: error.message,
            stack: error.stack
        });
        return sendError(res, 'Error fetching department-wise report', 500, 'FETCH_ERROR');
    }
};

/**
 * Get tax report
 * GET /api/v1/admin/payroll-reports/tax-report
 */
export const getTaxReport = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);
        const { month, year, startDate, endDate } = req.query;

        const query = addOrganizationFilter(req, {});

        if (month && year) {
            query.month = month;
            query.year = parseInt(year);
        } else if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const payrolls = await Payroll.find(query)
            .populate('employeeId', 'name lastName employeeId department')
            .lean();

        const taxReport = payrolls.map(p => ({
            employeeId: p.employeeId?._id,
            employeeName: `${p.employeeId?.name || ''} ${p.employeeId?.lastName || ''}`.trim(),
            employeeCode: p.employeeId?.employeeId,
            department: p.employeeId?.department,
            month: p.month,
            year: p.year,
            basicSalary: p.basicSalary || 0,
            totalEarnings: p.earnings?.totalEarnings || 0,
            incomeTax: p.deductions?.incomeTax || 0,
            professionalTax: p.deductions?.professionalTax || 0,
            totalTax: (p.deductions?.incomeTax || 0) + (p.deductions?.professionalTax || 0),
            inHandSalary: p.inHandSalary || 0
        }));

        const totalTax = taxReport.reduce((sum, r) => sum + r.totalTax, 0);
        const totalIncomeTax = taxReport.reduce((sum, r) => sum + r.incomeTax, 0);
        const totalProfessionalTax = taxReport.reduce((sum, r) => sum + r.professionalTax, 0);

        return sendSuccess(res, {
            report: taxReport,
            summary: {
                totalEmployees: taxReport.length,
                totalIncomeTax,
                totalProfessionalTax,
                totalTax
            },
            period: month && year ? `${month} ${year}` : (startDate && endDate ? `${startDate} to ${endDate}` : 'All time')
        }, 'Tax report retrieved successfully');
    } catch (error) {
        logger.error('Get Tax Report Error', {
            error: error.message,
            stack: error.stack
        });
        return sendError(res, 'Error fetching tax report', 500, 'FETCH_ERROR');
    }
};

/**
 * Get deductions report
 * GET /api/v1/admin/payroll-reports/deductions-report
 */
export const getDeductionsReport = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);
        const { month, year, startDate, endDate } = req.query;

        const query = addOrganizationFilter(req, {});

        if (month && year) {
            query.month = month;
            query.year = parseInt(year);
        } else if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const payrolls = await Payroll.find(query)
            .populate('employeeId', 'name lastName employeeId department')
            .lean();

        const deductionsReport = payrolls.map(p => ({
            employeeId: p.employeeId?._id,
            employeeName: `${p.employeeId?.name || ''} ${p.employeeId?.lastName || ''}`.trim(),
            employeeCode: p.employeeId?.employeeId,
            department: p.employeeId?.department,
            month: p.month,
            year: p.year,
            pfEmployee: p.deductions?.pfEmployee || 0,
            esiEmployee: p.deductions?.esiEmployee || 0,
            professionalTax: p.deductions?.professionalTax || 0,
            incomeTax: p.deductions?.incomeTax || 0,
            advanceSalary: p.deductions?.advanceSalary || 0,
            loanDeduction: p.deductions?.loanDeduction || 0,
            otherDeductions: p.deductions?.otherDeductions || 0,
            totalDeductions: p.deductions?.total || 0
        }));

        const summary = {
            totalPF: deductionsReport.reduce((sum, r) => sum + r.pfEmployee, 0),
            totalESI: deductionsReport.reduce((sum, r) => sum + r.esiEmployee, 0),
            totalProfessionalTax: deductionsReport.reduce((sum, r) => sum + r.professionalTax, 0),
            totalIncomeTax: deductionsReport.reduce((sum, r) => sum + r.incomeTax, 0),
            totalAdvanceSalary: deductionsReport.reduce((sum, r) => sum + r.advanceSalary, 0),
            totalLoanDeduction: deductionsReport.reduce((sum, r) => sum + r.loanDeduction, 0),
            totalOtherDeductions: deductionsReport.reduce((sum, r) => sum + r.otherDeductions, 0),
            totalDeductions: deductionsReport.reduce((sum, r) => sum + r.totalDeductions, 0)
        };

        return sendSuccess(res, {
            report: deductionsReport,
            summary,
            period: month && year ? `${month} ${year}` : (startDate && endDate ? `${startDate} to ${endDate}` : 'All time')
        }, 'Deductions report retrieved successfully');
    } catch (error) {
        logger.error('Get Deductions Report Error', {
            error: error.message,
            stack: error.stack
        });
        return sendError(res, 'Error fetching deductions report', 500, 'FETCH_ERROR');
    }
};

/**
 * Get earnings report
 * GET /api/v1/admin/payroll-reports/earnings-report
 */
export const getEarningsReport = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);
        const { month, year, startDate, endDate } = req.query;

        const query = addOrganizationFilter(req, {});

        if (month && year) {
            query.month = month;
            query.year = parseInt(year);
        } else if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const payrolls = await Payroll.find(query)
            .populate('employeeId', 'name lastName employeeId department')
            .lean();

        const earningsReport = payrolls.map(p => ({
            employeeId: p.employeeId?._id,
            employeeName: `${p.employeeId?.name || ''} ${p.employeeId?.lastName || ''}`.trim(),
            employeeCode: p.employeeId?.employeeId,
            department: p.employeeId?.department,
            month: p.month,
            year: p.year,
            basicWage: p.earnings?.basicWage || 0,
            houseRentAllowance: p.earnings?.houseRentAllowance || 0,
            transportAllowance: p.earnings?.transportAllowance || 0,
            medicalAllowance: p.earnings?.medicalAllowance || 0,
            overtime: p.earnings?.overtime || 0,
            specialAllowance: p.earnings?.specialAllowance || 0,
            performanceBonus: p.earnings?.performanceBonus || 0,
            projectBonus: p.earnings?.projectBonus || 0,
            attendanceBonus: p.earnings?.attendanceBonus || 0,
            totalEarnings: p.earnings?.totalEarnings || 0
        }));

        const summary = {
            totalBasicWage: earningsReport.reduce((sum, r) => sum + r.basicWage, 0),
            totalHRA: earningsReport.reduce((sum, r) => sum + r.houseRentAllowance, 0),
            totalTransport: earningsReport.reduce((sum, r) => sum + r.transportAllowance, 0),
            totalMedical: earningsReport.reduce((sum, r) => sum + r.medicalAllowance, 0),
            totalOvertime: earningsReport.reduce((sum, r) => sum + r.overtime, 0),
            totalSpecialAllowance: earningsReport.reduce((sum, r) => sum + r.specialAllowance, 0),
            totalPerformanceBonus: earningsReport.reduce((sum, r) => sum + r.performanceBonus, 0),
            totalProjectBonus: earningsReport.reduce((sum, r) => sum + r.projectBonus, 0),
            totalAttendanceBonus: earningsReport.reduce((sum, r) => sum + r.attendanceBonus, 0),
            totalEarnings: earningsReport.reduce((sum, r) => sum + r.totalEarnings, 0)
        };

        return sendSuccess(res, {
            report: earningsReport,
            summary,
            period: month && year ? `${month} ${year}` : (startDate && endDate ? `${startDate} to ${endDate}` : 'All time')
        }, 'Earnings report retrieved successfully');
    } catch (error) {
        logger.error('Get Earnings Report Error', {
            error: error.message,
            stack: error.stack
        });
        return sendError(res, 'Error fetching earnings report', 500, 'FETCH_ERROR');
    }
};

/**
 * Get comparison report (month-over-month or year-over-year)
 * GET /api/v1/admin/payroll-reports/comparison
 */
export const getComparisonReport = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);
        const { type = 'month', period1, period2 } = req.query; // type: 'month' or 'year'

        if (!period1 || !period2) {
            return sendError(res, 'Both period1 and period2 are required', 400, 'VALIDATION_ERROR');
        }

        const query1 = addOrganizationFilter(req, {});
        const query2 = addOrganizationFilter(req, {});

        if (type === 'month') {
            // Format: "January 2024"
            const [month1, year1] = period1.split(' ');
            const [month2, year2] = period2.split(' ');
            const monthNum1 = new Date(`${month1} 1, ${year1}`).getMonth() + 1;
            const monthNum2 = new Date(`${month2} 1, ${year2}`).getMonth() + 1;

            query1.month = month1;
            query1.year = parseInt(year1);
            query2.month = month2;
            query2.year = parseInt(year2);
        } else {
            // Year comparison
            query1.year = parseInt(period1);
            query2.year = parseInt(period2);
        }

        const [payrolls1, payrolls2] = await Promise.all([
            Payroll.find(query1).lean(),
            Payroll.find(query2).lean()
        ]);

        const calculateTotals = (payrolls) => {
            return {
                count: payrolls.length,
                totalEarnings: payrolls.reduce((sum, p) => sum + (p.earnings?.totalEarnings || 0), 0),
                totalDeductions: payrolls.reduce((sum, p) => sum + (p.deductions?.total || 0), 0),
                totalInHand: payrolls.reduce((sum, p) => sum + (p.inHandSalary || 0), 0),
                totalCTC: payrolls.reduce((sum, p) => sum + (p.ctc || 0), 0),
                avgEarnings: payrolls.length > 0 ? payrolls.reduce((sum, p) => sum + (p.earnings?.totalEarnings || 0), 0) / payrolls.length : 0,
                avgInHand: payrolls.length > 0 ? payrolls.reduce((sum, p) => sum + (p.inHandSalary || 0), 0) / payrolls.length : 0
            };
        };

        const totals1 = calculateTotals(payrolls1);
        const totals2 = calculateTotals(payrolls2);

        const comparison = {
            period1: {
                period: period1,
                ...totals1
            },
            period2: {
                period: period2,
                ...totals2
            },
            difference: {
                count: totals2.count - totals1.count,
                totalEarnings: totals2.totalEarnings - totals1.totalEarnings,
                totalDeductions: totals2.totalDeductions - totals1.totalDeductions,
                totalInHand: totals2.totalInHand - totals1.totalInHand,
                totalCTC: totals2.totalCTC - totals1.totalCTC,
                avgEarnings: totals2.avgEarnings - totals1.avgEarnings,
                avgInHand: totals2.avgInHand - totals1.avgInHand
            },
            percentageChange: {
                count: totals1.count > 0 ? ((totals2.count - totals1.count) / totals1.count * 100).toFixed(2) : 0,
                totalEarnings: totals1.totalEarnings > 0 ? ((totals2.totalEarnings - totals1.totalEarnings) / totals1.totalEarnings * 100).toFixed(2) : 0,
                totalDeductions: totals1.totalDeductions > 0 ? ((totals2.totalDeductions - totals1.totalDeductions) / totals1.totalDeductions * 100).toFixed(2) : 0,
                totalInHand: totals1.totalInHand > 0 ? ((totals2.totalInHand - totals1.totalInHand) / totals1.totalInHand * 100).toFixed(2) : 0
            }
        };

        return sendSuccess(res, {
            type,
            comparison
        }, 'Comparison report retrieved successfully');
    } catch (error) {
        logger.error('Get Comparison Report Error', {
            error: error.message,
            stack: error.stack
        });
        return sendError(res, 'Error fetching comparison report', 500, 'FETCH_ERROR');
    }
};

