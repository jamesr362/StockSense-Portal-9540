import React, { useState, useRef, useCallback } from 'react';
import { FiUpload, FiX, FiSave, FiTrash2, FiPlus, FiCrop, FiRotateCw, FiCamera, FiMove, FiMaximize2, FiAlertTriangle } from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import receiptStorage from '../services/receiptStorage';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

const ReceiptScannerModal = ({ isOpen, onClose, onItemsScanned, onReceiptSaved }) => {
  const [image, setImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
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
  const [ocrText, setOcrText] = useState('');
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [showMobileInstructions, setShowMobileInstructions] = useState(false);
  const [showAccuracyWarning, setShowAccuracyWarning] = useState(false); // ✅ Add warning state
  
  // VAT configuration state
  const [vatIncluded, setVatIncluded] = useState(true);
  const [vatPercentage, setVatPercentage] = useState(20);
  
  const fileInputRef = useRef(null);
  const imageRef = useRef(null);
  const canvasRef = useRef(null);
  const { user } = useAuth();

  // Detect mobile device
  React.useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) || 
                      ('ontouchstart' in window) || 
                      (window.innerWidth <= 768);
      setIsMobileDevice(isMobile);
      if (isMobile && showCropper) {
        setShowMobileInstructions(true);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [showCropper]);

  const resetModal = () => {
    setImage(null);
    setImageFile(null);
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
    setOcrText('');
    setShowMobileInstructions(false);
    setVatIncluded(true);
    setVatPercentage(20);
    setShowAccuracyWarning(false); // ✅ Reset warning
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

    setImageFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      setImage(event.target.result);
      setError('');
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  };

  // Get coordinates from mouse or touch event
  const getEventCoordinates = useCallback((e) => {
    const rect = imageRef.current.getBoundingClientRect();
    let clientX, clientY;
    
    if (e.touches && e.touches.length > 0) {
      // Touch event
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      // Touch end event
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    
    return { x, y };
  }, []);

  // Handle start of selection (mouse down or touch start)
  const handleSelectionStart = useCallback((e) => {
    if (!showCropper) return;
    
    e.preventDefault(); // Prevent scrolling on mobile
    
    const coords = getEventCoordinates(e);
    setIsSelecting(true);
    setSelectionStart(coords);
    setSelectionEnd(coords);
    
    // Hide mobile instructions once user starts selecting
    if (isMobileDevice && showMobileInstructions) {
      setShowMobileInstructions(false);
    }
  }, [showCropper, getEventCoordinates, isMobileDevice, showMobileInstructions]);

  // Handle selection movement (mouse move or touch move)
  const handleSelectionMove = useCallback((e) => {
    if (!isSelecting || !selectionStart) return;
    
    e.preventDefault(); // Prevent scrolling on mobile
    
    const coords = getEventCoordinates(e);
    setSelectionEnd(coords);
  }, [isSelecting, selectionStart, getEventCoordinates]);

  // Handle end of selection (mouse up or touch end)
  const handleSelectionEnd = useCallback((e) => {
    if (!isSelecting) return;
    
    e.preventDefault();
    
    setIsSelecting(false);
    if (selectionStart && selectionEnd) {
      const cropArea = {
        x: Math.min(selectionStart.x, selectionEnd.x),
        y: Math.min(selectionStart.y, selectionEnd.y),
        width: Math.abs(selectionEnd.x - selectionStart.x),
        height: Math.abs(selectionEnd.y - selectionStart.y)
      };
      
      // Minimum selection size (larger for mobile)
      const minSize = isMobileDevice ? 10 : 5;
      if (cropArea.width > minSize && cropArea.height > minSize) {
        setCropArea(cropArea);
      }
    }
  }, [isSelecting, selectionStart, selectionEnd, isMobileDevice]);

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
    if (isMobileDevice) {
      setShowMobileInstructions(true);
    }
  };

  // Quick select presets for mobile users
  const quickSelectPresets = [
    { name: 'Top Half', x: 5, y: 5, width: 90, height: 45 },
    { name: 'Bottom Half', x: 5, y: 50, width: 90, height: 45 },
    { name: 'Middle Section', x: 10, y: 25, width: 80, height: 50 },
    { name: 'Full Receipt', x: 2, y: 2, width: 96, height: 96 }
  ];

  const applyQuickSelect = (preset) => {
    setCropArea(preset);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const scanReceipt = async () => {
    const imageToScan = croppedImage || image;
    if (!imageToScan) return;

    setIsScanning(true);
    setError('');
    setProgress(10);
    setStatus('Loading OCR engine...');
    setShowAccuracyWarning(false); // ✅ Reset warning before scan

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

      setOcrText(text);
      setProgress(90);
      setStatus('Extracting items...');

      const extractedItems = extractItems(text);
      
      setItems(extractedItems);
      setProgress(100);
      
      // ✅ CRITICAL FIX: Show accuracy warning immediately when items are found
      if (extractedItems.length > 0) {
        setShowAccuracyWarning(true);
        setStatus(`${extractedItems.length} items found! Please verify accuracy.`);
      } else {
        setStatus('No items found');
      }

    } catch (err) {
      console.error('OCR Error:', err);
      setError('Failed to scan receipt. Please try again or add items manually.');
    } finally {
      setIsScanning(false);
      setTimeout(() => {
        setProgress(0);
        if (!showAccuracyWarning) {
          setStatus('');
        }
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

  // Calculate VAT breakdown for preview
  const calculateVatBreakdown = () => {
    if (!vatIncluded || items.length === 0) return null;

    const totalPurchasePrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const vatAmount = totalPurchasePrice * (vatPercentage / (100 + vatPercentage));
    const priceExcludingVat = totalPurchasePrice - vatAmount;

    return {
      totalPurchasePrice,
      vatAmount,
      priceExcludingVat
    };
  };

  const vatBreakdown = calculateVatBreakdown();

  const saveItems = async () => {
    console.log('=== 🚀 SAVE ITEMS CALLED ===');
    
    // Check if user is authenticated
    if (!user || !user.email) {
      setError('You must be logged in to save items');
      console.error('❌ No authenticated user');
      return;
    }

    console.log('👤 Authenticated user:', user.email);

    const validItems = items.filter(item => 
      item.name.trim().length > 0 && 
      item.price > 0 && 
      item.quantity > 0
    );

    if (validItems.length === 0 && !imageFile) {
      setError('Please add at least one valid item or upload a receipt image');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      let receiptRecord = null;

      // ALWAYS save receipt image and record if we have an image file
      if (imageFile) {
        console.log('=== 📸 RECEIPT SAVING PROCESS ===');
        console.log('🔄 Starting receipt save process...');
        console.log('📁 File:', imageFile.name, imageFile.size, 'bytes');
        
        try {
          // Test database connection first
          setStatus('Testing database connection...');
          const connectionTest = await receiptStorage.testConnection();
          console.log('🔗 Connection test result:', connectionTest);
          
          if (!connectionTest.success) {
            throw new Error(`Database connection failed: ${connectionTest.error}`);
          }

          // Step 1: Upload image to storage
          setStatus('Uploading receipt image...');
          console.log('🔄 Step 1: Uploading to storage...');
          const uploadResult = await receiptStorage.uploadReceipt(imageFile);
          console.log('✅ Upload result:', uploadResult);
          
          // Step 2: Save receipt record to database
          setStatus('Saving receipt to database...');
          console.log('🔄 Step 2: Saving to database...');
          const receiptData = {
            storagePath: uploadResult.path,
            fileName: uploadResult.fileName,
            fileSize: uploadResult.fileSize,
            mimeType: uploadResult.mimeType,
            scannedItems: validItems,
            scanStatus: 'completed',
            ocrText: ocrText
          };

          console.log('💾 Receipt data to save:', {
            storagePath: receiptData.storagePath,
            fileName: receiptData.fileName,
            fileSize: receiptData.fileSize,
            itemCount: receiptData.scannedItems.length,
            scanStatus: receiptData.scanStatus
          });
          
          receiptRecord = await receiptStorage.saveReceiptRecord(receiptData);
          console.log('🎉 Receipt record saved successfully:', receiptRecord?.id);
          
          // Step 3: Notify parent component about receipt save
          if (onReceiptSaved && receiptRecord) {
            console.log('🔔 Notifying parent of receipt save...');
            onReceiptSaved(receiptRecord);
          }

          console.log('=== ✅ RECEIPT SAVE COMPLETE ===');
        } catch (uploadError) {
          console.error('❌ Receipt save failed:', uploadError);
          setError(`Receipt save failed: ${uploadError.message}. Items will still be saved to inventory.`);
          // Don't return here - continue with item saving if there are items
        }
      }

      // Save items to inventory if we have any
      if (validItems.length > 0) {
        setStatus('Saving items to inventory...');
        console.log('📦 Saving items to inventory:', validItems.length);

        // Transform items to match the expected format for the database
        const transformedItems = validItems.map(item => ({
          name: item.name.trim(),
          quantity: item.quantity,
          unitPrice: item.price,
          category: 'Scanned Items',
          description: `Scanned from receipt${receiptRecord ? ` (Receipt #${receiptRecord.id})` : ''} on ${new Date().toLocaleDateString()}`,
          status: 'In Stock',
          dateAdded: new Date().toISOString().split('T')[0],
          // Add VAT configuration
          vatIncluded: vatIncluded,
          vatPercentage: vatPercentage
        }));

        console.log('📦 Transformed items for inventory:', transformedItems);

        // Call the parent component's handler with the transformed items
        await onItemsScanned(transformedItems);
        
        console.log('🎉 Items saved to inventory successfully');
      }

      console.log('🎉 All save operations completed successfully');
      
      // Show success message
      if (receiptRecord && validItems.length > 0) {
        setStatus(`✅ Receipt and ${validItems.length} items saved successfully!`);
      } else if (receiptRecord) {
        setStatus('✅ Receipt saved to history successfully!');
      } else if (validItems.length > 0) {
        setStatus(`✅ ${validItems.length} items saved to inventory!`);
      }
      
      // Close the modal after successful save
      setTimeout(() => {
        handleClose();
      }, 2000);
      
    } catch (err) {
      console.error('❌ Error in save process:', err);
      setError(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setStatus(''), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-2 sm:p-4">
      <div className="bg-gray-900 text-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-gray-700 p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold flex items-center">
            <SafeIcon icon={FiCamera} className="mr-2 sm:mr-3 text-blue-400" />
            Receipt Scanner
            {croppedImage && <span className="ml-2 text-xs sm:text-sm text-green-400">(Area Selected)</span>}
          </h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-white p-2">
            <SafeIcon icon={FiX} className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          {!image ? (
            /* Upload Section */
            <div className="space-y-4 sm:space-y-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-600 p-8 sm:p-12 text-center rounded-lg cursor-pointer hover:bg-gray-800/50 transition-colors"
              >
                <SafeIcon icon={FiUpload} className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-gray-500 mb-4" />
                <p className="text-base sm:text-lg text-gray-300 mb-2">
                  {isMobileDevice ? 'Tap to upload receipt image' : 'Click to upload receipt image'}
                </p>
                <p className="text-sm text-gray-500">Supports JPG, PNG, WebP (max 10MB)</p>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
                <h4 className="font-medium text-gray-200 mb-3 text-sm sm:text-base">
                  📸 Tips for best results:
                </h4>
                <ul className="text-xs sm:text-sm text-gray-400 space-y-1">
                  <li>• Use good lighting and keep receipt flat</li>
                  <li>• Make sure text is clear and readable</li>
                  <li>• {isMobileDevice ? 'You can select areas with your finger' : 'You can select specific areas after upload'}</li>
                  <li>• Crop out irrelevant parts for better accuracy</li>
                  <li>• Ensure prices are visible on the right side</li>
                  <li>• <strong className="text-green-400">Receipt images will be saved to your history automatically</strong></li>
                </ul>
              </div>

              {/* Authentication Status */}
              {user ? (
                <div className="bg-green-900/30 border border-green-700 rounded-lg p-3">
                  <p className="text-green-200 text-xs sm:text-sm">
                    ✅ Logged in as: <strong>{user.email}</strong>
                    <br />
                    <span className="text-green-300">Receipt images will be saved to your history</span>
                  </p>
                </div>
              ) : (
                <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
                  <p className="text-red-200 text-xs sm:text-sm">
                    ❌ You must be logged in to save receipts and items
                  </p>
                </div>
              )}
            </div>
          ) : showCropper ? (
            /* Area Selection - Mobile Optimized */
            <div className="space-y-4 sm:space-y-6">
              <div className="text-center">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-2">
                  Select Receipt Area
                </h3>
                <p className="text-gray-400 mb-4 text-sm sm:text-base">
                  {isMobileDevice 
                    ? 'Touch and drag to select the area with items and prices'
                    : 'Click and drag to select the area containing items and prices'
                  }
                </p>
              </div>

              {/* Mobile Instructions */}
              {isMobileDevice && showMobileInstructions && (
                <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 mb-4">
                  <div className="flex items-start">
                    <SafeIcon icon={FiMove} className="h-5 w-5 text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-blue-200 font-medium mb-1 text-sm">📱 Touch Selection Guide:</h4>
                      <ul className="text-xs text-blue-100 space-y-1">
                        <li>• Touch and drag your finger to select an area</li>
                        <li>• Start from top-left, drag to bottom-right</li>
                        <li>• Focus on the items list with prices</li>
                        <li>• Use quick presets below if selection is difficult</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Selection Presets for Mobile */}
              {isMobileDevice && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Quick Select:</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {quickSelectPresets.map((preset, index) => (
                      <button
                        key={index}
                        onClick={() => applyQuickSelect(preset)}
                        className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors"
                      >
                        <SafeIcon icon={FiMaximize2} className="h-3 w-3 mr-1 inline" />
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-center">
                <div className="relative inline-block max-w-full">
                  <img 
                    ref={imageRef}
                    src={image} 
                    alt="Receipt" 
                    className={`max-w-full rounded-lg border border-gray-600 ${
                      isMobileDevice 
                        ? 'max-h-[60vh] touch-none cursor-crosshair' 
                        : 'max-h-96 cursor-crosshair'
                    }`}
                    // Mouse events
                    onMouseDown={handleSelectionStart}
                    onMouseMove={handleSelectionMove}
                    onMouseUp={handleSelectionEnd}
                    onMouseLeave={handleSelectionEnd}
                    // Touch events for mobile
                    onTouchStart={handleSelectionStart}
                    onTouchMove={handleSelectionMove}
                    onTouchEnd={handleSelectionEnd}
                    draggable={false}
                    style={{ 
                      touchAction: 'none', // Prevent scrolling during selection
                      userSelect: 'none'   // Prevent text selection
                    }}
                  />
                  
                  {/* Current selection overlay */}
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
                  
                  {/* Confirmed crop area overlay */}
                  {cropArea && (
                    <div
                      className="absolute border-2 border-green-400 bg-green-400 bg-opacity-20 pointer-events-none"
                      style={{
                        left: `${cropArea.x}%`,
                        top: `${cropArea.y}%`,
                        width: `${cropArea.width}%`,
                        height: `${cropArea.height}%`,
                      }}
                    >
                      {/* Corner indicators for better visibility */}
                      <div className="absolute -top-1 -left-1 w-3 h-3 bg-green-400 rounded-full"></div>
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full"></div>
                      <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-green-400 rounded-full"></div>
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full"></div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4">
                <button
                  onClick={() => setShowCropper(false)}
                  className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm"
                >
                  Skip Selection
                </button>
                {cropArea && (
                  <>
                    <button
                      onClick={cropImage}
                      className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm"
                    >
                      <SafeIcon icon={FiCrop} className="h-4 w-4" />
                      Use Selected Area
                    </button>
                    <button
                      onClick={resetCrop}
                      className="flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm"
                    >
                      <SafeIcon icon={FiRotateCw} className="h-4 w-4" />
                      Reset Selection
                    </button>
                  </>
                )}
              </div>

              <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 sm:p-4">
                <h4 className="text-blue-200 font-medium mb-2 text-sm">💡 Selection Tips:</h4>
                <ul className="text-xs sm:text-sm text-blue-100 space-y-1">
                  <li>• Focus on the items list area with names and prices</li>
                  <li>• Make sure prices are clearly visible on the right side</li>
                  <li>• Exclude headers, footers, and store information</li>
                  <li>• Include quantity information if visible</li>
                  <li>• Avoid areas with only item codes or dates</li>
                  {isMobileDevice && <li>• <strong>Use a steady finger motion for best results</strong></li>}
                </ul>
              </div>
            </div>
          ) : (
            /* Scan Results Section - Mobile Optimized */
            <div className="space-y-4 sm:space-y-6">
              {/* Image Preview */}
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                {croppedImage && (
                  <div className="text-center">
                    <p className="text-xs sm:text-sm text-gray-400 mb-2">Selected Area</p>
                    <img 
                      src={croppedImage} 
                      alt="Cropped Receipt" 
                      className="max-h-32 sm:max-h-48 rounded-lg border border-green-600 mx-auto"
                    />
                  </div>
                )}
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-gray-400 mb-2">Original Image</p>
                  <img 
                    src={image} 
                    alt="Receipt" 
                    className="max-h-32 sm:max-h-48 rounded-lg border border-gray-600 opacity-70 mx-auto"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4">
                <button
                  onClick={() => setShowCropper(true)}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
                >
                  <SafeIcon icon={FiCrop} className="h-4 w-4" />
                  {croppedImage ? 'Reselect Area' : 'Select Area'}
                </button>
                
                {!isScanning && items.length === 0 && (
                  <button
                    onClick={scanReceipt}
                    className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 sm:px-6 rounded-lg text-sm"
                  >
                    <SafeIcon icon={FiCamera} className="h-4 w-4" />
                    {croppedImage ? 'Scan Selected Area' : 'Scan Full Image'}
                  </button>
                )}

                {/* Save Receipt Button - Always available when image is uploaded */}
                {imageFile && !isSaving && (
                  <button
                    onClick={saveItems}
                    disabled={!user}
                    className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 sm:px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <SafeIcon icon={FiSave} className="h-4 w-4" />
                    Save Receipt to History
                  </button>
                )}
              </div>

              {/* Progress */}
              {(isScanning || isSaving) && (
                <div className="text-center space-y-3">
                  <p className="text-gray-300 text-sm sm:text-base">{status}</p>
                  <div className="w-full bg-gray-600 rounded-full h-2 sm:h-3">
                    <div 
                      className="bg-blue-500 h-2 sm:h-3 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {progress > 0 && <p className="text-xs sm:text-sm text-gray-400">{progress}% complete</p>}
                </div>
              )}

              {/* ✅ FIXED: Show accuracy warning in modal when items are found - removed emoji */}
              {showAccuracyWarning && items.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3 sm:p-4 rounded-lg border bg-amber-900/30 border-amber-700"
                >
                  <div className="flex items-start">
                    <SafeIcon icon={FiAlertTriangle} className="h-5 w-5 text-amber-400 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-amber-200 font-medium mb-1 text-sm sm:text-base">Please Verify Information</h3>
                      <p className="text-amber-300 text-xs sm:text-sm">
                        Receipt scanning is not always completely accurate. Please check that all item names, quantities, and prices are correct before saving to your inventory.
                      </p>
                      <button
                        onClick={() => setShowAccuracyWarning(false)}
                        className="mt-2 text-amber-200 hover:text-amber-100 text-xs underline"
                      >
                        Dismiss this warning
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* VAT Configuration - Only show when items are found */}
              {items.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-3 text-sm sm:text-base">VAT Configuration</h4>
                  <div className="space-y-4">
                    {/* VAT Included Checkbox */}
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="vatIncluded"
                        checked={vatIncluded}
                        onChange={(e) => setVatIncluded(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600 rounded bg-gray-700"
                      />
                      <label htmlFor="vatIncluded" className="ml-2 text-gray-300 text-sm">
                        Price includes VAT
                      </label>
                    </div>

                    {/* VAT Rate Dropdown */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        VAT Rate
                      </label>
                      <select
                        value={vatPercentage}
                        onChange={(e) => setVatPercentage(parseInt(e.target.value))}
                        className="w-full rounded-md border-gray-600 bg-gray-700 text-white text-sm p-2 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={0}>0% (VAT Exempt)</option>
                        <option value={5}>5% (Reduced Rate)</option>
                        <option value={20}>20% (Standard Rate)</option>
                      </select>
                    </div>

                    {/* VAT Breakdown */}
                    {vatBreakdown && (
                      <div className="bg-gray-700 rounded-lg p-3">
                        <h5 className="text-gray-300 font-medium mb-2 text-sm">VAT Breakdown</h5>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Total Purchase Price:</span>
                            <span className="text-white">£{vatBreakdown.totalPurchasePrice.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">VAT Amount ({vatPercentage}%):</span>
                            <span className="text-green-400">£{vatBreakdown.vatAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-600 pt-1">
                            <span className="text-gray-400">Price Excluding VAT:</span>
                            <span className="text-white">£{vatBreakdown.priceExcludingVat.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Items List - Mobile Optimized */}
              {items.length > 0 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base sm:text-lg font-semibold">Found {items.length} items</h3>
                    <button
                      onClick={addItem}
                      className="flex items-center gap-1 sm:gap-2 bg-gray-700 hover:bg-gray-600 text-white px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm"
                    >
                      <SafeIcon icon={FiPlus} className="h-3 w-3 sm:h-4 sm:w-4" />
                      Add Item
                    </button>
                  </div>

                  <div className="space-y-3 max-h-60 sm:max-h-80 overflow-y-auto">
                    {items.map((item, index) => (
                      <div key={index} className="bg-gray-800 p-3 sm:p-4 rounded-lg">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-center">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateItem(index, 'name', e.target.value)}
                            placeholder="Item name"
                            className="bg-gray-700 text-white rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 border-none text-sm"
                          />
                          <div className="grid grid-cols-2 gap-2 sm:contents">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                              placeholder="Qty"
                              className="bg-gray-700 text-white rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 border-none text-sm"
                            />
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.price}
                              onChange={(e) => updateItem(index, 'price', e.target.value)}
                              placeholder="Price"
                              className="bg-gray-700 text-white rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 border-none text-sm"
                            />
                          </div>
                          <button
                            onClick={() => removeItem(index)}
                            className="text-red-400 hover:text-red-300 p-2 self-center justify-self-center sm:justify-self-auto"
                          >
                            <SafeIcon icon={FiTrash2} className="h-4 w-4 sm:h-5 sm:w-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => setItems([])}
                      className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg text-sm"
                      disabled={isSaving}
                    >
                      Clear All
                    </button>
                    <button
                      onClick={saveItems}
                      disabled={isSaving || !user}
                      className="bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      <SafeIcon icon={FiSave} className="h-4 w-4" />
                      {isSaving ? 'Saving...' : `Save ${items.length} Items & Receipt`}
                    </button>
                  </div>

                  {/* Receipt History Notice */}
                  {imageFile && user && (
                    <div className="bg-green-900/30 border border-green-700 rounded-lg p-3">
                      <p className="text-green-200 text-xs sm:text-sm">
                        📸 <strong>Receipt will be saved to your history</strong> along with the extracted items for future reference.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Try Again */}
              {!isScanning && !isSaving && (
                <div className="text-center">
                  <button
                    onClick={() => setImage(null)}
                    className="text-blue-400 hover:text-blue-300 text-xs sm:text-sm"
                  >
                    Try different image
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 p-3 sm:p-4 rounded-lg mt-4">
              <p className="text-xs sm:text-sm">{error}</p>
            </div>
          )}

          {/* Status Message */}
          {status && !error && !isScanning && !isSaving && (
            <div className="bg-green-900/50 border border-green-700 text-green-200 p-3 sm:p-4 rounded-lg mt-4">
              <p className="text-xs sm:text-sm">{status}</p>
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