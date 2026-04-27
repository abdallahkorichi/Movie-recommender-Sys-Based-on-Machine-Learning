/**
 * backfill-user-ids.js
 *
 * One-time script: assigns an integer appUserId to every existing user
 * that doesn't have one yet, and seeds the Counter collection so future
 * registrations continue from the right number.
 *
 * Run once from the backend folder:
 *   node backfill-user-ids.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Counter from './models/Counter.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const usersWithoutId = await User.find({ appUserId: { $exists: false } })
    .sort({ createdAt: 1 });  // oldest first so IDs are chronological

  if (usersWithoutId.length === 0) {
    console.log('All users already have appUserId — nothing to do.');
    process.exit(0);
  }

  console.log(`Found ${usersWithoutId.length} users to backfill...`);

  // Seed the counter to 0 (upsert with $setOnInsert so we don't overwrite if it exists)
  await Counter.findOneAndUpdate(
    { _id: 'userId' },
    { $setOnInsert: { seq: 0 } },
    { upsert: true }
  );

  for (const user of usersWithoutId) {
    const appUserId = await Counter.getNextId('userId');
    user.appUserId = appUserId;
    await user.save();
    console.log(`  ${user.email}  →  appUserId = ${appUserId}`);
  }

  console.log(`\nDone. Counter is now at ${await Counter.findById('userId').then(d => d.seq)}.`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
