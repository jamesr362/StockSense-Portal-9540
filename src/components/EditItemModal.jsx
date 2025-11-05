import { motion, AnimatePresence } from 'framer-motion';
import { RiCloseLine, RiInformationLine } from 'react-icons/ri';
import { useState, useEffect } from 'react';

export default function EditItemModal({ isOpen, onClose, onSave, item }) {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    quantity: '',
    description: '',
    unitPrice: '',
    status: 'In Stock',
    dateAdded: '',
    vatIncluded: false,
    vatPercentage: '20.00'
  });

  const categories = [
    { value: 'Electronics', label: '📱 Electronics' },
    { value: 'Clothing', label: '👕 Clothing & Apparel' },
    { value: 'Food & Beverages', label: '🍎 Food & Beverages' },
    { value: 'Home & Garden', label: '🏠 Home & Garden' },
    { value: 'Sports & Outdoors', label: '⚽ Sports & Outdoors' },
    { value: 'Books & Media', label: '📚 Books & Media' },
    { value: 'Health & Beauty', label: '💄 Health & Beauty' },
    { value: 'Automotive', label: '🚗 Automotive' },
    { value: 'Tools & Hardware', label: '🔧 Tools & Hardware' },
    { value: 'Office Supplies', label: '📎 Office Supplies' },
    { value: 'Toys & Games', label: '🎮 Toys & Games' },
    { value: 'Pet Supplies', label: '🐕 Pet Supplies' },
    { value: 'Jewelry & Accessories', label: '💍 Jewelry & Accessories' },
    { value: 'Art & Crafts', label: '🎨 Art & Crafts' },
    { value: 'Music & Instruments', label: '🎵 Music & Instruments' },
    { value: 'Baby & Kids', label: '👶 Baby & Kids' },
    { value: 'Furniture', label: '🪑 Furniture' },
    { value: 'Appliances', label: '🔌 Appliances' },
    { value: 'Medical & Healthcare', label: '🏥 Medical & Healthcare' },
    { value: 'Industrial', label: '🏭 Industrial' },
    { value: 'Other', label: '📦 Other' }
  ];

  const statusOptions = [
    { value: 'In Stock', label: 'In Stock' },
    { value: 'Limited Stock', label: 'Limited Stock' },
    { value: 'Out of Stock', label: 'Out of Stock' }
  ];

  const vatRates = [
    { value: '0.00', label: '0% (Zero-rated)' },
    { value: '5.00', label: '5% (Reduced rate)' },
    { value: '20.00', label: '20% (Standard rate)' }
  ];

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || '',
        category: item.category || '',
        quantity: item.quantity?.toString() || '',
        description: item.description || '',
        unitPrice: item.unitPrice?.toString() || '',
        status: item.status || 'In Stock',
        dateAdded: item.dateAdded || new Date().toISOString().split('T')[0],
        vatIncluded: item.vatIncluded || false,
        vatPercentage: item.vatPercentage?.toString() || '20.00'
      });
    }
  }, [item]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleVatRateChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({
      ...prev,
      vatPercentage: value
    }));
  };

  // Calculate VAT breakdown for display
  const calculateVatBreakdown = () => {
    const unitPrice = parseFloat(formData.unitPrice) || 0;
    const vatPercentage = parseFloat(formData.vatPercentage) || 0;
    
    if (unitPrice === 0) return { priceExVat: 0, vatAmount: 0, priceIncVat: 0 };

    let priceExVat, vatAmount, priceIncVat;

    if (formData.vatIncluded) {
      // Price includes VAT
      priceIncVat = unitPrice;
      priceExVat = unitPrice / (1 + (vatPercentage / 100));
      vatAmount = priceIncVat - priceExVat;
    } else {
      // Price excludes VAT
      priceExVat = unitPrice;
      vatAmount = unitPrice * (vatPercentage / 100);
      priceIncVat = priceExVat + vatAmount;
    }

    return {
      priceExVat: Math.round(priceExVat * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      priceIncVat: Math.round(priceIncVat * 100) / 100
    };
  };

  const vatBreakdown = calculateVatBreakdown();

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const updatedItem = {
      ...item,
      ...formData,
      quantity: parseInt(formData.quantity),
      unitPrice: parseFloat(formData.unitPrice),
      vatPercentage: parseFloat(formData.vatPercentage)
    };
    
    onSave(updatedItem);
    onClose();
  };

  if (!item) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 overflow-y-auto"
        >
          <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={onClose} />
            <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
              &#8203;
            </span>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative inline-block transform overflow-hidden rounded-lg bg-gray-800 px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6 sm:align-middle"
            >
              <div className="absolute right-0 top-0 pr-4 pt-4">
                <button
                  type="button"
                  className="rounded-md bg-gray-800 text-gray-400 hover:text-gray-300 focus:outline-none"
                  onClick={onClose}
                >
                  <span className="sr-only">Close</span>
                  <RiCloseLine className="h-6 w-6" />
                </button>
              </div>

              <div className="sm:flex sm:items-start">
                <div className="mt-3 w-full text-center sm:mt-0 sm:text-left">
                  <h3 className="text-lg font-medium leading-6 text-white">Edit Item</h3>
                  <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-white">
                        Item Name
                      </label>
                      <input
                        type="text"
                        name="name"
                        id="name"
                        required
                        className="mt-1 block w-full rounded-md border-gray-700 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2"
                        value={formData.name}
                        onChange={handleChange}
                      />
                    </div>

                    <div>
                      <label htmlFor="category" className="block text-sm font-medium text-white">
                        Category
                      </label>
                      <select
                        id="category"
                        name="category"
                        required
                        className="mt-1 block w-full rounded-md border-gray-700 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2"
                        value={formData.category}
                        onChange={handleChange}
                      >
                        {categories.map((category) => (
                          <option key={category.value} value={category.value}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label htmlFor="quantity" className="block text-sm font-medium text-white">
                          Quantity
                        </label>
                        <input
                          type="number"
                          name="quantity"
                          id="quantity"
                          min="0"
                          required
                          className="mt-1 block w-full rounded-md border-gray-700 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2"
                          value={formData.quantity}
                          onChange={handleChange}
                        />
                      </div>

                      <div>
                        <label htmlFor="status" className="block text-sm font-medium text-white">
                          Status
                        </label>
                        <select
                          id="status"
                          name="status"
                          required
                          className="mt-1 block w-full rounded-md border-gray-700 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2"
                          value={formData.status}
                          onChange={handleChange}
                        >
                          {statusOptions.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* VAT Configuration Section */}
                    <div className="border-t border-gray-700 pt-4">
                      <h4 className="text-md font-medium text-white mb-4 flex items-center">
                        <RiInformationLine className="h-5 w-5 mr-2 text-blue-400" />
                        VAT Configuration
                      </h4>

                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center">
                            <input
                              id="vatIncluded"
                              name="vatIncluded"
                              type="checkbox"
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-gray-700 rounded"
                              checked={formData.vatIncluded}
                              onChange={handleChange}
                            />
                            <label htmlFor="vatIncluded" className="ml-2 block text-sm text-white">
                              Price includes VAT
                            </label>
                          </div>
                          <p className="mt-1 text-xs text-gray-400">
                            {formData.vatIncluded 
                              ? 'The unit price includes VAT' 
                              : 'The unit price excludes VAT'
                            }
                          </p>
                        </div>

                        <div>
                          <label htmlFor="vatRate" className="block text-sm font-medium text-white">
                            VAT Rate
                          </label>
                          <select
                            id="vatRate"
                            name="vatRate"
                            className="mt-1 block w-full rounded-md border-gray-700 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2"
                            value={formData.vatPercentage}
                            onChange={handleVatRateChange}
                          >
                            {vatRates.map((rate) => (
                              <option key={rate.value} value={rate.value}>
                                {rate.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="unitPrice" className="block text-sm font-medium text-white">
                        Unit Price {formData.vatIncluded ? '(Inc. VAT)' : '(Ex. VAT)'}
                      </label>
                      <div className="relative mt-1 rounded-md shadow-sm">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <span className="text-gray-400 sm:text-sm">£</span>
                        </div>
                        <input
                          type="number"
                          name="unitPrice"
                          id="unitPrice"
                          min="0"
                          step="0.01"
                          required
                          className="block w-full rounded-md border-gray-700 bg-gray-700 pl-7 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2"
                          value={formData.unitPrice}
                          onChange={handleChange}
                        />
                      </div>

                      {/* VAT Breakdown Display */}
                      {formData.unitPrice && parseFloat(formData.unitPrice) > 0 && (
                        <div className="mt-2 p-3 bg-gray-700/50 rounded-md border border-gray-600">
                          <h5 className="text-sm font-medium text-white mb-2">VAT Breakdown:</h5>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-gray-400">Price Ex. VAT:</span>
                              <div className="text-white font-medium">£{vatBreakdown.priceExVat.toFixed(2)}</div>
                            </div>
                            <div>
                              <span className="text-gray-400">VAT ({formData.vatPercentage}%):</span>
                              <div className="text-white font-medium">£{vatBreakdown.vatAmount.toFixed(2)}</div>
                            </div>
                            <div>
                              <span className="text-gray-400">Price Inc. VAT:</span>
                              <div className="text-white font-medium">£{vatBreakdown.priceIncVat.toFixed(2)}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label htmlFor="dateAdded" className="block text-sm font-medium text-white">
                        Date Added
                      </label>
                      <input
                        type="date"
                        name="dateAdded"
                        id="dateAdded"
                        required
                        className="mt-1 block w-full rounded-md border-gray-700 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2"
                        value={formData.dateAdded}
                        onChange={handleChange}
                        max={new Date().toISOString().split('T')[0]} // Prevent future dates
                      />
                    </div>

                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-white">
                        Description
                      </label>
                      <textarea
                        id="description"
                        name="description"
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-700 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2"
                        value={formData.description}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                      <button
                        type="submit"
                        className="inline-flex w-full justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                      >
                        Save Changes
                      </button>
                      <button
                        type="button"
                        className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-600 bg-gray-700 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                        onClick={onClose}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}