import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RiCameraLine, RiCloseLine, RiScanLine, RiImageLine, RiRefreshLine, RiCheckLine, RiAlertLine } from 'react-icons/ri';
import Webcam from 'react-webcam';
import Tesseract from 'tesseract.js';

export default function ReceiptScannerModal({ isOpen, onClose, onItemsExtracted }) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [capturedImage, setCapturedImage] = useState(null);
  const [extractedItems, setExtractedItems] = useState([]);
  const [scanStatus, setScanStatus] = useState('idle'); // idle, scanning, success, error
  const [errorMessage, setErrorMessage] = useState('');
  const [useFileUpload, setUseFileUpload] = useState(false);
  
  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Video constraints for better receipt scanning
  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: { ideal: 'environment' } // Use back camera on mobile
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    setCapturedImage(imageSrc);
    processReceipt(imageSrc);
  }, [webcamRef]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
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

    try {
      // OCR Processing with Tesseract.js
      const { data: { text } } = await Tesseract.recognize(
        imageSrc,
        'eng',
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              setScanProgress(Math.round(m.progress * 100));
            }
          }
        }
      );

      // Parse the extracted text to find items
      const items = parseReceiptText(text);
      
      if (items.length > 0) {
        setExtractedItems(items);
        setScanStatus('success');
      } else {
        setScanStatus('error');
        setErrorMessage('No items could be extracted from this receipt. Please try a clearer image.');
      }
    } catch (error) {
      console.error('OCR Error:', error);
      setScanStatus('error');
      setErrorMessage('Failed to scan receipt. Please try again with a clearer image.');
    } finally {
      setIsScanning(false);
      setScanProgress(0);
    }
  };

  const parseReceiptText = (text) => {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const items = [];
    
    // Common price patterns - Fixed regex escaping
    const pricePattern = /[£$]?(\d+\.?\d{0,2})/g;
    const itemPattern = /^([A-Za-z][\w\s&'-]{2,30})\s*[£$]?(\d+\.?\d{0,2})$/;
    
    // Store/receipt identifiers to skip
    const skipPatterns = [
      /total/i, /subtotal/i, /tax/i, /vat/i, /discount/i, /change/i,
      /card/i, /cash/i, /receipt/i, /thank/i, /welcome/i, /store/i,
      /date/i, /time/i, /till/i, /operator/i, /transaction/i,
      /address/i, /phone/i, /website/i, /email/i
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip header/footer content
      if (skipPatterns.some(pattern => pattern.test(line))) {
        continue;
      }

      // Try to match item with price on same line
      const match = line.match(itemPattern);
      if (match) {
        const [, name, priceStr] = match;
        const price = parseFloat(priceStr);
        
        if (price > 0 && price < 1000) { // Reasonable price range
          items.push({
            name: cleanItemName(name),
            unitPrice: price,
            quantity: 1,
            category: guessCategory(name),
            dateAdded: new Date().toISOString().split('T')[0],
            status: 'In Stock',
            description: `Added from receipt scan on ${new Date().toLocaleDateString()}`
          });
        }
      } else {
        // Try to find item name and price on separate lines
        const prices = line.match(pricePattern);
        if (prices && i > 0) {
          const prevLine = lines[i - 1].trim();
          const price = parseFloat(prices[0].replace(/[£$]/, ''));
          
          if (price > 0 && price < 1000 && prevLine.length > 2 && 
              !skipPatterns.some(pattern => pattern.test(prevLine))) {
            items.push({
              name: cleanItemName(prevLine),
              unitPrice: price,
              quantity: 1,
              category: guessCategory(prevLine),
              dateAdded: new Date().toISOString().split('T')[0],
              status: 'In Stock',
              description: `Added from receipt scan on ${new Date().toLocaleDateString()}`
            });
          }
        }
      }
    }

    // Remove duplicates and clean up
    return items
      .filter((item, index, self) => 
        index === self.findIndex(t => t.name === item.name)
      )
      .slice(0, 20); // Limit to 20 items to avoid spam
  };

  const cleanItemName = (name) => {
    return name
      .replace(/[^\w\s&'-]/g, '') // Remove special chars except &, ', -
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase()); // Title case
  };

  const guessCategory = (itemName) => {
    const name = itemName.toLowerCase();
    
    const categories = {
      'Food & Beverages': ['bread', 'milk', 'cheese', 'meat', 'chicken', 'beef', 'fish', 'fruit', 'vegetable', 'juice', 'water', 'coffee', 'tea', 'soda', 'beer', 'wine'],
      'Health & Beauty': ['shampoo', 'soap', 'cream', 'lotion', 'medicine', 'vitamin', 'toothpaste', 'deodorant'],
      'Household': ['detergent', 'cleaner', 'tissue', 'paper', 'towel', 'bag', 'foil', 'wrap'],
      'Electronics': ['battery', 'charger', 'cable', 'phone', 'headphone'],
      'Clothing': ['shirt', 'pants', 'dress', 'shoe', 'sock', 'hat', 'jacket'],
      'Office Supplies': ['pen', 'pencil', 'paper', 'notebook', 'folder', 'tape']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => name.includes(keyword))) {
        return category;
      }
    }

    return 'Other';
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
    onClose();
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setExtractedItems([]);
    setScanStatus('idle');
    setErrorMessage('');
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
            className="relative w-full max-w-4xl bg-gray-800 rounded-lg shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div className="flex items-center">
                <RiScanLine className="h-6 w-6 text-primary-400 mr-2" />
                <h3 className="text-lg font-medium text-white">Receipt Scanner</h3>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-300 focus:outline-none"
              >
                <RiCloseLine className="h-6 w-6" />
              </button>
            </div>

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
                          videoConstraints={videoConstraints}
                          className="w-full h-auto max-h-96 object-cover"
                        />
                        <div className="absolute inset-0 border-2 border-dashed border-primary-400 m-4 rounded-lg pointer-events-none">
                          <div className="absolute top-2 left-2 right-2 text-center">
                            <span className="bg-black bg-opacity-50 text-white text-sm px-2 py-1 rounded">
                              Position receipt within the frame
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
                        <p className="text-white mb-4">Upload a clear image of your receipt</p>
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

                  {/* Tips */}
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-2">📸 Scanning Tips:</h4>
                    <ul className="text-gray-300 text-sm space-y-1">
                      <li>• Ensure good lighting and avoid shadows</li>
                      <li>• Keep the receipt flat and fully visible</li>
                      <li>• Make sure text is clear and readable</li>
                      <li>• Avoid blurry or tilted images</li>
                    </ul>
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
                        <span className="text-white">Scanning receipt...</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${scanProgress}%` }}
                        />
                      </div>
                      <p className="text-center text-gray-300 text-sm">{scanProgress}% complete</p>
                    </div>
                  )}

                  {/* Scan Results */}
                  {scanStatus === 'success' && extractedItems.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center text-green-400">
                        <RiCheckLine className="h-6 w-6 mr-2" />
                        <span className="font-medium">Found {extractedItems.length} items!</span>
                      </div>
                      
                      <div className="bg-gray-700 rounded-lg p-4 max-h-64 overflow-y-auto">
                        <h4 className="text-white font-medium mb-3">Extracted Items:</h4>
                        <div className="space-y-2">
                          {extractedItems.map((item, index) => (
                            <div key={index} className="flex justify-between items-center py-2 px-3 bg-gray-800 rounded">
                              <div>
                                <span className="text-white font-medium">{item.name}</span>
                                <span className="text-gray-400 text-sm ml-2">({item.category})</span>
                              </div>
                              <span className="text-primary-400 font-medium">
                                £{item.unitPrice.toFixed(2)}
                              </span>
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