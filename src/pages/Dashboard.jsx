import {motion} from 'framer-motion';
import {RiBarChartBoxLine,RiStore2Line,RiAlertLine,RiScanLine,RiFileExcelLine,RiLineChartLine} from 'react-icons/ri';
import {useState,useEffect} from 'react';
import {getInventoryItems} from '../services/db';
import {useAuth} from '../context/AuthContext';
import useSubscription from '../hooks/useSubscription';
import {Link} from 'react-router-dom';
import SubscriptionStatus from '../components/SubscriptionStatus';
import PlanLimitChecker from '../components/PlanLimitChecker';

export default function Dashboard() {
  const [stats,setStats]=useState(null);
  const [isLoading,setIsLoading]=useState(true);
  const [inventoryCount,setInventoryCount]=useState(0);
  const {user}=useAuth();
  const {subscription,planLimits,currentPlan}=useSubscription();

  useEffect(()=> {
    const loadData=async ()=> {
      if (!user?.email) return;
      try {
        setIsLoading(true);
        // Load inventory data
        const items=await getInventoryItems(user.email);
        const totalItems=items.length;
        const outOfStockItems=items.filter((item)=> item.status==='Out of Stock').length;
        const limitedStockItems=items.filter((item)=> item.status==='Limited Stock').length;
        const totalValue=items.reduce((sum,item)=> sum + item.quantity * item.unitPrice,0);
        
        setInventoryCount(totalItems);
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
        console.error('Error loading dashboard stats:',error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  },[user?.email]);

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
        initial={{opacity: 0,y: 20}}
        animate={{opacity: 1,y: 0}}
        transition={{duration: 0.5}}
      >
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-white">Dashboard</h1>
              <p className="text-sm text-gray-400 mt-2">Welcome back,{user?.businessName}</p>
            </div>
            <div className="flex flex-col items-end space-y-2">
              <SubscriptionStatus subscription={subscription} compact />
              {planLimits && (
                <div className="text-xs text-gray-500">
                  {planLimits.inventoryItems===-1 ? 'Unlimited items' : `${inventoryCount}/${planLimits.inventoryItems} items used`}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Subscription Banner (if free plan) */}
        {currentPlan==='free' && (
          <motion.div
            initial={{opacity: 0,y: -10}}
            animate={{opacity: 1,y: 0}}
            className="mb-6 bg-gradient-to-r from-primary-600/20 to-blue-600/20 rounded-lg p-4 border border-primary-500/30"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-medium">Upgrade to unlock premium features</h3>
                <p className="text-gray-300 text-sm mt-1">Get access to receipt scanning,Excel imports,and more!</p>
              </div>
              <Link
                to="/pricing"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                View Plans
              </Link>
            </div>
          </motion.div>
        )}

        {/* Stats Grid with Plan Limit Checking */}
        <PlanLimitChecker
          limitType="inventoryItems"
          currentUsage={inventoryCount}
          showUpgradePrompt={false}
        >
          {stats && stats.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat,index)=> (
                <motion.div
                  key={stat.name}
                  initial={{opacity: 0,y: 20}}
                  animate={{opacity: 1,y: 0}}
                  transition={{duration: 0.5,delay: index * 0.1}}
                  className="bg-gray-800 overflow-hidden rounded-lg shadow-sm"
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <stat.icon
                          className={`h-6 w-6 sm:h-7 sm:w-7 ${
                            stat.changeType==='negative'
                              ? 'text-red-400'
                              : stat.changeType==='warning'
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
              initial={{opacity: 0,y: 20}}
              animate={{opacity: 1,y: 0}}
              className="bg-gray-800 overflow-hidden rounded-lg shadow p-6 sm:p-8 text-center text-gray-400"
            >
              <RiStore2Line className="mx-auto h-12 w-12 text-gray-500 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No inventory items yet</h3>
              <p className="text-sm">
                Add some items to your inventory to see your dashboard statistics.
              </p>
            </motion.div>
          )}
        </PlanLimitChecker>

        {/* Feature Cards */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Receipt Scanner Card */}
          <motion.div
            initial={{opacity: 0,y: 20}}
            animate={{opacity: 1,y: 0}}
            transition={{delay: 0.2}}
            className="bg-gray-800 rounded-lg p-6"
          >
            <div className="flex items-center mb-4">
              <div className="bg-primary-900/30 p-3 rounded-lg">
                <RiScanLine className="h-6 w-6 text-primary-400" />
              </div>
              <h3 className="ml-3 text-lg font-medium text-white">Receipt Scanner</h3>
            </div>
            <p className="text-gray-400 mb-4">
              Quickly scan receipts to add items to your inventory automatically.
            </p>
            <div className="mt-2">
              {planLimits?.receiptScans > 0 ? (
                <Link
                  to="/receipt-scanner"
                  className="inline-flex items-center text-primary-400 hover:text-primary-300"
                >
                  Scan Receipt
                  <RiArrowRightIcon className="ml-1 h-4 w-4" />
                </Link>
              ) : (
                <div className="flex items-center">
                  <span className="text-red-400 text-sm">Available in Basic & Professional plans</span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Excel Import Card */}
          <motion.div
            initial={{opacity: 0,y: 20}}
            animate={{opacity: 1,y: 0}}
            transition={{delay: 0.3}}
            className="bg-gray-800 rounded-lg p-6"
          >
            <div className="flex items-center mb-4">
              <div className="bg-green-900/30 p-3 rounded-lg">
                <RiFileExcelLine className="h-6 w-6 text-green-400" />
              </div>
              <h3 className="ml-3 text-lg font-medium text-white">Excel Import</h3>
            </div>
            <p className="text-gray-400 mb-4">
              Bulkimport your inventory data from Excel spreadsheets.
            </p>
            <div className="mt-2">
              {planLimits?.excelImport ? (
                <Link
                  to="/excel-importer"
                  className="inline-flex items-center text-green-400 hover:text-green-300"
                >
                  Import Data
                  <RiArrowRightIcon className="ml-1 h-4 w-4" />
                </Link>
              ) : (
                <div className="flex items-center">
                  <span className="text-red-400 text-sm">Available in Basic & Professional plans</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Plan Limit Warning for Inventory */}
        {planLimits && planLimits.inventoryItems !==-1 && inventoryCount >=planLimits.inventoryItems * 0.8 && (
          <motion.div
            initial={{opacity: 0,y: 20}}
            animate={{opacity: 1,y: 0}}
            transition={{delay: 0.4}}
            className="mt-6"
          >
            <PlanLimitChecker
              limitType="inventoryItems"
              currentUsage={inventoryCount}
              customMessage={`You're using ${inventoryCount} of ${planLimits.inventoryItems} available inventory slots.`}
            />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

// Helper icon component
function RiArrowRightIcon({className}) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
      <path fill="none" d="M0 0h24v24H0z" />
      <path
        fill="currentColor"
        d="M16.172 11l-5.364-5.364 1.414-1.414L20 12l-7.778 7.778-1.414-1.414L16.172 13H4v-2z"
      />
    </svg>
  );
}