import { useState } from 'react';
import { motion } from 'framer-motion';
import * as RiIcons from 'react-icons/ri';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { getPlanById, SUBSCRIPTION_PLANS } from '../lib/stripe';
import { useAuth } from '../context/AuthContext';
import { logSecurityEvent } from '../utils/security';

const { RiSecurePaymentFill, RiArrowRightLine } = RiIcons;
const { FiCreditCard, FiLock } = FiIcons;

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

    if (!plan || !plan.paymentLink) {
      setError('Payment link not available for this plan');
      return;
    }

    try {
      setLoading(true);
      setError('');

      console.log('🚀 Starting secure payment process...', { planId, userEmail: user.email });

      // SECURE: Use the predefined Payment Link from plan config
      const paymentUrl = plan.paymentLink;
      
      console.log('✅ Using secure Payment Link:', paymentUrl);

      logSecurityEvent('PAYMENT_INITIATED', {
        planId,
        userEmail: user.email,
        paymentUrl
      });

      // Show user feedback before redirect
      if (onSuccess) {
        onSuccess({
          planId,
          redirecting: true
        });
      }

      // SECURE: Direct redirect to Stripe Payment Link
      console.log('🔗 Redirecting to Stripe Payment Link:', paymentUrl);
      
      setTimeout(() => {
        window.location.href = paymentUrl;
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
      {/* Plan Summary */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-white mb-4">Complete Your Purchase</h3>
        <div className="bg-gray-700 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Plan:</span>
            <span className="text-white font-medium">{plan.name}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Price:</span>
            <span className="text-white font-medium">
              {plan.price === 0 ? 'Free Forever' : `£${plan.price}/month`}
            </span>
          </div>
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
            After payment, you'll be automatically returned to activate your subscription
          </p>
        </motion.div>
      )}

      {/* Payment Button */}
      <motion.button
        whileHover={{ scale: loading ? 1 : 1.02 }}
        whileTap={{ scale: loading ? 1 : 0.98 }}
        onClick={handlePayment}
        disabled={loading || plan.price === 0}
        className={`w-full py-4 px-6 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center ${
          loading || plan.price === 0
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
            : 'bg-primary-600 hover:bg-primary-700 text-white shadow-lg hover:shadow-xl'
        }`}
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400 mr-3"></div>
            Redirecting to Stripe...
          </>
        ) : plan.price === 0 ? (
          <>
            <SafeIcon icon={FiCreditCard} className="h-5 w-5 mr-3" />
            Free Plan - No Payment Required
          </>
        ) : (
          <>
            <SafeIcon icon={FiCreditCard} className="h-5 w-5 mr-3" />
            Continue to Secure Payment
            <SafeIcon icon={RiArrowRightLine} className="h-5 w-5 ml-3" />
          </>
        )}
      </motion.button>

      {/* Security Notice */}
      <div className="mt-4 flex items-center justify-center text-gray-400 text-sm">
        <SafeIcon icon={FiLock} className="h-4 w-4 mr-2" />
        Secured by Stripe • SSL Encrypted
      </div>

      {/* Additional Info */}
      <div className="mt-4 text-center">
        <p className="text-gray-400 text-xs">
          🔄 You'll be redirected back automatically after payment
        </p>
        <p className="text-gray-500 text-xs mt-1">
          💡 If you're not redirected, check your email and contact support
        </p>
      </div>

      {/* Plan Features Preview */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <h4 className="text-white font-medium mb-3">What you'll get:</h4>
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