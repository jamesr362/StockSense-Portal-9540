import { motion } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { RiAddLine, RiSearchLine, RiEditLine, RiDeleteBin6Line, RiCalendarLine, RiStore2Line, RiScanLine } from 'react-icons/ri';
import { Link } from 'react-router-dom';
import AddItemModal from '../components/AddItemModal';
import EditItemModal from '../components/EditItemModal';
import DeleteItemModal from '../components/DeleteItemModal';
import ReceiptScannerModal from '../components/ReceiptScannerModal';
import { getInventoryItems, addInventoryItem, updateInventoryItem, deleteInventoryItem, searchInventoryItems } from '../services/db';
import { useAuth } from '../context/AuthContext';

export default function Inventory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const { user } = useAuth();

  const loadInventoryItems = useCallback(async () => {
    if (!user?.email) return;

    try {
      setIsLoading(true);
      setError(null);
      const items = await getInventoryItems(user.email);
      setInventoryItems(items);
    } catch (error) {
      console.error('Error loading inventory items:', error);
      setError('Failed to load inventory items');
    } finally {
      setIsLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    loadInventoryItems();
  }, [loadInventoryItems]);

  const handleAddItem = async (newItem) => {
    if (!user?.email) return;

    try {
      setError(null);
      await addInventoryItem(newItem, user.email);
      await loadInventoryItems();
      setIsAddModalOpen(false);
      setSuccessMessage('Item added successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error adding inventory item:', error);
      setError('Failed to add item');
    }
  };

  const handleScannedItems = async (scannedItems) => {
    if (!user?.email || !scannedItems.length) return;

    try {
      setError(null);
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

      await loadInventoryItems();

      if (addedCount > 0) {
        setSuccessMessage(`Successfully added ${addedCount} items from receipt scan!`);
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        setError('Failed to add items from receipt scan');
      }
    } catch (error) {
      console.error('Error processing scanned items:', error);
      setError('Failed to process scanned items');
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
      await deleteInventoryItem(itemId, user.email);
      await loadInventoryItems();
      setSuccessMessage('Item deleted successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      setError('Failed to delete item');
    }
  };

  const handleSaveEdit = async (updatedItem) => {
    if (!user?.email) return;

    try {
      setError(null);
      await updateInventoryItem(updatedItem, user.email);
      await loadInventoryItems();
      setIsEditModalOpen(false);
      setSelectedItem(null);
      setSuccessMessage('Item updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error updating inventory item:', error);
      setError('Failed to update item');
    }
  };

  useEffect(() => {
    const searchItems = async () => {
      if (!user?.email) return;

      try {
        setIsLoading(true);
        setError(null);
        const results = await searchInventoryItems(searchTerm, user.email);
        setInventoryItems(results);
      } catch (error) {
        console.error('Error searching items:', error);
        setError('Failed to search items');
      } finally {
        setIsLoading(false);
      }
    };

    const debounceSearch = setTimeout(searchItems, 300);
    return () => clearTimeout(debounceSearch);
  }, [searchTerm, user?.email]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'In Stock': return 'bg-green-100 text-green-800';
      case 'Limited Stock': return 'bg-yellow-100 text-yellow-800';
      case 'Out of Stock': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

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
            <h1 className="text-2xl sm:text-3xl font-semibold text-white">Inventory</h1>
            <p className="mt-1 text-sm text-gray-400">
              Manage your inventory items
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Link
              to="/receipt-scanner"
              className="inline-flex items-center justify-center rounded-md border border-primary-600 bg-transparent px-4 py-2 text-sm font-medium text-primary-400 shadow-sm hover:bg-primary-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 w-full sm:w-auto transition-colors"
            >
              <RiScanLine className="mr-2 h-4 w-4" />
              Receipt Scanner
            </Link>
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="inline-flex items-center justify-center rounded-md border border-gray-600 bg-transparent px-4 py-2 text-sm font-medium text-gray-300 shadow-sm hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 w-full sm:w-auto transition-colors"
            >
              <RiScanLine className="mr-2 h-4 w-4" />
              Quick Scan
            </button>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 w-full sm:w-auto"
            >
              <RiAddLine className="mr-2 h-4 w-4" />
              Add Item
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
            <div className="text-sm text-green-200">{successMessage}</div>
          </motion.div>
        )}

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-md bg-red-900/50 p-4"
          >
            <div className="text-sm text-red-200">{error}</div>
          </motion.div>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative rounded-md shadow-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <RiSearchLine className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full rounded-md border-gray-700 bg-gray-800 pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              placeholder="Search inventory..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : inventoryItems.length === 0 ? (
          <div className="text-center py-12 bg-gray-800 rounded-lg">
            <RiStore2Line className="mx-auto h-12 w-12 text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              {searchTerm ? 'No items found' : 'No inventory items'}
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              {searchTerm ? 'Try adjusting your search terms' : 'Add some items to get started with your inventory'}
            </p>
            {!searchTerm && (
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Link
                  to="/receipt-scanner"
                  className="inline-flex items-center px-4 py-2 border border-primary-600 text-primary-400 rounded-lg hover:bg-primary-600 hover:text-white transition-colors"
                >
                  <RiScanLine className="mr-2 h-4 w-4" />
                  Scan Receipt
                </Link>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  <RiAddLine className="mr-2 h-4 w-4" />
                  Add Manually
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block lg:hidden space-y-4">
              {inventoryItems.map((item) => (
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

                  {/* Card Body - Scrollable horizontally */}
                  <div className="p-4">
                    <div className="overflow-x-auto">
                      <div className="grid grid-cols-2 gap-4 text-sm min-w-max">
                        <div className="space-y-3">
                          <div className="flex flex-col">
                            <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">Quantity</span>
                            <span className="text-white font-medium">{item.quantity}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">Unit Price</span>
                            <span className="text-white font-medium">{formatCurrency(item.unitPrice)}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">Total Value</span>
                            <span className="text-white font-medium">{formatCurrency((item.quantity || 0) * (item.unitPrice || 0))}</span>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex flex-col">
                            <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">Status</span>
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold w-fit ${getStatusColor(item.status)}`}>
                              {item.status}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">Date Added</span>
                            <span className="text-white">{formatDate(item.dateAdded)}</span>
                          </div>
                          {item.description && (
                            <div className="flex flex-col">
                              <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">Description</span>
                              <span className="text-white text-sm leading-relaxed">{item.description}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Desktop Table View with Horizontal Scroll */}
            <div className="hidden lg:block">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-white sm:pl-6 min-w-[150px]">
                          Name
                        </th>
                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-white min-w-[120px]">
                          Category
                        </th>
                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-white min-w-[80px]">
                          Quantity
                        </th>
                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-white min-w-[100px]">
                          Unit Price
                        </th>
                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-white min-w-[100px]">
                          Total Value
                        </th>
                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-white min-w-[120px]">
                          Status
                        </th>
                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-white min-w-[120px]">
                          <div className="flex items-center">
                            <RiCalendarLine className="h-4 w-4 mr-1" />
                            Date Added
                          </div>
                        </th>
                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-white min-w-[200px]">
                          Description
                        </th>
                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-white min-w-[100px]">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700 bg-gray-800">
                      {inventoryItems.map((item) => (
                        <motion.tr
                          key={item.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3 }}
                        >
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-white sm:pl-6">
                            <div className="max-w-[150px] truncate" title={item.name}>
                              {item.name}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">
                            <div className="max-w-[120px] truncate" title={item.category}>
                              {item.category}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">
                            {item.quantity}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">
                            {formatCurrency(item.unitPrice)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300 font-medium">
                            {formatCurrency((item.quantity || 0) * (item.unitPrice || 0))}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${getStatusColor(item.status)}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">
                            {formatDate(item.dateAdded)}
                          </td>
                          <td className="px-3 py-4 text-sm text-gray-300">
                            <div className="max-w-[200px] truncate" title={item.description || 'No description'}>
                              {item.description || 'No description'}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleEditItem(item)}
                                className="text-blue-400 hover:text-blue-300"
                                title="Edit item"
                              >
                                <RiEditLine className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item)}
                                className="text-red-400 hover:text-red-300"
                                title="Delete item"
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
              </div>
            </div>
          </>
        )}
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