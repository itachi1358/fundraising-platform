import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CampaignDetail from './CampaignDetail';
import { getCampaign, getCampaignDonationHistory } from '../api/campaigns';
import { useAuth } from '../auth/AuthContext';

jest.mock('../api/campaigns', () => ({
  __esModule: true,
  getCampaign: jest.fn(),
  getCampaignDonationHistory: jest.fn()
}));

jest.mock('../auth/AuthContext', () => ({
  __esModule: true,
  useAuth: jest.fn()
}));

describe('CampaignDetail admin payment details', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ user: { role: 'admin' } });
    getCampaign.mockResolvedValue({
      data: {
        campaign: {
          _id: 'camp-1',
          title: 'Books for students',
          description: 'A cause description for the test.',
          reason: 'We need support for learning materials.',
          category: 'Education',
          goalAmount: 5000,
          raisedAmount: 1000,
          deadline: '2030-01-01T00:00:00.000Z',
          status: 'active',
          creatorName: 'Asha',
          creator: { name: 'Asha' },
          createdAt: '2024-01-01T00:00:00.000Z',
          upiId: 'test@upi',
          bankDetails: 'Account 12345',
          contactNumber: '+91 9876543210',
          documents: []
        }
      }
    });
    getCampaignDonationHistory.mockResolvedValue({ data: { donations: [] } });
  });

  it('shows payment details for admins on the campaign detail page', async () => {
    render(
      <MemoryRouter initialEntries={['/campaigns/camp-1']}>
        <Routes>
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Books for students')).toBeInTheDocument());
    expect(await screen.findByText('Payment details')).toBeInTheDocument();
    expect(screen.getByText('UPI ID')).toBeInTheDocument();
    expect(screen.getByText('test@upi')).toBeInTheDocument();
    expect(screen.getByText('Bank details')).toBeInTheDocument();
  });
});
