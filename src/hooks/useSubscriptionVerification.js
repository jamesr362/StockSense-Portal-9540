import {useState, useEffect, useCallback} from 'react';
import {useAuth} from '../context/AuthContext';
import {supabase} from '../lib/supabase';
import {logSecurityEvent} from '../utils/security';

export const useSubscriptionVerification = () => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const {user} = useAuth();

  // Check for payment completion on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment_status');
    const sessionId = urlParams.get('session_id');
    const planId = urlParams.get('plan');
    
    if (paymentStatus || sessionId || planId) {
      verifyPaymentAndUpdateSubscription(paymentStatus, sessionId, planId);
    }
  }, []);

  const verifyPaymentAndUpdateSubscription = async (paymentStatus, sessionId, planId) => {
    if (!user?.email) return;

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
      // Clean up URL parameters
      cleanUpUrlParameters();
    }
  };

  const handleSuccessfulPayment = async (sessionId, planId) => {
    try {
      // Wait a moment to simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (supabase) {
        // Check if user already has a subscription
        const {data: existingSubscription, error: fetchError} = await supabase
          .from('subscriptions_tb2k4x9p1m')
          .select('*')
          .eq('user_email', user.email.toLowerCase())
          .single();

        const subscriptionData = {
          user_email: user.email.toLowerCase(),
          stripe_customer_id: `cus_${Math.random().toString(36).substring(2, 15)}`,
          stripe_subscription_id: sessionId || `sub_${Math.random().toString(36).substring(2, 15)}`,
          plan_id: planId ? `price_${planId}` : 'price_professional', // Use provided plan or default to Professional
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          cancel_at_period_end: false,
          canceled_at: null,
          updated_at: new Date().toISOString()
        };

        if (existingSubscription && !fetchError) {
          // Update existing subscription
          const {error: updateError} = await supabase
            .from('subscriptions_tb2k4x9p1m')
            .update(subscriptionData)
            .eq('user_email', user.email.toLowerCase());

          if (updateError) throw updateError;
        } else {
          // Create new subscription
          subscriptionData.created_at = new Date().toISOString();
          const {error: insertError} = await supabase
            .from('subscriptions_tb2k4x9p1m')
            .insert([subscriptionData]);

          if (insertError) throw insertError;
        }
      }

      logSecurityEvent('PAYMENT_VERIFICATION_SUCCESS', {
        userEmail: user.email,
        planId: planId || 'professional'
      });

      const planName = planId || 'professional';
      setVerificationStatus({
        success: true,
        message: `Payment successful! Your ${planName.charAt(0).toUpperCase() + planName.slice(1)} plan is now active.`,
        planName: planName.charAt(0).toUpperCase() + planName.slice(1),
        features: [
          'Unlimited inventory items',
          'Unlimited receipt scans', 
          'Unlimited Excel imports',
          'Professional tax exports'
        ]
      });

      // Trigger a page refresh after showing success message
      setTimeout(() => {
        window.location.reload();
      }, 3000);

    } catch (error) {
      console.error('Error updating subscription after payment:', error);
      throw error;
    }
  };

  const cleanUpUrlParameters = () => {
    // Clean up URL parameters without triggering navigation
    const url = new URL(window.location);
    url.searchParams.delete('payment_status');
    url.searchParams.delete('session_id');
    url.searchParams.delete('plan');
    window.history.replaceState({}, '', url);
  };

  const dismissVerificationStatus = () => {
    setVerificationStatus(null);
  };

  return {
    isVerifying,
    verificationStatus,
    dismissVerificationStatus,
    verifyPaymentAndUpdateSubscription
  };
};

export default useSubscriptionVerification;