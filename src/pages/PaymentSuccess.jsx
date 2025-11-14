import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as RiIcons from 'react-icons/ri';
import SafeIcon from '../common/SafeIcon';
import { useAuth } from '../context/AuthContext';
import { SUBSCRIPTION_PLANS, getPlanById } from '../lib/stripe';

const { RiCheckboxCircleFill, RiArrowRightLine, RiHomeLine, RiErrorWarningLine } = RiIcons;

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [subscriptionData, setSubscriptionData] = useState(null);
  const { user, loading: authLoading } = useAuth();

  // SECURE: Fetch subscription status from backend only
  const fetchSubscriptionStatus = async (retryCount = 0) => {
    if (!user?.email) {
      console.log('⚠️ No user email available for subscription check');
      return null;
    }

    try {
      console.log(`🔍 Fetching subscription status (attempt ${retryCount + 1})...`);
      
      // Call backend endpoint to get current subscription
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

      if (data.subscription) {
        return {
          success: true,
          subscription: data.subscription,
          customer: data.customer,
          activated: true
        };
      }

      // If no subscription yet, maybe webhook hasn't processed
      if (retryCount < 6) { // Try for up to 60 seconds
        console.log(`⏳ No subscription found yet, retrying in 10 seconds... (${retryCount + 1}/6)`);
        await new Promise(resolve => setTimeout(resolve, 10000));
        return fetchSubscriptionStatus(retryCount + 1);
      }

      return {
        success: false,
        message: 'Subscription not found after waiting. It may take a few more minutes to activate.',
        stillProcessing: true
      };

    } catch (err) {
      console.error('❌ Error fetching subscription:', err);
      
      // Retry on network errors
      if (retryCount < 3 && (err.name === 'TypeError' || err.message.includes('fetch'))) {
        console.log(`🔄 Network error, retrying in 5 seconds... (${retryCount + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        return fetchSubscriptionStatus(retryCount + 1);
      }

      return {
        success: false,
        error: err.message,
        stillProcessing: retryCount < 3
      };
    }
  };

  useEffect(() => {
    const processPaymentReturn = async () => {
      try {
        console.log('🎉 Payment Success page loaded');
        
        // Wait for auth to be checked
        if (authLoading) {
          console.log('⏳ Waiting for auth check...');
          return;
        }

        // SECURE: Only use URL params for display purposes, not for activation
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        
        // Get display info from URL (informational only)
        const planId = hashParams.get('plan') || urlParams.get('plan') || 'professional';
        const sessionId = hashParams.get('session_id') || urlParams.get('session_id');
        
        console.log('📋 URL parameters (display only):', { planId, sessionId });

        if (!user?.email) {
          console.log('👤 User not logged in, showing login prompt');
          setResult({
            success: true,
            planId,
            sessionId,
            activated: false,
            requiresLogin: true
          });
          setIsProcessing(false);
          return;
        }

        // SECURE: Fetch actual subscription status from backend
        const subscriptionResult = await fetchSubscriptionStatus();
        
        if (subscriptionResult?.success && subscriptionResult.subscription) {
          console.log('✅ Subscription confirmed by backend');
          setSubscriptionData(subscriptionResult.subscription);
          setResult({
            success: true,
            planId: subscriptionResult.subscription.price?.lookup_key || planId,
            sessionId,
            activated: true,
            subscription: subscriptionResult.subscription
          });
        } else if (subscriptionResult?.stillProcessing) {
          console.log('⏳ Subscription still processing');
          setResult({
            success: true,
            planId,
            sessionId,
            activated: false,
            processing: true,
            message: subscriptionResult.message || 'Your subscription is being activated...'
          });
        } else {
          console.log('⚠️ Subscription not found, but payment was successful');
          setResult({
            success: true,
            planId,
            sessionId,
            activated: false,
            message: 'Payment successful! Your subscription will be activated within a few minutes.',
            fallback: true
          });
        }

      } catch (err) {
        console.error('❌ Error processing payment success:', err);
        // Show success anyway since we're on the success page
        setResult({
          success: true,
          planId: searchParams.get('plan') || 'professional',
          sessionId: searchParams.get('session_id'),
          activated: false,
          error: err.message,
          fallback: true
        });
      } finally {
        setIsProcessing(false);
      }
    };

    // Process payment when auth is ready
    if (!authLoading) {
      const timer = setTimeout(processPaymentReturn, 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams, user, authLoading]);

  // Force navigation using hash (the method that works)
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

  const planId = searchParams.get('plan') || result?.planId || 'professional';
  const plan = getPlanById(planId) || SUBSCRIPTION_PLANS.professional;

  // Show loading while auth is being checked
  if (authLoading || isProcessing) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {authLoading ? 'Checking Authentication...' : 'Verifying Your Subscription'}
          </h2>
          <p className="text-gray-400">
            {authLoading ? 'Verifying your account...' : 'Confirming payment with our secure backend...'}
          </p>
          <div className="mt-4 text-sm text-gray-500">
            <p>🔒 Validating subscription status securely</p>
            <p>⏳ This may take up to 60 seconds</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !result) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-6 mb-6">
            <SafeIcon icon={RiErrorWarningLine} className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-300 mb-2">
              Verification Issue
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
            Welcome to {plan.name}! {result?.activated ? 'Your subscription is now active.' : 'Your subscription is being activated.'}
          </motion.p>

          {/* Show status messages */}
          {result?.requiresLogin && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="bg-yellow-900/50 border border-yellow-700 rounded-lg p-4 mb-6"
            >
              <p className="text-yellow-200 text-sm">
                Please log in to complete your subscription setup and access all features.
              </p>
            </motion.div>
          )}

          {result?.processing && (
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
                {result.message || 'This usually takes 30-60 seconds. Please wait...'}
              </p>
            </motion.div>
          )}

          {result?.fallback && !result?.processing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="bg-blue-900/50 border border-blue-700 rounded-lg p-4 mb-6"
            >
              <p className="text-blue-200 text-sm">
                {result.message || 'Your payment was processed successfully. If you don\'t see your subscription immediately, it will be activated within a few minutes.'}
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
                result?.activated ? 'text-green-400' : 
                result?.processing ? 'text-yellow-400' : 'text-blue-400'
              }`}>
                {result?.processing && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400 mr-2"></div>
                )}
                {result?.activated ? 'Active' : 
                 result?.processing ? 'Activating...' : 'Pending Activation'}
              </span>
            </div>

            {/* Show subscription details if available */}
            {subscriptionData && (
              <>
                <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                  <span className="text-gray-300">Subscription ID:</span>
                  <span className="text-gray-400 text-sm font-mono">
                    {subscriptionData.id?.substring(0, 20)}...
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Next Billing:</span>
                  <span className="text-gray-300 text-sm">
                    {subscriptionData.current_period_end ? 
                      new Date(subscriptionData.current_period_end * 1000).toLocaleDateString() :
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
          {result?.requiresLogin ? (
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
            {result?.activated ? 
              'Ready to start using your new subscription features!' :
              'Your subscription will be ready shortly!'
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
              🔒 Your subscription status is verified securely with our backend systems
            </p>
            <p className="text-gray-500 text-xs mt-1">
              All payment processing is handled by Stripe's secure infrastructure
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}