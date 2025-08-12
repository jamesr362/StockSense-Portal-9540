import {motion} from 'framer-motion';
import {useState} from 'react';
import {RiCalendarLine, RiCreditCardLine, RiTrendingUpLine, RiSettings3Line, RiUserLine} from 'react-icons/ri';
import {useAuth} from '../context/AuthContext';
import useSubscription from '../hooks/useSubscription';
import SubscriptionCard from '../components/SubscriptionCard';
import SubscriptionStatus from '../components/SubscriptionStatus';
import UsageMetrics from '../components/UsageMetrics';
import BillingHistory from '../components/BillingHistory';
import PlanUpgradeModal from '../components/PlanUpgradeModal';
import {SUBSCRIPTION_PLANS} from '../lib/stripe';

export default function SubscriptionManagement() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const {user} = useAuth();
  
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
    {id: 'overview', name: 'Overview', icon: RiTrendingUpLine},
    {id: 'subscription', name: 'Subscription', icon: RiCreditCardLine},
    {id: 'usage', name: 'Usage', icon: RiUserLine},
    {id: 'billing', name: 'Billing History', icon: RiCalendarLine},
    {id: 'settings', name: 'Settings', icon: RiSettings3Line}
  ];

  const handlePlanUpgrade = async (plan, billingInterval) => {
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
    if (!window.confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.')) {
      return;
    }

    try {
      setIsProcessing(true);
      await cancelSubscription(true); // Cancel at period end
      alert('Subscription cancelled successfully. You will retain access until the end of your billing period.');
    } catch (error) {
      console.error('Cancel failed:', error);
      alert('Failed to cancel subscription. Please try again later.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReactivateSubscription = async () => {
    try {
      setIsProcessing(true);
      await reactivateSubscription();
      alert('Subscription reactivated successfully!');
    } catch (error) {
      console.error('Reactivation failed:', error);
      alert('Failed to reactivate subscription. Please try again later.');
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
              Manage your subscription, billing, and usage
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
                          ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                          : 'N/A'
                        }
                      </div>
                      <div className="text-gray-400 text-sm">Next Billing Date</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-800 p-6 rounded-lg">
                  <div className="flex items-center">
                    <RiCreditCardLine className="h-8 w-8 text-green-400 mr-3" />
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
                    <RiTrendingUpLine className="h-8 w-8 text-purple-400 mr-3" />
                    <div>
                      <div className="text-2xl font-bold text-white">
                        {planLimits?.inventoryItems === -1 ? '∞' : planLimits?.inventoryItems || 0}
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
              <SubscriptionCard
                subscription={subscription}
                onUpgrade={() => setShowUpgradeModal(true)}
                onCancel={handleCancelSubscription}
                onReactivate={handleReactivateSubscription}
                isLoading={isProcessing}
              />
            </motion.div>
          )}

          {activeTab === 'usage' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <UsageMetrics userPlan={currentPlan} />
            </motion.div>
          )}

          {activeTab === 'billing' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <BillingHistory customerId={user?.email} />
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-medium text-white mb-4">Subscription Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-medium">Auto-renewal</h4>
                      <p className="text-gray-400 text-sm">Automatically renew your subscription</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        defaultChecked={!willCancelAtPeriodEnd}
                        disabled={!isActive}
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-medium">Email notifications</h4>
                      <p className="text-gray-400 text-sm">Receive billing notifications via email</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
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
    </div>
  );
}