import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import './SignUp.css';

export default function SignUp() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [step, setStep] = useState('details'); // 'details' | 'otp'
  const [otp, setOtp] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const { register, verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // Countdown for the "Resend code" button
  useEffect(() => {
    if (resendIn <= 0 || step !== 'otp') return undefined;
    const timer = setInterval(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearInterval(timer);
  }, [resendIn, step]);

  function beginOtpStep(data, email) {
    setVerifiedEmail(email);
    setDevOtp(data.devOtp || '');
    setInfo(data.message || 'Enter the 6-digit code we sent to your email.');
    setResendIn(data.resendIn || 60);
    setError('');
    setOtp('');
    setStep('otp');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) return setError('Passwords do not match.');
    setError(''); setSubmitting(true);
    try {
      const data = await register({ name: formData.name, email: formData.email, password: formData.password });
      beginOtpStep(data, formData.email);
    } catch (requestError) {
      const response = requestError.response;
      setError(response?.data?.message || 'Unable to create your account.');
      if (response?.data?.resendIn) setResendIn(response.data.resendIn);
    } finally { setSubmitting(false); }
  }

  async function handleOtpSubmit(e) {
    e.preventDefault();
    setError(''); setSubmitting(true);
    try {
      await verifyOtp({ email: verifiedEmail, otp });
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to verify your code.');
    } finally { setSubmitting(false); }
  }

  async function handleResend() {
    if (resendIn > 0 || submitting) return;
    setError(''); setSubmitting(true);
    try {
      const data = await resendOtp(verifiedEmail);
      setDevOtp(data.devOtp || '');
      setOtp('');
      setInfo(data.message || 'A new code has been sent to your email.');
      setResendIn(data.resendIn || 60);
    } catch (requestError) {
      const response = requestError.response;
      setError(response?.data?.message || 'Unable to resend the code.');
      if (response?.data?.resendIn) setResendIn(response.data.resendIn);
    } finally { setSubmitting(false); }
  }

  return (
    <div className="signup-page">
      <div className="signup-card">
        <div className="signup-card__header">
          <div className="signup-card__icon" aria-hidden="true">✦</div>
          <h1>{step === 'details' ? 'Join CareConnect' : 'Verify your email'}</h1>
          <p>
            {step === 'details'
              ? 'Create your account to start or support campaigns'
              : `We emailed a 6-digit code to ${verifiedEmail}`}
          </p>
        </div>

        {step === 'details' ? (
          <form onSubmit={handleSubmit}>
            <div className="signup-card__field">
              <label htmlFor="name">Full Name</label>
              <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} autoComplete="name" placeholder="Your full name" required />
            </div>
            <div className="signup-card__field">
              <label htmlFor="email">Email</label>
              <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} autoComplete="email" placeholder="Your Email" required />
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
              {submitting ? 'Sending code…' : 'Create account'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit}>
            <div className="signup-card__field">
              <label htmlFor="otp">Verification code</label>
              <input
                type="text"
                id="otp"
                name="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                pattern="[0-9]{6}"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                required
              />
            </div>
            {devOtp && (
              <div className="signup-card__dev-otp" role="status">
                Development mode — your code is <strong>{devOtp}</strong>
              </div>
            )}
            {info && <p className="signup-card__info" role="status">{info}</p>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" className="signup-card__submit" disabled={submitting || otp.length !== 6}>
              {submitting ? 'Verifying…' : 'Verify & activate account'}
            </button>
            <div className="signup-card__resend">
              {resendIn > 0
                ? <span>Resend code in {resendIn}s</span>
                : <button type="button" onClick={handleResend} disabled={submitting}>Resend code</button>}
            </div>
          </form>
        )}

        <p className="signup-card__footer">
          {step === 'details' ? (
            <>Already have an account? <Link to="/login">Sign in</Link></>
          ) : (
            <>Changed your mind? <button type="button" className="signup-card__back" onClick={() => setStep('details')}>Back to details</button></>
          )}
        </p>
      </div>
    </div>
  );
}
