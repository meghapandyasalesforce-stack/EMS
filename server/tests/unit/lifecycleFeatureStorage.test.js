import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    encodeFeatureStorageKey,
    decodeFeatureStorageKey,
    featuresFromStorage,
} from '../../services/lifecycleConfigService.js';

describe('lifecycle feature storage encoding', () => {
    it('encodes and decodes dotted feature keys', () => {
        const key = 'compliance.india.aadhaar';
        const encoded = encodeFeatureStorageKey(key);
        assert.equal(encoded, 'compliance::india::aadhaar');
        assert.equal(decodeFeatureStorageKey(encoded), key);
    });

    it('reads encoded storage keys', () => {
        const flat = featuresFromStorage({
            buddyProgram: true,
            'compliance::india::aadhaar': false,
            'compliance::india::pan': true,
        });
        assert.equal(flat.buddyProgram, true);
        assert.equal(flat['compliance.india.aadhaar'], false);
        assert.equal(flat['compliance.india.pan'], true);
    });

    it('flattens legacy nested mongoose paths', () => {
        const flat = featuresFromStorage({
            buddyProgram: true,
            compliance: {
                india: {
                    aadhaar: true,
                    pan: false,
                },
            },
        });
        assert.equal(flat.buddyProgram, true);
        assert.equal(flat['compliance.india.aadhaar'], true);
        assert.equal(flat['compliance.india.pan'], false);
    });

    it('reads literal dotted keys when present', () => {
        const flat = featuresFromStorage({
            'compliance.india.epf': true,
        });
        assert.equal(flat['compliance.india.epf'], true);
    });
});
