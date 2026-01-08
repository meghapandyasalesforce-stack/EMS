import { Recruitment, Candidate } from '../../models/recruitment.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import { parsePagination, parseSort, sendPaginatedResponse } from '../../helpers/paginationHelper.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../middlewares/asyncHandler.js';

// If asyncHandler doesn't exist, use try-catch pattern
const handleAsync = asyncHandler || ((fn) => async (req, res, next) => {
    try {
        await fn(req, res, next);
    } catch (error) {
        logger.error('Error in recruitment controller', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * @route   POST /api/v1/admin/recruitment/jobs
 * @desc    Create a new job posting
 * @access  Admin only
 * @param   {Object} req.body - Job posting data
 * @param   {string} req.body.jobTitle - Job title (required)
 * @param   {string} req.body.department - Department (required)
 * @param   {string} req.body.jobDescription - Job description (required)
 * @returns {Object} Created job posting
 */
export const createJobPosting = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const createdBy = req.user?._id || req.employee?._id;

    const jobPosting = new Recruitment({
        ...req.body,
        organizationId,
        createdBy
    });

    await jobPosting.save();

    res.status(201).json({
        success: true,
        message: 'Job posting created successfully',
        data: jobPosting
    });
});

/**
 * @route   GET /api/v1/admin/recruitment/jobs
 * @desc    Get all job postings with pagination
 * @access  Admin/HR
 * @query   {number} page - Page number (default: 1)
 * @query   {number} limit - Items per page (default: 20, max: 100)
 * @query   {string} status - Filter by status (Draft, Open, Closed, etc.)
 * @query   {string} department - Filter by department
 * @query   {string} sort - Sort field (default: -createdAt)
 * @returns {Object} Paginated job postings
 */
export const getJobPostings = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { status, department } = req.query;

    // Parse pagination and sort
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });
    const sort = parseSort(req, '-createdAt');

    const query = addOrganizationFilter(req, {});

    if (status) query.status = status;
    if (department) query.department = department;

    // Optimized query with lean() and parallel count
    const [jobPostings, total] = await Promise.all([
        Recruitment.find(query)
            .populate('hiringManager', 'name email')
            .populate('recruiter', 'name email')
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean(), // Use lean() for better performance
        Recruitment.countDocuments(query)
    ]);

    return sendPaginatedResponse(res, jobPostings, page, limit, total, 'Job postings retrieved successfully');
});

/**
 * @route   GET /api/v1/admin/recruitment/jobs/:id
 * @desc    Get job posting by ID
 * @access  Admin/HR
 * @param   {string} id - Job posting ID
 * @returns {Object} Job posting details
 */
export const getJobPostingById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const jobPosting = await Recruitment.findOne({
        _id: id,
        organizationId
    })
        .populate('hiringManager', 'name email')
        .populate('recruiter', 'name email')
        .populate('createdBy', 'name email')
        .lean(); // Use lean() for better performance

    if (!jobPosting) {
        return res.status(404).json({
            success: false,
            message: 'Job posting not found'
        });
    }

    res.json({
        success: true,
        data: jobPosting
    });
});

/**
 * Update job posting
 */
export const updateJobPosting = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const jobPosting = await Recruitment.findOneAndUpdate(
        { _id: id, organizationId },
        req.body,
        { new: true, runValidators: true }
    );

    if (!jobPosting) {
        return res.status(404).json({
            success: false,
            message: 'Job posting not found'
        });
    }

    res.json({
        success: true,
        message: 'Job posting updated successfully',
        data: jobPosting
    });
});

/**
 * Delete job posting
 */
export const deleteJobPosting = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const jobPosting = await Recruitment.findOneAndDelete({
        _id: id,
        organizationId
    });

    if (!jobPosting) {
        return res.status(404).json({
            success: false,
            message: 'Job posting not found'
        });
    }

    res.json({
        success: true,
        message: 'Job posting deleted successfully'
    });
});

/**
 * Apply for a job (Create candidate)
 */
