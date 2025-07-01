import { createContext, useContext, useState, useEffect } from 'react';
import { getUserByEmail } from '../services/db';
import { validateSession, createSession, clearSession, logSecurityEvent } from '../utils/security';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeAuth();
  }, []);

  // Session timeout check
  useEffect(() => {
    if (user) {
      const interval = setInterval(() => {
        const session = validateSession();
        if (!session) {
          console.log('Session expired, logging out user');
          logout();
        }
      }, 60000); // Check every minute

      return () => clearInterval(interval);
    }
  }, [user]);

  const initializeAuth = async () => {
    try {
      console.log('===AuthContext Debug===');
      
      // Check for valid session first
      const session = validateSession();
      if (session && session.user) {
        console.log('Valid session found:', session.user);
        setUser(session.user);
        setLoading(false);
        return;
      }

      // Fallback to legacy localStorage check
      const savedEmail = localStorage.getItem('userEmail');
      console.log('Checking saved email:', savedEmail);
      
      if (savedEmail) {
        const userData = await getUserByEmail(savedEmail);
        if (userData) {
          const { password, salt, ...userWithoutPassword } = userData;
          console.log('Restored user from localStorage:', userWithoutPassword);
          
          // Create new session for legacy users
          createSession(userWithoutPassword);
          setUser(userWithoutPassword);
        } else {
          // Clean up invalid saved email
          localStorage.removeItem('userEmail');
        }
      }
    } catch (error) {
      console.error('AuthContext - Error restoring user:', error);
      clearSession();
    } finally {
      setLoading(false);
    }
  };

  const login = (userData) => {
    console.log('===AuthContext Login===');
    console.log('Login called with:', userData);
    console.log('Setting user role:', userData.role);
    console.log('========================');
    
    // Create secure session
    createSession(userData);
    setUser(userData);
    
    // Keep legacy localStorage for backward compatibility
    localStorage.setItem('userEmail', userData.email);
    
    logSecurityEvent('SESSION_CREATED', {
      userEmail: userData.email,
      role: userData.role
    });
  };

  const logout = () => {
    console.log('AuthContext - Logging out user');
    
    if (user) {
      logSecurityEvent('USER_LOGOUT', {
        userEmail: user.email,
        role: user.role
      });
    }
    
    setUser(null);
    clearSession();
    localStorage.removeItem('userEmail');
  };

  // Auto-logout on window close/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user) {
        logSecurityEvent('SESSION_ENDED', {
          userEmail: user.email,
          reason: 'window_close'
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  console.log('===AuthContext Current State===');
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