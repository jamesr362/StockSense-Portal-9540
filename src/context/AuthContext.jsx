import { createContext, useContext, useState, useEffect } from 'react';
import { getUserByEmail } from '../services/db';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedEmail = localStorage.getItem('userEmail');
    console.log('=== AuthContext Debug ===');
    console.log('Checking saved email:', savedEmail);
    
    if (savedEmail) {
      getUserByEmail(savedEmail).then(userData => {
        if (userData) {
          const { password, ...userWithoutPassword } = userData;
          console.log('Restored user from localStorage:', userWithoutPassword);
          console.log('User role:', userWithoutPassword.role);
          setUser(userWithoutPassword);
        }
        setLoading(false);
      }).catch(error => {
        console.error('AuthContext - Error restoring user:', error);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const login = (userData) => {
    console.log('=== AuthContext Login ===');
    console.log('Login called with:', userData);
    console.log('Setting user role:', userData.role);
    console.log('========================');
    setUser(userData);
    localStorage.setItem('userEmail', userData.email);
  };

  const logout = () => {
    console.log('AuthContext - Logging out user');
    setUser(null);
    localStorage.removeItem('userEmail');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  console.log('=== AuthContext Current State ===');
  console.log('Current user state:', user);
  console.log('User role:', user?.role);
  console.log('=================================');

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};