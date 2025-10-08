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
  const [debugInfo, setDebugInfo] = useState({});

  useEffect(() => {
    const handlePaymentSuccess = async () => {
      try {
        const planId = searchParams.get('plan');
        const sessionId = searchParams.get('session_id');
        const paymentStatus = searchParams.get('payment_status');
        const source = searchParams.get('source');
        
        // Enhanced debugging information
        const debugData = {
          planId, 
          sessionId, 
          paymentStatus,
          source,
          userEmail: user?.email,
          allParams: Object.fromEntries(searchParams.entries()),
          referrer: document.referrer,
          timestamp: new Date().toISOString(),
          pendingPayment: JSON.parse(localStorage.getItem('pendingPayment') || 'null'),
          sessionStorage: {
            stripePaymentAttempt: sessionStorage.getItem('stripePaymentAttempt'),
            paymentPlanId: sessionStorage.getItem('paymentPlanId'),
            paymentUserEmail: sessionStorage.getItem('paymentUserEmail')
          }
        };
        
        setDebugInfo(debugData);
        
        console.log('🎉 PaymentSuccess page loaded with enhanced data:', debugData);

        if (!user?.email) {
          setError('User not authenticated. Please log in and try again.');
          setLoading(false);
          return;
        }

        // Determine plan details with fallbacks
        const finalPlanId = planId || 
                           debugData.pendingPayment?.planId || 
                           debugData.sessionStorage.paymentPlanId || 
                           'professional';
        
        const plan = SUBSCRIPTION_PLANS[finalPlanId] || SUBSCRIPTION_PLANS.professional;
        setPlanDetails(plan);

        logSecurityEvent('PAYMENT_SUCCESS_PAGE_VIEW', {
          planId: finalPlanId,
          userEmail: user.email,
          sessionId,
          paymentStatus,
          source,
          debugData
        });

        // **ENHANCED**: Process payment return and activate subscription
        await processPaymentReturn(finalPlanId, sessionId, paymentStatus, source);
        
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

  const processPaymentReturn = async (planId, sessionId, paymentStatus, source) => {
    try {
      setIsUpdatingSubscription(true);
      setError('');

      console.log('🔄 Processing payment return for subscription activation...', {
        planId,
        sessionId,
        paymentStatus,
        source,
        userEmail: user.email
      });

      // **STEP 1**: Use the enhanced post-payment handler
      const postPaymentResult = await handlePostPaymentReturn(searchParams, user.email);
      
      if (postPaymentResult.success) {
        console.log('✅ Post-payment processing successful:', postPaymentResult);
        setSubscriptionUpdated(true);
        
        // **ADDITIONAL**: Force immediate feature refresh
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('forceFeatureRefresh', {
            detail: {
              userEmail: user.email,
              planId,
              immediate: true,
              source: 'payment_success_force_refresh'
            }
          }));
        }, 1000);
        
        return;
      }

      // **STEP 2**: Enhanced fallback - Direct subscription update with retries
      console.log('⚠️ Post-payment handler failed, using enhanced direct subscription update...');
      
      let updateSuccess = false;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (!updateSuccess && attempts < maxAttempts) {
        try {
          attempts++;
          console.log(`🔄 Subscription update attempt ${attempts}/${maxAttempts}...`);
          
          await updateUserSubscription(user.email, planId, sessionId || `cs_manual_${Date.now()}_${attempts}`);
          updateSuccess = true;
          console.log('✅ Subscription updated successfully');
          
        } catch (updateError) {
          console.warn(`⚠️ Subscription update attempt ${attempts} failed:`, updateError);
          
          if (attempts === maxAttempts) {
            throw updateError;
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }

      // **STEP 3**: Enhanced cache clearing
      const cacheKeys = [
        `featureCache_${user.email}`,
        `subscriptionCache_${user.email}`,
        `planLimits_${user.email}`,
        `userSubscription_${user.email}`,
        'pendingPayment',
        'stripePaymentAttempt',
        'paymentPlanId',
        'paymentUserEmail',
        'routeCache',
        'componentCache'
      ];
      
      cacheKeys.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      
      // **STEP 4**: Enhanced event dispatching
      const updateEvents = [
        'subscriptionUpdated',
        'refreshFeatureAccess',
        'planChanged',
        'userUpgraded',
        'forceAppRefresh',
        'subscriptionActivated'
      ];

      updateEvents.forEach((eventName, index) => {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent(eventName, {
            detail: { 
              userEmail: user.email, 
              planId,
              sessionId: sessionId || `cs_manual_${Date.now()}`,
              immediate: true,
              source: 'payment_success_page',
              timestamp: Date.now(),
              attempt: attempts
            }
          }));
        }, index * 200); // Stagger events
      });

      setSubscriptionUpdated(true);

      logSecurityEvent('SUBSCRIPTION_ACTIVATED_FROM_PAYMENT', {
        userEmail: user.email,
        planId: `price_${planId}`,
        sessionId,
        method: 'enhanced_direct_update',
        attempts,
        source
      });

    } catch (error) {
      console.error('❌ Error processing payment return:', error);
      setError(`Failed to activate subscription: ${error.message}`);
      
      // **FALLBACK**: Show manual activation option
      setError(
        `Subscription activation in progress... If features don't appear immediately, please refresh the page or contact support.\n\n` +
        `Error details: ${error.message}`
      );
      
      logSecurityEvent('SUBSCRIPTION_UPDATE_ERROR_AFTER_PAYMENT', {
        error: error.message,
        userEmail: user?.email,
        planId,
        sessionId,
        source
      });
    } finally {
      setIsUpdatingSubscription(false);
    }
  };

  const handleContinue = () => {
    console.log('🔄 Redirecting to dashboard with complete app refresh...');
    
    // **ENHANCED**: Multiple refresh strategies
    
    // Strategy 1: Clear all possible caches
    const allCacheKeys = Object.keys(localStorage).concat(Object.keys(sessionStorage));
    allCacheKeys.forEach(key => {
      if (key.includes('Cache') || key.includes('cache') || key.includes('feature') || key.includes('subscription')) {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      }
    });
    
    // Strategy 2: Force multiple feature refresh events
    const refreshEvents = ['refreshFeatureAccess', 'forceFeatureRefresh', 'subscriptionActivated'];
    refreshEvents.forEach((event, index) => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent(event, {
          detail: {
            source: 'payment_success_continue',
            immediate: true,
            force: true,
            userEmail: user?.email,
            timestamp: Date.now()
          }
        }));
      }, index * 100);
    });
    
    // Strategy 3: Use window.location.href for complete refresh
    setTimeout(() => {
      window.location.href = '/#/dashboard?subscription_activated=true&timestamp=' + Date.now();
    }, 500);
  };

  const handleRefreshPage = () => {
    console.log('🔄 Manual page refresh requested');
    window.location.reload();
  };

  const handleViewBilling = () => {
    navigate('/settings');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-400 mb-2">Processing your payment confirmation...</p>
          <p className="text-gray-500 text-sm mb-4">Activating premium features...</p>
          
          {/* Debug info for troubleshooting */}
          {Object.keys(debugInfo).length > 0 && (
            <details className="text-left text-xs text-gray-600 mt-4 bg-gray-800 p-3 rounded">
              <summary className="cursor-pointer text-gray-400 mb-2">Debug Information</summary>
              <pre className="whitespace-pre-wrap overflow-auto max-h-32">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          )}
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
          <h1 className="text-2xl font-bold text-white mb-4">Payment Processing</h1>
          <p className="text-gray-300 mb-6 whitespace-pre-line">{error}</p>
          <div className="space-y-3">
            <button
              onClick={handleRefreshPage}
              className="w-full py-3 px-6 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors flex items-center justify-center"
            >
              <RiRefreshLine className="h-5 w-5 mr-2" />
              Refresh Page
            </button>
            <button
              onClick={() => window.location.href = '/#/dashboard'}
              className="w-full py-2 px-6 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
            >
              Continue to Dashboard
            </button>
            <button
              onClick={() => window.location.href = '/#/pricing'}
              className="w-full py-2 px-6 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 transition-colors"
            >
              Back to Pricing
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
          
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleViewBilling}
              className="py-2 px-4 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors text-sm"
            >
              Manage Billing
            </button>
            <button
              onClick={handleRefreshPage}
              className="py-2 px-4 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors text-sm flex items-center justify-center"
            >
              <RiRefreshLine className="h-4 w-4 mr-1" />
              Refresh
            </button>
          </div>
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
          <p className="text-gray-500 text-xs mt-2">
            💡 If premium features don't appear immediately, try refreshing the page
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}