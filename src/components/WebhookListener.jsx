import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { processWebhookEvent } from '../services/webhookHandler';
import { logSecurityEvent } from '../utils/security';

/**
 * WebhookListener Component
 * Handles webhook simulation and real-time subscription updates
 */
export default function WebhookListener() {
  const { user } = useAuth();

  useEffect(() => {
    // Listen for webhook simulation from payment returns
    const handleWebhookSimulation = async () => {
      if (!user?.email) return;

      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
      
      // Check for webhook simulation parameters
      const sessionId = urlParams.get('session_id') || hashParams.get('session_id');
      const paymentStatus = urlParams.get('payment_status') || hashParams.get('payment_status');
      const planId = urlParams.get('plan') || hashParams.get('plan');
      const webhookTrigger = urlParams.get('webhook_trigger') || hashParams.get('webhook_trigger');

      if (sessionId && paymentStatus === 'success' && webhookTrigger === 'true') {
        console.log('🎯 Simulating webhook for successful payment:', { 
          sessionId, 
          planId, 
          userEmail: user.email 
        });
        
        try {
          // Simulate checkout.session.completed webhook
          const checkoutSession = {
            id: sessionId,
            object: 'checkout.session',
            customer: `cus_${sessionId.substring(0, 10)}`,
            customer_details: {
              email: user.email
            },
            customer_email: user.email,
            client_reference_id: user.email,
            subscription: `sub_${Math.random().toString(36).substring(2, 15)}`,
            metadata: {
              plan_id: planId || 'professional',
              customer_email: user.email
            },
            payment_status: 'paid',
            status: 'complete',
            mode: 'subscription'
          };

          // Process the webhook event
          const result = await processWebhookEvent({
            id: `evt_${Math.random().toString(36).substring(2, 15)}`,
            type: 'checkout.session.completed',
            data: { object: checkoutSession },
            created: Math.floor(Date.now() / 1000),
            livemode: false
          });

          console.log('✅ Webhook simulation result:', result);

          logSecurityEvent('WEBHOOK_SIMULATION_SUCCESS', {
            userEmail: user.email,
            sessionId,
            planId: planId || 'professional',
            result: result.status
          });

          // Additional subscription.created simulation for completeness
          if (checkoutSession.subscription) {
            const subscription = {
              id: checkoutSession.subscription,
              object: 'subscription',
              customer: checkoutSession.customer,
              status: 'active',
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
              cancel_at_period_end: false,
              canceled_at: null,
              items: {
                data: [{
                  price: {
                    id: `price_${planId || 'professional'}`
                  }
                }]
              },
              metadata: {
                customer_email: user.email
              }
            };

            await processWebhookEvent({
              id: `evt_${Math.random().toString(36).substring(2, 15)}`,
              type: 'customer.subscription.created',
              data: { object: subscription },
              created: Math.floor(Date.now() / 1000),
              livemode: false
            });
          }

        } catch (error) {
          console.error('❌ Error simulating webhook:', error);
          logSecurityEvent('WEBHOOK_SIMULATION_ERROR', {
            error: error.message,
            userEmail: user?.email,
            sessionId
          });
        }
      }
    };

    // Run webhook simulation on component mount and when user changes
    handleWebhookSimulation();

    // Listen for hash changes (for hash routing)
    const handleHashChange = () => {
      handleWebhookSimulation();
    };

    // Listen for custom webhook events
    const handleCustomWebhook = async (event) => {
      try {
        console.log('🔗 Received custom webhook event:', event.detail);
        await processWebhookEvent(event.detail);
        
        logSecurityEvent('CUSTOM_WEBHOOK_PROCESSED', {
          eventType: event.detail.type,
          userEmail: user?.email
        });
      } catch (error) {
        console.error('❌ Error processing custom webhook:', error);
        logSecurityEvent('CUSTOM_WEBHOOK_ERROR', {
          error: error.message,
          userEmail: user?.email
        });
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('stripeWebhook', handleCustomWebhook);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('stripeWebhook', handleCustomWebhook);
    };
  }, [user?.email]);

  // Listen for subscription update events and refresh feature access
  useEffect(() => {
    const handleSubscriptionUpdate = (event) => {
      console.log('📱 Subscription update detected:', event.detail);
      
      // Trigger a feature access refresh after a short delay
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('refreshFeatureAccess', {
          detail: { source: 'webhook_listener' }
        }));
      }, 1000);
    };

    window.addEventListener('subscriptionUpdated', handleSubscriptionUpdate);
    return () => window.removeEventListener('subscriptionUpdated', handleSubscriptionUpdate);
  }, []);

  // This component doesn't render anything visible
  return null;
}