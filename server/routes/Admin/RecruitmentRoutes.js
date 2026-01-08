import express from 'express';
import {
    createJobPosting,
    getJobPostings,
    getJobPostingById,
    updateJobPosting,
    deleteJobPosting,
    getCandidates,
    getCandidateById,
    updateCandidateStatus,
    scheduleInterview,
    getRecruitmentAnalytics,
    calculateCandidateScore,
    getCandidatePipeline,
    getRankedCandidates,
    generateOfferLetter
} from '../../controllers/recruitment/recruitmentController.js';
import isAdminOrHRAuthenticated from '../../middlewares/isAdminOrHRAuthenticated.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Job Postings
router.route('/jobs')
    .post(isAdminOrHRAuthenticated, writeLimiter, createJobPosting)
    .get(isAdminOrHRAuthenticated, readLimiter, getJobPostings);

router.route('/jobs/:id')
    .get(isAdminOrHRAuthenticated, readLimiter, getJobPostingById)
    .put(isAdminOrHRAuthenticated, writeLimiter, updateJobPosting)
    .delete(isAdminOrHRAuthenticated, writeLimiter, deleteJobPosting);

router.route('/jobs/:id/candidates/ranked')
    .get(isAdminOrHRAuthenticated, readLimiter, getRankedCandidates);

// Candidates
router.route('/candidates')
    .get(isAdminOrHRAuthenticated, readLimiter, getCandidates);

router.route('/candidates/:id')
    .get(isAdminOrHRAuthenticated, readLimiter, getCandidateById)
    .put(isAdminOrHRAuthenticated, writeLimiter, updateCandidateStatus);

router.route('/candidates/:id/interview')
    .post(isAdminOrHRAuthenticated, writeLimiter, scheduleInterview);

router.route('/candidates/:id/score')
    .post(isAdminOrHRAuthenticated, writeLimiter, calculateCandidateScore);

router.route('/candidates/:id/generate-offer')
    .post(isAdminOrHRAuthenticated, writeLimiter, generateOfferLetter);

// Pipeline & Analytics
router.route('/pipeline')
    .get(isAdminOrHRAuthenticated, readLimiter, getCandidatePipeline);

router.route('/analytics')
    .get(isAdminOrHRAuthenticated, readLimiter, getRecruitmentAnalytics);

export default router;

