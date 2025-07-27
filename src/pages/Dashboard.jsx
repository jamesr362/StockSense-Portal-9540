import {motion} from 'framer-motion';
import {RiBarChartBoxLine, RiStore2Line, RiAlertLine} from 'react-icons/ri';
import {useState, useEffect, useCallback} from 'react';
import {getInventoryItems} from '../services/db';
import {useAuth} from '../context/AuthContext';
import {useNavigate} from 'react-router-dom';
import {getUsageStats} from '../lib/stripe';
import UsageLimitWarning from '../components/UsageLimitWarning';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const {user} = useAuth();
  const navigate = useNavigate();
  const userPlan = user?.subscriptionPlan || 'free';
  const usage = getUsageStats(userPlan);

  // Memoize loadStats function to prevent unnecessary re-creation
  const loadStats = useCallback(async () => {
    if (!user?.email) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const items = await getInventoryItems(user.email);

      // Calculate stats safely
      let totalItems = 0;
      let outOfStockItems = 0;
      let limitedStockItems = 0;
      let totalValue = 0;

      if (items && Array.isArray(items) && items.length > 0) {
        totalItems = items.length;
        items.forEach(item => {
          // Safely check item properties
          if (item && typeof item === 'object') {
            if (item.status === 'Out of Stock') {
              outOfStockItems++;
            } else if (item.status === 'Limited Stock') {
              limitedStockItems++;
            }

            // Use nullish coalescing for safer calculations
            const quantity = Number(item.quantity) || 0;
            const unitPrice = Number(item.unitPrice) || 0;
            if (!isNaN(quantity) && !isNaN(unitPrice)) {
              totalValue += quantity * unitPrice;
            }
          }
        });
      }

      const newStats = [
        {
          name: 'Total Items',
          value: totalItems.toString(),
          icon: RiStore2Line,
          limit: usage.inventoryItems.limit,
          usage: `${totalItems}/${usage.inventoryItems.limit === -1 ? '∞' : usage.inventoryItems.limit}`,
          isNearLimit: usage.inventoryItems.percentage > 80
        },
        {
          name: 'Limited Stock',
          value: limitedStockItems.toString(),
          icon: RiAlertLine,
          changeType: 'warning',
        },
        {
          name: 'Out of Stock',
          value: outOfStockItems.toString(),
          icon: RiAlertLine,
          changeType: 'negative',
        },
        {
          name: 'Total Value',
          value: `£${totalValue.toFixed(2)}`,
          icon: RiBarChartBoxLine,
        },
      ];

      setStats(newStats);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      setError('Failed to load dashboard statistics');
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.email, usage.inventoryItems.limit, usage.inventoryItems.percentage]);

  useEffect(() => {
    // Add a small delay to prevent rapid re-renders
    const timer = setTimeout(() => {
      loadStats();
    }, 100);
    return () => clearTimeout(timer);
  }, [loadStats]);

  const handleUpgrade = () => {
    navigate('/subscription');
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-white">Loading dashboard...</span>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RiAlertLine className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Error Loading Dashboard</h3>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={loadStats}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <motion.div
        initial={{opacity: 0, y: 20}}
        animate={{opacity: 1, y: 0}}
        transition={{duration: 0.3}}
      >
        {/* Usage Limit Warning */}
        <UsageLimitWarning userPlan={userPlan} onUpgrade={handleUpgrade} />
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white">Dashboard</h1>
          <div className="flex items-center justify-between">
            <p className="mt-2 text-sm text-gray-400">
              Welcome back, {user?.businessName || 'User'}
            </p>
            {userPlan === 'free' && (
              <div className="flex items-center space-x-2 text-xs">
                <span className="px-2 py-1 bg-yellow-600 text-yellow-100 rounded-full">
                  FREE PLAN
                </span>
                <button onClick={handleUpgrade} className="text-primary-400 hover:text-primary-300 underline">
                  Upgrade
                </button>
              </div>
            )}
          </div>
        </div>

        {stats && stats.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.name}
                initial={{opacity: 0, y: 10}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.2, delay: index * 0.05}}
                className={`bg-gray-800 overflow-hidden rounded-lg shadow-sm ${
                  stat.isNearLimit ? 'ring-2 ring-yellow-500/50' : ''
                }`}
              >
                <div className="p-4 sm:p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <stat.icon
                        className={`h-6 w-6 sm:h-7 sm:w-7 ${
                          stat.changeType === 'negative'
                            ? 'text-red-400'
                            : stat.changeType === 'warning'
                            ? 'text-yellow-400'
                            : stat.isNearLimit
                            ? 'text-yellow-400'
                            : 'text-gray-400'
                        }`}
                      />
                    </div>
                    <div className="ml-3 sm:ml-4 w-0 flex-1">
                      <dl>
                        <dt className="text-xs sm:text-sm font-medium text-gray-400 truncate">
                          {stat.name}
                        </dt>
                        <dd className="flex items-baseline mt-1">
                          <div className="text-xl sm:text-2xl font-semibold text-white break-all">
                            {stat.value}
                          </div>
                        </dd>
                        {stat.usage && (
                          <dd
                            className={`text-xs mt-1 ${
                              stat.isNearLimit ? 'text-yellow-400' : 'text-gray-500'
                            }`}
                          >
                            {stat.usage} {stat.isNearLimit && '⚠️'}
                          </dd>
                        )}
                      </dl>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            className="bg-gray-800 overflow-hidden rounded-lg shadow p-6 sm:p-8 text-center text-gray-400"
          >
            <RiStore2Line className="mx-auto h-12 w-12 text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No inventory items yet</h3>
            <p className="text-sm mb-4">
              Add some items to your inventory to see your dashboard statistics.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6">
              <button
                onClick={() => navigate('/inventory')}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Add Items
              </button>
              <button
                onClick={() => navigate('/receipt-scanner')}
                className="px-4 py-2 border border-primary-600 text-primary-400 rounded-lg hover:bg-primary-600 hover:text-white"
              >
                Scan Receipt
              </button>
            </div>
            {userPlan === 'free' && (
              <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700 rounded-lg">
                <p className="text-blue-300 text-sm">
                  Remember: Free plan is limited to 10 items only.
                  <button
                    onClick={handleUpgrade}
                    className="text-blue-400 hover:text-blue-300 underline ml-1"
                  >
                    Upgrade for unlimited items.
                  </button>
                </p>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}