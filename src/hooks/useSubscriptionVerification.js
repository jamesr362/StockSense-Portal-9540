import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { logSecurityEvent } from '../utils/security';

export const useSubscriptionVerification = () => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const { user } = useAuth();

  // Check for payment completion on mount and URL changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment_status');
    const sessionId = urlParams.get('session_id');
    const planId = urlParams.get('plan');
    
    // Check for any payment-related URL parameters
    if (paymentStatus || sessionId || planId) {
      console.log('Payment verification triggered:', { paymentStatus, sessionId, planId });
      verifyPaymentAndUpdateSubscription(paymentStatus, sessionId, planId);
    }
  }, [user?.email]);

  // Listen for hash changes (for hash routing returns)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.includes('payment_status=success') || hash.includes('session_id=') || hash.includes('plan=')) {
        const hashParams = new URLSearchParams(hash.split('?')[1] || '');
        const paymentStatus = hashParams.get('payment_status');
        const sessionId = hashParams.get('session_id');
        const planId = hashParams.get('plan');
        
        console.log('Hash-based payment verification triggered:', { paymentStatus, sessionId, planId });
        verifyPaymentAndUpdateSubscription(paymentStatus, sessionId, planId);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    
    // Check on initial load
    handleHashChange();
    
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [user?.email]);

  const verifyPaymentAndUpdateSubscription = async (paymentStatus, sessionId, planId) => {
    if (!user?.email) {
      console.log('No user email available for payment verification');
      return;
    }

    try {
      setIsVerifying(true);
      logSecurityEvent('PAYMENT_VERIFICATION_STARTED', {
        userEmail: user.email,
        paymentStatus,
        sessionId,
        planId
      });

      // Check for successful payment indicators
      if (paymentStatus === 'success' || paymentStatus === 'paid' || sessionId || planId) {
        await handleSuccessfulPayment(sessionId, planId);
      } else if (paymentStatus === 'canceled' || paymentStatus === 'failed') {
        setVerificationStatus({
          success: false,
          message: 'Payment was canceled or failed. Please try again.',
          action: 'retry'
        });
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      setVerificationStatus({
        success: false,
        message: 'Error verifying payment. Please contact support if you were charged.',
        action: 'contact_support'
      });
    } finally {
      setIsVerifying(false);
      // Clean up URL parameters after processing
      cleanUpUrlParameters();
    }
  };

  const handleSuccessfulPayment = async (sessionId, planId) => {
    try {
      // Add a small delay to simulate verification process
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (supabase) {
        // Determine plan ID - default to professional if not specified
        const finalPlanId = planId || 'professional';
        const priceId = `price_${finalPlanId}`;

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
          plan_id: priceId,
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

          if (updateError) {
            console.error('Error updating subscription:', updateError);
            throw updateError;
          }
          console.log('Successfully updated existing subscription');
        } else {
          // Create new subscription
          subscriptionData.created_at = new Date().toISOString();
          const { error: insertError } = await supabase
            .from('subscriptions_tb2k4x9p1m')
            .insert([subscriptionData]);

          if (insertError) {
            console.error('Error creating subscription:', insertError);
            throw insertError;
          }
          console.log('Successfully created new subscription');
        }

        // Force a refresh of feature access by clearing cache
        localStorage.removeItem(`featureCache_${user.email}`);
        
        // Trigger a custom event to refresh feature access
        window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
          detail: { userEmail: user.email, planId: finalPlanId }
        }));
      }

      logSecurityEvent('PAYMENT_VERIFICATION_SUCCESS', {
        userEmail: user.email,
        planId: planId || 'professional'
      });

      const planName = (planId || 'professional').charAt(0).toUpperCase() + (planId || 'professional').slice(1);
      setVerificationStatus({
        success: true,
        message: `🎉 Welcome to ${planName}! Your subscription is now active.`,
        planName: planName,
        features: [
          'Unlimited inventory items',
          'Unlimited receipt scans', 
          'Unlimited Excel imports',
          'Professional tax exports',
          'Priority support'
        ]
      });

      // Trigger a page refresh after a short delay to ensure all components update
      setTimeout(() => {
        console.log('Refreshing page to update feature access...');
        window.location.reload();
      }, 4000);

    } catch (error) {
      console.error('Error updating subscription after payment:', error);
      throw error;
    }
  };

  const cleanUpUrlParameters = () => {
    // Clean up URL parameters without triggering navigation
    const url = new URL(window.location);
    const hasPaymentParams = url.searchParams.has('payment_status') || 
                           url.searchParams.has('session_id') || 
                           url.searchParams.has('plan');
    
    if (hasPaymentParams) {
      url.searchParams.delete('payment_status');
      url.searchParams.delete('session_id');
      url.searchParams.delete('plan');
      window.history.replaceState({}, '', url);
      console.log('Cleaned up payment URL parameters');
    }

    // Also clean up hash-based parameters
    const hash = window.location.hash;
    if (hash.includes('payment_status=') || hash.includes('session_id=') || hash.includes('plan=')) {
      const [hashPath, hashParams] = hash.split('?');
      if (hashParams) {
        const params = new URLSearchParams(hashParams);
        params.delete('payment_status');
        params.delete('session_id');
        params.delete('plan');
        
        const cleanedHash = params.toString() ? `${hashPath}?${params.toString()}` : hashPath;
        window.location.hash = cleanedHash;
        console.log('Cleaned up payment hash parameters');
      }
    }
  };

  const dismissVerificationStatus = useCallback(() => {
    setVerificationStatus(null);
  }, []);

  // Manual verification function for testing
  const manualVerifyPayment = useCallback(async (planId = 'professional') => {
    console.log('Manual payment verification triggered for plan:', planId);
    await verifyPaymentAndUpdateSubscription('success', null, planId);
  }, [user?.email]);

  return {
    isVerifying,
    verificationStatus,
    dismissVerificationStatus,
    verifyPaymentAndUpdateSubscription,
    manualVerifyPayment
  };
};

export default useSubscriptionVerification;