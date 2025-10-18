import React, { useState, useRef } from 'react';
import { FiUpload, FiX, FiZap, FiSave, FiTrash2, FiPlus } from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const ReceiptScannerModal = ({ isOpen, onClose, onItemsScanned }) => {
  const [image, setImage] = useState(null);
  const [items, setItems] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const resetModal = () => {
    setImage(null);
    setItems([]);
    setIsScanning(false);
    setProgress(0);
    setStatus('');
    setError('');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image too large. Please select an image under 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setImage(event.target.result);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const scanReceipt = async () => {
    if (!image) return;

    setIsScanning(true);
    setError('');
    setProgress(10);
    setStatus('Loading OCR engine...');

    try {
      // Import Tesseract dynamically
      const Tesseract = await import('tesseract.js');
      setProgress(20);
      setStatus('Analyzing image...');

      // Perform OCR
      const { data: { text } } = await Tesseract.recognize(image, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(20 + (m.progress * 60));
            setStatus(`Reading text... ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      setProgress(90);
      setStatus('Extracting items...');

      // Simple item extraction
      const extractedItems = extractItems(text);
      
      setItems(extractedItems);
      setProgress(100);
      setStatus(extractedItems.length > 0 ? 'Items found!' : 'No items found');

    } catch (err) {
      console.error('OCR Error:', err);
      setError('Failed to scan receipt. Please try again or add items manually.');
    } finally {
      setIsScanning(false);
      setTimeout(() => {
        setProgress(0);
        setStatus('');
      }, 2000);
    }
  };

  const extractItems = (text) => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 2);
    const items = [];

    for (const line of lines) {
      // Skip obvious non-item lines
      if (isSkipLine(line)) continue;

      // Look for price patterns
      const priceMatch = line.match(/(\d+\.\d{2})/);
      if (!priceMatch) continue;

      const price = parseFloat(priceMatch[1]);
      if (price < 0.10 || price > 500) continue;

      // Extract item name (text before the price)
      const priceIndex = line.indexOf(priceMatch[0]);
      let itemName = line.substring(0, priceIndex).trim();
      
      // Clean up item name
      itemName = itemName
        .replace(/^\d+\s*[x×*]?\s*/i, '') // Remove leading quantity
        .replace(/[^\w\s&'.-]/g, ' ')     // Remove special chars
        .replace(/\s+/g, ' ')             // Normalize spaces
        .trim();

      if (itemName.length < 2 || itemName.length > 50) continue;

      // Check for quantity in the name
      let quantity = 1;
      const qtyMatch = itemName.match(/(\d+)\s*$/);
      if (qtyMatch && parseInt(qtyMatch[1]) <= 20) {
        quantity = parseInt(qtyMatch[1]);
        itemName = itemName.replace(/\d+\s*$/, '').trim();
      }

      if (itemName.length >= 2) {
        items.push({
          name: capitalizeWords(itemName),
          quantity: quantity,
          price: price
        });
      }
    }

    // Remove duplicates and limit to 30 items
    const uniqueItems = [];
    const seen = new Set();

    for (const item of items) {
      const key = item.name.toLowerCase().replace(/\s+/g, '');
      if (!seen.has(key)) {
        seen.add(key);
        uniqueItems.push(item);
      }
    }

    return uniqueItems.slice(0, 30);
  };

  const isSkipLine = (line) => {
    const lower = line.toLowerCase();
    const skipWords = [
      'total', 'subtotal', 'tax', 'vat', 'change', 'cash', 'card',
      'receipt', 'thank', 'welcome', 'store', 'date', 'time'
    ];
    
    return skipWords.some(word => lower.includes(word)) ||
           line.length < 3 ||
           /^\d+$/.test(line) ||
           !/[a-zA-Z]/.test(line);
  };

  const capitalizeWords = (str) => {
    return str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    if (field === 'price' || field === 'quantity') {
      newItems[index][field] = parseFloat(value) || 0;
    } else {
      newItems[index][field] = value;
    }
    setItems(newItems);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItems([...items, { name: '', quantity: 1, price: 0 }]);
  };

  const saveItems = async () => {
    const validItems = items.filter(item => 
      item.name.trim().length > 0 && 
      item.price > 0 && 
      item.quantity > 0
    );

    if (validItems.length === 0) {
      setError('Please add at least one valid item');
      return;
    }

    try {
      await onItemsScanned(validItems, image);
      handleClose();
    } catch (err) {
      setError('Failed to save items. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-gray-900 text-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-gray-700 p-6">
          <h2 className="text-xl font-bold flex items-center">
            <SafeIcon icon={FiZap} className="mr-3 text-blue-400" />
            Receipt Scanner
          </h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-white">
            <SafeIcon icon={FiX} className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!image ? (
            /* Upload Section */
            <div className="space-y-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-600 p-12 text-center rounded-lg cursor-pointer hover:bg-gray-800/50 transition-colors"
              >
                <SafeIcon icon={FiUpload} className="mx-auto h-16 w-16 text-gray-500 mb-4" />
                <p className="text-lg text-gray-300 mb-2">Click to upload receipt image</p>
                <p className="text-sm text-gray-500">Supports JPG, PNG, WebP (max 10MB)</p>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="font-medium text-gray-200 mb-3">📸 Tips for best results:</h4>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• Use good lighting</li>
                  <li>• Keep receipt flat and straight</li>
                  <li>• Make sure text is clear and readable</li>
                  <li>• Include the entire receipt in the image</li>
                </ul>
              </div>
            </div>
          ) : (
            /* Scan Results Section */
            <div className="space-y-6">
              {/* Image Preview */}
              <div className="flex justify-center">
                <img 
                  src={image} 
                  alt="Receipt" 
                  className="max-h-48 rounded-lg border border-gray-600"
                />
              </div>

              {/* Scan Button */}
              {!isScanning && items.length === 0 && (
                <div className="text-center">
                  <button
                    onClick={scanReceipt}
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg mx-auto"
                  >
                    <SafeIcon icon={FiZap} />
                    Scan Receipt
                  </button>
                </div>
              )}

              {/* Progress */}
              {isScanning && (
                <div className="text-center space-y-3">
                  <p className="text-gray-300">{status}</p>
                  <div className="w-full bg-gray-600 rounded-full h-3">
                    <div 
                      className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-400">{progress}% complete</p>
                </div>
              )}

              {/* Items List */}
              {items.length > 0 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Found {items.length} items</h3>
                    <button
                      onClick={addItem}
                      className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm"
                    >
                      <SafeIcon icon={FiPlus} className="h-4 w-4" />
                      Add Item
                    </button>
                  </div>

                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {items.map((item, index) => (
                      <div key={index} className="bg-gray-800 p-4 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-3 items-center">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateItem(index, 'name', e.target.value)}
                            placeholder="Item name"
                            className="bg-gray-700 text-white rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 border-none"
                          />
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                            placeholder="Qty"
                            className="bg-gray-700 text-white rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 border-none"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.price}
                            onChange={(e) => updateItem(index, 'price', e.target.value)}
                            placeholder="Price"
                            className="bg-gray-700 text-white rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 border-none"
                          />
                          <button
                            onClick={() => removeItem(index)}
                            className="text-red-400 hover:text-red-300 p-2"
                          >
                            <SafeIcon icon={FiTrash2} className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setItems([])}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg"
                    >
                      Clear All
                    </button>
                    <button
                      onClick={saveItems}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2"
                    >
                      <SafeIcon icon={FiSave} />
                      Save {items.length} Items
                    </button>
                  </div>
                </div>
              )}

              {/* Try Again */}
              {!isScanning && (
                <div className="text-center">
                  <button
                    onClick={() => setImage(null)}
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    Try different image
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg mt-4">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceiptScannerModal;