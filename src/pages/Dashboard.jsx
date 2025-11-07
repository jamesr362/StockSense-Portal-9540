import { motion } from 'framer-motion';
import { 
  RiBarChartBoxLine, 
  RiShoppingBag3Line, 
  RiAlertLine, 
  RiScanLine, 
  RiFileExcelLine, 
  RiLineChartLine, 
  RiCalculatorLine, 
  RiCloseLine, 
  RiLockLine, 
  RiStarLine,
  RiArrowRightLine,
  RiTrendingUpLine,
  RiMoneyPoundCircleLine,
  RiCalendarLine,
  RiPercentLine,
  RiEyeLine,
  RiShieldCheckLine,
  RiTimeLine,
  RiCheckLine,
  RiRefreshLine,
  RiUserLine,
  RiGlobalLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiEqualizerLine
} from 'react-icons/ri';
import { useState, useEffect } from 'react';
import { getInventoryItems } from '../services/db';
import { useAuth } from '../context/AuthContext';
import useFeatureAccess from '../hooks/useFeatureAccess';
import useSubscriptionVerification from '../hooks/useSubscriptionVerification';
import { Link } from 'react-router-dom';
import SubscriptionStatus from '../components/SubscriptionStatus';
import UsageLimitGate from '../components/UsageLimitGate';
import FeatureGate from '../components/FeatureGate';
import PaymentVerificationBanner from '../components/PaymentVerificationBanner';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [error, setError] = useState(null);
  const [recentPurchases, setRecentPurchases] = useState([]);
  const [monthlyStats, setMonthlyStats] = useState(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);

  const { user } = useAuth();
  const { subscription, usage, currentPlan, canUseFeature, refresh, loading: featureLoading } = useFeatureAccess();
  const { isVerifying, verificationStatus, dismissVerificationStatus } = useSubscriptionVerification();

  useEffect(() => {
    const loadData = async () => {
      if (!user?.email) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Load purchase data with error handling
        let items = [];
        try {
          items = await getInventoryItems(user.email);
        } catch (purchaseError) {
          console.error('Error loading purchases:', purchaseError);
          items = []; // Continue with empty array
        }

        const totalItems = items.length;
        const totalValue = items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);
        const totalVAT = items.reduce((sum, item) => {
          if (item.vatPercentage > 0) {
            const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
            return sum + (item.vatIncluded ? (itemTotal * item.vatPercentage) / (100 + item.vatPercentage) : (itemTotal * item.vatPercentage) / 100);
          }
          return sum;
        }, 0);

        // Get recent purchases (last 5)
        const recent = items
          .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
          .slice(0, 5);

        // Calculate monthly stats
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const thisMonthItems = items.filter(item => {
          const itemDate = new Date(item.dateAdded);
          return itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear;
        });
        const thisMonthValue = thisMonthItems.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);

        // Last month comparison
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const lastMonthItems = items.filter(item => {
          const itemDate = new Date(item.dateAdded);
          return itemDate.getMonth() === lastMonth && itemDate.getFullYear() === lastMonthYear;
        });
        const lastMonthValue = lastMonthItems.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);

        // Category breakdown
        const categories = {};
        items.forEach(item => {
          const category = item.category || 'Uncategorized';
          if (!categories[category]) {
            categories[category] = { count: 0, value: 0 };
          }
          categories[category].count += 1;
          categories[category].value += (item.quantity || 0) * (item.unitPrice || 0);
        });

        const categoryArray = Object.entries(categories)
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);

        setPurchaseCount(totalItems);
        setRecentPurchases(recent);
        setCategoryBreakdown(categoryArray);

        const monthlyGrowth = lastMonthValue > 0 ? ((thisMonthValue - lastMonthValue) / lastMonthValue) * 100 : 0;

        setMonthlyStats({
          thisMonth: thisMonthValue,
          lastMonth: lastMonthValue,
          growth: monthlyGrowth,
          itemsThisMonth: thisMonthItems.length
        });

        setStats([
          {
            name: 'Total Purchases',
            value: totalItems.toString(),
            change: thisMonthItems.length > 0 ? `+${thisMonthItems.length} this month` : 'No new purchases',
            changeType: thisMonthItems.length > 0 ? 'positive' : 'neutral',
            icon: RiShoppingBag3Line,
            color: 'slate'
          },
          {
            name: 'Total Value',
            value: `£${totalValue.toFixed(2)}`,
            change: monthlyGrowth !== 0 ? `${monthlyGrowth > 0 ? '+' : ''}${monthlyGrowth.toFixed(1)}% vs last month` : 'No change',
            changeType: monthlyGrowth > 0 ? 'positive' : monthlyGrowth < 0 ? 'negative' : 'neutral',
            icon: RiMoneyPoundCircleLine,
            color: 'emerald'
          },
          {
            name: 'VAT Tracked',
            value: `£${totalVAT.toFixed(2)}`,
            change: `${items.filter(item => item.vatPercentage > 0).length} VAT items`,
            changeType: 'neutral',
            icon: RiPercentLine,
            color: 'amber'
          },
          {
            name: 'This Month',
            value: `£${thisMonthValue.toFixed(2)}`,
            change: `${thisMonthItems.length} purchases`,
            changeType: thisMonthItems.length > 0 ? 'positive' : 'neutral',
            icon: RiCalendarLine,
            color: 'indigo'
          }
        ]);
      } catch (error) {
        console.error('Error loading dashboard stats:', error);
        setError('Failed to load dashboard data. Please try refreshing the page.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user?.email]);

  // Refresh feature access when verification completes
  useEffect(() => {
    if (verificationStatus?.success) {
      refresh();
    }
  }, [verificationStatus, refresh]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch (error) {
      return 'N/A';
    }
  };

  // Show loading state
  if (isLoading || featureLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3 text-white">Loading dashboard...</span>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="text-center py-12">
        <RiAlertLine className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">Error Loading Dashboard</h3>
        <p className="text-gray-400 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          Refresh Page
        </button>
      </div>
    );
  }

  const getColorClasses = (color) => {
    const colors = {
      slate: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
      emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
      amber: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
      indigo: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
    };
    return colors[color] || colors.slate;
  };

  return (
    <div>
      {/* Payment Verification Banner */}
      <PaymentVerificationBanner
        isVerifying={isVerifying}
        verificationStatus={verificationStatus}
        onDismiss={dismissVerificationStatus}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={isVerifying || verificationStatus ? 'mt-16' : ''}
      >
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                <div className="flex items-center space-x-2">
                  <SubscriptionStatus subscription={subscription} compact />
                  {currentPlan === 'professional' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-primary-600 to-blue-600 text-white">
                      <RiStarLine className="h-3 w-3 mr-1" />
                      PRO
                    </span>
                  )}
                </div>
              </div>
              <p className="text-gray-400">
                Welcome back, <span className="text-white font-medium">{user?.businessName || user?.email}</span>
              </p>
              {usage && (
                <p className="text-sm text-gray-500 mt-1">
                  {currentPlan === 'professional'
                    ? 'Unlimited purchases • All features unlocked'
                    : `${purchaseCount}/100 purchases tracked • ${100 - purchaseCount} remaining`
                  }
                </p>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-3 py-2 border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              >
                <RiRefreshLine className="h-4 w-4 mr-2" />
                Refresh
              </button>
              {currentPlan === 'free' && (
                <Link
                  to="/pricing"
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-primary-600 to-blue-600 text-white rounded-lg hover:from-primary-700 hover:to-blue-700 transition-all"
                >
                  <RiStarLine className="h-4 w-4 mr-2" />
                  Upgrade
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Success Message for New Professional Users */}
        {verificationStatus?.success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-gradient-to-r from-green-600/20 to-primary-600/20 rounded-lg p-4 border border-green-500/30"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <RiStarLine className="h-6 w-6 text-green-400 mr-3" />
                <div>
                  <h3 className="text-green-400 font-semibold">🎉 Welcome to Professional!</h3>
                  <p className="text-gray-300 text-sm mt-1">
                    Your subscription is now active. All premium features are unlocked and ready to use!
                  </p>
                </div>
              </div>
              <button onClick={dismissVerificationStatus} className="text-green-400 hover:text-green-300">
                <RiCloseLine className="h-5 w-5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Free Plan Usage Warning */}
        {currentPlan === 'free' && purchaseCount >= 80 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 rounded-lg p-4 border ${
              purchaseCount >= 100 
                ? 'bg-red-900/20 border-red-700' 
                : purchaseCount >= 95 
                  ? 'bg-red-900/20 border-red-700' 
                  : 'bg-yellow-900/20 border-yellow-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <RiAlertLine className={`h-5 w-5 mr-2 ${
                  purchaseCount >= 100 ? 'text-red-400' : 'text-yellow-400'
                }`} />
                <div>
                  <h3 className={`font-medium ${
                    purchaseCount >= 100 ? 'text-red-300' : 'text-yellow-300'
                  }`}>
                    {purchaseCount >= 100 
                      ? 'Free Plan Limit Reached (100/100)' 
                      : `Approaching Limit: ${purchaseCount}/100 purchases`
                    }
                  </h3>
                  <p className="text-gray-300 text-sm mt-1">
                    {purchaseCount >= 100 
                      ? 'Upgrade to Professional for unlimited purchase tracking and premium features.'
                      : 'You\'re approaching your Free plan limit. Upgrade for unlimited tracking.'
                    }
                  </p>
                </div>
              </div>
              <Link
                to="/pricing"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
              >
                Upgrade Now
              </Link>
            </div>
            <div className="mt-3">
              <div className="w-full bg-gray-600 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    purchaseCount >= 100 ? 'bg-red-500' : 'bg-yellow-500'
                  }`}
                  style={{ width: `${Math.min((purchaseCount / 100) * 100, 100)}%` }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Stats Grid */}
        {stats && stats.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 overflow-hidden hover:shadow-xl transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-lg border ${getColorClasses(stat.color)}`}>
                      <stat.icon className="h-6 w-6" />
                    </div>
                    {stat.changeType === 'positive' && <RiArrowUpLine className="h-4 w-4 text-emerald-400" />}
                    {stat.changeType === 'negative' && <RiArrowDownLine className="h-4 w-4 text-red-400" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-400 mb-1">{stat.name}</p>
                    <p className="text-2xl font-bold text-white mb-2">{stat.value}</p>
                    <p className={`text-xs ${
                      stat.changeType === 'positive' ? 'text-emerald-400' :
                      stat.changeType === 'negative' ? 'text-red-400' : 'text-gray-500'
                    }`}>
                      {stat.change}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-8 text-center mb-8"
          >
            <RiShoppingBag3Line className="mx-auto h-16 w-16 text-gray-500 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No purchases tracked yet</h3>
            <p className="text-gray-400 mb-6">
              {currentPlan === 'free' && purchaseCount >= 100
                ? 'You\'ve reached the 100 purchase limit for the Free plan. Upgrade to track more purchases.'
                : 'Start tracking your purchases to see your dashboard statistics and insights.'
              }
            </p>
            {currentPlan === 'free' && purchaseCount >= 100 ? (
              <Link
                to="/pricing"
                className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <RiStarLine className="h-5 w-5 mr-2" />
                Upgrade to Professional
              </Link>
            ) : (
              <Link
                to="/purchases"
                className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <RiShoppingBag3Line className="h-5 w-5 mr-2" />
                Start Tracking Purchases
              </Link>
            )}
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Recent Purchases */}
          {recentPurchases.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gray-800 rounded-xl shadow-lg border border-gray-700"
            >
              <div className="p-6 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Recent Purchases</h3>
                  <Link
                    to="/purchases"
                    className="text-primary-400 hover:text-primary-300 text-sm font-medium"
                  >
                    View All
                  </Link>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {recentPurchases.map((item, index) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{item.name}</p>
                        <p className="text-gray-400 text-sm">{item.category} • {formatDate(item.dateAdded)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-semibold">
                          {formatCurrency((item.quantity || 0) * (item.unitPrice || 0))}
                        </p>
                        {item.vatPercentage > 0 && (
                          <p className="text-gray-500 text-xs">+{item.vatPercentage}% VAT</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Category Breakdown */}
          {categoryBreakdown.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gray-800 rounded-xl shadow-lg border border-gray-700"
            >
              <div className="p-6 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white">Top Categories</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {categoryBreakdown.map((category, index) => {
                    const maxValue = Math.max(...categoryBreakdown.map(c => c.value));
                    const percentage = (category.value / maxValue) * 100;
                    
                    return (
                      <div key={category.name} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium">{category.name}</span>
                          <div className="text-right">
                            <span className="text-white font-semibold">{formatCurrency(category.value)}</span>
                            <span className="text-gray-400 text-sm ml-2">({category.count} items)</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-slate-400 to-slate-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Manual Entry Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 hover:shadow-xl transition-all hover:border-slate-500/50 group"
          >
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="bg-slate-500/10 border border-slate-500/20 p-3 rounded-lg group-hover:bg-slate-500/20 transition-colors">
                  <RiShoppingBag3Line className="h-6 w-6 text-slate-300" />
                </div>
                <h3 className="ml-3 text-lg font-semibold text-white">Manual Entry</h3>
              </div>
              <p className="text-gray-400 mb-4 text-sm">
                Add purchases manually with full control over details and VAT configuration.
              </p>
              <Link
                to="/purchases"
                className="inline-flex items-center text-slate-300 hover:text-slate-200 font-medium"
              >
                Manage Purchases
                <RiArrowRightLine className="ml-1 h-4 w-4" />
              </Link>
              {currentPlan === 'free' && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">{purchaseCount}/100 tracked</span>
                    {purchaseCount >= 100 && (
                      <span className="text-red-400 font-medium">Limit reached</span>
                    )}
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1 mt-2">
                    <div
                      className={`h-1 rounded-full transition-all ${
                        purchaseCount >= 100 ? 'bg-red-500' : 'bg-slate-500'
                      }`}
                      style={{ width: `${Math.min((purchaseCount / 100) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Receipt Scanner Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className={`bg-gray-800 rounded-xl shadow-lg border border-gray-700 hover:shadow-xl transition-all group ${
              canUseFeature('receiptScanner') ? 'hover:border-primary-500/50' : 'opacity-75'
            }`}
          >
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className={`p-3 rounded-lg border transition-colors ${
                  canUseFeature('receiptScanner') 
                    ? 'bg-primary-500/10 border-primary-500/20 group-hover:bg-primary-500/20' 
                    : 'bg-gray-700 border-gray-600'
                }`}>
                  <RiScanLine className={`h-6 w-6 ${canUseFeature('receiptScanner') ? 'text-primary-300' : 'text-gray-500'}`} />
                </div>
                <h3 className="ml-3 text-lg font-semibold text-white">Receipt Scanner</h3>
                {!canUseFeature('receiptScanner') && (
                  <RiLockLine className="ml-auto h-4 w-4 text-gray-500" />
                )}
              </div>
              <p className="text-gray-400 mb-4 text-sm">
                Quickly scan receipts to extract and track purchases automatically.
              </p>
              {canUseFeature('receiptScanner') ? (
                <Link
                  to="/receipt-scanner"
                  className="inline-flex items-center text-primary-300 hover:text-primary-200 font-medium"
                >
                  Scan Receipt
                  <RiArrowRightLine className="ml-1 h-4 w-4" />
                </Link>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-sm">Professional plan required</span>
                  <Link to="/pricing" className="text-primary-400 hover:text-primary-300 text-sm font-medium">
                    Upgrade
                  </Link>
                </div>
              )}
            </div>
          </motion.div>

          {/* Excel Import Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className={`bg-gray-800 rounded-xl shadow-lg border border-gray-700 hover:shadow-xl transition-all group ${
              canUseFeature('excelImporter') ? 'hover:border-emerald-500/50' : 'opacity-75'
            }`}
          >
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className={`p-3 rounded-lg border transition-colors ${
                  canUseFeature('excelImporter') 
                    ? 'bg-emerald-500/10 border-emerald-500/20 group-hover:bg-emerald-500/20' 
                    : 'bg-gray-700 border-gray-600'
                }`}>
                  <RiFileExcelLine className={`h-6 w-6 ${canUseFeature('excelImporter') ? 'text-emerald-300' : 'text-gray-500'}`} />
                </div>
                <h3 className="ml-3 text-lg font-semibold text-white">Excel Import</h3>
                {!canUseFeature('excelImporter') && (
                  <RiLockLine className="ml-auto h-4 w-4 text-gray-500" />
                )}
              </div>
              <p className="text-gray-400 mb-4 text-sm">
                Bulk import your purchase data from Excel spreadsheets efficiently.
              </p>
              {canUseFeature('excelImporter') ? (
                <Link
                  to="/excel-importer"
                  className="inline-flex items-center text-emerald-300 hover:text-emerald-200 font-medium"
                >
                  Import Data
                  <RiArrowRightLine className="ml-1 h-4 w-4" />
                </Link>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-sm">Professional plan required</span>
                  <Link to="/pricing" className="text-primary-400 hover:text-primary-300 text-sm font-medium">
                    Upgrade
                  </Link>
                </div>
              )}
            </div>
          </motion.div>

          {/* Tax Exports Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className={`bg-gray-800 rounded-xl shadow-lg border border-gray-700 hover:shadow-xl transition-all group ${
              canUseFeature('taxExports') ? 'hover:border-amber-500/50' : 'opacity-75'
            }`}
          >
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className={`p-3 rounded-lg border transition-colors ${
                  canUseFeature('taxExports') 
                    ? 'bg-amber-500/10 border-amber-500/20 group-hover:bg-amber-500/20' 
                    : 'bg-gray-700 border-gray-600'
                }`}>
                  <RiCalculatorLine className={`h-6 w-6 ${canUseFeature('taxExports') ? 'text-amber-300' : 'text-gray-500'}`} />
                </div>
                <h3 className="ml-3 text-lg font-semibold text-white">Tax Exports</h3>
                {!canUseFeature('taxExports') && (
                  <RiLockLine className="ml-auto h-4 w-4 text-gray-500" />
                )}
              </div>
              <p className="text-gray-400 mb-4 text-sm">
                Generate professional tax reports ready for your accountant or HMRC.
              </p>
              {canUseFeature('taxExports') ? (
                <Link
                  to="/tax-exports"
                  className="inline-flex items-center text-amber-300 hover:text-amber-200 font-medium"
                >
                  Export Reports
                  <RiArrowRightLine className="ml-1 h-4 w-4" />
                </Link>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-sm">Professional plan required</span>
                  <Link to="/pricing" className="text-primary-400 hover:text-primary-300 text-sm font-medium">
                    Upgrade
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Quick Actions Section */}
        {purchaseCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="mt-8 bg-gradient-to-r from-gray-800 to-gray-700 rounded-xl shadow-lg border border-gray-600 p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                to="/purchases"
                className="flex items-center p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors border border-gray-600 hover:border-slate-500"
              >
                <RiEyeLine className="h-5 w-5 text-slate-300 mr-3" />
                <span className="text-white font-medium">View All Purchases</span>
              </Link>
              
              {canUseFeature('receiptScanner') && (
                <Link
                  to="/receipt-scanner"
                  className="flex items-center p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors border border-gray-600 hover:border-primary-500"
                >
                  <RiScanLine className="h-5 w-5 text-primary-300 mr-3" />
                  <span className="text-white font-medium">Quick Scan</span>
                </Link>
              )}
              
              {canUseFeature('taxExports') && (
                <Link
                  to="/tax-exports"
                  className="flex items-center p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors border border-gray-600 hover:border-amber-500"
                >
                  <RiCalculatorLine className="h-5 w-5 text-amber-300 mr-3" />
                  <span className="text-white font-medium">Generate Report</span>
                </Link>
              )}
              
              <Link
                to="/billing"
                className="flex items-center p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors border border-gray-600 hover:border-indigo-500"
              >
                <RiEqualizerLine className="h-5 w-5 text-indigo-300 mr-3" />
                <span className="text-white font-medium">Usage & Billing</span>
              </Link>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}