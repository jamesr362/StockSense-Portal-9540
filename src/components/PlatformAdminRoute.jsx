import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PlatformAdminRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  console.log('=== PlatformAdminRoute Debug ===');
  console.log('Current user:', user);
  console.log('User role:', user?.role);
  console.log('Is platform admin?', user?.role === 'platformadmin');
  console.log('Current path:', location.pathname);
  console.log('===============================');

  if (!user) {
    console.log('PlatformAdminRoute - No user, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.role !== 'platformadmin') {
    console.log('PlatformAdminRoute - User is not platform admin, redirecting based on role');
    if (user.role === 'admin') {
      return <Navigate to="/admin" state={{ from: location }} replace />;
    } else {
      return <Navigate to="/dashboard" state={{ from: location }} replace />;
    }
  }

  console.log('PlatformAdminRoute - User is platform admin, allowing access');
  return children;
}