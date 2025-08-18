import {motion} from 'framer-motion';
import {RiCheckLine, RiCloseLine, RiCalendarLine, RiCreditCard2Line, RiArrowRightLine} from 'react-icons/ri';
import {SUBSCRIPTION_PLANS, formatPrice} from '../lib/stripe';

export default function SubscriptionCard({subscription, onUpgrade, onCancel, onReactivate, isLoading = false}) {
  if (!subscription) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-center">
          <RiCreditCard2Line className="mx-auto h-12 w-12 text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Active Subscription</h3>
          <p className="text-gray-400 mb-4">You're currently on the Free plan</p>
          <button
            onClick={() => onUpgrade?.()}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Upgrade Plan
            <RiArrowRightLine className="h-4 w-4 ml-2" />
          </button>
        </div>
      </div>
    );
  }

  const planName = getPlanNameFromId(subscription.planId);
  const plan = SUBSCRIPTION_PLANS[planName] || SUBSCRIPTION_PLANS.free;
  const isActive = subscription.status === 'active';
  const isCanceled = subscription.status === 'canceled';
  const willCancelAtPeriodEnd = subscription.cancelAtPeriodEnd && isActive;

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return willCancelAtPeriodEnd ? 'text-yellow-400' : 'text-green-400';
      case 'canceled': return 'text-red-400';
      case 'trialing': return 'text-blue-400';
      case 'past_due': return 'text-orange-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusText = () => {
    if (willCancelAtPeriodEnd) {
      return 'Cancels at period end';
    }
    return subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getPlanNameFromId = (planId) => {
    if (!planId) return 'free';
    const parts = planId.split('_');
    return parts.length > 1 ? parts[1] : 'free';
  };

  return (
    <motion.div
      initial={{opacity: 0, y: 20}}
      animate={{opacity: 1, y: 0}}
      className="bg-gray-800 rounded-lg shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">{plan.name} Plan</h3>
            <p className="text-gray-300">{formatPrice(plan.price)}/month</p>
          </div>
          <div className="text-right">
            <span className={`font-medium ${getStatusColor(subscription.status)}`}>
              {getStatusText()}
            </span>
            {subscription.currentPeriodEnd && (
              <p className="text-gray-400 text-sm">
                {willCancelAtPeriodEnd ? 'Ends' : 'Renews'}: {formatDate(subscription.currentPeriodEnd)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Plan Features */}
        <div className="mb-6">
          <h4 className="text-white font-medium mb-3">Plan Features</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {plan.features.slice(0, 6).map((feature, index) => (
              <div key={index} className="flex items-start">
                <RiCheckLine className="h-4 w-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-gray-300 text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Subscription Details */}
        <div className="bg-gray-700 rounded-lg p-4 mb-6">
          <h4 className="text-white font-medium mb-3">Subscription Details</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Subscription ID:</span>
              <span className="text-white font-mono text-xs">
                {subscription.stripeSubscriptionId?.substring(0, 12)}...
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Current Period:</span>
              <span className="text-white">
                {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
              </span>
            </div>
            {subscription.canceledAt && (
              <div className="flex justify-between">
                <span className="text-gray-400">Canceled:</span>
                <span className="text-red-300">{formatDate(subscription.canceledAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          {isActive && !willCancelAtPeriodEnd && (
            <>
              <button
                onClick={() => onUpgrade?.(plan)}
                disabled={isLoading}
                className="flex-1 py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                Upgrade Plan
              </button>
              <button
                onClick={() => onCancel?.(subscription)}
                disabled={isLoading}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                Cancel Subscription
              </button>
            </>
          )}

          {willCancelAtPeriodEnd && (
            <button
              onClick={() => onReactivate?.(subscription)}
              disabled={isLoading}
              className="w-full py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Reactivate Subscription
            </button>
          )}

          {isCanceled && (
            <button
              onClick={() => onReactivate?.(subscription)}
              disabled={isLoading}
              className="w-full py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              Resubscribe
            </button>
          )}
        </div>

        {/* Warning Messages */}
        {willCancelAtPeriodEnd && (
          <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
            <p className="text-yellow-300 text-sm">
              Your subscription will end on {formatDate(subscription.currentPeriodEnd)}. You'll be downgraded to the Free plan unless you reactivate.
            </p>
          </div>
        )}

        {isCanceled && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-lg">
            <p className="text-red-300 text-sm">
              Your subscription has been canceled. You can resubscribe at any time to regain access to premium features.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}