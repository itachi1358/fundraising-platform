import api from './client';

// The app accepts both the documented singular endpoints and the REST-style
// plural endpoints. This keeps the UI compatible while the API is deployed or
// upgraded without masking real API errors.
async function requestWithFallback(primary, fallback) {
  try {
    return await primary();
  } catch (error) {
    if (error.response?.status === 404 && fallback) return fallback();
    throw error;
  }
}

export function getCampaigns(params = {}) {
  return api.get('/campaigns', { params });
}

export function getCampaign(id) {
  return requestWithFallback(
    () => api.get(`/campaigns/${id}`),
    () => api.get(`/campaign/${id}`)
  );
}

export function createCampaignRequest(payload) {
  const request = (url) => api.post(url, payload, {
    headers: payload instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : undefined
  });

  return requestWithFallback(
    () => request('/campaigns/request'),
    () => request('/campaign/request')
  );
}

export function getMyCampaigns() {
  return api.get('/my-campaigns');
}

export function createDonationOrder(payload) {
  return api.post('/donations/order', payload);
}

export function verifyDonation(payload) {
  return api.post('/donations/verify', payload);
}

export function getDonationHistory(params = {}) {
  return api.get('/donations/history', { params });
}

export function getCampaignDonationHistory(campaignId, params = {}) {
  return api.get(`/donations/campaign/${campaignId}`, { params });
}
