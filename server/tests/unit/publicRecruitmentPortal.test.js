import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import sift from 'sift';
import router from '../../routes/Public/RecruitmentPortalRoutes.js';
import { Recruitment } from '../../models/recruitment.model.js';
import Organization from '../../models/organization.model.js';

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

beforeEach(() => jest.spyOn(Organization.collection, 'findOne').mockResolvedValue({ _id: organizationId }));
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

describe('readable public career links', () => {
    it('lists the same tenant jobs through a company slug', async () => {
        jest.spyOn(Organization.collection, 'findOne').mockResolvedValue({ _id: organizationId });
        const find = jest.spyOn(Recruitment.collection, 'find').mockImplementation(filter => ({
            toArray: async () => [baseJob, { ...baseJob, organizationId: new mongoose.Types.ObjectId() }].filter(sift(filter)),
        }));
        const response = await request(app).get('/api/v1/public/recruitment/paarsiv/jobs').expect(200);
        expect(response.body.data).toHaveLength(1);
        expect(String(find.mock.calls[0][0].organizationId)).toBe(String(organizationId));
    });
    it('opens public job detail through the same slug', async () => {
        jest.spyOn(Organization.collection, 'findOne').mockResolvedValue({ _id: organizationId });
        jest.spyOn(Recruitment.collection, 'findOne').mockImplementation(async filter => sift(filter)(baseJob) ? baseJob : null);
        const response = await request(app).get(`/api/v1/public/recruitment/paarsiv/jobs/${jobId}`).expect(200);
        expect(response.body.data.jobTitle).toBe(baseJob.jobTitle);
    });
    it('scopes application lookup to the resolved tenant', async () => {
        jest.spyOn(Organization.collection, 'findOne').mockResolvedValue({ _id: organizationId });
        const lookup = jest.spyOn(Recruitment.collection, 'findOne').mockResolvedValue(null);
        await request(app).post(`/api/v1/public/recruitment/paarsiv/jobs/${jobId}/apply`)
            .send({ firstName: 'Candidate', email: 'candidate@example.com', consentAccepted: true }).expect(404);
        expect(String(lookup.mock.calls[0][0].organizationId)).toBe(String(organizationId));
    });
    it('returns 404 for unknown slugs without querying jobs', async () => {
        jest.spyOn(Organization.collection, 'findOne').mockResolvedValue(null);
        const find = jest.spyOn(Recruitment.collection, 'find');
        await request(app).get('/api/v1/public/recruitment/missing-company/jobs').expect(404);
        expect(find).not.toHaveBeenCalled();
    });
});

describe('public canonical career address', () => {
    it('returns the saved company slug for anonymous bookmarks and ignores caller-supplied names', async () => {
        jest.spyOn(Organization, 'findOne').mockReturnValue({ select: () => ({ lean: async () => ({ _id: organizationId }) }) });
        jest.spyOn(Organization, 'findById').mockReturnValue({ select: () => ({ lean: async () => ({ _id: organizationId, careerSlug: 'paarsiv' }) }) });
        const response = await request(app).post(`/api/v1/public/recruitment/${organizationId}/portal-link`)
            .send({ slug: 'another-company', organizationId: new mongoose.Types.ObjectId() }).expect(200);
        expect(response.body.data.slug).toBe('paarsiv');
        expect(Organization.findOne).toHaveBeenCalledWith({ _id: String(organizationId), isActive: true, deletedAt: null });
    });
    it('does not initialize public links for missing or inactive organizations', async () => {
        jest.spyOn(Organization, 'findOne').mockReturnValue({ select: () => ({ lean: async () => null }) });
        const allocation = jest.spyOn(Organization, 'findById');
        await request(app).post(`/api/v1/public/recruitment/${organizationId}/portal-link`).send({}).expect(404);
        expect(allocation).not.toHaveBeenCalled();
    });
});

describe('canonical tenant ownership', () => {
    it('keeps six Paarsiv jobs separate from two jobs owned by another saved portal', async () => {
        const otherId = new mongoose.Types.ObjectId();
        jest.spyOn(Organization.collection, 'findOne').mockImplementation(async filter => {
            if (filter.careerSlug === 'paarsiv') return { _id: organizationId };
            if (filter.careerSlug === 'other-company') return { _id: otherId };
            return null;
        });
        const jobs = [
            ...Array.from({ length: 6 }, () => ({ ...baseJob, _id: new mongoose.Types.ObjectId() })),
            ...Array.from({ length: 2 }, () => ({ ...baseJob, _id: new mongoose.Types.ObjectId(), organizationId: otherId })),
        ];
        jest.spyOn(Recruitment.collection, 'find').mockImplementation(filter => ({ toArray: async () => jobs.filter(sift(filter)) }));
        const paarsiv = await request(app).get('/api/v1/public/recruitment/paarsiv/jobs').expect(200);
        const other = await request(app).get('/api/v1/public/recruitment/other-company/jobs').expect(200);
        expect(paarsiv.body.data).toHaveLength(6);
        expect(other.body.data).toHaveLength(2);
        expect(paarsiv.body.data.every(j => j.organizationId === String(organizationId))).toBe(true);
        expect(other.body.data.every(j => j.organizationId === String(otherId))).toBe(true);
        await request(app).get('/api/v1/public/recruitment/megha/jobs').expect(404);
    });
    it('preserves a separate organization whose actual saved slug is megha', async () => {
        const otherId = new mongoose.Types.ObjectId();
        const lookup = jest.spyOn(Organization.collection, 'findOne').mockResolvedValue({ _id: otherId });
        const jobs = [baseJob, { ...baseJob, organizationId: otherId }, { ...baseJob, organizationId: otherId }];
        jest.spyOn(Recruitment.collection, 'find').mockImplementation(filter => ({ toArray: async () => jobs.filter(sift(filter)) }));
        const response = await request(app).get('/api/v1/public/recruitment/megha/jobs').expect(200);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.data.every(j => j.organizationId === String(otherId))).toBe(true);
        expect(lookup.mock.calls[0][0]).toMatchObject({ careerSlug: 'megha' });
    });
    it.each(['jobs', `jobs/${jobId}`, 'portal-link', `jobs/${jobId}/apply`])('rejects an obsolete slug on %s without falling back to any tenant', async suffix => {
        jest.spyOn(Organization.collection, 'findOne').mockResolvedValue(null);
        const find = jest.spyOn(Recruitment.collection, 'find');
        const findOne = jest.spyOn(Recruitment.collection, 'findOne');
        const path = `/api/v1/public/recruitment/megha/${suffix}`;
        const req = suffix === 'portal-link' || suffix.endsWith('/apply') ? request(app).post(path).send({}) : request(app).get(path);
        await req.expect(404);
        expect(find).not.toHaveBeenCalled();
        expect(findOne).not.toHaveBeenCalled();
    });
    it('rejects missing or inactive organizations through legacy IDs too', async () => {
        jest.spyOn(Organization.collection, 'findOne').mockResolvedValue(null);
        const find = jest.spyOn(Recruitment.collection, 'find');
        await request(app).get(url).expect(404);
        expect(find).not.toHaveBeenCalled();
    });
});
