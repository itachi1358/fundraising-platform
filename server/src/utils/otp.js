import crypto from 'crypto';

export const OTP_TTL_MS = 10 * 60 * 1000; // code valid for 10 minutes
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between resends
export const MAX_OTP_ATTEMPTS = 5; // wrong attempts before forcing a resend

/** Generates a cryptographically random 6-digit OTP. */
export function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

/** One-way hash used to store the OTP at rest (never store the raw code). */
export function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

/** Constant-time comparison between a submitted OTP and the stored hash. */
export function otpMatches(otp, storedHash) {
  if (!storedHash) return false;
  const attempt = Buffer.from(hashOtp(otp), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (attempt.length !== stored.length) return false;
  return crypto.timingSafeEqual(attempt, stored);
}
