/**
 * Phase 1 lifecycle gap migration — backfill notice period on active offboarding workflows.
 * Run: node server/scripts/migrateLifecyclePhase1.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { OffboardingWorkflow } from '../models/onboarding.model.js';
import { applyNoticePeriodToWorkflow } from '../services/noticePeriodService.js';
import { getOrCreateLifecycleSettings } from '../services/lifecycleConfigService.js';

dotenv.config();

async function migrate() {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
        console.error('MONGODB_URI not set');
        process.exit(1);
    }
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const workflows = await OffboardingWorkflow.find({ status: { $nin: ['Draft', 'Cancelled'] } });
    let updated = 0;

    for (const workflow of workflows) {
        await getOrCreateLifecycleSettings(workflow.organizationId);
        await applyNoticePeriodToWorkflow(workflow, workflow.organizationId);
        if (workflow.isModified()) {
            await workflow.save();
            updated += 1;
        }
    }

    console.log(`Phase 1 migration complete: ${updated}/${workflows.length} offboarding workflows updated`);
    await mongoose.disconnect();
}

migrate().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
});
