import './App.css';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Donor from './Components/Donor';
import SignUp from './Components/Singup';
import Homepage from './Components/Homepage';
import CreateCampaign from './Components/CreateCampaign';
import { AppLayout } from './Components/SiteHeader';
import AdminRoute from './auth/AdminRoute';
import ProtectedRoute from './auth/ProtectedRoute';
import CampaignDetail from './pages/CampaignDetail';
import AdminDashboard from './pages/AdminDashboard';
import MyCampaigns from './pages/MyCampaigns';
import ProfilePage from './pages/ProfilePage';

function App() {
  return <div className="App"><BrowserRouter><Routes>
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="/login" element={<Donor />} />
    <Route path="/signup" element={<SignUp />} />
    <Route path="/donor_login" element={<Navigate to="/login" replace />} />
    <Route path="/fundraiser_login" element={<Navigate to="/login" replace />} />
    <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
      <Route path="/dashboard" element={<Homepage />} />
      <Route path="/campaigns/:id" element={<CampaignDetail />} />
      <Route path="/create-campaign" element={<CreateCampaign />} />
      <Route path="/my-campaigns" element={<MyCampaigns />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
    </Route>
    <Route path="/homepage" element={<Navigate to="/dashboard" replace />} />
    <Route path="/create_campaign" element={<Navigate to="/create-campaign" replace />} />
    <Route path="/Campaign_Creators" element={<Navigate to="/dashboard" replace />} />
    <Route path="/donate" element={<Navigate to="/dashboard" replace />} />
    <Route path="/donate-1" element={<Navigate to="/dashboard" replace />} />
    <Route path="/donate-2" element={<Navigate to="/dashboard" replace />} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes></BrowserRouter></div>;
}

export default App;
