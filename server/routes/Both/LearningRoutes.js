import express from 'express';
import {
    getCourses,
    enrollInCourse,
    getEmployeeEnrollments,
    updateEnrollmentProgress,
    startExternalLearning,
    completeExternalLearning,
    updateExternalLearningProgress,
    getEnrollmentCertificate,
    downloadEnrollmentCertificate,
    upsertSkill,
    getEmployeeSkills
} from '../../controllers/learning/learningController.js';
import { isAuthenticatedBoth } from '../../middlewares/isAuthenticatedBoth.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Courses
router.route('/courses')
    .get(isAuthenticatedBoth, readLimiter, getCourses);

router.route('/courses/:courseId/enroll')
    .post(isAuthenticatedBoth, writeLimiter, enrollInCourse);

// Enrollments
router.route('/enrollments')
    .get(isAuthenticatedBoth, readLimiter, getEmployeeEnrollments);

router.route('/enrollments/:id/progress')
    .put(isAuthenticatedBoth, writeLimiter, updateEnrollmentProgress)
    .patch(isAuthenticatedBoth, writeLimiter, updateExternalLearningProgress);

router.route('/enrollments/:id/start')
    .post(isAuthenticatedBoth, writeLimiter, startExternalLearning);

router.route('/enrollments/:id/complete')
    .post(isAuthenticatedBoth, writeLimiter, completeExternalLearning);

router.route('/enrollments/:id/certificate')
    .get(isAuthenticatedBoth, readLimiter, getEnrollmentCertificate);

router.route('/enrollments/:id/certificate/download')
    .get(isAuthenticatedBoth, readLimiter, downloadEnrollmentCertificate);

// Skills
router.route('/skills')
    .get(isAuthenticatedBoth, readLimiter, getEmployeeSkills)
    .post(isAuthenticatedBoth, writeLimiter, upsertSkill);

router.route('/skills/:employeeId')
    .get(isAuthenticatedBoth, readLimiter, getEmployeeSkills);

export default router;

