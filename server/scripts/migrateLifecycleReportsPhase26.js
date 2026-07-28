/**
 * Phase 2.6 — seed reporting policy defaults for existing organizations.
 * Run: node server/scripts/migrateLifecycleReportsPhase26.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { LifecycleSettings } from '../models/lifecycle.model.js';
import { LIFECYCLE_REPORT_CATEGORIES } from '../constants/lifecycleReports.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function migrate() {
    if (!MONGO_URI) {
        console.error('MONGO_URI not set');
        process.exit(1);
    }
    await mongoose.connect(MONGO_URI);
    const settings = await LifecycleSettings.find({});
    let updated = 0;
    for (const s of settings) {
        const policy = s.reportingPolicy || {};
        if (!policy.enabledCategories?.length) {
            s.reportingPolicy = {
                enabled: policy.enabled !== false,
                defaultDateRangeDays: policy.defaultDateRangeDays || 90,
                enabledCategories: [...LIFECYCLE_REPORT_CATEGORIES],
                allowScheduledReports: policy.allowScheduledReports !== false,
                allowExport: policy.allowExport !== false,
                retentionDays: policy.retentionDays || 365,
            };
            await s.save();
            updated += 1;
        }
    }
    console.log(`Lifecycle reports Phase 2.6 migration complete. Updated ${updated} org(s).`);
    await mongoose.disconnect();
}

migrate().catch((err) => {
    console.error(err);
    process.exit(1);
});
