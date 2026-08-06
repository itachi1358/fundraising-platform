import { useState } from 'react';
import { createDonationOrder, verifyDonation } from '../api/campaigns';
import { formatCurrency } from '../utils/campaigns';
import './DonationCheckout.css';

const presetAmounts = [100, 250, 500, 1000];
let razorpayLoader;

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  if (razorpayLoader) return razorpayLoader;
  razorpayLoader = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
  return razorpayLoader;
}

export default function DonationCheckout({ campaign, onClose, onSuccess }) {
  const [amount, setAmount] = useState('500');
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [pendingOrder, setPendingOrder] = useState(null); const [transaction, setTransaction] = useState(null);
  const numericAmount = Number(amount);

  async function confirmPayment(order, paymentId, signature) {
    setLoading(true); setError('');
    try {
      const response = await verifyDonation({ campaignId: campaign.id, orderId: order.id, paymentId, signature });
      const data = response.data || {};
      setTransaction(data.donation || { paymentId });
      onSuccess?.(data.campaign || campaign);
    } catch (requestError) { setError(requestError.response?.data?.message || 'We could not confirm this donation. If money was debited, contact the CareConnect team with your payment ID.'); }
    finally { setLoading(false); }
  }

  async function startCheckout(event) {
    event.preventDefault();
    if (!Number.isFinite(numericAmount) || numericAmount < 1 || numericAmount > 1000000) {
      setError('Enter a donation amount between ₹1 and ₹10,00,000.'); return;
    }
    setLoading(true); setError('');
    try {
      const response = await createDonationOrder({ campaignId: campaign.id, amount: numericAmount });
      const order = response.data?.order;
      if (!order?.id) throw new Error('Payment order is missing');
      setPendingOrder(order);
      if (order.provider === 'mock') { setLoading(false); return; }
      const isLoaded = await loadRazorpay();
      if (!isLoaded) throw new Error('Razorpay Checkout could not be loaded. Check your internet connection and try again.');
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'CareConnect',
        description: `Donation to ${campaign.title}`,
        order_id: order.id,
        theme: { color: '#1d4ed8' },
        handler: (result) => confirmPayment(order, result.razorpay_payment_id, result.razorpay_signature),
        modal: { ondismiss: () => setLoading(false) }
      });
      checkout.on('payment.failed', (result) => { setError(result.error?.description || 'Payment was not successful. You have not been charged.'); setLoading(false); });
      checkout.open();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'We could not start secure checkout.');
      setLoading(false);
    }
  }

  if (transaction) return <div className="checkout-backdrop" role="presentation"><section className="checkout-modal checkout-success" role="dialog" aria-modal="true" aria-labelledby="donation-success-title"><div className="checkout-success-mark">✓</div><p className="checkout-eyebrow">Donation confirmed</p><h2 id="donation-success-title">Thank you for showing up.</h2><p>Your contribution to <strong>{campaign.title}</strong> was recorded successfully.</p><div className="transaction-id"><span>Transaction ID</span><code>{transaction.paymentId || transaction._id}</code></div><button className="checkout-primary" onClick={onClose}>Done</button></section></div>;

  return <div className="checkout-backdrop" role="presentation"><section className="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title"><button className="checkout-close" type="button" onClick={onClose} aria-label="Close donation form">×</button><p className="checkout-eyebrow">Secure donation</p><h2 id="checkout-title">Support this campaign</h2><p className="checkout-campaign-title">{campaign.title}</p><form onSubmit={startCheckout}><label className="checkout-label">Choose an amount<div className="checkout-presets">{presetAmounts.map((preset) => <button type="button" key={preset} className={Number(amount) === preset ? 'selected' : ''} onClick={() => setAmount(String(preset))}>{formatCurrency(preset)}</button>)}</div></label><label className="checkout-label">Other amount<div className="checkout-amount-input"><span>₹</span><input type="number" min="1" max="1000000" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" required /></div></label>{error && <p className="checkout-error" role="alert">{error}</p>}{pendingOrder?.provider === 'mock' ? <div className="mock-payment"><strong>Local test payment</strong><p>No money will be collected. Confirm to record this test donation.</p><button type="button" className="checkout-primary" disabled={loading} onClick={() => confirmPayment(pendingOrder, `mock_pay_${Date.now().toString(36)}`)}>Confirm {formatCurrency(numericAmount)} test donation</button></div> : <button className="checkout-primary" disabled={loading}>{loading ? 'Preparing checkout…' : `Donate ${formatCurrency(numericAmount)}`}</button>}<p className="checkout-secure-note">Payments are processed securely by Razorpay.</p></form></section></div>;
}
