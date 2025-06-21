import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  console.log('=== AdminRoute Debug ===');
  console.log('Current user:', user);
  console.log('User role:', user?.role);
  console.log('Is admin?', user?.role === 'admin');
  console.log('Current path:', location.pathname);
  console.log('========================');

  if (!user) {
    console.log('AdminRoute - No user, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.role !== 'admin') {
    console.log('AdminRoute - User is not admin, redirecting to dashboard');
    return <Navigate to="/dashboard" state={{ from: location }} replace />;
  }

  console.log('AdminRoute - User is admin, allowing access to admin panel');
  return children;
}