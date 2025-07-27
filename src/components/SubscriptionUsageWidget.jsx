import {motion} from 'framer-motion';
import {RiBarChartLine, RiTrendingUpLine, RiAlertLine, RiArrowRightLine} from 'react-icons/ri';
import {getUsageStats, SUBSCRIPTION_PLANS} from '../lib/stripe';
import {useNavigate} from 'react-router-dom';

export default function SubscriptionUsageWidget({userPlan = 'free'}) {
  const navigate = useNavigate();
  const usage = getUsageStats(userPlan);
  const planLimits = SUBSCRIPTION_PLANS[userPlan]?.limits || SUBSCRIPTION_PLANS.free.limits;

  const getUsageColor = (percentage) => {
    if (percentage >= 90) return 'text-red-400';
    if (percentage >= 75) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getProgressBarColor = (percentage) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const formatLimit = (limit) => {
    if (limit === -1) return '∞';
    if (limit >= 1000) return `${(limit / 1000).toFixed(0)}k`;
    return limit.toString();
  };

  const usageItems = [
    {
      key: 'inventoryItems',
      label: 'Inventory Items',
      icon: RiBarChartLine,
      ...usage.inventoryItems
    },
    {
      key: 'receiptScans',
      label: 'Receipt Scans',
      icon: RiTrendingUpLine,
      period: 'this month',
      ...usage.receiptScans
    },
    {
      key: 'excelImports',
      label: 'Excel Imports',
      icon: RiTrendingUpLine,
      period: 'this month',
      ...usage.excelImports
    }
  ];

  const isNearLimit = usageItems.some(item => item.percentage > 80);
  const isAtLimit = usageItems.some(item => item.percentage >= 100);

  return (
    <motion.div
      initial={{opacity: 0, y: 20}}
      animate={{opacity: 1, y: 0}}
      className={`bg-gray-800 rounded-lg p-6 shadow-lg ${isAtLimit ? 'ring-2 ring-red-500/50' : isNearLimit ? 'ring-2 ring-yellow-500/50' : ''}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Usage Overview</h3>
          <p className="text-gray-400 text-sm">
            Current plan: <span className="text-primary-400 font-medium capitalize">{userPlan}</span>
          </p>
        </div>
        
        {isNearLimit && (
          <div className="flex items-center text-yellow-400">
            <RiAlertLine className="h-5 w-5 mr-1" />
            <span className="text-sm font-medium">Near Limit</span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {usageItems.map((item) => (
          <div key={item.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <item.icon className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-white text-sm">{item.label}</span>
                {item.period && (
                  <span className="text-gray-500 text-xs ml-1">({item.period})</span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-medium ${getUsageColor(item.percentage)}`}>
                  {item.current} / {formatLimit(item.limit)}
                </span>
                <span className="text-xs text-gray-500">
                  ({Math.round(item.percentage)}%)
                </span>
              </div>
            </div>
            
            <div className="w-full bg-gray-700 rounded-full h-2">
              <motion.div
                initial={{width: 0}}
                animate={{width: `${Math.min(item.percentage, 100)}%`}}
                transition={{duration: 0.8, ease: "easeOut"}}
                className={`h-2 rounded-full transition-colors ${getProgressBarColor(item.percentage)}`}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Plan upgrade suggestion */}
      {(isNearLimit || userPlan === 'free') && (
        <motion.div
          initial={{opacity: 0, y: 10}}
          animate={{opacity: 1, y: 0}}
          transition={{delay: 0.3}}
          className="mt-6 p-4 bg-gradient-to-r from-primary-900/50 to-purple-900/50 border border-primary-700 rounded-lg"
        >
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-primary-400 font-medium text-sm">
                {isAtLimit ? 'Upgrade Required' : 'Consider Upgrading'}
              </h4>
              <p className="text-gray-300 text-xs mt-1">
                {isAtLimit 
                  ? 'You\'ve reached your plan limits. Upgrade to continue using all features.'
                  : 'Get unlimited access and avoid hitting limits.'
                }
              </p>
            </div>
            <button
              onClick={() => navigate('/subscription')}
              className="flex items-center px-3 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700 transition-colors"
            >
              Upgrade
              <RiArrowRightLine className="h-3 w-3 ml-1" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Plan benefits */}
      {userPlan !== 'free' && (
        <div className="mt-4 p-3 bg-green-900/20 border border-green-700 rounded-lg">
          <div className="flex items-center text-green-400 text-sm">
            <RiTrendingUpLine className="h-4 w-4 mr-2" />
            <span>
              {userPlan === 'power' 
                ? 'Unlimited everything with Power plan!' 
                : 'Professional plan active - expanded limits!'
              }
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}