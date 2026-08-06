import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import './ProfilePage.css';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault(); setMessage(''); setError(''); setSaving(true);
    try { await updateProfile({ name }); setMessage('Profile saved.'); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to update profile.'); }
    finally { setSaving(false); }
  }
  return <section className="profile-page"><div className="profile-card"><div className="profile-heading"><div className="profile-avatar">{user?.name?.[0]?.toUpperCase()}</div><div><p className="eyebrow">Account</p><h1>Your profile</h1><p>Keep your CareConnect account details up to date.</p></div></div>
    <form onSubmit={submit} className="profile-form"><label>Full name<input value={name} onChange={(e) => setName(e.target.value)} minLength="2" maxLength="80" required /></label><label>NIT Raipur email<input value={user?.email || ''} disabled /></label><label>Account role<input value={user?.role === 'admin' ? 'Administrator' : 'Student'} disabled /></label>
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}<button className="primary-action" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></form>
  </div></section>;
}
