import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { initials } from '../utils/campaigns';
import './SiteHeader.css';

export default function SiteHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const closeMenus = () => {
    setMobileOpen(false);
    setProfileOpen(false);
  };

  async function handleLogout() {
    setLogoutError('');
    try {
      await logout();
      closeMenus();
      navigate('/login', { replace: true });
    } catch (error) {
      // The local session is still cleared if the API cannot be reached.
      setLogoutError(error.response?.data?.message || 'We could not complete logout. Please try again.');
    }
  }

  return (
    <header className="cc-header">
      <div className="cc-header__inner">
        <Link to="/dashboard" className="cc-brand" onClick={closeMenus} aria-label="CareConnect dashboard">
          <span className="cc-brand__mark" aria-hidden="true">♥</span>
          <span>Care<span>Connect</span></span>
        </Link>

        <button
          type="button"
          className="cc-menu-toggle"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-controls="careconnect-navigation"
        >
          <span className="sr-only">Toggle navigation</span>
          <span /> <span /> <span />
        </button>

        <nav id="careconnect-navigation" className={`cc-nav ${mobileOpen ? 'cc-nav--open' : ''}`} aria-label="Main navigation">
          <NavLink to="/dashboard" onClick={closeMenus}>Discover</NavLink>
          <NavLink to="/create-campaign" onClick={closeMenus}>Create campaign</NavLink>
          <NavLink to="/my-campaigns" onClick={closeMenus}>My campaigns</NavLink>
          {user?.role === 'admin' && <NavLink to="/admin" onClick={closeMenus}>Admin</NavLink>}
          <a href="https://medical-resources.vercel.app" target="_blank" rel="noreferrer">Resources <span aria-hidden="true">↗</span></a>
        </nav>

        <div className="cc-profile-menu">
          <button
            type="button"
            className="cc-profile-trigger"
            onClick={() => setProfileOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={profileOpen}
          >
            <span className="cc-avatar" aria-hidden="true">{initials(user?.name)}</span>
            <span className="cc-profile-trigger__name">{user?.name?.split(' ')[0] || 'Profile'}</span>
            <span className="cc-chevron" aria-hidden="true">⌄</span>
          </button>
          {profileOpen && (
            <div className="cc-profile-popover" role="menu">
              <div className="cc-profile-popover__identity">
                <strong>{user?.name || 'NIT Raipur student'}</strong>
                <span>{user?.email}</span>
              </div>
              <Link to="/profile" role="menuitem" onClick={closeMenus}>View profile</Link>
              <Link to="/my-campaigns" role="menuitem" onClick={closeMenus}>My campaign requests</Link>
              <button type="button" role="menuitem" onClick={handleLogout}>Log out</button>
              {logoutError && <p className="cc-profile-popover__error" role="alert">{logoutError}</p>}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// Use this as the protected route layout so every signed-in page shares the
// same navigation and profile/logout controls.
export function AppLayout() {
  return <><SiteHeader /><Outlet /></>;
}
