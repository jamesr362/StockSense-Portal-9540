import {useState, useEffect} from 'react';
import {motion, AnimatePresence} from 'framer-motion';
import {RiAlertLine, RiArrowRightLine, RiCheckLine} from 'react-icons/ri';
import {checkPlanLimit} from '../services/subscriptionService';
import {useAuth} from '../context/AuthContext';
import {Link} from 'react-router-dom';

export default function PlanLimitChecker({ 
  limitType, 
  currentUsage, 
  children,
  showUpgradePrompt = true,
  customMessage = null 
}) {
  const [limitCheck, setLimitCheck] = useState(null);
  const [loading, setLoading] = useState(true);
  const {user} = useAuth();

  useEffect(() => {
    const checkLimit = async () => {
      if (!user?.email) return;
      
      try {
        const result = await checkPlanLimit(user.email, limitType, currentUsage);
        setLimitCheck(result);
      } catch (error) {
        console.error('Error checking plan limit:', error);
        setLimitCheck({ allowed: false, reason: 'Error checking limits' });
      } finally {
        setLoading(false);
      }
    };

    checkLimit();
  }, [user?.email, limitType, currentUsage]);

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
              Plan Limit Reached
            </h3>
            <p className="text-gray-300 mb-4">
              {customMessage || limitCheck?.reason || 'You\'ve reached the limit for this feature on your current plan.'}
            </p>
            
            {limitCheck?.limit && (
              <div className="bg-gray-700 rounded-lg p-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Current Usage:</span>
                  <span className="text-white">{currentUsage}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Plan Limit:</span>
                  <span className="text-white">
                    {limitCheck.unlimited ? 'Unlimited' : limitCheck.limit}
                  </span>
                </div>
                {!limitCheck.unlimited && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-600 rounded-full h-2">
                      <div 
                        className="bg-yellow-500 h-2 rounded-full" 
                        style={{ width: `${Math.min((currentUsage / limitCheck.limit) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <Link
              to="/pricing"
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Upgrade Your Plan
              <RiArrowRightLine className="h-4 w-4 ml-2" />
            </Link>
          </div>
        </div>
      </motion.div>
    );
  }

  // If allowed, render children with optional usage indicator
  return (
    <div>
      {children}
      
      {/* Optional usage indicator for near-limit situations */}
      {limitCheck?.allowed && !limitCheck?.unlimited && limitCheck?.limit && (
        <AnimatePresence>
          {(limitCheck.remaining / limitCheck.limit) < 0.2 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg"
            >
              <div className="flex items-center">
                <RiAlertLine className="h-4 w-4 text-yellow-400 mr-2" />
                <div className="flex-1">
                  <p className="text-yellow-300 text-sm">
                    You're approaching your plan limit: {currentUsage}/{limitCheck.limit} used
                  </p>
                  <div className="mt-2 w-full bg-gray-600 rounded-full h-1">
                    <div 
                      className="bg-yellow-500 h-1 rounded-full transition-all duration-300" 
                      style={{ width: `${(currentUsage / limitCheck.limit) * 100}%` }}
                    />
                  </div>
                </div>
                <Link
                  to="/pricing"
                  className="ml-3 text-yellow-300 hover:text-yellow-200 text-sm font-medium"
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