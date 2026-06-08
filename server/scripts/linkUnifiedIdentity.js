/**
 * One-time migration: unified auth linking
 *
 * 1. Backfill User.roles for existing admins (org_owner + hr_admin)
 * 2. Link Employee + User when same email exists in same organization (no userId yet)
 *
 * Usage: node server/scripts/linkUnifiedIdentity.js
 * Dry run: DRY_RUN=1 node server/scripts/linkUnifiedIdentity.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/user.model.js';
import Employee from '../models/employee.model.js';
import {
  linkUserToEmployeeProfile,
  unifiedAuthPlaceholderPassword,
} from '../helpers/identityService.js';
import { PLATFORM_ROLES } from '../config/identity.constants.js';
import logger from '../helpers/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const DRY_RUN = String(process.env.DRY_RUN || '').toLowerCase() === '1';

async function backfillAdminRoles() {
  const admins = await User.find({
    role: 'admin',
    $or: [
      { roles: { $exists: false } },
      { roles: { $size: 0 } },
    ],
  });

  logger.info(`Admins to backfill roles: ${admins.length}`);
  for (const user of admins) {
    const roles = new Set([
      ...(user.roles || []),
      PLATFORM_ROLES.ORG_OWNER,
      PLATFORM_ROLES.HR_ADMIN,
    ]);
    if (!DRY_RUN) {
      user.roles = [...roles];
      await user.save();
    }
    logger.info(`  roles -> ${[...roles].join(', ')}`, { email: user.email, id: user._id });
  }
}

async function linkDuplicateEmailPairs() {
  const employees = await Employee.find({ userId: { $exists: false } }).select(
    'email organizationId _id'
  );

  let linked = 0;
  for (const emp of employees) {
    const user = await User.findOne({
      email: emp.email,
      organizationId: emp.organizationId,
    });
    if (!user) continue;
    if (user.employeeProfileId) {
      logger.warn('User already has employeeProfileId; skip', {
        email: emp.email,
        userId: user._id,
        employeeProfileId: user.employeeProfileId,
      });
      continue;
    }

    logger.info('Link pair', { email: emp.email, employeeId: emp._id, userId: user._id });
    if (!DRY_RUN) {
      emp.userId = user._id;
      if (!emp.password) {
        emp.password = unifiedAuthPlaceholderPassword();
      }
      await emp.save();
      await linkUserToEmployeeProfile(user, emp);
    }
    linked++;
  }
  logger.info(`Linked ${linked} employee/user pairs${DRY_RUN ? ' (dry run)' : ''}`);
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  await mongoose.connect(uri);
  logger.info(`Unified identity migration started${DRY_RUN ? ' (DRY_RUN)' : ''}`);

  await backfillAdminRoles();
  await linkDuplicateEmailPairs();

  await mongoose.disconnect();
  logger.info('Done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
