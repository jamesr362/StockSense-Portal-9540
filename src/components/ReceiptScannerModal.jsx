import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RiCameraLine, RiCloseLine, RiScanLine, RiImageLine, RiRefreshLine, RiCheckLine, RiAlertLine, RiSettings3Line, RiEditLine } from 'react-icons/ri';
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
    multiPass: true,
    aggressiveParsing: true,
    minPrice: 0.01,
    maxPrice: 2000,
    minConfidence: 30
  });
  const [showSettings, setShowSettings] = useState(false);
  const [editingItems, setEditingItems] = useState(false);
  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Ultra-enhanced video constraints
  const videoConstraints = {
    width: { min: 1280, ideal: 1920, max: 4096 },
    height: { min: 720, ideal: 1080, max: 2160 },
    facingMode: { ideal: 'environment' },
    focusMode: 'continuous',
    whiteBalanceMode: 'continuous',
    exposureMode: 'continuous'
  };

  // Advanced image preprocessing
  const preprocessImage = async (imageSrc, enhanceLevel = 'standard') => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Increase canvas size for better quality
        const scale = enhanceLevel === 'aggressive' ? 2 : 1.5;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        // Enable image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw scaled image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        if (scanSettings.enhanceImage) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Advanced image enhancement
          for (let i = 0; i < data.length; i += 4) {
            // Convert to grayscale with better weights
            const gray = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
            
            // Apply gamma correction
            const gamma = 1.2;
            const corrected = 255 * Math.pow(gray / 255, 1 / gamma);
            
            // Enhanced contrast and brightness
            const contrast = enhanceLevel === 'aggressive' ? 1.8 : 1.5;
            const brightness = enhanceLevel === 'aggressive' ? 20 : 10;
            let enhanced = (corrected - 128) * contrast + 128 + brightness;
            
            // Adaptive thresholding based on local context
            const threshold = enhanceLevel === 'aggressive' ? 150 : 140;
            enhanced = enhanced > threshold ? 255 : 0;
            
            // Apply noise reduction for aggressive enhancement
            if (enhanceLevel === 'aggressive') {
              // Check surrounding pixels for noise reduction
              const x = (i / 4) % canvas.width;
              const y = Math.floor((i / 4) / canvas.width);
              if (x > 0 && x < canvas.width - 1 && y > 0 && y < canvas.height - 1) {
                // Simple median filter for noise reduction
                const surroundingPixels = [];
                for (let dx = -1; dx <= 1; dx++) {
                  for (let dy = -1; dy <= 1; dy++) {
                    const neighborIndex = ((y + dy) * canvas.width + (x + dx)) * 4;
                    if (neighborIndex >= 0 && neighborIndex < data.length) {
                      surroundingPixels.push(data[neighborIndex]);
                    }
                  }
                }
                surroundingPixels.sort((a, b) => a - b);
                const median = surroundingPixels[Math.floor(surroundingPixels.length / 2)];
                enhanced = median > threshold ? 255 : 0;
              }
            }
            
            data[i] = enhanced;     // Red
            data[i + 1] = enhanced; // Green  
            data[i + 2] = enhanced; // Blue
            // Alpha remains unchanged
          }
          
          ctx.putImageData(imageData, 0, 0);
        }
        
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      img.src = imageSrc;
    });
  };

  const capture = useCallback(async () => {
    const imageSrc = webcamRef.current.getScreenshot();
    setCapturedImage(imageSrc);
    processReceipt(imageSrc);
  }, [webcamRef]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageSrc = e.target.result;
        setCapturedImage(imageSrc);
        processReceipt(imageSrc);
      };
      reader.readAsDataURL(file);
    }
  };

  const processReceipt = async (imageSrc) => {
    setIsScanning(true);
    setScanStatus('scanning');
    setScanProgress(0);
    setErrorMessage('');
    setRawOcrText('');

    try {
      let allText = '';
      let bestResult = null;
      let maxConfidence = 0;

      // Multi-pass OCR for better accuracy
      if (scanSettings.multiPass) {
        const passes = [
          { enhance: 'none', psm: Tesseract.PSM.AUTO },
          { enhance: 'standard', psm: Tesseract.PSM.SINGLE_BLOCK },
          { enhance: 'standard', psm: Tesseract.PSM.SINGLE_COLUMN },
          { enhance: 'aggressive', psm: Tesseract.PSM.SPARSE_TEXT }
        ];

        for (let i = 0; i < passes.length; i++) {
          const pass = passes[i];
          setScanProgress(Math.round((i / passes.length) * 80));
          
          try {
            const processedImage = pass.enhance !== 'none' 
              ? await preprocessImage(imageSrc, pass.enhance)
              : imageSrc;

            const result = await Tesseract.recognize(
              processedImage,
              scanSettings.language,
              {
                logger: m => {
                  if (m.status === 'recognizing text') {
                    const passProgress = (i / passes.length) * 80 + (m.progress * 20 / passes.length);
                    setScanProgress(Math.round(passProgress));
                  }
                },
                tessedit_pageseg_mode: pass.psm,
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,£$€¥₹@#%&*()-+=[]{}|\\:";\'<>?/_ ',
                preserve_interword_spaces: '1',
                tessedit_do_invert: '0',
                classify_bln_numeric_mode: '0'
              }
            );

            allText += result.data.text + '\n---PASS-SEPARATOR---\n';
            
            // Check if this pass has better confidence
            if (result.data.confidence > maxConfidence) {
              maxConfidence = result.data.confidence;
              bestResult = result.data.text;
            }
          } catch (passError) {
            console.warn(`OCR pass ${i + 1} failed:`, passError);
          }
        }
      } else {
        // Single pass OCR
        const processedImage = scanSettings.enhanceImage 
          ? await preprocessImage(imageSrc, 'standard')
          : imageSrc;

        const result = await Tesseract.recognize(
          processedImage,
          scanSettings.language,
          {
            logger: m => {
              if (m.status === 'recognizing text') {
                setScanProgress(Math.round(m.progress * 80));
              }
            },
            tessedit_pageseg_mode: Tesseract.PSM.AUTO,
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,£$€¥₹@#%&*()-+=[]{}|\\:";\'<>?/_ ',
            preserve_interword_spaces: '1'
          }
        );

        allText = result.data.text;
        bestResult = result.data.text;
      }

      setScanProgress(90);
      setRawOcrText(allText);

      // Use the best result for parsing
      const items = parseReceiptTextUltraEnhanced(bestResult || allText);
      
      setScanProgress(100);

      if (items.length > 0) {
        setExtractedItems(items);
        setScanStatus('success');
      } else {
        setScanStatus('error');
        setErrorMessage(`No items found. OCR confidence: ${maxConfidence.toFixed(1)}%. Try adjusting the image or settings.`);
      }
    } catch (error) {
      console.error('OCR Error:', error);
      setScanStatus('error');
      setErrorMessage('OCR processing failed. Please try with a clearer image or adjust settings.');
    } finally {
      setIsScanning(false);
      setScanProgress(0);
    }
  };

  const parseReceiptTextUltraEnhanced = (text) => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const items = [];
    
    // Ultra-comprehensive price patterns
    const pricePatterns = [
      // Standard currency formats
      /[£$€¥₹]\s*(\d+[.,]\d{2})/g,
      /(\d+[.,]\d{2})\s*[£$€¥₹]/g,
      /(\d+[.,]\d{1,2})(?:\s*[£$€¥₹])?$/,
      // Decimal with various separators
      /(\d+[.,]\d{1,3})\b/g,
      // Price ranges and special formats
      /(\d+\.\d{2})/g,
      /(\d+,\d{2})/g,
      // Multi-digit prices
      /(\d{1,4}[.,]\d{2})/g
    ];

    // Ultra-comprehensive item patterns
    const itemPatterns = [
      // Standard item + price patterns
      /^([A-Za-z][\w\s&'.-]{1,50})\s+([£$€¥₹]?\s*\d+[.,]\d{1,3})\s*$/,
      /^(.{2,50}?)\s+(\d+[.,]\d{2})$/,
      /^([A-Za-z][\w\s&'.-]{1,50})\s*([£$€¥₹]\d+[.,]\d{1,3})$/,
      // Quantity patterns
      /^(\d+)\s*[xX×*]\s*(.{2,50}?)\s+([£$€¥₹]?\s*\d+[.,]\d{1,3})$/,
      /^(.{2,50}?)\s+(\d+)\s*[xX×*]\s+([£$€¥₹]?\s*\d+[.,]\d{1,3})$/,
      // Weight patterns
      /^(.{2,50}?)\s+(\d+[.,]?\d*)\s*(?:kg|g|lb|oz)\s+([£$€¥₹]?\s*\d+[.,]\d{1,3})$/,
      // Multi-line patterns
      /^([A-Za-z][\w\s&'.-]{1,50})$/
    ];

    // Enhanced skip patterns - more comprehensive
    const skipPatterns = [
      // Totals and calculations
      /(?:sub)?total\s*[:=]?/i, /grand\s*total/i, /final\s*total/i,
      /tax\s*[:=]?/i, /vat\s*[:=]?/i, /gst\s*[:=]?/i, /hst\s*[:=]?/i,
      /discount\s*[:=]?/i, /saving\s*[:=]?/i, /offer/i, /promo/i,
      /change\s*[:=]?/i, /cash\s*[:=]?/i, /card\s*[:=]?/i, /credit/i, /debit/i,
      // Receipt metadata
      /receipt/i, /invoice/i, /bill/i, /ticket/i,
      /thank\s*you/i, /welcome/i, /visit/i, /again/i, /come\s*back/i,
      /store/i, /shop/i, /market/i, /supermarket/i, /restaurant/i,
      /date\s*[:=]?/i, /time\s*[:=]?/i, /till/i, /reg/i, /register/i,
      /operator/i, /cashier/i, /server/i, /clerk/i,
      /transaction/i, /sale/i, /purchase/i, /order/i,
      // Contact and location info
      /address/i, /phone/i, /tel/i, /website/i, /email/i, /www\./i,
      /street/i, /road/i, /avenue/i, /drive/i, /lane/i,
      // Payment and balance info
      /balance/i, /amount/i, /due/i, /paid/i, /tender/i,
      /qty/i, /quantity/i, /each/i, /per/i, /unit/i,
      /sku/i, /upc/i, /barcode/i, /code/i, /ref/i, /id/i,
      // Symbols and separators
      /^\*+$/, /^-+$/, /^=+$/, /^\s*$/, /^[.]+$/, /^[_]+$/,
      // Opening hours and policies
      /open/i, /close/i, /hours/i, /policy/i, /return/i, /exchange/i,
      // Common non-items
      /bag\s*fee/i, /service\s*charge/i, /delivery/i, /tip/i
    ];

    // Store-specific patterns
    const storePatterns = [
      // Major chains
      /tesco/i, /asda/i, /sainsbury/i, /morrisons/i, /aldi/i, /lidl/i,
      /walmart/i, /target/i, /costco/i, /kroger/i, /safeway/i,
      /mcdonalds/i, /kfc/i, /subway/i, /starbucks/i,
      // Store info
      /opening\s*hours/i, /customer\s*service/i, /returns/i, /refund/i,
      /member/i, /loyalty/i, /rewards/i, /points/i
    ];

    // Process lines with multiple strategies
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip obvious non-items
      if (skipPatterns.some(pattern => pattern.test(line)) ||
          storePatterns.some(pattern => pattern.test(line)) ||
          line.length < 2 || line.length > 100) {
        continue;
      }

      // Strategy 1: Direct item + price matching
      let matched = false;
      for (const pattern of itemPatterns) {
        const match = line.match(pattern);
        if (match) {
          if (match.length >= 3) {
            const [, name, priceStr] = match;
            const price = extractPrice(priceStr);
            
            if (isValidPrice(price) && isValidItemName(name)) {
              items.push(createInventoryItem(name, price, line));
              matched = true;
              break;
            }
          } else if (match.length >= 4) {
            // Quantity pattern
            const [, qty, name, priceStr] = match;
            const price = extractPrice(priceStr);
            const quantity = parseInt(qty) || 1;
            
            if (isValidPrice(price) && isValidItemName(name)) {
              const item = createInventoryItem(name, price / quantity, line);
              item.quantity = quantity;
              items.push(item);
              matched = true;
              break;
            }
          }
        }
      }

      if (matched) continue;

      // Strategy 2: Look ahead for price on next line
      if (i < lines.length - 1) {
        const nextLine = lines[i + 1];
        const currentLineClean = line.replace(/[^\w\s&'.-]/g, '').trim();
        
        if (isValidItemName(currentLineClean)) {
          const price = findPriceInLine(nextLine);
          if (price && isValidPrice(price)) {
            items.push(createInventoryItem(currentLineClean, price, `${line} ${nextLine}`));
            i++; // Skip next line
            continue;
          }
        }
      }

      // Strategy 3: Look for price anywhere in current line
      if (isValidItemName(line)) {
        const price = findPriceInLine(line);
        if (price && isValidPrice(price)) {
          const nameOnly = line.replace(/[£$€¥₹]?\s*\d+[.,]\d{1,3}/g, '').trim();
          if (nameOnly.length > 1) {
            items.push(createInventoryItem(nameOnly, price, line));
          }
        }
      }
    }

    // Remove duplicates and apply filters
    const uniqueItems = items
      .filter((item, index, self) => 
        index === self.findIndex(t => 
          t.name.toLowerCase() === item.name.toLowerCase()
        )
      )
      .filter(item => 
        item.unitPrice >= scanSettings.minPrice && 
        item.unitPrice <= scanSettings.maxPrice
      )
      .slice(0, 50); // Increased limit

    return uniqueItems;
  };

  const extractPrice = (priceStr) => {
    if (!priceStr) return null;
    
    // Remove currency symbols and extract number
    const cleaned = priceStr.replace(/[£$€¥₹\s]/g, '');
    const number = parseFloat(cleaned.replace(',', '.'));
    
    return isNaN(number) ? null : number;
  };

  const findPriceInLine = (line) => {
    const pricePatterns = [
      /[£$€¥₹]\s*(\d+[.,]\d{1,3})/,
      /(\d+[.,]\d{2})\s*[£$€¥₹]?/,
      /(\d+\.\d{2})/,
      /(\d+,\d{2})/
    ];

    for (const pattern of pricePatterns) {
      const match = line.match(pattern);
      if (match) {
        return extractPrice(match[1] || match[0]);
      }
    }
    return null;
  };

  const isValidPrice = (price) => {
    return price && 
           !isNaN(price) && 
           price > 0 && 
           price >= scanSettings.minPrice && 
           price <= scanSettings.maxPrice &&
           price < 10000; // Reasonable upper limit
  };

  const isValidItemName = (name) => {
    if (!name || typeof name !== 'string') return false;
    
    const cleaned = name.trim();
    if (cleaned.length < 2 || cleaned.length > 100) return false;
    
    // Must contain at least one letter
    if (!/[A-Za-z]/.test(cleaned)) return false;
    
    // Shouldn't be all numbers
    if (/^\d+$/.test(cleaned)) return false;
    
    // Enhanced non-item detection
    const nonItemWords = [
      'total', 'subtotal', 'tax', 'vat', 'change', 'cash', 'card',
      'date', 'time', 'receipt', 'invoice', 'thank', 'welcome',
      'store', 'shop', 'till', 'reg', 'operator', 'transaction',
      'balance', 'amount', 'due', 'paid', 'qty', 'sku', 'barcode'
    ];
    
    const lowerName = cleaned.toLowerCase();
    if (nonItemWords.some(word => lowerName.includes(word))) {
      return false;
    }
    
    return true;
  };

  const createInventoryItem = (name, price, originalLine) => {
    const cleanName = cleanItemName(name);
    const description = generateDescription(originalLine, cleanName);
    
    return {
      name: cleanName,
      unitPrice: price,
      quantity: 1,
      category: guessCategory(cleanName),
      dateAdded: new Date().toISOString().split('T')[0],
      status: 'In Stock',
      description: description,
      originalLine: originalLine // Keep for reference
    };
  };

  const generateDescription = (originalLine, itemName) => {
    // Extract additional details from the original line
    let description = `Scanned from receipt on ${new Date().toLocaleDateString()}`;
    
    // Look for size/weight indicators
    const sizePattern = /(\d+(?:[.,]\d+)?)\s*(ml|l|g|kg|oz|lb|pack|ct|count|piece|pc)/i;
    const sizeMatch = originalLine.match(sizePattern);
    if (sizeMatch) {
      description += ` - Size: ${sizeMatch[1]}${sizeMatch[2]}`;
    }
    
    // Look for brand indicators (words in caps or known brands)
    const brandPattern = /\b([A-Z]{2,}|Coca-Cola|Pepsi|Nike|Adidas|Apple|Samsung)\b/;
    const brandMatch = originalLine.match(brandPattern);
    if (brandMatch && brandMatch[1].toLowerCase() !== itemName.toLowerCase()) {
      description += ` - Brand: ${brandMatch[1]}`;
    }
    
    return description;
  };

  const cleanItemName = (name) => {
    return name
      .replace(/[^\w\s&'.-]/g, '') // Remove special chars except common ones
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase()); // Title case
  };

  const guessCategory = (itemName) => {
    const name = itemName.toLowerCase();
    
    const categories = {
      'Food & Beverages': [
        'bread', 'milk', 'cheese', 'meat', 'chicken', 'beef', 'fish', 'salmon', 'tuna',
        'fruit', 'apple', 'banana', 'orange', 'grape', 'berry', 'strawberry', 'mango',
        'vegetable', 'carrot', 'potato', 'tomato', 'lettuce', 'cucumber', 'onion', 'pepper',
        'juice', 'water', 'coffee', 'tea', 'soda', 'cola', 'beer', 'wine', 'alcohol',
        'pasta', 'rice', 'cereal', 'yogurt', 'butter', 'oil', 'sugar', 'flour', 'salt',
        'chocolate', 'biscuit', 'cookie', 'cake', 'candy', 'sweet', 'snack', 'chips',
        'pizza', 'sandwich', 'burger', 'fries', 'soup', 'sauce', 'spice', 'herb'
      ],
      'Health & Beauty': [
        'shampoo', 'soap', 'cream', 'lotion', 'medicine', 'vitamin', 'toothpaste',
        'deodorant', 'perfume', 'cosmetic', 'makeup', 'lipstick', 'foundation',
        'skincare', 'moisturizer', 'sunscreen', 'bandage', 'pill', 'tablet'
      ],
      'Household': [
        'detergent', 'cleaner', 'tissue', 'paper', 'towel', 'bag', 'foil', 'wrap',
        'toilet', 'kitchen', 'bathroom', 'cleaning', 'washing', 'dishwasher',
        'laundry', 'bleach', 'sponge', 'brush', 'vacuum', 'trash'
      ],
      'Electronics': [
        'battery', 'charger', 'cable', 'phone', 'headphone', 'speaker', 'computer',
        'tablet', 'camera', 'tv', 'radio', 'electronic', 'adapter', 'usb', 'hdmi'
      ],
      'Clothing': [
        'shirt', 'pants', 'dress', 'shoe', 'sock', 'hat', 'jacket', 'coat',
        'jeans', 'sweater', 'blouse', 'skirt', 'underwear', 'clothing', 'tie',
        'belt', 'glove', 'scarf', 'boot', 'sandal'
      ],
      'Office Supplies': [
        'pen', 'pencil', 'paper', 'notebook', 'folder', 'tape', 'stapler',
        'envelope', 'stamp', 'ink', 'printer', 'office', 'marker', 'highlighter'
      ]
    };

    for (const [category, keywords] of Object.entries(categories)) {
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
                <h3 className="text-lg font-medium text-white">Ultra-Accurate Receipt Scanner</h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-gray-400 hover:text-gray-300 focus:outline-none p-2"
                  title="Scan Settings"
                >
                  <RiSettings3Line className="h-5 w-5" />
                </button>
                {rawOcrText && (
                  <button
                    onClick={() => setShowRawText(!showRawText)}
                    className="text-gray-400 hover:text-gray-300 focus:outline-none p-2"
                    title="Show Raw OCR Text"
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
                <h4 className="text-white font-medium mb-3">Advanced Scan Settings</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      OCR Language
                    </label>
                    <select
                      value={scanSettings.language}
                      onChange={(e) => setScanSettings(prev => ({ ...prev, language: e.target.value }))}
                      className="w-full rounded-md border-gray-600 bg-gray-700 text-white text-sm p-2"
                    >
                      <option value="eng">English</option>
                      <option value="fra">French</option>
                      <option value="deu">German</option>
                      <option value="spa">Spanish</option>
                      <option value="ita">Italian</option>
                      <option value="por">Portuguese</option>
                      <option value="rus">Russian</option>
                      <option value="chi_sim">Chinese (Simplified)</option>
                      <option value="jpn">Japanese</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={scanSettings.enhanceImage}
                        onChange={(e) => setScanSettings(prev => ({ ...prev, enhanceImage: e.target.checked }))}
                        className="mr-2 rounded border-gray-600 bg-gray-700 text-primary-600"
                      />
                      Enhance image quality
                    </label>
                    <label className="flex items-center text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={scanSettings.multiPass}
                        onChange={(e) => setScanSettings(prev => ({ ...prev, multiPass: e.target.checked }))}
                        className="mr-2 rounded border-gray-600 bg-gray-700 text-primary-600"
                      />
                      Multi-pass OCR (slower, more accurate)
                    </label>
                    <label className="flex items-center text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={scanSettings.aggressiveParsing}
                        onChange={(e) => setScanSettings(prev => ({ ...prev, aggressiveParsing: e.target.checked }))}
                        className="mr-2 rounded border-gray-600 bg-gray-700 text-primary-600"
                      />
                      Aggressive text parsing
                    </label>
                  </div>
                  <div className="space-y-2">
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
                <h4 className="text-white font-medium mb-3">Raw OCR Text Output</h4>
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
                      Camera
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
                              Position receipt within frame - ensure all text is visible and clear
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
                          <RiCameraLine className="h-5 w-5 mr-2" />
                          Capture Receipt
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* File Upload */
                    <div className="space-y-4">
                      <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
                        <RiImageLine className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-white mb-4">Upload a high-quality image of your receipt</p>
                        <p className="text-gray-400 text-sm mb-4">Supports JPG, PNG, WebP formats up to 10MB</p>
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

                  {/* Ultra-Enhanced Tips */}
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-2">🎯 Ultra-Accurate Scanning Tips:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                      <ul className="space-y-1">
                        <li>• Use bright, even lighting without shadows</li>
                        <li>• Keep receipt completely flat and straight</li>
                        <li>• Ensure all text is sharp and in focus</li>
                        <li>• Avoid reflections and glare</li>
                        <li>• Clean any smudges or stains first</li>
                      </ul>
                      <ul className="space-y-1">
                        <li>• Capture the entire receipt in frame</li>
                        <li>• Use multi-pass OCR for difficult receipts</li>
                        <li>• Enable image enhancement for faded receipts</li>
                        <li>• Try different angles if first scan fails</li>
                        <li>• Check raw OCR text if items are missed</li>
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
                          {scanSettings.multiPass ? 'Ultra-accurate multi-pass scanning...' : 'Processing with enhanced OCR...'}
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-3">
                        <div
                          className="bg-primary-600 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${scanProgress}%` }}
                        />
                      </div>
                      <p className="text-center text-gray-300 text-sm">{scanProgress}% complete</p>
                    </div>
                  )}

                  {/* Scan Results */}
                  {scanStatus === 'success' && extractedItems.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-green-400">
                          <RiCheckLine className="h-6 w-6 mr-2" />
                          <span className="font-medium">Successfully extracted {extractedItems.length} items!</span>
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
                        <span className="font-medium">Scan Failed</span>
                      </div>
                      <p className="text-gray-300">{errorMessage}</p>
                      <div className="text-sm text-gray-400">
                        <p>Try these solutions:</p>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>Enable multi-pass OCR in settings</li>
                          <li>Improve lighting conditions</li>
                          <li>Ensure receipt is flat and clear</li>
                          <li>Check the raw OCR text for debugging</li>
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
                        Add {extractedItems.length} Items to Inventory
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