import { motion, AnimatePresence } from 'framer-motion';
import { RiAlertLine, RiArrowRightLine, RiCloseLine } from 'react-icons/ri';
import { useState } from 'react';
import { getUsageStats } from '../lib/stripe';
import { useNavigate } from 'react-router-dom';

export default function UsageLimitWarning({ userPlan, onUpgrade }) {
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  // Don't show for paid users
  if (userPlan !== 'free') return null;

  const usage = getUsageStats(userPlan);

  // Check if any limits are close to being hit
  const isNearLimit = Object.values(usage).some(stat => stat.percentage > 80);
  const isAtLimit = Object.values(usage).some(stat => stat.percentage >= 100);

  if (!isNearLimit || dismissed) return null;

  const handleUpgradeClick = () => {
    navigate('/subscription');
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className={`relative mb-6 rounded-lg p-4 ${
          isAtLimit ? 'bg-red-900/50 border border-red-700' : 'bg-yellow-900/50 border border-yellow-700'
        }`}
      >
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-300"
        >
          <RiCloseLine className="h-5 w-5" />
        </button>
        <div className="flex items-start">
          <RiAlertLine
            className={`h-6 w-6 mr-3 mt-0.5 ${isAtLimit ? 'text-red-400' : 'text-yellow-400'}`}
          />
          <div className="flex-1">
            <h3 className={`font-semibold mb-2 ${isAtLimit ? 'text-red-300' : 'text-yellow-300'}`}>
              {isAtLimit ? 'You\'ve Hit Your Limits!' : 'Approaching Your Limits'}
            </h3>
            <div className="space-y-2 mb-4">
              {usage.inventoryItems.percentage > 80 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Inventory Items:</span>
                  <span
                    className={`font-medium ${
                      usage.inventoryItems.percentage >= 100 ? 'text-red-400' : 'text-yellow-400'
                    }`}
                  >
                    {usage.inventoryItems.current}/{usage.inventoryItems.limit}
                  </span>
                </div>
              )}
              {usage.receiptScans.percentage > 80 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Receipt Scans (this month):</span>
                  <span
                    className={`font-medium ${
                      usage.receiptScans.percentage >= 100 ? 'text-red-400' : 'text-yellow-400'
                    }`}
                  >
                    {usage.receiptScans.current}/{usage.receiptScans.limit}
                  </span>
                </div>
              )}
              {usage.excelImports.percentage > 80 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Excel Imports:</span>
                  <span
                    className={`font-medium ${
                      usage.excelImports.percentage >= 100 ? 'text-red-400' : 'text-yellow-400'
                    }`}
                  >
                    {usage.excelImports.current}/{usage.excelImports.limit}
                  </span>
                </div>
              )}
            </div>
            <p className={`text-sm mb-4 ${isAtLimit ? 'text-red-200' : 'text-yellow-200'}`}>
              {isAtLimit
                ? 'Upgrade now to continue managing your inventory without restrictions.'
                : 'Upgrade to Professional before you hit these limits and can\'t add more items.'}
            </p>
            <button
              onClick={handleUpgradeClick}
              className={`inline-flex items-center px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                isAtLimit
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-yellow-600 text-white hover:bg-yellow-700'
              }`}
            >
              Upgrade Now <RiArrowRightLine className="h-4 w-4 ml-2" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}