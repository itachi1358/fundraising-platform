import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import './AdminDashboard.css';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const date = (value) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)) : '—';
const unwrap = (response, key) => response.data[key] || response.data.data || response.data || [];

export default function AdminDashboard() {
  const [requests, setRequests] = useState([]); const [campaigns, setCampaigns] = useState([]); const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [workingId, setWorkingId] = useState(null);
  const [requestFilter, setRequestFilter] = useState('pending'); const [editTarget, setEditTarget] = useState(null); const [viewRequest, setViewRequest] = useState(null); const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [requestResult, campaignResult, analyticsResult] = await Promise.all([
        api.get('/admin/requests'), api.get('/admin/campaigns'), api.get('/admin/analytics')
      ]);
      setRequests(unwrap(requestResult, 'requests')); setCampaigns(unwrap(campaignResult, 'campaigns')); const analyticsData = unwrap(analyticsResult, 'analytics'); setAnalytics(analyticsData.summary || analyticsData);
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to load administration data.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shownRequests = useMemo(() => requestFilter === 'all' ? requests : requests.filter((request) => (request.status || '').toLowerCase() === requestFilter), [requests, requestFilter]);
  const pendingCount = analytics.pendingRequests ?? requests.filter((request) => (request.status || '').toLowerCase() === 'pending').length;
  const totalCampaigns = analytics.totalCampaigns ?? campaigns.length;
  const totalFunds = analytics.totalFundsRaised ?? analytics.totalRaised ?? campaigns.reduce((sum, campaign) => sum + (campaign.raisedAmount || 0), 0);
  const totalDonations = analytics.totalDonations ?? 0;

  async function openRequestDetails(request) {
    if (!request?._id) return;
    setDetailLoading(true); setError(''); setNotice('');
    try {
      const response = await api.get(`/admin/requests/${request._id}`);
      setViewRequest(response.data.request || response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load request details.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function runAction(id, endpoint, body, success, onSuccess) {
    setWorkingId(id); setNotice(''); setError('');
    try { await api.put(endpoint, body); setNotice(success); if (onSuccess) onSuccess(); await load(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'The change could not be completed.'); }
    finally { setWorkingId(null); }
  }
  async function deleteCampaign(campaign) {
    if (!window.confirm(`Delete “${campaign.title}”? This cannot be undone.`)) return;
    setWorkingId(campaign._id); setNotice(''); setError('');
    try { await api.delete(`/admin/campaigns/${campaign._id}`); setNotice('Campaign deleted.'); await load(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to delete this campaign.'); }
    finally { setWorkingId(null); }
  }
  async function saveEdit(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const id = editTarget._id;
    setWorkingId(id); setError('');
    try {
      await api.patch(`/admin/campaigns/${id}`, { title: form.get('title'), goalAmount: Number(form.get('goalAmount')), deadline: form.get('deadline') });
      setNotice('Campaign updated.'); setEditTarget(null); await load();
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to update campaign.'); }
    finally { setWorkingId(null); }
  }
  async function approveRequest(requestId) {
    const remarks = window.prompt('Optional approval remarks:') ?? '';
    await runAction(requestId, `/admin/requests/${requestId}/approve`, { adminRemarks: remarks }, 'Campaign approved and creator notified.', () => setViewRequest(null));
  }
  async function rejectRequest(requestId) {
    const remarks = window.prompt('Optional rejection remarks:') ?? '';
    await runAction(requestId, `/admin/requests/${requestId}/reject`, { adminRemarks: remarks }, 'Request rejected and creator notified.', () => setViewRequest(null));
  }
  const campaignData = (request) => request.campaignData || request;
  if (loading) return <section className="admin-page"><div className="admin-skeleton">Loading administration workspace…</div></section>;
  return <section className="admin-page"><div className="admin-hero"><div><p className="admin-eyebrow">Administrator workspace</p><h1>Fundraising overview</h1><p>Review student requests and keep every campaign accountable.</p></div><button className="secondary-button" onClick={load}>Refresh</button></div>
    {error && <p className="admin-alert error" role="alert">{error}</p>}{notice && <p className="admin-alert success" role="status">{notice}</p>}
    <div className="metric-grid"><Metric label="Total campaigns" value={totalCampaigns}/><Metric label="Pending requests" value={pendingCount}/><Metric label="Donations" value={totalDonations}/><Metric label="Funds raised" value={money.format(totalFunds)}/></div>
    <div className="admin-grid"><section className="admin-panel requests-panel"><div className="panel-heading"><div><h2>Campaign requests</h2><p>Review evidence and make a decision.</p></div><select value={requestFilter} onChange={(event) => setRequestFilter(event.target.value)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All requests</option></select></div>
      <div className="request-list">{shownRequests.length ? shownRequests.map((request) => { const data = campaignData(request); return <article className="request-row" key={request._id}><div className="request-copy"><div className="row-title"><h3>{data.title || 'Untitled campaign'}</h3><Status value={request.status}/></div><p>{data.category || 'Uncategorised'} · {money.format(data.goalAmount || 0)} · submitted {date(request.createdAt)}</p><p className="request-author">By {request.requestedBy?.name || request.requestedBy?.email || 'Student'}</p>{data.reason && <p className="request-reason">{data.reason}</p>}</div><div className="row-actions"><button className="secondary-button" disabled={detailLoading && viewRequest?._id === request._id} onClick={() => openRequestDetails(request)}>{detailLoading && viewRequest?._id === request._id ? 'Loading…' : 'View request'}</button></div></article>; }) : <p className="empty-admin">No {requestFilter === 'all' ? '' : requestFilter} requests.</p>}</div>
    </section>
    <section className="admin-panel campaigns-panel"><div className="panel-heading"><div><h2>Campaign management</h2><p>Pause, resume, edit, or remove campaigns.</p></div></div><div className="admin-table-wrap"><table><thead><tr><th>Campaign</th><th>Progress</th><th>Deadline</th><th>Status</th><th>Actions</th></tr></thead><tbody>{campaigns.length ? campaigns.map((campaign) => { const status = String(campaign.status || '').toLowerCase(); return <tr key={campaign._id}><td><strong>{campaign.title}</strong><small>{campaign.creator?.name || 'Unknown creator'}</small></td><td>{money.format(campaign.raisedAmount || 0)} <small>of {money.format(campaign.goalAmount || 0)}</small></td><td>{date(campaign.deadline)}</td><td><Status value={campaign.status}/></td><td><div className="table-actions"><Link to={`/campaigns/${campaign._id}`}>Donations</Link><button onClick={() => setEditTarget(campaign)}>Edit</button>{status === 'stopped' ? <button disabled={workingId === campaign._id} onClick={() => runAction(campaign._id, `/admin/campaigns/${campaign._id}/resume`, {}, 'Campaign resumed.')}>Resume</button> : status === 'active' ? <button disabled={workingId === campaign._id} onClick={() => runAction(campaign._id, `/admin/campaigns/${campaign._id}/stop`, {}, 'Campaign stopped and creator notified.')}>Stop</button> : null}<button className="danger-link" disabled={workingId === campaign._id} onClick={() => deleteCampaign(campaign)}>Delete</button></div></td></tr>; }) : <tr><td colSpan="5" className="empty-admin">No campaigns yet.</td></tr>}</tbody></table></div></section></div>
    {viewRequest && <div className="modal-backdrop" role="presentation"><div className="edit-modal request-detail-modal" role="dialog" aria-modal="true" aria-labelledby="request-details-title"><div className="modal-header"><div><p className="admin-eyebrow">Review request</p><h2 id="request-details-title">Campaign request details</h2></div><button type="button" onClick={() => setViewRequest(null)} aria-label="Close request details">×</button></div>{detailLoading ? <p className="empty-admin">Loading request details…</p> : (() => { const data = viewRequest.campaignData || viewRequest || {}; const isPending = (viewRequest.status || '').toLowerCase() === 'pending'; return <div className="request-detail-body"><div className="request-detail-summary"><h3>{data.title || 'Untitled campaign'}</h3><p className="request-detail-meta">Submitted by {viewRequest.requestedBy?.name || viewRequest.requestedBy?.email || 'Student'} · {date(viewRequest.createdAt)} · <Status value={viewRequest.status}/></p><p className="request-detail-description">{data.description || 'No description was provided.'}</p></div><div className="request-detail-grid"><div><span>Category</span><strong>{data.category || 'Uncategorised'}</strong></div><div><span>Goal amount</span><strong>{money.format(data.goalAmount || 0)}</strong></div><div><span>Deadline</span><strong>{date(data.deadline)}</strong></div><div><span>Contact number</span><strong>{data.contactNumber || '—'}</strong></div></div><div className="request-detail-section"><h4>Why this campaign matters</h4><p className="request-detail-description">{data.reason || 'No reason was provided.'}</p></div><div className="request-detail-section"><h4>Payment details</h4><p className="request-detail-description"><strong>UPI:</strong> {data.upiId || '—'}<br /><strong>Bank:</strong> {data.bankDetails || '—'}</p></div>{Array.isArray(data.documents) && data.documents.length > 0 ? <div className="request-detail-section"><h4>Supporting documents</h4><ul className="request-detail-list">{data.documents.map((document) => <li key={document}><a href={document} target="_blank" rel="noreferrer">{document}</a></li>)}</ul></div> : null}{viewRequest.adminRemarks ? <div className="request-detail-section"><h4>Admin remarks</h4><p className="request-detail-description">{viewRequest.adminRemarks}</p></div> : null}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setViewRequest(null)}>Close</button>{isPending && <><button className="approve" disabled={workingId === viewRequest._id} onClick={() => approveRequest(viewRequest._id)}>{workingId === viewRequest._id ? 'Processing…' : 'Approve request'}</button><button className="reject" disabled={workingId === viewRequest._id} onClick={() => rejectRequest(viewRequest._id)}>{workingId === viewRequest._id ? 'Processing…' : 'Reject request'}</button></>}</div></div>; })()}</div></div>}
    {editTarget && <div className="modal-backdrop" role="presentation"><form className="edit-modal" onSubmit={saveEdit}><div className="modal-header"><h2>Edit campaign</h2><button type="button" onClick={() => setEditTarget(null)} aria-label="Close">×</button></div><label>Title<input name="title" defaultValue={editTarget.title} required maxLength="120" /></label><label>Goal amount<input name="goalAmount" type="number" min="1" defaultValue={editTarget.goalAmount} required /></label><label>Deadline<input name="deadline" type="date" defaultValue={editTarget.deadline?.slice(0, 10)} required /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEditTarget(null)}>Cancel</button><button className="approve" disabled={workingId === editTarget._id}>{workingId === editTarget._id ? 'Saving…' : 'Save changes'}</button></div></form></div>}
  </section>;
}
function Metric({ label, value }) { return <article className="metric"><span>{label}</span><strong>{value}</strong></article>; }
function Status({ value }) { return <span className={`status status-${String(value || 'unknown').toLowerCase()}`}>{value || 'Unknown'}</span>; }
