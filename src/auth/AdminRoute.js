import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <main className="auth-loading">Checking your permissions…</main>;
  return user?.role === 'admin' ? children : <Navigate to="/dashboard" replace />;
}
