import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SubscriptionPlan from '../components/SubscriptionPlan';
import { logSecurityEvent } from '../utils/security';

export default function SubscriptionPage() {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [billingInterval, setBillingInterval] = useState('monthly');

  // Log pricing page view when component mounts
  useState(() => {
    logSecurityEvent('PRICING_PAGE_VIEW', { userEmail: user?.email, billingInterval });
  });

  const handlePlanSelect = async (plan, interval) => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (plan.id === 'free') {
      // Free plan doesn't need checkout
      navigate('/dashboard');
      return;
    }

    setSelectedPlan(plan);
    setIsLoading(true);
    setError(null);

    try {
      logSecurityEvent('PLAN_SELECTION', { planId: plan.id, userEmail: user.email, billingInterval: interval });
      
      // Navigate to checkout page with plan details
      navigate(`/checkout?plan=${plan.id}&billing=${interval}`);
    } catch (err) {
      setError(err.message);
      logSecurityEvent('PLAN_SELECTION_ERROR', { error: err.message, planId: plan.id });
    } finally {
      setIsLoading(false);
      setSelectedPlan(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white mb-4">Choose Your Subscription Plan</h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Get the right plan for your inventory management needs
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 max-w-md mx-auto"
          >
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
              <p className="text-red-300 text-sm text-center">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Subscription Plans */}
        <SubscriptionPlan
          onPlanSelect={handlePlanSelect}
          currentPlan={user?.subscriptionPlan || 'free'}
          isLoading={isLoading}
          billingInterval={billingInterval}
          setBillingInterval={setBillingInterval}
        />

        {/* FAQ Section */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">Frequently Asked Questions</h2>
          <div className="max-w-3xl mx-auto space-y-6">
            {[
              {
                question: 'Can I change my plan at any time?',
                answer: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we will prorate the billing accordingly.'
              },
              {
                question: 'Is there a free trial?',
                answer: 'Yes, all plans come with a 14-day free trial. No credit card required to start.'
              },
              {
                question: 'What payment methods do you accept?',
                answer: 'We accept all major credit cards, PayPal, and bank transfers for UK customers.'
              },
              {
                question: 'Is my data secure?',
                answer: 'Absolutely. We use bank-level encryption and follow industry best practices to keep your data secure.'
              }
            ].map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                className="bg-gray-800 rounded-lg p-6"
              >
                <h3 className="text-lg font-semibold text-white mb-2">{faq.question}</h3>
                <p className="text-gray-300">{faq.answer}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}