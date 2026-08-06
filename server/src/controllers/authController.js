import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { createToken, publicUser, setAuthCookie } from '../utils/token.js';

const nitDomain = () => (process.env.NIT_EMAIL_DOMAIN || 'nitrr.ac.in').toLowerCase();

export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    if (!email.endsWith(`@${nitDomain()}`)) {
      return res.status(403).json({ message: `Please use your @${nitDomain()} email address` });
    }
    if (await User.exists({ email })) return res.status(409).json({ message: 'An account already exists for this email' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: passwordHash });
    setAuthCookie(res, createToken(user));
    return res.status(201).json({ user: publicUser(user) });
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
