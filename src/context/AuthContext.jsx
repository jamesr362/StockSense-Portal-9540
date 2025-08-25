import { createContext, useContext, useState, useEffect } from 'react';
import { getUserByEmail, performAutoSync } from '../services/db';
import { validateSession, createSession, clearSession, logSecurityEvent } from '../utils/security';
import { supabase } from '../lib/supabase';
import useDataSync from '../hooks/useDataSync';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeAuth();
  }, []);

  // Session timeout check with auto-sync
  useEffect(() => {
    if (user) {
      const interval = setInterval(async () => {
        const session = validateSession();
        if (!session) {
          console.log('Session expired, logging out user');
          logout();
        } else {
          // Perform auto-sync every session check
          try {
            await performAutoSync(user.email);
          } catch (error) {
            console.error('Auto-sync during session check failed:', error);
          }
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

            // Perform initial data sync
            try {
              await performAutoSync(userData.email);
            } catch (syncError) {
              console.error('Initial auto-sync failed:', syncError);
            }

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

        // Perform initial data sync
        try {
          await performAutoSync(session.user.email);
        } catch (syncError) {
          console.error('Initial auto-sync failed:', syncError);
        }
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

          // Perform initial data sync
          try {
            await performAutoSync(savedEmail);
          } catch (syncError) {
            console.error('Initial auto-sync failed:', syncError);
          }
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
    if (supabase && userData.password) {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: userData.email,
          password: userData.password
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

    logSecurityEvent('SESSION_CREATED', {
      userEmail: userData.email,
      role: userData.role
    });

    // Perform initial data sync after login
    try {
      await performAutoSync(userData.email);
    } catch (syncError) {
      console.error('Post-login auto-sync failed:', syncError);
    }

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

      // Perform final sync before logout
      try {
        await performAutoSync(user.email);
      } catch (syncError) {
        console.error('Pre-logout sync failed:', syncError);
      }
    }

    // Sign out from Supabase if available
    if (supabase) {
      await supabase.auth.signOut();
    }

    setUser(null);
    clearSession();
    localStorage.removeItem('userEmail');
  };

  const updateUserData = async (newData) => {
    const updatedUser = { ...user, ...newData };
    setUser(updatedUser);

    // Update session
    createSession(updatedUser);

    // Sync to database
    if (supabase) {
      try {
        await supabase
          .from('users_tb2k4x9p1m')
          .update({
            business_name: updatedUser.businessName,
            updated_at: new Date().toISOString()
          })
          .eq('email', updatedUser.email.toLowerCase());
      } catch (error) {
        console.error('Error updating user data in database:', error);
      }
    }

    logSecurityEvent('USER_DATA_UPDATED', {
      userEmail: updatedUser.email,
      updatedFields: Object.keys(newData)
    });
  };

  // Auto-logout on window close/refresh with final sync
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (user) {
        // Attempt final sync (non-blocking)
        try {
          await performAutoSync(user.email);
        } catch (error) {
          console.error('Final sync on window close failed:', error);
        }

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
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">Loading and syncing your data...</p>
        </div>
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