import { motion } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { RiAddLine, RiSearchLine, RiEditLine, RiDeleteBin6Line, RiCalendarLine, RiShoppingBag3Line, RiScanLine, RiLockLine, RiStarLine, RiArrowRightLine, RiPercentLine } from 'react-icons/ri';
import { Link } from 'react-router-dom';

import AddItemModal from '../components/AddItemModal';
import EditItemModal from '../components/EditItemModal';
import DeleteItemModal from '../components/DeleteItemModal';
import ReceiptScannerModal from '../components/ReceiptScannerModal';
import UsageLimitGate from '../components/UsageLimitGate';
import FeatureGate from '../components/FeatureGate';

import { getInventoryItems, addInventoryItem, updateInventoryItem, deleteInventoryItem, searchInventoryItems } from '../services/db';
import { useAuth } from '../context/AuthContext';
import useFeatureAccess from '../hooks/useFeatureAccess';

export default function Purchases() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [purchaseItems, setPurchaseItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const { user } = useAuth();
  const { canAddInventoryItem, canUseFeature, currentPlan, planInfo } = useFeatureAccess();

  const loadPurchaseItems = useCallback(async () => {
    if (!user?.email) return;

    try {
      setIsLoading(true);
      setError(null);
      console.log('===Loading purchase items for user:', user.email, '===');
      const items = await getInventoryItems(user.email);
      console.log('===Loaded purchase items:', items?.length, 'items===');
      console.log('Items:', items);
      setPurchaseItems(items || []);
    } catch (error) {
      console.error('Error loading purchase items:', error);
      setError('Failed to load purchase items');
    } finally {
      setIsLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    loadPurchaseItems();
  }, [loadPurchaseItems]);

  const handleAddItem = async (newItem) => {
    if (!user?.email) {
      setError('User not authenticated');
      return;
    }

    console.log('===handleAddItem called===');
    console.log('User email:', user.email);
    console.log('New item data:', newItem);

    // STRICT LIMIT CHECK: Check if user can add more items
    const limitCheck = canAddInventoryItem(purchaseItems.length);
    if (!limitCheck.allowed) {
      setError(limitCheck.reason);
      return;
    }

    try {
      setError(null);
      console.log('===Calling addInventoryItem===');

      // Call the database function to add the item
      const savedItem = await addInventoryItem(newItem, user.email);
      console.log('===Item saved to database:', savedItem, '===');

      // Reload the purchases to get the latest data from database
      await loadPurchaseItems();

      // Close modal and show success message
      setIsAddModalOpen(false);
      setSuccessMessage(`Successfully added "${newItem.name}" to your purchases!`);

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);

      console.log('===Add item process completed successfully===');
    } catch (error) {
      console.error('===Error in handleAddItem===', error);
      setError(error.message || 'Failed to add purchase item');
    }
  };

  const handleScannedItems = async (scannedItems) => {
    if (!user?.email || !scannedItems.length) return;

    // Check if user can scan receipts
    if (!canUseFeature('receiptScanner')) {
      setError('Receipt scanning is not available on your current plan');
      return;
    }

    // STRICT LIMIT CHECK: Check if adding these items would exceed the limit
    const totalItemsAfter = purchaseItems.length + scannedItems.length;
    const limitCheck = canAddInventoryItem(totalItemsAfter - 1); // Check for the last item

    if (!limitCheck.allowed && limitCheck.limit !== -1) {
      const itemsCanAdd = Math.max(0, limitCheck.limit - purchaseItems.length);
      if (itemsCanAdd === 0) {
        setError('Cannot add items: You have reached your purchase tracking limit');
        return;
      } else {
        setError(`Can only add ${itemsCanAdd} more purchases due to plan limits. Consider upgrading your plan.`);
        // Proceed with adding only the allowed number of items
        scannedItems = scannedItems.slice(0, itemsCanAdd);
      }
    }

    try {
      setError(null);
      let addedCount = 0;

      // Add each scanned item to purchases
      for (const item of scannedItems) {
        try {
          await addInventoryItem(item, user.email);
          addedCount++;
        } catch (itemError) {
          console.error('Error adding scanned item:', itemError);
        }
      }

      // Reload purchases to reflect changes
      await loadPurchaseItems();

      if (addedCount > 0) {
        setSuccessMessage(`Successfully added ${addedCount} purchases from receipt scan!`);
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        setError('Failed to add purchases from receipt scan');
      }
    } catch (error) {
      console.error('Error processing scanned items:', error);
      setError('Failed to process scanned purchases');
    }
  };

  const handleEditItem = (item) => {
    setSelectedItem(item);
    setIsEditModalOpen(true);
  };

  const handleDeleteItem = (item) => {
    setSelectedItem(item);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (itemId) => {
    if (!user?.email) return;

    try {
      setError(null);
      console.log('===Deleting item:', itemId, '===');
      await deleteInventoryItem(itemId, user.email);

      // Reload purchases to reflect changes
      await loadPurchaseItems();

      setSuccessMessage('Purchase deleted successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      console.log('===Item deleted successfully===');
    } catch (error) {
      console.error('Error deleting purchase item:', error);
      setError('Failed to delete purchase');
    }
  };

  const handleSaveEdit = async (updatedItem) => {
    if (!user?.email) return;

    try {
      setError(null);
      console.log('===Updating item:', updatedItem, '===');
      await updateInventoryItem(updatedItem, user.email);

      // Reload purchases to reflect changes
      await loadPurchaseItems();

      setIsEditModalOpen(false);
      setSelectedItem(null);
      setSuccessMessage('Purchase updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      console.log('===Item updated successfully===');
    } catch (error) {
      console.error('Error updating purchase item:', error);
      setError('Failed to update purchase');
    }
  };

  // Search functionality with debouncing
  useEffect(() => {
    const searchItems = async () => {
      if (!user?.email) return;

      try {
        setIsLoading(true);
        setError(null);
        console.log('===Searching items with term:', searchTerm, '===');
        const results = await searchInventoryItems(searchTerm, user.email);
        console.log('===Search results:', results?.length, 'items===');
        setPurchaseItems(results || []);
      } catch (error) {
        console.error('Error searching items:', error);
        setError('Failed to search purchases');
      } finally {
        setIsLoading(false);
      }
    };

    const debounceSearch = setTimeout(searchItems, 300);
    return () => clearTimeout(debounceSearch);
  }, [searchTerm, user?.email]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch (error) {
      return 'N/A';
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  };

  const handleAddItemClick = () => {
    // STRICT LIMIT CHECK before opening modal
    const limitCheck = canAddInventoryItem(purchaseItems.length);
    if (!limitCheck.allowed) {
      setError(limitCheck.reason);
      return;
    }
    setIsAddModalOpen(true);
  };

  const handleQuickScanClick = () => {
    if (!canUseFeature('receiptScanner')) {
      setError('Receipt scanning is not available on your current plan');
      return;
    }
    setIsScannerOpen(true);
  };

  // Check if user is approaching or at limit
  const limitCheck = canAddInventoryItem(purchaseItems.length);
  const isAtLimit = !limitCheck.allowed;
  const isNearLimit = limitCheck.allowed && limitCheck.limit !== -1 && limitCheck.remaining <= 10;

  return (
    <div className="h-full overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="h-full flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 flex-shrink-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white">Purchase Tracking</h1>
            <p className="mt-1 text-sm text-gray-400">
              Track your purchases with VAT configuration for tax reporting
              {currentPlan === 'free' && (
                <span className="ml-2 text-yellow-400">
                  ({purchaseItems.length}/100 purchases tracked)
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <FeatureGate feature="receiptScanner" showUpgradePrompt={false}>
              <Link
                to="/receipt-scanner"
                className="inline-flex items-center justify-center rounded-md border border-primary-600 bg-transparent px-4 py-2 text-sm font-medium text-primary-400 shadow-sm hover:bg-primary-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 w-full sm:w-auto transition-colors"
              >
                <RiScanLine className="mr-2 h-4 w-4" />
                Receipt Scanner
              </Link>
            </FeatureGate>

            <button
              type="button"
              onClick={handleQuickScanClick}
              className="inline-flex items-center justify-center rounded-md border border-gray-600 bg-transparent px-4 py-2 text-sm font-medium text-gray-300 shadow-sm hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 w-full sm:w-auto transition-colors"
            >
              <RiScanLine className="mr-2 h-4 w-4" />
              Quick Scan
            </button>

            <button
              type="button"
              onClick={handleAddItemClick}
              disabled={isAtLimit}
              className={`inline-flex items-center justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 w-full sm:w-auto ${
                isAtLimit
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              <RiAddLine className="mr-2 h-4 w-4" />
              {isAtLimit ? 'Limit Reached' : 'Add Purchase'}
            </button>
          </div>
        </div>

        {/* Limit Warning for Free Users */}
        {currentPlan === 'free' && (isAtLimit || isNearLimit) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-4 rounded-lg p-4 border ${
              isAtLimit 
                ? 'bg-red-900/20 border-red-700' 
                : 'bg-yellow-900/20 border-yellow-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <RiLockLine className={`h-5 w-5 mr-2 ${isAtLimit ? 'text-red-400' : 'text-yellow-400'}`} />
                <div>
                  <h3 className={`font-medium ${isAtLimit ? 'text-red-300' : 'text-yellow-300'}`}>
                    {isAtLimit 
                      ? 'Free Plan Limit Reached (100/100)' 
                      : `Approaching Free Plan Limit (${purchaseItems.length}/100)`
                    }
                  </h3>
                  <p className="text-gray-300 text-sm mt-1">
                    {isAtLimit 
                      ? 'Upgrade to Professional for unlimited purchase tracking and premium features.'
                      : 'You have few purchases remaining. Upgrade for unlimited tracking.'
                    }
                  </p>
                </div>
              </div>
              <Link
                to="/pricing"
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
              >
                <RiStarLine className="h-4 w-4 mr-2" />
                Upgrade Now
                <RiArrowRightLine className="h-4 w-4 ml-2" />
              </Link>
            </div>
            {!isAtLimit && (
              <div className="mt-3">
                <div className="w-full bg-gray-600 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      purchaseItems.length >= 90 ? 'bg-red-500' : 'bg-yellow-500'
                    }`}
                    style={{ width: `${(purchaseItems.length / 100) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Success Message */}
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-md bg-green-900/50 p-4 flex-shrink-0"
          >
            <div className="text-sm text-green-200">{successMessage}</div>
          </motion.div>
        )}

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-md bg-red-900/50 p-4 flex-shrink-0"
          >
            <div className="text-sm text-red-200">{error}</div>
          </motion.div>
        )}

        {/* Content Area - Fixed height to prevent scrolling */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* Search */}
          <div className="mb-6 flex-shrink-0">
            <div className="relative rounded-md shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <RiSearchLine className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full rounded-md border-gray-700 bg-gray-800 pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                placeholder="Search purchases..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : purchaseItems.length === 0 ? (
            <div className="text-center py-12 bg-gray-800 rounded-lg">
              <RiShoppingBag3Line className="mx-auto h-12 w-12 text-gray-500 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                {searchTerm ? 'No purchases found' : 'No purchases tracked'}
              </h3>
              <p className="text-gray-400 text-sm mb-6">
                {searchTerm 
                  ? 'Try adjusting your search terms' 
                  : currentPlan === 'free' && isAtLimit
                    ? 'You\'ve reached the 100 purchase limit for the Free plan. Upgrade to track more purchases.'
                    : 'Start tracking your purchases to manage your expenses and VAT'
                }
              </p>
              {!searchTerm && !isAtLimit && (
                <div className="flex flex-col sm:flex-row justify-center gap-3">
                  <FeatureGate feature="receiptScanner" showUpgradePrompt={false}>
                    <Link
                      to="/receipt-scanner"
                      className="inline-flex items-center px-4 py-2 border border-primary-600 text-primary-400 rounded-lg hover:bg-primary-600 hover:text-white transition-colors"
                    >
                      <RiScanLine className="mr-2 h-4 w-4" />
                      Scan Receipt
                    </Link>
                  </FeatureGate>
                  <button
                    onClick={handleAddItemClick}
                    className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    <RiAddLine className="mr-2 h-4 w-4" />
                    Add Manually
                  </button>
                </div>
              )}
              {currentPlan === 'free' && isAtLimit && (
                <Link
                  to="/pricing"
                  className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <RiStarLine className="h-5 w-5 mr-2" />
                  Upgrade to Professional
                  <RiArrowRightLine className="h-5 w-5 ml-2" />
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block lg:hidden space-y-4 h-full overflow-y-auto">
                {purchaseItems.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="bg-gray-800 rounded-lg shadow-lg overflow-hidden"
                  >
                    {/* Card Header */}
                    <div className="px-4 py-3 border-b border-gray-700">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-medium text-white truncate">
                            {item.name}
                          </h3>
                          <p className="text-sm text-gray-400 truncate">{item.category}</p>
                        </div>
                        <div className="flex space-x-2 ml-3 flex-shrink-0">
                          <button
                            onClick={() => handleEditItem(item)}
                            className="p-2 text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded-md transition-colors"
                          >
                            <RiEditLine className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded-md transition-colors"
                          >
                            <RiDeleteBin6Line className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-3">
                          <div className="flex flex-col">
                            <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">Quantity</span>
                            <span className="text-white font-medium">{item.quantity}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">Unit Price</span>
                            <span className="text-white font-medium">{formatCurrency(item.unitPrice)}</span>
                            {item.vatIncluded && (
                              <span className="text-gray-500 text-xs">Inc. VAT ({item.vatPercentage}%)</span>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">Total Value</span>
                            <span className="text-white font-medium">{formatCurrency((item.quantity || 0) * (item.unitPrice || 0))}</span>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex flex-col">
                            <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">Date Added</span>
                            <span className="text-white">{formatDate(item.dateAdded)}</span>
                          </div>
                          {item.vatPercentage > 0 && (
                            <div className="flex flex-col">
                              <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                                <RiPercentLine className="h-3 w-3 inline mr-1" />
                                VAT Info
                              </span>
                              <span className="text-white text-xs">
                                {item.vatPercentage}% {item.vatIncluded ? 'included' : 'excluded'}
                              </span>
                            </div>
                          )}
                          {item.description && (
                            <div className="flex flex-col">
                              <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">Description</span>
                              <span className="text-white text-sm leading-relaxed">{item.description}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Desktop Table View - Enhanced and Professional */}
              <div className="hidden lg:block h-full w-full overflow-hidden">
                <div className="h-full w-full flex flex-col bg-gray-800 rounded-lg shadow-xl border border-gray-700">
                  {/* Table Header with Summary */}
                  <div className="px-6 py-4 border-b border-gray-700 bg-gray-750">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-6">
                        <div className="text-sm text-gray-300">
                          <span className="font-medium text-white">{purchaseItems.length}</span> purchases
                        </div>
                        <div className="text-sm text-gray-300">
                          Total Value: <span className="font-medium text-green-400">
                            {formatCurrency(
                              purchaseItems.reduce((sum, item) => 
                                sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0
                              )
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        Last updated: {new Date().toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Table Container with Better Scrolling */}
                  <div className="flex-1 min-h-0 w-full overflow-auto">
                    <table className="w-full">
                      <thead className="bg-gray-750 sticky top-0 z-10 border-b border-gray-600">
                        <tr>
                          <th scope="col" className="py-4 pl-6 pr-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                            Item Details
                          </th>
                          <th scope="col" className="px-3 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                            Category
                          </th>
                          <th scope="col" className="px-3 py-4 text-center text-xs font-semibold text-gray-300 uppercase tracking-wider">
                            Qty
                          </th>
                          <th scope="col" className="px-3 py-4 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">
                            Unit Price
                          </th>
                          <th scope="col" className="px-3 py-4 text-center text-xs font-semibold text-gray-300 uppercase tracking-wider">
                            <div className="flex items-center justify-center">
                              <RiPercentLine className="h-4 w-4 mr-1" />
                              VAT
                            </div>
                          </th>
                          <th scope="col" className="px-3 py-4 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">
                            Total Value
                          </th>
                          <th scope="col" className="px-3 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                            <div className="flex items-center">
                              <RiCalendarLine className="h-4 w-4 mr-1" />
                              Date
                            </div>
                          </th>
                          <th scope="col" className="px-3 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                            Description
                          </th>
                          <th scope="col" className="px-3 py-4 pr-6 text-center text-xs font-semibold text-gray-300 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700 bg-gray-800">
                        {purchaseItems.map((item, index) => (
                          <motion.tr
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            className="hover:bg-gray-750 transition-colors duration-150"
                          >
                            {/* Item Details */}
                            <td className="py-4 pl-6 pr-3">
                              <div className="flex flex-col">
                                <div className="text-sm font-medium text-white mb-1 max-w-xs">
                                  {item.name}
                                </div>
                                {item.description && (
                                  <div className="text-xs text-gray-400 max-w-xs truncate" title={item.description}>
                                    {item.description}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Category */}
                            <td className="px-3 py-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/30 text-blue-300 border border-blue-700/50">
                                {item.category}
                              </span>
                            </td>

                            {/* Quantity */}
                            <td className="px-3 py-4 text-center">
                              <span className="text-sm font-medium text-white">
                                {item.quantity}
                              </span>
                            </td>

                            {/* Unit Price */}
                            <td className="px-3 py-4 text-right">
                              <div className="flex flex-col items-end">
                                <span className="text-sm font-medium text-white">
                                  {formatCurrency(item.unitPrice)}
                                </span>
                                {item.vatIncluded && (
                                  <span className="text-xs text-gray-500">Inc. VAT</span>
                                )}
                              </div>
                            </td>

                            {/* VAT */}
                            <td className="px-3 py-4 text-center">
                              <div className="flex flex-col items-center">
                                <span className="text-sm font-medium text-white">
                                  {item.vatPercentage}%
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  item.vatIncluded 
                                    ? 'bg-green-900/30 text-green-300 border border-green-700/50' 
                                    : 'bg-yellow-900/30 text-yellow-300 border border-yellow-700/50'
                                }`}>
                                  {item.vatIncluded ? 'Inc' : 'Ex'}
                                </span>
                              </div>
                            </td>

                            {/* Total Value */}
                            <td className="px-3 py-4 text-right">
                              <span className="text-sm font-semibold text-green-400">
                                {formatCurrency((item.quantity || 0) * (item.unitPrice || 0))}
                              </span>
                            </td>

                            {/* Date */}
                            <td className="px-3 py-4">
                              <span className="text-sm text-gray-300">
                                {formatDate(item.dateAdded)}
                              </span>
                            </td>

                            {/* Description (Hidden in this layout as it's shown in Item Details) */}
                            <td className="px-3 py-4">
                              <span className="text-sm text-gray-400 max-w-xs truncate block" title={item.description || 'No description'}>
                                {item.description || '—'}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="px-3 py-4 pr-6">
                              <div className="flex items-center justify-center space-x-2">
                                <button
                                  onClick={() => handleEditItem(item)}
                                  className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded-md transition-all duration-150"
                                  title="Edit purchase"
                                >
                                  <RiEditLine className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item)}
                                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-md transition-all duration-150"
                                  title="Delete purchase"
                                >
                                  <RiDeleteBin6Line className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer with Summary */}
                  <div className="px-6 py-3 border-t border-gray-700 bg-gray-750">
                    <div className="flex items-center justify-between text-sm">
                      <div className="text-gray-400">
                        Showing {purchaseItems.length} purchases
                      </div>
                      <div className="flex items-center space-x-6">
                        <div className="text-gray-300">
                          Average: <span className="font-medium text-white">
                            {formatCurrency(
                              purchaseItems.length > 0 
                                ? purchaseItems.reduce((sum, item) => 
                                    sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0
                                  ) / purchaseItems.length
                                : 0
                            )}
                          </span>
                        </div>
                        <div className="text-gray-300">
                          VAT Items: <span className="font-medium text-white">
                            {purchaseItems.filter(item => item.vatPercentage > 0).length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>

      <AddItemModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddItem}
      />

      <EditItemModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedItem(null);
        }}
        onSave={handleSaveEdit}
        item={selectedItem}
      />

      <DeleteItemModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedItem(null);
        }}
        onConfirm={handleConfirmDelete}
        item={selectedItem}
      />

      <ReceiptScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onItemsExtracted={handleScannedItems}
      />
    </div>
  );
}