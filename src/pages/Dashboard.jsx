import { motion } from 'framer-motion';
import { RiBarChartBoxLine, RiStore2Line, RiAlertLine } from 'react-icons/ri';
import { useState, useEffect } from 'react';
import { getInventoryItems } from '../services/db';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const loadStats = async () => {
      if (!user?.email) return;

      try {
        setIsLoading(true);
        const items = await getInventoryItems(user.email);

        const totalItems = items.length;
        const outOfStockItems = items.filter((item) => item.status === 'Out of Stock').length;
        const limitedStockItems = items.filter((item) => item.status === 'Limited Stock').length;
        const totalValue = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

        setStats([
          {
            name: 'Total Items',
            value: totalItems.toString(),
            icon: RiStore2Line,
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
        ]);
      } catch (error) {
        console.error('Error loading dashboard stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [user?.email]);

  if (isLoading) {
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
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-400">
            Welcome back, {user?.businessName}
          </p>
        </div>

        {stats && stats.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-gray-800 overflow-hidden rounded-lg shadow-sm"
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
                      </dl>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800 overflow-hidden rounded-lg shadow p-6 sm:p-8 text-center text-gray-400"
          >
            <RiStore2Line className="mx-auto h-12 w-12 text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No inventory items yet</h3>
            <p className="text-sm">
              Add some items to your inventory to see your dashboard statistics.
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}