import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiFileText, FiCalendar, FiChevronDown, FiChevronUp, FiArchive } from 'react-icons/fi';
import ReceiptScannerModal from '../components/ReceiptScannerModal';
import SafeIcon from '../common/SafeIcon';
import supabase from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const ReceiptScanner = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedReceiptId, setExpandedReceiptId] = useState(null);
  const [receiptItems, setReceiptItems] = useState({});

  const { user } = useAuth();

  const fetchReceipts = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching receipts:', error);
    } else {
      setReceipts(data);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const handleItemsScanned = async (items, imageFile) => {
    if (!user) {
      setError('You must be logged in to save receipts.');
      return;
    }
  
    try {
      const fileName = `receipt_${Date.now()}.jpeg`;
      const { data: fileData, error: fileError } = await supabase.storage
        .from('receipts')
        .upload(`${user.id}/${fileName}`, imageFile.split(',')[1], {
            contentType: 'image/jpeg',
            upsert: false,
        });

      if (fileError) throw fileError;
  
      const { data: receiptData, error: receiptError } = await supabase
        .from('receipts')
        .insert({
          user_id: user.id,
          storage_path: fileData.path,
          file_name: fileName,
        })
        .select('id')
        .single();
  
      if (receiptError) throw receiptError;
  
      const receiptId = receiptData.id;
  
      const itemsToInsert = items.map(item => ({
        receipt_id: receiptId,
        user_id: user.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      }));
  
      const { error: itemsError } = await supabase
        .from('receipt_items')
        .insert(itemsToInsert);
  
      if (itemsError) throw itemsError;
  
      await fetchReceipts();
      setIsModalOpen(false);
  
    } catch (err) {
      console.error('Error saving receipt and items:', err);
      setError('Failed to save your receipt. Please try again.');
    }
  };

  const toggleReceiptDetails = async (receiptId) => {
    if (expandedReceiptId === receiptId) {
      setExpandedReceiptId(null);
    } else {
      setExpandedReceiptId(receiptId);
      if (!receiptItems[receiptId]) {
        const { data, error } = await supabase
          .from('receipt_items')
          .select('*')
          .eq('receipt_id', receiptId)
          .eq('user_id', user.id);
        
        if (error) {
          console.error('Error fetching receipt items:', error);
          // Do not show error to user, just log it
        } else {
          setReceiptItems(prev => ({ ...prev, [receiptId]: data }));
        }
      }
    }
  };

  const ReceiptCard = ({ receipt }) => (
    <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg">
      <div className="p-4 cursor-pointer" onClick={() => toggleReceiptDetails(receipt.id)}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <SafeIcon icon={FiFileText} className="text-blue-400 text-2xl" />
            <div>
              <p className="font-semibold text-white">{receipt.file_name || 'Receipt'}</p>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <SafeIcon icon={FiCalendar} />
                <span>{new Date(receipt.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <SafeIcon icon={expandedReceiptId === receipt.id ? FiChevronUp : FiChevronDown} className="text-gray-400 text-xl" />
        </div>
      </div>

      {expandedReceiptId === receipt.id && (
        <div className="p-4 bg-gray-800/50 border-t border-gray-700">
          <h4 className="text-md font-semibold text-gray-200 mb-2">Scanned Items</h4>
          {receiptItems[receipt.id] ? (
            <ul className="space-y-2">
              {receiptItems[receipt.id].map(item => (
                <li key={item.id} className="flex justify-between items-center text-sm p-2 rounded-md bg-gray-700/50">
                  <span className="text-gray-300">{item.name}</span>
                  <span className="text-gray-400">{item.quantity} x ${parseFloat(item.price).toFixed(2)}</span>
                  <span className="font-semibold text-white">${(item.quantity * parseFloat(item.price)).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-gray-400">Loading items...</p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-100">Receipt History</h1>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
          >
            <SafeIcon icon={FiPlus} />
            <span>Scan New Receipt</span>
          </button>
        </div>

        {error && <div className="bg-red-800 text-white p-3 mb-4 rounded-lg">{error}</div>}

        <div className="space-y-4">
          {loading ? (
            <p className="text-center text-gray-400">Loading receipts...</p>
          ) : receipts.length > 0 ? (
            receipts.map(receipt => <ReceiptCard key={receipt.id} receipt={receipt} />)
          ) : (
            <div className="text-center py-16 px-6 bg-gray-800 rounded-lg">
              <SafeIcon icon={FiArchive} className="mx-auto h-12 w-12 text-gray-500" />
              <h3 className="mt-4 text-lg font-medium text-white">No receipts found</h3>
              <p className="mt-1 text-sm text-gray-400">Get started by scanning your first receipt.</p>
            </div>
          )}
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

export default ReceiptScanner;