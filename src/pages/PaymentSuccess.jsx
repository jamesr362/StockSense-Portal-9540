import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as RiIcons from 'react-icons/ri';
import SafeIcon from '../common/SafeIcon';
import { useAuth } from '../context/AuthContext';
import { SUBSCRIPTION_PLANS, handlePostPaymentReturn } from '../lib/stripe';
import { updateUserSubscription } from '../services/subscriptionService';

const { RiCheckboxCircleFill, RiArrowRightLine } = RiIcons;

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const processPaymentReturn = async () => {
      try {
        console.log('🎉 Payment Success page loaded');

        if (!user?.email) {
          setError('User not authenticated');
          setIsProcessing(false);
          return;
        }

        // Process the payment return
        const result = await handlePostPaymentReturn(searchParams, user.email);
        
        if (result.success) {
          setResult(result);
          console.log('✅ Payment processing completed:', result);
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

    // Small delay to ensure proper component mounting
    const timer = setTimeout(processPaymentReturn, 500);
    return () => clearTimeout(timer);
  }, [searchParams, user]);

  const handleContinue = (e) => {
    // Prevent any default behavior
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Prevent multiple clicks
    if (isNavigating) {
      console.log('🚫 Navigation already in progress...');
      return;
    }
    
    setIsNavigating(true);
    console.log('🚀 Starting navigation to dashboard...');
    
    // Clear any payment-related session storage
    sessionStorage.removeItem('paymentUserEmail');
    sessionStorage.removeItem('pendingPayment');
    sessionStorage.removeItem('paymentTracking');
    sessionStorage.removeItem('awaitingPayment');
    
    // Trigger subscription refresh events
    window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
      detail: { source: 'payment_success', userEmail: user?.email, force: true }
    }));
    window.dispatchEvent(new CustomEvent('refreshFeatureAccess', {
      detail: { source: 'payment_success', force: true }
    }));
    
    // **HASH ROUTER NAVIGATION - Multiple approaches**
    console.log('🎯 Navigating to dashboard using hash router...');
    
    try {
      // Method 1: Use React Router navigate
      console.log('🔄 Trying React Router navigate...');
      navigate('/dashboard', { replace: true });
      
      // Method 2: Direct hash manipulation (backup)
      setTimeout(() => {
        if (window.location.hash !== '#/dashboard') {
          console.log('🔄 Trying hash manipulation...');
          window.location.hash = '#/dashboard';
        }
      }, 100);
      
      // Method 3: Force page navigation (final backup)
      setTimeout(() => {
        if (!window.location.href.includes('#/dashboard')) {
          console.log('🔄 Trying force navigation...');
          window.location.href = window.location.origin + window.location.pathname + '#/dashboard';
        }
      }, 500);
      
    } catch (navError) {
      console.error('❌ Navigation error:', navError);
      // Ultimate fallback - direct hash set
      window.location.hash = '#/dashboard';
    }
    
    // Reset navigation state after a delay
    setTimeout(() => {
      setIsNavigating(false);
    }, 2000);
  };

  const planId = searchParams.get('plan') || result?.planId || 'professional';
  const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.professional;

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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-red-300 mb-2">Payment Issue</h2>
            <p className="text-red-200 mb-4">{error}</p>
            <div className="space-y-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/pricing', { replace: true });
                }}
                className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Return to Pricing
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/dashboard', { replace: true });
                }}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Status:</span>
              <span className="text-green-400 font-semibold">Active</span>
            </div>
          </div>
        </motion.div>

        {/* Important Notes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 mb-8"
        >
          <h3 className="text-blue-400 font-semibold mb-3">📋 Important Information:</h3>
          <ul className="text-blue-300 text-sm space-y-2">
            <li>• Your subscription is now active with immediate access to all features</li>
            <li>• You'll be billed £{plan.price} monthly until you cancel</li>
            <li>• You can manage your subscription in Settings</li>
            <li>• You'll receive email confirmations for all billing activities</li>
            <li>• Contact support if you have any questions or need assistance</li>
          </ul>
        </motion.div>

        {/* Continue Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="text-center"
        >
          <button
            type="button"
            onClick={handleContinue}
            disabled={isNavigating}
            className={`inline-flex items-center font-semibold py-4 px-8 rounded-lg transition-all shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
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
                Go to Dashboard
                <SafeIcon icon={RiArrowRightLine} className="h-5 w-5 ml-2" />
              </>
            )}
          </button>
          
          <p className="text-gray-400 text-sm mt-4">
            {isNavigating ? (
              'Redirecting to your dashboard...'
            ) : (
              'Your subscription is ready to use!'
            )}
          </p>
          
          {/* Additional Navigation Options */}
          {!isNavigating && (
            <div className="mt-6 pt-4 border-t border-gray-700">
              <p className="text-gray-500 text-sm mb-3">
                Alternative navigation options:
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => navigate('/dashboard', { replace: true })}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                >
                  🎯 React Router
                </button>
                <button
                  onClick={() => window.location.hash = '#/dashboard'}
                  className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
                >
                  🔗 Hash Navigation
                </button>
                <button
                  onClick={() => window.location.href = window.location.origin + window.location.pathname + '#/dashboard'}
                  className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
                >
                  🚀 Force Navigate
                </button>
              </div>
            </div>
          )}
          
          {/* Debug info */}
          <div className="mt-4 text-xs text-gray-500 p-3 bg-gray-800 rounded">
            <p><strong>Current URL:</strong> {window.location.href}</p>
            <p><strong>Current Hash:</strong> {window.location.hash}</p>
            <p><strong>Target:</strong> #/dashboard</p>
            <p><strong>User:</strong> {user?.email}</p>
            <p><strong>Navigation State:</strong> {isNavigating ? 'Navigating...' : 'Ready'}</p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}