import { createContext, useContext, useState, useEffect } from 'react';
import { getUserByEmail } from '../services/db';
import { validateSession, createSession, clearSession, logSecurityEvent } from '../utils/security';
import { supabase } from '../lib/supabase';

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
      
      // First check if we have a Supabase session
      if (supabase) {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!sessionError && session) {
          console.log('Valid Supabase session found:', session);
          
          // Get user data from our custom table
          const { data: userData, error: userError } = await supabase
            .from('users_tb2k4x9p1m')
            .select('email, business_name, role, created_at, last_login')
            .eq('email', session.user.email)
            .single();
          
          if (!userError && userData) {
            const userObj = {
              email: userData.email,
              businessName: userData.business_name,
              role: userData.role
            };
            
            console.log('User data retrieved from Supabase:', userObj);
            
            // Create session for our app
            createSession(userObj);
            setUser(userObj);
            setLoading(false);
            
            // Update last login
            await supabase
              .from('users_tb2k4x9p1m')
              .update({ last_login: new Date().toISOString() })
              .eq('email', userData.email);
            
            return;
          }
        }
      }
      
      // Check for valid session in our app
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

  const login = async (userData) => {
    console.log('===AuthContext Login===');
    console.log('Login called with:', userData);
    console.log('Setting user role:', userData.role);
    console.log('========================');

    // If we have Supabase available, sign in there too
    if (supabase) {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: userData.email,
          password: userData.password || 'default-password' // Only used if password is provided
        });
        
        if (error) {
          console.error('Supabase auth error:', error);
          // Continue anyway with our local auth
        }
      } catch (err) {
        console.error('Error signing in with Supabase:', err);
        // Continue with our local auth
      }
    }
    
    // Create secure session
    createSession(userData);
    setUser(userData);
    
    // Keep legacy localStorage for backward compatibility
    localStorage.setItem('userEmail', userData.email);
    logSecurityEvent('SESSION_CREATED', { userEmail: userData.email, role: userData.role });
  };

  const logout = async () => {
    console.log('AuthContext - Logging out user');
    if (user) {
      logSecurityEvent('USER_LOGOUT', { userEmail: user.email, role: user.role });
    }
    
    // Sign out from Supabase if available
    if (supabase) {
      await supabase.auth.signOut();
    }
    
    setUser(null);
    clearSession();
    localStorage.removeItem('userEmail');
  };

  const updateUserData = (newData) => {
    const updatedUser = { ...user, ...newData };
    setUser(updatedUser);
    
    // Update session
    createSession(updatedUser);
    logSecurityEvent('USER_DATA_UPDATED', { 
      userEmail: updatedUser.email, 
      updatedFields: Object.keys(newData) 
    });
  };

  // Auto-logout on window close/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user) {
        logSecurityEvent('SESSION_ENDED', { userEmail: user.email, reason: 'window_close' });
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
    <AuthContext.Provider value={{ user, login, logout, updateUserData }}>
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