export const applyForJob = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { jobPostingId } = req.params;

    // Check if job posting exists and is open
    const jobPosting = await Recruitment.findOne({
        _id: jobPostingId,
        organizationId,
        status: 'Open'
    });

    if (!jobPosting) {
        return res.status(404).json({
            success: false,
            message: 'Job posting not found or not accepting applications'
        });
    }

    const candidate = new Candidate({
        ...req.body,
        organizationId,
        jobPostingId,
        applicationDate: new Date()
    });

    await candidate.save();

    // Update job posting stats
    jobPosting.currentApplications = (jobPosting.currentApplications || 0) + 1;
    await jobPosting.save();

    res.status(201).json({
        success: true,
        message: 'Application submitted successfully',
        data: candidate
    });
});

/**
 * Get all candidates
 */
export const getCandidates = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { jobPostingId, status, stage, page = 1, limit = 20 } = req.query;

    const query = addOrganizationFilter(req, {});

    if (jobPostingId) query.jobPostingId = jobPostingId;
    if (status) query.status = status;
    if (stage) query.stage = stage;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const candidates = await Candidate.find(query)
        .populate('jobPostingId', 'jobTitle department')
        .populate('referredBy', 'name email')
        .sort({ applicationDate: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Candidate.countDocuments(query);

    res.json({
        success: true,
        data: candidates,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

/**
 * Get candidate by ID
 */
export const getCandidateById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const candidate = await Candidate.findOne({
        _id: id,
        organizationId
    })
        .populate('jobPostingId', 'jobTitle department')
        .populate('referredBy', 'name email')
        .populate('interviewSchedule.interviewer', 'name email');

    if (!candidate) {
        return res.status(404).json({
            success: false,
            message: 'Candidate not found'
        });
    }

    res.json({
        success: true,
        data: candidate
    });
});

/**
 * Update candidate status
 */
export const updateCandidateStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const { status, stage, notes } = req.body;

    const candidate = await Candidate.findOne({
        _id: id,
        organizationId
    });

    if (!candidate) {
        return res.status(404).json({
            success: false,
            message: 'Candidate not found'
        });
    }

    if (status) candidate.status = status;
    if (stage) candidate.stage = stage;
    if (notes) {
        candidate.notes.push({
            note: notes,
            addedBy: req.user?._id || req.employee?._id,
            addedAt: new Date()
        });
    }

    await candidate.save();

    res.json({
        success: true,
        message: 'Candidate status updated successfully',
        data: candidate
    });
});

/**
 * Schedule interview
 */
export const scheduleInterview = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const candidate = await Candidate.findOne({
        _id: id,
        organizationId
    });

    if (!candidate) {
        return res.status(404).json({
            success: false,
            message: 'Candidate not found'
        });
    }

    candidate.interviewSchedule.push({
        ...req.body,
        status: 'Scheduled'
    });

    await candidate.save();

    res.json({
        success: true,
        message: 'Interview scheduled successfully',
        data: candidate
    });
});

/**
 * Get recruitment analytics
 */
export const getRecruitmentAnalytics = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
        if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const [totalPostings, openPostings, totalCandidates, candidatesByStage, 
           timeToFill, sourceStats] = await Promise.all([
        Recruitment.countDocuments({ organizationId, ...dateFilter }),
        Recruitment.countDocuments({ organizationId, status: 'Open', ...dateFilter }),
        Candidate.countDocuments({ organizationId, ...dateFilter }),
        Candidate.aggregate([
            { $match: { organizationId, ...dateFilter } },
            { $group: { _id: '$stage', count: { $sum: 1 } } }
        ]),
        Candidate.aggregate([
            { $match: { organizationId, status: 'Offer Accepted', ...dateFilter } },
            {
                $project: {
                    days: {
                        $divide: [
                            { $subtract: ['$offerDetails.offerLetter.sentDate', '$applicationDate'] },
                            86400000
                        ]
                    }
                }
            },
            { $group: { _id: null, avgDays: { $avg: '$days' } } }
        ]),
        Candidate.aggregate([
            { $match: { organizationId, ...dateFilter } },
            { $group: { _id: '$source', count: { $sum: 1 } } }
        ])
    ]);

    res.json({
        success: true,
        data: {
            totalPostings,
            openPostings,
            totalCandidates,
            candidatesByStage,
            averageTimeToFill: timeToFill[0]?.avgDays || 0,
            sourceStatistics: sourceStats
        }
    });
});

