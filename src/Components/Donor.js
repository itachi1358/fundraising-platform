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
    try { await login({ email, password }); navigate(location.state?.from?.pathname || '/dashboard', { replace: true }); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to sign in. Please try again.'); }
    finally { setSubmitting(false); }
  }
  return <><div className="container_of_image"><div className="image_container" /></div><div className="login-container"><div className="login-box">
    <h2 className="login-title">Welcome to CareConnect</h2>
    <form className="login-form" onSubmit={handleSubmit}>
      <div className="form-group"><label htmlFor="email">NIT Raipur Email</label><input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></div>
      <div className="form-group"><label htmlFor="password">Password</label><input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button type="submit" className="login-button" disabled={submitting}>{submitting ? 'Signing in…' : 'Log In'}</button>
    </form>
    <p className="signup-text">Don’t have an account? <Link to="/signup" className="signup-link">Sign up</Link></p>
  </div></div></>;
}
