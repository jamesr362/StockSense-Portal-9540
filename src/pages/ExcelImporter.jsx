import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { RiFileExcelLine, RiDownloadLine, RiUploadLine, RiCheckLine, RiAlertLine, RiHistoryLine, RiEyeLine, RiDeleteBin6Line, RiArrowRightLine } from 'react-icons/ri';
import { useNavigate } from 'react-router-dom';
import ExcelImporterModal from '../components/ExcelImporterModal';
import { addInventoryItem, getInventoryItems } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { trackUsage, canPerformAction, isAtOrOverLimit } from '../lib/stripe';

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
  const [limitReached, setLimitReached] = useState(false);
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const userPlan = user?.subscriptionPlan || 'free';

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

    const checkImportLimits = async () => {
      try {
        // Check if user has reached their Excel import limit
        if (isAtOrOverLimit(userPlan, 'excelImports')) {
          setLimitReached(true);
        } else {
          setLimitReached(false);
        }
      } catch (error) {
        console.error('Error checking import limits:', error);
      }
    };

    if (user?.email) {
      loadImportHistory();
      checkImportLimits();
    }
  }, [user?.email, userPlan]);

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
    
    // Check if user can import Excel files based on their plan
    if (!canPerformAction(userPlan, 'import_excel')) {
      setError('You have reached your Excel import limit. Please upgrade your plan to import more files.');
      return;
    }

    try {
      setError(null);
      setIsLoading(true);
      
      let addedCount = 0;
      let failedCount = 0;
      
      // Check if adding these items would exceed the inventory limit
      const currentItems = await getInventoryItems(user.email);
      const itemLimit = userPlan === 'free' ? 10 : (userPlan === 'pro' ? 2500 : -1);
      let remainingSlots = itemLimit === -1 ? Infinity : itemLimit - currentItems.length;

      // Add each imported item to inventory, respecting the limit
      for (const item of importedItems) {
        if (remainingSlots > 0 || itemLimit === -1) {
          try {
            await addInventoryItem(item, user.email);
            addedCount++;
            if (itemLimit !== -1) remainingSlots--;
          } catch (itemError) {
            console.error('Error adding imported item:', itemError);
            failedCount++;
          }
        } else {
          failedCount++;
        }
      }

      // Track Excel import usage
      trackUsage('excel_imports_month', 1);
      
      // Save to import history
      saveImportToHistory(importedItems, fileName, addedCount > 0 ? 'success' : 'failed');
      
      if (addedCount > 0) {
        let message = `Successfully imported ${addedCount} items from ${fileName}!`;
        if (failedCount > 0) {
          message += ` (${failedCount} items couldn't be added due to your plan limits)`;
        }
        setSuccessMessage(message);
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        setError('Failed to import any items due to plan limits. Please upgrade your plan.');
      }
      
      // Update limit status
      if (isAtOrOverLimit(userPlan, 'excelImports')) {
        setLimitReached(true);
      }
      
    } catch (error) {
      console.error('Error processing imported items:', error);
      setError('Failed to process imported items');
      saveImportToHistory(importedItems, fileName, 'failed');
    } finally {
      setIsLoading(false);
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
    const csvContent = sampleData
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

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

  const getImportLimitInfo = () => {
    if (userPlan === 'free') {
      return {
        limit: 1,
        text: 'Free plan allows only 1 Excel import (lifetime)'
      };
    } else if (userPlan === 'pro') {
      return {
        limit: 10,
        text: 'Professional plan allows 10 Excel imports per month'
      };
    } else {
      return {
        limit: -1,
        text: 'Power plan includes unlimited Excel imports'
      };
    }
  };

  const importLimitInfo = getImportLimitInfo();

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
              <RiDownloadLine className="mr-2 h-4 w-4" /> Download Template
            </button>

            {importHistory.length > 0 && (
              <>
                <button
                  onClick={exportHistory}
                  className="inline-flex items-center justify-center rounded-md border border-blue-600 bg-transparent px-4 py-2 text-sm font-medium text-blue-400 shadow-sm hover:bg-blue-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 w-full sm:w-auto transition-colors"
                >
                  <RiDownloadLine className="mr-2 h-4 w-4" /> Export History
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
              onClick={() => setIsImporterOpen(true)}
              disabled={isLoading || limitReached}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 w-full sm:w-auto disabled:opacity-50"
            >
              <RiUploadLine className="mr-2 h-4 w-4" />
              {isLoading ? 'Processing...' : 'Import Spreadsheet'}
            </button>
          </div>
        </div>

        {/* Plan Limit Warning */}
        {limitReached && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-md bg-red-900/50 p-4"
          >
            <div className="flex items-start">
              <RiAlertLine className="h-5 w-5 text-red-400 mr-2 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-200">
                  You've reached your Excel import limit ({userPlan === 'free' ? '1 lifetime import' : '10 imports per month'}).
                </p>
                <div className="mt-2">
                  <button 
                    onClick={() => navigate('/subscription')}
                    className="inline-flex items-center px-3 py-1 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
                  >
                    Upgrade Plan <RiArrowRightLine className="ml-1 h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
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

        {/* Plan Info Banner */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-3 bg-gray-800 rounded-lg border border-gray-700"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <RiFileExcelLine className="h-5 w-5 text-primary-400 mr-2" />
              <span className="text-sm text-gray-300">
                {importLimitInfo.text}
              </span>
            </div>
            {userPlan !== 'power' && (
              <button 
                onClick={() => navigate('/subscription')}
                className="text-xs text-primary-400 hover:text-primary-300 underline"
              >
                Upgrade for more imports
              </button>
            )}
          </div>
        </motion.div>

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
                  <RiDownloadLine className="h-4 w-4 mr-1" /> Download
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
                  onClick={() => setIsImporterOpen(true)}
                  disabled={limitReached}
                  className={`mt-3 inline-flex items-center px-3 py-1 text-white rounded text-sm ${limitReached ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  <RiUploadLine className="h-4 w-4 mr-1" /> Start Import
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
                  onClick={() => setIsImporterOpen(true)}
                  disabled={limitReached}
                  className={`inline-flex items-center px-4 py-2 text-white rounded-lg ${limitReached ? 'bg-gray-600 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'}`}
                >
                  <RiUploadLine className="mr-2 h-4 w-4" /> Import Your First Spreadsheet
                </button>
                
                {limitReached && (
                  <div className="mt-4 p-4 bg-gray-700 rounded-lg max-w-md mx-auto">
                    <p className="text-gray-300 mb-3">
                      You've reached the {userPlan === 'free' ? '1 lifetime' : '10 monthly'} Excel import limit of your {userPlan} plan.
                    </p>
                    <button 
                      onClick={() => navigate('/subscription')}
                      className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      Upgrade Your Plan <RiArrowRightLine className="ml-1 h-4 w-4" />
                    </button>
                  </div>
                )}
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
                          <RiFileExcelLine className="h-5 w-5 text-primary-400 mr-2" />
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
                          <span
                            className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                              importRecord.status === 'success'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {importRecord.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            const details = `Import Details: File: ${importRecord.fileName} Date: ${formatDate(
                              importRecord.timestamp
                            )} Items: ${importRecord.itemCount} Total Value: ${formatCurrency(
                              importRecord.totalValue
                            )} Categories: ${importRecord.categories.join(',')} Total Quantity: ${
                              importRecord.summary.totalQuantity
                            } Average Price: ${formatCurrency(importRecord.summary.avgPrice)}`;
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