import { motion } from 'framer-motion';
import { RiCheckLine, RiCloseLine } from 'react-icons/ri';
import RoleComparison from '../components/RoleComparison';

export default function PricingGuide() {
  const plans = [
    {
      name: 'Starter',
      price: '$29',
      description: 'Perfect for small businesses just getting started',
      features: [
        'Up to 500 inventory items',
        'Basic stock alerts',
        '2 team members',
        'Email support',
        'Mobile app access',
      ],
    },
    {
      name: 'Professional',
      price: '$79',
      description: 'Ideal for growing businesses with multiple locations',
      features: [
        'Unlimited inventory items',
        'Advanced analytics',
        '10 team members',
        'Priority support',
        'Multiple locations',
        'Custom categories',
        'Batch operations',
      ],
      highlighted: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      description: 'Tailored solutions for large operations',
      features: [
        'All Professional features',
        'Unlimited team members',
        'Dedicated account manager',
        'Custom API access',
        'Advanced security features',
        'Custom integrations',
      ],
    },
  ];

  const implementationSteps = [
    {
      title: 'Initial Setup',
      description: 'Create your account and configure basic settings',
      duration: '1-2 hours',
    },
    {
      title: 'Data Import',
      description: 'Import your existing inventory data',
      duration: '2-4 hours',
    },
    {
      title: 'Team Training',
      description: 'Train your team on basic system operations',
      duration: '1-2 days',
    },
    {
      title: 'Go Live',
      description: 'Start using Trackio in your daily operations',
      duration: 'Immediate',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Pricing & Implementation</h1>
        
        {/* Pricing Plans */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className={`rounded-lg shadow-lg overflow-hidden ${
                plan.highlighted ? 'border-2 border-primary-500' : 'border border-gray-200'
              }`}
            >
              <div className="px-6 py-8">
                <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                <div className="mt-4 flex items-baseline text-gray-900">
                  <span className="text-5xl font-extrabold tracking-tight">{plan.price}</span>
                  {plan.price !== 'Custom' && <span className="ml-1 text-xl font-semibold">/month</span>}
                </div>
                <p className="mt-5 text-lg text-gray-500">{plan.description}</p>
              </div>
              <div className="px-6 pt-6 pb-8">
                <ul className="space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <div className="flex-shrink-0">
                        <RiCheckLine className="h-6 w-6 text-green-500" />
                      </div>
                      <p className="ml-3 text-base text-gray-700">{feature}</p>
                    </li>
                  ))}
                </ul>
                <button
                  className={`mt-8 block w-full rounded-md px-6 py-3 text-center text-sm font-semibold transition-all ${
                    plan.highlighted
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'bg-primary-50 text-primary-600 hover:bg-primary-100'
                  }`}
                >
                  Get started
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Role Comparison */}
        <RoleComparison />

        {/* Implementation Guide */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Implementation Guide</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {implementationSteps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white rounded-lg shadow p-6"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 text-primary-600 mb-4">
                  {index + 1}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600 mb-2">{step.description}</p>
                <p className="text-sm text-gray-500">Duration: {step.duration}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}