import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import helmet from 'helmet';
import { adminLimiter, authLimiter, paymentLimiter, standardLimiter, webhookLimiter, writeLimiter } from './config/rateLimiter.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import campaignRoutes, { legacyCampaignRoutes, userCampaignRoutes } from './routes/campaignRoutes.js';
import donationRoutes from './routes/donationRoutes.js';
import { handleRazorpayWebhook } from './controllers/webhookController.js';

const app = express();
app.set('trust proxy', 1);

// ── Security headers (all requests) ──
app.use(helmet());

// ── CORS ──
app.use(cors({
  origin: process.env.CLIENT_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
}));

// ── Razorpay webhook (raw body BEFORE JSON parser — webhook-specific rate limit) ──
app.post('/api/payments/razorpay-webhook',
  webhookLimiter,
  express.raw({ type: 'application/json', limit: '100kb' }),
  handleRazorpayWebhook
);

// ── Body parsing & input sanitization ──
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(mongoSanitize());

// ── Health check (NO rate limit — needed by uptime monitors / load balancers) ──
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ── Auth routes: strictest limit (login, signup, profile) ──
app.use('/api/auth', authLimiter, authRoutes);

// ── Campaign routes ──
//   Main mount:  /api/campaigns
//   Legacy:      /api/campaign       (frontend still uses /campaign/:id, /campaign/request)
//   User mount:  /api/my-campaigns   (user's own campaigns)
app.use('/api/campaigns', writeLimiter, campaignRoutes);
app.use('/api/campaign', writeLimiter, legacyCampaignRoutes);
app.use('/api', writeLimiter, userCampaignRoutes);

// ── Donation & payment routes: payment-sensitive limit ──
app.use('/api/donations', paymentLimiter, donationRoutes);

// ── Admin routes: generous limit for dashboard & moderation ──
app.use('/api/admin', adminLimiter, adminRoutes);

// ── Global fallback rate limit for any unlisted /api/* routes ──
app.use('/api', standardLimiter);

// ── 404 handler ──
app.use((_req, res) => res.status(404).json({ message: 'Route not found' }));

// ── Global error handler ──
app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.name === 'MulterError') {
    return res.status(400).json({ message: 'Invalid upload. Use up to five documents, six photos, and one banner image.' });
  }
  const status = error.statusCode || error.status || 500;
  return res.status(status).json({
    message: status >= 500 ? 'An unexpected server error occurred' : error.message
  });
});

export default app;
