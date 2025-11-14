import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as RiIcons from 'react-icons/ri';
import SafeIcon from '../common/SafeIcon';
import { useAuth } from '../context/AuthContext';
import { SUBSCRIPTION_PLANS, getPlanById } from '../lib/stripe';

const { RiCheckboxCircleFill, RiArrowRightLine, RiHomeLine, RiErrorWarningLine, RiTimeLine } = RiIcons;

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const [isChecking, setIsChecking] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const { user, loading: authLoading } = useAuth();

  // ENHANCED: Check subscription status from backend
  const checkSubscriptionStatus = async (attempt = 1) => {
    if (!user?.email) {
      console.log('⚠️ No user email available for subscription check');
      return null;
    }

    try {
      console.log(`🔍 Checking subscription status (attempt ${attempt})...`);
      
      const response = await fetch('/.netlify/functions/get-customer-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email
        })
      });

      if (!response.ok) {
        throw new Error(`Backend responded with ${response.status}`);
      }

      const data = await response.json();
      console.log('📊 Backend subscription data:', data);

      if (data.subscription && data.subscription.status === 'active') {
        // Map Stripe subscription to internal format
        const internalPlan = mapStripeSubscriptionToPlan(data.subscription);
        
        return {
          success: true,
          subscription: data.subscription,
          customer: data.customer,
          planId: internalPlan,
          activated: true
        };
      }

      // If no active subscription found, maybe webhook is still processing
      if (attempt <= 12) { // Try for up to 2 minutes (12 attempts * 10 seconds)
        console.log(`⏳ No active subscription found yet, retrying in 10 seconds... (${attempt}/12)`);
        await new Promise(resolve => setTimeout(resolve, 10000));
        return checkSubscriptionStatus(attempt + 1);
      }

      return {
        success: false,
        message: 'Subscription activation is taking longer than expected. Please check your dashboard in a few minutes.',
        stillProcessing: true
      };

    } catch (err) {
      console.error('❌ Error checking subscription:', err);
      
      // Retry on network errors
      if (attempt <= 3 && (err.name === 'TypeError' || err.message.includes('fetch'))) {
        console.log(`🔄 Network error, retrying in 5 seconds... (${attempt}/3)`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        return checkSubscriptionStatus(attempt + 1);
      }

      return {
        success: false,
        error: err.message,
        stillProcessing: attempt <= 3
      };
    }
  };

  // Map Stripe subscription data to internal plan format
  const mapStripeSubscriptionToPlan = (subscription) => {
    if (!subscription || !subscription.items || !subscription.items.data || subscription.items.data.length === 0) {
      return 'free';
    }

    const priceId = subscription.items.data[0].price?.id;
    const lookupKey = subscription.items.data[0].price?.lookup_key;

    // Use lookup key first if available
    if (lookupKey) {
      if (lookupKey.includes('professional') || lookupKey.includes('pro')) {
        return 'professional';
      }
      if (lookupKey.includes('free') || lookupKey.includes('basic')) {
        return 'free';
      }
    }

    // Fallback to price ID mapping
    if (priceId) {
      // Map your actual Stripe price IDs here
      const priceIdMap = {
        'price_1RxEcJEw1FLYKy8h3FDMZ6QP': 'professional',
        'price_professional': 'professional',
        'price_free': 'free'
      };

      if (priceIdMap[priceId]) {
        return priceIdMap[priceId];
      }

      // Pattern matching
      if (priceId.includes('professional') || priceId.includes('pro')) {
        return 'professional';
      }
    }

    // Default for active subscriptions
    return subscription.status === 'active' ? 'professional' : 'free';
  };

  useEffect(() => {
    const processPaymentSuccess = async () => {
      try {
        console.log('🎉 Payment Success page loaded');
        
        // Wait for auth to be ready
        if (authLoading) {
          console.log('⏳ Waiting for auth check...');
          return;
        }

        // Get URL parameters for display
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        
        const planId = hashParams.get('plan') || urlParams.get('plan') || 'professional';
        const sessionId = hashParams.get('session_id') || urlParams.get('session_id');
        
        console.log('📋 URL parameters:', { planId, sessionId });

        if (!user?.email) {
          console.log('👤 User not logged in');
          setSubscriptionStatus({
            success: true,
            planId,
            sessionId,
            activated: false,
            requiresLogin: true
          });
          setIsChecking(false);
          return;
        }

        // Check subscription status from backend (with retries)
        console.log('🔍 Checking subscription status from backend...');
        const result = await checkSubscriptionStatus();
        
        if (result?.success && result.activated) {
          console.log('✅ Subscription confirmed active');
          setSubscriptionStatus({
            success: true,
            planId: result.planId,
            sessionId,
            activated: true,
            subscription: result.subscription
          });

          // Clear any cached subscription data to force refresh
          const clearCaches = () => {
            const cacheKeys = [
              `featureCache_${user.email}`,
              `subscriptionCache_${user.email}`,
              `planLimits_${user.email}`,
              `subscription_${user.email}`,
              `userPlan_${user.email}`,
              `planAccess_${user.email}`
            ];
            
            cacheKeys.forEach(key => {
              try {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
              } catch (error) {
                console.warn('Error clearing cache key:', key);
              }
            });
          };

          clearCaches();

          // Dispatch events to refresh UI
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
              detail: { 
                userEmail: user.email, 
                force: true, 
                immediate: true,
                planId: result.planId,
                status: 'active'
              }
            }));

            window.dispatchEvent(new CustomEvent('refreshFeatureAccess', {
              detail: { 
                userEmail: user.email, 
                force: true, 
                immediate: true
              }
            }));
          }, 1000);

        } else if (result?.stillProcessing) {
          console.log('⏳ Subscription still processing');
          setSubscriptionStatus({
            success: true,
            planId,
            sessionId,
            activated: false,
            processing: true,
            message: result.message || 'Your subscription is being activated...'
          });
        } else {
          console.log('⚠️ Subscription not found or error occurred');
          setSubscriptionStatus({
            success: true,
            planId,
            sessionId,
            activated: false,
            message: 'Payment successful! Your subscription will be activated shortly.',
            fallback: true
          });
        }

      } catch (err) {
        console.error('❌ Error processing payment success:', err);
        setError(err.message);
      } finally {
        setIsChecking(false);
      }
    };

    // Process when auth is ready
    if (!authLoading) {
      const timer = setTimeout(processPaymentSuccess, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, authLoading, retryCount]);

  // Navigation functions
  const goToDashboard = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🚀 Going to Dashboard...');
    window.location.hash = '#/app/dashboard';
    window.location.reload();
  };

  const goToLogin = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🔑 Going to Login...');
    window.location.hash = '#/login';
    window.location.reload();
  };

  const planId = subscriptionStatus?.planId || 'professional';
  const plan = getPlanById(planId) || SUBSCRIPTION_PLANS.professional;

  // Show loading while checking
  if (authLoading || isChecking) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {authLoading ? 'Checking Authentication...' : 'Activating Your Subscription'}
          </h2>
          <p className="text-gray-400 mb-4">
            {authLoading ? 'Verifying your account...' : 'Confirming your payment and setting up your account...'}
          </p>
          <div className="bg-gray-800 rounded-lg p-4 text-sm text-gray-400">
            <p className="flex items-center justify-center mb-2">
              <SafeIcon icon={RiTimeLine} className="h-4 w-4 mr-2" />
              This usually takes 30-60 seconds
            </p>
            <p>🔒 Securely processing with Stripe webhooks</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !subscriptionStatus) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-6 mb-6">
            <SafeIcon icon={RiErrorWarningLine} className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-300 mb-2">
              Activation Issue
            </h2>
            <p className="text-red-200 mb-4">{error}</p>
            <button
              onClick={goToDashboard}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main success page
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="inline-flex items-center justify-center w-20 h-20 bg-green-500 rounded-full mb-6"
          >
            <SafeIcon icon={RiCheckboxCircleFill} className="h-12 w-12 text-white" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4xl font-bold text-white mb-4"
          >
            🎉 Payment Successful!
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl text-gray-300 mb-8"
          >
            {subscriptionStatus?.activated 
              ? `Welcome to ${plan.name}! Your subscription is now active.`
              : `Thank you for your payment! Your ${plan.name} subscription is being activated.`
            }
          </motion.p>

          {/* Status Messages */}
          {subscriptionStatus?.requiresLogin && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="bg-yellow-900/50 border border-yellow-700 rounded-lg p-4 mb-6"
            >
              <p className="text-yellow-200 text-sm">
                Please log in to access your subscription and start using all features.
              </p>
            </motion.div>
          )}

          {subscriptionStatus?.processing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="bg-blue-900/50 border border-blue-700 rounded-lg p-4 mb-6"
            >
              <div className="flex items-center justify-center mb-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400 mr-3"></div>
                <p className="text-blue-200 text-sm font-medium">Activating your subscription...</p>
              </div>
              <p className="text-blue-300 text-xs">
                {subscriptionStatus.message || 'Stripe webhooks are processing your payment. This usually takes 30-60 seconds.'}
              </p>
            </motion.div>
          )}

          {subscriptionStatus?.fallback && !subscriptionStatus?.processing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="bg-blue-900/50 border border-blue-700 rounded-lg p-4 mb-6"
            >
              <p className="text-blue-200 text-sm">
                {subscriptionStatus.message || 'Your payment was processed successfully. Your subscription will be activated within a few minutes.'}
              </p>
            </motion.div>
          )}
        </div>

        {/* Plan Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gray-800 rounded-xl p-6 mb-8"
        >
          <h2 className="text-2xl font-bold text-white mb-4 text-center">
            Subscription Summary
          </h2>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-700">
              <span className="text-gray-300">Plan:</span>
              <span className="text-white font-semibold">{plan.name}</span>
            </div>
            
            <div className="flex justify-between items-center pb-2 border-b border-gray-700">
              <span className="text-gray-300">Price:</span>
              <span className="text-white font-semibold">
                {plan.price === 0 ? 'Free' : `£${plan.price}/month`}
              </span>
            </div>
            
            <div className="flex justify-between items-center pb-2 border-b border-gray-700">
              <span className="text-gray-300">User:</span>
              <span className="text-white font-semibold">
                {user?.email || 'Login required'}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Status:</span>
              <span className={`font-semibold flex items-center ${
                subscriptionStatus?.activated ? 'text-green-400' : 
                subscriptionStatus?.processing ? 'text-yellow-400' : 'text-blue-400'
              }`}>
                {subscriptionStatus?.processing && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400 mr-2"></div>
                )}
                {subscriptionStatus?.activated ? 'Active' : 
                 subscriptionStatus?.processing ? 'Activating...' : 'Pending Activation'}
              </span>
            </div>

            {/* Show subscription details if available */}
            {subscriptionStatus?.subscription && (
              <>
                <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                  <span className="text-gray-300">Subscription ID:</span>
                  <span className="text-gray-400 text-sm font-mono">
                    {subscriptionStatus.subscription.id?.substring(0, 20)}...
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Next Billing:</span>
                  <span className="text-gray-300 text-sm">
                    {subscriptionStatus.subscription.current_period_end ? 
                      new Date(subscriptionStatus.subscription.current_period_end * 1000).toLocaleDateString() :
                      'TBD'
                    }
                  </span>
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* Navigation Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-center"
        >
          {subscriptionStatus?.requiresLogin ? (
            <button
              type="button"
              onClick={goToLogin}
              className="inline-flex items-center justify-center font-semibold py-4 px-8 rounded-lg transition-all shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 bg-blue-600 hover:bg-blue-700 text-white text-lg"
            >
              <SafeIcon icon={RiHomeLine} className="h-6 w-6 mr-3" />
              Login to Continue
              <SafeIcon icon={RiArrowRightLine} className="h-6 w-6 ml-3" />
            </button>
          ) : (
            <button
              type="button"
              onClick={goToDashboard}
              className="inline-flex items-center justify-center font-semibold py-4 px-8 rounded-lg transition-all shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-gray-900 bg-primary-600 hover:bg-primary-700 text-white text-lg"
            >
              <SafeIcon icon={RiHomeLine} className="h-6 w-6 mr-3" />
              Go to Dashboard
              <SafeIcon icon={RiArrowRightLine} className="h-6 w-6 ml-3" />
            </button>
          )}

          <p className="text-gray-400 text-sm mt-4">
            {subscriptionStatus?.activated ? 
              'Ready to start using your new subscription features!' :
              subscriptionStatus?.processing ?
              'Your subscription will be ready in just a moment!' :
              'Your subscription will be activated shortly!'
            }
          </p>
        </motion.div>

        {/* Security Notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-8 text-center"
        >
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <p className="text-gray-400 text-xs">
              🔒 Your subscription is processed securely via Stripe webhooks
            </p>
            <p className="text-gray-500 text-xs mt-1">
              No manual activation required - everything is automated and secure
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}