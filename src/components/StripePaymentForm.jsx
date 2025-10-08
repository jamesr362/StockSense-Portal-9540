import { useState } from 'react';
import { motion } from 'framer-motion';
import { RiSecurePaymentLine, RiCheckLine, RiAlertLine, RiExternalLinkLine } from 'react-icons/ri';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { logSecurityEvent } from '../utils/security';
import { createEnhancedCheckoutSession } from '../lib/stripe';

export default function StripePaymentForm({ plan, onSuccess, onCancel }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  const handlePayment = async () => {
    if (!user?.email || !plan) return;

    try {
      setIsProcessing(true);
      setError('');

      logSecurityEvent('PAYMENT_INITIATED', {
        planId: plan.id,
        userEmail: user.email,
        amount: plan.price
      });

      // Always use Stripe checkout for real payments
      if (plan.paymentLink) {
        logSecurityEvent('STRIPE_CHECKOUT_INITIATED', {
          planId: plan.id,
          userEmail: user.email,
          paymentUrl: plan.paymentLink
        });

        // Create enhanced checkout session with proper webhook handling
        const checkoutSession = await createEnhancedCheckoutSession(plan.id, user.email, {
          mode: 'subscription',
          allowPromotionCodes: true
        });

        console.log('🚀 Redirecting to Stripe checkout:', checkoutSession.url);
        
        // Redirect to Stripe checkout - webhook will handle the rest
        window.location.href = checkoutSession.url;
        return;
      }

      // Fallback: Demo payment processing (should be removed in production)
      console.log('⚠️ Using demo payment processing - remove in production');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Demo: Update subscription directly
      if (supabase) {
        await updateSubscriptionAfterDemoPayment(plan.id);
      }

      logSecurityEvent('DEMO_PAYMENT_SUCCESS', {
        planId: plan.id,
        userEmail: user.email
      });

      // Navigate to success page
      navigate(`/payment-success?plan=${plan.id}&payment_status=success&session_id=demo_${Date.now()}`);
    } catch (error) {
      console.error('❌ Payment processing error:', error);
      setError('Payment failed. Please try again.');
      logSecurityEvent('PAYMENT_FAILED', {
        planId: plan.id,
        userEmail: user.email,
        error: error.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const updateSubscriptionAfterDemoPayment = async (planId) => {
    try {
      console.log('📝 Updating subscription after demo payment...');

      // Check if user already has a subscription
      const { data: existingSubscription, error: fetchError } = await supabase
        .from('subscriptions_tb2k4x9p1m')
        .select('*')
        .eq('user_email', user.email.toLowerCase())
        .single();

      const subscriptionData = {
        user_email: user.email.toLowerCase(),
        stripe_customer_id: `cus_demo_${Math.random().toString(36).substring(2, 15)}`,
        stripe_subscription_id: `sub_demo_${Math.random().toString(36).substring(2, 15)}`,
        stripe_session_id: `cs_demo_${Date.now()}`,
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
        console.log('✅ Updated existing subscription');
      } else {
        // Create new subscription
        subscriptionData.created_at = new Date().toISOString();
        const { error: insertError } = await supabase
          .from('subscriptions_tb2k4x9p1m')
          .insert([subscriptionData]);

        if (insertError) throw insertError;
        console.log('✅ Created new subscription');
      }

      // Clear feature cache for immediate access
      localStorage.removeItem(`featureCache_${user.email}`);
      
      // Dispatch subscription update event
      window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
        detail: { 
          userEmail: user.email, 
          planId, 
          immediate: true,
          source: 'demo_payment'
        }
      }));

    } catch (error) {
      console.error('❌ Error updating subscription after demo payment:', error);
      throw error;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800 rounded-lg p-6 shadow-xl"
    >
      <div className="text-center mb-6">
        <RiSecurePaymentLine className="h-12 w-12 text-primary-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white">Complete Your Upgrade</h3>
        <p className="text-gray-400 text-sm mt-1">
          Upgrade to {plan.name} Plan
        </p>
      </div>

      {/* Plan Summary */}
      <div className="bg-gray-700 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-white font-medium">{plan.name} Plan</span>
          <span className="text-primary-400 font-bold text-lg">
            £{plan.price}/month
          </span>
        </div>
        <div className="text-gray-300 text-sm">
          <p>• {plan.features.slice(0, 3).join(' • ')}</p>
          {plan.features.length > 3 && (
            <p className="mt-1">• And {plan.features.length - 3} more features</p>
          )}
        </div>
      </div>

      {/* Payment Method Notice */}
      {plan.paymentLink ? (
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-center mb-2">
            <RiExternalLinkLine className="h-5 w-5 text-blue-400 mr-2" />
            <span className="text-blue-300 font-medium">Secure Stripe Checkout</span>
          </div>
          <p className="text-blue-300 text-sm text-center mb-2">
            You'll be redirected to Stripe's secure payment page. After completing payment, 
            you'll automatically return with full Professional access activated.
          </p>
          <div className="text-center space-y-1">
            <div className="inline-flex items-center text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded">
              <RiCheckLine className="h-3 w-3 mr-1" />
              Instant activation via webhooks
            </div>
            <div className="inline-flex items-center text-xs text-blue-400 bg-blue-900/20 px-2 py-1 rounded ml-2">
              <RiSecurePaymentLine className="h-3 w-3 mr-1" />
              256-bit SSL encryption
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-orange-900/30 border border-orange-700 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-center mb-2">
            <RiAlertLine className="h-5 w-5 text-orange-400 mr-2" />
            <span className="text-orange-300 font-medium">Demo Mode</span>
          </div>
          <p className="text-orange-300 text-sm text-center">
            This is a demo payment. In production, this would process through Stripe.
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg"
        >
          <div className="flex items-center">
            <RiAlertLine className="h-4 w-4 text-red-400 mr-2" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        </motion.div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1 py-3 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handlePayment}
          disabled={isProcessing}
          className="flex-1 py-3 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center font-medium"
        >
          {isProcessing ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              {plan.paymentLink ? 'Redirecting to Stripe...' : 'Processing Demo Payment...'}
            </div>
          ) : (
            <>
              {plan.paymentLink ? (
                <>
                  <RiExternalLinkLine className="h-4 w-4 mr-2" />
                  Continue to Stripe Checkout
                </>
              ) : (
                <>
                  <RiCheckLine className="h-4 w-4 mr-2" />
                  Demo Pay £{plan.price}/month
                </>
              )}
            </>
          )}
        </button>
      </div>

      {/* Webhook Information */}
      {plan.paymentLink && (
        <div className="mt-4 p-3 bg-gray-700 rounded-lg">
          <p className="text-gray-300 text-xs text-center">
            ✅ Webhooks enabled: Your Professional features will be activated instantly upon payment completion
          </p>
          <p className="text-gray-400 text-xs text-center mt-1">
            No manual refresh needed - the system will automatically detect your payment
          </p>
        </div>
      )}

      {/* Security Notice */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="flex items-center justify-center text-gray-400 text-xs">
          <RiSecurePaymentLine className="h-3 w-3 mr-1" />
          Your payment information is processed securely by Stripe
        </div>
      </div>
    </motion.div>
  );
}