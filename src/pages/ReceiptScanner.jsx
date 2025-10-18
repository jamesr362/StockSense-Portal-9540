import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiZap, FiUploadCloud, FiFileText, FiCheckCircle } from 'react-icons/fi';
import ReceiptScannerModal from '../components/ReceiptScannerModal';
import { useAuth } from '../context/AuthContext';
import { addInventoryItem } from '../services/db';
import SafeIcon from '../common/SafeIcon';

const ReceiptScannerPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scannedItems, setScannedItems] = useState([]);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useAuth();

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
          <h1 className="text-3xl font-bold text-white flex items-center">
            <SafeIcon icon={FiZap} className="mr-3 text-yellow-400" />
            Receipt Scanner
          </h1>
          <p className="mt-2 text-gray-400 max-w-2xl">
            Quickly add items to your inventory by scanning receipt images. 
            Our enhanced OCR technology extracts item names, quantities, and prices automatically with right-side price detection.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          disabled={isProcessing}
          className="mt-4 sm:mt-0 flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SafeIcon icon={FiUploadCloud} className="mr-2 h-5 w-5" />
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

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center mb-4">
            <SafeIcon icon={FiZap} className="h-8 w-8 text-yellow-400 mr-3" />
            <h3 className="text-lg font-semibold text-white">Enhanced OCR</h3>
          </div>
          <p className="text-gray-400 text-sm">
            Advanced optical character recognition with right-side price detection ensures accurate extraction of items and prices.
          </p>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center mb-4">
            <SafeIcon icon={FiFileText} className="h-8 w-8 text-blue-400 mr-3" />
            <h3 className="text-lg font-semibold text-white">Smart Parsing</h3>
          </div>
          <p className="text-gray-400 text-sm">
            Intelligent algorithms identify item names, quantities, and prices from receipt text, filtering out irrelevant numbers.
          </p>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center mb-4">
            <SafeIcon icon={FiCheckCircle} className="h-8 w-8 text-green-400 mr-3" />
            <h3 className="text-lg font-semibold text-white">Area Selection</h3>
          </div>
          <p className="text-gray-400 text-sm">
            Select specific areas of your receipt for focused scanning, improving accuracy and reducing false positives.
          </p>
        </div>
      </div>

      {/* Recently Scanned Items */}
      <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <SafeIcon icon={FiFileText} className="mr-3 text-blue-400" />
            Recently Scanned Items
            {scannedItems.length > 0 && (
              <span className="ml-2 px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                {scannedItems.length}
              </span>
            )}
          </h2>
        </div>
        <div className="p-6">
          {scannedItems.length > 0 ? (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {scannedItems.slice(0, 20).map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex justify-between items-center bg-gray-700/50 p-4 rounded-lg border border-gray-600"
                >
                  <div className="flex-1">
                    <p className="font-medium text-white">{item.name}</p>
                    <div className="flex items-center text-sm text-gray-400 mt-1">
                      <span>Qty: {item.quantity}</span>
                      <span className="mx-2">•</span>
                      <span>Added to inventory</span>
                      <span className="mx-2">•</span>
                      <span>{item.category || 'Scanned Items'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-blue-400">
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
            <div className="text-center py-12 px-4">
              <SafeIcon icon={FiUploadCloud} className="mx-auto h-16 w-16 text-gray-500 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                No receipts scanned yet
              </h3>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                Start by clicking 'Scan New Receipt' to upload an image of your receipt. 
                We'll automatically extract the items and add them to your inventory with enhanced accuracy.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <SafeIcon icon={FiZap} className="mr-2 h-4 w-4" />
                Get Started
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Receipt Scanner Modal */}
      <ReceiptScannerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onItemsScanned={handleItemsScanned}
      />
    </motion.div>
  );
};

export default ReceiptScannerPage;