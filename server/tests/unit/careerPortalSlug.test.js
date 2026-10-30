import { afterEach, describe, expect, it, jest } from '@jest/globals';
import Organization from '../../models/organization.model.js';
import { careerSlugFromName, ensureCareerSlug, resolveCareerOrganizationId } from '../../helpers/careerPortalSlug.js';
const query = value => ({ select: () => ({ lean: async () => value }) });
const id = '6aaa62a8fb45a608bc3b3655';
afterEach(() => jest.restoreAllMocks());
describe('stable readable career links', () => {
    it.each([['Paarsiv Technologies', 'paarsiv-technologies'], ['  Acmé & Sons Pvt. Ltd. ', 'acme-sons-pvt-ltd'], ['', 'company'], [id, `company-${id}`]])('normalizes %s', (name, expected) => expect(careerSlugFromName(name)).toBe(expected));
    it('preserves a shared slug after a company rename', async () => {
        jest.spyOn(Organization, 'findById').mockReturnValue(query({ _id: id, name: 'New Name', careerSlug: 'paarsiv' }));
        const update = jest.spyOn(Organization, 'findOneAndUpdate');
        expect(await ensureCareerSlug(id)).toBe('paarsiv');
        expect(update).not.toHaveBeenCalled();
    });
    it('handles duplicate company names without reusing another tenant link', async () => {
        jest.spyOn(Organization, 'findById').mockReturnValue(query({ _id: id, name: 'Paarsiv' }));
        jest.spyOn(Organization.collection, 'createIndex').mockResolvedValue('careerSlug_1');
        jest.spyOn(Organization, 'findOneAndUpdate')
            .mockReturnValueOnce({ select: () => ({ lean: async () => { throw Object.assign(new Error('Duplicate'), { code: 11000 }); } }) })
            .mockReturnValueOnce(query({ careerSlug: 'paarsiv-3b3655' }));
        expect(await ensureCareerSlug(id)).toBe('paarsiv-3b3655');
    });
    it('returns the winner when two requests initialize the same company', async () => {
        jest.spyOn(Organization, 'findById').mockReturnValueOnce(query({ _id: id, name: 'Paarsiv' })).mockReturnValueOnce(query({ _id: id, careerSlug: 'paarsiv' }));
        jest.spyOn(Organization, 'findOneAndUpdate').mockReturnValue(query(null));
        expect(await ensureCareerSlug(id)).toBe('paarsiv');
    });
    it('retains legacy IDs without a company lookup', async () => {
        const lookup = jest.spyOn(Organization, 'findOne');
        expect(await resolveCareerOrganizationId(id)).toBe(id);
        expect(lookup).not.toHaveBeenCalled();
    });
    it('resolves names only against active, non-deleted organizations', async () => {
        const lookup = jest.spyOn(Organization, 'findOne').mockReturnValue(query({ _id: id }));
        expect(await resolveCareerOrganizationId('Paarsiv')).toBe(id);
        expect(lookup).toHaveBeenCalledWith({ careerSlug: 'paarsiv', isActive: true, deletedAt: null });
    });
    it.each(['../other', '$ne', 'a'.repeat(91)])('rejects malformed identifier %s', async value => {
        const lookup = jest.spyOn(Organization, 'findOne');
        expect(await resolveCareerOrganizationId(value)).toBeNull();
        expect(lookup).not.toHaveBeenCalled();
    });
});
