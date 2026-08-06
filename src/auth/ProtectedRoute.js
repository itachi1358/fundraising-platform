import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth(); const location = useLocation();
  if (loading) return <main className="auth-loading">Checking your session…</main>;
  return user ? children : <Navigate to="/login" replace state={{ from: location }} />;
}
