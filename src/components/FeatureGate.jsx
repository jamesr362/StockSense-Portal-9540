import { motion, AnimatePresence } from 'framer-motion';
import { RiLockLine, RiArrowRightLine, RiStarLine, RiAlertLine } from 'react-icons/ri';
import { Link } from 'react-router-dom';
import useFeatureAccess from '../hooks/useFeatureAccess';

export default function FeatureGate({ 
  feature, 
  children, 
  fallback = null,
  showUpgradePrompt = true,
  customMessage = null,
  requiredPlan = null 
}) {
  const { canUseFeature, currentPlan, planInfo, loading } = useFeatureAccess();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const hasAccess = canUseFeature(feature);

  if (hasAccess) {
    return children;
  }

  if (fallback) {
    return fallback;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gray-800 rounded-lg p-6 border border-gray-700"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
            <RiLockLine className="h-5 w-5 text-gray-400" />
          </div>
        </div>
        <div className="ml-4 flex-1">
          <h3 className="text-lg font-medium text-white mb-2">
            Premium Feature
          </h3>
          <p className="text-gray-300 mb-4">
            {customMessage || getFeatureMessage(feature)}
          </p>
          
          <div className="bg-gray-700 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-400">Current Plan:</span>
              <span className="text-white font-medium">{planInfo.name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Required Plan:</span>
              <span className="text-primary-400 font-medium">
                {requiredPlan || getRequiredPlan(feature)}
              </span>
            </div>
          </div>
          
          <Link
            to="/pricing"
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <RiStarLine className="h-4 w-4 mr-2" />
            Upgrade Plan
            <RiArrowRightLine className="h-4 w-4 ml-2" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

function getFeatureMessage(feature) {
  const messages = {
    receiptScanner: 'Receipt scanning allows you to automatically extract items from receipts and add them to your inventory.',
    excelImporter: 'Excel import lets you bulk import inventory data from spreadsheets.',
    advancedAnalytics: 'Advanced analytics provide detailed insights into your inventory trends and performance.',
    customCategories: 'Create custom categories to better organize your inventory items.',
    multipleLocations: 'Manage inventory across multiple locations or warehouses.',
    apiAccess: 'Access our REST API to integrate with your existing systems.',
    bulkOperations: 'Perform bulk operations on multiple inventory items at once.',
    prioritySupport: 'Get priority customer support with faster response times.'
  };
  
  return messages[feature] || 'This feature is available with a premium plan.';
}

function getRequiredPlan(feature) {
  const requirements = {
    receiptScanner: 'Basic Plan or higher',
    excelImporter: 'Basic Plan or higher',
    advancedAnalytics: 'Professional Plan',
    customCategories: 'Professional Plan',
    multipleLocations: 'Professional Plan',
    apiAccess: 'Professional Plan',
    bulkOperations: 'Professional Plan',
    prioritySupport: 'Professional Plan'
  };
  
  return requirements[feature] || 'Premium Plan';
}