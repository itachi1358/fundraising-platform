import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import './AppShell.css';

const displayName = (name) => name?.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'U';

export default function AppShell() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const navigate = useNavigate();

  async function handleLogout() {
    setLoggingOut(true);
    try { await logout(); } finally { navigate('/login', { replace: true }); }
  }

  return <div className="app-shell">
    <header className="app-header">
      <Link className="brand" to="/dashboard" aria-label="CareConnect dashboard"><span className="brand-mark">C</span><span>CareConnect</span></Link>
      <nav className="primary-nav" aria-label="Main navigation">
        <NavLink to="/dashboard">Campaigns</NavLink>
        <NavLink to="/create-campaign">Create campaign</NavLink>
        <NavLink to="/my-campaigns">My campaigns</NavLink>
        {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
      </nav>
      <div className="account-menu">
        <button className="profile-trigger" type="button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-haspopup="menu">
          <span className="avatar">{displayName(user?.name)}</span><span className="profile-name">{user?.name}</span><span aria-hidden="true">⌄</span>
        </button>
        {menuOpen && <div className="profile-dropdown" role="menu">
          <div className="account-summary"><strong>{user?.name}</strong><span>{user?.email}</span></div>
          <Link to="/profile" role="menuitem" onClick={() => setMenuOpen(false)}>Profile</Link>
          <button type="button" role="menuitem" onClick={handleLogout} disabled={loggingOut}>{loggingOut ? 'Logging out…' : 'Log out'}</button>
        </div>}
      </div>
    </header>
    <main className="app-content"><Outlet /></main>
  </div>;
}
