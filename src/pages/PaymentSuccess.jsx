import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as RiIcons from 'react-icons/ri';
import SafeIcon from '../common/SafeIcon';
import { useAuth } from '../context/AuthContext';
import { SUBSCRIPTION_PLANS, handlePostPaymentReturn, formatTrialInfo } from '../lib/stripe';
import { updateUserSubscription } from '../services/subscriptionService';

const { RiCheckboxCircleFill, RiGiftLine, RiCalendarLine, RiArrowRightLine } = RiIcons;

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
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

  const handleContinue = () => {
    navigate('/dashboard');
  };

  const planId = searchParams.get('plan') || result?.planId || 'professional';
  const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.professional;
  const trialActivated = searchParams.get('trial_activated') === 'true' || result?.trialActivated;
  const trialInfo = trialActivated ? formatTrialInfo(planId) : null;

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-white mb-2">Processing Your Payment</h2>
          <p className="text-gray-400">
            {trialActivated ? 'Setting up your free trial...' : 'Activating your subscription...'}
          </p>
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
            <button
              onClick={() => navigate('/pricing')}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Return to Pricing
            </button>
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
            {trialActivated ? '🎉 Free Trial Activated!' : '🎉 Payment Successful!'}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl text-gray-300 mb-8"
          >
            {trialActivated 
              ? `Welcome to your ${plan.name} free trial!`
              : `Welcome to ${plan.name}! Your subscription is now active.`
            }
          </motion.p>
        </div>

        {/* Trial Information */}
        {trialActivated && trialInfo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-green-700/50 rounded-xl p-6 mb-8"
          >
            <div className="flex items-center justify-center mb-4">
              <SafeIcon icon={RiGiftLine} className="h-8 w-8 text-green-400 mr-3" />
              <h2 className="text-2xl font-bold text-green-400">5-Day FREE Trial Details</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="text-center">
                <div className="bg-green-800/30 rounded-lg p-4">
                  <SafeIcon icon={RiCalendarLine} className="h-6 w-6 text-green-400 mx-auto mb-2" />
                  <h3 className="text-white font-semibold mb-1">Trial Period</h3>
                  <p className="text-green-300 text-sm">
                    {trialInfo.trialDays} days of full access
                  </p>
                  <p className="text-green-200 text-xs mt-1">
                    Ends: {trialInfo.trialEndFormatted}
                  </p>
                </div>
              </div>
              
              <div className="text-center">
                <div className="bg-green-800/30 rounded-lg p-4">
                  <SafeIcon icon={RiCheckboxCircleFill} className="h-6 w-6 text-green-400 mx-auto mb-2" />
                  <h3 className="text-white font-semibold mb-1">No Charge</h3>
                  <p className="text-green-300 text-sm">
                    Card secured, not charged
                  </p>
                  <p className="text-green-200 text-xs mt-1">
                    Then £{trialInfo.monthlyPrice}/month
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-green-800/20 rounded-lg p-4">
              <h4 className="text-green-400 font-semibold mb-3 text-center">
                🚀 What's Included in Your Trial:
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {plan.features.slice(0, 6).map((feature, index) => (
                  <div key={index} className="flex items-center text-green-300 text-sm">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-3 flex-shrink-0"></div>
                    {feature}
                  </div>
                ))}
              </div>
              {plan.features.length > 6 && (
                <p className="text-green-400 text-center text-sm mt-3">
                  + {plan.features.length - 6} more premium features!
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* Plan Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gray-800 rounded-xl p-6 mb-8"
        >
          <h2 className="text-2xl font-bold text-white mb-4 text-center">
            {trialActivated ? 'Trial' : 'Subscription'} Summary
          </h2>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-700">
              <span className="text-gray-300">Plan:</span>
              <span className="text-white font-semibold">{plan.name}</span>
            </div>
            
            {trialActivated ? (
              <>
                <div className="flex justify-between items-center pb-2 border-b border-gray-700">
                  <span className="text-gray-300">Trial Period:</span>
                  <span className="text-green-400 font-semibold">5 Days FREE</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-gray-700">
                  <span className="text-gray-300">After Trial:</span>
                  <span className="text-white font-semibold">£{plan.price}/month</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Next Billing:</span>
                  <span className="text-white font-semibold">
                    {trialInfo?.trialEndFormatted || 'In 5 days'}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between items-center pb-2 border-b border-gray-700">
                  <span className="text-gray-300">Price:</span>
                  <span className="text-white font-semibold">£{plan.price}/month</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Status:</span>
                  <span className="text-green-400 font-semibold">Active</span>
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* Important Notes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 mb-8"
        >
          <h3 className="text-blue-400 font-semibold mb-3">📋 Important Information:</h3>
          <ul className="text-blue-300 text-sm space-y-2">
            {trialActivated ? (
              <>
                <li>• Your free trial is now active with full access to all premium features</li>
                <li>• No charges will be made during the 5-day trial period</li>
                <li>• Cancel anytime during the trial to avoid any charges</li>
                <li>• After the trial, you'll be charged £{plan.price}/month automatically</li>
              </>
            ) : (
              <>
                <li>• Your subscription is now active with immediate access to all features</li>
                <li>• You'll be billed £{plan.price} monthly until you cancel</li>
                <li>• You can manage your subscription in Settings</li>
              </>
            )}
            <li>• You'll receive email confirmations for all billing activities</li>
            <li>• Contact support if you have any questions or need assistance</li>
          </ul>
        </motion.div>

        {/* Continue Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="text-center"
        >
          <button
            onClick={handleContinue}
            className="inline-flex items-center bg-primary-600 hover:bg-primary-700 text-white font-semibold py-4 px-8 rounded-lg transition-colors shadow-lg hover:shadow-xl"
          >
            {trialActivated ? 'Start Using Your Trial' : 'Go to Dashboard'}
            <SafeIcon icon={RiArrowRightLine} className="h-5 w-5 ml-2" />
          </button>
          
          <p className="text-gray-400 text-sm mt-4">
            {trialActivated 
              ? 'Ready to explore all premium features!'
              : 'Your subscription is ready to use!'
            }
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}