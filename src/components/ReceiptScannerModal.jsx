import {useState,useRef,useCallback} from 'react';
import {motion,AnimatePresence} from 'framer-motion';
import {RiCameraLine,RiCloseLine,RiScanLine,RiImageLine,RiRefreshLine,RiCheckLine,RiAlertLine,RiSettings3Line,RiEditLine,RiFlashFill} from 'react-icons/ri';
import Webcam from 'react-webcam';
import Tesseract from 'tesseract.js';

export default function ReceiptScannerModal({isOpen,onClose,onItemsExtracted}) {
  const [isScanning,setIsScanning]=useState(false);
  const [scanProgress,setScanProgress]=useState(0);
  const [capturedImage,setCapturedImage]=useState(null);
  const [extractedItems,setExtractedItems]=useState([]);
  const [scanStatus,setScanStatus]=useState('idle');
  const [errorMessage,setErrorMessage]=useState('');
  const [useFileUpload,setUseFileUpload]=useState(false);
  const [showRawText,setShowRawText]=useState(false);
  const [rawOcrText,setRawOcrText]=useState('');
  const [scanSettings,setScanSettings]=useState({
    language: 'eng',
    enhanceImage: true,
    quickMode: true, // NEW: Quick mode for faster scanning
    aggressiveParsing: false, // Disabled by default for speed
    minPrice: 0.01,
    maxPrice: 2000,
    smartFiltering: true // NEW: Smarter filtering to reduce false positives
  });
  const [showSettings,setShowSettings]=useState(false);
  const [editingItems,setEditingItems]=useState(false);

  const webcamRef=useRef(null);
  const fileInputRef=useRef(null);

  // Optimized video constraints - balanced for speed and quality
  const videoConstraints={
    width: {min: 720,ideal: 1280,max: 1920}, // Reduced max resolution for speed
    height: {min: 480,ideal: 720,max: 1080},
    facingMode: {ideal: 'environment'},
    focusMode: 'continuous',
    whiteBalanceMode: 'continuous'
  };

  // Fast image preprocessing - optimized for speed
  const preprocessImageFast=async (imageSrc)=> {
    return new Promise((resolve)=> {
      const img=new Image();
      img.onload=()=> {
        const canvas=document.createElement('canvas');
        const ctx=canvas.getContext('2d');
        
        // Moderate scaling for balance of speed and accuracy
        const scale=1.2;
        canvas.width=img.width * scale;
        canvas.height=img.height * scale;
        
        ctx.imageSmoothingEnabled=true;
        ctx.imageSmoothingQuality='medium'; // Reduced from 'high' for speed
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        
        if (scanSettings.enhanceImage) {
          const imageData=ctx.getImageData(0,0,canvas.width,canvas.height);
          const data=imageData.data;
          
          // Fast contrast enhancement
          for (let i=0;i < data.length;i +=4) {
            const gray=data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            const enhanced=Math.min(255,Math.max(0,gray * 1.3 + 20)); // Simple enhancement
            
            data[i]=enhanced;
            data[i + 1]=enhanced;
            data[i + 2]=enhanced;
          }
          
          ctx.putImageData(imageData,0,0);
        }
        
        resolve(canvas.toDataURL('image/jpeg',0.85)); // Reduced quality for speed
      };
      img.src=imageSrc;
    });
  };

  const capture=useCallback(async ()=> {
    const imageSrc=webcamRef.current.getScreenshot();
    setCapturedImage(imageSrc);
    processReceiptFast(imageSrc);
  },[webcamRef]);

  const handleFileUpload=async (event)=> {
    const file=event.target.files[0];
    if (file) {
      const reader=new FileReader();
      reader.onload=async (e)=> {
        const imageSrc=e.target.result;
        setCapturedImage(imageSrc);
        processReceiptFast(imageSrc);
      };
      reader.readAsDataURL(file);
    }
  };

  // Optimized OCR processing for speed
  const processReceiptFast=async (imageSrc)=> {
    setIsScanning(true);
    setScanStatus('scanning');
    setScanProgress(0);
    setErrorMessage('');
    setRawOcrText('');

    try {
      let ocrText='';
      
      if (scanSettings.quickMode) {
        // Single-pass OCR optimized for speed
        setScanProgress(20);
        
        const processedImage=scanSettings.enhanceImage 
          ? await preprocessImageFast(imageSrc) 
          : imageSrc;
        
        setScanProgress(40);
        
        const result=await Tesseract.recognize(
          processedImage,
          scanSettings.language,
          {
            logger: m=> {
              if (m.status==='recognizing text') {
                setScanProgress(40 + (m.progress * 50));
              }
            },
            tessedit_pageseg_mode: Tesseract.PSM.AUTO,
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,£$€¥₹@#%&*()x×X -+=[]{}|\\:";\'<>?/_ \n\t',
            preserve_interword_spaces: '1',
            tessedit_do_invert: '0'
          }
        );
        
        ocrText=result.data.text;
      } else {
        // Reduced multi-pass for better accuracy (only 2 passes instead of 5)
        const passes=[
          {enhance: false,psm: Tesseract.PSM.AUTO},
          {enhance: true,psm: Tesseract.PSM.SINGLE_BLOCK}
        ];
        
        for (let i=0;i < passes.length;i++) {
          const pass=passes[i];
          setScanProgress(Math.round((i / passes.length) * 80));
          
          try {
            const processedImage=pass.enhance 
              ? await preprocessImageFast(imageSrc) 
              : imageSrc;
            
            const result=await Tesseract.recognize(
              processedImage,
              scanSettings.language,
              {
                logger: m=> {
                  if (m.status==='recognizing text') {
                    const passProgress=(i / passes.length) * 80 + (m.progress * 40 / passes.length);
                    setScanProgress(Math.round(passProgress));
                  }
                },
                tessedit_pageseg_mode: pass.psm,
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,£$€¥₹@#%&*()x×X -+=[]{}|\\:";\'<>?/_ \n\t',
                preserve_interword_spaces: '1'
              }
            );
            
            ocrText += result.data.text + '\n';
          } catch (passError) {
            console.warn(`OCR pass ${i + 1} failed:`,passError);
          }
        }
      }
      
      setScanProgress(90);
      setRawOcrText(ocrText);
      
      // Fast text parsing
      const items=parseReceiptTextFast(ocrText);
      
      setScanProgress(100);
      
      if (items.length > 0) {
        setExtractedItems(items);
        setScanStatus('success');
      } else {
        setScanStatus('error');
        setErrorMessage('No items found. Try improving lighting or image clarity.');
      }
    } catch (error) {
      console.error('OCR Error:',error);
      setScanStatus('error');
      setErrorMessage('OCR processing failed. Please try with a clearer image.');
    } finally {
      setIsScanning(false);
      setScanProgress(0);
    }
  };

  // Optimized text parsing for speed and accuracy
  const parseReceiptTextFast=(text)=> {
    const lines=text.split('\n')
      .map(line=> line.trim())
      .filter(line=> line.length > 1 && line.length < 80); // Quick length filter
    
    const items=[];
    
    // Fast price extraction patterns - most common first
    const quickPricePatterns=[
      /([£$€¥₹])\s*(\d+[.,]\d{2})/g,
      /(\d+[.,]\d{2})\s*([£$€¥₹]?)/g,
      /(\d+\.\d{2})/g
    ];
    
    // Fast item patterns - prioritized by effectiveness
    const quickItemPatterns=[
      /^([A-Za-z][\w\s&'.-]{1,40})\s+([£$€¥₹]?\s*\d+[.,]\d{1,3})\s*$/,
      /^(.{2,40}?)\s+(\d+[.,]\d{2})$/,
      /^(\d+)\s*[xX×*]\s*(.{2,40}?)\s+([£$€¥₹]?\s*\d+[.,]\d{1,3})$/
    ];
    
    // Streamlined skip patterns - only essential ones
    const skipPatterns=[
      /total|tax|vat|change|cash|card|receipt|thank|welcome|date|time/i,
      /^\*+$|^-+$|^=+$/,
      /^\d+$/
    ];
    
    // Fast processing loop
    for (let i=0;i < lines.length;i++) {
      const line=lines[i];
      
      // Quick skip check
      if (skipPatterns.some(pattern=> pattern.test(line))) {
        continue;
      }
      
      // Try direct matching first (fastest)
      let matched=false;
      for (const pattern of quickItemPatterns) {
        const match=line.match(pattern);
        if (match && match.length >= 3) {
          let itemName,priceStr,quantity=1;
          
          if (match.length >= 4) {
            // Quantity pattern
            const [,qty,name,price]=match;
            quantity=parseInt(qty) || 1;
            itemName=name;
            priceStr=price;
          } else {
            // Regular pattern
            const [,name,price]=match;
            itemName=name;
            priceStr=price;
          }
          
          const price=extractPriceFast(priceStr);
          if (isValidPriceFast(price) && isValidItemNameFast(itemName)) {
            const unitPrice=quantity > 1 ? price / quantity : price;
            items.push(createInventoryItemFast(itemName,unitPrice,quantity));
            matched=true;
            break;
          }
        }
      }
      
      if (matched) continue;
      
      // Look ahead for price (only check next line for speed)
      if (i < lines.length - 1 && !matched) {
        const nextLine=lines[i + 1];
        const currentLineClean=line.replace(/[^\w\s&'.-]/g,'').trim();
        
        if (isValidItemNameFast(currentLineClean)) {
          const price=findPriceInLineFast(nextLine);
          if (price && isValidPriceFast(price)) {
            items.push(createInventoryItemFast(currentLineClean,price,1));
            i++; // Skip next line
          }
        }
      }
    }
    
    // Fast deduplication and filtering
    const uniqueItems=items
      .filter((item,index,self)=> 
        index===self.findIndex(t=> 
          t.name.toLowerCase().replace(/\s+/g,'')===item.name.toLowerCase().replace(/\s+/g,'')
        )
      )
      .filter(item=> 
        item.unitPrice >= scanSettings.minPrice && 
        item.unitPrice <= scanSettings.maxPrice
      )
      .slice(0,25); // Reduced limit for faster processing
    
    return uniqueItems;
  };

  // Fast price extraction
  const extractPriceFast=(priceStr)=> {
    if (!priceStr) return null;
    const cleaned=priceStr.replace(/[£$€¥₹\s]/g,'');
    const number=parseFloat(cleaned.replace(',','.'));
    return isNaN(number) ? null : number;
  };

  // Fast price finding in line
  const findPriceInLineFast=(line)=> {
    const priceMatch=line.match(/(\d+[.,]\d{2})/);
    return priceMatch ? extractPriceFast(priceMatch[1]) : null;
  };

  // Fast price validation
  const isValidPriceFast=(price)=> {
    return price && 
           !isNaN(price) && 
           price > 0 && 
           price >= scanSettings.minPrice && 
           price <= scanSettings.maxPrice;
  };

  // Fast item name validation
  const isValidItemNameFast=(name)=> {
    if (!name || typeof name !== 'string') return false;
    const cleaned=name.trim();
    if (cleaned.length < 2 || cleaned.length > 50) return false;
    if (!/[A-Za-z]/.test(cleaned)) return false;
    if (/^\d+$/.test(cleaned)) return false;
    
    // Quick non-item check
    const nonItemWords=['total','tax','change','cash','receipt','thank'];
    const lowerName=cleaned.toLowerCase();
    return !nonItemWords.some(word=> lowerName.includes(word));
  };

  // Fast inventory item creation
  const createInventoryItemFast=(name,price,quantity=1)=> {
    const cleanName=name
      .replace(/[^\w\s&'.-]/g,'')
      .replace(/\s+/g,' ')
      .trim()
      .toLowerCase()
      .replace(/\b\w/g,l=> l.toUpperCase());
    
    return {
      name: cleanName,
      unitPrice: price,
      quantity: quantity,
      category: guessCategoryFast(cleanName),
      dateAdded: new Date().toISOString().split('T')[0],
      status: 'In Stock',
      description: `Quick scanned on ${new Date().toLocaleDateString()}`
    };
  };

  // Fast category guessing with most common categories first
  const guessCategoryFast=(itemName)=> {
    const name=itemName.toLowerCase();
    
    // Most common categories first for speed
    const quickCategories={
      'Food & Beverages': ['bread','milk','cheese','meat','fruit','juice','coffee','tea','water','beer','wine'],
      'Household': ['detergent','tissue','paper','soap','cleaner','bag'],
      'Health & Beauty': ['shampoo','cream','medicine','vitamin','toothpaste'],
      'Electronics': ['battery','cable','phone','charger']
    };
    
    for (const [category,keywords] of Object.entries(quickCategories)) {
      if (keywords.some(keyword=> name.includes(keyword))) {
        return category;
      }
    }
    
    return 'Other';
  };

  const handleEditItem=(index,field,value)=> {
    const updatedItems=[...extractedItems];
    if (field==='unitPrice') {
      updatedItems[index][field]=parseFloat(value) || 0;
    } else {
      updatedItems[index][field]=value;
    }
    setExtractedItems(updatedItems);
  };

  const handleRemoveItem=(index)=> {
    const updatedItems=extractedItems.filter((_,i)=> i !== index);
    setExtractedItems(updatedItems);
  };

  const handleConfirmItems=()=> {
    onItemsExtracted(extractedItems,capturedImage);
    handleClose();
  };

  const handleClose=()=> {
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

  const retakePhoto=()=> {
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
        initial={{opacity: 0}}
        animate={{opacity: 1}}
        exit={{opacity: 0}}
        className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-90"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <motion.div
            initial={{opacity: 0,scale: 0.95}}
            animate={{opacity: 1,scale: 1}}
            exit={{opacity: 0,scale: 0.95}}
            className="relative w-full max-w-6xl bg-gray-800 rounded-lg shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div className="flex items-center">
                <RiFlashFill className="h-6 w-6 text-primary-400 mr-2" />
                <h3 className="text-lg font-medium text-white">Quick Receipt Scanner</h3>
                <span className="ml-2 px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                  Speed Optimized
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={()=> setShowSettings(!showSettings)}
                  className="text-gray-400 hover:text-gray-300 focus:outline-none p-2"
                  title="Quick Settings"
                >
                  <RiSettings3Line className="h-5 w-5" />
                </button>
                {rawOcrText && (
                  <button
                    onClick={()=> setShowRawText(!showRawText)}
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

            {/* Quick Settings Panel */}
            {showSettings && (
              <motion.div
                initial={{height: 0,opacity: 0}}
                animate={{height: 'auto',opacity: 1}}
                exit={{height: 0,opacity: 0}}
                className="border-b border-gray-700 p-4 bg-gray-750"
              >
                <h4 className="text-white font-medium mb-3">Quick Scan Settings</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="flex items-center text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={scanSettings.quickMode}
                        onChange={(e)=> setScanSettings(prev=> ({...prev,quickMode: e.target.checked}))}
                        className="mr-2 rounded border-gray-600 bg-gray-700 text-primary-600"
                      />
                      Quick Mode (faster,single-pass)
                    </label>
                    <label className="flex items-center text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={scanSettings.enhanceImage}
                        onChange={(e)=> setScanSettings(prev=> ({...prev,enhanceImage: e.target.checked}))}
                        className="mr-2 rounded border-gray-600 bg-gray-700 text-primary-600"
                      />
                      Basic image enhancement
                    </label>
                    <label className="flex items-center text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={scanSettings.smartFiltering}
                        onChange={(e)=> setScanSettings(prev=> ({...prev,smartFiltering: e.target.checked}))}
                        className="mr-2 rounded border-gray-600 bg-gray-700 text-primary-600"
                      />
                      Smart item filtering
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
                        onChange={(e)=> setScanSettings(prev=> ({...prev,minPrice: parseFloat(e.target.value) || 0}))}
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
                        onChange={(e)=> setScanSettings(prev=> ({...prev,maxPrice: parseFloat(e.target.value) || 2000}))}
                        className="w-full rounded-md border-gray-600 bg-gray-700 text-white text-sm p-2"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
                      <h5 className="text-green-400 font-medium mb-2">⚡ Speed Optimizations</h5>
                      <ul className="text-green-300 text-xs space-y-1">
                        <li>• Single-pass OCR in Quick Mode</li>
                        <li>• Optimized image preprocessing</li>
                        <li>• Streamlined text parsing</li>
                        <li>• Smart pattern matching</li>
                        <li>• Reduced resolution for speed</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Raw OCR Text Panel */}
            {showRawText && rawOcrText && (
              <motion.div
                initial={{height: 0,opacity: 0}}
                animate={{height: 'auto',opacity: 1}}
                exit={{height: 0,opacity: 0}}
                className="border-b border-gray-700 p-4 bg-gray-750 max-h-64 overflow-y-auto"
              >
                <h4 className="text-white font-medium mb-3">OCR Text Output</h4>
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
                      onClick={()=> setUseFileUpload(false)}
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
                      onClick={()=> setUseFileUpload(true)}
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
                          screenshotQuality={0.85} // Reduced for speed
                          videoConstraints={videoConstraints}
                          className="w-full h-auto max-h-96 object-cover"
                        />
                        <div className="absolute inset-0 border-2 border-dashed border-primary-400 m-4 rounded-lg pointer-events-none">
                          <div className="absolute top-2 left-2 right-2 text-center">
                            <span className="bg-black bg-opacity-50 text-white text-sm px-2 py-1 rounded">
                              Position receipt clearly - Quick Mode enabled for faster scanning
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
                          <RiFlashFill className="h-5 w-5 mr-2" />
                          Quick Capture
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* File Upload */
                    <div className="space-y-4">
                      <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
                        <RiImageLine className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-white mb-4">Upload receipt image for quick processing</p>
                        <p className="text-gray-400 text-sm mb-4">JPG,PNG,WebP up to 10MB</p>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          accept="image/*"
                          className="hidden"
                        />
                        <button
                          onClick={()=> fileInputRef.current?.click()}
                          disabled={isScanning}
                          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                        >
                          <RiImageLine className="h-5 w-5 mr-2" />
                          Choose Image
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Quick Tips */}
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-2">⚡ Quick Scanning Tips:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                      <ul className="space-y-1">
                        <li>• Use good lighting for best results</li>
                        <li>• Keep receipt flat and straight</li>
                        <li>• Ensure text is clear and readable</li>
                      </ul>
                      <ul className="space-y-1">
                        <li>• Quick Mode is enabled by default</li>
                        <li>• Processing typically takes 5-10 seconds</li>
                        <li>• Edit results before confirming</li>
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
                        <RiFlashFill className="h-6 w-6 text-primary-400 mr-2 animate-pulse" />
                        <span className="text-white">
                          {scanSettings.quickMode 
                            ? 'Quick scanning in progress...' 
                            : 'Processing with enhanced accuracy...'}
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-3">
                        <div 
                          className="bg-primary-600 h-3 rounded-full transition-all duration-300"
                          style={{width: `${scanProgress}%`}}
                        />
                      </div>
                      <p className="text-center text-gray-300 text-sm">
                        {scanProgress}% complete
                        {scanSettings.quickMode && scanProgress > 40 && (
                          <span className="ml-2 text-green-400">
                            ⚡ Quick Mode Active
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Scan Results */}
                  {scanStatus==='success' && extractedItems.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-green-400">
                          <RiCheckLine className="h-6 w-6 mr-2" />
                          <span className="font-medium">
                            ⚡ Quick scan found {extractedItems.length} items!
                          </span>
                        </div>
                        <button
                          onClick={()=> setEditingItems(!editingItems)}
                          className="flex items-center px-3 py-1 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm"
                        >
                          <RiEditLine className="h-4 w-4 mr-1" />
                          {editingItems ? 'Done Editing' : 'Edit Items'}
                        </button>
                      </div>

                      <div className="bg-gray-700 rounded-lg p-4 max-h-96 overflow-y-auto">
                        <div className="space-y-3">
                          {extractedItems.map((item,index)=> (
                            <div key={index} className="bg-gray-800 rounded p-3">
                              {editingItems ? (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                  <div>
                                    <label className="block text-xs text-gray-400 mb-1">Item Name</label>
                                    <input
                                      type="text"
                                      value={item.name}
                                      onChange={(e)=> handleEditItem(index,'name',e.target.value)}
                                      className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-400 mb-1">Price (£)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.unitPrice}
                                      onChange={(e)=> handleEditItem(index,'unitPrice',e.target.value)}
                                      className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-400 mb-1">Category</label>
                                    <select
                                      value={item.category}
                                      onChange={(e)=> handleEditItem(index,'category',e.target.value)}
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
                                      onClick={()=> handleRemoveItem(index)}
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
                  {scanStatus==='error' && (
                    <div className="text-center space-y-4">
                      <div className="flex items-center justify-center text-red-400">
                        <RiAlertLine className="h-6 w-6 mr-2" />
                        <span className="font-medium">Quick Scan Failed</span>
                      </div>
                      <p className="text-gray-300">{errorMessage}</p>
                      <div className="text-sm text-gray-400">
                        <p>Quick solutions:</p>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>Improve lighting conditions</li>
                          <li>Ensure receipt is flat and clear</li>
                          <li>Try disabling Quick Mode for better accuracy</li>
                          <li>Check the OCR text output for debugging</li>
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
                    {scanStatus==='success' && extractedItems.length > 0 && (
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