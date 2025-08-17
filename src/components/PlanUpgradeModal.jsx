import { motion, AnimatePresence } from 'framer-motion';
import { RiCloseLine, RiCheckLine, RiArrowRightLine, RiStarLine } from 'react-icons/ri';
import { useState } from 'react';
import { SUBSCRIPTION_PLANS, formatPrice } from '../lib/stripe';

export default function PlanUpgradeModal({ isOpen, onClose, currentPlan, onUpgrade }) {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(false);

  const plans = Object.values(SUBSCRIPTION_PLANS);
  const availableUpgrades = plans.filter(plan => 
    plan.price > (SUBSCRIPTION_PLANS[currentPlan]?.price || 0)
  );

  const handleUpgrade = async () => {
    if (!selectedPlan) return;

    try {
      setLoading(true);
      // Simulate API call with delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      await onUpgrade(selectedPlan, 'monthly');
      onClose();
    } catch (error) {
      console.error('Upgrade error:', error);
      alert('Failed to upgrade. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-75"
        >
          <div className="flex min-h-screen items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-4xl bg-gray-800 rounded-lg shadow-xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-700">
                <div>
                  <h3 className="text-lg font-medium text-white">Upgrade Your Plan</h3>
                  <p className="mt-1 text-sm text-gray-400">
                    Choose a plan that better fits your growing needs
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-300 focus:outline-none"
                >
                  <RiCloseLine className="h-6 w-6" />
                </button>
              </div>

              {/* Plan Options */}
              <div className="p-6">
                {availableUpgrades.length === 0 ? (
                  <div className="text-center py-8">
                    <RiStarLine className="mx-auto h-12 w-12 text-yellow-400 mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">
                      You're on the highest plan!
                    </h3>
                    <p className="text-gray-400">
                      You're already enjoying all the premium features we offer.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {availableUpgrades.map((plan) => (
                      <motion.div
                        key={plan.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`border rounded-lg p-6 cursor-pointer transition-all ${
                          selectedPlan?.id === plan.id
                            ? 'border-primary-500 bg-primary-50/5'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                        onClick={() => setSelectedPlan(plan)}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-semibold text-white">{plan.name}</h4>
                          {plan.highlighted && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                              <RiStarLine className="h-3 w-3 mr-1" />
                              Popular
                            </span>
                          )}
                        </div>
                        <div className="mb-4">
                          <div className="flex items-baseline">
                            <span className="text-3xl font-bold text-white">
                              {plan.price === 0 ? 'Free' : `£${plan.price}`}
                            </span>
                            {plan.price > 0 && (
                              <span className="text-gray-400 ml-1">/month</span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2 mb-6">
                          {plan.features.slice(0, 4).map((feature, index) => (
                            <div key={index} className="flex items-start">
                              <RiCheckLine className="h-4 w-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                              <span className="text-gray-300 text-sm">{feature}</span>
                            </div>
                          ))}
                          {plan.features.length > 4 && (
                            <div className="text-gray-400 text-sm">
                              +{plan.features.length - 4} more features
                            </div>
                          )}
                        </div>
                        <div
                          className={`w-full py-2 px-4 rounded-lg text-center text-sm font-medium transition-colors ${
                            selectedPlan?.id === plan.id
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {selectedPlan?.id === plan.id ? 'Selected' : 'Select Plan'}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {availableUpgrades.length > 0 && (
                <div className="flex justify-between items-center p-6 border-t border-gray-700">
                  <div className="text-sm text-gray-400">
                    {selectedPlan && (
                      <span>
                        Upgrading to <strong className="text-white">{selectedPlan.name}</strong>
                        <span className="text-gray-300 ml-1">
                          - Billed monthly
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpgrade}
                      disabled={!selectedPlan || loading}
                      className="inline-flex items-center px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Processing...
                        </div>
                      ) : (
                        <>
                          Upgrade Now
                          <RiArrowRightLine className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}