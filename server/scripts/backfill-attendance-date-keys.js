/**
 * Backfill attendanceDateKey, timezoneUsed, and correct date (org TZ) on attendance rows.
 *
 * Usage (from server/): node scripts/backfill-attendance-date-keys.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Attendance from '../models/attendance.model.js';
import { getEffectiveTimezone } from '../helpers/organizationTimezoneService.js';
import {
  getDateKeyInTimezone,
  getStartOfDayInTimezone,
} from '../helpers/timezoneHelper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function backfill() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI or MONGO_URI is required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  try {
    await Attendance.collection.dropIndex('organizationId_1_userId_1_date_1');
    console.log('Dropped legacy unique index organizationId_1_userId_1_date_1');
  } catch (dropErr) {
    if (dropErr.code !== 27 && !/not found/i.test(dropErr.message)) {
      console.warn('Legacy index drop:', dropErr.message);
    }
  }

  const timezoneCache = new Map();
  const cursor = Attendance.find({}).cursor();
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for await (const doc of cursor) {
    try {
      const orgId = doc.organizationId?.toString();
      if (!orgId) {
        skipped += 1;
        continue;
      }

      let tz = timezoneCache.get(orgId);
      if (!tz) {
        tz = await getEffectiveTimezone(doc.organizationId);
        timezoneCache.set(orgId, tz);
      }

      const ref = doc.clockIn || doc.date;
      if (!ref) {
        skipped += 1;
        continue;
      }

      const attendanceDateKey = getDateKeyInTimezone(ref, tz);
      const startOfDay = getStartOfDayInTimezone(ref, tz);

      const needsUpdate =
        doc.attendanceDateKey !== attendanceDateKey ||
        doc.timezoneUsed !== tz ||
        !doc.date ||
        new Date(doc.date).getTime() !== startOfDay.getTime();

      if (!needsUpdate) {
        skipped += 1;
        continue;
      }

      await Attendance.updateOne(
        { _id: doc._id },
        {
          $set: {
            attendanceDateKey,
            timezoneUsed: tz,
            date: startOfDay,
          },
        }
      );
      updated += 1;
    } catch (err) {
      errors += 1;
      console.error(`Failed row ${doc._id}:`, err.message);
    }
  }

  console.log(`Done. updated=${updated} skipped=${skipped} errors=${errors}`);

  try {
    await Attendance.syncIndexes();
    console.log('Attendance indexes synced');
  } catch (indexErr) {
    console.warn('Index sync warning (drop legacy unique date index manually if needed):', indexErr.message);
  }

  await mongoose.disconnect();
}

backfill().catch((err) => {
  console.error(err);
  process.exit(1);
});
