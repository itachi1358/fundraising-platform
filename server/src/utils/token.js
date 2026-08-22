import jwt from 'jsonwebtoken';

export function createToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

export function setAuthCookie(res, token) {
  res.cookie('careconnect_token', token, {
    httpOnly: true,
    // Over plain HTTP (e.g. the EC2 box without TLS) browsers reject Secure
    // cookies, silently logging everyone out. COOKIE_SECURE lets HTTP
    // deployments opt out until HTTPS is in place.
    secure: process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === 'true'
      : process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  });
}

export const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  isVerified: user.isVerified
});
