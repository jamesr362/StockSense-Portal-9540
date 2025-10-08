import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { processWebhookEvent } from '../services/webhookHandler';
import { logSecurityEvent } from '../utils/security';

/**
 * WebhookListener Component
 * Listens for Stripe webhook events and processes them
 * In production, webhooks would be handled server-side
 */
export default function WebhookListener() {
  const { user } = useAuth();

  useEffect(() => {
    // Listen for simulated webhook events from Stripe redirects
    const handleWebhookSimulation = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
      
      // Check for webhook simulation parameters
      const sessionId = urlParams.get('session_id') || hashParams.get('session_id');
      const paymentStatus = urlParams.get('payment_status') || hashParams.get('payment_status');
      const planId = urlParams.get('plan') || hashParams.get('plan');

      if (sessionId && paymentStatus === 'success' && user?.email) {
        console.log('Simulating webhook for successful payment:', { sessionId, planId, userEmail: user.email });
        
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
            status: 'complete'
          };

          // Process the webhook event
          const result = await processWebhookEvent({
            id: `evt_${Math.random().toString(36).substring(2, 15)}`,
            type: 'checkout.session.completed',
            data: { object: checkoutSession }
          });

          console.log('Webhook simulation result:', result);

          logSecurityEvent('WEBHOOK_SIMULATION_SUCCESS', {
            userEmail: user.email,
            sessionId,
            planId: planId || 'professional'
          });

        } catch (error) {
          console.error('Error simulating webhook:', error);
          logSecurityEvent('WEBHOOK_SIMULATION_ERROR', {
            error: error.message,
            userEmail: user?.email
          });
        }
      }
    };

    // Run webhook simulation on component mount
    handleWebhookSimulation();

    // Listen for hash changes (for hash routing)
    const handleHashChange = () => {
      handleWebhookSimulation();
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [user?.email]);

  useEffect(() => {
    // Listen for real-time webhook events (if using WebSocket or Server-Sent Events)
    const handleWebhookEvent = async (event) => {
      try {
        console.log('Received real-time webhook event:', event.detail);
        await processWebhookEvent(event.detail);
      } catch (error) {
        console.error('Error processing real-time webhook:', error);
      }
    };

    // Listen for custom webhook events
    window.addEventListener('stripeWebhook', handleWebhookEvent);
    return () => window.removeEventListener('stripeWebhook', handleWebhookEvent);
  }, []);

  // This component doesn't render anything visible
  return null;
}