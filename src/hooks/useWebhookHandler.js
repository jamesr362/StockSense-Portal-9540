import { useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { processWebhookEvent, simulateWebhookEvent } from '../services/webhookHandler';
import useFeatureAccess from './useFeatureAccess';

/**
 * Hook for handling Stripe webhooks and subscription updates
 */
export const useWebhookHandler = () => {
  const { user } = useAuth();
  const { refresh: refreshFeatureAccess } = useFeatureAccess();

  // Process incoming webhook events
  const handleWebhookEvent = useCallback(async (webhookEvent) => {
    try {
      console.log('Processing webhook event:', webhookEvent.type);
      const result = await processWebhookEvent(webhookEvent);
      
      // Refresh feature access after processing
      if (result.status === 'success') {
        setTimeout(() => {
          refreshFeatureAccess();
        }, 1000);
      }
      
      return result;
    } catch (error) {
      console.error('Error handling webhook event:', error);
      throw error;
    }
  }, [refreshFeatureAccess]);

  // Simulate webhook for testing/demo purposes
  const simulatePaymentSuccess = useCallback(async (planId = 'professional', sessionId = null) => {
    if (!user?.email) {
      throw new Error('User not authenticated');
    }

    const mockSessionId = sessionId || `cs_test_${Math.random().toString(36).substring(2, 15)}`;
    
    try {
      const result = await simulateWebhookEvent(
        'checkout.session.completed',
        {
          id: mockSessionId,
          object: 'checkout.session',
          customer: `cus_${mockSessionId.substring(0, 10)}`,
          customer_details: { email: user.email },
          customer_email: user.email,
          client_reference_id: user.email,
          subscription: `sub_${Math.random().toString(36).substring(2, 15)}`,
          payment_status: 'paid',
          status: 'complete'
        },
        {
          plan_id: planId,
          customer_email: user.email
        }
      );

      // Refresh feature access immediately
      setTimeout(() => {
        refreshFeatureAccess();
      }, 500);

      return result;
    } catch (error) {
      console.error('Error simulating payment success:', error);
      throw error;
    }
  }, [user?.email, refreshFeatureAccess]);

  // Handle subscription cancellation
  const simulateSubscriptionCancellation = useCallback(async (subscriptionId) => {
    try {
      const result = await simulateWebhookEvent(
        'customer.subscription.deleted',
        {
          id: subscriptionId,
          object: 'subscription',
          customer: `cus_${Math.random().toString(36).substring(2, 15)}`,
          status: 'canceled',
          canceled_at: Math.floor(Date.now() / 1000)
        }
      );

      // Refresh feature access
      setTimeout(() => {
        refreshFeatureAccess();
      }, 500);

      return result;
    } catch (error) {
      console.error('Error simulating subscription cancellation:', error);
      throw error;
    }
  }, [refreshFeatureAccess]);

  // Listen for subscription update events
  useEffect(() => {
    const handleSubscriptionUpdate = (event) => {
      console.log('Subscription update detected:', event.detail);
      // Trigger feature access refresh
      setTimeout(() => {
        refreshFeatureAccess();
      }, 1000);
    };

    window.addEventListener('subscriptionUpdated', handleSubscriptionUpdate);
    return () => window.removeEventListener('subscriptionUpdated', handleSubscriptionUpdate);
  }, [refreshFeatureAccess]);

  return {
    handleWebhookEvent,
    simulatePaymentSuccess,
    simulateSubscriptionCancellation
  };
};

export default useWebhookHandler;