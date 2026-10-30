/** Read-only: node scripts/auditCareerPortals.js megha paarsiv (from server/). */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
const identifiers = process.argv.slice(2);
if (!process.env.MONGO_URI || !identifiers.length) {
    console.error('Set MONGO_URI (or server/.env), then run: node scripts/auditCareerPortals.js <slug-or-id> [...]');
    process.exitCode = 1;
} else {
    try {
        // Native reads only: no model initialization, index creation, or mutations.
        await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
        const db = mongoose.connection.db;
        const result = [];
        for (const identifier of identifiers) {
            const selector = /^[a-f\d]{24}$/i.test(identifier)
                ? { _id: new mongoose.Types.ObjectId(identifier) }
                : { careerSlug: identifier.toLowerCase() };
            const orgs = await db.collection('organizations').find(selector, {
                projection: { name: 1, careerSlug: 1, isActive: 1, deletedAt: 1 },
            }).toArray();
            if (!orgs.length) result.push({ identifier, result: 'No saved organization matches; portal should return 404.' });
            for (const org of orgs) {
                const eligible = { organizationId: org._id, status: 'Open', isActive: { $ne: false }, archivedAt: null, externalVisible: { $ne: false } };
                result.push({ identifier, organizationId: String(org._id), name: org.name, careerSlug: org.careerSlug,
                    canonicalPath: org.careerSlug ? `/careers/${org.careerSlug}` : null,
                    portalActive: org.isActive === true && !org.deletedAt,
                    totalJobs: await db.collection('recruitments').countDocuments({ organizationId: org._id }),
                    eligiblePublicJobs: await db.collection('recruitments').countDocuments(eligible),
                });
            }
        }
        console.log(JSON.stringify({ database: db.databaseName, portals: result }, null, 2));
    } catch {
        // Do not print a URI or credentials embedded in connection errors.
        console.error('Career portal audit failed. Check database access and MONGO_URI.');
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}
