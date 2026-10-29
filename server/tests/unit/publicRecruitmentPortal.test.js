import { afterEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import sift from 'sift';
import router from '../../routes/Public/RecruitmentPortalRoutes.js';
import { Recruitment } from '../../models/recruitment.model.js';

const organizationId = new mongoose.Types.ObjectId();
const jobId = new mongoose.Types.ObjectId();
const baseJob = {
    _id: jobId, organizationId, jobTitle: 'External engineer',
    department: 'Engineering', status: 'Open', externalVisible: true,
};
const app = express();
app.use(express.json());
app.use('/api/v1/public/recruitment', router);
app.use((error, req, res, next) => res.status(500).json({ message: error.message }));
const url = `/api/v1/public/recruitment/${organizationId}/jobs`;

afterEach(() => jest.restoreAllMocks());

describe('anonymous public recruitment visibility', () => {
    it('lists legacy active jobs as well as explicitly active jobs without exposing private fields', async () => {
        const jobs = [baseJob, { ...baseJob, _id: new mongoose.Types.ObjectId(), isActive: true }];
        const find = jest.spyOn(Recruitment.collection, 'find').mockImplementation((filter, options) => ({
            toArray: async () => jobs.filter(sift(filter)).map(job => Object.fromEntries(
                Object.entries(job).filter(([key]) => key === '_id' || options.projection[key] === 1)
            )),
        }));
        const response = await request(app).get(url).expect(200);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.data[0].jobTitle).toBe('External engineer');
        expect(find.mock.calls[0][1].projection.createdBy).toBeUndefined();
        expect(find.mock.calls[0][1].projection.recruiter).toBeUndefined();
    });

    it.each([
        ['internal-only', { externalVisible: false }],
        ['draft', { status: 'Draft' }],
        ['closed', { status: 'Closed' }],
        ['on hold', { status: 'On Hold' }],
        ['cancelled', { status: 'Cancelled' }],
        ['inactive', { isActive: false }],
        ['archived', { archivedAt: new Date() }],
        ['another organization', { organizationId: new mongoose.Types.ObjectId() }],
    ])('excludes %s jobs from anonymous listings and details', async (label, overrides) => {
        const job = { ...baseJob, isActive: true, ...overrides };
        jest.spyOn(Recruitment.collection, 'find').mockImplementation(filter => ({
            toArray: async () => [job].filter(sift(filter)),
        }));
        jest.spyOn(Recruitment.collection, 'findOne').mockImplementation(async filter =>
            sift(filter)(job) ? job : null
        );
        const response = await request(app).get(url).expect(200);
        expect(response.body.data).toEqual([]);
        await request(app).get(`${url}/${jobId}`).expect(404);
    });

    it('opens a legacy public job detail without login', async () => {
        jest.spyOn(Recruitment.collection, 'findOne').mockImplementation(async filter =>
            sift(filter)(baseJob) ? baseJob : null
        );
        const response = await request(app).get(`${url}/${jobId}`).expect(200);
        expect(response.body.data.jobTitle).toBe(baseJob.jobTitle);
    });

    it('uses the same legacy-active eligibility when accepting public applications', async () => {
        const findOne = jest.spyOn(Recruitment.collection, 'findOne').mockResolvedValue(null);
        // Stop at job lookup: existing candidate creation and application validation stay untouched.
        await request(app).post(`${url}/${jobId}/apply`).send({
            firstName: 'Candidate', email: 'candidate@example.com', consentAccepted: true,
        }).expect(404);
        expect(sift(findOne.mock.calls[0][0])(baseJob)).toBe(true);
        expect(sift(findOne.mock.calls[0][0])({ ...baseJob, isActive: false })).toBe(false);
        expect(sift(findOne.mock.calls[0][0])({ ...baseJob, archivedAt: new Date() })).toBe(false);
    });
});
