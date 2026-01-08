import { Survey, SurveyResponse, Feedback, Recognition } from '../../models/engagement.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../middlewares/asyncHandler.js';

/**
 * Create survey
 */
export const createSurvey = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const createdBy = req.user?._id || req.employee?._id;

    const survey = new Survey({
        ...req.body,
        organizationId,
        createdBy
    });

    await survey.save();

    res.status(201).json({
        success: true,
        message: 'Survey created successfully',
        data: survey
    });
});

/**
 * Get surveys
 */
export const getSurveys = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { status, type, page = 1, limit = 20 } = req.query;

    const query = addOrganizationFilter(req, {});

    if (status) query.status = status;
    if (type) query.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const surveys = await Survey.find(query)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Survey.countDocuments(query);

    res.json({
        success: true,
        data: surveys,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

/**
 * Submit survey response
 */
export const submitSurveyResponse = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { surveyId } = req.params;
    const employeeId = req.employee?._id;

    const survey = await Survey.findOne({
        _id: surveyId,
        organizationId
    });

    if (!survey) {
        return res.status(404).json({
            success: false,
            message: 'Survey not found'
        });
    }

    if (survey.status !== 'Active') {
        return res.status(400).json({
            success: false,
            message: 'Survey is not active'
        });
    }

    // Check if already responded
    const existingResponse = await SurveyResponse.findOne({
        organizationId,
        surveyId,
        employeeId
    });

    if (existingResponse && !survey.anonymous) {
        return res.status(400).json({
            success: false,
            message: 'Already responded to this survey'
        });
    }

    const response = new SurveyResponse({
        organizationId,
        surveyId,
        employeeId: survey.anonymous ? null : employeeId,
        responses: req.body.responses,
        isAnonymous: survey.anonymous,
        timeSpent: req.body.timeSpent
    });

    await response.save();

    // Update survey response count
    survey.responseCount += 1;
    await survey.save();

    res.status(201).json({
        success: true,
        message: 'Survey response submitted successfully',
        data: response
    });
});

/**
 * Create feedback
 */
export const createFeedback = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employeeId = req.employee?._id || req.user?._id;

    const feedback = new Feedback({
        ...req.body,
        organizationId,
        employeeId
    });

    await feedback.save();

    res.status(201).json({
        success: true,
        message: 'Feedback submitted successfully',
        data: feedback
    });
});

/**
 * Get feedbacks
 */
export const getFeedbacks = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { employeeId, status, type, page = 1, limit = 20 } = req.query;

    const query = addOrganizationFilter(req, {});

    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;
    if (type) query.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const feedbacks = await Feedback.find(query)
        .populate('employeeId', 'name email')
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Feedback.countDocuments(query);

    res.json({
        success: true,
        data: feedbacks,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

/**
 * Create recognition
 */
export const createRecognition = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const givenBy = req.user?._id || req.employee?._id;

    const recognition = new Recognition({
        ...req.body,
        organizationId,
        givenBy
    });

    await recognition.save();

    res.status(201).json({
        success: true,
        message: 'Recognition created successfully',
        data: recognition
    });
});

/**
 * Get recognitions
 */
