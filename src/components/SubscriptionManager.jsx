import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  RiCalendarLine, 
  RiArrowRightLine, 
  RiCheckLine, 
  RiAlertLine, 
  RiSettings3Line, 
  RiDownloadLine, 
  RiRefreshLine,
  RiMoneyDollarCircleLine,
  RiCreditCardLine
} from 'react-icons/ri';
import { SUBSCRIPTION_PLANS, formatPrice, getPlanById, getDaysUntilRenewal } from '../lib/stripe';
import { logSecurityEvent } from '../utils/security';
import { supabase } from '../lib/supabase';

// Mock Stripe services for demo purposes
const mockStripeServices = {
  getCustomerSubscription: async () => ({
    id: 'sub_demo',
    status: 'active',
    price_id: 'price_professional',
    amount: 3500, // £35.00 in pence
    currency: 'gbp',
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
    inventory_items: 250,
    team_members: 3,
    receipt_scans: 85
  }),
  
  cancelSubscription: async () => ({ status: 'canceled' }),
  updateSubscription: async () => ({ status: 'active' }),
  createPortalSession: async () => {
    window.open('https://billing.stripe.com', '_blank');
  }
};

export default function SubscriptionManager({ customerId, onSubscriptionChange }) {
  const [subscription, setSubscription] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [usageData, setUsageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [billingInterval, setBillingInterval] = useState('monthly');

  useEffect(() => {
    if (customerId) {
      loadSubscriptionData();
    }
  }, [customerId]);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);
      setError(null);

      // First try to get data from Supabase if available
      if (supabase) {
        try {
          const { data: subscriptionData, error: subscriptionError } = await supabase
            .from('subscriptions_tb2k4x9p1m')
            .select('*')
            .eq('user_email', customerId)
            .single();

          if (!subscriptionError && subscriptionData) {
            console.log('Loaded subscription from Supabase:', subscriptionData);
            
            // Transform to expected format
            setSubscription({
              id: subscriptionData.stripe_subscription_id || 'sub_demo',
              status: subscriptionData.status || 'active',
              price_id: subscriptionData.plan_id || 'price_professional',
              amount: getPlanAmountFromId(subscriptionData.plan_id) * 100, // convert to pence
              current_period_end: Math.floor(new Date(subscriptionData.current_period_end || Date.now() + 30*24*60*60*1000).getTime() / 1000)
            });
            
            setLoading(false);
            return;
          }
        } catch (err) {
          console.log('Error fetching from Supabase, falling back to mock data:', err);
        }
      }

      // Simulate API calls with a slight delay to feel more realistic
      await new Promise(resolve => setTimeout(resolve, 800));

      const [subData, paymentData, usageInfo] = await Promise.all([
        mockStripeServices.getCustomerSubscription(customerId),
        mockStripeServices.getPaymentMethods(customerId),
        mockStripeServices.getUsageData()
      ]);

      setSubscription(subData);
      setPaymentMethods(paymentData);
      setUsageData(usageInfo);

      logSecurityEvent('SUBSCRIPTION_DATA_LOADED', { customerId });
    } catch (err) {
      console.error('Error loading subscription data:', err);
      setError('Failed to load subscription data. Please try again.');
      logSecurityEvent('SUBSCRIPTION_DATA_ERROR', { error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const getPlanAmountFromId = (planId) => {
    // Extract the plan name from the price ID (e.g., "price_professional" -> "professional")
    const planName = planId?.split('_')[1];
    return SUBSCRIPTION_PLANS[planName]?.price || 35; // Default to Professional plan amount
  };

  const handleCancelSubscription = async () => {
    if (!subscription?.id) return;

    try {
      setActionLoading(true);

      // Try to update in Supabase first
      if (supabase) {
        try {
          const { error } = await supabase
            .from('subscriptions_tb2k4x9p1m')
            .update({ 
              status: 'canceled',
              updated_at: new Date().toISOString()
            })
            .eq('user_email', customerId);

          if (!error) {
            console.log('Updated subscription status in Supabase');
            await loadSubscriptionData();
            onSubscriptionChange?.();
            setShowCancelConfirm(false);
            return;
          }
        } catch (err) {
          console.log('Error updating Supabase, falling back to mock:', err);
        }
      }

      // Simulate API call with a delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      await mockStripeServices.cancelSubscription(subscription.id);
      await loadSubscriptionData();
      onSubscriptionChange?.();
      setShowCancelConfirm(false);
    } catch (err) {
      setError('Failed to cancel subscription. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateSubscription = async (newPriceId) => {
    if (!subscription?.id) return;

    try {
      setActionLoading(true);

      // Try to update in Supabase first
      if (supabase) {
        try {
          const { error } = await supabase
            .from('subscriptions_tb2k4x9p1m')
            .update({ 
              plan_id: newPriceId,
              updated_at: new Date().toISOString()
            })
            .eq('user_email', customerId);

          if (!error) {
            console.log('Updated subscription plan in Supabase');
            await loadSubscriptionData();
            onSubscriptionChange?.();
            return;
          }
        } catch (err) {
          console.log('Error updating Supabase, falling back to mock:', err);
        }
      }

      // Simulate API call with a delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      await mockStripeServices.updateSubscription(subscription.id, newPriceId);
      await loadSubscriptionData();
      onSubscriptionChange?.();
    } catch (err) {
      setError('Failed to update subscription. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenPortal = async () => {
    try {
      setActionLoading(true);
      await mockStripeServices.createPortalSession(customerId);
    } catch (err) {
      setError('Failed to open billing portal. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const getSubscriptionStatus = () => {
    if (!subscription) return { text: 'No subscription', color: 'text-gray-400' };

    switch (subscription.status) {
      case 'active':
        return { text: 'Active', color: 'text-green-400' };
      case 'canceled':
        return { text: 'Canceled', color: 'text-red-400' };
      case 'past_due':
        return { text: 'Past Due', color: 'text-yellow-400' };
      case 'unpaid':
        return { text: 'Unpaid', color: 'text-red-400' };
      default:
        return { text: subscription.status, color: 'text-gray-400' };
    }
  };

  const getCurrentPlan = () => {
    if (!subscription?.price_id) return null;
    
    // Extract plan name from price ID (e.g., "price_professional" -> "professional")
    const planName = subscription.price_id.split('_')[1];
    return SUBSCRIPTION_PLANS[planName];
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

  // Get usage percentage for the progress bars
  const getUsagePercentage = (used, limit) => {
    if (limit === -1) return 0; // Unlimited
    if (limit === 0) return 100; // Not available
    return Math.min((used / limit) * 100, 100);
  };

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
                  {currentPlan?.name || 'Free Plan'}
                </h4>
                <p className="text-gray-400 text-sm">
                  {currentPlan?.price === 0 ? 'Free Plan' : `${formatPrice(currentPlan?.price || 0)}/month`}
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
                <h5 className="font-medium text-white mb-4">Current Usage</h5>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Inventory Items</span>
                      <span className="text-white">
                        {usageData.inventory_items} / {currentPlan.limits.inventoryItems === -1 ? '∞' : currentPlan.limits.inventoryItems}
                      </span>
                    </div>
                    <div className="w-full bg-gray-600 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          getUsagePercentage(usageData.inventory_items, currentPlan.limits.inventoryItems) > 80 
                            ? 'bg-red-500' 
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${getUsagePercentage(usageData.inventory_items, currentPlan.limits.inventoryItems)}%` }}
                      />
                    </div>
                  </div>

                  {currentPlan.limits.receiptScans !== 0 && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Receipt Scans</span>
                        <span className="text-white">
                          {usageData.receipt_scans} / {currentPlan.limits.receiptScans === -1 ? '∞' : currentPlan.limits.receiptScans}
                        </span>
                      </div>
                      <div className="w-full bg-gray-600 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            getUsagePercentage(usageData.receipt_scans, currentPlan.limits.receiptScans) > 80 
                              ? 'bg-red-500' 
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${getUsagePercentage(usageData.receipt_scans, currentPlan.limits.receiptScans)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Team Members</span>
                      <span className="text-white">
                        {usageData.team_members} / {currentPlan.limits.teamMembers === -1 ? '∞' : currentPlan.limits.teamMembers}
                      </span>
                    </div>
                    <div className="w-full bg-gray-600 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          getUsagePercentage(usageData.team_members, currentPlan.limits.teamMembers) > 80 
                            ? 'bg-red-500' 
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${getUsagePercentage(usageData.team_members, currentPlan.limits.teamMembers)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Feature Availability */}
            <div className="p-4 bg-gray-700 rounded-lg">
              <h5 className="font-medium text-white mb-2">Plan Features</h5>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full ${currentPlan.limits.excelImport ? 'bg-green-500' : 'bg-red-500'} mr-2`}></div>
                  <span className="text-sm text-gray-300">Excel Import</span>
                </div>
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full ${currentPlan.limits.receiptScans > 0 ? 'bg-green-500' : 'bg-red-500'} mr-2`}></div>
                  <span className="text-sm text-gray-300">Receipt Scanner</span>
                </div>
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full ${currentPlan.limits.features.includes('custom_categories') ? 'bg-green-500' : 'bg-red-500'} mr-2`}></div>
                  <span className="text-sm text-gray-300">Custom Categories</span>
                </div>
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full ${currentPlan.limits.features.includes('advanced_analytics') ? 'bg-green-500' : 'bg-red-500'} mr-2`}></div>
                  <span className="text-sm text-gray-300">Advanced Analytics</span>
                </div>
              </div>
            </div>

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

              {subscription.status === 'active' && currentPlan.price > 0 && (
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
            <RiMoneyDollarCircleLine className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h4 className="text-white font-medium mb-2">Free Plan</h4>
            <p className="text-gray-400 text-sm">
              You're currently on the Free plan. Upgrade to unlock premium features.
            </p>
          </div>
        )}
      </div>

      {/* Plan Upgrade Options */}
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Upgrade Options</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setBillingInterval('monthly')}
              className={`px-3 py-1 rounded-md text-xs font-medium ${
                billingInterval === 'monthly' 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('yearly')}
              className={`px-3 py-1 rounded-md text-xs font-medium ${
                billingInterval === 'yearly' 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              Yearly <span className="text-green-400">-10%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.values(SUBSCRIPTION_PLANS)
            .filter(plan => {
              // If current plan is free, show Basic and Professional
              if (!currentPlan || currentPlan.id === 'free') {
                return plan.id === 'basic' || plan.id === 'professional';
              }
              // If current plan is basic, show only Professional
              else if (currentPlan.id === 'basic') {
                return plan.id === 'professional';
              }
              // Otherwise, don't show upgrade options
              return false;
            })
            .map(plan => (
              <div key={plan.id} className="p-4 bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-white">{plan.name}</h4>
                  <span className="text-primary-400 font-semibold">
                    {billingInterval === 'yearly' 
                      ? formatPrice(plan.price * 12 * 0.9) + '/year'
                      : formatPrice(plan.price) + '/month'
                    }
                  </span>
                </div>
                <div className="space-y-2 mb-3">
                  {plan.features.slice(0, 3).map((feature, idx) => (
                    <div key={idx} className="flex items-start">
                      <RiCheckLine className="h-4 w-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => handleUpdateSubscription(`price_${plan.id}`)}
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

      {/* Payment Methods */}
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-white mb-4">Payment Methods</h3>
        
        {paymentMethods.length > 0 ? (
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <div key={method.id} className="flex items-center p-3 bg-gray-700 rounded-lg">
                <RiCreditCardLine className="h-5 w-5 text-gray-400 mr-3" />
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
              Are you sure you want to cancel your subscription? You'll lose access to premium features and be downgraded to the Free plan at the end of your current billing period.
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