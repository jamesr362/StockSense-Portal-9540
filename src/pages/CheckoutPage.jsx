import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js';
import getStripe from '../lib/stripe';
import { RiShieldCheckLine, RiArrowLeftLine } from 'react-icons/ri';
import StripeCheckoutForm from '../components/StripeCheckoutForm';
import { useAuth } from '../context/AuthContext';
import { formatPrice, SUBSCRIPTION_PLANS } from '../lib/stripe';
import { logSecurityEvent } from '../utils/security';

export default function CheckoutPage() {
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateUserData } = useAuth();
  const stripePromise = getStripe();
  
  // Get plan details from URL parameters
  const queryParams = new URLSearchParams(location.search);
  const planId = queryParams.get('plan') || 'pro';
  const billingInterval = queryParams.get('billing') || 'monthly';
  
  // Get plan details
  const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.pro;
  const price = billingInterval === 'yearly' ? plan.yearlyPrice : plan.price;

  const handlePaymentSuccess = (result) => {
    setIsProcessing(true);
    logSecurityEvent('SUBSCRIPTION_CREATED', { 
      planId,
      billingInterval,
      userEmail: user?.email
    });
    
    // Update user data with subscription information
    updateUserData({
      subscriptionPlan: planId,
      subscriptionStatus: 'active',
      subscriptionInterval: billingInterval,
      customerId: result.customerId,
      subscriptionId: result.subscriptionId
    });
    
    // Show success message and redirect
    setPaymentSuccess(true);
    setIsProcessing(false);
    
    // Redirect to success page after a delay
    setTimeout(() => {
      navigate('/payment-success?session_id=mock_session_123');
    }, 1500);
  };

  const handlePaymentError = (error) => {
    setPaymentError(error.message || 'Payment failed. Please try again.');
    setIsProcessing(false);
    logSecurityEvent('SUBSCRIPTION_ERROR', { 
      planId,
      billingInterval,
      error: error.message,
      userEmail: user?.email
    });
  };

  const handleCancel = () => {
    navigate(`/subscription`);
  };

  return (
    <div className="min-h-screen bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <button
            onClick={handleCancel}
            className="flex items-center text-gray-400 hover:text-white transition-colors"
          >
            <RiArrowLeftLine className="h-5 w-5 mr-1" />
            Back to plans
          </button>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Order summary */}
          <div className="md:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-gray-800 rounded-lg p-6 shadow-lg"
            >
              <h3 className="text-lg font-medium text-white mb-6">Order Summary</h3>
              
              <div className="border-b border-gray-700 pb-4 mb-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">Plan</span>
                  <span className="text-white font-medium">{plan.name}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">Billing</span>
                  <span className="text-white font-medium capitalize">{billingInterval}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Price</span>
                  <span className="text-white font-medium">{formatPrice(price)}/{billingInterval === 'yearly' ? 'year' : 'month'}</span>
                </div>
              </div>
              
              {billingInterval === 'yearly' && (
                <div className="bg-green-900/20 border border-green-700 rounded-lg p-3 mb-4">
                  <div className="flex items-center text-green-400 text-sm">
                    <RiShieldCheckLine className="h-4 w-4 mr-2" />
                    <span>You save {plan.savings} with annual billing!</span>
                  </div>
                </div>
              )}
              
              <div className="border-t border-gray-700 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Total</span>
                  <div className="text-right">
                    <div className="text-xl font-semibold text-white">
                      {formatPrice(price)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {billingInterval === 'monthly' ? 'Billed monthly' : 'Billed annually'}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
          
          {/* Payment form */}
          <div className="md:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-gray-800 rounded-lg p-6 shadow-lg"
            >
              <h2 className="text-xl font-semibold text-white mb-6">Payment Information</h2>
              
              {paymentSuccess ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-green-900/20 border border-green-700 rounded-lg p-6 text-center"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-green-500 rounded-full mb-4">
                    <RiShieldCheckLine className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">Payment Successful!</h3>
                  <p className="text-green-300 mb-4">
                    Your subscription has been activated successfully.
                  </p>
                  <div className="animate-pulse">Redirecting to your dashboard...</div>
                </motion.div>
              ) : (
                <Elements stripe={stripePromise}>
                  <StripeCheckoutForm
                    amount={price}
                    planId={planId}
                    billingInterval={billingInterval}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                    onCancel={handleCancel}
                    buttonText={`Subscribe ${formatPrice(price)}/${billingInterval === 'yearly' ? 'year' : 'month'}`}
                  />
                </Elements>
              )}
              
              {paymentError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-3 bg-red-900/50 border border-red-700 rounded-md"
                >
                  <p className="text-red-300 text-sm">{paymentError}</p>
                </motion.div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}