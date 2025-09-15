import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { RiScanLine, RiHistoryLine, RiDownloadLine, RiEyeLine, RiCheckLine, RiAlertLine, RiLockLine, RiStarLine, RiArrowRightLine } from 'react-icons/ri';
import ReceiptScannerModal from '../components/ReceiptScannerModal';
import FeatureGate from '../components/FeatureGate';
import UsageLimitGate from '../components/UsageLimitGate';
import { getInventoryItems, addInventoryItem } from '../services/db';
import { useAuth } from '../context/AuthContext';
import useFeatureAccess from '../hooks/useFeatureAccess';
import { Link } from 'react-router-dom';

export default function ReceiptScanner() {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [stats, setStats] = useState({
    totalScans: 0,
    itemsScanned: 0,
    successfulScans: 0,
    lastScan: null
  });
  const { user } = useAuth();
  const { canScanReceipt, canUseFeature, currentPlan, planInfo, usageStats, incrementUsage } = useFeatureAccess();

  // Load scan history from localStorage
  useEffect(() => {
    const loadScanHistory = () => {
      try {
        const stored = localStorage.getItem(`scanHistory_${user?.email}`);
        if (stored) {
          const history = JSON.parse(stored);
          setScanHistory(history);
          updateStats(history);
        }
      } catch (error) {
        console.error('Error loading scan history:', error);
      }
    };

    if (user?.email) {
      loadScanHistory();
    }
  }, [user?.email]);

  const updateStats = (history) => {
    const totalScans = history.length;
    const itemsScanned = history.reduce((sum, scan) => sum + scan.items.length, 0);
    const successfulScans = history.filter(scan => scan.items.length > 0).length;
    const lastScan = history.length > 0 ? history[0].timestamp : null;

    setStats({
      totalScans,
      itemsScanned,
      successfulScans,
      lastScan
    });
  };

  const saveScanToHistory = (scannedItems, receiptImage = null) => {
    const scanRecord = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      items: scannedItems,
      receiptImage,
      itemCount: scannedItems.length,
      totalValue: scannedItems.reduce((sum, item) => sum + (item.unitPrice || 0), 0)
    };

    const newHistory = [scanRecord, ...scanHistory].slice(0, 50); // Keep last 50 scans
    setScanHistory(newHistory);
    updateStats(newHistory);

    // Save to localStorage
    try {
      localStorage.setItem(`scanHistory_${user.email}`, JSON.stringify(newHistory));
    } catch (error) {
      console.error('Error saving scan history:', error);
    }
  };

  const handleScannedItems = async (scannedItems, receiptImage = null) => {
    if (!user?.email || !scannedItems.length) return;

    try {
      setError(null);
      setIsLoading(true);

      let addedCount = 0;
      let failedCount = 0;

      // Add each scanned item to inventory
      for (const item of scannedItems) {
        try {
          await addInventoryItem(item, user.email);
          addedCount++;
        } catch (itemError) {
          console.error('Error adding scanned item:', itemError);
          failedCount++;
        }
      }

      // Save to scan history and increment usage
      saveScanToHistory(scannedItems, receiptImage);
      incrementUsage('receiptScan');

      if (addedCount > 0) {
        setSuccessMessage(
          `Successfully scanned and added ${addedCount} items to inventory!` +
          (failedCount > 0 ? ` (${failedCount} items failed to import)` : '')
        );
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        setError('Failed to add items from receipt scan');
      }
    } catch (error) {
      console.error('Error processing scanned items:', error);
      setError('Failed to process scanned items');
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    if (window.confirm('Are you sure you want to clear all scan history? This action cannot be undone.')) {
      setScanHistory([]);
      setStats({
        totalScans: 0,
        itemsScanned: 0,
        successfulScans: 0,
        lastScan: null
      });
      localStorage.removeItem(`scanHistory_${user?.email}`);
    }
  };

  const exportHistory = () => {
    const dataStr = JSON.stringify(scanHistory, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `receipt-scan-history-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  };

  const handleScanReceiptClick = () => {
    // Check feature access and usage limits
    const usageCheck = canScanReceipt();
    if (!usageCheck.allowed) {
      setError(usageCheck.reason);
      return;
    }

    setIsScannerOpen(true);
  };

  // Check if user has access to receipt scanner feature
  const hasReceiptScannerAccess = canUseFeature('receiptScanner');
  const usageCheck = canScanReceipt();

  // If user doesn't have access at all (not on any plan that includes it)
  if (!hasReceiptScannerAccess && currentPlan === 'free' && usageStats.receiptScans === 0) {
    return (
      <FeatureGate feature="receiptScanner">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Content will be handled by FeatureGate */}
          </motion.div>
        </div>
      </FeatureGate>
    );
  }

  // If user has used up their free scans, show upgrade prompt
  if (!usageCheck.allowed && currentPlan === 'free') {
    return (
      <div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-white">Receipt Scanner</h1>
              <p className="mt-1 text-sm text-gray-400">
                Scan receipts to automatically add items to your inventory
              </p>
            </div>
          </div>

          {/* Usage Limit Reached */}
          <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
                <RiLockLine className="h-8 w-8 text-gray-400" />
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-4">
                Monthly Scan Limit Reached
              </h3>
              
              <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                You've used your {usageCheck.limit} free receipt scan for this month. Upgrade to Professional for unlimited receipt scanning and unlock all premium features.
              </p>

              {/* Usage Stats */}
              <div className="bg-gray-700 rounded-lg p-4 mb-6 max-w-md mx-auto">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400">Used This Month:</div>
                    <div className="text-white font-medium">{usageCheck.used}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Plan Limit:</div>
                    <div className="text-white font-medium">{usageCheck.limit}</div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="w-full bg-gray-600 rounded-full h-2">
                    <div className="bg-red-500 h-2 rounded-full w-full"></div>
                  </div>
                </div>
              </div>

              {/* Professional Plan Benefits */}
              <div className="bg-gradient-to-r from-primary-600/20 to-blue-600/20 rounded-lg p-6 mb-8 border border-primary-500/30">
                <div className="flex items-center justify-center mb-4">
                  <RiStarLine className="h-6 w-6 text-yellow-400 mr-2" />
                  <h4 className="text-xl font-semibold text-white">Professional Plan Benefits</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                  <div>
                    <h5 className="text-white font-medium mb-2">📱 Receipt Scanner:</h5>
                    <ul className="text-gray-300 text-sm space-y-1">
                      <li>• Unlimited receipt scans</li>
                      <li>• Advanced OCR accuracy</li>
                      <li>• Multi-pass processing</li>
                      <li>• Batch scanning capability</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="text-white font-medium mb-2">💼 Additional Features:</h5>
                    <ul className="text-gray-300 text-sm space-y-1">
                      <li>• Unlimited inventory items</li>
                      <li>• Unlimited Excel imports</li>
                      <li>• Professional tax exports</li>
                      <li>• Priority support</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Upgrade CTA */}
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  to="/pricing"
                  className="inline-flex items-center px-8 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-semibold"
                >
                  <RiStarLine className="h-5 w-5 mr-2" />
                  Upgrade to Professional
                  <RiArrowRightLine className="h-5 w-5 ml-2" />
                </Link>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Back to Dashboard
                </Link>
              </div>

              {/* Pricing Info */}
              <div className="mt-8 pt-8 border-t border-gray-700">
                <p className="text-gray-400 text-sm">
                  Professional Plan: <span className="text-white font-semibold">£9.99/month</span> • Cancel anytime
                </p>
                <p className="text-gray-500 text-xs mt-2">
                  All features included • No setup fees • Resets monthly
                </p>
              </div>
            </div>
          </div>

          {/* Show scan history if available */}
          {scanHistory.length > 0 && (
            <div className="mt-8 bg-gray-800 rounded-lg shadow-lg">
              <div className="px-4 py-5 border-b border-gray-700 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg leading-6 font-medium text-white">Your Scan History</h3>
                    <p className="mt-1 max-w-2xl text-sm text-gray-400">
                      Your previous receipt scans this month
                    </p>
                  </div>
                  <RiHistoryLine className="h-6 w-6 text-gray-400" />
                </div>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="space-y-4">
                  {scanHistory.slice(0, 3).map((scan) => (
                    <motion.div
                      key={scan.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <RiScanLine className="h-5 w-5 text-primary-400 mr-2" />
                            <span className="text-white font-medium">
                              Scan #{scan.id}
                            </span>
                            <span className="ml-2 text-sm text-gray-400">
                              {formatDate(scan.timestamp)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center space-x-4 text-sm text-gray-400">
                            <span>{scan.itemCount} items</span>
                            <span>Total: {formatCurrency(scan.totalValue)}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {scanHistory.length > 3 && (
                    <p className="text-center text-gray-400 text-sm">
                      And {scanHistory.length - 3} more scans...
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // Regular receipt scanner page for users with access
  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white">Receipt Scanner</h1>
            <p className="mt-1 text-sm text-gray-400">
              Scan receipts to automatically add items to your inventory
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            {scanHistory.length > 0 && (
              <>
                <button
                  onClick={exportHistory}
                  className="inline-flex items-center justify-center rounded-md border border-gray-600 bg-transparent px-4 py-2 text-sm font-medium text-gray-300 shadow-sm hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 w-full sm:w-auto transition-colors"
                >
                  <RiDownloadLine className="mr-2 h-4 w-4" />
                  Export History
                </button>
                <button
                  onClick={clearHistory}
                  className="inline-flex items-center justify-center rounded-md border border-red-600 bg-transparent px-4 py-2 text-sm font-medium text-red-400 shadow-sm hover:bg-red-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 w-full sm:w-auto transition-colors"
                >
                  Clear History
                </button>
              </>
            )}
            <button
              onClick={handleScanReceiptClick}
              disabled={isLoading || !usageCheck.allowed}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 w-full sm:w-auto disabled:opacity-50"
            >
              <RiScanLine className="mr-2 h-4 w-4" />
              {isLoading ? 'Processing...' : 'Scan Receipt'}
            </button>
          </div>
        </div>

        {/* Usage Status for Free Users */}
        {currentPlan === 'free' && (
          <div className="mb-6 bg-blue-900/20 border border-blue-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-blue-400 font-medium">Free Plan Usage</h3>
                <p className="text-gray-300 text-sm">
                  You have {usageCheck.remaining || 0} of {usageCheck.limit} receipt scans remaining this month
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-400">{usageCheck.used}/{usageCheck.limit}</div>
                <div className="text-xs text-gray-400">Scans Used</div>
              </div>
            </div>
            <div className="mt-3">
              <div className="w-full bg-gray-600 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((usageCheck.used || 0) / (usageCheck.limit || 1)) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-md bg-green-900/50 p-4"
          >
            <div className="flex items-center">
              <RiCheckLine className="h-5 w-5 text-green-400 mr-2" />
              <div className="text-sm text-green-200">{successMessage}</div>
            </div>
          </motion.div>
        )}

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-md bg-red-900/50 p-4"
          >
            <div className="flex items-center">
              <RiAlertLine className="h-5 w-5 text-red-400 mr-2" />
              <div className="text-sm text-red-200">{error}</div>
            </div>
          </motion.div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-gray-800 overflow-hidden rounded-lg shadow-sm"
          >
            <div className="p-4 sm:p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <RiScanLine className="h-6 w-6 sm:h-7 sm:w-7 text-primary-400" />
                </div>
                <div className="ml-3 sm:ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-xs sm:text-sm font-medium text-gray-400 truncate">
                      Total Scans
                    </dt>
                    <dd className="flex items-baseline mt-1">
                      <div className="text-xl sm:text-2xl font-semibold text-white">
                        {stats.totalScans}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-gray-800 overflow-hidden rounded-lg shadow-sm"
          >
            <div className="p-4 sm:p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <RiCheckLine className="h-6 w-6 sm:h-7 sm:w-7 text-green-400" />
                </div>
                <div className="ml-3 sm:ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-xs sm:text-sm font-medium text-gray-400 truncate">
                      Items Scanned
                    </dt>
                    <dd className="flex items-baseline mt-1">
                      <div className="text-xl sm:text-2xl font-semibold text-white">
                        {stats.itemsScanned}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-gray-800 overflow-hidden rounded-lg shadow-sm"
          >
            <div className="p-4 sm:p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <RiCheckLine className="h-6 w-6 sm:h-7 sm:w-7 text-blue-400" />
                </div>
                <div className="ml-3 sm:ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-xs sm:text-sm font-medium text-gray-400 truncate">
                      Success Rate
                    </dt>
                    <dd className="flex items-baseline mt-1">
                      <div className="text-xl sm:text-2xl font-semibold text-white">
                        {stats.totalScans > 0 ? Math.round((stats.successfulScans / stats.totalScans) * 100) : 0}%
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-gray-800 overflow-hidden rounded-lg shadow-sm"
          >
            <div className="p-4 sm:p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <RiHistoryLine className="h-6 w-6 sm:h-7 sm:w-7 text-yellow-400" />
                </div>
                <div className="ml-3 sm:ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-xs sm:text-sm font-medium text-gray-400 truncate">
                      Last Scan
                    </dt>
                    <dd className="flex items-baseline mt-1">
                      <div className="text-sm sm:text-base font-semibold text-white break-all">
                        {stats.lastScan ? formatDate(stats.lastScan).split(' ')[0] : 'Never'}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Scan History */}
        <div className="bg-gray-800 rounded-lg shadow-lg">
          <div className="px-4 py-5 border-b border-gray-700 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg leading-6 font-medium text-white">Scan History</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-400">
                  Your recent receipt scans and extracted items
                </p>
              </div>
              <RiHistoryLine className="h-6 w-6 text-gray-400" />
            </div>
          </div>
          <div className="px-4 py-5 sm:p-6">
            {scanHistory.length === 0 ? (
              <div className="text-center py-12">
                <RiScanLine className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No scans yet</h3>
                <p className="text-gray-400 text-sm mb-6">
                  Start by scanning your first receipt to build your scan history
                </p>
                <button
                  onClick={handleScanReceiptClick}
                  disabled={!usageCheck.allowed}
                  className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  <RiScanLine className="mr-2 h-4 w-4" />
                  Scan Your First Receipt
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {scanHistory.map((scan) => (
                  <motion.div
                    key={scan.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <RiScanLine className="h-5 w-5 text-primary-400 mr-2" />
                          <span className="text-white font-medium">
                            Scan #{scan.id}
                          </span>
                          <span className="ml-2 text-sm text-gray-400">
                            {formatDate(scan.timestamp)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center space-x-4 text-sm text-gray-400">
                          <span>{scan.itemCount} items</span>
                          <span>Total: {formatCurrency(scan.totalValue)}</span>
                        </div>
                      </div>
                      {scan.receiptImage && (
                        <button
                          onClick={() => window.open(scan.receiptImage)}
                          className="text-gray-400 hover:text-gray-300 p-1"
                          title="View receipt image"
                        >
                          <RiEyeLine className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {scan.items.length > 0 && (
                      <div className="bg-gray-700 rounded-md p-3">
                        <h4 className="text-sm font-medium text-white mb-2">Extracted Items:</h4>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {scan.items.map((item, index) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span className="text-gray-300 truncate flex-1 mr-2">
                                {item.name}
                              </span>
                              <span className="text-primary-400 font-medium">
                                {formatCurrency(item.unitPrice)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Receipt Scanner Modal */}
        <ReceiptScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onItemsExtracted={handleScannedItems}
        />
      </motion.div>
    </div>
  );
}