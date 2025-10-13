import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createWorker } from 'tesseract.js';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { FiUpload, FiX, FiCrop, FiCheck, FiRefreshCw, FiTrash2, FiSave, FiArrowLeft, FiCamera } from 'react-icons/fi';
import { Image as ImageJS } from 'image-js';
import { parseReceipt } from '../utils/receipt-parser';
import SafeIcon from '../common/SafeIcon';
import supabase from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const ReceiptScannerModal = ({ isOpen, onClose, onItemsScanned }) => {
  const [image, setImage] = useState(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState('');
  const [scannedText, setScannedText] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState('upload'); // 'upload', 'crop', 'confirm', 'edit'
  const [parsedItems, setParsedItems] = useState([]);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [croppedImageSrc, setCroppedImageSrc] = useState(null);

  const imgRef = useRef(null);
  const workerRef = useRef(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!isOpen) {
      setImage(null);
      setCrop(undefined);
      setCompletedCrop(null);
      setScanProgress(0);
      setScanStatus('');
      setScannedText('');
      setError('');
      setIsLoading(false);
      setView('upload');
      setParsedItems([]);
      setCroppedImageSrc(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const setupWorker = async () => {
      setScanStatus('Initializing scanner...');
      setIsWorkerReady(false);
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
    };

    if (isOpen) {
      setupWorker();
    }

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      setIsWorkerReady(false);
    };
  }, [isOpen]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImage(reader.result?.toString() || '');
        setView('crop');
        setError('');
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const onImageLoad = (e) => {
    const { width, height } = e.currentTarget;
    const initialCrop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, 16 / 9, width, height),
      width,
      height
    );
    setCrop(initialCrop);
  };

  const getCroppedImg = async (sourceImage, crop) => {
    const image = await ImageJS.load(sourceImage);
    const cropped = image.crop({
      x: Math.round(crop.x),
      y: Math.round(crop.y),
      width: Math.round(crop.width),
      height: Math.round(crop.height),
    });
    return cropped;
  };

  const handleConfirmCrop = async () => {
    if (!completedCrop || !imgRef.current) {
      setError('Please select an area to scan.');
      return;
    }
    if (completedCrop.width === 0 || completedCrop.height === 0) {
      setError('Invalid crop selection. Please select a valid area.');
      return;
    }
    
    setError('');

    const imageElement = imgRef.current;
    const scaleX = imageElement.naturalWidth / imageElement.width;
    const scaleY = imageElement.naturalHeight / imageElement.height;

    const pixelCrop = {
      x: completedCrop.x * scaleX,
      y: completedCrop.y * scaleY,
      width: completedCrop.width * scaleX,
      height: completedCrop.height * scaleY,
    };

    const croppedImage = await getCroppedImg(image, pixelCrop);
    setCroppedImageSrc(croppedImage.toDataURL());
    setView('confirm');
  };

  const handleScan = async () => {
    if (!croppedImageSrc) {
      setError('No cropped image to scan.');
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
      const imageToProcess = await ImageJS.load(croppedImageSrc);
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
        throw new Error("Could not parse any items. Please try again.");
      }
      
      setParsedItems(items);
      setView('edit');
      setScanProgress(100);
      setScanStatus('Scan complete!');
      
    } catch (err) {
      setError(err.message || 'An error occurred during scanning.');
      console.error(err);
      setView('confirm');
    } finally {
      setIsLoading(false);
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

  if (!isOpen) return null;

  const renderUploadView = () => (
    <div>
      <h3 className="text-lg font-semibold text-gray-200 mb-4">Upload a Receipt</h3>
      <div className="border-2 border-dashed border-gray-600 p-6 text-center rounded-lg relative">
        <SafeIcon icon={FiUpload} className="mx-auto h-12 w-12 text-gray-500" />
        <p className="mt-2 text-sm text-gray-400">Drag & drop or click to upload</p>
        <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
      </div>
      <div className="mt-6 prose prose-invert prose-sm text-gray-400 max-w-none">
        <h4>Instructions:</h4>
        <ol>
          <li>Take a clear, well-lit photo of your receipt.</li>
          <li>Ensure the text is horizontal and not blurry.</li>
          <li>Upload the image file (JPEG, PNG).</li>
        </ol>
      </div>
    </div>
  );

  const renderCropView = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-200">Crop the Receipt</h3>
        <button onClick={() => { setImage(null); setView('upload'); }} className="text-gray-400 hover:text-white">
          <SafeIcon icon={FiRefreshCw} />
        </button>
      </div>
       {image && (
        <ReactCrop
          crop={crop}
          onChange={(_, percentCrop) => setCrop(percentCrop)}
          onComplete={(c) => setCompletedCrop(c)}
          aspect={null}
          className="max-h-[50vh] w-auto overflow-y-auto"
        >
          <img ref={imgRef} src={image} onLoad={onImageLoad} alt="Receipt" className="mx-auto" style={{ maxHeight: '60vh' }}/>
        </ReactCrop>
      )}
      <div className="prose prose-invert prose-sm text-gray-400 max-w-none">
        <p>Adjust the box to cover all the items you want to scan.</p>
      </div>
      <button onClick={handleConfirmCrop} disabled={!completedCrop} className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed">
        <SafeIcon icon={FiCrop} />
        Confirm Crop
      </button>
    </div>
  );
  
  const renderConfirmView = () => (
    <div className="space-y-4 text-center">
        <h3 className="text-lg font-semibold text-gray-200">Confirm Scan Area</h3>
        {croppedImageSrc && (
            <img src={croppedImageSrc} alt="Cropped Receipt" className="mx-auto border border-gray-600 rounded-lg" style={{ maxHeight: '50vh' }}/>
        )}
        <p className="text-sm text-gray-400">Press 'Scan' to extract items from this area.</p>
        <div className="flex gap-4">
            <button onClick={() => setView('crop')} className="w-full flex justify-center items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200">
                <SafeIcon icon={FiArrowLeft} />
                Back
            </button>
            <button onClick={handleScan} disabled={isLoading || !isWorkerReady} className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200 disabled:bg-gray-500">
                <SafeIcon icon={FiCamera} />
                {isWorkerReady ? 'Scan' : 'Initializing...'}
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
        <p className="text-sm text-gray-400">Please wait while we analyze the receipt...</p>
      </div>
  );


  const renderEditView = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-200">Review Scanned Items</h3>
        <button onClick={() => setView('confirm')} className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300">
            <SafeIcon icon={FiArrowLeft} /> Back to Confirm
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
        let backView = 'upload';
        if (view === 'crop') backView = 'upload';
        if (view === 'confirm') backView = 'crop';
        if (view === 'edit') backView = 'confirm';
        if (view === 'scan_progress') backView = 'confirm';

        return (
            <div className="text-center">
                <div className="bg-red-800 text-white p-3 mb-4 rounded-lg">{error}</div>
                <button onClick={() => { setError(''); setView(backView); }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">
                    Try Again
                </button>
            </div>
        )
    }

    switch(view) {
        case 'upload': return renderUploadView();
        case 'crop': return renderCropView();
        case 'confirm': return renderConfirmView();
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