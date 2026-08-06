import crypto from 'crypto';
import Razorpay from 'razorpay';

export class PaymentConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PaymentConfigurationError';
  }
}

const trim = (value) => (typeof value === 'string' ? value.trim() : '');

function razorpayConfiguration() {
  const keyId = trim(process.env.RAZORPAY_KEY_ID);
  const keySecret = trim(process.env.RAZORPAY_KEY_SECRET);

  if (Boolean(keyId) !== Boolean(keySecret)) {
    throw new PaymentConfigurationError('Both RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured together');
  }

  if (!keyId) return null;

  if (!keyId.startsWith('rzp_test_') && !keyId.startsWith('rzp_live_')) {
    throw new PaymentConfigurationError('RAZORPAY_KEY_ID must be a Razorpay Test or Live key');
  }
  const mode = keyId.startsWith('rzp_live_') ? 'live' : 'test';
  if (mode === 'live' && process.env.RAZORPAY_LIVE_ENABLED !== 'true') {
    throw new PaymentConfigurationError('Live payments are disabled. Set RAZORPAY_LIVE_ENABLED=true only after completing the live-mode checklist.');
  }
  if (mode === 'live' && process.env.NODE_ENV !== 'production') {
    throw new PaymentConfigurationError('Live Razorpay payments require NODE_ENV=production and an HTTPS deployment.');
  }
  return { keyId, keySecret, mode };
}

export function getPaymentProvider() {
  const razorpay = razorpayConfiguration();
  if (razorpay) return { provider: 'razorpay', keyId: razorpay.keyId, mode: razorpay.mode };

  // Mock checkout exists solely to keep local development usable before a
  // Razorpay account is configured. It is never available in production.
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_MOCK_PAYMENTS !== 'true') {
    throw new PaymentConfigurationError('Payments are not configured. Add Razorpay API keys.');
  }

  return { provider: 'mock', keyId: null };
}

export async function createPaymentOrder({ amount, currency = 'INR', receipt, notes = {} }) {
  const paymentConfig = getPaymentProvider();
  const amountInSmallestUnit = Math.round(Number(amount) * 100);

  if (!Number.isSafeInteger(amountInSmallestUnit) || amountInSmallestUnit < 100) {
    throw new PaymentConfigurationError('Donation amount must be at least ₹1');
  }

  if (paymentConfig.provider === 'mock') {
    return {
      id: `mock_order_${crypto.randomUUID().replaceAll('-', '')}`,
      amount: amountInSmallestUnit,
      currency,
      receipt,
      status: 'created',
      provider: 'mock',
      keyId: null
    };
  }

  const client = new Razorpay({ key_id: paymentConfig.keyId, key_secret: razorpayConfiguration().keySecret });
  const order = await client.orders.create({
    amount: amountInSmallestUnit,
    currency,
    receipt,
    payment_capture: 1,
    notes
  });

  return { ...order, provider: 'razorpay', keyId: paymentConfig.keyId };
}

export function verifyPaymentSignature({ provider, orderId, paymentId, signature }) {
  if (provider === 'mock') {
    if (process.env.NODE_ENV === 'production' || process.env.ALLOW_MOCK_PAYMENTS === 'false') return false;
    return typeof paymentId === 'string' && paymentId.startsWith('mock_pay_');
  }

  const { keySecret } = razorpayConfiguration() || {};
  if (!keySecret || !signature || !orderId || !paymentId) return false;

  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const received = Buffer.from(signature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export function verifyWebhookSignature(rawBody, signature) {
  const webhookSecret = trim(process.env.RAZORPAY_WEBHOOK_SECRET);
  if (!webhookSecret) throw new PaymentConfigurationError('RAZORPAY_WEBHOOK_SECRET must be configured for webhook verification');
  if (!signature || !rawBody) return false;
  const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  const received = Buffer.from(signature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}
