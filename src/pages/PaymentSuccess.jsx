import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { RiCheckLine, RiArrowRightLine } from 'react-icons/ri';
import { logSecurityEvent } from '../utils/security';
import { SUBSCRIPTION_PLANS } from '../lib/stripe';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [sessionDetails, setSessionDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      // Retrieve session details
      fetchSessionDetails(sessionId);
      // Log successful payment
      logSecurityEvent('PAYMENT_SUCCESS_PAGE_VIEW', { sessionId });
    } else {
      navigate('/pricing');
    }
  }, [searchParams, navigate]);

  const fetchSessionDetails = async (sessionId) => {
    try {
      // Since we don't have a real backend API, we'll mock the session details
      // In a real app, you would fetch these details from your server
      const mockDetails = {
        plan_name: 'Professional',
        price_id: 'price_1RtpsuEw1FLYKy8hvxTrRpwe',
        amount_total: 7900, // $79.00 in cents
        currency: 'gbp',
        customer_email: 'customer@example.com',
        subscription_id: 'sub_' + Math.random().toString(36).substring(2, 15)
      };

      setSessionDetails(mockDetails);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching session details:', error);
      setLoading(false);
    }
  };

  const handleContinue = () => {
    navigate('/dashboard');
  };

  // Find plan details based on session
  const getPlanDetails = () => {
    if (!sessionDetails?.price_id) return null;
    
    return Object.values(SUBSCRIPTION_PLANS).find(
      plan => plan.priceId === sessionDetails.price_id
    ) || {
      name: sessionDetails.plan_name || 'Professional',
      features: [
        'Unlimited inventory items',
        'Advanced analytics',
        '10 team members',
        'Priority support'
      ]
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const planDetails = getPlanDetails();

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-8 text-center"
      >
        {/* Success Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <RiCheckLine className="h-8 w-8 text-white" />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold text-white mb-4"
        >
          Payment Successful!
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-gray-300 mb-6"
        >
          Thank you for your purchase. Your subscription has been activated successfully.
        </motion.p>

        {/* Session Details */}
        {sessionDetails && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gray-700 rounded-lg p-4 mb-6 text-left"
          >
            <h3 className="text-white font-semibold mb-2">Order Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Plan:</span>
                <span className="text-white">{planDetails?.name || 'Professional'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Amount:</span>
                <span className="text-white">
                  {new Intl.NumberFormat('en-GB', {
                    style: 'currency',
                    currency: sessionDetails.currency?.toUpperCase() || 'GBP',
                  }).format(sessionDetails.amount_total / 100)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className="text-green-400">Active</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Plan Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-6"
        >
          <h3 className="text-blue-400 font-semibold mb-2">Your {planDetails?.name} Plan Includes:</h3>
          <ul className="text-blue-300 text-sm space-y-1 text-left">
            {planDetails?.features.slice(0, 4).map((feature, index) => (
              <li key={index} className="flex items-center">
                <RiCheckLine className="h-4 w-4 mr-2 text-green-400" />
                {feature}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="space-y-3"
        >
          <button
            onClick={handleContinue}
            className="w-full py-3 px-6 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors flex items-center justify-center"
          >
            Continue to Dashboard
            <RiArrowRightLine className="h-5 w-5 ml-2" />
          </button>

          <button
            onClick={() => navigate('/settings/billing')}
            className="w-full py-2 px-6 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
          >
            Manage Billing
          </button>
        </motion.div>

        {/* Support Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 pt-6 border-t border-gray-700"
        >
          <p className="text-gray-400 text-sm">
            Need help? Contact our support team at{' '}
            <a
              href="mailto:support@trackio.com"
              className="text-primary-400 hover:text-primary-300"
            >
              support@trackio.com
            </a>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}