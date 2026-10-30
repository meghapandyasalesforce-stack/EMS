import { describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { getCareerPortalLink } from '../../controllers/recruitment/recruitmentController.js';
const currentId = '6aaa62a8fb45a608bc3b3655';
const otherId = '6a3cbbacc02ff3769ba3e8c6';
function appFor(identity) {
    const app = express();
    app.use(express.json());
    app.get('/career-link', (req, res, next) => { Object.assign(req, identity); next(); }, getCareerPortalLink);
    return app;
}
describe('trusted organization career ID', () => {
    it.each([{ user: { organizationId: currentId } }, { employee: { organizationId: currentId } }, { organizationId: currentId }])('uses the authenticated tenant and ignores a caller-selected company', async identity => {
        const response = await request(appFor(identity)).get(`/career-link?organizationId=${otherId}&slug=megha`).expect(200);
        expect(response.body.data).toEqual({ organizationId: currentId });
    });
    it('does not fall back to client data when session context is missing', async () => {
        await request(appFor({})).get(`/career-link?organizationId=${otherId}`).expect(403);
    });
});
