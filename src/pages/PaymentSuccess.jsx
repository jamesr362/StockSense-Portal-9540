import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as RiIcons from 'react-icons/ri';
import SafeIcon from '../common/SafeIcon';
import { useAuth } from '../context/AuthContext';
import { SUBSCRIPTION_PLANS } from '../lib/stripe';
import { 
  getSubscriptionByStripeId, 
  refreshSubscriptionData, 
  clearUserCache,
  verifySubscriptionUpdate 
} from '../services/subscriptionService';

const { RiCheckboxCircleFill, RiArrowRightLine, RiHomeLine, RiErrorWarningLine } = RiIcons;

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState('loading');
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const verifyPayment = async () => {
      if (!user?.email) {
        console.log('No user found, redirecting to login');
        navigate('/login');
        return;
      }

      try {
        console.log('🔍 Verifying payment success...');
        
        // Get parameters from URL
        const sessionId = searchParams.get('session_id');
        const subscriptionId = searchParams.get('subscription_id');
        
        console.log('URL Parameters:', { sessionId, subscriptionId });

        // Clear all caches first
        clearUserCache(user.email);

        let subscription = null;
        let retryCount = 0;
        const maxRetries = 10;
        const retryDelay = 2000; // 2 seconds

        // Retry logic for fetching subscription
        while (!subscription && retryCount < maxRetries) {
          console.log(`🔄 Attempt ${retryCount + 1}/${maxRetries} to fetch subscription...`);
          
          try {
            if (subscriptionId) {
              // Primary method: Use Stripe Subscription ID from URL
              console.log('🔍 Fetching subscription by Stripe ID:', subscriptionId);
              subscription = await getSubscriptionByStripeId(subscriptionId);
            } else {
              // Fallback: Refresh subscription data by email
              console.log('🔍 Refreshing subscription data by email:', user.email);
              const result = await refreshSubscriptionData(user.email);
              subscription = result?.subscription;
            }

            if (subscription) {
              console.log('✅ Subscription found:', subscription);
              break;
            } else {
              console.log(`⏳ No subscription found, retrying in ${retryDelay}ms...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              retryCount++;
            }
          } catch (err) {
            console.error(`❌ Error in attempt ${retryCount + 1}:`, err);
            retryCount++;
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
          }
        }

        if (subscription && subscription.status === 'active') {
          console.log('✅ Active subscription verified:', subscription);
          
          setSubscriptionData(subscription);
          setSubscriptionStatus('success');

          // Comprehensive cache clearing and event dispatching
          console.log('🧹 Clearing caches and dispatching events...');
          
          // Clear localStorage caches
          try {
            Object.keys(localStorage).forEach(key => {
              if (key.includes('subscription') || key.includes('feature') || key.includes('plan')) {
                localStorage.removeItem(key);
              }
            });
          } catch (e) {
            console.warn('Error clearing localStorage:', e);
          }

          // Dispatch multiple events for different components
          const eventTypes = [
            'subscriptionUpdated',
            'refreshFeatureAccess',
            'planChanged',
            'userUpgraded',
            'paymentSuccessful',
            'forceSubscriptionSync',
            'globalDataRefresh'
          ];

          eventTypes.forEach(eventType => {
            try {
              window.dispatchEvent(new CustomEvent(eventType, {
                detail: {
                  userEmail: user.email,
                  subscription: subscription,
                  planId: subscription.planId,
                  status: subscription.status,
                  force: true,
                  immediate: true,
                  timestamp: Date.now()
                }
              }));
              console.log(`📡 ${eventType} event dispatched`);
            } catch (e) {
              console.warn(`Error dispatching ${eventType}:`, e);
            }
          });

          // Force a final refresh after a short delay
          setTimeout(() => {
            refreshSubscriptionData(user.email);
          }, 1000);

        } else {
          console.warn('⚠️ No active subscription found after all retries');
          setSubscriptionStatus('pending');
          setError('Subscription verification is still in progress. Please check your account in a few minutes.');
        }

      } catch (err) {
        console.error('❌ Error verifying payment:', err);
        setError(err.message);
        setSubscriptionStatus('error');
      }
    };

    verifyPayment();
  }, [user, searchParams, navigate]);

  const getPlanInfo = () => {
    if (!subscriptionData?.planId) return SUBSCRIPTION_PLANS.free;
    
    // Extract plan from planId (e.g., "price_professional" -> "professional")
    if (subscriptionData.planId.includes('professional')) {
      return SUBSCRIPTION_PLANS.professional;
    }
    return SUBSCRIPTION_PLANS.free;
  };

  const handleContinue = () => {
    // Navigate to dashboard with a refresh flag
    navigate('/dashboard?upgraded=true', { replace: true });
  };

  const handleGoHome = () => {
    navigate('/', { replace: true });
  };

  if (subscriptionStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center"
        >
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Verifying Payment</h2>
          <p className="text-gray-600">Please wait while we confirm your subscription...</p>
        </motion.div>
      </div>
    );
  }

  if (subscriptionStatus === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center"
        >
          <SafeIcon icon={RiErrorWarningLine} className="text-6xl text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Payment Verification Failed</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={handleGoHome}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Go Home
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (subscriptionStatus === 'pending') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-orange-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center"
        >
          <SafeIcon icon={RiErrorWarningLine} className="text-6xl text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Payment Processing</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={handleContinue}
              className="w-full bg-yellow-600 text-white py-3 rounded-lg font-medium hover:bg-yellow-700 transition-colors"
            >
              Continue to Dashboard
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Refresh
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const planInfo = getPlanInfo();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        >
          <SafeIcon icon={RiCheckboxCircleFill} className="text-6xl text-green-500 mx-auto mb-4" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Payment Successful!</h1>
          <p className="text-gray-600 mb-6">
            Welcome to {planInfo.name}! Your subscription is now active.
          </p>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-green-800 mb-2">What's included:</h3>
            <ul className="text-sm text-green-700 space-y-1">
              {planInfo.features.map((feature, index) => (
                <li key={index} className="flex items-center">
                  <SafeIcon icon={RiCheckboxCircleFill} className="text-green-500 mr-2 text-xs" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleContinue}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
            >
              Continue to Dashboard
              <SafeIcon icon={RiArrowRightLine} className="ml-2" />
            </button>
            
            <button
              onClick={handleGoHome}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center"
            >
              <SafeIcon icon={RiHomeLine} className="mr-2" />
              Go Home
            </button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default PaymentSuccess;