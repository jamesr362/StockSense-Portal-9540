// Payment Verification Service
import { supabase } from '../lib/supabase';
import { logSecurityEvent } from '../utils/security';

// Verify payment completion and update subscription
export const verifyPaymentCompletion = async (sessionId, userEmail) => {
  try {
    logSecurityEvent('PAYMENT_VERIFICATION_STARTED', {
      sessionId,
      userEmail
    });

    // Call your backend API to verify the payment
    const response = await fetch('/api/stripe/verify-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        user_email: userEmail
      })
    });

    if (!response.ok) {
      throw new Error(`Payment verification failed: ${response.statusText}`);
    }

    const verificationResult = await response.json();

    if (verificationResult.success) {
      // Update local subscription data
      await updateLocalSubscription(verificationResult.subscription);
      
      logSecurityEvent('PAYMENT_VERIFICATION_SUCCESS', {
        sessionId,
        userEmail,
        subscriptionId: verificationResult.subscription.id
      });

      return {
        success: true,
        subscription: verificationResult.subscription,
        message: 'Payment verified and subscription activated!'
      };
    } else {
      throw new Error(verificationResult.message || 'Payment verification failed');
    }

  } catch (error) {
    console.error('Payment verification error:', error);
    logSecurityEvent('PAYMENT_VERIFICATION_ERROR', {
      sessionId,
      userEmail,
      error: error.message
    });

    return {
      success: false,
      error: error.message
    };
  }
};

// Check payment status from URL parameters
export const checkPaymentFromUrl = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get('payment_status');
  const sessionId = urlParams.get('session_id');
  const planId = urlParams.get('plan');

  return {
    hasPaymentParams: !!(paymentStatus || sessionId || planId),
    paymentStatus,
    sessionId,
    planId
  };
};

// Update local subscription data
const updateLocalSubscription = async (subscriptionData) => {
  if (!supabase) {
    console.warn('Supabase not available for local subscription update');
    return;
  }

  try {
    const { error } = await supabase
      .from('subscriptions_tb2k4x9p1m')
      .upsert([{
        user_email: subscriptionData.userEmail.toLowerCase(),
        stripe_customer_id: subscriptionData.customerId,
        stripe_subscription_id: subscriptionData.subscriptionId,
        plan_id: subscriptionData.planId,
        status: 'active',
        current_period_start: subscriptionData.currentPeriodStart,
        current_period_end: subscriptionData.currentPeriodEnd,
        updated_at: new Date().toISOString()
      }]);

    if (error) throw error;

    console.log('Local subscription updated successfully');
  } catch (error) {
    console.error('Error updating local subscription:', error);
  }
};

// Poll for subscription updates (fallback method)
export const pollForSubscriptionUpdate = async (userEmail, maxAttempts = 10) => {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      attempts++;
      
      // Check if subscription has been updated
      const { data, error } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .select('*')
        .eq('user_email', userEmail.toLowerCase())
        .single();

      if (!error && data) {
        // Check if this is a recent update (within last 5 minutes)
        const updatedAt = new Date(data.updated_at);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        if (updatedAt > fiveMinutesAgo && data.status === 'active') {
          logSecurityEvent('SUBSCRIPTION_POLL_SUCCESS', {
            userEmail,
            attempts,
            planId: data.plan_id
          });
          
          return {
            success: true,
            subscription: data
          };
        }
      }

      // Wait before next attempt (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.min(1000 * attempts, 5000)));
      
    } catch (error) {
      console.error(`Polling attempt ${attempts} failed:`, error);
    }
  }

  logSecurityEvent('SUBSCRIPTION_POLL_TIMEOUT', {
    userEmail,
    attempts: maxAttempts
  });

  return {
    success: false,
    error: 'Subscription update not detected within expected time'
  };
};

// Real-time subscription listener
export const subscribeToSubscriptionUpdates = (userEmail, onUpdate) => {
  if (!supabase) {
    console.warn('Supabase not available for real-time subscriptions');
    return null;
  }

  const subscription = supabase
    .channel('subscription_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'subscriptions_tb2k4x9p1m',
        filter: `user_email=eq.${userEmail.toLowerCase()}`
      },
      (payload) => {
        console.log('Subscription update received:', payload);
        logSecurityEvent('SUBSCRIPTION_REALTIME_UPDATE', {
          userEmail,
          eventType: payload.eventType,
          subscriptionId: payload.new?.stripe_subscription_id
        });
        
        if (onUpdate) {
          onUpdate(payload.new);
        }
      }
    )
    .subscribe();

  return subscription;
};

export default {
  verifyPaymentCompletion,
  checkPaymentFromUrl,
  pollForSubscriptionUpdate,
  subscribeToSubscriptionUpdates
};