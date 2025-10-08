import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RiCameraLine, RiCloseLine, RiScanLine, RiImageLine, RiRefreshLine, 
  RiCheckLine, RiAlertLine, RiSettings3Line, RiEditLine, RiLightbulbLine,
  RiZoomInLine, RiZoomOutLine, RiRotateClockwiseLine, RiContrastLine
} from 'react-icons/ri';
import Webcam from 'react-webcam';
import Tesseract from 'tesseract.js';

export default function ReceiptScannerModal({ isOpen, onClose, onItemsExtracted }) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [capturedImage, setCapturedImage] = useState(null);
  const [extractedItems, setExtractedItems] = useState([]);
  const [scanStatus, setScanStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [useFileUpload, setUseFileUpload] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const [rawOcrText, setRawOcrText] = useState('');
  const [scanSettings, setScanSettings] = useState({
    language: 'eng',
    enhanceImage: true,
    adaptiveMode: true, // Smart switching between speed and accuracy
    dualPass: false, // Only when needed
    minPrice: 0.01,
    maxPrice: 2000,
    smartFiltering: true,
    autoRotate: true,
    contrastBoost: true
  });
  const [showSettings, setShowSettings] = useState(false);
  const [editingItems, setEditingItems] = useState(false);
  const [imagePreprocessing, setImagePreprocessing] = useState('auto');

  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  // Optimized video constraints for best quality/speed balance
  const videoConstraints = {
    width: { min: 1280, ideal: 1920, max: 2560 },
    height: { min: 720, ideal: 1080, max: 1440 },
    facingMode: { ideal: 'environment' },
    focusMode: 'continuous',
    whiteBalanceMode: 'continuous',
    exposureMode: 'continuous'
  };

  // Advanced image preprocessing with multiple techniques
  const preprocessImageAdvanced = async (imageSrc, options = {}) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Optimal scaling for OCR accuracy
        const scale = options.highQuality ? 2.0 : 1.5;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        if (scanSettings.enhanceImage) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Advanced image enhancement pipeline
          enhanceImageData(data, {
            contrast: scanSettings.contrastBoost ? 1.4 : 1.2,
            brightness: 15,
            sharpening: true,
            denoising: options.highQuality
          });
          
          ctx.putImageData(imageData, 0, 0);
        }
        
        // Auto-rotation detection and correction
        if (scanSettings.autoRotate && options.detectRotation) {
          const rotatedCanvas = detectAndCorrectRotation(canvas);
          resolve(rotatedCanvas.toDataURL('image/jpeg', 0.95));
        } else {
          resolve(canvas.toDataURL('image/jpeg', 0.92));
        }
      };
      img.src = imageSrc;
    });
  };

  // Advanced image enhancement with multiple filters
  const enhanceImageData = (data, options) => {
    const { contrast, brightness, sharpening, denoising } = options;
    
    // First pass: Basic enhancement
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Convert to grayscale with optimal weights for text
      const gray = r * 0.299 + g * 0.587 + b * 0.114;
      
      // Apply contrast and brightness
      let enhanced = (gray - 128) * contrast + 128 + brightness;
      enhanced = Math.min(255, Math.max(0, enhanced));
      
      // Apply threshold for better text clarity
      if (enhanced > 180) enhanced = 255;
      else if (enhanced < 75) enhanced = 0;
      else enhanced = enhanced > 127 ? 255 : 0;
      
      data[i] = enhanced;
      data[i + 1] = enhanced;
      data[i + 2] = enhanced;
    }
    
    // Optional: Denoising for high-quality mode
    if (denoising) {
      applyDenoising(data);
    }
  };

  // Simple denoising filter
  const applyDenoising = (data) => {
    // Median filter implementation for noise reduction
    const width = Math.sqrt(data.length / 4);
    const temp = new Uint8ClampedArray(data);
    
    for (let i = 4; i < data.length - 4; i += 4) {
      const neighbors = [
        temp[i - 4], temp[i], temp[i + 4],
        temp[i - width * 4], temp[i + width * 4]
      ].sort((a, b) => a - b);
      
      const median = neighbors[Math.floor(neighbors.length / 2)];
      data[i] = data[i + 1] = data[i + 2] = median;
    }
  };

  // Auto-rotation detection (simplified)
  const detectAndCorrectRotation = (canvas) => {
    // For now, return original canvas
    // In production, you'd implement Hough line detection
    return canvas;
  };

  const capture = useCallback(async () => {
    const imageSrc = webcamRef.current.getScreenshot({
      width: 1920,
      height: 1080
    });
    setCapturedImage(imageSrc);
    processReceiptSmart(imageSrc);
  }, [webcamRef]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageSrc = e.target.result;
        setCapturedImage(imageSrc);
        processReceiptSmart(imageSrc);
      };
      reader.readAsDataURL(file);
    }
  };

  // Smart OCR processing with adaptive quality
  const processReceiptSmart = async (imageSrc) => {
    setIsScanning(true);
    setScanStatus('scanning');
    setScanProgress(0);
    setErrorMessage('');
    setRawOcrText('');

    try {
      let ocrText = '';
      let items = [];
      
      setScanProgress(10);
      
      // First attempt: Fast processing
      const fastResult = await performFastOCR(imageSrc);
      setScanProgress(50);
      
      ocrText = fastResult.text;
      items = parseReceiptTextAdvanced(ocrText);
      
      // Adaptive quality: If few items found, try enhanced processing
      if (scanSettings.adaptiveMode && items.length < 3) {
        setScanProgress(60);
        const enhancedResult = await performEnhancedOCR(imageSrc);
        setScanProgress(85);
        
        const enhancedItems = parseReceiptTextAdvanced(enhancedResult.text);
        if (enhancedItems.length > items.length) {
          ocrText = enhancedResult.text;
          items = enhancedItems;
        }
      }
      
      setScanProgress(95);
      setRawOcrText(ocrText);
      
      // Final validation and cleanup
      items = validateAndCleanItems(items);
      
      setScanProgress(100);
      
      if (items.length > 0) {
        setExtractedItems(items);
        setScanStatus('success');
      } else {
        setScanStatus('error');
        setErrorMessage('No valid items detected. Try adjusting lighting or image angle.');
      }
    } catch (error) {
      console.error('OCR Error:', error);
      setScanStatus('error');
      setErrorMessage('Processing failed. Please try with a clearer image.');
    } finally {
      setIsScanning(false);
      setScanProgress(0);
    }
  };

  // Fast OCR pass for speed
  const performFastOCR = async (imageSrc) => {
    const processedImage = await preprocessImageAdvanced(imageSrc, { 
      highQuality: false, 
      detectRotation: false 
    });
    
    return await Tesseract.recognize(processedImage, scanSettings.language, {
      logger: m => {
        if (m.status === 'recognizing text') {
          setScanProgress(10 + (m.progress * 40));
        }
      },
      tessedit_pageseg_mode: Tesseract.PSM.AUTO_OSD,
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,£$€¥₹@#%&*()x×X -+=[]{}|\\:";\'<>?/_ \n\t',
      preserve_interword_spaces: '1',
      tessedit_do_invert: '0'
    });
  };

  // Enhanced OCR pass for accuracy
  const performEnhancedOCR = async (imageSrc) => {
    const processedImage = await preprocessImageAdvanced(imageSrc, { 
      highQuality: true, 
      detectRotation: true 
    });
    
    return await Tesseract.recognize(processedImage, scanSettings.language, {
      logger: m => {
        if (m.status === 'recognizing text') {
          setScanProgress(60 + (m.progress * 25));
        }
      },
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,£$€¥₹@#%&*()x×X -+=[]{}|\\:";\'<>?/_ \n\t',
      preserve_interword_spaces: '1',
      tessedit_do_invert: '0',
      tessedit_ocr_engine_mode: '2' // Use LSTM OCR engine
    });
  };

  // Advanced text parsing with multiple strategies
  const parseReceiptTextAdvanced = (text) => {
    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 1 && line.length < 100);
    
    const items = [];
    
    // Multiple parsing strategies
    const strategies = [
      parseWithRegexPatterns,
      parseWithContextualAnalysis,
      parseWithPriceAlignment
    ];
    
    for (const strategy of strategies) {
      const strategyItems = strategy(lines);
      
      // Merge unique items
      strategyItems.forEach(newItem => {
        const exists = items.find(existing => 
          existing.name.toLowerCase().replace(/\s+/g, '') === 
          newItem.name.toLowerCase().replace(/\s+/g, '')
        );
        
        if (!exists) {
          items.push(newItem);
        }
      });
    }
    
    return items;
  };

  // Strategy 1: Advanced regex patterns
  const parseWithRegexPatterns = (lines) => {
    const items = [];
    
    const advancedPatterns = [
      // Quantity x Item Price pattern
      /^(\d+)\s*[xX×*]\s*(.{2,50}?)\s+([£$€¥₹]?\s*\d+[.,]\d{2})$/,
      // Item followed by price on same line
      /^([A-Za-z][\w\s&'.-]{1,50})\s+([£$€¥₹]?\s*\d+[.,]\d{2})\s*$/,
      // Price at end of line
      /^(.{2,50}?)\s+(\d+[.,]\d{2})\s*([£$€¥₹]?)$/,
      // Item code followed by description and price
      /^\d{4,}\s+(.{2,40}?)\s+([£$€¥₹]?\s*\d+[.,]\d{2})$/
    ];
    
    const skipPatterns = [
      /total|subtotal|tax|vat|change|cash|card|receipt|thank|welcome|date|time|store|address|phone/i,
      /^\*+$|^-+$|^=+$|^\d+$/,
      /^\s*$|^[^a-zA-Z]*$/
    ];
    
    for (const line of lines) {
      if (skipPatterns.some(pattern => pattern.test(line))) continue;
      
      for (const pattern of advancedPatterns) {
        const match = line.match(pattern);
        if (match) {
          let itemName, priceStr, quantity = 1;
          
          if (match.length >= 4 && /^\d+$/.test(match[1])) {
            // Quantity pattern
            quantity = parseInt(match[1]);
            itemName = match[2];
            priceStr = match[3];
          } else {
            itemName = match[1];
            priceStr = match[2] + (match[3] || '');
          }
          
          const price = extractPriceAdvanced(priceStr);
          if (isValidPrice(price) && isValidItemName(itemName)) {
            const unitPrice = quantity > 1 ? price / quantity : price;
            items.push(createInventoryItem(itemName, unitPrice, quantity));
            break;
          }
        }
      }
    }
    
    return items;
  };

  // Strategy 2: Contextual analysis
  const parseWithContextualAnalysis = (lines) => {
    const items = [];
    
    for (let i = 0; i < lines.length - 1; i++) {
      const currentLine = lines[i];
      const nextLine = lines[i + 1];
      
      // Skip obvious non-items
      if (!/[a-zA-Z]/.test(currentLine) || currentLine.length < 2) continue;
      
      const currentPrice = findPriceInLine(currentLine);
      const nextPrice = findPriceInLine(nextLine);
      
      // If current line has item-like text and next line has price
      if (!currentPrice && nextPrice && isValidItemName(currentLine)) {
        if (isValidPrice(nextPrice)) {
          items.push(createInventoryItem(currentLine, nextPrice, 1));
          i++; // Skip next line
        }
      }
    }
    
    return items;
  };

  // Strategy 3: Price alignment analysis
  const parseWithPriceAlignment = (lines) => {
    const items = [];
    const pricePositions = [];
    
    // Find common price positions
    lines.forEach((line, index) => {
      const priceMatch = line.match(/(\d+[.,]\d{2})/g);
      if (priceMatch) {
        priceMatch.forEach(price => {
          const position = line.lastIndexOf(price);
          pricePositions.push({ index, position, price });
        });
      }
    });
    
    // Group by similar positions (receipt columns)
    const columns = groupByPosition(pricePositions);
    
    // Extract items based on column alignment
    columns.forEach(column => {
      column.forEach(({ index, price }) => {
        const line = lines[index];
        const pricePos = line.lastIndexOf(price);
        const itemText = line.substring(0, pricePos).trim();
        
        if (isValidItemName(itemText)) {
          const priceValue = extractPriceAdvanced(price);
          if (isValidPrice(priceValue)) {
            items.push(createInventoryItem(itemText, priceValue, 1));
          }
        }
      });
    });
    
    return items;
  };

  // Helper functions
  const groupByPosition = (positions) => {
    const groups = [];
    const tolerance = 20; // Position tolerance
    
    positions.forEach(pos => {
      let found = false;
      for (const group of groups) {
        if (Math.abs(group[0].position - pos.position) <= tolerance) {
          group.push(pos);
          found = true;
          break;
        }
      }
      if (!found) {
        groups.push([pos]);
      }
    });
    
    return groups.filter(group => group.length > 1);
  };

  const extractPriceAdvanced = (priceStr) => {
    if (!priceStr) return null;
    
    // Remove currency symbols and clean
    const cleaned = priceStr.replace(/[£$€¥₹\s]/g, '');
    
    // Handle different decimal separators
    let normalized = cleaned;
    if (normalized.includes(',') && normalized.includes('.')) {
      // European format: 1.234,56
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else if (normalized.includes(',')) {
      // Could be decimal comma: 12,34
      if (normalized.split(',')[1]?.length === 2) {
        normalized = normalized.replace(',', '.');
      }
    }
    
    const number = parseFloat(normalized);
    return isNaN(number) ? null : number;
  };

  const findPriceInLine = (line) => {
    const pricePatterns = [
      /([£$€¥₹])\s*(\d+[.,]\d{2})/,
      /(\d+[.,]\d{2})\s*([£$€¥₹]?)/,
      /(\d+\.\d{2})/
    ];
    
    for (const pattern of pricePatterns) {
      const match = line.match(pattern);
      if (match) {
        return extractPriceAdvanced(match[0]);
      }
    }
    return null;
  };

  const isValidPrice = (price) => {
    return price && 
           !isNaN(price) && 
           price > 0 && 
           price >= scanSettings.minPrice && 
           price <= scanSettings.maxPrice;
  };

  const isValidItemName = (name) => {
    if (!name || typeof name !== 'string') return false;
    
    const cleaned = name.trim();
    if (cleaned.length < 2 || cleaned.length > 80) return false;
    if (!/[A-Za-z]/.test(cleaned)) return false;
    if (/^\d+$/.test(cleaned)) return false;
    
    // Advanced non-item detection
    const nonItemPatterns = [
      /^(total|subtotal|tax|vat|change|cash|card|receipt|thank|welcome|store|address|phone|date|time)/i,
      /^[^a-zA-Z]*$/,
      /^\d+[.,]\d{2}$/,
      /^[*-=]+$/
    ];
    
    return !nonItemPatterns.some(pattern => pattern.test(cleaned));
  };

  const validateAndCleanItems = (items) => {
    return items
      .filter(item => item && item.name && item.unitPrice)
      .map(item => ({
        ...item,
        name: cleanItemName(item.name),
        unitPrice: Math.round(item.unitPrice * 100) / 100 // Round to 2 decimals
      }))
      .filter((item, index, self) => 
        index === self.findIndex(t => 
          t.name.toLowerCase().replace(/\s+/g, '') === item.name.toLowerCase().replace(/\s+/g, '')
        )
      )
      .slice(0, 30); // Reasonable limit
  };

  const cleanItemName = (name) => {
    return name
      .replace(/[^\w\s&'.-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const createInventoryItem = (name, price, quantity = 1) => {
    const cleanName = cleanItemName(name);
    
    return {
      name: cleanName,
      unitPrice: price,
      quantity: quantity,
      category: guessCategoryAdvanced(cleanName),
      dateAdded: new Date().toISOString().split('T')[0],
      status: 'In Stock',
      description: `Scanned on ${new Date().toLocaleDateString()}`
    };
  };

  const guessCategoryAdvanced = (itemName) => {
    const name = itemName.toLowerCase();
    
    const categoryMap = {
      'Food & Beverages': [
        'bread', 'milk', 'cheese', 'meat', 'chicken', 'beef', 'pork', 'fish',
        'fruit', 'apple', 'banana', 'orange', 'grape', 'berry', 'vegetable',
        'potato', 'tomato', 'onion', 'carrot', 'lettuce', 'juice', 'coffee',
        'tea', 'water', 'soda', 'beer', 'wine', 'yogurt', 'butter', 'egg',
        'rice', 'pasta', 'cereal', 'snack', 'chocolate', 'candy', 'cookie'
      ],
      'Health & Beauty': [
        'shampoo', 'conditioner', 'soap', 'cream', 'lotion', 'medicine',
        'vitamin', 'toothpaste', 'toothbrush', 'deodorant', 'perfume',
        'makeup', 'lipstick', 'mascara', 'sunscreen', 'bandage'
      ],
      'Household': [
        'detergent', 'cleaner', 'tissue', 'paper', 'towel', 'bag', 'foil',
        'wrap', 'sponge', 'brush', 'vacuum', 'bulb', 'battery', 'candle'
      ],
      'Electronics': [
        'phone', 'charger', 'cable', 'headphone', 'speaker', 'computer',
        'tablet', 'camera', 'watch', 'remote', 'adapter'
      ],
      'Clothing': [
        'shirt', 'pants', 'dress', 'shoe', 'sock', 'underwear', 'jacket',
        'coat', 'hat', 'glove', 'scarf', 'belt', 'tie'
      ],
      'Office Supplies': [
        'pen', 'pencil', 'paper', 'notebook', 'folder', 'stapler', 'clip',
        'tape', 'glue', 'marker', 'ruler', 'calculator', 'envelope'
      ]
    };
    
    for (const [category, keywords] of Object.entries(categoryMap)) {
      if (keywords.some(keyword => name.includes(keyword))) {
        return category;
      }
    }
    
    return 'Other';
  };

  const handleEditItem = (index, field, value) => {
    const updatedItems = [...extractedItems];
    if (field === 'unitPrice') {
      updatedItems[index][field] = parseFloat(value) || 0;
    } else {
      updatedItems[index][field] = value;
    }
    setExtractedItems(updatedItems);
  };

  const handleRemoveItem = (index) => {
    const updatedItems = extractedItems.filter((_, i) => i !== index);
    setExtractedItems(updatedItems);
  };

  const handleConfirmItems = () => {
    onItemsExtracted(extractedItems, capturedImage);
    handleClose();
  };

  const handleClose = () => {
    setCapturedImage(null);
    setExtractedItems([]);
    setScanStatus('idle');
    setIsScanning(false);
    setScanProgress(0);
    setErrorMessage('');
    setUseFileUpload(false);
    setShowSettings(false);
    setEditingItems(false);
    setShowRawText(false);
    setRawOcrText('');
    onClose();
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setExtractedItems([]);
    setScanStatus('idle');
    setErrorMessage('');
    setShowRawText(false);
    setRawOcrText('');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-90"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-6xl bg-gray-800 rounded-lg shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div className="flex items-center">
                <RiScanLine className="h-6 w-6 text-primary-400 mr-2" />
                <h3 className="text-lg font-medium text-white">Smart Receipt Scanner</h3>
                <div className="flex ml-3 space-x-2">
                  <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                    AI Enhanced
                  </span>
                  <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                    High Accuracy
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-gray-400 hover:text-gray-300 focus:outline-none p-2"
                  title="Scanner Settings"
                >
                  <RiSettings3Line className="h-5 w-5" />
                </button>
                {rawOcrText && (
                  <button
                    onClick={() => setShowRawText(!showRawText)}
                    className="text-gray-400 hover:text-gray-300 focus:outline-none p-2"
                    title="Show OCR Text"
                  >
                    <RiEditLine className="h-5 w-5" />
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-300 focus:outline-none"
                >
                  <RiCloseLine className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Advanced Settings Panel */}
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-b border-gray-700 p-4 bg-gray-750"
              >
                <h4 className="text-white font-medium mb-3">🎯 Advanced Scanner Settings</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-3">
                    <h5 className="text-primary-400 font-medium">Processing Mode</h5>
                    <label className="flex items-center text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={scanSettings.adaptiveMode}
                        onChange={(e) => setScanSettings(prev => ({ ...prev, adaptiveMode: e.target.checked }))}
                        className="mr-2 rounded border-gray-600 bg-gray-700 text-primary-600"
                      />
                      Adaptive Quality (Smart speed/accuracy balance)
                    </label>
                    <label className="flex items-center text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={scanSettings.enhanceImage}
                        onChange={(e) => setScanSettings(prev => ({ ...prev, enhanceImage: e.target.checked }))}
                        className="mr-2 rounded border-gray-600 bg-gray-700 text-primary-600"
                      />
                      Advanced image enhancement
                    </label>
                    <label className="flex items-center text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={scanSettings.autoRotate}
                        onChange={(e) => setScanSettings(prev => ({ ...prev, autoRotate: e.target.checked }))}
                        className="mr-2 rounded border-gray-600 bg-gray-700 text-primary-600"
                      />
                      Auto-rotation correction
                    </label>
                    <label className="flex items-center text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={scanSettings.contrastBoost}
                        onChange={(e) => setScanSettings(prev => ({ ...prev, contrastBoost: e.target.checked }))}
                        className="mr-2 rounded border-gray-600 bg-gray-700 text-primary-600"
                      />
                      High contrast boost
                    </label>
                  </div>
                  <div className="space-y-3">
                    <h5 className="text-primary-400 font-medium">Price Filters</h5>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Min Price (£)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={scanSettings.minPrice}
                        onChange={(e) => setScanSettings(prev => ({ ...prev, minPrice: parseFloat(e.target.value) || 0 }))}
                        className="w-full rounded-md border-gray-600 bg-gray-700 text-white text-sm p-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Max Price (£)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={scanSettings.maxPrice}
                        onChange={(e) => setScanSettings(prev => ({ ...prev, maxPrice: parseFloat(e.target.value) || 2000 }))}
                        className="w-full rounded-md border-gray-600 bg-gray-700 text-white text-sm p-2"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3">
                      <h5 className="text-blue-400 font-medium mb-2">🚀 AI Features</h5>
                      <ul className="text-blue-300 text-xs space-y-1">
                        <li>• Multi-strategy text parsing</li>
                        <li>• Contextual item recognition</li>
                        <li>• Price alignment analysis</li>
                        <li>• Smart category detection</li>
                        <li>• Advanced image preprocessing</li>
                        <li>• Adaptive quality switching</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Raw OCR Text Panel */}
            {showRawText && rawOcrText && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-b border-gray-700 p-4 bg-gray-750 max-h-64 overflow-y-auto"
              >
                <h4 className="text-white font-medium mb-3">📄 OCR Text Output</h4>
                <pre className="text-xs text-gray-300 whitespace-pre-wrap bg-gray-800 p-3 rounded">
                  {rawOcrText}
                </pre>
              </motion.div>
            )}

            {/* Content */}
            <div className="p-6">
              {!capturedImage ? (
                <div className="space-y-6">
                  {/* Scanner Mode Toggle */}
                  <div className="flex justify-center space-x-4">
                    <button
                      onClick={() => setUseFileUpload(false)}
                      className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                        !useFileUpload 
                          ? 'bg-primary-600 text-white' 
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      <RiCameraLine className="h-5 w-5 mr-2" />
                      HD Camera
                    </button>
                    <button
                      onClick={() => setUseFileUpload(true)}
                      className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                        useFileUpload 
                          ? 'bg-primary-600 text-white' 
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      <RiImageLine className="h-5 w-5 mr-2" />
                      Upload Image
                    </button>
                  </div>

                  {/* Camera View */}
                  {!useFileUpload ? (
                    <div className="space-y-4">
                      <div className="relative bg-black rounded-lg overflow-hidden">
                        <Webcam
                          audio={false}
                          ref={webcamRef}
                          screenshotFormat="image/jpeg"
                          screenshotQuality={0.95}
                          videoConstraints={videoConstraints}
                          className="w-full h-auto max-h-96 object-cover"
                        />
                        <div className="absolute inset-0 border-2 border-dashed border-primary-400 m-4 rounded-lg pointer-events-none">
                          <div className="absolute top-2 left-2 right-2 text-center">
                            <span className="bg-black bg-opacity-50 text-white text-sm px-2 py-1 rounded">
                              🎯 Position receipt clearly - AI will enhance and analyze automatically
                            </span>
                          </div>
                          <div className="absolute bottom-2 left-2 right-2 text-center">
                            <span className="bg-black bg-opacity-50 text-green-400 text-xs px-2 py-1 rounded">
                              ✨ Smart processing enabled: Fast scan with accuracy fallback
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-center">
                        <button
                          onClick={capture}
                          disabled={isScanning}
                          className="flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RiScanLine className="h-5 w-5 mr-2" />
                          Smart Capture
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* File Upload */
                    <div className="space-y-4">
                      <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
                        <RiImageLine className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-white mb-4">Upload receipt for AI-powered analysis</p>
                        <p className="text-gray-400 text-sm mb-4">JPG, PNG, WebP up to 10MB - High resolution preferred</p>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          accept="image/*"
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isScanning}
                          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                        >
                          <RiImageLine className="h-5 w-5 mr-2" />
                          Choose Image
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Pro Tips */}
                  <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-700 rounded-lg p-4">
                    <h4 className="text-blue-400 font-medium mb-3">🎯 Pro Scanning Tips:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-300">
                      <ul className="space-y-1">
                        <li>• 📸 Use bright, even lighting</li>
                        <li>• 📏 Keep receipt flat and straight</li>
                        <li>• 🔍 Ensure all text is clearly visible</li>
                        <li>• 📱 Hold camera steady</li>
                      </ul>
                      <ul className="space-y-1">
                        <li>• 🤖 AI will auto-enhance image quality</li>
                        <li>• ⚡ Fast processing with accuracy backup</li>
                        <li>• 🎯 Multiple parsing strategies</li>
                        <li>• ✏️ Review and edit results before adding</li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                /* Results View */
                <div className="space-y-6">
                  {/* Captured Image */}
                  <div className="flex justify-center">
                    <img
                      src={capturedImage}
                      alt="Captured receipt"
                      className="max-w-full max-h-64 object-contain rounded-lg border border-gray-600"
                    />
                  </div>

                  {/* Scanning Progress */}
                  {isScanning && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center">
                        <RiScanLine className="h-6 w-6 text-primary-400 mr-2 animate-pulse" />
                        <span className="text-white">
                          {scanProgress < 50 
                            ? '🚀 Fast processing...' 
                            : scanProgress < 85 
                            ? '🎯 Enhanced analysis...' 
                            : '✨ Finalizing results...'}
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-3">
                        <div 
                          className="bg-gradient-to-r from-primary-600 to-blue-600 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${scanProgress}%` }}
                        />
                      </div>
                      <p className="text-center text-gray-300 text-sm">
                        {scanProgress}% complete
                        {scanSettings.adaptiveMode && scanProgress > 60 && (
                          <span className="ml-2 text-yellow-400">
                            🎯 Enhanced mode activated
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Scan Results */}
                  {scanStatus === 'success' && extractedItems.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-green-400">
                          <RiCheckLine className="h-6 w-6 mr-2" />
                          <span className="font-medium">
                            🎉 Successfully extracted {extractedItems.length} items!
                          </span>
                        </div>
                        <button
                          onClick={() => setEditingItems(!editingItems)}
                          className="flex items-center px-3 py-1 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm"
                        >
                          <RiEditLine className="h-4 w-4 mr-1" />
                          {editingItems ? 'Done Editing' : 'Edit Items'}
                        </button>
                      </div>

                      <div className="bg-gray-700 rounded-lg p-4 max-h-96 overflow-y-auto">
                        <div className="space-y-3">
                          {extractedItems.map((item, index) => (
                            <div key={index} className="bg-gray-800 rounded p-3">
                              {editingItems ? (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                  <div>
                                    <label className="block text-xs text-gray-400 mb-1">Item Name</label>
                                    <input
                                      type="text"
                                      value={item.name}
                                      onChange={(e) => handleEditItem(index, 'name', e.target.value)}
                                      className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-400 mb-1">Price (£)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.unitPrice}
                                      onChange={(e) => handleEditItem(index, 'unitPrice', e.target.value)}
                                      className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-400 mb-1">Category</label>
                                    <select
                                      value={item.category}
                                      onChange={(e) => handleEditItem(index, 'category', e.target.value)}
                                      className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                                    >
                                      <option value="Food & Beverages">🍎 Food & Beverages</option>
                                      <option value="Health & Beauty">💄 Health & Beauty</option>
                                      <option value="Household">🏠 Household</option>
                                      <option value="Electronics">📱 Electronics</option>
                                      <option value="Clothing">👕 Clothing</option>
                                      <option value="Office Supplies">📎 Office Supplies</option>
                                      <option value="Other">📦 Other</option>
                                    </select>
                                  </div>
                                  <div className="flex items-end">
                                    <button
                                      onClick={() => handleRemoveItem(index)}
                                      className="px-2 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex justify-between items-center">
                                  <div className="flex-1">
                                    <div className="flex items-center">
                                      <span className="text-white font-medium">{item.name}</span>
                                      <span className="text-gray-400 text-sm ml-2">({item.category})</span>
                                      {item.quantity > 1 && (
                                        <span className="text-primary-400 text-sm ml-2">Qty: {item.quantity}</span>
                                      )}
                                    </div>
                                    {item.description && (
                                      <p className="text-gray-400 text-xs mt-1">{item.description}</p>
                                    )}
                                  </div>
                                  <span className="text-primary-400 font-medium ml-4">
                                    £{item.unitPrice.toFixed(2)}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Error State */}
                  {scanStatus === 'error' && (
                    <div className="text-center space-y-4">
                      <div className="flex items-center justify-center text-red-400">
                        <RiAlertLine className="h-6 w-6 mr-2" />
                        <span className="font-medium">Scan Analysis Failed</span>
                      </div>
                      <p className="text-gray-300">{errorMessage}</p>
                      <div className="text-sm text-gray-400 bg-gray-700 rounded-lg p-4">
                        <p className="font-medium mb-2">💡 Troubleshooting tips:</p>
                        <ul className="list-disc list-inside space-y-1 text-left">
                          <li>Ensure receipt has clear, readable text</li>
                          <li>Try better lighting or different angle</li>
                          <li>Enable "Advanced image enhancement" in settings</li>
                          <li>Check if prices are clearly visible</li>
                          <li>Review the OCR text output for debugging</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-center space-x-4">
                    <button
                      onClick={retakePhoto}
                      className="flex items-center px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                      <RiRefreshLine className="h-5 w-5 mr-2" />
                      Try Again
                    </button>
                    {scanStatus === 'success' && extractedItems.length > 0 && (
                      <button
                        onClick={handleConfirmItems}
                        className="flex items-center px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <RiCheckLine className="h-5 w-5 mr-2" />
                        Add {extractedItems.length} Items
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}