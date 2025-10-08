import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { logSecurityEvent } from '../utils/security';

/**
 * Hook for verifying and processing subscription updates after payment
 * Listens for payment completion and updates subscription status
 */
export const useSubscriptionVerification = () => {
  const { user } = useAuth();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);

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

      // Clear caches for immediate feature access
      localStorage.removeItem(`featureCache_${user.email}`);
      localStorage.removeItem(`subscriptionCache_${user.email}`);

      // Dispatch subscription update event
      window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
        detail: { 
          userEmail: user.email, 
          planId: planId || 'professional',
          sessionId,
          immediate: true,
          source: 'payment_verification'
        }
      }));

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
  }, [user?.email, isVerifying]);

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

  return {
    isVerifying,
    verificationStatus,
    triggerVerification
  };
};

export default useSubscriptionVerification;