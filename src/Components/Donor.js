import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import './Donor.css';

export default function Login() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth(); const navigate = useNavigate(); const location = useLocation();

  async function handleSubmit(event) {
    event.preventDefault(); setError(''); setSubmitting(true);
    try {
      await login({ email, password });
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to sign in. Please try again.');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="login-page">
      <div className="login-page__visual">
        <div className="login-page__visual-inner">
          <div className="login-page__logo" aria-hidden="true">♥</div>
          <h2>Every contribution creates a ripple of change.</h2>
          <p>CareConnect brings the NIT Raipur community together to support students when they need it most — verified, transparent, and powered by compassion.</p>
          <div className="login-page__stats">
            <div className="login-page__stat"><strong>500+</strong><span>Campaigns supported</span></div>
            <div className="login-page__stat"><strong>100%</strong><span>Verified requests</span></div>
            <div className="login-page__stat"><strong>₹25L+</strong><span>Funds raised</span></div>
          </div>
        </div>
      </div>
      <div className="login-page__form-side">
        <div className="login-card">
          <div className="login-card__header">
            <h1>Welcome back</h1>
            <p>Sign in with your NIT Raipur credentials</p>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="login-card__field">
              <label htmlFor="email">Email</label>
              <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="Your Email" required />
            </div>
            <div className="login-card__field">
              <label htmlFor="password">Password</label>
              <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" required />
            </div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" className="login-card__submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="login-card__footer">Don't have an account? <Link to="/signup">Create one</Link></p>
        </div>
      </div>
    </div>
  );
}
