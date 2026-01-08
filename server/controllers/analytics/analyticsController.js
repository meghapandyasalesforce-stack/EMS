import { getOrganizationId } from '../../helpers/organizationHelper.js';
import asyncHandler from '../../middlewares/asyncHandler.js';
import Employee from '../../models/employee.model.js';
import Attendance from '../../models/attendance.model.js';
import Leave from '../../models/leave.model.js';
import { Recruitment, Candidate } from '../../models/recruitment.model.js';
import { Enrollment } from '../../models/learning.model.js';
import { SurveyResponse } from '../../models/engagement.model.js';
import { HelpdeskTicket } from '../../models/helpdesk.model.js';
import PerformanceReview from '../../models/performanceReview.model.js';

/**
 * Get comprehensive HR analytics
 */
export const getHRAnalytics = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
        if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Employee Statistics
    const [totalEmployees, activeEmployees, newHires, terminations] = await Promise.all([
        Employee.countDocuments({ organizationId }),
        Employee.countDocuments({ organizationId, status: 'active' }),
        Employee.countDocuments({ 
            organizationId, 
            joiningDate: { 
                $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) 
            } 
        }),
        Employee.countDocuments({ 
            organizationId, 
            status: 'inactive',
            ...dateFilter 
        })
    ]);

    // Attendance Analytics
    const attendanceStats = await Attendance.aggregate([
        { $match: { organizationId, ...dateFilter } },
        {
            $group: {
                _id: null,
                avgHours: { $avg: '$effectiveHours' },
                totalHours: { $sum: '$effectiveHours' },
                presentDays: { $sum: 1 }
            }
        }
    ]);

    // Leave Analytics
    const leaveStats = await Leave.aggregate([
        { $match: { organizationId, ...dateFilter } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalDays: { $sum: '$numberOfDays' }
            }
        }
    ]);

    // Recruitment Analytics
    const recruitmentStats = await Promise.all([
        Recruitment.countDocuments({ organizationId, ...dateFilter }),
        Candidate.countDocuments({ organizationId, ...dateFilter }),
        Candidate.aggregate([
            { $match: { organizationId, status: 'Offer Accepted', ...dateFilter } },
            {
                $group: {
                    _id: null,
                    avgTimeToFill: {
                        $avg: {
                            $divide: [
                                { $subtract: ['$offerDetails.offerLetter.sentDate', '$applicationDate'] },
                                86400000
                            ]
                        }
                    }
                }
            }
        ])
    ]);

    // Learning Analytics
    const learningStats = await Enrollment.aggregate([
        { $match: { organizationId, ...dateFilter } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                avgProgress: { $avg: '$progress' }
            }
        }
    ]);

    // Engagement Analytics
    const engagementStats = await SurveyResponse.aggregate([
        { $match: { organizationId, ...dateFilter } },
        {
            $group: {
                _id: null,
                totalResponses: { $sum: 1 },
                avgTimeSpent: { $avg: '$timeSpent' }
            }
        }
    ]);

    // Helpdesk Analytics
    const helpdeskStats = await HelpdeskTicket.aggregate([
        { $match: { organizationId, ...dateFilter } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    // Performance Analytics
    const performanceStats = await PerformanceReview.aggregate([
        { $match: { organizationId, ...dateFilter } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                avgRating: { $avg: '$managerEvaluation.overallRating' }
            }
        }
    ]);

    // Department Distribution
    const departmentDistribution = await Employee.aggregate([
        { $match: { organizationId, status: 'active' } },
        {
            $group: {
                _id: '$department',
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } }
    ]);

    // Enhanced Turnover Analysis
    const lastYearStart = new Date();
    lastYearStart.setFullYear(lastYearStart.getFullYear() - 1);
    
    // Try to get termination data (fields may not exist in all schemas)
    let voluntaryTerminations = 0;
    let involuntaryTerminations = 0;
    let terminationsByMonth = [];
    
    try {
        const terminationData = await Promise.all([
            Employee.countDocuments({ 
                organizationId, 
                status: 'inactive',
                terminationType: 'voluntary',
                ...dateFilter 
            }).catch(() => 0),
            Employee.countDocuments({ 
                organizationId, 
                status: 'inactive',
                terminationType: 'involuntary',
                ...dateFilter 
            }).catch(() => 0),
            Employee.aggregate([
                { 
                    $match: { 
                        organizationId, 
                        status: 'inactive',
                        updatedAt: { $gte: lastYearStart }
                    } 
                },
                {
                    $group: {
                        _id: { 
                            year: { $year: '$updatedAt' },
                            month: { $month: '$updatedAt' }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]).catch(() => [])
        ]);
        voluntaryTerminations = terminationData[0] || 0;
        involuntaryTerminations = terminationData[1] || 0;
        terminationsByMonth = terminationData[2] || [];
    } catch (error) {
        // If fields don't exist, use defaults
        logger.debug('Termination analysis fields not available', { error: error.message });
    }

    // Attrition Rate (Annualized)
    const avgEmployees = (totalEmployees + activeEmployees) / 2;
    const attritionRate = avgEmployees > 0 
        ? ((terminations / avgEmployees) * 100).toFixed(2)
        : 0;

    // Enhanced Recruitment Metrics
    const recruitmentDateFilter = dateFilter.createdAt ? { createdAt: dateFilter.createdAt } : {};
    const [hiredCandidates, rejectedCandidates, offerAccepted, offerRejected] = await Promise.all([
        Candidate.countDocuments({ 
            organizationId, 
            status: 'Offer Accepted',
            ...recruitmentDateFilter 
        }).catch(() => 0),
        Candidate.countDocuments({ 
            organizationId, 
            status: { $in: ['Rejected', 'Withdrawn'] },
            ...recruitmentDateFilter 
        }).catch(() => 0),
        Candidate.countDocuments({ 
            organizationId, 
            status: 'Offer Accepted',
            ...recruitmentDateFilter 
        }).catch(() => 0),
        Candidate.countDocuments({ 
            organizationId, 
            status: 'Offer Declined',
            ...recruitmentDateFilter 
        }).catch(() => 0)
    ]);

    // Time-to-Hire Calculation
    let timeToHireData = [];
    try {
        timeToHireData = await Candidate.aggregate([
            { 
                $match: { 
                    organizationId, 
                    status: 'Offer Accepted',
                    applicationDate: { $exists: true },
                    offerDetails: { $exists: true },
                    'offerDetails.offerLetter.sentDate': { $exists: true },
                    ...recruitmentDateFilter
                } 
            },
            {
                $project: {
                    daysToHire: {
                        $divide: [
                            { 
                                $subtract: [
                                    '$offerDetails.offerLetter.sentDate', 
                                    '$applicationDate'
                                ] 
                            },
                            86400000
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    avgTimeToHire: { $avg: '$daysToHire' },
                    minTimeToHire: { $min: '$daysToHire' },
                    maxTimeToHire: { $max: '$daysToHire' }
                }
            }
        ]).catch(() => []);
    } catch (error) {
        logger.debug('Time-to-hire calculation error', { error: error.message });
    }

    // Cost-per-Hire (simplified - can be enhanced with actual costs)
    const totalHires = hiredCandidates || 1;
    const estimatedCostPerHire = 5000; // Base estimate, should come from actual data
    const costPerHire = estimatedCostPerHire;

    // Offer Acceptance Rate
    const totalOffers = offerAccepted + offerRejected;
    const offerAcceptanceRate = totalOffers > 0 
        ? ((offerAccepted / totalOffers) * 100).toFixed(2)
        : 0;

    // Employee Lifecycle Analytics
    const lifecycleStats = await Employee.aggregate([
        { $match: { organizationId } },
        {
            $project: {
                tenure: {
                    $divide: [
                        { $subtract: [new Date(), '$joiningDate'] },
                        86400000 * 30 // Convert to months
                    ]
                },
                status: 1,
                department: 1
            }
        },
        {
            $group: {
                _id: null,
                avgTenure: { $avg: '$tenure' },
                medianTenure: { $percentile: { input: '$tenure', p: [0.5], method: 'approximate' } },
                newEmployeeCount: { 
                    $sum: { 
                        $cond: [{ $lte: ['$tenure', 6] }, 1, 0] 
                    } 
                },
                experiencedEmployeeCount: { 
                    $sum: { 
                        $cond: [{ $and: [{ $gt: ['$tenure', 6] }, { $lte: ['$tenure', 24] }] }, 1, 0] 
                    } 
                },
                veteranEmployeeCount: { 
                    $sum: { 
                        $cond: [{ $gt: ['$tenure', 24] }, 1, 0] 
                    } 
                }
            }
        }
    ]);

    // Diversity & Inclusion Metrics (if gender/ethnicity data exists)
    let diversityStats = [];
    try {
        diversityStats = await Employee.aggregate([
            { $match: { organizationId, status: 'active', gender: { $exists: true } } },
            {
                $group: {
                    _id: '$gender',
                    count: { $sum: 1 }
                }
            }
        ]).catch(() => []);
    } catch (error) {
        logger.debug('Diversity metrics not available', { error: error.message });
    }

    // Pay Equity Analysis (simplified)
    const payEquityStats = await Employee.aggregate([
        { $match: { organizationId, status: 'active', salary: { $exists: true } } },
        {
            $group: {
                _id: '$department',
                avgSalary: { $avg: '$salary' },
                minSalary: { $min: '$salary' },
                maxSalary: { $max: '$salary' },
                employeeCount: { $sum: 1 }
            }
        },
        { $sort: { avgSalary: -1 } }
    ]);

    // Performance Distribution
    const performanceDistribution = await PerformanceReview.aggregate([
        { $match: { organizationId, ...dateFilter } },
        {
            $project: {
                rating: '$managerEvaluation.overallRating',
                department: 1
            }
        },
        {
            $group: {
                _id: {
                    $cond: [
                        { $gte: ['$rating', 4.5] }, 'Excellent',
                        { $cond: [
                            { $gte: ['$rating', 3.5] }, 'Good',
                            { $cond: [
                                { $gte: ['$rating', 2.5] }, 'Average',
                                { $cond: [
                                    { $gte: ['$rating', 1.5] }, 'Below Average',
                                    'Needs Improvement'
                                ]}
                            ]}
                        ]}
                    ]
                },
                count: { $sum: 1 }
            }
        }
    ]);

    // Training Effectiveness
    const trainingEffectiveness = await Enrollment.aggregate([
        { $match: { organizationId, status: 'Completed', ...dateFilter } },
        {
            $lookup: {
                from: 'courses',
                localField: 'courseId',
                foreignField: '_id',
                as: 'course'
            }
        },
        {
            $group: {
                _id: '$course.category',
                completedCount: { $sum: 1 },
                avgProgress: { $avg: '$progress' },
                avgScore: { $avg: '$finalScore' }
            }
        }
    ]);

    // Engagement Trends
    const engagementTrends = await SurveyResponse.aggregate([
        { $match: { organizationId, ...dateFilter } },
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                },
                responseCount: { $sum: 1 },
                avgTimeSpent: { $avg: '$timeSpent' },
                avgScore: { $avg: '$overallScore' }
            }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
        success: true,
        data: {
            employees: {
                total: totalEmployees,
                active: activeEmployees,
                newHires,
                terminations,
                attritionRate: parseFloat(attritionRate),
                voluntaryTerminations,
                involuntaryTerminations,
                terminationsByMonth
            },
            attendance: attendanceStats[0] || {},
            leaves: leaveStats,
            recruitment: {
                totalPostings: recruitmentStats[0],
                totalCandidates: recruitmentStats[1],
                avgTimeToFill: recruitmentStats[2][0]?.avgTimeToFill || 0,
                timeToHire: timeToHireData[0] || {},
                costPerHire,
                offerAcceptanceRate: parseFloat(offerAcceptanceRate),
                hiredCandidates,
                rejectedCandidates,
                offerAccepted,
                offerRejected
            },
            learning: learningStats,
            learningEffectiveness: trainingEffectiveness,
            engagement: engagementStats[0] || {},
            engagementTrends,
            helpdesk: helpdeskStats,
            performance: performanceStats,
            performanceDistribution,
            departmentDistribution,
            lifecycle: lifecycleStats[0] || {},
            diversity: diversityStats,
            payEquity: payEquityStats
        }
    });
});

/**
 * Get Manager Analytics
 */
export const getManagerAnalytics = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const managerId = req.employee?._id || req.user?._id;
    const { startDate, endDate } = req.query;

    // Get manager's team
    const manager = await Employee.findById(managerId);
    if (!manager) {
        return res.status(404).json({
            success: false,
            message: 'Manager not found'
        });
    }

    const teamMembers = await Employee.find({
        organizationId,
        manager: managerId,
        status: 'active'
    });

    const teamMemberIds = teamMembers.map(emp => emp._id);

    const dateFilter = {};
    if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
        if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Team Statistics
    const teamSize = teamMembers.length;

    // Team Attendance
    const teamAttendance = await Attendance.aggregate([
        {
            $match: {
                organizationId,
                employeeId: { $in: teamMemberIds },
                ...dateFilter
            }
        },
        {
            $group: {
                _id: '$employeeId',
                totalHours: { $sum: '$effectiveHours' },
                presentDays: { $sum: 1 }
            }
        }
    ]);

    // Team Performance
    const teamPerformance = await PerformanceReview.aggregate([
        {
            $match: {
                organizationId,
                employeeId: { $in: teamMemberIds },
                ...dateFilter
            }
        },
        {
            $group: {
                _id: null,
                avgRating: { $avg: '$managerEvaluation.overallRating' },
                completedReviews: { $sum: 1 }
            }
        }
    ]);

    // Team Leaves
    const teamLeaves = await Leave.aggregate([
        {
            $match: {
                organizationId,
                employeeId: { $in: teamMemberIds },
                ...dateFilter
            }
        },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalDays: { $sum: '$numberOfDays' }
            }
        }
    ]);

    res.json({
        success: true,
        data: {
            teamSize,
            teamMembers: teamMembers.map(emp => ({
                id: emp._id,
                name: emp.name,
                email: emp.email,
                department: emp.department,
                position: emp.position
            })),
            attendance: teamAttendance,
            performance: teamPerformance[0] || {},
            leaves: teamLeaves
        }
    });
});

