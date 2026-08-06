import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboard from './AdminDashboard';
import api from '../api/client';

jest.mock('../api/client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn()
  }
}));

const mockApi = api;

describe('AdminDashboard request review', () => {
  beforeEach(() => {
    mockApi.get.mockImplementation((url) => {
      if (url === '/admin/requests') {
        return Promise.resolve({
          data: {
            requests: [
              {
                _id: 'req-1',
                status: 'pending',
                createdAt: '2024-01-01T00:00:00.000Z',
                requestedBy: { name: 'Asha', email: 'asha@example.com' },
                campaignData: {
                  title: 'Books for students',
                  description: 'A detailed campaign description for the review modal.',
                  category: 'Education',
                  goalAmount: 5000,
                  deadline: '2025-02-01T00:00:00.000Z',
                  reason: 'We need classroom resources for underserved students.',
                  contactNumber: '+91 9876543210',
                  upiId: 'test@upi',
                  bankDetails: 'Account 12345',
                  bannerImage: '',
                  documents: []
                }
              }
            ]
          }
        });
      }
      if (url === '/admin/campaigns') {
        return Promise.resolve({ data: { campaigns: [] } });
      }
      if (url === '/admin/analytics') {
        return Promise.resolve({ data: { analytics: { summary: { pendingRequests: 1, totalCampaigns: 0, totalFundsRaised: 0, totalDonations: 0 } } } });
      }
      if (url === '/admin/requests/req-1') {
        return Promise.resolve({ data: { request: { _id: 'req-1', status: 'pending', createdAt: '2024-01-01T00:00:00.000Z', requestedBy: { name: 'Asha', email: 'asha@example.com' }, campaignData: { title: 'Books for students', description: 'A detailed campaign description for the review modal.', category: 'Education', goalAmount: 5000, deadline: '2025-02-01T00:00:00.000Z', reason: 'We need classroom resources for underserved students.', contactNumber: '+91 9876543210', upiId: 'test@upi', bankDetails: 'Account 12345', bannerImage: '', documents: [] } } } });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it('opens a full request review modal with approval actions', async () => {
    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Campaign requests')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /view request/i }));

    expect(await screen.findByText('Campaign request details')).toBeInTheDocument();
    expect(screen.getByText('Books for students')).toBeInTheDocument();
    expect(screen.getByText(/A detailed campaign description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve request/i })).toBeInTheDocument();
  });
});
