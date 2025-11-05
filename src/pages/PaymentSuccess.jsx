import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as RiIcons from 'react-icons/ri';
import SafeIcon from '../common/SafeIcon';
import { useAuth } from '../context/AuthContext';
import { SUBSCRIPTION_PLANS, handlePostPaymentReturn } from '../lib/stripe';

const { RiCheckboxCircleFill, RiArrowRightLine, RiRefreshLine, RiHomeLine } = RiIcons;

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const { user, loading: authLoading } = useAuth();

  // Debug logging
  console.log('🔍 PaymentSuccess Debug:', {
    user: user?.email,
    authLoading,
    authChecked,
    currentUrl: window.location.href,
    currentHash: window.location.hash
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

        // Process the payment return
        const result = await handlePostPaymentReturn(searchParams, user.email);
        
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

  const handleContinue = async (method = 'auto') => {
    if (isNavigating) {
      console.log('🚫 Navigation already in progress...');
      return;
    }
    
    setIsNavigating(true);
    console.log(`🚀 Starting navigation to dashboard using method: ${method}`);
    
    try {
      // Ensure user is authenticated
      if (!user?.email) {
        console.log('❌ No user for navigation, going to login...');
        navigate('/login', { replace: true });
        return;
      }

      // Clear payment-related session storage
      sessionStorage.removeItem('paymentUserEmail');
      sessionStorage.removeItem('pendingPayment');
      sessionStorage.removeItem('paymentTracking');
      sessionStorage.removeItem('awaitingPayment');
      
      // Trigger one more subscription refresh
      window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
        detail: { source: 'navigation', userEmail: user.email, force: true }
      }));

      console.log('🎯 Attempting navigation to dashboard...');

      switch (method) {
        case 'react-router':
          console.log('🔄 Using React Router navigate...');
          navigate('/dashboard', { replace: true });
          break;
          
        case 'hash-direct':
          console.log('🔄 Using direct hash manipulation...');
          window.location.hash = '#/dashboard';
          break;
          
        case 'full-redirect':
          console.log('🔄 Using full page redirect...');
          const baseUrl = window.location.origin + window.location.pathname;
          window.location.href = baseUrl + '#/dashboard';
          break;
          
        case 'force-reload':
          console.log('🔄 Using force reload...');
          sessionStorage.setItem('redirectToDashboard', 'true');
          window.location.reload();
          break;
          
        default: // 'auto'
          console.log('🔄 Using auto navigation (React Router first)...');
          navigate('/dashboard', { replace: true });
          
          // Fallback after delay
          setTimeout(() => {
            if (!window.location.hash.includes('/dashboard')) {
              console.log('🔄 Fallback: Using hash manipulation...');
              window.location.hash = '#/dashboard';
            }
          }, 1000);
          
          // Final fallback
          setTimeout(() => {
            if (!window.location.hash.includes('/dashboard')) {
              console.log('🔄 Final fallback: Force redirect...');
              const baseUrl = window.location.origin + window.location.pathname;
              window.location.href = baseUrl + '#/dashboard';
            }
          }, 3000);
          break;
      }
      
    } catch (navError) {
      console.error('❌ Navigation error:', navError);
      // Ultimate fallback
      window.location.hash = '#/dashboard';
    }
    
    // Reset navigation state after delay
    setTimeout(() => {
      setIsNavigating(false);
    }, 5000);
  };

  // Handle redirect on page load if needed
  useEffect(() => {
    const shouldRedirect = sessionStorage.getItem('redirectToDashboard');
    if (shouldRedirect) {
      sessionStorage.removeItem('redirectToDashboard');
      console.log('🔄 Redirecting to dashboard after reload...');
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1000);
    }
  }, [navigate]);

  const planId = searchParams.get('plan') || result?.planId || 'professional';
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
            <h2 className="text-2xl font-bold text-red-300 mb-2">
              {!user ? 'Authentication Required' : 'Payment Issue'}
            </h2>
            <p className="text-red-200 mb-4">
              {!user ? 'Please log in to complete your subscription setup' : error}
            </p>
            <div className="space-y-2">
              <button
                onClick={() => navigate(!user ? '/login' : '/pricing', { replace: true })}
                className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                {!user ? 'Go to Login' : 'Return to Pricing'}
              </button>
              {user && (
                <button
                  onClick={() => handleContinue('react-router')}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Try Dashboard Anyway
                </button>
              )}
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
            onClick={() => handleContinue('auto')}
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
          
          {/* Alternative Navigation Methods */}
          {!isNavigating && (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">
                Having trouble? Try these alternative methods:
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => handleContinue('react-router')}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                >
                  🎯 React Router
                </button>
                <button
                  onClick={() => handleContinue('hash-direct')}
                  className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
                >
                  🔗 Hash Navigation
                </button>
                <button
                  onClick={() => handleContinue('full-redirect')}
                  className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
                >
                  🚀 Full Redirect
                </button>
                <button
                  onClick={() => handleContinue('force-reload')}
                  className="px-4 py-2 text-sm bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-medium"
                >
                  <SafeIcon icon={RiRefreshLine} className="h-4 w-4 mr-1" />
                  Force Reload
                </button>
              </div>
            </div>
          )}
          
          {/* Debug Information */}
          <div className="mt-8 text-xs text-gray-500 p-4 bg-gray-800 rounded-lg">
            <h3 className="font-semibold mb-2 text-gray-400">Debug Information:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
              <p><strong>Current URL:</strong> {window.location.href}</p>
              <p><strong>Current Hash:</strong> {window.location.hash}</p>
              <p><strong>Target:</strong> #/dashboard</p>
              <p><strong>User:</strong> {user?.email}</p>
              <p><strong>Auth Loading:</strong> {authLoading.toString()}</p>
              <p><strong>Navigation State:</strong> {isNavigating ? 'Navigating...' : 'Ready'}</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}