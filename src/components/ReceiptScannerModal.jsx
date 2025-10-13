import React, { useState, useRef, useEffect } from 'react';
import { createWorker } from 'tesseract.js';
import 'react-image-crop/dist/ReactCrop.css';
import { FiUpload, FiX, FiRefreshCw, FiTrash2, FiSave, FiCamera, FiRepeat, FiCrop } from 'react-icons/fi';
import { Image as ImageJS } from 'image-js';
import { parseReceipt } from '../utils/receipt-parser';
import SafeIcon from '../common/SafeIcon';
import supabase from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const ReceiptScannerModal = ({ isOpen, onClose, onItemsScanned }) => {
  const [image, setImage] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState('upload'); // 'upload', 'confirm', 'select_area', 'scan_progress', 'edit'
  const [parsedItems, setParsedItems] = useState([]);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  
  // Area selection state
  const [selectionArea, setSelectionArea] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const selectionRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const workerRef = useRef(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!isOpen) {
      setImage(null);
      setScanProgress(0);
      setScanStatus('');
      setError('');
      setIsLoading(false);
      setView('upload');
      setParsedItems([]);
      setSelectionArea({ x: 0, y: 0, width: 0, height: 0 });
    }
  }, [isOpen]);

  useEffect(() => {
    const setupWorker = async () => {
      setScanStatus('Initializing scanner...');
      setIsWorkerReady(false);
      try {
        const worker = await createWorker({
          logger: m => {
            if (m.status === 'recognizing text') {
              const progress = 20 + Math.floor(m.progress * 60);
              setScanProgress(progress > 90 ? 90 : progress);
            }
          },
        });
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        await worker.setParameters({
          tessedit_pageseg_mode: '6', // Assume a single uniform block of text.
        });
        workerRef.current = worker;
        setIsWorkerReady(true);
        setScanStatus('');
      } catch (error) {
        console.error('Error initializing OCR worker:', error);
        setError('Failed to initialize scanner. Please try again later.');
        setIsWorkerReady(false);
      }
    };

    if (isOpen) {
      setupWorker();
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      setIsWorkerReady(false);
    };
  }, [isOpen]);

  // Draw the image and selection rectangle on the canvas
  useEffect(() => {
    if (view === 'select_area' && canvasRef.current && image) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (imageRef.current) {
        const img = imageRef.current;
        
        // Clear canvas and draw image
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Draw selection rectangle
        ctx.strokeStyle = '#2563eb'; // Blue
        ctx.lineWidth = 3;
        ctx.strokeRect(
          selectionArea.x, 
          selectionArea.y, 
          selectionArea.width, 
          selectionArea.height
        );
        
        // Semi-transparent overlay outside selection
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        
        // Top
        ctx.fillRect(0, 0, canvas.width, selectionArea.y);
        // Bottom
        ctx.fillRect(
          0, 
          selectionArea.y + selectionArea.height, 
          canvas.width, 
          canvas.height - (selectionArea.y + selectionArea.height)
        );
        // Left
        ctx.fillRect(
          0, 
          selectionArea.y, 
          selectionArea.x, 
          selectionArea.height
        );
        // Right
        ctx.fillRect(
          selectionArea.x + selectionArea.width, 
          selectionArea.y, 
          canvas.width - (selectionArea.x + selectionArea.width), 
          selectionArea.height
        );
      }
    }
  }, [selectionArea, view, image]);

  // Load image into canvas when view changes to select_area
  useEffect(() => {
    if (view === 'select_area' && image) {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (canvas) {
          // Set canvas dimensions to match the container size while maintaining aspect ratio
          const container = containerRef.current;
          if (container) {
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            const imgAspectRatio = img.width / img.height;
            
            let canvasWidth, canvasHeight;
            
            if (containerWidth / containerHeight > imgAspectRatio) {
              // Container is wider than image aspect ratio
              canvasHeight = Math.min(containerHeight, img.height);
              canvasWidth = canvasHeight * imgAspectRatio;
            } else {
              // Container is taller than image aspect ratio
              canvasWidth = Math.min(containerWidth, img.width);
              canvasHeight = canvasWidth / imgAspectRatio;
            }
            
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            
            // Draw the image
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Store the image reference
            imageRef.current = img;
            
            // Initialize selection area to full image
            setSelectionArea({
              x: 0,
              y: 0,
              width: canvas.width,
              height: canvas.height
            });
          }
        }
      };
      img.src = image;
    }
  }, [view, image]);

  const handleScan = async () => {
    if (!image) {
      setError('No image to scan.');
      return;
    }
    if (!workerRef.current || !isWorkerReady) {
      setError('Scanner is not ready yet. Please wait a moment.');
      return;
    }

    setIsLoading(true);
    setScanStatus('Initializing...');
    setScanProgress(0);
    setError('');
    setView('scan_progress');

    try {
      setScanStatus('Preprocessing image...');
      setScanProgress(20);
      
      // Create a new canvas to extract the selected area
      const extractCanvas = document.createElement('canvas');
      const ctx = extractCanvas.getContext('2d');
      
      // Calculate the actual coordinates in the original image
      const img = imageRef.current;
      const scaleX = img.naturalWidth / canvasRef.current.width;
      const scaleY = img.naturalHeight / canvasRef.current.height;
      
      const actualX = selectionArea.x * scaleX;
      const actualY = selectionArea.y * scaleY;
      const actualWidth = selectionArea.width * scaleX;
      const actualHeight = selectionArea.height * scaleY;
      
      // Set extract canvas size to the selection area
      extractCanvas.width = actualWidth;
      extractCanvas.height = actualHeight;
      
      // Draw only the selected portion
      ctx.drawImage(
        img, 
        actualX, actualY, actualWidth, actualHeight, 
        0, 0, actualWidth, actualHeight
      );
      
      // Get the cropped image data URL
      const croppedImage = extractCanvas.toDataURL('image/jpeg');
      
      // Process the selected area
      const imageToProcess = await ImageJS.load(croppedImage);
      let processedImage = imageToProcess.grey();
      const mask = processedImage.mask({ algorithm: 'li' });
      processedImage = mask;
      const imageForTesseract = processedImage.toDataURL();

      setScanStatus('Recognizing text...');
      const { data: { text } } = await workerRef.current.recognize(imageForTesseract);

      setScanStatus('Parsing items...');
      setScanProgress(95);

      const items = parseReceipt(text);
      if (items.length === 0) {
        throw new Error("Could not parse any items. Please try again with a clearer image or select a different area.");
      }
      
      setParsedItems(items);
      setView('edit');
      setScanProgress(100);
      setScanStatus('Scan complete!');
      
    } catch (err) {
      setError(err.message || 'An error occurred during scanning.');
      console.error('OCR Error:', err);
      setView('select_area');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.match('image.*')) {
        setError('Please select an image file (JPEG, PNG, etc.)');
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('Image is too large. Please select an image smaller than 10MB.');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imageDataUrl = reader.result;
          setImage(imageDataUrl);
          setView('confirm');
          setError(''); // Clear any previous errors
        } catch (error) {
          console.error('Error loading image:', error);
          setError('Failed to load the selected image. Please try a different file.');
        }
      };
      
      reader.onerror = () => {
        console.error('FileReader error:', reader.error);
        setError('Failed to read the selected file. Please try again.');
      };
      
      reader.readAsDataURL(file);
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...parsedItems];
    const item = newItems[index];

    if (field === 'quantity' || field === 'price') {
      const numValue = parseFloat(value);
      item[field] = isNaN(numValue) ? 0 : numValue;
    } else {
      item[field] = value;
    }
    
    setParsedItems(newItems);
  };
  
  const handleRemoveItem = (index) => {
    setParsedItems(parsedItems.filter((_, i) => i !== index));
  };
  
  const handleSaveItems = async () => {
    setIsLoading(true);
    setError('');
    try {
        await onItemsScanned(parsedItems, image);
        onClose();
    } catch (err) {
        setError('Failed to save items. Please try again.');
        console.error('Error saving items:', err);
    } finally {
        setIsLoading(false);
    }
  };
  
  // Area selection handlers
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsSelecting(true);
    setStartPoint({ x, y });
    setSelectionArea({ x, y, width: 0, height: 0 });
  };
  
  const handleMouseMove = (e) => {
    if (!isSelecting) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate selection dimensions
    const width = Math.abs(x - startPoint.x);
    const height = Math.abs(y - startPoint.y);
    
    // Calculate top-left corner of selection
    const selX = Math.min(startPoint.x, x);
    const selY = Math.min(startPoint.y, y);
    
    setSelectionArea({ 
      x: selX, 
      y: selY, 
      width, 
      height 
    });
  };
  
  const handleMouseUp = () => {
    setIsSelecting(false);
    
    // If selection is too small, reset to full image
    if (selectionArea.width < 20 || selectionArea.height < 20) {
      if (canvasRef.current) {
        setSelectionArea({
          x: 0,
          y: 0,
          width: canvasRef.current.width,
          height: canvasRef.current.height
        });
      }
    }
  };
  
  // Handle touch events for mobile support
  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    handleMouseDown({
      clientX: touch.clientX,
      clientY: touch.clientY
    });
  };
  
  const handleTouchMove = (e) => {
    if (e.touches.length !== 1 || !isSelecting) return;
    const touch = e.touches[0];
    handleMouseMove({
      clientX: touch.clientX,
      clientY: touch.clientY
    });
  };
  
  const handleTouchEnd = () => {
    handleMouseUp();
  };
  
  // Trigger file input click
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  if (!isOpen) return null;

  const renderUploadView = () => (
    <div>
      <h3 className="text-lg font-semibold text-gray-200 mb-4">Upload a Receipt</h3>
      <div 
        className="border-2 border-dashed border-gray-600 p-6 text-center rounded-lg cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={triggerFileInput}
      >
        <SafeIcon icon={FiUpload} className="mx-auto h-12 w-12 text-gray-500" />
        <p className="mt-2 text-sm text-gray-400">
          {isWorkerReady 
            ? 'Click to select an image of your receipt' 
            : 'Initializing scanner, please wait...'
          }
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Supported formats: JPG, PNG, WEBP (max 10MB)
        </p>
        <input 
          ref={fileInputRef}
          type="file" 
          accept="image/*" 
          onChange={handleFileChange} 
          className="hidden" 
          disabled={!isWorkerReady || isLoading} 
        />
      </div>
      <div className="mt-6 text-gray-400 text-sm">
        <h4 className="font-medium mb-2">For best results:</h4>
        <ol className="list-decimal list-inside space-y-1">
          <li>Take a clear, well-lit photo of your receipt</li>
          <li>Ensure the text is horizontal and not blurry</li>
          <li>You'll be able to select the items area for better scanning accuracy</li>
        </ol>
      </div>
    </div>
  );

  const renderConfirmView = () => (
    <div>
      <h3 className="text-lg font-semibold text-gray-200 mb-4">Confirm Image</h3>
      <div className="flex justify-center items-center mb-4 border border-gray-700 rounded-lg overflow-hidden bg-gray-800">
        <img src={image} alt="Receipt preview" className="max-w-full max-h-64 object-contain" />
      </div>
      <div className="flex gap-4 mt-4">
        <button onClick={() => { setView('upload'); setImage(null); }} className="w-full flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">
          <SafeIcon icon={FiRepeat} />
          Change
        </button>
        <button onClick={() => setView('select_area')} disabled={isLoading || !isWorkerReady} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed">
          <SafeIcon icon={FiCrop} />
          Select Area
        </button>
      </div>
    </div>
  );

  const renderSelectAreaView = () => (
    <div>
      <h3 className="text-lg font-semibold text-gray-200 mb-4">Select Items Area</h3>
      <p className="text-sm text-gray-400 mb-3">Drag to select the area containing items and prices for better scanning accuracy.</p>
      <div 
        ref={containerRef}
        className="flex justify-center items-center mb-4 border border-gray-700 rounded-lg overflow-hidden bg-gray-800 relative"
        style={{ height: '350px' }}
      >
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      </div>
      <div className="flex gap-4 mt-4">
        <button onClick={() => { setView('confirm'); }} className="w-full flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">
          <SafeIcon icon={FiRepeat} />
          Back
        </button>
        <button 
          onClick={handleScan} 
          disabled={isLoading || !isWorkerReady || selectionArea.width < 10 || selectionArea.height < 10} 
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          <SafeIcon icon={FiCamera} />
          {isLoading ? 'Scanning...' : 'Scan Selected Area'}
        </button>
      </div>
    </div>
  );

  const renderScanProgressView = () => (
      <div className="text-center space-y-4 flex flex-col items-center justify-center h-full">
        <h3 className="text-lg font-semibold text-gray-200">{scanStatus}</h3>
        <div className="w-full bg-gray-600 rounded-full h-2.5 mt-2">
            <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${scanProgress}%` }}></div>
        </div>
        <p className="text-sm text-gray-400">Please wait while we analyze the selected area...</p>
      </div>
  );


  const renderEditView = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-200">Review Scanned Items</h3>
        <button onClick={() => { setView('upload'); setError(''); }} className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300">
            <SafeIcon icon={FiRefreshCw} /> Scan New Receipt
        </button>
      </div>
      <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-3">
        {parsedItems.map((item, index) => (
          <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_80px_80px_40px] gap-2 items-center bg-gray-800 p-2 rounded-lg">
            <input
              type="text"
              value={item.name}
              onChange={(e) => handleItemChange(index, 'name', e.target.value)}
              className="bg-gray-700 text-white rounded p-2 focus:ring-2 focus:ring-blue-500 border-none w-full"
              placeholder="Item Name"
            />
            <input
              type="number"
              value={item.quantity}
              onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
              className="bg-gray-700 text-white rounded p-2 focus:ring-2 focus:ring-blue-500 border-none w-full"
              placeholder="Qty"
            />
            <input
              type="number"
              step="0.01"
              value={item.price}
              onChange={(e) => handleItemChange(index, 'price', e.target.value)}
              className="bg-gray-700 text-white rounded p-2 focus:ring-2 focus:ring-blue-500 border-none w-full"
              placeholder="Price"
            />
            <button onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-400 p-2 rounded-full flex justify-center items-center">
              <SafeIcon icon={FiTrash2} />
            </button>
          </div>
        ))}
      </div>
      <button onClick={handleSaveItems} disabled={isLoading || parsedItems.length === 0} className="w-full flex justify-center items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200 disabled:bg-gray-500">
        <SafeIcon icon={FiSave} />
        Save to Inventory
      </button>
    </div>
  );

  const renderContent = () => {
    if (error) {
        return (
            <div className="text-center">
                <div className="bg-red-800 text-white p-3 mb-4 rounded-lg">{error}</div>
                <button onClick={() => { setError(''); setView(view === 'scan_progress' ? 'select_area' : 'upload'); }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">
                    Try Again
                </button>
            </div>
        )
    }

    switch(view) {
        case 'upload': return renderUploadView();
        case 'confirm': return renderConfirmView();
        case 'select_area': return renderSelectAreaView();
        case 'scan_progress': return renderScanProgressView();
        case 'edit': return renderEditView();
        default: return renderUploadView();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
      <div className="bg-gray-900 text-white rounded-xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center border-b border-gray-700 pb-3 mb-4">
          <h2 className="text-xl font-bold text-gray-100">Receipt Scanner</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <SafeIcon icon={FiX} className="h-6 w-6" />
          </button>
        </div>
        <div className="flex-grow overflow-y-auto pr-2">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default ReceiptScannerModal;