import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import User from '../models/User.js';

const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD in server/.env before creating an admin.');
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 12) {
  console.error('ADMIN_PASSWORD must contain at least 12 characters.');
  process.exit(1);
}

try {
  await connectDatabase();
  const password = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const user = await User.findOneAndUpdate(
    { email: ADMIN_EMAIL.trim().toLowerCase() },
    { name: ADMIN_NAME.trim(), email: ADMIN_EMAIL.trim().toLowerCase(), password, role: 'admin' },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`Admin account ready for ${user.email}`);
} catch (error) {
  console.error('Unable to create admin account:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
