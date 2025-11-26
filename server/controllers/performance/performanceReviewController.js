import PerformanceReview from '../../models/performanceReview.model.js';
import Employee from '../../models/employee.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import logger from '../../helpers/logger.js';

/**
 * Create a new performance review
 */
export const createPerformanceReview = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);
        const { employeeId, reviewPeriod, reviewType } = req.body;

        const review = new PerformanceReview({
            organizationId,
            employeeId,
            reviewPeriod,
            reviewType: reviewType || 'Manager Review',
            status: 'Draft'
        });

        await review.save();

        res.status(201).json({
            success: true,
            message: 'Performance review created successfully',
            data: review
        });
    } catch (error) {
        logger.error('Error creating performance review', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get all performance reviews
 */
export const getPerformanceReviews = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);
        const { employeeId, status, reviewType, page = 1, limit = 20 } = req.query;

        const query = addOrganizationFilter(req, {});

        if (employeeId) {
            query.employeeId = employeeId;
        } else if (req.employee?._id) {
            // Employee can only see their own reviews
            query.employeeId = req.employee._id;
        }

        if (status) {
            query.status = status;
        }

        if (reviewType) {
            query.reviewType = reviewType;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const reviews = await PerformanceReview.find(query)
            .populate('employeeId', 'name lastName email employeeId department')
            .populate('managerEvaluation.managerId', 'name email')
            .populate('peerReviews.reviewerId', 'name email')
            .sort({ 'reviewPeriod.endDate': -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await PerformanceReview.countDocuments(query);

        res.json({
            success: true,
            data: reviews,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        logger.error('Error fetching performance reviews', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get performance review by ID
 */
export const getPerformanceReviewById = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = getOrganizationId(req);

        const review = await PerformanceReview.findOne({
            _id: id,
            organizationId
        })
            .populate('employeeId', 'name lastName email employeeId department position')
            .populate('managerEvaluation.managerId', 'name email')
            .populate('peerReviews.reviewerId', 'name email')
            .populate('finalReview.reviewedBy', 'name email');

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Performance review not found'
            });
        }

        // Check access
        if (req.employee?._id && review.employeeId._id.toString() !== req.employee._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        res.json({
            success: true,
            data: review
        });
    } catch (error) {
        logger.error('Error fetching performance review', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Submit self-assessment
 */
export const submitSelfAssessment = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = getOrganizationId(req);
        const employeeId = req.employee?._id;

        if (!employeeId) {
            return res.status(401).json({
                success: false,
                message: 'Employee authentication required'
            });
        }

        const review = await PerformanceReview.findOne({
            _id: id,
            organizationId,
            employeeId
        });

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Performance review not found'
            });
        }

        const { strengths, areasForImprovement, achievements, goals } = req.body;

        review.selfAssessment = {
            strengths: strengths || [],
            areasForImprovement: areasForImprovement || [],
            achievements: achievements || [],
            goals: goals || [],
            submittedAt: new Date()
        };

        if (review.status === 'Draft') {
            review.status = 'In Progress';
        }

        await review.save();

        res.json({
            success: true,
            message: 'Self-assessment submitted successfully',
            data: review
        });
    } catch (error) {
        logger.error('Error submitting self-assessment', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Submit manager evaluation
 */
export const submitManagerEvaluation = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = getOrganizationId(req);
        const managerId = req.user?._id || req.employee?._id;

        if (!managerId) {
            return res.status(401).json({
                success: false,
                message: 'Manager authentication required'
            });
        }

        const review = await PerformanceReview.findOne({
            _id: id,
            organizationId
        });

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Performance review not found'
            });
        }

        const {
            overallRating,
            ratings,
            strengths,
            areasForImprovement,
            goals,
            comments
        } = req.body;

        review.managerEvaluation = {
            managerId,
            overallRating,
            ratings: ratings || [],
            strengths: strengths || [],
            areasForImprovement: areasForImprovement || [],
            goals: goals || [],
            comments: comments || '',
            submittedAt: new Date()
        };

        review.status = 'Completed';
        await review.save();

        res.json({
            success: true,
            message: 'Manager evaluation submitted successfully',
            data: review
        });
    } catch (error) {
        logger.error('Error submitting manager evaluation', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Add peer review
 */
export const addPeerReview = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = getOrganizationId(req);
        const reviewerId = req.employee?._id || req.user?._id;

        if (!reviewerId) {
            return res.status(401).json({
                success: false,
                message: 'Reviewer authentication required'
            });
        }

        const review = await PerformanceReview.findOne({
            _id: id,
            organizationId
        });

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Performance review not found'
            });
        }

        // Get reviewer info
        const reviewer = await Employee.findById(reviewerId);
        if (!reviewer) {
            return res.status(404).json({
                success: false,
                message: 'Reviewer not found'
            });
        }

        const { ratings, overallComments, relationship } = req.body;

        const peerReview = {
            reviewerId,
            reviewerName: `${reviewer.name} ${reviewer.lastName}`,
            relationship: relationship || 'Peer',
            ratings: ratings || [],
            overallComments: overallComments || '',
            submittedAt: new Date()
        };

        review.peerReviews.push(peerReview);
        await review.save();

        res.json({
            success: true,
            message: 'Peer review added successfully',
            data: review
        });
    } catch (error) {
        logger.error('Error adding peer review', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Update performance review
 */
export const updatePerformanceReview = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = getOrganizationId(req);

        const review = await PerformanceReview.findOne({
            _id: id,
            organizationId
        });

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Performance review not found'
            });
        }

        const allowedFields = ['reviewPeriod', 'reviewType', 'status', 'finalReview', 'improvementPlan'];
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                review[field] = req.body[field];
            }
        });

        await review.save();

        res.json({
            success: true,
            message: 'Performance review updated successfully',
            data: review
        });
    } catch (error) {
        logger.error('Error updating performance review', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Delete performance review
 */
export const deletePerformanceReview = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = getOrganizationId(req);

        const review = await PerformanceReview.findOne({
            _id: id,
            organizationId
        });

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Performance review not found'
            });
        }

        await PerformanceReview.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'Performance review deleted successfully'
        });
    } catch (error) {
        logger.error('Error deleting performance review', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

