import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiUploadCloud, FiFileText, FiCheckCircle, FiImage, FiTrash2, FiEye, FiCalendar, FiPackage, FiX, FiDownload, FiArchive, FiCamera } from 'react-icons/fi';
import ReceiptScannerModal from '../components/ReceiptScannerModal';
import { useAuth } from '../context/AuthContext';
import { addInventoryItem } from '../services/db';
import receiptStorage from '../services/receiptStorage';
import SafeIcon from '../common/SafeIcon';

const ReceiptScannerPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scannedItems, setScannedItems] = useState([]);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('scanner');
  const [receiptHistory, setReceiptHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedReceiptsForExport, setSelectedReceiptsForExport] = useState(new Set());
  const [showExportOptions, setShowExportOptions] = useState(false);
  const { user } = useAuth();

  // Load receipt history on component mount and tab change
  useEffect(() => {
    if (activeTab === 'history' && user) {
      loadReceiptHistory();
    }
  }, [activeTab, user]);

  const loadReceiptHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const receipts = await receiptStorage.getUserReceipts(user.email);
      setReceiptHistory(receipts);
    } catch (error) {
      console.error('Error loading receipt history:', error);
      setFeedbackMessage('❌ Failed to load receipt history');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleItemsScanned = async (items) => {
    console.log('=== handleItemsScanned called ===');
    console.log('User:', user);
    console.log('Items received:', items);

    if (!user || !user.email) {
      setFeedbackMessage('❌ You must be logged in to add items.');
      return;
    }

    if (!items || items.length === 0) {
      setFeedbackMessage('❌ No items to save.');
      return;
    }

    setIsProcessing(true);
    setFeedbackMessage('💾 Saving items to your inventory...');
    
    let successCount = 0;
    const failedItems = [];

    for (const item of items) {
      try {
        console.log('Adding item:', item);
        
        // Validate item data
        if (!item.name || !item.name.trim()) {
          console.log('Skipping item with empty name:', item);
          failedItems.push('Empty item name');
          continue;
        }

        if (!item.quantity || item.quantity <= 0) {
          console.log('Setting default quantity for item:', item.name);
          item.quantity = 1;
        }

        if (!item.unitPrice || item.unitPrice <= 0) {
          console.log('Skipping item with invalid price:', item);
          failedItems.push(item.name + ' (invalid price)');
          continue;
        }

        // Prepare item data for database
        const itemData = {
          name: item.name.trim(),
          quantity: parseInt(item.quantity) || 1,
          unitPrice: parseFloat(item.unitPrice) || 0,
          category: item.category || 'Scanned Items',
          description: item.description || `Scanned from receipt on ${new Date().toLocaleDateString()}`,
          status: item.status || 'In Stock',
          dateAdded: item.dateAdded || new Date().toISOString().split('T')[0]
        };

        console.log('Calling addInventoryItem with:', itemData, user.email);
        
        // Call the database function with correct parameter order
        await addInventoryItem(itemData, user.email);
        successCount++;
        
        console.log('Successfully added item:', item.name);
      } catch (error) {
        console.error('Failed to add item:', item.name, error);
        failedItems.push(item.name + ' (' + error.message + ')');
      }
    }
    
    // Update the scanned items list for display
    const validItems = items.filter(item => 
      item.name && item.name.trim() && 
      item.unitPrice && item.unitPrice > 0
    );
    setScannedItems(prev => [...validItems, ...prev]);
    
    // Show feedback
    if (failedItems.length === 0) {
      setFeedbackMessage(`✅ Successfully added ${successCount} items to inventory!`);
    } else if (successCount > 0) {
      setFeedbackMessage(`⚠️ Added ${successCount} items. Failed to add: ${failedItems.join(', ')}`);
    } else {
      setFeedbackMessage(`❌ Failed to add items. Errors: ${failedItems.join(', ')}`);
    }
    
    setIsProcessing(false);
    
    // Clear message after 8 seconds
    setTimeout(() => setFeedbackMessage(''), 8000);
  };

  const handleReceiptSaved = (receiptRecord) => {
    console.log('Receipt saved:', receiptRecord);
    // Refresh history if we're on that tab
    if (activeTab === 'history') {
      loadReceiptHistory();
    }
    setFeedbackMessage(`✅ Receipt saved to history with ${receiptRecord.total_items} items!`);
  };

  const viewReceiptImage = async (receipt) => {
    setIsLoadingImage(true);
    try {
      console.log('🖼️ Loading receipt image for:', receipt.file_name);
      console.log('Storage path:', receipt.storage_path);
      
      const imageUrl = await receiptStorage.getReceiptUrl(receipt.storage_path);
      console.log('📸 Received image URL:', imageUrl ? 'URL received' : 'No URL');
      
      if (imageUrl) {
        setSelectedReceipt({ ...receipt, imageUrl });
        console.log('✅ Receipt image loaded successfully');
      } else {
        console.error('❌ No image URL returned from storage service');
        setFeedbackMessage('❌ Failed to load receipt image - no URL returned');
        
        // Show detailed error for debugging
        setTimeout(() => {
          setFeedbackMessage('💡 Try refreshing the page or check if the receipt file still exists in storage');
        }, 3000);
      }
    } catch (error) {
      console.error('❌ Error loading receipt image:', error);
      setFeedbackMessage(`❌ Failed to load receipt image: ${error.message}`);
    } finally {
      setIsLoadingImage(false);
    }
  };

  const deleteReceipt = async (receiptId) => {
    if (!confirm('Are you sure you want to delete this receipt? This action cannot be undone.')) {
      return;
    }

    try {
      await receiptStorage.deleteReceiptRecord(receiptId);
      setFeedbackMessage('✅ Receipt deleted successfully');
      loadReceiptHistory(); // Refresh the list
      setSelectedReceipt(null); // Close modal if open
    } catch (error) {
      console.error('Error deleting receipt:', error);
      setFeedbackMessage('❌ Failed to delete receipt');
    }
  };

  // Export functionality
  const downloadImage = async (imageUrl, filename) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('Error downloading image:', error);
      return false;
    }
  };

  const exportSingleReceipt = async (receipt) => {
    setIsExporting(true);
    try {
      const imageUrl = await receiptStorage.getReceiptUrl(receipt.storage_path);
      if (imageUrl) {
        const filename = receipt.file_name || `receipt-${receipt.id}.jpg`;
        const success = await downloadImage(imageUrl, filename);
        
        if (success) {
          setFeedbackMessage(`✅ Receipt "${filename}" downloaded successfully!`);
        } else {
          setFeedbackMessage(`❌ Failed to download receipt "${filename}"`);
        }
      } else {
        setFeedbackMessage('❌ Failed to get receipt image URL');
      }
    } catch (error) {
      console.error('Error exporting receipt:', error);
      setFeedbackMessage(`❌ Error exporting receipt: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const exportMultipleReceipts = async () => {
    if (selectedReceiptsForExport.size === 0) {
      setFeedbackMessage('❌ Please select receipts to export');
      return;
    }

    setIsExporting(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const receiptsToExport = receiptHistory.filter(receipt => 
        selectedReceiptsForExport.has(receipt.id)
      );

      setFeedbackMessage(`📦 Exporting ${receiptsToExport.length} receipts...`);

      for (const receipt of receiptsToExport) {
        try {
          const imageUrl = await receiptStorage.getReceiptUrl(receipt.storage_path);
          if (imageUrl) {
            const filename = receipt.file_name || `receipt-${receipt.id}.jpg`;
            const success = await downloadImage(imageUrl, filename);
            
            if (success) {
              successCount++;
            } else {
              failCount++;
            }
          } else {
            failCount++;
          }
          
          // Small delay between downloads to avoid overwhelming the browser
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error('Error exporting receipt:', receipt.id, error);
          failCount++;
        }
      }

      // Show final result
      if (failCount === 0) {
        setFeedbackMessage(`✅ Successfully exported ${successCount} receipts!`);
      } else if (successCount > 0) {
        setFeedbackMessage(`⚠️ Exported ${successCount} receipts, failed to export ${failCount} receipts`);
      } else {
        setFeedbackMessage(`❌ Failed to export all ${failCount} receipts`);
      }

      // Clear selection
      setSelectedReceiptsForExport(new Set());
      setShowExportOptions(false);
    } catch (error) {
      console.error('Error in bulk export:', error);
      setFeedbackMessage(`❌ Error during bulk export: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const exportAllReceipts = async () => {
    if (receiptHistory.length === 0) {
      setFeedbackMessage('❌ No receipts to export');
      return;
    }

    if (!confirm(`Are you sure you want to export all ${receiptHistory.length} receipts? This may take a while.`)) {
      return;
    }

    setIsExporting(true);
    let successCount = 0;
    let failCount = 0;

    try {
      setFeedbackMessage(`📦 Exporting all ${receiptHistory.length} receipts...`);

      for (const receipt of receiptHistory) {
        try {
          const imageUrl = await receiptStorage.getReceiptUrl(receipt.storage_path);
          if (imageUrl) {
            const filename = receipt.file_name || `receipt-${receipt.id}.jpg`;
            const success = await downloadImage(imageUrl, filename);
            
            if (success) {
              successCount++;
            } else {
              failCount++;
            }
          } else {
            failCount++;
          }
          
          // Small delay between downloads
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error('Error exporting receipt:', receipt.id, error);
          failCount++;
        }
      }

      // Show final result
      if (failCount === 0) {
        setFeedbackMessage(`✅ Successfully exported all ${successCount} receipts!`);
      } else if (successCount > 0) {
        setFeedbackMessage(`⚠️ Exported ${successCount} receipts, failed to export ${failCount} receipts`);
      } else {
        setFeedbackMessage(`❌ Failed to export all receipts`);
      }

      setShowExportOptions(false);
    } catch (error) {
      console.error('Error in export all:', error);
      setFeedbackMessage(`❌ Error during export: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const toggleReceiptSelection = (receiptId) => {
    const newSelection = new Set(selectedReceiptsForExport);
    if (newSelection.has(receiptId)) {
      newSelection.delete(receiptId);
    } else {
      newSelection.add(receiptId);
    }
    setSelectedReceiptsForExport(newSelection);
  };

  const selectAllReceipts = () => {
    if (selectedReceiptsForExport.size === receiptHistory.length) {
      setSelectedReceiptsForExport(new Set());
    } else {
      setSelectedReceiptsForExport(new Set(receiptHistory.map(r => r.id)));
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateMobile = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-4 sm:p-6 max-w-6xl mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center">
            <SafeIcon icon={FiCamera} className="mr-2 sm:mr-3 text-blue-400" />
            Receipt Scanner
          </h1>
          <p className="mt-2 text-gray-400 max-w-2xl text-sm sm:text-base">
            Quickly add items to your inventory by scanning receipt images. 
            Our enhanced OCR technology extracts item names, quantities, and prices automatically with right-side price detection.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          disabled={isProcessing}
          className="mt-4 sm:mt-0 flex items-center justify-center px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base w-full sm:w-auto"
        >
          <SafeIcon icon={FiUploadCloud} className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
          {isProcessing ? 'Processing...' : 'Scan New Receipt'}
        </button>
      </div>

      {/* Feedback Message */}
      {feedbackMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-6 p-4 rounded-lg border text-sm ${
            feedbackMessage.includes('✅') 
              ? 'bg-green-900/50 border-green-700 text-green-300'
              : feedbackMessage.includes('⚠️')
              ? 'bg-yellow-900/50 border-yellow-700 text-yellow-300'
              : feedbackMessage.includes('❌')
              ? 'bg-red-900/50 border-red-700 text-red-300'
              : 'bg-blue-900/50 border-blue-700 text-blue-300'
          }`}
        >
          {feedbackMessage}
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 mb-6 bg-gray-800 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('scanner')}
          className={`flex-1 py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-colors ${
            activeTab === 'scanner'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <SafeIcon icon={FiCamera} className="inline mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Scanner</span>
          <span className="sm:hidden">Scan</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <SafeIcon icon={FiImage} className="inline mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Receipt History</span>
          <span className="sm:hidden">History</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'scanner' ? (
        <>
          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8">
            <div className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
              <div className="flex items-center mb-4">
                <SafeIcon icon={FiCamera} className="h-6 w-6 sm:h-8 sm:w-8 text-blue-400 mr-3" />
                <h3 className="text-base sm:text-lg font-semibold text-white">Enhanced OCR</h3>
              </div>
              <p className="text-gray-400 text-xs sm:text-sm">
                Advanced optical character recognition with right-side price detection ensures accurate extraction of items and prices.
              </p>
            </div>

            <div className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
              <div className="flex items-center mb-4">
                <SafeIcon icon={FiFileText} className="h-6 w-6 sm:h-8 sm:w-8 text-blue-400 mr-3" />
                <h3 className="text-base sm:text-lg font-semibold text-white">Smart Parsing</h3>
              </div>
              <p className="text-gray-400 text-xs sm:text-sm">
                Intelligent algorithms identify item names, quantities, and prices from receipt text, filtering out irrelevant numbers.
              </p>
            </div>

            <div className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
              <div className="flex items-center mb-4">
                <SafeIcon icon={FiCheckCircle} className="h-6 w-6 sm:h-8 sm:w-8 text-green-400 mr-3" />
                <h3 className="text-base sm:text-lg font-semibold text-white">Receipt Storage</h3>
              </div>
              <p className="text-gray-400 text-xs sm:text-sm">
                All receipt images are securely stored in your history with extracted items data for future reference.
              </p>
            </div>
          </div>

          {/* Recently Scanned Items */}
          <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700">
            <div className="p-4 sm:p-6 border-b border-gray-700">
              <h2 className="text-lg sm:text-xl font-semibold text-white flex items-center">
                <SafeIcon icon={FiFileText} className="mr-2 sm:mr-3 text-blue-400" />
                Recently Scanned Items
                {scannedItems.length > 0 && (
                  <span className="ml-2 px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                    {scannedItems.length}
                  </span>
                )}
              </h2>
            </div>
            <div className="p-4 sm:p-6">
              {scannedItems.length > 0 ? (
                <div className="space-y-3 sm:space-y-4 max-h-96 overflow-y-auto">
                  {scannedItems.slice(0, 20).map((item, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex justify-between items-center bg-gray-700/50 p-3 sm:p-4 rounded-lg border border-gray-600"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white text-sm sm:text-base truncate">{item.name}</p>
                        <div className="flex flex-col sm:flex-row sm:items-center text-xs sm:text-sm text-gray-400 mt-1">
                          <span>Qty: {item.quantity}</span>
                          <span className="hidden sm:inline mx-2">•</span>
                          <span>Added to inventory</span>
                          <span className="hidden sm:inline mx-2">•</span>
                          <span className="truncate">{item.category || 'Scanned Items'}</span>
                        </div>
                      </div>
                      <div className="text-right ml-3 flex-shrink-0">
                        <p className="font-semibold text-blue-400 text-sm sm:text-base">
                          £{Number(item.unitPrice || item.price || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.quantity > 1 ? 'per item' : 'total'}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                  {scannedItems.length > 20 && (
                    <p className="text-center text-gray-400 text-sm py-4">
                      ... and {scannedItems.length - 20} more items
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 sm:py-12 px-4">
                  <SafeIcon icon={FiUploadCloud} className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-gray-500 mb-4" />
                  <h3 className="text-base sm:text-lg font-medium text-white mb-2">
                    No receipts scanned yet
                  </h3>
                  <p className="text-gray-400 mb-6 max-w-md mx-auto text-sm sm:text-base">
                    Start by clicking 'Scan New Receipt' to upload an image of your receipt. 
                    We'll automatically extract the items and add them to your inventory with enhanced accuracy.
                  </p>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
                  >
                    <SafeIcon icon={FiCamera} className="mr-2 h-4 w-4" />
                    Get Started
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Receipt History Tab - Mobile Optimized with Export */
        <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700">
          <div className="p-4 sm:p-6 border-b border-gray-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-white flex items-center">
                  <SafeIcon icon={FiImage} className="mr-2 sm:mr-3 text-blue-400" />
                  Receipt History
                  {receiptHistory.length > 0 && (
                    <span className="ml-2 px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                      {receiptHistory.length}
                    </span>
                  )}
                </h2>
                <p className="text-gray-400 text-xs sm:text-sm mt-2">
                  View, export, and manage your uploaded receipt images with extracted item data.
                </p>
              </div>
              
              {/* Export Controls */}
              {receiptHistory.length > 0 && (
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
                  <button
                    onClick={() => setShowExportOptions(!showExportOptions)}
                    disabled={isExporting}
                    className="flex items-center justify-center px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                  >
                    <SafeIcon icon={FiDownload} className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    {isExporting ? 'Exporting...' : 'Export'}
                  </button>
                  
                  {showExportOptions && (
                    <div className="flex space-x-2 w-full sm:w-auto">
                      <button
                        onClick={selectAllReceipts}
                        className="flex-1 sm:flex-none px-2 sm:px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-xs sm:text-sm"
                      >
                        {selectedReceiptsForExport.size === receiptHistory.length ? 'Deselect All' : 'Select All'}
                      </button>
                      <button
                        onClick={exportAllReceipts}
                        disabled={isExporting}
                        className="flex-1 sm:flex-none px-2 sm:px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 text-xs sm:text-sm"
                      >
                        <SafeIcon icon={FiArchive} className="mr-1 h-3 w-3 inline" />
                        All
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bulk Export Actions */}
            {showExportOptions && selectedReceiptsForExport.size > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 p-3 bg-gray-700/50 rounded-lg border border-gray-600"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
                  <span className="text-sm text-gray-300">
                    {selectedReceiptsForExport.size} receipt{selectedReceiptsForExport.size !== 1 ? 's' : ''} selected
                  </span>
                  <div className="flex space-x-2 w-full sm:w-auto">
                    <button
                      onClick={exportMultipleReceipts}
                      disabled={isExporting}
                      className="flex-1 sm:flex-none px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 text-xs sm:text-sm"
                    >
                      <SafeIcon icon={FiDownload} className="mr-1 h-3 w-3 inline" />
                      Export Selected
                    </button>
                    <button
                      onClick={() => {
                        setSelectedReceiptsForExport(new Set());
                        setShowExportOptions(false);
                      }}
                      className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-xs sm:text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
          
          <div className="p-4 sm:p-6">
            {isLoadingHistory ? (
              <div className="text-center py-8 sm:py-12">
                <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-400 text-sm sm:text-base">Loading receipt history...</p>
              </div>
            ) : receiptHistory.length > 0 ? (
              <div className="space-y-3 sm:space-y-4">
                {receiptHistory.map((receipt, index) => (
                  <motion.div
                    key={receipt.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`bg-gray-700/50 p-3 sm:p-4 rounded-lg border transition-colors ${
                      selectedReceiptsForExport.has(receipt.id) 
                        ? 'border-green-500 bg-green-900/20' 
                        : 'border-gray-600'
                    }`}
                  >
                    {/* Mobile Layout */}
                    <div className="block sm:hidden">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start flex-1 min-w-0">
                          {showExportOptions && (
                            <input
                              type="checkbox"
                              checked={selectedReceiptsForExport.has(receipt.id)}
                              onChange={() => toggleReceiptSelection(receipt.id)}
                              className="mt-1 mr-2 flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center mb-1">
                              <SafeIcon icon={FiImage} className="h-4 w-4 text-blue-400 mr-2 flex-shrink-0" />
                              <h3 className="font-medium text-white text-sm truncate">
                                {receipt.file_name || `Receipt ${receipt.id}`}
                              </h3>
                            </div>
                            <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                              receipt.scan_status === 'completed' 
                                ? 'bg-green-900/50 text-green-300'
                                : receipt.scan_status === 'failed'
                                ? 'bg-red-900/50 text-red-300'
                                : 'bg-yellow-900/50 text-yellow-300'
                            }`}>
                              {receipt.scan_status}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
                          <button
                            onClick={() => exportSingleReceipt(receipt)}
                            disabled={isExporting}
                            className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Export Receipt"
                          >
                            <SafeIcon icon={FiDownload} className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => viewReceiptImage(receipt)}
                            disabled={isLoadingImage}
                            className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="View Receipt Image"
                          >
                            {isLoadingImage ? (
                              <div className="animate-spin h-3 w-3 border border-white border-t-transparent rounded-full"></div>
                            ) : (
                              <SafeIcon icon={FiEye} className="h-3 w-3" />
                            )}
                          </button>
                          <button
                            onClick={() => deleteReceipt(receipt.id)}
                            className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
                            title="Delete Receipt"
                          >
                            <SafeIcon icon={FiTrash2} className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center text-xs text-gray-400 space-x-3 mb-3">
                        <div className="flex items-center">
                          <SafeIcon icon={FiCalendar} className="h-3 w-3 mr-1" />
                          {formatDateMobile(receipt.created_at)}
                        </div>
                        <div className="flex items-center">
                          <SafeIcon icon={FiPackage} className="h-3 w-3 mr-1" />
                          {receipt.total_items} items
                        </div>
                        {receipt.file_size && (
                          <span>{formatFileSize(receipt.file_size)}</span>
                        )}
                      </div>
                      
                      {receipt.scanned_items && receipt.scanned_items.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {receipt.scanned_items.slice(0, 2).map((item, idx) => (
                            <span key={idx} className="inline-block bg-gray-600 text-gray-200 text-xs px-2 py-1 rounded">
                              {item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name}
                            </span>
                          ))}
                          {receipt.scanned_items.length > 2 && (
                            <span className="text-gray-400 text-xs self-center">
                              +{receipt.scanned_items.length - 2} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden sm:block">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start flex-1">
                          {showExportOptions && (
                            <input
                              type="checkbox"
                              checked={selectedReceiptsForExport.has(receipt.id)}
                              onChange={() => toggleReceiptSelection(receipt.id)}
                              className="mt-1 mr-3 flex-shrink-0"
                            />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <SafeIcon icon={FiImage} className="h-5 w-5 text-blue-400 mr-2" />
                              <h3 className="font-medium text-white">
                                {receipt.file_name || `Receipt ${receipt.id}`}
                              </h3>
                              <span className={`ml-3 px-2 py-1 text-xs rounded-full ${
                                receipt.scan_status === 'completed' 
                                  ? 'bg-green-900/50 text-green-300'
                                  : receipt.scan_status === 'failed'
                                  ? 'bg-red-900/50 text-red-300'
                                  : 'bg-yellow-900/50 text-yellow-300'
                              }`}>
                                {receipt.scan_status}
                              </span>
                            </div>
                            <div className="flex items-center text-sm text-gray-400 space-x-4">
                              <div className="flex items-center">
                                <SafeIcon icon={FiCalendar} className="h-4 w-4 mr-1" />
                                {formatDate(receipt.created_at)}
                              </div>
                              <div className="flex items-center">
                                <SafeIcon icon={FiPackage} className="h-4 w-4 mr-1" />
                                {receipt.total_items} items
                              </div>
                              {receipt.file_size && (
                                <span>{formatFileSize(receipt.file_size)}</span>
                              )}
                            </div>
                            {receipt.scanned_items && receipt.scanned_items.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {receipt.scanned_items.slice(0, 3).map((item, idx) => (
                                  <span key={idx} className="inline-block bg-gray-600 text-gray-200 text-xs px-2 py-1 rounded">
                                    {item.name} (£{item.price})
                                  </span>
                                ))}
                                {receipt.scanned_items.length > 3 && (
                                  <span className="text-gray-400 text-xs">
                                    +{receipt.scanned_items.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => exportSingleReceipt(receipt)}
                            disabled={isExporting}
                            className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Export Receipt"
                          >
                            <SafeIcon icon={FiDownload} className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => viewReceiptImage(receipt)}
                            disabled={isLoadingImage}
                            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative"
                            title="View Receipt Image"
                          >
                            {isLoadingImage ? (
                              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                            ) : (
                              <SafeIcon icon={FiEye} className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => deleteReceipt(receipt.id)}
                            className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                            title="Delete Receipt"
                          >
                            <SafeIcon icon={FiTrash2} className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 sm:py-12 px-4">
                <SafeIcon icon={FiImage} className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-gray-500 mb-4" />
                <h3 className="text-base sm:text-lg font-medium text-white mb-2">
                  No receipt history yet
                </h3>
                <p className="text-gray-400 mb-6 max-w-md mx-auto text-sm sm:text-base">
                  Upload your first receipt to start building your receipt history. 
                  All images will be securely stored for future reference and export.
                </p>
                <button
                  onClick={() => {
                    setActiveTab('scanner');
                    setIsModalOpen(true);
                  }}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
                >
                  <SafeIcon icon={FiUploadCloud} className="mr-2 h-4 w-4" />
                  Scan First Receipt
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Enhanced Receipt Image Modal - Mobile Optimized with Export */}
      {selectedReceipt && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-2 sm:p-4"
          onClick={(e) => {
            // Close modal when clicking outside the content
            if (e.target === e.currentTarget) {
              setSelectedReceipt(null);
            }
          }}
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gray-900 text-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-gray-700 p-4 sm:p-6">
              <div className="flex items-center min-w-0 flex-1">
                <SafeIcon icon={FiImage} className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400 mr-2 sm:mr-3 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg sm:text-xl font-bold truncate">
                    {selectedReceipt.file_name || `Receipt ${selectedReceipt.id}`}
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-400 mt-1 truncate">
                    {formatDateMobile(selectedReceipt.created_at)} • {selectedReceipt.total_items} items extracted
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 ml-2">
                <button
                  onClick={() => exportSingleReceipt(selectedReceipt)}
                  disabled={isExporting}
                  className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Export Receipt"
                >
                  {isExporting ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  ) : (
                    <SafeIcon icon={FiDownload} className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </button>
                <button 
                  onClick={() => setSelectedReceipt(null)}
                  className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700 flex-shrink-0"
                  title="Close"
                >
                  <SafeIcon icon={FiX} className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-3 sm:p-6">
              <div className="text-center">
                {/* Receipt Image */}
                <div className="relative inline-block w-full">
                  <img 
                    src={selectedReceipt.imageUrl} 
                    alt="Receipt" 
                    className="max-w-full max-h-[50vh] sm:max-h-[60vh] mx-auto rounded-lg border border-gray-600 shadow-lg"
                    style={{ objectFit: 'contain' }}
                    onError={(e) => {
                      console.error('Failed to load receipt image');
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'block';
                    }}
                  />
                  {/* Error fallback */}
                  <div 
                    className="hidden bg-gray-800 border border-gray-600 rounded-lg p-6 sm:p-8 text-center"
                  >
                    <SafeIcon icon={FiImage} className="h-12 w-12 sm:h-16 sm:w-16 text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-400 text-sm sm:text-base">Failed to load receipt image</p>
                    <p className="text-gray-500 text-xs sm:text-sm mt-2">The image may have been moved or deleted</p>
                  </div>
                </div>

                {/* Receipt Details */}
                <div className="mt-4 sm:mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 text-left">
                  {/* File Information */}
                  <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
                    <h3 className="text-base sm:text-lg font-semibold text-white mb-3 flex items-center">
                      <SafeIcon icon={FiFileText} className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-blue-400" />
                      File Information
                    </h3>
                    <div className="space-y-2 text-xs sm:text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">File Name:</span>
                        <span className="text-white text-right truncate ml-2">{selectedReceipt.file_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Upload Date:</span>
                        <span className="text-white">{formatDateMobile(selectedReceipt.created_at)}</span>
                      </div>
                      {selectedReceipt.file_size && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">File Size:</span>
                          <span className="text-white">{formatFileSize(selectedReceipt.file_size)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-400">Scan Status:</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          selectedReceipt.scan_status === 'completed' 
                            ? 'bg-green-900/50 text-green-300'
                            : selectedReceipt.scan_status === 'failed'
                            ? 'bg-red-900/50 text-red-300'
                            : 'bg-yellow-900/50 text-yellow-300'
                        }`}>
                          {selectedReceipt.scan_status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Extracted Items */}
                  <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
                    <h3 className="text-base sm:text-lg font-semibold text-white mb-3 flex items-center">
                      <SafeIcon icon={FiPackage} className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-400" />
                      Extracted Items ({selectedReceipt.total_items})
                    </h3>
                    {selectedReceipt.scanned_items && selectedReceipt.scanned_items.length > 0 ? (
                      <div className="space-y-2 max-h-32 sm:max-h-48 overflow-y-auto">
                        {selectedReceipt.scanned_items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-gray-700/50 p-2 rounded text-xs sm:text-sm">
                            <span className="text-white font-medium truncate mr-2">{item.name}</span>
                            <span className="text-blue-400 flex-shrink-0">£{parseFloat(item.price || 0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-xs sm:text-sm">No items were extracted from this receipt.</p>
                    )}
                  </div>
                </div>

                {/* OCR Text Preview (if available) - Hidden on mobile */}
                {selectedReceipt.ocr_text && (
                  <div className="mt-4 sm:mt-6 bg-gray-800 rounded-lg p-3 sm:p-4 text-left hidden sm:block">
                    <h3 className="text-base sm:text-lg font-semibold text-white mb-3 flex items-center">
                      <SafeIcon icon={FiFileText} className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-purple-400" />
                      OCR Text Preview
                    </h3>
                    <div className="bg-gray-900 rounded p-3 max-h-32 overflow-y-auto">
                      <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                        {selectedReceipt.ocr_text.substring(0, 500)}
                        {selectedReceipt.ocr_text.length > 500 && '...'}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-700 p-3 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
              <div className="text-xs sm:text-sm text-gray-400 truncate w-full sm:w-auto">
                <span className="hidden sm:inline">Storage Path: </span>
                <code className="bg-gray-800 px-2 py-1 rounded text-xs break-all">
                  {selectedReceipt.storage_path}
                </code>
              </div>
              <div className="flex space-x-2 sm:space-x-3 w-full sm:w-auto">
                <button
                  onClick={() => exportSingleReceipt(selectedReceipt)}
                  disabled={isExporting}
                  className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 text-xs sm:text-sm"
                >
                  <SafeIcon icon={FiDownload} className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 inline" />
                  {isExporting ? 'Exporting...' : 'Export'}
                </button>
                <button
                  onClick={() => deleteReceipt(selectedReceipt.id)}
                  className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-xs sm:text-sm"
                >
                  <SafeIcon icon={FiTrash2} className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 inline" />
                  Delete
                </button>
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-xs sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Receipt Scanner Modal */}
      <ReceiptScannerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onItemsScanned={handleItemsScanned}
        onReceiptSaved={handleReceiptSaved}
      />
    </motion.div>
  );
};

export default ReceiptScannerPage;