import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/client';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/auth/me').then(({ data }) => setUser(data.user)).catch(() => setUser(null)).finally(() => setLoading(false)); }, []);
  const login = useCallback(async (credentials) => { const { data } = await api.post('/auth/login', credentials); setUser(data.user); return data.user; }, []);
  // Registers the account and emails a verification code — does NOT sign in yet.
  const register = useCallback(async (details) => { const { data } = await api.post('/auth/register', details); return data; }, []);
  const verifyOtp = useCallback(async ({ email, otp }) => { const { data } = await api.post('/auth/verify-otp', { email, otp }); setUser(data.user); return data.user; }, []);
  const resendOtp = useCallback(async (email) => { const { data } = await api.post('/auth/resend-otp', { email }); return data; }, []);
  const logout = useCallback(async () => { await api.post('/auth/logout'); setUser(null); }, []);
  const updateProfile = useCallback(async (details) => { const { data } = await api.patch('/auth/profile', details); setUser(data.user); return data.user; }, []);
  return <AuthContext.Provider value={{ user, loading, login, register, verifyOtp, resendOtp, logout, updateProfile }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used inside AuthProvider'); return context; }
