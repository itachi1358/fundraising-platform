import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { createToken, publicUser, setAuthCookie } from '../utils/token.js';
import { sendOtpEmail } from '../utils/email.js';
import {
  MAX_OTP_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  generateOtp,
  hashOtp,
  otpMatches
} from '../utils/otp.js';

/**
 * Stores a fresh OTP on the user, emails it, and returns the resend cooldown.
 * In development, when email isn't delivered (SMTP unconfigured / failed),
 * the raw code is returned as `devOtp` so the flow can still be tested.
 */
async function issueOtp(user) {
  const otp = generateOtp();
  user.otpHash = hashOtp(otp);
  user.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  user.otpResendAt = new Date(Date.now() + OTP_RESEND_COOLDOWN_MS);
  user.otpAttempts = 0;
  await user.save();

  const delivery = await sendOtpEmail({ to: user.email, recipientName: user.name, otp });
  const devOtp = process.env.NODE_ENV !== 'production' && !delivery.sent ? otp : undefined;

  return {
    resendIn: Math.ceil(OTP_RESEND_COOLDOWN_MS / 1000),
    ...(devOtp ? { devOtp } : {})
  };
}

export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    let user = await User.findOne({ email });

    if (user) {
      if (user.isVerified) {
        return res.status(409).json({ message: 'An account already exists for this email' });
      }
      // Unverified account — refresh details and resend a new code.
      if (user.otpResendAt && user.otpResendAt > new Date()) {
        const waitSeconds = Math.ceil((user.otpResendAt - new Date()) / 1000);
        return res.status(429).json({
          message: `A verification code was sent recently. Check your email or try again in ${waitSeconds}s.`,
          email,
          resendIn: waitSeconds
        });
      }
      user.name = name;
      user.password = await bcrypt.hash(password, 12);
      const extras = await issueOtp(user);
      return res.status(200).json({
        message: 'A new verification code has been sent to your email',
        email,
        ...extras
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    user = await User.create({ name, email, password: passwordHash, isVerified: false });
    const extras = await issueOtp(user);
    return res.status(201).json({
      message: 'Verification code sent to your email. Enter it below to activate your account.',
      email,
      ...extras
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyOtp(req, res, next) {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email }).select('+otpHash');
    if (!user || user.isVerified) {
      return res.status(400).json({ message: 'No pending verification for this email' });
    }
    if (!user.otpHash || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: 'This code has expired. Request a new one.', email, requiresResend: true });
    }
    if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
      return res.status(400).json({ message: 'Too many incorrect attempts. Request a new code.', email, requiresResend: true });
    }
    if (!otpMatches(otp, user.otpHash)) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({ message: 'Incorrect code. Please try again.' });
    }

    user.isVerified = true;
    user.otpHash = undefined;
    user.otpExpiresAt = undefined;
    user.otpResendAt = undefined;
    user.otpAttempts = 0;
    await user.save();

    setAuthCookie(res, createToken(user));
    return res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

export async function resendOtp(req, res, next) {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user || user.isVerified) {
      return res.status(400).json({ message: 'No pending verification for this email' });
    }
    if (user.otpResendAt && user.otpResendAt > new Date()) {
      const waitSeconds = Math.ceil((user.otpResendAt - new Date()) / 1000);
      return res.status(429).json({
        message: `Please wait ${waitSeconds}s before requesting a new code.`,
        email,
        resendIn: waitSeconds
      });
    }
    const extras = await issueOtp(user);
    return res.json({ message: 'A new verification code has been sent to your email', email, ...extras });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (!user.isVerified) {
      return res.status(403).json({
        message: 'Please verify your email before signing in. Use the code from signup, or sign up again with the same email to receive a new one.',
        email: user.email,
        requiresVerification: true
      });
    }
    setAuthCookie(res, createToken(user));
    return res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

export function logout(_req, res) {
  res.clearCookie('careconnect_token', { httpOnly: true, sameSite: 'lax', path: '/' });
  res.status(204).end();
}

export function me(req, res) {
  res.json({ user: publicUser(req.user) });
}

export async function updateProfile(req, res, next) {
  try {
    req.user.name = req.body.name;
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  } catch (error) {
    next(error);
  }
}
