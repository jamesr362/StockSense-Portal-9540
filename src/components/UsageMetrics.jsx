import {useState,useEffect} from 'react';
import {motion} from 'framer-motion';
import {RiBarChartLine,RiTeamLine,RiStore2Line,RiLineChartLine,RiScanLine} from 'react-icons/ri';
import {SUBSCRIPTION_PLANS,getPlanById} from '../lib/stripe';

export default function UsageMetrics({userPlan='free'}) {
  const [usage,setUsage]=useState({
    inventoryItems: 0,
    teamMembers: 0,
    receiptScans: 0,
    apiCalls: 0,
    storageUsed: 0
  });
  const [loading,setLoading]=useState(true);

  useEffect(()=> {
    loadUsageData();
  },[]);

  const loadUsageData=async ()=> {
    try {
      setLoading(true);
      
      // Simulate API call with a delay
      await new Promise(resolve=> setTimeout(resolve,800));
      
      // Mock usage data - replace with actual API call
      const mockUsage={
        inventoryItems: 147,
        teamMembers: 1,
        receiptScans: 35,
        apiCalls: 450,
        storageUsed: 1.2 // GB
      };
      
      setUsage(mockUsage);
    } catch (error) {
      console.error('Error loading usage data:',error);
    } finally {
      setLoading(false);
    }
  };

  const plan=getPlanById(userPlan);
  const limits=plan?.limits || {};

  const getUsagePercentage=(current,limit)=> {
    if (limit===-1) return 0;// Unlimited
    if (limit===0) return 100;// Not available on this plan
    return Math.min((current / limit) * 100,100);
  };

  const getUsageColor=(percentage)=> {
    if (percentage >=90) return 'bg-red-500';
    if (percentage >=75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const usageMetrics=[ 
    {
      name: 'Inventory Items',
      current: usage.inventoryItems,
      limit: limits.inventoryItems,
      icon: RiStore2Line,
      color: 'text-blue-400'
    },
    {
      name: 'Receipt Scans',
      current: usage.receiptScans,
      limit: limits.receiptScans,
      icon: RiScanLine,
      color: 'text-green-400',
      periodLabel: '/month'
    },
    {
      name: 'Team Members',
      current: usage.teamMembers,
      limit: limits.teamMembers,
      icon: RiTeamLine,
      color: 'text-purple-400'
    },
    {
      name: 'Storage Used',
      current: usage.storageUsed,
      limit: 5,// 5GB for all plans
      icon: RiBarChartLine,
      color: 'text-yellow-400',
      unit: 'GB'
    } 
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg">
      <div className="px-4 py-5 border-b border-gray-700 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg leading-6 font-medium text-white">Usage Metrics</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-400">
              Monitor your current usage against plan limits
            </p>
          </div>
          <div className="text-sm text-gray-400">
            <span className="text-primary-400 font-medium">{plan?.name || 'Free'}</span> Plan
          </div>
        </div>
      </div>
      <div className="px-4 py-5 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {usageMetrics.map((metric,index)=> {
            const percentage=getUsagePercentage(metric.current,metric.limit);
            const isUnlimited=metric.limit===-1;
            const isUnavailable=metric.limit===0;
            
            return (
              <motion.div
                key={metric.name}
                initial={{opacity: 0,y: 20}}
                animate={{opacity: 1,y: 0}}
                transition={{delay: index * 0.1}}
                className="bg-gray-700 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <metric.icon className={`h-5 w-5 ${metric.color} mr-2`} />
                    <span className="text-white font-medium">{metric.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-semibold">
                      {metric.current}{metric.unit && ` ${metric.unit}`}
                    </div>
                    <div className="text-gray-400 text-xs">
                      {isUnavailable ? 'Not available' : isUnlimited ? 'Unlimited' : `of ${metric.limit}${metric.unit ? ` ${metric.unit}` : ''}${metric.periodLabel || ''}`}
                    </div>
                  </div>
                </div>

                {!isUnavailable && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Usage</span>
                      <span className="text-white">
                        {isUnlimited ? '∞' : `${percentage.toFixed(1)}%`}
                      </span>
                    </div>
                    <div className="w-full bg-gray-600 rounded-full h-2">
                      <motion.div
                        initial={{width: 0}}
                        animate={{width: `${percentage}%`}}
                        transition={{duration: 1,ease: "easeOut"}}
                        className={`h-2 rounded-full transition-all duration-300 ${isUnavailable ? 'bg-red-500' : isUnlimited ? 'bg-green-500' : getUsageColor(percentage)}`}
                      />
                    </div>
                    
                    {percentage >=75 && !isUnlimited && !isUnavailable && (
                      <div className={`text-xs ${percentage >=90 ? 'text-red-400' : 'text-yellow-400'}`}>
                        {percentage >=90 ? '⚠️ Approaching limit - consider upgrading' : '⚡ High usage detected'}
                      </div>
                    )}
                    
                    {isUnavailable && (
                      <div className="text-xs text-red-400">
                        ⚠️ Upgrade your plan to access this feature
                      </div>
                    )}
                  </div>
                )}

                {isUnlimited && (
                  <div className="text-center py-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      ♾️ Unlimited
                    </span>
                  </div>
                )}

                {isUnavailable && (
                  <div className="text-center py-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Not Available
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Usage Summary */}
        <div className="mt-6 bg-gray-700 rounded-lg p-4">
          <h4 className="text-white font-medium mb-3">Plan Features</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full ${plan.limits.excelImport ? 'bg-green-500' : 'bg-red-500'} mr-2`}></div>
              <span className="text-sm text-gray-300">Excel Import</span>
            </div>
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full ${plan.limits.receiptScans > 0 ? 'bg-green-500' : 'bg-red-500'} mr-2`}></div>
              <span className="text-sm text-gray-300">Receipt Scanner</span>
            </div>
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full ${plan.limits.features.includes('custom_categories') ? 'bg-green-500' : 'bg-red-500'} mr-2`}></div>
              <span className="text-sm text-gray-300">Custom Categories</span>
            </div>
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full ${plan.limits.features.includes('advanced_analytics') ? 'bg-green-500' : 'bg-red-500'} mr-2`}></div>
              <span className="text-sm text-gray-300">Advanced Analytics</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}