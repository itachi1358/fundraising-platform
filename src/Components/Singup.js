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
    try { await register({ name: formData.name, email: formData.email, password: formData.password }); navigate('/dashboard', { replace: true }); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to create your account.'); }
    finally { setSubmitting(false); }
  }
  return <div className="signup-container"><form className="signup-form" onSubmit={handleSubmit}>
    <h2>Create an Account</h2>
    <div className="form-group"><label>Full Name</label><input type="text" name="name" value={formData.name} onChange={handleChange} autoComplete="name" required /></div>
    <div className="form-group"><label>NIT Raipur Email</label><input type="email" name="email" value={formData.email} onChange={handleChange} autoComplete="email" required /></div>
    <div className="form-group"><label>Password</label><input type="password" name="password" value={formData.password} onChange={handleChange} autoComplete="new-password" minLength="8" required /></div>
    <div className="form-group"><label>Confirm Password</label><input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} autoComplete="new-password" minLength="8" required /></div>
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button type="submit" className="signup-button" disabled={submitting}>{submitting ? 'Creating account…' : 'Sign Up'}</button>
    <p className="login-link">Already have an account? <Link to="/login">Log In</Link></p>
  </form></div>;
}
