import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DonationCheckout from '../Components/DonationCheckout';
import { getCampaign, getCampaignDonationHistory } from '../api/campaigns';
import { useAuth } from '../auth/AuthContext';
import { CAMPAIGN_PLACEHOLDER, categoryLabel, formatCurrency, formatDate, getDaysLeft, getProgress, normalizeCampaign } from '../utils/campaigns';
import './CampaignDetail.css';

export default function CampaignDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState(null); const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [checkoutOpen, setCheckoutOpen] = useState(false); const [copied, setCopied] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const campaignResult = await getCampaign(id);
      const rawCampaign = campaignResult.data?.campaign || campaignResult.data;
      setCampaign(normalizeCampaign(rawCampaign));
      try {
        const donationResult = await getCampaignDonationHistory(id, { page: 1, limit: 10 });
        setDonations(donationResult.data?.donations || []);
      } catch { setDonations([]); }
    } catch (requestError) { setError(requestError.response?.data?.message || 'This campaign could not be loaded.'); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  async function copyLink() { try { await navigator.clipboard.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); } }
  if (loading) return <main className="detail-page"><div className="detail-loading">Loading campaign details…</div></main>;
  if (error || !campaign) return <main className="detail-page"><section className="detail-empty"><h1>Campaign unavailable</h1><p>{error || 'We could not find that campaign.'}</p><Link to="/dashboard">Return to campaigns</Link></section></main>;
  const progress = getProgress(campaign); const daysLeft = getDaysLeft(campaign.deadline); const remaining = Math.max(0, campaign.goalAmount - campaign.raisedAmount); const canDonate = campaign.status === 'active' && remaining > 0 && new Date(campaign.deadline).getTime() > Date.now(); const isAdmin = user?.role === 'admin';
  return <main className="detail-page"><div className="detail-container"><Link className="detail-back" to="/dashboard">← All campaigns</Link><div className="detail-layout"><article className="detail-main"><img className="detail-banner" src={campaign.image} alt="" onError={(event) => { event.currentTarget.src = CAMPAIGN_PLACEHOLDER; }} /><div className="detail-copy"><div className="detail-tags"><span>{categoryLabel(campaign.category)}</span>{campaign.status !== 'active' && <span className="detail-status">{campaign.status === 'closed' ? 'Goal achieved' : campaign.status}</span>}</div><h1>{campaign.title}</h1><p className="detail-byline">Created by <strong>{campaign.creatorName}</strong> · {formatDate(campaign.createdAt)}</p><p className="detail-description">{campaign.description}</p>{campaign.reason && campaign.reason !== campaign.description && <section className="detail-story"><h2>Why this support is needed</h2><p>{campaign.reason}</p></section>}{isAdmin && <section className="detail-payment"><h2>Payment details</h2><div className="detail-payment-grid"><div><span>UPI ID</span><strong>{campaign.upiId || 'Not provided'}</strong></div><div><span>Bank details</span><strong>{campaign.bankDetails || 'Not provided'}</strong></div><div><span>Contact number</span><strong>{campaign.contactNumber || 'Not provided'}</strong></div></div></section>}<section className="detail-history"><h2>Donation history</h2>{donations.length ? <ul>{donations.map((donation) => <li key={donation._id || donation.id}><span className="donor-avatar">{donation.donor?.name?.[0]?.toUpperCase() || 'A'}</span><div><strong>{donation.donor?.name || 'Anonymous supporter'}</strong><small>{formatDate(donation.createdAt, { day: 'numeric', month: 'short' })}</small></div><b>{formatCurrency(donation.amount)}</b></li>)}</ul> : <p className="detail-no-history">Donations will appear here after they are securely confirmed.</p>}</section></div></article><aside className="detail-sidebar"><section className="donate-card"><div className="detail-funding"><strong>{formatCurrency(campaign.raisedAmount)}</strong><span>raised of {formatCurrency(campaign.goalAmount)}</span></div><div className="detail-progress"><i style={{ width: `${progress}%` }} /></div><div className="detail-numbers"><span>{Math.round(progress)}% funded</span><span>{formatCurrency(remaining)} to go</span></div>{canDonate ? <button className="detail-donate" onClick={() => setCheckoutOpen(true)}>Donate now</button> : <div className="detail-closed"><strong>{campaign.status === 'closed' ? 'Goal achieved' : 'Donations unavailable'}</strong><span>{campaign.status === 'closed' ? 'This campaign has reached its target.' : 'This campaign is not currently accepting donations.'}</span></div>}<button className="detail-share" type="button" onClick={copyLink}>{copied ? 'Link copied!' : 'Share / copy link'}</button></section><section className="detail-meta"><div><span>Days left</span><strong>{daysLeft || '—'}</strong></div><div><span>Goal</span><strong>{formatCurrency(campaign.goalAmount)}</strong></div><div><span>Status</span><strong className="capitalize">{campaign.status}</strong></div></section></aside></div></div>{checkoutOpen && <DonationCheckout campaign={campaign} onClose={() => setCheckoutOpen(false)} onSuccess={(updated) => { setCampaign(normalizeCampaign(updated)); }} />}</main>;
}
