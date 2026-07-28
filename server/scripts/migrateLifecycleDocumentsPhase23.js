/**
 * Backfill document hub fields on existing Document records.
 * Run: node server/scripts/migrateLifecycleDocumentsPhase23.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Document } from '../models/document.model.js';
import { CATALOG_TO_JOB_DOCUMENT_TYPE } from '../constants/lifecycleDocumentCatalog.js';

const JOB_TO_CATALOG = Object.fromEntries(
    Object.entries(CATALOG_TO_JOB_DOCUMENT_TYPE).map(([k, v]) => [v, k]),
);

dotenv.config();

async function migrate() {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
        console.error('MONGODB_URI not set');
        process.exit(1);
    }
    await mongoose.connect(uri);
    const docs = await Document.find({});
    let updated = 0;
    for (const doc of docs) {
        let changed = false;
        if (!doc.verificationStatus) {
            doc.verificationStatus = doc.approvalStatus === 'Approved' ? 'Approved'
                : doc.approvalStatus === 'Rejected' ? 'Rejected' : 'Pending';
            changed = true;
        }
        if (!doc.catalogKey && doc.employeeJobDocumentType) {
            doc.catalogKey = JOB_TO_CATALOG[doc.employeeJobDocumentType] || 'OTHER';
            changed = true;
        }
        if (!doc.hubCategory && doc.catalogKey) {
            const { getCatalogDocument } = await import('../constants/lifecycleDocumentCatalog.js');
            const catalog = getCatalogDocument(doc.catalogKey);
            if (catalog?.hubCategory) {
                doc.hubCategory = catalog.hubCategory;
                changed = true;
            }
        }
        if (changed) {
            await doc.save();
            updated += 1;
        }
    }
    console.log(`Migrated ${updated} of ${docs.length} documents`);
    await mongoose.disconnect();
}

migrate().catch((err) => {
    console.error(err);
    process.exit(1);
});
