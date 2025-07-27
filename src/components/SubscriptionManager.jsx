import {useState, useEffect} from 'react';
import {motion} from 'framer-motion';
import {RiCreditCardLine, RiCalendarLine, RiArrowRightLine, RiCheckLine, RiAlertLine, RiSettings3Line, RiDownloadLine, RiRefreshLine} from 'react-icons/ri';
import {SUBSCRIPTION_PLANS, formatPrice} from '../lib/stripe';
import {logSecurityEvent} from '../utils/security';
import {useNavigate} from 'react-router-dom';
import BillingHistory from './BillingHistory';
import PaymentMethodManager from './PaymentMethodManager';
import SubscriptionUsageWidget from './SubscriptionUsageWidget';

export default function SubscriptionManager({customerId, onSubscriptionChange}) {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  const navigate = useNavigate();

  const tabs = [
    {id: 'overview', name: 'Overview'},
    {id: 'usage', name: 'Usage'},
    {id: 'payment', name: 'Payment Methods'},
    {id: 'billing', name: 'Billing History'},
  ];

  useEffect(() => {
    if (customerId) {
      loadSubscriptionData();
    }
  }, [customerId]);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Mock subscription data
      const mockSubscription = {
        id: 'sub_demo',
        status: 'active',
        price_id: 'price_pro_monthly',
        amount: 1200, // £12.00 in pence
        billing_interval: 'monthly',
        current_period_start: Math.floor(Date.now() / 1000) - (5 * 24 * 60 * 60), // 5 days ago
        current_period_end: Math.floor(Date.now() / 1000) + (25 * 24 * 60 * 60), // 25 days from now
        trial_end: null,
        cancel_at_period_end: false,
        canceled_at: null,
      };

      setSubscription(mockSubscription);
      logSecurityEvent('SUBSCRIPTION_DATA_LOADED', {customerId});
    } catch (err) {
      setError(err.message);
      logSecurityEvent('SUBSCRIPTION_DATA_ERROR', {error: err.message});
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription?.id) return;

    try {
      setActionLoading(true);
      
      // Mock cancellation API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      logSecurityEvent('SUBSCRIPTION_CANCELLED', {
        subscriptionId: subscription.id
      });

      // Update subscription status
      setSubscription({
        ...subscription,
        cancel_at_period_end: true,
        canceled_at: Math.floor(Date.now() / 1000)
      });

      // Notify parent component
      if (onSubscriptionChange) {
        onSubscriptionChange({status: 'canceling'});
      }

      setShowCancelConfirm(false);
    } catch (err) {
      setError(err.message);
      logSecurityEvent('SUBSCRIPTION_CANCEL_ERROR', {error: err.message});
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivateSubscription = async () => {
    try {
      setActionLoading(true);
      
      // Mock reactivation API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      logSecurityEvent('SUBSCRIPTION_REACTIVATED', {
        subscriptionId: subscription.id
      });

      setSubscription({
        ...subscription,
        cancel_at_period_end: false,
        canceled_at: null
      });

      if (onSubscriptionChange) {
        onSubscriptionChange({status: 'active'});
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangePlan = () => {
    navigate('/subscription');
  };

  const getSubscriptionStatus = () => {
    if (!subscription) return {text: 'No subscription', color: 'text-gray-400'};
    
    if (subscription.cancel_at_period_end) {
      return {text: 'Canceling', color: 'text-yellow-400'};
    }
    
    switch (subscription.status) {
      case 'active':
        return {text: 'Active', color: 'text-green-400'};
      case 'canceled':
        return {text: 'Canceled', color: 'text-red-400'};
      case 'past_due':
        return {text: 'Past Due', color: 'text-yellow-400'};
      case 'unpaid':
        return {text: 'Unpaid', color: 'text-red-400'};
      case 'trialing':
        return {text: 'Trial', color: 'text-blue-400'};
      default:
        return {text: subscription.status, color: 'text-gray-400'};
    }
  };

  const getCurrentPlan = () => {
    if (!subscription?.price_id) return null;
    
    // Find plan by price ID
    return Object.values(SUBSCRIPTION_PLANS).find(
      plan => plan.priceId === subscription.price_id || plan.yearlyPriceId === subscription.price_id
    );
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const status = getSubscriptionStatus();
  const currentPlan = getCurrentPlan() || SUBSCRIPTION_PLANS.free;
  const isYearly = subscription?.billing_interval === 'yearly';

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <motion.div
          initial={{opacity: 0, y: -10}}
          animate={{opacity: 1, y: 0}}
          className="p-4 bg-red-900/50 border border-red-700 rounded-lg"
        >
          <div className="flex items-center">
            <RiAlertLine className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        </motion.div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-700">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Current Subscription */}
            <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Current Subscription</h3>
                <button
                  onClick={loadSubscriptionData}
                  disabled={loading}
                  className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <RiRefreshLine className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {subscription ? (
                <div className="space-y-4">
                  {/* Plan Info */}
                  <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                    <div>
                      <h4 className="font-semibold text-white">
                        {currentPlan?.name || 'Custom Plan'}
                      </h4>
                      <p className="text-gray-400 text-sm">
                        {formatPrice(subscription.amount / 100)}/{isYearly ? 'year' : 'month'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`font-medium ${status.color}`}>
                        {status.text}
                      </span>
                      <p className="text-gray-400 text-sm">
                        {subscription.cancel_at_period_end ? (
                          <>Ends: {formatDate(subscription.current_period_end)}</>
                        ) : subscription.current_period_end ? (
                          <>Next billing: {formatDate(subscription.current_period_end)}</>
                        ) : null}
                      </p>
                    </div>
                  </div>

                  {/* Cancellation Warning */}
                  {subscription.cancel_at_period_end && (
                    <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                      <div className="flex items-start">
                        <RiAlertLine className="h-5 w-5 text-yellow-400 mr-3 mt-0.5" />
                        <div>
                          <h4 className="text-yellow-400 font-medium">Subscription Ending</h4>
                          <p className="text-yellow-300 text-sm mt-1">
                            Your subscription will end on {formatDate(subscription.current_period_end)}. 
                            You'll lose access to premium features after this date.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleChangePlan}
                      disabled={actionLoading}
                      className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                    >
                      <RiSettings3Line className="h-4 w-4 mr-2" />
                      Change Plan
                    </button>

                    {subscription.cancel_at_period_end ? (
                      <button
                        onClick={handleReactivateSubscription}
                        disabled={actionLoading}
                        className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        Reactivate Subscription
                      </button>
                    ) : subscription.status === 'active' && (
                      <button
                        onClick={() => setShowCancelConfirm(true)}
                        disabled={actionLoading}
                        className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        Cancel Subscription
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <RiCreditCardLine className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <h4 className="text-white font-medium mb-2">No Active Subscription</h4>
                  <p className="text-gray-400 text-sm">
                    Choose a plan to get started with premium features
                  </p>
                  <button
                    onClick={handleChangePlan}
                    className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    View Plans
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'usage' && (
          <SubscriptionUsageWidget userPlan={currentPlan?.id || 'free'} />
        )}

        {activeTab === 'payment' && (
          <PaymentMethodManager
            customerId={customerId}
            onPaymentMethodChange={(method) => console.log('Payment method changed:', method)}
          />
        )}

        {activeTab === 'billing' && (
          <BillingHistory customerId={customerId} />
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{opacity: 0, scale: 0.95}}
            animate={{opacity: 1, scale: 1}}
            className="bg-gray-800 rounded-lg p-6 max-w-md mx-4"
          >
            <h3 className="text-lg font-semibold text-white mb-4">
              Cancel Subscription
            </h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to cancel your subscription? You'll lose access to premium features 
              at the end of your current billing period on {formatDate(subscription.current_period_end)}.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={actionLoading}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Canceling...' : 'Cancel Subscription'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}