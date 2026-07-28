/**
 * Migrate legacy LifecycleLetterTemplate records to extended schema.
 * Run: node server/scripts/migrateLifecycleLettersPhase25.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { LifecycleLetterTemplate } from '../models/lifecycleGap.model.js';
import { categoryForLetterType } from '../services/lifecycleLetterService.js';

dotenv.config();

async function migrate() {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
        console.error('MONGODB_URI not set');
        process.exit(1);
    }
    await mongoose.connect(uri);
    const templates = await LifecycleLetterTemplate.find({});
    let updated = 0;
    for (const tpl of templates) {
        let changed = false;
        if (!tpl.category) {
            tpl.category = categoryForLetterType(tpl.letterType);
            changed = true;
        }
        if (!tpl.status) {
            tpl.status = tpl.isActive === false ? 'Archived' : 'Published';
            changed = true;
        }
        if (!tpl.version) {
            tpl.version = 1;
            changed = true;
        }
        if (changed) {
            await tpl.save();
            updated += 1;
        }
    }
    console.log(`Migrated ${updated} of ${templates.length} letter templates`);
    await mongoose.disconnect();
}

migrate().catch((err) => {
    console.error(err);
    process.exit(1);
});
