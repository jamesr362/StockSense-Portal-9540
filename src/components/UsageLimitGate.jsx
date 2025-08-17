import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RiAlertLine, RiArrowRightLine, RiBarChartLine } from 'react-icons/ri';
import { Link } from 'react-router-dom';
import useFeatureAccess from '../hooks/useFeatureAccess';

export default function UsageLimitGate({ 
  limitType, 
  currentUsage, 
  children, 
  showUpgradePrompt = true,
  customMessage = null,
  onLimitReached = null 
}) {
  const { planLimits, currentPlan, planInfo, loading } = useFeatureAccess();
  const [limitCheck, setLimitCheck] = useState(null);

  useEffect(() => {
    if (!planLimits || loading) return;

    let allowed = false;
    let limit = 0;
    let unlimited = false;
    let reason = '';

    switch (limitType) {
      case 'inventoryItems':
        limit = planLimits.inventoryItems;
        unlimited = limit === -1;
        allowed = unlimited || currentUsage < limit;
        reason = allowed ? null : 'You have reached your inventory item limit';
        break;
      
      case 'receiptScans':
        limit = planLimits.receiptScans;
        unlimited = limit === -1;
        allowed = unlimited || (limit > 0 && currentUsage < limit);
        reason = allowed ? null : 
          limit === 0 ? 'Receipt scanning is not available on your plan' : 
          'You have reached your monthly receipt scan limit';
        break;
      
      case 'teamMembers':
        limit = planLimits.teamMembers;
        unlimited = limit === -1;
        allowed = unlimited || currentUsage < limit;
        reason = allowed ? null : 'You have reached your team member limit';
        break;
      
      default:
        allowed = true;
    }

    setLimitCheck({
      allowed,
      reason,
      limit,
      unlimited,
      remaining: unlimited ? -1 : Math.max(0, limit - currentUsage),
      usagePercentage: unlimited ? 0 : limit > 0 ? (currentUsage / limit) * 100 : 100
    });

    // Call onLimitReached if provided and limit is reached
    if (!allowed && onLimitReached) {
      onLimitReached({ limitType, currentUsage, limit, reason });
    }
  }, [planLimits, currentUsage, limitType, loading, onLimitReached]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // If limit check failed or not allowed, show upgrade prompt
  if (!limitCheck?.allowed && showUpgradePrompt) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-800 rounded-lg p-6 border border-yellow-600"
      >
        <div className="flex items-start">
          <RiAlertLine className="h-6 w-6 text-yellow-400 mr-3 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-lg font-medium text-white mb-2">
              Usage Limit Reached
            </h3>
            <p className="text-gray-300 mb-4">
              {customMessage || limitCheck?.reason || 'You\'ve reached the limit for this feature on your current plan.'}
            </p>
            
            {limitCheck?.limit > 0 && (
              <div className="bg-gray-700 rounded-lg p-3 mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Current Usage:</span>
                  <span className="text-white">{currentUsage}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Plan Limit:</span>
                  <span className="text-white">
                    {limitCheck.unlimited ? '∞' : limitCheck.limit}
                  </span>
                </div>
                {!limitCheck.unlimited && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Usage</span>
                      <span className="text-gray-400">{Math.round(limitCheck.usagePercentage)}%</span>
                    </div>
                    <div className="w-full bg-gray-600 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          limitCheck.usagePercentage >= 100 ? 'bg-red-500' :
                          limitCheck.usagePercentage >= 80 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(limitCheck.usagePercentage, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/pricing"
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Upgrade Your Plan <RiArrowRightLine className="h-4 w-4 ml-2" />
              </Link>
              
              <Link
                to="/settings/subscription"
                className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <RiBarChartLine className="h-4 w-4 mr-2" />
                View Usage
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // If allowed, render children with optional usage warning
  return (
    <div>
      {children}
      
      {/* Usage warning for near-limit situations */}
      {limitCheck?.allowed && !limitCheck?.unlimited && limitCheck?.limit > 0 && (
        <AnimatePresence>
          {limitCheck.usagePercentage >= 80 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`mt-4 p-3 rounded-lg border ${
                limitCheck.usagePercentage >= 95 ? 'bg-red-900/30 border-red-700' : 'bg-yellow-900/30 border-yellow-700'
              }`}
            >
              <div className="flex items-center">
                <RiAlertLine className={`h-4 w-4 mr-2 ${
                  limitCheck.usagePercentage >= 95 ? 'text-red-400' : 'text-yellow-400'
                }`} />
                <div className="flex-1">
                  <p className={`text-sm ${
                    limitCheck.usagePercentage >= 95 ? 'text-red-300' : 'text-yellow-300'
                  }`}>
                    {limitCheck.usagePercentage >= 95 ? 
                      `Critical: You're at ${Math.round(limitCheck.usagePercentage)}% of your ${getLimitDisplayName(limitType)} limit` :
                      `Warning: You're approaching your ${getLimitDisplayName(limitType)} limit (${Math.round(limitCheck.usagePercentage)}% used)`
                    }
                  </p>
                  <div className="mt-2 w-full bg-gray-600 rounded-full h-1">
                    <div
                      className={`h-1 rounded-full transition-all duration-300 ${
                        limitCheck.usagePercentage >= 95 ? 'bg-red-500' : 'bg-yellow-500'
                      }`}
                      style={{ width: `${Math.min(limitCheck.usagePercentage, 100)}%` }}
                    />
                  </div>
                </div>
                <Link
                  to="/pricing"
                  className={`ml-3 text-sm font-medium hover:underline ${
                    limitCheck.usagePercentage >= 95 ? 'text-red-300' : 'text-yellow-300'
                  }`}
                >
                  Upgrade
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

function getLimitDisplayName(limitType) {
  const names = {
    inventoryItems: 'inventory item',
    receiptScans: 'receipt scan',
    teamMembers: 'team member'
  };
  return names[limitType] || limitType;
}