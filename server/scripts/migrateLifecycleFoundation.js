/**
 * Migration: seed LifecycleSettings, OffboardingTemplate, and document catalog for all orgs.
 * Run: node server/scripts/migrateLifecycleFoundation.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organization from '../models/organization.model.js';
import { getOrCreateLifecycleSettings } from '../services/lifecycleConfigService.js';
import { ensureDefaultOnboardingTemplate, ensureDefaultOffboardingTemplate } from '../services/lifecycleTemplateEngine.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/ems';

async function migrate() {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const orgs = await Organization.find({}).select('_id name onboardingSettings').lean();
    console.log(`Migrating ${orgs.length} organizations...`);

    for (const org of orgs) {
        const settings = await getOrCreateLifecycleSettings(org._id);
        if (org.onboardingSettings?.defaultTemplateId && !settings.defaults?.onboardingTemplateId) {
            settings.defaults = settings.defaults || {};
            settings.defaults.onboardingTemplateId = org.onboardingSettings.defaultTemplateId;
            await settings.save();
        }
        await ensureDefaultOnboardingTemplate(org._id);
        await ensureDefaultOffboardingTemplate(org._id);
        console.log(`  ✓ ${org.name || org._id}`);
    }

    console.log('Migration complete.');
    await mongoose.disconnect();
}

migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
