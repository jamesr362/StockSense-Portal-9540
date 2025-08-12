import {motion} from 'framer-motion';
import {RiCheckLine, RiAlertLine, RiTimeLine, RiCloseLine} from 'react-icons/ri';

export default function SubscriptionStatus({subscription, compact = false}) {
  if (!subscription) {
    return (
      <div className={`flex items-center ${compact ? 'text-sm' : ''}`}>
        <div className="w-2 h-2 bg-gray-500 rounded-full mr-2"></div>
        <span className="text-gray-400">Free Plan</span>
      </div>
    );
  }

  const getStatusConfig = () => {
    const willCancelAtPeriodEnd = subscription.cancelAtPeriodEnd && subscription.status === 'active';
    
    switch (subscription.status) {
      case 'active':
        return willCancelAtPeriodEnd 
          ? {
              icon: RiTimeLine,
              color: 'text-yellow-400',
              bgColor: 'bg-yellow-400',
              text: 'Cancels at period end'
            }
          : {
              icon: RiCheckLine,
              color: 'text-green-400',
              bgColor: 'bg-green-400',
              text: 'Active'
            };
      case 'canceled':
        return {
          icon: RiCloseLine,
          color: 'text-red-400',
          bgColor: 'bg-red-400',
          text: 'Canceled'
        };
      case 'trialing':
        return {
          icon: RiTimeLine,
          color: 'text-blue-400',
          bgColor: 'bg-blue-400',
          text: 'Trial'
        };
      case 'past_due':
        return {
          icon: RiAlertLine,
          color: 'text-orange-400',
          bgColor: 'bg-orange-400',
          text: 'Past Due'
        };
      case 'unpaid':
        return {
          icon: RiAlertLine,
          color: 'text-red-400',
          bgColor: 'bg-red-400',
          text: 'Unpaid'
        };
      default:
        return {
          icon: RiAlertLine,
          color: 'text-gray-400',
          bgColor: 'bg-gray-400',
          text: 'Unknown'
        };
    }
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;

  if (compact) {
    return (
      <div className="flex items-center text-sm">
        <div className={`w-2 h-2 ${config.bgColor} rounded-full mr-2`}></div>
        <span className={config.color}>{config.text}</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center"
    >
      <div className={`p-2 rounded-full ${config.bgColor}/20 mr-3`}>
        <StatusIcon className={`h-5 w-5 ${config.color}`} />
      </div>
      <div>
        <span className={`font-medium ${config.color}`}>{config.text}</span>
        {subscription.currentPeriodEnd && (
          <p className="text-gray-400 text-sm">
            Until {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })}
          </p>
        )}
      </div>
    </motion.div>
  );
}