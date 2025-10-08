import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { processWebhookEvent } from '../services/webhookHandler';
import { logSecurityEvent } from '../utils/security';

/**
 * WebhookListener Component
 * Enhanced webhook simulation and real-time subscription updates
 */
export default function WebhookListener() {
  const { user } = useAuth();

  useEffect(() => {
    // Enhanced webhook simulation handler
    const handleWebhookSimulation = async () => {
      if (!user?.email) return;

      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
      
      // Check for webhook simulation parameters from multiple sources
      const sessionId = urlParams.get('session_id') || hashParams.get('session_id');
      const paymentStatus = urlParams.get('payment_status') || hashParams.get('payment_status');
      const planId = urlParams.get('plan') || hashParams.get('plan');
      const webhookTrigger = urlParams.get('webhook_trigger') || hashParams.get('webhook_trigger');

      // Also check for direct Stripe return parameters
      const stripeSuccess = window.location.href.includes('payment-success') || 
                           paymentStatus === 'success' || 
                           sessionId?.startsWith('cs_');

      if (sessionId && (paymentStatus === 'success' || stripeSuccess)) {
        console.log('🎯 Detected successful payment return, simulating webhook:', { 
          sessionId, 
          planId, 
          userEmail: user.email,
          paymentStatus,
          webhookTrigger,
          currentUrl: window.location.href
        });
        
        try {
          // Create comprehensive checkout session object
          const checkoutSession = {
            id: sessionId,
            object: 'checkout.session',
            customer: `cus_${sessionId.substring(3, 13)}`, // Extract from session ID
            customer_details: {
              email: user.email,
              name: user.displayName || user.email.split('@')[0]
            },
            customer_email: user.email,
            client_reference_id: user.email,
            subscription: `sub_${Math.random().toString(36).substring(2, 15)}`,
            metadata: {
              plan_id: planId || 'professional',
              customer_email: user.email,
              webhook_source: 'client_simulation'
            },
            payment_status: 'paid',
            status: 'complete',
            mode: 'subscription',
            success_url: window.location.href,
            cancel_url: `${window.location.origin}/#/pricing`,
            created: Math.floor(Date.now() / 1000),
            expires_at: Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000)
          };

          console.log('📋 Simulating checkout.session.completed webhook...');

          // Process the checkout session completed webhook
          const checkoutResult = await processWebhookEvent({
            id: `evt_${Math.random().toString(36).substring(2, 15)}`,
            type: 'checkout.session.completed',
            data: { object: checkoutSession },
            created: Math.floor(Date.now() / 1000),
            livemode: false,
            api_version: '2020-08-27'
          });

          console.log('✅ Checkout session webhook result:', checkoutResult);

          // Simulate subscription.created webhook for completeness
          if (checkoutSession.subscription) {
            console.log('📋 Simulating customer.subscription.created webhook...');
            
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
                  id: `si_${Math.random().toString(36).substring(2, 15)}`,
                  price: {
                    id: `price_${planId || 'professional'}`,
                    object: 'price',
                    active: true,
                    currency: 'gbp',
                    product: `prod_${planId || 'professional'}`,
                    unit_amount: planId === 'professional' ? 999 : 0,
                    recurring: {
                      interval: 'month',
                      interval_count: 1
                    }
                  }
                }]
              },
              metadata: {
                customer_email: user.email,
                plan_id: planId || 'professional'
              },
              created: Math.floor(Date.now() / 1000)
            };

            const subscriptionResult = await processWebhookEvent({
              id: `evt_${Math.random().toString(36).substring(2, 15)}`,
              type: 'customer.subscription.created',
              data: { object: subscription },
              created: Math.floor(Date.now() / 1000),
              livemode: false,
              api_version: '2020-08-27'
            });

            console.log('✅ Subscription webhook result:', subscriptionResult);
          }

          // Log successful webhook simulation
          logSecurityEvent('WEBHOOK_SIMULATION_SUCCESS', {
            userEmail: user.email,
            sessionId,
            planId: planId || 'professional',
            checkoutResult: checkoutResult.status,
            source: 'webhook_listener'
          });

          // Trigger immediate feature refresh
          setTimeout(() => {
            console.log('🔄 Triggering feature access refresh...');
            window.dispatchEvent(new CustomEvent('refreshFeatureAccess', {
              detail: { 
                source: 'webhook_simulation',
                immediate: true,
                userEmail: user.email
              }
            }));
          }, 500);

        } catch (error) {
          console.error('❌ Error simulating webhook:', error);
          logSecurityEvent('WEBHOOK_SIMULATION_ERROR', {
            error: error.message,
            userEmail: user?.email,
            sessionId,
            stack: error.stack
          });

          // Even if webhook simulation fails, try to update subscription directly
          console.log('🔄 Attempting direct subscription update as fallback...');
          try {
            window.dispatchEvent(new CustomEvent('directSubscriptionUpdate', {
              detail: {
                userEmail: user.email,
                planId: planId || 'professional',
                sessionId,
                source: 'webhook_fallback'
              }
            }));
          } catch (fallbackError) {
            console.error('❌ Fallback subscription update also failed:', fallbackError);
          }
        }
      }
    };

    // Run webhook simulation with slight delay to ensure user is loaded
    const timeoutId = setTimeout(() => {
      handleWebhookSimulation();
    }, 100);

    // Listen for hash changes (for hash routing)
    const handleHashChange = () => {
      setTimeout(handleWebhookSimulation, 100);
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

    // Listen for payment return detection
    const handlePaymentReturn = (event) => {
      console.log('💳 Payment return detected:', event.detail);
      setTimeout(handleWebhookSimulation, 100);
    };

    // Add event listeners
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('stripeWebhook', handleCustomWebhook);
    window.addEventListener('paymentReturnDetected', handlePaymentReturn);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('stripeWebhook', handleCustomWebhook);
      window.removeEventListener('paymentReturnDetected', handlePaymentReturn);
    };
  }, [user?.email]);

  // Listen for subscription update events and refresh feature access
  useEffect(() => {
    const handleSubscriptionUpdate = (event) => {
      console.log('📱 Subscription update detected:', event.detail);
      
      // Trigger feature access refresh after a short delay
      setTimeout(() => {
        console.log('🔄 Refreshing feature access after subscription update...');
        window.dispatchEvent(new CustomEvent('refreshFeatureAccess', {
          detail: { 
            source: 'subscription_update',
            userEmail: event.detail.userEmail,
            planId: event.detail.planId
          }
        }));
      }, 1000);
    };

    // Listen for direct subscription updates (fallback mechanism)
    const handleDirectSubscriptionUpdate = async (event) => {
      console.log('⚡ Direct subscription update requested:', event.detail);
      
      try {
        // Import and use the subscription service directly
        const { updateUserSubscription } = await import('../services/subscriptionService');
        await updateUserSubscription(event.detail.userEmail, event.detail.planId, event.detail.sessionId);
        
        console.log('✅ Direct subscription update completed');
        
        // Trigger feature refresh
        window.dispatchEvent(new CustomEvent('refreshFeatureAccess', {
          detail: { 
            source: 'direct_update',
            immediate: true
          }
        }));
        
      } catch (error) {
        console.error('❌ Direct subscription update failed:', error);
      }
    };

    window.addEventListener('subscriptionUpdated', handleSubscriptionUpdate);
    window.addEventListener('directSubscriptionUpdate', handleDirectSubscriptionUpdate);
    
    return () => {
      window.removeEventListener('subscriptionUpdated', handleSubscriptionUpdate);
      window.removeEventListener('directSubscriptionUpdate', handleDirectSubscriptionUpdate);
    };
  }, []);

  // This component doesn't render anything visible
  return null;
}