import asyncHandler from './asyncHandler.js';
import { Candidate } from '../models/recruitment.model.js';
import { isRecruitmentActionBlocked } from '../services/resumeScreeningService.js';

/**
 * Blocks recruitment workflow mutations for candidates who failed automatic resume screening.
 * Safe to mount on candidate write routes; GET routes should not use this.
 */
export const blockFailedScreeningActions = asyncHandler(async (req, res, next) => {
    const id = req.params.id;
    if (!id || id === 'bulk') return next();

    const candidate = await Candidate.findById(id)
        .select('resumeScreening status organizationId')
        .lean();

    if (!candidate) return next();

    if (isRecruitmentActionBlocked(candidate)) {
        return res.status(403).json({
            success: false,
            code: 'SCREENING_FAILED_READONLY',
            message: 'This candidate failed resume screening and is read-only for recruitment actions. You may view the match report or delete the candidate.',
        });
    }
    return next();
});

export default blockFailedScreeningActions;
