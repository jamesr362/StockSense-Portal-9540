import {createContext, useContext, useState, useEffect} from 'react';
import {getUserByEmail} from '../services/db';
import {validateSession, createSession, clearSession, logSecurityEvent} from '../utils/security';
import {supabase} from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({children}) {
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
      
      // Check for valid session in our app first (primary source of truth)
      const session = validateSession();
      if (session && session.user) {
        console.log('Valid local session found:', session.user);
        setUser(session.user);
        setLoading(false);
        return;
      }

      // Check Supabase session as fallback
      if (supabase) {
        try {
          const {data: {session: supabaseSession}, error: sessionError} = await supabase.auth.getSession();
          if (!sessionError && supabaseSession) {
            console.log('Valid Supabase session found, syncing with local DB');
            
            // Get user data from our custom table
            const userData = await getUserByEmail(supabaseSession.user.email);
            if (userData) {
              const userObj = {
                email: userData.email,
                businessName: userData.businessName,
                role: userData.role
              };
              
              console.log('User data retrieved from local DB:', userObj);
              
              // Create local session for consistency
              createSession(userObj);
              setUser(userObj);
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          console.log('Supabase session check failed:', err);
        }
      }

      // Fallback to legacy localStorage check (for migration)
      const savedEmail = localStorage.getItem('userEmail');
      console.log('Checking saved email:', savedEmail);
      
      if (savedEmail) {
        const userData = await getUserByEmail(savedEmail);
        if (userData) {
          const {password, salt, ...userWithoutPassword} = userData;
          console.log('Restored user from localStorage:', userWithoutPassword);
          
          // Create new session for legacy users
          createSession(userWithoutPassword);
          setUser(userWithoutPassword);
          
          // Clean up legacy storage
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

    // Create secure session
    createSession(userData);
    setUser(userData);

    logSecurityEvent('SESSION_CREATED', {
      userEmail: userData.email,
      role: userData.role
    });

    // Return a promise that resolves when the state is updated
    return new Promise((resolve) => {
      // Use setTimeout to ensure the state update has been processed
      setTimeout(() => {
        resolve(userData);
      }, 0);
    });
  };

  const logout = async () => {
    console.log('AuthContext - Logging out user');
    if (user) {
      logSecurityEvent('USER_LOGOUT', {
        userEmail: user.email,
        role: user.role
      });
    }

    // Sign out from Supabase if available
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.log('Supabase signout error:', error);
      }
    }

    setUser(null);
    clearSession();
    // Clean up any legacy storage
    localStorage.removeItem('userEmail');
  };

  const updateUserData = (newData) => {
    const updatedUser = {...user, ...newData};
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
    <AuthContext.Provider value={{user, login, logout, updateUserData}}>
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