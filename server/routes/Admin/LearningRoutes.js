import express from 'express';
import {
    createCourse,
    createLearningPath,
    getLearningPaths,
    generateCertificate,
    getLearningAnalytics,
    calculateTrainingROI,
    getRecommendedLearningPaths
} from '../../controllers/learning/learningController.js';
import isAdminOrHRAuthenticated from '../../middlewares/isAdminOrHRAuthenticated.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Courses
router.route('/courses')
    .post(isAdminOrHRAuthenticated, writeLimiter, createCourse);

// Learning Paths
router.route('/learning-paths')
    .post(isAdminOrHRAuthenticated, writeLimiter, createLearningPath)
    .get(isAdminOrHRAuthenticated, readLimiter, getLearningPaths);

// Certificates
router.route('/enrollments/:enrollmentId/certificate')
    .post(isAdminOrHRAuthenticated, writeLimiter, generateCertificate);

// Analytics
router.route('/analytics')
    .get(isAdminOrHRAuthenticated, readLimiter, getLearningAnalytics);

router.route('/roi')
    .get(isAdminOrHRAuthenticated, readLimiter, calculateTrainingROI);

// Recommendations
router.route('/recommendations/:employeeId')
    .get(isAdminOrHRAuthenticated, readLimiter, getRecommendedLearningPaths);

export default router;

