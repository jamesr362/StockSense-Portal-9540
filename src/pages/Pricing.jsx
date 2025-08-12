import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  RiCheckLine, 
  RiArrowRightLine, 
  RiStarLine, 
  RiShieldCheckLine,
  RiBarChart2Line,
  RiGlobalLine 
} from 'react-icons/ri';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { logSecurityEvent } from '../utils/security';
import { SUBSCRIPTION_PLANS, formatPrice } from '../lib/stripe';
import { getUserSubscriptionSupabase } from '../services/supabaseDb';

export default function Pricing() {
  const [billingInterval, setBillingInterval] = useState('monthly');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPlanId, setCurrentPlanId] = useState('free');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    logSecurityEvent('PRICING_PAGE_VIEW', { 
      userEmail: user?.email, 
      billingInterval 
    });

    // Load user's current subscription plan
    const loadUserPlan = async () => {
      if (user?.email) {
        try {
          const subscription = await getUserSubscriptionSupabase(user.email);
          if (subscription && subscription.planId) {
            // Extract plan name from price ID (e.g., "price_professional" -> "professional")
            const planName = subscription.planId.split('_')[1];
            if (planName && SUBSCRIPTION_PLANS[planName]) {
              setCurrentPlanId(planName);
            }
          }
        } catch (error) {
          console.error('Error loading subscription:', error);
        }
      }
    };

    loadUserPlan();
  }, [user, billingInterval]);

  const handlePlanSelect = (plan) => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Don't allow selecting current plan
    if (plan.id === currentPlanId) {
      return;
    }

    // Don't allow downgrading from the UI (would need to go through subscription management)
    if (SUBSCRIPTION_PLANS[currentPlanId]?.price > plan.price) {
      setError("To downgrade your plan, please go to Settings > Billing & Subscription");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      logSecurityEvent('PLAN_SELECTION', { 
        planId: plan.id, 
        userEmail: user.email,
        billingInterval 
      });

      // For free plan, redirect to dashboard
      if (plan.id === 'free') {
        navigate('/dashboard');
        return;
      }

      // For paid plans, redirect to Stripe or settings
      if (plan.paymentLink) {
        window.open(plan.paymentLink, '_blank');
      } else {
        navigate('/settings/billing');
      }
    } catch (err) {
      setError(err.message);
      logSecurityEvent('PLAN_SELECTION_ERROR', { 
        error: err.message, 
        planId: plan.id 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    {
      title: 'Inventory Management',
      icon: RiBarChart2Line,
      items: [
        'Real-time stock tracking',
        'Automated low stock alerts',
        'Barcode scanning support',
        'Bulk import/export'
      ]
    },
    {
      title: 'Team Collaboration',
      icon: RiGlobalLine,
      items: [
        'Multi-user access',
        'Role-based permissions',
        'Activity logging',
        'Team notifications'
      ]
    },
    {
      title: 'Analytics & Reporting',
      icon: RiBarChart2Line,
      items: [
        'Inventory valuation',
        'Stock movement reports',
        'Custom dashboards',
        'Export to Excel/PDF'
      ]
    },
    {
      title: 'Security & Compliance',
      icon: RiShieldCheckLine,
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

  const plans = Object.values(SUBSCRIPTION_PLANS);

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
        <div className="flex justify-center mb-12">
          <div className="bg-gray-800 rounded-lg p-1 inline-flex">
            <button
              onClick={() => setBillingInterval('monthly')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                billingInterval === 'monthly'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('yearly')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                billingInterval === 'yearly'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Yearly <span className="text-xs text-green-400 ml-1">Save 10%</span>
            </button>
          </div>
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

        {/* Current Plan Info */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 max-w-md mx-auto"
          >
            <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-4 text-center">
              <p className="text-gray-300 text-sm">
                Your current plan: <span className="text-primary-400 font-semibold">{SUBSCRIPTION_PLANS[currentPlanId]?.name || 'Free'}</span>
              </p>
            </div>
          </motion.div>
        )}

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16 max-w-7xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className={`relative rounded-lg shadow-lg overflow-hidden ${
                plan.highlighted
                  ? 'border-2 border-primary-500 bg-gray-800'
                  : 'border border-gray-700 bg-gray-800'
              }`}
            >
              {/* Popular badge */}
              {plan.highlighted && (
                <div className="absolute top-0 right-0 bg-primary-500 text-white px-3 py-1 text-sm font-medium rounded-bl-lg">
                  <div className="flex items-center">
                    <RiStarLine className="h-4 w-4 mr-1" />
                    Most Popular
                  </div>
                </div>
              )}

              <div className="px-6 py-8">
                {/* Plan name and price */}
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center">
                    <span className="text-4xl font-extrabold text-white">
                      {plan.price === 0 ? 'Free' : plan.price === 'Custom' ? 'Custom' : formatPrice(plan.price)}
                    </span>
                    {plan.price > 0 && plan.price !== 'Custom' && (
                      <span className="text-xl font-semibold text-gray-400 ml-1">/month</span>
                    )}
                  </div>
                  {plan.price > 0 && plan.price !== 'Custom' && billingInterval === 'yearly' && (
                    <p className="text-gray-400 mt-2">
                      {formatPrice(plan.price * 12 * 0.9)}/year (Save 10%)
                    </p>
                  )}
                </div>

                {/* Features list */}
                <div className="space-y-4 mb-8">
                  {plan.features.map((feature, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="flex items-start"
                    >
                      <div className="flex-shrink-0 mr-3">
                        <RiCheckLine className="h-5 w-5 text-green-400" />
                      </div>
                      <p className="text-gray-300 text-sm leading-relaxed">{feature}</p>
                    </motion.div>
                  ))}
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handlePlanSelect(plan)}
                  disabled={isLoading || plan.id === currentPlanId}
                  className={`w-full py-3 px-6 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center ${
                    plan.id === currentPlanId
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : plan.highlighted
                      ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg hover:shadow-xl'
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </div>
                  ) : plan.id === currentPlanId ? (
                    'Current Plan'
                  ) : (
                    <>
                      {plan.price === 0 ? 'Get Started' : plan.price === 'Custom' ? 'Contact Sales' : 'Upgrade'}
                      <RiArrowRightLine className="h-4 w-4 ml-2" />
                    </>
                  )}
                </button>
              </div>
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
                <div className="flex items-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary-400" />
                  <h3 className="text-lg font-semibold text-white ml-2">
                    {feature.title}
                  </h3>
                </div>
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
            onClick={() => !user ? navigate('/register') : navigate('/settings/billing')}
            className="inline-flex items-center px-8 py-3 bg-white text-primary-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            {!user ? 'Start Free Trial' : 'Manage Your Subscription'}
            <RiArrowRightLine className="h-5 w-5 ml-2" />
          </button>
        </motion.div>
      </div>
    </div>
  );
}