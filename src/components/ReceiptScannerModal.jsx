import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createWorker } from 'tesseract.js';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { FiUpload, FiX, FiCrop, FiCheck, FiRefreshCw } from 'react-icons/fi';
import { Image as ImageJS } from 'image-js';
import { parseReceipt } from '../utils/receipt-parser';
import SafeIcon from '../common/SafeIcon';
import supabase from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const ReceiptScannerModal = ({ isOpen, onClose, onItemsScanned }) => {
  const [image, setImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [scannedText, setScannedText] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [parsedItems, setParsedItems] = useState([]);
  const imgRef = useRef(null);
  const [imageName, setImageName] = useState('');
  const { user } = useAuth();

  const resetState = useCallback(() => {
    setImage(null);
    setImageFile(null);
    setCrop(undefined);
    setCompletedCrop(null);
    setScannedText('');
    setIsScanning(false);
    setError('');
    setParsedItems([]);
    if (imgRef.current) {
      imgRef.current.src = '';
    }
    setImageName('');
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  const uploadReceiptToSupabase = async (file) => {
    if (!file || !user) return;
    const filePath = `${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, file);
    if (uploadError) {
      console.error('Error uploading receipt:', uploadError);
      setError('Failed to save the receipt image. Please try again.');
      return;
    }
    await supabase.from('receipts').insert({ user_id: user.id, storage_path: filePath, file_name: file.name });
  };

  const onSelectFile = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setImageName(file.name);
      setImageFile(file);
      const reader = new FileReader();
      reader.addEventListener('load', () => setImage(reader.result.toString()));
      reader.readAsDataURL(file);
      await uploadReceiptToSupabase(file);
    }
  };

  const handleScan = useCallback(async () => {
    if (!completedCrop || !imgRef.current) {
      setError('Please select an area to scan.');
      return;
    }
    setIsScanning(true);
    setError('');
    setScannedText('');
    setParsedItems([]);
    try {
      const image = imgRef.current;
      const canvas = document.createElement('canvas');
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      const cropX = completedCrop.x * scaleX;
      const cropY = completedCrop.y * scaleY;
      const cropWidth = completedCrop.width * scaleX;
      const cropHeight = completedCrop.height * scaleY;
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      const imageBuffer = canvas.toDataURL('image/png');
      const imgJs = await ImageJS.load(imageBuffer);
      const grey = imgJs.grey();
      const mask = grey.mask();
      const preprocessedImage = mask.toDataURL();
      const worker = await createWorker('eng');
      const { data: { text } } = await worker.recognize(preprocessedImage);
      await worker.terminate();
      setScannedText(text);
      const items = parseReceipt(text);
      setParsedItems(items);
      if (items.length === 0) {
        setError('Could not parse any items. For best results, crop tightly around the list of items.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during scanning. Please try again.');
    } finally {
      setIsScanning(false);
    }
  }, [completedCrop]);

  const handleAddItems = () => {
    onItemsScanned(parsedItems);
    onClose();
  };

  const handleRetry = () => {
    setScannedText('');
    setParsedItems([]);
    setError('');
    setCompletedCrop(null);
    setCrop(undefined);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-start p-4 pt-8 md:pt-12">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[calc(100vh-5rem)] flex flex-col text-white">
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-100">Receipt Scanner</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <SafeIcon icon={FiX} className="text-2xl" />
          </button>
        </div>

        <div className="flex-grow min-h-0 overflow-y-auto">
          {!image ? (
            <div className="flex flex-col justify-center items-center p-6 text-center h-full">
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 sm:p-12">
                <SafeIcon icon={FiUpload} className="text-4xl sm:text-5xl text-gray-500 mb-4" />
                <h3 className="text-lg sm:text-xl font-semibold mb-2">Upload a receipt image</h3>
                <p className="text-gray-400 mb-6 text-sm sm:text-base">Your receipt will be saved automatically for your records.</p>
                <input type="file" accept="image/*" onChange={onSelectFile} className="hidden" id="receipt-upload" />
                <label htmlFor="receipt-upload" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg cursor-pointer transition-all duration-300 transform hover:scale-105">
                  Select Image
                </label>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row gap-4 p-4">
              <div className="w-full md:w-1/2 flex flex-col bg-gray-900 p-2 sm:p-4 rounded-lg">
                <div className="flex-grow flex items-center justify-center overflow-hidden">
                  <ReactCrop crop={crop} onChange={(_, percentCrop) => setCrop(percentCrop)} onComplete={(c) => setCompletedCrop(c)} aspect={undefined}>
                    <img ref={imgRef} src={image} alt="Receipt" className="max-w-full max-h-[40vh] object-contain" />
                  </ReactCrop>
                </div>
                <div className="text-center mt-2">
                  <p className="text-xs sm:text-sm text-gray-400 truncate">{imageName}</p>
                </div>
              </div>
              <div className="w-full md:w-1/2 flex flex-col min-h-0">
                {isScanning && (
                  <div className="flex-grow flex flex-col justify-center items-center bg-gray-900 p-4 rounded-lg">
                    <p className="text-lg mb-4">Scanning...</p>
                    <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4 animate-spin border-t-indigo-500"></div>
                    <p className="text-gray-400 text-sm">Processing image, this may take a moment.</p>
                  </div>
                )}
                {!isScanning && parsedItems.length === 0 && (
                  <div className="h-full flex flex-col">
                    <div className="flex-grow flex flex-col justify-center items-center bg-gray-900 p-4 rounded-lg text-center">
                      <SafeIcon icon={FiCrop} className="text-4xl sm:text-5xl text-gray-500 mb-4" />
                      <h3 className="text-lg sm:text-xl font-semibold mb-2">Crop and Scan</h3>
                      <p className="text-gray-400 mb-4 sm:mb-6 px-2 sm:px-4 text-sm sm:text-base">
                        <span className="font-bold text-indigo-300">For best results,</span> draw a tight box around the list of items.
                      </p>
                      <button onClick={handleScan} disabled={!completedCrop || isScanning} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center">
                        Scan Receipt
                      </button>
                      {error && <p className="text-red-400 mt-4 text-sm">{error}</p>}
                    </div>
                  </div>
                )}
                {!isScanning && parsedItems.length > 0 && (
                  <div className="flex-grow flex flex-col bg-gray-900 p-4 rounded-lg min-h-0">
                    <h3 className="text-lg sm:text-xl font-semibold mb-3 text-gray-100">Scanned Items</h3>
                    <div className="flex-grow overflow-y-auto pr-2">
                      <table className="w-full text-xs sm:text-sm text-left text-gray-300">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-700 sticky top-0">
                          <tr>
                            <th scope="col" className="px-2 py-2">Item Name</th>
                            <th scope="col" className="px-2 py-2 text-right">Qty</th>
                            <th scope="col" className="px-2 py-2 text-right">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedItems.map((item, index) => (
                            <tr key={index} className="border-b border-gray-700 hover:bg-gray-800">
                              <td className="px-2 py-2 font-medium">{item.name}</td>
                              <td className="px-2 py-2 text-right">{item.quantity}</td>
                              <td className="px-2 py-2 text-right">${item.price.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-4 flex flex-col sm:flex-row gap-4">
                      <button onClick={handleRetry} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                        <SafeIcon icon={FiRefreshCw} /> Retry
                      </button>
                      <button onClick={handleAddItems} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                        <SafeIcon icon={FiCheck} /> Add Items
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceiptScannerModal;