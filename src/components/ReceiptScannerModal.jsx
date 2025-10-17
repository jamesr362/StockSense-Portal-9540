import React, { useState, useRef, useEffect } from 'react';
import { FiUpload, FiX, FiRefreshCw, FiTrash2, FiSave, FiCamera, FiRepeat, FiCrop, FiCheck, FiSkipForward, FiZap } from 'react-icons/fi';
import { parseReceipt } from '../utils/receipt-parser';
import SafeIcon from '../common/SafeIcon';
import { useAuth } from '../context/AuthContext';

// Image processing settings
const IMAGE_COMPRESSION = 0.7; // Higher quality for better OCR results
const MAX_IMAGE_SIZE = 1000; // Reduced size for faster processing
const OCR_TIMEOUT = 30000; // 30 seconds max for OCR processing

const ReceiptScannerModal = ({ isOpen, onClose, onItemsScanned }) => {
  const [image, setImage] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState('upload');
  const [parsedItems, setParsedItems] = useState([]);
  
  // Selection area state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 });
  const [selectedArea, setSelectedArea] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Refs for DOM elements
  const fileInputRef = useRef(null);
  const imageRef = useRef(null);
  const canvasRef = useRef(null);
  const imageContainerRef = useRef(null);
  const { user } = useAuth();
  const progressIntervalRef = useRef(null);
  const ocrTimeoutRef = useRef(null);
  const tesseractWorkerRef = useRef(null);
  
  // Store image dimensions once loaded
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [imageDataUrl, setImageDataUrl] = useState(null);
  
  // Speed mode - optimized but still accurate
  const [speedMode, setSpeedMode] = useState(true);
  
  // Fallback mode - use simpler OCR if full OCR fails
  const [fallbackMode, setFallbackMode] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, []);
  
  const clearAllTimers = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (ocrTimeoutRef.current) {
      clearTimeout(ocrTimeoutRef.current);
      ocrTimeoutRef.current = null;
    }
    if (tesseractWorkerRef.current) {
      try {
        tesseractWorkerRef.current.terminate();
      } catch (e) {
        console.log('Worker already terminated');
      }
      tesseractWorkerRef.current = null;
    }
  };
  
  const resetState = () => {
    setImage(null);
    setScanProgress(0);
    setScanStatus('');
    setError('');
    setIsLoading(false);
    setView('upload');
    setParsedItems([]);
    setSelectedArea(null);
    setSelectionMode(false);
    setIsDrawing(false);
    setImageDimensions({ width: 0, height: 0 });
    setImageDataUrl(null);
    setFallbackMode(false);
    
    clearAllTimers();
  };

  // Store image dimensions when image loads
  useEffect(() => {
    if (image && imageRef.current) {
      const updateDimensions = () => {
        if (imageRef.current) {
          const img = imageRef.current;
          
          // Use natural dimensions as fallback
          const width = img.clientWidth || img.naturalWidth || 300;
          const height = img.clientHeight || img.naturalHeight || 400;
          
          console.log("Updated image dimensions:", width, height);
          setImageDimensions({ width, height });
          
          // Also update canvas dimensions
          if (canvasRef.current) {
            canvasRef.current.width = width;
            canvasRef.current.height = height;
          }
        }
      };
      
      // Set initial dimensions after a small delay to ensure image is loaded
      setTimeout(updateDimensions, 200);
      
      // Add load event listener
      const imgElement = imageRef.current;
      imgElement.addEventListener('load', updateDimensions);
      
      // Add resize observer to track container size changes
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(updateDimensions);
        observer.observe(imgElement);
        return () => {
          observer.disconnect();
          if (imgElement) {
            imgElement.removeEventListener('load', updateDimensions);
          }
        };
      }
      
      return () => {
        if (imgElement) {
          imgElement.removeEventListener('load', updateDimensions);
        }
      };
    }
  }, [image, view]);

  // Main scan handler
  const handleScan = async () => {
    if (!image) {
      setError('No image to scan.');
      return;
    }

    setIsLoading(true);
    setScanStatus('Preparing image...');
    setScanProgress(5);
    setError('');
    setView('scan_progress');
    
    // Start a progress bar animation to show activity
    clearAllTimers();
    
    // Continuous progress updates for better user experience
    let fakeProgress = 5;
    progressIntervalRef.current = setInterval(() => {
      if (fakeProgress < 90) {
        const increment = speedMode ? 3 : 1; // Faster progress in speed mode
        fakeProgress += increment;
        setScanProgress(fakeProgress);
      }
    }, 300);

    try {
      // Process the image
      if (selectedArea) {
        console.log("Processing selected area");
        await processSelectedArea();
      } else {
        console.log("Processing full image");
        await processFullImage();
      }
    } catch (err) {
      console.error('Processing Error:', err);
      
      // Try fallback mode if not already in it
      if (!fallbackMode) {
        setFallbackMode(true);
        setError('First attempt failed. Trying simpler processing method...');
        setTimeout(() => handleScan(), 500); // Retry with fallback mode
      } else {
        setError('Unable to process the receipt. Please enter items manually.');
        setView('edit');
        setParsedItems([]);
      }
    } finally {
      setIsLoading(false);
      clearAllTimers();
    }
  };
  
  // Process the whole image
  const processFullImage = async () => {
    try {
      // Get image data
      const imageData = imageDataUrl || image;
      
      // Optimize the image
      const optimizedImageData = await optimizeImage(imageData);
      setScanProgress(15);
      setScanStatus('Analyzing receipt text...');
      
      // Perform OCR on the image
      const text = await performOCR(optimizedImageData);
      console.log("OCR Result length:", text ? text.length : 0);
      if (text && text.length > 0) {
        console.log("OCR Result sample:", text.slice(0, 100) + "...");
      }
      
      setScanProgress(80);
      setScanStatus('Extracting items...');
      
      // Parse the receipt text to extract items
      const items = parseReceipt(text || "");
      
      // Complete the scan
      setScanProgress(100);
      setScanStatus('Scan complete!');
      setParsedItems(items);
      setView('edit');
      
    } catch (error) {
      console.error("Image processing error:", error);
      throw error;
    }
  };
  
  // Process just the selected area - FIXED VERSION
  const processSelectedArea = async () => {
    try {
      setScanStatus('Processing selected area...');
      setScanProgress(10);
      
      if (!selectedArea) {
        throw new Error("No area selected");
      }
      
      console.log("Selected area:", selectedArea);
      
      // Safety check for dimensions
      if (!imageDimensions.width || !imageDimensions.height) {
        if (imageRef.current) {
          const width = imageRef.current.clientWidth || imageRef.current.naturalWidth || 300;
          const height = imageRef.current.clientHeight || imageRef.current.naturalHeight || 400;
          console.log("Using dimensions from ref:", width, height);
          setImageDimensions({ width, height });
        } else {
          console.error("No valid image dimensions available");
          throw new Error("Cannot determine image dimensions");
        }
      }
      
      // Create a temporary image and load it
      const tempImg = new Image();
      tempImg.crossOrigin = "Anonymous";
      
      // Wait for image to load
      await new Promise((resolve, reject) => {
        tempImg.onload = resolve;
        tempImg.onerror = () => reject(new Error("Failed to load image for cropping"));
        tempImg.src = imageDataUrl || image;
        
        // Set a timeout in case image loading hangs
        setTimeout(resolve, 3000);
      });
      
      console.log("Temp image loaded:", tempImg.naturalWidth, tempImg.naturalHeight);
      setScanProgress(20);
      
      // Create canvas for cropping
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Calculate scale factors between displayed image and actual image
      const scaleX = tempImg.naturalWidth / imageDimensions.width;
      const scaleY = tempImg.naturalHeight / imageDimensions.height;
      
      console.log("Image display dimensions:", imageDimensions.width, imageDimensions.height);
      console.log("Image natural dimensions:", tempImg.naturalWidth, tempImg.naturalHeight);
      console.log("Scale factors:", scaleX, scaleY);
      
      // Calculate crop coordinates with safety checks
      let cropX = Math.max(0, Math.round(selectedArea.startX * scaleX));
      let cropY = Math.max(0, Math.round(selectedArea.startY * scaleY));
      let cropWidth = Math.min(
        tempImg.naturalWidth - cropX,
        Math.round(Math.abs(selectedArea.endX - selectedArea.startX) * scaleX)
      );
      let cropHeight = Math.min(
        tempImg.naturalHeight - cropY,
        Math.round(Math.abs(selectedArea.endY - selectedArea.startY) * scaleY)
      );
      
      // Ensure minimum crop dimensions
      if (cropWidth < 50) cropWidth = Math.min(tempImg.naturalWidth - cropX, 50);
      if (cropHeight < 50) cropHeight = Math.min(tempImg.naturalHeight - cropY, 50);
      
      console.log("Crop dimensions:", cropX, cropY, cropWidth, cropHeight);
      
      // Set canvas dimensions
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      
      // Draw cropped image to canvas
      ctx.drawImage(
        tempImg,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
      );
      
      // Convert to data URL
      const croppedImageData = canvas.toDataURL('image/jpeg', 0.9);
      setScanProgress(30);
      
      // Apply image enhancement for better OCR
      const enhancedImageData = await enhanceImageForOCR(croppedImageData);
      setScanProgress(40);
      
      // Perform OCR on the cropped and enhanced image
      setScanStatus('Analyzing selected area text...');
      const text = await performOCR(enhancedImageData);
      
      console.log("Cropped area OCR result length:", text ? text.length : 0);
      if (text && text.length > 0) {
        console.log("Cropped OCR Result sample:", text.slice(0, 100) + "...");
      }
      
      setScanProgress(80);
      setScanStatus('Extracting items...');
      
      // Parse the receipt text to extract items
      const items = parseReceipt(text || "");
      
      // Complete the scan
      setScanProgress(100);
      setScanStatus('Scan complete!');
      setParsedItems(items);
      setView('edit');
      
    } catch (error) {
      console.error("Selected area processing error:", error);
      throw error;
    }
  };
  
  // Enhance image specifically for OCR
  const enhanceImageForOCR = async (imageData) => {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          
          // Draw original image
          ctx.drawImage(img, 0, 0);
          
          // Get image data for processing
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          
          // Apply processing for better OCR
          for (let i = 0; i < data.length; i += 4) {
            // Convert to grayscale with better weights
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            
            // Apply threshold to create high contrast black and white
            const threshold = 160;
            const value = gray > threshold ? 255 : 0;
            
            // Set RGB to the same value (black or white)
            data[i] = data[i + 1] = data[i + 2] = value;
          }
          
          // Put the processed data back
          ctx.putImageData(imgData, 0, 0);
          
          // Return enhanced image
          const enhancedImageData = canvas.toDataURL('image/jpeg', 0.9);
          resolve(enhancedImageData);
        };
        
        img.onerror = () => {
          console.error("Failed to load image for enhancement");
          resolve(imageData); // Return original if enhancement fails
        };
        
        img.src = imageData;
      } catch (err) {
        console.error("Image enhancement error:", err);
        resolve(imageData); // Return original if enhancement fails
      }
    });
  };
  
  // Perform OCR on an image
  const performOCR = async (imageData) => {
    try {
      // Load Tesseract.js dynamically
      const tesseractModule = await import('tesseract.js').catch(err => {
        console.error("Failed to import tesseract.js:", err);
        throw new Error("Failed to load OCR library");
      });
      
      const { createWorker } = tesseractModule;
      
      // Create worker with proper error handling
      const worker = await createWorker({
        logger: message => {
          console.log('OCR Progress:', message);
          
          // Update progress based on OCR status
          if (message.status === 'recognizing text') {
            const progress = message.progress * 0.6 + 0.2;
            setScanProgress(Math.floor(progress * 100));
          }
        },
        errorHandler: err => {
          console.error('OCR Error:', err);
        }
      });
      
      tesseractWorkerRef.current = worker;
      
      // Set timeout for OCR operation
      ocrTimeoutRef.current = setTimeout(() => {
        if (tesseractWorkerRef.current) {
          try {
            tesseractWorkerRef.current.terminate();
            tesseractWorkerRef.current = null;
          } catch (e) {
            console.log('Error terminating worker on timeout:', e);
          }
          throw new Error("OCR processing timed out");
        }
      }, OCR_TIMEOUT);
      
      // Initialize worker with optimizations - with proper error handling
      try {
        await worker.load();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        
        // Configure for speed based on mode
        const ocrParams = fallbackMode ? {
          tessedit_pageseg_mode: '1', // Auto page segmentation - fastest mode
          tessedit_ocr_engine_mode: '0', // Legacy engine only - most compatible
          tessjs_create_box: '0',
          tessjs_create_unlv: '0',
          tessjs_create_osd: '0',
        } : {
          tessedit_pageseg_mode: speedMode ? '1' : '3',
          tessedit_ocr_engine_mode: speedMode ? '1' : '2',
          tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$.,:%@&() -',
          tessjs_create_box: '0',
          tessjs_create_unlv: '0',
          tessjs_create_osd: '0',
        };
        
        await worker.setParameters(ocrParams);
        
        // Recognize text
        const result = await worker.recognize(imageData);
        
        // Clean up
        if (ocrTimeoutRef.current) {
          clearTimeout(ocrTimeoutRef.current);
          ocrTimeoutRef.current = null;
        }
        
        await worker.terminate();
        tesseractWorkerRef.current = null;
        
        return result.data.text;
      } catch (error) {
        console.error('OCR recognition error:', error);
        
        // Clean up on error
        if (tesseractWorkerRef.current) {
          try {
            await tesseractWorkerRef.current.terminate();
          } catch (e) {
            console.log('Error terminating worker:', e);
          }
          tesseractWorkerRef.current = null;
        }
        
        if (ocrTimeoutRef.current) {
          clearTimeout(ocrTimeoutRef.current);
          ocrTimeoutRef.current = null;
        }
        
        throw error;
      }
    } catch (error) {
      console.error('OCR initialization failed:', error);
      
      // Try fallback with direct text extraction if in fallback mode
      if (fallbackMode) {
        console.log("Using basic pattern recognition as ultimate fallback");
        return "FALLBACK MODE - Basic pattern recognition only";
      }
      
      throw error;
    }
  };
  
  // Optimize image for OCR processing
  const optimizeImage = async (imageDataUrl) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          console.log("Original image size:", img.naturalWidth, img.naturalHeight);
          
          // Calculate new dimensions while maintaining aspect ratio
          let width = img.naturalWidth;
          let height = img.naturalHeight;
          
          if (width > MAX_IMAGE_SIZE || height > MAX_IMAGE_SIZE) {
            if (width > height) {
              height = Math.round(height * (MAX_IMAGE_SIZE / width));
              width = MAX_IMAGE_SIZE;
            } else {
              width = Math.round(width * (MAX_IMAGE_SIZE / height));
              height = MAX_IMAGE_SIZE;
            }
          }
          
          console.log("Resized to:", width, height);
          
          // Create canvas for resizing
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          
          // Apply pre-processing for better OCR results
          // First draw the image normally
          ctx.drawImage(img, 0, 0, width, height);
          
          // For speed mode or fallback, apply more aggressive processing
          if (speedMode || fallbackMode) {
            // Get image data
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            // Apply contrast enhancement and thresholding
            for (let i = 0; i < data.length; i += 4) {
              // Grayscale conversion - weighted method (luminance)
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              let gray = 0.299 * r + 0.587 * g + 0.114 * b;
              
              // Apply contrast enhancement
              gray = gray < 128 ? gray * 0.8 : Math.min(255, gray * 1.2);
              
              // Apply thresholding for fallback mode
              if (fallbackMode) {
                gray = gray > 160 ? 255 : 0; // Binary threshold
              }
              
              data[i] = data[i + 1] = data[i + 2] = gray;
            }
            
            ctx.putImageData(imageData, 0, 0);
          }
          
          // Convert to JPEG with appropriate compression
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', IMAGE_COMPRESSION);
          resolve(optimizedDataUrl);
        } catch (err) {
          console.error("Error optimizing image:", err);
          resolve(imageDataUrl); // Fall back to original if optimization fails
        }
      };
      
      img.onerror = () => {
        console.error("Failed to load image for optimization");
        resolve(imageDataUrl); // Return original if we can't optimize
      };
      
      img.src = imageDataUrl;
      
      // Set a timeout to resolve anyway if loading takes too long
      setTimeout(() => resolve(imageDataUrl), 3000);
    });
  };
  
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      if (!file.type.match('image.*')) {
        setError('Please select an image file (JPEG, PNG, etc.)');
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        setError('Image is too large. Please select an image smaller than 10MB.');
        return;
      }
      
      // Use FileReader to get image data
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imageData = event.target.result;
          
          // Store both the image data URL and set the image state
          setImageDataUrl(imageData);
          setImage(imageData);
          
          // Reset other states
          setView('select_area');
          setError('');
          setSelectedArea(null);
          setSelectionMode(false);
          setImageDimensions({ width: 0, height: 0 });
          setFallbackMode(false);
          
        } catch (error) {
          console.error('Error loading image:', error);
          setError('Failed to load the selected image. Please try a different file.');
        }
      };
      
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleItemChange = (index, field, value) => {
    setParsedItems(items => {
      const newItems = [...items];
      if (field === 'quantity' || field === 'price') {
        const numValue = parseFloat(value);
        newItems[index][field] = isNaN(numValue) ? 0 : numValue;
      } else {
        newItems[index][field] = value;
      }
      return newItems;
    });
  };
  
  const handleRemoveItem = (index) => {
    setParsedItems(items => items.filter((_, i) => i !== index));
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

  // Add item manually
  const handleAddItem = () => {
    setParsedItems([...parsedItems, { name: '', quantity: 1, price: 0 }]);
  };
  
  // Area selection handlers - IMPROVED VERSION
  const startSelection = (e) => {
    if (!selectionMode) return;
    
    e.preventDefault();
    setIsDrawing(true);
    
    // Get coordinates relative to the image
    const rect = imageRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    
    setSelectionStart({ x, y });
    setSelectionEnd({ x, y });
    
    // Make sure canvas is sized correctly
    if (canvasRef.current && imageRef.current) {
      const canvas = canvasRef.current;
      canvas.width = imageRef.current.clientWidth || imageRef.current.offsetWidth;
      canvas.height = imageRef.current.clientHeight || imageRef.current.offsetHeight;
      
      // Store current dimensions
      setImageDimensions({
        width: canvas.width,
        height: canvas.height
      });
    }
  };
  
  const updateSelection = (e) => {
    if (!selectionMode || !isDrawing || !imageRef.current) return;
    
    e.preventDefault();
    
    // Get coordinates relative to the image
    const rect = imageRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    
    setSelectionEnd({ x, y });
    drawSelectionRect();
  };
  
  const endSelection = (e) => {
    if (!selectionMode || !isDrawing) return;
    
    e.preventDefault();
    setIsDrawing(false);
    
    // Calculate selection dimensions
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);
    
    // Only create selection if it's large enough
    if (width > 10 && height > 10) {
      const newSelection = {
        startX: Math.min(selectionStart.x, selectionEnd.x),
        startY: Math.min(selectionStart.y, selectionEnd.y),
        endX: Math.max(selectionStart.x, selectionEnd.x),
        endY: Math.max(selectionStart.y, selectionEnd.y)
      };
      
      setSelectedArea(newSelection);
      console.log("Selection created:", newSelection);
      
      // Store current dimensions
      if (imageRef.current) {
        const imgWidth = imageRef.current.clientWidth || imageRef.current.offsetWidth;
        const imgHeight = imageRef.current.clientHeight || imageRef.current.offsetHeight;
        
        console.log("Storing dimensions on selection:", imgWidth, imgHeight);
        setImageDimensions({ width: imgWidth, height: imgHeight });
      }
    }
    
    // Exit selection mode
    setSelectionMode(false);
  };
  
  const drawSelectionRect = () => {
    if (!canvasRef.current || !imageRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate rectangle coordinates
    const x = Math.min(selectionStart.x, selectionEnd.x);
    const y = Math.min(selectionStart.y, selectionEnd.y);
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);
    
    // Draw selection rectangle
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    // Fill with semi-transparent color
    ctx.fillStyle = 'rgba(37, 99, 235, 0.2)';
    ctx.fillRect(x, y, width, height);
    
    // Draw handles
    ctx.fillStyle = '#2563eb';
    const handleSize = 6;
    ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize); // Top-left
    ctx.fillRect(x + width - handleSize/2, y - handleSize/2, handleSize, handleSize); // Top-right
    ctx.fillRect(x - handleSize/2, y + height - handleSize/2, handleSize, handleSize); // Bottom-left
    ctx.fillRect(x + width - handleSize/2, y + height - handleSize/2, handleSize, handleSize); // Bottom-right
  };
  
  // Redraw selection area when view changes or dimensions update
  useEffect(() => {
    if ((view === 'select_area' || view === 'scan_progress') && selectedArea && canvasRef.current && imageRef.current) {
      // Update canvas size
      const canvas = canvasRef.current;
      const currentWidth = imageRef.current.clientWidth || imageRef.current.offsetWidth;
      const currentHeight = imageRef.current.clientHeight || imageRef.current.offsetHeight;
      
      if (canvas.width !== currentWidth || canvas.height !== currentHeight) {
        canvas.width = currentWidth;
        canvas.height = currentHeight;
        
        // Update stored dimensions
        if (imageDimensions.width !== currentWidth || imageDimensions.height !== currentHeight) {
          setImageDimensions({
            width: currentWidth,
            height: currentHeight
          });
        }
      }
      
      // Redraw selection
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        selectedArea.startX,
        selectedArea.startY,
        selectedArea.endX - selectedArea.startX,
        selectedArea.endY - selectedArea.startY
      );
      
      ctx.fillStyle = 'rgba(37, 99, 235, 0.2)';
      ctx.fillRect(
        selectedArea.startX,
        selectedArea.startY,
        selectedArea.endX - selectedArea.startX,
        selectedArea.endY - selectedArea.startY
      );
      
      // Draw handles
      ctx.fillStyle = '#2563eb';
      const handleSize = 6;
      ctx.fillRect(selectedArea.startX - handleSize/2, selectedArea.startY - handleSize/2, handleSize, handleSize); // Top-left
      ctx.fillRect(selectedArea.endX - handleSize/2, selectedArea.startY - handleSize/2, handleSize, handleSize); // Top-right
      ctx.fillRect(selectedArea.startX - handleSize/2, selectedArea.endY - handleSize/2, handleSize, handleSize); // Bottom-left
      ctx.fillRect(selectedArea.endX - handleSize/2, selectedArea.endY - handleSize/2, handleSize, handleSize); // Bottom-right
    }
  }, [view, selectedArea, imageDimensions]);

  if (!isOpen) return null;

  const renderUploadView = () => (
    <div>
      <h3 className="text-lg font-semibold text-gray-200 mb-4">Upload a Receipt</h3>
      <div
        onClick={triggerFileInput} 
        className={`w-full border-2 border-dashed border-gray-600 p-6 text-center rounded-lg transition-colors flex flex-col items-center justify-center ${!isLoading ? 'cursor-pointer hover:bg-gray-800/50' : 'cursor-not-allowed bg-gray-800/20'}`}
      >
        <SafeIcon icon={FiUpload} className="mx-auto h-12 w-12 text-gray-500" />
        <p className="mt-2 text-sm text-gray-400">
          Click to select an image of your receipt
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Supported formats: JPG, PNG, WEBP (max 10MB)
        </p>
      </div>
      <input 
        ref={fileInputRef}
        id="receipt-file-input"
        type="file" 
        accept="image/*" 
        onChange={handleFileChange} 
        className="hidden" 
        disabled={isLoading} 
        aria-label="Upload receipt image"
      />
      <div className="mt-6 text-gray-400 text-sm">
        <h4 className="font-medium mb-2">For best results:</h4>
        <ol className="list-decimal list-inside space-y-1">
          <li>Take a clear, well-lit photo of your receipt</li>
          <li>Ensure the text is horizontal and not blurry</li>
          <li>Make sure the receipt is flat and not wrinkled</li>
        </ol>
      </div>
      <div className="mt-4 text-center">
        <button
          onClick={triggerFileInput}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700"
          disabled={isLoading}
        >
          <SafeIcon icon={FiCamera} className="mr-2 -ml-1 h-5 w-5" />
          Select Receipt Photo
        </button>
      </div>
      
      <div className="mt-4 flex items-center justify-center gap-2">
        <input
          type="checkbox"
          id="speed-mode"
          checked={speedMode}
          onChange={() => setSpeedMode(!speedMode)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="speed-mode" className="text-sm text-blue-400 flex items-center">
          <SafeIcon icon={FiZap} className="mr-1 h-4 w-4" />
          Speed-optimized scanning
        </label>
      </div>
    </div>
  );

  const renderSelectAreaView = () => (
    <div>
      <h3 className="text-lg font-semibold text-gray-200 mb-2">Select Items Area (Optional)</h3>
      <p className="text-sm text-gray-400 mb-4">
        For faster and more accurate scanning, select just the area that contains the items and prices.
      </p>
      
      <div 
        ref={imageContainerRef}
        className="relative border border-gray-700 rounded-lg overflow-hidden bg-gray-800 mb-4"
      >
        <img 
          ref={imageRef}
          src={image} 
          alt="Receipt" 
          className={`max-w-full object-contain ${selectionMode ? 'cursor-crosshair' : 'cursor-default'}`}
          onMouseDown={startSelection}
          onMouseMove={updateSelection}
          onMouseUp={endSelection}
          onMouseLeave={endSelection}
          onTouchStart={(e) => {
            const touch = e.touches[0];
            startSelection({
              preventDefault: () => e.preventDefault(),
              clientX: touch.clientX,
              clientY: touch.clientY
            });
          }}
          onTouchMove={(e) => {
            const touch = e.touches[0];
            updateSelection({
              preventDefault: () => e.preventDefault(),
              clientX: touch.clientX,
              clientY: touch.clientY
            });
          }}
          onTouchEnd={(e) => {
            endSelection({
              preventDefault: () => e.preventDefault()
            });
          }}
          onLoad={(e) => {
            // Explicitly capture dimensions on load
            if (imageRef.current) {
              const width = imageRef.current.clientWidth || imageRef.current.offsetWidth || e.target.naturalWidth;
              const height = imageRef.current.clientHeight || imageRef.current.offsetHeight || e.target.naturalHeight;
              console.log("Image loaded with dimensions:", width, height);
              setImageDimensions({ width, height });
              
              if (canvasRef.current) {
                canvasRef.current.width = width;
                canvasRef.current.height = height;
              }
            }
          }}
          draggable="false"
        />
        <canvas 
          ref={canvasRef}
          className="absolute top-0 left-0 pointer-events-none"
          width={imageDimensions.width}
          height={imageDimensions.height}
        />
        {selectionMode && (
          <div className="absolute top-0 left-0 right-0 p-2 bg-black bg-opacity-50 text-center">
            <span className="text-white text-sm">
              Click and drag to select the items area
            </span>
          </div>
        )}
      </div>
      
      <div className="flex flex-wrap gap-2 mb-4">
        <button 
          onClick={() => {
            setSelectionMode(true);
            if (selectedArea) {
              setSelectedArea(null);
            }
          }}
          className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md ${selectionMode ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
        >
          <SafeIcon icon={FiCrop} className="h-4 w-4" />
          {selectionMode ? 'Drawing Selection...' : 'Select Area'}
        </button>
        
        {selectedArea && (
          <button 
            onClick={() => setSelectedArea(null)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-red-700 text-white rounded-md hover:bg-red-600"
          >
            <SafeIcon icon={FiX} className="h-4 w-4" />
            Clear Selection
          </button>
        )}
      </div>
      
      <div className="flex gap-4 mt-4">
        <button 
          onClick={() => { setView('upload'); setImage(null); setSelectedArea(null); }} 
          className="w-full flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg"
        >
          <SafeIcon icon={FiRepeat} />
          Change Image
        </button>
        <button 
          onClick={handleScan} 
          disabled={isLoading} 
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          {speedMode && <SafeIcon icon={FiZap} className="mr-1" />}
          <SafeIcon icon={selectedArea ? FiCheck : FiCamera} />
          {isLoading ? 'Scanning...' : selectedArea ? 'Scan Selected Area' : 'Scan Full Receipt'}
        </button>
      </div>
      
      <div className="mt-4 text-center">
        <button
          onClick={() => { setView('edit'); setParsedItems([]); }}
          className="text-blue-400 hover:text-blue-300 text-sm"
        >
          Skip scanning and enter items manually
        </button>
      </div>
    </div>
  );

  const renderScanProgressView = () => (
    <div className="text-center space-y-4 flex flex-col items-center justify-center h-full py-8">
      <h3 className="text-lg font-semibold text-gray-200">{scanStatus}</h3>
      <div className="w-full bg-gray-600 rounded-full h-2.5 mt-2">
        <div 
          className="bg-blue-500 h-2.5 rounded-full transition-all duration-300" 
          style={{ width: `${scanProgress}%` }}
        ></div>
      </div>
      <p className="text-sm text-gray-400">Please wait while we analyze your receipt...</p>
      
      <button
        onClick={() => { setView('edit'); setParsedItems([]); }}
        className="mt-4 text-blue-400 hover:text-blue-300 text-sm flex items-center"
      >
        <SafeIcon icon={FiSkipForward} className="mr-1" />
        Skip and enter items manually
      </button>
    </div>
  );

  const renderEditView = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-200">Review Items</h3>
        <button 
          onClick={() => { setView('upload'); setError(''); }} 
          className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
        >
          <SafeIcon icon={FiRefreshCw} /> Scan New Receipt
        </button>
      </div>
      <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-3">
        {parsedItems.length === 0 ? (
          <div className="text-center py-6 bg-gray-800 rounded-lg">
            <p className="text-gray-400">No items found. Try selecting a specific area or add items manually.</p>
          </div>
        ) : (
          parsedItems.map((item, index) => (
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
              <button 
                onClick={() => handleRemoveItem(index)} 
                className="text-red-500 hover:text-red-400 p-2 rounded-full flex justify-center items-center"
              >
                <SafeIcon icon={FiTrash2} />
              </button>
            </div>
          ))
        )}
        <button 
          onClick={handleAddItem}
          className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-dashed border-gray-600"
        >
          + Add Item
        </button>
      </div>
      <button 
        onClick={handleSaveItems} 
        disabled={isLoading || parsedItems.length === 0} 
        className="w-full flex justify-center items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200 disabled:bg-gray-500"
      >
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
          <button 
            onClick={() => { 
              setError(''); 
              setView(view === 'scan_progress' ? 'select_area' : 'upload');
            }} 
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
          >
            Try Again
          </button>
        </div>
      )
    }

    switch(view) {
      case 'upload': return renderUploadView();
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
          <h2 className="text-xl font-bold text-gray-100">
            {speedMode ? (
              <span className="flex items-center">
                <SafeIcon icon={FiZap} className="mr-2 text-yellow-400" />
                Optimized Receipt Scanner
              </span>
            ) : (
              "Receipt Scanner"
            )}
          </h2>
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