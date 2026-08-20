import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import './SignUp.css';

export default function SignUp() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth(); const navigate = useNavigate();
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) return setError('Passwords do not match.');
    setError(''); setSubmitting(true);
    try {
      await register({ name: formData.name, email: formData.email, password: formData.password });
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create your account.');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="signup-page">
      <div className="signup-card">
        <div className="signup-card__header">
          <div className="signup-card__icon" aria-hidden="true">✦</div>
          <h1>Join CareConnect</h1>
          <p>Create your account to start or support campaigns</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="signup-card__field">
            <label htmlFor="name">Full Name</label>
            <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} autoComplete="name" placeholder="Your full name" required />
          </div>
          <div className="signup-card__field">
            <label htmlFor="email">NIT Raipur Email</label>
            <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} autoComplete="email" placeholder="you@nitrr.ac.in" required />
          </div>
          <div className="signup-card__field">
            <label htmlFor="password">Password</label>
            <input type="password" id="password" name="password" value={formData.password} onChange={handleChange} autoComplete="new-password" minLength="8" placeholder="At least 8 characters" required />
          </div>
          <div className="signup-card__field">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input type="password" id="confirmPassword" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} autoComplete="new-password" minLength="8" placeholder="Repeat your password" required />
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" className="signup-card__submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="signup-card__footer">Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  );
}
