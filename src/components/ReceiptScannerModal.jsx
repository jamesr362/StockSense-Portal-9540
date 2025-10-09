import React, { useState, useCallback, useRef } from 'react';
    import { motion, AnimatePresence } from 'framer-motion';
    import { useDropzone } from 'react-dropzone';
    import Tesseract from 'tesseract.js';
    import ReactCrop from 'react-image-crop';
    import 'react-image-crop/dist/ReactCrop.css';

    import {
      RiCloseLine, RiUploadCloud2Line, RiRefreshLine, RiScissorsCutLine,
      RiSave3Line, RiCameraLine, RiAlertLine, RiCheckboxCircleLine, RiLoader4Line
    } from 'react-icons/ri';

    const ReceiptScannerModal = ({ isOpen, onClose, onSave }) => {
      const [image, setImage] = useState(null);
      const [crop, setCrop] = useState();
      const [completedCrop, setCompletedCrop] = useState(null);
      const [ocrResult, setOcrResult] = useState('');
      const [isProcessing, setIsProcessing] = useState(false);
      const [error, setError] = useState('');
      const [stage, setStage] = useState('upload'); // upload, crop, review
      const [items, setItems] = useState([]);
      const [processedImage, setProcessedImage] = useState(null);

      const imgRef = useRef(null);
      const videoRef = useRef(null);
      const canvasRef = useRef(null);

      const preprocessImage = async (imageSrc) => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;

            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
              const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
              data[i] = avg; // red
              data[i + 1] = avg; // green
              data[i + 2] = avg; // blue
            }
            ctx.putImageData(imageData, 0, 0);

            // Apply contrast
            ctx.filter = 'contrast(150%)';
            ctx.drawImage(canvas, 0, 0);

            resolve(canvas.toDataURL('image/jpeg'));
          };
          img.onerror = reject;
          img.src = imageSrc;
        });
      };

      const onDrop = useCallback(async (acceptedFiles) => {
        const file = acceptedFiles[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              setIsProcessing(true);
              setError('');
              const processed = await preprocessImage(e.target.result);
              setProcessedImage(processed);
              setImage(e.target.result);
              setStage('crop');
            } catch (err) {
              setError('Failed to process image.');
            } finally {
              setIsProcessing(false);
            }
          };
          reader.readAsDataURL(file);
        }
      }, []);

      const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': [] },
        multiple: false
      });

      const handleRecognize = async () => {
        if (!completedCrop || !imgRef.current) {
          setError('Please select an area to scan.');
          return;
        }

        setIsProcessing(true);
        setError('');
        setOcrResult('');

        const canvas = document.createElement('canvas');
        const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
        const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
        canvas.width = completedCrop.width * scaleX;
        canvas.height = completedCrop.height * scaleY;
        const ctx = canvas.getContext('2d');

        ctx.drawImage(
          imgRef.current,
          completedCrop.x * scaleX,
          completedCrop.y * scaleY,
          completedCrop.width * scaleX,
          completedCrop.height * scaleY,
          0,
          0,
          canvas.width,
          canvas.height
        );
        
        const croppedImageUrl = canvas.toDataURL('image/jpeg');

        try {
            const result = await Tesseract.recognize(croppedImageUrl, 'eng');
            setOcrResult(result.data.text);
            parseOcrResult(result.data.text);
            setStage('review');
        } catch (err) {
            setError('OCR processing failed. Please try again.');
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
      };

      const parseOcrResult = (text) => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const potentialItems = lines.map((line, index) => ({
          id: Date.now() + index,
          name: line.replace(/[\d,.$€£]+/g, '').trim(),
          quantity: 1,
          price: (line.match(/([\d,.]+)$/)?.[0] || '0').replace(',', '.'),
        })).filter(item => item.name && parseFloat(item.price) > 0);
        setItems(potentialItems);
      };

      const handleItemChange = (id, field, value) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
      };

      const handleSaveItems = () => {
        onSave(items.filter(item => item.name && item.quantity > 0 && item.price > 0));
        handleClose();
      };
      
      const handleClose = () => {
        setImage(null);
        setCrop(undefined);
        setCompletedCrop(null);
        setOcrResult('');
        setIsProcessing(false);
        setError('');
        setStage('upload');
        setItems([]);
        onClose();
      };

      return (
        <AnimatePresence>
          {isOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col text-white">
                <header className="p-4 flex justify-between items-center border-b border-gray-700">
                  <h2 className="text-xl font-semibold">Receipt Scanner</h2>
                  <button onClick={handleClose} className="text-gray-400 hover:text-white"><RiCloseLine size={24} /></button>
                </header>

                <main className="p-6 overflow-y-auto">
                    <canvas ref={canvasRef} className="hidden"></canvas>
                    {error && <div className="mb-4 p-3 bg-red-500/20 text-red-300 border border-red-500 rounded-md flex items-center"><RiAlertLine className="mr-2" />{error}</div>}
                    
                    {stage === 'upload' && (
                        <div {...getRootProps()} className="border-2 border-dashed border-gray-600 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 transition-colors">
                            <input {...getInputProps()} />
                            <RiUploadCloud2Line className="mx-auto text-gray-400" size={48} />
                            {isDragActive ? <p className="mt-4 text-lg">Drop the receipt here ...</p> : <p className="mt-4 text-lg">Drag & drop a receipt image, or click to select</p>}
                        </div>
                    )}

                    {stage === 'crop' && image && (
                      <div>
                        <p className="mb-4 text-center text-gray-300">Drag to select the area of the receipt containing line items.</p>
                        <ReactCrop crop={crop} onChange={c => setCrop(c)} onComplete={c => setCompletedCrop(c)}>
                          <img ref={imgRef} src={image} alt="Receipt preview" style={{ maxHeight: '60vh', objectFit: 'contain' }}/>
                        </ReactCrop>
                        <div className="mt-4 flex justify-center gap-4">
                          <button onClick={handleRecognize} disabled={isProcessing} className="px-6 py-2 bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-500 flex items-center gap-2">
                            {isProcessing ? <RiLoader4Line className="animate-spin" /> : <RiScissorsCutLine />}
                            {isProcessing ? 'Scanning...' : 'Scan Selected Area'}
                          </button>
                        </div>
                      </div>
                    )}

                    {stage === 'review' && (
                        <div>
                            <h3 className="text-lg font-semibold mb-3">Review Scanned Items</h3>
                            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                                {items.map((item, index) => (
                                    <div key={item.id} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center bg-gray-700/50 p-3 rounded-md">
                                        <input type="text" value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} placeholder="Item Name" className="bg-gray-900 border border-gray-600 rounded-md px-3 py-1.5 w-full"/>
                                        <div className="grid grid-cols-2 gap-3">
                                            <input type="number" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', e.target.value)} placeholder="Qty" className="bg-gray-900 border border-gray-600 rounded-md px-3 py-1.5 w-full"/>
                                            <input type="number" step="0.01" value={item.price} onChange={e => handleItemChange(item.id, 'price', e.target.value)} placeholder="Price" className="bg-gray-900 border border-gray-600 rounded-md px-3 py-1.5 w-full"/>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {items.length === 0 && <p className="text-center text-gray-400 py-8">No items were automatically detected. Please check the crop or try a clearer image.</p>}
                            <div className="mt-6 flex justify-end gap-4">
                               <button onClick={() => setStage('crop')} className="px-6 py-2 bg-gray-600 rounded-md hover:bg-gray-700">Back to Crop</button>
                               <button onClick={handleSaveItems} disabled={items.length === 0} className="px-6 py-2 bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-500 flex items-center gap-2">
                                  <RiSave3Line /> Save Items
                               </button>
                            </div>
                        </div>
                    )}
                </main>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      );
    };

    export default ReceiptScannerModal;