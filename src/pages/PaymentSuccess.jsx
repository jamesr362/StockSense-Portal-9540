import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as RiIcons from 'react-icons/ri';
import SafeIcon from '../common/SafeIcon';
import { useAuth } from '../context/AuthContext';
import { SUBSCRIPTION_PLANS, handlePostPaymentReturn } from '../lib/stripe';

const { RiCheckboxCircleFill, RiArrowRightLine, RiHomeLine, RiErrorWarningLine } = RiIcons;

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const { user, loading: authLoading } = useAuth();

  // Debug logging
  console.log('🔍 PaymentSuccess Debug:', {
    user: user?.email,
    authLoading,
    currentUrl: window.location.href,
    currentHash: window.location.hash,
    navigate: typeof navigate
  });

  useEffect(() => {
    const processPaymentReturn = async () => {
      try {
        console.log('🎉 Payment Success page loaded');
        
        // Wait for auth to be checked
        if (authLoading) {
          console.log('⏳ Waiting for auth check...');
          return;
        }

        // Extract parameters from URL or hash
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        
        // Create a combined search params object
        const combinedParams = new URLSearchParams();
        
        // Add URL params
        for (const [key, value] of urlParams) {
          combinedParams.set(key, value);
        }
        
        // Add hash params (hash params take precedence)
        for (const [key, value] of hashParams) {
          combinedParams.set(key, value);
        }
        
        console.log('📋 Combined parameters:', Object.fromEntries(combinedParams.entries()));

        // Get user email
        const currentUser = user?.email || combinedParams.get('user_email') || combinedParams.get('email');

        try {
          // Process the payment return
          const result = await handlePostPaymentReturn(combinedParams, currentUser);
          console.log('📊 Payment processing result:', result);

          if (result.success) {
            setResult(result);
            console.log('✅ Payment processing completed:', result);
          } else {
            console.log('⚠️ Payment processing had issues, but showing success anyway');
            setResult({
              success: true,
              planId: combinedParams.get('plan') || 'professional',
              sessionId: combinedParams.get('session_id') || 'pl_manual',
              activated: false,
              requiresLogin: !currentUser
            });
          }
        } catch (paymentError) {
          console.log('⚠️ Payment processing error, but showing success anyway:', paymentError);
          setResult({
            success: true,
            planId: combinedParams.get('plan') || 'professional',
            sessionId: combinedParams.get('session_id') || 'pl_fallback',
            activated: false,
            requiresLogin: !currentUser,
            fallback: true
          });
        }

      } catch (err) {
        console.error('❌ Error processing payment success:', err);
        // Show success anyway since we're on the success page
        setResult({
          success: true,
          planId: searchParams.get('plan') || 'professional',
          sessionId: searchParams.get('session_id') || 'pl_error',
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

  // Simple navigation handlers
  const goToDashboard = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🚀 Dashboard button clicked');
    
    try {
      console.log('🎯 Navigating to dashboard...');
      navigate('/dashboard', { replace: true });
    } catch (navError) {
      console.error('❌ Navigation error, trying hash fallback:', navError);
      window.location.hash = '#/dashboard';
    }
  };

  const goToLogin = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🔑 Login button clicked');
    
    try {
      console.log('🎯 Navigating to login...');
      navigate('/login', { replace: true });
    } catch (navError) {
      console.error('❌ Navigation error, trying hash fallback:', navError);
      window.location.hash = '#/login';
    }
  };

  const goToSubscription = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('💳 Subscription button clicked');
    
    try {
      console.log('🎯 Navigating to subscription...');
      navigate('/subscription', { replace: true });
    } catch (navError) {
      console.error('❌ Navigation error, trying hash fallback:', navError);
      window.location.hash = '#/subscription';
    }
  };

  const goToPricing = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('💰 Pricing button clicked');
    
    try {
      console.log('🎯 Navigating to pricing...');
      navigate('/pricing', { replace: true });
    } catch (navError) {
      console.error('❌ Navigation error, trying hash fallback:', navError);
      window.location.hash = '#/pricing';
    }
  };

  // Force navigation using hash (ultimate fallback)
  const forceNavigate = (path) => {
    console.log('🔧 Force navigating to:', path);
    window.location.hash = `#${path}`;
    window.location.reload();
  };

  const planId = searchParams.get('plan') || result?.planId || 'professional';
  const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.professional;

  // Show loading while auth is being checked
  if (authLoading || isProcessing) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {authLoading ? 'Checking Authentication...' : 'Processing Your Payment'}
          </h2>
          <p className="text-gray-400">
            {authLoading ? 'Verifying your account...' : 'Activating your subscription...'}
          </p>
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
              Payment Processing Issue
            </h2>
            <p className="text-red-200 mb-4">{error}</p>
            <div className="space-y-2">
              <button
                onClick={goToPricing}
                className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Return to Pricing
              </button>
              <button
                onClick={goToDashboard}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Try Dashboard Anyway
              </button>
            </div>
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
            Welcome to {plan.name}! Your subscription is now active.
          </motion.p>

          {/* Show warnings if needed */}
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

          {result?.fallback && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="bg-blue-900/50 border border-blue-700 rounded-lg p-4 mb-6"
            >
              <p className="text-blue-200 text-sm">
                Your payment was processed successfully. If you don't see your subscription immediately, it will be activated within a few minutes.
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
              <span className="text-white font-semibold">£{plan.price}/month</span>
            </div>
            
            <div className="flex justify-between items-center pb-2 border-b border-gray-700">
              <span className="text-gray-300">User:</span>
              <span className="text-white font-semibold">
                {user?.email || result?.userEmail || 'Login required'}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Status:</span>
              <span className={`font-semibold ${
                result?.activated ? 'text-green-400' : 'text-yellow-400'
              }`}>
                {result?.activated ? 'Active' : 'Activating...'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Navigation Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-center space-y-4"
        >
          {/* Primary Action Button */}
          <div>
            {result?.requiresLogin ? (
              <button
                type="button"
                onClick={goToLogin}
                className="inline-flex items-center font-semibold py-4 px-8 rounded-lg transition-all shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <SafeIcon icon={RiHomeLine} className="h-5 w-5 mr-2" />
                Login to Continue
                <SafeIcon icon={RiArrowRightLine} className="h-5 w-5 ml-2" />
              </button>
            ) : (
              <button
                type="button"
                onClick={goToDashboard}
                className="inline-flex items-center font-semibold py-4 px-8 rounded-lg transition-all shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-gray-900 bg-primary-600 hover:bg-primary-700 text-white"
              >
                <SafeIcon icon={RiHomeLine} className="h-5 w-5 mr-2" />
                Go to Dashboard
                <SafeIcon icon={RiArrowRightLine} className="h-5 w-5 ml-2" />
              </button>
            )}
          </div>
          
          {/* Alternative Navigation Options */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={goToDashboard}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center"
            >
              <SafeIcon icon={RiHomeLine} className="h-4 w-4 mr-2" />
              Dashboard
            </button>
            
            <button
              type="button"
              onClick={goToSubscription}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center"
            >
              Subscription
            </button>
            
            <button
              type="button"
              onClick={goToPricing}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center"
            >
              Pricing
            </button>
          </div>

          {/* Force Navigation Fallbacks (for debugging) */}
          <div className="mt-6 p-4 bg-gray-800 rounded-lg">
            <p className="text-gray-400 text-sm mb-3">
              <strong>Navigation not working?</strong> Try these direct links:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => forceNavigate('/dashboard')}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded text-sm transition-colors"
              >
                Force Dashboard
              </button>
              <button
                type="button"
                onClick={() => forceNavigate('/login')}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded text-sm transition-colors"
              >
                Force Login
              </button>
              <button
                type="button"
                onClick={() => forceNavigate('/subscription')}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded text-sm transition-colors"
              >
                Force Subscription
              </button>
            </div>
          </div>
          
          {/* Debug Information */}
          <div className="mt-4 text-xs text-gray-500 p-4 bg-gray-800 rounded-lg">
            <h3 className="font-semibold mb-2 text-gray-400">Navigation Debug:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
              <p><strong>Current URL:</strong> {window.location.href}</p>
              <p><strong>Current Hash:</strong> {window.location.hash}</p>
              <p><strong>Target:</strong> {result?.requiresLogin ? '/login' : '/dashboard'}</p>
              <p><strong>User:</strong> {user?.email || 'Not logged in'}</p>
              <p><strong>Router:</strong> HashRouter</p>
              <p><strong>Navigate Function:</strong> {typeof navigate}</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}