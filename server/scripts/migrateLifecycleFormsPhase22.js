/**
 * Backfill lifecycle form definitions for Phase 2.2 versioning fields.
 * Run: node server/scripts/migrateLifecycleFormsPhase22.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { LifecycleFormDefinition } from '../models/lifecycle.model.js';

dotenv.config();

async function migrate() {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
        console.error('MONGODB_URI not set');
        process.exit(1);
    }
    await mongoose.connect(uri);
    const forms = await LifecycleFormDefinition.find({});
    let updated = 0;
    for (const form of forms) {
        let changed = false;
        if (!form.status) {
            form.status = form.isActive === false ? 'Archived' : 'Published';
            changed = true;
        }
        if (!form.category) {
            form.category = form.module || 'custom';
            changed = true;
        }
        if (!form.version) {
            form.version = 1;
            changed = true;
        }
        if (!form.versionHistory) {
            form.versionHistory = [];
            changed = true;
        }
        if (changed) {
            await form.save();
            updated += 1;
        }
    }
    console.log(`Migrated ${updated} of ${forms.length} form definitions`);
    await mongoose.disconnect();
}

migrate().catch((err) => {
    console.error(err);
    process.exit(1);
});
