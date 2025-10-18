import React, { useState, useRef, useCallback } from 'react';
import { FiUpload, FiX, FiZap, FiSave, FiTrash2, FiPlus, FiCrop, FiRotateCw } from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const ReceiptScannerModal = ({ isOpen, onClose, onItemsScanned }) => {
  const [image, setImage] = useState(null);
  const [items, setItems] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [showCropper, setShowCropper] = useState(false);
  const [cropArea, setCropArea] = useState(null);
  const [croppedImage, setCroppedImage] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);
  const imageRef = useRef(null);
  const canvasRef = useRef(null);

  const resetModal = () => {
    setImage(null);
    setItems([]);
    setIsScanning(false);
    setProgress(0);
    setStatus('');
    setError('');
    setShowCropper(false);
    setCropArea(null);
    setCroppedImage(null);
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
    setIsSaving(false);
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
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  };

  // Handle mouse events for area selection
  const handleMouseDown = useCallback((e) => {
    if (!showCropper) return;
    
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setIsSelecting(true);
    setSelectionStart({ x, y });
    setSelectionEnd({ x, y });
  }, [showCropper]);

  const handleMouseMove = useCallback((e) => {
    if (!isSelecting || !selectionStart) return;
    
    const rect = imageRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    
    setSelectionEnd({ x, y });
  }, [isSelecting, selectionStart]);

  const handleMouseUp = useCallback(() => {
    if (!isSelecting) return;
    
    setIsSelecting(false);
    if (selectionStart && selectionEnd) {
      const cropArea = {
        x: Math.min(selectionStart.x, selectionEnd.x),
        y: Math.min(selectionStart.y, selectionEnd.y),
        width: Math.abs(selectionEnd.x - selectionStart.x),
        height: Math.abs(selectionEnd.y - selectionStart.y)
      };
      
      if (cropArea.width > 5 && cropArea.height > 5) {
        setCropArea(cropArea);
      }
    }
  }, [isSelecting, selectionStart, selectionEnd]);

  const cropImage = useCallback(() => {
    if (!image || !cropArea || !imageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      const cropX = (cropArea.x / 100) * img.width;
      const cropY = (cropArea.y / 100) * img.height;
      const cropWidth = (cropArea.width / 100) * img.width;
      const cropHeight = (cropArea.height / 100) * img.height;
      
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      
      ctx.drawImage(
        img,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
      );
      
      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCroppedImage(croppedDataUrl);
      setShowCropper(false);
    };
    
    img.src = image;
  }, [image, cropArea]);

  const resetCrop = () => {
    setCropArea(null);
    setSelectionStart(null);
    setSelectionEnd(null);
    setCroppedImage(null);
    setShowCropper(true);
  };

  const scanReceipt = async () => {
    const imageToScan = croppedImage || image;
    if (!imageToScan) return;

    setIsScanning(true);
    setError('');
    setProgress(10);
    setStatus('Loading OCR engine...');

    try {
      const Tesseract = await import('tesseract.js');
      setProgress(20);
      setStatus('Analyzing image...');

      const { data: { text } } = await Tesseract.recognize(imageToScan, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(20 + (m.progress * 60));
            setStatus(`Reading text... ${Math.round(m.progress * 100)}%`);
          }
        },
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,£$€¥₹@#%&*()-+=[]{}|\\:";\'<>?/_ ',
        preserve_interword_spaces: '1'
      });

      setProgress(90);
      setStatus('Extracting items...');

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

    console.log('🔍 Processing lines:', lines.length);

    for (const line of lines) {
      if (isSkipLine(line)) continue;

      console.log('📝 Processing line:', line);

      const rightmostPrice = findRightmostPrice(line);
      if (!rightmostPrice) {
        console.log('❌ No valid price found in line');
        continue;
      }

      const { price, priceMatch, priceIndex } = rightmostPrice;
      console.log('💰 Found price:', price, 'at position:', priceIndex);

      let itemName = line.substring(0, priceIndex).trim();
      itemName = cleanItemName(itemName);
      
      if (itemName.length < 2 || itemName.length > 50) {
        console.log('❌ Item name too short/long:', itemName);
        continue;
      }

      let quantity = 1;
      const qtyMatch = itemName.match(/^(\d{1,2})\s*[x×*]?\s*/i);
      if (qtyMatch) {
        const q = parseInt(qtyMatch[1]);
        if (q > 0 && q <= 99) {
          quantity = q;
          itemName = itemName.replace(/^\d{1,2}\s*[x×*]?\s*/i, '').trim();
        }
      }

      if (itemName.length >= 2 && !isItemNameInvalid(itemName)) {
        const finalItem = {
          name: capitalizeWords(itemName),
          quantity: quantity,
          price: price
        };
        
        console.log('✅ Added item:', finalItem);
        items.push(finalItem);
      } else {
        console.log('❌ Item name invalid:', itemName);
      }
    }

    const uniqueItems = removeDuplicates(items);
    console.log('📦 Final items:', uniqueItems.length);
    
    return uniqueItems.slice(0, 30);
  };

  const findRightmostPrice = (line) => {
    const pricePatterns = [
      /([£$€¥₹])\s*(\d{1,4}[.,]\d{2})\s*$/,
      /(\d{1,4}[.,]\d{2})\s*([£$€¥₹])\s*$/,
      /(\d{1,4}[.,]\d{2})\s*$/,
      /([£$€¥₹])\s*(\d{1,4}[.,]\d{2})/g,
      /(\d{1,4}[.,]\d{2})\s*([£$€¥₹])/g,
      /(\d{1,4}[.,]\d{2})/g
    ];

    let bestMatch = null;
    let bestPrice = null;
    let bestIndex = -1;

    for (let i = 0; i < pricePatterns.length; i++) {
      const pattern = pricePatterns[i];
      
      if (pattern.global) {
        let match;
        let rightmostMatch = null;
        let rightmostIndex = -1;
        
        while ((match = pattern.exec(line)) !== null) {
          const matchIndex = match.index;
          if (matchIndex > rightmostIndex) {
            rightmostMatch = match;
            rightmostIndex = matchIndex;
          }
        }
        
        if (rightmostMatch) {
          const priceStr = rightmostMatch[0];
          const price = parseFloat(priceStr.replace(/[£$€¥₹\s]/g, '').replace(',', '.'));
          
          if (isValidPrice(price, line, rightmostIndex)) {
            if (!bestMatch || rightmostIndex > bestIndex || i < 3) {
              bestMatch = rightmostMatch;
              bestPrice = price;
              bestIndex = rightmostIndex;
            }
          }
        }
      } else {
        const match = line.match(pattern);
        if (match) {
          const matchIndex = line.lastIndexOf(match[0]);
          const priceStr = match[0];
          const price = parseFloat(priceStr.replace(/[£$€¥₹\s]/g, '').replace(',', '.'));
          
          if (isValidPrice(price, line, matchIndex)) {
            bestMatch = match;
            bestPrice = price;
            bestIndex = matchIndex;
            break;
          }
        }
      }
    }

    if (bestMatch && bestPrice !== null) {
      return {
        price: bestPrice,
        priceMatch: bestMatch[0],
        priceIndex: bestIndex
      };
    }

    return null;
  };

  const isValidPrice = (price, line, priceIndex) => {
    if (price < 0.01 || price > 9999.99) return false;
    
    const lineLength = line.length;
    const relativePosition = priceIndex / lineLength;
    
    if (relativePosition < 0.4) return false;
    
    const textBeforePrice = line.substring(0, priceIndex).trim();
    if (textBeforePrice.length < 2) return false;
    
    if (relativePosition < 0.5 && price < 10) return false;
    
    const textAfterPrice = line.substring(priceIndex + 10).trim();
    if (textAfterPrice.length > 10) return false;
    
    return true;
  };

  const cleanItemName = (name) => {
    return name
      .replace(/^\d{1,2}\s*[x×*]?\s*/i, '')
      .replace(/\b\d{4,}\b/g, ' ')
      .replace(/[^\w\s&'.-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const isItemNameInvalid = (name) => {
    const lower = name.toLowerCase();
    
    if (/^\d+/.test(name) && name.length < 6) return true;
    
    const invalidPatterns = [
      /^(qty|quantity|price|total|tax|vat|disc|discount)\s*$/i,
      /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
      /^\d{1,2}:\d{2}$/,
      /^[a-z]\d+$/i,
      /^\d+[a-z]$/i,
    ];
    
    return invalidPatterns.some(pattern => pattern.test(name));
  };

  const removeDuplicates = (items) => {
    const seen = new Set();
    return items.filter(item => {
      const key = item.name.toLowerCase().replace(/\s+/g, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const isSkipLine = (line) => {
    const lower = line.toLowerCase();
    const skipWords = [
      'total', 'subtotal', 'tax', 'vat', 'change', 'cash', 'card',
      'receipt', 'thank', 'welcome', 'store', 'date', 'time', 'till',
      'balance', 'payment', 'tender', 'operator', 'cashier', 'discount',
      'sale', 'savings', 'member', 'points', 'rewards'
    ];
    
    if (skipWords.some(word => lower.includes(word))) return true;
    if (line.length < 5) return true;
    if (/^\d+$/.test(line)) return true;
    if (!/[a-zA-Z]{2,}/.test(line)) return true;
    if (/^[*\-=_#\s\.]{3,}$/.test(line)) return true;
    if (/^(store|shop|market|receipt|invoice|bill)/i.test(line)) return true;
    if (/^\d{1,2}[\/\-:]\d{1,2}[\/\-:]\d{2,4}/.test(line)) return true;
    
    return false;
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

    setIsSaving(true);
    setError('');

    try {
      // Transform items to match the expected format for the database
      const transformedItems = validItems.map(item => ({
        name: item.name.trim(),
        quantity: item.quantity,
        unitPrice: item.price, // Use unitPrice instead of price
        category: 'Scanned Items',
        description: `Scanned from receipt on ${new Date().toLocaleDateString()}`,
        status: 'In Stock',
        dateAdded: new Date().toISOString().split('T')[0]
      }));

      console.log('Saving transformed items:', transformedItems);

      // Call the parent component's handler with the transformed items
      await onItemsScanned(transformedItems);
      
      // Close the modal after successful save
      handleClose();
    } catch (err) {
      console.error('Error saving items:', err);
      setError('Failed to save items. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-gray-900 text-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-gray-700 p-6">
          <h2 className="text-xl font-bold flex items-center">
            <SafeIcon icon={FiZap} className="mr-3 text-blue-400" />
            Receipt Scanner
            {croppedImage && <span className="ml-2 text-sm text-green-400">(Area Selected)</span>}
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
                  <li>• Use good lighting and keep receipt flat</li>
                  <li>• Make sure text is clear and readable</li>
                  <li>• You can select specific areas after upload</li>
                  <li>• Crop out irrelevant parts for better accuracy</li>
                  <li>• Ensure prices are visible on the right side</li>
                </ul>
              </div>
            </div>
          ) : showCropper ? (
            /* Area Selection */
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white mb-2">Select Receipt Area</h3>
                <p className="text-gray-400 mb-4">
                  Click and drag to select the area containing items and prices. 
                  Focus on the items list with prices on the right side.
                </p>
              </div>

              <div className="flex justify-center">
                <div className="relative inline-block">
                  <img 
                    ref={imageRef}
                    src={image} 
                    alt="Receipt" 
                    className="max-w-full max-h-96 rounded-lg border border-gray-600 cursor-crosshair"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    draggable={false}
                  />
                  
                  {/* Selection overlay */}
                  {(selectionStart && selectionEnd) && (
                    <div
                      className="absolute border-2 border-blue-400 bg-blue-400 bg-opacity-20 pointer-events-none"
                      style={{
                        left: `${Math.min(selectionStart.x, selectionEnd.x)}%`,
                        top: `${Math.min(selectionStart.y, selectionEnd.y)}%`,
                        width: `${Math.abs(selectionEnd.x - selectionStart.x)}%`,
                        height: `${Math.abs(selectionEnd.y - selectionStart.y)}%`,
                      }}
                    />
                  )}
                  
                  {/* Crop area overlay */}
                  {cropArea && (
                    <div
                      className="absolute border-2 border-green-400 bg-green-400 bg-opacity-20 pointer-events-none"
                      style={{
                        left: `${cropArea.x}%`,
                        top: `${cropArea.y}%`,
                        width: `${cropArea.width}%`,
                        height: `${cropArea.height}%`,
                      }}
                    />
                  )}
                </div>
              </div>

              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setShowCropper(false)}
                  className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
                >
                  Skip Selection
                </button>
                {cropArea && (
                  <>
                    <button
                      onClick={cropImage}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
                    >
                      <SafeIcon icon={FiCrop} className="h-4 w-4" />
                      Use Selected Area
                    </button>
                    <button
                      onClick={resetCrop}
                      className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg"
                    >
                      <SafeIcon icon={FiRotateCw} className="h-4 w-4" />
                      Reset Selection
                    </button>
                  </>
                )}
              </div>

              <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
                <h4 className="text-blue-200 font-medium mb-2">💡 Selection Tips:</h4>
                <ul className="text-sm text-blue-100 space-y-1">
                  <li>• Focus on the items list area with names and prices</li>
                  <li>• Make sure prices are clearly visible on the right side</li>
                  <li>• Exclude headers, footers, and store information</li>
                  <li>• Include quantity information if visible</li>
                  <li>• Avoid areas with only item codes or dates</li>
                </ul>
              </div>
            </div>
          ) : (
            /* Scan Results Section */
            <div className="space-y-6">
              {/* Image Preview */}
              <div className="flex justify-center gap-4">
                {croppedImage && (
                  <div className="text-center">
                    <p className="text-sm text-gray-400 mb-2">Selected Area</p>
                    <img 
                      src={croppedImage} 
                      alt="Cropped Receipt" 
                      className="max-h-48 rounded-lg border border-green-600"
                    />
                  </div>
                )}
                <div className="text-center">
                  <p className="text-sm text-gray-400 mb-2">Original Image</p>
                  <img 
                    src={image} 
                    alt="Receipt" 
                    className="max-h-48 rounded-lg border border-gray-600 opacity-70"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setShowCropper(true)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  <SafeIcon icon={FiCrop} className="h-4 w-4" />
                  {croppedImage ? 'Reselect Area' : 'Select Area'}
                </button>
                
                {!isScanning && items.length === 0 && (
                  <button
                    onClick={scanReceipt}
                    className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-lg"
                  >
                    <SafeIcon icon={FiZap} />
                    {croppedImage ? 'Scan Selected Area' : 'Scan Full Image'}
                  </button>
                )}
              </div>

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
                      disabled={isSaving}
                    >
                      Clear All
                    </button>
                    <button
                      onClick={saveItems}
                      disabled={isSaving}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <SafeIcon icon={FiSave} />
                      {isSaving ? 'Saving...' : `Save ${items.length} Items`}
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

        {/* Hidden canvas for image processing */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export default ReceiptScannerModal;