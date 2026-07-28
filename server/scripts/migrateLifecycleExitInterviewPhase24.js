/**
 * Phase 2.4 — enable exit interview policy defaults for existing orgs.
 * Run: node server/scripts/migrateLifecycleExitInterviewPhase24.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { LifecycleSettings } from '../models/lifecycle.model.js';

dotenv.config();

async function migrate() {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
        console.error('MONGODB_URI not set');
        process.exit(1);
    }
    await mongoose.connect(uri);
    const settings = await LifecycleSettings.find({});
    let updated = 0;
    for (const doc of settings) {
        if (!doc.exitInterviewPolicy) {
            doc.exitInterviewPolicy = {
                enabled: false,
                mandatory: false,
                anonymousAllowed: true,
                autoSchedule: true,
                autoScheduleDaysBeforeLwd: 7,
                approvalRequired: false,
                reminderDaysBefore: [7, 3, 1],
                feedbackAreas: [
                    'Manager', 'Team', 'Work Culture', 'Salary', 'Benefits', 'Career Growth',
                    'Workload', 'Leadership', 'Company Policies', 'Office Environment',
                    'Technology', 'HR Experience', 'Training', 'Suggestions',
                ],
            };
            await doc.save();
            updated += 1;
        }
    }
    console.log(`Migrated ${updated} of ${settings.length} lifecycle settings`);
    await mongoose.disconnect();
}

migrate().catch((err) => {
    console.error(err);
    process.exit(1);
});
