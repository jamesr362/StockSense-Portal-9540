import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createWorker } from 'tesseract.js';
import { ReactCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { FiUpload, FiX, FiCrop, FiRefreshCw, FiTrash2, FiSave, FiArrowLeft, FiCamera } from 'react-icons/fi';
import { parseReceipt } from '../utils/receipt-parser';
import SafeIcon from '../common/SafeIcon';

const ReceiptScannerModal = ({ isOpen, onClose, onItemsScanned }) => {
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState([]);
  const [view, setView] = useState('upload'); // 'upload', 'crop', 'edit'
  const [error, setError] = useState('');
  const imgRef = useRef(null);
  const workerRef = useRef(null);
  const canvasRef = useRef(null);

  const initializeWorker = async () => {
    try {
      const worker = await createWorker('eng');
      workerRef.current = worker;
    } catch (err) {
      console.error('Failed to initialize OCR worker', err);
      setError('Could not start scanner. Please try again.');
    }
  };

  useEffect(() => {
    if (isOpen) {
      initializeWorker();
    }
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [isOpen]);

  const onSelectFile = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined); 
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImgSrc(reader.result?.toString() || '');
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
    setCompletedCrop(initialCrop);
  };

  const handleScan = async () => {
    if (!completedCrop || !imgRef.current || !workerRef.current) return;
  
    setIsScanning(true);
    setError('');
  
    try {
        const image = imgRef.current;
        const canvas = canvasRef.current;
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;
  
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get canvas context');
        }

        const cropX = completedCrop.x * scaleX;
        const cropY = completedCrop.y * scaleY;
        const cropWidth = completedCrop.width * scaleX;
        const cropHeight = completedCrop.height * scaleY;
  
        canvas.width = cropWidth;
        canvas.height = cropHeight;

        // Binarization pre-processing
        ctx.drawImage(
            image,
            cropX,
            cropY,
            cropWidth,
            cropHeight,
            0,
            0,
            cropWidth,
            cropHeight
        );

        const imageData = ctx.getImageData(0, 0, cropWidth, cropHeight);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            const color = avg > 128 ? 255 : 0;
            data[i] = color;
            data[i + 1] = color;
            data[i + 2] = color;
        }
        ctx.putImageData(imageData, 0, 0);

      
        const { data: { text } } = await workerRef.current.recognize(canvas);
        const items = parseReceipt(text);
        setScannedItems(items);
        setView('edit');

    } catch (err) {
        console.error('Error during scanning:', err);
        setError('Failed to scan the image. Please try again.');
    } finally {
        setIsScanning(false);
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...scannedItems];
    if (field === 'price' || field === 'quantity') {
      const parsedValue = parseFloat(value);
      newItems[index][field] = isNaN(parsedValue) ? 0 : parsedValue;
    } else {
      newItems[index][field] = value;
    }
    setScannedItems(newItems);
  };

  const handleRemoveItem = (index) => {
    const newItems = scannedItems.filter((_, i) => i !== index);
    setScannedItems(newItems);
  };
  
  const handleSave = () => {
    onItemsScanned(scannedItems, imgSrc);
    resetState();
  };

  const resetState = () => {
    setImgSrc('');
    setCrop(undefined);
    setCompletedCrop(null);
    setScannedItems([]);
    setView('upload');
    setError('');
    setIsScanning(false);
    if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white">
            {view === 'upload' && 'Upload Receipt'}
            {view === 'crop' && 'Crop Receipt'}
            {view === 'edit' && 'Review Scanned Items'}
            </h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-white">
            <SafeIcon icon={FiX} className="text-2xl" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-md mb-4">{error}</div>}

          {view === 'upload' && (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-600 rounded-lg">
                <SafeIcon icon={FiUpload} className="text-5xl text-gray-500 mb-4" />
                <p className="text-gray-400 mb-4">Drag & drop or click to upload</p>
                <input type="file" accept="image/*" onChange={onSelectFile} className="hidden" id="file-upload" />
                <label htmlFor="file-upload" className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    Select File
                </label>
            </div>
          )}

          {view === 'crop' && imgSrc && (
            <div>
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={null}
                className="max-h-[60vh]"
              >
                <img
                  ref={imgRef}
                  src={imgSrc}
                  onLoad={onImageLoad}
                  alt="Receipt"
                  className="w-full h-auto"
                />
              </ReactCrop>
              <canvas ref={canvasRef} className="hidden"></canvas>
              <div className="flex justify-center mt-4">
                <button
                  onClick={handleScan}
                  disabled={isScanning || !completedCrop}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition duration-200 disabled:bg-gray-500"
                >
                  <SafeIcon icon={FiCamera} />
                  <span>{isScanning ? 'Scanning...' : 'Scan Selection'}</span>
                </button>
              </div>
            </div>
          )}

          {view === 'edit' && (
            <div>
              <div className="space-y-3 mb-4">
                {scannedItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center bg-gray-700/50 p-2 rounded-md">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                      className="col-span-1 md:col-span-2 bg-gray-900 border border-gray-600 rounded-md px-2 py-1 text-white"
                      placeholder="Item Name"
                    />
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      className="bg-gray-900 border border-gray-600 rounded-md px-2 py-1 text-white"
                      placeholder="Qty"
                    />
                    <div className="flex items-center">
                        <input
                            type="number"
                            step="0.01"
                            value={item.price}
                            onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                            className="bg-gray-900 border border-gray-600 rounded-md px-2 py-1 text-white w-full"
                            placeholder="Price"
                        />
                        <button onClick={() => handleRemoveItem(index)} className="ml-2 text-red-400 hover:text-red-300">
                            <SafeIcon icon={FiTrash2} />
                        </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-400 text-center mb-4">Review and edit the scanned items before saving.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end items-center p-4 border-t border-gray-700 space-x-3">
          {view === 'crop' && (
            <button
                onClick={() => setView('upload')}
                className="flex items-center gap-2 text-gray-300 hover:text-white"
            >
                <SafeIcon icon={FiArrowLeft} /> Back
            </button>
          )}

          {view === 'edit' && (
            <>
                <button
                    onClick={() => setView('crop')}
                    className="flex items-center gap-2 text-gray-300 hover:text-white"
                >
                    <SafeIcon icon={FiArrowLeft} /> Back to Crop
                </button>
                <button
                    onClick={handleSave}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
                >
                    <SafeIcon icon={FiSave} /> Save to Inventory
                </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceiptScannerModal;