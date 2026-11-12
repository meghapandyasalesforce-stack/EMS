import { afterEach, describe, expect, it, jest } from '@jest/globals';
import Organization from '../../models/organization.model.js';
import { resolveCareerOrganizationId } from '../../helpers/careerPortalSlug.js';
const query = value => ({ select: () => ({ lean: async () => value }) });
const id = '6a3cbbacc02ff3769ba3e8c6';
afterEach(() => jest.restoreAllMocks());
describe('organization ID career resolution', () => {
    it('resolves an existing active organization by ID', async () => {
        const lookup = jest.spyOn(Organization, 'findOne').mockReturnValue(query({ _id: id }));
        expect(await resolveCareerOrganizationId(id)).toBe(id);
        expect(lookup).toHaveBeenCalledWith({ _id: id, isActive: true, deletedAt: null });
    });
    it.each(['paarsiv', 'megha', 'other-company', '../other', '$ne', '', null])('rejects non-ID URL %s without a slug lookup', async value => {
        const lookup = jest.spyOn(Organization, 'findOne');
        expect(await resolveCareerOrganizationId(value)).toBeNull();
        expect(lookup).not.toHaveBeenCalled();
    });
    it('rejects missing, inactive, or deleted organizations', async () => {
        jest.spyOn(Organization, 'findOne').mockReturnValue(query(null));
        expect(await resolveCareerOrganizationId(id)).toBeNull();
    });
});
