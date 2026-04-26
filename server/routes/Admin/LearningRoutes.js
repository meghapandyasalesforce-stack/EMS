import express from 'express';
import {
    createCourse,
    getAdminCourses,
    getAdminCourseById,
    updateCourse,
    createLearningPath,
    getLearningPaths,
    generateCertificate,
    getLearningAnalytics,
    calculateTrainingROI,
    getRecommendedLearningPaths
} from '../../controllers/learning/learningController.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Courses
router.route('/courses')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createCourse)
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getAdminCourses);

router.route('/courses/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getAdminCourseById)
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateCourse);

// Learning Paths
router.route('/learning-paths')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createLearningPath)
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getLearningPaths);

// Certificates
router.route('/enrollments/:enrollmentId/certificate')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, generateCertificate);

// Analytics
router.route('/analytics')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getLearningAnalytics);

router.route('/roi')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, calculateTrainingROI);

// Recommendations
router.route('/recommendations/:employeeId')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getRecommendedLearningPaths);

export default router;

