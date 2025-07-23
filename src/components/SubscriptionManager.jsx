import {useState, useEffect} from 'react';
import {motion} from 'framer-motion';
import { 
  RiCreditCard2Fill, 
  RiCalendarLine, 
  RiArrowRightLine, 
  RiCheckLine, 
  RiAlertLine, 
  RiSettings3Line, 
  RiDownloadLine, 
  RiRefreshLine 
} from 'react-icons/ri';
import {SUBSCRIPTION_PLANS, formatPrice} from '../lib/stripe';
import {logSecurityEvent} from '../utils/security';

// Mock Stripe services for demo purposes
const mockStripeServices = {
  getCustomerSubscription: async () => ({
    id: 'sub_demo',
    status: 'active',
    price_id: 'price_professional_monthly',
    amount: 7900,
    current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
  }),
  getPaymentMethods: async () => ([
    {
      id: 'pm_demo',
      card: {
        brand: 'visa',
        last4: '4242',
        exp_month: 12,
        exp_year: 2025
      },
      is_default: true
    }
  ]),
  getUsageData: async () => ({
    inventory_items: 150,
    team_members: 3
  }),
  cancelSubscription: async () => ({ status: 'canceled' }),
  updateSubscription: async () => ({ status: 'active' }),
  createPortalSession: async () => {
    window.open('https://billing.stripe.com', '_blank');
  }
};

export default function SubscriptionManager({customerId, onSubscriptionChange}) {
  const [subscription, setSubscription] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [usageData, setUsageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    if (customerId) {
      loadSubscriptionData();
    }
  }, [customerId]);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [subData, paymentData, usageInfo] = await Promise.all([
        mockStripeServices.getCustomerSubscription(customerId),
        mockStripeServices.getPaymentMethods(customerId),
        subscription?.id ? mockStripeServices.getUsageData(subscription.id) : Promise.resolve(null)
      ]);
      
      setSubscription(subData);
      setPaymentMethods(paymentData);
      setUsageData(usageInfo);
      logSecurityEvent('SUBSCRIPTION_DATA_LOADED', { customerId });
    } catch (err) {
      setError(err.message);
      logSecurityEvent('SUBSCRIPTION_DATA_ERROR', { error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription?.id) return;
    
    try {
      setActionLoading(true);
      await mockStripeServices.cancelSubscription(subscription.id);
      await loadSubscriptionData();
      onSubscriptionChange?.();
      setShowCancelConfirm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateSubscription = async (newPriceId) => {
    if (!subscription?.id) return;
    
    try {
      setActionLoading(true);
      await mockStripeServices.updateSubscription(subscription.id, newPriceId);
      await loadSubscriptionData();
      onSubscriptionChange?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenPortal = async () => {
    try {
      setActionLoading(true);
      await mockStripeServices.createPortalSession(customerId);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getSubscriptionStatus = () => {
    if (!subscription) return { text: 'No subscription', color: 'text-gray-400' };
    
    switch (subscription.status) {
      case 'active': return { text: 'Active', color: 'text-green-400' };
      case 'canceled': return { text: 'Canceled', color: 'text-red-400' };
      case 'past_due': return { text: 'Past Due', color: 'text-yellow-400' };
      case 'unpaid': return { text: 'Unpaid', color: 'text-red-400' };
      default: return { text: subscription.status, color: 'text-gray-400' };
    }
  };

  const getCurrentPlan = () => {
    if (!subscription?.price_id) return null;
    return Object.values(SUBSCRIPTION_PLANS).find(
      plan => plan.priceId === subscription.price_id
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
  const currentPlan = getCurrentPlan();

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-900/50 border border-red-700 rounded-lg"
        >
          <div className="flex items-center">
            <RiAlertLine className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        </motion.div>
      )}

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
                  {formatPrice(subscription.amount / 100)}/month
                </p>
              </div>
              <div className="text-right">
                <span className={`font-medium ${status.color}`}>
                  {status.text}
                </span>
                <p className="text-gray-400 text-sm">
                  {subscription.current_period_end && (
                    <>Next billing: {formatDate(subscription.current_period_end)}</>
                  )}
                </p>
              </div>
            </div>

            {/* Usage Information */}
            {usageData && (
              <div className="p-4 bg-gray-700 rounded-lg">
                <h5 className="font-medium text-white mb-2">Current Usage</h5>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Inventory Items:</span>
                    <span className="text-white ml-2">{usageData.inventory_items}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Team Members:</span>
                    <span className="text-white ml-2">{usageData.team_members}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleOpenPortal}
                disabled={actionLoading}
                className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                <RiSettings3Line className="h-4 w-4 mr-2" />
                Manage Billing
              </button>

              {subscription.status === 'active' && (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={actionLoading}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  Cancel Subscription
                </button>
              )}

              {subscription.invoice_pdf && (
                <a
                  href={subscription.invoice_pdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <RiDownloadLine className="h-4 w-4 mr-2" />
                  Download Invoice
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <RiCreditCard2Fill className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h4 className="text-white font-medium mb-2">No Active Subscription</h4>
            <p className="text-gray-400 text-sm">
              Choose a plan to get started with premium features
            </p>
          </div>
        )}
      </div>

      {/* Plan Upgrade Options */}
      {subscription && currentPlan && (
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Upgrade Options</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.values(SUBSCRIPTION_PLANS)
              .filter(plan => plan.price > currentPlan.price)
              .map(plan => (
                <div key={plan.id} className="p-4 bg-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-white">{plan.name}</h4>
                    <span className="text-primary-400 font-semibold">
                      {formatPrice(plan.price)}/month
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-3">
                    {plan.features.slice(0, 2).join(', ')}
                  </p>
                  <button
                    onClick={() => handleUpdateSubscription(plan.priceId)}
                    disabled={actionLoading}
                    className="w-full py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center justify-center">
                      {actionLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <>
                          Upgrade to {plan.name}
                          <RiArrowRightLine className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </div>
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Payment Methods */}
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-white mb-4">Payment Methods</h3>
        {paymentMethods.length > 0 ? (
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <div key={method.id} className="flex items-center p-3 bg-gray-700 rounded-lg">
                <RiCreditCard2Fill className="h-5 w-5 text-gray-400 mr-3" />
                <div className="flex-1">
                  <p className="text-white">
                    •••• •••• •••• {method.card.last4}
                  </p>
                  <p className="text-gray-400 text-sm">
                    {method.card.brand.toUpperCase()} expires {method.card.exp_month}/{method.card.exp_year}
                  </p>
                </div>
                {method.is_default && (
                  <span className="text-green-400 text-sm font-medium">Default</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">No payment methods on file</p>
        )}
        <button
          onClick={handleOpenPortal}
          className="mt-4 w-full py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Manage Payment Methods
        </button>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
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
              Are you sure you want to cancel your subscription? You'll lose access to premium features at the end of your current billing period.
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