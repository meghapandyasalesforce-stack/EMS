/**
 * One-shot: make designations level-only for all (or one) organizations.
 * Role-like designations are soft-deactivated and ensured as job roles.
 *
 * Usage:
 *   node server/scripts/normalize-org-designations.js
 *   node server/scripts/normalize-org-designations.js <organizationId>
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Organization from '../models/organization.model.js';
import { normalizeOrgDesignationCatalog } from '../services/orgStructureService.js';
import logger from '../helpers/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const run = async () => {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/paarsiv_hr';
    await mongoose.connect(mongoURI);
    logger.info('Connected', { db: mongoose.connection.db.databaseName });

    const orgIdArg = process.argv[2];
    const orgs = orgIdArg
        ? await Organization.find({ _id: orgIdArg }).select('_id name').lean()
        : await Organization.find({}).select('_id name').lean();

    if (!orgs.length) {
        logger.warn('No organizations found');
        await mongoose.disconnect();
        process.exit(orgIdArg ? 1 : 0);
    }

    for (const org of orgs) {
        const result = await normalizeOrgDesignationCatalog(org._id);
        logger.info('Normalized designations', {
            organizationId: String(org._id),
            name: org.name,
            ...result,
        });
    }

    await mongoose.disconnect();
    logger.info('Done');
};

run().catch(async (err) => {
    logger.error('normalize-org-designations failed', { error: err.message, stack: err.stack });
    try {
        await mongoose.disconnect();
    } catch {
        /* ignore */
    }
    process.exit(1);
});
