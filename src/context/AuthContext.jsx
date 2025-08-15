import { createContext, useContext, useState, useEffect } from 'react';
import { getUserByEmail } from '../services/db';
import { getUserSubscription } from '../services/subscriptionService';
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
      
      // Check for valid session first
      const session = validateSession();
      if (session && session.user) {
        console.log('Valid session found:', session.user);
        
        // If we have a valid session, load subscription info
        let subscriptionPlan = 'free';
        if (supabase && session.user.email) {
          try {
            const { data: subscriptionData } = await supabase
              .from('user_subscriptions_p3k7j2l')
              .select('plan_id')
              .eq('user_email', session.user.email.toLowerCase())
              .single();
              
            if (subscriptionData?.plan_id) {
              const { data: planData } = await supabase
                .from('subscription_plans_p3k7j2l')
                .select('name')
                .eq('id', subscriptionData.plan_id)
                .single();
                
              if (planData?.name) {
                subscriptionPlan = planData.name.toLowerCase();
              }
            }
          } catch (error) {
            console.log('Error getting subscription plan:', error);
          }
        }
        
        setUser({
          ...session.user,
          plan: subscriptionPlan
        });
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
          
          // Get subscription plan if available
          let subscriptionPlan = 'free';
          if (supabase) {
            try {
              const { data: subscriptionData } = await supabase
                .from('user_subscriptions_p3k7j2l')
                .select('plan_id')
                .eq('user_email', savedEmail.toLowerCase())
                .single();
                
              if (subscriptionData?.plan_id) {
                const { data: planData } = await supabase
                  .from('subscription_plans_p3k7j2l')
                  .select('name')
                  .eq('id', subscriptionData.plan_id)
                  .single();
                  
                if (planData?.name) {
                  subscriptionPlan = planData.name.toLowerCase();
                }
              }
            } catch (error) {
              console.log('Error getting subscription plan:', error);
            }
          }
          
          // Create new session for legacy users
          const userWithPlan = {
            ...userWithoutPassword,
            plan: subscriptionPlan
          };
          createSession(userWithPlan);
          setUser(userWithPlan);
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
    
    // Get subscription plan if available
    let subscriptionPlan = 'free';
    if (supabase) {
      try {
        const { data: subscriptionData } = await supabase
          .from('user_subscriptions_p3k7j2l')
          .select('plan_id')
          .eq('user_email', userData.email.toLowerCase())
          .single();
          
        if (subscriptionData?.plan_id) {
          const { data: planData } = await supabase
            .from('subscription_plans_p3k7j2l')
            .select('name')
            .eq('id', subscriptionData.plan_id)
            .single();
            
          if (planData?.name) {
            subscriptionPlan = planData.name.toLowerCase();
          }
        } else {
          // Create default free subscription for new users
          const { data: freePlanData } = await supabase
            .from('subscription_plans_p3k7j2l')
            .select('id')
            .eq('name', 'Free')
            .single();
            
          if (freePlanData?.id) {
            await supabase.from('user_subscriptions_p3k7j2l').insert([{
              user_email: userData.email.toLowerCase(),
              plan_id: freePlanData.id,
              status: 'active',
              start_date: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }]);
          }
        }
      } catch (error) {
        console.log('Error getting subscription plan:', error);
      }
    }
    
    // Enhance user data with subscription plan
    const enhancedUserData = {
      ...userData,
      plan: subscriptionPlan
    };

    // Create secure session
    createSession(enhancedUserData);
    setUser(enhancedUserData);
    
    // Keep legacy localStorage for backward compatibility
    localStorage.setItem('userEmail', userData.email);
    
    logSecurityEvent('SESSION_CREATED', {
      userEmail: userData.email,
      role: userData.role,
      plan: subscriptionPlan
    });
  };

  const logout = () => {
    console.log('AuthContext - Logging out user');
    if (user) {
      logSecurityEvent('USER_LOGOUT', {
        userEmail: user.email,
        role: user.role,
        plan: user.plan
      });
    }
    setUser(null);
    clearSession();
    localStorage.removeItem('userEmail');
  };

  const updateUserData = async (newData) => {
    // Get current subscription plan if it's not provided in the update
    let updatedPlan = newData.plan || user.plan;
    if (!newData.plan && supabase) {
      try {
        const { data: subscriptionData } = await supabase
          .from('user_subscriptions_p3k7j2l')
          .select('plan_id')
          .eq('user_email', user.email.toLowerCase())
          .single();
          
        if (subscriptionData?.plan_id) {
          const { data: planData } = await supabase
            .from('subscription_plans_p3k7j2l')
            .select('name')
            .eq('id', subscriptionData.plan_id)
            .single();
            
          if (planData?.name) {
            updatedPlan = planData.name.toLowerCase();
          }
        }
      } catch (error) {
        console.log('Error updating subscription plan:', error);
      }
    }
    
    const updatedUser = {
      ...user,
      ...newData,
      plan: updatedPlan
    };
    
    setUser(updatedUser);
    
    // Update session
    createSession(updatedUser);
    
    logSecurityEvent('USER_DATA_UPDATED', {
      userEmail: updatedUser.email,
      updatedFields: Object.keys(newData),
      plan: updatedPlan
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
  console.log('User plan:', user?.plan);
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