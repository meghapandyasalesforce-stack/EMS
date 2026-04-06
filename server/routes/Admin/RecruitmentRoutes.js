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
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Job Postings
router.route('/jobs')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createJobPosting)
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getJobPostings);

router.route('/jobs/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getJobPostingById)
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateJobPosting)
    .delete(isAdminOrHROrExecutiveAuthenticated, writeLimiter, deleteJobPosting);

router.route('/jobs/:id/candidates/ranked')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getRankedCandidates);

// Candidates
router.route('/candidates')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getCandidates);

router.route('/candidates/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getCandidateById)
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateCandidateStatus);

router.route('/candidates/:id/interview')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, scheduleInterview);

router.route('/candidates/:id/score')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, calculateCandidateScore);

router.route('/candidates/:id/generate-offer')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, generateOfferLetter);

// Pipeline & Analytics
router.route('/pipeline')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getCandidatePipeline);

router.route('/analytics')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getRecruitmentAnalytics);

export default router;

