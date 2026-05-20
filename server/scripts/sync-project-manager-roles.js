/**
 * One-time / maintenance: set project_manager functional role for Project Manager job titles.
 * Run: node server/scripts/sync-project-manager-roles.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Employee from '../models/employee.model.js';
import { isProjectManagerJobTitle } from '../helpers/projectManagerHelper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function main() {
    if (!MONGO_URI) {
        console.error('MONGO_URI or MONGODB_URI required');
        process.exit(1);
    }
    await mongoose.connect(MONGO_URI);
    const employees = await Employee.find({
        jobTitle: { $regex: /^project manager$/i }
    }).select('functionalRoles jobTitle organizationId');

    let updated = 0;
    for (const emp of employees) {
        const roles = new Set(Array.isArray(emp.functionalRoles) ? emp.functionalRoles : []);
        roles.add('project_manager');
        if (isProjectManagerJobTitle(emp.jobTitle)) {
            roles.delete('manager');
        }
        emp.functionalRoles = [...roles];
        await emp.save();
        updated += 1;
    }

    console.log(`Synced project_manager role for ${updated} employee(s).`);
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
