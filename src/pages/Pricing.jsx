import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Elements } from '@stripe/react-stripe-js';
import { RiCheckLine, RiArrowRightLine, RiStarLine } from 'react-icons/ri';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import getStripe, { SUBSCRIPTION_PLANS, formatPrice } from '../lib/stripe';
import PricingCard from '../components/PricingCard';
import { createCheckoutSession } from '../services/stripe';
import { logSecurityEvent } from '../utils/security';

export default function Pricing() {
  const [billingInterval, setBillingInterval] = useState('monthly');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const stripePromise = getStripe();

  useEffect(() => {
    // Log pricing page view
    logSecurityEvent('PRICING_PAGE_VIEW', { 
      userEmail: user?.email,
      billingInterval 
    });
  }, [user, billingInterval]);

  const handlePlanSelect = async (plan) => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (plan.id === 'enterprise') {
      // Handle enterprise plan differently
      window.location.href = 'mailto:sales@trackio.com?subject=Enterprise Plan Inquiry';
      return;
    }

    setSelectedPlan(plan);
    setIsLoading(true);
    setError(null);

    try {
      logSecurityEvent('PLAN_SELECTION', { 
        planId: plan.id,
        userEmail: user.email,
        billingInterval 
      });

      // Create checkout session
      await createCheckoutSession(
        plan.priceId,
        user.customerId, // If you have customer ID stored
        {
          user_email: user.email,
          plan_id: plan.id,
          billing_interval: billingInterval
        }
      );

    } catch (err) {
      setError(err.message);
      logSecurityEvent('PLAN_SELECTION_ERROR', { 
        error: err.message,
        planId: plan.id 
      });
    } finally {
      setIsLoading(false);
      setSelectedPlan(null);
    }
  };

  const getAdjustedPrice = (basePrice) => {
    if (billingInterval === 'yearly') {
      return basePrice * 12 * 0.9; // 10% discount for yearly
    }
    return basePrice;
  };

  const features = [
    {
      title: 'Inventory Management',
      items: [
        'Real-time stock tracking',
        'Automated low stock alerts',
        'Barcode scanning support',
        'Bulk import/export'
      ]
    },
    {
      title: 'Team Collaboration',
      items: [
        'Multi-user access',
        'Role-based permissions',
        'Activity logging',
        'Team notifications'
      ]
    },
    {
      title: 'Analytics & Reporting',
      items: [
        'Inventory valuation',
        'Stock movement reports',
        'Custom dashboards',
        'Export to Excel/PDF'
      ]
    },
    {
      title: 'Security & Compliance',
      items: [
        'Bank-level encryption',
        'Regular backups',
        'Audit trails',
        'GDPR compliance'
      ]
    }
  ];

  const testimonials = [
    {
      name: 'Sarah Johnson',
      company: 'Tech Solutions Ltd',
      text: 'Trackio has revolutionized how we manage our inventory. The real-time tracking and automated alerts have saved us countless hours.',
      rating: 5
    },
    {
      name: 'Michael Chen',
      company: 'Retail Express',
      text: 'The team collaboration features are fantastic. Our entire team can now work together seamlessly on inventory management.',
      rating: 5
    },
    {
      name: 'Emma Williams',
      company: 'Manufacturing Plus',
      text: 'The analytics and reporting capabilities have given us insights we never had before. Highly recommended!',
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Start your inventory management journey with a plan that fits your business needs
          </p>
        </motion.div>

        {/* Billing Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-12"
        >
          <div className="bg-gray-800 rounded-lg p-1 flex">
            <button
              onClick={() => setBillingInterval('monthly')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                billingInterval === 'monthly'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('yearly')}
              className={`px-6 py-2 rounded-md font-medium transition-colors relative ${
                billingInterval === 'yearly'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Yearly
              <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs px-1 rounded-full">
                10% OFF
              </span>
            </button>
          </div>
        </motion.div>

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

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {Object.values(SUBSCRIPTION_PLANS).map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
            >
              <PricingCard
                plan={{
                  ...plan,
                  price: plan.price === 'Custom' ? 'Custom' : getAdjustedPrice(plan.price)
                }}
                isPopular={plan.highlighted}
                onSelectPlan={handlePlanSelect}
                isLoading={isLoading && selectedPlan?.id === plan.id}
                buttonText={plan.id === 'enterprise' ? 'Contact Sales' : null}
              />
            </motion.div>
          ))}
        </div>

        {/* Features Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-16"
        >
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Everything You Need to Manage Inventory
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Powerful features designed to streamline your inventory management process
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                className="bg-gray-800 rounded-lg p-6"
              >
                <h3 className="text-lg font-semibold text-white mb-4">
                  {feature.title}
                </h3>
                <ul className="space-y-2">
                  {feature.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start">
                      <RiCheckLine className="h-5 w-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-300 text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Testimonials */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mb-16"
        >
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Trusted by Growing Businesses
            </h2>
            <p className="text-gray-400">
              See what our customers have to say about Trackio
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 + index * 0.1 }}
                className="bg-gray-800 rounded-lg p-6"
              >
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <RiStarLine key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-300 mb-4">"{testimonial.text}"</p>
                <div>
                  <p className="text-white font-semibold">{testimonial.name}</p>
                  <p className="text-gray-400 text-sm">{testimonial.company}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="mb-16"
        >
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-6">
            {[
              {
                question: 'Can I change my plan at any time?',
                answer: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we\'ll prorate the billing accordingly.'
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
              },
              {
                question: 'Can I cancel at any time?',
                answer: 'Yes, you can cancel your subscription at any time. You\'ll continue to have access until the end of your current billing period.'
              }
            ].map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 + index * 0.1 }}
                className="bg-gray-800 rounded-lg p-6"
              >
                <h3 className="text-lg font-semibold text-white mb-2">
                  {faq.question}
                </h3>
                <p className="text-gray-300">{faq.answer}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="text-center bg-primary-600 rounded-lg p-8"
        >
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-primary-100 mb-6 max-w-2xl mx-auto">
            Join thousands of businesses that trust Trackio to manage their inventory efficiently
          </p>
          <button
            onClick={() => !user ? navigate('/register') : handlePlanSelect(SUBSCRIPTION_PLANS.professional)}
            className="inline-flex items-center px-8 py-3 bg-white text-primary-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            {!user ? 'Start Free Trial' : 'Choose Plan'}
            <RiArrowRightLine className="h-5 w-5 ml-2" />
          </button>
        </motion.div>
      </div>
    </div>
  );
}