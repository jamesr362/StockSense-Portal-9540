import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { logSecurityEvent } from '../utils/security';

/**
 * Hook for verifying and processing subscription updates after payment
 * Listens for payment completion and updates subscription status
 * ENHANCED: Better cross-device sync and cache management
 */
export const useSubscriptionVerification = () => {
  const { user } = useAuth();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);

  // ENHANCED: Clear all subscription-related caches across devices
  const clearAllSubscriptionCaches = useCallback((userEmail) => {
    if (!userEmail) return;
    
    console.log('🧹 Clearing all subscription caches for:', userEmail);
    
    // Clear all possible cache keys
    const cacheKeys = [
      `featureCache_${userEmail}`,
      `subscriptionCache_${userEmail}`,
      `planLimits_${userEmail}`,
      `subscription_${userEmail}`,
      `userPlan_${userEmail}`,
      `planAccess_${userEmail}`,
      'lastSubscriptionCheck',
      'subscriptionRefreshTime'
    ];
    
    cacheKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch (error) {
        console.warn('Error clearing cache key:', key, error);
      }
    });
    
    // Clear IndexedDB subscription data if available
    try {
      if ('indexedDB' in window) {
        // This will be handled by the next data fetch
        console.log('IndexedDB cache will be refreshed on next fetch');
      }
    } catch (error) {
      console.warn('Error clearing IndexedDB cache:', error);
    }
  }, []);

  // ENHANCED: Force subscription refresh across all components
  const forceSubscriptionRefresh = useCallback((userEmail, immediate = true) => {
    console.log('🔄 Forcing subscription refresh for:', userEmail);
    
    // Clear caches first
    clearAllSubscriptionCaches(userEmail);
    
    // Dispatch multiple events to ensure all components refresh
    const events = [
      'subscriptionUpdated',
      'refreshFeatureAccess', 
      'planChanged',
      'userUpgraded',
      'paymentSuccessful',
      'forceSubscriptionSync' // New event for forced sync
    ];
    
    events.forEach(eventType => {
      window.dispatchEvent(new CustomEvent(eventType, {
        detail: { 
          userEmail, 
          force: true,
          immediate,
          source: 'verification_refresh',
          timestamp: Date.now()
        }
      }));
    });
    
    // Also dispatch a global refresh event
    window.dispatchEvent(new CustomEvent('globalDataRefresh', {
      detail: { userEmail, immediate: true }
    }));
    
  }, [clearAllSubscriptionCaches]);

  // ENHANCED: Verify subscription status directly from Supabase
  const verifySubscriptionStatus = useCallback(async (userEmail) => {
    if (!userEmail || !supabase) {
      console.warn('Cannot verify subscription: missing user email or Supabase');
      return null;
    }

    try {
      console.log('🔍 Verifying subscription status for:', userEmail);
      
      // Direct query to Supabase with retry logic
      let attempts = 0;
      const maxAttempts = 3;
      let subscriptionData = null;
      
      while (attempts < maxAttempts && !subscriptionData) {
        try {
          const { data, error } = await supabase
            .from('subscriptions_tb2k4x9p1m')
            .select('*')
            .eq('user_email', userEmail.toLowerCase())
            .single();
            
          if (error && error.code !== 'PGRST116') {
            throw error;
          }
          
          subscriptionData = data;
          break;
        } catch (err) {
          attempts++;
          console.warn(`Subscription verification attempt ${attempts} failed:`, err);
          
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          }
        }
      }
      
      if (subscriptionData) {
        console.log('✅ Subscription verified:', {
          planId: subscriptionData.plan_id,
          status: subscriptionData.status,
          userEmail: subscriptionData.user_email
        });
        
        return subscriptionData;
      } else {
        console.log('ℹ️ No subscription found - user is on free plan');
        return null;
      }
      
    } catch (error) {
      console.error('❌ Error verifying subscription status:', error);
      return null;
    }
  }, []);

  // Process payment verification from URL parameters
  const processPaymentVerification = useCallback(async (params = {}) => {
    if (!user?.email || isVerifying) return;

    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    
    // Extract payment parameters from URL
    const sessionId = params.sessionId || urlParams.get('session_id') || hashParams.get('session_id');
    const paymentStatus = params.paymentStatus || urlParams.get('payment_status') || hashParams.get('payment_status');
    const planId = params.planId || urlParams.get('plan') || hashParams.get('plan');
    const webhookTrigger = params.webhookTrigger || urlParams.get('webhook_trigger') || hashParams.get('webhook_trigger');

    // Only process if we have payment success indicators
    if (!sessionId || paymentStatus !== 'success') {
      // ENHANCED: Still perform subscription verification on new device login
      if (user?.email) {
        console.log('🔄 No payment params, but performing subscription sync for new device...');
        setTimeout(async () => {
          const currentSubscription = await verifySubscriptionStatus(user.email);
          if (currentSubscription) {
            forceSubscriptionRefresh(user.email, true);
          }
        }, 1000);
      }
      return;
    }

    console.log('🔍 Processing payment verification:', { 
      sessionId, 
      paymentStatus, 
      planId, 
      webhookTrigger,
      userEmail: user.email 
    });

    try {
      setIsVerifying(true);
      setVerificationStatus('processing');

      logSecurityEvent('PAYMENT_VERIFICATION_STARTED', {
        userEmail: user.email,
        sessionId,
        planId,
        webhookTrigger
      });

      // Update subscription in database
      await updateSubscriptionAfterPayment(planId || 'professional', sessionId);

      // ENHANCED: Clear all caches and force refresh
      clearAllSubscriptionCaches(user.email);

      // Force subscription refresh with immediate effect
      forceSubscriptionRefresh(user.email, true);

      setVerificationStatus('success');

      logSecurityEvent('PAYMENT_VERIFICATION_SUCCESS', {
        userEmail: user.email,
        sessionId,
        planId: planId || 'professional'
      });

      // Clean up URL parameters after successful processing
      if (window.history.replaceState) {
        const newUrl = window.location.pathname + window.location.hash.split('?')[0];
        window.history.replaceState({}, '', newUrl);
      }

    } catch (error) {
      console.error('❌ Payment verification failed:', error);
      setVerificationStatus('error');
      
      logSecurityEvent('PAYMENT_VERIFICATION_ERROR', {
        userEmail: user.email,
        sessionId,
        error: error.message
      });
    } finally {
      setIsVerifying(false);
    }
  }, [user?.email, isVerifying, verifySubscriptionStatus, clearAllSubscriptionCaches, forceSubscriptionRefresh]);

  // Update subscription in Supabase
  const updateSubscriptionAfterPayment = async (planId, sessionId) => {
    if (!supabase) {
      throw new Error('Database connection not available');
    }

    console.log('📝 Updating subscription after payment verification...');

    // Check if user already has a subscription
    const { data: existingSubscription, error: fetchError } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .select('*')
      .eq('user_email', user.email.toLowerCase())
      .single();

    const subscriptionData = {
      user_email: user.email.toLowerCase(),
      stripe_customer_id: sessionId ? `cus_${sessionId.substring(0, 10)}` : `cus_${Math.random().toString(36).substring(2, 15)}`,
      stripe_subscription_id: sessionId || `sub_${Math.random().toString(36).substring(2, 15)}`,
      stripe_session_id: sessionId,
      plan_id: `price_${planId}`,
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancel_at_period_end: false,
      canceled_at: null,
      updated_at: new Date().toISOString()
    };

    if (existingSubscription && !fetchError) {
      // Update existing subscription
      const { error: updateError } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .update(subscriptionData)
        .eq('user_email', user.email.toLowerCase());

      if (updateError) throw updateError;
      console.log('✅ Updated existing subscription via verification');
    } else {
      // Create new subscription
      subscriptionData.created_at = new Date().toISOString();
      const { error: insertError } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .insert([subscriptionData]);

      if (insertError) throw insertError;
      console.log('✅ Created new subscription via verification');
    }
  };

  // ENHANCED: Listen for user login events to sync subscription
  useEffect(() => {
    const handleUserLogin = async (event) => {
      if (event.detail?.userEmail === user?.email) {
        console.log('🔑 User login detected, syncing subscription...');
        setTimeout(async () => {
          const currentSubscription = await verifySubscriptionStatus(user.email);
          if (currentSubscription) {
            forceSubscriptionRefresh(user.email, true);
          }
        }, 2000); // Delay to ensure auth is fully processed
      }
    };

    window.addEventListener('userLoggedIn', handleUserLogin);
    return () => window.removeEventListener('userLoggedIn', handleUserLogin);
  }, [user?.email, verifySubscriptionStatus, forceSubscriptionRefresh]);

  // ENHANCED: Auto-sync on component mount for new devices
  useEffect(() => {
    if (user?.email) {
      console.log('🔄 Component mounted, performing subscription sync...');
      setTimeout(async () => {
        const currentSubscription = await verifySubscriptionStatus(user.email);
        if (currentSubscription) {
          // Check if local cache matches remote data
          const cachedPlan = localStorage.getItem(`subscriptionCache_${user.email}`);
          if (!cachedPlan || JSON.parse(cachedPlan)?.planId !== currentSubscription.plan_id) {
            console.log('🔄 Local cache outdated, forcing refresh...');
            forceSubscriptionRefresh(user.email, true);
          }
        }
      }, 1000);
    }
  }, [user?.email, verifySubscriptionStatus, forceSubscriptionRefresh]);

  // Listen for URL changes and hash changes
  useEffect(() => {
    // Process verification on mount
    processPaymentVerification();

    // Listen for hash changes (for hash routing)
    const handleHashChange = () => {
      processPaymentVerification();
    };

    // Listen for popstate events (back/forward navigation)
    const handlePopState = () => {
      processPaymentVerification();
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [processPaymentVerification]);

  // Manual verification trigger
  const triggerVerification = useCallback((params) => {
    return processPaymentVerification(params);
  }, [processPaymentVerification]);

  // ENHANCED: Manual subscription sync function
  const syncSubscription = useCallback(async () => {
    if (!user?.email) return;
    
    console.log('🔄 Manual subscription sync requested...');
    const currentSubscription = await verifySubscriptionStatus(user.email);
    forceSubscriptionRefresh(user.email, true);
    return currentSubscription;
  }, [user?.email, verifySubscriptionStatus, forceSubscriptionRefresh]);

  return {
    isVerifying,
    verificationStatus,
    triggerVerification,
    syncSubscription, // New method for manual sync
    clearAllSubscriptionCaches,
    forceSubscriptionRefresh
  };
};

export default useSubscriptionVerification;