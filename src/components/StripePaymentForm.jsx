import { useState } from 'react';
import { motion } from 'framer-motion';
import * as RiIcons from 'react-icons/ri';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { createEnhancedCheckoutSession, getPlanById } from '../lib/stripe';
import { useAuth } from '../context/AuthContext';
import { logSecurityEvent } from '../utils/security';

const { RiSecurePaymentFill, RiArrowRightLine, RiGiftLine } = RiIcons;
const { FiCreditCard, FiLock, FiCalendar } = FiIcons;

export default function StripePaymentForm({ planId, onSuccess, onError, className = '' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  
  const plan = getPlanById(planId);

  const handlePayment = async () => {
    if (!user?.email) {
      setError('Please log in to continue with payment');
      return;
    }

    try {
      setLoading(true);
      setError('');

      console.log('🚀 Starting payment process...', { planId, userEmail: user.email });

      // Create enhanced checkout session for Payment Links
      const checkoutData = await createEnhancedCheckoutSession(planId, user.email);
      
      console.log('✅ Checkout session created:', checkoutData);

      logSecurityEvent('PAYMENT_INITIATED', {
        planId,
        userEmail: user.email,
        paymentUrl: checkoutData.url,
        originalUrl: checkoutData.originalUrl
      });

      // **IMPORTANT**: Open Stripe Payment Link in same window for better redirect handling
      console.log('🔗 Redirecting to Stripe Payment Link:', checkoutData.url);
      
      // Show user feedback before redirect
      if (onSuccess) {
        onSuccess({
          sessionId: checkoutData.sessionId || 'payment_link_redirect',
          planId,
          redirecting: true
        });
      }

      // **CRITICAL**: Use window.location.href for proper redirect
      // This ensures we can detect the return properly
      setTimeout(() => {
        window.location.href = checkoutData.url;
      }, 1000);

    } catch (err) {
      console.error('❌ Payment error:', err);
      const errorMessage = err.message || 'Failed to initialize payment. Please try again.';
      setError(errorMessage);
      
      if (onError) {
        onError(err);
      }

      logSecurityEvent('PAYMENT_ERROR', {
        error: errorMessage,
        planId,
        userEmail: user?.email
      });
    } finally {
      // Don't set loading to false immediately, as we're redirecting
      setTimeout(() => setLoading(false), 3000);
    }
  };

  if (!plan) {
    return (
      <div className="text-center py-4">
        <p className="text-red-400">Invalid plan selected</p>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
      {/* Free Trial Header */}
      {plan.price > 0 && (
        <div className="mb-6 bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-green-700/50 rounded-lg p-4">
          <div className="flex items-center justify-center mb-3">
            <SafeIcon icon={RiGiftLine} className="h-6 w-6 text-green-400 mr-2" />
            <h3 className="text-xl font-bold text-green-400">5-Day FREE Trial</h3>
          </div>
          <div className="text-center space-y-2">
            <p className="text-green-300 text-sm font-medium">
              🎯 Try all premium features completely free for 5 full days
            </p>
            <p className="text-green-400 text-xs">
              Your card will be securely stored but NOT charged during the trial period
            </p>
          </div>
        </div>
      )}

      {/* Plan Summary */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-white mb-4">
          {plan.price > 0 ? 'Start Your Free Trial' : 'Complete Your Purchase'}
        </h3>
        <div className="bg-gray-700 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Plan:</span>
            <span className="text-white font-medium">{plan.name}</span>
          </div>
          
          {plan.price > 0 ? (
            <>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Trial Period:</span>
                <span className="text-green-400 font-medium">5 days FREE</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">After trial:</span>
                <span className="text-white font-medium">£{plan.price}/month</span>
              </div>
              <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-3 mt-3">
                <div className="flex items-center text-green-300 text-sm">
                  <SafeIcon icon={FiCalendar} className="h-4 w-4 mr-2" />
                  <span className="font-medium">Billing starts: </span>
                  <span className="ml-1">
                    {new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Price:</span>
              <span className="text-white font-medium">Free Forever</span>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg"
        >
          <p className="text-red-300 text-sm">{error}</p>
        </motion.div>
      )}

      {/* Loading State */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4 p-4 bg-blue-900/30 border border-blue-700 rounded-lg text-center"
        >
          <div className="flex items-center justify-center text-blue-300 mb-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400 mr-3"></div>
            Redirecting to secure payment...
          </div>
          <p className="text-blue-400 text-sm">
            🔒 You'll be redirected to Stripe's secure payment page
          </p>
          <p className="text-blue-500 text-xs mt-1">
            {plan.price > 0 
              ? 'Set up your free trial - no charge for 5 days!'
              : 'After payment, you\'ll be automatically returned to activate your subscription'
            }
          </p>
        </motion.div>
      )}

      {/* Payment Button */}
      <motion.button
        whileHover={{ scale: loading ? 1 : 1.02 }}
        whileTap={{ scale: loading ? 1 : 0.98 }}
        onClick={handlePayment}
        disabled={loading}
        className={`w-full py-4 px-6 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center ${
          loading
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
            : plan.price > 0
            ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl'
            : 'bg-primary-600 hover:bg-primary-700 text-white shadow-lg hover:shadow-xl'
        }`}
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400 mr-3"></div>
            Redirecting to Stripe...
          </>
        ) : (
          <>
            <SafeIcon icon={plan.price > 0 ? RiGiftLine : FiCreditCard} className="h-5 w-5 mr-3" />
            {plan.price > 0 ? 'Start 5-Day FREE Trial' : 'Continue to Secure Payment'}
            <SafeIcon icon={RiArrowRightLine} className="h-5 w-5 ml-3" />
          </>
        )}
      </motion.button>

      {/* Security Notice */}
      <div className="mt-4 flex items-center justify-center text-gray-400 text-sm">
        <SafeIcon icon={FiLock} className="h-4 w-4 mr-2" />
        Secured by Stripe • SSL Encrypted
      </div>

      {/* Trial Terms */}
      {plan.price > 0 && (
        <div className="mt-4 bg-gray-700/50 rounded-lg p-3">
          <h4 className="text-white font-medium text-sm mb-2">Free Trial Terms:</h4>
          <ul className="text-gray-300 text-xs space-y-1">
            <li>• Full access to all premium features for 5 days</li>
            <li>• Your payment method is securely stored but not charged</li>
            <li>• Cancel anytime during trial with no charges</li>
            <li>• After trial: £{plan.price}/month, cancel anytime</li>
            <li>• Automatic billing starts only after trial ends</li>
          </ul>
        </div>
      )}

      {/* Additional Info */}
      <div className="mt-4 text-center">
        <p className="text-gray-400 text-xs">
          🔄 You'll be redirected back automatically after setup
        </p>
        <p className="text-gray-500 text-xs mt-1">
          💡 If you're not redirected, check your email and contact support
        </p>
      </div>

      {/* Plan Features Preview */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <h4 className="text-white font-medium mb-3">
          {plan.price > 0 ? 'What you\'ll get in your free trial:' : 'What you\'ll get:'}
        </h4>
        <ul className="space-y-2">
          {plan.features.slice(0, 3).map((feature, index) => (
            <li key={index} className="flex items-center text-sm">
              <div className="w-2 h-2 bg-primary-500 rounded-full mr-3 flex-shrink-0"></div>
              <span className="text-gray-300">{feature}</span>
            </li>
          ))}
          {plan.features.length > 3 && (
            <li className="text-gray-400 text-xs ml-5">
              + {plan.features.length - 3} more features
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}