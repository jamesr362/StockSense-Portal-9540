import { useState } from 'react';
import { motion } from 'framer-motion';
import { RiCheckLine, RiArrowRightLine } from 'react-icons/ri';
import { SUBSCRIPTION_PLANS, formatPrice } from '../lib/stripe';
import PricingCard from './PricingCard';

export default function SubscriptionPlan({ 
  onPlanSelect, 
  currentPlan, 
  isLoading,
  billingInterval = 'monthly',
  setBillingInterval
}) {
  const plans = Object.values(SUBSCRIPTION_PLANS);

  const handleToggleBilling = (interval) => {
    if (setBillingInterval) {
      setBillingInterval(interval);
    }
  };

  return (
    <div className="space-y-8">
      {/* Billing Toggle - only show if there are yearly options */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex justify-center"
      >
        <div className="bg-gray-800 rounded-lg p-1 flex">
          <button
            onClick={() => handleToggleBilling('monthly')}
            className={`px-6 py-2 rounded-md font-medium transition-colors ${
              billingInterval === 'monthly'
                ? 'bg-primary-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => handleToggleBilling('yearly')}
            className={`px-6 py-2 rounded-md font-medium transition-colors relative ${
              billingInterval === 'yearly'
                ? 'bg-primary-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Yearly
            <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs px-1 rounded-full">
              SAVE
            </span>
          </button>
        </div>
      </motion.div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan, index) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
          >
            <PricingCard
              plan={plan}
              isPopular={plan.highlighted}
              onSelectPlan={() => onPlanSelect(plan, billingInterval)}
              currentPlan={currentPlan}
              isLoading={isLoading && currentPlan?.id === plan.id}
              billingInterval={billingInterval}
            />
          </motion.div>
        ))}
      </div>

      {/* Feature Comparison */}
      <div className="mt-16">
        <h3 className="text-xl font-bold text-white mb-6 text-center">What's Included</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700 rounded-lg overflow-hidden">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Feature
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Free Trial
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Professional
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Power
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {[
                {
                  name: 'Inventory Items',
                  free: '10 only',
                  pro: '2,500',
                  power: 'Unlimited'
                },
                {
                  name: 'Receipt Scans',
                  free: '3/month',
                  pro: '50-100/month',
                  power: 'Unlimited'
                },
                {
                  name: 'Excel Imports',
                  free: '1 lifetime',
                  pro: '10/month',
                  power: 'Unlimited'
                },
                {
                  name: 'Manual Entry',
                  free: '✓',
                  pro: 'Unlimited',
                  power: 'Unlimited'
                },
                {
                  name: 'Team Members',
                  free: '1',
                  pro: '3',
                  power: 'Unlimited'
                },
              ].map((feature, i) => (
                <motion.tr
                  key={feature.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i }}
                  className={i % 2 === 0 ? 'bg-gray-750' : 'bg-gray-800'}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                    {feature.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    {feature.free === '✓' ? (
                      <RiCheckLine className="h-5 w-5 text-green-400 mx-auto" />
                    ) : feature.free === '✗' ? (
                      <div className="h-5 w-5 text-gray-500 mx-auto flex items-center justify-center">—</div>
                    ) : (
                      <span className={`text-xs ${feature.free.includes('only') || feature.free === '1' || feature.free === '3/month' ? 'text-yellow-400' : 'text-gray-300'}`}>
                        {feature.free}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    {feature.pro === '✓' ? (
                      <RiCheckLine className="h-5 w-5 text-green-400 mx-auto" />
                    ) : feature.pro === '✗' ? (
                      <div className="h-5 w-5 text-gray-500 mx-auto">—</div>
                    ) : (
                      <span className="text-gray-300">{feature.pro}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    {feature.power === '✓' ? (
                      <RiCheckLine className="h-5 w-5 text-green-400 mx-auto" />
                    ) : feature.power === '✗' ? (
                      <div className="h-5 w-5 text-gray-500 mx-auto">—</div>
                    ) : (
                      <span className="text-primary-400 font-medium">{feature.power}</span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Urgency Message */}
      <div className="mt-12 bg-gradient-to-r from-primary-900/50 to-purple-900/50 border border-primary-700 rounded-lg p-6 text-center">
        <h4 className="text-lg font-semibold text-white mb-2">
          Ready to Scale Your Business?
        </h4>
        <p className="text-gray-300 mb-4">
          Most businesses outgrow the free trial within 24-48 hours. Upgrade now to avoid hitting limits when you need it most.
        </p>
        <div className="flex justify-center">
          <button
            onClick={() => onPlanSelect(SUBSCRIPTION_PLANS.pro, billingInterval)}
            className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
          >
            Upgrade to Professional <RiArrowRightLine className="h-5 w-5 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
}