/**
 * Calculate and update candidate scores
 * @route POST /api/v1/admin/recruitment/candidates/:id/score
 */
export const calculateCandidateScore = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const { resumeScore, technicalScore, culturalFitScore } = req.body;

    const candidate = await Candidate.findOne({
        _id: id,
        organizationId
    });

    if (!candidate) {
        return res.status(404).json({
            success: false,
            message: 'Candidate not found'
        });
    }

    // Calculate overall score (weighted average)
    const weights = {
        resume: 0.3,
        technical: 0.4,
        cultural: 0.3
    };

    const overallScore = (
        (resumeScore || 0) * weights.resume +
        (technicalScore || 0) * weights.technical +
        (culturalFitScore || 0) * weights.cultural
    );

    candidate.scores = {
        resumeScore: resumeScore || candidate.scores?.resumeScore || 0,
        technicalScore: technicalScore || candidate.scores?.technicalScore || 0,
        culturalFitScore: culturalFitScore || candidate.scores?.culturalFitScore || 0,
        overallScore: overallScore || candidate.scores?.overallScore || 0
    };

    await candidate.save();

    res.json({
        success: true,
        message: 'Candidate score calculated successfully',
        data: candidate
    });
});

/**
 * Get candidate pipeline visualization
 * @route GET /api/v1/admin/recruitment/pipeline
 */
export const getCandidatePipeline = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { jobPostingId } = req.query;

    const matchQuery = { organizationId };
    if (jobPostingId) matchQuery.jobPostingId = jobPostingId;

    const pipeline = await Candidate.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: '$stage',
                count: { $sum: 1 },
                candidates: {
                    $push: {
                        id: '$_id',
                        name: { $concat: ['$firstName', ' ', '$lastName'] },
                        status: '$status',
                        overallScore: '$scores.overallScore',
                        applicationDate: '$applicationDate'
                    }
                }
            }
        },
        {
            $project: {
                stage: '$_id',
                count: 1,
                candidates: {
                    $slice: [
                        {
                            $sortArray: {
                                input: '$candidates',
                                sortBy: { overallScore: -1, applicationDate: -1 }
                            }
                        },
                        10 // Top 10 per stage
                    ]
                }
            }
        },
        { $sort: { stage: 1 } }
    ]);

    res.json({
        success: true,
        data: pipeline
    });
});

/**
 * Get ranked candidates for a job posting
 * @route GET /api/v1/admin/recruitment/jobs/:id/candidates/ranked
 */
export const getRankedCandidates = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const { limit = 20 } = req.query;

    const jobPosting = await Recruitment.findOne({
        _id: id,
        organizationId
    });

    if (!jobPosting) {
        return res.status(404).json({
            success: false,
            message: 'Job posting not found'
        });
    }

    const candidates = await Candidate.find({
        organizationId,
        jobPostingId: id
    })
        .populate('referredBy', 'name email')
        .sort({ 'scores.overallScore': -1, applicationDate: -1 })
        .limit(parseInt(limit))
        .lean();

    res.json({
        success: true,
        data: candidates
    });
});

/**
 * Generate offer letter data
 * @route POST /api/v1/admin/recruitment/candidates/:id/generate-offer
 */
export const generateOfferLetter = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const { position, startDate, salary, benefits, expiryDays = 7 } = req.body;

    const candidate = await Candidate.findOne({
        _id: id,
        organizationId
    }).populate('jobPostingId');

    if (!candidate) {
        return res.status(404).json({
            success: false,
            message: 'Candidate not found'
        });
    }

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + expiryDays);

    candidate.offerDetails = {
        position: position || candidate.jobPostingId?.jobTitle,
        startDate: startDate ? new Date(startDate) : new Date(),
        salary: salary || candidate.jobPostingId?.salaryRange?.max,
        benefits: benefits || [],
        offerLetter: {
            sentDate: new Date(),
            expiryDate: expiryDate,
            status: 'Draft'
        },
        status: 'Draft'
    };

    candidate.status = 'Offer Extended';
    candidate.stage = 'Offer';

    await candidate.save();

    res.json({
        success: true,
        message: 'Offer letter generated successfully',
        data: {
            candidate,
            offerDetails: candidate.offerDetails
        }
    });
});

