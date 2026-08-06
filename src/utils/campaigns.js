const placeholderSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700"><rect width="1200" height="700" fill="#e8f1ff"/><circle cx="960" cy="170" r="145" fill="#fff" opacity=".65"/><path d="M600 440C470 360 395 290 395 190c0-65 50-112 112-112 40 0 75 22 93 54 18-32 53-54 93-54 62 0 112 47 112 112 0 100-75 170-205 250Z" fill="#e15757"/><text x="600" y="570" text-anchor="middle" fill="#245146" font-family="Arial" font-size="46" font-weight="700">CareConnect</text></svg>';
export const CAMPAIGN_PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent(placeholderSvg)}`;

export const CATEGORY_LABELS = {
  medical: 'Medical emergency', fees: 'Tuition fees', education: 'Educational resources',
  family: 'Family emergency', housing: 'Housing support', other: 'Other'
};

const numberOrZero = (value) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };
export function getId(value) { if (!value) return ''; if (typeof value === 'string') return value; return value._id || value.id || ''; }
export function normalizeCampaign(campaign = {}) {
  const creator = campaign.creator || campaign.requestedBy || campaign.user || {};
  const creatorName = typeof creator === 'string' ? creator : creator.name || campaign.creatorName || campaign.requestedByName || 'NIT Raipur student';
  const image = campaign.bannerImage?.url || campaign.bannerImage || campaign.image?.url || campaign.image || campaign.coverImage || '';
  return {
    ...campaign, id: getId(campaign), title: campaign.title || campaign.campaignTitle || 'Untitled campaign',
    description: campaign.description || campaign.reason || '', reason: campaign.reason || campaign.description || '',
    category: String(campaign.category || 'other').toLowerCase(), goalAmount: numberOrZero(campaign.goalAmount ?? campaign.targetAmount ?? campaign.goal),
    raisedAmount: numberOrZero(campaign.raisedAmount ?? campaign.amountRaised ?? campaign.raised), deadline: campaign.deadline || campaign.endDate || null,
    status: String(campaign.status || 'pending').toLowerCase(), creatorName, creator,
    image: typeof image === 'string' && image.trim() ? image : CAMPAIGN_PLACEHOLDER, createdAt: campaign.createdAt || campaign.requestedAt || null,
    donations: campaign.donations || campaign.donationHistory || [], donationCount: numberOrZero(campaign.donationCount ?? campaign.donorsCount ?? campaign.donations?.length),
    documents: campaign.documents || campaign.supportingDocuments || []
  };
}
export function normaliseCampaignList(payload) { const root = payload?.data ?? payload ?? {}; const values = Array.isArray(root) ? root : root.campaigns || root.items || root.results || root.data || []; return Array.isArray(values) ? values.map(normalizeCampaign) : []; }
export function getPagination(payload, itemCount, requestedPage = 1) { const root = payload?.data ?? payload ?? {}; const details = root.pagination || root.meta || {}; const page = Number(details.page || details.currentPage || requestedPage) || 1; const totalPages = Number(details.totalPages || details.pages || 1) || 1; const total = Number(details.total || details.totalItems || itemCount) || 0; return { page, totalPages: Math.max(1, totalPages), total }; }
export function formatCurrency(value) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(numberOrZero(value)); }
export function formatDate(value, options = {}) { if (!value) return 'Not specified'; const parsed = new Date(value); if (Number.isNaN(parsed.getTime())) return 'Not specified'; return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', ...options }).format(parsed); }
export function getProgress(campaign) { const goal = numberOrZero(campaign?.goalAmount); return goal ? Math.min(100, Math.max(0, (numberOrZero(campaign?.raisedAmount) / goal) * 100)) : 0; }
export function getDaysLeft(deadline) { if (!deadline) return null; const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000); if (Number.isNaN(days)) return null; if (days < 0) return 'Ended'; if (days === 0) return 'Ends today'; return days === 1 ? '1 day left' : `${days} days left`; }
export function categoryLabel(category) { return CATEGORY_LABELS[String(category || 'other').toLowerCase()] || String(category || 'Other'); }
export function initials(name = '') { return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'CC'; }
