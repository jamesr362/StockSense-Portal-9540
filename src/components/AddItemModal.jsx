import {motion,AnimatePresence} from 'framer-motion';
import {RiCloseLine} from 'react-icons/ri';
import {useState} from 'react';

export default function AddItemModal({isOpen,onClose,onAdd}) {
  const [formData,setFormData] = useState({
    name: '',
    category: '',
    quantity: '',
    description: '',
    unitPrice: '',
    dateAdded: new Date().toISOString().split('T')[0], // Default to today
  });
  const [isSubmitting,setIsSubmitting] = useState(false);
  const [error,setError] = useState('');

  const categories = [
    {value: '',label: 'Select a category'},
    {value: 'Electronics',label: '📱 Electronics'},
    {value: 'Clothing',label: '👕 Clothing & Apparel'},
    {value: 'Food & Beverages',label: '🍎 Food & Beverages'},
    {value: 'Home & Garden',label: '🏠 Home & Garden'},
    {value: 'Sports & Outdoors',label: '⚽ Sports & Outdoors'},
    {value: 'Books & Media',label: '📚 Books & Media'},
    {value: 'Health & Beauty',label: '💄 Health & Beauty'},
    {value: 'Automotive',label: '🚗 Automotive'},
    {value: 'Tools & Hardware',label: '🔧 Tools & Hardware'},
    {value: 'Office Supplies',label: '📎 Office Supplies'},
    {value: 'Toys & Games',label: '🎮 Toys & Games'},
    {value: 'Pet Supplies',label: '🐕 Pet Supplies'},
    {value: 'Jewelry & Accessories',label: '💍 Jewelry & Accessories'},
    {value: 'Art & Crafts',label: '🎨 Art & Crafts'},
    {value: 'Music & Instruments',label: '🎵 Music & Instruments'},
    {value: 'Baby & Kids',label: '👶 Baby & Kids'},
    {value: 'Furniture',label: '🪑 Furniture'},
    {value: 'Appliances',label: '🔌 Appliances'},
    {value: 'Medical & Healthcare',label: '🏥 Medical & Healthcare'},
    {value: 'Industrial',label: '🏭 Industrial'},
    {value: 'Other',label: '📦 Other'}
  ];

  const handleChange = (e) => {
    const {name,value} = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Clear any previous errors
    setError('');
    
    // Validate required fields
    if (!formData.name.trim()) {
      setError('Item name is required');
      return;
    }
    
    if (!formData.category) {
      setError('Please select a category');
      return;
    }
    
    if (!formData.quantity || formData.quantity === '') {
      setError('Quantity is required');
      return;
    }
    
    if (!formData.unitPrice || formData.unitPrice === '') {
      setError('Unit price is required');
      return;
    }

    // Parse and validate numeric values
    const quantity = parseInt(formData.quantity);
    const unitPrice = parseFloat(formData.unitPrice);

    if (isNaN(quantity) || quantity < 0) {
      setError('Please enter a valid quantity (0 or greater)');
      return;
    }

    if (isNaN(unitPrice) || unitPrice < 0) {
      setError('Please enter a valid unit price (0 or greater)');
      return;
    }

    // Auto-determine status based on quantity
    let status = 'In Stock';
    if (quantity === 0) {
      status = 'Out of Stock';
    } else if (quantity <= 10) {
      status = 'Limited Stock';
    }

    try {
      setIsSubmitting(true);

      // Create the item object with proper structure
      const newItem = {
        name: formData.name.trim(),
        category: formData.category,
        quantity: quantity,
        unitPrice: unitPrice,
        description: formData.description.trim() || '',
        status: status,
        dateAdded: formData.dateAdded
      };

      console.log('===AddItemModal: Submitting item===');
      console.log('Form data:',formData);
      console.log('Processed item:',newItem);
      console.log('=====================================');

      // Call the onAdd function - this should handle database saving
      await onAdd(newItem);

      // Reset form only after successful submission
      setFormData({
        name: '',
        category: '',
        quantity: '',
        description: '',
        unitPrice: '',
        dateAdded: new Date().toISOString().split('T')[0],
      });

      // Close modal - this is now handled by the parent component
      // onClose();

    } catch (error) {
      console.error('Error submitting form:',error);
      setError(error.message || 'Failed to add item. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      // Reset form when closing
      setFormData({
        name: '',
        category: '',
        quantity: '',
        description: '',
        unitPrice: '',
        dateAdded: new Date().toISOString().split('T')[0],
      });
      setError('');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          exit={{opacity: 0}}
          className="fixed inset-0 z-50 overflow-y-auto"
        >
          <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={handleClose} />
            
            <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
              &#8203;
            </span>
            
            <motion.div
              initial={{opacity: 0,scale: 0.95}}
              animate={{opacity: 1,scale: 1}}
              exit={{opacity: 0,scale: 0.95}}
              className="relative inline-block transform overflow-hidden rounded-lg bg-gray-800 px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle"
            >
              <div className="absolute right-0 top-0 pr-4 pt-4">
                <button
                  type="button"
                  className="rounded-md bg-gray-800 text-gray-400 hover:text-gray-300 focus:outline-none"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  <span className="sr-only">Close</span>
                  <RiCloseLine className="h-6 w-6" />
                </button>
              </div>

              <div className="sm:flex sm:items-start">
                <div className="mt-3 w-full text-center sm:mt-0 sm:text-left">
                  <h3 className="text-lg font-medium leading-6 text-white">Add New Item</h3>
                  
                  {/* Error Message */}
                  {error && (
                    <motion.div
                      initial={{opacity: 0,y: -10}}
                      animate={{opacity: 1,y: 0}}
                      className="mt-3 p-3 bg-red-900/50 border border-red-700 rounded-md"
                    >
                      <p className="text-red-300 text-sm">{error}</p>
                    </motion.div>
                  )}

                  <form onSubmit={handleSubmit} className="mt-6 space-y-4 sm:space-y-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-white">
                        Item Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        id="name"
                        required
                        disabled={isSubmitting}
                        className="mt-1 block w-full rounded-md border-gray-700 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 disabled:opacity-50"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Enter item name"
                        maxLength={100}
                      />
                    </div>

                    <div>
                      <label htmlFor="category" className="block text-sm font-medium text-white">
                        Category <span className="text-red-400">*</span>
                      </label>
                      <select
                        id="category"
                        name="category"
                        required
                        disabled={isSubmitting}
                        className="mt-1 block w-full rounded-md border-gray-700 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 disabled:opacity-50"
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

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="quantity" className="block text-sm font-medium text-white">
                          Quantity <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="number"
                          name="quantity"
                          id="quantity"
                          min="0"
                          max="1000000"
                          required
                          disabled={isSubmitting}
                          className="mt-1 block w-full rounded-md border-gray-700 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 disabled:opacity-50"
                          value={formData.quantity}
                          onChange={handleChange}
                          placeholder="0"
                        />
                        <p className="mt-1 text-xs text-gray-400">
                          Status auto-set: 0=Out of Stock, 1-10=Limited Stock, 11+=In Stock
                        </p>
                      </div>

                      <div>
                        <label htmlFor="dateAdded" className="block text-sm font-medium text-white">
                          Date Added <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="date"
                          name="dateAdded"
                          id="dateAdded"
                          required
                          disabled={isSubmitting}
                          className="mt-1 block w-full rounded-md border-gray-700 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 disabled:opacity-50"
                          value={formData.dateAdded}
                          onChange={handleChange}
                          max={new Date().toISOString().split('T')[0]} // Prevent future dates
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="unitPrice" className="block text-sm font-medium text-white">
                        Unit Price <span className="text-red-400">*</span>
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
                          max="1000000"
                          step="0.01"
                          required
                          disabled={isSubmitting}
                          className="block w-full rounded-md border-gray-700 bg-gray-700 pl-7 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2 disabled:opacity-50"
                          value={formData.unitPrice}
                          onChange={handleChange}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-white">
                        Description
                      </label>
                      <textarea
                        id="description"
                        name="description"
                        rows={3}
                        disabled={isSubmitting}
                        className="mt-1 block w-full rounded-md border-gray-700 bg-gray-700 text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 disabled:opacity-50"
                        value={formData.description}
                        onChange={handleChange}
                        placeholder="Optional description"
                        maxLength={500}
                      />
                    </div>

                    <div className="mt-5 sm:mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                      <button
                        type="button"
                        className="inline-flex w-full justify-center rounded-md border border-gray-600 bg-gray-700 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:w-auto sm:text-sm disabled:opacity-50"
                        onClick={handleClose}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="inline-flex w-full justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:w-auto sm:text-sm disabled:opacity-50"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Adding...
                          </>
                        ) : (
                          'Add Item'
                        )}
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