import React, { useState } from 'react';
    import { motion } from 'framer-motion';
    import { RiAddLine, RiUploadCloud2Line, RiFileList2Line } from 'react-icons/ri';
    import ReceiptScannerModal from '../components/ReceiptScannerModal';
    import { useAuth } from '../context/AuthContext';
    import { addInventoryItem } from '../services/db';

    const ReceiptScannerPage = () => {
      const [isModalOpen, setIsModalOpen] = useState(false);
      const [scannedItems, setScannedItems] = useState([]);
      const { user } = useAuth();
      const [feedbackMessage, setFeedbackMessage] = useState('');

      const handleItemsScanned = async (items) => {
        if (!user || !user.email) {
            setFeedbackMessage('You must be logged in to add items.');
            return;
        }

        setFeedbackMessage('Saving items to your inventory...');
        let successCount = 0;
        for (const item of items) {
          try {
            await addInventoryItem(user.email, {
              ...item,
              status: 'In Stock',
              dateAdded: new Date().toISOString(),
            });
            successCount++;
          } catch (error) {
            console.error('Failed to add item:', error);
          }
        }
        
        setScannedItems(prev => [...items, ...prev]);
        setFeedbackMessage(`${successCount} of ${items.length} items added to inventory successfully!`);
        
        setTimeout(() => setFeedbackMessage(''), 5000);
      };

      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="p-4 sm:p-6"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white">Receipt Scanner</h1>
              <p className="mt-1 text-gray-400">
                Automatically add items to your inventory by scanning a receipt.
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 sm:mt-0 flex items-center justify-center px-5 py-3 bg-primary-600 text-white rounded-lg shadow-md hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              <RiAddLine className="mr-2 h-5 w-5" />
              Scan New Receipt
            </button>
          </div>

          {feedbackMessage && (
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-green-900/50 border border-green-700 rounded-lg text-green-300 text-sm"
            >
                {feedbackMessage}
            </motion.div>
          )}

          <div className="bg-gray-800 rounded-xl shadow-lg">
            <div className="p-6 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <RiFileList2Line className="mr-3 text-primary-400" />
                Recently Scanned Items
              </h2>
            </div>
            <div className="p-6">
              {scannedItems.length > 0 ? (
                <ul className="space-y-4">
                  {scannedItems.map((item, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex justify-between items-center bg-gray-700/50 p-4 rounded-lg"
                    >
                      <div>
                        <p className="font-semibold text-white">{item.name}</p>
                        <p className="text-sm text-gray-400">
                          Quantity: {item.quantity}
                        </p>
                      </div>
                      <p className="font-semibold text-primary-400">
                        £{Number(item.unitPrice).toFixed(2)}
                      </p>
                    </motion.li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-12 px-4">
                  <RiUploadCloud2Line className="mx-auto h-16 w-16 text-gray-500" />
                  <h3 className="mt-4 text-lg font-semibold text-white">
                    No receipts scanned yet
                  </h3>
                  <p className="mt-1 text-sm text-gray-400">
                    Click 'Scan New Receipt' to get started.
                  </p>
                </div>
              )}
            </div>
          </div>

          <ReceiptScannerModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onItemsScanned={handleItemsScanned}
          />
        </motion.div>
      );
    };

    export default ReceiptScannerPage;