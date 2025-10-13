import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiFileText, FiCalendar, FiChevronDown, FiChevronUp, FiArchive } from 'react-icons/fi';
import ReceiptScannerModal from '../components/ReceiptScannerModal';
import SafeIcon from '../common/SafeIcon';
import supabase from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const ReceiptScannerPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedReceiptId, setExpandedReceiptId] = useState(null);
  const [receiptItems, setReceiptItems] = useState({});

  const { user } = useAuth();

  const fetchReceipts = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching receipts:', error);
      setError('Failed to load receipts.');
    } else {
      setReceipts(data);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const fetchItemsForReceipt = async (receiptId) => {
    if (receiptItems[receiptId]) {
      // Already fetched
      setExpandedReceiptId(expandedReceiptId === receiptId ? null : receiptId);
      return;
    }

    const { data, error } = await supabase
      .from('receipt_items')
      .select('*')
      .eq('receipt_id', receiptId)
      .eq('user_id', user.id);
    
    if (error) {
      console.error(`Error fetching items for receipt ${receiptId}:`, error);
      setError('Failed to load receipt items.');
    } else {
      setReceiptItems(prev => ({ ...prev, [receiptId]: data }));
      setExpandedReceiptId(receiptId);
    }
  };

  const handleToggleReceipt = (receiptId) => {
    if (expandedReceiptId === receiptId) {
      setExpandedReceiptId(null);
    } else {
      fetchItemsForReceipt(receiptId);
    }
  };

  const handleItemsScanned = async (items, image) => {
    if (!user) {
      setError('You must be logged in to save a receipt.');
      throw new Error('User not authenticated');
    }
    
    // 1. Upload image to storage
    const fileName = `${user.id}/${Date.now()}_receipt.jpeg`;
    const imageBlob = await (await fetch(image)).blob();
    
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('receipts')
      .upload(fileName, imageBlob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading receipt image:', uploadError);
      setError('Failed to upload receipt image.');
      throw uploadError;
    }

    // 2. Insert into `receipts` table
    const { data: receiptData, error: receiptError } = await supabase
      .from('receipts')
      .insert({
        user_id: user.id,
        storage_path: uploadData.path,
        file_name: fileName,
      })
      .select()
      .single();

    if (receiptError) {
      console.error('Error saving receipt:', receiptError);
      setError('Failed to save receipt.');
      await supabase.storage.from('receipts').remove([fileName]);
      throw receiptError;
    }

    // 3. Insert into `receipt_items` table
    const itemsToInsert = items.map(item => ({
      receipt_id: receiptData.id,
      user_id: user.id,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    }));

    const { error: itemsError } = await supabase
      .from('receipt_items')
      .insert(itemsToInsert);
    
    if (itemsError) {
      console.error('Error saving receipt items:', itemsError);
      setError('Failed to save receipt items.');
      throw itemsError;
    }
    
    fetchReceipts();
    return { data: receiptData, error: null };
  };

  return (
    <div className="bg-gray-900 min-h-screen text-white">
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Receipt History</h1>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition"
          >
            <SafeIcon icon={FiPlus} />
            Scan New Receipt
          </button>
        </div>

        {loading && <p>Loading receipts...</p>}
        {error && <p className="text-red-500 bg-red-900 bg-opacity-30 p-3 rounded-lg">{error}</p>}

        <div className="space-y-4">
          {!loading && receipts.length === 0 && (
            <div className="text-center py-16 px-6 bg-gray-800 rounded-lg">
              <SafeIcon icon={FiArchive} className="mx-auto h-12 w-12 text-gray-500" />
              <h3 className="mt-4 text-lg font-medium text-gray-300">No receipts found</h3>
              <p className="mt-1 text-sm text-gray-400">Get started by scanning your first receipt.</p>
            </div>
          )}

          {receipts.map(receipt => (
            <div key={receipt.id} className="bg-gray-800 rounded-lg shadow transition-all duration-300">
              <div
                className="flex justify-between items-center p-4 cursor-pointer"
                onClick={() => handleToggleReceipt(receipt.id)}
              >
                <div className="flex items-center gap-4">
                  <SafeIcon icon={FiFileText} className="text-blue-400 text-xl" />
                  <div>
                    <p className="font-semibold">{receipt.file_name?.split('/')[1] || 'Receipt'}</p>
                    <p className="text-sm text-gray-400 flex items-center gap-2">
                      <SafeIcon icon={FiCalendar} />
                      {new Date(receipt.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <SafeIcon icon={expandedReceiptId === receipt.id ? FiChevronUp : FiChevronDown} className="text-xl"/>
              </div>

              {expandedReceiptId === receipt.id && (
                <div className="p-4 border-t border-gray-700 animate-fade-in">
                  {receiptItems[receipt.id] ? (
                    <div className="space-y-2">
                       <div className="grid grid-cols-[1fr_80px_80px] gap-2 font-semibold text-gray-400 text-sm px-2 mb-2">
                         <span>Item</span>
                         <span className="text-right">Qty</span>
                         <span className="text-right">Price</span>
                       </div>
                      {receiptItems[receipt.id].length > 0 ? receiptItems[receipt.id].map(item => (
                        <div key={item.id} className="grid grid-cols-[1fr_80px_80px] gap-2 bg-gray-700 p-2 rounded">
                          <span>{item.name}</span>
                          <span className="text-right">{item.quantity}</span>
                          <span className="text-right">${Number(item.price).toFixed(2)}</span>
                        </div>
                      )) : <p className="text-gray-400 text-center p-4">No items found for this receipt.</p>}
                    </div>
                  ) : (
                    <p>Loading items...</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <ReceiptScannerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onItemsScanned={handleItemsScanned}
      />
    </div>
  );
};

export default ReceiptScannerPage;