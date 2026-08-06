import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCampaigns } from '../api/campaigns';
import { CATEGORY_LABELS, formatCurrency, getPagination, normaliseCampaignList } from '../utils/campaigns';
import CampaignCard from './CampaignCard';
import './Homepage.css';

const PAGE_SIZE = 9;
const categoryOptions = Object.entries(CATEGORY_LABELS).filter(([value]) => value !== 'other');

function hasServerPagination(payload) {
  const root = payload?.data ?? payload ?? {};
  return Boolean(root.pagination || root.meta);
}

function filterAndSortCampaigns(campaigns, { category, search, sort }) {
  const query = search.trim().toLocaleLowerCase();
  const filtered = campaigns.filter((campaign) => {
    const matchesCategory = category === 'all' || campaign.category === category;
    const haystack = `${campaign.title} ${campaign.description} ${campaign.creatorName} ${campaign.category}`.toLocaleLowerCase();
    return matchesCategory && (!query || haystack.includes(query));
  });

  return [...filtered].sort((first, second) => {
    if (sort === 'mostFunded') return second.raisedAmount - first.raisedAmount;
    if (sort === 'endingSoon') {
      const firstDate = first.deadline ? new Date(first.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      const secondDate = second.deadline ? new Date(second.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      return firstDate - secondDate;
    }
    return new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime();
  });
}

function CampaignSkeleton() {
  return <article className="cc-skeleton-card" aria-hidden="true"><span /><div><i /><i /><i /><i /></div></article>;
}

export default function Homepage() {
  const [campaigns, setCampaigns] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [serverPagination, setServerPagination] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let isCurrent = true;
    const controller = new AbortController();

    async function loadCampaigns() {
      setLoading(true);
      setError('');
      try {
        const response = await getCampaigns({
          page,
          limit: PAGE_SIZE,
          category: category === 'all' ? undefined : category,
          search: search || undefined,
          sort
        });
        if (!isCurrent) return;
        const payload = response.data;
        const listed = normaliseCampaignList(payload).filter((campaign) => campaign.status === 'active');
        const hasPagination = hasServerPagination(payload);
        setCampaigns(listed);
        setServerPagination(hasPagination);
        setPagination(getPagination(payload, listed.length, page));
      } catch (requestError) {
        if (requestError.code === 'ERR_CANCELED' || !isCurrent) return;
        setError(requestError.response?.data?.message || 'Campaigns could not be loaded. Please try again.');
        setCampaigns([]);
      } finally {
        if (isCurrent) setLoading(false);
      }
    }

    loadCampaigns();
    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [category, page, refreshKey, search, sort]);

  const displayedCampaigns = useMemo(() => {
    if (serverPagination) return campaigns;
    const all = filterAndSortCampaigns(campaigns, { category, search, sort });
    return all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [campaigns, category, page, search, serverPagination, sort]);

  const localPagination = useMemo(() => {
    if (serverPagination) return pagination;
    const total = filterAndSortCampaigns(campaigns, { category, search, sort }).length;
    return { page, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  }, [campaigns, category, page, pagination, search, serverPagination, sort]);

  const raisedTotal = campaigns.reduce((sum, campaign) => sum + campaign.raisedAmount, 0);

  function updateCategory(event) {
    setCategory(event.target.value);
    setPage(1);
  }

  function updateSort(event) {
    setSort(event.target.value);
    setPage(1);
  }

  return (
    <div className="cc-dashboard">
      <main>
        <section className="cc-dashboard__hero">
          <div className="cc-dashboard__hero-orb cc-dashboard__hero-orb--one" />
          <div className="cc-dashboard__hero-orb cc-dashboard__hero-orb--two" />
          <div className="cc-dashboard__hero-content">
            <span className="cc-dashboard__eyebrow"><span aria-hidden="true">✦</span> NIT Raipur community fund</span>
            <h1>Small acts of care can keep a future moving forward.</h1>
            <p>Discover verified fundraisers from the NIT Raipur community. Every contribution goes toward a student or cause that needs support.</p>
            <div className="cc-dashboard__hero-actions">
              <a href="#campaigns" className="cc-btn cc-btn--light">Explore campaigns <span aria-hidden="true">↓</span></a>
              <Link to="/create-campaign" className="cc-btn cc-btn--ghost">Start a campaign</Link>
            </div>
            <div className="cc-dashboard__hero-stats" aria-label="Campaign highlights">
              <div><strong>{pagination.total || campaigns.length}+</strong><span>campaigns supported</span></div>
              <div><strong>{formatCurrency(raisedTotal || 0)}</strong><span>raised by our community</span></div>
              <div><strong>100%</strong><span>verified before going live</span></div>
            </div>
          </div>
        </section>

        <section className="cc-dashboard__content" id="campaigns" aria-labelledby="campaigns-title">
          <div className="cc-dashboard__heading-row">
            <div>
              <span className="cc-section-kicker">Live now</span>
              <h2 id="campaigns-title">Campaigns that need your support</h2>
              <p>Browse active, verified requests from the NIT Raipur community.</p>
            </div>
            <Link to="/create-campaign" className="cc-text-link">Need support? Create a campaign <span aria-hidden="true">→</span></Link>
          </div>

          <div className="cc-filters" aria-label="Find a campaign">
            <label className="cc-search-field">
              <span className="sr-only">Search campaigns</span>
              <span aria-hidden="true">⌕</span>
              <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search campaigns, causes, or creators" />
            </label>
            <label className="cc-select-field">
              <span className="sr-only">Filter by category</span>
              <select value={category} onChange={updateCategory}>
                <option value="all">All categories</option>
                {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="cc-select-field">
              <span className="sr-only">Sort campaigns</span>
              <select value={sort} onChange={updateSort}>
                <option value="newest">Newest first</option>
                <option value="endingSoon">Ending soon</option>
                <option value="mostFunded">Most funded</option>
              </select>
            </label>
          </div>

          {error && (
            <div className="cc-query-state cc-query-state--error" role="alert">
              <span aria-hidden="true">!</span>
              <div><strong>We couldn’t load campaigns.</strong><p>{error}</p></div>
              <button type="button" onClick={() => setRefreshKey((key) => key + 1)}>Try again</button>
            </div>
          )}

          {loading ? (
            <div className="cc-campaign-grid" aria-label="Loading campaigns"><CampaignSkeleton /><CampaignSkeleton /><CampaignSkeleton /><CampaignSkeleton /><CampaignSkeleton /><CampaignSkeleton /></div>
          ) : !error && displayedCampaigns.length === 0 ? (
            <div className="cc-query-state cc-query-state--empty">
              <span className="cc-empty-icon" aria-hidden="true">♡</span>
              <h3>No campaigns found</h3>
              <p>{search || category !== 'all' ? 'Try a different search term or clear your filters.' : 'Be the first to submit a campaign request for review.'}</p>
              {search || category !== 'all' ? <button type="button" onClick={() => { setSearchInput(''); setSearch(''); setCategory('all'); setPage(1); }}>Clear filters</button> : <Link to="/create-campaign">Create a campaign</Link>}
            </div>
          ) : (
            <>
              <div className="cc-results-count">Showing <strong>{displayedCampaigns.length}</strong>{localPagination.total ? ` of ${localPagination.total}` : ''} active campaign{localPagination.total === 1 ? '' : 's'}</div>
              <div className="cc-campaign-grid">{displayedCampaigns.map((campaign) => <CampaignCard campaign={campaign} key={campaign.id} />)}</div>
            </>
          )}

          {!loading && !error && localPagination.totalPages > 1 && (
            <nav className="cc-pagination" aria-label="Campaign pages">
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>← Previous</button>
              <span>Page {page} of {localPagination.totalPages}</span>
              <button type="button" disabled={page >= localPagination.totalPages} onClick={() => setPage((current) => Math.min(localPagination.totalPages, current + 1))}>Next →</button>
            </nav>
          )}
        </section>
      </main>
      <footer className="cc-footer">
        <div className="cc-footer__inner">
          <div><Link to="/dashboard" className="cc-footer__brand">Care<span>Connect</span></Link><p>A trusted support network built for the NIT Raipur community.</p></div>
          <div><strong>Quick links</strong><Link to="/create-campaign">Create a campaign</Link><a href="https://medical-resources.vercel.app" target="_blank" rel="noreferrer">Medical resources</a></div>
          <div><strong>Need urgent help?</strong><p>For immediate campus assistance, contact your department or the student welfare office.</p></div>
        </div>
      </footer>
    </div>
  );
}
