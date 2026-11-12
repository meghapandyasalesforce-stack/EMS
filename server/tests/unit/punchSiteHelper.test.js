import { describe, it, expect } from '@jest/globals';
import { selectPunchSite, hasValidPunchCoordinates } from '../../helpers/punchSiteHelper.js';

const rule = {
    location: 'Head Office',
    address: 'Mumbai HQ',
    coordinates: { latitude: 19.076, longitude: 72.8777 },
    maximumRadius: 300,
};

const delhi = {
    _id: 'branch-delhi',
    name: 'Delhi Office',
    address: { city: 'Delhi' },
    coordinates: { latitude: 28.6139, longitude: 77.209 },
    maximumRadius: 200,
};

describe('selectPunchSite', () => {
    it('uses the assigned branch pin instead of the organization pin', () => {
        const site = selectPunchSite(delhi, rule);
        expect(site.source).toBe('branch');
        expect(site.locationName).toBe('Delhi Office');
        expect(site.address).toBe('Delhi');
        expect(site.coordinates).toEqual({ latitude: 28.6139, longitude: 77.209 });
        expect(site.maximumRadius).toBe(200);
    });

    it('falls back to the attendance rule when the branch has no pin', () => {
        const site = selectPunchSite({ name: 'Pune', coordinates: {} }, rule);
        expect(site.source).toBe('rule');
        expect(site.locationName).toBe('Head Office');
        expect(site.maximumRadius).toBe(300);
    });

    it('ignores a 0,0 branch pin and uses the organization pin', () => {
        const site = selectPunchSite(
            { name: 'Blank', coordinates: { latitude: 0, longitude: 0 } },
            rule
        );
        expect(site.source).toBe('rule');
    });

    it('returns null when neither the branch nor the rule has a pin', () => {
        expect(selectPunchSite(null, { coordinates: { latitude: 0, longitude: 0 } })).toBeNull();
        expect(hasValidPunchCoordinates(null)).toBe(false);
    });
});