export const getRecognitions = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { recipientId, status, page = 1, limit = 20 } = req.query;

    const query = addOrganizationFilter(req, { status: 'Approved', isPublic: true });

    if (recipientId) query.recipientId = recipientId;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const recognitions = await Recognition.find(query)
        .populate('recipientId', 'name email')
        .populate('givenBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Recognition.countDocuments(query);

    res.json({
        success: true,
        data: recognitions,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

/**
 * Get engagement analytics including eNPS
 */
export const getEngagementAnalytics = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
        dateFilter.submittedAt = {};
        if (startDate) dateFilter.submittedAt.$gte = new Date(startDate);
        if (endDate) dateFilter.submittedAt.$lte = new Date(endDate);
    }

    const [totalSurveys, activeSurveys, totalResponses, surveysByType,
           avgResponseRate, feedbackStats, recognitionStats, eNPS] = await Promise.all([
        Survey.countDocuments({ organizationId }),
        Survey.countDocuments({ organizationId, status: 'Active' }),
        SurveyResponse.countDocuments({ organizationId, ...dateFilter }),
        Survey.aggregate([
            { $match: { organizationId } },
            { $group: { _id: '$type', count: { $sum: 1 } } }
        ]),
        Survey.aggregate([
            { $match: { organizationId } },
            {
                $project: {
                    responseRate: {
                        $cond: [
                            { $gt: ['$totalInvites', 0] },
                            { $multiply: [{ $divide: ['$responseCount', '$totalInvites'] }, 100] },
                            0
                        ]
                    }
                }
            },
            { $group: { _id: null, avgRate: { $avg: '$responseRate' } } }
        ]),
        Feedback.aggregate([
            { $match: { organizationId, ...dateFilter } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    avgPriority: { $avg: { $switch: { branches: [
                        { case: { $eq: ['$priority', 'Low'] }, then: 1 },
                        { case: { $eq: ['$priority', 'Medium'] }, then: 2 },
                        { case: { $eq: ['$priority', 'High'] }, then: 3 },
                        { case: { $eq: ['$priority', 'Urgent'] }, then: 4 }
                    ], default: 0 } } }
                }
            }
        ]),
        Recognition.aggregate([
            { $match: { organizationId, status: 'Approved', ...dateFilter } },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    totalPoints: { $sum: '$points' }
                }
            }
        ]),
        // Calculate eNPS from survey responses (simplified - needs NPS question)
        SurveyResponse.aggregate([
            { $match: { organizationId, ...dateFilter } },
            { $unwind: '$responses' },
            {
                $match: {
                    'responses.questionText': { $regex: /recommend|nps|net promoter/i }
                }
            },
            {
                $group: {
                    _id: null,
                    promoters: { $sum: { $cond: [{ $gte: ['$responses.answer', 9] }, 1, 0] } },
                    passives: { $sum: { $cond: [{ $and: [{ $gte: ['$responses.answer', 7] }, { $lt: ['$responses.answer', 9] }] }, 1, 0] } },
                    detractors: { $sum: { $cond: [{ $lt: ['$responses.answer', 7] }, 1, 0] } },
                    total: { $sum: 1 }
                }
            }
        ])
    ]);

    // Calculate eNPS
    let eNPSValue = 0;
    if (eNPS[0] && eNPS[0].total > 0) {
        const { promoters, detractors, total } = eNPS[0];
        const promoterPercent = (promoters / total) * 100;
        const detractorPercent = (detractors / total) * 100;
        eNPSValue = (promoterPercent - detractorPercent).toFixed(2);
    }

    res.json({
        success: true,
        data: {
            surveys: {
                total: totalSurveys,
                active: activeSurveys,
                totalResponses
            },
            surveysByType,
            avgResponseRate: avgResponseRate[0]?.avgRate || 0,
            feedback: feedbackStats,
            recognition: recognitionStats,
            eNPS: parseFloat(eNPSValue)
        }
    });
});

/**
 * Create pulse survey (quick, frequent survey)
 */
export const createPulseSurvey = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const createdBy = req.user?._id || req.employee?._id;

    // Pulse surveys are typically shorter and more frequent
    const pulseSurvey = new Survey({
        ...req.body,
        organizationId,
        createdBy,
        type: 'Pulse',
        // Pulse surveys typically have fewer questions (3-5)
        questions: req.body.questions || []
    });

    await pulseSurvey.save();

    res.status(201).json({
        success: true,
        message: 'Pulse survey created successfully',
        data: pulseSurvey
    });
});

/**
 * Get 360-degree feedback (needs separate model or enhancement)
 * For now, this is a placeholder that can be enhanced
 */
export const get360Feedback = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { employeeId } = req.params;

    // This would require a separate 360Feedback model
    // For now, return feedback from multiple sources
    const feedbacks = await Feedback.find({
        organizationId,
        employeeId,
        type: { $in: ['Suggestion', 'Appreciation'] }
    })
        .populate('employeeId', 'name email')
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 });

    res.json({
        success: true,
        message: '360 feedback retrieved (simplified - needs dedicated model)',
        data: feedbacks
    });
});

