import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { RiFileExcelLine, RiDownloadLine, RiUploadLine, RiCheckLine, RiAlertLine, RiHistoryLine, RiEyeLine, RiDeleteBin6Line, RiLockLine, RiStarLine, RiArrowRightLine } from 'react-icons/ri';
import ExcelImporterModal from '../components/ExcelImporterModal';
import FeatureGate from '../components/FeatureGate';
import UsageLimitGate from '../components/UsageLimitGate';
import { addInventoryItem } from '../services/db';
import { useAuth } from '../context/AuthContext';
import useFeatureAccess from '../hooks/useFeatureAccess';
import { Link } from 'react-router-dom';

export default function ExcelImporter() {
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [importHistory, setImportHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [stats, setStats] = useState({
    totalImports: 0,
    itemsImported: 0,
    successfulImports: 0,
    lastImport: null
  });
  const { user } = useAuth();
  const { canImportExcel, canUseFeature, canAddInventoryItem, currentPlan, planInfo, usageStats, incrementUsage } = useFeatureAccess();

  // Load import history from localStorage
  useEffect(() => {
    const loadImportHistory = () => {
      try {
        const stored = localStorage.getItem(`importHistory_${user?.email}`);
        if (stored) {
          const history = JSON.parse(stored);
          setImportHistory(history);
          updateStats(history);
        }
      } catch (error) {
        console.error('Error loading import history:', error);
      }
    };

    if (user?.email) {
      loadImportHistory();
    }
  }, [user?.email]);

  const updateStats = (history) => {
    const totalImports = history.length;
    const itemsImported = history.reduce((sum, imp) => sum + imp.itemCount, 0);
    const successfulImports = history.filter(imp => imp.status === 'success').length;
    const lastImport = history.length > 0 ? history[0].timestamp : null;

    setStats({
      totalImports,
      itemsImported,
      successfulImports,
      lastImport
    });
  };

  const saveImportToHistory = (importedItems, fileName, status = 'success') => {
    const importRecord = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      fileName: fileName || 'Unknown File',
      itemCount: importedItems.length,
      status,
      items: importedItems,
      totalValue: importedItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity || 0), 0),
      categories: [...new Set(importedItems.map(item => item.category))],
      summary: {
        totalQuantity: importedItems.reduce((sum, item) => sum + (item.quantity || 0), 0),
        avgPrice: importedItems.length > 0 ? importedItems.reduce((sum, item) => sum + (item.unitPrice || 0), 0) / importedItems.length : 0
      }
    };

    const newHistory = [importRecord, ...importHistory].slice(0, 50); // Keep last 50 imports
    setImportHistory(newHistory);
    updateStats(newHistory);

    // Save to localStorage
    try {
      localStorage.setItem(`importHistory_${user?.email}`, JSON.stringify(newHistory));
    } catch (error) {
      console.error('Error saving import history:', error);
    }
  };

  const handleImportedItems = async (importedItems, fileName) => {
    if (!user?.email || !importedItems.length) return;

    // Check if user can use Excel import feature
    const usageCheck = canImportExcel();
    if (!usageCheck.allowed) {
      setError(usageCheck.reason);
      return;
    }

    try {
      setError(null);
      setIsLoading(true);
      let addedCount = 0;
      let failedCount = 0;
      let itemsToAdd = [...importedItems];

      // Check inventory limits
      const currentInventoryCount = await getCurrentInventoryCount();
      for (let i = 0; i < itemsToAdd.length; i++) {
        const limitCheck = canAddInventoryItem(currentInventoryCount + addedCount);
        if (!limitCheck.allowed && limitCheck.limit !== -1) {
          // Hit the limit, stop adding more items
          const remainingItems = itemsToAdd.length - i;
          setError(`Added ${addedCount} items. Remaining ${remainingItems} items could not be added due to plan limits.`);
          break;
        }

        try {
          await addInventoryItem(itemsToAdd[i], user.email);
          addedCount++;
        } catch (itemError) {
          console.error('Error adding imported item:', itemError);
          failedCount++;
        }
      }

      // Save to import history and increment usage
      saveImportToHistory(importedItems, fileName, addedCount > 0 ? 'success' : 'failed');
      incrementUsage('excelImport');

      if (addedCount > 0) {
        setSuccessMessage(
          `Successfully imported ${addedCount} items from ${fileName}!` +
          (failedCount > 0 ? ` (${failedCount} items failed to import)` : '')
        );
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        setError('Failed to import any items from the spreadsheet');
      }
    } catch (error) {
      console.error('Error processing imported items:', error);
      setError('Failed to process imported items');
      saveImportToHistory(importedItems, fileName, 'failed');
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentInventoryCount = async () => {
    try {
      const { getInventoryItems } = await import('../services/db');
      const items = await getInventoryItems(user.email);
      return items.length;
    } catch (error) {
      console.error('Error getting inventory count:', error);
      return 0;
    }
  };

  const clearHistory = () => {
    if (window.confirm('Are you sure you want to clear all import history? This action cannot be undone.')) {
      setImportHistory([]);
      setStats({
        totalImports: 0,
        itemsImported: 0,
        successfulImports: 0,
        lastImport: null
      });
      localStorage.removeItem(`importHistory_${user?.email}`);
    }
  };

  const deleteImportRecord = (importId) => {
    if (window.confirm('Are you sure you want to delete this import record?')) {
      const newHistory = importHistory.filter(imp => imp.id !== importId);
      setImportHistory(newHistory);
      updateStats(newHistory);
      localStorage.setItem(`importHistory_${user?.email}`, JSON.stringify(newHistory));
    }
  };

  const exportHistory = () => {
    const dataStr = JSON.stringify(importHistory, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `import-history-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const downloadTemplate = () => {
    // Create sample data
    const sampleData = [
      ['Item Name', 'Category', 'Quantity', 'Unit Price', 'Description', 'Status', 'Date Added'],
      ['Apple iPhone 15', 'Electronics', '5', '999.99', 'Latest iPhone model', 'In Stock', '2024-01-15'],
      ['Office Chair', 'Furniture', '10', '149.99', 'Ergonomic office chair', 'In Stock', '2024-01-10'],
      ['Coffee Beans', 'Food & Beverages', '25', '12.50', 'Premium arabica beans', 'Limited Stock', '2024-01-12'],
      ['Wireless Mouse', 'Electronics', '0', '29.99', 'Bluetooth wireless mouse', 'Out of Stock', '2024-01-08'],
      ['Desk Lamp', 'Furniture', '15', '79.99', 'LED desk lamp with USB charging', 'In Stock', '2024-01-14']
    ];

    // Convert to CSV
    const csvContent = sampleData.map(row =>
      row.map(field => `"${field}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'Trackio_Inventory_Template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return <RiCheckLine className="h-5 w-5 text-green-400" />;
      case 'failed': return <RiAlertLine className="h-5 w-5 text-red-400" />;
      default: return <RiFileExcelLine className="h-5 w-5 text-blue-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const handleImportClick = () => {
    // Check feature access and usage limits
    const usageCheck = canImportExcel();
    if (!usageCheck.allowed) {
      setError(usageCheck.reason);
      return;
    }

    setIsImporterOpen(true);
  };

  // Check if user has access to Excel importer feature
  const hasExcelImporterAccess = canUseFeature('excelImporter');
  const usageCheck = canImportExcel();

  // If user doesn't have access at all (not on any plan that includes it)
  if (!hasExcelImporterAccess && currentPlan === 'free' && usageStats.excelImports === 0) {
    return (
      <FeatureGate feature="excelImporter">
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

  // If user has used up their free imports, show upgrade prompt
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
              <h1 className="text-2xl sm:text-3xl font-semibold text-white">Excel Importer</h1>
              <p className="mt-1 text-sm text-gray-400">
                Import inventory data from Excel, CSV, or ODS files
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
                Monthly Import Limit Reached
              </h3>
              
              <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                You've used your {usageCheck.limit} free Excel import for this month. Upgrade to Professional for unlimited imports and unlock all premium features.
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
                    <h5 className="text-white font-medium mb-2">📊 Excel Importer:</h5>
                    <ul className="text-gray-300 text-sm space-y-1">
                      <li>• Unlimited Excel imports</li>
                      <li>• Advanced file processing</li>
                      <li>• Smart column mapping</li>
                      <li>• Bulk data validation</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="text-white font-medium mb-2">💼 Additional Features:</h5>
                    <ul className="text-gray-300 text-sm space-y-1">
                      <li>• Unlimited inventory items</li>
                      <li>• Unlimited receipt scans</li>
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

          {/* Show import history if available */}
          {importHistory.length > 0 && (
            <div className="mt-8 bg-gray-800 rounded-lg shadow-lg">
              <div className="px-4 py-5 border-b border-gray-700 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg leading-6 font-medium text-white">Your Import History</h3>
                    <p className="mt-1 max-w-2xl text-sm text-gray-400">
                      Your previous Excel imports this month
                    </p>
                  </div>
                  <RiHistoryLine className="h-6 w-6 text-gray-400" />
                </div>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="space-y-4">
                  {importHistory.slice(0, 3).map((importRecord) => (
                    <motion.div
                      key={importRecord.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <RiFileExcelLine className="h-5 w-5 text-green-400 mr-2" />
                            <span className="text-white font-medium">
                              {importRecord.fileName}
                            </span>
                            <span className="ml-2 text-sm text-gray-400">
                              {formatDate(importRecord.timestamp)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center space-x-4 text-sm text-gray-400">
                            <span>{importRecord.itemCount} items</span>
                            <span>Total: {formatCurrency(importRecord.totalValue)}</span>
                            <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${getStatusColor(importRecord.status)}`}>
                              {importRecord.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {importHistory.length > 3 && (
                    <p className="text-center text-gray-400 text-sm">
                      And {importHistory.length - 3} more imports...
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

  // Regular Excel importer page for users with access
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
            <h1 className="text-2xl sm:text-3xl font-semibold text-white">Excel Importer</h1>
            <p className="mt-1 text-sm text-gray-400">
              Import inventory data from Excel, CSV, or ODS files
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center justify-center rounded-md border border-gray-600 bg-transparent px-4 py-2 text-sm font-medium text-gray-300 shadow-sm hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 w-full sm:w-auto transition-colors"
            >
              <RiDownloadLine className="mr-2 h-4 w-4" />
              Download Template
            </button>
            {importHistory.length > 0 && (
              <>
                <button
                  onClick={exportHistory}
                  className="inline-flex items-center justify-center rounded-md border border-blue-600 bg-transparent px-4 py-2 text-sm font-medium text-blue-400 shadow-sm hover:bg-blue-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 w-full sm:w-auto transition-colors"
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
              onClick={handleImportClick}
              disabled={isLoading || !usageCheck.allowed}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 w-full sm:w-auto disabled:opacity-50"
            >
              <RiUploadLine className="mr-2 h-4 w-4" />
              {isLoading ? 'Processing...' : 'Import Spreadsheet'}
            </button>
          </div>
        </div>

        {/* Usage Status for Free Users */}
        {currentPlan === 'free' && (
          <div className="mb-6 bg-green-900/20 border border-green-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-green-400 font-medium">Free Plan Usage</h3>
                <p className="text-gray-300 text-sm">
                  You have {usageCheck.remaining || 0} of {usageCheck.limit} Excel imports remaining this month
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-400">{usageCheck.used}/{usageCheck.limit}</div>
                <div className="text-xs text-gray-400">Imports Used</div>
              </div>
            </div>
            <div className="mt-3">
              <div className="w-full bg-gray-600 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
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
                  <RiFileExcelLine className="h-6 w-6 sm:h-7 sm:w-7 text-green-400" />
                </div>
                <div className="ml-3 sm:ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-xs sm:text-sm font-medium text-gray-400 truncate">
                      Total Imports
                    </dt>
                    <dd className="flex items-baseline mt-1">
                      <div className="text-xl sm:text-2xl font-semibold text-white">
                        {stats.totalImports}
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
                  <RiCheckLine className="h-6 w-6 sm:h-7 sm:w-7 text-blue-400" />
                </div>
                <div className="ml-3 sm:ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-xs sm:text-sm font-medium text-gray-400 truncate">
                      Items Imported
                    </dt>
                    <dd className="flex items-baseline mt-1">
                      <div className="text-xl sm:text-2xl font-semibold text-white">
                        {stats.itemsImported}
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
                  <RiCheckLine className="h-6 w-6 sm:h-7 sm:w-7 text-primary-400" />
                </div>
                <div className="ml-3 sm:ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-xs sm:text-sm font-medium text-gray-400 truncate">
                      Success Rate
                    </dt>
                    <dd className="flex items-baseline mt-1">
                      <div className="text-xl sm:text-2xl font-semibold text-white">
                        {stats.totalImports > 0 ? Math.round((stats.successfulImports / stats.totalImports) * 100) : 0}%
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
                      Last Import
                    </dt>
                    <dd className="flex items-baseline mt-1">
                      <div className="text-sm sm:text-base font-semibold text-white break-all">
                        {stats.lastImport ? formatDate(stats.lastImport).split(' ')[0] : 'Never'}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Quick Start Guide */}
        <div className="bg-gray-800 rounded-lg shadow-lg mb-8">
          <div className="px-4 py-5 border-b border-gray-700 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-white">Quick Start Guide</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-400">
              Follow these steps to import your inventory data
            </p>
          </div>
          <div className="px-4 py-5 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 text-primary-600 mb-4 mx-auto">
                  <span className="text-lg font-semibold">1</span>
                </div>
                <h4 className="text-white font-medium mb-2">Download Template</h4>
                <p className="text-gray-400 text-sm">
                  Get our Excel template with the correct column structure and sample data.
                </p>
                <button
                  onClick={downloadTemplate}
                  className="mt-3 inline-flex items-center px-3 py-1 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
                >
                  <RiDownloadLine className="h-4 w-4 mr-1" />
                  Download
                </button>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-4 mx-auto">
                  <span className="text-lg font-semibold">2</span>
                </div>
                <h4 className="text-white font-medium mb-2">Prepare Your Data</h4>
                <p className="text-gray-400 text-sm">
                  Fill in your inventory data using the template format with required columns.
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-4 mx-auto">
                  <span className="text-lg font-semibold">3</span>
                </div>
                <h4 className="text-white font-medium mb-2">Import & Review</h4>
                <p className="text-gray-400 text-sm">
                  Upload your file, map columns, review data, and confirm the import.
                </p>
                <button
                  onClick={handleImportClick}
                  disabled={!usageCheck.allowed}
                  className="mt-3 inline-flex items-center px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  <RiUploadLine className="h-4 w-4 mr-1" />
                  Start Import
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Import History */}
        <div className="bg-gray-800 rounded-lg shadow-lg">
          <div className="px-4 py-5 border-b border-gray-700 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg leading-6 font-medium text-white">Import History</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-400">
                  Your recent Excel imports and their details
                </p>
              </div>
              <RiHistoryLine className="h-6 w-6 text-gray-400" />
            </div>
          </div>
          <div className="px-4 py-5 sm:p-6">
            {importHistory.length === 0 ? (
              <div className="text-center py-12">
                <RiFileExcelLine className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No imports yet</h3>
                <p className="text-gray-400 text-sm mb-6">
                  Start by importing your first spreadsheet to build your import history
                </p>
                <button
                  onClick={handleImportClick}
                  disabled={!usageCheck.allowed}
                  className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  <RiUploadLine className="mr-2 h-4 w-4" />
                  Import Your First Spreadsheet
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {importHistory.map((importRecord) => (
                  <motion.div
                    key={importRecord.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center">
                          {getStatusIcon(importRecord.status)}
                          <span className="text-white font-medium ml-2">
                            {importRecord.fileName}
                          </span>
                          <span className="ml-2 text-sm text-gray-400">
                            {formatDate(importRecord.timestamp)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center space-x-4 text-sm text-gray-400">
                          <span>{importRecord.itemCount} items</span>
                          <span>Total: {formatCurrency(importRecord.totalValue)}</span>
                          <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${getStatusColor(importRecord.status)}`}>
                            {importRecord.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            const details = `Import Details:

File: ${importRecord.fileName}
Date: ${formatDate(importRecord.timestamp)}
Items: ${importRecord.itemCount}
Total Value: ${formatCurrency(importRecord.totalValue)}
Categories: ${importRecord.categories.join(', ')}

Total Quantity: ${importRecord.summary.totalQuantity}
Average Price: ${formatCurrency(importRecord.summary.avgPrice)}`;
                            alert(details);
                          }}
                          className="text-gray-400 hover:text-gray-300 p-1"
                          title="View details"
                        >
                          <RiEyeLine className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteImportRecord(importRecord.id)}
                          className="text-gray-400 hover:text-red-400 p-1"
                          title="Delete import record"
                        >
                          <RiDeleteBin6Line className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {importRecord.categories.length > 0 && (
                      <div className="bg-gray-700 rounded-md p-3">
                        <h4 className="text-sm font-medium text-white mb-2">Categories Imported:</h4>
                        <div className="flex flex-wrap gap-2">
                          {importRecord.categories.map((category, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-600 text-gray-200"
                            >
                              {category}
                            </span>
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

      {/* Excel Importer Modal */}
      <ExcelImporterModal
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onItemsImported={handleImportedItems}
      />
    </div>
  );
}