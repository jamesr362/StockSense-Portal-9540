import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { RiScanLine, RiHistoryLine, RiDownloadLine, RiEyeLine, RiCheckLine, RiAlertLine } from 'react-icons/ri';
import ReceiptScannerModal from '../components/ReceiptScannerModal';
import { getInventoryItems, addInventoryItem } from '../services/db';
import { useAuth } from '../context/AuthContext';

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
      localStorage.setItem(`scanHistory_${user?.email}`, JSON.stringify(newHistory));
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

      // Add each scanned item to inventory
      for (const item of scannedItems) {
        try {
          await addInventoryItem(item, user.email);
          addedCount++;
        } catch (itemError) {
          console.error('Error adding scanned item:', itemError);
        }
      }

      // Save to scan history
      saveScanToHistory(scannedItems, receiptImage);

      if (addedCount > 0) {
        setSuccessMessage(`Successfully scanned and added ${addedCount} items to inventory!`);
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
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
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
              onClick={() => setIsScannerOpen(true)}
              disabled={isLoading}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 w-full sm:w-auto disabled:opacity-50"
            >
              <RiScanLine className="mr-2 h-4 w-4" />
              {isLoading ? 'Processing...' : 'Scan Receipt'}
            </button>
          </div>
        </div>

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
                  onClick={() => setIsScannerOpen(true)}
                  className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
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
      </motion.div>

      {/* Receipt Scanner Modal */}
      <ReceiptScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onItemsExtracted={handleScannedItems}
      />
    </div>
  );
}