import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { RiCheckLine, RiArrowRightLine, RiStarLine, RiRefreshLine } from 'react-icons/ri';
import { logSecurityEvent } from '../utils/security';
import { SUBSCRIPTION_PLANS } from '../lib/stripe';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [planDetails, setPlanDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUpdatingSubscription, setIsUpdatingSubscription] = useState(false);
  const [subscriptionUpdated, setSubscriptionUpdated] = useState(false);

  useEffect(() => {
    const handlePaymentSuccess = async () => {
      const planId = searchParams.get('plan');
      const sessionId = searchParams.get('session_id');
      const paymentStatus = searchParams.get('payment_status');
      
      console.log('PaymentSuccess page loaded with params:', { planId, sessionId, paymentStatus });

      // Determine plan details
      const finalPlanId = planId || 'professional';
      if (SUBSCRIPTION_PLANS[finalPlanId]) {
        setPlanDetails(SUBSCRIPTION_PLANS[finalPlanId]);
        logSecurityEvent('PAYMENT_SUCCESS_PAGE_VIEW', {
          planId: finalPlanId,
          userEmail: user?.email,
          sessionId,
          paymentStatus
        });

        // Update subscription in database
        if (user?.email && supabase) {
          await updateUserSubscription(finalPlanId, sessionId);
        }
      } else {
        // Default to professional plan if no specific plan
        setPlanDetails(SUBSCRIPTION_PLANS.professional);
        if (user?.email && supabase) {
          await updateUserSubscription('professional', sessionId);
        }
      }
      
      setLoading(false);
    };

    handlePaymentSuccess();
  }, [searchParams, user?.email]);

  const updateUserSubscription = async (planId, sessionId) => {
    try {
      setIsUpdatingSubscription(true);

      console.log('Updating subscription for user:', user.email, 'Plan:', planId);

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
        console.log('Successfully updated existing subscription');
      } else {
        // Create new subscription
        subscriptionData.created_at = new Date().toISOString();
        const { error: insertError } = await supabase
          .from('subscriptions_tb2k4x9p1m')
          .insert([subscriptionData]);

        if (insertError) throw insertError;
        console.log('Successfully created new subscription');
      }

      // Clear feature access cache to ensure immediate refresh
      localStorage.removeItem(`featureCache_${user.email}`);
      
      // Dispatch subscription update event
      window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
        detail: { userEmail: user.email, planId }
      }));

      setSubscriptionUpdated(true);

      logSecurityEvent('SUBSCRIPTION_ACTIVATED_FROM_PAYMENT', {
        userEmail: user.email,
        planId: `price_${planId}`,
        sessionId
      });

    } catch (error) {
      console.error('Error updating subscription after payment:', error);
      logSecurityEvent('SUBSCRIPTION_UPDATE_ERROR_AFTER_PAYMENT', {
        error: error.message,
        userEmail: user?.email
      });
    } finally {
      setIsUpdatingSubscription(false);
    }
  };

  const handleContinue = () => {
    // Force a page refresh to ensure all components have updated feature access
    window.location.href = '/dashboard';
  };

  const handleViewBilling = () => {
    navigate('/settings');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Processing your payment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-8 text-center"
      >
        {/* Success Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <RiCheckLine className="h-8 w-8 text-white" />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold text-white mb-4"
        >
          Payment Successful!
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-gray-300 mb-6"
        >
          🎉 Welcome to {planDetails?.name}! Your subscription has been activated and you now have immediate access to all premium features.
        </motion.p>

        {/* Subscription Update Status */}
        {isUpdatingSubscription && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 p-3 bg-blue-900/30 border border-blue-700 rounded-lg"
          >
            <div className="flex items-center justify-center text-blue-300">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400 mr-2"></div>
              Activating your premium features...
            </div>
          </motion.div>
        )}

        {/* Success Status */}
        {subscriptionUpdated && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 p-3 bg-green-900/30 border border-green-700 rounded-lg"
          >
            <div className="flex items-center justify-center text-green-300">
              <RiCheckLine className="h-4 w-4 mr-2" />
              Premium features activated successfully!
            </div>
          </motion.div>
        )}

        {/* Plan Details */}
        {planDetails && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gray-700 rounded-lg p-4 mb-6 text-left"
          >
            <h3 className="text-white font-semibold mb-2">Your Active Plan</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-400">Plan:</div>
                <div className="text-white font-medium">{planDetails.name}</div>
              </div>
              <div>
                <div className="text-gray-400">Price:</div>
                <div className="text-white font-medium">£{planDetails.price}/month</div>
              </div>
              <div>
                <div className="text-gray-400">Status:</div>
                <div className="text-green-400 font-medium">✅ Active</div>
              </div>
              <div>
                <div className="text-gray-400">Next Billing:</div>
                <div className="text-white font-medium">
                  {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB')}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Plan Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-6"
        >
          <h3 className="text-blue-400 font-semibold mb-2">🚀 Now Available:</h3>
          <ul className="text-blue-300 text-sm space-y-1 text-left">
            {planDetails?.features.slice(0, 4).map((feature, index) => (
              <li key={index} className="flex items-center">
                <RiCheckLine className="h-4 w-4 mr-2 text-green-400" />
                {feature}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="space-y-3"
        >
          <button
            onClick={handleContinue}
            className="w-full py-3 px-6 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors flex items-center justify-center"
          >
            <RiStarLine className="h-5 w-5 mr-2" />
            Start Using Premium Features
            <RiArrowRightLine className="h-5 w-5 ml-2" />
          </button>
          <button
            onClick={handleViewBilling}
            className="w-full py-2 px-6 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
          >
            Manage Subscription
          </button>
        </motion.div>

        {/* Auto-redirect notice */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-6 p-3 bg-gray-700 rounded-lg"
        >
          <div className="flex items-center justify-center text-gray-300 text-sm">
            <RiRefreshLine className="h-4 w-4 mr-2" />
            The app will refresh to activate all features when you continue
          </div>
        </motion.div>

        {/* Support Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-8 pt-6 border-t border-gray-700"
        >
          <p className="text-gray-400 text-sm">
            Need help? Contact our support team at{' '}
            <a
              href="mailto:support@trackio.com"
              className="text-primary-400 hover:text-primary-300"
            >
              support@trackio.com
            </a>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}