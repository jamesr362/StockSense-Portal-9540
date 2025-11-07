import { motion } from 'framer-motion';
import { useState } from 'react';
import { RiCalendarLine, RiLineChartLine } from 'react-icons/ri';
import { useAuth } from '../context/AuthContext';
import useSubscription from '../hooks/useSubscription';
import SubscriptionStatus from '../components/SubscriptionStatus';
import PlanUpgradeModal from '../components/PlanUpgradeModal';
import { SUBSCRIPTION_PLANS } from '../lib/stripe';

export default function SubscriptionManagement() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const { user } = useAuth();
  
  const {
    subscription,
    planLimits,
    loading,
    error,
    isActive,
    isCanceled,
    willCancelAtPeriodEnd,
    currentPlan,
    updateSubscription,
    cancelSubscription,
    reactivateSubscription
  } = useSubscription();

  const tabs = [
    { id: 'overview', name: 'Overview', icon: RiLineChartLine },
    { id: 'subscription', name: 'Subscription', icon: RiCalendarLine }
  ];

  const handlePlanUpgrade = async (plan) => {
    try {
      setIsProcessing(true);
      const subscriptionData = {
        planId: plan.priceId,
        status: 'active',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };
      await updateSubscription(subscriptionData);
      setShowUpgradeModal(false);
      // Show success message
      alert(`Successfully upgraded to ${plan.name}!`);
    } catch (error) {
      console.error('Upgrade failed:', error);
      alert('Failed to upgrade. Please try again later.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setIsProcessing(true);
      
      // Cancel at period end (keeps access until billing period ends)
      await cancelSubscription(true);
      
      setShowCancelModal(false);
      alert('Subscription cancelled successfully. You will retain access until the end of your billing period.');
      
      // Force refresh the subscription data
      window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
        detail: { userEmail: user?.email, force: true, immediate: true }
      }));
      
    } catch (error) {
      console.error('Cancel failed:', error);
      alert(`Failed to cancel subscription: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReactivateSubscription = async () => {
    try {
      setIsProcessing(true);
      await reactivateSubscription('price_professional');
      alert('Subscription reactivated successfully!');
      
      // Force refresh the subscription data
      window.dispatchEvent(new CustomEvent('subscriptionUpdated', {
        detail: { userEmail: user?.email, force: true, immediate: true }
      }));
      
    } catch (error) {
      console.error('Reactivation failed:', error);
      alert(`Failed to reactivate subscription: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const currentPlanDetails = SUBSCRIPTION_PLANS[currentPlan] || SUBSCRIPTION_PLANS.free;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-semibold text-white">Subscription Management</h1>
            <p className="mt-2 text-sm text-gray-400">
              Manage your subscription and view usage
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <SubscriptionStatus subscription={subscription} />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg"
          >
            <p className="text-red-300 text-sm">{error}</p>
          </motion.div>
        )}

        {/* Cancellation Notice */}
        {willCancelAtPeriodEnd && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-yellow-900/50 border border-yellow-700 rounded-lg"
          >
            <p className="text-yellow-300 text-sm">
              <strong>Notice:</strong> Your subscription is set to cancel at the end of your billing period 
              ({subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-GB') : 'N/A'}). 
              You can reactivate it at any time before then.
            </p>
          </motion.div>
        )}

        {/* Tab Navigation */}
        <div className="mt-8">
          <div className="border-b border-gray-700">
            <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <tab.icon className="h-5 w-5 mr-2" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-8">
          {activeTab === 'overview' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Current Plan Overview */}
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-white">Current Plan</h3>
                  <button
                    onClick={() => setShowUpgradeModal(true)}
                    className="text-primary-400 hover:text-primary-300 text-sm font-medium"
                  >
                    Change Plan
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="col-span-1">
                    <div className="text-center p-4 bg-gray-700 rounded-lg">
                      <h4 className="text-xl font-bold text-white mb-2">
                        {currentPlanDetails.name}
                      </h4>
                      <p className="text-3xl font-bold text-primary-400">
                        {currentPlanDetails.price === 0 ? 'Free' : `£${currentPlanDetails.price}`}
                      </p>
                      {currentPlanDetails.price > 0 && (
                        <p className="text-gray-400 text-sm">per month</p>
                      )}
                      {willCancelAtPeriodEnd && (
                        <p className="text-yellow-400 text-xs mt-2">Cancels on period end</p>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <h5 className="text-white font-medium mb-3">Plan Features</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {currentPlanDetails.features.slice(0, 6).map((feature, index) => (
                        <div key={index} className="flex items-start text-sm">
                          <div className="w-2 h-2 bg-green-400 rounded-full mt-2 mr-2 flex-shrink-0"></div>
                          <span className="text-gray-300">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-800 p-6 rounded-lg">
                  <div className="flex items-center">
                    <RiCalendarLine className="h-8 w-8 text-blue-400 mr-3" />
                    <div>
                      <div className="text-2xl font-bold text-white">
                        {subscription?.currentPeriodEnd 
                          ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short'
                            })
                          : 'N/A'
                        }
                      </div>
                      <div className="text-gray-400 text-sm">
                        {willCancelAtPeriodEnd ? 'Cancels On' : 'Next Billing Date'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg">
                  <div className="flex items-center">
                    <RiLineChartLine className="h-8 w-8 text-green-400 mr-3" />
                    <div>
                      <div className="text-2xl font-bold text-white">
                        £{currentPlanDetails.price || 0}
                      </div>
                      <div className="text-gray-400 text-sm">Monthly Cost</div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg">
                  <div className="flex items-center">
                    <RiLineChartLine className="h-8 w-8 text-purple-400 mr-3" />
                    <div>
                      <div className="text-2xl font-bold text-white">
                        {planLimits?.planLimits?.inventoryItems === -1 ? '∞' : planLimits?.planLimits?.inventoryItems || 0}
                      </div>
                      <div className="text-gray-400 text-sm">Item Limit</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'subscription' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {/* Subscription details will be rendered here */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-medium text-white mb-4">Subscription Details</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Plan</label>
                      <div className="text-white font-medium">{currentPlanDetails.name}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                      <div className="text-white font-medium">
                        <SubscriptionStatus subscription={subscription} compact />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Monthly Cost</label>
                      <div className="text-white font-medium">
                        {currentPlanDetails.price === 0 ? 'Free' : `£${currentPlanDetails.price}`}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Next Billing</label>
                      <div className="text-white font-medium">
                        {subscription?.currentPeriodEnd 
                          ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-GB')
                          : 'N/A'
                        }
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-700">
                    <button
                      onClick={() => setShowUpgradeModal(true)}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      Change Plan
                    </button>
                    {isActive && !willCancelAtPeriodEnd && (
                      <button
                        onClick={() => setShowCancelModal(true)}
                        disabled={isProcessing}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {isProcessing ? 'Cancelling...' : 'Cancel Subscription'}
                      </button>
                    )}
                    {willCancelAtPeriodEnd && (
                      <button
                        onClick={handleReactivateSubscription}
                        disabled={isProcessing}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {isProcessing ? 'Reactivating...' : 'Reactivate Subscription'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Plan Upgrade Modal */}
      <PlanUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentPlan={currentPlan}
        onUpgrade={handlePlanUpgrade}
      />

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 rounded-lg p-6 max-w-md mx-4"
          >
            <h3 className="text-lg font-semibold text-white mb-4">
              Cancel Subscription
            </h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to cancel your subscription? You'll keep access to premium features until the end of your current billing period, then be downgraded to the Free plan.
            </p>
            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3 mb-6">
              <p className="text-blue-300 text-sm">
                <strong>Your access ends:</strong> {subscription?.currentPeriodEnd 
                  ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })
                  : 'End of billing period'
                }
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={isProcessing}
                className="flex-1 py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={isProcessing}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isProcessing ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Cancelling...
                  </div>
                ) : (
                  'Cancel Subscription'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}