import {useState, useEffect} from 'react';
import {motion} from 'framer-motion';
import {RiCalendarLine, RiArrowRightLine, RiCheckLine, RiAlertLine, RiSettings3Line, RiDownloadLine, RiRefreshLine, RiMoneyDollarCircleLine, RiSecurePaymentLine, RiLineChartLine} from 'react-icons/ri';
import {SUBSCRIPTION_PLANS, formatPrice, getPlanById} from '../lib/stripe';
import {logSecurityEvent} from '../utils/security';
import {supabase} from '../lib/supabase';
import * as stripeService from '../services/stripe';

export default function SubscriptionManager({customerId, onSubscriptionChange}) {
  const [subscription, setSubscription] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [usageData, setUsageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
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

      // Try to get data from Supabase first
      if (supabase) {
        try {
          const {data: subscriptionData, error: subscriptionError} = await supabase
            .from('subscriptions_tb2k4x9p1m')
            .select('*')
            .eq('user_email', customerId)
            .single();

          if (!subscriptionError && subscriptionData) {
            const transformedSubscription = {
              id: subscriptionData.stripe_subscription_id || subscriptionData.id || 'sub_demo',
              status: subscriptionData.status || 'active',
              price_id: subscriptionData.plan_id || 'price_professional',
              amount: getPlanAmountFromId(subscriptionData.plan_id) * 100,
              current_period_end: Math.floor(
                new Date(subscriptionData.current_period_end || Date.now() + 30*24*60*60*1000).getTime() / 1000
              ),
              cancel_at_period_end: subscriptionData.cancel_at_period_end || false,
              canceled_at: subscriptionData.canceled_at,
              supabaseData: subscriptionData
            };

            setSubscription(transformedSubscription);

            // Load additional data
            const [paymentData, usageInfo] = await Promise.all([
              stripeService.getPaymentMethods(subscriptionData.stripe_customer_id || customerId),
              stripeService.getUsageData(subscriptionData.stripe_subscription_id)
            ]);

            setPaymentMethods(paymentData);
            setUsageData(usageInfo);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.log('Error fetching from Supabase, falling back to Stripe API:', err);
        }
      }

      // Fallback to Stripe API calls
      const [subData, paymentData, usageInfo] = await Promise.all([
        stripeService.getCustomerSubscription(customerId),
        stripeService.getPaymentMethods(customerId),
        stripeService.getUsageData()
      ]);

      setSubscription(subData);
      setPaymentMethods(paymentData);
      setUsageData(usageInfo);

      logSecurityEvent('SUBSCRIPTION_DATA_LOADED', {customerId});

    } catch (err) {
      console.error('Error loading subscription data:', err);
      setError('Failed to load subscription data. Please try again.');
      logSecurityEvent('SUBSCRIPTION_DATA_ERROR', {error: err.message});
    } finally {
      setLoading(false);
    }
  };

  const getPlanAmountFromId = (planId) => {
    const planName = planId?.split('_')[1];
    return SUBSCRIPTION_PLANS[planName]?.price || 9.99;
  };

  const handleCancelSubscription = async () => {
    if (!subscription?.id) return;

    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);

      // Get the actual Stripe IDs from Supabase data
      const stripeSubscriptionId = subscription?.supabaseData?.stripe_subscription_id || subscription?.id;
      const stripeCustomerId = subscription?.supabaseData?.stripe_customer_id || customerId;
      
      // Call the cancellation service
      const cancelResult = await stripeService.cancelSubscription(stripeSubscriptionId, stripeCustomerId);

      // Update in Supabase to reflect the cancellation
      if (supabase) {
        try {
          const {error} = await supabase
            .from('subscriptions_tb2k4x9p1m')
            .update({
              status: cancelResult.status,
              cancel_at_period_end: cancelResult.cancel_at_period_end,
              canceled_at: cancelResult.canceled_at ? new Date(cancelResult.canceled_at * 1000).toISOString() : new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('user_email', customerId);

          if (error) {
            console.log('Error updating Supabase:', error);
          }
        } catch (err) {
          console.log('Error updating Supabase (non-critical):', err);
        }
      }

      // Reload subscription data to reflect changes
      await loadSubscriptionData();
      onSubscriptionChange?.();
      setShowCancelConfirm(false);

      // Show success message
      if (cancelResult.cancel_at_period_end) {
        setSuccess({
          message: 'Subscription cancelled successfully! No future charges will occur.',
          type: 'success',
          stripeVerified: cancelResult.stripeVerified
        });
      } else {
        setSuccess({
          message: 'Subscription cancelled immediately. No future charges will occur.',
          type: 'success',
          stripeVerified: cancelResult.stripeVerified
        });
      }

      logSecurityEvent('SUBSCRIPTION_CANCELLED_SUCCESS', {
        customerId,
        subscriptionId: subscription.id,
        stripeSubscriptionId: stripeSubscriptionId,
        stripeVerified: cancelResult.stripeVerified
      });

    } catch (err) {
      console.error('Cancellation failed:', err);
      setError(`Failed to cancel subscription: ${err.message}`);
      
      if (err.message.includes('STRIPE_SECRET_KEY')) {
        setError('Stripe is not configured. Please add your STRIPE_SECRET_KEY environment variable in Netlify.');
      } else if (err.message.includes('not found')) {
        setError('Subscription not found in Stripe. It may have already been cancelled.');
      }
      
      logSecurityEvent('SUBSCRIPTION_CANCEL_FAILED', {
        customerId,
        subscriptionId: subscription?.id,
        error: err.message
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateSubscription = async (newPriceId) => {
    if (!subscription?.id) return;

    try {
      setActionLoading(true);
      setError(null);

      const stripeSubscriptionId = subscription?.supabaseData?.stripe_subscription_id || subscription?.id;
      
      await stripeService.updateSubscription(stripeSubscriptionId, newPriceId);

      if (supabase) {
        try {
          const {error} = await supabase
            .from('subscriptions_tb2k4x9p1m')
            .update({
              plan_id: newPriceId,
              updated_at: new Date().toISOString()
            })
            .eq('user_email', customerId);

          if (error) {
            console.log('Error updating Supabase:', error);
          }
        } catch (err) {
          console.log('Error updating Supabase:', err);
        }
      }

      await loadSubscriptionData();
      onSubscriptionChange?.();

      setSuccess({
        message: 'Subscription updated successfully!',
        type: 'success'
      });

    } catch (err) {
      console.error('Error updating subscription:', err);
      setError('Failed to update subscription. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenPortal = async () => {
    try {
      setActionLoading(true);
      
      const stripeCustomerId = subscription?.supabaseData?.stripe_customer_id || subscription?.customer || customerId;
      
      await stripeService.createPortalSession(stripeCustomerId);
      
    } catch (err) {
      console.error('Error opening portal:', err);
      setError('Failed to open billing portal. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const getSubscriptionStatus = () => {
    if (!subscription) return {text: 'No subscription', color: 'text-gray-400'};

    if (subscription.cancel_at_period_end && subscription.status === 'active') {
      return {text: 'Canceling (Active until end of period)', color: 'text-orange-400'};
    }

    switch (subscription.status) {
      case 'active': return {text: 'Active', color: 'text-green-400'};
      case 'canceled': return {text: 'Canceled', color: 'text-red-400'};
      case 'past_due': return {text: 'Past Due', color: 'text-yellow-400'};
      case 'unpaid': return {text: 'Unpaid', color: 'text-red-400'};
      default: return {text: subscription.status, color: 'text-gray-400'};
    }
  };

  const getCurrentPlan = () => {
    if (!subscription?.price_id) return null;
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

  const getUsagePercentage = (used, limit) => {
    if (limit === -1) return 0;
    if (limit === 0) return 100;
    return Math.min((used / limit) * 100, 100);
  };

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {success && (
        <motion.div
          initial={{opacity: 0, y: -10}}
          animate={{opacity: 1, y: 0}}
          className="p-4 bg-green-900/50 border border-green-700 rounded-lg"
        >
          <div className="flex items-center">
            <RiCheckLine className="h-5 w-5 text-green-400 mr-2" />
            <div>
              <p className="text-green-300 text-sm font-medium">{success.message}</p>
              {success.stripeVerified && (
                <p className="text-green-400 text-xs mt-1">
                  ✅ Verified in Stripe Dashboard
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

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

      {/* Cancellation Success Notice */}
      {subscription?.cancel_at_period_end && subscription?.status === 'active' && (
        <motion.div
          initial={{opacity: 0, y: -10}}
          animate={{opacity: 1, y: 0}}
          className="p-4 bg-orange-900/50 border border-orange-700 rounded-lg"
        >
          <div className="flex items-center">
            <RiCalendarLine className="h-5 w-5 text-orange-400 mr-2" />
            <div>
              <p className="text-orange-200 font-medium">Subscription Cancelled</p>
              <p className="text-orange-300 text-sm">
                Your subscription will not renew. You'll keep access until {subscription.current_period_end && formatDate(subscription.current_period_end)}.
              </p>
            </div>
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
                  {currentPlan?.price === 0 ? 'Free Plan' : `£${currentPlan?.price || 0}/month`}
                </p>
              </div>
              <div className="text-right">
                <span className={`font-medium ${status.color}`}>
                  {status.text}
                </span>
                <p className="text-gray-400 text-sm">
                  {subscription.current_period_end && (
                    <>
                      {subscription.cancel_at_period_end ? 'Access until: ' : 'Next billing: '}
                      {formatDate(subscription.current_period_end)}
                    </>
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
                        style={{
                          width: `${getUsagePercentage(usageData.inventory_items, currentPlan.limits.inventoryItems)}%`
                        }}
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
                          style={{
                            width: `${getUsagePercentage(usageData.receipt_scans, currentPlan.limits.receiptScans)}%`
                          }}
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
                        style={{
                          width: `${getUsagePercentage(usageData.team_members, currentPlan.limits.teamMembers)}%`
                        }}
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
                {actionLoading ? 'Loading...' : 'Manage Billing'}
              </button>

              {subscription.status === 'active' && currentPlan.price > 0 && !subscription.cancel_at_period_end && (
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
          <span className="text-sm text-gray-400">Monthly billing only</span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {Object.values(SUBSCRIPTION_PLANS)
            .filter(plan => {
              if (!currentPlan || currentPlan.id === 'free') {
                return plan.id === 'professional';
              }
              return false;
            })
            .map(plan => (
              <div key={plan.id} className="p-4 bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-white">{plan.name}</h4>
                  <span className="text-primary-400 font-semibold">
                    £{plan.price}/month
                  </span>
                </div>
                <div className="space-y-2 mb-3">
                  {plan.features.slice(0, 4).map((feature, idx) => (
                    <div key={idx} className="flex items-start">
                      <RiCheckLine className="h-4 w-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </div>
                  ))}
                  {plan.features.length > 4 && (
                    <p className="text-gray-400 text-sm">
                      +{plan.features.length - 4} more features
                    </p>
                  )}
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
              <div
                key={method.id}
                className="flex items-center p-3 bg-gray-700 rounded-lg"
              >
                <RiSecurePaymentLine className="h-5 w-5 text-gray-400 mr-3" />
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
          disabled={actionLoading}
          className="mt-4 w-full py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {actionLoading ? 'Loading...' : 'Manage Payment Methods'}
        </button>
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
            <div className="mb-6">
              <p className="text-gray-300 mb-4">
                Are you sure you want to cancel your subscription?
              </p>
              <div className="bg-gray-700 rounded-lg p-4 space-y-2">
                <div className="flex items-center text-green-400 text-sm">
                  <RiCheckLine className="h-4 w-4 mr-2" />
                  <span>No future charges will occur</span>
                </div>
                <div className="flex items-center text-green-400 text-sm">
                  <RiCheckLine className="h-4 w-4 mr-2" />
                  <span>You keep access until your current period ends</span>
                </div>
                <div className="flex items-center text-orange-400 text-sm">
                  <RiAlertLine className="h-4 w-4 mr-2" />
                  <span>Premium features will be removed after the period ends</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={actionLoading}
                className="flex-1 py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={actionLoading}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Canceling...
                  </div>
                ) : (
                  'Cancel Subscription'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}