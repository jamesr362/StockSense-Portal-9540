import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as RiIcons from 'react-icons/ri';
import SafeIcon from '../common/SafeIcon';
import { useAuth } from '../context/AuthContext';
import { SUBSCRIPTION_PLANS, handlePostPaymentReturn } from '../lib/stripe';

const { RiCheckboxCircleFill, RiArrowRightLine, RiRefreshLine, RiHomeLine, RiErrorWarningLine } = RiIcons;

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [urlDebug, setUrlDebug] = useState({});
  const { user, loading: authLoading } = useAuth();

  // Parse and clean URL parameters
  useEffect(() => {
    const currentUrl = window.location.href;
    const cleanUrl = currentUrl.replace(/%3C\/code%3E/g, ''); // Remove malformed HTML encoding
    
    // Parse parameters from both URL and hash
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    
    const debugInfo = {
      originalUrl: currentUrl,
      cleanUrl,
      urlParams: Object.fromEntries(urlParams.entries()),
      hashParams: Object.fromEntries(hashParams.entries()),
      hasSessionId: urlParams.has('session_id') || hashParams.has('session_id'),
      hasPaymentStatus: urlParams.has('payment_status') || hashParams.has('payment_status'),
      hasPlan: urlParams.has('plan') || hashParams.has('plan')
    };
    
    setUrlDebug(debugInfo);
    console.log('🔍 URL Debug Info:', debugInfo);
    
    // If URL is malformed, try to clean it
    if (currentUrl.includes('%3C/code%3E') && !window.location.href.includes('cleaned=true')) {
      console.log('🧹 Cleaning malformed URL...');
      const cleanedUrl = cleanUrl + (cleanUrl.includes('?') ? '&' : '?') + 'cleaned=true';
      window.location.href = cleanedUrl;
      return;
    }
  }, []);

  // Debug logging
  console.log('🔍 PaymentSuccess Debug:', {
    user: user?.email,
    authLoading,
    authChecked,
    currentUrl: window.location.href,
    currentHash: window.location.hash,
    urlDebug
  });

  useEffect(() => {
    const processPaymentReturn = async () => {
      try {
        console.log('🎉 Payment Success page loaded');
        console.log('👤 User state:', { user: user?.email, authLoading });

        // Wait for auth to be checked
        if (authLoading) {
          console.log('⏳ Waiting for auth check...');
          return;
        }

        setAuthChecked(true);

        if (!user?.email) {
          console.log('❌ No user found, redirecting to login...');
          setError('Please log in to complete your subscription setup');
          setIsProcessing(false);
          
          // Redirect to login with return path
          setTimeout(() => {
            navigate('/login', { replace: true });
          }, 2000);
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

        // Process the payment return
        const result = await handlePostPaymentReturn(combinedParams, user.email);
        
        if (result.success) {
          setResult(result);
          console.log('✅ Payment processing completed:', result);
          
          // Trigger subscription refresh events
          window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
            detail: { source: 'payment_success', userEmail: user.email, force: true }
          }));
          window.dispatchEvent(new CustomEvent('refreshFeatureAccess', {
            detail: { source: 'payment_success', force: true }
          }));
          
        } else {
          setError(result.reason || 'Payment processing failed');
        }

      } catch (err) {
        console.error('❌ Error processing payment success:', err);
        setError(err.message || 'An error occurred while processing your payment');
      } finally {
        setIsProcessing(false);
      }
    };

    // Process payment when auth is ready
    if (!authLoading) {
      const timer = setTimeout(processPaymentReturn, 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams, user, authLoading, navigate]);

  const handleContinue = async () => {
    if (isNavigating) {
      console.log('🚫 Navigation already in progress...');
      return;
    }
    
    setIsNavigating(true);
    console.log('🚀 Starting navigation to dashboard');
    
    try {
      // Ensure user is authenticated
      if (!user?.email) {
        console.log('❌ No user for navigation, going to login...');
        navigate('/login', { replace: true });
        return;
      }

      // Clear payment-related session storage
      const clearKeys = [
        'paymentUserEmail',
        'pendingPayment', 
        'paymentTracking',
        'awaitingPayment'
      ];
      
      clearKeys.forEach(key => {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
      });
      
      // Trigger one more subscription refresh
      window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
        detail: { source: 'navigation', userEmail: user.email, force: true }
      }));

      console.log('🎯 Navigating to dashboard...');
      
      // Use direct URL navigation for better compatibility
      const baseUrl = window.location.origin + window.location.pathname;
      window.location.href = baseUrl + '#/dashboard';
      
    } catch (navError) {
      console.error('❌ Navigation error:', navError);
      // Ultimate fallback
      window.location.hash = '#/dashboard';
    } finally {
      // Reset navigation state after delay
      setTimeout(() => {
        setIsNavigating(false);
      }, 3000);
    }
  };

  // Handle redirect on page load if needed
  useEffect(() => {
    const shouldRedirect = sessionStorage.getItem('redirectToDashboard');
    if (shouldRedirect) {
      sessionStorage.removeItem('redirectToDashboard');
      console.log('🔄 Redirecting to dashboard after reload...');
      setTimeout(() => {
        const baseUrl = window.location.origin + window.location.pathname;
        window.location.href = baseUrl + '#/dashboard';
      }, 1000);
    }
  }, []);

  const planId = searchParams.get('plan') || urlDebug.hashParams?.plan || result?.planId || 'professional';
  const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.professional;

  // Show loading while auth is being checked
  if (authLoading || (isProcessing && !authChecked)) {
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
  if (error || (!user && authChecked)) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-6 mb-6">
            <SafeIcon icon={RiErrorWarningLine} className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-300 mb-2">
              {!user ? 'Authentication Required' : 'Payment Issue'}
            </h2>
            <p className="text-red-200 mb-4">
              {!user ? 'Please log in to complete your subscription setup' : error}
            </p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  const baseUrl = window.location.origin + window.location.pathname;
                  window.location.href = baseUrl + (!user ? '#/login' : '#/pricing');
                }}
                className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                {!user ? 'Go to Login' : 'Return to Pricing'}
              </button>
              {user && (
                <button
                  onClick={handleContinue}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Try Dashboard Anyway
                </button>
              )}
            </div>
          </div>
          
          {/* Debug Information for Errors */}
          <div className="mt-4 text-xs text-gray-500 p-4 bg-gray-800 rounded-lg">
            <h3 className="font-semibold mb-2 text-gray-400">Debug Information:</h3>
            <div className="text-left space-y-1">
              <p><strong>URL:</strong> {urlDebug.originalUrl}</p>
              <p><strong>Has Session ID:</strong> {urlDebug.hasSessionId ? 'Yes' : 'No'}</p>
              <p><strong>Has Payment Status:</strong> {urlDebug.hasPaymentStatus ? 'Yes' : 'No'}</p>
              <p><strong>User:</strong> {user?.email || 'Not logged in'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show processing state
  if (isProcessing) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-white mb-2">Processing Your Payment</h2>
          <p className="text-gray-400">Activating your subscription...</p>
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
              <span className="text-white font-semibold">{user?.email}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Status:</span>
              <span className="text-green-400 font-semibold">Active</span>
            </div>
          </div>
        </motion.div>

        {/* Navigation Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-center"
        >
          <button
            type="button"
            onClick={handleContinue}
            disabled={isNavigating}
            className={`inline-flex items-center font-semibold py-4 px-8 rounded-lg transition-all shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-gray-900 mb-6 ${
              isNavigating 
                ? 'bg-gray-600 text-gray-300 cursor-not-allowed' 
                : 'bg-primary-600 hover:bg-primary-700 text-white'
            }`}
          >
            {isNavigating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-300 mr-2"></div>
                Taking you to dashboard...
              </>
            ) : (
              <>
                <SafeIcon icon={RiHomeLine} className="h-5 w-5 mr-2" />
                Go to Dashboard
                <SafeIcon icon={RiArrowRightLine} className="h-5 w-5 ml-2" />
              </>
            )}
          </button>
          
          {/* Manual Navigation Fallback */}
          {!isNavigating && (
            <div className="mb-6">
              <p className="text-gray-400 text-sm mb-3">
                Having trouble? Click here to go directly:
              </p>
              <a
                href="#/dashboard"
                className="inline-flex items-center px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                onClick={(e) => {
                  e.preventDefault();
                  const baseUrl = window.location.origin + window.location.pathname;
                  window.location.href = baseUrl + '#/dashboard';
                }}
              >
                <SafeIcon icon={RiHomeLine} className="h-4 w-4 mr-2" />
                Direct Dashboard Link
              </a>
            </div>
          )}
          
          {/* Debug Information */}
          <div className="mt-8 text-xs text-gray-500 p-4 bg-gray-800 rounded-lg">
            <h3 className="font-semibold mb-2 text-gray-400">Navigation Debug:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
              <p><strong>Current URL:</strong> {window.location.href}</p>
              <p><strong>Current Hash:</strong> {window.location.hash}</p>
              <p><strong>Target:</strong> #/dashboard</p>
              <p><strong>User:</strong> {user?.email}</p>
              <p><strong>Navigation State:</strong> {isNavigating ? 'Navigating...' : 'Ready'}</p>
              <p><strong>URL Clean:</strong> {urlDebug.originalUrl?.includes('%3C/code%3E') ? 'No (Fixed)' : 'Yes'}</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}