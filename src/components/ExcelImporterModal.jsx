import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RiFileExcelLine, RiCloseLine, RiUploadLine, RiDownloadLine, RiCheckLine, RiAlertLine, RiEditLine, RiDeleteBin6Line, RiInformationLine } from 'react-icons/ri';
import * as XLSX from 'xlsx';
import { validateFile, sanitizeInput, validateInventoryItem, logSecurityEvent } from '../utils/security';

export default function ExcelImporterModal({ isOpen, onClose, onItemsImported }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [mappedItems, setMappedItems] = useState([]);
  const [importStatus, setImportStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);
  const [editingItems, setEditingItems] = useState(false);
  const [columnMapping, setColumnMapping] = useState({
    name: '',
    category: '',
    quantity: '',
    unitPrice: '',
    description: '',
    status: '',
    dateAdded: ''
  });
  const [previewData, setPreviewData] = useState([]);
  const [currentStep, setCurrentStep] = useState('upload');
  const fileInputRef = useRef(null);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Security validation
    const fileValidation = validateFile(file);
    if (!fileValidation.isValid) {
      setErrorMessage(fileValidation.errors.join(', '));
      logSecurityEvent('FILE_UPLOAD_REJECTED', { 
        reason: fileValidation.errors.join(', '),
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });
      return;
    }

    setIsProcessing(true);
    setProcessProgress(10);
    setErrorMessage('');
    setValidationErrors([]);

    try {
      setUploadedFile(file);
      setProcessProgress(30);

      logSecurityEvent('FILE_UPLOAD_STARTED', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      // Read and parse file
      const data = await readExcelFile(file);
      setProcessProgress(60);

      if (!data || data.length === 0) {
        throw new Error('The file appears to be empty or contains no readable data.');
      }

      setParsedData(data);
      setPreviewData(data.slice(0, 10));
      setProcessProgress(100);
      setCurrentStep('mapping');

      logSecurityEvent('FILE_UPLOAD_SUCCESS', {
        fileName: file.name,
        rowCount: data.length
      });

    } catch (error) {
      console.error('File upload error:', error);
      setErrorMessage(error.message || 'Failed to process file. Please try again.');
      setImportStatus('error');
      logSecurityEvent('FILE_UPLOAD_ERROR', {
        fileName: file?.name,
        error: error.message
      });
    } finally {
      setIsProcessing(false);
      setProcessProgress(0);
    }
  };

  const readExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            defval: '',
            blankrows: false 
          });
          
          resolve(jsonData);
        } catch (error) {
          reject(new Error('Failed to parse file. Please ensure it\'s a valid spreadsheet.'));
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleColumnMapping = () => {
    if (!parsedData.length) return;

    const requiredColumns = ['name', 'quantity', 'unitPrice'];
    const missingRequired = requiredColumns.filter(col => !columnMapping[col]);
    if (missingRequired.length > 0) {
      setErrorMessage(`Please map the following required columns: ${missingRequired.join(', ')}`);
      return;
    }

    setIsProcessing(true);
    setProcessProgress(20);

    try {
      const headers = parsedData[0];
      const dataRows = parsedData.slice(1);
      const items = [];
      const errors = [];

      dataRows.forEach((row, index) => {
        const rowNumber = index + 2;
        
        try {
          const item = mapRowToItem(row, headers, rowNumber);
          if (item) {
            // Additional security validation
            const validation = validateInventoryItem(item);
            if (validation.isValid) {
              items.push(item);
            } else {
              errors.push({
                row: rowNumber,
                message: `Validation failed: ${validation.errors.join(', ')}`
              });
            }
          }
        } catch (error) {
          errors.push({
            row: rowNumber,
            message: error.message
          });
        }
        
        setProcessProgress(20 + (index / dataRows.length) * 60);
      });

      setMappedItems(items);
      setValidationErrors(errors);
      setProcessProgress(100);
      
      if (items.length > 0) {
        setCurrentStep('preview');
        setImportStatus('success');
        logSecurityEvent('DATA_MAPPING_SUCCESS', {
          totalRows: dataRows.length,
          validItems: items.length,
          errors: errors.length
        });
      } else {
        setErrorMessage('No valid items could be extracted from the file.');
        setImportStatus('error');
      }

    } catch (error) {
      console.error('Mapping error:', error);
      setErrorMessage('Failed to process the mapped data.');
      setImportStatus('error');
      logSecurityEvent('DATA_MAPPING_ERROR', { error: error.message });
    } finally {
      setIsProcessing(false);
      setProcessProgress(0);
    }
  };

  const mapRowToItem = (row, headers, rowNumber) => {
    const getValue = (columnKey) => {
      const columnIndex = headers.indexOf(columnMapping[columnKey]);
      return columnIndex >= 0 ? row[columnIndex] : '';
    };

    // Sanitize and validate inputs
    const name = sanitizeInput(String(getValue('name')).trim());
    const quantity = getValue('quantity');
    const unitPrice = getValue('unitPrice');

    if (!name) {
      throw new Error(`Row ${rowNumber}: Item name is required`);
    }

    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity < 0) {
      throw new Error(`Row ${rowNumber}: Invalid quantity "${quantity}"`);
    }

    const parsedPrice = parseFloat(String(unitPrice).replace(/[£$€¥₹,]/g, ''));
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      throw new Error(`Row ${rowNumber}: Invalid unit price "${unitPrice}"`);
    }

    const category = sanitizeInput(getValue('category') || 'Other');
    const description = sanitizeInput(getValue('description') || `Imported from ${uploadedFile?.name || 'spreadsheet'} on ${new Date().toLocaleDateString()}`);
    
    // Status mapping with sanitization
    let status = sanitizeInput(getValue('status') || 'In Stock');
    const statusLower = status.toLowerCase();
    if (statusLower.includes('out') || statusLower.includes('0') || parsedQuantity === 0) {
      status = 'Out of Stock';
    } else if (statusLower.includes('limited') || statusLower.includes('low') || parsedQuantity <= 10) {
      status = 'Limited Stock';
    } else {
      status = 'In Stock';
    }

    // Date handling with validation
    let dateAdded = getValue('dateAdded');
    if (dateAdded) {
      try {
        if (typeof dateAdded === 'number') {
          const excelDate = new Date((dateAdded - 25569) * 86400 * 1000);
          dateAdded = excelDate.toISOString().split('T')[0];
        } else {
          const parsed = new Date(dateAdded);
          if (isNaN(parsed.getTime())) {
            dateAdded = new Date().toISOString().split('T')[0];
          } else {
            dateAdded = parsed.toISOString().split('T')[0];
          }
        }
      } catch {
        dateAdded = new Date().toISOString().split('T')[0];
      }
    } else {
      dateAdded = new Date().toISOString().split('T')[0];
    }

    return {
      name,
      category,
      quantity: parsedQuantity,
      unitPrice: parsedPrice,
      description,
      status,
      dateAdded,
      sourceRow: rowNumber
    };
  };

  const handleEditItem = (index, field, value) => {
    const updatedItems = [...mappedItems];
    
    // Sanitize input values
    let sanitizedValue = value;
    if (field === 'name' || field === 'category' || field === 'description') {
      sanitizedValue = sanitizeInput(value);
    }
    
    if (field === 'unitPrice') {
      const numValue = parseFloat(sanitizedValue);
      updatedItems[index][field] = isNaN(numValue) ? 0 : Math.max(0, numValue);
    } else if (field === 'quantity') {
      const numValue = parseInt(sanitizedValue);
      updatedItems[index][field] = isNaN(numValue) ? 0 : Math.max(0, numValue);
    } else {
      updatedItems[index][field] = sanitizedValue;
    }
    
    setMappedItems(updatedItems);
  };

  const handleRemoveItem = (index) => {
    const updatedItems = mappedItems.filter((_, i) => i !== index);
    setMappedItems(updatedItems);
  };

  const handleConfirmImport = () => {
    if (mappedItems.length === 0) {
      setErrorMessage('No items to import.');
      return;
    }

    // Final validation before import
    const validItems = [];
    const finalErrors = [];

    mappedItems.forEach((item, index) => {
      const validation = validateInventoryItem(item);
      if (validation.isValid) {
        const { sourceRow, ...cleanItem } = item;
        validItems.push(cleanItem);
      } else {
        finalErrors.push(`Item ${index + 1}: ${validation.errors.join(', ')}`);
      }
    });

    if (finalErrors.length > 0) {
      setErrorMessage(`Validation errors: ${finalErrors.join('; ')}`);
      return;
    }

    logSecurityEvent('DATA_IMPORT_CONFIRMED', {
      itemCount: validItems.length,
      fileName: uploadedFile?.name
    });

    onItemsImported(validItems, uploadedFile?.name);
    handleClose();
  };

  const downloadTemplate = () => {
    const sampleData = [
      ['Item Name', 'Category', 'Quantity', 'Unit Price', 'Description', 'Status', 'Date Added'],
      ['Apple iPhone 15', 'Electronics', '5', '999.99', 'Latest iPhone model', 'In Stock', '2024-01-15'],
      ['Office Chair', 'Furniture', '10', '149.99', 'Ergonomic office chair', 'In Stock', '2024-01-10'],
      ['Coffee Beans', 'Food & Beverages', '25', '12.50', 'Premium arabica beans', 'Limited Stock', '2024-01-12'],
      ['Wireless Mouse', 'Electronics', '0', '29.99', 'Bluetooth wireless mouse', 'Out of Stock', '2024-01-08']
    ];

    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory Template');
    XLSX.writeFile(wb, 'Trackio_Inventory_Template.xlsx');
    
    logSecurityEvent('TEMPLATE_DOWNLOADED', {});
  };

  const handleClose = () => {
    setUploadedFile(null);
    setParsedData([]);
    setMappedItems([]);
    setPreviewData([]);
    setImportStatus('idle');
    setIsProcessing(false);
    setProcessProgress(0);
    setErrorMessage('');
    setValidationErrors([]);
    setEditingItems(false);
    setCurrentStep('upload');
    setColumnMapping({
      name: '',
      category: '',
      quantity: '',
      unitPrice: '',
      description: '',
      status: '',
      dateAdded: ''
    });
    onClose();
  };

  const getAvailableColumns = () => {
    if (!parsedData.length) return [];
    return parsedData[0] || [];
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
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
            className="relative w-full max-w-7xl bg-gray-800 rounded-lg shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div className="flex items-center">
                <RiFileExcelLine className="h-6 w-6 text-green-400 mr-2" />
                <h3 className="text-lg font-medium text-white">Secure Excel Import Wizard</h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={downloadTemplate}
                  className="text-gray-400 hover:text-gray-300 focus:outline-none p-2"
                  title="Download Template"
                >
                  <RiDownloadLine className="h-5 w-5" />
                </button>
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-300 focus:outline-none"
                >
                  <RiCloseLine className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="border-b border-gray-700 p-4">
              <div className="flex items-center justify-between">
                {['upload', 'mapping', 'preview', 'confirm'].map((step, index) => {
                  const stepNames = ['Secure Upload', 'Column Mapping', 'Data Validation', 'Confirm Import'];
                  const isActive = currentStep === step;
                  const isCompleted = ['upload', 'mapping', 'preview', 'confirm'].indexOf(currentStep) > index;
                  
                  return (
                    <div key={step} className="flex items-center">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                        isCompleted ? 'bg-green-600 text-white' : 
                        isActive ? 'bg-primary-600 text-white' : 
                        'bg-gray-600 text-gray-300'
                      }`}>
                        {isCompleted ? <RiCheckLine className="h-4 w-4" /> : index + 1}
                      </div>
                      <span className={`ml-2 text-sm ${isActive ? 'text-white' : 'text-gray-400'}`}>
                        {stepNames[index]}
                      </span>
                      {index < 3 && <div className="mx-4 w-8 h-0.5 bg-gray-600"></div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Step 1: Upload File */}
              {currentStep === 'upload' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h4 className="text-xl font-medium text-white mb-2">Secure File Upload</h4>
                    <p className="text-gray-400">Upload your inventory spreadsheet with built-in security validation</p>
                  </div>

                  {/* Security Notice */}
                  <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                    <div className="flex items-start">
                      <RiInformationLine className="h-5 w-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h5 className="text-blue-400 font-medium mb-2">Security Features Active</h5>
                        <ul className="text-blue-300 text-sm space-y-1">
                          <li>• File type validation (Excel, CSV, ODS only)</li>
                          <li>• File size limit enforcement (10MB max)</li>
                          <li>• Content sanitization and validation</li>
                          <li>• Security audit logging</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* File Upload Area */}
                  <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-gray-500 transition-colors">
                    {!uploadedFile ? (
                      <>
                        <RiUploadLine className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-white mb-2">Choose a file or drag it here</p>
                        <p className="text-gray-400 text-sm mb-4">
                          Supports: .xlsx, .xls, .csv, .ods (Max 10MB)
                        </p>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          accept=".xlsx,.xls,.csv,.ods"
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isProcessing}
                          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                        >
                          <RiUploadLine className="h-5 w-5 mr-2" />
                          Select File Securely
                        </button>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <RiFileExcelLine className="mx-auto h-12 w-12 text-green-400" />
                        <div>
                          <p className="text-white font-medium">{uploadedFile.name}</p>
                          <p className="text-gray-400 text-sm">
                            {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                          <div className="mt-2 text-xs text-green-400">
                            ✓ File validated and secure
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setUploadedFile(null);
                            setParsedData([]);
                            setCurrentStep('upload');
                          }}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Remove file
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Processing Progress */}
                  {isProcessing && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center">
                        <RiUploadLine className="h-6 w-6 text-primary-400 mr-2 animate-pulse" />
                        <span className="text-white">Securely processing file...</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-3">
                        <div
                          className="bg-primary-600 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${processProgress}%` }}
                        />
                      </div>
                      <p className="text-center text-gray-300 text-sm">{processProgress}% complete</p>
                    </div>
                  )}

                  {/* Template Download */}
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="flex items-start">
                      <RiInformationLine className="h-5 w-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h5 className="text-white font-medium mb-2">Need a template?</h5>
                        <p className="text-gray-300 text-sm mb-3">
                          Download our secure template with the correct format and sample data.
                        </p>
                        <button
                          onClick={downloadTemplate}
                          className="inline-flex items-center px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                        >
                          <RiDownloadLine className="h-4 w-4 mr-1" />
                          Download Secure Template
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Column Mapping */}
              {currentStep === 'mapping' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h4 className="text-xl font-medium text-white mb-2">Map Your Columns</h4>
                    <p className="text-gray-400">Match your spreadsheet columns to our secure inventory fields</p>
                  </div>

                  {/* Preview of uploaded data */}
                  {previewData.length > 0 && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h5 className="text-white font-medium mb-3">Preview of your data:</h5>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-600">
                              {previewData[0]?.map((header, index) => (
                                <th key={index} className="text-left py-2 px-3 text-gray-300 font-medium">
                                  {sanitizeInput(String(header))}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {previewData.slice(1, 4).map((row, rowIndex) => (
                              <tr key={rowIndex} className="border-b border-gray-600">
                                {row.map((cell, cellIndex) => (
                                  <td key={cellIndex} className="py-2 px-3 text-gray-300">
                                    {sanitizeInput(String(cell)).substring(0, 50)}{sanitizeInput(String(cell)).length > 50 ? '...' : ''}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Column Mapping */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries({
                      name: { label: 'Item Name', required: true },
                      quantity: { label: 'Quantity', required: true },
                      unitPrice: { label: 'Unit Price', required: true },
                      category: { label: 'Category', required: false },
                      description: { label: 'Description', required: false },
                      status: { label: 'Status', required: false },
                      dateAdded: { label: 'Date Added', required: false }
                    }).map(([key, config]) => (
                      <div key={key}>
                        <label className="block text-sm font-medium text-white mb-2">
                          {config.label}
                          {config.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        <select
                          value={columnMapping[key]}
                          onChange={(e) => setColumnMapping(prev => ({ ...prev, [key]: e.target.value }))}
                          className="w-full rounded-md border-gray-600 bg-gray-700 text-white text-sm p-2"
                        >
                          <option value="">-- Select Column --</option>
                          {getAvailableColumns().map((column, index) => (
                            <option key={index} value={column}>{sanitizeInput(String(column))}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between">
                    <button
                      onClick={() => setCurrentStep('upload')}
                      className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleColumnMapping}
                      disabled={isProcessing || !columnMapping.name || !columnMapping.quantity || !columnMapping.unitPrice}
                      className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                      {isProcessing ? 'Processing...' : 'Validate & Map Data'}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Preview Data */}
              {currentStep === 'preview' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xl font-medium text-white mb-2">Data Validation & Preview</h4>
                      <p className="text-gray-400">Review and edit your items after security validation</p>
                    </div>
                    <button
                      onClick={() => setEditingItems(!editingItems)}
                      className="flex items-center px-3 py-1 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm"
                    >
                      <RiEditLine className="h-4 w-4 mr-1" />
                      {editingItems ? 'Done Editing' : 'Edit Items'}
                    </button>
                  </div>

                  {/* Import Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-700 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-400">{mappedItems.length}</div>
                      <div className="text-gray-300 text-sm">Validated Items</div>
                    </div>
                    <div className="bg-gray-700 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-red-400">{validationErrors.length}</div>
                      <div className="text-gray-300 text-sm">Security Errors</div>
                    </div>
                    <div className="bg-gray-700 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-primary-400">
                        {formatCurrency(mappedItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0))}
                      </div>
                      <div className="text-gray-300 text-sm">Total Value</div>
                    </div>
                  </div>

                  {/* Validation Errors */}
                  {validationErrors.length > 0 && (
                    <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                      <h5 className="text-red-400 font-medium mb-2">Security Validation Errors:</h5>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {validationErrors.map((error, index) => (
                          <p key={index} className="text-red-300 text-sm">
                            {error.message}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Items Preview */}
                  <div className="bg-gray-700 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <div className="space-y-3">
                      {mappedItems.map((item, index) => (
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
                                  maxLength={100}
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">Quantity</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="1000000"
                                  value={item.quantity}
                                  onChange={(e) => handleEditItem(index, 'quantity', e.target.value)}
                                  className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">Unit Price (£)</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="1000000"
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={(e) => handleEditItem(index, 'unitPrice', e.target.value)}
                                  className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                                />
                              </div>
                              <div className="flex items-end">
                                <button
                                  onClick={() => handleRemoveItem(index)}
                                  className="px-2 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                                >
                                  <RiDeleteBin6Line className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between items-center">
                              <div className="flex-1">
                                <div className="flex items-center">
                                  <span className="text-white font-medium">{item.name}</span>
                                  <span className="text-gray-400 text-sm ml-2">({item.category})</span>
                                  <span className="text-primary-400 text-sm ml-2">Qty: {item.quantity}</span>
                                </div>
                                {item.description && (
                                  <p className="text-gray-400 text-xs mt-1">{item.description}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="text-primary-400 font-medium">
                                  {formatCurrency(item.unitPrice)}
                                </span>
                                <div className="text-xs text-gray-400">
                                  Total: {formatCurrency(item.quantity * item.unitPrice)}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <button
                      onClick={() => setCurrentStep('mapping')}
                      className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700"
                    >
                      Back to Mapping
                    </button>
                    <button
                      onClick={() => setCurrentStep('confirm')}
                      disabled={mappedItems.length === 0}
                      className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                      Proceed to Secure Import
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Confirm Import */}
              {currentStep === 'confirm' && (
                <div className="space-y-6 text-center">
                  <div>
                    <RiCheckLine className="mx-auto h-16 w-16 text-green-400 mb-4" />
                    <h4 className="text-xl font-medium text-white mb-2">Ready for Secure Import</h4>
                    <p className="text-gray-400">
                      {mappedItems.length} validated items will be securely added to your inventory
                    </p>
                  </div>

                  <div className="bg-gray-700 rounded-lg p-6">
                    <h5 className="text-white font-medium mb-4">Import Summary</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-2xl font-bold text-white">{mappedItems.length}</div>
                        <div className="text-gray-400">Total Items</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-white">
                          {new Set(mappedItems.map(item => item.category)).size}
                        </div>
                        <div className="text-gray-400">Categories</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-white">
                          {mappedItems.reduce((sum, item) => sum + item.quantity, 0)}
                        </div>
                        <div className="text-gray-400">Total Quantity</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-white">
                          {formatCurrency(mappedItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)).replace('£', '£')}
                        </div>
                        <div className="text-gray-400">Total Value</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center space-x-4">
                    <button
                      onClick={() => setCurrentStep('preview')}
                      className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700"
                    >
                      Back to Preview
                    </button>
                    <button
                      onClick={handleConfirmImport}
                      className="px-8 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                    >
                      Securely Import {mappedItems.length} Items
                    </button>
                  </div>
                </div>
              )}

              {/* Error Messages */}
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 rounded-md bg-red-900/50 p-4"
                >
                  <div className="flex items-center">
                    <RiAlertLine className="h-5 w-5 text-red-400 mr-2" />
                    <div className="text-sm text-red-200">{errorMessage}</div>
                  </div>
                </motion.div>
              )}

              {/* Processing Progress */}
              {isProcessing && currentStep === 'mapping' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center">
                    <RiFileExcelLine className="h-6 w-6 text-green-400 mr-2 animate-pulse" />
                    <span className="text-white">Securely processing spreadsheet data...</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-primary-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${processProgress}%` }}
                    />
                  </div>
                  <p className="text-center text-gray-300 text-sm">{processProgress}% complete</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}