import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { RiCheckLine, RiArrowRightLine, RiStarLine, RiRefreshLine, RiAlertLine } from 'react-icons/ri';
import { logSecurityEvent } from '../utils/security';
import { SUBSCRIPTION_PLANS, handlePostPaymentReturn } from '../lib/stripe';
import { useAuth } from '../context/AuthContext';
import { updateUserSubscription } from '../services/subscriptionService';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [planDetails, setPlanDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUpdatingSubscription, setIsUpdatingSubscription] = useState(false);
  const [subscriptionUpdated, setSubscriptionUpdated] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handlePaymentSuccess = async () => {
      try {
        const planId = searchParams.get('plan');
        const sessionId = searchParams.get('session_id');
        const paymentStatus = searchParams.get('payment_status');
        
        console.log('🎉 PaymentSuccess page loaded:', { 
          planId, 
          sessionId, 
          paymentStatus, 
          userEmail: user?.email,
          allParams: Object.fromEntries(searchParams.entries())
        });

        if (!user?.email) {
          setError('User not authenticated. Please log in and try again.');
          setLoading(false);
          return;
        }

        // Determine plan details
        const finalPlanId = planId || 'professional';
        const plan = SUBSCRIPTION_PLANS[finalPlanId] || SUBSCRIPTION_PLANS.professional;
        setPlanDetails(plan);

        logSecurityEvent('PAYMENT_SUCCESS_PAGE_VIEW', {
          planId: finalPlanId,
          userEmail: user.email,
          sessionId,
          paymentStatus
        });

        // **ENHANCED**: Process payment return and activate subscription
        await processPaymentReturn(finalPlanId, sessionId, paymentStatus);
        
      } catch (error) {
        console.error('❌ Error handling payment success:', error);
        setError('Error processing payment confirmation. Please contact support.');
      } finally {
        setLoading(false);
      }
    };

    if (user?.email) {
      handlePaymentSuccess();
    } else {
      setLoading(false);
    }
  }, [searchParams, user?.email]);

  const processPaymentReturn = async (planId, sessionId, paymentStatus) => {
    try {
      setIsUpdatingSubscription(true);
      setError('');

      console.log('🔄 Processing payment return for subscription activation...', {
        planId,
        sessionId,
        paymentStatus,
        userEmail: user.email
      });

      // **STEP 1**: Use the enhanced post-payment handler
      const postPaymentResult = await handlePostPaymentReturn(searchParams, user.email);
      
      if (postPaymentResult.success) {
        console.log('✅ Post-payment processing successful:', postPaymentResult);
        setSubscriptionUpdated(true);
        return;
      }

      // **STEP 2**: Fallback - Direct subscription update
      console.log('⚠️ Post-payment handler failed, using direct subscription update...');
      
      await updateUserSubscription(user.email, planId, sessionId);

      // **STEP 3**: Clear all caches for immediate refresh
      localStorage.removeItem(`featureCache_${user.email}`);
      localStorage.removeItem(`subscriptionCache_${user.email}`);
      localStorage.removeItem(`planLimits_${user.email}`);
      
      // **STEP 4**: Dispatch multiple update events for maximum compatibility
      const updateEvents = [
        'subscriptionUpdated',
        'refreshFeatureAccess',
        'planChanged',
        'userUpgraded'
      ];

      updateEvents.forEach(eventName => {
        window.dispatchEvent(new CustomEvent(eventName, {
          detail: { 
            userEmail: user.email, 
            planId,
            sessionId,
            immediate: true,
            source: 'payment_success_page',
            timestamp: Date.now()
          }
        }));
      });

      setSubscriptionUpdated(true);

      logSecurityEvent('SUBSCRIPTION_ACTIVATED_FROM_PAYMENT', {
        userEmail: user.email,
        planId: `price_${planId}`,
        sessionId,
        method: 'direct_update'
      });

    } catch (error) {
      console.error('❌ Error processing payment return:', error);
      setError(`Failed to activate subscription: ${error.message}`);
      logSecurityEvent('SUBSCRIPTION_UPDATE_ERROR_AFTER_PAYMENT', {
        error: error.message,
        userEmail: user?.email
      });
    } finally {
      setIsUpdatingSubscription(false);
    }
  };

  const handleContinue = () => {
    // **ENHANCED**: Force complete app refresh to ensure all components update
    console.log('🔄 Redirecting to dashboard with full app refresh...');
    
    // Clear additional caches
    localStorage.removeItem('routeCache');
    localStorage.removeItem('componentCache');
    
    // Force refresh feature access one more time
    window.dispatchEvent(new CustomEvent('refreshFeatureAccess', {
      detail: {
        source: 'payment_success_continue',
        immediate: true,
        force: true
      }
    }));

    // Use window.location for complete refresh instead of navigate
    setTimeout(() => {
      window.location.href = '/#/dashboard';
    }, 100);
  };

  const handleViewBilling = () => {
    navigate('/settings');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Processing your payment confirmation...</p>
          <p className="text-gray-500 text-sm mt-2">Activating premium features...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-8 text-center"
        >
          <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <RiAlertLine className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Payment Processing Error</h1>
          <p className="text-gray-300 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.href = '/#/pricing'}
              className="w-full py-3 px-6 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = '/#/dashboard'}
              className="w-full py-2 px-6 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        </motion.div>
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
          Payment Successful! 🎉
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-gray-300 mb-6"
        >
          Welcome to {planDetails?.name} Plan! Your subscription has been activated and all premium features are now available.
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
            <p className="text-blue-400 text-xs mt-1">This may take a few seconds</p>
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
              🚀 Premium features activated successfully!
            </div>
            <p className="text-green-400 text-xs mt-1">All Professional features are now unlocked</p>
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
            <h3 className="text-white font-semibold mb-3 text-center">Your Active Plan</h3>
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
          className="bg-gradient-to-r from-blue-900/20 to-green-900/20 border border-blue-700 rounded-lg p-4 mb-6"
        >
          <h3 className="text-blue-400 font-semibold mb-3 text-center">🎯 Now Available:</h3>
          <ul className="text-blue-300 text-sm space-y-2 text-left">
            {planDetails?.features.slice(0, 4).map((feature, index) => (
              <li key={index} className="flex items-center">
                <RiCheckLine className="h-4 w-4 mr-2 text-green-400 flex-shrink-0" />
                {feature}
              </li>
            ))}
            {planDetails?.features.length > 4 && (
              <li className="text-gray-400 text-xs mt-2">
                + {planDetails.features.length - 4} more premium features
              </li>
            )}
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

        {/* Auto-refresh notice */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-6 p-3 bg-gray-700 rounded-lg"
        >
          <div className="flex items-center justify-center text-gray-300 text-sm">
            <RiRefreshLine className="h-4 w-4 mr-2" />
            The app will refresh completely to ensure all premium features are activated
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
            Need help? Contact support at{' '}
            <a
              href="mailto:support@trackio.com"
              className="text-primary-400 hover:text-primary-300 transition-colors"
            >
              support@trackio.com
            </a>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}